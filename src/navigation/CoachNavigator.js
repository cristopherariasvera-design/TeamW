import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Pantallas Coach
import CoachDashboard from '../screens/coach/CoachDashboard';
import StudentDetailView from '../screens/coach/StudentDetailView';
import CoachDayEditor from '../screens/coach/CoachDayEditor';
import PlannerScreen from '../screens/coach/PlannerScreen';
import AddStudentScreen from '../screens/coach/AddStudentScreen';
import CoachStudentsScreen from '../screens/coach/CoachStudentsScreen';
import CoachCalendarScreen from '../screens/coach/CoachCalendarScreen';
import CoachDayPlansScreen from '../screens/coach/CoachDayPlansScreen';

const Stack = createNativeStackNavigator();

export default function CoachNavigator() {
  const { signOut } = useAuth();

  const renderBackButton = (navigation) => (
    <TouchableOpacity
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('CoachDashboard');
        }
      }}
      style={styles.backButton}
      activeOpacity={0.8}
    >
      <Text style={styles.backArrow}>←</Text>
    </TouchableOpacity>
  );

  const renderLogoutButton = () => (
    <TouchableOpacity
      onPress={signOut}
      style={styles.logoutButton}
      activeOpacity={0.8}
    >
      <Ionicons
        name="log-out-outline"
        size={24}
        color="#FFD700"
      />
    </TouchableOpacity>
  );

  return (
    <Stack.Navigator
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1A1A1A',
        },
        headerTintColor: '#FFD700',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          color: '#FFD700',
          fontWeight: '900',
          fontSize: 18,
        },
        headerShadowVisible: false,

        // Ocultamos la flecha nativa porque en web/GitHub Pages se puede ocultar.
        headerBackVisible: false,

        // Flecha personalizada para todas menos Dashboard.
        headerLeft: () => {
          if (route.name === 'CoachDashboard') {
            return null;
          }

          return renderBackButton(navigation);
        },

        headerRight: renderLogoutButton,
      })}
    >
      <Stack.Screen
        name="CoachDashboard"
        component={CoachDashboard}
        options={{
          title: 'Panel Coach',
        }}
      />

      <Stack.Screen
        name="AddStudent"
        component={AddStudentScreen}
        options={{
          title: 'Registrar Alumno',
        }}
      />

      <Stack.Screen
        name="AdminStudents"
        component={CoachStudentsScreen}
        options={{
          title: 'Gestión de Atletas',
        }}
      />

      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailView}
        options={({ route }) => ({
          title: route.params?.student?.full_name || 'Detalle Atleta',
        })}
      />

      <Stack.Screen
        name="DayDetail"
        component={CoachDayEditor}
        options={{
          title: 'Detalle del Entrenamiento',
        }}
      />

      <Stack.Screen
        name="PlannerScreen"
        component={PlannerScreen}
        options={{
          title: 'Cargar Planificación',
        }}
      />

      <Stack.Screen
        name="CoachCalendar"
        component={CoachCalendarScreen}
        options={{
          title: 'Calendario WODs',
        }}
      />

      <Stack.Screen
        name="CoachDayPlans"
        component={CoachDayPlansScreen}
        options={{
          title: 'Planes del Día',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  backArrow: {
    color: '#FFD700',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },

  logoutButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});