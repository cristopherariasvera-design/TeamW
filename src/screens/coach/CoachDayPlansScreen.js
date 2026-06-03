import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDayPlansScreen({ route, navigation }) {
  const { profile } = useAuth();

  const {
    date,
    holidayName = null,
  } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wodGroups, setWodGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  useFocusEffect(
    useCallback(() => {
      if (profile?.id && date) {
        fetchDayPlans();
      }
    }, [profile?.id, date])
  );

  const fetchDayPlans = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }

      const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select(`
          id,
          student_id,
          coach_id,
          date,
          title,
          sections,
          blocks,
          is_done,
          source,
          plan_type,
          created_from,
          batch_id,
          month,
          year,
          day_name
        `)
        .eq('coach_id', profile.id)
        .eq('date', date)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod')
        .order('title', { ascending: true })
        .order('id', { ascending: true });

      if (plansError) {
        throw plansError;
      }

      const cleanPlans = plans || [];

      const studentIds = [
        ...new Set(
          cleanPlans
            .map((plan) => plan.student_id)
            .filter(Boolean)
        ),
      ];

      let studentsMap = {};

      if (studentIds.length > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            level,
            status,
            plan_start_date,
            plan_end_date,
            sessions_per_week,
            plan_weeks
          `)
          .in('id', studentIds);

        if (studentsError) {
          throw studentsError;
        }

        studentsMap = (students || []).reduce((acc, student) => {
          acc[student.id] = student;
          return acc;
        }, {});
      }

      const enrichedPlans = cleanPlans.map((plan) => ({
        ...plan,
        student_profile: studentsMap[plan.student_id] || null,
      }));

      const groupsMap = {};

      enrichedPlans.forEach((plan) => {
        const groupKey =
          plan.batch_id ||
          `single_${plan.date}_${plan.title || 'sin_titulo'}_${plan.id}`;

        if (!groupsMap[groupKey]) {
          groupsMap[groupKey] = {
            key: groupKey,
            batch_id: plan.batch_id,
            title: plan.title || 'WOD sin título',
            date: plan.date,
            plans: [],
          };
        }

        groupsMap[groupKey].plans.push(plan);
      });

      const groups = Object.values(groupsMap)
        .map((group) => ({
          ...group,
          plans: group.plans.sort((a, b) => {
            const nameA = a.student_profile?.full_name || '';
            const nameB = b.student_profile?.full_name || '';
            return nameA.localeCompare(nameB);
          }),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      setWodGroups(groups);

      setExpandedGroups((current) => {
        if (Object.keys(current).length > 0) {
          return current;
        }

        if (groups.length === 0) {
          return {};
        }

        return {
          [groups[0].key]: true,
        };
      });
    } catch (error) {
      console.error('Error cargando WODs del día:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDayPlans();
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const openWodGroup = (group) => {
    if (!group?.plans?.length) return;

    navigation.navigate('DayDetail', {
      plan: group.plans[0],
      date,
      mode: 'manage-wod',
      holidayName,
    });
  };

  const openStudentPlan = (plan) => {
    navigation.navigate('DayDetail', {
      plan,
      date,
      holidayName,
    });
  };

  const goToNewWod = () => {
    navigation.navigate('DayDetail', {
      plan: {
        id: null,
        title: '',
        sections: [],
        source: 'calendar_wod',
        plan_type: 'wod',
      },
      date,
      mode: 'create-multiple',
      holidayName,
    });
  };

  const getInitial = (name) => {
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  const getStudentsCountText = (count) => {
    if (count === 1) {
      return '1 alumno asignado';
    }

    return `${count} alumnos asignados`;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#FFD700"
          size="large"
          style={{ marginTop: 80 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        <View style={styles.headerBlock}>
          <Text style={styles.headerLabel}>
            PLANES DEL DÍA
          </Text>

          <Text style={styles.dateTitle}>
            {date}
          </Text>

          {holidayName && holidayName !== 'null' && (
            <View style={styles.holidayBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#FF4D4D"
              />

              <Text style={styles.holidayText}>
                Feriado: {holidayName}
              </Text>
            </View>
          )}
        </View>

        {wodGroups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="barbell-outline"
              size={56}
              color="#1A1A1A"
            />

            <Text style={styles.emptyTitle}>
              Sin WODs para este día
            </Text>

            <Text style={styles.emptyText}>
              Crea un WOD y asígnalo a los alumnos con período activo.
            </Text>
          </View>
        ) : (
          wodGroups.map((group) => {
            const isExpanded = !!expandedGroups[group.key];

            return (
              <View
                key={group.key}
                style={styles.wodCard}
              >
                <View style={styles.wodHeader}>
                  <TouchableOpacity
                    style={styles.wodTitleArea}
                    onPress={() => openWodGroup(group)}
                    activeOpacity={0.8}
                  >
                    <View>
                      <Text style={styles.wodTitle}>
                        🔥 {group.title}
                      </Text>

                      <Text style={styles.studentsCount}>
                        {getStudentsCountText(group.plans.length)}
                      </Text>

                      <Text style={styles.manageHint}>
                        Tocar nombre para gestionar alumnos
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.expandBtn}
                    onPress={() => toggleGroup(group.key)}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={26}
                      color="#FFD700"
                    />
                  </TouchableOpacity>
                </View>

                {isExpanded && (
                  <View style={styles.studentsContainer}>
                    {group.plans.map((studentPlan) => {
                      const student = studentPlan.student_profile;
                      const studentName =
                        student?.full_name || 'Alumno sin nombre';

                      return (
                        <TouchableOpacity
                          key={studentPlan.id}
                          style={styles.studentRow}
                          onPress={() => openStudentPlan(studentPlan)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {getInitial(studentName)}
                            </Text>
                          </View>

                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>
                              {studentName}
                            </Text>

                            <Text style={styles.studentSub}>
                              {student?.level || 'Sin nivel'} · Tocar para editar copia individual
                            </Text>
                          </View>

                          <Ionicons
                            name="create-outline"
                            size={22}
                            color="#FFD700"
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.newButton}
        onPress={goToNewWod}
        activeOpacity={0.9}
      >
        <Ionicons
          name="add-circle-outline"
          size={22}
          color="#000"
        />

        <Text style={styles.newButtonText}>
          NUEVO WOD
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 130,
  },

  headerBlock: {
    marginBottom: 22,
  },

  headerLabel: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },

  dateTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },

  holidayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#170707',
    borderWidth: 1,
    borderColor: '#FF4D4D',
    borderRadius: 12,
    padding: 12,
  },

  holidayText: {
    color: '#FF9B9B',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: 'bold',
  },

  wodCard: {
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },

  wodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#151515',
  },

  wodTitleArea: {
    flex: 1,
  },

  wodTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },

  studentsCount: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 6,
  },

  manageHint: {
    color: '#555',
    fontSize: 11,
    marginTop: 4,
  },

  expandBtn: {
    padding: 8,
  },

  studentsContainer: {
    padding: 12,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 17,
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  studentSub: {
    color: '#777',
    marginTop: 4,
    fontSize: 12,
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 80,
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  newButton: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: '#FFD700',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 8,
  },

  newButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
    marginLeft: 8,
    letterSpacing: 0.8,
  },
});