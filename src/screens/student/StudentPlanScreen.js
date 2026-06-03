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

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const pad = (value) => String(value).padStart(2, '0');

const parseDate = (str) => {
  if (!str) return null;

  const [year, month, day] = String(str).split('-').map(Number);

  return new Date(year, month - 1, day);
};

const toISO = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}`;
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
};

const getSunday = (monday) => {
  const d = new Date(monday);

  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);

  return d;
};

const fmtDay = (date) =>
  date
    .toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());

const fmtShort = (date) =>
  date
    .toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
    })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());

const fmtPlanDate = (dateStr) => {
  const date = parseDate(dateStr);

  if (!date) return 'Sin fecha';

  return date
    .toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());
};

const getMonthRange = (selectedYear, selectedMonth) => {
  const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
  const lastDay = new Date(selectedYear, selectedMonth, 0);

  return {
    firstDay,
    lastDay,
    firstDayISO: toISO(firstDay),
    lastDayISO: toISO(lastDay),
  };
};

const getExtendedMonthRange = (selectedYear, selectedMonth) => {
  const { firstDay, lastDay } = getMonthRange(selectedYear, selectedMonth);

  const rangeStart = getMonday(firstDay);
  const rangeEnd = getSunday(lastDay);

  return {
    rangeStart,
    rangeEnd,
    rangeStartISO: toISO(rangeStart),
    rangeEndISO: toISO(rangeEnd),
  };
};

const groupByWeek = (plans) => {
  const map = {};

  plans.forEach((plan) => {
    const week = plan.week_number || 1;

    if (!map[week]) map[week] = [];

    map[week].push(plan);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map((week) => {
      const sessions = map[week];

      const dates = sessions
        .map((session) => parseDate(session.date))
        .filter(Boolean)
        .sort((a, b) => a - b);

      const firstSession = dates[0];
      const lastSession = dates[dates.length - 1];

      const weekStart = firstSession ? getMonday(firstSession) : null;
      const weekEnd = lastSession ? getSunday(lastSession) : null;

      const isCurrentWeek =
        weekStart && weekEnd
          ? today >= weekStart && today <= weekEnd
          : false;

      const rangeLabel = firstSession
        ? firstSession.getTime() === lastSession.getTime()
          ? fmtDay(firstSession)
          : `${fmtDay(firstSession)} → ${fmtDay(lastSession)}`
        : `Semana ${week}`;

      return {
        weekNumber: Number(week),
        sessions,
        firstSession,
        lastSession,
        isCurrentWeek,
        rangeLabel,
      };
    });
};

const buildCalendarDays = (selectedYear, selectedMonth) => {
  const { firstDay, lastDay } = getMonthRange(selectedYear, selectedMonth);

  const calendarStart = getMonday(firstDay);
  const calendarEnd = getSunday(lastDay);

  const days = [];
  const cursor = new Date(calendarStart);

  while (cursor <= calendarEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const getExpectedSessions = (period) => {
  if (!period) return 0;

  const total = Number(period.total_sessions || 0);
  const sessionsPerWeek = Number(period.sessions_per_week || 0);
  const weeks = Math.max(Number(period.weeks || 0), 1);
  const fallback = sessionsPerWeek * weeks;

  return Math.max(total, fallback, 0);
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StudentPlanScreen({ navigation }) {
  const { profile } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [viewMode, setViewMode] = useState('list');

  const [periodStats, setPeriodStats] = useState({
    expected: 0,
    loaded: 0,
    completed: 0,
    remainingToLoad: 0,
    remainingToComplete: 0,
    loadProgress: 0,
    completionProgress: 0,
  });

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  useEffect(() => {
    if (profile?.id && isFocused) {
      loadPlans();
    }
  }, [selectedMonth, selectedYear, profile?.id, isFocused]);

  const toggleWeek = (weekNumber) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  };

  const loadActivePeriod = async (firstDay, lastDay) => {
    const { data, error } = await supabase
      .from('student_plan_periods')
      .select(`
        id,
        student_id,
        start_date,
        end_date,
        sessions_per_week,
        weeks,
        total_sessions,
        status
      `)
      .eq('student_id', profile.id)
      .eq('status', 'Active')
      .lte('start_date', toISO(lastDay))
      .gte('end_date', toISO(firstDay))
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    setActivePeriod(data || null);

    return data || null;
  };

  const loadPeriodStats = async (period) => {
    if (!period) {
      setPeriodStats({
        expected: 0,
        loaded: 0,
        completed: 0,
        remainingToLoad: 0,
        remainingToComplete: 0,
        loadProgress: 0,
        completionProgress: 0,
      });

      return;
    }

    const expected = getExpectedSessions(period);

    const { data, error } = await supabase
      .from('plans')
      .select('id, is_done')
      .eq('student_id', profile.id)
      .eq('source', 'calendar_wod')
      .eq('plan_type', 'wod')
      .gte('date', period.start_date)
      .lte('date', period.end_date);

    if (error) throw error;

    const loaded = data?.length || 0;
    const completed = (data || []).filter((plan) => plan.is_done).length;

    setPeriodStats({
      expected,
      loaded,
      completed,
      remainingToLoad: Math.max(expected - loaded, 0),
      remainingToComplete: Math.max(expected - completed, 0),
      loadProgress: expected > 0 ? Math.min(loaded / expected, 1) : 0,
      completionProgress: expected > 0 ? Math.min(completed / expected, 1) : 0,
    });
  };

  const loadPlans = async () => {
    try {
      setLoading(true);

      const { firstDay, lastDay, firstDayISO, lastDayISO } = getMonthRange(
        selectedYear,
        selectedMonth
      );

      const { rangeStartISO, rangeEndISO } = getExtendedMonthRange(
        selectedYear,
        selectedMonth
      );

      const period = await loadActivePeriod(firstDay, lastDay);

      await loadPeriodStats(period);

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('student_id', profile.id)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod')
        .gte('date', rangeStartISO)
        .lte('date', rangeEndISO)
        .order('date', { ascending: true });

      if (error) throw error;

      const sanitized = (data || []).map((plan) => {
        let sections = [];

        if (plan.sections) {
          if (typeof plan.sections === 'string') {
            try {
              sections = JSON.parse(plan.sections);
            } catch {
              sections = [];
            }
          } else {
            sections = plan.sections;
          }
        }

        return {
          ...plan,
          sections: Array.isArray(sections) ? sections : [],
        };
      });

      const currentMonthPlans = sanitized.filter(
        (plan) => plan.date >= firstDayISO && plan.date <= lastDayISO
      );

      setPlans(sanitized);

      const built = groupByWeek(currentMonthPlans);
      const initial = {};
      const currentWeek = built.find((week) => week.isCurrentWeek);

      if (currentWeek) {
        initial[currentWeek.weekNumber] = true;
      } else if (built.length > 0) {
        initial[built[0].weekNumber] = true;
      }

      setExpandedWeeks(initial);
    } catch (error) {
      console.error('Error loading plans:', error.message || error);
      Alert.alert('Error', 'No se pudieron cargar los entrenamientos.');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (dir) => {
    let month = selectedMonth + dir;
    let year = selectedYear;

    if (month > 12) {
      month = 1;
      year += 1;
    }

    if (month < 1) {
      month = 12;
      year -= 1;
    }

    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const { firstDayISO, lastDayISO } = getMonthRange(
    selectedYear,
    selectedMonth
  );

  const monthPlans = plans.filter(
    (plan) => plan.date >= firstDayISO && plan.date <= lastDayISO
  );

  const weeks = groupByWeek(monthPlans);
  const completedTotal = monthPlans.filter((plan) => plan.is_done).length;

  const attendance =
    monthPlans.length > 0
      ? Math.round((completedTotal / monthPlans.length) * 100)
      : 0;

  const plansByDate = plans.reduce((acc, plan) => {
    if (!acc[plan.date]) acc[plan.date] = [];

    acc[plan.date].push(plan);

    return acc;
  }, {});

  const renderViewToggle = () => (
    <View style={styles.viewToggle}>
      <TouchableOpacity
        style={[
          styles.viewToggleBtn,
          viewMode === 'list' && styles.viewToggleBtnActive,
        ]}
        onPress={() => setViewMode('list')}
        activeOpacity={0.85}
      >
        <Ionicons
          name="list-outline"
          size={16}
          color={viewMode === 'list' ? '#000' : '#FFD700'}
        />

        <Text
          style={[
            styles.viewToggleText,
            viewMode === 'list' && styles.viewToggleTextActive,
          ]}
        >
          Lista
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.viewToggleBtn,
          viewMode === 'calendar' && styles.viewToggleBtnActive,
        ]}
        onPress={() => setViewMode('calendar')}
        activeOpacity={0.85}
      >
        <Ionicons
          name="calendar-outline"
          size={16}
          color={viewMode === 'calendar' ? '#000' : '#FFD700'}
        />

        <Text
          style={[
            styles.viewToggleText,
            viewMode === 'calendar' && styles.viewToggleTextActive,
          ]}
        >
          Calendario
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPeriodCard = () => {
    if (!activePeriod) {
      return (
        <View style={styles.periodEmptyCard}>
          <Ionicons name="alert-circle-outline" size={17} color="#777" />

          <Text style={styles.periodEmptyText}>
            Sin período activo para este mes
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.periodCard}>
        <View style={styles.periodTop}>
          <View style={styles.periodIconBox}>
            <Ionicons name="calendar-outline" size={18} color="#FFD700" />
          </View>

          <View style={styles.periodInfo}>
            <Text style={styles.periodLabel}>
              PLAN ACTUAL
            </Text>

            <Text style={styles.periodDates}>
              {fmtPlanDate(activePeriod.start_date)} → {fmtPlanDate(activePeriod.end_date)}
            </Text>

            <Text style={styles.periodMeta}>
              {activePeriod.sessions_per_week || 0}x semana · {activePeriod.weeks || 0} semanas · {periodStats.expected} WODs esperados
            </Text>
          </View>
        </View>

        <View style={styles.periodProgressBox}>
          <View style={styles.periodStatsCompactRow}>
            <View style={styles.periodMiniStat}>
              <Text style={styles.periodMiniLabel}>
                Cargados
              </Text>

              <Text style={styles.periodMiniValue}>
                {periodStats.loaded}/{periodStats.expected}
              </Text>
            </View>

            <View style={styles.periodMiniStat}>
              <Text style={styles.periodMiniLabel}>
                Completados
              </Text>

              <Text style={[styles.periodMiniValue, { color: '#00ff88' }]}>
                {periodStats.completed}/{periodStats.expected}
              </Text>
            </View>

            <View style={styles.periodMiniStat}>
              <Text style={styles.periodMiniLabel}>
                Restan por cargar
              </Text>

              <Text style={styles.periodMiniValue}>
                {periodStats.remainingToLoad}
              </Text>
            </View>
          </View>

          <View style={styles.compactProgressGroup}>
            <View style={styles.compactProgressBarBg}>
              <View
                style={[
                  styles.compactProgressBarFill,
                  { width: `${periodStats.loadProgress * 100}%` },
                ]}
              />
            </View>

            <View style={styles.compactProgressBarBg}>
              <View
                style={[
                  styles.compactProgressBarFill,
                  styles.compactProgressBarFillDone,
                  { width: `${periodStats.completionProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSummaryBar = () => {
    if (monthPlans.length === 0) return null;

    return (
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {monthPlans.length}
          </Text>

          <Text style={styles.summaryLabel}>
            SESIONES MES
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#00ff88' }]}>
            {completedTotal}
          </Text>

          <Text style={styles.summaryLabel}>
            COMPLETADAS
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#00aaff' }]}>
            {attendance}%
          </Text>

          <Text style={styles.summaryLabel}>
            ASISTENCIA MES
          </Text>
        </View>
      </View>
    );
  };

  const renderListView = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {weeks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#1a1a1a" />

          <Text style={styles.emptyText}>
            Sin planificación este mes
          </Text>

          <Text style={styles.emptySubtext}>
            Tu coach aún no ha cargado entrenamientos para este período.
          </Text>
        </View>
      ) : (
        weeks.map(({ weekNumber, sessions, rangeLabel, isCurrentWeek }) => {
          const doneCount = sessions.filter((session) => session.is_done).length;
          const allDone = doneCount === sessions.length && sessions.length > 0;
          const isExpanded = !!expandedWeeks[weekNumber];

          return (
            <View
              key={weekNumber}
              style={[
                styles.weekBlock,
                isCurrentWeek && styles.weekBlockCurrent,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.75}
                style={[
                  styles.weekHeader,
                  isCurrentWeek && styles.weekHeaderCurrent,
                ]}
                onPress={() => toggleWeek(weekNumber)}
              >
                <View style={styles.weekHeaderLeft}>
                  <View
                    style={[
                      styles.weekBadge,
                      allDone && styles.weekBadgeDone,
                      isCurrentWeek && !allDone && styles.weekBadgeCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekBadgeText,
                        (allDone || isCurrentWeek) && { color: '#000' },
                      ]}
                    >
                      {weekNumber}
                    </Text>
                  </View>

                  <View>
                    <View style={styles.weekTitleRow}>
                      <Text
                        style={[
                          styles.weekTitle,
                          isCurrentWeek && styles.weekTitleCurrent,
                        ]}
                      >
                        SEMANA {weekNumber}
                      </Text>

                      {isCurrentWeek && (
                        <View style={styles.currentBadge}>
                          <View style={styles.currentDot} />

                          <Text style={styles.currentBadgeText}>
                            ACTUAL
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.weekRange,
                        isCurrentWeek && styles.weekRangeCurrent,
                      ]}
                    >
                      {rangeLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.weekProgress}>
                  <Text style={styles.weekProgressText}>
                    {doneCount}/{sessions.length}
                  </Text>

                  {allDone ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#00ff88"
                    />
                  ) : (
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={isCurrentWeek ? '#FFD700' : '#444'}
                    />
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${
                        sessions.length > 0
                          ? (doneCount / sessions.length) * 100
                          : 0
                      }%`,
                    },
                    allDone && { backgroundColor: '#00ff88' },
                  ]}
                />
              </View>

              {isExpanded && (
                <View style={styles.sessionsContainer}>
                  {sessions.map((plan) => {
                    const planDate = parseDate(plan.date);
                    const isDone = plan.is_done;

                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[
                          styles.sessionCard,
                          isDone && styles.sessionCardDone,
                        ]}
                        onPress={() =>
                          navigation.navigate('DayDetail', { plan })
                        }
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.statusBar,
                            isDone && styles.statusBarDone,
                          ]}
                        />

                        <View style={styles.sessionBody}>
                          <View style={styles.sessionTop}>
                            <Text
                              style={[
                                styles.sessionDate,
                                isDone && styles.sessionDateDone,
                              ]}
                            >
                              {planDate
                                ? fmtShort(planDate).toUpperCase()
                                : 'S/F'}
                            </Text>

                            <Text
                              style={styles.sessionTitle}
                              numberOfLines={1}
                            >
                              {plan.title || plan.day_name || 'Sesión'}
                            </Text>
                          </View>

                          {plan.sections?.length > 0 && (
                            <Text style={styles.sessionBlocks}>
                              {plan.sections.length} bloque
                              {plan.sections.length !== 1 ? 's' : ''} de entrenamiento
                            </Text>
                          )}
                        </View>

                        {isDone ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color="#00ff88"
                          />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#2a2a2a"
                          />
                        )}
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
  );

  const renderCalendarView = () => {
    const calendarDays = buildCalendarDays(selectedYear, selectedMonth);

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.calendarContent}
      >
        <View style={styles.calendarHeader}>
          {dayNames.map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.calendarDayName}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => {
            const iso = toISO(day);
            const dayPlans = plansByDate[iso] || [];
            const isCurrentMonth = day.getMonth() + 1 === selectedMonth;
            const isToday = iso === toISO(new Date());
            const doneCount = dayPlans.filter((plan) => plan.is_done).length;

            return (
              <View
                key={iso}
                style={[
                  styles.calendarCell,
                  !isCurrentMonth && styles.calendarCellMuted,
                  dayPlans.length > 0 && styles.calendarCellWithPlans,
                  isToday && styles.calendarCellToday,
                ]}
              >
                <View style={styles.calendarCellTop}>
                  <Text
                    style={[
                      styles.calendarDayNumber,
                      !isCurrentMonth && styles.calendarDayNumberMuted,
                      isToday && styles.calendarDayNumberToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>

                  {dayPlans.length > 0 && (
                    <View
                      style={[
                        styles.calendarCountBadge,
                        doneCount === dayPlans.length &&
                          styles.calendarCountBadgeDone,
                      ]}
                    >
                      <Text style={styles.calendarCountText}>
                        {dayPlans.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.calendarPlansList}>
                  {dayPlans.slice(0, 2).map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.calendarPlanChip,
                        plan.is_done && styles.calendarPlanChipDone,
                      ]}
                      onPress={() =>
                        navigation.navigate('DayDetail', { plan })
                      }
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.calendarPlanTitle,
                          plan.is_done && styles.calendarPlanTitleDone,
                        ]}
                        numberOfLines={1}
                      >
                        {plan.title || plan.day_name || 'WOD'}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {dayPlans.length > 2 && (
                    <Text style={styles.calendarMoreText}>
                      +{dayPlans.length - 2} más
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  if (loading && plans.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />

        <Text style={styles.loadingText}>
          Cargando planificación...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthSelector}>
        <TouchableOpacity
          onPress={() => changeMonth(-1)}
          style={styles.monthBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#FFD700" />
        </TouchableOpacity>

        <View style={styles.monthInfo}>
          <Text style={styles.monthText}>
            {monthNames[selectedMonth - 1]}
          </Text>

          <Text style={styles.yearText}>
            {selectedYear}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => changeMonth(1)}
          style={styles.monthBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {renderPeriodCard()}

      {renderSummaryBar()}

      {renderViewToggle()}

      {viewMode === 'list' ? renderListView() : renderCalendarView()}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
  },

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#060606',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  monthBtn: {
    padding: 8,
  },

  monthInfo: {
    alignItems: 'center',
  },

  monthText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },

  yearText: {
    fontSize: 11,
    color: '#FFD700',
    marginTop: 1,
    letterSpacing: 1.5,
  },

  periodCard: {
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  periodTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  periodIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#151300',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3200',
    marginRight: 12,
  },

  periodInfo: {
    flex: 1,
  },

  periodLabel: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  periodDates: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },

  periodMeta: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  periodProgressBox: {
    marginTop: 9,
  },

  periodStatsCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  periodMiniStat: {
    flex: 1,
  },

  periodMiniLabel: {
    color: '#555',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  periodMiniValue: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },

  compactProgressGroup: {
    marginTop: 7,
  },

  compactProgressBarBg: {
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    marginBottom: 5,
    overflow: 'hidden',
  },

  compactProgressBarFill: {
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },

  compactProgressBarFillDone: {
    backgroundColor: '#00ff88',
  },

  periodEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  periodEmptyText: {
    color: '#777',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#080808',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },

  summaryValue: {
    color: '#FFD700',
    fontSize: 19,
    fontWeight: '900',
  },

  summaryLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },

  summaryDivider: {
    width: 1,
    backgroundColor: '#111',
    marginVertical: 10,
  },

  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#030303',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  viewToggleBtn: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginHorizontal: 4,
  },

  viewToggleBtnActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  viewToggleText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },

  viewToggleTextActive: {
    color: '#000',
  },

  content: {
    flex: 1,
  },

  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },

  emptyText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },

  emptySubtext: {
    fontSize: 13,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  weekBlock: {
    marginBottom: 6,
  },

  weekBlockCurrent: {
    borderLeftWidth: 2,
    borderLeftColor: '#FFD700',
  },

  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },

  weekHeaderCurrent: {
    backgroundColor: '#0d0d00',
  },

  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  weekBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFD70022',
    borderWidth: 1,
    borderColor: '#FFD70044',
    justifyContent: 'center',
    alignItems: 'center',
  },

  weekBadgeDone: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  weekBadgeCurrent: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  weekBadgeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '900',
  },

  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  weekTitle: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  weekTitleCurrent: {
    color: '#FFD700',
  },

  weekRange: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },

  weekRangeCurrent: {
    color: '#fff',
  },

  weekProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  weekProgressText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  progressBarBg: {
    height: 2,
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 1,
  },

  progressBarFill: {
    height: 2,
    backgroundColor: '#FFD700',
    borderRadius: 1,
  },

  sessionsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#161616',
    overflow: 'hidden',
  },

  sessionCardDone: {
    borderColor: '#00ff8822',
  },

  statusBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#1e1e1e',
  },

  statusBarDone: {
    backgroundColor: '#00ff88',
  },

  sessionBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },

  sessionDate: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  sessionDateDone: {
    color: '#00ff88',
  },

  sessionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },

  sessionBlocks: {
    color: '#333',
    fontSize: 11,
    fontStyle: 'italic',
  },

  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD70022',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD70055',
  },

  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },

  currentBadgeText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  calendarContent: {
    paddingHorizontal: 8,
    paddingBottom: 40,
  },

  calendarHeader: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 5,
  },

  calendarDayName: {
    flex: 1,
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarCell: {
    width: `${100 / 7}%`,
    minHeight: 82,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#171717',
    padding: 5,
  },

  calendarCellMuted: {
    backgroundColor: '#050505',
    opacity: 0.45,
  },

  calendarCellWithPlans: {
    backgroundColor: '#0F0F00',
    borderColor: '#302A00',
  },

  calendarCellToday: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },

  calendarCellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  calendarDayNumber: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  calendarDayNumberMuted: {
    color: '#555',
  },

  calendarDayNumberToday: {
    color: '#FFD700',
  },

  calendarCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  calendarCountBadgeDone: {
    backgroundColor: '#00ff88',
  },

  calendarCountText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },

  calendarPlansList: {
    marginTop: 6,
  },

  calendarPlanChip: {
    backgroundColor: '#1A1A1A',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginBottom: 3,
  },

  calendarPlanChipDone: {
    backgroundColor: '#002617',
  },

  calendarPlanTitle: {
    color: '#FFD700',
    fontSize: 8,
    fontWeight: '900',
  },

  calendarPlanTitleDone: {
    color: '#00ff88',
  },

  calendarMoreText: {
    color: '#777',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
});