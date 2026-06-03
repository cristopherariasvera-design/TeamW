import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';

export default function PlannerScreen({ route, navigation }) {
  const { studentId, studentName } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState('');
  const [numSessions, setNumSessions] = useState(3);

  useEffect(() => {
    if (startDate) {
      setEndDate(addDays(startDate, 27));
    }
  }, [startDate]);

  const addDays = (dateString, days) => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const getWeeksBetween = () => {
    if (!startDate || !endDate) return 4;

    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);

    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    return Math.max(1, Math.ceil(diffDays / 7));
  };

  const showSuccess = (message) => {
    if (Platform.OS === 'web') {
      window.alert(`Período guardado\n\n${message}`);
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Período guardado',
      message,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const showError = (message) => {
    if (Platform.OS === 'web') {
      window.alert(`Error\n\n${message}`);
      return;
    }

    Alert.alert('Error', message);
  };

  const planWeeks = getWeeksBetween();
  const totalSessions = numSessions * planWeeks;

  const handleSavePeriod = async () => {
    if (!studentId) {
      showError('No se encontró el alumno.');
      return;
    }

    if (!startDate || !endDate) {
      showError('Debes ingresar fecha de inicio y fecha de término.');
      return;
    }

    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);

    if (end < start) {
      showError('La fecha de término no puede ser menor a la fecha de inicio.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Sesión de Coach no encontrada');
      }

      const { error: periodError } = await supabase
        .from('student_plan_periods')
        .insert({
          student_id: studentId,
          coach_id: user.id,
          start_date: startDate,
          end_date: endDate,
          sessions_per_week: numSessions,
          weeks: planWeeks,
          total_sessions: totalSessions,
          status: 'Active',
        });

      if (periodError) {
        throw periodError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: 'Active',
          plan_start_date: startDate,
          plan_end_date: endDate,
          sessions_per_week: numSessions,
          plan_weeks: planWeeks,
        })
        .eq('id', studentId);

      if (profileError) {
        throw profileError;
      }

      showSuccess(
        `${studentName} queda activo desde ${startDate} hasta ${endDate}. Total esperado: ${totalSessions} WODs.`
      );
    } catch (error) {
      console.error('Error guardando período:', error);
      showError(error.message || 'No se pudo guardar el período.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollInside}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#FFD700"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Período del Plan
          </Text>

          <Text style={styles.subTitle}>
            Configurando planificación para {studentName}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            Sesiones por semana
          </Text>

          <View style={styles.sessionsRow}>
            {[2, 3, 4, 5, 6].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.sessionChip,
                  numSessions === num && styles.sessionChipActive,
                ]}
                onPress={() => setNumSessions(num)}
              >
                <Text
                  style={[
                    styles.sessionChipText,
                    numSessions === num && styles.sessionChipTextActive,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>
            Fecha de inicio
          </Text>

          <View style={styles.dateWrapper}>
            <MaterialCommunityIcons
              name="calendar-start"
              size={20}
              color="#FFD700"
              style={{ marginRight: 10 }}
            />

            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={webInputStyle}
              />
            ) : (
              <TextInput
                style={styles.mobileDateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#444"
              />
            )}
          </View>

          <Text style={styles.label}>
            Fecha de término
          </Text>

          <View style={styles.dateWrapper}>
            <MaterialCommunityIcons
              name="calendar-end"
              size={20}
              color="#FFD700"
              style={{ marginRight: 10 }}
            />

            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={webInputStyle}
              />
            ) : (
              <TextInput
                style={styles.mobileDateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#444"
              />
            )}
          </View>

          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                {numSessions}
              </Text>
              <Text style={styles.summaryLabel}>
                Veces por semana
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                {planWeeks}
              </Text>
              <Text style={styles.summaryLabel}>
                Semanas
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                {totalSessions}
              </Text>
              <Text style={styles.summaryLabel}>
                WODs esperados
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color="#FFD700"
            />

            <Text style={styles.infoText}>
              Esta pantalla solo guarda el período activo del alumno. Los WODs se cargarán después desde Calendario V2.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              loading && { opacity: 0.7 },
            ]}
            onPress={handleSavePeriod}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>
                  GUARDAR PERÍODO
                </Text>

                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color="#000"
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const webInputStyle = {
  backgroundColor: 'transparent',
  color: '#fff',
  border: 'none',
  fontSize: '16px',
  width: '100%',
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scrollInside: {
    padding: 20,
    paddingTop: 50,
  },

  header: {
    marginBottom: 25,
  },

  backBtn: {
    marginBottom: 10,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },

  subTitle: {
    color: '#666',
    fontSize: 14,
  },

  card: {
    backgroundColor: '#111',
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#222',
  },

  label: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  sessionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },

  sessionChip: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },

  sessionChipActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  sessionChipText: {
    color: '#666',
    fontWeight: 'bold',
  },

  sessionChipTextActive: {
    color: '#000',
  },

  dateWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 25,
  },

  mobileDateInput: {
    color: '#fff',
    flex: 1,
    fontSize: 16,
  },

  summaryBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  summaryVal: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
  },

  summaryLabel: {
    color: '#555',
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },

  divider: {
    width: 1,
    height: '100%',
    backgroundColor: '#222',
  },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 15,
    padding: 14,
    marginBottom: 20,
  },

  infoText: {
    color: '#888',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
    fontSize: 13,
  },

  primaryBtn: {
    backgroundColor: '#FFD700',
    padding: 20,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    marginRight: 10,
  },
});