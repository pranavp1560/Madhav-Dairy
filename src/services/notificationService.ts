import { supabase } from '../lib/supabase';
import { NotificationItem } from '../types/dairy';

export const notificationService = {
  async fetchNotifications(): Promise<NotificationItem[]> {
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch notifications:', error.message);
      return [];
    }

    return (notifs || []).map((n: any): NotificationItem => {
      const d = new Date(n.created_at);
      const now = new Date();
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
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  },

  async markAllAsRead() {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
  }
};
