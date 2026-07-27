import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Linking,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { EditFormSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';
import { showAlert, showConfirm } from '../utils/alert';
import { mapsUrl, validateClinicLocation } from '../utils/geo';
import { _pullPendingClinic } from './ClinicAddressPickerScreen';

/**
 * The form is walked one section at a time rather than as one endless scroll:
 * a doctor record spans six unrelated concerns and the single-page version ran
 * past a dozen screens, so a half-filled record was impossible to audit.
 *
 * The chips double as tabs — Next/Back is the guided path for a new doctor,
 * while an admin fixing one field on an existing one jumps straight to it and
 * uses Save in the header. Saving always validates every step, not just the
 * visible one, and lands on the first that still needs attention.
 */
const STEPS = [
  { key: 'account', label: 'Account', icon: 'account-outline' },
  { key: 'profile', label: 'Profile', icon: 'card-account-details-outline' },
  { key: 'fees', label: 'Fees', icon: 'cash-multiple' },
  { key: 'availability', label: 'Availability', icon: 'calendar-clock' },
  { key: 'clinics', label: 'Clinics', icon: 'hospital-building' },
  { key: 'awards', label: 'Awards', icon: 'trophy-outline' },
];

const LAST_STEP = STEPS.length - 1;

/** A clinic row is only "done" once the columns the API requires are filled. */
const isClinicComplete = clinic =>
  !!(clinic?.name?.trim() && clinic?.address?.trim() && clinic?.city?.trim());

const isAwardComplete = award =>
  !!(award?.title?.trim() && award?.issuer?.trim() && award?.year);

/** Field label with a red asterisk for the columns the API refuses to null. */
const RequiredLabel = ({ text, styles }) => (
  <Text style={styles.label}>
    {text}
    <Text style={styles.requiredStar}> *</Text>
  </Text>
);

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
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.modalItem, selected && styles.modalItemSelected]}
                onPress={() => onToggle(item.id)}
              >
                <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>
                  {item.name}
                </Text>
                {selected && <MCIcon name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          }}
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
  const [saving, setSaving] = useState(false);
  const [editedDoctor, setEditedDoctor] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  // Steps only show their missing fields once the admin has tried to leave them
  // (or hit Save) — a blank form shouldn't open covered in red.
  const [touchedSteps, setTouchedSteps] = useState({});

  const [specialties, setSpecialties] = useState([]);
  const [allExpertise, setAllExpertise] = useState([]);
  const [allLanguages, setAllLanguages] = useState([]);
  const [slotTimingsByDay, setSlotTimingsByDay] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [consultationTypes, setConsultationTypes] = useState([]);
  // { [consultationTypeId]: { price: string } } — presence means "offered".
  const [selectedConsultationTypes, setSelectedConsultationTypes] = useState({});
  const [isAddingClinic, setIsAddingClinic] = useState(false);

  const bodyRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabOffsets = useRef({});

  const step = STEPS[stepIndex];

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
        language_ids: [],
        is_active: true,
      });
      // Fetch metadata for new doctor
      Promise.all([
        apiClient.get(ENDPOINTS.SPECIALTIES),
        apiClient.get(ENDPOINTS.EXPERTISES),
        apiClient.get(ENDPOINTS.LANGUAGES),
        apiClient.get(ENDPOINTS.SLOT_TIMINGS),
        apiClient.get(ENDPOINTS.CONSULTATION_TYPES),
      ]).then(([specRes, expRes, langRes, slotRes, typeRes]) => {
        setSpecialties(specRes.data || specRes || []);
        setAllExpertise(expRes.data || expRes || []);
        setAllLanguages(langRes.data || langRes || []);
        setSlotTimingsByDay(slotRes.data || slotRes || []);
        setConsultationTypes(typeRes.data || typeRes || []);
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
      apiClient.get(ENDPOINTS.CONSULTATION_TYPES),
    ]).then(([docRes, specRes, expRes, langRes, slotRes, availRes, typeRes]) => {
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
        is_active: doc.is_active !== false,
      });
      setSpecialties(specRes.data || specRes || []);
      setAllExpertise(expRes.data || expRes || []);
      setAllLanguages(langRes.data || langRes || []);
      setSlotTimingsByDay(slotRes.data || slotRes || []);
      setConsultationTypes(typeRes.data || typeRes || []);
      const availData = availRes.data || availRes || [];
      setSelectedSlotIds(availData.map(a => a.slot_timing_id));
      const selectedTypes = {};
      (doc.consultation_types || []).forEach(entry => {
        selectedTypes[entry.consultation_type_id] = {
          price: entry.price != null ? String(entry.price) : '',
        };
      });
      setSelectedConsultationTypes(selectedTypes);
    }).catch(() => showAlert('Error', 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const toggleConsultationType = typeId => {
    setSelectedConsultationTypes(prev => {
      const next = { ...prev };
      if (next[typeId]) delete next[typeId];
      else next[typeId] = { price: '' };
      return next;
    });
  };

  const setConsultationPrice = (typeId, price) => {
    setSelectedConsultationTypes(prev =>
      prev[typeId] ? { ...prev, [typeId]: { price } } : prev,
    );
  };

  const consultationTypeName = useCallback(
    id => consultationTypes.find(ct => ct.id === Number(id))?.name || `type ${id}`,
    [consultationTypes],
  );

  // What each step still needs, keyed by step. Drives the warning dots on the
  // chips, the banner inside a step, and where Save sends the admin back to.
  const stepIssues = useMemo(() => {
    const issues = {};
    STEPS.forEach(s => { issues[s.key] = []; });
    if (!editedDoctor) return issues;

    const name = doctorId ? editedDoctor.full_name : editedDoctor.name;
    if (!name?.trim()) issues.account.push('Full Name');
    if (!editedDoctor.email?.trim()) issues.account.push('Email');
    if (!doctorId && !editedDoctor.password) issues.account.push('Password');

    if (!editedDoctor.specialty_ids?.length) issues.profile.push('Specialties');
    if (!editedDoctor.experience && editedDoctor.experience !== 0) {
      issues.profile.push('Experience (Years)');
    }

    if (!editedDoctor.fee) issues.fees.push('Consultation Fee');
    Object.entries(selectedConsultationTypes)
      .filter(([, { price }]) => !price?.trim())
      .forEach(([id]) => issues.fees.push(`Price for ${consultationTypeName(id)}`));

    (editedDoctor.clinics || []).forEach((clinic, index) => {
      if (!isClinicComplete(clinic)) {
        issues.clinics.push(`Clinic ${index + 1} needs a name, address and city`);
      }
    });

    (editedDoctor.awards || []).forEach((award, index) => {
      if (!isAwardComplete(award)) {
        issues.awards.push(`Award ${index + 1} needs a title, issuer and year`);
      }
    });

    return issues;
  }, [editedDoctor, doctorId, selectedConsultationTypes, consultationTypeName]);

  const goToStep = useCallback((index, { markCurrentTouched = false } = {}) => {
    if (markCurrentTouched) {
      setTouchedSteps(t => ({ ...t, [STEPS[stepIndex].key]: true }));
    }
    setStepIndex(index);
    bodyRef.current?.scrollTo({ y: 0, animated: false });
  }, [stepIndex]);

  // Keep the active chip on screen — with six of them the later ones sit past
  // the right edge, so stepping forward would otherwise appear to do nothing.
  useEffect(() => {
    const x = tabOffsets.current[STEPS[stepIndex].key];
    if (typeof x === 'number') {
      tabScrollRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
    }
  }, [stepIndex]);

  const handleSave = () => {
    const blocked = STEPS.find(s => stepIssues[s.key].length > 0);
    if (blocked) {
      setTouchedSteps(t => ({ ...t, [blocked.key]: true }));
      goToStep(STEPS.indexOf(blocked));
      showAlert(
        'Still incomplete',
        `${blocked.label} needs:\n\n• ${stepIssues[blocked.key].join('\n• ')}`,
      );
      return;
    }

    setSaving(true);

    const clinics = editedDoctor.clinics || [];
    const payload = {
        ...editedDoctor,
        specialty_ids: editedDoctor.specialty_ids || [],
        slot_timing_ids: selectedSlotIds,
        // A blank price means "use the base consultation fee" — send null.
        consultation_types: Object.entries(selectedConsultationTypes).map(
          ([consultation_type_id, { price }]) => ({
            consultation_type_id,
            price: String(price ?? '').trim() === '' ? null : Number(price),
          }),
        ),
        // Lat/long come off the address picker — send numbers (or null), not strings.
        clinics: clinics.map(clinic => ({
          ...clinic,
          latitude: clinic.latitude === '' || clinic.latitude == null ? null : Number(clinic.latitude),
          longitude: clinic.longitude === '' || clinic.longitude == null ? null : Number(clinic.longitude),
        })),
    };

    const request = doctorId
        ? apiClient.put(ENDPOINTS.DOCTOR_DETAIL(doctorId), payload)
        : apiClient.post(ENDPOINTS.DOCTORS, payload);

    request
      .then(() => {
        // Leave on OK rather than popping underneath the dialog — the screen we
        // return to refetches on focus, so the list/detail shows what was just
        // saved instead of the values it was rendered with.
        showAlert(
          'Success',
          `Doctor ${doctorId ? 'updated' : 'created'} successfully`,
          [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
        );
      })
      .catch((error) => {
        console.error("Save error:", error);
        showAlert('Error', error.message || 'Failed to save doctor details. Please try again.');
      })
      .finally(() => setSaving(false));
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
    const award = (editedDoctor.awards || [])[index];
    showConfirm(
      'Remove award',
      `Remove ${award?.title ? `"${award.title}"` : 'this award'}? It is deleted when you save.`,
      () => {
        const updatedAwards = (editedDoctor.awards || []).filter((_, i) => i !== index);
        setEditedDoctor({ ...editedDoctor, awards: updatedAwards });
      },
      { confirmLabel: 'Remove', destructive: true },
    );
  };

  const clinics = editedDoctor?.clinics || [];
  // Guard against stacking up half-filled clinic cards: the last one has to be
  // finished (or removed) before another can be started.
  const canAddClinic = clinics.every(isClinicComplete);

  const addClinic = () => {
    setIsAddingClinic(true);
    navigation.navigate('ClinicAddressPicker');
  };

  // The picker is a separate screen, so it leaves the finished clinic behind
  // for us to collect when we come back. Cancelling leaves nothing, and either
  // way the "Add Clinic" button has to be re-enabled — it is disabled while the
  // picker is open to stop a second one being started.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const pending = _pullPendingClinic();
      if (pending) {
        setEditedDoctor(prev => ({
          ...prev,
          clinics: [
            ...(prev?.clinics || []),
            {
              ...pending,
              latitude: String(pending.latitude),
              longitude: String(pending.longitude),
            },
          ],
        }));
        // Coming back from the picker, the new card is on the Clinics step —
        // land there rather than wherever the admin happened to leave off.
        setStepIndex(STEPS.findIndex(s => s.key === 'clinics'));
      }
      setIsAddingClinic(false);
    });
    return unsubscribe;
  }, [navigation]);

  const previewClinicLocation = clinic => {
    const error = validateClinicLocation(clinic.latitude, clinic.longitude);
    if (error || clinic.latitude === '' || clinic.latitude == null) {
      showAlert('Location not set', error || 'Add this clinic again from the address picker to set its location.');
      return;
    }
    Linking.openURL(mapsUrl(Number(clinic.latitude), Number(clinic.longitude))).catch(() =>
      showAlert('Error', 'Could not open the maps app.'),
    );
  };

  const updateClinic = (index, key, value) => {
    const updatedClinics = [...(editedDoctor.clinics || [])];
    updatedClinics[index] = { ...updatedClinics[index], [key]: value };
    setEditedDoctor({ ...editedDoctor, clinics: updatedClinics });
  };

  const removeClinic = (index) => {
    const clinic = (editedDoctor.clinics || [])[index];
    const drop = () => {
      const updatedClinics = (editedDoctor.clinics || []).filter((_, i) => i !== index);
      setEditedDoctor({ ...editedDoctor, clinics: updatedClinics });
    };

    // An untouched blank card is not worth a dialog — just drop it.
    if (!clinic?.name?.trim() && !clinic?.address?.trim() && !clinic?.city?.trim()) {
      drop();
      return;
    }
    showConfirm(
      'Remove clinic',
      `Remove ${clinic?.name ? `"${clinic.name}"` : 'this clinic'}? It is deleted when you save. Clinics with existing appointments are deactivated instead of deleted.`,
      drop,
      { confirmLabel: 'Remove', destructive: true },
    );
  };

  const screenTitle = doctorId ? 'Edit Doctor' : 'Add Doctor';

  if (loading) return (
    <View style={styles.root}>
      <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
      <EditFormSkeleton />
    </View>
  );

  const renderAccountStep = () => (
    <View style={styles.card}>
      {doctorId ? (
        <>
          <RequiredLabel text="Full Name" styles={styles} />
          <TextInput style={styles.input} value={editedDoctor.full_name} onChangeText={(val) => setEditedDoctor({...editedDoctor, full_name: val})} placeholder="Enter full name" placeholderTextColor={colors.textMuted} />

          <RequiredLabel text="Email" styles={styles} />
          <TextInput style={styles.input} value={editedDoctor.email} onChangeText={(val) => setEditedDoctor({...editedDoctor, email: val})} placeholder="email@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={editedDoctor.phone} onChangeText={(val) => setEditedDoctor({...editedDoctor, phone: val})} placeholder="+91-9876543210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

          <View style={styles.activeToggleRow}>
            <View style={styles.activeToggleText}>
              <Text style={styles.activeToggleLabel}>Active</Text>
              <Text style={styles.hint}>
                Inactive doctors stay on record but stop appearing to patients.
              </Text>
            </View>
            <AppToggle
              value={!!editedDoctor.is_active}
              onValueChange={val => setEditedDoctor(prev => ({ ...prev, is_active: val }))}
            />
          </View>
        </>
      ) : (
        <>
          <RequiredLabel text="Full Name" styles={styles} />
          <TextInput style={styles.input} value={editedDoctor.name} onChangeText={(val) => setEditedDoctor({...editedDoctor, name: val})} placeholder="Enter full name" placeholderTextColor={colors.textMuted} />

          <RequiredLabel text="Email" styles={styles} />
          <TextInput style={styles.input} value={editedDoctor.email} onChangeText={(val) => setEditedDoctor({...editedDoctor, email: val})} placeholder="email@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

          <RequiredLabel text="Password" styles={styles} />
          <TextInput style={styles.input} value={editedDoctor.password} onChangeText={(val) => setEditedDoctor({...editedDoctor, password: val})} placeholder="Enter password" placeholderTextColor={colors.textMuted} secureTextEntry />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={editedDoctor.phone} onChangeText={(val) => setEditedDoctor({...editedDoctor, phone: val})} placeholder="+91-9876543210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
        </>
      )}
    </View>
  );

  const renderProfileStep = () => (
    <View style={styles.card}>
      <RequiredLabel text="Specialties" styles={styles} />
      <TouchableOpacity style={styles.picker} onPress={() => setModalType('specialty')}>
        <Text style={editedDoctor.specialty_ids?.length ? styles.pickerText : styles.pickerPlaceholder}>
          {editedDoctor.specialty_ids?.length ? `${editedDoctor.specialty_ids.length} selected` : 'Select Specialties'}
        </Text>
        <MCIcon name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {renderSelectedTags('specialty_ids', specialties)}

      <Text style={styles.label}>About</Text>
      <TextInput style={[styles.input, styles.multiline]} value={editedDoctor.about} onChangeText={(val) => setEditedDoctor({...editedDoctor, about: val})} placeholder="Enter doctor's biography" placeholderTextColor={colors.textMuted} multiline />

      <Text style={styles.label}>Education</Text>
      <TextInput style={styles.input} value={editedDoctor.education} onChangeText={(val) => setEditedDoctor({...editedDoctor, education: val})} placeholder="e.g. MBBS, MD" placeholderTextColor={colors.textMuted} />

      <RequiredLabel text="Experience (Years)" styles={styles} />
      <TextInput style={styles.input} value={String(editedDoctor.experience || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, experience: parseInt(val, 10) || 0})} placeholder="Years of experience" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

      <Text style={styles.label}>Expertise</Text>
      <TouchableOpacity style={styles.picker} onPress={() => setModalType('expertise')}>
        <Text style={editedDoctor.expertise_ids?.length ? styles.pickerText : styles.pickerPlaceholder}>
          {editedDoctor.expertise_ids?.length ? `${editedDoctor.expertise_ids.length} selected` : 'Select Expertise'}
        </Text>
        <MCIcon name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {renderSelectedTags('expertise_ids', allExpertise)}

      <Text style={styles.label}>Languages</Text>
      <TouchableOpacity style={styles.picker} onPress={() => setModalType('language')}>
        <Text style={editedDoctor.language_ids?.length ? styles.pickerText : styles.pickerPlaceholder}>
          {editedDoctor.language_ids?.length ? `${editedDoctor.language_ids.length} selected` : 'Select Languages'}
        </Text>
        <MCIcon name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {renderSelectedTags('language_ids', allLanguages)}
    </View>
  );

  const renderFeesStep = () => (
    <>
      <View style={styles.card}>
        <RequiredLabel text="Consultation Fee" styles={styles} />
        <TextInput style={styles.input} value={String(editedDoctor.fee || '')} onChangeText={(val) => setEditedDoctor({...editedDoctor, fee: parseInt(val, 10) || 0})} placeholder="Fee per consultation" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
        <Text style={styles.hint}>Base fee, used for any visit mode without its own price.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Consultation Modes</Text>
        <Text style={styles.hint}>
          Pick the visit types this doctor offers. Price is required for every selected mode.
        </Text>
        {consultationTypes.length === 0 ? (
          <Text style={styles.emptyText}>No consultation types configured.</Text>
        ) : (
          consultationTypes.map(type => {
            const selected = !!selectedConsultationTypes[type.id];
            return (
              <View key={type.id} style={styles.consultTypeRow}>
                <TouchableOpacity
                  style={styles.consultTypeToggle}
                  onPress={() => toggleConsultationType(type.id)}
                >
                  <MCIcon
                    name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.consultTypeName}>{type.name}</Text>
                </TouchableOpacity>
                <View style={styles.consultPriceWrapper}>
                  <TextInput
                    style={[styles.input, styles.consultPriceInput, !selected && styles.disabled]}
                    value={selected ? (selectedConsultationTypes[type.id].price ?? '') : ''}
                    onChangeText={val => setConsultationPrice(type.id, val)}
                    placeholder={editedDoctor.fee ? `₹${editedDoctor.fee}` : 'Price'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    editable={selected}
                  />
                  {selected && <Text style={styles.requiredStar}>*</Text>}
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );

  const renderAvailabilityStep = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Weekly Time Slots</Text>
      <Text style={styles.hint}>Select when this doctor is available.</Text>
      {slotTimingsByDay.length === 0 ? (
        <Text style={styles.emptyText}>No slot timings configured.</Text>
      ) : (
        slotTimingsByDay.map((day) => (
          <View key={day.id} style={styles.daySection}>
            <Text style={styles.dayLabel}>{day.day}</Text>
            <View style={styles.slotRow}>
              {day.slots.length === 0 ? (
                <Text style={styles.emptyText}>No slots configured</Text>
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
        ))
      )}
    </View>
  );

  const renderClinicsStep = () => (
    <>
      {clinics.length === 0 ? (
        <View style={styles.emptyCard}>
          <MCIcon name="hospital-building" size={30} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No clinics yet</Text>
          <Text style={styles.emptyText}>
            Add the places this doctor practises at. Patients pick one when booking an in-person visit.
          </Text>
        </View>
      ) : null}

      {clinics.map((clinic, index) => {
        const incomplete = !isClinicComplete(clinic);
        const hasLocation = clinic.latitude != null && clinic.latitude !== '';
        return (
          <View key={index} style={[styles.card, incomplete && styles.cardIncomplete]}>
            <View style={styles.clinicHeaderRow}>
              <RequiredLabel text="Clinic Name" styles={styles} />
              <TouchableOpacity onPress={() => updateClinic(index, 'is_primary', !clinic.is_primary)}>
                <View style={[styles.primaryToggle, clinic.is_primary && styles.primaryToggleActive]}>
                  <Text style={[styles.primaryToggleText, clinic.is_primary && styles.primaryToggleTextActive]}>
                    {clinic.is_primary ? 'Primary' : 'Set as Primary'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="e.g. Sarah Acupressure Clinic" placeholderTextColor={colors.textMuted} value={clinic.name} onChangeText={(val) => updateClinic(index, 'name', val)} />

            <RequiredLabel text="Address" styles={styles} />
            <TextInput style={styles.input} placeholder="e.g. 123 MG Road" placeholderTextColor={colors.textMuted} value={clinic.address} onChangeText={(val) => updateClinic(index, 'address', val)} />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <RequiredLabel text="City" styles={styles} />
                <TextInput style={styles.input} placeholder="e.g. Bangalore" placeholderTextColor={colors.textMuted} value={clinic.city} onChangeText={(val) => updateClinic(index, 'city', val)} />
              </View>
              <View style={[styles.rowItem, styles.rowItemGap]}>
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} placeholder="e.g. +91-9876543210" placeholderTextColor={colors.textMuted} value={clinic.phone} onChangeText={(val) => updateClinic(index, 'phone', val)} keyboardType="phone-pad" />
              </View>
            </View>

            <View style={styles.clinicFooterRow}>
              {hasLocation ? (
                <TouchableOpacity style={styles.mapPreviewBtn} onPress={() => previewClinicLocation(clinic)}>
                  <MCIcon name="map-marker-outline" size={16} color={colors.primary} />
                  <Text style={styles.mapPreviewText}>View on map</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.hint}>No map location set</Text>
              )}
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeClinic(index)}>
                <MCIcon name="trash-can-outline" size={16} color={colors.danger} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.addBtn, (isAddingClinic || !canAddClinic) && styles.addBtnDisabled]}
        onPress={addClinic}
        disabled={isAddingClinic || !canAddClinic}
      >
        <MCIcon name="plus" size={18} color={isAddingClinic || !canAddClinic ? colors.textMuted : colors.primary} />
        <Text style={[styles.addBtnText, (isAddingClinic || !canAddClinic) && styles.addBtnTextDisabled]}>
          {isAddingClinic ? 'Adding Clinic…' : 'Add Clinic'}
        </Text>
      </TouchableOpacity>
      {!canAddClinic ? (
        <Text style={styles.addHint}>
          Complete the clinic above (name, address and city) before adding another.
        </Text>
      ) : null}
    </>
  );

  const renderAwardsStep = () => (
    <>
      {(editedDoctor.awards || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <MCIcon name="trophy-outline" size={30} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No awards yet</Text>
          <Text style={styles.emptyText}>
            Optional. Awards show on the doctor's public profile.
          </Text>
        </View>
      ) : null}

      {editedDoctor.awards?.map((award, index) => (
        <View key={index} style={[styles.card, !isAwardComplete(award) && styles.cardIncomplete]}>
          <RequiredLabel text="Award Title" styles={styles} />
          <TextInput style={styles.input} placeholder="e.g. Best Doctor" placeholderTextColor={colors.textMuted} value={award.title} onChangeText={(val) => updateAward(index, 'title', val)} />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <RequiredLabel text="Issuer" styles={styles} />
              <TextInput style={styles.input} placeholder="e.g. Health Assoc" placeholderTextColor={colors.textMuted} value={award.issuer} onChangeText={(val) => updateAward(index, 'issuer', val)} />
            </View>
            <View style={[styles.yearItem, styles.rowItemGap]}>
              <RequiredLabel text="Year" styles={styles} />
              <TextInput style={styles.input} placeholder="2024" placeholderTextColor={colors.textMuted} value={String(award.year || '')} onChangeText={(val) => updateAward(index, 'year', parseInt(val, 10))} keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder="Brief description" placeholderTextColor={colors.textMuted} value={award.description} onChangeText={(val) => updateAward(index, 'description', val)} multiline />

          <TouchableOpacity style={[styles.removeBtn, styles.removeBtnEnd]} onPress={() => removeAward(index)}>
            <MCIcon name="trash-can-outline" size={16} color={colors.danger} />
            <Text style={styles.removeBtnText}>Remove Award</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addAward}>
        <MCIcon name="plus" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Add Award</Text>
      </TouchableOpacity>
    </>
  );

  const STEP_RENDERERS = {
    account: renderAccountStep,
    profile: renderProfileStep,
    fees: renderFeesStep,
    availability: renderAvailabilityStep,
    clinics: renderClinicsStep,
    awards: renderAwardsStep,
  };

  const currentIssues = stepIssues[step.key];
  const showIssues = touchedSteps[step.key] && currentIssues.length > 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={screenTitle}
        subtitle={`Step ${stepIndex + 1} of ${STEPS.length} · ${step.label}`}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            style={[styles.headerSave, saving && styles.headerSaveDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.headerSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.tabBar}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStrip}
        >
          {STEPS.map((s, index) => {
            const active = index === stepIndex;
            const flagged = touchedSteps[s.key] && stepIssues[s.key].length > 0;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.tab, active && styles.tabActive]}
                onLayout={e => { tabOffsets.current[s.key] = e.nativeEvent.layout.x; }}
                onPress={() => goToStep(index, { markCurrentTouched: true })}
              >
                <MCIcon
                  name={s.icon}
                  size={16}
                  color={active ? colors.white : flagged ? colors.danger : colors.textSecondary}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive, !active && flagged && styles.tabTextFlagged]}>
                  {s.label}
                </Text>
                {flagged && !active ? <View style={styles.tabDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView ref={bodyRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.requiredHint}>
          Fields marked <Text style={styles.requiredStar}>*</Text> are required.
        </Text>

        {showIssues ? (
          <View style={styles.issueBanner}>
            <MCIcon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.issueText}>
              Still needed: {currentIssues.join(', ')}
            </Text>
          </View>
        ) : null}

        {STEP_RENDERERS[step.key]()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.backButton, stepIndex === 0 && styles.buttonDisabled]}
          onPress={() => goToStep(stepIndex - 1)}
          disabled={stepIndex === 0}
        >
          <MCIcon name="chevron-left" size={20} color={stepIndex === 0 ? colors.textMuted : colors.textPrimary} />
          <Text style={[styles.backButtonText, stepIndex === 0 && styles.buttonTextDisabled]}>Back</Text>
        </TouchableOpacity>

        {stepIndex === LAST_STEP ? (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <MCIcon name="check" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Complete'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => goToStep(stepIndex + 1, { markCurrentTouched: true })}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
            <MCIcon name="chevron-right" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
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
  content: { padding: 16, paddingBottom: 28 },

  // Step chips. The active one is a solid brand fill and the rest sit on the
  // page canvas with a hairline — in light mode a muted-grey fill for the
  // inactive chips is all but invisible against the warm off-white background.
  tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabStrip: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  tabTextFlagged: { color: colors.danger },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  progressTrack: { height: 3, backgroundColor: colors.surfaceMuted },
  progressFill: { height: 3, backgroundColor: colors.primary },

  headerSave: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)' },
  headerSaveDisabled: { opacity: 0.6 },
  headerSaveText: { color: colors.headerText, fontWeight: '700', fontSize: 13 },

  // One white card per section on the warm canvas, with a hairline border.
  // The old layout put every section on `surfaceMuted`, which is a two-percent
  // step off the page colour in light mode — the groupings simply vanished.
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardIncomplete: { borderColor: colors.danger },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },

  emptyCard: {
    alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 20, marginBottom: 14,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
  requiredStar: { color: colors.danger, fontWeight: '700' },
  requiredHint: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },

  input: {
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  disabled: { backgroundColor: colors.surfaceMuted, opacity: 0.6 },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  pickerText: { color: colors.textPrimary, fontSize: 14 },
  pickerPlaceholder: { color: colors.textMuted, fontSize: 14 },

  issueBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12,
    padding: 12, borderRadius: 12, backgroundColor: colors.accentLight,
    borderWidth: 1, borderColor: colors.danger,
  },
  issueText: { flex: 1, fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 },

  activeToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  activeToggleText: { flex: 1 },
  activeToggleLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  consultTypeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  consultTypeToggle: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  consultTypeName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  consultPriceInput: { width: 100, paddingVertical: 8, textAlign: 'right' },
  consultPriceWrapper: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  tagScroll: { marginTop: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primaryLight, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  tagText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.modalSurface, borderRadius: 16, padding: 16, maxHeight: '80%', borderWidth: 1, borderColor: colors.modalBorder, shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, paddingHorizontal: 4, color: colors.textPrimary, textTransform: 'capitalize' },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  // The selected row used to be `surfaceMuted` — a near-white fill on a white
  // modal, so nothing looked selected at all until you spotted the tick.
  modalItemSelected: { backgroundColor: colors.primaryLight },
  modalItemText: { color: colors.textPrimary, fontSize: 14 },
  modalItemTextSelected: { color: colors.primary, fontWeight: '600' },
  closeButton: { marginTop: 16, backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  closeButtonText: { color: colors.white, fontWeight: '700' },

  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 12 },
  // Outlined rather than filled: a `surfaceMuted` fill reads as a disabled
  // button on a white footer in light mode.
  backButton: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  backButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.primary },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.45 },
  buttonTextDisabled: { color: colors.textMuted },

  row: { flexDirection: 'row' },
  rowItem: { flex: 1 },
  rowItemGap: { marginLeft: 10 },
  yearItem: { width: 92 },

  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  removeBtnEnd: { alignSelf: 'flex-end', marginTop: 6 },
  removeBtnText: { color: colors.danger, fontWeight: '600', fontSize: 13 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginBottom: 8,
    backgroundColor: colors.primaryFaint, borderWidth: 1, borderColor: colors.borderStrong,
  },
  addBtnDisabled: { opacity: 0.55 },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  addBtnTextDisabled: { color: colors.textMuted },
  addHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },

  clinicHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clinicFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  mapPreviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapPreviewText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  primaryToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong },
  primaryToggleActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  primaryToggleText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  primaryToggleTextActive: { color: colors.primary },

  daySection: { marginTop: 14 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  slotChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  slotChipTextSelected: { color: colors.white },
});

export default EditDoctorScreen;
