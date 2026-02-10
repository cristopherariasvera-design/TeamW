import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Importamos las pantallas
import CoachDashboard from '../screens/coach/CoachDashboard';
import StudentDetailView from '../screens/coach/StudentDetailView';
import DayDetailScreen from '../screens/student/DayDetailScreen';
import CoachDayEditor from '../screens/coach/CoachDayEditor';
import PlannerScreen from '../screens/coach/PlannerScreen';
import AddStudentScreen from '../screens/coach/AddStudentScreen'; 
import CoachStudentsScreen from '../screens/coach/CoachStudentsScreen';

const Stack = createNativeStackNavigator();

export default function CoachNavigator() {
  const { signOut } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#FFD700',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
        headerRight: () => (
          <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FFD700" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen 
        name="CoachDashboard" 
        component={CoachDashboard} 
        options={{ 
          title: 'Panel Coach',
          headerShown: true 
        }} 
      />

      <Stack.Screen 
        name="AddStudent" 
        component={AddStudentScreen} 
        options={{ title: 'Registrar Alumno' }} 
      />

      {/* ESTA ES LA PANTALLA QUE DABA ERROR */}
      <Stack.Screen 
        name="AdminStudents" // Nombre que espera el botón del Dashboard
        component={CoachStudentsScreen} 
        options={{ title: 'Gestión de Atletas' }} 
      />

      <Stack.Screen 
        name="StudentDetail" 
        component={StudentDetailView} 
        options={({ route }) => ({ 
          title: route.params.student?.full_name || 'Detalle Atleta' 
        })}
      />
      
      <Stack.Screen 
        name="DayDetail" 
        component={CoachDayEditor}
        options={{ title: 'Detalle del Entrenamiento' }}
      />

      <Stack.Screen 
        name="PlannerScreen" 
        component={PlannerScreen} 
        options={{ title: 'Cargar Planificación' }} 
      />
      
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 10,
    padding: 5,
  },
});