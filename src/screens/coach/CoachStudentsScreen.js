import React, { useState, useEffect, useLayoutEffect } from 'react';
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
  Platform
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachStudentsScreen({ navigation }) {
  const { profile, signOut } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // 1. OCULTAMOS EL HEADER DEL NAVIGATOR (Para evitar conflictos en el desplegado)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, 
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
      setFilteredStudents(data || []);
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

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator color="#FFD700" size="large" /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 2. HEADER MANUAL (Esto aparecerá sí o sí en Git Desplegado) */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Dashboard')} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#FFD700" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Gestión de Atletas</Text>

        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={26} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#FFD700" /> 
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
        renderItem={({ item }) => {
            const isActive = item.status === 'Active';
            return (
              <View style={styles.row}>
                <View style={styles.infoCol}>
                  <Text style={styles.nameText}>{item.full_name}</Text>
                  <Text style={styles.levelText}>{item.level}</Text>
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
        }}
        contentContainerStyle={{ padding: 15 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  
  // ESTILOS DEL HEADER MANUAL
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingTop: Platform.OS === 'android' ? 10 : 0, // Ajuste para móviles
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  logoutButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },

  // Buscador y Lista
  searchSection: { padding: 15 },
  searchContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    borderRadius: 12, 
    alignItems: 'center', 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333'
  },
  searchInput: { color: '#fff', height: 50, flex: 1, marginLeft: 10 },
  statsRow: { marginTop: 10, alignItems: 'center' },
  statsText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  row: { 
    flexDirection: 'row', 
    backgroundColor: '#0a0a0a', 
    padding: 16, 
    borderRadius: 15, 
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  infoCol: { flex: 2 },
  actionsCol: { flex: 1, alignItems: 'flex-end' },
  nameText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  levelText: { color: '#888', fontSize: 12 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 10, fontWeight: 'bold' }
});