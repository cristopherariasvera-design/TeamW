import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { createClient } from '@supabase/supabase-js';
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export default function AddCoachScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    specialty: 'CrossFit / Weightlifting',
  });

  const showMessage = (title, message, onOk) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
      return;
    }

    Alert.alert(title, message, [
      {
        text: 'OK',
        onPress: onOk,
      },
    ]);
  };

  const validateForm = () => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();
    const specialty = formData.specialty.trim();

    if (!name || !email || !password) {
      showMessage(
        'Campos incompletos',
        'Debes ingresar nombre, correo y contraseña.'
      );
      return null;
    }

    if (!email.includes('@')) {
      showMessage('Correo inválido', 'Ingresa un correo válido.');
      return null;
    }

    if (password.length < 6) {
      showMessage(
        'Contraseña muy corta',
        'La contraseña debe tener al menos 6 caracteres.'
      );
      return null;
    }

    return {
      name,
      email,
      password,
      specialty: specialty || 'CrossFit / Weightlifting',
    };
  };

  const handleCreateCoach = async () => {
    const cleanData = validateForm();

    if (!cleanData || loading) return;

    setLoading(true);

    try {
      const { name, email, password, specialty } = cleanData;

      /*
        Primero revisamos si ya existe en profiles.
        Si existe, actualizamos ese perfil como coach.
        Esto evita quedar bloqueado si el usuario ya estaba creado.
      */
      const { data: existingProfile, error: existingProfileError } =
        await supabase
          .from('profiles')
          .select('id, full_name, email, role, status')
          .eq('email', email)
          .maybeSingle();

      if (existingProfileError) throw existingProfileError;

      if (existingProfile?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: name,
            role: 'coach',
            status: 'Active',
            goal: specialty,
            box_city: 'Santiago',
          })
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;

        showMessage(
          'Coach actualizado',
          `El correo ya existía. Se actualizó el perfil de ${name} como coach activo.`,
          () => navigation.goBack()
        );

        return;
      }

      /*
        Si no existe en profiles, intentamos crearlo en Auth.
      */
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.signUp({
          email,
          password,
        });

      if (authError) {
        const message = authError.message || '';

        if (message.toLowerCase().includes('already registered')) {
          showMessage(
            'Correo ya registrado',
            'Ese correo ya existe en Supabase Auth, pero no se encontró en profiles. Usa otro correo o revisa ese usuario directamente en Supabase Auth.'
          );

          return;
        }

        throw authError;
      }

      const userId = authData?.user?.id;

      if (!userId) {
        throw new Error('No se pudo obtener el ID del usuario creado.');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            full_name: name,
            email,
            role: 'coach',
            status: 'Active',
            goal: specialty,
            box_city: 'Santiago',
          },
          {
            onConflict: 'id',
          }
        );

      if (profileError) throw profileError;

      showMessage(
        'Coach registrado',
        `${name} ahora es parte del staff técnico.`,
        () => navigation.goBack()
      );
    } catch (error) {
      console.error('Error registrando coach:', error.message || error);

      showMessage(
        'Error',
        error.message || 'No se pudo registrar el coach.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={28} color="#FFD700" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerSubtitle}>
                Gestión de Staff
              </Text>

              <Text style={styles.headerTitle}>
                Nuevo Coach
              </Text>

              <Text style={styles.headerDescription}>
                Crea credenciales y perfil técnico para un nuevo entrenador.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Credenciales de acceso
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Nombre del coach"
                  placeholderTextColor="#444"
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Correo profesional"
                  placeholderTextColor="#444"
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData({ ...formData, email: text })
                  }
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  placeholder="Contraseña"
                  placeholderTextColor="#444"
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData({ ...formData, password: text })
                  }
                />

                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.helpText}>
                Mínimo 6 caracteres. El coach podrá ingresar con este correo y contraseña.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Perfil profesional
              </Text>

              <Text style={styles.label}>
                Especialidades / certificaciones
              </Text>

              <TextInput
                style={[styles.inputStandalone, styles.textArea]}
                multiline
                placeholder="Ej: CrossFit, Weightlifting, Endurance..."
                placeholderTextColor="#444"
                value={formData.specialty}
                onChangeText={(text) =>
                  setFormData({ ...formData, specialty: text })
                }
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleCreateCoach}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    Registrar coach
                  </Text>

                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color="#000"
                    style={{ marginLeft: 10 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },

  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 24,
    marginBottom: 24,
  },

  backButton: {
    marginRight: 14,
    backgroundColor: '#111',
    padding: 8,
    borderRadius: 12,
  },

  headerSubtitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
  },

  headerDescription: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  form: {
    flex: 1,
  },

  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },

  label: {
    color: '#666',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 15,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 15,
    fontSize: 15,
    fontWeight: '700',
  },

  inputStandalone: {
    color: '#fff',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#222',
    fontSize: 15,
    fontWeight: '700',
  },

  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  helpText: {
    color: '#555',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  submitBtn: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 19,
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 40,
  },

  submitBtnDisabled: {
    opacity: 0.5,
  },

  submitBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});