import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'application' | 'accepted' | 'delivered' | 'completed' | 'message' | 'review';
  title: string;
  body: string;
  link_id: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_META: Record<Notification['type'], { icon: string; color: string }> = {
  application: { icon: '📩', color: '#6C47FF' },
  accepted:    { icon: '🎉', color: '#2ECC71' },
  delivered:   { icon: '📦', color: '#F59E0B' },
  completed:   { icon: '✅', color: '#2ECC71' },
  message:     { icon: '💬', color: '#6C47FF' },
  review:      { icon: '⭐', color: '#F59E0B' },
};

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications' as never)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  };

  const markRead = async (id: string) => {
    await supabase
      .from('notifications' as never)
      .update({ read: true })
      .eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handlePress = (n: Notification) => {
    markRead(n.id);
    if (n.link_id) {
      if (n.type === 'message' || n.type === 'delivered' || n.type === 'completed') {
        router.push(`/chat/${n.link_id}`);
      } else if (n.type === 'application' || n.type === 'accepted') {
        router.push(`/job/${n.link_id}`);
      }
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications' as never)
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6C47FF" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllRow} onPress={markAllRead}>
          <Text style={styles.markAllText}>すべて既読にする ({unreadCount}件)</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C47FF" />
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type];
          const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ja });
          return (
            <TouchableOpacity
              style={[styles.item, !item.read && styles.itemUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: meta.color + '22' }]}>
                <Text style={styles.icon}>{meta.icon}</Text>
              </View>
              <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.time}>{timeAgo}</Text>
              </View>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>通知はまだありません</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F13' },
  markAllRow: {
    padding: 12, alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: 'rgba(108,71,255,0.15)',
  },
  markAllText: { fontSize: 13, color: '#6C47FF', fontWeight: '600' },
  list: { paddingBottom: 32 },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemUnread: { backgroundColor: 'rgba(108,71,255,0.05)' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 20 },
  content: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '700', color: '#F0F0F7' },
  body: { fontSize: 13, color: '#8888AA', lineHeight: 18 },
  time: { fontSize: 11, color: '#6666AA', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#8888AA' },
});
