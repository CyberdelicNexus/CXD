import { createClient } from '@/supabase/client';

export type NotificationType = 'info' | 'success' | 'warning' | 'announcement' | 'update' | 'project';

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  is_global: boolean;
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string | null;
}

// System notification types that can be triggered
export const NOTIFICATION_EVENTS = {
  // Project-related
  PROJECT_CREATED: { type: 'project' as NotificationType, title: 'Project Created' },
  PROJECT_SAVED: { type: 'success' as NotificationType, title: 'Project Saved' },
  PROJECT_SHARED: { type: 'info' as NotificationType, title: 'Project Shared' },
  PROJECT_UPDATED: { type: 'project' as NotificationType, title: 'Project Updated' },
  PROJECT_DELETED: { type: 'warning' as NotificationType, title: 'Project Deleted' },
  
  // Wizard & Design Flow
  WIZARD_COMPLETED: { type: 'success' as NotificationType, title: 'Wizard Completed' },
  CANVAS_INITIALIZED: { type: 'info' as NotificationType, title: 'Canvas Ready' },
  FOCUS_MODE_ENTERED: { type: 'info' as NotificationType, title: 'Focus Mode Activated' },
  
  // Experience Flow
  EXPERIENCE_FLOW_UPDATED: { type: 'project' as NotificationType, title: 'Experience Flow Updated' },
  STATE_TRAIT_ALIGNED: { type: 'success' as NotificationType, title: 'State-Trait Alignment Verified' },
  STATE_TRAIT_WARNING: { type: 'warning' as NotificationType, title: 'Alignment Warning' },
  
  // Reality Planes & Sensory
  REALITY_PLANES_CONFIGURED: { type: 'project' as NotificationType, title: 'Reality Planes Configured' },
  SENSORY_DOMAINS_UPDATED: { type: 'project' as NotificationType, title: 'Sensory Domains Updated' },
  PRESENCE_TYPES_ADJUSTED: { type: 'project' as NotificationType, title: 'Presence Types Adjusted' },
  
  // Share & Collaboration
  SHARE_LINK_GENERATED: { type: 'success' as NotificationType, title: 'Share Link Created' },
  PROJECT_VIEWED: { type: 'info' as NotificationType, title: 'Project Viewed' },
  COLLABORATION_INVITED: { type: 'info' as NotificationType, title: 'Collaboration Invitation' },
  
  // Export & Data
  EXPORT_COMPLETE: { type: 'success' as NotificationType, title: 'Export Complete' },
  EXPORT_FAILED: { type: 'warning' as NotificationType, title: 'Export Failed' },
  DATA_SYNC_SUCCESS: { type: 'success' as NotificationType, title: 'Data Synced' },
  DATA_SYNC_FAILED: { type: 'warning' as NotificationType, title: 'Sync Failed' },
  
  // Validation & Errors
  VALIDATION_ERROR: { type: 'warning' as NotificationType, title: 'Validation Error' },
  AUTOSAVE_SUCCESS: { type: 'success' as NotificationType, title: 'Auto-saved' },
  AUTOSAVE_FAILED: { type: 'warning' as NotificationType, title: 'Auto-save Failed' },
  DRAFT_RECOVERED: { type: 'info' as NotificationType, title: 'Draft Recovered' },
  
  // System announcements (admin-triggered)
  SYSTEM_ANNOUNCEMENT: { type: 'announcement' as NotificationType, title: 'Announcement' },
  FEATURE_UPDATE: { type: 'update' as NotificationType, title: 'New Feature' },
  MAINTENANCE_NOTICE: { type: 'warning' as NotificationType, title: 'Maintenance Notice' },
  SYSTEM_UPGRADE: { type: 'update' as NotificationType, title: 'System Upgrade' },
  
  // User activity
  WELCOME_MESSAGE: { type: 'info' as NotificationType, title: 'Welcome to CXD Canvas!' },
  FIRST_PROJECT_MILESTONE: { type: 'success' as NotificationType, title: 'First Project Created!' },
  TUTORIAL_COMPLETED: { type: 'success' as NotificationType, title: 'Tutorial Completed' },
} as const;

/**
 * Fetch notifications for the current user
 * Includes both user-specific and global notifications
 */
export async function fetchNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${user.id},is_global.eq.true`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  // Filter out expired notifications
  const now = new Date();
  return (data || []).filter(n => !n.expires_at || new Date(n.expires_at) > now);
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  return !error;
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead(): Promise<boolean> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .or(`user_id.eq.${user.id},is_global.eq.true`);

  return !error;
}

/**
 * Create a notification for a specific user
 * Use this in your app code to trigger notifications
 */
export async function createNotification(
  userId: string,
  eventKey: keyof typeof NOTIFICATION_EVENTS,
  message: string,
  metadata: Record<string, any> = {},
  expiresInHours?: number
): Promise<boolean> {
  const supabase = createClient();
  const event = NOTIFICATION_EVENTS[eventKey];
  
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: event.title,
      message,
      type: event.type,
      is_global: false,
      metadata,
      expires_at: expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null,
    });

  if (error) {
    const msg = String((error as any)?.message ?? '');
    const details = String((error as any)?.details ?? '');
    if (msg.includes('Failed to fetch') || details.includes('Failed to fetch')) {
      return false;
    }
    console.error('Error creating notification:', error);
    return false;
  }
  return true;
}

/**
 * Create a global announcement (for all users)
 * This is what you'd call from admin/backend to push announcements
 */
export async function createGlobalAnnouncement(
  title: string,
  message: string,
  type: NotificationType = 'announcement',
  metadata: Record<string, any> = {},
  expiresInDays?: number
): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: null,
      title,
      message,
      type,
      is_global: true,
      metadata,
      expires_at: expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
    });

  if (error) {
    const msg = String((error as any)?.message ?? '');
    const details = String((error as any)?.details ?? '');
    if (msg.includes('Failed to fetch') || details.includes('Failed to fetch')) {
      return false;
    }
    console.error('Error creating global announcement:', error);
    return false;
  }
  return true;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  // In preview / blocked-network scenarios, auth.getUser can effectively be unavailable.
  if (userError || !user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.eq.${user.id},is_global.eq.true`)
    .eq('is_read', false);

  if (error) {
    const msg = String((error as any)?.message ?? '');
    const details = String((error as any)?.details ?? '');
    if (msg.includes('Failed to fetch') || details.includes('Failed to fetch')) {
      return 0;
    }
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Clear all notifications for current user
 */
export async function clearAllNotifications(): Promise<boolean> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    const msg = String((error as any)?.message ?? '');
    const details = String((error as any)?.details ?? '');
    if (msg.includes('Failed to fetch') || details.includes('Failed to fetch')) {
      return false;
    }
  }

  return !error;
}
