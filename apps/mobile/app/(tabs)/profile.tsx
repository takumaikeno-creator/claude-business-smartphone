import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useAuthStore } from '../../stores/auth';
import { supabase } from '../../lib/supabase';

const SKILL_OPTIONS = [
  'SNS投稿', 'ライティング', '動画編集', '画像編集',
  'データ入力', '翻訳', '文字起こし', 'AIプロンプト',
  'リサーチ', 'Excel/スプレッドシート',
];

export default function ProfileScreen() {
  const { profile, user, fetchProfile, signOut } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(profile?.skills ?? []);
  const [saving, setSaving] = useState(false);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const save = async () => {
    if (!displayName.trim()) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim(), skills: selectedSkills })
      .eq('id', user!.id);
    setSaving(false);
    if (error) {
      Alert.alert('エラー', '保存に失敗しました');
    } else {
      await fetchProfile();
      setEditing(false);
    }
  };

  if (!profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* アバター */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.display_name?.[0] ?? '?'}</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>評価</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.review_count}</Text>
            <Text style={styles.statLabel}>完了件数</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: profile.is_premium ? '#6C47FF' : '#8888AA' }]}>
              {profile.is_premium ? 'PRO' : '無料'}
            </Text>
            <Text style={styles.statLabel}>プラン</Text>
          </View>
        </View>
      </View>

      {editing ? (
        /* 編集モード */
        <View style={styles.editSection}>
          <Text style={styles.label}>表示名</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="あなたの名前"
            placeholderTextColor="#8888AA"
          />

          <Text style={styles.label}>自己紹介</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            value={bio}
            onChangeText={setBio}
            placeholder="スキルや経験を簡単に"
            placeholderTextColor="#8888AA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>スキル</Text>
          <View style={styles.skills}>
            {SKILL_OPTIONS.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={[styles.skillChip, selectedSkills.includes(skill) && styles.skillChipActive]}
                onPress={() => toggleSkill(skill)}
              >
                <Text style={[styles.skillText, selectedSkills.includes(skill) && styles.skillTextActive]}>
                  {skill}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? '保存中...' : '保存する'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* 表示モード */
        <View style={styles.viewSection}>
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.bio}>{profile.bio || 'まだ自己紹介がありません'}</Text>

          {profile.skills.length > 0 && (
            <View style={styles.skills}>
              {profile.skills.map((skill) => (
                <View key={skill} style={styles.skillChipActive}>
                  <Text style={styles.skillTextActive}>{skill}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>プロフィールを編集</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* プレミアム誘導 */}
      {!profile.is_premium && (
        <View style={styles.premiumCard}>
          <Text style={styles.premiumTitle}>⚡ プレミアムにアップグレード</Text>
          <Text style={styles.premiumDesc}>月¥1,480で応募無制限・検索上位表示・AI提案文生成</Text>
          <TouchableOpacity style={styles.premiumBtn}>
            <Text style={styles.premiumBtnText}>14日間無料で試す</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#6C47FF', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: '700' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#F0F0F7' },
  statLabel: { fontSize: 11, color: '#8888AA', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  viewSection: { gap: 12 },
  name: { fontSize: 22, fontWeight: '800', color: '#F0F0F7' },
  bio: { fontSize: 15, color: '#8888AA', lineHeight: 22 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)',
  },
  skillChipActive: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, backgroundColor: 'rgba(108,71,255,0.15)',
  },
  skillText: { fontSize: 12, color: '#8888AA', fontWeight: '600' },
  skillTextActive: { fontSize: 12, color: '#A78BFA', fontWeight: '600' },
  editBtn: {
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(108,71,255,0.4)',
    paddingVertical: 12, alignItems: 'center',
  },
  editBtnText: { color: '#6C47FF', fontWeight: '700' },
  editSection: { gap: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#8888AA' },
  input: {
    backgroundColor: '#1A1A24', borderRadius: 12, padding: 14,
    color: '#F0F0F7', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
  },
  editActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { color: '#8888AA', fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#6C47FF',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
  premiumCard: {
    backgroundColor: 'rgba(108,71,255,0.1)',
    borderWidth: 1, borderColor: '#6C47FF',
    borderRadius: 14, padding: 16, gap: 8,
  },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: '#F0F0F7' },
  premiumDesc: { fontSize: 13, color: '#A78BFA', lineHeight: 20 },
  premiumBtn: {
    backgroundColor: '#6C47FF', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  premiumBtnText: { color: '#fff', fontWeight: '700' },
  signOutBtn: {
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { color: '#FF6B6B', fontWeight: '600' },
});
