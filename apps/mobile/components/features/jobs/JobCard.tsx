import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { JobListItem } from '../../../../../packages/shared/src/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../../../../../packages/shared/src/types';

interface Props {
  job: JobListItem;
  onPress: () => void;
}

export function JobCard({ job, onPress }: Props) {
  const budgetLabel =
    job.budget_min === job.budget_max
      ? `¥${job.budget_min.toLocaleString('ja-JP')}`
      : `¥${job.budget_min.toLocaleString('ja-JP')}〜¥${job.budget_max.toLocaleString('ja-JP')}`;

  const timeAgo = formatDistanceToNow(new Date(job.created_at), {
    addSuffix: true, locale: ja,
  });

  return (
    <TouchableOpacity style={[styles.card, job.is_featured && styles.featured]} onPress={onPress} activeOpacity={0.75}>
      {job.is_featured && <Text style={styles.featuredBadge}>⚡ 注目案件</Text>}

      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryIcon}>{CATEGORY_ICONS[job.category]}</Text>
          <Text style={styles.categoryLabel}>{CATEGORY_LABELS[job.category]}</Text>
        </View>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>{job.title}</Text>

      <View style={styles.footer}>
        <Text style={styles.budget}>{budgetLabel}</Text>
        <View style={styles.client}>
          <Text style={styles.clientName}>{job.client?.display_name}</Text>
          <Text style={styles.rating}>★ {job.client?.rating?.toFixed(1) ?? '—'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.2)',
    gap: 10,
  },
  featured: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108,71,255,0.07)',
  },
  featuredBadge: {
    fontSize: 11, fontWeight: '700',
    color: '#6C47FF', marginBottom: -4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(108,71,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 100,
  },
  categoryIcon: { fontSize: 12 },
  categoryLabel: { fontSize: 11, color: '#A78BFA', fontWeight: '600' },
  time: { fontSize: 11, color: '#8888AA' },
  title: { fontSize: 15, fontWeight: '700', color: '#F0F0F7', lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budget: { fontSize: 16, fontWeight: '800', color: '#2ECC71' },
  client: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  clientName: { fontSize: 12, color: '#8888AA' },
  rating: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
});
