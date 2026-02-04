# Collaborative Canvas Architecture

## Overview

This document outlines the architecture for real-time collaborative editing of CXD canvases, enabling multiple users to work simultaneously on the same canvas with full synchronization, permissions, and presence awareness.

---

## 1. Architecture Overview

### 1.1 Technology Stack
- **Real-time Sync**: Supabase Realtime (Postgres Changes + Broadcast)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **State Management**: Zustand store with optimistic updates
- **Presence**: Supabase Realtime Presence API

### 1.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  Zustand    │◄──►│ useCollaboration│◄──►│   Supabase Realtime Client  │  │
│  │   Store     │    │     Hook        │    │   (Presence + Broadcast)    │  │
│  └─────────────┘    └─────────────────┘    └─────────────────────────────┘  │
│         ▲                    │                           │                   │
│         │                    ▼                           ▼                   │
│         │           ┌─────────────────┐        ┌────────────────────┐       │
│         │           │ Conflict        │        │  Cursor/Selection  │       │
│         │           │ Resolver        │        │  Renderer          │       │
│         │           └─────────────────┘        └────────────────────┘       │
│         │                                                                    │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌────────────────────┐   ┌────────────────────────────┐ │
│  │ Realtime     │   │   PostgreSQL       │   │       RLS Policies         │ │
│  │ Server       │   │   Database         │   │                            │ │
│  │ ─────────    │   │   ──────────       │   │ • canvas_collaborators     │ │
│  │ • Presence   │   │   • cxd_projects   │   │ • permission checks        │ │
│  │ • Broadcast  │   │   • collaborators  │   │ • subscription validation  │ │
│  │ • Changes    │   │   • invitations    │   │                            │ │
│  └──────────────┘   └────────────────────┘   └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Sync Strategy: "Last Write Wins" with Granular Updates

Instead of syncing the entire `project_data` JSONB on every change, we use:
1. **Granular field updates** - Only the specific changed field is broadcast
2. **Timestamps for ordering** - Each update carries a timestamp
3. **Optimistic UI** - Apply locally first, then sync
4. **Conflict resolution** - Last write wins at field level, not document level

---

## 2. Database Schema

### 2.1 New Tables

```sql
-- Canvas collaborators table
CREATE TABLE public.canvas_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'collaborator')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate entries
  CONSTRAINT unique_canvas_user UNIQUE (canvas_id, user_id)
);

-- Canvas invitations table
CREATE TABLE public.canvas_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_collaborators_canvas ON public.canvas_collaborators(canvas_id);
CREATE INDEX idx_collaborators_user ON public.canvas_collaborators(user_id);
CREATE INDEX idx_invitations_canvas ON public.canvas_invitations(canvas_id);
CREATE INDEX idx_invitations_token ON public.canvas_invitations(token);
CREATE INDEX idx_invitations_email ON public.canvas_invitations(invited_email);
```

### 2.2 Migration for Existing Data

```sql
-- Migrate existing projects: owners become collaborators with 'owner' role
INSERT INTO public.canvas_collaborators (canvas_id, user_id, role, added_at)
SELECT id, owner_id, 'owner', created_at
FROM public.cxd_projects
ON CONFLICT (canvas_id, user_id) DO NOTHING;
```

### 2.3 Updated RLS Policies

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.cxd_projects;

-- New policies that support collaboration
CREATE POLICY "Users can view owned and collaborated projects" ON public.cxd_projects
  FOR SELECT USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_collaborators
      WHERE canvas_id = id AND user_id = auth.uid()
    )
    OR (share_token IS NOT NULL AND share_token != '')
  );

CREATE POLICY "Users can insert own projects" ON public.cxd_projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update owned and collaborated projects" ON public.cxd_projects
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_collaborators
      WHERE canvas_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Only owners can delete projects" ON public.cxd_projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Collaborators table policies
ALTER TABLE public.canvas_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collaborators of their canvases" ON public.canvas_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.canvas_collaborators cc
      WHERE cc.canvas_id = canvas_id AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage collaborators" ON public.canvas_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

-- Invitations table policies
ALTER TABLE public.canvas_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage invitations" ON public.canvas_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view their pending invitations" ON public.canvas_invitations
  FOR SELECT USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  );
```

---

## 3. Invite Flow Logic

### 3.1 Sequence Diagram

```
Owner                    System                    Invitee
  │                        │                          │
  │ 1. Enter email         │                          │
  │───────────────────────►│                          │
  │                        │ 2. Validate:             │
  │                        │    - Owner has Pro/Life  │
  │                        │    - < max collaborators │
  │                        │    - Not already member  │
  │                        │                          │
  │                        │ 3. Create invitation     │
  │                        │    record with token     │
  │                        │                          │
  │                        │ 4. Send email with link  │
  │                        │──────────────────────────►
  │                        │                          │
  │                        │                     5. Click link
  │                        │◄──────────────────────────
  │                        │                          │
  │                        │ 6. Validate token:       │
  │                        │    - Not expired         │
  │                        │    - Not used            │
  │                        │    - Status = pending    │
  │                        │                          │
  │                        │ 7. If not logged in:     │
  │                        │    Store token, redirect │
  │                        │    to login/signup       │
  │                        │                          │
  │                        │ 8. On auth complete:     │
  │                        │    - Create collaborator │
  │                        │    - Mark token accepted │
  │                        │    - Redirect to canvas  │
  │                        │                          │
  │ 9. See new collaborator│                          │
  │◄───────────────────────│                          │
  │                        │                          │
```

### 3.2 API Endpoints

```typescript
// POST /api/canvas/invite
// Creates invitation and sends email
interface InviteRequest {
  canvasId: string;
  email: string;
}

// GET /api/canvas/invite/accept?token=xxx
// Validates and accepts invitation
// - If user logged in: accept immediately
// - If not: store token in session, redirect to auth

// DELETE /api/canvas/invite/:invitationId
// Revokes pending invitation

// DELETE /api/canvas/collaborator/:canvasId/:userId
// Removes collaborator (owner only)

// POST /api/canvas/leave/:canvasId
// Collaborator leaves canvas voluntarily
```

### 3.3 Invite Link Format
```
https://canvas.cyberdelic.design/invite?token={32-byte-hex-token}
```

---

## 4. Permission Enforcement Strategy

### 4.1 Permission Matrix

| Action                      | Owner | Collaborator | Viewer (share_token) |
|-----------------------------|-------|--------------|----------------------|
| View canvas                 | ✓     | ✓            | ✓                    |
| Edit content                | ✓     | ✓            | ✗                    |
| Add/remove elements         | ✓     | ✓            | ✗                    |
| Change canvas settings      | ✓     | ✗            | ✗                    |
| Invite collaborators        | ✓     | ✗            | ✗                    |
| Remove collaborators        | ✓     | ✗            | ✗                    |
| Delete canvas               | ✓     | ✗            | ✗                    |
| Generate/revoke share link  | ✓     | ✗            | ✗                    |
| Export canvas               | ✓     | ✓            | ✓ (if enabled)       |

### 4.2 Enforcement Layers

**Layer 1: Database (RLS)**
- All queries automatically filtered by RLS policies
- Prevents unauthorized data access at the lowest level

**Layer 2: API Routes**
- Validate user role before mutations
- Return appropriate HTTP errors (401/403)

**Layer 3: Client UI**
- Hide/disable unavailable actions
- Show clear permission indicators

### 4.3 Helper Functions

```typescript
// src/lib/collaboration.ts

type CanvasRole = 'owner' | 'collaborator' | 'viewer' | null;

interface CanvasPermissions {
  canEdit: boolean;
  canInvite: boolean;
  canRemoveCollaborators: boolean;
  canDelete: boolean;
  canChangeSettings: boolean;
  canExport: boolean;
}

export async function getCanvasRole(
  canvasId: string,
  userId: string
): Promise<CanvasRole> {
  // Check owner
  const { data: canvas } = await supabase
    .from('cxd_projects')
    .select('owner_id, share_token')
    .eq('id', canvasId)
    .single();

  if (!canvas) return null;
  if (canvas.owner_id === userId) return 'owner';

  // Check collaborator
  const { data: collab } = await supabase
    .from('canvas_collaborators')
    .select('role')
    .eq('canvas_id', canvasId)
    .eq('user_id', userId)
    .single();

  if (collab) return collab.role as CanvasRole;

  // Check share token (viewer)
  if (canvas.share_token) return 'viewer';

  return null;
}

export function getPermissions(role: CanvasRole): CanvasPermissions {
  switch (role) {
    case 'owner':
      return {
        canEdit: true,
        canInvite: true,
        canRemoveCollaborators: true,
        canDelete: true,
        canChangeSettings: true,
        canExport: true,
      };
    case 'collaborator':
      return {
        canEdit: true,
        canInvite: false,
        canRemoveCollaborators: false,
        canDelete: false,
        canChangeSettings: false,
        canExport: true,
      };
    case 'viewer':
      return {
        canEdit: false,
        canInvite: false,
        canRemoveCollaborators: false,
        canDelete: false,
        canChangeSettings: false,
        canExport: true, // Read-only export
      };
    default:
      return {
        canEdit: false,
        canInvite: false,
        canRemoveCollaborators: false,
        canDelete: false,
        canChangeSettings: false,
        canExport: false,
      };
  }
}
```

### 4.4 Plan-Based Gating

```typescript
// src/lib/collaboration.ts

export async function canAddCollaborator(
  ownerId: string,
  canvasId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Get owner's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('user_id', ownerId)
    .single();

  const planId = subscription?.plan_id || 'free';
  const plan = getPlan(planId);

  // Check if plan allows collaboration
  if (!plan.limits.hasCollaboration) {
    return {
      allowed: false,
      reason: 'Upgrade to Pro to invite collaborators'
    };
  }

  // Check collaborator count
  const { count } = await supabase
    .from('canvas_collaborators')
    .select('*', { count: 'exact', head: true })
    .eq('canvas_id', canvasId)
    .neq('role', 'owner');

  if ((count || 0) >= plan.limits.maxCollaborators) {
    return {
      allowed: false,
      reason: `Maximum ${plan.limits.maxCollaborators} collaborators reached`
    };
  }

  return { allowed: true };
}
```

---

## 5. Presence and Cursor Sharing

### 5.1 Presence Data Structure

```typescript
interface CollaboratorPresence {
  id: string;           // user ID
  name: string;         // display name
  email: string;        // for avatar fallback
  avatarUrl?: string;   // profile picture
  color: string;        // assigned color (consistent per session)
  cursor?: {
    x: number;
    y: number;
    timestamp: number;
  };
  selection?: {
    elementIds: string[];  // selected canvas elements
  };
  lastSeen: number;     // timestamp for cleanup
}
```

### 5.2 Supabase Realtime Channel Setup

```typescript
// src/hooks/use-collaboration.ts

export function useCollaboration(canvasId: string) {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!canvasId || !user) return;

    const channel = supabase.channel(`canvas:${canvasId}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: false },
      },
    });

    // Track presence
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<CollaboratorPresence>();
      const collaboratorList = Object.values(state).flat();
      setCollaborators(collaboratorList);
    });

    // Listen for canvas updates
    channel.on('broadcast', { event: 'canvas_update' }, ({ payload }) => {
      handleRemoteUpdate(payload);
    });

    // Subscribe and track own presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: user.id,
          name: user.user_metadata?.name || user.email,
          email: user.email,
          avatarUrl: user.user_metadata?.avatar_url,
          color: generateUserColor(user.id),
          lastSeen: Date.now(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [canvasId, user]);

  // Broadcast cursor position (throttled)
  const updateCursor = useCallback(
    throttle((x: number, y: number) => {
      channelRef.current?.track({
        cursor: { x, y, timestamp: Date.now() },
      });
    }, 50), // 20fps max
    []
  );

  // Broadcast selection changes
  const updateSelection = useCallback((elementIds: string[]) => {
    channelRef.current?.track({
      selection: { elementIds },
    });
  }, []);

  // Broadcast canvas changes
  const broadcastUpdate = useCallback((update: CanvasUpdate) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'canvas_update',
      payload: update,
    });
  }, []);

  return {
    collaborators,
    updateCursor,
    updateSelection,
    broadcastUpdate,
  };
}
```

### 5.3 Cursor Rendering

```typescript
// src/components/canvas/collaborator-cursors.tsx

interface CollaboratorCursorsProps {
  collaborators: CollaboratorPresence[];
  canvasOffset: { x: number; y: number };
  zoom: number;
}

export function CollaboratorCursors({
  collaborators,
  canvasOffset,
  zoom
}: CollaboratorCursorsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {collaborators
        .filter(c => c.cursor && Date.now() - c.cursor.timestamp < 5000)
        .map(collaborator => (
          <div
            key={collaborator.id}
            className="absolute transition-transform duration-75"
            style={{
              transform: `translate(
                ${(collaborator.cursor!.x - canvasOffset.x) * zoom}px,
                ${(collaborator.cursor!.y - canvasOffset.y) * zoom}px
              )`,
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={collaborator.color}
              className="drop-shadow-md"
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-5 top-5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.name}
            </div>
          </div>
        ))}
    </div>
  );
}
```

### 5.4 Color Assignment

```typescript
// Consistent color based on user ID
const COLLABORATOR_COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#34D399', // emerald
  '#22D3EE', // cyan
  '#818CF8', // indigo
  '#A78BFA', // violet
  '#F472B6', // pink
];

export function generateUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}
```

---

## 6. State Synchronization

### 6.1 Update Types

```typescript
type CanvasUpdate =
  | { type: 'field_update'; path: string[]; value: any; timestamp: number; userId: string }
  | { type: 'element_add'; element: CanvasElement; timestamp: number; userId: string }
  | { type: 'element_update'; elementId: string; changes: Partial<CanvasElement>; timestamp: number; userId: string }
  | { type: 'element_delete'; elementId: string; timestamp: number; userId: string }
  | { type: 'edge_add'; edge: CanvasEdge; timestamp: number; userId: string }
  | { type: 'edge_delete'; edgeId: string; timestamp: number; userId: string };
```

### 6.2 Optimistic Updates with Reconciliation

```typescript
// src/hooks/use-collaborative-sync.ts

export function useCollaborativeSync(canvasId: string) {
  const { broadcastUpdate } = useCollaboration(canvasId);
  const pendingUpdates = useRef<Map<string, CanvasUpdate>>(new Map());

  // Apply local change optimistically
  const applyLocalUpdate = useCallback((update: CanvasUpdate) => {
    // 1. Generate unique update ID
    const updateId = `${update.timestamp}-${update.userId}`;

    // 2. Apply to local state immediately
    applyUpdateToStore(update);

    // 3. Track pending update
    pendingUpdates.current.set(updateId, update);

    // 4. Broadcast to other clients
    broadcastUpdate(update);

    // 5. Persist to database (debounced)
    debouncedPersist();
  }, [broadcastUpdate]);

  // Handle remote update
  const handleRemoteUpdate = useCallback((update: CanvasUpdate) => {
    // Skip if this is our own update
    if (update.userId === currentUserId) return;

    // Apply to local state
    applyUpdateToStore(update);
  }, []);

  return { applyLocalUpdate, handleRemoteUpdate };
}
```

### 6.3 Conflict Resolution

For field-level conflicts (two users edit same field simultaneously):
- **Last write wins** - The update with the later timestamp overwrites
- **Preserve intent** - Users see their changes briefly, then reconcile

For element-level conflicts:
- **Delete wins** - If one user deletes while another edits, delete wins
- **Position conflicts** - Last position update wins

---

## 7. Security Considerations

### 7.1 Token Security
- Invitation tokens are 32-byte cryptographically random hex strings
- Tokens expire after 7 days
- Tokens are single-use (marked 'accepted' after use)
- Tokens can be revoked by owner

### 7.2 Rate Limiting
- Invite API: 10 invites per canvas per hour
- Cursor updates: Client-side throttle (50ms minimum)
- Canvas updates: Client-side debounce (1000ms for persist)

### 7.3 Input Validation
- Email validation on invite
- Canvas ID validation (UUID format)
- User role verification on all mutations

### 7.4 Audit Trail (Optional Future)
```sql
CREATE TABLE public.canvas_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.cxd_projects(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. Edge Cases

### 8.1 Owner Downgrades Plan
When owner's subscription expires/downgrades to Free:
- Existing collaborators retain read access for 30 days
- No new collaborators can be added
- Show banner: "Owner's plan expired. Collaboration limited."
- After 30 days: Collaborators lose access, data preserved

### 8.2 Collaborator Already Has Account
- Check if email matches existing user
- If yes: Create collaborator record directly, send notification
- If no: Create invitation, send email with signup flow

### 8.3 Simultaneous Edits to Same Element
- Both changes applied optimistically
- Last timestamp wins on reconciliation
- Brief visual flicker (acceptable trade-off for responsiveness)

### 8.4 Network Disconnection
- Optimistic updates queued locally
- Reconnection syncs pending updates
- Conflicts resolved with timestamps

### 8.5 User Leaves While Editing
- Presence automatically cleaned up (5 second stale timeout)
- Pending changes persisted before unload
- Other collaborators see user disappear

---

## 9. Implementation Order

1. **Phase 1: Database Schema** (Migration)
   - Create `canvas_collaborators` table
   - Create `canvas_invitations` table
   - Update RLS policies
   - Migrate existing owners

2. **Phase 2: API Routes**
   - `/api/canvas/invite` (create invitation)
   - `/api/canvas/invite/accept` (accept invitation)
   - `/api/canvas/collaborators` (list/manage)
   - Permission helper functions

3. **Phase 3: Realtime Sync**
   - `useCollaboration` hook
   - Supabase channel setup
   - Broadcast/receive updates

4. **Phase 4: Presence & Cursors**
   - Presence tracking
   - Cursor rendering
   - Selection indicators

5. **Phase 5: UI Integration**
   - Invite modal in canvas
   - Collaborator avatars
   - Permission-based UI states
   - Plan upgrade prompts

---

## 10. Testing Strategy

### Unit Tests
- Permission helper functions
- Color generation consistency
- Update conflict resolution

### Integration Tests
- Invite flow end-to-end
- RLS policy verification
- Realtime sync reliability

### Manual Testing
- Multi-browser simultaneous editing
- Network interruption recovery
- Plan downgrade scenarios
