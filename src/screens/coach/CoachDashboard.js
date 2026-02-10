import React, { useState, useCallback } from 'react'; 
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native'; 
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDashboard({ navigation }) {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Función para obtener los alumnos desde Supabase
  const fetchStudents = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // Filtramos por rol, coach_id y status
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'alumno')
        .eq('coach_id', profile.id)
        .eq('status', 'Active');

      if (profileError) throw profileError;

      // Verificamos si tienen mensajes nuevos (notificaciones)
      const studentsWithAlerts = await Promise.all(profiles.map(async (student) => {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', student.id)
          .eq('is_read', false)
          .eq('sender_role', 'alumno');

        return { ...student, hasNewMessages: count > 0 };
      }));

      setStudents(studentsWithAlerts);
    } catch (error) {
      console.error("Error al cargar alumnos:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Se ejecuta cada vez que la pantalla gana el foco
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchStudents();
      }
    }, [profile?.id])
  );

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.studentCard}
      onPress={() => navigation.navigate('StudentDetail', { student: item })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.full_name?.charAt(0) || '?'}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.studentName}>{item.full_name}</Text>
          {item.hasNewMessages && (
            <View style={styles.notificationDot} />
          )}
        </View>
        <Text style={styles.studentSub}>
          {item.level || 'Sin nivel'} • {item.box_city || 'Sin ciudad'}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#555" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER CORREGIDO CON DOS BOTONES */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcome}>Panel de Coach</Text>
            <Text style={styles.title}>Mis Atletas</Text>
          </View>
          
          <View style={styles.headerButtonsContainer}>
            {/* BOTÓN ADMINISTRACIÓN */}
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate('AdminStudents')}
            >
              <Ionicons name="options-outline" size={22} color="#FFD700" />
            </TouchableOpacity>

            {/* BOTÓN AGREGAR (Mantenido con espacio a la izquierda) */}
            <TouchableOpacity 
              style={[styles.headerActionBtn, { marginLeft: 10 }]}
              onPress={() => navigation.navigate('AddStudent')}
            >
              <Ionicons name="person-add" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>
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
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                setRefreshing(true);
                fetchStudents();
              }} 
              tintColor="#FFD700" 
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={60} color="#333" />
              <Text style={styles.emptyText}>No tienes alumnos asociados.</Text>
              <TouchableOpacity 
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AddStudent')}
              >
                <Text style={styles.emptyBtnText}>Registrar mi primer alumno</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* BOTÓN FLOTANTE */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddStudent')}
      >
        <Ionicons name="add" size={32} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    padding: 20, 
    paddingTop: 50, 
    backgroundColor: '#111', 
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcome: { 
    color: '#FFD700', 
    fontSize: 12, 
    fontWeight: 'bold', 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },
  title: { 
    color: '#fff', 
    fontSize: 26, 
    fontWeight: 'bold', 
    marginTop: 2 
  },
  headerActionBtn: { 
    padding: 10, 
    backgroundColor: '#1a1a1a', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  list: { 
    padding: 15, 
    paddingBottom: 100 
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: { color: '#000', fontWeight: '900', fontSize: 20 },
  infoContainer: { flex: 1, marginLeft: 15 },
  studentName: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  studentSub: { color: '#666', fontSize: 13, marginTop: 4 },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginLeft: 8
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#666', marginTop: 15, fontSize: 16 },
  emptyBtn: { 
    marginTop: 20, 
    backgroundColor: '#1a1a1a', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#FFD700' 
  },
  emptyBtnText: { color: '#FFD700', fontWeight: 'bold' }
});