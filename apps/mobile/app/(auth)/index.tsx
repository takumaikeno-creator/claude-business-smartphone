import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'sumagig://auth/callback' },
    });
    if (error) Alert.alert('エラー', error.message);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>SumaGig</Text>
        <Text style={styles.tagline}>スマホだけで稼ぐ、時代が来た。</Text>
        <Text style={styles.sub}>
          案件受注・納品・報酬受取まで{'\n'}スマートフォン1台で完結
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGoogle]}
          onPress={signInWithGoogle}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>🔑  Googleで続ける</Text>
          }
        </TouchableOpacity>

        <Text style={styles.terms}>
          続けることで利用規約・プライバシーポリシーに同意します
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13', justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 48, fontWeight: '900', color: '#6C47FF', marginBottom: 16 },
  tagline: { fontSize: 20, fontWeight: '800', color: '#F0F0F7', textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 15, color: '#8888AA', textAlign: 'center', lineHeight: 24 },
  actions: { padding: 24, gap: 12 },
  btn: {
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGoogle: { backgroundColor: '#6C47FF' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: { fontSize: 11, color: '#8888AA', textAlign: 'center' },
});
