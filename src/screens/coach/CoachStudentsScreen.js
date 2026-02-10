import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachStudentsScreen() {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (profile?.id) fetchAllStudents();
  }, [profile?.id]);

  // Filtrar en tiempo real cuando cambia el texto de búsqueda o la lista original
  useEffect(() => {
    const filtered = students.filter(s => 
      s.full_name?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [search, students]);

  const fetchAllStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, level, status, plan_end_date')
        .eq('role', 'alumno')
        .eq('coach_id', profile.id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar con la tabla de perfiles');
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (studentId, studentName) => {
    Alert.alert(
      'Renovar Plan',
      `¿Deseas sumar 30 días al plan de ${studentName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('renew_student_plan', { 
                target_student_id: studentId 
              });
              if (error) throw error;
              Alert.alert('Éxito', 'Plan renovado.');
              fetchAllStudents();
            } catch (err) {
              Alert.alert('Error', 'No se pudo renovar.');
            }
          }
        }
      ]
    );
  };

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const renderItem = ({ item }) => {
    const isActive = item.status === 'Active';
    const isExpired = item.plan_end_date && new Date(item.plan_end_date) < new Date();

    return (
      <View style={styles.row}>
        <View style={styles.infoCol}>
          <Text style={styles.nameText}>{item.full_name || 'Sin Nombre'}</Text>
          <Text style={styles.levelText}>{item.level || 'Beginner'}</Text>
        </View>

        <View style={styles.dateCol}>
          <Text style={styles.dateLabel}>VENCE</Text>
          <Text style={[styles.dateText, isExpired && isActive && { color: '#FF3B30' }]}>
            {formatDate(item.plan_end_date)}
          </Text>
        </View>

        <View style={styles.actionsCol}>
          {/* <TouchableOpacity style={styles.renewBtn} onPress={() => handleRenew(item.id, item.full_name)}>
            <Ionicons name="calendar-outline" size={18} color="#FFD700" />
            <Text style={styles.renewBtnText}>+30d</Text>
          </TouchableOpacity> */}

          <TouchableOpacity 
            style={[styles.statusToggle, { borderColor: isActive ? '#FFD700' : '#444' }]}
            onPress={() => toggleStatus(item.id, item.status)}
          >
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#FFD700' : '#666' }]} />
            <Text style={[styles.statusLabel, { color: isActive ? '#fff' : '#666' }]}>
              {isActive ? 'ACTIVO' : 'INACTIVO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator color="#FFD700" size="large" /></View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER CON BUSCADOR */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar atleta..."
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Total: {students.length}</Text>
          <Text style={styles.statsText}>Activos: {students.filter(s => s.status === 'Active').length}</Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron atletas.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  searchContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    borderRadius: 10, 
    alignItems: 'center', 
    paddingHorizontal: 10,
    marginBottom: 10
  },
  searchIcon: { marginRight: 10 },
  searchInput: { color: '#fff', height: 45, flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statsText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  row: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222'
  },
  infoCol: { flex: 1.5 },
  dateCol: { flex: 1.2, alignItems: 'center' },
  actionsCol: { flex: 1.8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  nameText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  levelText: { color: '#666', fontSize: 11 },
  dateLabel: { color: '#FFD700', fontSize: 8, fontWeight: '900', marginBottom: 2 },
  dateText: { color: '#eee', fontSize: 12 },
  renewBtn: { alignItems: 'center', marginRight: 10, backgroundColor: '#1a1a1a', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  renewBtnText: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  statusToggle: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, minWidth: 80, justifyContent: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusLabel: { fontSize: 9, fontWeight: 'bold' },
  empty: { color: '#444', textAlign: 'center', marginTop: 50 }
});