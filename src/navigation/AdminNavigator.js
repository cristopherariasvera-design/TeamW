import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// IMPORTACIONES
import AdminDashboard from '../screens/admin/AdminDashboard';
import CoachManagement from '../screens/admin/CoachManagement';
import AddCoachScreen from '../screens/admin/AddCoachScreen';
import StudentManagement from '../screens/admin/StudentManagement';
import PlanMonitor from '../screens/admin/PlanMonitor';



const Stack = createStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { 
          backgroundColor: '#000', 
          elevation: 0, 
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#1a1a1a'
        },
        headerTintColor: '#FFD700',
        headerTitleStyle: { 
          fontWeight: 'bold', 
          fontSize: 14,
          letterSpacing: 1
        },
        headerBackTitleVisible: false, // Limpia el header en iOS
      }}
    >
      {/* 1. Dashboard Principal */}
      <Stack.Screen 
        name="AdminHome" 
        component={AdminDashboard} 
        options={{ title: 'TEAM W ADMIN' }}
      />

      {/* 2. Lista de Alumnos (Llamada desde el Dashboard) */}
      <Stack.Screen 
        name="StudentManagement" 
        component={StudentManagement} 
        options={{ headerShown: false }} // Usamos el header personalizado que ya tiene el archivo
      />

      {/* 3. Gestión de Coaches */}
      <Stack.Screen 
        name="CoachManagement"
        component={CoachManagement} 
        options={{ title: 'GESTIÓN DE STAFF' }} 
      />

      {/* 4. Formulario Nuevo Coach */}
      <Stack.Screen 
        name="AddCoach" 
        component={AddCoachScreen} 
        options={{ title: 'REGISTRAR COACH' }} 
      />

      {/* 5. Monitor de Planes (Acceso directo desde Dashboard o Alumnos)*/ }
      
      <Stack.Screen 
        name="PlanMonitor" 
        component={PlanMonitor} 
        options={{ headerShown: false }} 
      />

      {/* 6. Perfil Técnico del Atleta */}
      {/* <Stack.Screen 
        name="AdminStudentProfile" 
        component={AdminStudentProfile} 
        options={{ title: 'PERFIL TÉCNICO' }} 
      /> */} 

    </Stack.Navigator>
  );
}