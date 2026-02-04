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

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export default function AddStudentScreen({ navigation }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', level: 'Beginner', goal: 'Mejorar condición física' 
  });

  const levels = [
    { id: 'Beginner', label: 'Beginner', icon: 'fitness-outline' },
    { id: 'Rookie', label: 'Rookie', icon: 'trophy-outline' },
    { id: 'Scaled', label: 'Scaled', icon: 'barbell-outline' },
    { id: 'RX', label: 'RX', icon: 'flame-outline' },
  ];

  const handleCreateStudent = async () => {
    const { name, email, password, level, goal } = formData;
    if (!name || !email || !password) {
      Alert.alert("Campos incompletos", "Por favor completa los datos básicos del atleta.");
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({ email: email.trim(), password });
      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: name,
            role: 'alumno',
            status: 'Active',
            level,
            goal,
            coach_id: profile.id,
            box_city: 'Santiago'
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
        Alert.alert("¡Atleta Registrado!", `${name} ya es parte de tu equipo.`);
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
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFD700" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSubtitle}>Gestión de Equipo</Text>
            <Text style={styles.headerTitle}>Nuevo Alumno</Text>
          </View>
        </View>

        <View style={styles.form}>
          {/* SECCIÓN 1: DATOS PERSONALES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Básica</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Nombre Completo"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, name: t})} 
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                autoCapitalize="none" 
                placeholder="Correo Electrónico"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, email: t})} 
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                secureTextEntry 
                placeholder="Contraseña Temporal"
                placeholderTextColor="#444"
                onChangeText={(t) => setFormData({...formData, password: t})} 
              />
            </View>
          </View>

          {/* SECCIÓN 2: OBJETIVOS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planificación</Text>
            <Text style={styles.label}>Objetivo del Atleta</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              multiline
              numberOfLines={2}
              value={formData.goal}
              onChangeText={(t) => setFormData({...formData, goal: t})} 
            />
          </View>

          {/* SECCIÓN 3: NIVEL (SELECTOR MEJORADO) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nivel Técnico</Text>
            <View style={styles.levelGrid}>
              {levels.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.levelCard, formData.level === item.id && styles.levelCardActive]}
                  onPress={() => setFormData({...formData, level: item.id})}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={24} 
                    color={formData.level === item.id ? "#000" : "#FFD700"} 
                  />
                  <Text style={[styles.levelCardText, formData.level === item.id && styles.levelCardTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={handleCreateStudent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>REGISTRAR ATLETA</Text>
                <Ionicons name="flash" size={20} color="#000" style={{marginLeft: 10}} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  levelCard: { 
    width: '48%', 
    backgroundColor: '#111', 
    padding: 15, 
    borderRadius: 15, 
    alignItems: 'center', 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222'
  },
  levelCardActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  levelCardText: { color: '#fff', marginTop: 8, fontWeight: 'bold', fontSize: 14 },
  levelCardTextActive: { color: '#000' },
  submitBtn: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, 
    borderRadius: 15, 
    marginTop: 10,
    marginBottom: 40,
    elevation: 5,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});