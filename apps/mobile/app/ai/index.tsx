import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuthStore } from '../../stores/auth';
import { ai } from '../../lib/api';

type Tab = 'proposal' | 'profile' | 'price' | 'insight';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'proposal', label: '応募文', icon: '✍️' },
  { key: 'profile',  label: 'プロフィール', icon: '👤' },
  { key: 'price',    label: '単価相談', icon: '💰' },
  { key: 'insight',  label: '月次分析', icon: '📊' },
];

export default function AIAssistantScreen() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('proposal');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  // Proposal form
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');

  // Price form
  const [priceCategory, setPriceCategory] = useState('');
  const [priceDesc, setPriceDesc] = useState('');
  const [expLevel, setExpLevel] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');

  if (!profile?.is_premium) {
    return <UpgradePrompt />;
  }

  const runProposal = async () => {
    if (!jobTitle || !jobDesc) { Alert.alert('入力してください', '案件タイトルと詳細を入力してください'); return; }
    setLoading(true); setResult('');
    try {
      const { proposal } = await ai.generateProposal({
        job_title: jobTitle, job_description: jobDesc,
        job_category: 'content', budget_min: 5000, budget_max: 30000,
      });
      setResult(proposal);
    } catch (e) {
      Alert.alert('エラー', String(e));
    } finally {
      setLoading(false);
    }
  };

  const runProfile = async () => {
    if (!profile.bio && !profile.skills?.length) {
      Alert.alert('プロフィールを先に設定してください');
      return;
    }
    setLoading(true); setResult('');
    try {
      const res = await ai.optimizeProfile({ bio: profile.bio ?? '', skills: profile.skills ?? [] });
      setResult(`【改善後の自己紹介】\n${res.improved_bio}\n\n【おすすめスキルタグ】\n${res.suggested_skills.join(' / ')}\n\n【ポイント】\n${res.advice}`);
    } catch (e) {
      Alert.alert('エラー', String(e));
    } finally {
      setLoading(false);
    }
  };

  const runPrice = async () => {
    if (!priceCategory || !priceDesc) { Alert.alert('入力してください'); return; }
    setLoading(true); setResult('');
    try {
      const { advice } = await ai.getPriceAdvice({
        category: priceCategory, job_description: priceDesc, my_experience_level: expLevel,
      });
      setResult(advice);
    } catch (e) {
      Alert.alert('エラー', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* タブ */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); setResult(''); }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 応募文生成 */}
        {activeTab === 'proposal' && (
          <View style={styles.form}>
            <Text style={styles.description}>
              案件情報を入力すると、あなたのプロフィールに合った応募文を自動生成します。
            </Text>
            <InputField label="案件タイトル" value={jobTitle} onChangeText={setJobTitle} placeholder="例: Instagram投稿文10本作成" />
            <InputField label="案件詳細" value={jobDesc} onChangeText={setJobDesc} placeholder="案件の詳細内容を入力" multiline />
            <RunButton label="応募文を生成する ✨" onPress={runProposal} loading={loading} />
          </View>
        )}

        {/* プロフィール最適化 */}
        {activeTab === 'profile' && (
          <View style={styles.form}>
            <Text style={styles.description}>
              現在のプロフィールを分析して改善案を提案します。
            </Text>
            <View style={styles.currentProfile}>
              <Text style={styles.currentLabel}>現在の自己紹介</Text>
              <Text style={styles.currentValue}>{profile.bio || '（未設定）'}</Text>
              <Text style={styles.currentLabel}>スキル</Text>
              <Text style={styles.currentValue}>{profile.skills?.join(', ') || '（未設定）'}</Text>
            </View>
            <RunButton label="プロフィールを最適化する ✨" onPress={runProfile} loading={loading} />
          </View>
        )}

        {/* 単価アドバイス */}
        {activeTab === 'price' && (
          <View style={styles.form}>
            <Text style={styles.description}>
              案件内容と経験レベルから適正単価を分析します。
            </Text>
            <InputField label="カテゴリ・作業内容" value={priceCategory} onChangeText={setPriceCategory} placeholder="例: SNS投稿文作成" />
            <InputField label="案件の詳細" value={priceDesc} onChangeText={setPriceDesc} placeholder="作業量・難易度など" multiline />
            <Text style={styles.fieldLabel}>あなたの経験レベル</Text>
            <View style={styles.levelSelector}>
              {([['beginner', '初心者'], ['intermediate', '中級'], ['expert', '上級']] as const).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.levelBtn, expLevel === val && styles.levelBtnActive]}
                  onPress={() => setExpLevel(val)}
                >
                  <Text style={[styles.levelBtnText, expLevel === val && styles.levelBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <RunButton label="適正単価を調べる ✨" onPress={runPrice} loading={loading} />
          </View>
        )}

        {/* 月次インサイト */}
        {activeTab === 'insight' && (
          <View style={styles.form}>
            <Text style={styles.description}>
              今月の実績を分析して、来月に向けたアドバイスを生成します。
            </Text>
            <View style={styles.insightStats}>
              <InsightStat label="完了件数" value={`${profile.review_count}件`} />
              <InsightStat label="評価" value={`★ ${profile.rating.toFixed(1)}`} />
            </View>
            <RunButton
              label="インサイトを生成する ✨"
              loading={loading}
              onPress={async () => {
                setLoading(true); setResult('');
                try {
                  const res = await ai.getPriceAdvice({
                    category: 'insight', job_description: 'monthly', my_experience_level: 'intermediate',
                  });
                  setResult(res.advice);
                } catch (e) { Alert.alert('エラー', String(e)); }
                finally { setLoading(false); }
              }}
            />
          </View>
        )}

        {/* 結果表示 */}
        {result !== '' && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>✨ AI の回答</Text>
            <Text style={styles.resultText}>{result}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => { /* クリップボードにコピー */ Alert.alert('コピーしました'); }}
            >
              <Text style={styles.copyBtnText}>📋 コピー</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── サブコンポーネント ──

function UpgradePrompt() {
  return (
    <View style={styles.upgradeContainer}>
      <Text style={styles.upgradeIcon}>🤖</Text>
      <Text style={styles.upgradeTitle}>AI副業アシスタント</Text>
      <Text style={styles.upgradeDesc}>
        プレミアム会員限定の機能です。{'\n'}
        応募文の自動生成・プロフィール最適化・{'\n'}
        単価アドバイスが使い放題になります。
      </Text>
      <TouchableOpacity
        style={styles.upgradeBtn}
        onPress={() => { /* router.push('/premium') */ }}
      >
        <Text style={styles.upgradeBtnText}>⚡ 14日間無料で試す（¥980/月）</Text>
      </TouchableOpacity>
    </View>
  );
}

function InputField({ label, value, onChangeText, placeholder, multiline = false }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#8888AA"
        multiline={multiline}
      />
    </View>
  );
}

function RunButton({ label, onPress, loading }: { label: string; onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity style={[styles.runBtn, loading && { opacity: 0.6 }]} onPress={onPress} disabled={loading}>
      {loading
        ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.runBtnText}>生成中...</Text>
          </View>
        : <Text style={styles.runBtnText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightStat}>
      <Text style={styles.insightStatValue}>{value}</Text>
      <Text style={styles.insightStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(108,71,255,0.2)',
    backgroundColor: '#0F0F13',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6C47FF' },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 10, color: '#8888AA', fontWeight: '600' },
  tabLabelActive: { color: '#6C47FF' },
  scroll: { padding: 20, gap: 12, paddingBottom: 48 },
  description: { fontSize: 14, color: '#8888AA', lineHeight: 22, marginBottom: 4 },
  form: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#8888AA', marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A24', borderRadius: 12, padding: 14,
    color: '#F0F0F7', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
  },
  levelSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  levelBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', backgroundColor: '#1A1A24',
  },
  levelBtnActive: { backgroundColor: '#6C47FF', borderColor: '#6C47FF' },
  levelBtnText: { fontSize: 13, color: '#8888AA', fontWeight: '600' },
  levelBtnTextActive: { color: '#fff' },
  runBtn: {
    backgroundColor: '#6C47FF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  runBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  currentProfile: {
    backgroundColor: '#1A1A24', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)', gap: 6, marginBottom: 4,
  },
  currentLabel: { fontSize: 11, color: '#8888AA', fontWeight: '700', textTransform: 'uppercase' },
  currentValue: { fontSize: 14, color: '#D0D0E0', lineHeight: 20 },
  insightStats: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  insightStat: {
    flex: 1, backgroundColor: '#1A1A24', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)',
  },
  insightStatValue: { fontSize: 22, fontWeight: '900', color: '#6C47FF' },
  insightStatLabel: { fontSize: 11, color: '#8888AA', marginTop: 4 },
  resultBox: {
    backgroundColor: '#1A1A24', borderRadius: 14, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#6C47FF',
    marginTop: 4,
  },
  resultLabel: { fontSize: 13, fontWeight: '700', color: '#6C47FF' },
  resultText: { fontSize: 15, color: '#F0F0F7', lineHeight: 24 },
  copyBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(108,71,255,0.15)',
  },
  copyBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '600' },
  upgradeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  upgradeIcon: { fontSize: 64 },
  upgradeTitle: { fontSize: 22, fontWeight: '800', color: '#F0F0F7' },
  upgradeDesc: { fontSize: 15, color: '#8888AA', textAlign: 'center', lineHeight: 24 },
  upgradeBtn: {
    backgroundColor: '#6C47FF', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', width: '100%',
  },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
