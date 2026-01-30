import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext'; 
import { Ionicons } from '@expo/vector-icons';

export default function StudentProfileScreen() {
  const { signOut, profile } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir de Team W?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Cerrar Sesión", 
          onPress: signOut, 
          style: "destructive" 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header del Perfil */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>
            {profile?.full_name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.nameText}>{profile?.full_name}</Text>
        <Text style={styles.roleBadge}>ATLETA</Text>
      </View>

      <View style={styles.optionsContainer}>
        {/* Puedes agregar más opciones aquí (Editar Perfil, Ajustes, etc.) */}
        
        <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          <Text style={styles.logoutLabel}>Cerrar Sesión</Text>
          <Ionicons name="chevron-forward" size={20} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15
  },
  avatarTextLarge: { fontSize: 40, fontWeight: 'bold', color: '#000' },
  nameText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  roleBadge: { 
    color: '#FFD700', 
    fontSize: 12, 
    fontWeight: 'bold', 
    marginTop: 5,
    letterSpacing: 1
  },
  optionsContainer: { padding: 20 },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333'
  },
  logoutLabel: {
    flex: 1,
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15
  }
});