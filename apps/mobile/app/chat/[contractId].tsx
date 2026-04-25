import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import type { Database } from '../../../../packages/shared/src/types';

type Message = Database['public']['Tables']['messages']['Row'];

export default function ChatScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [contract, setContract] = useState<{ status: string; worker_id: string; client_id: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();
    fetchContract();

    // リアルタイム購読
    const channel = supabase
      .channel(`chat:${contractId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `contract_id=eq.${contractId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        flatListRef.current?.scrollToEnd({ animated: true });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contractId]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at');
    setMessages(data ?? []);
  };

  const fetchContract = async () => {
    const { data } = await supabase
      .from('contracts')
      .select('status, worker_id, client_id')
      .eq('id', contractId)
      .single();
    setContract(data);
  };

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    await supabase.from('messages').insert({
      contract_id: contractId,
      sender_id: user!.id,
      content,
    });
  };

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled) return;
    const file = result.assets[0];
    const path = `${contractId}/${Date.now()}_${file.name}`;
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('deliverables').upload(path, blob);
    if (error) { Alert.alert('エラー', 'ファイルのアップロードに失敗しました'); return; }
    const { data } = supabase.storage.from('deliverables').getPublicUrl(path);
    await supabase.from('messages').insert({
      contract_id: contractId,
      sender_id: user!.id,
      file_url: data.publicUrl,
      file_type: file.mimeType ?? 'application/octet-stream',
    });
  };

  const markDelivered = async () => {
    await supabase.from('contracts').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', contractId);
    setContract((prev) => prev ? { ...prev, status: 'delivered' } : prev);
    Alert.alert('納品通知送信', 'クライアントに確認を依頼しました');
  };

  const markCompleted = async () => {
    Alert.alert('完了確認', '成果物を確認しましたか？完了すると報酬が支払われます', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '完了する', onPress: async () => {
          await supabase.from('contracts').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', contractId);
          setContract((prev) => prev ? { ...prev, status: 'completed' } : prev);
        },
      },
    ]);
  };

  const isWorker = user?.id === contract?.worker_id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ステータスバー */}
      {contract && contract.status !== 'completed' && (
        <View style={styles.statusBar}>
          {contract.status === 'active' && isWorker && (
            <TouchableOpacity style={styles.actionBtn} onPress={markDelivered}>
              <Text style={styles.actionBtnText}>📦 納品する</Text>
            </TouchableOpacity>
          )}
          {contract.status === 'delivered' && !isWorker && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2ECC71' }]} onPress={markCompleted}>
              <Text style={styles.actionBtnText}>✓ 成果物を承認して完了</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              {item.content && (
                <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                  {item.content}
                </Text>
              )}
              {item.file_url && (
                <Text style={styles.fileLink}>📎 添付ファイル</Text>
              )}
              <Text style={styles.bubbleTime}>
                {new Date(item.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      {/* 入力エリア */}
      {contract?.status !== 'completed' && (
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={attachFile}>
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="メッセージを入力..."
            placeholderTextColor="#8888AA"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  statusBar: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(108,71,255,0.2)',
  },
  actionBtn: {
    backgroundColor: '#6C47FF', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  messageList: { padding: 16, gap: 8, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 12, gap: 4 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#6C47FF' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#1A1A24' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextOther: { color: '#F0F0F7' },
  fileLink: { color: '#A78BFA', fontSize: 14, fontWeight: '600' },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(108,71,255,0.2)',
  },
  attachBtn: { padding: 8 },
  attachIcon: { fontSize: 20 },
  input: {
    flex: 1, backgroundColor: '#1A1A24',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    color: '#F0F0F7', fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#6C47FF', alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 16 },
});
