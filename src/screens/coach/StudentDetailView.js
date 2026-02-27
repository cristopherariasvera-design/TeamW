import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (date) =>
  date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();

const fmtFull = (date) =>
  date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

/**
 * Agrupa sesiones en ciclos de 30 días desde plan_start_date del atleta.
 * Retorna array de ciclos con sus semanas y sesiones.
 */
const groupByCycles = (sessions, planStartDate) => {
  if (!sessions.length) return [];

  const start = new Date(planStartDate + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Asignar cada sesión a su ciclo y semana
  const cycleMap = {};

  sessions.forEach(session => {
    const date = new Date(session.date + 'T12:00:00');
    const daysSinceStart = Math.floor((date - start) / (1000 * 60 * 60 * 24));

    // Ciclo base-1
    const cycleIndex = Math.max(0, Math.floor(daysSinceStart / 30));
    const cycleNumber = cycleIndex + 1;

    // Fechas del ciclo
    const cycleStart = new Date(start);
    cycleStart.setDate(cycleStart.getDate() + cycleIndex * 30);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + 29);

    // ¿Es el ciclo activo?
    const isActiveCycle = today >= cycleStart && today <= cycleEnd;

    const cycleKey = `cycle_${cycleNumber}`;
    if (!cycleMap[cycleKey]) {
      cycleMap[cycleKey] = {
        cycleNumber,
        cycleKey,
        label: `CICLO ${cycleNumber}`,
        dateRange: `${fmt(cycleStart)} → ${fmt(cycleEnd)}`,
        cycleStart,
        cycleEnd,
        isActiveCycle,
        weeks: {},
      };
    }

    // Semana dentro del ciclo (1–4)
    const dayInCycle = daysSinceStart - cycleIndex * 30;
    const weekNumber = Math.min(4, Math.floor(dayInCycle / 7) + 1);
    const weekKey = `week_${weekNumber}`;

    if (!cycleMap[cycleKey].weeks[weekKey]) {
      cycleMap[cycleKey].weeks[weekKey] = {
        weekNumber,
        weekKey,
        label: `Semana ${weekNumber}`,
        sessions: [],
      };
    }

    cycleMap[cycleKey].weeks[weekKey].sessions.push(session);
  });

  // Ordenar ciclos desc (más reciente primero), semanas asc dentro de cada ciclo
  return Object.values(cycleMap)
    .sort((a, b) => b.cycleNumber - a.cycleNumber)
    .map(cycle => ({
      ...cycle,
      weeks: Object.values(cycle.weeks)
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map(week => ({
          ...week,
          sessions: week.sessions.sort((a, b) => new Date(a.date) - new Date(b.date)),
          // Semana completada = todas las sesiones done
          isCompleted: week.sessions.length > 0 && week.sessions.every(s => s.is_done),
        })),
    }));
};

/**
 * Calcula qué semana del ciclo activo corresponde a hoy.
 * Retorna el weekKey de la semana activa o null.
 */
const getActiveWeekKey = (cycle, planStartDate) => {
  if (!cycle?.isActiveCycle) return null;
  const start = new Date(planStartDate + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  const cycleIndex = cycle.cycleNumber - 1;
  const dayInCycle = daysSinceStart - cycleIndex * 30;
  const weekNumber = Math.min(4, Math.floor(dayInCycle / 7) + 1);
  return `week_${weekNumber}`;
};

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, onPress }) {
  return (
    <TouchableOpacity style={sessionStyles.card} onPress={() => onPress(session)} activeOpacity={0.7}>
      <View style={[sessionStyles.statusBar, session.is_done && sessionStyles.statusBarDone]} />
      <View style={sessionStyles.info}>
        <Text style={sessionStyles.title}>{session.day_name || session.title}</Text>
        <Text style={sessionStyles.date}>{fmtFull(new Date(session.date + 'T12:00:00'))}</Text>
      </View>
      {session.is_done ? (
        <View style={sessionStyles.doneBadge}>
          <Ionicons name="checkmark" size={12} color="#000" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#333" />
      )}
    </TouchableOpacity>
  );
}

const sessionStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' },
  statusBar: { width: 3, height: '100%', minHeight: 56, backgroundColor: '#222' },
  info: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  date: { color: '#555', fontSize: 11, marginTop: 2 },
  doneBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  statusBarDone: { backgroundColor: '#FFD700' },
});

// ─── Week Row ─────────────────────────────────────────────────────────────────
function WeekRow({ week, isExpanded, isActive, onToggle, onSessionPress }) {
  const completedCount = week.sessions.filter(s => s.is_done).length;
  const total = week.sessions.length;
  const progress = total > 0 ? completedCount / total : 0;

  return (
    <View style={weekStyles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[weekStyles.bar, isExpanded && weekStyles.barExpanded, isActive && weekStyles.barActive]}
        onPress={onToggle}
      >
        <View style={weekStyles.left}>
          <MaterialCommunityIcons
            name="layers-triple-outline"
            size={18}
            color={isExpanded ? '#000' : isActive ? '#FFD700' : '#555'}
          />
          <Text style={[weekStyles.label, isExpanded && weekStyles.labelExpanded]}>
            {week.label}
          </Text>
          {isActive && !isExpanded && (
            <View style={weekStyles.activePill}>
              <Text style={weekStyles.activePillText}>ACTUAL</Text>
            </View>
          )}
          {week.isCompleted && (
            <View style={weekStyles.completedPill}>
              <Ionicons name="checkmark-circle" size={12} color="#00ff88" />
              <Text style={weekStyles.completedPillText}>COMPLETADA</Text>
            </View>
          )}
        </View>
        <View style={weekStyles.right}>
          {!isExpanded && total > 0 && (
            <Text style={weekStyles.progressText}>{completedCount}/{total}</Text>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isExpanded ? '#000' : '#444'}
          />
        </View>
      </TouchableOpacity>

      {/* Progress bar (visible cuando colapsado y hay progreso) */}
      {!isExpanded && total > 0 && progress > 0 && (
        <View style={weekStyles.progressBarBg}>
          <View style={[weekStyles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {isExpanded && (
        <View style={weekStyles.sessionsContainer}>
          {week.sessions.map(s => (
            <SessionCard key={s.id} session={s} onPress={onSessionPress} />
          ))}
        </View>
      )}
    </View>
  );
}

const weekStyles = StyleSheet.create({
  wrapper: { marginBottom: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, backgroundColor: '#111' },
  barExpanded: { backgroundColor: '#FFD700' },
  barActive: { borderLeftWidth: 3, borderLeftColor: '#FFD700' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontSize: 15, fontWeight: '700' },
  labelExpanded: { color: '#000' },
  activePill: { backgroundColor: '#FFD70033', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  activePillText: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  completedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#00ff8822', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  completedPillText: { color: '#00ff88', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  progressText: { color: '#555', fontSize: 11 },
  progressBarBg: { height: 2, backgroundColor: '#1a1a1a' },
  progressBarFill: { height: 2, backgroundColor: '#FFD700', borderRadius: 1 },
  sessionsContainer: { padding: 10, paddingTop: 6, backgroundColor: '#050505' },
});

// ─── Cycle Header ─────────────────────────────────────────────────────────────
function CycleHeader({ cycle }) {
  const completedSessions = cycle.weeks.reduce((acc, w) => acc + w.sessions.filter(s => s.is_done).length, 0);
  const totalSessions = cycle.weeks.reduce((acc, w) => acc + w.sessions.length, 0);

  return (
    <View style={cycleStyles.header}>
      <View style={cycleStyles.left}>
        <View style={cycleStyles.numberBadge}>
          <Text style={cycleStyles.numberText}>{cycle.cycleNumber}</Text>
        </View>
        <View>
          <View style={cycleStyles.labelRow}>
            <Text style={cycleStyles.label}>{cycle.label}</Text>
            {cycle.isActiveCycle && (
              <View style={cycleStyles.activeBadge}>
                <View style={cycleStyles.activeDot} />
                <Text style={cycleStyles.activeBadgeText}>EN CURSO</Text>
              </View>
            )}
          </View>
          <Text style={cycleStyles.dateRange}>{cycle.dateRange}</Text>
        </View>
      </View>
      <Text style={cycleStyles.counter}>{completedSessions}/{totalSessions}</Text>
    </View>
  );
}

const cycleStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numberBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFD70022', borderWidth: 1, borderColor: '#FFD70044', justifyContent: 'center', alignItems: 'center' },
  numberText: { color: '#FFD700', fontSize: 16, fontWeight: '900' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70022', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFD700' },
  activeBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dateRange: { color: '#444', fontSize: 11, marginTop: 2 },
  counter: { color: '#333', fontSize: 12, fontWeight: '600' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentDetailView({ route, navigation }) {
  const { student } = route.params || {};
  const [cycles, setCycles] = useState([]);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (student?.id) fetchStudentPlans();
    }, [student?.id])
  );

  const fetchStudentPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (error) throw error;
      buildCycles(data || []);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const buildCycles = (data) => {
    // plan_start_date debe venir en student, o fallback a la sesión más antigua
    const planStart = student.plan_start_date
      || (data.length > 0 ? [...data].sort((a, b) => new Date(a.date) - new Date(b.date))[0].date : null);

    if (!planStart) { setCycles([]); return; }

    const built = groupByCycles(data, planStart);
    setCycles(built);

    // Auto-expand: semana activa del ciclo activo
    const activeCycle = built.find(c => c.isActiveCycle);
    if (activeCycle) {
      const activeWeekKey = getActiveWeekKey(activeCycle, planStart);
      if (activeWeekKey) {
        setExpandedWeeks({ [`${activeCycle.cycleKey}_${activeWeekKey}`]: true });
      }
    } else if (built.length > 0) {
      // Si no hay ciclo activo, expandir la primera semana del ciclo más reciente
      const first = built[0];
      if (first.weeks.length > 0) {
        setExpandedWeeks({ [`${first.cycleKey}_${first.weeks[0].weekKey}`]: true });
      }
    }
  };

  const toggleWeek = (expandKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeeks(prev => ({ ...prev, [expandKey]: !prev[expandKey] }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFD700" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>PROGRAMACIÓN DE</Text>
          <Text style={styles.headerName} numberOfLines={1}>{student?.full_name}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={cycles}
          keyExtractor={item => item.cycleKey}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: cycle }) => (
            <View>
              <CycleHeader cycle={cycle} />
              {cycle.weeks.map(week => {
                const expandKey = `${cycle.cycleKey}_${week.weekKey}`;
                const planStart = student.plan_start_date
                  || cycles[cycles.length - 1]?.weeks[0]?.sessions[0]?.date;
                const activeWeekKey = getActiveWeekKey(cycle, planStart || '');
                const isActiveWeek = cycle.isActiveCycle && week.weekKey === activeWeekKey;

                return (
                  <WeekRow
                    key={week.weekKey}
                    week={week}
                    isExpanded={!!expandedWeeks[expandKey]}
                    isActive={isActiveWeek}
                    onToggle={() => toggleWeek(expandKey)}
                    onSessionPress={(session) =>
                      navigation.navigate('DayDetail', { plan: session })
                    }
                  />
                );
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="calendar-search" size={60} color="#1a1a1a" />
              <Text style={styles.emptyTitle}>Sin planes programados</Text>
              <Text style={styles.emptySubtitle}>Crea el primer ciclo con el botón de abajo</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('PlannerScreen', {
          studentId: student.id,
          studentName: student.full_name,
        })}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={22} color="#000" />
        <Text style={styles.fabText}>NUEVO CICLO DE 30 DÍAS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 8, gap: 14 },
  backBtn: { backgroundColor: '#111', padding: 10, borderRadius: 12 },
  headerLabel: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  headerName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },

  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  emptyState: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptySubtitle: { color: '#444', fontSize: 13 },

  fab: {
    position: 'absolute', bottom: 35, left: 20, right: 20,
    backgroundColor: '#FFD700', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 20, borderRadius: 20, gap: 10,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
