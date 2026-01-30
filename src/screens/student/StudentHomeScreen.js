import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform // <--- AGREGA ESTO AQUÍ
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function StudentHomeScreen({ navigation }) {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    completed: 0,
    streak: 0,
    prs: 0,
    daysLeft: 0
  });

  // Cargar datos reales desde Supabase
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Obtener WODs completados
      const { count: completedCount, error: errorWods } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile?.id)
        .eq('is_done', true);

      // 2. Obtener PRs del mes (ejemplo de consulta a tu tabla de PRs)
      const { count: prCount, error: errorPrs } = await supabase
        .from('student_prs') // Asegúrate que este sea el nombre de tu tabla
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile?.id);

      if (errorWods || errorPrs) console.warn("Error en algunas consultas");

      setStats({
        completed: completedCount || 0,
        streak: 0, // Aquí podrías implementar lógica de fechas más adelante
        prs: prCount || 0,
        daysLeft: 0 // Lógica según vencimiento de mensualidad
      });

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (profile?.id) fetchDashboardData();
  }, [profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

const handleLogout = () => {
  if (Platform.OS === 'web') {
    // Esto es lo que se ejecutará ahora en tu Chrome/Edge
    const confirmLogout = window.confirm("¿Estás seguro de que quieres salir?");
    if (confirmLogout) signOut();
  } else {
    // Esto se ejecutará cuando lo abras en un celular real
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", onPress: signOut, style: "destructive" }
      ]
    );
  }
};
// const handleLogout = () => {
//   // En lugar de Alert, ejecutamos directo para probar
//   console.log("Cerrando sesión...");
//   signOut(); 
// };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
      }
    >
      {/* Header con bienvenida y Logout */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0) || 'A'}
          </Text>
        </View>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Hola,</Text>
          <Text style={styles.nameText}>{profile?.full_name || 'Atleta'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={26} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Resumen rápido */}
      <View style={styles.summaryContainer}>
        <Text style={styles.sectionTitle}>Resumen de la Semana</Text>
        
        {loading && !refreshing ? (
          <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                <Text style={styles.statNumber}>{stats.completed}</Text>
                <Text style={styles.statLabel}>WODs Completados</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="flame" size={32} color="#FF9800" />
                <Text style={styles.statNumber}>{stats.streak}</Text>
                <Text style={styles.statLabel}>Días seguidos</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="trophy" size={32} color="#FFD700" />
                <Text style={styles.statNumber}>{stats.prs}</Text>
                <Text style={styles.statLabel}>PRs este mes</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="calendar" size={32} color="#2196F3" />
                <Text style={styles.statNumber}>{stats.daysLeft}</Text>
                <Text style={styles.statLabel}>Días restantes</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Accesos rápidos */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Accesos Rápidos</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Plan')} 
        >
          <Ionicons name="calendar" size={24} color="#FFD700" />
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Ver mi plan de hoy</Text>
            <Text style={styles.actionSubtitle}>Revisa tu entrenamiento</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('PRs')}
        >
          <Ionicons name="trophy" size={24} color="#FFD700" />
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Registrar PR</Text>
            <Text style={styles.actionSubtitle}>Guarda tu nuevo récord</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Info del perfil */}
      <View style={styles.profileInfo}>
        <Text style={styles.sectionTitle}>Mi Información</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nivel:</Text>
          <Text style={styles.infoValue}>{profile?.level || 'Intermedio'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Box:</Text>
          <Text style={styles.infoValue}>{profile?.box_city || 'Santiago'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  welcomeContainer: { flex: 1 },
  welcomeText: { fontSize: 12, color: '#999' },
  nameText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  logoutButton: { padding: 5 },
  summaryContainer: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },
  quickActions: { paddingHorizontal: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  actionTextContainer: { flex: 1, marginLeft: 15 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  actionSubtitle: { fontSize: 12, color: '#999' },
  profileInfo: { padding: 20, marginBottom: 30 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoLabel: { color: '#999' },
  infoValue: { color: '#fff', fontWeight: 'bold' },
});