import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  Platform, TextInput, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LEVELS = ['Beginner', 'Rookie', 'Scaled', 'Intermediate', 'Advanced', 'RX'];

// ─── Hook: stats reales desde Supabase ───────────────────────────────────────

function useStudentStats(studentId) {
  const [stats, setStats] = useState({ sessions: 0, completed: 0, attendance: 0, loading: true });

  useEffect(() => {
    if (!studentId) return;
    const fetch = async () => {
      try {
        // Total sesiones asignadas
        const { count: total } = await supabase
          .from('plans')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId);

        // Sesiones completadas
        const { count: done } = await supabase
          .from('plans')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('is_done', true);

        const attendance = total > 0 ? Math.round((done / total) * 100) : 0;
        setStats({ sessions: total || 0, completed: done || 0, attendance, loading: false });
      } catch (e) {
        console.error('useStudentStats:', e);
        setStats(s => ({ ...s, loading: false }));
      }
    };
    fetch();
  }, [studentId]);

  return stats;
}

// ─── Componente: Fila de info (solo lectura) ──────────────────────────────────

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconBox}>
        <Ionicons name={icon} size={16} color="#FFD700" />
      </View>
      <View style={infoStyles.texts}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#0f0f0f', gap: 14 },
  iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFD70015', justifyContent: 'center', alignItems: 'center' },
  texts: { flex: 1 },
  label: { color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  value: { color: '#ddd', fontSize: 14, fontWeight: '500', marginTop: 1 },
});

// ─── Componente: Input editable ───────────────────────────────────────────────

function EditField({ icon, label, value, onChangeText, keyboardType = 'default', placeholder, multiline }) {
  return (
    <View style={editStyles.field}>
      <View style={editStyles.iconBox}>
        <Ionicons name={icon} size={15} color="#FFD700" />
      </View>
      <View style={editStyles.inputWrapper}>
        <Text style={editStyles.label}>{label}</Text>
        <TextInput
          style={[editStyles.input, multiline && { height: 72, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor="#333"
          keyboardType={keyboardType}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

const editStyles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f0f0f', gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFD70015', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  inputWrapper: { flex: 1 },
  label: { color: '#444', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  input: { backgroundColor: '#111', color: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#1e1e1e' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function StudentProfileScreen() {
  const { signOut, profile, setProfile } = useAuth();
  const stats = useStudentStats(profile?.id);

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campos editables
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    weight:    profile?.weight?.toString() || '',
    height:    profile?.height?.toString() || '',
    birth_date: profile?.birth_date || '',
    goal:      profile?.goal || '',
    injuries:  profile?.injuries || '',
    level:     profile?.level || 'Beginner',
  });

  const setField = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleEdit = () => setIsEditing(true);

  const handleCancel = () => {
    setForm({
      full_name:  profile?.full_name || '',
      weight:     profile?.weight?.toString() || '',
      height:     profile?.height?.toString() || '',
      birth_date: profile?.birth_date || '',
      goal:       profile?.goal || '',
      injuries:   profile?.injuries || '',
      level:      profile?.level || 'Beginner',
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío');
    setLoading(true);
    try {
      const updates = {
        full_name:  form.full_name.trim(),
        weight:     form.weight ? parseFloat(form.weight) : null,
        height:     form.height ? parseFloat(form.height) : null,
        birth_date: form.birth_date || null,
        goal:       form.goal.trim() || null,
        injuries:   form.injuries.trim() || null,
        level:      form.level,
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) throw error;

      if (setProfile) setProfile({ ...profile, ...updates });
      setIsEditing(false);
      Alert.alert('✅ Perfil actualizado');
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const doLogout = async () => { try { await signOut(); } catch (e) { console.error(e); } };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión en Team W?')) doLogout();
    } else {
      Alert.alert('Cerrar Sesión', '¿Quieres salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: doLogout, style: 'destructive' },
      ]);
    }
  };

  const levelColor = {
    Beginner: '#888', Rookie: '#aaa', Scaled: '#00aaff',
    Intermediate: '#00ff88', Advanced: '#ff8800', RX: '#FFD700',
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── HEADER ── */}
        <View style={styles.header}>
          {/* Avatar con inicial */}
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(form.full_name || profile?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{profile?.full_name || 'Atleta'}</Text>
          <Text style={styles.email}>{profile?.email || ''}</Text>

          {/* Badge nivel */}
          <View style={[styles.levelBadge, { borderColor: levelColor[profile?.level] || '#333' }]}>
            <View style={[styles.levelDot, { backgroundColor: levelColor[profile?.level] || '#333' }]} />
            <Text style={[styles.levelText, { color: levelColor[profile?.level] || '#888' }]}>
              {profile?.level || 'Beginner'}
            </Text>
          </View>

          {/* Plan vence */}
          {profile?.plan_end_date && (
            <View style={[
              styles.planBadge,
              new Date(profile.plan_end_date) < new Date() && styles.planBadgeExpired
            ]}>
              <Ionicons
                name="calendar-outline"
                size={11}
                color={new Date(profile.plan_end_date) < new Date() ? '#ff4444' : '#aaa'}
              />
              <Text style={[
                styles.planText,
                new Date(profile.plan_end_date) < new Date() && { color: '#ff4444' }
              ]}>
                {new Date(profile.plan_end_date) < new Date()
                  ? `Plan vencido · ${fmtDate(profile.plan_end_date)}`
                  : `Plan hasta ${fmtDate(profile.plan_end_date)}`
                }
              </Text>
            </View>
          )}
        </View>

        {/* ── STATS ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flash" size={20} color="#FFD700" />
            <Text style={styles.statValue}>
              {stats.loading ? '—' : stats.sessions}
            </Text>
            <Text style={styles.statLabel}>SESIONES</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMid]}>
            <Ionicons name="checkmark-circle" size={20} color="#00ff88" />
            <Text style={styles.statValue}>
              {stats.loading ? '—' : stats.completed}
            </Text>
            <Text style={styles.statLabel}>COMPLETADAS</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={20} color="#00aaff" />
            <Text style={styles.statValue}>
              {stats.loading ? '—' : `${stats.attendance}%`}
            </Text>
            <Text style={styles.statLabel}>ASISTENCIA</Text>
          </View>
        </View>

        {/* ── PERFIL (vista / edición) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MI PERFIL</Text>
            {!isEditing && (
              <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
                <Ionicons name="pencil" size={13} color="#000" />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            /* ── MODO EDICIÓN ── */
            <View>
              <EditField icon="person-outline" label="NOMBRE COMPLETO" value={form.full_name} onChangeText={setField('full_name')} />
              <EditField icon="barbell-outline" label="PESO (KG)" value={form.weight} onChangeText={setField('weight')} keyboardType="decimal-pad" placeholder="ej: 75" />
              <EditField icon="resize-outline" label="ALTURA (CM)" value={form.height} onChangeText={setField('height')} keyboardType="decimal-pad" placeholder="ej: 175" />
              <EditField icon="calendar-outline" label="FECHA DE NACIMIENTO (YYYY-MM-DD)" value={form.birth_date} onChangeText={setField('birth_date')} placeholder="ej: 1995-06-15" />
              <EditField icon="flag-outline" label="OBJETIVO" value={form.goal} onChangeText={setField('goal')} multiline placeholder="ej: Competir en CrossFit" />
              <EditField icon="medkit-outline" label="LESIONES / LIMITACIONES" value={form.injuries} onChangeText={setField('injuries')} multiline placeholder="ej: Rodilla derecha, lumbar" />

              {/* Selector de nivel */}
              <View style={styles.levelSelector}>
                <Text style={editStyles.label}>NIVEL TÉCNICO</Text>
                <View style={styles.levelGrid}>
                  {LEVELS.map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.levelChip, form.level === l && { backgroundColor: levelColor[l] + '33', borderColor: levelColor[l] }]}
                      onPress={() => setField('level')(l)}
                    >
                      <Text style={[styles.levelChipText, form.level === l && { color: levelColor[l] }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botones guardar / cancelar */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <>
                      <Ionicons name="checkmark" size={18} color="#000" />
                      <Text style={styles.saveBtnText}>GUARDAR CAMBIOS</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

          ) : (
            /* ── MODO LECTURA ── */
            <View>
              <InfoRow icon="person-outline"   label="NOMBRE"        value={profile?.full_name} />
              <InfoRow icon="mail-outline"      label="EMAIL"         value={profile?.email} />
              <InfoRow icon="location-outline"  label="CIUDAD"        value={profile?.box_city} />
              <InfoRow icon="calendar-outline"  label="NACIMIENTO"    value={fmtDate(profile?.birth_date)} />
              <InfoRow icon="barbell-outline"   label="PESO"          value={profile?.weight ? `${profile.weight} kg` : null} />
              <InfoRow icon="resize-outline"    label="ALTURA"        value={profile?.height ? `${profile.height} cm` : null} />
              <InfoRow icon="flag-outline"      label="OBJETIVO"      value={profile?.goal} />
              <InfoRow icon="medkit-outline"    label="LESIONES"      value={profile?.injuries} />
              <InfoRow icon="time-outline"      label="MIEMBRO DESDE" value={fmtDate(profile?.created_at)} />
            </View>
          )}
        </View>

        {/* ── CUENTA ── */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUENTA</Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: '#1a0000' }]}>
                <Ionicons name="log-out-outline" size={18} color="#ff4444" />
              </View>
              <Text style={[styles.menuLabel, { color: '#ff4444' }]}>Cerrar Sesión</Text>
              <Ionicons name="chevron-forward" size={16} color="#2a2a2a" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.version}>Team W App v1.0.2</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Header
  header: { alignItems: 'center', paddingTop: 64, paddingBottom: 28, backgroundColor: '#050505', paddingHorizontal: 20 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#FFD70055', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: '#000' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  email: { color: '#444', fontSize: 13, marginBottom: 12 },

  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#222' },
  planBadgeExpired: { borderColor: '#ff444444', backgroundColor: '#1a0000' },
  planText: { color: '#666', fontSize: 11 },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: -1, marginBottom: 0, borderBottomWidth: 1, borderBottomColor: '#0f0f0f' },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 20, backgroundColor: '#080808', gap: 6 },
  statCardMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#111' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#333', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },

  // Sections
  section: { marginHorizontal: 20, marginTop: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#2a2a2a', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  editBtnText: { color: '#000', fontSize: 11, fontWeight: '800' },

  // Level selector
  levelSelector: { marginTop: 14, marginBottom: 4 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  levelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e' },
  levelChipText: { color: '#555', fontSize: 12, fontWeight: '700' },

  // Save / Cancel
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFD700', padding: 17, borderRadius: 16, marginTop: 24 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  cancelBtn: { alignItems: 'center', padding: 14 },
  cancelBtnText: { color: '#444', fontWeight: '600', fontSize: 14 },

  // Menu
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#111', gap: 14 },
  menuIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, color: '#ddd', fontSize: 14, fontWeight: '600' },

  version: { textAlign: 'center', color: '#1e1e1e', fontSize: 11, marginTop: 40 },
});
