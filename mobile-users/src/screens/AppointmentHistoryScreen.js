import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import { APPOINTMENT_STATUS_COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { APPOINTMENT_HISTORY_STATUS_LABELS } from '../constants/strings';
import { useHeaderTopPadding } from '../components/ScreenHeader';
import { popToStackRoot } from '../navigation/backHelpers';


const STATUS_COLORS = APPOINTMENT_STATUS_COLORS;
const STATUS_LABELS = APPOINTMENT_HISTORY_STATUS_LABELS;

const AppointmentHistoryScreen = ({ navigation }) => {
  const headerTop = useHeaderTopPadding();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [consultTypes, setConsultTypes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const data = await consultService.getAppointments();
      if (Array.isArray(data)) {
        setAppointments(data);
        const types = [...new Set(data.map(a => a.consultationType))];
        setConsultTypes(['All', ...types]);
      }
    } catch (err) {
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, []);

  const filtered = activeFilter === 'All'
    ? appointments
    : appointments.filter(a => a.consultationType === activeFilter);

  const renderAppointment = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('AppointmentDetail', { appointment: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardDoctorInfo}>
          <Text style={styles.doctorName}>{item.doctorName}</Text>
          <Text style={styles.specialty}>{item.specialty}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#9CA3AF' }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{item.date}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>{item.time} - {item.endTime}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>{item.consultationType}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fee</Text>
          <Text style={styles.detailValue}>₹{item.fee}</Text>
        </View>
      </View>

      {item.userDescription ? (
        <View style={styles.descriptionPreview}>
          <Text style={styles.descriptionText} numberOfLines={2}>{item.userDescription}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => popToStackRoot(navigation)}>
          <MCIcon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <View style={styles.backBtn} />
      </View>

      {consultTypes.length > 1 && (
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={consultTypes}
            keyExtractor={item => item}
            contentContainerStyle={styles.filterContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
                onPress={() => setActiveFilter(item)}
              >
                <Text style={[styles.filterChipText, activeFilter === item && styles.filterChipTextActive]}>
                  {item === 'All' ? 'All' : item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <MCIcon name="clipboard-text-outline" size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No Appointments</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'All'
              ? 'You haven\'t booked any appointments yet.'
              : `No appointments for "${activeFilter}" consultation type.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderAppointment}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}
    </View>
  );
};

export default AppointmentHistoryScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: colors.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  filterRow: {
    backgroundColor: colors.card, paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },

  list: { padding: 16, gap: 14 },

  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardDoctorInfo: { flex: 1, marginRight: 12 },
  doctorName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  specialty: { fontSize: 12, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.white },

  cardBody: { gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  descriptionPreview: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceMuted,
  },
  descriptionText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
});
