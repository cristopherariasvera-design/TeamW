import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const parseDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const getSunday = (monday) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
};

const fmtDay = (date) =>
  date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '')
    .replace(/^\w/, c => c.toUpperCase());

const fmtShort = (date) =>
  date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
    .replace('.', '')
    .replace(/^\w/, c => c.toUpperCase());

const groupByWeek = (plans) => {
  const map = {};
  plans.forEach(plan => {
    const wk = plan.week_number || 1;
    if (!map[wk]) map[wk] = [];
    map[wk].push(plan);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map(wk => {
      const sessions = map[wk];
      const dates = sessions.map(s => parseDate(s.date)).filter(Boolean).sort((a, b) => a - b);

      const firstSession = dates[0];
      const lastSession  = dates[dates.length - 1];

      // ✅ La semana es "actual" si hoy cae entre la primera y última sesión de ese week_number
      // Usamos el lunes de la primera sesión y el domingo de la última para dar margen
      // aunque el plan empiece un miércoles o un sábado
      const weekStart = firstSession ? getMonday(firstSession) : null;
      const weekEnd   = lastSession  ? getSunday(lastSession)  : null;
      const isCurrentWeek = weekStart && weekEnd
        ? today >= weekStart && today <= weekEnd
        : false;

      // Rango: primera fecha real → última fecha real del week_number
      const rangeLabel = firstSession
        ? firstSession.getTime() === lastSession.getTime()
          ? fmtDay(firstSession)
          : `${fmtDay(firstSession)} → ${fmtDay(lastSession)}`
        : `Semana ${wk}`;

      return {
        weekNumber: Number(wk),
        sessions,
        firstSession,
        lastSession,
        isCurrentWeek,
        rangeLabel,
      };
    });
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StudentPlanScreen({ navigation }) {
  const { profile } = useAuth();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  useEffect(() => {
    if (profile?.id && isFocused) loadPlans();
  }, [selectedMonth, selectedYear, profile?.id, isFocused]);

  const toggleWeek = (weekNumber) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeeks(prev => ({ ...prev, [weekNumber]: !prev[weekNumber] }));
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      // Calculamos el rango de fechas del mes seleccionado
      // + 6 días antes (por si una semana empieza en el mes anterior)
      // + 6 días después (por si una semana termina en el mes siguiente)
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      const lastDay  = new Date(selectedYear, selectedMonth, 0); // último día del mes

      // Lunes de la semana que contiene el primer día
      const rangeStart = new Date(firstDay);
      const startDay = rangeStart.getDay();
      rangeStart.setDate(rangeStart.getDate() - (startDay === 0 ? 6 : startDay - 1));

      // Domingo de la semana que contiene el último día
      const rangeEnd = new Date(lastDay);
      const endDay = rangeEnd.getDay();
      rangeEnd.setDate(rangeEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay));

      const toISO = (d) => d.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', profile.id)
        .gte('date', toISO(rangeStart))
        .lte('date', toISO(rangeEnd))
        .order('date', { ascending: true });

      if (error) throw error;

      const sanitized = (data || []).map(plan => {
        let sections = [];
        if (plan.sections) {
          if (typeof plan.sections === 'string') {
            try { sections = JSON.parse(plan.sections); } catch { sections = []; }
          } else {
            sections = plan.sections;
          }
        }
        return { ...plan, sections: Array.isArray(sections) ? sections : [] };
      });

      setPlans(sanitized);

      // ✅ FIX: Calcular semanas expandidas aquí, justo después de tener los datos
      // Así se resetea correctamente al cambiar de mes
      const built = groupByWeek(sanitized);
      const initial = {};
      const currentWeek = built.find(w => w.isCurrentWeek);
      if (currentWeek) {
        initial[currentWeek.weekNumber] = true;
      } else if (built.length > 0) {
        initial[built[0].weekNumber] = true;
      }
      setExpandedWeeks(initial);

    } catch (e) {
      console.error('Error loading plans:', e);
      Alert.alert('Error', 'No se pudieron cargar los entrenamientos.');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (dir) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1)  { m = 12; y -= 1; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const weeks = groupByWeek(plans);
  const completedTotal = plans.filter(p => p.is_done).length;

  if (loading && plans.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Cargando planificación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── SELECTOR DE MES ── */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFD700" />
        </TouchableOpacity>
        <View style={styles.monthInfo}>
          <Text style={styles.monthText}>{monthNames[selectedMonth - 1]}</Text>
          <Text style={styles.yearText}>{selectedYear}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
          <Ionicons name="chevron-forward" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* ── RESUMEN MES ── */}
      {plans.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{plans.length}</Text>
            <Text style={styles.summaryLabel}>SESIONES</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#00ff88' }]}>{completedTotal}</Text>
            <Text style={styles.summaryLabel}>COMPLETADAS</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#00aaff' }]}>
              {Math.round((completedTotal / plans.length) * 100)}%
            </Text>
            <Text style={styles.summaryLabel}>ASISTENCIA</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {weeks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#1a1a1a" />
            <Text style={styles.emptyText}>Sin planificación este mes</Text>
            <Text style={styles.emptySubtext}>
              Tu coach aún no ha cargado entrenamientos para este período.
            </Text>
          </View>
        ) : (
          weeks.map(({ weekNumber, sessions, rangeLabel, isCurrentWeek }) => {
            const doneCount = sessions.filter(s => s.is_done).length;
            const allDone = doneCount === sessions.length && sessions.length > 0;
            const isExpanded = !!expandedWeeks[weekNumber];

            return (
              <View key={weekNumber} style={[styles.weekBlock, isCurrentWeek && styles.weekBlockCurrent]}>

                {/* ── HEADER — toca para expandir/colapsar ── */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[styles.weekHeader, isCurrentWeek && styles.weekHeaderCurrent]}
                  onPress={() => toggleWeek(weekNumber)}
                >
                  <View style={styles.weekHeaderLeft}>
                    <View style={[
                      styles.weekBadge,
                      allDone && styles.weekBadgeDone,
                      isCurrentWeek && !allDone && styles.weekBadgeCurrent,
                    ]}>
                      <Text style={[
                        styles.weekBadgeText,
                        (allDone || isCurrentWeek) && { color: '#000' },
                      ]}>
                        {weekNumber}
                      </Text>
                    </View>

                    <View>
                      <View style={styles.weekTitleRow}>
                        <Text style={[styles.weekTitle, isCurrentWeek && styles.weekTitleCurrent]}>
                          SEMANA {weekNumber}
                        </Text>
                        {isCurrentWeek && (
                          <View style={styles.currentBadge}>
                            <View style={styles.currentDot} />
                            <Text style={styles.currentBadgeText}>ACTUAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.weekRange, isCurrentWeek && styles.weekRangeCurrent]}>
                        {rangeLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Progreso + chevron */}
                  <View style={styles.weekProgress}>
                    <Text style={styles.weekProgressText}>{doneCount}/{sessions.length}</Text>
                    {allDone
                      ? <Ionicons name="checkmark-circle" size={16} color="#00ff88" />
                      : <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={isCurrentWeek ? '#FFD700' : '#444'}
                        />
                    }
                  </View>
                </TouchableOpacity>

                {/* Barra de progreso — siempre visible */}
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${(doneCount / sessions.length) * 100}%` },
                    allDone && { backgroundColor: '#00ff88' },
                  ]} />
                </View>

                {/* ── SESIONES — solo si expandida ── */}
                {isExpanded && (
                  <View style={styles.sessionsContainer}>
                    {sessions.map(plan => {
                      const planDate = parseDate(plan.date);
                      const isDone = plan.is_done;
                      return (
                        <TouchableOpacity
                          key={plan.id}
                          style={[styles.sessionCard, isDone && styles.sessionCardDone]}
                          onPress={() => navigation.navigate('DayDetail', { plan })}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.statusBar, isDone && styles.statusBarDone]} />
                          <View style={styles.sessionBody}>
                            <View style={styles.sessionTop}>
                              <Text style={[styles.sessionDate, isDone && styles.sessionDateDone]}>
                                {planDate ? fmtShort(planDate).toUpperCase() : 'S/F'}
                              </Text>
                              <Text style={styles.sessionTitle} numberOfLines={1}>
                                {plan.title || plan.day_name || 'Sesión'}
                              </Text>
                            </View>
                            {plan.sections?.length > 0 && (
                              <Text style={styles.sessionBlocks}>
                                {plan.sections.length} bloque{plan.sections.length !== 1 ? 's' : ''} de entrenamiento
                              </Text>
                            )}
                          </View>
                          {isDone
                            ? <Ionicons name="checkmark-circle" size={24} color="#00ff88" />
                            : <Ionicons name="chevron-forward" size={20} color="#2a2a2a" />
                          }
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 14 },

  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#060606', borderBottomWidth: 1, borderBottomColor: '#111',
  },
  monthBtn: { padding: 8 },
  monthInfo: { alignItems: 'center' },
  monthText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  yearText: { fontSize: 11, color: '#FFD700', marginTop: 1, letterSpacing: 1.5 },

  summaryBar: {
    flexDirection: 'row', backgroundColor: '#080808',
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryValue: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#111', marginVertical: 10 },

  content: { flex: 1 },

  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 17, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#fff', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  weekBlock: { marginBottom: 6 },
  weekBlockCurrent: { borderLeftWidth: 2, borderLeftColor: '#FFD700' },
  weekHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },
  weekHeaderCurrent: { backgroundColor: '#0d0d00' },
  weekHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#FFD70022', borderWidth: 1, borderColor: '#FFD70044',
    justifyContent: 'center', alignItems: 'center',
  },
  weekBadgeDone: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  weekBadgeCurrent: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  weekBadgeText: { color: '#FFD700', fontSize: 14, fontWeight: '900' },
  weekTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekTitle: { color: '#FFD700', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  weekTitleCurrent: { color: '#FFD700' },
  weekRange: { color: '#fff', fontSize: 11, marginTop: 2 },
  weekRangeCurrent: { color: '#fff' },
  weekProgress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekProgressText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  progressBarBg: { height: 2, backgroundColor: '#111', marginHorizontal: 20, marginBottom: 10, borderRadius: 1 },
  progressBarFill: { height: 2, backgroundColor: '#FFD700', borderRadius: 1 },

  sessionsContainer: { paddingHorizontal: 14, paddingBottom: 10 },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0a0a', borderRadius: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#161616',
    overflow: 'hidden',
  },
  sessionCardDone: { borderColor: '#00ff8822' },
  statusBar: { width: 3, alignSelf: 'stretch', backgroundColor: '#1e1e1e' },
  statusBarDone: { backgroundColor: '#00ff88' },
  sessionBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sessionDate: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sessionDateDone: { color: '#00ff88' },
  sessionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  sessionBlocks: { color: '#333', fontSize: 11, fontStyle: 'italic' },

  currentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFD70022', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: '#FFD70055',
  },
  currentDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFD700' },
  currentBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
