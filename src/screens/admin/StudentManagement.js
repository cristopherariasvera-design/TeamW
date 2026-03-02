import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  ActivityIndicator, RefreshControl, TextInput, Modal, 
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  SafeAreaView
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// CLIENTE ADMIN
const SUPABASE_URL = 'https://khrzhzeqdbizbmqdwebw.supabase.co';
const SUPABASE_SERVICE_KEY = 'TU_SERVICE_ROLE_KEY_AQUI'; 
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export default function StudentManagement({ route, navigation }) {
  const { coachId: filterCoachId, coachName } = route.params || {};

  // --- ESTADOS ---
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Estados del Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', level: 'Beginner', goal: '', coach_id: null 
  });

  const levels = [
    { id: 'Beginner', label: 'Beginner', icon: 'fitness-outline' },
    { id: 'Rookie', label: 'Rookie', icon: 'trophy-outline' },
    { id: 'Scaled', label: 'Scaled', icon: 'barbell-outline' },
    { id: 'RX', label: 'RX', icon: 'flame-outline' },
  ];

  // --- CARGA DE DATOS ---
  useFocusEffect(
    useCallback(() => {
      fetchStudents();
      fetchCoaches();
    }, [filterCoachId])
  );

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase.from('profiles').select('*').eq('role', 'alumno');
      if (filterCoachId) query = query.eq('coach_id', filterCoachId);
      
      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) throw error;
      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCoaches = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'coach')
      .eq('status', 'Active');
    setCoaches(data || []);
  };

  const handleSearch = (text) => {
    setSearch(text);
    const filtered = students.filter(s => 
      s.full_name.toLowerCase().includes(text.toLowerCase()) || 
      (s.email && s.email.toLowerCase().includes(text.toLowerCase()))
    );
    setFilteredStudents(filtered);
  };

  const checkIsExpired = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
      fetchStudents();
    } catch (e) {
      Alert.alert("Error", "No se pudo cambiar el estado.");
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setFormData({ name: '', email: '', password: '', level: 'Beginner', goal: '', coach_id: null });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setIsEditing(true);
    setSelectedId(item.id);
    setFormData({
      name: item.full_name,
      email: item.email,
      password: '*****', 
      level: item.level || 'Beginner',
      goal: item.goal || '',
      coach_id: item.coach_id
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const { name, email, password, level, goal, coach_id } = formData;
    if (!name || !coach_id || (!isEditing && (!email || !password))) {
      Alert.alert("Campos incompletos", "Por favor rellena todos los datos y selecciona un coach.");
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase.from('profiles').update({ full_name: name, level, goal, coach_id }).eq('id', selectedId);
        if (error) throw error;
        Alert.alert("Éxito", "Atleta actualizado.");
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        if (authData.user) {
          await supabase.from('profiles').update({ full_name: name, role: 'alumno', status: 'Active', level, goal, coach_id, box_city: 'Santiago' }).eq('id', authData.user.id);
          Alert.alert("Éxito", "Nuevo atleta registrado.");
        }
      }
      setModalVisible(false);
      fetchStudents();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      {/* HEADER PRINCIPAL */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" style={{ marginRight: 10 }} />
            <Text style={styles.title}>{coachName ? `Team ${coachName.split(' ')[0]}` : 'Atletas'}</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>{filteredStudents.length} atletas encontrados</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar atleta..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStudents} tintColor="#FFD700" />}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const isExpired = checkIsExpired(item.plan_end_date);
          const isActive = item.status === 'Active';
          return (
            <View style={[styles.card, !isActive && styles.cardInactive, isExpired && isActive && styles.cardExpired]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Planner', { student: item })}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, isExpired && isActive && {color: '#fff'}]}>{item.full_name}</Text>
                    <Text style={[styles.venceText, isExpired && isActive && {color: '#ffcccc'}]}>
                      {isExpired && isActive ? '⚠️ PLAN VENCIDO' : `📅 Vence: ${item.plan_end_date ? new Date(item.plan_end_date).toLocaleDateString() : 'Sin plan'}`}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? '#ADFF2F20' : '#444' }]}>
                    <Text style={[styles.statusText, { color: isActive ? '#ADFF2F' : '#999' }]}>{isActive ? 'ACTIVO' : 'INACTIVO'}</Text>
                  </View>
                </View>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}><Text style={styles.statLabel}>PESO</Text><Text style={styles.statValue}>{item.weight || '--'}kg</Text></View>
                  <View style={[styles.statBox, styles.statBorder]}><Text style={styles.statLabel}>NIVEL</Text><Text style={styles.statValue}>{item.level}</Text></View>
                  <View style={styles.statBox}><Text style={styles.statLabel}>ALTURA</Text><Text style={styles.statValue}>{item.height || '--'}cm</Text></View>
                </View>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}><Ionicons name="pencil" size={18} color="#FFD700" /></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleStatus(item.id, item.status)}>
                  <Ionicons name={isActive ? "person-remove-outline" : "person-add-outline"} size={20} color={isActive ? "#ff4444" : "#ADFF2F"} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* MODAL CON SCROLL CORREGIDO */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Editar Atleta' : 'Nuevo Atleta'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={32} color="#444" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={true} 
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
              >
                <Text style={styles.modalLabel}>DATOS DE ACCESO</Text>
                <TextInput 
                  placeholder="Nombre Completo" 
                  placeholderTextColor="#444" 
                  style={styles.modalInput} 
                  value={formData.name}
                  onChangeText={(t) => setFormData({...formData, name: t})} 
                />
                {!isEditing && (
                  <>
                    <TextInput 
                      placeholder="Email" 
                      placeholderTextColor="#444" 
                      autoCapitalize="none" 
                      keyboardType="email-address"
                      style={styles.modalInput} 
                      onChangeText={(t) => setFormData({...formData, email: t})} 
                    />
                    <TextInput 
                      placeholder="Contraseña" 
                      placeholderTextColor="#444" 
                      secureTextEntry 
                      style={styles.modalInput} 
                      onChangeText={(t) => setFormData({...formData, password: t})} 
                    />
                  </>
                )}

                <Text style={styles.modalLabel}>NIVEL TÉCNICO</Text>
                <View style={styles.levelGrid}>
                  {levels.map(l => (
                    <TouchableOpacity 
                      key={l.id} 
                      style={[styles.levelItem, formData.level === l.id && styles.levelActive]} 
                      onPress={() => setFormData({...formData, level: l.id})}
                    >
                      <Ionicons name={l.icon} size={16} color={formData.level === l.id ? '#000' : '#666'} />
                      <Text style={[styles.levelItemText, formData.level === l.id && {color: '#000'}]}>{l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>ASIGNAR COACH</Text>
                <View style={styles.coachGrid}>
                  {coaches.map(c => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={[styles.coachChip, formData.coach_id === c.id && styles.coachChipActive]} 
                      onPress={() => setFormData({...formData, coach_id: c.id})}
                    >
                      <Text style={{color: formData.coach_id === c.id ? '#000' : '#fff', fontSize: 12}}>{c.full_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>OBJETIVOS / NOTAS</Text>
                <TextInput 
                  placeholder="Ej: Bajar de peso, mejorar Snatch..." 
                  placeholderTextColor="#444" 
                  multiline
                  numberOfLines={3}
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} 
                  value={formData.goal}
                  onChangeText={(t) => setFormData({...formData, goal: t})} 
                />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{isEditing ? 'ACTUALIZAR' : 'CREAR ATLETA'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 60 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', fontSize: 12 },
  addButton: { backgroundColor: '#FFD700', width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 10 },
  card: { backgroundColor: '#0a0a0a', padding: 18, borderRadius: 24, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a', flexDirection: 'row' },
  cardInactive: { opacity: 0.4 },
  cardExpired: { backgroundColor: '#3b0000', borderColor: '#ff4444' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  studentName: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  venceText: { color: '#666', fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10 },
  statBox: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 'bold' },
  statValue: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cardActions: { marginLeft: 15, justifyContent: 'space-around', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 10 },
  actionBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderTopWidth: 2, borderTopColor: '#FFD700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modalLabel: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginTop: 15, marginBottom: 10 },
  modalInput: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelItem: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#222' },
  levelActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  levelItemText: { color: '#666', marginLeft: 8, fontSize: 11, fontWeight: 'bold' },
  coachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  coachChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  coachChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  saveBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 25 },
  saveBtnText: { color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }
});