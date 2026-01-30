import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';

export default function PlannerScreen({ route, navigation }) {
  const { studentId, studentName } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); 
  const [weekNumber, setWeekNumber] = useState('1');
  
  // CONFIGURACIÓN DE PLAN
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [numSessions, setNumSessions] = useState('5'); // Por defecto 5 sesiones

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [weekPlan, setWeekPlan] = useState({});

  const startPlanning = () => {
    const sessionsCount = parseInt(numSessions);
    
    if (isNaN(sessionsCount) || sessionsCount < 1) {
      Alert.alert("Error", "Ingresa una cantidad válida de sesiones.");
      return;
    }
    if (!endDate) {
      Alert.alert("Error", "Selecciona una fecha de fin para el periodo.");
      return;
    }

    let initialPlan = {};
    for (let i = 1; i <= sessionsCount; i++) {
      const currentLabel = `Sesión ${i}`;
      initialPlan[currentLabel] = [{ id: Math.random(), title: 'A) SECCIÓN', content: '' }];
    }
    setWeekPlan(initialPlan);
    setStep(2);
  };

  const daysKeys = Object.keys(weekPlan);
  const currentDayKey = daysKeys[selectedDayIndex];

  const addBlock = () => {
    const currentBlocks = weekPlan[currentDayKey];
    const nextLetter = String.fromCharCode(65 + currentBlocks.length);
    const newBlock = { id: Math.random(), title: `${nextLetter}) SECCIÓN`, content: '' };
    setWeekPlan({ ...weekPlan, [currentDayKey]: [...currentBlocks, newBlock] });
  };

  const updateBlock = (id, field, value) => {
    const updatedBlocks = weekPlan[currentDayKey].map(b => b.id === id ? { ...b, [field]: value } : b);
    setWeekPlan({ ...weekPlan, [currentDayKey]: updatedBlocks });
  };

const handleSave = async () => {
  setLoading(true);
  try {
    const entries = daysKeys.map((dayLabel, index) => {
      const dayBlocks = weekPlan[dayLabel].filter(b => b.content.trim() !== '');
      if (dayBlocks.length === 0) return null;

      // Convertimos el formato para que coincida con la columna 'sections' de tu DB
const sectionsFormat = dayBlocks.map(b => ({
  name: b.title,
  content: b.content
}));

return {
  student_id: studentId,
  day_name: dayLabel,
  title: `Semana ${weekNumber} - ${dayLabel}`,
  date: startDate,
  end_date: endDate,
  sections: sectionsFormat, // QUITAMOS el JSON.stringify
  blocks: dayBlocks,
  week_number: parseInt(weekNumber),
  is_done: false
};
    }).filter(Boolean);

    if (entries.length === 0) throw new Error("No hay contenido para guardar.");

    const { error } = await supabase.from('plans').insert(entries);
    if (error) throw error;

    Alert.alert("Éxito", "Planificación guardada.");
    navigation.goBack();
  } catch (e) {
    console.error("Error al guardar:", e);
    Alert.alert("Error", e.message);
  } finally {
    setLoading(false);
  }
};

  if (step === 1) {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.headerTitle}>Configurar Planificación</Text>
        <Text style={styles.subTitle}>Alumno: {studentName}</Text>
        
        <View style={styles.card}>
          <Text style={styles.label}>Semana #</Text>
          <TextInput style={styles.bigInput} value={weekNumber} onChangeText={setWeekNumber} keyboardType="numeric" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha Inicio</Text>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={webInputStyle} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Fecha Fin</Text>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={webInputStyle} />
            </View>
          </View>

          <Text style={styles.label}>Cantidad de Sesiones (Días de entreno)</Text>
          <TextInput 
            style={styles.bigInput} 
            value={numSessions} 
            onChangeText={setNumSessions} 
            keyboardType="numeric" 
            placeholder="Ej: 3"
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={startPlanning}>
            <Text style={styles.primaryBtnText}>Comenzar a Planificar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setStep(1)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitleSmall}>Semana {weekNumber} - {numSessions} Sesiones</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayNav}>
        {daysKeys.map((day, index) => (
          <TouchableOpacity 
            key={day} 
            onPress={() => setSelectedDayIndex(index)}
            style={[styles.dayTab, selectedDayIndex === index && styles.activeTab]}
          >
            <Text style={[styles.dayTabText, selectedDayIndex === index && styles.activeTabText]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{currentDayKey}</Text>
          <TouchableOpacity onPress={addBlock} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ BLOQUE</Text>
          </TouchableOpacity>
        </View>

        {weekPlan[currentDayKey].map((block) => (
          <View key={block.id} style={styles.blockCard}>
            <TextInput style={styles.blockTitle} value={block.title} onChangeText={(t) => updateBlock(block.id, 'title', t)} />
            <TextInput multiline placeholder="Escribe aquí..." placeholderTextColor="#555" style={styles.textArea} value={block.content} onChangeText={(t) => updateBlock(block.id, 'content', t)} />
          </View>
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>GUARDAR PLAN</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const webInputStyle = {
  backgroundColor: '#000', color: '#FFD700', padding: '12px', borderRadius: '10px', fontSize: '14px', border: 'none', borderBottom: '2px solid #FFD700', width: '100%', outline: 'none'
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  setupContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  headerTitle: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subTitle: { color: '#666', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222' },
  label: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
  bigInput: { backgroundColor: '#000', color: '#fff', padding: 12, borderRadius: 10, borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  primaryBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, marginTop: 25, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 20 },
  headerTitleSmall: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginLeft: 15 },
  dayNav: { flexDirection: 'row', marginBottom: 20, maxHeight: 45 },
  dayTab: { paddingHorizontal: 20, paddingVertical: 10, marginRight: 8, backgroundColor: '#111', borderRadius: 10 },
  activeTab: { backgroundColor: '#FFD700' },
  dayTabText: { color: '#fff', fontWeight: 'bold' },
  activeTabText: { color: '#000' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  dayTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#222', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700' },
  addBtnText: { color: '#FFD700', fontWeight: 'bold' },
  blockCard: { backgroundColor: '#0a0a0a', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  blockTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  textArea: { color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});