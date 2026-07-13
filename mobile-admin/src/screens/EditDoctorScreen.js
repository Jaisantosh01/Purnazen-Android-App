import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { EditFormSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

const SelectionModal = ({ visible, onClose, title, data, selectedIds, onToggle }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
              <Text style={{color: colors.textPrimary}}>{item.name}</Text>
              {selectedIds.includes(item.id) && <MCIcon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>Done</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
};

const EditDoctorScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        name: '',
        email: '',
        password: '',
        phone: '',
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
    }).catch(() => showAlert('Error', 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const handleSave = () => {
    setLoading(true);

    if (!doctorId && (!editedDoctor.email || !editedDoctor.password || !editedDoctor.name)) {
        showAlert('Validation Error', 'Full Name, Email, and Password are required');
        setLoading(false);
        return;
    }

    const payload = {
        ...editedDoctor,
        specialty_ids: editedDoctor.specialty_ids || [],
        slot_timing_ids: selectedSlotIds
    };

    const request = doctorId
        ? apiClient.put(ENDPOINTS.DOCTOR_DETAIL(doctorId), payload)
        : apiClient.post(ENDPOINTS.DOCTORS, payload);

    request
      .then((res) => {
        showAlert('Success', `Doctor ${doctorId ? 'updated' : 'created'} successfully`);
        navigation.goBack();
      })
      .catch((error) => {
        console.error("Save error:", error);
        showAlert('Error', error.message || 'Failed to save doctor details. Please try again.');
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

  if (loading) return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Doctor Details" onBack={() => navigation.goBack()} />
      <EditFormSkeleton />
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Doctor Details" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {doctorId ? (
            <>
                <Text style={styles.sectionLabel}>Account Details</Text>
                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={editedDoctor.full_name} onChangeText={(val) => setEditedDoctor({...editedDoctor, full_name: val})} placeholder="Enter full name" placeholderTextColor={colors.textMuted} />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={editedDoctor.email} onChangeText={(val) => setEditedDoctor({...editedDoctor, email: val})} placeholder="email@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={editedDoctor.phone} onChangeText={(val) => setEditedDoctor({...editedDoctor, phone: val})} placeholder="+91-9876543210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            </>
        ) : (
            <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={editedDoctor.name} onChangeText={(val) => setEditedDoctor({...editedDoctor, name: val})} placeholder="Enter full name" placeholderTextColor={colors.textMuted} />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={editedDoctor.email} onChangeText={(val) => setEditedDoctor({...editedDoctor, email: val})} placeholder="email@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Password</Text>
                <TextInput style={styles.input} value={editedDoctor.password} onChangeText={(val) => setEditedDoctor({...editedDoctor, password: val})} placeholder="Enter password" placeholderTextColor={colors.textMuted} secureTextEntry />

                <Text style={styles.label}>Phone (optional)</Text>
                <TextInput style={styles.input} value={editedDoctor.phone} onChangeText={(val) => setEditedDoctor({...editedDoctor, phone: val})} placeholder="+91-9876543210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            </>
        )}

        <Text style={styles.label}>Specialties</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('specialty')}>
            <Text style={{color: colors.textPrimary}}>{editedDoctor.specialty_ids?.length ? `${editedDoctor.specialty_ids.length} selected` : 'Select Specialties'}</Text>
        </TouchableOpacity>
        {renderSelectedTags('specialty_ids', specialties)}
        
        <Text style={styles.label}>About</Text>
        <TextInput style={styles.input} value={editedDoctor.about} onChangeText={(val) => setEditedDoctor({...editedDoctor, about: val})} placeholder="Enter doctor's biography" placeholderTextColor={colors.textMuted} multiline />
        
        <Text style={styles.label}>Education</Text>
        <TextInput style={styles.input} value={editedDoctor.education} onChangeText={(val) => setEditedDoctor({...editedDoctor, education: val})} placeholder="e.g. MBBS, MD" placeholderTextColor={colors.textMuted} />
        
        <Text style={styles.label}>Experience (Years)</Text>
        <TextInput style={styles.input} value={String(editedDoctor.experience || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, experience: parseInt(val) || 0})} placeholder="Years of experience" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
        
        <Text style={styles.label}>Consultation Fee</Text>
        <TextInput style={styles.input} value={String(editedDoctor.fee || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, fee: parseInt(val) || 0})} placeholder="Fee per consultation" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        <Text style={styles.label}>Expertise</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('expertise')}>
            <Text style={{color: colors.textPrimary}}>{editedDoctor.expertise_ids?.length ? `${editedDoctor.expertise_ids.length} selected` : 'Select Expertise'}</Text>
        </TouchableOpacity>
        {renderSelectedTags('expertise_ids', allExpertise)}
        
        <Text style={styles.label}>Languages</Text>
        <TouchableOpacity style={styles.input} onPress={() => setModalType('language')}>
            <Text style={{color: colors.textPrimary}}>{editedDoctor.language_ids?.length ? `${editedDoctor.language_ids.length} selected` : 'Select Languages'}</Text>
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
                <TextInput style={styles.input} placeholder="e.g. Best Doctor" placeholderTextColor={colors.textMuted} value={award.title} onChangeText={(val) => updateAward(index, 'title', val)} />
                
                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Issuer</Text>
                        <TextInput style={styles.input} placeholder="e.g. Health Assoc" placeholderTextColor={colors.textMuted} value={award.issuer} onChangeText={(val) => updateAward(index, 'issuer', val)} />
                    </View>
                    <View style={{width: 80, marginLeft: 8}}>
                        <Text style={styles.label}>Year</Text>
                        <TextInput style={styles.input} placeholder="2024" placeholderTextColor={colors.textMuted} value={String(award.year || '')} onChangeText={(val) => updateAward(index, 'year', parseInt(val))} keyboardType="numeric" />
                    </View>
                </View>
                
                <Text style={styles.label}>Description</Text>
                <TextInput style={styles.input} placeholder="Brief description" placeholderTextColor={colors.textMuted} value={award.description} onChangeText={(val) => updateAward(index, 'description', val)} multiline />
                
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeAward(index)}>
                    <Text style={{color: colors.danger, fontWeight: '600'}}>Remove Award</Text>
                </TouchableOpacity>
            </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addAward}>
            <MCIcon name="plus" size={18} color={colors.primary} style={{marginRight: 8}} />
            <Text style={{color: colors.primary, fontWeight: '700'}}>Add Award</Text>
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
            <TextInput style={styles.input} placeholder="e.g. Sarah Acupressure Clinic" placeholderTextColor={colors.textMuted} value={clinic.name} onChangeText={(val) => updateClinic(index, 'name', val)} />

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} placeholder="e.g. 123 MG Road" placeholderTextColor={colors.textMuted} value={clinic.address} onChangeText={(val) => updateClinic(index, 'address', val)} />

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>City</Text>
                <TextInput style={styles.input} placeholder="e.g. Bangalore" placeholderTextColor={colors.textMuted} value={clinic.city} onChangeText={(val) => updateClinic(index, 'city', val)} />
              </View>
              <View style={{flex: 1, marginLeft: 8}}>
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} placeholder="e.g. +91-9876543210" placeholderTextColor={colors.textMuted} value={clinic.phone} onChangeText={(val) => updateClinic(index, 'phone', val)} keyboardType="phone-pad" />
              </View>
            </View>

            <TouchableOpacity style={styles.removeBtn} onPress={() => removeClinic(index)}>
              <Text style={{color: colors.danger, fontWeight: '600'}}>Remove Clinic</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addClinic}>
            <MCIcon name="plus" size={18} color={colors.primary} style={{marginRight: 8}} />
            <Text style={{color: colors.primary, fontWeight: '700'}}>Add Clinic</Text>
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

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: colors.card, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.borderStrong, color: colors.textPrimary },
  disabled: { backgroundColor: colors.surfaceMuted },
  tagScroll: { marginTop: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primaryLight, borderRadius: 16, marginRight: 8 },
  tagText: { color: colors.primary, fontSize: 13, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.card, borderRadius: 12, padding: 15, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5, color: colors.textPrimary },
  modalItem: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      paddingHorizontal: 10,
      borderBottomWidth: 1, 
      borderBottomColor: colors.border,
      marginVertical: 2
  },
  tagSelected: { backgroundColor: colors.surfaceMuted },
  closeButton: { marginTop: 20, backgroundColor: colors.primary, padding: 15, borderRadius: 8, alignItems: 'center' },
  closeButtonText: { color: colors.white, fontWeight: 'bold' },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.surfaceMuted, marginRight: 10 },
  saveButton: { backgroundColor: colors.primary },
  cancelButtonText: { color: colors.textPrimary, fontWeight: 'bold' },
  saveButtonText: { color: colors.white, fontWeight: 'bold' },
  awardInputCard: { backgroundColor: colors.surfaceMuted, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  subLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  row: { flexDirection: 'row' },
  removeBtn: { marginTop: 8, alignSelf: 'flex-end' },
  addBtn: { padding: 12, backgroundColor: colors.surfaceMuted, borderRadius: 8, alignItems: 'center', marginBottom: 20, flexDirection: 'row', justifyContent: 'center' },
  daySection: { marginBottom: 12 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, marginTop: 4 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noSlots: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  slotChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card },
  slotChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  slotChipTextSelected: { color: colors.white },
  clinicHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.primary },
  primaryToggleActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  primaryToggleText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  primaryToggleTextActive: { color: colors.primary },
});

export default EditDoctorScreen;
