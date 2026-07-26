import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Linking,
} from 'react-native';
import { showAlert } from '../utils/alert';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

const leafletHtml = (lat, lng, zoom) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0}html,body,#map{width:100%;height:100%}
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map',{dragging:true,zoomControl:false}).setView([${lat || 20.5937}, ${lng || 78.9629}], ${zoom || 5});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://openstreetmap.org/copyright">OSM</a>'}).addTo(map);
  function sendCenter(){
    var c = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'moveend',lat:c.lat.toFixed(6),lng:c.lng.toFixed(6)}));
  }
  map.on('moveend', sendCenter);
  map.on('load', function(){ sendCenter(); });
  function panTo(lat,lng,zoom){
    map.setView([lat,lng],zoom||15,{animate:true});
  }
</script>
</body></html>`;

const DEBOUNCE_MS = 500;

let _pendingClinic = null;
export const _pullPendingClinic = () => {
  const c = _pendingClinic;
  _pendingClinic = null;
  return c;
};

const ClinicAddressPickerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);

  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const searchTimer = useRef(null);
  const webViewRef = useRef(null);
  const skipSearchRef = useRef(false);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const url = `${NOMINATIM_SEARCH}?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'PurnazenAdmin/1.0' } });
        const data = await res.json();
        setSuggestions(data || []);
        setShowSuggestions(data && data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const reverseGeocode = async (lat, lng, addr) => {
    if (!addr) {
      try {
        const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'PurnazenAdmin/1.0' } });
        const data = await res.json();
        addr = data.address || {};
      } catch { return; }
    }
    const parts = [addr.suburb, addr.neighbourhood, addr.road, addr.house_number].filter(Boolean);
    setAddress(parts.join(', ') || addr.display_name || '');
    setPincode(addr.postcode || '');
    setCity(addr.city || addr.town || addr.village || addr.county || '');
  };

  const selectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSearchQuery(item.display_name || '');
    skipSearchRef.current = true;
    setShowSuggestions(false);
    setShowMap(true);
    if (mapReadyRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(`panTo(${lat},${lng},16);true;`);
    }
    reverseGeocode(lat, lng, item.address);
  };

  const getPosition = (options) =>
    new Promise((resolve, reject) => Geolocation.getCurrentPosition(resolve, reject, options));

  const handleCurrentLocation = async () => {
    if (Platform.OS === 'android') {
      let granted;
      try {
        granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Admin app uses your location to fill in clinic address automatically.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
      } catch {
        granted = PermissionsAndroid.RESULTS.DENIED;
      }
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        showAlert(
          'Location Permission Needed',
          'Location access is turned off for this app. Enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        showAlert('Permission Denied', 'Location permission is required.');
        return;
      }
    }

    setLocating(true);
    try {
      let pos;
      try {
        pos = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 });
      } catch {
        pos = await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
      }
      const { latitude, longitude } = pos.coords;
      setSelectedLat(latitude);
      setSelectedLng(longitude);
      setSearchQuery('');
      setShowSuggestions(false);
      setShowMap(true);
      if (mapReadyRef.current && webViewRef.current) {
        webViewRef.current.injectJavaScript(`panTo(${latitude},${longitude},16);true;`);
      }
      reverseGeocode(latitude, longitude);
    } catch (err) {
      showAlert(
        'Location Unavailable',
        err?.code === 2
          ? 'Turn on your device location (GPS) and try again.'
          : 'Could not get your current location.',
      );
    } finally {
      setLocating(false);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        mapReadyRef.current = true;
        if (selectedLat && selectedLng && webViewRef.current) {
          webViewRef.current.injectJavaScript(`panTo(${selectedLat},${selectedLng},15);true;`);
        }
      }
      if (msg.type === 'moveend') {
        const lat = parseFloat(msg.lat);
        const lng = parseFloat(msg.lng);
        setSelectedLat(lat);
        setSelectedLng(lng);
        reverseGeocode(lat, lng);
      }
    } catch {}
  };

  const handleSave = () => {
    if (!clinicName.trim()) {
      showAlert('Required', 'Please enter the clinic name.');
      return;
    }
    if (!address.trim()) {
      showAlert('Required', 'Please enter the clinic address (auto-filled from map or type manually).');
      return;
    }
    if (!city.trim()) {
      showAlert('Required', 'Please enter the city.');
      return;
    }
    if (!pincode.trim()) {
      showAlert('Required', 'Please enter the pincode.');
      return;
    }
    if (!selectedLat || !selectedLng) {
      showAlert('Required', 'Please select a location on the map.');
      return;
    }

    _pendingClinic = {
      name: clinicName.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      pincode: pincode.trim(),
      is_primary: isPrimary,
      latitude: selectedLat,
      longitude: selectedLng,
    };
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add Clinic Address" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}>
              <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for clinic location..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searching && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />
              )}
            </View>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={handleCurrentLocation}
              activeOpacity={0.7}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MCIcon name="crosshairs-gps" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              <ScrollView
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
              >
                {suggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={item.osm_id || idx}
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <MCIcon name="map-marker" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Map */}
        {showMap && (
          <View style={styles.mapContainer}>
            <View style={{ flex: 1 }}>
              <WebView
                ref={webViewRef}
                source={{ html: leafletHtml(selectedLat, selectedLng, 15) }}
                style={styles.map}
                scrollEnabled={false}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
              />
              <View style={styles.centerMarker} pointerEvents="none">
                <MCIcon name="map-marker" size={36} color={colors.danger} />
              </View>
            </View>
            <View style={styles.markerHint}>
              <MCIcon name="gesture-pan" size={14} color={colors.white} />
              <Text style={styles.markerHintText}>Pan the map to position the pin</Text>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Clinic Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Clinic Name <Text style={{color: '#E53935'}}>*</Text></Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Sarah Acupressure Clinic"
              placeholderTextColor={colors.textMuted}
              value={clinicName}
              onChangeText={setClinicName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Address <Text style={{color: '#E53935'}}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldAutoFilled]}
              placeholder="Auto-filled from location"
              placeholderTextColor={colors.textMuted}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>City <Text style={{color: '#E53935'}}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldAutoFilled]}
                placeholder="Auto-filled"
                placeholderTextColor={colors.textMuted}
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Pincode <Text style={{color: '#E53935'}}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldAutoFilled]}
                placeholder="Auto-filled"
                placeholderTextColor={colors.textMuted}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. +91-9876543210"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity style={styles.primaryRow} onPress={() => setIsPrimary(!isPrimary)}>
            <MCIcon
              name={isPrimary ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={isPrimary ? colors.primary : colors.textMuted}
            />
            <Text style={styles.primaryLabel}>Set as primary clinic</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save Clinic</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  searchSection: { paddingHorizontal: 16, paddingTop: 16, zIndex: 10, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, height: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0 },
  searchSpinner: { marginLeft: 8 },
  locationBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionsDropdown: {
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, marginTop: 6,
    maxHeight: 200, zIndex: 100,
    elevation: 12,
  },
  suggestionsScroll: { maxHeight: 200 },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceMuted,
  },
  suggestionText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  mapContainer: {
    marginHorizontal: 16, marginTop: 12,
    height: 220, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border,
  },
  map: { flex: 1 },
  centerMarker: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -18, marginTop: -36,
    zIndex: 10,
  },
  markerHint: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  markerHintText: { fontSize: 11, color: colors.white },

  formSection: { paddingHorizontal: 16, marginTop: 20 },
  formSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.textPrimary,
  },
  fieldAutoFilled: { borderColor: colors.primaryLight },
  fieldRow: { flexDirection: 'row', gap: 0 },

  primaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingVertical: 6,
  },
  primaryLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  footer: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
});

export default ClinicAddressPickerScreen;
