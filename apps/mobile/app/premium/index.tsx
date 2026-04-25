import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { payments } from '../../lib/api';

type Plan = 'worker_premium' | 'client_premium' | 'ai_assistant';

const PLANS = [
  {
    id: 'worker_premium' as Plan,
    name: 'プレミアムワーカー',
    price: 1480,
    icon: '⚡',
    color: '#6C47FF',
    tagline: '稼ぐ速度を3倍に',
    features: [
      '応募数 無制限（フリーは月10件）',
      '検索結果で最上位表示（3倍露出）',
      'プロフィールにバッジ表示',
      '優先カスタマーサポート',
      '月次スキルアップウェビナー',
    ],
  },
  {
    id: 'ai_assistant' as Plan,
    name: 'AI副業アシスタント',
    price: 980,
    icon: '🤖',
    color: '#FF6B6B',
    tagline: 'AIで採用率を上げる',
    features: [
      '応募文を1タップで自動生成',
      'プロフィール最適化提案',
      '単価交渉アドバイス',
      '月次収益インサイト',
      '使い放題（回数制限なし）',
    ],
  },
  {
    id: 'client_premium' as Plan,
    name: 'プレミアムクライアント',
    price: 2980,
    icon: '🏢',
    color: '#2ECC71',
    tagline: '最適な人材を即確保',
    features: [
      '案件掲載数 無制限（フリーは月3件）',
      'AIによる最適ワーカー自動マッチング',
      '優先審査（最短30分で公開）',
      '専任カスタマーサクセス担当',
      '取引分析ダッシュボード',
    ],
  },
];

export default function PremiumScreen() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('worker_premium');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { client_secret, trial_end } = await payments.subscribe(selectedPlan);
      const trialDate = trial_end ? new Date(trial_end * 1000).toLocaleDateString('ja-JP') : null;
      Alert.alert(
        '✅ 14日間の無料トライアル開始！',
        `${trialDate ? `${trialDate}まで無料。` : ''}その後は月額料金が発生します。\n\nいつでもキャンセル可能です。`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      // 決済UIが必要な場合（client_secret がある場合）はここでStripe Sheet を開く
      // 現状はアラートでエラー表示
      Alert.alert('エラー', String(e));
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selectedPlan)!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerBadge}>💎 プレミアム</Text>
        <Text style={styles.headerTitle}>あなたの副業を{'\n'}次のレベルへ</Text>
        <Text style={styles.headerSub}>14日間無料 · いつでもキャンセル可</Text>
      </View>

      {/* プラン選択 */}
      <View style={styles.plans}>
        {PLANS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.planCard, selectedPlan === p.id && { borderColor: p.color, backgroundColor: p.color + '11' }]}
            onPress={() => setSelectedPlan(p.id)}
            activeOpacity={0.8}
          >
            <View style={styles.planHeader}>
              <View style={[styles.planIconCircle, { backgroundColor: p.color + '22' }]}>
                <Text style={styles.planIcon}>{p.icon}</Text>
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planTagline}>{p.tagline}</Text>
              </View>
              <View style={styles.planPriceCol}>
                <Text style={[styles.planPrice, { color: p.color }]}>¥{p.price.toLocaleString()}</Text>
                <Text style={styles.planPriceSub}>/月</Text>
              </View>
            </View>

            {selectedPlan === p.id && (
              <View style={styles.features}>
                {p.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={[styles.featureCheck, { color: p.color }]}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* 価値訴求 */}
      <View style={styles.valueBox}>
        <Text style={styles.valueTitle}>💡 投資対効果</Text>
        <Text style={styles.valueText}>
          {selectedPlan === 'worker_premium'
            ? '月1件 ¥10,000案件を受注すれば\n投資対効果 575%。\n通常の案件でも2件で元が取れます。'
            : selectedPlan === 'ai_assistant'
            ? 'AI提案文で採用率が平均2倍に。\n1件受注で¥5,000以上稼げれば\n510%の投資対効果です。'
            : '毎月 ¥50,000発注する場合、\n手数料の節約だけで\n月¥12,000以上おトクになります。'
          }
        </Text>
      </View>

      {/* 購読ボタン */}
      <TouchableOpacity
        style={[styles.subscribeBtn, { backgroundColor: plan.color }, loading && { opacity: 0.6 }]}
        onPress={handleSubscribe}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.subscribeBtnText}>
              14日間無料で試す → ¥{plan.price.toLocaleString()}/月
            </Text>
        }
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        14日間の無料トライアル後、自動更新されます。{'\n'}
        設定からいつでもキャンセルできます。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  scroll: { padding: 20, paddingBottom: 48, gap: 20 },
  header: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  headerBadge: {
    backgroundColor: 'rgba(108,71,255,0.15)', color: '#A78BFA',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100,
    fontSize: 12, fontWeight: '700',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#F0F0F7', textAlign: 'center', lineHeight: 36 },
  headerSub: { fontSize: 13, color: '#8888AA' },
  plans: { gap: 10 },
  planCard: {
    backgroundColor: '#1A1A24', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: 'rgba(108,71,255,0.2)',
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  planIcon: { fontSize: 20 },
  planInfo: { flex: 1 },
  planName: { fontSize: 14, fontWeight: '800', color: '#F0F0F7' },
  planTagline: { fontSize: 12, color: '#8888AA', marginTop: 2 },
  planPriceCol: { alignItems: 'flex-end' },
  planPrice: { fontSize: 20, fontWeight: '900' },
  planPriceSub: { fontSize: 11, color: '#8888AA' },
  features: { marginTop: 14, gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureCheck: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  featureText: { flex: 1, fontSize: 13, color: '#D0D0E0', lineHeight: 20 },
  valueBox: {
    backgroundColor: '#1A1A24', borderRadius: 14, padding: 16, gap: 8,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)',
  },
  valueTitle: { fontSize: 14, fontWeight: '700', color: '#F0F0F7' },
  valueText: { fontSize: 14, color: '#8888AA', lineHeight: 22 },
  subscribeBtn: {
    borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16,
  },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 11, color: '#8888AA', textAlign: 'center', lineHeight: 18 },
});
