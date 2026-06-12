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
import { generateStudentReport } from '../../services/reportService';

export default function CoachStudentsScreen({ navigation }) {
  const { profile } = useAuth();

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [generatingReportId, setGeneratingReportId] = useState(null);

  const sortStudents = (list) => {
    return [...list].sort((a, b) => {
      const aIsActive = a.status === 'Active';
      const bIsActive = b.status === 'Active';

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      return (a.full_name || '').localeCompare(b.full_name || '', 'es', {
        sensitivity: 'base',
      });
    });
  };

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchAllStudents();
      }
    }, [profile?.id])
  );

  useEffect(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      setFilteredStudents(sortStudents(students));
      return;
    }

    const filtered = students.filter((student) => {
      return (
        student.full_name?.toLowerCase().includes(normalized) ||
        student.email?.toLowerCase().includes(normalized) ||
        student.level?.toLowerCase().includes(normalized) ||
        student.box_city?.toLowerCase().includes(normalized)
      );
    });

    setFilteredStudents(sortStudents(filtered));
  }, [search, students]);

  const showMessage = (title, message) => {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const askConfirm = (title, message) => {
    if (typeof window !== 'undefined') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }

    return new Promise((resolve) => {
      Alert.alert(title, message, [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Confirmar',
          onPress: () => resolve(true),
        },
      ]);
    });
  };

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

      const sortedStudents = sortStudents(data || []);

      setStudents(sortedStudents);
      setFilteredStudents(sortedStudents);
    } catch (error) {
      console.error('Error cargando atletas:', error.message || error);
      showMessage('Error', 'No se pudieron cargar los atletas.');
    } finally {
      setLoading(false);
    }
  };

  const hasCompletePeriod = (student) => {
    return Boolean(
      student.plan_start_date &&
        student.plan_end_date &&
        student.sessions_per_week &&
        student.plan_weeks
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';

    const date = new Date(`${dateString}T12:00:00`);

    return date
      .toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace('.', '');
  };

  const getInitials = (name) => {
    if (!name) return '?';

    const parts = name.trim().split(' ').filter(Boolean);

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const getPeriodText = (student) => {
    if (!hasCompletePeriod(student)) {
      return 'Sin período configurado';
    }

    return `${formatDate(student.plan_start_date)} → ${formatDate(
      student.plan_end_date
    )}`;
  };

  const getPeriodSubText = (student) => {
    if (!hasCompletePeriod(student)) {
      return 'Configura fechas y sesiones por semana';
    }

    return `${student.sessions_per_week}x semana · ${student.plan_weeks} semanas`;
  };

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    const confirmed = await askConfirm(
      'Cambiar estado',
      `¿Quieres dejar este alumno como ${
        newStatus === 'Active' ? 'ACTIVO' : 'INACTIVO'
      }?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', studentId);

      if (error) throw error;

      setStudents((prev) =>
        sortStudents(
          prev.map((student) =>
            student.id === studentId
              ? { ...student, status: newStatus }
              : student
          )
        )
      );
    } catch (error) {
      console.error('Error actualizando estado:', error.message || error);
      showMessage('Error', 'No se pudo actualizar el estado.');
    }
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

  const handleGenerateReport = async (student) => {
    if (!student?.id) {
      showMessage('Error', 'No se encontró el ID del alumno.');
      return;
    }

    if (!hasCompletePeriod(student)) {
      showMessage(
        'Sin período configurado',
        'Primero debes configurar el período del alumno antes de generar el reporte.'
      );
      return;
    }

    if (!student.email) {
      showMessage(
        'Alumno sin correo',
        'Este alumno no tiene correo registrado. Actualiza su correo antes de enviar el reporte.'
      );
      return;
    }

    const confirmed = await askConfirm(
      'Enviar reporte',
      `¿Quieres generar y enviar el reporte Excel a?\n\n${student.email}`
    );

    if (!confirmed) return;

    try {
      setGeneratingReportId(student.id);

      const result = await generateStudentReport({
        studentId: student.id,
        periodStart: student.plan_start_date || null,
        periodEnd: student.plan_end_date || null,
        sendToEmail: student.email || null,
      });

      const baseMessage =
        result?.message || 'Reporte generado correctamente.';

      const emailInfo = result?.email_to
        ? `\n\nCorreo destino:\n${result.email_to}`
        : '\n\nCorreo destino:\nSin correo registrado';

      const emailStatus = result?.email_sent
        ? '\n\nEstado correo: enviado ✅'
        : result?.email_error
        ? `\n\nEstado correo: error ❌\n${result.email_error}`
        : '\n\nEstado correo: no enviado';

      showMessage(
        'Reporte TeamW',
        `${baseMessage}\n\nArchivo:\n${
          result.file_name || 'Sin nombre'
        }${emailInfo}${emailStatus}`
      );

      await fetchAllStudents();
    } catch (error) {
      console.error('Error generando reporte:', error.message || error);

      showMessage(
        'Error generando reporte',
        error.message || 'No se pudo generar o enviar el reporte Excel.'
      );
    } finally {
      setGeneratingReportId(null);
    }
  };

  const activeCount = students.filter(
    (student) => student.status === 'Active'
  ).length;

  const inactiveCount = students.filter(
    (student) => student.status !== 'Active'
  ).length;

  const withPeriodCount = students.filter((student) =>
    hasCompletePeriod(student)
  ).length;

  const renderSummary = () => {
    return (
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{students.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>

        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>Activos</Text>
        </View>

        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{inactiveCount}</Text>
          <Text style={styles.summaryLabel}>Inactivos</Text>
        </View>

        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{withPeriodCount}</Text>
          <Text style={styles.summaryLabel}>Con período</Text>
        </View>
      </View>
    );
  };

  const renderStudent = ({ item }) => {
    const isActive = item.status === 'Active';
    const hasPeriod = hasCompletePeriod(item);
    const isGeneratingReport = generatingReportId === item.id;

    return (
      <View style={[styles.card, !isActive && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.studentMain}
            onPress={() => goToStudentDetail(item)}
            activeOpacity={0.85}
          >
            <View style={[styles.avatar, !isActive && styles.avatarInactive]}>
              <Text style={styles.avatarText}>
                {getInitials(item.full_name)}
              </Text>
            </View>

            <View style={styles.studentInfo}>
              <Text
                style={[styles.nameText, !isActive && styles.nameTextInactive]}
                numberOfLines={1}
              >
                {item.full_name || 'Sin nombre'}
              </Text>

              <Text style={styles.metaText} numberOfLines={1}>
                {item.level || 'Sin nivel'} · {item.box_city || 'Sin ciudad'}
              </Text>

              {!!item.email && (
                <Text style={styles.emailText} numberOfLines={1}>
                  {item.email}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusPill,
              isActive ? styles.statusActive : styles.statusInactive,
            ]}
            onPress={() => toggleStatus(item.id, item.status)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? '#00ff88' : '#777' },
              ]}
            />

            <Text
              style={[
                styles.statusText,
                { color: isActive ? '#00ff88' : '#777' },
              ]}
            >
              {isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.periodBox,
            hasPeriod ? styles.periodOk : styles.periodWarning,
          ]}
        >
          <Ionicons
            name={hasPeriod ? 'calendar-outline' : 'alert-circle-outline'}
            size={16}
            color={hasPeriod ? '#FFD700' : '#FFB800'}
          />

          <View style={styles.periodTextContainer}>
            <Text
              style={[
                styles.periodTitle,
                !hasPeriod && styles.periodTitleWarning,
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

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => goToStudentDetail(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-outline" size={16} color="#DDD" />

            <Text style={styles.actionText}>
              Detalle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              hasPeriod ? styles.actionButtonOutline : styles.actionButtonPrimary,
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
                styles.actionText,
                hasPeriod ? styles.actionTextGold : styles.actionTextDark,
              ]}
            >
              Período
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              hasPeriod ? styles.reportButton : styles.reportButtonDisabled,
            ]}
            onPress={() => handleGenerateReport(item)}
            disabled={isGeneratingReport}
            activeOpacity={0.85}
          >
            {isGeneratingReport ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={hasPeriod ? '#000' : '#777'}
                />

                <Text
                  style={[
                    styles.actionText,
                    hasPeriod ? styles.actionTextDark : styles.actionTextDisabled,
                  ]}
                >
                  Reporte
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFD700" size="large" />
        <Text style={styles.loadingText}>Cargando atletas...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#FFD700" />

          <TextInput
            style={styles.searchInput}
            placeholder="Buscar atleta, correo, nivel o ciudad..."
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
          />

          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {renderSummary()}
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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

  loadingText: {
    color: '#777',
    marginTop: 12,
    fontWeight: '700',
  },

  topSection: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    backgroundColor: '#000',
  },

  searchContainer: {
    height: 44,
    flexDirection: 'row',
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },

  searchInput: {
    color: '#fff',
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '600',
    outlineStyle: 'none',
  },

  summaryRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },

  summaryChip: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C1C1C',
    paddingVertical: 9,
    alignItems: 'center',
  },

  summaryValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
  },

  summaryLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  list: {
    padding: 14,
    paddingBottom: 90,
  },

  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },

  cardInactive: {
    opacity: 0.58,
    borderColor: '#151515',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  avatarInactive: {
    backgroundColor: '#777',
  },

  avatarText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
  },

  studentInfo: {
    flex: 1,
  },

  nameText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '900',
  },

  nameTextInactive: {
    color: '#AAA',
  },

  metaText: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },

  emailText: {
    color: '#555',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },

  statusActive: {
    borderColor: '#00ff8844',
    backgroundColor: '#001a0e',
  },

  statusInactive: {
    borderColor: '#333',
    backgroundColor: '#0B0B0B',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  periodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
  },

  periodOk: {
    borderColor: '#222',
    backgroundColor: '#101010',
  },

  periodWarning: {
    borderColor: '#3A3200',
    backgroundColor: '#100D00',
  },

  periodTextContainer: {
    flex: 1,
    marginLeft: 8,
  },

  periodTitle: {
    color: '#EDEDED',
    fontSize: 11,
    fontWeight: '900',
  },

  periodTitleWarning: {
    color: '#FFD700',
  },

  periodSubText: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
  },

  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },

  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#242424',
  },

  actionButtonOutline: {
    borderColor: '#5A4B00',
    backgroundColor: '#111',
  },

  actionButtonPrimary: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  reportButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  reportButtonDisabled: {
    backgroundColor: '#111',
    borderColor: '#333',
  },

  actionText: {
    color: '#DDD',
    fontWeight: '900',
    fontSize: 11,
    marginLeft: 6,
    textTransform: 'uppercase',
  },

  actionTextGold: {
    color: '#FFD700',
  },

  actionTextDark: {
    color: '#000',
  },

  actionTextDisabled: {
    color: '#777',
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 80,
  },

  emptyText: {
    color: '#666',
    marginTop: 15,
    fontSize: 15,
    fontWeight: '700',
  },
});