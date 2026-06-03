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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import CommentsModal from '../student/CommentsModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const toDate = (dateString) => new Date(`${dateString}T12:00:00`);

const fmtShort = (dateString) => {
  if (!dateString) return '-';

  return toDate(dateString)
    .toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase();
};

const fmtFull = (dateString) => {
  if (!dateString) return '-';

  return toDate(dateString)
    .toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
    .replace(/^\w/, (c) => c.toUpperCase());
};

const addDays = (dateString, days) => {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const getWeeksBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = toDate(startDate);
  const end = toDate(endDate);

  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, Math.ceil(diffDays / 7));
};

const getPeriodStatus = (startDate, endDate) => {
  if (!startDate || !endDate) return 'Sin período';

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const start = toDate(startDate);
  const end = toDate(endDate);

  if (today < start) return 'Futuro';
  if (today > end) return 'Vencido';
  return 'En curso';
};

const getCurrentWeekNumber = (startDate, endDate) => {
  if (!startDate || !endDate) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const start = toDate(startDate);
  const end = toDate(endDate);

  if (today < start || today > end) return null;

  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / 7) + 1;
};

const buildWeeks = (wods, startDate, endDate, totalWeeks) => {
  if (!startDate || !endDate || !totalWeeks) return [];

  const weeks = [];

  for (let i = 1; i <= totalWeeks; i++) {
    const weekStart = addDays(startDate, (i - 1) * 7);
    const weekEnd = i === totalWeeks
      ? endDate
      : addDays(weekStart, 6);

    const sessions = (wods || []).filter((wod) => (
      wod.date >= weekStart && wod.date <= weekEnd
    ));

    weeks.push({
      weekNumber: i,
      weekKey: `week_${i}`,
      label: `Semana ${i}`,
      startDate: weekStart,
      endDate: weekEnd,
      dateRange: `${fmtShort(weekStart)} → ${fmtShort(weekEnd)}`,
      sessions,
    });
  }

  return weeks;
};

/* ─────────────────────────────────────────────
   PERIOD SUMMARY
───────────────────────────────────────────── */

function PeriodSummaryCard({ student, wodsCount }) {
  const startDate = student?.plan_start_date;
  const endDate = student?.plan_end_date;
  const sessionsPerWeek = student?.sessions_per_week || 0;
  const planWeeks = student?.plan_weeks || getWeeksBetween(startDate, endDate);
  const totalExpected = sessionsPerWeek * planWeeks;
  const remaining = Math.max(totalExpected - wodsCount, 0);
  const progress = totalExpected > 0 ? Math.min(wodsCount / totalExpected, 1) : 0;
  const status = getPeriodStatus(startDate, endDate);

  if (!startDate || !endDate) {
    return (
      <View style={periodStyles.card}>
        <View style={periodStyles.emptyIcon}>
          <Ionicons name="calendar-outline" size={30} color="#FFD700" />
        </View>

        <Text style={periodStyles.emptyTitle}>
          Sin período activo
        </Text>

        <Text style={periodStyles.emptyText}>
          Configura un período para definir cuántos WODs debe recibir este alumno.
        </Text>
      </View>
    );
  }

  return (
    <View style={periodStyles.card}>
      <View style={periodStyles.topRow}>
        <View>
          <Text style={periodStyles.label}>
            PERÍODO ACTIVO
          </Text>

          <Text style={periodStyles.range}>
            {fmtShort(startDate)} → {fmtShort(endDate)}
          </Text>
        </View>

        <View
          style={[
            periodStyles.statusBadge,
            status === 'En curso' && periodStyles.statusActive,
            status === 'Vencido' && periodStyles.statusExpired,
            status === 'Futuro' && periodStyles.statusFuture,
          ]}
        >
          <Text style={periodStyles.statusText}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={periodStyles.statsRow}>
        <View style={periodStyles.statBox}>
          <Text style={periodStyles.statValue}>
            {sessionsPerWeek}
          </Text>
          <Text style={periodStyles.statLabel}>
            Veces/sem
          </Text>
        </View>

        <View style={periodStyles.statBox}>
          <Text style={periodStyles.statValue}>
            {planWeeks}
          </Text>
          <Text style={periodStyles.statLabel}>
            Semanas
          </Text>
        </View>

        <View style={periodStyles.statBox}>
          <Text style={periodStyles.statValue}>
            {wodsCount}/{totalExpected}
          </Text>
          <Text style={periodStyles.statLabel}>
            WODs
          </Text>
        </View>

        <View style={periodStyles.statBox}>
          <Text style={periodStyles.statValue}>
            {remaining}
          </Text>
          <Text style={periodStyles.statLabel}>
            Restan
          </Text>
        </View>
      </View>

      <View style={periodStyles.progressBg}>
        <View
          style={[
            periodStyles.progressFill,
            { width: `${progress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   PERIOD HISTORY
───────────────────────────────────────────── */

function PeriodHistoryCard({ period }) {
  const progress =
    period.total_sessions > 0
      ? Math.min(period.wods_cargados / period.total_sessions, 1)
      : 0;

  return (
    <View style={historyStyles.card}>
      <View style={historyStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={historyStyles.title}>
            {fmtShort(period.start_date)} → {fmtShort(period.end_date)}
          </Text>

          <Text style={historyStyles.subtitle}>
            {period.sessions_per_week} veces/sem · {period.weeks} semanas
          </Text>
        </View>

        <View style={historyStyles.badge}>
          <Text style={historyStyles.badgeText}>
            {(period.status || 'Active').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={historyStyles.statsRow}>
        <Text style={historyStyles.statText}>
          {period.wods_cargados} / {period.total_sessions} WODs cargados
        </Text>

        <Text style={historyStyles.remainingText}>
          Restan {period.wods_restantes}
        </Text>
      </View>

      <View style={historyStyles.progressBg}>
        <View
          style={[
            historyStyles.progressFill,
            { width: `${progress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   WOD CARD
───────────────────────────────────────────── */

function WodCard({ session, onPress }) {
  return (
    <TouchableOpacity
      style={wodStyles.card}
      onPress={() => onPress(session)}
      activeOpacity={0.75}
    >
      <View
        style={[
          wodStyles.statusBar,
          session.is_done && wodStyles.statusBarDone,
        ]}
      />

      <View style={wodStyles.info}>
        <Text style={wodStyles.title}>
          {session.title || 'WOD sin título'}
        </Text>

        <Text style={wodStyles.date}>
          {fmtFull(session.date)}
        </Text>
      </View>

      {session.is_done ? (
        <View style={wodStyles.doneBadge}>
          <Ionicons name="checkmark" size={12} color="#000" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#555" />
      )}
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────
   WEEK ROW
───────────────────────────────────────────── */

function WeekRow({
  week,
  expectedPerWeek,
  isExpanded,
  isActive,
  onToggle,
  onSessionPress,
}) {
  const loadedCount = week.sessions.length;
  const completedCount = week.sessions.filter((s) => s.is_done).length;
  const expectedCount = expectedPerWeek || loadedCount;

  const weekCompleted =
    expectedCount > 0 &&
    loadedCount >= expectedCount &&
    completedCount >= expectedCount;

  const missingCount = Math.max(expectedCount - loadedCount, 0);

  return (
    <View style={weekStyles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          weekStyles.bar,
          isExpanded && weekStyles.barExpanded,
          isActive && weekStyles.barActive,
        ]}
        onPress={onToggle}
      >
        <View style={weekStyles.left}>
          <View
            style={[
              weekStyles.numberBadge,
              isExpanded && weekStyles.numberBadgeExpanded,
              isActive && !isExpanded && weekStyles.numberBadgeActive,
            ]}
          >
            <Text
              style={[
                weekStyles.numberBadgeText,
                isExpanded && { color: '#000' },
              ]}
            >
              {week.weekNumber}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={weekStyles.labelRow}>
              <Text
                style={[
                  weekStyles.label,
                  isExpanded && weekStyles.labelExpanded,
                ]}
              >
                {week.label}
              </Text>

              {isActive && (
                <View style={weekStyles.activePill}>
                  <Text style={weekStyles.activePillText}>
                    ACTUAL
                  </Text>
                </View>
              )}

              {weekCompleted && (
                <View style={weekStyles.completedPill}>
                  <Ionicons name="checkmark-circle" size={12} color="#00ff88" />
                  <Text style={weekStyles.completedPillText}>
                    COMPLETA
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[
                weekStyles.dateRange,
                isExpanded && { color: '#000' },
              ]}
            >
              {week.dateRange}
            </Text>
          </View>
        </View>

        <View style={weekStyles.right}>
          <Text
            style={[
              weekStyles.counter,
              isExpanded && { color: '#000' },
            ]}
          >
            {loadedCount}/{expectedCount}
          </Text>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isExpanded ? '#000' : '#555'}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={weekStyles.sessionsContainer}>
          {week.sessions.length === 0 ? (
            <View style={weekStyles.emptyWeek}>
              <Ionicons name="barbell-outline" size={24} color="#333" />

              <Text style={weekStyles.emptyWeekText}>
                Sin WODs cargados esta semana
              </Text>

              {expectedCount > 0 && (
                <Text style={weekStyles.emptyWeekSubText}>
                  Faltan {expectedCount} WODs esperados
                </Text>
              )}
            </View>
          ) : (
            <>
              {week.sessions.map((session) => (
                <WodCard
                  key={session.id}
                  session={session}
                  onPress={onSessionPress}
                />
              ))}

              {missingCount > 0 && (
                <View style={weekStyles.missingBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#FFD700"
                  />

                  <Text style={weekStyles.missingText}>
                    Faltan {missingCount} WODs para completar esta semana
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export default function StudentDetailView({ route, navigation }) {
  const { student } = route.params || {};

  const [studentProfile, setStudentProfile] = useState(student || null);
  const [weeks, setWeeks] = useState([]);
  const [wods, setWods] = useState([]);
  const [periodsHistory, setPeriodsHistory] = useState([]);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [loading, setLoading] = useState(true);
  const [chatVisible, setChatVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (student?.id) {
        fetchStudentPlanning();
      }
    }, [student?.id])
  );

  const fetchStudentPlanning = async () => {
    try {
      setLoading(true);

      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          status,
          level,
          coach_id,
          plan_start_date,
          plan_end_date,
          sessions_per_week,
          plan_weeks
        `)
        .eq('id', student.id)
        .single();

      if (profileError) throw profileError;

      setStudentProfile(freshProfile);

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
        .eq('student_id', student.id)
        .order('start_date', { ascending: false });

      if (periodsError) throw periodsError;

      const { data: allWodsData, error: allWodsError } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', student.id)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod')
        .order('date', { ascending: true });

      if (allWodsError) throw allWodsError;

      const allWods = allWodsData || [];

      const periodsWithProgress = (periodsData || []).map((period) => {
        const periodWods = allWods.filter((wod) => (
          wod.date >= period.start_date &&
          wod.date <= period.end_date
        ));

        return {
          ...period,
          wods_cargados: periodWods.length,
          wods_restantes: Math.max(
            (period.total_sessions || 0) - periodWods.length,
            0
          ),
        };
      });

      setPeriodsHistory(periodsWithProgress);

      const hasPeriod =
        freshProfile?.plan_start_date &&
        freshProfile?.plan_end_date;

      const currentPeriodWods = hasPeriod
        ? allWods.filter((wod) => (
            wod.date >= freshProfile.plan_start_date &&
            wod.date <= freshProfile.plan_end_date
          ))
        : allWods;

      setWods(currentPeriodWods);

      if (!hasPeriod) {
        setWeeks([]);
        setExpandedWeeks({});
        return;
      }

      const totalWeeks =
        freshProfile.plan_weeks ||
        getWeeksBetween(
          freshProfile.plan_start_date,
          freshProfile.plan_end_date
        );

      const builtWeeks = buildWeeks(
        currentPeriodWods,
        freshProfile.plan_start_date,
        freshProfile.plan_end_date,
        totalWeeks
      );

      setWeeks(builtWeeks);

      const currentWeekNumber = getCurrentWeekNumber(
        freshProfile.plan_start_date,
        freshProfile.plan_end_date
      );

      if (currentWeekNumber) {
        setExpandedWeeks({
          [`week_${currentWeekNumber}`]: true,
        });
      } else if (builtWeeks.length > 0) {
        setExpandedWeeks({
          [builtWeeks[0].weekKey]: true,
        });
      }
    } catch (error) {
      console.error('Error cargando planificación del alumno:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = (weekKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const handleOpenWod = (session) => {
    navigation.navigate('DayDetail', {
      plan: session,
      date: session.date,
    });
  };

  const firstPlanId = wods[0]?.id;

  const currentWeekNumber = getCurrentWeekNumber(
    studentProfile?.plan_start_date,
    studentProfile?.plan_end_date
  );

  const expectedPerWeek = studentProfile?.sessions_per_week || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFD700" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>
            PROGRAMACIÓN DE
          </Text>

          <Text style={styles.headerName} numberOfLines={1}>
            {studentProfile?.full_name || student?.full_name || 'Alumno'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => setChatVisible(true)}
        >
          <Ionicons name="chatbubbles-sharp" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#FFD700"
          style={{ marginTop: 60 }}
        />
      ) : (
        <FlatList
          data={weeks}
          keyExtractor={(item) => item.weekKey}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <PeriodSummaryCard
                student={studentProfile}
                wodsCount={wods.length}
              />

              {periodsHistory.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    Historial de períodos
                  </Text>

                  {periodsHistory.map((period) => (
                    <PeriodHistoryCard
                      key={period.id}
                      period={period}
                    />
                  ))}
                </>
              )}

              {studentProfile?.plan_start_date && studentProfile?.plan_end_date && (
                <Text style={styles.sectionTitle}>
                  WODs cargados por semana
                </Text>
              )}
            </>
          }
          renderItem={({ item }) => (
            <WeekRow
              week={item}
              expectedPerWeek={expectedPerWeek}
              isExpanded={!!expandedWeeks[item.weekKey]}
              isActive={item.weekNumber === currentWeekNumber}
              onToggle={() => toggleWeek(item.weekKey)}
              onSessionPress={handleOpenWod}
            />
          )}
          ListEmptyComponent={
            studentProfile?.plan_start_date && studentProfile?.plan_end_date ? (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={60} color="#1a1a1a" />

                <Text style={styles.emptyTitle}>
                  Sin WODs cargados
                </Text>

                <Text style={styles.emptyText}>
                  Los WODs se cargarán desde Calendario V2.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <CommentsModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        planId={firstPlanId}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('PlannerScreen', {
            studentId: studentProfile?.id || student.id,
            studentName: studentProfile?.full_name || student.full_name,
          })
        }
        activeOpacity={0.85}
      >
        <Ionicons name="calendar" size={22} color="#000" />

        <Text style={styles.fabText}>
          CONFIGURAR / EXTENDER PERÍODO
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 14,
  },

  backBtn: {
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 12,
  },

  chatBtn: {
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 12,
  },

  headerLabel: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },

  headerName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 125,
  },

  sectionTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 50,
    gap: 8,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },

  emptyText: {
    color: '#555',
    textAlign: 'center',
    marginTop: 4,
  },

  fab: {
    position: 'absolute',
    bottom: 35,
    left: 20,
    right: 20,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 20,
    gap: 10,
    elevation: 8,
  },

  fabText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
});

const periodStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  label: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  range: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 5,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#222',
  },

  statusActive: {
    backgroundColor: '#FFD70022',
  },

  statusExpired: {
    backgroundColor: '#FF3B3022',
  },

  statusFuture: {
    backgroundColor: '#2F80ED22',
  },

  statusText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },

  statBox: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '900',
  },

  statLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  progressBg: {
    height: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    marginTop: 18,
    overflow: 'hidden',
  },

  progressFill: {
    height: 5,
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },

  emptyIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyText: {
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

const historyStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  title: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
  },

  subtitle: {
    color: '#666',
    marginTop: 4,
    fontSize: 12,
  },

  badge: {
    backgroundColor: '#FFD70022',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  badgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  statText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: 'bold',
  },

  remainingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
  },

  progressBg: {
    height: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },

  progressFill: {
    height: 5,
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
});

const weekStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },

  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#111',
  },

  barExpanded: {
    backgroundColor: '#FFD700',
  },

  barActive: {
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  label: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  labelExpanded: {
    color: '#000',
  },

  dateRange: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },

  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },

  numberBadgeActive: {
    borderColor: '#FFD700',
    backgroundColor: '#FFD70022',
  },

  numberBadgeExpanded: {
    borderColor: '#000',
    backgroundColor: 'transparent',
  },

  numberBadgeText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '900',
  },

  activePill: {
    backgroundColor: '#FFD70033',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },

  activePillText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
  },

  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#00ff8822',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },

  completedPillText: {
    color: '#00ff88',
    fontSize: 9,
    fontWeight: '900',
  },

  counter: {
    color: '#555',
    fontSize: 12,
    fontWeight: '800',
  },

  sessionsContainer: {
    padding: 10,
    backgroundColor: '#050505',
  },

  emptyWeek: {
    alignItems: 'center',
    paddingVertical: 18,
  },

  emptyWeekText: {
    color: '#555',
    marginTop: 6,
    fontSize: 13,
  },

  emptyWeekSubText: {
    color: '#FFD700',
    marginTop: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },

  missingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191600',
    borderWidth: 1,
    borderColor: '#FFD70033',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },

  missingText: {
    color: '#FFD700',
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

const wodStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1C1C1C',
    overflow: 'hidden',
  },

  statusBar: {
    width: 3,
    height: '100%',
    minHeight: 58,
    backgroundColor: '#222',
  },

  statusBarDone: {
    backgroundColor: '#FFD700',
  },

  info: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },

  date: {
    color: '#555',
    fontSize: 11,
    marginTop: 3,
  },

  doneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
});