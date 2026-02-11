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
  Platform
} from 'react-native';
import { createClient } from '@supabase/supabase-js'; 
import { supabase } from '../../config/supabaseClient'; 
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const SUPABASE_URL = 'https://khrzhzeqdbizbmqdwebw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocnpoemVxZGJpemJtcWR3ZWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDE0ODMsImV4cCI6MjA4NTI3NzQ4M30.au0_SWWVZMKtU7uokYgV4gI-KZMf45rEBOe_tm1WtDE';

// Cliente para no cerrar sesión
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export default function AddCoachScreen({ navigation }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', specialty: 'CrossFit / Weightlifting' 
  });

  const handleCreateCoach = async () => {
    const { name, email, password, specialty } = formData;
    
    if (!name || !email || !password) {
      Alert.alert("Campos incompletos", "Por favor completa los datos del entrenador.");
      return;
    }

    setLoading(true);
    try {
      // 1. Crear en Auth (mismo método que usas en alumnos)
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({ 
        email: email.trim(), 
        password 
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Actualizar perfil con ROL COACH
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: name,
            role: 'coach',       // <--- Aquí cambiamos el rol
            status: 'Active',
            goal: specialty,      // Usamos el campo goal para su especialidad
            box_city: 'Santiago'
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
        
        Alert.alert("¡Coach Registrado!", `${name} ahora es parte del staff técnico.`);
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFD700" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSubtitle}>Gestión de Staff</Text>
            <Text style={styles.headerTitle}>Nuevo Coach</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credenciales de Acceso</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Nombre del Coach"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, name: t})} 
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                autoCapitalize="none" 
                placeholder="Correo Profesional"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, email: t})} 
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                secureTextEntry 
                placeholder="Contraseña"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, password: t})} 
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perfil Profesional</Text>
            <Text style={styles.label}>Especialidades / Certificaciones</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              multiline
              value={formData.specialty}
              onChangeText={(t) => setFormData({...formData, specialty: t})} 
            />
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={handleCreateCoach}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>REGISTRAR COACH</Text>
                <Ionicons name="shield-checkmark" size={20} color="#000" style={{marginLeft: 10}} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ... COPIA LOS MISMOS STYLES QUE TIENES EN ADDSTUDENTSCREEN ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
  backButton: { marginRight: 15, backgroundColor: '#111', padding: 8, borderRadius: 12 },
  headerSubtitle: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  form: { paddingHorizontal: 20 },
  section: { marginBottom: 25 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15, opacity: 0.9 },
  label: { color: '#666', fontSize: 13, marginBottom: 8 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 15
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', paddingVertical: 15, fontSize: 15 },
  textArea: { backgroundColor: '#111', borderRadius: 12, padding: 15, textAlignVertical: 'top', borderWidth: 1, borderColor: '#222' },
  submitBtn: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, 
    borderRadius: 15, 
    marginTop: 10,
    marginBottom: 40
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});