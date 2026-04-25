import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuthStore();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications();

    // 通知受信ハンドラ（アプリがフォアグラウンドの場合）
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] received:', notification.request.identifier);
    });

    // 通知タップハンドラ
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      // 契約IDがあればチャット画面へ
      if (data['contract_id']) {
        // router.push(`/chat/${data.contract_id}`) — _layout.tsx から呼ぶ
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return;  // シミュレーターでは不要

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // Android チャンネル設定
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SumaGig通知',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C47FF',
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // トークンをSupabaseに保存（profiles に push_token カラムがある想定）
    await supabase
      .from('profiles')
      .update({ push_token: token } as never)
      .eq('id', user!.id);
  };
}
