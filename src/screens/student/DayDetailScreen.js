import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Vibration,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import CommentsModal from './CommentsModal';

export default function DayDetailScreen({ route, navigation }) {
  const { plan = {} } = route.params || {};

  const [isDone, setIsDone] = useState(Boolean(plan.is_done));
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [editedSections, setEditedSections] = useState([]);
  const [savingDone, setSavingDone] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [timerMode, setTimerMode] = useState('FOR TIME');
  const [seconds, setSeconds] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(10);
  const [status, setStatus] = useState('READY');
  const [round, setRound] = useState(1);

  useEffect(() => {
    let rawSections = plan.sections;

    if (typeof rawSections === 'string') {
      try {
        rawSections = JSON.parse(rawSections);
      } catch {
        rawSections = [];
      }
    }

    setEditedSections(Array.isArray(rawSections) ? rawSections : []);
    setIsDone(Boolean(plan.is_done));
  }, [plan]);

  useEffect(() => {
    let interval = null;

    if (isActive) {
      interval = setInterval(() => {
        handleTimerTick();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, status, timerMode]);

  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(`${dateString}T12:00:00`);

    return date
      .toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
      .replace('.', '')
      .toUpperCase();
  };

  const handleTimerTick = () => {
    if (timerMode === 'FOR TIME') {
      setSeconds((current) => current + 1);
      return;
    }

    if (timerMode === 'AMRAP') {
      if (seconds > 0) {
        setSeconds((current) => current - 1);
      } else {
        setIsActive(false);
        Alert.alert('¡Tiempo!', 'AMRAP finalizado');
      }

      return;
    }

    if (timerMode === 'EMOM') {
      if (seconds < 59) {
        setSeconds((current) => current + 1);
      } else {
        setSeconds(0);
        setRound((current) => current + 1);
        vibrateDevice();
      }

      return;
    }

    if (timerMode === 'TABATA') {
      if (status === 'WORK') {
        if (seconds < 19) {
          setSeconds((current) => current + 1);
        } else {
          setStatus('REST');
          setSeconds(0);
          vibrateDevice();
        }
      } else {
        if (seconds < 9) {
          setSeconds((current) => current + 1);
        } else {
          setStatus('WORK');
          setSeconds(0);
          setRound((current) => current + 1);
          vibrateDevice();
        }
      }
    }
  };

  const vibrateDevice = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(500);
    }
  };

  const startTimer = () => {
    if (timerMode === 'AMRAP' && seconds === 0) {
      setSeconds(targetMinutes * 60);
    }

    if (timerMode === 'TABATA' && status === 'READY') {
      setStatus('WORK');
    }

    setIsActive(true);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(0);
    setRound(1);
    setStatus('READY');
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const sec = secs % 60;

    return `${mins < 10 ? '0' : ''}${mins}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const toggleDone = async () => {
    if (!plan?.id || savingDone) return;

    try {
      setSavingDone(true);

      const newStatus = !isDone;

      const { error } = await supabase
        .from('plans')
        .update({
          is_done: newStatus,
        })
        .eq('id', plan.id);

      if (error) throw error;

      setIsDone(newStatus);
    } catch (error) {
      console.error('Error actualizando WOD:', error.message || error);
      Alert.alert('Error', 'No se pudo actualizar el estado del WOD.');
    } finally {
      setSavingDone(false);
    }
  };

  const getTimerColor = () => {
    if (!isActive) return '#fff';
    if (timerMode === 'TABATA' && status === 'REST') return '#FF4444';
    if (timerMode === 'TABATA' && status === 'WORK') return '#4CAF50';

    return '#FFD700';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconCircle}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>
            {formatDate(plan.date)}
          </Text>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {plan.title || 'Entrenamiento'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={toggleDone}
          style={[
            styles.iconCircle,
            isDone && styles.iconCircleDone,
          ]}
          activeOpacity={0.8}
          disabled={savingDone}
        >
          <Ionicons
            name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={isDone ? '#00ff88' : '#444'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>
              ESTADO DEL WOD
            </Text>

            <Text
              style={[
                styles.statusText,
                isDone && styles.statusTextDone,
              ]}
            >
              {isDone ? 'Completado' : 'Pendiente'}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              isDone && styles.statusPillDone,
            ]}
          >
            <Ionicons
              name={isDone ? 'checkmark-circle' : 'time-outline'}
              size={15}
              color={isDone ? '#000' : '#FFD700'}
            />

            <Text
              style={[
                styles.statusPillText,
                isDone && styles.statusPillTextDone,
              ]}
            >
              {isDone ? 'HECHO' : 'POR HACER'}
            </Text>
          </View>
        </View>

        <View style={[styles.timerCard, { borderColor: getTimerColor() }]}>
          <View style={styles.modeSelector}>
            {['FOR TIME', 'AMRAP', 'EMOM', 'TABATA'].map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setTimerMode(mode);
                  resetTimer();
                }}
                style={[
                  styles.modeBtn,
                  timerMode === mode && styles.modeBtnActive,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    timerMode === mode && styles.modeBtnTextActive,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isActive && (timerMode === 'AMRAP' || timerMode === 'EMOM') && (
            <View style={styles.configRow}>
              <TouchableOpacity
                onPress={() =>
                  setTargetMinutes((current) => Math.max(1, current - 1))
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={24}
                  color="#FFD700"
                />
              </TouchableOpacity>

              <Text style={styles.configText}>
                {targetMinutes} MIN
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setTargetMinutes((current) => current + 1)
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color="#FFD700"
                />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.timerText, { color: getTimerColor() }]}>
            {formatTime(seconds)}
          </Text>

          {(timerMode === 'EMOM' || timerMode === 'TABATA') && (
            <Text style={styles.roundText}>
              RONDA {round}
            </Text>
          )}

          <View style={styles.timerControls}>
            <TouchableOpacity
              style={styles.mainPlayBtn}
              onPress={() => (isActive ? setIsActive(false) : startTimer())}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isActive ? 'pause' : 'play'}
                size={32}
                color="#000"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={resetTimer}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.planContent}>
          {editedSections.length === 0 ? (
            <View style={styles.emptySections}>
              <Ionicons
                name="document-text-outline"
                size={42}
                color="#333"
              />

              <Text style={styles.emptySectionsText}>
                Este WOD no tiene bloques cargados.
              </Text>
            </View>
          ) : (
            editedSections.map((section, index) => (
              <View key={`${section.name}-${index}`} style={styles.sectionCard}>
                <View style={styles.sideIndicator} />

                <View style={styles.sectionTextContent}>
                  <Text style={styles.sectionTitle}>
                    {section.name || `Bloque ${index + 1}`}
                  </Text>

                  <Text style={styles.sectionBody}>
                    {section.content || 'Sin contenido'}
                  </Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[
              styles.completeButton,
              isDone && styles.completeButtonDone,
            ]}
            onPress={toggleDone}
            activeOpacity={0.85}
            disabled={savingDone}
          >
            <Ionicons
              name={isDone ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={22}
              color={isDone ? '#000' : '#FFD700'}
            />

            <Text
              style={[
                styles.completeButtonText,
                isDone && styles.completeButtonTextDone,
              ]}
            >
              {isDone ? 'Entrenamiento completado' : 'Marcar como completado'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.commentsButton}
            onPress={() => setCommentsVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.commentIconBg}>
              <Ionicons name="chatbubbles" size={18} color="#000" />
            </View>

            <Text style={styles.commentsButtonText}>
              Feedback del entrenamiento
            </Text>

            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CommentsModal
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        planId={plan.id}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },

  iconCircleDone: {
    borderColor: '#00ff8844',
    backgroundColor: '#001B10',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  headerDate: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },

  content: {
    flex: 1,
  },

  statusCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#171717',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  statusText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  statusTextDone: {
    color: '#00ff88',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3200',
    backgroundColor: '#151300',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusPillDone: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },

  statusPillText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 5,
  },

  statusPillTextDone: {
    color: '#000',
  },

  timerCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#0A0A0A',
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
  },

  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
  },

  modeBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#111',
    flex: 1,
    marginHorizontal: 2,
    alignItems: 'center',
  },

  modeBtnActive: {
    backgroundColor: '#FFD700',
  },

  modeBtnText: {
    color: '#555',
    fontSize: 10,
    fontWeight: 'bold',
  },

  modeBtnTextActive: {
    color: '#000',
  },

  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  configText: {
    color: '#fff',
    marginHorizontal: 15,
    fontWeight: 'bold',
  },

  timerText: {
    fontSize: 72,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  roundText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -10,
    marginBottom: 10,
  },

  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },

  mainPlayBtn: {
    backgroundColor: '#FFD700',
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },

  resetBtn: {
    backgroundColor: '#1a1a1a',
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },

  planContent: {
    padding: 20,
    paddingTop: 0,
  },

  sectionCard: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111',
  },

  sideIndicator: {
    width: 4,
    backgroundColor: '#FFD700',
  },

  sectionTextContent: {
    padding: 20,
    flex: 1,
  },

  sectionTitle: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  sectionBody: {
    color: '#eee',
    fontSize: 15,
    lineHeight: 22,
  },

  emptySections: {
    backgroundColor: '#080808',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#151515',
    padding: 24,
    alignItems: 'center',
    marginBottom: 15,
  },

  emptySectionsText: {
    color: '#666',
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
  },

  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 15,
    borderRadius: 18,
    marginTop: 5,
  },

  completeButtonDone: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },

  completeButtonText: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },

  completeButtonTextDone: {
    color: '#000',
  },

  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#222',
  },

  commentIconBg: {
    backgroundColor: '#FFD700',
    padding: 8,
    borderRadius: 12,
    marginRight: 12,
  },

  commentsButtonText: {
    color: '#fff',
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
});