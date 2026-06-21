import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const SelectionModal = ({ visible, onClose, title, data, selectedIds, onToggle }) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.modalItem, selectedIds.includes(item.id) && styles.tagSelected]} 
              onPress={() => onToggle(item.id)}
            >
              <Text>{item.name}</Text>
              {selectedIds.includes(item.id) && <MCIcon name="check" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>Done</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const EditDoctorScreen = ({ route, navigation }) => {
  const { doctorId } = route.params;
  const [loading, setLoading] = useState(true);
  const [editedDoctor, setEditedDoctor] = useState(null);
  const [modalType, setModalType] = useState(null); 
  
  const [specialties, setSpecialties] = useState([]);
  const [allExpertise, setAllExpertise] = useState([]);
  const [allLanguages, setAllLanguages] = useState([]);
  const [slotTimingsByDay, setSlotTimingsByDay] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  useEffect(() => {
    if (!doctorId) {
      setEditedDoctor({
        name: 'New Doctor',
        about: '',
        education: '',
        experience: 0,
        fee: 0,
        specialty_ids: [],
        expertise_ids: [],
        language_ids: []
      });
      // Fetch metadata for new doctor
      Promise.all([
        apiClient.get(ENDPOINTS.SPECIALTIES),
        apiClient.get(ENDPOINTS.EXPERTISES),
        apiClient.get(ENDPOINTS.LANGUAGES),
        apiClient.get(ENDPOINTS.SLOT_TIMINGS),
      ]).then(([specRes, expRes, langRes, slotRes]) => {
        setSpecialties(specRes.data || specRes || []);
        setAllExpertise(expRes.data || expRes || []);
        setAllLanguages(langRes.data || langRes || []);
        setSlotTimingsByDay(slotRes.data || slotRes || []);
      }).finally(() => setLoading(false));
      return;
    }

    Promise.all([
      apiClient.get(ENDPOINTS.DOCTOR_DETAIL(doctorId)),
      apiClient.get(ENDPOINTS.SPECIALTIES),
      apiClient.get(ENDPOINTS.EXPERTISES),
      apiClient.get(ENDPOINTS.LANGUAGES),
      apiClient.get(ENDPOINTS.SLOT_TIMINGS),
      apiClient.get(ENDPOINTS.DOCTOR_AVAILABILITY(doctorId)),
    ]).then(([docRes, specRes, expRes, langRes, slotRes, availRes]) => {
      const doc = docRes.data || docRes;
      setEditedDoctor({
        ...doc,
        specialty_ids: doc.specialty_ids || [], 
        expertise_ids: doc.expertise_ids || [],
        language_ids: doc.language_ids || [],
        about: doc.about || '',
        education: doc.education || '',
        experience: doc.experience || 0,
        fee: doc.fee || 0,
      });
      setSpecialties(specRes.data || specRes || []);
      setAllExpertise(expRes.data || expRes || []);
      setAllLanguages(langRes.data || langRes || []);
      setSlotTimingsByDay(slotRes.data || slotRes || []);
      const availData = availRes.data || availRes || [];
      setSelectedSlotIds(availData.map(a => a.slot_timing_id));
    }).catch(() => Alert.alert('Error', 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const handleSave = () => {
    setLoading(true);
    const payload = {
        ...editedDoctor,
        specialty_ids: editedDoctor.specialty_ids || [],
        slot_timing_ids: selectedSlotIds
    };
    
    const request = doctorId 
        ? apiClient.put(ENDPOINTS.DOCTOR_DETAIL(doctorId), payload)
        : apiClient.post(ENDPOINTS.DOCTORS, payload); // Assumes creation endpoint exists
    
    request
      .then((res) => {
        Alert.alert('Success', `Doctor ${doctorId ? 'updated' : 'created'} successfully`);
        navigation.goBack();
      })
      .catch((error) => {
        console.error("Save error:", error);
        Alert.alert('Error', error.message || 'Failed to save doctor details. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  const toggleSelection = (key, itemId) => {
    const current = editedDoctor[key] || [];
    const updated = current.includes(itemId) 
      ? current.filter(id => id !== itemId)
      : [...current, itemId];
    setEditedDoctor({...editedDoctor, [key]: updated});
  };

  const renderSelectedTags = (key, dataList) => {
    const selectedIds = editedDoctor[key] || [];
    if (selectedIds.length === 0) return null;
    return (
      <ScrollView horizontal style={styles.tagScroll} showsHorizontalScrollIndicator={false}>
        {selectedIds.map(id => {
          const item = dataList.find(i => i.id === id);
          return item ? (
            <View key={id} style={styles.tag}>
              <Text style={styles.tagText}>{item.name}</Text>
            </View>
          ) : null;
        })}
      </ScrollView>
    );
  };

  const addAward = () => {
    setEditedDoctor({
        ...editedDoctor,
        awards: [...(editedDoctor.awards || []), { title: '', issuer: '', year: new Date().getFullYear(), description: '' }]
    });
  };

  const updateAward = (index, key, value) => {
    const updatedAwards = [...(editedDoctor.awards || [])];
    updatedAwards[index] = { ...updatedAwards[index], [key]: value };
    setEditedDoctor({ ...editedDoctor, awards: updatedAwards });
  };

  const removeAward = (index) => {
    const updatedAwards = (editedDoctor.awards || []).filter((_, i) => i !== index);
    setEditedDoctor({ ...editedDoctor, awards: updatedAwards });
  };

  const addClinic = () => {
    setEditedDoctor({
      ...editedDoctor,
      clinics: [...(editedDoctor.clinics || []), { name: '', address: '', city: '', phone: '', is_primary: false }]
    });
  };

  const updateClinic = (index, key, value) => {
    const updatedClinics = [...(editedDoctor.clinics || [])];
    updatedClinics[index] = { ...updatedClinics[index], [key]: value };
    setEditedDoctor({ ...editedDoctor, clinics: updatedClinics });
  };

  const removeClinic = (index) => {
    const updatedClinics = (editedDoctor.clinics || []).filter((_, i) => i !== index);
    setEditedDoctor({ ...editedDoctor, clinics: updatedClinics });
  };

  if (loading) return <View style={styles.root}><Text style={styles.loading}>Loading...</Text></View>;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Doctor Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={[styles.input, styles.disabled]} value={editedDoctor.name} editable={false} />
        
        {!doctorId && (
            <>
                <Text style={styles.label}>User ID (To link doctor profile)</Text>
                <TextInput style={styles.input} value={String(editedDoctor.user_id || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, user_id: parseInt(val) || 0})} placeholder="User ID" keyboardType="numeric" />
            </>
        )}

        <Text style={styles.label}>Specialties</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('specialty')}>
            <Text>{editedDoctor.specialty_ids?.length ? `${editedDoctor.specialty_ids.length} selected` : 'Select Specialties'}</Text>
        </TouchableOpacity>
        {renderSelectedTags('specialty_ids', specialties)}
        
        <Text style={styles.label}>About</Text>
        <TextInput style={styles.input} value={editedDoctor.about} onChangeText={(val) => setEditedDoctor({...editedDoctor, about: val})} placeholder="Enter doctor's biography" multiline />
        
        <Text style={styles.label}>Education</Text>
        <TextInput style={styles.input} value={editedDoctor.education} onChangeText={(val) => setEditedDoctor({...editedDoctor, education: val})} placeholder="e.g. MBBS, MD" />
        
        <Text style={styles.label}>Experience (Years)</Text>
        <TextInput style={styles.input} value={String(editedDoctor.experience || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, experience: parseInt(val) || 0})} placeholder="Years of experience" keyboardType="numeric" />
        
        <Text style={styles.label}>Consultation Fee</Text>
        <TextInput style={styles.input} value={String(editedDoctor.fee || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, fee: parseInt(val) || 0})} placeholder="Fee per consultation" keyboardType="numeric" />

        <Text style={styles.label}>Expertise</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('expertise')}>
            <Text>{editedDoctor.expertise_ids?.length ? `${editedDoctor.expertise_ids.length} selected` : 'Select Expertise'}</Text>
        </TouchableOpacity>
        {renderSelectedTags('expertise_ids', allExpertise)}
        
        <Text style={styles.label}>Languages</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('language')}>
            <Text>{editedDoctor.language_ids?.length ? `${editedDoctor.language_ids.length} selected` : 'Select Languages'}</Text>
        </TouchableOpacity>
        {renderSelectedTags('language_ids', allLanguages)}

        <Text style={styles.sectionLabel}>Weekly Time Slots</Text>
        <Text style={styles.subLabel}>Select when this doctor is available</Text>
        {slotTimingsByDay.map((day) => (
          <View key={day.id} style={styles.daySection}>
            <Text style={styles.dayLabel}>{day.day}</Text>
            <View style={styles.slotRow}>
              {day.slots.length === 0 ? (
                <Text style={styles.noSlots}>No slots configured</Text>
              ) : (
                day.slots.map((slot) => {
                  const selected = selectedSlotIds.includes(slot.id);
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotChip, selected && styles.slotChipSelected]}
                      onPress={() => {
                        setSelectedSlotIds(prev =>
                          prev.includes(slot.id)
                            ? prev.filter(id => id !== slot.id)
                            : [...prev, slot.id]
                        );
                      }}
                    >
                      <Text style={[styles.slotChipText, selected && styles.slotChipTextSelected]}>
                        {slot.start_time ? slot.start_time.substring(0, 5) : ''} - {slot.end_time ? slot.end_time.substring(0, 5) : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Awards</Text>
        {editedDoctor.awards?.map((award, index) => (
            <View key={index} style={styles.awardInputCard}>
                <Text style={styles.label}>Award Title</Text>
                <TextInput style={styles.input} placeholder="e.g. Best Doctor" value={award.title} onChangeText={(val) => updateAward(index, 'title', val)} />
                
                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Issuer</Text>
                        <TextInput style={styles.input} placeholder="e.g. Health Assoc" value={award.issuer} onChangeText={(val) => updateAward(index, 'issuer', val)} />
                    </View>
                    <View style={{width: 80, marginLeft: 8}}>
                        <Text style={styles.label}>Year</Text>
                        <TextInput style={styles.input} placeholder="2024" value={String(award.year || '')} onChangeText={(val) => updateAward(index, 'year', parseInt(val))} keyboardType="numeric" />
                    </View>
                </View>
                
                <Text style={styles.label}>Description</Text>
                <TextInput style={styles.input} placeholder="Brief description" value={award.description} onChangeText={(val) => updateAward(index, 'description', val)} multiline />
                
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeAward(index)}>
                    <Text style={{color: COLORS.danger, fontWeight: '600'}}>Remove Award</Text>
                </TouchableOpacity>
            </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addAward}>
            <MCIcon name="plus" size={18} color={COLORS.primary} style={{marginRight: 8}} />
            <Text style={{color: COLORS.primary, fontWeight: '700'}}>Add Award</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Clinics</Text>
        {editedDoctor.clinics?.map((clinic, index) => (
          <View key={index} style={styles.awardInputCard}>
            <View style={styles.clinicHeaderRow}>
              <Text style={styles.label}>Clinic Name</Text>
              <TouchableOpacity onPress={() => updateClinic(index, 'is_primary', !clinic.is_primary)}>
                <View style={[styles.primaryToggle, clinic.is_primary && styles.primaryToggleActive]}>
                  <Text style={[styles.primaryToggleText, clinic.is_primary && styles.primaryToggleTextActive]}>
                    {clinic.is_primary ? 'Primary' : 'Set as Primary'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="e.g. Sarah Acupressure Clinic" value={clinic.name} onChangeText={(val) => updateClinic(index, 'name', val)} />

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} placeholder="e.g. 123 MG Road" value={clinic.address} onChangeText={(val) => updateClinic(index, 'address', val)} />

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>City</Text>
                <TextInput style={styles.input} placeholder="e.g. Bangalore" value={clinic.city} onChangeText={(val) => updateClinic(index, 'city', val)} />
              </View>
              <View style={{flex: 1, marginLeft: 8}}>
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} placeholder="e.g. +91-9876543210" value={clinic.phone} onChangeText={(val) => updateClinic(index, 'phone', val)} keyboardType="phone-pad" />
              </View>
            </View>

            <TouchableOpacity style={styles.removeBtn} onPress={() => removeClinic(index)}>
              <Text style={{color: COLORS.danger, fontWeight: '600'}}>Remove Clinic</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addClinic}>
            <MCIcon name="plus" size={18} color={COLORS.primary} style={{marginRight: 8}} />
            <Text style={{color: COLORS.primary, fontWeight: '700'}}>Add Clinic</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <SelectionModal 
        visible={!!modalType}
        onClose={() => setModalType(null)}
        title={`Select ${modalType || ''}`}
        data={modalType === 'specialty' ? specialties : modalType === 'expertise' ? allExpertise : allLanguages}
        selectedIds={modalType === 'specialty' ? editedDoctor.specialty_ids : modalType === 'expertise' ? editedDoctor.expertise_ids : editedDoctor.language_ids}
        onToggle={(id) => toggleSelection(modalType === 'specialty' ? 'specialty_ids' : modalType === 'expertise' ? 'expertise_ids' : 'language_ids', id)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  content: { padding: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginTop: 20, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.white, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#ddd' },
  disabled: { backgroundColor: '#f0f0f0' },
  tagScroll: { marginTop: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.primaryLight, borderRadius: 16, marginRight: 8 },
  tagText: { color: COLORS.primary, fontSize: 13, fontWeight: '500' },
  loading: { textAlign: 'center', marginTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: 15, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5 },
  modalItem: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      paddingHorizontal: 10,
      borderBottomWidth: 1, 
      borderBottomColor: '#eee',
      marginVertical: 2
  },
  tagSelected: { backgroundColor: '#e6f7ff' },
  closeButton: { marginTop: 20, backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center' },
  closeButtonText: { color: COLORS.white, fontWeight: 'bold' },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#eee' },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#eee', marginRight: 10 },
  saveButton: { backgroundColor: COLORS.primary },
  cancelButtonText: { color: COLORS.textPrimary, fontWeight: 'bold' },
  saveButtonText: { color: COLORS.white, fontWeight: 'bold' },
  awardInputCard: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  subLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  row: { flexDirection: 'row' },
  removeBtn: { marginTop: 8, alignSelf: 'flex-end' },
  addBtn: { padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center', marginBottom: 20, flexDirection: 'row', justifyContent: 'center' },
  daySection: { marginBottom: 12 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6, marginTop: 4 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noSlots: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  slotChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#ccc', backgroundColor: COLORS.white },
  slotChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotChipText: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '500' },
  slotChipTextSelected: { color: COLORS.white },
  clinicHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary },
  primaryToggleActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  primaryToggleText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  primaryToggleTextActive: { color: COLORS.primary },
});

export default EditDoctorScreen;
