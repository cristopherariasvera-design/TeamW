import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function StudentHomeScreen({ navigation }) {
  const { profile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    completed: 0,
    streak: 0,
    prs: 0,
    daysLeft: 0,
  });

  const normalizeDate = (date) => {
    if (!date) return null;
    return String(date).split('T')[0];
  };

  const calculateStreak = (data) => {
    if (!data || data.length === 0) return 0;

    const uniqueDates = [
      ...new Set(
        data
          .map((item) => normalizeDate(item.date))
          .filter(Boolean)
      ),
    ].sort((a, b) => new Date(b) - new Date(a));

    if (uniqueDates.length === 0) return 0;

    let streak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
      return 0;
    }

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        streak += 1;
        continue;
      }

      const current = new Date(uniqueDates[i - 1]);
      const previous = new Date(uniqueDates[i]);

      current.setHours(0, 0, 0, 0);
      previous.setHours(0, 0, 0, 0);

      const diffDays = Math.round(
        (current - previous) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  };

  const getDaysLeft = () => {
    const endDate =
      profile?.expiration_date ||
      profile?.plan_end_date;

    if (!endDate) return 0;

    const expDate = new Date(endDate);
    const today = new Date();

    expDate.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);

    const diffTime = expDate - today;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return days > 0 ? days : 0;
  };

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday =
        now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);

      const monday = new Date(now);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const mondayStr = monday.toISOString().split('T')[0];

      const { count: completedCount, error: completedError } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', profile?.id)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod')
        .eq('is_done', true)
        .gte('date', mondayStr);

      if (completedError) throw completedError;

      const { count: prCount, error: prError } = await supabase
        .from('prs')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', profile?.id);

      if (prError) throw prError;

      const { data: streakData, error: streakError } = await supabase
        .from('plans')
        .select('date')
        .eq('student_id', profile?.id)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod')
        .eq('is_done', true)
        .order('date', { ascending: false })
        .limit(30);

      if (streakError) throw streakError;

      setStats({
        completed: completedCount || 0,
        streak: calculateStreak(streakData || []),
        prs: prCount || 0,
        daysLeft: getDaysLeft(),
      });
    } catch (error) {
      console.error('Dashboard error:', error.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchDashboardData(true);
      }
    }, [profile?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData(true);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Deseas cerrar sesión?')) {
        signOut();
      }
    } else {
      Alert.alert('Sesión', '¿Cerrar sesión?', [
        { text: 'No' },
        {
          text: 'Sí',
          onPress: signOut,
          style: 'destructive',
        },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FFD700"
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0) || 'U'}
          </Text>
        </View>

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Hola,
          </Text>

          <Text style={styles.nameText}>
            {profile?.full_name || 'Usuario'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
          activeOpacity={0.8}
        >
          <Ionicons
            name="log-out-outline"
            size={26}
            color="#FFD700"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.sectionTitle}>
          Resumen Semanal
        </Text>

        {loading && !refreshing ? (
          <ActivityIndicator
            color="#FFD700"
            style={{ marginVertical: 30 }}
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons
                  name="checkmark-circle"
                  size={32}
                  color="#4CAF50"
                />

                <Text style={styles.statNumber}>
                  {stats.completed}
                </Text>

                <Text style={styles.statLabel}>
                  WODs Completados
                </Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons
                  name="flame"
                  size={32}
                  color="#FF9800"
                />

                <Text style={styles.statNumber}>
                  {stats.streak}
                </Text>

                <Text style={styles.statLabel}>
                  Días de Racha
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons
                  name="trophy"
                  size={32}
                  color="#FFD700"
                />

                <Text style={styles.statNumber}>
                  {stats.prs}
                </Text>

                <Text style={styles.statLabel}>
                  Récords (PR)
                </Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons
                  name="calendar"
                  size={32}
                  color="#2196F3"
                />

                <Text style={styles.statNumber}>
                  {stats.daysLeft}
                </Text>

                <Text style={styles.statLabel}>
                  Días Membresía
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>
          Accesos Rápidos
        </Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Plan')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="calendar"
            size={24}
            color="#FFD700"
          />

          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>
              Mi Plan de Entrenamiento
            </Text>

            <Text style={styles.actionSubtitle}>
              Ver rutina de hoy
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('PRs')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="trophy"
            size={24}
            color="#FFD700"
          />

          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>
              Mis Marcas Personales
            </Text>

            <Text style={styles.actionSubtitle}>
              Registrar nuevo récord
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={24}
            color="#333"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.sectionTitle}>
          Mi Perfil
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            Nivel:
          </Text>

          <Text style={styles.infoValue}>
            {profile?.level || 'Atleta'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            Box:
          </Text>

          <Text style={styles.infoValue}>
            {profile?.box_city || 'Team W'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },

  welcomeContainer: {
    flex: 1,
  },

  welcomeText: {
    fontSize: 12,
    color: '#666',
  },

  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  logoutButton: {
    padding: 5,
  },

  summaryContainer: {
    padding: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },

  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
  },

  statLabel: {
    fontSize: 10,
    color: '#555',
    marginTop: 4,
    textAlign: 'center',
  },

  quickActions: {
    paddingHorizontal: 20,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },

  actionTextContainer: {
    flex: 1,
    marginLeft: 15,
  },

  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },

  actionSubtitle: {
    fontSize: 12,
    color: '#555',
  },

  profileInfo: {
    padding: 20,
    marginBottom: 40,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },

  infoLabel: {
    color: '#555',
    fontWeight: 'bold',
  },

  infoValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
});