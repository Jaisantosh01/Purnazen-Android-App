import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppDialog from '../components/AppDialog';
import {DAYS, MONTHS} from '../constants/strings';

// Clinic visit always comes first, then home, then video.
const VISIT_ORDER = { clinic: 0, home: 1, video: 2 };
const sortVisitTypes = list =>
  [...list].sort((a, b) => (VISIT_ORDER[a.id] ?? 9) - (VISIT_ORDER[b.id] ?? 9));

// Fallback cards built from the doctor's consultation-type tags so the visit
// type section always shows, even if the visit-types API call fails.
const TAG_TO_VISIT_TYPE = {
  'Clinic Visit': { id: 'clinic', title: 'Clinic Visit', subtitle: 'Meet at the clinic', icon: 'hospital-building' },
  'Home Visit':   { id: 'home',   title: 'Home Visit',   subtitle: 'Doctor visits your home', icon: 'home-outline' },
  'Video Call':   { id: 'video',  title: 'Video Consultation', subtitle: 'Consult from anywhere', icon: 'video-outline' },
};

const BookAppointmentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { doctor } = route.params;

  // The sticky footer grows and shrinks (the date/time summary lines come and
  // go), so its height is measured rather than guessed — a fixed scroll padding
  // left the last section, "Home Address", trapped behind it.
  const [barHeight, setBarHeight] = useState(0);

  // While the keyboard is open the footer would sit right on top of it and hide
  // whatever the user is typing under, so it steps aside until they're done.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

  const today = new Date();
  const [visitTypes, setVisitTypes]         = useState([]);
  const [timeSlots, setTimeSlots]           = useState([]);
  const [selectedVisit, setSelectedVisit]   = useState('clinic');
  const [selectedTime, setSelectedTime]     = useState(null);
  const [currentMonth, setCurrentMonth]     = useState(today.getMonth());
  const [currentYear, setCurrentYear]       = useState(today.getFullYear());
  // Default to null — no date is pre-selected
  const [selectedDate, setSelectedDate]     = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userDescription, setUserDescription] = useState('');
  const [clinics, setClinics]               = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [userAddresses, setUserAddresses]   = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Load user addresses and auto-select the best one for home visit.
  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const data = await consultService.getUserAddresses();
      setUserAddresses(data || []);
      if (data && data.length > 0) {
        const defaultAddr = data.find(a => a.isDefault);
        setSelectedAddress(defaultAddr || data[0]);
      } else {
        setSelectedAddress(null);
      }
    } catch {
      setUserAddresses([]);
      setSelectedAddress(null);
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedVisit === 'home') loadAddresses();
  }, [selectedVisit, loadAddresses]);

  // Reload when returning from AddressManagement
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (selectedVisit === 'home') loadAddresses();
    });
    return unsub;
  }, [navigation, selectedVisit, loadAddresses]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return [addr.houseName, addr.area, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  };

  const selectedVisitData = visitTypes.find(v => v.id === selectedVisit);

  useEffect(() => {
    const applyVisitTypes = (list) => {
      const sorted = sortVisitTypes(list);
      setVisitTypes(sorted);
      // Keep clinic as the default whenever the doctor offers it.
      setSelectedVisit(prev => (sorted.some(v => v.id === prev) ? prev : sorted[0].id));
    };
    const applyFallback = () => {
      const fallback = (doctor.tags || [])
        .map(tag => TAG_TO_VISIT_TYPE[tag])
        .filter(Boolean)
        .map(v => ({ ...v, fee: doctor.minFee ?? doctor.fee }));
      if (fallback.length) applyVisitTypes(fallback);
    };
    consultService.getVisitTypes(doctor.id)
      .then(data => {
        if (data?.length) applyVisitTypes(data);
        else applyFallback();
      })
      .catch(applyFallback);
  }, [doctor.id, doctor.tags, doctor.minFee, doctor.fee]);

  useEffect(() => {
    if (selectedVisit !== 'clinic') {
      setClinics([]);
      setSelectedClinic(null);
      return;
    }
    consultService.getDoctorClinics(doctor.id)
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setClinics(data);
          const primary = data.find(c => c.is_primary);
          setSelectedClinic(primary || data[0]);
        }
      })
      .catch(() => setClinics([]));
  }, [doctor.id, selectedVisit]);

  const fetchTimeSlots = useCallback(() => {
    if (!selectedDate) return;
    setSelectedTime(null);
    setTimeSlots([]);
    setSlotsLoading(true);
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
    consultService.getTimeSlots(doctor.id, dateStr)
      .then(data => { if (Array.isArray(data)) setTimeSlots(data); })
      .catch(() => setTimeSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [doctor.id, selectedDate, currentMonth, currentYear]);

  useEffect(() => { fetchTimeSlots(); }, [fetchTimeSlots]);

  // Re-fetch on focus so already-booked slots show as disabled after returning
  // from BookingConfirmedScreen.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { fetchTimeSlots(); });
    return unsub;
  }, [navigation, fetchTimeSlots]);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const getSelectedDateString = () => {
    if (!selectedDate) return null;
    const date = new Date(currentYear, currentMonth, selectedDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) {
      showAlert('Missing Info', 'Please select a date and time slot.');
      return;
    }
    if (selectedVisit === 'clinic' && !selectedClinic) {
      showAlert('Missing Info', 'Please select a clinic for the visit.');
      return;
    }
    if (selectedVisit === 'home' && !selectedAddress) {
      showAlert('Missing Info', 'Please add a home address for the visit.');
      return;
    }
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
    try {
      const booking = await consultService.bookAppointment({
        doctorId:          doctor.id,
        visitType:         selectedVisit,
        date:              dateStr,
        slotTimingId:      selectedTime.id,
        clinicId:          selectedClinic?.id,
        userAddressId:     selectedAddress?.id,
        fee:               selectedVisitData?.fee,
        userDescription:   userDescription.trim() || undefined,
      });
      navigation.navigate('BookingConfirmed', {
        doctor,
        date: getSelectedDateString(),
        time: selectedTime.time,
        visitType: selectedVisitData?.title,
        fee: selectedVisitData?.fee,
        bookingRef: booking?.reference,
        appointmentId: booking?.id,
      });
    } catch (err) {
      showAlert('Booking Failed', err.message);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const calendarDays = [];

  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? 11 : currentMonth - 1,
    currentMonth === 0 ? currentYear - 1 : currentYear
  );
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, current: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, current: true });
  }
  // Only pad out the final week — never a whole empty trailing row — so the
  // calendar height matches the month and leaves no dead space above "Select Time".
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, current: false });
  }

  const isPast = (day, current) => {
    if (!current) return true;
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  // Parse a slot's start time ("09:00 AM" / "14:30") into {h, min}.
  const parseSlotStart = (timeStr) => {
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(timeStr || ''));
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3] && m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return { h, min };
  };

  // A slot is "past" only when the selected date is today and its start time
  // has already elapsed — you can't book a slot earlier than the current hour.
  const isSlotPast = (slot) => {
    if (!selectedDate) return false;
    const now = new Date();
    const selected = new Date(currentYear, currentMonth, selectedDate);
    if (selected.toDateString() !== now.toDateString()) return false;
    const t = parseSlotStart(slot.time);
    if (!t) return false;
    const slotStart = new Date(currentYear, currentMonth, selectedDate, t.h, t.min);
    return slotStart <= now;
  };

  // A slot is unavailable if it's booked OR already elapsed today.
  const isSlotUnavailable = (slot) => slot.booked || isSlotPast(slot);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Book Appointment" subtitle={doctor.name} variant="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: (keyboardOpen ? 0 : barHeight || 120) + 24 }}
      >

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Visit Type</Text>
          <View style={styles.visitRow}>
            {visitTypes.map(visit => (
              <TouchableOpacity
                key={visit.id}
                style={[styles.visitCard, selectedVisit === visit.id && styles.visitCardActive]}
                onPress={() => setSelectedVisit(visit.id)}
                activeOpacity={0.8}
              >
                <MCIcon
                  name={visit.icon}
                  size={24}
                  color={selectedVisit === visit.id ? colors.primary : colors.textMuted}
                  style={styles.visitIcon}
                />
                <Text style={[styles.visitTitle, selectedVisit === visit.id && styles.visitTitleActive]}>
                  {visit.title}
                </Text>
                <Text style={[styles.visitSubtitle, selectedVisit === visit.id && styles.visitSubtitleActive]}>
                  {visit.subtitle}
                </Text>
                <View style={styles.visitCardFooter}>
                  <Text style={[styles.visitFee, selectedVisit === visit.id && styles.visitFeeActive]}>
                    ₹{visit.fee}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedVisit === 'clinic' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Clinic</Text>
            <View style={styles.clinicList}>
              {clinics.map(clinic => (
                <TouchableOpacity
                  key={clinic.id}
                  style={[styles.clinicOption, selectedClinic?.id === clinic.id && styles.clinicOptionActive]}
                  onPress={() => setSelectedClinic(clinic)}
                  activeOpacity={0.8}
                >
                  <MCIcon
                    name="hospital-marker"
                    size={20}
                    color={selectedClinic?.id === clinic.id ? colors.primary : colors.textMuted}
                  />
                  <View style={styles.clinicOptionInfo}>
                    <Text style={[styles.clinicOptionName, selectedClinic?.id === clinic.id && styles.clinicOptionNameActive]}>
                      {clinic.name}
                    </Text>
                    <Text style={styles.clinicOptionAddress}>{clinic.address}, {clinic.city}</Text>
                  </View>
                  {selectedClinic?.id === clinic.id && (
                    <MCIcon name="check-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <TouchableOpacity
            style={styles.datePickerRow}
            activeOpacity={0.8}
            onPress={() => setShowDatePicker(v => !v)}
          >
            <MCIcon name="calendar-blank" size={20} color={colors.primary} />
            {selectedDate ? (
              <Text style={styles.datePickerText}>{getSelectedDateString()}</Text>
            ) : (
              <Text style={styles.datePickerPlaceholder}>Select a date</Text>
            )}
            <MCIcon name={showDatePicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {showDatePicker && (
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.monthBtn}>
                  <Text style={styles.monthBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.monthBtn}>
                  <Text style={styles.monthBtnText}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dayHeaders}>
                {DAYS.map(day => <Text key={day} style={styles.dayHeader}>{day}</Text>)}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((item, index) => {
                  const past = isPast(item.day, item.current);
                  const selected = item.current && item.day === selectedDate;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dayCell, selected && styles.dayCellSelected]}
                      onPress={() => { if (!item.current || past) return; setSelectedDate(item.day); setShowDatePicker(false); }}
                      disabled={!item.current || past}
                    >
                        <Text style={[styles.dayText, !item.current && styles.dayTextFaded, past && styles.dayTextPast, selected && styles.dayTextSelected]}>
                          {item.day}
                        </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          {!selectedDate ? (
            /* Without this the heading sat above a blank gap until a date was picked. */
            <TouchableOpacity
              style={styles.noSlotsCard}
              activeOpacity={0.8}
              onPress={() => setShowDatePicker(true)}
            >
              <MCIcon name="calendar-clock" size={28} color={colors.textMuted} />
              <Text style={styles.noSlotsTitle}>Pick a date first</Text>
              <Text style={styles.noSlotsText}>Choose a date above to see the slots this doctor has open.</Text>
            </TouchableOpacity>
          ) : slotsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : timeSlots.length === 0 ? (
            <View style={styles.noSlotsCard}>
              <MCIcon name="clock-off-outline" size={28} color={colors.textMuted} />
              <Text style={styles.noSlotsTitle}>No Slots Available</Text>
              <Text style={styles.noSlotsText}>Please choose another date.</Text>
            </View>
          ) : timeSlots.length > 0 && timeSlots.every(isSlotUnavailable) ? (
            <View style={styles.noSlotsCard}>
              <MCIcon name="clock-off-outline" size={28} color={colors.textMuted} />
              <Text style={styles.noSlotsTitle}>No Slots Available</Text>
              <Text style={styles.noSlotsText}>All slots for this date are booked or have passed. Please choose another day.</Text>
            </View>
          ) : (
            <View style={styles.timeGrid}>
              {timeSlots.map(slot => {
                const unavailable = isSlotUnavailable(slot);
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeSlot,
                      unavailable && styles.timeSlotBooked,
                      !unavailable && selectedTime?.id === slot.id && styles.timeSlotActive,
                    ]}
                    onPress={() => !unavailable && setSelectedTime(slot)}
                    activeOpacity={unavailable ? 1 : 0.8}
                    disabled={unavailable}
                  >
                    <Text style={[
                      styles.timeSlotText,
                      unavailable && styles.timeSlotBookedText,
                      !unavailable && selectedTime?.id === slot.id && styles.timeSlotTextActive,
                    ]}>
                      {slot.time} - {slot.end_time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Issue (Optional)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Briefly describe your symptoms or reason for the visit..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            value={userDescription}
            onChangeText={setUserDescription}
            textAlignVertical="top"
          />
        </View>

        {selectedVisit === 'home' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Home Address</Text>
            {addressesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : selectedAddress ? (
              <View style={styles.homeAddressCard}>
                <MCIcon name="map-marker" size={20} color={colors.primary} style={styles.addressIcon} />
                <View style={styles.addressInfo}>
                  <Text style={styles.addressTitle}>{selectedAddress.houseName || 'Address'}</Text>
                  <Text style={styles.addressText} numberOfLines={2}>{formatAddress(selectedAddress)}</Text>
                  <TouchableOpacity onPress={() => setShowAddressPicker(true)}>
                    <Text style={styles.changeAddress}>Change Address</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noAddressCard}>
                <MCIcon name="map-marker-off-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noAddressText}>No address saved yet</Text>
                <Text style={styles.noAddressSubtext}>Add an address for the doctor to visit.</Text>
                <TouchableOpacity
                  style={styles.addAddressBtn}
                  onPress={() => navigation.navigate('AddressManagement')}
                  activeOpacity={0.8}
                >
                  <MCIcon name="plus" size={16} color={colors.white} />
                  <Text style={styles.addAddressBtnText}>Add New Address</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: 16 + insets.bottom },
          keyboardOpen && styles.bottomBarHidden,
        ]}
        pointerEvents={keyboardOpen ? 'none' : 'auto'}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setBarHeight(h);
        }}
      >
        <View style={styles.summaryRow}>
          {selectedDate && (
            <View style={styles.summaryItem}>
              <MCIcon name="calendar-blank-outline" size={14} color={colors.textSecondary} style={styles.summaryIcon} />
              <Text style={styles.summaryText}>{getSelectedDateString()}</Text>
            </View>
          )}
          {selectedTime && (
            <View style={styles.summaryItem}>
              <MCIcon name="clock-outline" size={14} color={colors.textSecondary} style={styles.summaryIcon} />
              <Text style={styles.summaryText}>{selectedTime.time}</Text>
            </View>
          )}
        </View>
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{selectedVisitData?.fee}</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedDate || !selectedTime) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={selectedTime ? 0.85 : 1}
            disabled={!selectedDate || !selectedTime || (selectedVisit === 'clinic' && !selectedClinic) || (selectedVisit === 'home' && !selectedAddress)}
          >
            <Text style={styles.confirmBtnText}>Confirm Booking</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Address picker dialog */}
      <AppDialog
        compact
        visible={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        icon="home-map-marker"
        title="Select Address"
        subtitle="For your home visit"
        confirmLabel="Close"
        onConfirm={() => setShowAddressPicker(false)}
        showCancel={false}
        topSlot={(
          <TouchableOpacity
            style={styles.pickerAddBtn}
            onPress={() => { setShowAddressPicker(false); navigation.navigate('AddressManagement'); }}
            activeOpacity={0.7}
          >
            <MCIcon name="plus-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.pickerAddBtnText}>Add New Address</Text>
          </TouchableOpacity>
        )}
      >
        {userAddresses.length === 0 ? (
          <Text style={styles.pickerEmptyText}>No addresses saved yet.</Text>
        ) : userAddresses.map(addr => (
          <TouchableOpacity
            key={addr.id}
            style={[styles.pickerItem, selectedAddress?.id === addr.id && styles.pickerItemActive]}
            onPress={() => { setSelectedAddress(addr); setShowAddressPicker(false); }}
            activeOpacity={0.7}
          >
            <MCIcon
              name={addr.typeOfAddress === 'office' ? 'office-building-outline' : 'home-outline'}
              size={18}
              color={selectedAddress?.id === addr.id ? colors.primary : colors.textMuted}
            />
            <View style={styles.pickerItemInfo}>
              <View style={styles.pickerItemTitleRow}>
                <Text style={[styles.pickerItemTitle, selectedAddress?.id === addr.id && styles.pickerItemTitleActive]} numberOfLines={1}>
                  {addr.houseName || 'Address'}
                </Text>
                {addr.isDefault && (
                  <View style={styles.pickerDefaultBadge}>
                    <Text style={styles.pickerDefaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={styles.pickerItemDetail} numberOfLines={1}>{formatAddress(addr)}</Text>
            </View>
            {selectedAddress?.id === addr.id && (
              <MCIcon name="check-circle" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </AppDialog>
    </View>
  );
};

export default BookAppointmentScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: colors.textPrimary },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },

  visitRow: { flexDirection: 'row', gap: 12 },
  visitCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    padding: 16, alignItems: 'flex-start', borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'space-between',
  },
  visitCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  visitIcon:        { fontSize: 24, marginBottom: 8, color: colors.textMuted },
  visitIconActive:  { color: colors.primary },
  visitTitle:       { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  visitTitleActive: { color: colors.primary },
  visitSubtitle:    { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  visitSubtitleActive: { color: colors.textSecondary },
  visitCardFooter:  { marginTop: 'auto', width: '100%', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  visitFee:         { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  visitFeeActive:   { color: colors.primary },

  /* Date Picker Row */
  datePickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: colors.border,
  },
  datePickerText:       { flex: 1, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  datePickerPlaceholder:{ flex: 1, fontSize: 14, color: colors.textMuted },

  calendarCard: {
    backgroundColor: colors.card, borderRadius: 14,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginTop: 10,
  },
  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  monthBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthBtnText:  { fontSize: 22, color: colors.textSecondary, fontWeight: '500' },
  monthTitle:    { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  dayHeaders:    { flexDirection: 'row', marginBottom: 8 },
  dayHeader:     { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textMuted },
  calendarGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:       { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  dayCellSelected: { backgroundColor: colors.primary, borderRadius: 20 },
  dayText:         { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  dayTextFaded:    { color: colors.borderStrong },
  dayTextPast:     { color: colors.borderStrong },
  dayTextSelected: { color: colors.white, fontWeight: '700' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSlot: {
    width: '47%', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center',
  },
  timeSlotActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  timeSlotBooked:     { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, opacity: 0.45 },
  timeSlotText:       { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  timeSlotTextActive: { color: colors.white, fontWeight: '700' },
  timeSlotBookedText:{ fontSize: 12, fontWeight: '500', color: colors.textMuted, textDecorationLine: 'line-through' },
  noSlotsCard: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: 14,
    padding: 24, borderWidth: 1.5, borderColor: colors.border, gap: 8,
  },
  noSlotsTitle: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  noSlotsText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  descriptionInput: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, fontSize: 13,
    color: colors.textPrimary, minHeight: 100,
  },

  /* Home Visit Address */
  homeAddressCard: {
    flexDirection: 'row', backgroundColor: colors.warning + '14', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: colors.warning + '55', gap: 10,
  },
  addressIcon:    { fontSize: 20 },
  addressInfo:    { flex: 1 },
  addressTitle:   { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  addressText:    { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  changeAddress:  { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 6 },
  noAddressCard: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: 14,
    padding: 24, borderWidth: 1.5, borderColor: colors.border, gap: 6,
  },
  noAddressText:    { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  noAddressSubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  addAddressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10,
  },
  addAddressBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },

  /* Address Picker Dialog */
  pickerAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.primary + '55', borderStyle: 'dashed',
    backgroundColor: colors.primaryFaint,
  },
  pickerAddBtnText: { fontSize: 13.5, fontWeight: '600', color: colors.primary },
  pickerEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent', marginBottom: 8,
    backgroundColor: colors.surfaceMuted,
  },
  pickerItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  pickerItemInfo: { flex: 1 },
  pickerItemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickerItemTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  pickerItemTitleActive: { color: colors.primary },
  pickerDefaultBadge: {
    backgroundColor: colors.primaryFaint, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
  },
  pickerDefaultBadgeText: { fontSize: 9, fontWeight: '600', color: colors.primary },
  pickerItemDetail: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  clinicCard: {
    flexDirection: 'row', backgroundColor: '#f0f7ff', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#bfdbfe', gap: 10,
  },
  clinicList: { gap: 8 },
  clinicOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  clinicOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  clinicOptionInfo: { flex: 1 },
  clinicOptionName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  clinicOptionNameActive: { color: colors.primary },
  clinicOptionAddress: { fontSize: 12, color: colors.textSecondary },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: colors.surfaceMuted, elevation: 10,
    shadowColor: colors.black, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  bottomBarHidden: { display: 'none' },
  summaryRow:    { marginBottom: 10, gap: 4 },
  summaryItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryIcon:   { fontSize: 13 },
  summaryText:   { fontSize: 12, color: colors.textSecondary },
  bottomRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel:    { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  totalAmount:   { fontSize: 20, fontWeight: '700', color: colors.primary },
  confirmBtn:    { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  confirmBtnDisabled: { backgroundColor: colors.borderStrong },
  confirmBtnText:     { fontSize: 15, fontWeight: '700', color: colors.white },
});
