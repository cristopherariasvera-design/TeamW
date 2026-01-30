import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase'; // Asegúrate de que la ruta sea correcta

export default function StudentSelector({ navigation }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student'); // Solo traemos a los que son alumnos

    if (!error) setStudents(data);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Alumnos</Text>
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.studentCard}
            onPress={() => navigation.navigate('Planificador', { studentId: item.id, studentName: item.full_name })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text>
            </View>
            <Text style={styles.studentName}>{item.full_name}</Text>
            <Text style={styles.arrow}> {'>'} </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  title: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  studentCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontWeight: 'bold', color: '#000' },
  studentName: { color: '#fff', fontSize: 18, flex: 1 },
  arrow: { color: '#FFD700', fontSize: 20 }
});