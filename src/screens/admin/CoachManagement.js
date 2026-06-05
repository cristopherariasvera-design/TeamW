import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

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

const getStatusConfig = (status) => {
  switch (status) {
    case 'Active':
      return {
        label: 'Activo',
        color: '#00ff88',
        bg: '#002414',
        border: '#00ff8844',
        icon: 'checkmark-circle',
      };

    case 'Inactive':
    default:
      return {
        label: 'Inactivo',
        color: '#777',
        bg: '#111',
        border: '#333',
        icon: 'close-circle',
      };
  }
};

export default function CoachManagement({ navigation }) {
  const [coaches, setCoaches] = useState([]);
  const [filteredCoaches, setFilteredCoaches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useFocusEffect(
    useCallback(() => {
      fetchCoaches();
    }, [])
  );

  const fetchCoaches = async () => {
    try {
      setLoading(true);

      const { startISO, endISO } = getCurrentMonthRange();

      const { data: coachesData, error: coachesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          status,
          role,
          created_at
        `)
        .eq('role', 'coach')
        .order('full_name', { ascending: true });

      if (coachesError) throw coachesError;

      const coachesList = coachesData || [];
      const coachIds = coachesList.map((coach) => coach.id);

      let students = [];
      let plans = [];

      if (coachIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            status,
            coach_id,
            plan_start_date,
            plan_end_date
          `)
          .eq('role', 'alumno')
          .in('coach_id', coachIds);

        if (studentsError) throw studentsError;

        students = studentsData || [];

        const studentIds = students.map((student) => student.id);

        if (studentIds.length > 0) {
          const { data: plansData, error: plansError } = await supabase
            .from('plans')
            .select(`
              id,
              student_id,
              date,
              source,
              plan_type
            `)
            .in('student_id', studentIds)
            .eq('source', 'calendar_wod')
            .eq('plan_type', 'wod')
            .gte('date', startISO)
            .lte('date', endISO);

          if (plansError) throw plansError;

          plans = plansData || [];
        }
      }

      const processed = coachesList.map((coach) => {
        const assignedStudents = students.filter(
          (student) => student.coach_id === coach.id
        );

        const assignedStudentIds = assignedStudents.map((student) => student.id);

        const activeStudents = assignedStudents.filter(
          (student) => student.status === 'Active'
        );

        const inactiveStudents = assignedStudents.filter(
          (student) => student.status !== 'Active'
        );

        const studentsWithPlan = assignedStudents.filter(
          (student) => student.plan_start_date && student.plan_end_date
        );

        const wodsThisMonth = plans.filter((plan) =>
          assignedStudentIds.includes(plan.student_id)
        );

        return {
          ...coach,
          status: coach.status || 'Inactive',
          assignedCount: assignedStudents.length,
          activeStudentsCount: activeStudents.length,
          inactiveStudentsCount: inactiveStudents.length,
          studentsWithPlanCount: studentsWithPlan.length,
          wodsThisMonthCount: wodsThisMonth.length,
        };
      });

      setCoaches(processed);
      applyFilters(processed, search, statusFilter);
    } catch (error) {
      console.error('Error al obtener coaches:', error.message || error);
      Alert.alert('Error', 'No se pudo cargar la gestión de coaches.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (source, text, selectedFilter = statusFilter) => {
    const normalized = text.trim().toLowerCase();

    let filtered = [...source];

    if (selectedFilter === 'active') {
      filtered = filtered.filter((coach) => coach.status === 'Active');
    }

    if (selectedFilter === 'inactive') {
      filtered = filtered.filter((coach) => coach.status !== 'Active');
    }

    if (selectedFilter === 'with_students') {
      filtered = filtered.filter((coach) => coach.assignedCount > 0);
    }

    if (normalized) {
      filtered = filtered.filter((coach) => {
        return (
          coach.full_name?.toLowerCase().includes(normalized) ||
          coach.email?.toLowerCase().includes(normalized)
        );
      });
    }

    setFilteredCoaches(filtered);
  };

  const handleSearch = (text) => {
    setSearch(text);
    applyFilters(coaches, text, statusFilter);
  };

  const handleStatusFilter = (nextFilter) => {
    setStatusFilter(nextFilter);
    applyFilters(coaches, search, nextFilter);
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    const message = `¿Deseas marcar a este coach como ${
      nextStatus === 'Active' ? 'Activo' : 'Inactivo'
    }?`;

    const executeChange = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status: nextStatus })
          .eq('id', id);

        if (error) throw error;

        await fetchCoaches();
      } catch (error) {
        console.error('Error actualizando coach:', error.message || error);
        Alert.alert('Error', 'No se pudo actualizar el estado del coach.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) {
        executeChange();
      }
    } else {
      Alert.alert('Cambiar estado', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: executeChange },
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCoaches();
  };

  const goToCoachStudents = (coach) => {
    navigation.navigate('StudentManagement', {
      coachId: coach.id,
      coachName: coach.full_name,
    });
  };

  const stats = {
    total: coaches.length,
    active: coaches.filter((coach) => coach.status === 'Active').length,
    inactive: coaches.filter((coach) => coach.status !== 'Active').length,
    withStudents: coaches.filter((coach) => coach.assignedCount > 0).length,
  };

  const renderStatCard = ({ filterKey, value, label, color }) => {
    const isActive = statusFilter === filterKey;

    return (
      <TouchableOpacity
        style={[
          styles.statCard,
          isActive && styles.statCardActive,
          isActive && { borderColor: color },
        ]}
        onPress={() => handleStatusFilter(filterKey)}
        activeOpacity={0.85}
      >
        <Text style={[styles.statValue, { color }]}>
          {value}
        </Text>

        <Text style={styles.statLabel}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.85}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#FFD700"
              style={{ marginRight: 10 }}
            />

            <Text style={styles.headerSmall}>
              Gestión de Staff
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            Staff de Coaches
          </Text>

          <Text style={styles.subtitle}>
            {filteredCoaches.length} entrenadores encontrados
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddCoach')}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={20} color="#000" />
          <Text style={styles.buttonText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {renderStatCard({
          filterKey: 'all',
          value: stats.total,
          label: 'Total',
          color: '#FFD700',
        })}

        {renderStatCard({
          filterKey: 'active',
          value: stats.active,
          label: 'Activos',
          color: '#00ff88',
        })}

        {renderStatCard({
          filterKey: 'inactive',
          value: stats.inactive,
          label: 'Inactivos',
          color: '#777',
        })}

        {renderStatCard({
          filterKey: 'with_students',
          value: stats.withStudents,
          label: 'Con atletas',
          color: '#FFD700',
        })}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#666" />

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar coach por nombre o email..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={handleSearch}
        />

        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color="#444" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const renderCoach = (coach) => {
    const isActive = coach.status === 'Active';
    const statusConfig = getStatusConfig(coach.status);

    return (
      <View
        key={coach.id}
        style={[
          styles.card,
          !isActive && styles.cardInactive,
        ]}
      >
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => goToCoachStudents(coach)}
          activeOpacity={0.85}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {coach.full_name?.charAt(0)?.toUpperCase() || 'C'}
            </Text>
          </View>

          <View style={styles.coachInfo}>
            <Text
              style={[
                styles.coachName,
                !isActive && styles.textInactive,
              ]}
              numberOfLines={1}
            >
              {coach.full_name || 'Coach sin nombre'}
            </Text>

            <Text style={styles.coachEmail} numberOfLines={1}>
              {coach.email || 'Sin email'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => toggleStatus(coach.id, coach.status)}
            style={[
              styles.badge,
              {
                backgroundColor: statusConfig.bg,
                borderColor: statusConfig.border,
              },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={14}
              color={statusConfig.color}
            />

            <Text style={[styles.badgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {coach.assignedCount}
            </Text>
            <Text style={styles.metricLabel}>
              Atletas
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: '#00ff88' }]}>
              {coach.activeStudentsCount}
            </Text>
            <Text style={styles.metricLabel}>
              Activos
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {coach.studentsWithPlanCount}
            </Text>
            <Text style={styles.metricLabel}>
              Con plan
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {coach.wodsThisMonthCount}
            </Text>
            <Text style={styles.metricLabel}>
              WODs mes
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewStudentsButton}
          onPress={() => goToCoachStudents(coach)}
          activeOpacity={0.85}
        >
          <Ionicons name="people-outline" size={16} color="#FFD700" />
          <Text style={styles.viewStudentsText}>
            Ver atletas asignados
          </Text>

          <Ionicons
            name="chevron-forward"
            size={16}
            color="#444"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />

        <Text style={styles.loadingText}>
          Cargando coaches...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD700"
          />
        }
      >
        {renderHeader()}

        {filteredCoaches.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="briefcase-outline" size={54} color="#222" />

            <Text style={styles.emptyText}>
              {search ? 'Sin resultados' : 'No hay coaches registrados aún.'}
            </Text>
          </View>
        ) : (
          filteredCoaches.map((coach) => renderCoach(coach))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#000',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#fff',
    marginTop: 14,
    fontWeight: '700',
  },

  list: {
    flex: 1,
    minHeight: 0,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    marginBottom: 14,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  headerSmall: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },

  subtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },

  addButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
  },

  buttonText: {
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 13,
    color: '#000',
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statCardActive: {
    backgroundColor: '#111',
  },

  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    color: '#777',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 3,
    textAlign: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },

  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    marginLeft: 10,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 10,
    overflow: 'hidden',
  },

  cardInactive: {
    opacity: 0.48,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 18,
  },

  coachInfo: {
    flex: 1,
    marginRight: 10,
  },

  coachName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },

  textInactive: {
    color: '#777',
  },

  coachEmail: {
    color: '#777',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 5,
    textTransform: 'uppercase',
  },

  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#151515',
  },

  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#151515',
  },

  metricValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
  },

  metricLabel: {
    color: '#666',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 3,
  },

  viewStudentsButton: {
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  viewStudentsText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 90,
  },

  emptyText: {
    color: '#444',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
});