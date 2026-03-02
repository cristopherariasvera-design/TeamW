import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!email) return Alert.alert('Atención', 'Ingresa tu correo');
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Éxito', 'Revisa tu correo para el enlace de recuperación', [{text: 'OK', onPress: () => navigation.goBack()}]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#FFD700" />
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Recuperar</Text>
        <Text style={styles.sub}>Te enviaremos un email para resetear tu clave.</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          placeholderTextColor="#666" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Enviando...' : 'Enviar Enlace'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backBtn: { padding: 20 },
  content: { padding: 30, flex: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  sub: { color: '#888', marginBottom: 30 },
  input: { backgroundColor: '#121212', borderRadius: 10, padding: 18, color: '#fff', marginBottom: 20 },
  btn: { backgroundColor: '#FFD700', padding: 20, borderRadius: 10, alignItems: 'center' },
  btnText: { fontWeight: '900', textTransform: 'uppercase' }
});