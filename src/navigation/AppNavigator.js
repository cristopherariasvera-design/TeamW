import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Role-based navigators
import AdminNavigator from './AdminNavigator';
import CoachNavigator from './CoachNavigator';
import StudentNavigator from './StudentNavigator';

// Importa esto si ya creaste el archivo de notificaciones, si no, comenta la línea del useEffect abajo
// import { registerForPushNotificationsAsync } from '../config/NotificationHelper'; 

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, profile, loading, signOut } = useAuth();

  // EL EFFECT DEBE IR AQUÍ ADENTRO
  useEffect(() => {
    if (profile?.id) {
      console.log("Usuario autenticado:", profile.full_name);
      // registerForPushNotificationsAsync(profile.id); // Actívalo cuando tengas el helper listo
    }
  }, [profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : profile?.status !== 'Active' ? (
          <Stack.Screen name="Pending">
            {() => <PendingScreen onSignOut={signOut} />}
          </Stack.Screen>
        ) : profile?.role === 'admin' ? (
          <Stack.Screen name="AdminApp" component={AdminNavigator} />
        ) : profile?.role === 'coach' ? (
          <Stack.Screen name="CoachApp" component={CoachNavigator} />
        ) : (
          <Stack.Screen name="StudentApp" component={StudentNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Pantalla para usuarios pendientes (Esta sí puede ir afuera como función independiente)
function PendingScreen({ onSignOut }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 24 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#000' }}>TEAM W</Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
        Cuenta Pendiente
      </Text>
      <Text style={{ color: '#999', fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Tu cuenta está pendiente de activación por el administrador.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: '#FFD700', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 8 }}
        onPress={onSignOut}
      >
        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
}