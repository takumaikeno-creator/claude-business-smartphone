import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../../../../packages/shared/src/types';
import type { Database } from '../../../../packages/shared/src/types';

type Job = Database['public']['Tables']['jobs']['Row'] & {
  client: Database['public']['Tables']['profiles']['Row'];
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [message, setMessage] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    fetchJob();
    checkExistingApplication();
  }, [id]);

  const fetchJob = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, client:profiles!jobs_client_id_fkey(*)')
      .eq('id', id)
      .single();
    setJob(data as Job);
    setLoading(false);
  };

  const checkExistingApplication = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', id)
      .eq('worker_id', user.id)
      .maybeSingle();
    setHasApplied(!!data);
  };

  const handleApply = async () => {
    if (!message.trim() || !proposedPrice) {
      Alert.alert('入力エラー', 'メッセージと希望金額を入力してください');
      return;
    }
    setApplying(true);
    const { error } = await supabase.from('applications').insert({
      job_id: id,
      worker_id: user!.id,
      message: message.trim(),
      proposed_price: Number(proposedPrice),
    });
    setApplying(false);
    if (error) {
      Alert.alert('エラー', '応募に失敗しました');
    } else {
      setHasApplied(true);
      setShowApplyForm(false);
      Alert.alert('応募完了！', 'クライアントからの連絡をお待ちください');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6C47FF" size="large" />
      </View>
    );
  }
  if (!job) return null;

  const isOwnJob = user?.id === job.client_id;
  const budgetLabel = `¥${job.budget_min.toLocaleString('ja-JP')}〜¥${job.budget_max.toLocaleString('ja-JP')}`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* カテゴリ */}
        <View style={styles.categoryRow}>
          <Text style={styles.categoryIcon}>{CATEGORY_ICONS[job.category]}</Text>
          <Text style={styles.categoryLabel}>{CATEGORY_LABELS[job.category]}</Text>
          {job.is_featured && <Text style={styles.featuredBadge}>⚡ 注目</Text>}
        </View>

        {/* タイトル */}
        <Text style={styles.title}>{job.title}</Text>

        {/* 予算 */}
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>予算</Text>
          <Text style={styles.budget}>{budgetLabel}</Text>
        </View>

        {/* 説明 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>案件詳細</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {/* クライアント情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>クライアント</Text>
          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>
                {job.client.display_name?.[0] ?? '?'}
              </Text>
            </View>
            <View>
              <Text style={styles.clientName}>{job.client.display_name}</Text>
              <Text style={styles.clientRating}>★ {job.client.rating?.toFixed(1)} ({job.client.review_count}件)</Text>
            </View>
          </View>
        </View>

        {/* 応募フォーム */}
        {showApplyForm && (
          <View style={styles.applyForm}>
            <Text style={styles.sectionTitle}>応募内容を入力</Text>
            <TextInput
              style={styles.input}
              placeholder="自己紹介と応募理由を書いてください"
              placeholderTextColor="#8888AA"
              multiline
              numberOfLines={5}
              value={message}
              onChangeText={setMessage}
            />
            <TextInput
              style={styles.input}
              placeholder="希望金額（円）"
              placeholderTextColor="#8888AA"
              keyboardType="numeric"
              value={proposedPrice}
              onChangeText={setProposedPrice}
            />
            <TouchableOpacity
              style={[styles.applyBtn, applying && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={applying}
            >
              {applying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.applyBtnText}>応募する</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 固定フッター：応募ボタン */}
      {!isOwnJob && !showApplyForm && (
        <View style={styles.footer}>
          {hasApplied ? (
            <View style={styles.appliedBadge}>
              <Text style={styles.appliedText}>✓ 応募済み</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setShowApplyForm(true)}
            >
              <Text style={styles.applyBtnText}>⚡ この案件に応募する</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F13' },
  scroll: { padding: 20, paddingBottom: 100, gap: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryIcon: { fontSize: 18 },
  categoryLabel: { fontSize: 13, color: '#A78BFA', fontWeight: '600' },
  featuredBadge: { fontSize: 12, color: '#6C47FF', fontWeight: '700', marginLeft: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#F0F0F7', lineHeight: 30 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetLabel: { fontSize: 13, color: '#8888AA' },
  budget: { fontSize: 20, fontWeight: '800', color: '#2ECC71' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#8888AA', textTransform: 'uppercase', letterSpacing: 1 },
  description: { fontSize: 15, color: '#D0D0E0', lineHeight: 24 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6C47FF', alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#F0F0F7' },
  clientRating: { fontSize: 13, color: '#F59E0B' },
  applyForm: { gap: 12 },
  input: {
    backgroundColor: '#1A1A24', borderRadius: 12, padding: 14,
    color: '#F0F0F7', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
    textAlignVertical: 'top',
  },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(108,71,255,0.2)' },
  applyBtn: {
    backgroundColor: '#6C47FF', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  appliedBadge: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2ECC71',
  },
  appliedText: { color: '#2ECC71', fontSize: 16, fontWeight: '700' },
});
