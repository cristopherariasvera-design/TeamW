import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function CoachManagement({ navigation }) {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCoaches();
    }, [])
  );

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coach')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      setCoaches(data || []);
    } catch (error) {
      console.error("Error al obtener coaches:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const mensaje = `¿Deseas marcar a este coach como ${nextStatus === 'Active' ? 'Activo' : 'Inactivo'}?`;

    const ejecutarCambio = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status: nextStatus })
          .eq('id', id);
        
        if (error) throw error;
        setCoaches(coaches.map(c => c.id === id ? { ...c, status: nextStatus } : c));
      } catch (error) {
        console.error("Error Supabase:", error.message);
        alert("No se pudo actualizar: " + error.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) ejecutarCambio();
    } else {
      Alert.alert("Cambiar Estado", mensaje, [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: ejecutarCambio }
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCoaches();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Staff de Coaches</Text>
          <Text style={styles.subtitle}>{coaches.length} entrenadores en total</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => navigation.navigate('AddCoach')}
        >
          <Ionicons name="person-add" size={20} color="#000" />
          <Text style={styles.buttonText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
          }
          renderItem={({ item }) => {
            const isActive = item.status === 'Active';
            return (
              <View style={[styles.card, !isActive && styles.cardInactive]}>
                
                {/* ÁREA DE INFORMACIÓN: Al tocar aquí, vas a sus alumnos */}
                <TouchableOpacity 
                  style={styles.coachMainArea}
                  onPress={() => navigation.navigate('StudentManagement', { 
                    coachId: item.id, 
                    coachName: item.full_name 
                  })}
                >
                  <View style={styles.coachInfo}>
                    <Text style={[styles.coachName, !isActive && styles.textInactive]}>
                      {item.full_name}
                    </Text>
                    <Text style={styles.coachEmail}>{item.email || 'coach@teamw.com'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#333" />
                </TouchableOpacity>
                
                {/* BOTÓN DE ESTADO: Independiente para no navegar por error */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => toggleStatus(item.id, item.status)}
                  style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}
                >
                  <Ionicons 
                    name={isActive ? "checkmark-circle" : "close-circle"} 
                    size={16} 
                    color={isActive ? "#FFD700" : "#666"} 
                  />
                  <Text style={[styles.badgeText, { color: isActive ? '#FFD700' : '#666' }]}>
                    {isActive ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                </TouchableOpacity>

              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay coaches registrados aún.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 30,
    marginTop: 40 
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 2 },
  addButton: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  buttonText: { fontWeight: '900', marginLeft: 8, fontSize: 13, color: '#000' },
  card: { 
    backgroundColor: '#0a0a0a', 
    padding: 18, 
    borderRadius: 16, 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  cardInactive: {
    borderColor: '#111',
    opacity: 0.7
  },
  coachMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 15
  },
  coachInfo: { flex: 1 },
  coachName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  textInactive: { color: '#666' },
  coachEmail: { color: '#666', fontSize: 13, marginTop: 4 },
  badge: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: '#111', 
    borderColor: '#222'
  },
  badgeInactive: {
    backgroundColor: '#050505',
    borderColor: '#111'
  },
  badgeText: { fontSize: 10, fontWeight: 'bold', marginLeft: 5 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 100, fontSize: 16 }
});