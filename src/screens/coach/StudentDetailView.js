import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function StudentDetailView({ route, navigation }) {
  const { student } = route.params;
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentPlans();
  }, [student.id]);

  const fetchStudentPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', student.id) // <--- CAMBIO CLAVE: de 'user_id' a 'student_id'
        .order('date', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Entrenamientos de {student.full_name}</Text>
      
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.planCard}
            onPress={() => navigation.navigate('DayDetail', { plan: item })} 
          >
            <View>
              <Text style={styles.planDate}>{item.date}</Text>
              <Text style={styles.planTitle}>{item.title}</Text>
            </View>
            <View style={styles.statusContainer}>
              {/* Icono de comentarios */}
              <Ionicons 
                name="chatbubble-ellipses" 
                size={24} 
                color="#FFD700" 
              />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Este alumno no tiene planes asignados aún.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  planDate: { color: '#FFD700', fontSize: 12, marginBottom: 4 },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 }
});