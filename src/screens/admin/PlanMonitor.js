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
  SafeAreaView,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const todayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseDate = (dateString) => {
  if (!dateString) return null;
  return new Date(`${dateString}T12:00:00`);
};

const fmtDate = (dateString) => {
  if (!dateString) return 'Sin fecha';

  return parseDate(dateString)
    .toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace('.', '');
};

const calculateDaysLeft = (endDate) => {
  if (!endDate) return null;

  const end = parseDate(endDate);
  const today = parseDate(todayISO());
  const diffTime = end - today;

  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const isDateInRange = (date, startDate, endDate) => {
  if (!date || !startDate || !endDate) return false;
  return date >= startDate && date <= endDate;
};

const getExpectedSessions = (period) => {
  if (!period) return 0;

  const total = Number(period.total_sessions || 0);
  const sessionsPerWeek = Number(period.sessions_per_week || 0);
  const weeks = Number(period.weeks || 0);
  const fallback = sessionsPerWeek * weeks;

  return Math.max(total, fallback, 0);
};

const getStatusConfig = (status) => {
  switch (status) {
    case 'ok':
      return {
        label: 'Al día',
        color: '#00ff88',
        bg: '#001f13',
        border: '#00ff8844',
        icon: 'checkmark-circle',
      };

    case 'behind':
      return {
        label: 'Por cargar',
        color: '#FFD700',
        bg: '#1f1a00',
        border: '#FFD70055',
        icon: 'alert-circle',
      };

    case 'warning':
      return {
        label: 'Por vencer',
        color: '#FFB800',
        bg: '#201400',
        border: '#FFB80044',
        icon: 'time',
      };

    case 'expired':
      return {
        label: 'Vencido',
        color: '#FF4444',
        bg: '#220606',
        border: '#FF444455',
        icon: 'close-circle',
      };

    case 'no_period':
    default:
      return {
        label: 'Sin período',
        color: '#777',
        bg: '#111',
        border: '#333',
        icon: 'remove-circle',
      };
  }
};

export default function PlanMonitor({ navigation }) {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchPlanStatus();
    }, [])
  );

  const fetchPlanStatus = async () => {
    try {
      setLoading(true);

      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          level,
          status,
          box_city,
          coach_id,
          plan_start_date,
          plan_end_date,
          sessions_per_week,
          plan_weeks
        `)
        .eq('role', 'alumno')
        .order('full_name', { ascending: true });

      if (studentsError) throw studentsError;

      const students = studentsData || [];
      const studentIds = students.map((student) => student.id);

      const coachIds = [
        ...new Set(
          students
            .map((student) => student.coach_id)
            .filter(Boolean)
        ),
      ];

      let coaches = [];
      let periods = [];
      let plans = [];

      if (coachIds.length > 0) {
        const { data: coachesData, error: coachesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', coachIds);

        if (coachesError) throw coachesError;

        coaches = coachesData || [];
      }

      if (studentIds.length > 0) {
        const { data: periodsData, error: periodsError } = await supabase
          .from('student_plan_periods')
          .select(`
            id,
            student_id,
            coach_id,
            start_date,
            end_date,
            sessions_per_week,
            weeks,
            total_sessions,
            status,
            created_at
          `)
          .in('student_id', studentIds)
          .order('start_date', { ascending: false });

        if (periodsError) throw periodsError;

        periods = periodsData || [];

        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select(`
            id,
            student_id,
            date,
            title,
            is_done,
            source,
            plan_type
          `)
          .in('student_id', studentIds)
          .eq('source', 'calendar_wod')
          .eq('plan_type', 'wod')
          .order('date', { ascending: true });

        if (plansError) throw plansError;

        plans = plansData || [];
      }

      const processed = students.map((student) => {
        const coach = coaches.find((item) => item.id === student.coach_id);

        const studentPeriods = periods.filter(
          (period) => period.student_id === student.id
        );

        const dbPeriod =
          studentPeriods.find((period) => period.status === 'Active') ||
          studentPeriods[0] ||
          null;

        const profilePeriod =
          student.plan_start_date && student.plan_end_date
            ? {
                id: `profile-${student.id}`,
                student_id: student.id,
                coach_id: student.coach_id,
                start_date: student.plan_start_date,
                end_date: student.plan_end_date,
                sessions_per_week: Number(student.sessions_per_week || 0),
                weeks: Number(student.plan_weeks || 0),
                total_sessions:
                  Number(student.sessions_per_week || 0) *
                  Number(student.plan_weeks || 0),
                status: 'Active',
                source: 'profiles',
              }
            : null;

        const activePeriod = dbPeriod || profilePeriod;
        const expected = getExpectedSessions(activePeriod);

        const periodPlans = activePeriod
          ? plans.filter(
              (plan) =>
                plan.student_id === student.id &&
                isDateInRange(
                  plan.date,
                  activePeriod.start_date,
                  activePeriod.end_date
                )
            )
          : [];

        const loaded = periodPlans.length;
        const completed = periodPlans.filter((plan) => plan.is_done).length;

        const remainingToLoad = Math.max(expected - loaded, 0);
        const remainingToComplete = Math.max(expected - completed, 0);

        const progress =
          expected > 0 ? Math.min(loaded / expected, 1) : 0;

        const completionProgress =
          expected > 0 ? Math.min(completed / expected, 1) : 0;

        const daysLeft = activePeriod
          ? calculateDaysLeft(activePeriod.end_date)
          : null;

        let planStatus = 'ok';

        if (!activePeriod) {
          planStatus = 'no_period';
        } else if (daysLeft < 0) {
          planStatus = 'expired';
        } else if (remainingToLoad > 0) {
          planStatus = 'behind';
        } else if (daysLeft <= 7) {
          planStatus = 'warning';
        }

        return {
          ...student,
          coachName: coach?.full_name || 'Sin coach',
          activePeriod,
          expected,
          loaded,
          completed,
          remainingToLoad,
          remainingToComplete,
          progress,
          completionProgress,
          daysLeft,
          planStatus,
        };
      });

      setData(processed);
      applyFilter(processed, filter, search);
    } catch (error) {
      console.error('Error cargando monitor de planes:', error.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (allData, type, query) => {
    let temp = allData;

    if (type !== 'all') {
      temp = temp.filter((item) => item.planStatus === type);
    }

    if (query) {
      const normalized = query.toLowerCase();

      temp = temp.filter(
        (item) =>
          item.full_name?.toLowerCase().includes(normalized) ||
          item.coachName?.toLowerCase().includes(normalized) ||
          item.level?.toLowerCase().includes(normalized)
      );
    }

    setFilteredData(temp);
  };

  const handleChangeFilter = (nextFilter) => {
    setFilter(nextFilter);
    applyFilter(data, nextFilter, search);
  };

  const handleSearch = (text) => {
    setSearch(text);
    applyFilter(data, filter, text);
  };

  const stats = {
    total: data.length,
    ok: data.filter((item) => item.planStatus === 'ok').length,
    behind: data.filter((item) => item.planStatus === 'behind').length,
    warning: data.filter((item) => item.planStatus === 'warning').length,
    expired: data.filter((item) => item.planStatus === 'expired').length,
    noPeriod: data.filter((item) => item.planStatus === 'no_period').length,
  };

  const renderStatCard = ({ keyName, label, value, color }) => (
    <TouchableOpacity
      style={[
        styles.statCard,
        filter === keyName && styles.activeFilter,
        filter === keyName && { borderColor: color },
      ]}
      onPress={() => handleChangeFilter(keyName)}
      activeOpacity={0.85}
    >
      <Text style={[styles.statNumber, { color }]}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>
          TEAM W ADMIN
        </Text>

        <Text style={styles.headerTitle}>
          Monitor de Planes
        </Text>

        <Text style={styles.headerSub}>
          Vista compacta de períodos, WODs y cumplimiento
        </Text>
      </View>

      <View style={styles.statsContainer}>
        {renderStatCard({
          keyName: 'all',
          label: 'Total',
          value: stats.total,
          color: '#fff',
        })}

        {renderStatCard({
          keyName: 'ok',
          label: 'Al día',
          value: stats.ok,
          color: '#00ff88',
        })}

        {renderStatCard({
          keyName: 'behind',
          label: 'Por cargar',
          value: stats.behind,
          color: '#FFD700',
        })}

        {renderStatCard({
          keyName: 'warning',
          label: 'Por vencer',
          value: stats.warning,
          color: '#FFB800',
        })}

        {renderStatCard({
          keyName: 'expired',
          label: 'Vencidos',
          value: stats.expired,
          color: '#FF4444',
        })}

        {renderStatCard({
          keyName: 'no_period',
          label: 'Sin período',
          value: stats.noPeriod,
          color: '#777',
        })}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#666" />

        <TextInput
          placeholder="Buscar atleta, coach o nivel..."
          placeholderTextColor="#444"
          style={styles.searchInput}
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

  const renderCompactPlanCard = ({ item }) => {
    const statusConfig = getStatusConfig(item.planStatus);
    const expanded = expandedId === item.id;

    const loadedText = item.activePeriod
      ? `${item.loaded}/${item.expected}`
      : '-';

    const completedText = item.activePeriod
      ? `${item.completed}/${item.expected}`
      : '-';

    const daysText = item.activePeriod
      ? item.daysLeft < 0
        ? `Vencido hace ${Math.abs(item.daysLeft)} días`
        : `${item.daysLeft} días`
      : '-';

    return (
      <View
        style={[
          styles.compactCard,
          {
            borderColor: expanded ? statusConfig.border : '#1A1A1A',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.compactTop}
          onPress={() => setExpandedId(expanded ? null : item.id)}
          activeOpacity={0.85}
        >
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>
              {item.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>

          <View style={styles.compactMainInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.studentName} numberOfLines={1}>
                {item.full_name}
              </Text>
            </View>

            <Text style={styles.studentMeta} numberOfLines={1}>
              {item.level || 'Sin nivel'} · {item.coachName}
            </Text>

            <Text style={styles.periodLine} numberOfLines={1}>
              {item.activePeriod
                ? `${fmtDate(item.activePeriod.start_date)} → ${fmtDate(item.activePeriod.end_date)}`
                : 'Sin período activo'}
            </Text>
          </View>

          <View style={styles.rightInfo}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusConfig.bg,
                  borderColor: statusConfig.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: statusConfig.color },
                ]}
              >
                {statusConfig.label}
              </Text>
            </View>

            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#555"
              style={{ marginTop: 7 }}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.quickMetrics}>
          <View style={styles.quickMetric}>
            <Text style={styles.quickValue}>
              {loadedText}
            </Text>
            <Text style={styles.quickLabel}>
              Cargados
            </Text>
          </View>

          <View style={styles.quickMetric}>
            <Text style={[styles.quickValue, { color: '#00ff88' }]}>
              {completedText}
            </Text>
            <Text style={styles.quickLabel}>
              Completados
            </Text>
          </View>

          <View style={styles.quickMetric}>
            <Text style={styles.quickValue}>
              {item.activePeriod ? item.remainingToLoad : '-'}
            </Text>
            <Text style={styles.quickLabel}>
              Restan
            </Text>
          </View>

          <View style={styles.quickMetric}>
            <Text style={[styles.quickValue, { color: statusConfig.color }]}>
              {daysText}
            </Text>
            <Text style={styles.quickLabel}>
              Días
            </Text>
          </View>
        </View>

        {item.activePeriod && (
          <View style={styles.compactProgressBg}>
            <View
              style={[
                styles.compactProgressFill,
                {
                  width: `${item.progress * 100}%`,
                  backgroundColor: statusConfig.color,
                },
              ]}
            />
          </View>
        )}

        {expanded && (
          <View style={styles.expandedBox}>
            {item.activePeriod ? (
              <>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>
                      Carga del plan
                    </Text>
                    <Text style={styles.detailValue}>
                      {Math.round(item.progress * 100)}%
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>
                      Cumplimiento alumno
                    </Text>
                    <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                      {Math.round(item.completionProgress * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.expandedProgressBg}>
                  <View
                    style={[
                      styles.expandedProgressFill,
                      {
                        width: `${item.completionProgress * 100}%`,
                        backgroundColor: '#00ff88',
                      },
                    ]}
                  />
                </View>

                <View style={styles.periodInfoBox}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#FFD700"
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.periodInfoTitle}>
                      {fmtDate(item.activePeriod.start_date)} → {fmtDate(item.activePeriod.end_date)}
                    </Text>

                    <Text style={styles.periodInfoSub}>
                      {item.activePeriod.sessions_per_week || 0}x semana · {item.activePeriod.weeks || 0} semanas · {item.expected} WODs esperados
                    </Text>

                    {item.activePeriod.source === 'profiles' && (
                      <Text style={styles.periodInfoSource}>
                        Respaldo desde perfil
                      </Text>
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noPeriodBox}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={20}
                  color="#777"
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.noPeriodTitle}>
                    Sin período configurado
                  </Text>

                  <Text style={styles.noPeriodText}>
                    Este atleta todavía no tiene período activo.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('StudentManagement')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color="#FFD700"
              />

              <Text style={styles.actionButtonText}>
                Ir a gestión de atletas
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />

        <Text style={styles.loadingText}>
          Cargando monitor...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={styles.list}
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderCompactPlanCard}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPlanStatus();
            }}
            tintColor="#FFD700"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="analytics-outline"
              size={54}
              color="#222"
            />

            <Text style={styles.emptyText}>
              No hay atletas en esta categoría.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },

  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 120,
    flexGrow: 1,
  },

  header: {
    paddingTop: 18,
    paddingBottom: 10,
  },

  headerLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },

  headerSub: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  statCard: {
    backgroundColor: '#0A0A0A',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    width: '32%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 7,
  },

  activeFilter: {
    backgroundColor: '#121212',
  },

  statNumber: {
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    color: '#777',
    fontSize: 8,
    marginTop: 3,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 13,
    borderRadius: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },

  searchInput: {
    color: '#fff',
    flex: 1,
    paddingVertical: 10,
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
  },

  compactCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 9,
    overflow: 'hidden',
  },

  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 17,
  },

  compactMainInfo: {
    flex: 1,
    marginRight: 8,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },

  studentMeta: {
    color: '#777',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '700',
  },

  periodLine: {
    color: '#555',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
  },

  rightInfo: {
    alignItems: 'flex-end',
    minWidth: 96,
  },

  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 82,
    alignItems: 'center',
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  quickMetrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#151515',
  },

  quickMetric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#151515',
  },

  quickValue: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
  },

  quickLabel: {
    color: '#666',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  compactProgressBg: {
    height: 4,
    backgroundColor: '#1A1A1A',
  },

  compactProgressFill: {
    height: 4,
  },

  expandedBox: {
    padding: 12,
    backgroundColor: '#050505',
  },

  detailRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  detailItem: {
    flex: 1,
  },

  detailLabel: {
    color: '#666',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  detailValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },

  expandedProgressBg: {
    height: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 5,
    marginBottom: 11,
    overflow: 'hidden',
  },

  expandedProgressFill: {
    height: 5,
    borderRadius: 5,
  },

  periodInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#171717',
    borderRadius: 13,
    padding: 11,
    marginTop: 5,
  },

  periodInfoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 9,
  },

  periodInfoSub: {
    color: '#666',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    marginLeft: 9,
  },

  periodInfoSource: {
    color: '#555',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    marginLeft: 9,
  },

  noPeriodBox: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  noPeriodTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },

  noPeriodText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  actionButton: {
    marginTop: 11,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 13,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  actionButtonText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 7,
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 70,
  },

  emptyText: {
    color: '#444',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
});