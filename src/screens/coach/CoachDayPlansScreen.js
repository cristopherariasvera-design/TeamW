import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDayPlansScreen({ route, navigation }) {
  const { profile } = useAuth();

  const {
    date,
    holidayName = null,
  } = route.params;

  const [loading, setLoading] = useState(true);
  const [planGroups, setPlanGroups] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id && date) {
        loadPlansForDay();
      }
    }, [profile?.id, date])
  );

  const loadPlansForDay = async () => {
    try {
      setLoading(true);

      const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select(`
          id,
          student_id,
          coach_id,
          date,
          title,
          warmup,
          work1,
          work2,
          wod,
          cooldown,
          video_url,
          is_done,
          week_number,
          month,
          year,
          sections,
          blocks,
          end_date,
          day_name
        `)
        .eq('coach_id', profile.id)
        .eq('date', date)
        .order('title', { ascending: true });

      if (plansError) throw plansError;

      const studentIds = [
        ...new Set(
          (plans || [])
            .map((plan) => plan.student_id)
            .filter(Boolean)
        ),
      ];

      let studentsMap = {};

      if (studentIds.length > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select('id, full_name, level, plan_end_date')
          .in('id', studentIds);

        if (studentsError) throw studentsError;

        studentsMap = (students || []).reduce((acc, student) => {
          acc[student.id] = student;
          return acc;
        }, {});
      }

      const grouped = {};

      (plans || []).forEach((plan) => {
        const groupKey = plan.title || 'Sin título';

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            title: groupKey,
            plans: [],
          };
        }

        grouped[groupKey].plans.push({
          ...plan,
          student: studentsMap[plan.student_id] || null,
        });
      });

      setPlanGroups(Object.values(grouped));
    } catch (error) {
      console.error('Error cargando planes del día:', error.message);

      Alert.alert(
        'Error',
        'No se pudieron cargar los planes de este día.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (title) => {
    setExpandedGroup((current) => (
      current === title ? null : title
    ));
  };

  const handleOpenStudentPlan = (plan) => {
    navigation.navigate('DayDetail', {
      plan,
      date,
    });
  };

  const handleNewWod = () => {
    navigation.navigate('DayDetail', {
      date,
      holidayName,
      mode: 'create-multiple',
      plan: {
        id: null,
        title: '',
        sections: [],
        blocks: [],
        date,
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBox}>
          <Text style={styles.label}>
            PLANES DEL DÍA
          </Text>

          <Text style={styles.title}>
            {date}
          </Text>

          {holidayName && (
            <View style={styles.holidayBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color="#FF4D4D"
              />

              <View style={styles.holidayTextBox}>
                <Text style={styles.holidayTitle}>
                  FERIADO
                </Text>

                <Text style={styles.holidayText}>
                  {holidayName}
                </Text>
              </View>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            color="#FFD700"
            size="large"
            style={{ marginTop: 50 }}
          />
        ) : planGroups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="calendar-outline"
              size={60}
              color="#333"
            />

            <Text style={styles.emptyTitle}>
              No hay WODs creados
            </Text>

            <Text style={styles.emptyText}>
              Crea un WOD para este día y asígnalo a uno o varios alumnos.
            </Text>
          </View>
        ) : (
          planGroups.map((group) => {
            const isExpanded = expandedGroup === group.title;

            return (
              <View
                key={group.title}
                style={styles.groupCard}
              >
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => toggleGroup(group.title)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>
                      🔥 {group.title}
                    </Text>

                    <Text style={styles.groupSubtitle}>
                      {group.plans.length} alumno{group.plans.length === 1 ? '' : 's'} asignado{group.plans.length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#FFD700"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.studentsList}>
                    {group.plans.map((plan) => (
                      <TouchableOpacity
                        key={plan.id}
                        style={styles.studentRow}
                        onPress={() => handleOpenStudentPlan(plan)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {plan.student?.full_name?.charAt(0) || '?'}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName}>
                            {plan.student?.full_name || 'Alumno sin nombre'}
                          </Text>

                          <Text style={styles.studentSub}>
                            {plan.student?.level || 'Sin nivel'} · Tocar para editar
                          </Text>
                        </View>

                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#FFD700"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newButton}
          onPress={handleNewWod}
          activeOpacity={0.85}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scroll: {
    padding: 20,
    paddingBottom: 30,
  },

  headerBox: {
    marginBottom: 20,
  },

  label: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  title: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
  },

  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#170707',
    borderWidth: 1,
    borderColor: '#FF4D4D',
    borderRadius: 14,
    padding: 14,
    marginTop: 15,
  },

  holidayTextBox: {
    marginLeft: 10,
    flex: 1,
  },

  holidayTitle: {
    color: '#FF4D4D',
    fontWeight: '900',
    fontSize: 12,
  },

  holidayText: {
    color: '#FF9B9B',
    marginTop: 3,
    fontSize: 13,
  },

  groupCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },

  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  groupTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  groupSubtitle: {
    color: '#888',
    marginTop: 5,
    fontSize: 13,
  },

  studentsList: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    padding: 10,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },

  studentName: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  studentSub: {
    color: '#777',
    marginTop: 3,
    fontSize: 12,
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 70,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 15,
  },

  emptyText: {
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    padding: 20,
  },

  newButton: {
    backgroundColor: '#FFD700',
    borderRadius: 15,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  newButtonText: {
    color: '#000',
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 1,
  },
});