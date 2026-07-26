import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import Avatar from './Avatar';
import { getInitials } from '../utils/patientUtils';

const PatientCard = ({ item, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress(item)}>

      <Avatar
        uri={item.avatarUrl}
        name={item.name}
        initials={getInitials(item.name)}
        size={40}
        backgroundColor={colors.primaryLight}
      />

      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardMeta}>{item.gender} • {item.ageStr || `${item.age} Years`}</Text>

        <View style={styles.cardStatsRow}>
          <Text style={styles.consultationsCount}>{item.totalConsultations} Consultations</Text>
          <Text style={styles.separatorDot}>|</Text>
          <Text style={styles.lastVisitValue}>Last Visit: {item.lastVisit || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.chevronWrap}>
        <MCIcon name="chevron-right" size={24} color={colors.textMuted} />
      </View>

    </TouchableOpacity>
  );
};

const PatientSeparator = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.separator} />;
};

export { PatientCard, PatientSeparator };
export default PatientCard;

const makeStyles = colors =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardBody: {
    flex: 1,
    marginLeft: SPACING.sm,
    gap: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  consultationsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  separatorDot: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '300',
  },
  lastVisitValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chevronWrap: {
    paddingLeft: SPACING.xs,
  },
  separator: {
    height: SPACING.md,
  },
});
