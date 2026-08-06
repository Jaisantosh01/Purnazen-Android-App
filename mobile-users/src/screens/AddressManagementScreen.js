import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { showSuccess, showError } from '../utils/toast';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';
import consultService from '../services/consultService';
import permissionsService from '../services/permissionsService';

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

const ADDRESS_TYPES = [
  { label: 'Home', value: 'home' },
  { label: 'Office', value: 'office' },
];

const DEBOUNCE_MS = 500;

const AddressManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState('list');
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);

  const [houseName, setHouseName] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [typeOfAddress, setTypeOfAddress] = useState('home');
  const [isDefault, setIsDefault] = useState(false);

  const searchTimer = useRef(null);
  const webViewRef = useRef(null);
  const skipSearchRef = useRef(false);
  const mapReadyRef = useRef(false);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await consultService.getUserAddresses();
      setAddresses(data || []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

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
        const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'PurnazenApp/1.0' } });
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

  const reverseGeocode = async (lat, lng, addr) => {
    if (!addr) {
      try {
        const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'PurnazenApp/1.0' } });
        const data = await res.json();
        addr = data.address || {};
      } catch { return; }
    }
    setArea([addr.suburb, addr.neighbourhood, addr.road].filter(Boolean).join(', ') || '');
    setPincode(addr.postcode || '');
    setCity(addr.city || addr.town || addr.village || addr.county || '');
    setState(addr.state || '');
  };

  const getPosition = (options) =>
    new Promise((resolve, reject) => Geolocation.getCurrentPosition(resolve, reject, options));

  const handleCurrentLocation = async () => {
    // Goes through permissionsService rather than PermissionsAndroid directly,
    // so granting here also switches Settings → Location Access on instead of
    // leaving the two disagreeing.
    const { granted, blocked } = await permissionsService.ensureLocation();
    if (blocked) {
      // Android suppresses the dialog after repeated denials — Settings is
      // the only way to grant from here.
      showAlert(
        'Location Permission Needed',
        'Location access is turned off for this app. Enable it in Settings to use your current location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    if (!granted) {
      showAlert('Permission Denied', 'Location permission is required to use your current location.');
      return;
    }

    setLocating(true);
    try {
      let pos;
      try {
        pos = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 });
      } catch {
        // No GPS fix (indoors, emulator) — fall back to network location
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
      // 2 = POSITION_UNAVAILABLE: device location (GPS) is switched off
      showAlert(
        'Location Unavailable',
        err?.code === 2
          ? 'Turn on your device location (GPS) and try again.'
          : 'Could not get your current location. Please try again, or search for your address instead.',
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
    } catch { /* ignore malformed messages */ }
  };

  const resetForm = () => {
    setEditingId(null);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedLat(null);
    setSelectedLng(null);
    setShowMap(false);
    setHouseName('');
    setArea('');
    setLandmark('');
    setPincode('');
    setCity('');
    setState('');
    setTypeOfAddress('home');
    setIsDefault(false);
  };

  const openNew = () => {
    resetForm();
    setMode('edit');
  };

  const openEdit = (addr) => {
    setEditingId(addr.id);
    setSearchQuery('');
    setSelectedLat(addr.latitude ? parseFloat(addr.latitude) : null);
    setSelectedLng(addr.longitude ? parseFloat(addr.longitude) : null);
    setShowMap(!!(addr.latitude && addr.longitude));
    setHouseName(addr.houseName || '');
    setArea(addr.area || '');
    setLandmark(addr.landmark || '');
    setPincode(addr.pincode || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setTypeOfAddress(addr.typeOfAddress || 'home');
    setIsDefault(addr.isDefault || false);
    setMode('edit');
  };

  const handleSave = async () => {
    if (!houseName.trim()) {
      showAlert('Required', 'Please enter flat / house / building name.');
      return;
    }
    if (!selectedLat || !selectedLng) {
      showAlert('Required', 'Please select a location on the map or use the search bar.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        houseName: houseName.trim(),
        area: area.trim() || undefined,
        landmark: landmark.trim() || undefined,
        pincode: pincode.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        typeOfAddress,
        isDefault,
        latitude: selectedLat,
        longitude: selectedLng,
      };
      if (editingId) {
        await consultService.updateUserAddress(editingId, payload);
        showSuccess('Address updated successfully');
      } else {
        await consultService.createUserAddress(payload);
        showSuccess('Address created successfully');
      }
      setMode('list');
      resetForm();
      loadAddresses();
    } catch (err) {
      showError(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr) => {
    showAlert(
      'Delete Address',
      `Are you sure you want to delete ${addr.houseName || 'this address'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await consultService.deleteUserAddress(addr.id);
              showSuccess('Address deleted');
              loadAddresses();
            } catch (err) {
              showError(err.message || 'Failed to delete address');
            }
          },
        },
      ],
    );
  };

  if (mode === 'edit') {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title={editingId ? 'Edit Address' : 'Add Address'}
          variant="light"
          onBack={() => { setMode('list'); resetForm(); }}
        />

        <View style={{ flex: 1 }}>
          {/* ── Search bar (fixed above scroll view) ── */}
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for your area or landmark..."
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

          <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

          {/* ── Map ── */}
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

          {/* ── Form ── */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Address Details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Flat / House / Building *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Flat 101, Sunrise Apartments"
                placeholderTextColor={colors.textMuted}
                value={houseName}
                onChangeText={setHouseName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Area / Sector / Locality</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldAutoFilled]}
                placeholder="Auto-filled from location"
                placeholderTextColor={colors.textMuted}
                value={area}
                onChangeText={setArea}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Landmark</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Near City Hospital"
                placeholderTextColor={colors.textMuted}
                value={landmark}
                onChangeText={setLandmark}
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Pincode</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldAutoFilled]}
                  placeholder="Auto-filled"
                  placeholderTextColor={colors.textMuted}
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Town / City</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldAutoFilled]}
                  placeholder="Auto-filled"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldAutoFilled]}
                placeholder="Auto-filled"
                placeholderTextColor={colors.textMuted}
                value={state}
                onChangeText={setState}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Type of Address</Text>
              <View style={styles.typeRow}>
                {ADDRESS_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, typeOfAddress === t.value && styles.typeChipActive]}
                    onPress={() => setTypeOfAddress(t.value)}
                    activeOpacity={0.7}
                  >
                    <MCIcon
                      name={t.value === 'home' ? 'home-outline' : 'office-building-outline'}
                      size={16}
                      color={typeOfAddress === t.value ? colors.primary : colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.typeChipText, typeOfAddress === t.value && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.defaultRow}>
              <Text style={styles.defaultLabel}>Mark as default address</Text>
              <AppToggle value={isDefault} onValueChange={setIsDefault} />
            </View>
          </View>

          {/* ── Action Buttons ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setMode('list'); resetForm(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Save'} Address</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        </View>
      </View>
    );
  }

  /* ── List Mode ── */
  return (
    <View style={styles.root}>
      <ScreenHeader title="My Addresses" variant="light" />

      <FlatList
        data={addresses}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshing={loading}
        onRefresh={loadAddresses}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addCard} onPress={openNew} activeOpacity={0.7}>
            <View style={styles.addIconCircle}>
              <MCIcon name="plus" size={24} color={colors.primary} />
            </View>
            <Text style={styles.addCardText}>Add New Address</Text>
            <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <MCIcon name="map-marker-off-outline" size={48} color={colors.borderStrong} />
              <Text style={styles.emptyTitle}>No Addresses Saved</Text>
              <Text style={styles.emptySubtitle}>
                Add your home or office address for clinic visits and home consultations.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.addressCard} activeOpacity={0.8} onPress={() => openEdit(item)}>
            <View style={styles.addressCardTop}>
              <View style={styles.addressIconCircle}>
                <MCIcon
                  name={item.typeOfAddress === 'office' ? 'office-building-outline' : 'home-outline'}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.addressCardInfo}>
                <View style={styles.addressCardTitleRow}>
                  <Text style={styles.addressCardTitle}>{item.houseName || 'Address'}</Text>
                  {item.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                      <MCIcon name="pencil-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                      <MCIcon name="delete-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.addressCardDetail} numberOfLines={2}>
                  {[item.area, item.landmark, item.city, item.state, item.pincode].filter(Boolean).join(', ')}
                </Text>
                <View style={styles.addressCardFooter}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.typeOfAddress === 'office' ? 'Office' : 'Home'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default AddressManagementScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  /* ── Search ── */
  searchSection: { paddingHorizontal: 16, paddingTop: 16, zIndex: 10, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionsDropdown: {
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, marginTop: 6,
    maxHeight: 200, zIndex: 100,
    elevation: 12, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
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
  suggestionsScroll: { maxHeight: 200 },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceMuted,
  },
  suggestionText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  /* ── Map ── */
  mapContainer: {
    marginHorizontal: 16, marginTop: 12,
    height: 220, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border,
  },
  map: { flex: 1 },
  markerHint: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  markerHintText: { fontSize: 11, color: colors.white },

  centerMarker: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -18, marginTop: -36,
    zIndex: 10,
  },

  /* ── Form ── */
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

  typeRow: { flexDirection: 'row', gap: 12 },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  typeChipText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  typeChipTextActive: { color: colors.primary, fontWeight: '600' },

  defaultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  defaultLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  /* ── Action Buttons ── */
  actionRow: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 8,
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
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  /* ── List Mode ── */
  addCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryFaint, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  addCardText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.primary },
  addressCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  addressCardTop: { flexDirection: 'row', marginBottom: 12 },
  addressIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryFaint, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  addressCardInfo: { flex: 1 },
  addressCardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  addressCardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, flexWrap: 'wrap' },
  cardActions: { flexDirection: 'row', gap: 10, marginLeft: 'auto', paddingTop: 2 },
  defaultBadge: {
    backgroundColor: colors.primaryFaint, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  addressCardDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  addressCardFooter: { flexDirection: 'row', marginTop: 8, gap: 8 },
  typeBadge: {
    backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
