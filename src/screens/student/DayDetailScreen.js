import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, Vibration, KeyboardAvoidingView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import CommentsModal from './CommentsModal';

export default function DayDetailScreen({ route, navigation }) {
  const { plan } = route.params;
  const { profile } = useAuth();
  
  // ESTADOS DEL PLAN
  const [isDone, setIsDone] = useState(plan.is_done);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [editedSections, setEditedSections] = useState([]);

  // ESTADOS DEL CRONÓMETRO PRO
  const [isActive, setIsActive] = useState(false);
  const [timerMode, setTimerMode] = useState('FOR TIME'); 
  const [seconds, setSeconds] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(10); 
  const [status, setStatus] = useState('READY'); 
  const [round, setRound] = useState(1);

  useEffect(() => {
    let rawSections = plan.sections;
    if (typeof rawSections === 'string') {
      try { rawSections = JSON.parse(rawSections); } 
      catch (e) { rawSections = []; }
    }
    setEditedSections(Array.isArray(rawSections) ? rawSections : []);
  }, [plan]);

  // Lógica de formateo de fecha (Restaurado)
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', day: 'numeric', month: 'short' 
    }).toUpperCase();
  };

  // Lógica principal del Timer
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        handleTimerTick();
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, status, timerMode]);

  const handleTimerTick = () => {
    if (timerMode === 'FOR TIME') {
      setSeconds(s => s + 1);
    } 
    else if (timerMode === 'AMRAP') {
      if (seconds > 0) setSeconds(s => s - 1);
      else {
        setIsActive(false);
        Alert.alert("¡Tiempo!", "AMRAP Finalizado");
      }
    } 
    else if (timerMode === 'EMOM') {
      if (seconds < 59) setSeconds(s => s + 1);
      else {
        setSeconds(0);
        setRound(r => r + 1);
        vibrateDevice();
      }
    } 
    else if (timerMode === 'TABATA') {
      if (status === 'WORK') {
        if (seconds < 19) setSeconds(s => s + 1);
        else {
          setStatus('REST');
          setSeconds(0);
          vibrateDevice();
        }
      } else {
        if (seconds < 9) setSeconds(s => s + 1);
        else {
          setStatus('WORK');
          setSeconds(0);
          setRound(r => r + 1);
          vibrateDevice();
        }
      }
    }
  };

  const vibrateDevice = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(500);
  };

  const startTimer = () => {
    if (timerMode === 'AMRAP') setSeconds(targetMinutes * 60);
    if (timerMode === 'TABATA') setStatus('WORK');
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
    const s = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleDone = async () => {
    try {
      const newStatus = !isDone;
      const { error } = await supabase.from('plans').update({ is_done: newStatus }).eq('id', plan.id);
      if (error) throw error;
      setIsDone(newStatus);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar');
    }
  };

  const getTimerColor = () => {
    if (!isActive) return '#fff';
    if (timerMode === 'TABATA' && status === 'REST') return '#FF4444';
    if (timerMode === 'TABATA' && status === 'WORK') return '#4CAF50';
    return '#FFD700';
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      {/* --- HEADER RESTAURADO --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>{formatDate(plan.date)}</Text>
          <Text style={styles.headerTitle}>{plan.title || 'Entrenamiento'}</Text>
        </View>

        <TouchableOpacity onPress={toggleDone} style={styles.iconCircle}>
          <Ionicons name={isDone ? "checkmark-circle" : "ellipse-outline"} size={28} color={isDone ? "#FFD700" : "#444"} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* TIMER CARD PRO */}
        <View style={[styles.timerCard, { borderColor: getTimerColor() }]}>
          <View style={styles.modeSelector}>
            {['FOR TIME', 'AMRAP', 'EMOM', 'TABATA'].map(m => (
              <TouchableOpacity key={m} onPress={() => { setTimerMode(m); resetTimer(); }} 
                style={[styles.modeBtn, timerMode === m && styles.modeBtnActive]}>
                <Text style={[styles.modeBtnText, timerMode === m && styles.modeBtnTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isActive && (timerMode === 'AMRAP' || timerMode === 'EMOM') && (
            <View style={styles.configRow}>
              <TouchableOpacity onPress={() => setTargetMinutes(m => Math.max(1, m - 1))}>
                <Ionicons name="remove-circle-outline" size={24} color="#FFD700" />
              </TouchableOpacity>
              <Text style={styles.configText}>{targetMinutes} MIN</Text>
              <TouchableOpacity onPress={() => setTargetMinutes(m => m + 1)}>
                <Ionicons name="add-circle-outline" size={24} color="#FFD700" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.timerText, { color: getTimerColor() }]}>{formatTime(seconds)}</Text>
          
          { (timerMode === 'EMOM' || timerMode === 'TABATA') && (
            <Text style={styles.roundText}>RONDA {round}</Text>
          )}

          <View style={styles.timerControls}>
            <TouchableOpacity style={styles.mainPlayBtn} onPress={() => isActive ? setIsActive(false) : startTimer()}>
              <Ionicons name={isActive ? "pause" : "play"} size={32} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={resetTimer}>
              <Ionicons name="refresh" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTENIDO DEL PLAN */}
        <View style={styles.planContent}>
          {editedSections.map((section, index) => (
            <View key={index} style={styles.sectionCard}>
              <View style={styles.sideIndicator} />
              <View style={styles.sectionTextContent}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
                <Text style={styles.sectionBody}>{section.content}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.commentsButton} onPress={() => setCommentsVisible(true)}>
            <View style={styles.commentIconBg}>
              <Ionicons name="chatbubbles" size={18} color="#000" />
            </View>
            <Text style={styles.commentsButtonText}>Feedback del entrenamiento</Text>
            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>
        </View>

      </ScrollView>
      <CommentsModal visible={commentsVisible} onClose={() => setCommentsVisible(false)} planId={plan.id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222'
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerDate: { fontSize: 10, color: '#FFD700', fontWeight: '900', letterSpacing: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 2 },
  
  content: { flex: 1 },
  timerCard: { 
    margin: 20, padding: 20, backgroundColor: '#0A0A0A', borderRadius: 30, 
    borderWidth: 2, alignItems: 'center' 
  },
  modeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, width: '100%' },
  modeBtn: { padding: 8, borderRadius: 10, backgroundColor: '#111', flex: 1, marginHorizontal: 2, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#FFD700' },
  modeBtnText: { color: '#555', fontSize: 10, fontWeight: 'bold' },
  modeBtnTextActive: { color: '#000' },
  
  configRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  configText: { color: '#fff', marginHorizontal: 15, fontWeight: 'bold' },

  timerText: { fontSize: 72, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  roundText: { color: '#666', fontSize: 14, fontWeight: 'bold', marginTop: -10, marginBottom: 10 },
  
  timerControls: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  mainPlayBtn: { backgroundColor: '#FFD700', width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  resetBtn: { backgroundColor: '#1a1a1a', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

  planContent: { padding: 20 },
  sectionCard: { 
    flexDirection: 'row', backgroundColor: '#0A0A0A', borderRadius: 15, 
    marginBottom: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#111' 
  },
  sideIndicator: { width: 4, backgroundColor: '#FFD700' },
  sectionTextContent: { padding: 20, flex: 1 },
  sectionTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 14, marginBottom: 8, textTransform: 'uppercase' },
  sectionBody: { color: '#eee', fontSize: 15, lineHeight: 22 },

  commentsButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
    padding: 12, borderRadius: 20, marginTop: 20, borderWidth: 1, borderColor: '#222'
  },
  commentIconBg: { backgroundColor: '#FFD700', padding: 8, borderRadius: 12, marginRight: 12 },
  commentsButtonText: { color: '#fff', flex: 1, fontWeight: '600', fontSize: 14 },
});