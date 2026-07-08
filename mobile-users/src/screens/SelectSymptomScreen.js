import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

// Curated list — maps each symptom to a relief session slug so tapping
// navigates directly to the right guided session.
const SYMPTOMS = [
  { id: '1', title: 'Headache',         subtitle: 'Tension & migraine relief',  icon: 'brain',                  bgColor: '#EEF0FF', reliefSlug: 'headache-relief'    },
  { id: '2', title: 'Neck Pain',        subtitle: 'Stiffness & pain relief',    icon: 'lightning-bolt',         bgColor: '#F3EEFF', reliefSlug: 'neck-pain-relief'    },
  { id: '3', title: 'Back Pain',        subtitle: 'Lower & upper back',         icon: 'fire',                   bgColor: '#FFF3EE', reliefSlug: 'back-pain-relief'    },
  { id: '4', title: 'Stress & Anxiety', subtitle: 'Mental relaxation',          icon: 'weather-windy',          bgColor: '#EEFAF6', reliefSlug: 'stress-relief'       },
  { id: '5', title: 'Shoulder Pain',    subtitle: 'Frozen shoulder relief',     icon: 'hand-back-right-outline', bgColor: '#EEFAF0', reliefSlug: 'shoulder-pain-relief'},
  { id: '6', title: 'Insomnia',         subtitle: 'Better sleep quality',       icon: 'sleep',                  bgColor: '#F0EEFF', reliefSlug: 'insomnia-relief'     },
  { id: '7', title: 'Eye Strain',       subtitle: 'Digital eye fatigue',        icon: 'eye-outline',            bgColor: '#FFEEEE', reliefSlug: 'eye-strain-relief'   },
  { id: '8', title: 'Ear Pain',         subtitle: 'Earache relief',             icon: 'ear-hearing',            bgColor: '#FFFBEE', reliefSlug: 'ear-pain-relief'     },
];

const SelectSymptomScreen = ({ navigation }) => {
  const headerTop = useHeaderTopPadding();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = SYMPTOMS.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.subtitle.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSymptomPress = (symptom) => {
    navigation.navigate('ReliefSession', {
      reliefSlug: symptom.reliefSlug,
      reliefTitle: symptom.title,
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Select Symptom</Text>
            <Text style={styles.headerSubtitle}>Choose what you're experiencing</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.searchContainer}>
          <MCIcon name="magnify" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symptoms..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <MCIcon name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Symptom List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      >
        {filtered.length > 0 ? (
          <View style={styles.cardsWrapper}>
            {filtered.map((symptom, index) => (
              <TouchableOpacity
                key={symptom.id}
                style={[
                  styles.symptomCard,
                  { backgroundColor: symptom.bgColor },
                  index < filtered.length - 1 && styles.symptomBorder,
                ]}
                activeOpacity={0.72}
                onPress={() => handleSymptomPress(symptom)}
              >
                <View style={[styles.iconCircle, { backgroundColor: symptom.bgColor }]}>
                  <MCIcon name={symptom.icon} size={22} color={colors.textPrimary} style={styles.symptomIcon} />
                </View>
                <View style={styles.symptomInfo}>
                  <Text style={styles.symptomTitle}>{symptom.title}</Text>
                  <Text style={styles.symptomSubtitle}>{symptom.subtitle}</Text>
                </View>
                <MCIcon name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MCIcon name="magnify-remove-outline" size={52} color={colors.borderStrong} />
            <Text style={styles.emptyTitle}>No symptoms found</Text>
            <Text style={styles.emptySubtitle}>Try a different keyword</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SelectSymptomScreen;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.card,
  },

  // Header
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  clearBtn: {
    paddingLeft: 6,
  },

  // Symptom Cards
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  cardsWrapper: {
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  symptomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  symptomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    color: colors.textPrimary,
    marginBottom: 3,
  },
  symptomSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
