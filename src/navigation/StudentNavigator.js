import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Pantallas del alumno
import StudentHomeScreen from '../screens/student/StudentHomeScreen';
import StudentPlanScreen from '../screens/student/StudentPlanScreen';
import DayDetailScreen from '../screens/student/DayDetailScreen';
import StudentPRsScreen from '../screens/student/StudentPRsScreen';
import StudentNewsScreen from '../screens/student/StudentNewsScreen';
import StudentProfileScreen from '../screens/student/StudentProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack para la sección de Plan (incluye vista mensual y detalle del día)
function PlanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlanList" component={StudentPlanScreen} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} />
    </Stack.Navigator>
  );
}

export default function StudentNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Plan') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'PRs') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'News') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={StudentHomeScreen}
        options={{ title: 'Inicio' }}
      />
      <Tab.Screen 
        name="Plan" 
        component={PlanStack}
        options={{ title: 'Mi Plan' }}
      />
      <Tab.Screen 
        name="PRs" 
        component={StudentPRsScreen}
        options={{ title: 'PRs' }}
      />
      <Tab.Screen 
        name="News" 
        component={StudentNewsScreen}
        options={{ title: 'Noticias' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={StudentProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}