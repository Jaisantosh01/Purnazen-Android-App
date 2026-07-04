import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import appointmentService from '../services/appointmentService';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const formatDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// A doctor's patients are the distinct users they have appointments with — there
// is no separate patients table, so we derive the roster from the appointment
// feed (GET /appointments/doctor) the rest of the app already uses.
const derivePatients = appointments => {
  const map = new Map();
  for (const a of appointments) {
    if (!a.userId) continue;
    const existing = map.get(a.userId);
    const dateMs = a.date ? new Date(a.date).getTime() : 0;
    if (existing) {
      existing.visits += 1;
      if (a.status === 'completed') existing.completed += 1;
      if (dateMs > existing.lastDateMs) {
        existing.lastDateMs = dateMs;
        existing.lastDate = a.date;
        existing.lastStatus = a.status;
      }
    } else {
      map.set(a.userId, {
        userId: a.userId,
        name: a.userName || 'Unknown Patient',
        email: a.userEmail || null,
        phone: a.userPhone || null,
        gender: a.userGender || null,
        age: a.userAge ?? null,
        visits: 1,
        completed: a.status === 'completed' ? 1 : 0,
        lastDateMs: dateMs,
        lastDate: a.date,
        lastStatus: a.status,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastDateMs - a.lastDateMs);
};

const PatientsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await appointmentService.getDoctorAppointments();
      setAppointments(data?.appointments ?? []);
    } catch (err) {
      console.warn('[Patients] fetch error:', err?.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(false); };

  const patients = useMemo(() => derivePatients(appointments), [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q),
    );
  }, [patients, query]);

  const openPatient = p => {
    const theirs = appointments.filter(a => a.userId === p.userId);
    navigation.navigate('PatientDetail', { id: p.userId, patient: p, appointments: theirs });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openPatient(item)}>
      <View style={styles.avatar}>
        <MCIcon name="account" size={28} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.email || item.phone || 'No contact'}
        </Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <MCIcon name="calendar-check" size={11} color={colors.textSecondary} />
            <Text style={styles.pillText}>{item.visits} visit{item.visits === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.pill}>
            <MCIcon name="history" size={11} color={colors.textSecondary} />
            <Text style={styles.pillText}>Last {formatDate(item.lastDate)}</Text>
          </View>
        </View>
      </View>
      <MCIcon name="chevron-right" size={22} color={colors.borderStrong} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Patients"
        right={
          <TouchableOpacity onPress={onRefresh}>
            <MCIcon name="refresh" size={22} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <MCIcon name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MCIcon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <MCIcon name="account-search-outline" size={60} color={colors.border} />
          <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No patients yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {query
              ? 'No patients match your search.'
              : 'Patients appear here once you have appointments with them.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.userId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        />
      )}
    </View>
  );
};

export default PatientsScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.card,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: colors.textPrimary },

  list: { padding: SPACING.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  pillRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});
