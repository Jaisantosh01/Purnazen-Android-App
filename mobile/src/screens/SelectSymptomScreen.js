import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import { COLORS } from '../constants/theme';

const SYMPTOMS = [
  { id: '1', title: 'Headache',      subtitle: 'Tension & migraine relief', icon: '🧠', bgColor: '#EEF0FF' },
  { id: '2', title: 'Neck Pain',     subtitle: 'Stiffness & pain relief',   icon: '⚡', bgColor: '#F3EEFF' },
  { id: '3', title: 'Back Pain',     subtitle: 'Lower & upper back',        icon: '🔥', bgColor: '#FFF3EE' },
  { id: '4', title: 'Stress & Anxiety', subtitle: 'Mental relaxation',     icon: '💨', bgColor: '#EEFAF6' },
  { id: '5', title: 'Shoulder Pain', subtitle: 'Frozen shoulder relief',    icon: '🤚', bgColor: '#EEFAF0' },
  { id: '6', title: 'Insomnia',      subtitle: 'Better sleep quality',      icon: '💜', bgColor: '#F0EEFF' },
  { id: '7', title: 'Eye Strain',    subtitle: 'Digital eye fatigue',       icon: '👁️', bgColor: '#FFEEEE' },
  { id: '8', title: 'Ear Pain',      subtitle: 'Earache relief',            icon: '👂', bgColor: '#FFFBEE' },
];

const SelectSymptomScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSymptoms = SYMPTOMS.filter(symptom =>
    symptom.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    symptom.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header + Search ── */}
<View style={styles.header}>
  <View style={styles.headerTop}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => navigation.goBack()}
    >
      <Text style={styles.backIcon}>←</Text>
    </TouchableOpacity>
    <View style={styles.headerText}>
      <Text style={styles.headerTitle}>Select Symptom</Text>
      <Text style={styles.headerSubtitle}>Choose what you're experiencing</Text>
    </View>
    <View style={styles.backBtn} />
  </View>

  <View style={styles.searchContainer}>
    <Text style={styles.searchIcon}>🔍</Text>
    <TextInput
      style={styles.searchInput}
      placeholder="Search symptoms..."
      placeholderTextColor={COLORS.textMuted}
      value={searchQuery}
      onChangeText={setSearchQuery}
    />
    {searchQuery.length > 0 && (
      <TouchableOpacity onPress={() => setSearchQuery('')}>
        <Text style={styles.clearBtn}>✕</Text>
      </TouchableOpacity>
    )}
  </View>
</View>

      {/* ── Symptom List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      >
       {filteredSymptoms.length > 0 ? (
  <View style={styles.cardsWrapper}>
    {filteredSymptoms.map((symptom, index) => (
      <TouchableOpacity
        key={symptom.id}
        style={[
          styles.symptomCard,
          { backgroundColor: symptom.bgColor },
          index < filteredSymptoms.length - 1 && styles.symptomBorder,
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.symptomIcon}>{symptom.icon}</Text>
        </View>
        <View style={styles.symptomInfo}>
          <Text style={styles.symptomTitle}>{symptom.title}</Text>
          <Text style={styles.symptomSubtitle}>{symptom.subtitle}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    ))}
  </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No symptoms found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with a different keyword
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SelectSymptomScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Header
header: {
  backgroundColor: COLORS.white,
  paddingTop: 50,
  paddingHorizontal: 16,
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.surfaceMuted,
},
headerTop: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
},
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  headerText: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Search
  searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f9fafb',
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.surfaceMuted,
},
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
  },
  clearBtn: {
    fontSize: 14,
    color: COLORS.textMuted,
    paddingLeft: 8,
  },

  // Symptom List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
cardsWrapper: {
  backgroundColor: COLORS.white,
  borderRadius: 16,
  overflow: 'hidden',
  shadowColor: COLORS.black,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
},
symptomCard: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 14,
},
symptomBorder: {
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(0,0,0,0.06)',
},
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  symptomIcon: {
    fontSize: 22,
  },
  symptomInfo: {
    flex: 1,
  },
  symptomTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  symptomSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  arrow: {
    fontSize: 22,
    color: COLORS.textMuted,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
