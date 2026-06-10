import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Linking,
} from 'react-native';
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '../../config/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { generateStudentReport } from '../../services/reportService';

const isolatedAuthClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

const levels = [
  { id: 'Beginner', label: 'Beginner', icon: 'fitness-outline' },
  { id: 'Rookie', label: 'Rookie', icon: 'trophy-outline' },
  { id: 'Scaled', label: 'Scaled', icon: 'barbell-outline' },
  { id: 'RX', label: 'RX', icon: 'flame-outline' },
];

const toDate = (dateString) => {
  if (!dateString) return null;
  return new Date(`${dateString}T12:00:00`);
};

const fmtDate = (dateString) => {
  const date = toDate(dateString);

  if (!date) return 'Sin fecha';

  return date
    .toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace('.', '');
};

const getWeeksBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = toDate(startDate);
  const end = toDate(endDate);

  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, Math.ceil(diffDays / 7));
};

const isDateInRange = (date, startDate, endDate) => {
  if (!date || !startDate || !endDate) return false;

  return date >= startDate && date <= endDate;
};

const getPlanStatus = (student) => {
  if (!student.plan_start_date || !student.plan_end_date) {
    return 'no_plan';
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const start = toDate(student.plan_start_date);
  const end = toDate(student.plan_end_date);

  if (today < start) return 'future';
  if (today > end) return 'expired';

  return 'active';
};

const getStatusConfig = (status) => {
  switch (status) {
    case 'Active':
      return {
        label: 'Activo',
        color: '#00ff88',
        bg: '#002414',
        border: '#00ff8844',
      };

    case 'Inactive':
    default:
      return {
        label: 'Inactivo',
        color: '#777',
        bg: '#111',
        border: '#333',
      };
  }
};

const getPlanConfig = (planStatus) => {
  switch (planStatus) {
    case 'active':
      return {
        label: 'Plan activo',
        color: '#FFD700',
        icon: 'calendar-outline',
      };

    case 'future':
      return {
        label: 'Plan futuro',
        color: '#2F80ED',
        icon: 'time-outline',
      };

    case 'expired':
      return {
        label: 'Plan vencido',
        color: '#FF4444',
        icon: 'alert-circle-outline',
      };

    case 'no_plan':
    default:
      return {
        label: 'Sin período',
        color: '#777',
        icon: 'calendar-clear-outline',
      };
  }
};

export default function StudentManagement({ route, navigation }) {
  const { coachId: filterCoachId, coachName } = route.params || {};

  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [coaches, setCoaches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingReportId, setGeneratingReportId] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    level: 'Beginner',
    goal: '',
    coach_id: null,
  });

  useFocusEffect(
    useCallback(() => {
      fetchInitialData();
    }, [filterCoachId])
  );

  const showMessage = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      const [coachesResult, studentsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'coach')
          .order('full_name', { ascending: true }),

        fetchStudentsData(),
      ]);

      if (coachesResult.error) throw coachesResult.error;

      setCoaches(coachesResult.data || []);

      const studentsWithData = studentsResult || [];

      setStudents(studentsWithData);
      applyFilters(studentsWithData, search, statusFilter);
    } catch (error) {
      console.error('Error cargando atletas:', error.message || error);
      showMessage('Error', 'No se pudieron cargar los atletas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStudentsData = async () => {
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        role,
        status,
        level,
        goal,
        box_city,
        coach_id,
        plan_start_date,
        plan_end_date,
        sessions_per_week,
        plan_weeks,
        weight,
        height
      `)
      .eq('role', 'alumno')
      .order('full_name', { ascending: true });

    if (filterCoachId) {
      query = query.eq('coach_id', filterCoachId);
    }

    const { data: studentsData, error: studentsError } = await query;

    if (studentsError) throw studentsError;

    const cleanStudents = studentsData || [];

    const studentIds = cleanStudents.map((student) => student.id);

    const coachIds = [
      ...new Set(
        cleanStudents
          .map((student) => student.coach_id)
          .filter(Boolean)
      ),
    ];

    let coachProfiles = [];
    let plans = [];

    if (coachIds.length > 0) {
      const { data: coachData, error: coachError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', coachIds);

      if (coachError) throw coachError;

      coachProfiles = coachData || [];
    }

    if (studentIds.length > 0) {
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('id, student_id, date, is_done, source, plan_type')
        .in('student_id', studentIds)
        .eq('source', 'calendar_wod')
        .eq('plan_type', 'wod');

      if (plansError) throw plansError;

      plans = plansData || [];
    }

    return cleanStudents.map((student) => {
      const coach = coachProfiles.find((item) => item.id === student.coach_id);

      const weeks =
        Number(student.plan_weeks || 0) ||
        getWeeksBetween(student.plan_start_date, student.plan_end_date);

      const sessionsPerWeek = Number(student.sessions_per_week || 0);
      const expected = sessionsPerWeek * weeks;

      const periodPlans =
        student.plan_start_date && student.plan_end_date
          ? plans.filter(
              (plan) =>
                plan.student_id === student.id &&
                isDateInRange(
                  plan.date,
                  student.plan_start_date,
                  student.plan_end_date
                )
            )
          : [];

      const loaded = periodPlans.length;
      const completed = periodPlans.filter((plan) => plan.is_done).length;
      const remaining = Math.max(expected - loaded, 0);
      const progress = expected > 0 ? Math.min(loaded / expected, 1) : 0;

      return {
        ...student,
        coachName: coach?.full_name || 'Sin coach',
        expected,
        loaded,
        completed,
        remaining,
        progress,
        planStatus: getPlanStatus(student),
      };
    });
  };

  const applyFilters = (source, text, selectedFilter = statusFilter) => {
    const normalized = text.trim().toLowerCase();

    let filtered = [...source];

    if (selectedFilter === 'active') {
      filtered = filtered.filter((student) => student.status === 'Active');
    }

    if (selectedFilter === 'inactive') {
      filtered = filtered.filter((student) => student.status !== 'Active');
    }

    if (selectedFilter === 'with_plan') {
      filtered = filtered.filter((student) => student.planStatus !== 'no_plan');
    }

    if (normalized) {
      filtered = filtered.filter((student) => {
        return (
          student.full_name?.toLowerCase().includes(normalized) ||
          student.email?.toLowerCase().includes(normalized) ||
          student.level?.toLowerCase().includes(normalized) ||
          student.coachName?.toLowerCase().includes(normalized) ||
          student.box_city?.toLowerCase().includes(normalized)
        );
      });
    }

    setFilteredStudents(filtered);
  };

  const handleSearch = (text) => {
    setSearch(text);
    applyFilters(students, text, statusFilter);
  };

  const handleStatusFilter = (nextFilter) => {
    setStatusFilter(nextFilter);
    applyFilters(students, search, nextFilter);
  };

  const refreshList = () => {
    setRefreshing(true);
    fetchInitialData();
  };

  const openAddModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      level: 'Beginner',
      goal: '',
      coach_id: filterCoachId || null,
    });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setIsEditing(true);
    setSelectedId(item.id);
    setFormData({
      name: item.full_name || '',
      email: item.email || '',
      password: '',
      level: item.level || 'Beginner',
      goal: item.goal || '',
      coach_id: item.coach_id || null,
    });
    setModalVisible(true);
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;

      await fetchInitialData();
    } catch (error) {
      console.error('Error cambiando estado:', error.message || error);
      showMessage('Error', 'No se pudo cambiar el estado del atleta.');
    }
  };

  const handleGenerateReport = async (student) => {
    if (!student?.id) {
      showMessage('Error', 'No se encontró el ID del alumno.');
      return;
    }

    if (student.planStatus === 'no_plan') {
      showMessage(
        'Sin período',
        'Este atleta no tiene período configurado. Primero debes asignarle fecha de inicio y término.'
      );
      return;
    }

    try {
      setGeneratingReportId(student.id);

      const result = await generateStudentReport({
        studentId: student.id,
        periodStart: student.plan_start_date || null,
        periodEnd: student.plan_end_date || null,
        sendToEmail: student.email || null,
      });

      showMessage(
        'Reporte generado',
        `Se generó correctamente el Excel:\n\n${result.file_name}`
      );

      if (result?.file_url) {
        await Linking.openURL(result.file_url);
      }

      await fetchInitialData();
    } catch (error) {
      console.error('Error generando reporte:', error.message || error);

      showMessage(
        'Error generando reporte',
        error.message || 'No se pudo generar el reporte Excel.'
      );
    } finally {
      setGeneratingReportId(null);
    }
  };

  const handleSave = async () => {
    const { name, email, password, level, goal, coach_id } = formData;

    if (!name.trim() || !coach_id) {
      showMessage(
        'Campos incompletos',
        'Debes ingresar nombre y seleccionar un coach.'
      );
      return;
    }

    if (!isEditing && (!email.trim() || !password.trim())) {
      showMessage(
        'Campos incompletos',
        'Debes ingresar email y contraseña para crear un atleta.'
      );
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: name.trim(),
            level,
            goal: goal.trim(),
            coach_id,
          })
          .eq('id', selectedId);

        if (error) throw error;

        showMessage('Éxito', 'Atleta actualizado correctamente.');
      } else {
        if (!isolatedAuthClient) {
          showMessage(
            'Falta configuración',
            'No se pudo crear el cliente aislado para registrar usuarios. Revisa supabaseClient.'
          );
          return;
        }

        const { data: authData, error: authError } =
          await isolatedAuthClient.auth.signUp({
            email: email.trim(),
            password: password.trim(),
          });

        if (authError) throw authError;

        if (!authData?.user?.id) {
          throw new Error('No se pudo obtener el usuario creado.');
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            full_name: name.trim(),
            email: email.trim(),
            role: 'alumno',
            status: 'Active',
            level,
            goal: goal.trim(),
            coach_id,
            box_city: 'Santiago',
          });

        if (profileError) throw profileError;

        showMessage('Éxito', 'Nuevo atleta registrado correctamente.');
      }

      setModalVisible(false);
      await fetchInitialData();
    } catch (error) {
      console.error('Error guardando atleta:', error.message || error);
      showMessage('Error', error.message || 'No se pudo guardar el atleta.');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: students.length,
    active: students.filter((item) => item.status === 'Active').length,
    inactive: students.filter((item) => item.status !== 'Active').length,
    withPlan: students.filter((item) => item.planStatus !== 'no_plan').length,
  };

  const renderStatCard = ({ filterKey, value, label, color }) => {
    const isActive = statusFilter === filterKey;

    return (
      <TouchableOpacity
        style={[
          styles.statCard,
          isActive && styles.statCardActive,
          isActive && { borderColor: color },
        ]}
        onPress={() => handleStatusFilter(filterKey)}
        activeOpacity={0.85}
      >
        <Text style={[styles.statValue, { color }]}>
          {value}
        </Text>

        <Text style={styles.statLabel}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.85}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#FFD700"
              style={{ marginRight: 10 }}
            />

            <Text style={styles.title}>
              {coachName ? `Team ${coachName.split(' ')[0]}` : 'Gestionar Atletas'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.subtitle}>
            {filteredStudents.length} atletas encontrados
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddModal}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {renderStatCard({
          filterKey: 'all',
          value: stats.total,
          label: 'Total',
          color: '#FFD700',
        })}

        {renderStatCard({
          filterKey: 'active',
          value: stats.active,
          label: 'Activos',
          color: '#00ff88',
        })}

        {renderStatCard({
          filterKey: 'inactive',
          value: stats.inactive,
          label: 'Inactivos',
          color: '#777',
        })}

        {renderStatCard({
          filterKey: 'with_plan',
          value: stats.withPlan,
          label: 'Con plan',
          color: '#FFD700',
        })}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar atleta, coach o nivel..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={handleSearch}
        />

        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color="#444" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const renderStudent = ({ item }) => {
    const isActive = item.status === 'Active';
    const statusConfig = getStatusConfig(item.status);
    const planConfig = getPlanConfig(item.planStatus);
    const isGeneratingReport = generatingReportId === item.id;

    return (
      <View
        style={[
          styles.card,
          !isActive && styles.cardInactive,
          item.planStatus === 'expired' && isActive && styles.cardExpired,
        ]}
      >
        <View style={styles.cardBody}>
          <TouchableOpacity
            style={styles.cardMain}
            onPress={() => navigation.navigate('Planner', { student: item })}
            activeOpacity={0.85}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.studentName} numberOfLines={1}>
                  {item.full_name}
                </Text>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusConfig.bg,
                      borderColor: statusConfig.border,
                    },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.metaText} numberOfLines={1}>
                {item.level || 'Sin nivel'} · {item.box_city || 'Sin ciudad'}
              </Text>

              <Text style={styles.metaText} numberOfLines={1}>
                Coach: {item.coachName}
              </Text>

              <View style={styles.planBox}>
                <Ionicons
                  name={planConfig.icon}
                  size={15}
                  color={planConfig.color}
                />

                <View style={{ flex: 1, marginLeft: 7 }}>
                  <Text style={[styles.planTitle, { color: planConfig.color }]}>
                    {planConfig.label}
                  </Text>

                  {item.planStatus === 'no_plan' ? (
                    <Text style={styles.planSub}>
                      Sin fecha de inicio y término configurada
                    </Text>
                  ) : (
                    <Text style={styles.planSub}>
                      {fmtDate(item.plan_start_date)} → {fmtDate(item.plan_end_date)}
                    </Text>
                  )}
                </View>
              </View>

              {item.planStatus !== 'no_plan' && (
                <>
                  <View style={styles.progressTop}>
                    <Text style={styles.wodText}>
                      {item.loaded}/{item.expected} WODs cargados
                    </Text>

                    <Text style={styles.remainingText}>
                      Restan {item.remaining}
                    </Text>
                  </View>

                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${item.progress * 100}%` },
                      ]}
                    />
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.reportButton,
              item.planStatus === 'no_plan' && styles.reportButtonDisabled,
            ]}
            onPress={() => handleGenerateReport(item)}
            disabled={isGeneratingReport}
            activeOpacity={0.85}
          >
            {isGeneratingReport ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="document-attach-outline" size={15} color="#000" />

                <Text style={styles.reportButtonText}>
                  Generar Excel
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openEditModal(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="pencil" size={18} color="#FFD700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => toggleStatus(item.id, item.status)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isActive ? 'person-remove-outline' : 'person-add-outline'}
              size={20}
              color={isActive ? '#ff4444' : '#00ff88'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />

        <Text style={styles.loadingText}>
          Cargando atletas...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshList}
            tintColor="#FFD700"
          />
        }
      >
        {renderHeader()}

        {filteredStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#222" />

            <Text style={styles.emptyText}>
              {search ? 'Sin resultados' : 'No hay atletas registrados'}
            </Text>
          </View>
        ) : (
          filteredStudents.map((item) => (
            <View key={item.id}>
              {renderStudent({ item })}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditing ? 'Editar Atleta' : 'Nuevo Atleta'}
                </Text>

                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={32} color="#444" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                <Text style={styles.modalLabel}>DATOS PRINCIPALES</Text>

                <TextInput
                  placeholder="Nombre completo"
                  placeholderTextColor="#444"
                  style={styles.modalInput}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                />

                {!isEditing && (
                  <>
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor="#444"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.modalInput}
                      value={formData.email}
                      onChangeText={(text) =>
                        setFormData({ ...formData, email: text })
                      }
                    />

                    <TextInput
                      placeholder="Contraseña"
                      placeholderTextColor="#444"
                      secureTextEntry
                      style={styles.modalInput}
                      value={formData.password}
                      onChangeText={(text) =>
                        setFormData({ ...formData, password: text })
                      }
                    />
                  </>
                )}

                <Text style={styles.modalLabel}>NIVEL TÉCNICO</Text>

                <View style={styles.levelGrid}>
                  {levels.map((level) => (
                    <TouchableOpacity
                      key={level.id}
                      style={[
                        styles.levelItem,
                        formData.level === level.id && styles.levelActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, level: level.id })
                      }
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={level.icon}
                        size={16}
                        color={formData.level === level.id ? '#000' : '#666'}
                      />

                      <Text
                        style={[
                          styles.levelItemText,
                          formData.level === level.id && { color: '#000' },
                        ]}
                      >
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>ASIGNAR COACH</Text>

                <View style={styles.coachGrid}>
                  {coaches.map((coach) => (
                    <TouchableOpacity
                      key={coach.id}
                      style={[
                        styles.coachChip,
                        formData.coach_id === coach.id && styles.coachChipActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, coach_id: coach.id })
                      }
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.coachChipText,
                          formData.coach_id === coach.id && { color: '#000' },
                        ]}
                      >
                        {coach.full_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>OBJETIVOS / NOTAS</Text>

                <TextInput
                  placeholder="Ej: bajar de peso, mejorar Snatch..."
                  placeholderTextColor="#444"
                  multiline
                  numberOfLines={3}
                  style={[styles.modalInput, styles.textArea]}
                  value={formData.goal}
                  onChangeText={(text) =>
                    setFormData({ ...formData, goal: text })
                  }
                />

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {isEditing ? 'ACTUALIZAR ATLETA' : 'CREAR ATLETA'}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#000',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#fff',
    marginTop: 14,
    fontWeight: '700',
  },

  list: {
    flex: 1,
    minHeight: 0,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 180,
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    marginBottom: 14,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },

  subtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },

  addButton: {
    backgroundColor: '#FFD700',
    width: 45,
    height: 45,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statCardActive: {
    backgroundColor: '#111',
  },

  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    color: '#777',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 3,
    textAlign: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 15,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },

  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    marginLeft: 10,
    fontWeight: '700',
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    gap: 12,
  },

  emptyText: {
    color: '#444',
    fontSize: 14,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    flexDirection: 'row',
    overflow: 'hidden',
  },

  cardInactive: {
    opacity: 0.45,
  },

  cardExpired: {
    borderColor: '#FF444455',
    backgroundColor: '#140404',
  },

  cardBody: {
    flex: 1,
  },

  cardMain: {
    flexDirection: 'row',
    padding: 13,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 18,
  },

  info: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 8,
  },

  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  metaText: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },

  planBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#171717',
    borderRadius: 12,
    padding: 9,
    marginTop: 9,
  },

  planTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  planSub: {
    color: '#777',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },

  wodText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  remainingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },

  progressBg: {
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },

  progressFill: {
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },

  reportButton: {
    marginHorizontal: 13,
    marginBottom: 13,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportButtonDisabled: {
    opacity: 0.55,
  },

  reportButtonText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: 6,
  },

  cardActions: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#171717',
  },

  actionBtn: {
    padding: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },

  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 12,
    paddingBottom: 0,
    maxHeight: '92%',
    borderTopWidth: 2,
    borderTopColor: '#FFD700',
  },

  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },

  modalLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },

  modalInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },

  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  levelItem: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },

  levelActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  levelItemText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '900',
  },

  coachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },

  coachChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
  },

  coachChipActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },

  coachChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  saveBtn: {
    backgroundColor: '#FFD700',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 24,
  },

  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 14,
  },
});
