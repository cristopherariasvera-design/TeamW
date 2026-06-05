import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

const pad = (value) => String(value).padStart(2, '0');

const toISO = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startISO: toISO(firstDay),
    endISO: toISO(lastDay),
  };
};

export default function AdminDashboard({ navigation }) {
  const { profile, signOut } = useAuth();

  const [stats, setStats] = useState({
    students: 0,
    activeStudents: 0,
    coaches: 0,
    wodsThisMonth: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      setLoading(true);

      const { startISO, endISO } = getCurrentMonthRange();

      const [
        studentsResult,
        activeStudentsResult,
        coachesResult,
        wodsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'alumno'),

        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'alumno')
          .eq('status', 'Active'),

        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'coach'),

        supabase
          .from('plans')
          .select('*', { count: 'exact', head: true })
          .eq('source', 'calendar_wod')
          .eq('plan_type', 'wod')
          .gte('date', startISO)
          .lte('date', endISO),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (activeStudentsResult.error) throw activeStudentsResult.error;
      if (coachesResult.error) throw coachesResult.error;
      if (wodsResult.error) throw wodsResult.error;

      setStats({
        students: studentsResult.count || 0,
        activeStudents: activeStudentsResult.count || 0,
        coaches: coachesResult.count || 0,
        wodsThisMonth: wodsResult.count || 0,
      });
    } catch (error) {
      console.error('Error cargando datos de Admin:', error.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGlobalStats();
  };

  const renderKpiCard = ({
    icon,
    label,
    value,
    iconBackground = '#FFD700',
    iconColor = '#000',
  }) => (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconBadge, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <Text style={styles.kpiValue}>
        {loading ? '..' : value}
      </Text>

      <Text style={styles.kpiLabel}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD700"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.adminBadge}>
              ADMINISTRADOR PRINCIPAL
            </Text>

            <Text style={styles.nameText}>
              {profile?.full_name || 'Admin Master'}
            </Text>
          </View>

          <View style={styles.avatarPlaceholder}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color="#FFD700"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          RESUMEN GENERAL
        </Text>

        <View style={styles.kpiContainer}>
          {renderKpiCard({
            icon: 'people',
            label: 'TOTAL ATLETAS',
            value: stats.students,
          })}

          {renderKpiCard({
            icon: 'checkmark-circle',
            label: 'ATLETAS ACTIVOS',
            value: stats.activeStudents,
            iconBackground: '#00ff88',
          })}

          {renderKpiCard({
            icon: 'fitness',
            label: 'TOTAL COACHES',
            value: stats.coaches,
            iconBackground: '#fff',
          })}

          {renderKpiCard({
            icon: 'barbell-outline',
            label: 'WODS ESTE MES',
            value: stats.wodsThisMonth,
            iconBackground: '#FFD700',
          })}
        </View>

        <Text style={styles.sectionTitle}>
          CENTRAL DE GESTIÓN
        </Text>

        <View style={styles.menuGrid}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('StudentManagement')}
            activeOpacity={0.85}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="people-outline"
                size={24}
                color="#FFD700"
              />
            </View>

            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>
                Gestionar Atletas
              </Text>

              <Text style={styles.menuSubtext}>
                Ver, editar o registrar alumnos
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#333"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('CoachManagement')}
            activeOpacity={0.85}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="briefcase-outline"
                size={24}
                color="#FFD700"
              />
            </View>

            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>
                Gestionar Coaches
              </Text>

              <Text style={styles.menuSubtext}>
                Controlar staff técnico
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#333"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PlanMonitor')}
            activeOpacity={0.85}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color="#FFD700"
              />
            </View>

            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>
                Monitor de Planes
              </Text>

              <Text style={styles.menuSubtext}>
                Períodos, WODs cargados y avance general
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#333"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={signOut}
          activeOpacity={0.85}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color="#ff4444"
          />

          <Text style={styles.logoutText}>
            Cerrar Sesión Segura
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 26,
  },

  adminBadge: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  nameText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },

  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },

  sectionTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },

  kpiCard: {
    backgroundColor: '#0a0a0a',
    width: '48%',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    marginBottom: 12,
  },

  kpiIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  kpiValue: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
  },

  kpiLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },

  menuGrid: {
    gap: 12,
  },

  menuItem: {
    backgroundColor: '#0a0a0a',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#151515',
  },

  iconCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#111',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  menuTextContainer: {
    flex: 1,
    marginLeft: 15,
  },

  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  menuSubtext: {
    color: '#555',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },

  logoutBtn: {
    marginTop: 38,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#331111',
    borderRadius: 18,
    backgroundColor: '#080000',
  },

  logoutText: {
    color: '#ff4444',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },
});