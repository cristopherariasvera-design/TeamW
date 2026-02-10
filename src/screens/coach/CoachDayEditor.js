import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function CoachDayEditor({ route, navigation }) {
  const { plan } = route.params;
  
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [title, setTitle] = useState(plan.title || '');
  const [sections, setSections] = useState([]);

  // 1. CARGA DE DATOS (Mantiene los títulos que ya existan)
  useEffect(() => {
    try {
      let rawSections = plan.sections || [];
      if (typeof rawSections === 'string') {
        rawSections = JSON.parse(plan.sections);
      }

      if (rawSections.length > 0) {
        setSections(rawSections.map(s => ({
          id: Math.random().toString(36).substr(2, 9),
          name: s.name || '',
          content: s.content || ''
        })));
      } else {
        setSections([{ id: '1', name: 'A) CALENTAMIENTO', content: '' }]);
      }
    } catch (e) {
      setSections([{ id: '1', name: 'A) SECCIÓN', content: '' }]);
    }
  }, [plan]);

  // 2. BLOQUEADOR DE SALIDA (Solo preventivo si hay cambios)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges || loading) return;
      e.preventDefault();
      Alert.alert('Salir', '¿Descartar cambios?', [
        { text: 'No', style: 'cancel' },
        { text: 'Sí', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, hasChanges, loading]);

  const addSection = () => {
    const nextLetter = String.fromCharCode(65 + sections.length);
    setSections([...sections, { 
      id: Math.random().toString(), 
      name: `${nextLetter}) SECCIÓN`, 
      content: '' 
    }]);
    setHasChanges(true);
  };

  const removeSection = (id) => {
    if (sections.length <= 1) return;
    setSections(sections.filter(s => s.id !== id));
    setHasChanges(true);
  };

  const updateSection = (id, field, value) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
    setHasChanges(true);
  };

  // 3. GUARDADO DIRECTO (Sin validaciones, sin lag)
  const handleSave = async () => {
    setLoading(true);
    Keyboard.dismiss();

    try {
      const formattedSections = sections.map(s => ({
        name: s.name,
        content: s.content
      }));

      const { error } = await supabase
        .from('plans')
        .update({ 
          title: title, 
          sections: formattedSections,
          is_done: false 
        })
        .eq('id', plan.id);
      
      if (error) throw error;
      
      setHasChanges(false);
      navigation.goBack();

    } catch (error) {
      console.error(error);
      setLoading(false);
      Alert.alert("Error", "No se pudo guardar");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDITOR TEAM W</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.label}>TÍTULO GENERAL</Text>
          <TextInput 
            style={styles.titleInput}
            value={title}
            onChangeText={(t) => { setTitle(t); setHasChanges(true); }}
            placeholder="Ej: Empuje - Fuerza"
            placeholderTextColor="#444"
          />

          <Text style={styles.label}>BLOQUES DE TRABAJO</Text>

          {sections.map((section) => (
            <View key={section.id} style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                {/* TÍTULO DE LA SECCIÓN (AQUÍ ESTÁ) */}
                <TextInput 
                  style={styles.sectionNameInput}
                  value={section.name}
                  onChangeText={(val) => updateSection(section.id, 'name', val)}
                  placeholder="Nombre de sección..."
                  placeholderTextColor="#555"
                />
                <TouchableOpacity onPress={() => removeSection(section.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
              
              {/* CONTENIDO DE LA SECCIÓN */}
              <TextInput 
                style={styles.contentInput}
                value={section.content}
                onChangeText={(val) => updateSection(section.id, 'content', val)}
                placeholder="Escribe la rutina..."
                placeholderTextColor="#333"
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}

          {/* BOTÓN AÑADIR SECCIÓN */}
          <TouchableOpacity onPress={addSection} style={styles.addSectionBtn}>
            <Ionicons name="add-circle-outline" size={22} color="#FFD700" />
            <Text style={styles.addSectionText}>AGREGAR NUEVA SECCIÓN</Text>
          </TouchableOpacity>
          
          <View style={{ height: 150 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTÓN GUARDAR FLOTANTE */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.mainSaveBtn, loading && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.mainSaveText}>GUARDAR RUTINA</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 15, paddingTop: 55, paddingBottom: 15, 
    borderBottomWidth: 1, borderBottomColor: '#111' 
  },
  headerTitle: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  scroll: { padding: 20 },
  label: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 10, opacity: 0.8 },
  titleInput: { 
    backgroundColor: '#0a0a0a', color: '#fff', padding: 15, borderRadius: 12, 
    fontSize: 18, fontWeight: 'bold', marginBottom: 25, borderWidth: 1, borderColor: '#1a1a1a' 
  },
  sectionCard: { backgroundColor: '#080808', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#151515' },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 8 
  },
  sectionNameInput: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', flex: 1 },
  contentInput: { 
    color: '#eee', fontSize: 15, minHeight: 110, lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingTop: 10
  },
  addSectionBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' 
  },
  addSectionText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, 
    paddingBottom: Platform.OS === 'ios' ? 35 : 20, backgroundColor: 'rgba(0,0,0,0.9)' 
  },
  mainSaveBtn: { 
    backgroundColor: '#FFD700', paddingVertical: 18, borderRadius: 15, 
    alignItems: 'center', elevation: 8, shadowColor: '#FFD700', shadowOpacity: 0.2, shadowRadius: 10 
  },
  mainSaveText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});