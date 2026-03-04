import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Switch,
  KeyboardAvoidingView, Platform, FlatList, Animated,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte "MM:SS" → segundos para comparar tiempos correctamente */
const timeToSeconds = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return (min || 0) * 60 + (sec || 0);
};

/** Compara dos valores según su unidad. Retorna true si newVal > currentBest */
const isNewPR = (newVal, currentVal, unit) => {
  if (!currentVal) return true;
  if (unit === 'time') {
    // En tiempo: MENOR es mejor (más rápido)
    return timeToSeconds(newVal) < timeToSeconds(currentVal);
  }
  return parseFloat(newVal) > parseFloat(currentVal);
};

/** Formatea fecha ISO → "15 mar 2024" */
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

/** Formatea tiempo en segundos → "MM:SS" */
const formatTime = (text) => {
  const cleaned = text.replace(/[^0-9]/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, cleaned.length - 2)}:${cleaned.slice(cleaned.length - 2)}`;
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
};

// ─── Hook de datos ────────────────────────────────────────────────────────────

function usePRData(studentId) {
  const [prs, setPrs] = useState([]); // mejor PR por movimiento
  const [history, setHistory] = useState({}); // historial por movimiento { [movName]: [...] }
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const [{ data: movData }, { data: prData }] = await Promise.all([
        supabase.from('movements').select('*').order('name', { ascending: true }),
        supabase
          .from('prs')
          .select('id, value, date, unit, movements (id, name, unit, category)')
          .eq('student_id', studentId)
          .order('date', { ascending: false }),
      ]);

      setMovements(movData || []);

      if (prData) {
        // Construir historial agrupado por movimiento
        const hist = {};
        prData.forEach(item => {
          const name = item.movements?.name;
          if (!name) return;
          if (!hist[name]) hist[name] = [];
          hist[name].push(item);
        });
        setHistory(hist);

        // Mejor PR por movimiento (comparación correcta según unidad)
        const bestMap = {};
        prData.forEach(item => {
          const name = item.movements?.name;
          const unit = item.movements?.unit;
          if (!name) return;
          if (!bestMap[name] || isNewPR(item.value, bestMap[name].value, unit)) {
            bestMap[name] = item;
          }
        });
        setPrs(Object.values(bestMap));
      }
    } catch (e) {
      console.error('usePRData error:', e);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { prs, history, movements, loading, refetch: fetchAll };
}

// ─── Componente: Tarjeta de PR ────────────────────────────────────────────────

function PRCard({ pr, onPress }) {
  const unit = pr.movements?.unit;
  const unitLabel = unit === 'kg' ? 'KG' : unit === 'time' ? 'MIN' : unit?.toUpperCase() || '';

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={cardStyles.left}>
        <Text style={cardStyles.name}>{pr.movements?.name}</Text>
        <Text style={cardStyles.date}>{fmtDate(pr.date)}</Text>
      </View>
      <View style={cardStyles.right}>
        <Text style={cardStyles.value}>{pr.value}</Text>
        <Text style={cardStyles.unit}>{unitLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="#2a2a2a" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: '#161616',
  },
  left: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  date: { color: '#383838', fontSize: 11, marginTop: 3 },
  right: { alignItems: 'flex-end', marginRight: 4 },
  value: { color: '#FFD700', fontSize: 24, fontWeight: '900', lineHeight: 26 },
  unit: { color: '#333', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
});

// ─── Componente: Modal de historial ──────────────────────────────────────────

function HistoryModal({ visible, movementName, records, onClose }) {
  const unit = records[0]?.movements?.unit;
  const unitLabel = unit === 'kg' ? 'KG' : unit === 'time' ? 'MIN' : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={histStyles.overlay}>
        <View style={histStyles.sheet}>
          <View style={histStyles.handle} />
          <View style={histStyles.header}>
            <View>
              <Text style={histStyles.label}>HISTORIAL</Text>
              <Text style={histStyles.title}>{movementName}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          {records.length === 0 ? (
            <Text style={histStyles.empty}>Sin registros</Text>
          ) : (
            <FlatList
              data={records}
              keyExtractor={r => r.id.toString()}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item, index }) => {
                const isBest = index === 0;
                return (
                  <View style={[histStyles.row, isBest && histStyles.rowBest]}>
                    {isBest && (
                      <View style={histStyles.crownBadge}>
                        <Ionicons name="trophy" size={10} color="#000" />
                      </View>
                    )}
                    <Text style={histStyles.rowDate}>{fmtDate(item.date)}</Text>
                    <View style={histStyles.rowRight}>
                      <Text style={[histStyles.rowValue, isBest && histStyles.rowValueBest]}>
                        {item.value}
                      </Text>
                      <Text style={histStyles.rowUnit}>{unitLabel}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const histStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '75%', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  handle: { width: 36, height: 4, backgroundColor: '#222', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  label: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  empty: { color: '#444', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  rowBest: { },
  crownBadge: { backgroundColor: '#FFD700', width: 20, height: 20, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rowDate: { flex: 1, color: '#555', fontSize: 13, marginLeft: 4 },
  rowRight: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  rowValue: { color: '#888', fontSize: 20, fontWeight: '700' },
  rowValueBest: { color: '#FFD700' },
  rowUnit: { color: '#333', fontSize: 9, fontWeight: 'bold' },
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StudentPRsScreen() {
  const { profile } = useAuth();
  const { prs, history, movements, loading, refetch } = usePRData(profile?.id);

  const [activeTab, setActiveTab] = useState('Fuerza');

  // Modal registro
  const [registerVisible, setRegisterVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isLbs, setIsLbs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef(null);

  // Modal historial
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyMovement, setHistoryMovement] = useState(null);

  // ── Abrir / cerrar modal registro ──
  const openRegister = () => {
    // ✅ FIX: Limpiar búsqueda y selección al abrir
    setSearchQuery('');
    setSelectedMovement(null);
    setInputValue('');
    setIsLbs(false);
    setRegisterVisible(true);
  };

  const closeRegister = () => {
    setRegisterVisible(false);
    // ✅ FIX: También limpiar al cerrar por si acaso
    setSearchQuery('');
    setSelectedMovement(null);
    setInputValue('');
    setIsLbs(false);
  };

  // ✅ FIX: Al seleccionar un movimiento, limpiar búsqueda también
  const handleSelectMovement = (m) => {
    setSelectedMovement(m);
    setInputValue('');
    setIsLbs(false);
    setSearchQuery(''); // ← limpia el buscador al seleccionar
    searchRef.current?.blur();
  };

  // ── Formateo de input ──
  const handleValueChange = (text) => {
    if (selectedMovement?.unit === 'time') {
      setInputValue(formatTime(text));
    } else {
      setInputValue(text.replace(',', '.'));
    }
  };

  // ── Guardar PR ──
  const handleSavePR = async () => {
    if (!selectedMovement || !inputValue) return;

    let finalValue = inputValue;
    if (selectedMovement.unit === 'kg' && isLbs) {
      finalValue = (parseFloat(inputValue) * 0.453592).toFixed(1);
    }

    // Verificar si supera el récord actual
    const currentBest = prs.find(p => p.movements?.id === selectedMovement.id);
    const isPR = isNewPR(finalValue, currentBest?.value, selectedMovement.unit);

    if (!isPR && currentBest) {
      Alert.alert(
        'No supera tu récord',
        `Tu marca actual es ${currentBest.value}${selectedMovement.unit === 'kg' ? ' KG' : ''}.\n¿Quieres guardar igual?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar igual', onPress: () => saveToSupabase(finalValue) },
        ]
      );
      return;
    }

    await saveToSupabase(finalValue, isPR);
  };

  const saveToSupabase = async (finalValue, isPR = false) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('prs').insert([{
        student_id: profile.id,
        movement_id: selectedMovement.id,
        category: selectedMovement.category,
        value: finalValue.toString(),
        unit: selectedMovement.unit,
        date: new Date().toISOString().split('T')[0],
      }]);
      if (error) throw error;

      closeRegister();
      await refetch();

      if (isPR) {
        Alert.alert(
          '🏆 ¡Nuevo Récord Personal!',
          isLbs
            ? `${inputValue} lbs = ${finalValue} kg guardado`
            : `${finalValue} ${selectedMovement.unit === 'kg' ? 'KG' : ''} registrado`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la marca');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Abrir historial ──
  const openHistory = (pr) => {
    setHistoryMovement(pr.movements?.name);
    setHistoryVisible(true);
  };

  // ── Filtros ──
  const filteredPRs = prs.filter(p => p.movements?.category === activeTab);
  const filteredMovements = movements.filter(m =>
    m.category === activeTab &&
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>RENDIMIENTO</Text>
          <Text style={styles.headerTitle}>Mis Marcas</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openRegister}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        {['Fuerza', 'Benchmark'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
            {activeTab === tab && (
              <View style={styles.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTA */}
      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filteredPRs.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={52} color="#1a1a1a" />
              <Text style={styles.emptyTitle}>Sin marcas aún</Text>
              <Text style={styles.emptySub}>Registra tu primer PR con el botón +</Text>
            </View>
          )}
          {filteredPRs.map(pr => (
            <PRCard
              key={pr.id}
              pr={pr}
              onPress={() => openHistory(pr)}
            />
          ))}
        </ScrollView>
      )}

      {/* ── MODAL: REGISTRAR PR ── */}
      <Modal
        animationType="slide"
        transparent
        visible={registerVisible}
        onRequestClose={closeRegister}
      >
        {/* ✅ FIX: Separar overlay (para cerrar al tocar afuera) del sheet
            El TouchableOpacity de fondo NO envuelve el sheet — están como hermanos */}
        <View style={modalStyles.outerContainer}>
          <TouchableOpacity
            style={modalStyles.backdrop}
            onPress={closeRegister}
            activeOpacity={1}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={modalStyles.kavWrapper}
          >
            <View style={modalStyles.sheet}>
              <View style={modalStyles.handle} />

              {/* Header modal */}
              <View style={modalStyles.header}>
                <View>
                  <Text style={modalStyles.eyebrow}>NUEVA MARCA</Text>
                  <Text style={modalStyles.title}>{activeTab}</Text>
                </View>
                <TouchableOpacity onPress={closeRegister}>
                  <Ionicons name="close-circle" size={30} color="#222" />
                </TouchableOpacity>
              </View>

              {/* Buscador */}
              <View style={modalStyles.searchBar}>
                <Ionicons name="search" size={16} color="#444" />
                <TextInput
                  ref={searchRef}
                  style={modalStyles.searchInput}
                  placeholder="Buscar movimiento..."
                  placeholderTextColor="#444"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  // ✅ FIX: Al cambiar búsqueda, deseleccionar movimiento
                  onFocus={() => setSelectedMovement(null)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#444" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Chips de movimientos */}
              {!selectedMovement && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={modalStyles.chipScroll}
                  contentContainerStyle={{ paddingRight: 20 }}
                >
                  {filteredMovements.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={modalStyles.chip}
                      onPress={() => handleSelectMovement(m)}
                    >
                      <Text style={modalStyles.chipText}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredMovements.length === 0 && (
                    <Text style={modalStyles.noResults}>Sin resultados para "{searchQuery}"</Text>
                  )}
                </ScrollView>
              )}

              {/* Input de valor */}
              {selectedMovement && (
                <View style={modalStyles.inputSection}>
                  {/* Movimiento seleccionado con opción de cambiar */}
                  <TouchableOpacity
                    style={modalStyles.selectedMovTag}
                    onPress={() => { setSelectedMovement(null); setInputValue(''); }}
                  >
                    <Text style={modalStyles.selectedMovName}>{selectedMovement.name}</Text>
                    <Ionicons name="close-circle" size={16} color="#555" />
                  </TouchableOpacity>

                  <View style={modalStyles.inputHeader}>
                    <Text style={modalStyles.inputLabel}>
                      {selectedMovement.unit === 'time' ? 'TIEMPO (MM:SS)' : 'PESO'}
                    </Text>
                    {selectedMovement.unit === 'kg' && (
                      <View style={modalStyles.switchRow}>
                        <Text style={[modalStyles.switchLabel, !isLbs && modalStyles.switchLabelActive]}>KG</Text>
                        <Switch
                          value={isLbs}
                          onValueChange={setIsLbs}
                          trackColor={{ false: '#1a1a1a', true: '#2a2a2a' }}
                          thumbColor={isLbs ? '#FFD700' : '#444'}
                        />
                        <Text style={[modalStyles.switchLabel, isLbs && modalStyles.switchLabelActive]}>LBS</Text>
                      </View>
                    )}
                  </View>

                  <TextInput
                    style={modalStyles.mainInput}
                    placeholder={selectedMovement.unit === 'time' ? '00:00' : isLbs ? '0 lbs' : '0 kg'}
                    placeholderTextColor="#2a2a2a"
                    keyboardType="numeric"
                    value={inputValue}
                    onChangeText={handleValueChange}
                    maxLength={selectedMovement.unit === 'time' ? 5 : 6}
                    autoFocus
                  />

                  {isLbs && inputValue !== '' && !isNaN(parseFloat(inputValue)) && (
                    <View style={modalStyles.conversionRow}>
                      <Ionicons name="swap-horizontal" size={12} color="#FFD700" />
                      <Text style={modalStyles.conversionText}>
                        {(parseFloat(inputValue) * 0.453592).toFixed(1)} KG
                      </Text>
                    </View>
                  )}

                  {/* PR actual */}
                  {prs.find(p => p.movements?.id === selectedMovement.id) && (
                    <Text style={modalStyles.currentPR}>
                      Marca actual: {prs.find(p => p.movements?.id === selectedMovement.id)?.value}
                      {selectedMovement.unit === 'kg' ? ' KG' : ''}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[modalStyles.saveBtn, (!selectedMovement || !inputValue) && modalStyles.saveBtnDisabled]}
                onPress={handleSavePR}
                disabled={isSaving || !selectedMovement || !inputValue}
              >
                {isSaving
                  ? <ActivityIndicator color="#000" />
                  : <Text style={modalStyles.saveBtnText}>GUARDAR MARCA</Text>
                }
              </TouchableOpacity>

              <View style={{ height: Platform.OS === 'ios' ? 20 : 30 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MODAL: HISTORIAL ── */}
      <HistoryModal
        visible={historyVisible}
        movementName={historyMovement}
        records={historyMovement ? (history[historyMovement] || []) : []}
        onClose={() => setHistoryVisible(false)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },

  header: { marginTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerEyebrow: { color: '#333', fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 2 },
  addBtn: { backgroundColor: '#FFD700', borderRadius: 12, width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#111' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 11 },
  activeTab: { backgroundColor: '#111' },
  tabText: { color: '#333', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#FFD700' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFD700', marginTop: 4 },

  list: { paddingBottom: 60, paddingTop: 4 },

  emptyState: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub: { color: '#333', fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  // FIX: backdrop y sheet son hermanos, no anidados
  outerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  kavWrapper: {},
  sheet: {
    backgroundColor: '#0a0a0a', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  handle: { width: 36, height: 4, backgroundColor: '#1e1e1e', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
    paddingHorizontal: 14, borderRadius: 14, marginBottom: 16,
    height: 46, borderWidth: 1, borderColor: '#1a1a1a', gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  noResults: { color: '#333', fontSize: 13, paddingTop: 10 },

  chipScroll: { maxHeight: 46, marginBottom: 20 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
    backgroundColor: '#111', marginRight: 8, borderWidth: 1, borderColor: '#1c1c1c',
  },
  chipText: { color: '#888', fontSize: 12, fontWeight: '600' },

  inputSection: { marginBottom: 8 },
  selectedMovTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: '#FFD70033',
  },
  selectedMovName: { color: '#FFD700', fontWeight: '700', fontSize: 14 },

  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  inputLabel: { color: '#444', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { color: '#333', fontSize: 11, fontWeight: 'bold' },
  switchLabelActive: { color: '#FFD700' },

  mainInput: {
    backgroundColor: '#050505', color: '#fff', padding: 20,
    borderRadius: 18, fontSize: 36, fontWeight: '900', textAlign: 'center',
    borderWidth: 1, borderColor: '#1a1a1a', letterSpacing: 2,
  },

  conversionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  conversionText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  currentPR: { color: '#333', fontSize: 12, textAlign: 'center', marginTop: 8 },

  saveBtn: {
    backgroundColor: '#FFD700', padding: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
});
