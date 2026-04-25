import { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useJobsStore } from '../../stores/jobs';
import { JobCard } from '../../components/features/jobs/JobCard';
import { CategoryFilter } from '../../components/features/jobs/CategoryFilter';
import type { JobListItem } from '../../../../packages/shared/src/types';

export default function JobsScreen() {
  const { jobs, loading, hasMore, fetchJobs, filters } = useJobsStore();

  useEffect(() => { fetchJobs(true); }, []);

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) fetchJobs();
  }, [loading, hasMore]);

  const renderItem = useCallback(
    ({ item }: { item: JobListItem }) => (
      <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />
    ),
    []
  );

  return (
    <View style={styles.container}>
      <CategoryFilter />
      <FlatList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={loading && jobs.length === 0}
            onRefresh={() => fetchJobs(true)}
            tintColor="#6C47FF"
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>案件が見つかりませんでした</Text>
              <TouchableOpacity onPress={() => fetchJobs(true)}>
                <Text style={styles.emptyLink}>条件をリセットする</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          loading && jobs.length > 0
            ? <ActivityIndicator color="#6C47FF" style={{ padding: 24 }} />
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#8888AA', fontSize: 15, marginBottom: 12 },
  emptyLink: { color: '#6C47FF', fontSize: 14, fontWeight: '600' },
});
