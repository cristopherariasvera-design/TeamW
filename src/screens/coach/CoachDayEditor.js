import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CoachDayEditor({ route, navigation }) {
  const { profile } = useAuth();

  const {
    plan = {},
    date = null,
    mode = null,
    holidayName = null,
  } = route.params || {};

  const isCreateMultiple = mode === 'create-multiple';
  const selectedDate = date || plan?.date || null;

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);
  const [title, setTitle] = useState(plan?.title || '');
  const [sections, setSections] = useState([]);

  const [studentsModalVisible, setStudentsModalVisible] = useState(false);
  const [activeStudents, setActiveStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    try {
      let rawSections = plan?.sections || [];

      if (typeof rawSections === 'string') {
        rawSections = JSON.parse(plan.sections);
      }

      if (Array.isArray(rawSections) && rawSections.length > 0) {
        setSections(
          rawSections.map((s) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: s.name || '',
            content: s.content || '',
          }))
        );
      } else {
        setSections([]);
      }
    } catch (e) {
      setSections([
        {
          id: '1',
          name: 'A) SECCIÓN',
          content: '',
        },
      ]);
    }
  }, [plan]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges || loading || assigning || studentsModalVisible) return;

      e.preventDefault();

      Alert.alert('Salir', '¿Descartar cambios?', [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Sí',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [
    navigation,
    hasChanges,
    loading,
    assigning,
    studentsModalVisible,
  ]);

  const addSection = () => {
    const nextLetter = String.fromCharCode(65 + sections.length);

    setSections([
      ...sections,
      {
        id: Math.random().toString(),
        name: `${nextLetter}) SECCIÓN`,
        content: '',
      },
    ]);

    setHasChanges(true);
  };

  const removeSection = (id) => {
    if (sections.length <= 1) return;

    setSections(sections.filter((s) => s.id !== id));
    setHasChanges(true);
  };

  const updateSection = (id, field, value) => {
    setSections(
      sections.map((s) =>
        s.id === id
          ? {
              ...s,
              [field]: value,
            }
          : s
      )
    );

    setHasChanges(true);
  };

  const getFormattedSections = () => {
    return sections.map((s) => ({
      name: s.name,
      content: s.content,
    }));
  };

  const getDayName = (dateString) => {
    if (!dateString) return null;

    const days = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];

    const d = new Date(`${dateString}T12:00:00`);
    return days[d.getDay()];
  };

  const getMonthNumber = (dateString) => {
    if (!dateString) return null;

    const d = new Date(`${dateString}T12:00:00`);
    return d.getMonth() + 1;
  };

  const getYearNumber = (dateString) => {
    if (!dateString) return null;

    const d = new Date(`${dateString}T12:00:00`);
    return d.getFullYear();
  };

  const loadActiveStudents = async () => {
    try {
      if (!profile?.id) {
        Alert.alert('Error', 'No se encontró el perfil del coach.');
        return;
      }

      if (!selectedDate) {
        Alert.alert('Error', 'No se encontró la fecha del WOD.');
        return;
      }

      setLoadingStudents(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, level, plan_end_date, status')
        .eq('role', 'alumno')
        .eq('coach_id', profile.id)
        .eq('status', 'Active')
        .gte('plan_end_date', selectedDate)
        .order('full_name', { ascending: true });

      if (error) throw error;

      setActiveStudents(data || []);
      setSelectedStudentIds([]);
      setStudentsModalVisible(true);
    } catch (error) {
      console.error('Error cargando alumnos activos:', error.message);

      Alert.alert(
        'Error',
        'No se pudieron cargar los alumnos activos.'
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudentIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId);
      }

      return [...current, studentId];
    });
  };

  const selectAllStudents = () => {
    if (selectedStudentIds.length === activeStudents.length) {
      setSelectedStudentIds([]);
      return;
    }

    setSelectedStudentIds(activeStudents.map((student) => student.id));
  };

  const handleSave = async () => {
    Keyboard.dismiss();

    if (!title.trim()) {
      Alert.alert('Falta título', 'Ingresa un título para la rutina.');
      return;
    }

    setLoading(true);

    try {
      const formattedSections = getFormattedSections();

      // CASO 1: editar un plan existente
      if (plan?.id) {
        const { error } = await supabase
          .from('plans')
          .update({
            title: title.trim(),
            sections: formattedSections,
            is_done: false,
          })
          .eq('id', plan.id);

        if (error) throw error;

        setHasChanges(false);
        navigation.goBack();
        return;
      }

      // CASO 2: crear WOD desde Calendario V2 y luego asignar alumnos
      if (isCreateMultiple) {
        await loadActiveStudents();
        setLoading(false);
        return;
      }

      Alert.alert(
        'Aviso',
        'Este flujo necesita un alumno asociado. Usa el Calendario V2 para crear WODs masivos.'
      );

      setLoading(false);
    } catch (error) {
      console.error('Error guardando rutina:', error.message || error);
      setLoading(false);

      Alert.alert('Error', 'No se pudo guardar');
    }
  };

  const handleAssignWod = async () => {
    if (selectedStudentIds.length === 0) {
      Alert.alert(
        'Selecciona alumnos',
        'Debes seleccionar al menos un alumno.'
      );
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No se encontró el coach.');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Error', 'No se encontró la fecha del WOD.');
      return;
    }

    setAssigning(true);

    try {
      const formattedSections = getFormattedSections();

      const payload = selectedStudentIds.map((studentId) => ({
        student_id: studentId,
        coach_id: profile.id,
        date: selectedDate,
        title: title.trim(),
        sections: formattedSections,
        is_done: false,
        month: getMonthNumber(selectedDate),
        year: getYearNumber(selectedDate),
        day_name: getDayName(selectedDate),
      }));

      const { error } = await supabase
        .from('plans')
        .insert(payload);

      if (error) throw error;

      setHasChanges(false);
      setStudentsModalVisible(false);

      Alert.alert(
        'WOD asignado',
        `Se creó el WOD para ${selectedStudentIds.length} alumno${selectedStudentIds.length === 1 ? '' : 's'}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error asignando WOD:', error.message || error);

      Alert.alert(
        'Error',
        'No se pudo asignar el WOD a los alumnos.'
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons
            name="chevron-back"
            size={28}
            color="#FFD700"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          EDITOR TEAM W
        </Text>

        <View style={{ width: 28 }} />
      </View>

      {isCreateMultiple && selectedDate && (
        <View style={styles.dateBanner}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color="#FFD700"
          />

          <Text style={styles.dateBannerText}>
            WOD para el {selectedDate}
          </Text>
        </View>
      )}

      {holidayName && (
        <View style={styles.holidayBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color="#FF4D4D"
          />

          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.holidayTitle}>
              FERIADO
            </Text>

            <Text style={styles.holidayText}>
              {holidayName}
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>
            TÍTULO GENERAL
          </Text>

          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setHasChanges(true);
            }}
            placeholder="Ej: Empuje - Fuerza"
            placeholderTextColor="#444"
          />

          <Text style={styles.label}>
            BLOQUES DE TRABAJO
          </Text>

          {sections.map((section) => (
            <View
              key={section.id}
              style={styles.sectionCard}
            >
              <View style={styles.cardHeader}>
                <TextInput
                  style={styles.sectionNameInput}
                  value={section.name}
                  onChangeText={(val) =>
                    updateSection(section.id, 'name', val)
                  }
                  placeholder="Nombre de sección..."
                  placeholderTextColor="#555"
                />

                <TouchableOpacity
                  onPress={() => removeSection(section.id)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#ff4444"
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.contentInput}
                value={section.content}
                onChangeText={(val) =>
                  updateSection(section.id, 'content', val)
                }
                placeholder="Escribe la rutina..."
                placeholderTextColor="#333"
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={addSection}
            style={styles.addSectionBtn}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color="#FFD700"
            />

            <Text style={styles.addSectionText}>
              AGREGAR NUEVA SECCIÓN
            </Text>
          </TouchableOpacity>

          <View style={{ height: 150 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.mainSaveBtn,
            (loading || loadingStudents) && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={loading || loadingStudents}
        >
          {loading || loadingStudents ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.mainSaveText}>
              {isCreateMultiple ? 'GUARDAR Y ASIGNAR' : 'GUARDAR RUTINA'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={studentsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStudentsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalLabel}>
                  ASIGNAR WOD
                </Text>

                <Text style={styles.modalTitle}>
                  Seleccionar alumnos
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setStudentsModalVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#FFD700"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Solo aparecen alumnos activos con plan vigente hasta {selectedDate}.
            </Text>

            {activeStudents.length > 0 && (
              <TouchableOpacity
                style={styles.selectAllBtn}
                onPress={selectAllStudents}
              >
                <Text style={styles.selectAllText}>
                  {selectedStudentIds.length === activeStudents.length
                    ? 'DESELECCIONAR TODOS'
                    : 'SELECCIONAR TODOS'}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView style={styles.studentsScroll}>
              {activeStudents.length === 0 ? (
                <View style={styles.emptyStudents}>
                  <Ionicons
                    name="people-outline"
                    size={46}
                    color="#333"
                  />

                  <Text style={styles.emptyStudentsText}>
                    No hay alumnos activos para esta fecha.
                  </Text>
                </View>
              ) : (
                activeStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <TouchableOpacity
                      key={student.id}
                      style={[
                        styles.studentOption,
                        isSelected && styles.studentOptionSelected,
                      ]}
                      onPress={() => toggleStudent(student.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentAvatarText}>
                          {student.full_name?.charAt(0) || '?'}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>
                          {student.full_name || 'Alumno sin nombre'}
                        </Text>

                        <Text style={styles.studentSub}>
                          {student.level || 'Sin nivel'} · Plan hasta {student.plan_end_date || 'sin fecha'}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          isSelected
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={24}
                        color={isSelected ? '#FFD700' : '#555'}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.assignBtn,
                (assigning || selectedStudentIds.length === 0) && {
                  opacity: 0.6,
                },
              ]}
              onPress={handleAssignWod}
              disabled={assigning || selectedStudentIds.length === 0}
            >
              {assigning ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.assignBtnText}>
                  ASIGNAR WOD A {selectedStudentIds.length} ALUMNO{selectedStudentIds.length === 1 ? '' : 'S'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 55,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  dateBannerText: {
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 8,
  },

  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#170707',
    borderBottomWidth: 1,
    borderBottomColor: '#FF4D4D',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  holidayTitle: {
    color: '#FF4D4D',
    fontWeight: '900',
    fontSize: 11,
  },

  holidayText: {
    color: '#FF9B9B',
    marginTop: 2,
    fontSize: 12,
  },

  scroll: { padding: 20 },

  label: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 10,
    opacity: 0.8,
  },

  titleInput: {
    backgroundColor: '#0a0a0a',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },

  sectionCard: {
    backgroundColor: '#080808',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#151515',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 8,
  },

  sectionNameInput: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },

  contentInput: {
    color: '#eee',
    fontSize: 15,
    minHeight: 110,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingTop: 10,
  },

  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },

  addSectionText: {
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 13,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },

  mainSaveBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  mainSaveText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },

  modalBox: {
    backgroundColor: '#050505',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#222',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  modalLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  modalTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },

  modalSubtitle: {
    color: '#777',
    marginTop: 10,
    lineHeight: 18,
  },

  selectAllBtn: {
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },

  selectAllText: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 12,
  },

  studentsScroll: {
    marginTop: 15,
    maxHeight: 360,
  },

  studentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  studentOptionSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#191600',
  },

  studentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  studentAvatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },

  studentName: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  studentSub: {
    color: '#777',
    marginTop: 3,
    fontSize: 12,
  },

  emptyStudents: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyStudentsText: {
    color: '#777',
    marginTop: 12,
    textAlign: 'center',
  },

  assignBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 15,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 15,
  },

  assignBtnText: {
    color: '#000',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});