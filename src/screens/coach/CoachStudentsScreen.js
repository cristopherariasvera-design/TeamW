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

  // CONFIGURACIÓN DEL HEADER NATIVO (Adiós al header duplicado)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Gestión de Atletas",
      headerStyle: { 
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
      },
      headerTintColor: '#FFD700',
      // Forzamos la flecha izquierda aquí para que siempre se vea en web
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ marginLeft: 15, paddingRight: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color="#FFD700" />
        </TouchableOpacity>
      ),
      // Mantenemos tu botón de salir a la derecha que sí funcionaba
      headerRight: () => (
        <TouchableOpacity onPress={signOut} style={{ marginRight: 15, paddingLeft: 10 }}>
          <Ionicons name="log-out-outline" size={24} color="#FFD700" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, signOut]);

  // --- LÓGICA DE DATOS ---
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
      Alert.alert('Error', 'No se pudo conectar con la tabla de perfiles');
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
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // --- RENDERIZADO DE LA LISTA ---
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
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.statsText}>Total: {students.length}</Text>
          <Text style={styles.statsText}>Activos: {students.filter(s => s.status === 'Active').length}</Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron atletas.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  
  // Buscador
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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 5 },
  statsText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', opacity: 0.8 },

  // Lista
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
  dateCol: { flex: 1, alignItems: 'center' },
  actionsCol: { flex: 1, alignItems: 'flex-end' },
  nameText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  levelText: { color: '#888', fontSize: 12, marginTop: 2 },
  dateLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  dateText: { color: '#fff', fontSize: 13 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 10, fontWeight: 'bold' },
  empty: { color: '#444', textAlign: 'center', marginTop: 50 }
});