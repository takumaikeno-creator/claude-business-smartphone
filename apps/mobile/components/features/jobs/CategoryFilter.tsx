import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useJobsStore } from '../../../stores/jobs';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../../../../../packages/shared/src/types';
import type { JobCategory } from '../../../../../packages/shared/src/types';

const CATEGORIES: Array<{ key: JobCategory | null; label: string; icon: string }> = [
  { key: null, label: 'すべて', icon: '🗂️' },
  ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key: key as JobCategory,
    label,
    icon: CATEGORY_ICONS[key as JobCategory],
  })),
];

export function CategoryFilter() {
  const { filters, setFilter } = useJobsStore();

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {CATEGORIES.map(({ key, label, icon }) => {
          const active = filters.category === key;
          return (
            <TouchableOpacity
              key={String(key)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter('category', key)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipIcon}>{icon}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, borderBottomColor: 'rgba(108,71,255,0.15)' },
  scroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.25)',
    backgroundColor: '#1A1A24',
  },
  chipActive: { backgroundColor: '#6C47FF', borderColor: '#6C47FF' },
  chipIcon: { fontSize: 13 },
  chipLabel: { fontSize: 12, fontWeight: '600', color: '#8888AA' },
  chipLabelActive: { color: '#fff' },
});
