import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, ScrollView, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Asegúrate de tener expo-icons
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- ESTADOS PARA EL POP-UP DE ERROR ---
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);
  
  const { signIn } = useAuth();
  const passwordInputRef = useRef(null);

  // Función para disparar el mensaje de error
  const triggerError = (msg) => {
    setErrorMsg(msg);
    setShowError(true);
    // Se oculta automáticamente tras 4 segundos
    setTimeout(() => setShowError(false), 4000);
  };

  const handleLogin = async () => {
    // Validación inicial
    if (!email || !password) {
      triggerError('Por favor, completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        // Mapeo de errores de Supabase a Español
        let friendlyMsg = 'Error al iniciar sesión';
        
        if (error.message === 'Invalid login credentials') {
          friendlyMsg = 'Correo o contraseña incorrectos';
        } else if (error.message.includes('network')) {
          friendlyMsg = 'Sin conexión a internet';
        } else {
          friendlyMsg = error.message;
        }
        
        triggerError(friendlyMsg);
      } 
      // Si no hay error, el AuthContext cambiará el estado y AppNavigator nos moverá
    } catch (err) {
      triggerError('Ocurrió un fallo inesperado');
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
        {/* --- EL POP-UP (BANNER SUPERIOR) --- */}
        {showError && (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="alert-circle" size={22} color="#000" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowError(false)}>
              <Ionicons name="close" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/logo1dark.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>CROSSFIT & HYBRID TRAINING</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.title}>Iniciar Sesión</Text>

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#666"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current.focus()}
              />

              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#666"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>Ingresar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  // Estilos del Pop-up
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFD700', // Dorado
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999, // Asegura que esté por encima de todo
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  errorText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 10,
  },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoImage: { width: 280, height: 280 },
  subtitle: {
    fontSize: 12, color: '#FFD700', fontWeight: '800', 
    marginTop: 10, letterSpacing: 2, textAlign: 'center' 
  },
  form: { width: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 25, textAlign: 'center' },
  input: {
    backgroundColor: '#121212', borderRadius: 10, padding: 18,
    marginBottom: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#222'
  },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotPasswordText: { color: '#FFD700', fontSize: 14 },
  button: {
    backgroundColor: '#FFD700', borderRadius: 10, padding: 20, 
    alignItems: 'center', marginBottom: 20
  },
  buttonDisabled: { backgroundColor: '#998500' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
});