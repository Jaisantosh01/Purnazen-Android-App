import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Full-screen "service unavailable" placeholder.
 * Show when a screen cannot load its primary data.
 *
 * Props:
 *   title      – headline (default: "Service Unavailable")
 *   message    – body text
 *   onRetry    – called when the user taps Retry
 *   loading    – show spinner instead of Retry button
 *   icon       – MaterialCommunityIcons name (default: "server-off")
 */
const ServiceUnavailable = ({
  title   = 'Service Unavailable',
  message = 'We\'re having trouble reaching the server. Please check your connection and try again.',
  onRetry,
  loading = false,
  icon    = 'server-off',
}) => (
  <View style={styles.root}>
    <View style={styles.iconBox}>
      <MCIcon name={icon} size={56} color="#9ca3af" />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <TouchableOpacity
        style={[styles.retryBtn, loading && styles.retryBtnDisabled]}
        onPress={loading ? undefined : onRetry}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MCIcon name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </>
        )}
      </TouchableOpacity>
    )}
  </View>
);

export default ServiceUnavailable;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
    backgroundColor: '#f9fafb',
  },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C850C0',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  retryBtnDisabled: { opacity: 0.7 },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
