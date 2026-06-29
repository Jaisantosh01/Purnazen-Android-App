import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Biometric login, backed entirely by react-native-keychain's biometric
 * access-control (no extra native dependency).
 *
 * enable()  writes a sentinel credential guarded by BIOMETRY_ANY — the write
 *           itself confirms the device has enrolled biometrics.
 * authenticate() reads it back, which makes the OS show the fingerprint /
 *           Face ID sheet. Success => the user is who they claim.
 *
 * The on/off preference lives in AsyncStorage so we can cheaply check it on
 * bootstrap without touching the keystore.
 */
const BIOMETRIC_SERVICE = 'com.purnazen.doctor.biometric';
const FLAG_KEY = 'biometric_enabled';

async function getSupportedType() {
  try {
    return await Keychain.getSupportedBiometryType();
  } catch {
    return null;
  }
}

const biometricService = {
  getSupportedType,

  async isAvailable() {
    return (await getSupportedType()) != null;
  },

  async isEnabled() {
    return (await AsyncStorage.getItem(FLAG_KEY)) === 'true';
  },

  /** Turn biometric login on. Throws if the device has no enrolled biometrics. */
  async enable() {
    const type = await getSupportedType();
    if (!type) {
      throw new Error('No fingerprint or Face ID is set up on this device.');
    }
    await Keychain.setGenericPassword('purnazen', 'enabled', {
      service: BIOMETRIC_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.setItem(FLAG_KEY, 'true');
    return type;
  },

  async disable() {
    try {
      await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE });
    } catch {
      // entry may not exist — ignore
    }
    await AsyncStorage.removeItem(FLAG_KEY);
  },

  /**
   * Prompt the OS biometric sheet. Resolves true on success, false on
   * cancel / failure (callers decide how to fail closed).
   */
  async authenticate(reason = 'Unlock Purnazen Doctor') {
    try {
      const creds = await Keychain.getGenericPassword({
        service: BIOMETRIC_SERVICE,
        authenticationPrompt: { title: reason },
      });
      return !!creds;
    } catch {
      return false;
    }
  },
};

export default biometricService;
