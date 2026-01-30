import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
// 1. IMPORTA EL MODAL (Asegúrate de que la ruta sea correcta)
import CommentsModal from './CommentsModal';

export default function DayDetailScreen({ route, navigation }) {
  const { plan } = route.params;
  const [isDone, setIsDone] = useState(plan.is_done);
  
  // 2. ESTADO PARA MOSTRAR/OCULTAR EL MODAL
  const [commentsVisible, setCommentsVisible] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const toggleDone = async () => {
    try {
      const newStatus = !isDone;
      const { error } = await supabase
        .from('plans')
        .update({ is_done: newStatus })
        .eq('id', plan.id);

      if (error) throw error;
      
      setIsDone(newStatus);
      Alert.alert(
        'Éxito',
        newStatus ? '¡Entrenamiento completado!' : 'Marcado como pendiente'
      );
    } catch (error) {
      console.error('Error updating plan:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>{formatDate(plan.date)}</Text>
          <Text style={styles.headerTitle}>{plan.title || 'Entrenamiento'}</Text>
        </View>
        <TouchableOpacity onPress={toggleDone}>
          <Ionicons 
            name={isDone ? "checkmark-circle" : "checkmark-circle-outline"} 
            size={32} 
            color={isDone ? "#4CAF50" : "#999"} 
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {plan.sections && plan.sections.length > 0 ? (
          plan.sections.map((section, index) => (
            <View key={index} style={styles.sectionCard}>
              <Text style={styles.sectionName}>{section.name}</Text>
              <Text style={styles.sectionContent}>{section.content}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay contenido para este día</Text>
          </View>
        )}

        {/* 3. BOTÓN DE COMENTARIOS ACTUALIZADO */}
        <TouchableOpacity 
          style={styles.commentsButton}
          onPress={() => setCommentsVisible(true)} // Abrir modal
        >
          <Ionicons name="chatbubble-outline" size={20} color="#FFD700" />
          <Text style={styles.commentsButtonText}>Agregar comentario</Text>
        </TouchableOpacity>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsSectionTitle}>Comunidad Team W</Text>
          <Text style={styles.noComments}>Toca el botón para ver la conversación</Text>
        </View>
      </ScrollView>

      {/* 4. EL COMPONENTE DEL MODAL (Invisible hasta que sea true) */}
      <CommentsModal 
        visible={commentsVisible} 
        onClose={() => setCommentsVisible(false)} // Cerrar modal
        planId={plan.id} // Pasar el ID del entrenamiento
      />
    </View>
  );
}

// ... (tus estilos se mantienen iguales)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: 50, // Ajuste para que no choque con la notch
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerDate: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 24,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  commentsButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  commentsSection: {
    marginBottom: 40,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  noComments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
});