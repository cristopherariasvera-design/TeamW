import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const MONTH_NAMES = [
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

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CoachCalendarScreen({ navigation }) {
  const { profile } = useAuth();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const [holidays, setHolidays] = useState({});
  const [wodCountsByDate, setWodCountsByDate] = useState({});

  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    loadHolidays(currentYear);
  }, [currentYear]);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        loadPlansForMonth();
      }
    }, [profile?.id, currentMonth, currentYear])
  );

  const formatDate = (year, month, day) => {
    const monthText = String(month + 1).padStart(2, '0');
    const dayText = String(day).padStart(2, '0');

    return `${year}-${monthText}-${dayText}`;
  };

  const getMonthRange = () => {
    const firstDay = formatDate(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const lastDay = formatDate(currentYear, currentMonth, lastDayOfMonth);

    return {
      firstDay,
      lastDay,
    };
  };

  const loadHolidays = async (year) => {
    try {
      setLoadingHolidays(true);

      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/CL`
      );

      if (!response.ok) {
        throw new Error('No se pudieron obtener los feriados');
      }

      const data = await response.json();
      const holidayMap = {};

      data.forEach((holiday) => {
        holidayMap[holiday.date] = holiday.localName;
      });

      setHolidays(holidayMap);
    } catch (error) {
      console.error('Error obteniendo feriados:', error);

      Alert.alert(
        'Aviso',
        'No se pudieron cargar los feriados. El calendario funcionará igualmente.'
      );
    } finally {
      setLoadingHolidays(false);
    }
  };

  const loadPlansForMonth = async () => {
    try {
      if (!profile?.id) return;

      setLoadingPlans(true);

      const { firstDay, lastDay } = getMonthRange();

      const { data, error } = await supabase
        .from('plans')
        .select('id, date, title, student_id, coach_id')
        .eq('coach_id', profile.id)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .not('date', 'is', null);

      if (error) throw error;

      const counts = {};

      data.forEach((plan) => {
        if (!plan.date) return;

        if (!counts[plan.date]) {
          counts[plan.date] = 0;
        }

        counts[plan.date] += 1;
      });

      setWodCountsByDate(counts);
    } catch (error) {
      console.error('Error cargando planes del mes:', error.message);

      Alert.alert(
        'Error',
        'No se pudieron cargar los WODs del calendario.'
      );
    } finally {
      setLoadingPlans(false);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const totalDays = lastDayOfMonth.getDate();

    // getDay(): domingo = 0, lunes = 1.
    // Queremos lunes como primer día.
    const firstWeekDay = firstDayOfMonth.getDay();
    const emptyDaysBefore = firstWeekDay === 0 ? 6 : firstWeekDay - 1;

    const days = [];

    for (let i = 0; i < emptyDaysBefore; i++) {
      days.push({
        type: 'empty',
        key: `empty-${i}`,
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = formatDate(currentYear, currentMonth, day);

      days.push({
        type: 'day',
        key: date,
        day,
        date,
        holidayName: holidays[date],
        wodCount: wodCountsByDate[date] || 0,
      });
    }

    return days;
  }, [currentMonth, currentYear, holidays, wodCountsByDate]);

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
      return;
    }

    setCurrentMonth((prev) => prev - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
      return;
    }

    setCurrentMonth((prev) => prev + 1);
  };

  const handleDayPress = (dayData) => {
    navigation.navigate('CoachDayPlans', {
      date: dayData.date,
      holidayName: dayData.holidayName || null,
    });
  };

  const renderDay = (item) => {
    if (item.type === 'empty') {
      return <View key={item.key} style={styles.emptyDay} />;
    }

    const isHoliday = Boolean(item.holidayName);
    const hasWods = item.wodCount > 0;

    return (
      <TouchableOpacity
        key={item.key}
        style={[
          styles.dayCell,
          isHoliday && styles.holidayCell,
          hasWods && styles.hasWodCell,
        ]}
        onPress={() => handleDayPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.dayTopRow}>
          <Text
            style={[
              styles.dayNumber,
              isHoliday && styles.holidayDayNumber,
            ]}
          >
            {item.day}
          </Text>

          {hasWods && (
            <View style={styles.wodBadge}>
              <Text style={styles.wodBadgeText}>
                {item.wodCount}
              </Text>
            </View>
          )}
        </View>

        {isHoliday ? (
          <View style={styles.holidayBox}>
            <Text style={styles.holidayLabel}>
              FERIADO
            </Text>

            <Text
              style={styles.holidayName}
              numberOfLines={2}
            >
              {item.holidayName}
            </Text>
          </View>
        ) : hasWods ? (
          <Text style={styles.wodText}>
            PLANES
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const isLoading = loadingHolidays || loadingPlans;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.monthHeader}>
        <TouchableOpacity
          style={styles.monthButton}
          onPress={goToPreviousMonth}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#FFD700"
          />
        </TouchableOpacity>

        <View style={styles.monthTitleBox}>
          <Text style={styles.title}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <Text style={styles.subtitle}>
            Calendario de WODs
          </Text>
        </View>

        <TouchableOpacity
          style={styles.monthButton}
          onPress={goToNextMonth}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color="#FFD700"
          />
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            color="#FFD700"
            size="small"
          />

          <Text style={styles.loadingText}>
            Cargando calendario...
          </Text>
        </View>
      )}

      <View style={styles.weekHeader}>
        {DAY_NAMES.map((dayName, index) => (
          <Text
            key={`${dayName}-${index}`}
            style={styles.weekDayText}
          >
            {dayName}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendarDays.map(renderDay)}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDotGold} />
          <Text style={styles.legendText}>
            Día con planes/WODs
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={styles.legendDotRed} />
          <Text style={styles.legendText}>
            Feriado
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthTitleBox: {
    alignItems: 'center',
  },

  title: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  subtitle: {
    color: '#777',
    marginTop: 4,
    fontSize: 13,
  },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },

  loadingText: {
    color: '#777',
    marginLeft: 10,
  },

  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  weekDayText: {
    flex: 1,
    textAlign: 'center',
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 12,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  emptyDay: {
    width: `${100 / 7}%`,
    height: 72,
    padding: 3,
  },

  dayCell: {
    width: `${100 / 7}%`,
    height: 72,
    padding: 6,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 5,
  },

  hasWodCell: {
    borderColor: '#FFD700',
  },

  holidayCell: {
    borderColor: '#FF4D4D',
    backgroundColor: '#170707',
  },

  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dayNumber: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },

  holidayDayNumber: {
    color: '#FF6B6B',
  },

  wodBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  wodBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },

  wodText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 10,
  },

  holidayBox: {
    marginTop: 5,
  },

  holidayLabel: {
    color: '#FF4D4D',
    fontSize: 8,
    fontWeight: '900',
  },

  holidayName: {
    color: '#FF9B9B',
    fontSize: 7,
    marginTop: 2,
    lineHeight: 9,
  },

  legend: {
    marginTop: 18,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  legendDotGold: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD700',
    marginRight: 8,
  },

  legendDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4D4D',
    marginRight: 8,
  },

  legendText: {
    color: '#AAA',
    fontSize: 13,
  },
});