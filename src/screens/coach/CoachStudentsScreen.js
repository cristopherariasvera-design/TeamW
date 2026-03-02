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
  SafeAreaView,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachStudentsScreen({ navigation }) {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Seteamos el header de la navegación nativa para evitar el doble título
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "Gestión de Atletas",
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#FFD700',
      headerRight: () => (
        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ marginRight: 15 }}>
          <Ionicons name="log-out-outline" size={24} color="#FFD700" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (profile?.id) fetchAllStudents();
  }, [profile?.id]);

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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar.');
    }
  };

  const renderItem = ({ item }) => {
    const isActive = item.status === 'Active';
    return (
      <View style={styles.row}>
        <View style={styles.infoCol}>
          <Text style={styles.nameText}>{item.full_name}</Text>
          <Text style={styles.levelText}>{item.level}</Text>
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.dateLabel}>VENCE</Text>
          <Text style={styles.dateText}>
            {item.plan_end_date ? new Date(item.plan_end_date).toLocaleDateString() : 'Sin fecha'}
          </Text>
        </View>
        <View style={styles.actionsCol}>
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

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#FFD700" size="large" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#FFD700" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar atleta..."
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Total: {students.length} | Activos: {students.filter(s => s.status === 'Active').length}</Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 15 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  searchSection: { padding: 15 },
  searchContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    borderRadius: 8, 
    alignItems: 'center', 
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: '#222'
  },
  searchInput: { color: '#fff', flex: 1, marginLeft: 10, fontSize: 14 },
  statsRow: { marginTop: 10, alignItems: 'center' },
  statsText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  row: { 
    flexDirection: 'row', 
    backgroundColor: '#0a0a0a', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  infoCol: { flex: 2 },
  dateCol: { flex: 1, alignItems: 'center' },
  actionsCol: { flex: 1, alignItems: 'flex-end' },
  nameText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  levelText: { color: '#888', fontSize: 11 },
  dateLabel: { color: '#FFD700', fontSize: 8, fontWeight: 'bold' },
  dateText: { color: '#fff', fontSize: 12 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusLabel: { fontSize: 9, fontWeight: 'bold' }
});