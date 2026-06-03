import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachStudentsScreen({ navigation }) {
  const { profile } = useAuth();

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchAllStudents();
      }
    }, [profile?.id])
  );

  useEffect(() => {
    const filtered = students.filter((student) =>
      student.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    setFilteredStudents(filtered);
  }, [search, students]);

  const fetchAllStudents = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          level,
          status,
          coach_id,
          box_city,
          plan_start_date,
          plan_end_date,
          sessions_per_week,
          plan_weeks
        `)
        .eq('role', 'alumno')
        .eq('coach_id', profile.id)
        .order('full_name', { ascending: true });

      if (error) throw error;

      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error('Error cargando atletas:', error.message);
      Alert.alert('Error', 'No se pudieron cargar los atletas.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    Alert.alert(
      'Cambiar estado',
      `¿Quieres dejar este alumno como ${
        newStatus === 'Active' ? 'ACTIVO' : 'INACTIVO'
      }?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', studentId);

              if (error) throw error;

              setStudents((prev) =>
                prev.map((student) =>
                  student.id === studentId
                    ? { ...student, status: newStatus }
                    : student
                )
              );
            } catch (error) {
              console.error('Error actualizando estado:', error.message);
              Alert.alert('Error', 'No se pudo actualizar el estado.');
            }
          },
        },
      ]
    );
  };

  const goToPlanner = (student) => {
    navigation.navigate('PlannerScreen', {
      studentId: student.id,
      studentName: student.full_name,
    });
  };

  const goToStudentDetail = (student) => {
    navigation.navigate('StudentDetail', {
      student,
    });
  };

  const hasCompletePeriod = (student) => {
    return Boolean(
      student.plan_start_date &&
        student.plan_end_date &&
        student.sessions_per_week &&
        student.plan_weeks
    );
  };

  const getPeriodText = (student) => {
    if (!hasCompletePeriod(student)) {
      return 'Sin período configurado';
    }

    return `Plan: ${student.plan_start_date} → ${student.plan_end_date}`;
  };

  const getPeriodSubText = (student) => {
    if (!hasCompletePeriod(student)) {
      return 'Debe configurar fecha inicio, término y veces por semana';
    }

    return `${student.sessions_per_week}x semana · ${student.plan_weeks} semanas`;
  };

  const activeCount = students.filter(
    (student) => student.status === 'Active'
  ).length;

  const withPeriodCount = students.filter((student) =>
    hasCompletePeriod(student)
  ).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={19} color="#FFD700" />

          <TextInput
            style={styles.searchInput}
            placeholder="Buscar atleta..."
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            Total: {students.length}
          </Text>

          <View style={styles.statsDivider} />

          <Text style={styles.statsText}>
            Activos: {activeCount}
          </Text>

          <View style={styles.statsDivider} />

          <Text style={styles.statsText}>
            Con período: {withPeriodCount}
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isActive = item.status === 'Active';
          const hasPeriod = hasCompletePeriod(item);

          return (
            <View style={styles.row}>
              <View style={styles.topRow}>
                <TouchableOpacity
                  style={styles.infoCol}
                  onPress={() => goToStudentDetail(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nameText} numberOfLines={1}>
                    {item.full_name}
                  </Text>

                  <Text style={styles.levelText}>
                    {item.level || 'Sin nivel'} · {item.box_city || 'Sin ciudad'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusToggle,
                    isActive ? styles.statusActive : styles.statusInactive,
                  ]}
                  onPress={() => toggleStatus(item.id, item.status)}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isActive ? '#FFD700' : '#666' },
                    ]}
                  />

                  <Text
                    style={[
                      styles.statusLabel,
                      { color: isActive ? '#FFD700' : '#666' },
                    ]}
                  >
                    {isActive ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.periodBox,
                  hasPeriod ? styles.periodBoxActive : styles.periodBoxWarning,
                ]}
              >
                <Ionicons
                  name={hasPeriod ? 'calendar-outline' : 'alert-circle-outline'}
                  size={15}
                  color={hasPeriod ? '#FFD700' : '#FFB800'}
                />

                <View style={styles.periodTextBox}>
                  <Text
                    style={[
                      styles.periodText,
                      !hasPeriod && styles.periodTextWarning,
                    ]}
                    numberOfLines={1}
                  >
                    {getPeriodText(item)}
                  </Text>

                  <Text style={styles.periodSubText} numberOfLines={1}>
                    {getPeriodSubText(item)}
                  </Text>
                </View>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => goToStudentDetail(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="eye-outline" size={16} color="#BBB" />

                  <Text style={styles.secondaryBtnText}>
                    Ver detalle
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    !hasPeriod && styles.primaryBtnHighlight,
                  ]}
                  onPress={() => goToPlanner(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={hasPeriod ? '#FFD700' : '#000'}
                  />

                  <Text
                    style={[
                      styles.primaryBtnText,
                      !hasPeriod && styles.primaryBtnTextHighlight,
                    ]}
                  >
                    Configurar período
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={52} color="#333" />

            <Text style={styles.emptyText}>
              No se encontraron atletas.
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

  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchSection: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },

  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#282828',
  },

  searchInput: {
    color: '#fff',
    height: 46,
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
  },

  statsRow: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  statsText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
  },

  statsDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    marginHorizontal: 8,
  },

  list: {
    padding: 14,
    paddingTop: 20,
    paddingBottom: 90,
  },

  row: {
    backgroundColor: '#0B0B0B',
    padding: 13,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1B1B1B',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoCol: {
    flex: 1,
    paddingRight: 12,
  },

  nameText: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '900',
  },

  levelText: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },

  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
  },

  statusActive: {
    borderColor: '#5A4B00',
    backgroundColor: '#111',
  },

  statusInactive: {
    borderColor: '#333',
    backgroundColor: '#0B0B0B',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  statusLabel: {
    fontSize: 9,
    fontWeight: '900',
  },

  periodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  periodBoxActive: {
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },

  periodBoxWarning: {
    borderColor: '#3A3200',
    backgroundColor: '#100D00',
  },

  periodTextBox: {
    flex: 1,
    marginLeft: 8,
  },

  periodText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '900',
  },

  periodTextWarning: {
    color: '#FFD700',
  },

  periodSubText: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },

  buttonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },

  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  secondaryBtnText: {
    color: '#BBB',
    fontWeight: '800',
    fontSize: 11,
    marginLeft: 6,
  },

  primaryBtn: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  primaryBtnHighlight: {
    backgroundColor: '#E6C200',
    borderColor: '#E6C200',
  },

  primaryBtnText: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 11,
    marginLeft: 6,
  },

  primaryBtnTextHighlight: {
    color: '#000',
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
});