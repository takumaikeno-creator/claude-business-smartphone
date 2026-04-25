import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();

  useEffect(() => {
    // 起動時のセッション復元
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
    });

    // セッション変更の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor="#0F0F13" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F13' },
          headerTintColor: '#F0F0F7',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: '#0F0F13' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: '案件詳細' }} />
        <Stack.Screen name="chat/[contractId]" options={{ title: 'チャット' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
