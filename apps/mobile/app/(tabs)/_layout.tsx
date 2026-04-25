import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/auth';

export default function TabsLayout() {
  const { session, loading } = useAuthStore();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1A1A24',
          borderTopColor: 'rgba(108,71,255,0.2)',
          paddingBottom: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#6C47FF',
        tabBarInactiveTintColor: '#8888AA',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0F0F13' },
        headerTintColor: '#F0F0F7',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '案件一覧', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: '案件掲載', tabBarIcon: ({ color }) => <TabIcon emoji="➕" color={color} /> }}
      />
      <Tabs.Screen
        name="contracts"
        options={{ title: '進行中', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'マイページ', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === '#6C47FF' ? 1 : 0.5 }}>{emoji}</Text>;
}
