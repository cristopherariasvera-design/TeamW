import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext'; 
import { supabase } from '../../config/supabaseClient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function StudentProfileScreen() {
  const { signOut, profile, setProfile } = useAuth(); // Asumiendo que setProfile está en tu contexto para actualizar el estado global

  // ESTADOS PARA EDICIÓN
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');

  const handleLogout = () => {
    const logoutAction = async () => {
      try { await signOut(); } catch (e) { console.error(e); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("¿Cerrar sesión en Team W?")) logoutAction();
    } else {
      Alert.alert("Cerrar Sesión", "¿Quieres salir?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", onPress: logoutAction, style: "destructive" }
      ]);
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) return Alert.alert("Error", "El nombre no puede estar vacío");
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);

      if (error) throw error;

      // Actualizamos el estado local del contexto para que el cambio sea instantáneo
      if (setProfile) {
        setProfile({ ...profile, full_name: fullName });
      }

      Alert.alert("¡Éxito!", "Perfil actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el perfil");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header del Perfil */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        </View>
        
        {isEditing ? (
          <View style={styles.editInputContainer}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nombre completo"
              placeholderTextColor="#555"
              autoFocus
            />
          </View>
        ) : (
          <Text style={styles.nameText}>{profile?.full_name || 'Usuario'}</Text>
        )}

        <View style={styles.badgeContainer}>
          <Text style={styles.roleBadge}>ATLETA TEAM W</Text>
        </View>
      </View>

      {/* Tarjetas de Estadísticas */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="fire" size={24} color="#FFD700" />
          <Text style={styles.statValue}>24</Text>
          <Text style={styles.statLabel}>Sesiones</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="calendar-check" size={24} color="#FFD700" />
          <Text style={styles.statValue}>95%</Text>
          <Text style={styles.statLabel}>Asistencia</Text>
        </View>
      </View>

      {/* Contenedor de Opciones */}
      <View style={styles.optionsContainer}>
        <Text style={styles.sectionTitle}>Ajustes de cuenta</Text>
        
        {/* BOTÓN EDITAR / GUARDAR */}
        <TouchableOpacity 
          style={[styles.menuItem, isEditing && styles.menuItemActive]} 
          onPress={() => isEditing ? handleUpdateProfile() : setIsEditing(true)}
          disabled={loading}
        >
          <View style={[styles.menuIconBg, isEditing && { backgroundColor: '#FFD700' }]}>
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name={isEditing ? "save-outline" : "person-outline"} size={22} color={isEditing ? "#000" : "#fff"} />
            )}
          </View>
          <Text style={styles.menuLabel}>{isEditing ? "Guardar Cambios" : "Editar Perfil"}</Text>
          {!isEditing && <Ionicons name="chevron-forward" size={18} color="#333" />}
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setIsEditing(false); setFullName(profile.full_name); }}>
            <Text style={styles.cancelEditText}>Cancelar</Text>
          </TouchableOpacity>
        )}

        {/* CERRAR SESIÓN */}
        {!isEditing && (
          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <View style={[styles.menuIconBg, { backgroundColor: '#331111' }]}>
              <Ionicons name="log-out-outline" size={22} color="#ff4444" />
            </View>
            <Text style={[styles.menuLabel, { color: '#ff4444' }]}>Cerrar Sesión</Text>
            <Ionicons name="chevron-forward" size={18} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.versionText}>Team W App v1.0.2</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  profileHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: 30, backgroundColor: '#0a0a0a' },
  avatarWrapper: { marginBottom: 15 },
  avatarLarge: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFD700',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#1a1a1a'
  },
  avatarTextLarge: { fontSize: 40, fontWeight: 'bold', color: '#000' },
  nameText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  
  // Estilos del Input de Edición
  editInputContainer: { width: '80%', marginBottom: 5 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', padding: 10, borderRadius: 10,
    fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: '#FFD700'
  },

  badgeContainer: { backgroundColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleBadge: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: -20 },
  statCard: {
    backgroundColor: '#111', width: '40%', paddingVertical: 15, borderRadius: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#222'
  },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  statLabel: { color: '#666', fontSize: 10 },

  optionsContainer: { padding: 25 },
  sectionTitle: { color: '#444', fontSize: 12, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a',
    padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#161616'
  },
  menuItemActive: { borderColor: '#FFD700' },
  menuIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, color: '#eee', fontSize: 15, fontWeight: '500', marginLeft: 15 },
  
  cancelEditBtn: { alignItems: 'center', marginBottom: 20 },
  cancelEditText: { color: '#555', fontWeight: 'bold' },

  logoutItem: { borderColor: '#221111' },
  versionText: { textAlign: 'center', color: '#333', fontSize: 12, marginVertical: 20 }
});