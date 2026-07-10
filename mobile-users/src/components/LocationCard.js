import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { SPACING, RADIUS } from '../constants/theme';

export const openInGoogleMaps = (latitude, longitude, label, address) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  let url;
  let webUrl;

  if (!isNaN(lat) && !isNaN(lng)) {
    const encodedLabel = encodeURIComponent(label || 'Location');
    if (Platform.OS === 'ios') {
      url = `maps://?q=${encodedLabel}&ll=${lat},${lng}`;
    } else {
      url = `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
    }
    webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  } else if (address) {
    const encodedAddress = encodeURIComponent(address);
    if (Platform.OS === 'ios') {
      url = `maps://?q=${encodedAddress}`;
    } else {
      url = `geo:0,0?q=${encodedAddress}`;
    }
    webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  } else {
    return;
  }

  Linking.openURL(url).catch(() => {
    Linking.openURL(webUrl).catch(() => {});
  });
};

const LocationCard = ({ location }) => {
  const { colors } = useTheme();

  if (!location || location.type === 'video') return null;

  const isClinic = location.type === 'clinic';
  const typeIcon = isClinic ? 'hospital-building' : 'home-outline';

  const handlePress = () => {
    openInGoogleMaps(location.latitude, location.longitude, location.name, location.address);
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={handlePress}
    >
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <MCIcon name="map-marker" size={18} color={colors.primary} style={styles.headerIcon} />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Location</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.locationNameRow}>
          <MCIcon name={typeIcon} size={18} color={colors.primary} />
          <Text style={[styles.locationName, { color: colors.textPrimary }]}>
            {location.name}
          </Text>
        </View>

        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
          {location.address}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default LocationCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  headerIcon: {
    marginRight: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardBody: {
    gap: SPACING.sm,
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  locationName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  addressText: {
    fontSize: 13.5,
    lineHeight: 19,
    paddingLeft: 18 + SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
