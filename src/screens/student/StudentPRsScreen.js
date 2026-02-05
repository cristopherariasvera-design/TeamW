import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, Switch 
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function StudentPRsScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('Fuerza');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isLbs, setIsLbs] = useState(false); // Estado para el conversor
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: movData } = await supabase.from('movements').select('*').order('name', { ascending: true });
      setMovements(movData || []);
      await fetchPRs();
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchPRs = async () => {
    const { data, error } = await supabase
      .from('prs')
      .select(`id, value, date, category, movements (name, unit, category)`)
      .eq('student_id', profile.id)
      .order('date', { ascending: false });

    if (!error) {
      const bestRecords = {};
      data.forEach(item => {
        const moveName = item.movements?.name;
        if (!bestRecords[moveName] || parseFloat(item.value.replace(':', '.')) > parseFloat(bestRecords[moveName].value.replace(':', '.'))) {
          bestRecords[moveName] = item;
        }
      });
      setPrs(Object.values(bestRecords));
    }
  };

  // --- LÓGICA DE FORMATEO ---
  const formatTime = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, cleaned.length - 2)}:${cleaned.slice(cleaned.length - 2)}`;
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
  };

  const handleValueChange = (text) => {
    if (selectedMovement?.unit === 'time') {
      setInputValue(formatTime(text));
    } else {
      setInputValue(text.replace(',', '.'));
    }
  };

  const handleSavePR = async () => {
    if (!selectedMovement || !inputValue) return Alert.alert("Error", "Ingresa una marca");

    let finalValue = inputValue;

    // Convertir LBS a KG si es necesario antes de guardar
    if (selectedMovement.unit === 'kg' && isLbs) {
      finalValue = (parseFloat(inputValue) * 0.453592).toFixed(1);
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('prs').insert([{
        student_id: profile.id,
        movement_id: selectedMovement.id,
        category: selectedMovement.category,
        value: finalValue.toString(),
        unit: selectedMovement.unit,
        date: new Date().toISOString().split('T')[0]
      }]);

      if (error) throw error;

      setModalVisible(false);
      setInputValue('');
      setSelectedMovement(null);
      setIsLbs(false);
      await fetchPRs();
      Alert.alert("¡Éxito!", isLbs ? `Guardado como ${finalValue} kg` : "Récord guardado");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MIS MARCAS</Text>
          <Text style={styles.headerSub}>Team W Records</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {['Fuerza', 'Benchmark'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && { color: '#FFD700' }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color="#FFD700" style={{marginTop: 50}} /> : (
        <ScrollView contentContainerStyle={styles.list}>
          {prs.filter(p => p.movements?.category === activeTab).map((pr) => (
            <View key={pr.id} style={styles.card}>
              <View>
                <Text style={styles.movementText}>{pr.movements?.name}</Text>
                <Text style={styles.dateText}>{pr.date}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.valueText}>{pr.value}</Text>
                <Text style={styles.unitText}>{pr.movements?.unit === 'kg' ? 'KG' : 'MIN'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REGISTRAR {activeTab.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#555" style={{ marginRight: 10 }} />
              <TextInput style={styles.searchInput} placeholder="Buscar ejercicio..." placeholderTextColor="#555" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {movements.filter(m => m.category === activeTab && m.name.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                <TouchableOpacity key={m.id} style={[styles.chip, selectedMovement?.id === m.id && styles.activeChip]} onPress={() => {setSelectedMovement(m); setInputValue('');}}>
                  <Text style={[styles.chipText, selectedMovement?.id === m.id && styles.activeChipText]}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedMovement && (
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Text style={styles.selectedTitle}>{selectedMovement.name}</Text>
                  {selectedMovement.unit === 'kg' && (
                    <View style={styles.switchContainer}>
                      <Text style={{color: isLbs ? '#FFD700' : '#444', fontSize: 10, fontWeight: 'bold'}}>LBS</Text>
                      <Switch 
                        value={isLbs} 
                        onValueChange={setIsLbs}
                        trackColor={{ false: "#222", true: "#333" }}
                        thumbColor={isLbs ? "#FFD700" : "#555"}
                      />
                    </View>
                  )}
                </View>

                <TextInput
                  style={styles.mainInput}
                  placeholder={selectedMovement.unit === 'kg' ? (isLbs ? "Peso en LBS" : "Peso en KG") : "00:00"}
                  placeholderTextColor="#333"
                  keyboardType="numeric"
                  value={inputValue}
                  onChangeText={handleValueChange}
                  maxLength={selectedMovement.unit === 'time' ? 5 : 6}
                />
                {isLbs && inputValue !== '' && (
                  <Text style={styles.conversionHint}>≈ { (parseFloat(inputValue) * 0.453).toFixed(1) } KG</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, (!selectedMovement || !inputValue) && { opacity: 0.5 }]} onPress={handleSavePR} disabled={isSaving || !selectedMovement || !inputValue}>
              {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>GUARDAR MARCA</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  header: { marginTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: '#555', fontSize: 12 },
  addBtn: { backgroundColor: '#FFD700', borderRadius: 10, padding: 8 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, padding: 5, marginTop: 20, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#1a1a1a' },
  tabText: { color: '#444', fontWeight: 'bold' },
  list: { paddingBottom: 50 },
  card: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1, borderColor: '#161616' },
  movementText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dateText: { color: '#444', fontSize: 11, marginTop: 4 },
  cardRight: { alignItems: 'flex-end' },
  valueText: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  unitText: { color: '#333', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0D0D0D', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616', paddingHorizontal: 15, borderRadius: 15, marginBottom: 20, height: 50 },
  searchInput: { flex: 1, color: '#fff' },
  chipScroll: { maxHeight: 50, marginBottom: 20 },
  chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1a1a1a', marginRight: 10, height: 40 },
  activeChip: { backgroundColor: '#FFD700' },
  chipText: { color: '#666', fontSize: 12 },
  activeChipText: { color: '#000', fontWeight: 'bold' },
  inputContainer: { marginTop: 10, alignItems: 'center', width: '100%' },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 10 },
  switchContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectedTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  mainInput: { width: '100%', backgroundColor: '#000', color: '#fff', padding: 20, borderRadius: 15, fontSize: 32, textAlign: 'center', borderWidth: 1, borderColor: '#333' },
  conversionHint: { color: '#FFD700', fontSize: 12, marginTop: 10, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#FFD700', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});