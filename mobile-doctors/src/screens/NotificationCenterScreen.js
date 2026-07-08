import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import notificationsService from '../services/notificationsService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const CATEGORY_META = {
  appointment: { icon: 'calendar-clock',      color: '#2563EB' },
  payment:     { icon: 'credit-card-outline', color: '#0284C7' },
  promo:       { icon: 'tag-outline',         color: '#F59E0B' },
  reminder:    { icon: 'bell-ring-outline',   color: '#7C3AED' },
  system:      { icon: 'information-outline', color: '#6B7280' },
};

const timeAgo = iso => {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

const NotificationCenterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(() => {
    notificationsService
      .list({ limit: 100 })
      .then(data => {
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchList();
    }, [fetchList])
  );

  const openItem = item => {
    if (!item.isRead) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnread(u => Math.max(0, u - 1));
      notificationsService.markRead(item.id).catch(() => {});
    }
    if (item.data?.appointmentId && (item.category === 'appointment' || item.category === 'reminder')) {
      navigation.navigate('Appointments', { screen: 'AppointmentsMain' });
    }
  };

  const markAll = () => {
    if (!unread) return;
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
    notificationsService.markAllRead().catch(() => {});
  };

  const renderItem = ({ item }) => {
    const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        onPress={() => openItem(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}1E` }]}>
          <MCIcon name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        onBack={() => navigation.goBack()}
        right={
          unread ? (
            <TouchableOpacity onPress={markAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.markAll}>Mark all</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchList}
          ListEmptyComponent={
            <View style={styles.center}>
              <MCIcon name="bell-off-outline" size={52} color={colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySub}>
                New bookings, cancellations and reminders will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 },
  markAll: { color: colors.white, fontSize: 13, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.textPrimary },
  titleUnread: { fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11.5, color: colors.textMuted, marginTop: 6, fontWeight: '500' },
  emptyText: { marginTop: 14, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptySub: { marginTop: 6, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
});

export default NotificationCenterScreen;
