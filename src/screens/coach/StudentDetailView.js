import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function StudentDetailView({ route, navigation }) {
  // Verificamos que 'student' exista para evitar errores de renderizado
  const { student } = route.params || {};
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refresca la lista automáticamente cuando vuelves de la pantalla "PlannerScreen"
  useFocusEffect(
    useCallback(() => {
      if (student?.id) {
        fetchStudentPlans();
      }
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
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMonthHeader = (dateString) => {
    const date = new Date(dateString + 'T12:00:00'); // Evita desfase por zona horaria
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Entrenamientos de {student?.full_name}</Text>
      
      {loading && plans.length === 0 ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item, index }) => {
            const showHeader = index === 0 || getMonthHeader(item.date) !== getMonthHeader(plans[index - 1].date);
            
            return (
              <View>
                {showHeader && <Text style={styles.monthHeader}>{getMonthHeader(item.date)}</Text>}
                <TouchableOpacity 
                  style={styles.planCard}
                  onPress={() => navigation.navigate('DayDetail', { plan: item })} 
                >
                  <View>
                    <Text style={styles.planDate}>{item.date}</Text>
                    <Text style={styles.planTitle}>{item.title}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#FFD700" />
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Este alumno no tiene planes asignados aún.</Text>
          }
        />
      )}

      {/* BOTÓN FLOTANTE CORREGIDO */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.7}
        onPress={() => {
            // Asegúrate que el nombre 'PlannerScreen' esté registrado en tu Navigator
            navigation.navigate('PlannerScreen', { 
              studentId: student.id, 
              studentName: student.full_name 
            });
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#000" />
        <Text style={styles.fabText}>Planificar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  monthHeader: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, letterSpacing: 1 },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  planDate: { color: '#FFD700', fontSize: 11, marginBottom: 4 },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 35,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  fabText: { color: '#000', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }
});