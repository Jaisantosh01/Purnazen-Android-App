import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import consultService from '../services/consultService';

const DEFAULT_VISIT_TYPES = [
  { id: 'video', title: 'Video Consultation', subtitle: 'Consult from anywhere',    icon: '📹', fee: 1200 },
  { id: 'home',  title: 'Home Visit',         subtitle: 'Doctor visits your home',  icon: '🏠', fee: 2000 },
];

const DEFAULT_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM',
  '10:30 AM', '11:00 AM', '11:30 AM',
  '02:00 PM', '02:30 PM', '03:00 PM',
  '03:30 PM', '04:00 PM', '04:30 PM',
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOME_ADDRESS = {
  street: '123 Main Street, Apartment 4B',
  city: 'Mumbai, Maharashtra 400001',
};

const BookAppointmentScreen = ({ navigation, route }) => {
  const { doctor } = route.params;

  const today = new Date();
  const [visitTypes, setVisitTypes]         = useState(DEFAULT_VISIT_TYPES);
  const [timeSlots, setTimeSlots]           = useState(DEFAULT_TIME_SLOTS);
  const [selectedVisit, setSelectedVisit]   = useState('video');
  const [selectedTime, setSelectedTime]     = useState(null);
  const [currentMonth, setCurrentMonth]     = useState(today.getMonth());
  const [currentYear, setCurrentYear]       = useState(today.getFullYear());
  const [selectedDate, setSelectedDate]     = useState(today.getDate());

  const selectedVisitData = visitTypes.find(v => v.id === selectedVisit);

  useEffect(() => {
    consultService.getVisitTypes(doctor.id)
      .then(data => { if (data?.length) setVisitTypes(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
    consultService.getTimeSlots(doctor.id, dateStr)
      .then(data => { if (data?.length) setTimeSlots(data); })
      .catch(() => {});
  }, [selectedDate, currentMonth, currentYear]);

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  const getSelectedDateString = () => {
    if (!selectedDate) return null;
    const date = new Date(currentYear, currentMonth, selectedDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Missing Info', 'Please select a date and time slot.');
      return;
    }
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
    try {
      await consultService.bookAppointment({
        doctorId:  doctor.id,
        visitType: selectedVisit,
        date:      dateStr,
        time:      selectedTime,
        fee:       selectedVisitData?.fee,
      });
    } catch (err) {
      console.log('Booking API not ready:', err.message);
    }
    navigation.navigate('BookingConfirmed', {
      doctor,
      date: getSelectedDateString(),
      time: selectedTime,
      visitType: selectedVisitData?.title,
      fee: selectedVisitData?.fee,
    });
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const calendarDays = [];

  // Previous month filler days
  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? 11 : currentMonth - 1,
    currentMonth === 0 ? currentYear - 1 : currentYear
  );
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, current: false });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, current: true });
  }
  // Next month filler days
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, current: false });
  }

  const isToday = (day, current) => {
    return current &&
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear();
  };

  const isPast = (day, current) => {
    if (!current) return true;
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <Text style={styles.headerSubtitle}>{doctor.name}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Select Visit Type ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Visit Type</Text>
          <View style={styles.visitRow}>
            {visitTypes.map(visit => (
              <TouchableOpacity
                key={visit.id}
                style={[
                  styles.visitCard,
                  selectedVisit === visit.id && styles.visitCardActive,
                ]}
                onPress={() => setSelectedVisit(visit.id)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.visitIcon,
                  selectedVisit === visit.id && styles.visitIconActive,
                ]}>
                  {visit.icon}
                </Text>
                <Text style={[
                  styles.visitTitle,
                  selectedVisit === visit.id && styles.visitTitleActive,
                ]}>
                  {visit.title}
                </Text>
                <Text style={[
                  styles.visitSubtitle,
                  selectedVisit === visit.id && styles.visitSubtitleActive,
                ]}>
                  {visit.subtitle}
                </Text>
                <Text style={[
                  styles.visitFee,
                  selectedVisit === visit.id && styles.visitFeeActive,
                ]}>
                  ₹{visit.fee}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Select Date ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <View style={styles.calendarCard}>

            {/* Month navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.monthBtn}>
                <Text style={styles.monthBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTHS[currentMonth]} {currentYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.monthBtn}>
                <Text style={styles.monthBtnText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
              {DAYS.map(day => (
                <Text key={day} style={styles.dayHeader}>{day}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((item, index) => {
                const today_ = isToday(item.day, item.current);
                const past = isPast(item.day, item.current);
                const selected = item.current && item.day === selectedDate &&
                  !(today_ && selectedDate === null);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      today_ && styles.dayCellToday,
                      selected && !today_ && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      if (!item.current || past) return;
                      setSelectedDate(item.day);
                    }}
                    disabled={!item.current || past}
                  >
                    <Text style={[
                      styles.dayText,
                      !item.current && styles.dayTextFaded,
                      past && styles.dayTextPast,
                      today_ && styles.dayTextToday,
                      selected && !today_ && styles.dayTextSelected,
                    ]}>
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Select Time ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((slot, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.timeSlot,
                  selectedTime === slot && styles.timeSlotActive,
                ]}
                onPress={() => setSelectedTime(slot)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.timeSlotText,
                  selectedTime === slot && styles.timeSlotTextActive,
                ]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Home Address (only for Home Visit) ── */}
        {selectedVisit === 'home' && (
          <View style={styles.section}>
            <View style={styles.addressCard}>
              <Text style={styles.addressIcon}>📍</Text>
              <View style={styles.addressInfo}>
                <Text style={styles.addressTitle}>Home Address</Text>
                <Text style={styles.addressText}>{HOME_ADDRESS.street}</Text>
                <Text style={styles.addressText}>{HOME_ADDRESS.city}</Text>
                <TouchableOpacity onPress={() => Alert.alert('Change Address', 'Coming soon!')}>
                  <Text style={styles.changeAddress}>Change Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.summaryRow}>
          {selectedDate && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>📅</Text>
              <Text style={styles.summaryText}>{getSelectedDateString()}</Text>
            </View>
          )}
          {selectedTime && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>🕐</Text>
              <Text style={styles.summaryText}>{selectedTime}</Text>
            </View>
          )}
        </View>
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{selectedVisitData?.fee}</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, !selectedTime && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={selectedTime ? 0.85 : 1}
            disabled={!selectedTime}
          >
            <Text style={styles.confirmBtnText}>Confirm Booking</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
};

export default BookAppointmentScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#1a1a1a',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  // Visit Type
  visitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visitCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  visitCardActive: {
    borderColor: '#1FA77A',
    backgroundColor: '#f0faf6',
  },
  visitIcon: {
    fontSize: 24,
    marginBottom: 8,
    color: '#9ca3af',
  },
  visitIconActive: {
    color: '#1FA77A',
  },
  visitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  visitTitleActive: {
    color: '#1FA77A',
  },
  visitSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 8,
  },
  visitSubtitleActive: {
    color: '#6b7280',
  },
  visitFee: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  visitFeeActive: {
    color: '#1FA77A',
  },

  // Calendar
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: {
    fontSize: 22,
    color: '#6b7280',
    fontWeight: '500',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellToday: {
    backgroundColor: '#1FA77A',
    borderRadius: 20,
  },
  dayCellSelected: {
    backgroundColor: '#e8f8f2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1FA77A',
  },
  dayText: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  dayTextFaded: {
    color: '#d1d5db',
  },
  dayTextPast: {
    color: '#d1d5db',
  },
  dayTextToday: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#1FA77A',
    fontWeight: '700',
  },

  // Time Slots
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  timeSlotActive: {
    backgroundColor: '#1FA77A',
    borderColor: '#1FA77A',
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  timeSlotTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Address Card
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#fff9f0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 10,
  },
  addressIcon: {
    fontSize: 20,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  changeAddress: {
    fontSize: 13,
    color: '#1FA77A',
    fontWeight: '600',
    marginTop: 6,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  summaryRow: {
    marginBottom: 10,
    gap: 4,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryIcon: {
    fontSize: 13,
  },
  summaryText: {
    fontSize: 12,
    color: '#6b7280',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1FA77A',
  },
  confirmBtn: {
    backgroundColor: '#1FA77A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  confirmBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});