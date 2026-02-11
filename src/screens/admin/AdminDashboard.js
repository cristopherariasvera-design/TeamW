import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  StatusBar,
  RefreshControl
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminDashboard({ navigation }) {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState({ students: 0, coaches: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    setLoading(true);
    try {
      // 1. Contar TODOS los Alumnos en la plataforma
      const { count: studentCount, error: err1 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // 2. Contar TODOS los Coaches en la plataforma
      const { count: coachCount, error: err2 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'coach');

      if (err1 || err2) throw new Error("Error en la consulta");

      setStats({
        students: studentCount || 0,
        coaches: coachCount || 0
      });
    } catch (error) {
      console.error("Error cargando datos de Admin:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGlobalStats();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        
        {/* HEADER ADMIN */}
        <View style={styles.header}>
          <View>
            <Text style={styles.adminBadge}>ADMINISTRADOR PRINCIPAL</Text>
            <Text style={styles.nameText}>{profile?.full_name || 'Admin Master'}</Text>
          </View>
          <View style={styles.avatarPlaceholder}>
             <Ionicons name="shield-checkmark" size={24} color="#FFD700" />
          </View>
        </View>

        {/* SECCIÓN KPIs GLOBALES */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconBadge}>
              <Ionicons name="people" size={22} color="#000" />
            </View>
            <Text style={styles.kpiValue}>{loading ? '..' : stats.students}</Text>
            <Text style={styles.kpiLabel}>TOTAL ALUMNOS</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBadge, { backgroundColor: '#fff' }]}>
              <Ionicons name="fitness" size={22} color="#000" />
            </View>
            <Text style={styles.kpiValue}>{loading ? '..' : stats.coaches}</Text>
            <Text style={styles.kpiLabel}>TOTAL COACHES</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>CENTRAL DE GESTIÓN</Text>

        {/* MENÚ DE ADMINISTRACIÓN */}
        <View style={styles.menuGrid}>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('CoachStudents')}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="people-outline" size={24} color="#FFD700" />
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Gestionar Atletas</Text>
                <Text style={styles.menuSubtext}>Ver, editar o registrar alumnos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('CoachManagement')}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="briefcase-outline" size={24} color="#FFD700" />
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Gestionar Coaches</Text>
                <Text style={styles.menuSubtext}>Controlar staff técnico</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Planner')}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="calendar-outline" size={24} color="#FFD700" />
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Monitor de Planes</Text>
                <Text style={styles.menuSubtext}>Estado de las 4 semanas</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>

        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 30 },
  adminBadge: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
  nameText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  kpiCard: { backgroundColor: '#0a0a0a', width: '48%', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1a1a1a' },
  kpiIconBadge: { backgroundColor: '#FFD700', width: 42, height: 42, borderRadius: 12, marginBottom: 15, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  kpiLabel: { color: '#555', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginTop: 4 },

  sectionTitle: { color: '#333', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, marginBottom: 15 },
  menuGrid: { gap: 12 },
  menuItem: { backgroundColor: '#0a0a0a', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#151515' },
  iconCircle: { width: 48, height: 48, backgroundColor: '#111', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  menuTextContainer: { flex: 1, marginLeft: 15 },
  menuText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  menuSubtext: { color: '#444', fontSize: 11, marginTop: 2 },
  
  logoutBtn: { marginTop: 40, padding: 20, alignItems: 'center', marginBottom: 30 },
  logoutText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14 }
});