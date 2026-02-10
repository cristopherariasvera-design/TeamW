import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';

export default function PlannerScreen({ route, navigation }) {
  const { studentId, studentName } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [startWeekNumber, setStartWeekNumber] = useState(1); 
  
  // Inicializamos con la fecha de hoy por defecto (para el caso "si no tiene fecha")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [numSessions, setNumSessions] = useState(3); 

  // --- NUEVA LÓGICA: AUTO-DETECTAR FECHA DE INICIO ---
  useEffect(() => {
    const fetchStudentExpiry = async () => {
      if (!studentId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan_end_date')
          .eq('id', studentId)
          .single();

        if (error) throw error;

        if (data?.plan_end_date) {
          // CASO A: El alumno tiene fecha de vencimiento.
          // La fecha de inicio será: Vencimiento + 1 día.
          const expiry = new Date(data.plan_end_date);
          expiry.setDate(expiry.getDate() + 0); // Sumamos 1 día
          
          setStartDate(expiry.toISOString().split('T')[0]);
        } else {
          // CASO B: No tiene fecha (es nuevo o inactivo).
          // Se mantiene la fecha actual (hoy) que definimos en el useState inicial.
        }
      } catch (err) {
        console.log("No se pudo obtener la fecha anterior, usando fecha actual.", err);
      }
    };

    fetchStudentExpiry();
  }, [studentId]);
  // ----------------------------------------------------

  const adjustValue = (setter, val, min = 1) => {
    setter(prev => Math.max(min, prev + val));
  };

  const handleSaveMonth = async () => {
    if (!studentId) {
      Alert.alert("Error", "No se identificó al alumno.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión de Coach no encontrada");

      // 1. Preparar las sesiones del Plan
      const allEntries = [];
      const baseDate = new Date(startDate); // Usará la fecha que calculamos automáticamente

      // Calculamos la nueva fecha de fin (Fecha de inicio + 30 días)
      const endDate = new Date(baseDate);
      endDate.setDate(baseDate.getDate() + 30); 

      for (let w = 0; w < 4; w++) {
        const currentWeekNum = startWeekNumber + w;
        const weekDate = new Date(baseDate);
        weekDate.setDate(baseDate.getDate() + (w * 7));
        
        for (let s = 1; s <= numSessions; s++) {
          allEntries.push({
            student_id: studentId,
            coach_id: user.id,
            month: weekDate.getUTCMonth() + 1,
            year: weekDate.getUTCFullYear(),
            date: weekDate.toISOString().split('T')[0],
            day_name: `Sesión ${s}`,
            title: `Semana ${currentWeekNum} - Sesión ${s}`,
            sections: [],
            blocks: [],
            week_number: currentWeekNum,
            is_done: false
          });
        }
      }

      // 2. Guardar todo en paralelo
      const promises = [
        // A: Insertar sesiones
        supabase.from('plans').insert(allEntries),

        // B: Actualizar vencimiento del alumno
        supabase.from('profiles').update({
          plan_end_date: endDate.toISOString().split('T')[0],
          status: 'Active'
        }).eq('id', studentId),

        // C: Historial
        supabase.from('plan_history').insert({
          student_id: studentId,
          coach_id: user.id,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          amount: 0
        })
      ];

      const results = await Promise.all(promises);
      const errors = results.map(r => r.error).filter(e => e !== null);
      if (errors.length > 0) throw errors[0];

      Alert.alert(
        "¡Plan Creado!", 
        `Se ha programado el inicio para el ${baseDate.toLocaleDateString()}.\nNuevo vencimiento: ${endDate.toLocaleDateString()}`
      );
      
      navigation.goBack();
      
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message || "Ocurrió un error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollInside} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planificación</Text>
          <Text style={styles.subTitle}>Configurando mes para {studentName}</Text>
        </View>

        <View style={styles.card}>
          
          {/* STEPPER SEMANA INICIAL */}
          <Text style={styles.label}>Semana de inicio</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity onPress={() => adjustValue(setStartWeekNumber, -1)} style={styles.stepBtn}>
              <MaterialCommunityIcons name="minus" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.stepValueDisplay}>
              <Text style={styles.stepValueText}>Semana {startWeekNumber}</Text>
              <Text style={styles.stepValueSub}>Hasta semana {startWeekNumber + 3}</Text>
            </View>
            <TouchableOpacity onPress={() => adjustValue(setStartWeekNumber, 1)} style={styles.stepBtn}>
              <MaterialCommunityIcons name="plus" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* CHIPS SESIONES POR SEMANA */}
          <Text style={styles.label}>Sesiones semanales</Text>
          <View style={styles.sessionsRow}>
            {[2, 3, 4, 5, 6].map((num) => (
              <TouchableOpacity 
                key={num} 
                style={[styles.sessionChip, numSessions === num && styles.sessionChipActive]}
                onPress={() => setNumSessions(num)}
              >
                <Text style={[styles.sessionChipText, numSessions === num && styles.sessionChipTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* INPUT DE FECHA */}
          <Text style={styles.label}>Fecha de inicio</Text>
          <View style={styles.dateWrapper}>
            <MaterialCommunityIcons name="calendar" size={20} color="#FFD700" style={{marginRight: 10}} />
            {Platform.OS === 'web' ? (
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                style={webInputStyle} 
              />
            ) : (
              <TextInput 
                style={styles.mobileDateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#444"
              />
            )}
          </View>

          {/* RESUMEN */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{numSessions * 4}</Text>
              <Text style={styles.summaryLabel}>Total Sesiones</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="calendar-arrow-right" size={20} color="#FFD700" />
              <Text style={styles.summaryLabel}>Vence en 30 días</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSaveMonth} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>GENERAR Y RENOVAR</Text>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const webInputStyle = {
  backgroundColor: 'transparent',
  color: '#fff',
  border: 'none',
  fontSize: '16px',
  width: '100%',
  outline: 'none',
  cursor: 'pointer'
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollInside: { padding: 20, paddingTop: 50 },
  header: { marginBottom: 25 },
  backBtn: { marginBottom: 10 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subTitle: { color: '#666', fontSize: 14 },
  card: { backgroundColor: '#111', padding: 25, borderRadius: 25, borderWidth: 1, borderColor: '#222' },
  label: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', padding: 10, borderRadius: 20, marginBottom: 25 },
  stepBtn: { backgroundColor: '#FFD700', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  stepValueDisplay: { alignItems: 'center' },
  stepValueText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  stepValueSub: { color: '#444', fontSize: 10 },

  sessionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  sessionChip: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  sessionChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  sessionChipText: { color: '#666', fontWeight: 'bold' },
  sessionChipTextActive: { color: '#000' },

  dateWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#222', marginBottom: 25 },
  mobileDateInput: { color: '#fff', flex: 1, fontSize: 16 },

  summaryBox: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20, marginBottom: 20, alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#FFD700', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: '#555', fontSize: 10, textTransform: 'uppercase', marginTop: 4 },
  divider: { width: 1, height: '100%', backgroundColor: '#222' },

  primaryBtn: { backgroundColor: '#FFD700', padding: 20, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 16, marginRight: 10 } 
});