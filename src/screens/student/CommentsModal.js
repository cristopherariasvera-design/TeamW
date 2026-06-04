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

  useEffect(() => {
    if (!visible || !planId) return;

    const channel = supabase
      .channel(`comments-plan-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          loadComments(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, planId]);

  const loadComments = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          plan_id,
          user_id,
          text,
          created_at,
          sender_role,
          is_read,
          profile:user_id (
            id,
            full_name,
            role
          )
        `)
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(data || []);

      await markOtherMessagesAsRead(data || []);
    } catch (error) {
      console.error('Error loading comments:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const markOtherMessagesAsRead = async (messages) => {
    try {
      if (!profile?.id || !planId) return;

      const unreadFromOthers = messages.filter(
        (message) => !message.is_read && message.user_id !== profile.id
      );

      if (unreadFromOthers.length === 0) return;

      const ids = unreadFromOthers.map((message) => message.id);

      const { error } = await supabase
        .from('comments')
        .update({ is_read: true })
        .in('id', ids);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking comments as read:', error.message || error);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    if (!profile?.id) {
      Alert.alert('Error', 'Debes iniciar sesión para comentar.');
      return;
    }

    if (!planId) {
      Alert.alert('Error', 'No se encontró el entrenamiento asociado.');
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
            sender_role: profile.role,
            is_read: false,
          },
        ]);

      if (error) throw error;

      setNewComment('');
      Keyboard.dismiss();

      await loadComments(false);
    } catch (error) {
      console.error('Error posting comment:', error.message || error);
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlaceholder = () => {
    if (profile?.role === 'coach') {
      return 'Responder al alumno...';
    }

    return 'Escribe al coach...';
  };

  const getInitial = (name) => {
    if (!name) return '?';

    return name.charAt(0).toUpperCase();
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={52} color="#333" />

      <Text style={styles.emptyTitle}>
        Sin mensajes todavía
      </Text>

      <Text style={styles.emptyText}>
        Usa este chat para dejar feedback, dudas o comentarios sobre este entrenamiento.
      </Text>
    </View>
  );

  const renderComment = ({ item }) => {
    const isMine = item.user_id === profile?.id;
    const isCoach = item.sender_role === 'coach';
    const senderName = item.profile?.full_name || 'Usuario';

    return (
      <View
        style={[
          styles.messageWrapper,
          isMine ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {!isMine && (
          <View
            style={[
              styles.smallAvatar,
              isCoach ? styles.avatarCoach : styles.avatarStudent,
            ]}
          >
            <Text style={styles.smallAvatarText}>
              {getInitial(senderName)}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isMine ? styles.myBubble : styles.theirBubble,
            isCoach && !isMine && styles.coachBubble,
          ]}
        >
          {!isMine && (
            <Text
              style={[
                styles.authorName,
                isCoach && styles.authorNameCoach,
              ]}
            >
              {senderName}
              {isCoach ? ' · Coach' : ' · Alumno'}
            </Text>
          )}

          <Text
            style={[
              styles.commentText,
              isMine ? styles.myCommentText : styles.theirCommentText,
            ]}
          >
            {item.text}
          </Text>

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.commentDate,
                isMine ? styles.myCommentDate : styles.theirCommentDate,
              ]}
            >
              {formatDate(item.created_at)}
            </Text>

            {isMine && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.is_read ? '#000' : '#4A3D00'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>
              FEEDBACK
            </Text>

            <Text style={styles.headerTitle}>
              Chat de entrenamiento
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#FFD700"
            style={{ flex: 1 }}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderComment}
            contentContainerStyle={[
              styles.listContent,
              comments.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmpty}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder={getPlaceholder()}
            placeholderTextColor="#666"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newComment.trim() || submitting) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!newComment.trim() || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="send" size={20} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#050505',
  },

  headerLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#fff',
    marginTop: 2,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    padding: 15,
    paddingBottom: 20,
  },

  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 34,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 15,
    maxWidth: '86%',
  },

  myMessage: {
    alignSelf: 'flex-end',
  },

  theirMessage: {
    alignSelf: 'flex-start',
  },

  bubble: {
    padding: 12,
    borderRadius: 18,
  },

  myBubble: {
    backgroundColor: '#FFD700',
    borderBottomRightRadius: 3,
  },

  theirBubble: {
    backgroundColor: '#111',
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: '#242424',
  },

  coachBubble: {
    borderColor: '#2F80ED55',
  },

  authorName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFD700',
    marginBottom: 5,
  },

  authorNameCoach: {
    color: '#6DB4FF',
  },

  commentText: {
    fontSize: 15,
    lineHeight: 20,
  },

  myCommentText: {
    color: '#000',
    fontWeight: '700',
  },

  theirCommentText: {
    color: '#fff',
  },

  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 5,
  },

  commentDate: {
    fontSize: 10,
  },

  myCommentDate: {
    color: '#4A3D00',
  },

  theirCommentDate: {
    color: '#666',
  },

  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },

  avatarStudent: {
    backgroundColor: '#FFD700',
  },

  avatarCoach: {
    backgroundColor: '#2F80ED',
  },

  smallAvatarText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '900',
  },

  inputArea: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#0A0A0A',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },

  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: '#000',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#333',
  },
});