import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function StudentManagement({ route, navigation }) {
  // Parámetros de navegación (si venimos de CoachManagement)
  const { coachId, coachName } = route.params || {};

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [coachId])
  );

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*') 
        .eq('role', 'alumno');

      if (coachId) {
        query = query.eq('coach_id', coachId);
      }

      const { data, error } = await query.order('full_name', { ascending: true });
      
      if (error) throw error;
      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error("Error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    const filtered = students.filter(s => 
      s.full_name.toLowerCase().includes(text.toLowerCase()) || 
      s.email?.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredStudents(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const getLevelColor = (level) => {
    switch(level) {
      case 'RX': return '#FF4500';
      case 'Scaled': return '#FFD700';
      case 'Rookie': return '#ADFF2F';
      default: return '#00BFFF';
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            disabled={!coachId}
          >
            {coachId && <Ionicons name="arrow-back" size={24} color="#FFD700" style={{ marginRight: 10 }} />}
            <Text style={styles.title}>
              {coachName ? `Team ${coachName.split(' ')[0]}` : 'Comunidad'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            {coachId ? `Atletas bajo tu supervisión` : `${students.length} atletas en total`}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => navigation.navigate('AddStudent')}
        >
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      {/* BUSCADOR */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar atleta por nombre o correo..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {/* LISTA DE ATLETAS */}
      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.9}>
              {/* Encabezado de la Card */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{item.full_name}</Text>
                  <Text style={styles.studentEmail}>{item.email}</Text>
                </View>
                <View style={[styles.levelBadge, { borderColor: getLevelColor(item.level) }]}>
                  <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>
                    {item.level || 'Beginner'}
                  </Text>
                </View>
              </View>

              {/* Grid de Estadísticas Físicas */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>EDAD</Text>
                  <Text style={styles.statValue}>{item.age || '--'} años</Text>
                </View>
                <View style={[styles.statBox, styles.statBorder]}>
                  <Text style={styles.statLabel}>PESO</Text>
                  <Text style={styles.statValue}>{item.weight || '--'} kg</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ALTURA</Text>
                  <Text style={styles.statValue}>{item.height || '--'} cm</Text>
                </View>
              </View>

              {/* Sección de Objetivo */}
              <View style={styles.goalSection}>
                <Text style={styles.statLabel}>OBJETIVO PRINCIPAL</Text>
                <Text style={styles.goalValue}>{item.goal || 'No definido aún'}</Text>
              </View>

              {/* Alerta de Lesiones (solo si existen) */}
              {item.injuries && item.injuries !== "" && (
                <View style={styles.injuryContainer}>
                  <Ionicons name="warning" size={14} color="#FF4444" />
                  <Text style={styles.injuryText}>LESIÓN: {item.injuries}</Text>
                </View>
              )}

              {/* Footer de la Card */}
              <View style={styles.cardFooter}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#666" />
                  <Text style={styles.footerText}>{item.box_city || 'Santiago'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="flash-outline" size={14} color={item.status === 'Active' ? '#ADFF2F' : '#666'} />
                  <Text style={[styles.footerText, item.status === 'Active' && { color: '#ADFF2F' }]}>
                    {item.status === 'Active' ? 'Activo' : 'Pausado'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No se encontraron atletas.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 50 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 2 },
  addButton: { backgroundColor: '#FFD700', width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 10, fontSize: 14 },
  card: { backgroundColor: '#0a0a0a', padding: 18, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: '#1a1a1a', elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  studentName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  studentEmail: { color: '#444', fontSize: 12, marginTop: 2 },
  levelBadge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  levelText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 15, padding: 12, marginBottom: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#222' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.5 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  goalSection: { marginBottom: 15, paddingHorizontal: 5 },
  goalValue: { color: '#aaa', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  injuryContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 68, 68, 0.15)', padding: 10, borderRadius: 10, marginBottom: 15 },
  injuryText: { color: '#FF4444', fontSize: 11, marginLeft: 8, fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  footerText: { color: '#666', fontSize: 11, marginLeft: 5, fontWeight: '500' },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 100, fontSize: 16 }
});