import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '../../../../packages/shared/src/types';
import type { JobCategory } from '../../../../packages/shared/src/types';

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [JobCategory, string][];

export default function PostJobScreen() {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<JobCategory | null>(null);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!title.trim() || !description.trim() || !category || !budgetMin || !budgetMax) {
      Alert.alert('入力エラー', 'すべての項目を入力してください');
      return;
    }
    if (Number(budgetMin) > Number(budgetMax)) {
      Alert.alert('入力エラー', '最低予算は最高予算以下にしてください');
      return;
    }
    setPosting(true);
    const { error } = await supabase.from('jobs').insert({
      client_id: user!.id,
      title: title.trim(),
      description: description.trim(),
      category,
      budget_min: Number(budgetMin),
      budget_max: Number(budgetMax),
    });
    setPosting(false);
    if (error) {
      Alert.alert('エラー', '案件の掲載に失敗しました');
    } else {
      Alert.alert('掲載完了！', '案件が公開されました', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/') },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.sectionTitle}>案件カテゴリ</Text>
      <View style={styles.categories}>
        {CATEGORIES.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.categoryChip, category === key && styles.categoryChipActive]}
            onPress={() => setCategory(key)}
          >
            <Text style={styles.categoryIcon}>{CATEGORY_ICONS[key]}</Text>
            <Text style={[styles.categoryLabel, category === key && styles.categoryLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>案件タイトル</Text>
      <TextInput
        style={styles.input}
        placeholder="例: Instagram投稿文10本作成"
        placeholderTextColor="#8888AA"
        value={title}
        onChangeText={setTitle}
        maxLength={60}
      />

      <Text style={styles.sectionTitle}>案件詳細</Text>
      <TextInput
        style={[styles.input, { height: 120 }]}
        placeholder="作業内容・条件・注意事項などを詳しく書いてください"
        placeholderTextColor="#8888AA"
        multiline
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.sectionTitle}>予算（円）</Text>
      <View style={styles.budgetRow}>
        <TextInput
          style={[styles.input, styles.budgetInput]}
          placeholder="最低"
          placeholderTextColor="#8888AA"
          keyboardType="numeric"
          value={budgetMin}
          onChangeText={setBudgetMin}
        />
        <Text style={styles.budgetSep}>〜</Text>
        <TextInput
          style={[styles.input, styles.budgetInput]}
          placeholder="最高"
          placeholderTextColor="#8888AA"
          keyboardType="numeric"
          value={budgetMax}
          onChangeText={setBudgetMax}
        />
      </View>

      <TouchableOpacity
        style={[styles.postBtn, posting && styles.postBtnDisabled]}
        onPress={handlePost}
        disabled={posting}
      >
        {posting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.postBtnText}>⚡ 案件を掲載する</Text>
        }
      </TouchableOpacity>

      <Text style={styles.note}>
        掲載は無料です。ワーカーが決まり次第、手数料（取引額の15%）をご負担いただきます。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#8888AA',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 4,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)',
    backgroundColor: '#1A1A24',
  },
  categoryChipActive: { backgroundColor: '#6C47FF', borderColor: '#6C47FF' },
  categoryIcon: { fontSize: 14 },
  categoryLabel: { fontSize: 12, color: '#8888AA', fontWeight: '600' },
  categoryLabelActive: { color: '#fff' },
  input: {
    backgroundColor: '#1A1A24', borderRadius: 12, padding: 14,
    color: '#F0F0F7', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
  },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetInput: { flex: 1 },
  budgetSep: { color: '#8888AA', fontSize: 16 },
  postBtn: {
    backgroundColor: '#6C47FF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, color: '#8888AA', lineHeight: 18, textAlign: 'center' },
});
