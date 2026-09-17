/**
 * Sign in with Apple — Apple's own button, iOS only.
 *
 * App Review guideline 4.8 asks for Sign in with Apple wherever another social
 * login (Google here) is offered, and the Human Interface Guidelines ask for
 * Apple's button rather than a look-alike, so this renders
 * AppleAuthenticationButton from expo-apple-authentication. On Android, on
 * devices where the capability is unavailable, and in builds without the
 * native module, it renders nothing.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import socialAuthService from '../services/socialAuthService';

const AppleSignInButton = ({ onPress, loading = false, disabled = false, isDark = false, label = 'continue' }) => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    socialAuthService.isAppleSignInAvailable().then(ok => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  let Apple;
  try {
    Apple = require('expo-apple-authentication');
  } catch {
    return null;
  }

  return (
    <View
      style={styles.wrap}
      pointerEvents={disabled || loading ? 'none' : 'auto'}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <Apple.AppleAuthenticationButton
        buttonType={
          label === 'signup'
            ? Apple.AppleAuthenticationButtonType.SIGN_UP
            : Apple.AppleAuthenticationButtonType.CONTINUE
        }
        buttonStyle={
          isDark
            ? Apple.AppleAuthenticationButtonStyle.WHITE
            : Apple.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={14}
        style={styles.button}
        onPress={onPress}
      />
      {loading ? (
        <View style={styles.busy}>
          <ActivityIndicator color={isDark ? '#000' : '#fff'} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 12, opacity: 1 },
  button: { width: '100%', height: 50 },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppleSignInButton;
