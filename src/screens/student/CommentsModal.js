import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function CommentsModal({ visible, onClose, planId }) {
  const { profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (visible && planId) {
      loadComments();
    }
  }, [visible, planId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          text,
          created_at,
          sender_role,
          profile:user_id (
            full_name,
            role
          )
        `)
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    if (!profile?.id) {
      Alert.alert('Error', 'Debes iniciar sesión para comentar');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('comments')
        .insert([
          {
            plan_id: planId,
            user_id: profile.id,
            text: newComment.trim(),
            sender_role: profile.role, // Guardamos 'coach' o 'alumno'
            is_read: false
          }
        ]);

      if (error) throw error;

      setNewComment('');
      Keyboard.dismiss();
      await loadComments();
      
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderComment = ({ item }) => {
    // Verificamos si el mensaje es mío
    const isMine = item.profile?.full_name === profile?.full_name;

    return (
      <View style={[styles.messageWrapper, isMine ? styles.myMessage : styles.theirMessage]}>
        {!isMine && (
          <View style={[styles.smallAvatar, item.sender_role === 'coach' && styles.avatarCoach]}>
            <Text style={styles.smallAvatarText}>{item.profile?.full_name?.charAt(0)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
          {!isMine && (
            <Text style={styles.authorName}>
              {item.profile?.full_name} {item.sender_role === 'coach' ? ' (Coach)' : ''}
            </Text>
          )}
          <Text style={styles.commentText}>{item.text}</Text>
          <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat de Entrenamiento</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#FFD700" style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderComment}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Escribe al coach..."
            placeholderTextColor="#666"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]} 
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Ionicons name="send" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  listContent: { padding: 15 },
  messageWrapper: { flexDirection: 'row', marginBottom: 15, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end' },
  theirMessage: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 18 },
  myBubble: { backgroundColor: '#FFD700', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#333' },
  authorName: { fontSize: 11, fontWeight: 'bold', color: '#FFD700', marginBottom: 4 },
  commentText: { fontSize: 15, color: '#000' }, // Texto negro en burbuja dorada
  commentDate: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'right' },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center', marginRight: 8, alignSelf: 'flex-end' },
  avatarCoach: { backgroundColor: '#2196F3' },
  smallAvatarText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  inputArea: { flexDirection: 'row', padding: 15, backgroundColor: '#1a1a1a', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, color: '#fff', marginRight: 10, borderWidth: 1, borderColor: '#333' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#333' }
});