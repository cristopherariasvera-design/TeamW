import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDashboard({ navigation }) {
  const { profile } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDateInRange = (date, startDate, endDate) => {
    if (!date || !startDate || !endDate) return false;

    return date >= startDate && date <= endDate;
  };

  const getPlanProgress = (student, plans = []) => {
    const hasPeriod =
      student.plan_start_date &&
      student.plan_end_date &&
      student.sessions_per_week &&
      student.plan_weeks;

    if (!hasPeriod) {
      return {
        hasPeriod: false,
        totalExpected: 0,
        loaded: 0,
        remaining: 0,
        progress: 0,
      };
    }

    const totalExpected =
      Number(student.sessions_per_week || 0) *
      Number(student.plan_weeks || 0);

    const loaded = plans.filter((plan) =>
      plan.student_id === student.id &&
      isDateInRange(
        plan.date,
        student.plan_start_date,
        student.plan_end_date
      )
    ).length;

    const remaining = Math.max(totalExpected - loaded, 0);

    const progress =
      totalExpected > 0
        ? Math.min(loaded / totalExpected, 1)
        : 0;

    return {
      hasPeriod: true,
      totalExpected,
      loaded,
      remaining,
      progress,
    };
  };

  const getStudentPlanIds = (student, plans = []) => {
    return plans
      .filter((plan) => {
        if (plan.student_id !== student.id) return false;

        if (student.plan_start_date && student.plan_end_date) {
          return isDateInRange(
            plan.date,
            student.plan_start_date,
            student.plan_end_date
          );
        }

        return true;
      })
      .map((plan) => plan.id);
  };

  const fetchStudents = async () => {
    try {
      if (!refreshing) setLoading(true);

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          status,
          goal,
          level,
          email,
          box_city,
          avatar_url,
          coach_id,
          plan_start_date,
          plan_end_date,
          sessions_per_week,
          plan_weeks
        `)
        .eq('role', 'alumno')
        .eq('coach_id', profile.id)
        .eq('status', 'Active')
        .order('full_name', { ascending: true });

      if (profileError) throw profileError;

      const cleanProfiles = profiles || [];
      const studentIds = cleanProfiles.map((student) => student.id);

      let calendarWods = [];
      let unreadComments = [];

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
          .eq('plan_type', 'wod');

        if (plansError) throw plansError;

        calendarWods = plansData || [];

        const planIds = calendarWods.map((plan) => plan.id);

        if (planIds.length > 0) {
          const { data: commentsData, error: commentsError } = await supabase
            .from('comments')
            .select(`
              id,
              plan_id,
              user_id,
              sender_role,
              is_read
            `)
            .in('plan_id', planIds)
            .eq('is_read', false)
            .neq('user_id', profile.id)
            .eq('sender_role', 'alumno');

          if (commentsError) throw commentsError;

          unreadComments = commentsData || [];
        }
      }

      const studentsWithData = cleanProfiles.map((student) => {
        const progress = getPlanProgress(student, calendarWods);
        const studentPlanIds = getStudentPlanIds(student, calendarWods);

        const hasNewMessages = unreadComments.some((comment) =>
          studentPlanIds.includes(comment.plan_id)
        );

        return {
          ...student,
          hasNewMessages,
          planProgress: progress,
        };
      });

      setStudents(studentsWithData);
    } catch (error) {
      console.error('Error al cargar alumnos:', error.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchStudents();
      }
    }, [profile?.id])
  );

  const renderProgressInfo = (student) => {
    const progress = student.planProgress;

    if (!progress?.hasPeriod) {
      return (
        <View style={styles.noPlanBox}>
          <Ionicons
            name="alert-circle-outline"
            size={14}
            color="#FFB800"
          />

          <Text style={styles.noPlanText}>
            Sin período configurado
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.progressWrapper}>
        <View style={styles.planRow}>
          <Text style={styles.planText}>
            Plan: {student.plan_start_date} → {student.plan_end_date}
          </Text>

          <Text style={styles.remainingText}>
            Restan {progress.remaining}
          </Text>
        </View>

        <View style={styles.planRow}>
          <Text style={styles.wodCounter}>
            {progress.loaded} / {progress.totalExpected} WODs cargados
          </Text>

          <Text style={styles.sessionsText}>
            {student.sessions_per_week}x semana
          </Text>
        </View>

        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress.progress * 100}%` },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => navigation.navigate('StudentDetail', { student: item })}
      activeOpacity={0.85}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.full_name?.charAt(0) || '?'}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.studentName} numberOfLines={1}>
            {item.full_name}
          </Text>

          {item.hasNewMessages && (
            <View style={styles.notificationDot} />
          )}
        </View>

        <Text style={styles.studentSub}>
          {item.level || 'Sin nivel'} • {item.box_city || 'Sin ciudad'}
        </Text>

        {renderProgressInfo(item)}
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#555"
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcome}>
              Panel de Coach
            </Text>

            <Text style={styles.title}>
              Mis Atletas
            </Text>
          </View>

          <View style={styles.headerButtonsContainer}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate('AdminStudents')}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color="#FFD700"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerActionBtn, { marginLeft: 10 }]}
              onPress={() => navigation.navigate('AddStudent')}
            >
              <Ionicons
                name="person-add"
                size={22}
                color="#FFD700"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminStudents')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="document-text-outline"
            size={28}
            color="#FFD700"
          />

          <Text style={styles.actionTitle}>
            Planificador
          </Text>

          <Text style={styles.actionSub}>
            Configurar períodos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CoachCalendar')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="calendar-outline"
            size={28}
            color="#FFD700"
          />

          <Text style={styles.actionTitle}>
            Calendario V2
          </Text>

          <Text style={styles.actionSub}>
            Crear WODs
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator
          color="#FFD700"
          size="large"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchStudents();
              }}
              tintColor="#FFD700"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons
                name="people-outline"
                size={60}
                color="#333"
              />

              <Text style={styles.emptyText}>
                No tienes alumnos asociados.
              </Text>

              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AddStudent')}
              >
                <Text style={styles.emptyBtnText}>
                  Registrar mi primer alumno
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddStudent')}
        activeOpacity={0.9}
      >
        <Ionicons
          name="add"
          size={32}
          color="#000"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  welcome: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 2,
  },

  headerActionBtn: {
    padding: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },

  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
  },

  actionCard: {
    flex: 1,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },

  actionTitle: {
    color: '#FFF',
    marginTop: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  actionSub: {
    color: '#666',
    marginTop: 4,
    fontSize: 11,
    fontWeight: 'bold',
  },

  list: {
    padding: 15,
    paddingBottom: 100,
  },

  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },

  avatar: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 20,
  },

  infoContainer: {
    flex: 1,
    marginLeft: 15,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    maxWidth: '92%',
  },

  studentSub: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },

  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginLeft: 8,
  },

  progressWrapper: {
    marginTop: 10,
  },

  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  planText: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },

  remainingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },

  wodCounter: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },

  sessionsText: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 3,
  },

  progressBg: {
    height: 5,
    backgroundColor: '#222',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },

  progressFill: {
    height: 5,
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },

  noPlanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  noPlanText: {
    color: '#FFB800',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
  },

  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 80,
  },

  emptyText: {
    color: '#666',
    marginTop: 15,
    fontSize: 16,
  },

  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },

  emptyBtnText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});