import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';

import * as Font from 'expo-font';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Role-based navigators
import AdminNavigator from './AdminNavigator';
import CoachNavigator from './CoachNavigator';
import StudentNavigator from './StudentNavigator';

const Stack = createStackNavigator();

const linking = {
  prefixes: [
    'http://localhost:8081',
    Linking.createURL('/'),
    'https://cristopherariasvera-design.github.io/TeamW',
  ],
  config: {
    screens: {
      ResetPassword: 'ResetPasswordScreen', // <--- Asegúrate que coincida con el nombre en el Stack
      Login: 'login',
    },
  },
};

export default function AppNavigator() {
  // EXTRAEMOS isRecovering del Contexto
  const { user, profile, loading, signOut, isRecovering } = useAuth();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadResources() {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
          ...FontAwesome.font,
          ...MaterialIcons.font,
          ...MaterialCommunityIcons.font,
        });
      } catch (e) {
        console.warn("Error cargando fuentes:", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadResources();
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}> 
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {/* PRIORIDAD 1: MODO RECUPERACIÓN */}
        {isRecovering ? (
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        ) : 
        
        /* PRIORIDAD 2: USUARIO NO LOGUEADO */
        !user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : 

        /* PRIORIDAD 3: USUARIO PENDIENTE */
        profile?.status !== 'Active' ? (
          <Stack.Screen name="Pending">
            {(props) => <PendingScreen {...props} onSignOut={signOut} />}
          </Stack.Screen>
        ) : 

        /* PRIORIDAD 4: FLUJO NORMAL POR ROL */
        profile?.role === 'admin' ? (
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

// Pantalla para usuarios pendientes (Mantenemos tu estilo)
function PendingScreen({ onSignOut }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 24 }}>
      <View style={{ 
        width: 100, height: 100, borderRadius: 50, 
        backgroundColor: '#111', borderWidth: 2, borderColor: '#FFD700',
        justifyContent: 'center', alignItems: 'center', marginBottom: 30 
      }}>
        <Ionicons name="time-outline" size={50} color="#FFD700" />
      </View>
      
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
        Acceso en Revisión
      </Text>
      
      <Text style={{ color: '#666', fontSize: 16, marginBottom: 40, textAlign: 'center', lineHeight: 22 }}>
        Tu cuenta está pendiente de activación. El administrador debe aprobar tu acceso para que puedas ver tus entrenamientos.
      </Text>

      <TouchableOpacity
        style={{ 
          backgroundColor: '#FFD700', 
          paddingHorizontal: 40, paddingVertical: 18, 
          borderRadius: 30, shadowColor: '#FFD700', shadowOpacity: 0.2 
        }}
        onPress={onSignOut}
      >
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' }}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
}