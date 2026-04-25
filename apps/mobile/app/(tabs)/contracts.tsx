import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import type { ContractStatus } from '../../../../packages/shared/src/types';

interface Contract {
  id: string;
  amount: number;
  status: ContractStatus;
  created_at: string;
  job: { title: string; category: string };
  worker: { display_name: string };
  client: { display_name: string };
}

const STATUS_LABELS: Record<ContractStatus, { label: string; color: string }> = {
  active:    { label: '進行中', color: '#F59E0B' },
  delivered: { label: '納品済み（確認待ち）', color: '#6C47FF' },
  completed: { label: '完了', color: '#2ECC71' },
  disputed:  { label: '異議申し立て中', color: '#FF6B6B' },
};

export default function ContractsScreen() {
  const { user } = useAuthStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('contracts')
      .select(`
        id, amount, status, created_at,
        job:jobs(title, category),
        worker:profiles!contracts_worker_id_fkey(display_name),
        client:profiles!contracts_client_id_fkey(display_name)
      `)
      .or(`worker_id.eq.${user.id},client_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setContracts((data ?? []) as Contract[]);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6C47FF" size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={contracts}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => {
        const statusMeta = STATUS_LABELS[item.status];
        const isWorker = true; // 実装時はuser.idと比較
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.jobTitle} numberOfLines={1}>{item.job?.title}</Text>
              <View style={[styles.statusBadge, { borderColor: statusMeta.color }]}>
                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.counterpart}>
                {isWorker ? `発注者: ${item.client?.display_name}` : `ワーカー: ${item.worker?.display_name}`}
              </Text>
              <Text style={styles.amount}>¥{item.amount.toLocaleString('ja-JP')}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>進行中の案件はありません</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
            <Text style={styles.emptyLink}>案件を探す</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F13' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#1A1A24', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)', gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#F0F0F7' },
  statusBadge: {
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counterpart: { fontSize: 13, color: '#8888AA' },
  amount: { fontSize: 16, fontWeight: '800', color: '#2ECC71' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { color: '#8888AA', fontSize: 15 },
  emptyLink: { color: '#6C47FF', fontWeight: '600' },
});
