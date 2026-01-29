# CXD Canvas Notification System Guide

## Overview
The notification system provides real-time user feedback for project events, system updates, and user actions. It supports both user-specific and global announcements with automatic real-time syncing.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Component│────▶│ Notification Lib │────▶│ Supabase DB     │
│  (Frontend)     │     │ & Edge Function  │     │ (notifications) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         ▲                                                 │
         │                                                 │
         └──────────────Real-time Sync───────────────────┘
```

---

## Quick Start

### 1. Trigger a Notification (Client-Side)

```typescript
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications';

// In your component or function
async function handleProjectSave(projectId: string) {
  const user = await getCurrentUser();
  
  await createNotification(
    user.id,
    'PROJECT_SAVED',
    'Your project has been saved successfully',
    { projectId, timestamp: new Date().toISOString() },
    24 // expires in 24 hours
  );
}
```

### 2. Display Notifications

```typescript
import { useNotifications } from '@/hooks/use-notifications';

function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  return (
    <div>
      <Badge>{unreadCount}</Badge>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          <h4>{notif.title}</h4>
          <p>{notif.message}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Available Notification Events

### Project Lifecycle
- `PROJECT_CREATED` - New project created
- `PROJECT_SAVED` - Project saved successfully
- `PROJECT_UPDATED` - Project data updated
- `PROJECT_DELETED` - Project removed
- `PROJECT_SHARED` - Project shared with link

### Wizard & Design Flow
- `WIZARD_COMPLETED` - Initiation wizard finished
- `CANVAS_INITIALIZED` - Canvas ready for use
- `FOCUS_MODE_ENTERED` - User entered focus mode

### Experience Flow
- `EXPERIENCE_FLOW_UPDATED` - Flow stages modified
- `STATE_TRAIT_ALIGNED` - State-trait alignment verified
- `STATE_TRAIT_WARNING` - Alignment issue detected

### Reality Planes & Sensory
- `REALITY_PLANES_CONFIGURED` - Reality plane sliders adjusted
- `SENSORY_DOMAINS_UPDATED` - Sensory domain values changed
- `PRESENCE_TYPES_ADJUSTED` - Presence type values modified

### Share & Collaboration
- `SHARE_LINK_GENERATED` - New share link created
- `PROJECT_VIEWED` - Someone viewed your shared project
- `COLLABORATION_INVITED` - Invited to collaborate

### Export & Data
- `EXPORT_COMPLETE` - Export (PDF/JSON) finished
- `EXPORT_FAILED` - Export failed
- `DATA_SYNC_SUCCESS` - Data synced to cloud
- `DATA_SYNC_FAILED` - Sync failed (retry needed)

### Validation & Errors
- `VALIDATION_ERROR` - Form or data validation failed
- `AUTOSAVE_SUCCESS` - Auto-save completed
- `AUTOSAVE_FAILED` - Auto-save failed
- `DRAFT_RECOVERED` - Draft restored after refresh

### System Announcements
- `SYSTEM_ANNOUNCEMENT` - General announcement
- `FEATURE_UPDATE` - New feature released
- `MAINTENANCE_NOTICE` - Scheduled maintenance
- `SYSTEM_UPGRADE` - System upgrade notice

### User Milestones
- `WELCOME_MESSAGE` - First-time user welcome
- `FIRST_PROJECT_MILESTONE` - First project created
- `TUTORIAL_COMPLETED` - Tutorial finished

---

## How to Add New Notification Events

### Step 1: Define Event in `src/lib/notifications.ts`

```typescript
export const NOTIFICATION_EVENTS = {
  // ... existing events
  
  // Add your new event
  YOUR_NEW_EVENT: { 
    type: 'success' as NotificationType, 
    title: 'Your Event Title' 
  },
} as const;
```

**Available Types:**
- `info` - General information (blue)
- `success` - Positive outcome (green)
- `warning` - Caution or error (yellow/red)
- `announcement` - System-wide announcement (purple)
- `update` - Feature update (blue)
- `project` - Project-specific event (teal)

### Step 2: Trigger the Event

```typescript
import { createNotification } from '@/lib/notifications';

async function yourFunction() {
  await createNotification(
    userId,                    // Target user ID
    'YOUR_NEW_EVENT',          // Event key from NOTIFICATION_EVENTS
    'Detailed message here',   // Custom message
    { extraData: 'value' },    // Optional metadata (JSON object)
    48                         // Expiration in hours (optional)
  );
}
```

### Step 3: Handle in UI (if needed)

```typescript
// Use the hook to access notifications
const { notifications } = useNotifications();

// Filter by type if needed
const projectNotifs = notifications.filter(n => n.type === 'project');

// Access metadata
notifications.forEach(notif => {
  console.log(notif.metadata.projectId);
});
```

---

## Common Use Cases

### 1. Project Save with Success Notification

```typescript
import { createNotification } from '@/lib/notifications';
import { useCXDStore } from '@/store/cxd-store';

async function saveProject() {
  const project = useCXDStore.getState().project;
  
  try {
    await saveToSupabase(project);
    
    await createNotification(
      userId,
      'PROJECT_SAVED',
      `Project "${project.title}" saved successfully`,
      { projectId: project.id }
    );
  } catch (error) {
    await createNotification(
      userId,
      'AUTOSAVE_FAILED',
      'Failed to save project. Please try again.',
      { error: error.message },
      1 // short expiration
    );
  }
}
```

### 2. Export Completion

```typescript
async function exportProject(format: 'pdf' | 'json') {
  try {
    const file = await generateExport(format);
    
    await createNotification(
      userId,
      'EXPORT_COMPLETE',
      `Your ${format.toUpperCase()} export is ready for download`,
      { 
        format, 
        fileUrl: file.url,
        fileName: file.name 
      },
      72 // 3 days
    );
  } catch (error) {
    await createNotification(
      userId,
      'EXPORT_FAILED',
      `Export failed: ${error.message}`,
      { format, error: error.message }
    );
  }
}
```

### 3. State-Trait Alignment Warning

```typescript
function validateStateTraitAlignment(states: any, traits: any) {
  const misalignments = detectMisalignments(states, traits);
  
  if (misalignments.length > 0) {
    createNotification(
      userId,
      'STATE_TRAIT_WARNING',
      `${misalignments.length} alignment issue(s) detected. Review your state-trait mapping.`,
      { misalignments },
      168 // 7 days
    );
  } else {
    createNotification(
      userId,
      'STATE_TRAIT_ALIGNED',
      'All states and traits are properly aligned',
      { validatedAt: new Date().toISOString() },
      24
    );
  }
}
```

### 4. Global Announcement (Admin Only)

```typescript
import { createGlobalAnnouncement } from '@/lib/notifications';

// Only admins should call this
async function announceNewFeature() {
  await createGlobalAnnouncement(
    'New Feature: Real-time Collaboration',
    'You can now collaborate with team members in real-time on the same canvas',
    'update',
    { 
      featureLink: '/docs/collaboration',
      releaseDate: '2024-02-01' 
    },
    30 // 30 days
  );
}
```

### 5. Share Link Generated

```typescript
async function generateShareLink(projectId: string) {
  const token = await createShareToken(projectId);
  const shareUrl = `${BASE_URL}/cxd/share/${token}`;
  
  await createNotification(
    userId,
    'SHARE_LINK_GENERATED',
    'Your share link has been created and copied to clipboard',
    { 
      projectId,
      shareUrl,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
    },
    720 // 30 days
  );
  
  navigator.clipboard.writeText(shareUrl);
}
```

---

## Server-Side Notifications (Edge Function)

For external services or webhooks that need to trigger notifications:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/push-notification \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Project Shared",
    "message": "Someone shared a project with you",
    "type": "project",
    "user_id": "user-uuid-here",
    "expires_in_days": 30,
    "metadata": {
      "projectId": "123",
      "sharedBy": "John Doe"
    }
  }'
```

---

## Best Practices

### 1. **Choose Appropriate Expiration Times**
- Success messages: 24-48 hours
- Warnings/errors: 1-7 days
- Feature updates: 30 days
- Critical announcements: 60-90 days

### 2. **Keep Messages Concise**
- Title: 3-5 words max
- Message: 1-2 sentences
- Use metadata for detailed data

### 3. **Use Metadata for Rich Context**
```typescript
await createNotification(userId, 'EXPORT_COMPLETE', 'Export ready', {
  format: 'pdf',
  fileUrl: '/downloads/project.pdf',
  fileName: 'CXD-Project-2024.pdf',
  fileSize: '2.4MB',
  timestamp: new Date().toISOString()
});
```

### 4. **Don't Spam Users**
- Batch similar notifications
- Use debouncing for auto-save notifications
- Avoid notifications for every keystroke

### 5. **Handle Errors Gracefully**
```typescript
try {
  await createNotification(...);
} catch (error) {
  console.error('Failed to create notification:', error);
  // Don't break the main flow if notification fails
}
```

---

## Real-Time Syncing

The `useNotifications` hook automatically syncs notifications in real-time using Supabase channels:

```typescript
// No polling needed - updates happen automatically
const { notifications, unreadCount } = useNotifications();

// Notifications array updates when:
// 1. Component mounts
// 2. New notification is inserted in the database
// 3. Notification is updated (e.g., marked as read)
```

---

## Testing Notifications

### Manual Test
```typescript
// Add this to any component temporarily
import { createNotification } from '@/lib/notifications';

async function testNotification() {
  const user = await supabase.auth.getUser();
  if (user.data.user) {
    await createNotification(
      user.data.user.id,
      'SYSTEM_ANNOUNCEMENT',
      'This is a test notification',
      { test: true }
    );
  }
}

// Call testNotification() from console or button
```

### Check Database
```sql
-- View all notifications
SELECT * FROM notifications ORDER BY created_at DESC;

-- View unread notifications for a user
SELECT * FROM notifications 
WHERE user_id = 'user-uuid' 
AND is_read = false;

-- View global announcements
SELECT * FROM notifications 
WHERE is_global = true;
```

---

## Troubleshooting

### Notifications Not Appearing
1. Check auth - user must be logged in
2. Verify notification was created in database
3. Check real-time subscription is active
4. Ensure component uses `useNotifications` hook

### Real-Time Not Working
1. Check Supabase project settings for real-time enabled
2. Verify database triggers are set up
3. Check browser console for connection errors

### Expired Notifications
Notifications automatically hide after `expires_at` timestamp. To clean up:
```sql
DELETE FROM notifications WHERE expires_at < NOW();
```

---

## Future Enhancements

- [ ] Push notifications (browser notifications API)
- [ ] Email digest for unread notifications
- [ ] Notification preferences per user
- [ ] Notification categories/filters
- [ ] Batch mark as read
- [ ] Notification sound/toast animations
