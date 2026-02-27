import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  ActivityIndicator, RefreshControl, TextInput 
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function PlanMonitor({ navigation }) {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'warning', 'expired'
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchPlanStatus();
    }, [])
  );

  const fetchPlanStatus = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, plan_end_date, status, coach_id')
        .eq('role', 'alumno')
        .order('plan_end_date', { ascending: true });

      if (error) throw error;

      // Procesar estados dinámicamente
      const processed = profiles.map(student => {
        const daysLeft = calculateDaysLeft(student.plan_end_date);
        let planStatus = 'active'; // Vigente
        if (daysLeft < 0) planStatus = 'expired'; // Vencido
        else if (daysLeft <= 7) planStatus = 'warning'; // Por vencer (7 días o menos)

        return { ...student, daysLeft, planStatus };
      });

      setData(processed);
      applyFilter(processed, filter, search);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDaysLeft = (endDate) => {
    if (!endDate) return -999;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const applyFilter = (allData, type, query) => {
    let temp = allData;
    if (type !== 'all') {
      temp = temp.filter(item => item.planStatus === type);
    }
    if (query) {
      temp = temp.filter(item => item.full_name.toLowerCase().includes(query.toLowerCase()));
    }
    setFilteredData(temp);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#ADFF2F'; // Verde
      case 'warning': return '#FFD700'; // Amarillo
      case 'expired': return '#FF4444'; // Rojo
      default: return '#666';
    }
  };

  // Stats para los cuadritos superiores
  const stats = {
    total: data.length,
    active: data.filter(s => s.planStatus === 'active').length,
    warning: data.filter(s => s.planStatus === 'warning').length,
    expired: data.filter(s => s.planStatus === 'expired').length,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Monitor de Planes</Text>

      {/* MINI DASHBOARD */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={[styles.statCard, filter === 'all' && styles.activeFilter]} onPress={() => {setFilter('all'); applyFilter(data, 'all', search);}}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, filter === 'active' && styles.activeFilter]} onPress={() => {setFilter('active'); applyFilter(data, 'active', search);}}>
          <Text style={[styles.statNumber, {color: '#ADFF2F'}]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Al día</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, filter === 'warning' && styles.activeFilter]} onPress={() => {setFilter('warning'); applyFilter(data, 'warning', search);}}>
          <Text style={[styles.statNumber, {color: '#FFD700'}]}>{stats.warning}</Text>
          <Text style={styles.statLabel}>Avisar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, filter === 'expired' && styles.activeFilter]} onPress={() => {setFilter('expired'); applyFilter(data, 'expired', search);}}>
          <Text style={[styles.statNumber, {color: '#FF4444'}]}>{stats.expired}</Text>
          <Text style={styles.statLabel}>Deuda</Text>
        </TouchableOpacity>
      </View>

      {/* BUSCADOR */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#666" />
        <TextInput 
          placeholder="Buscar atleta por nombre..." 
          placeholderTextColor="#444" 
          style={styles.searchInput}
          value={search}
          onChangeText={(t) => {setSearch(t); applyFilter(data, filter, t);}}
        />
      </View>

      {/* LISTADO */}
      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchPlanStatus} tintColor="#FFD700" />}
        renderItem={({ item }) => (
          <View style={styles.planCard}>
            <View style={styles.planInfo}>
              <Text style={styles.studentName}>{item.full_name}</Text>
              <Text style={styles.planDates}>
                Vence: {item.plan_end_date ? new Date(item.plan_end_date).toLocaleDateString() : 'No asignado'}
              </Text>
            </View>
            
            <View style={styles.statusSection}>
              <Text style={[styles.daysText, { color: getStatusColor(item.planStatus) }]}>
                {item.planStatus === 'expired' 
                  ? `Vencido hace ${Math.abs(item.daysLeft)}d` 
                  : `${item.daysLeft} días restantes`}
              </Text>
              <TouchableOpacity 
                style={styles.renewBtn} 
                onPress={() => navigation.navigate('AdminStudentProfile', { studentId: item.id })}
              >
                <Ionicons name="refresh-circle" size={24} color="#FFD700" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay atletas en esta categoría.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20, paddingTop: 60 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  
  // Dashboard Stats
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { backgroundColor: '#111', padding: 12, borderRadius: 15, width: '23%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  activeFilter: { borderColor: '#FFD700', backgroundColor: '#1a1a1a' },
  statNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 9, marginTop: 4, fontWeight: 'bold', textTransform: 'uppercase' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 15, borderRadius: 12, marginBottom: 20 },
  searchInput: { color: '#fff', flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 14 },

  // Cards
  planCard: { backgroundColor: '#0a0a0a', padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  planInfo: { flex: 1 },
  studentName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  planDates: { color: '#555', fontSize: 12, marginTop: 4 },
  statusSection: { alignItems: 'flex-end' },
  daysText: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  renewBtn: { padding: 5 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 50, fontSize: 14 }
});