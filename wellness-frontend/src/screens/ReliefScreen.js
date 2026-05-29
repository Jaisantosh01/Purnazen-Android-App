import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RELIEF_ITEMS } from '../data/reliefData';

const ReliefScreen = ({ navigation }) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Relief</Text>
          <Text style={styles.headerSubtitle}>
            Instant acupressure therapy for common issues
          </Text>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {RELIEF_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: item.bgColor }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('ReliefSession', { reliefKey: item.title })}
            >
              <MCIcon name={item.icon} size={32} color={item.iconColor} style={styles.cardIcon} />
              <Text style={[styles.cardTitle, { color: item.iconColor }]}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.sessions, { color: item.iconColor }]}>
                  {item.sessions} sessions
                </Text>
                <MCIcon name="arrow-right" size={16} color={item.iconColor} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default ReliefScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  card: {
    width: '48%',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    minHeight: 168,
    justifyContent: 'space-between',
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessions: {
    fontSize: 12,
    fontWeight: '500',
  },
});
