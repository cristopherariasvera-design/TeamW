import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext'; // <--- IMPORTANTE

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Extraemos setIsRecovering para "apagar" el modo recuperación al terminar
  const { setIsRecovering } = useAuth(); 

  // Estado para el mensaje de error (Pop-up amarillo)
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
    
    try {
      // Actualizamos la contraseña en Supabase
      // (Supabase ya tiene la sesión activa gracias al link del correo)
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Si todo sale bien, mostramos el éxito
      Alert.alert(
        '¡Éxito!', 
        'Tu contraseña ha sido actualizada correctamente.',
        [{ 
          text: 'Entrar a TeamW', 
          onPress: () => {
            // APAGAMOS el modo recuperación. 
            // Esto hace que AppNavigator detecte que ya no estamos recuperando
            // y te mande al Dashboard automáticamente.
            setIsRecovering(false); 
          } 
        }]
      );

    } catch (error) {
      triggerError(error.message);
    } finally {
      setLoading(false);
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
            <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={40} color="#FFD700" />
            </View>
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
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  subtitle: { color: '#666', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  form: { width: '100%' },
  input: {
    backgroundColor: '#121212', borderRadius: 10, padding: 18,
    marginBottom: 16, color: '#fff', borderWidth: 1, borderColor: '#222'
  },
  button: {
    backgroundColor: '#FFD700', borderRadius: 10, padding: 20,
    alignItems: 'center', marginTop: 10
  },
  buttonDisabled: { backgroundColor: '#998500', opacity: 0.6 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
});

