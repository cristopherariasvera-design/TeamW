import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estado para el mensaje de error (mismo Pop-up que el Login)
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);

  const triggerError = (msg) => {
    setErrorMsg(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 4000);
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      triggerError('Completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      triggerError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      triggerError('Mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    
    // Esta función de Supabase toma el token que viene en la URL 
    // automáticamente para validar el cambio
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (error) {
      triggerError(error.message);
    } else {
      Alert.alert(
        '¡Éxito!', 
        'Tu contraseña ha sido actualizada. Ya puedes ingresar.',
        [{ text: 'Ir al Login', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* POP-UP DE ERROR */}
        {showError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#000" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="key-outline" size={60} color="#FFD700" />
            <Text style={styles.title}>Nueva Contraseña</Text>
            <Text style={styles.subtitle}>
              Establece tu nueva clave para acceder a TeamW.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Nueva Contraseña"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirmar Contraseña"
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Actualizar clave</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorBanner: {
    position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: '#FFD700',
    padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    zIndex: 1000, elevation: 10,
  },
  errorText: { color: '#000', fontWeight: '800', marginLeft: 10 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  subtitle: { color: '#666', textAlign: 'center', marginTop: 10 },
  form: { width: '100%' },
  input: {
    backgroundColor: '#121212', borderRadius: 10, padding: 18,
    marginBottom: 16, color: '#fff', borderWidth: 1, borderColor: '#222'
  },
  button: {
    backgroundColor: '#FFD700', borderRadius: 10, padding: 20,
    alignItems: 'center', marginTop: 10
  },
  buttonDisabled: { backgroundColor: '#998500' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
});