import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: '📱',
    title: 'スマホだけで\n稼げる時代',
    body: '受注・納品・入金まで\nスマートフォン1台で完結。\nPCは一切不要です。',
    accent: '#6C47FF',
  },
  {
    id: '2',
    icon: '⚡',
    title: '隙間時間を\n収入に変える',
    body: '通勤・育児・休憩の5分から。\n小さな作業でも確実に稼げる\nマイクロジョブを多数掲載。',
    accent: '#FF6B6B',
  },
  {
    id: '3',
    icon: '🤖',
    title: 'AIが\n稼ぐのを手伝う',
    body: '応募文の自動生成から\n単価交渉アドバイスまで。\nAIがあなたの副業を加速します。',
    accent: '#2ECC71',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { user } = useAuthStore();

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    // オンボーディング完了フラグを保存
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarded: true } as never)
        .eq('id', user.id);
    }
    router.replace('/(tabs)/');
  };

  const skip = () => finishOnboarding();

  return (
    <SafeAreaView style={styles.container}>
      {/* スキップ */}
      <TouchableOpacity style={styles.skip} onPress={skip}>
        <Text style={styles.skipText}>スキップ</Text>
      </TouchableOpacity>

      {/* スライド */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: item.accent + '22' }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* ドット インジケーター */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity }]}
            />
          );
        })}
      </View>

      {/* ボタン */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextBtnText}>
            {currentIndex < SLIDES.length - 1 ? '次へ →' : '⚡ はじめる'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  skip: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  skipText: { color: '#8888AA', fontSize: 14, fontWeight: '600' },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 24,
  },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 56 },
  title: {
    fontSize: 32, fontWeight: '900', color: '#F0F0F7',
    textAlign: 'center', lineHeight: 40,
  },
  body: {
    fontSize: 16, color: '#8888AA', textAlign: 'center', lineHeight: 26,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 24 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#6C47FF' },
  footer: { padding: 24, paddingBottom: 40 },
  nextBtn: {
    backgroundColor: '#6C47FF', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
