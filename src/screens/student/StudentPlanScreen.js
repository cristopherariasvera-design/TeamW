import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
    loadPlans();
  }, [selectedMonth, selectedYear]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', profile.id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('date', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupPlansByWeek = () => {
    const weeks = {};
    plans.forEach(plan => {
      const weekNum = plan.week_number || 1;
      if (!weeks[weekNum]) {
        weeks[weekNum] = [];
      }
      weeks[weekNum].push(plan);
    });
    return weeks;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[date.getDay()]} ${date.getDate()}`;
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
      <ScrollView style={styles.content}>
        {Object.keys(weeks).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>No hay planificación para este mes</Text>
            <Text style={styles.emptySubtext}>
              Tu coach aún no ha cargado entrenamientos
            </Text>
          </View>
        ) : (
          Object.keys(weeks).sort().map(weekNum => (
            <View key={weekNum} style={styles.weekContainer}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>Semana {weekNum}</Text>
                <Text style={styles.weekSubtitle}>
                  {weeks[weekNum].length} día{weeks[weekNum].length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.daysContainer}>
                {weeks[weekNum].map((plan, index) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.dayCard}
                    onPress={() => navigation.navigate('DayDetail', { plan })}
                  >
                    <View style={styles.dayHeader}>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayDate}>{formatDate(plan.date)}</Text>
                        <Text style={styles.dayTitle}>{plan.title || `Día ${index + 1}`}</Text>
                      </View>
                      
                      {plan.is_done ? (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                      )}
                    </View>

                    {plan.sections && plan.sections.length > 0 && (
                      <Text style={styles.sectionsPreview}>
                        {plan.sections.length} sección{plan.sections.length !== 1 ? 'es' : ''}
                      </Text>
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  monthButton: {
    padding: 8,
  },
  monthInfo: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  yearText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  weekContainer: {
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  weekSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  daysContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dayCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  completedBadge: {
    marginLeft: 12,
  },
  sectionsPreview: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});