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
      const isToday = new Date().toDateString() === d.toDateString();

      return {
        id: n.id,
        date: d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        timeGroup: isToday ? 'today' : 'earlier',
        recipientType: 'internal',
        title: n.title,
        message: n.message,
        type: n.type as 'expiry' | 'order' | 'product' | 'payment',
        channel: (n.channel || 'in_app') as 'in_app' | 'push' | 'whatsapp' | 'sms',
        read: Boolean(n.read_at),
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
