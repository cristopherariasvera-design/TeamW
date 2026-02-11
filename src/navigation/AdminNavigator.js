import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// IMPORTACIONES CORRECTAS BASADAS EN TU FOTO:
import AdminDashboard from '../screens/admin/AdminDashboard';
import CoachManagement from '../screens/admin/CoachManagement';
import AddCoachScreen from '../screens/admin/AddCoachScreen';
import StudentManagement from '../screens/admin/StudentManagement';

const Stack = createStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#000', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#FFD700',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
      }}
    >
      <Stack.Screen 
        name="AdminHome" 
        component={AdminDashboard} 
        options={{ title: 'TEAM W ADMIN' }}
      />
      <Stack.Screen 
        name="CoachManagement"
        component={CoachManagement} 
        options={{ title: 'GESTIÓN DE COACHES' }} 
      />
      <Stack.Screen 
        name="AddCoach" 
        component={AddCoachScreen} 
        options={{ title: 'NUEVO COACH' }} 
      />
      <Stack.Screen 
        name="StudentManagement" 
        component={StudentManagement} 
        options={{ headerShown: false }} 
      />

    </Stack.Navigator>
  );
}