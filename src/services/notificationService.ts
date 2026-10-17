import { supabase } from '../lib/supabase';
import { NotificationItem } from '../types/dairy';

export const notificationService = {
  async fetchNotifications(): Promise<NotificationItem[]> {
    // Optionally trigger background 24-hr cleanup
    this.cleanupReadNotifications().catch(() => {});

    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch notifications:', error.message);
      return [];
    }

    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

    return (notifs || [])
      .filter((n: any) => {
        // Exclude notifications marked read more than 24 hours ago
        if (n.read_at && new Date(n.read_at).getTime() < twentyFourHoursAgo) {
          return false;
        }
        return true;
      })
      .map((n: any): NotificationItem => {
        const d = new Date(n.created_at);
        const isToday = now.toDateString() === d.toDateString();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = yesterday.toDateString() === d.toDateString();

        return {
          id: n.id,
          date: d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
          timeGroup: isToday ? 'today' : isYesterday ? 'yesterday' : 'earlier',
          recipientType: n.customer_id ? 'customer' : 'internal',
          recipientId: n.customer_id || undefined,
          title: n.title,
          message: n.message,
          type: (n.type || 'system') as any,
          channel: 'in_app', // Expiry and website notifications use in-app channel exclusively
          read: Boolean(n.read_at),
          referenceType: n.reference_type || undefined,
          referenceId: n.reference_id || undefined,
        };
      });
  },

  async markAsRead(id: string) {
    try {
      const { error } = await supabase.rpc('mark_notification_as_read', {
        p_notification_id: id,
      });
      if (error) throw error;
    } catch {
      // Fallback to direct update
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
    }
  },

  async markAllAsRead(recipientType: 'customer' | 'internal' = 'internal') {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_as_read', {
        p_recipient_type: recipientType,
      });
      if (error) throw error;
    } catch {
      // Fallback to direct update
      let q = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

      if (recipientType === 'customer') {
        q = q.not('customer_id', 'is', null);
      }
      await q;
    }
  },

  async cleanupReadNotifications(): Promise<void> {
    try {
      await supabase.rpc('cleanup_read_notifications_and_alerts');
    } catch {
      // Silent error handler
    }
  }
};
