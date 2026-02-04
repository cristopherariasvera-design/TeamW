import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CommentsModal from './CommentsModal';

export default function DayDetailScreen({ route, navigation }) {
  const { plan } = route.params;
  const { profile } = useAuth();
  const isCoach = profile?.role === 'coach';

  const [isDone, setIsDone] = useState(plan.is_done);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSections, setEditedSections] = useState([]);

  useEffect(() => {
    let rawSections = plan.sections;
    if (typeof rawSections === 'string') {
      try { rawSections = JSON.parse(rawSections); } 
      catch (e) { rawSections = []; }
    }
    setEditedSections(Array.isArray(rawSections) ? rawSections : []);
  }, [plan]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', day: 'numeric', month: 'short' 
    }).toUpperCase();
  };

  const addSection = () => {
    const nextLetter = String.fromCharCode(65 + editedSections.length);
    setEditedSections([...editedSections, { name: `${nextLetter}) SECCIÓN`, content: '' }]);
  };

  const updateSection = (index, field, value) => {
    const updated = [...editedSections];
    updated[index][field] = value;
    setEditedSections(updated);
  };

  const removeSection = (index) => {
    setEditedSections(editedSections.filter((_, i) => i !== index));
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('plans')
        .update({ sections: editedSections, blocks: editedSections })
        .eq('id', plan.id);

      if (error) throw error;
      Alert.alert("¡Listo!", "Entrenamiento actualizado.");
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDone = async () => {
    try {
      const newStatus = !isDone;
      const { error } = await supabase.from('plans').update({ is_done: newStatus }).eq('id', plan.id);
      if (error) throw error;
      setIsDone(newStatus);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>{formatDate(plan.date)}</Text>
          <Text style={styles.headerTitle}>{plan.title || 'Entrenamiento'}</Text>
        </View>

        {isCoach ? (
          <TouchableOpacity 
            style={[styles.iconCircle, isEditing && styles.saveIconActive]} 
            onPress={() => isEditing ? saveChanges() : setIsEditing(true)}
          >
            <Ionicons name={isEditing ? "checkmark" : "pencil"} size={22} color={isEditing ? "#000" : "#FFD700"} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={toggleDone} style={styles.iconCircle}>
            <Ionicons name={isDone ? "checkmark-circle" : "ellipse-outline"} size={28} color={isDone ? "#FFD700" : "#444"} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {isEditing ? (
          /* MODO EDICIÓN */
          <View style={styles.editWrapper}>
            <Text style={styles.editInfoText}>Estás editando la sesión del alumno</Text>
            {editedSections.map((section, index) => (
              <View key={index} style={styles.editCard}>
                <View style={styles.editCardHeader}>
                  <TextInput
                    style={styles.inputTitle}
                    value={section.name}
                    onChangeText={(t) => updateSection(index, 'name', t)}
                    placeholder="Nombre del bloque..."
                    placeholderTextColor="#555"
                  />
                  <TouchableOpacity onPress={() => removeSection(index)}>
                    <Ionicons name="close-circle" size={22} color="#ff4444" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.inputContent}
                  multiline
                  placeholder="Instrucciones, series, reps..."
                  placeholderTextColor="#444"
                  value={section.content}
                  onChangeText={(t) => updateSection(index, 'content', t)}
                />
              </View>
            ))}
            
            <TouchableOpacity style={styles.addSectionBtn} onPress={addSection}>
              <Ionicons name="add" size={20} color="#FFD700" />
              <Text style={styles.addSectionText}>AÑADIR BLOQUE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelBtnText}>Descartar cambios</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* MODO VISTA */
          <View style={styles.viewWrapper}>
            {editedSections.length > 0 ? (
              editedSections.map((section, index) => (
                <View key={index} style={styles.displayCard}>
                  <View style={styles.sideIndicator} />
                  <View style={styles.displayContent}>
                    <Text style={styles.displaySectionName}>{section.name}</Text>
                    <Text style={styles.displaySectionText}>{section.content}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="dumbbell" size={50} color="#1a1a1a" />
                <Text style={styles.emptyText}>Sin programación asignada</Text>
              </View>
            )}

            <TouchableOpacity style={styles.commentsButton} onPress={() => setCommentsVisible(true)}>
              <View style={styles.commentIconBg}>
                <Ionicons name="chatbubbles" size={18} color="#000" />
              </View>
              <Text style={styles.commentsButtonText}>Feedback del entrenamiento</Text>
              <Ionicons name="chevron-forward" size={18} color="#333" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* BOTÓN FLOTANTE DE GUARDADO (SOLO EN EDICIÓN) */}
      {isEditing && (
        <TouchableOpacity style={styles.floatingSaveBtn} onPress={saveChanges} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.floatingSaveText}>GUARDAR CAMBIOS</Text>}
        </TouchableOpacity>
      )}

      <CommentsModal visible={commentsVisible} onClose={() => setCommentsVisible(false)} planId={plan.id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222'
  },
  saveIconActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerDate: { fontSize: 10, color: '#FFD700', fontWeight: '900', letterSpacing: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 2 },
  
  content: { flex: 1 },
  viewWrapper: { padding: 20 },
  
  // Vista Alumno
  displayCard: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111'
  },
  sideIndicator: { width: 4, backgroundColor: '#FFD700' },
  displayContent: { padding: 20, flex: 1 },
  displaySectionName: { color: '#FFD700', fontWeight: 'bold', fontSize: 14, marginBottom: 8, textTransform: 'uppercase' },
  displaySectionText: { color: '#eee', fontSize: 15, lineHeight: 22 },

  // Modo Edición
  editWrapper: { padding: 20 },
  editInfoText: { color: '#444', textAlign: 'center', marginBottom: 20, fontSize: 12, fontWeight: 'bold' },
  editCard: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  editCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 16, flex: 1 },
  inputContent: { color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },
  
  addSectionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 15, 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: '#333', 
    borderStyle: 'dashed',
    marginTop: 10 
  },
  addSectionText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  
  cancelBtn: { marginTop: 20, alignItems: 'center' },
  cancelBtnText: { color: '#555', fontSize: 13 },

  floatingSaveBtn: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: '#FFD700', padding: 20, borderRadius: 20,
    alignItems: 'center', shadowColor: '#FFD700', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10
  },
  floatingSaveText: { color: '#000', fontWeight: '900', letterSpacing: 1 },

  commentsButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
    padding: 12, borderRadius: 20, marginTop: 20, borderWidth: 1, borderColor: '#222'
  },
  commentIconBg: { backgroundColor: '#FFD700', padding: 8, borderRadius: 12, marginRight: 12 },
  commentsButtonText: { color: '#fff', flex: 1, fontWeight: '600', fontSize: 14 },

  emptyContainer: { padding: 80, alignItems: 'center' },
  emptyText: { color: '#222', fontWeight: 'bold', marginTop: 10 }
});