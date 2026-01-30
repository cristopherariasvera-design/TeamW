import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDashboard({ navigation }) {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = async () => {
  try {
    setLoading(true);
    
    // 1. Traer alumnos
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'alumno')
      .eq('status', 'Active');

    if (profileError) throw profileError;

    // 2. Para cada alumno, verificar si tiene comentarios sin leer del rol 'alumno'
    const studentsWithAlerts = await Promise.all(profiles.map(async (student) => {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', student.id)
        .eq('is_read', false)
        .eq('sender_role', 'alumno'); // Solo nos interesan los que escribió el alumno

      return { ...student, hasNewMessages: count > 0 };
    }));

    setStudents(studentsWithAlerts);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchStudents();
  }, []);

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.studentCard}
      onPress={() => navigation.navigate('StudentDetail', { student: item })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text>
      </View>
      
<View style={styles.infoContainer}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Text style={styles.studentName}>{item.full_name}</Text>
    {item.hasNewMessages && (
      <View style={styles.notificationDot} /> // Un pequeño círculo rojo
    )}
  </View>
  <Text style={styles.studentSub}>{item.level} • {item.box_city}</Text>
</View>

      <Ionicons name="chevron-forward" size={20} color="#555" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Panel de Coach</Text>
        <Text style={styles.title}>Mis Atletas</Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              fetchStudents();
            }} tintColor="#FFD700" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay alumnos registrados aún.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, paddingTop: 30, backgroundColor: '#1a1a1a' },
  welcome: { color: '#FFD700', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  list: { padding: 15 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  infoContainer: { flex: 1, marginLeft: 15 },
  studentName: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  studentSub: { color: '#888', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50 }
});