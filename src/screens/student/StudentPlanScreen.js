import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function StudentPlanScreen({ navigation }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    if (profile?.id) {
      loadPlans();
    }
  }, [selectedMonth, selectedYear, profile?.id]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      
      // Consultamos los planes del alumno para el mes y año seleccionados
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', profile.id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('date', { ascending: true });

      if (error) throw error;

      // --- PROCESAMIENTO CRÍTICO DE DATOS ---
      // Esto asegura que 'sections' siempre sea un Array usable, 
      // sin importar si en la DB se guardó como texto o como JSON.
      const sanitizedPlans = (data || []).map(plan => {
        let processedSections = [];
        
        if (plan.sections) {
          if (typeof plan.sections === 'string') {
            try {
              processedSections = JSON.parse(plan.sections);
            } catch (e) {
              console.error("Error parseando sections string:", e);
              processedSections = [];
            }
          } else {
            processedSections = plan.sections;
          }
        }
        
        return {
          ...plan,
          sections: Array.isArray(processedSections) ? processedSections : []
        };
      });

      setPlans(sanitizedPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert("Error", "No se pudieron cargar los entrenamientos.");
    } finally {
      setLoading(false);
    }
  };

  const groupPlansByWeek = () => {
    const weeks = {};
    plans.forEach(plan => {
      // Si no tiene semana definida, lo mandamos a la 1 por defecto
      const weekNum = plan.week_number || 1;
      if (!weeks[weekNum]) {
        weeks[weekNum] = [];
      }
      weeks[weekNum].push(plan);
    });
    return weeks;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "S/F";
    const date = new Date(dateString);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[date.getUTCDay()]} ${date.getUTCDate()}`;
  };

  const changeMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const weeks = groupPlansByWeek();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Cargando planificación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selector de mes */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthButton}>
          <Ionicons name="chevron-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        <View style={styles.monthInfo}>
          <Text style={styles.monthText}>{monthNames[selectedMonth - 1]}</Text>
          <Text style={styles.yearText}>{selectedYear}</Text>
        </View>

        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthButton}>
          <Ionicons name="chevron-forward" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Lista de semanas */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
        {Object.keys(weeks).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>No hay planificación para este mes</Text>
            <Text style={styles.emptySubtext}>
              Tu coach aún no ha cargado entrenamientos para este periodo.
            </Text>
          </View>
        ) : (
          Object.keys(weeks).sort((a, b) => a - b).map(weekNum => (
            <View key={weekNum} style={styles.weekContainer}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>Semana {weekNum}</Text>
                <Text style={styles.weekSubtitle}>
                  {weeks[weekNum].length} sesión{weeks[weekNum].length !== 1 ? 'es' : ''}
                </Text>
              </View>

              <View style={styles.daysContainer}>
                {weeks[weekNum].map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.dayCard}
                    onPress={() => navigation.navigate('DayDetail', { plan })}
                  >
                    <View style={styles.dayHeader}>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayDate}>{formatDate(plan.date)}</Text>
                        <Text style={styles.dayTitle}>{plan.title || `Sesión`}</Text>
                      </View>
                      
                      <View style={styles.rightAction}>
                        {plan.is_done ? (
                          <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
                        ) : (
                          <Ionicons name="chevron-forward" size={24} color="#444" />
                        )}
                      </View>
                    </View>

                    {plan.sections && plan.sections.length > 0 && (
                      <View style={styles.previewContainer}>
                        <Text style={styles.sectionsPreview}>
                          {plan.sections.length} bloques de entrenamiento
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#666', marginTop: 16, fontSize: 14 },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  monthButton: { padding: 10 },
  monthInfo: { alignItems: 'center' },
  monthText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  yearText: { fontSize: 12, color: '#FFD700', marginTop: 2, letterSpacing: 1 },
  content: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  weekContainer: { marginBottom: 10 },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#080808',
  },
  weekTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFD700', textTransform: 'uppercase' },
  weekSubtitle: { fontSize: 12, color: '#444' },
  daysContainer: { paddingHorizontal: 15, paddingTop: 10 },
  dayCard: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayInfo: { flex: 1 },
  dayDate: { fontSize: 11, color: '#FFD700', fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  dayTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  rightAction: { marginLeft: 10 },
  previewContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  sectionsPreview: { fontSize: 13, color: '#555', fontStyle: 'italic' },
});