import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StudentDetailView({ route, navigation }) {
  const { student } = route.params || {};
  const [groupedPlans, setGroupedPlans] = useState([]);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (student?.id) fetchStudentPlans();
    }, [student?.id])
  );

  const fetchStudentPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (error) throw error;
      formatAndGroupData(data || []);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAndGroupData = (data) => {
    const groups = {};
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

    data.forEach(plan => {
      const date = new Date(plan.date + 'T12:00:00');
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      const weekKey = `Semana ${plan.week_number}`;

      if (!groups[monthKey]) groups[monthKey] = {};
      if (!groups[monthKey][weekKey]) groups[monthKey][weekKey] = [];
      
      groups[monthKey][weekKey].push(plan);
    });

    const formatted = Object.keys(groups).map(month => ({
      title: month,
      weeks: Object.keys(groups[month]).map(week => ({
        title: week,
        data: groups[month][week].sort((a, b) => new Date(a.date) - new Date(b.date))
      }))
    }));

    setGroupedPlans(formatted);
    
    // Opcional: Expandir la primera semana automáticamente si hay datos
    if (formatted.length > 0 && formatted[0].weeks.length > 0) {
        const firstWeekId = `${formatted[0].title}-${formatted[0].weeks[0].title}`;
        setExpandedWeeks({ [firstWeekId]: true });
    }
  };

  const toggleWeek = (weekId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }));
  };

  const renderSession = (session) => (
    <TouchableOpacity 
      key={session.id} 
      style={styles.sessionCard}
      onPress={() => navigation.navigate('DayDetail', { plan: session })}
    >
      <View style={styles.sessionInfo}>
        <View style={[styles.statusIndicator, session.is_done && styles.statusDone]} />
        <View>
          <Text style={styles.sessionTitle}>{session.day_name || session.title}</Text>
          <Text style={styles.sessionDate}>
            {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#444" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER PERSONALIZADO */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerLabel}>PROGRAMACIÓN DE</Text>
          <Text style={styles.headerStudentName}>{student?.full_name}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={groupedPlans}
          keyExtractor={(item) => item.title}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
          renderItem={({ item: month }) => (
            <View style={styles.monthSection}>
              <Text style={styles.monthHeaderText}>{month.title}</Text>
              
              {month.weeks.map(week => {
                const weekId = `${month.title}-${week.title}`;
                const isExpanded = expandedWeeks[weekId];

                return (
                  <View key={weekId} style={styles.weekWrapper}>
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      style={[styles.weekBar, isExpanded && styles.weekBarActive]} 
                      onPress={() => toggleWeek(weekId)}
                    >
                      <View style={styles.weekRow}>
                        <MaterialCommunityIcons 
                          name="layers-triple-outline" 
                          size={20} 
                          color={isExpanded ? "#000" : "#FFD700"} 
                        />
                        <Text style={[styles.weekTitleText, isExpanded && styles.weekTitleActive]}>
                          {week.title}
                        </Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={isExpanded ? "#000" : "#666"} 
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.sessionsContainer}>
                        {week.data.map(renderSession)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="calendar-search" size={60} color="#222" />
              <Text style={styles.emptyText}>No hay planes programados aún.</Text>
            </View>
          }
        />
      )}

      {/* FAB - BOTÓN DE ACCIÓN PRINCIPAL */}
      <TouchableOpacity 
        style={styles.mainFab} 
        onPress={() => navigation.navigate('PlannerScreen', { 
          studentId: student.id, 
          studentName: student.full_name 
        })}
      >
        <Ionicons name="add-circle" size={24} color="#000" />
        <Text style={styles.mainFabText}>NUEVO PLAN MENSUAL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  // Header
  customHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { backgroundColor: '#111', padding: 10, borderRadius: 12, marginRight: 15 },
  headerLabel: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  headerStudentName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },

  // Secciones
  monthSection: { marginBottom: 30 },
  monthHeaderText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginBottom: 15, textTransform: 'uppercase' },
  
  weekWrapper: { marginBottom: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0A0A0A' },
  weekBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#111' },
  weekBarActive: { backgroundColor: '#FFD700' },
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  weekTitleText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 12 },
  weekTitleActive: { color: '#000' },

  // Sesiones
  sessionsContainer: { padding: 10, backgroundColor: '#050505' },
  sessionCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  sessionInfo: { flexDirection: 'row', alignItems: 'center' },
  statusIndicator: { width: 4, height: 25, borderRadius: 2, backgroundColor: '#333', marginRight: 15 },
  statusDone: { backgroundColor: '#FFD700' },
  sessionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  sessionDate: { color: '#666', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 80, opacity: 0.5 },
  emptyText: { color: '#fff', marginTop: 15, fontSize: 14 },

  // Floating Action Button
  mainFab: {
    position: 'absolute', bottom: 35, left: 20, right: 20,
    backgroundColor: '#FFD700', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 20, borderRadius: 20,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8
  },
  mainFabText: { color: '#000', fontWeight: '900', marginLeft: 10, fontSize: 14, letterSpacing: 1 }
});