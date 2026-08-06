import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import permissionsService from '../../services/permissionsService';
import preferencesService from '../../services/preferencesService';

jest.mock('../../services/preferencesService', () => ({
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
}));

describe('permissionsService — location', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // The service short-circuits every check/request to "granted" off Android
    // (iOS asks at the point of use), and jest reports OS as ios.
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    preferencesService.updatePreferences.mockResolvedValue({});
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  });

  afterEach(() => jest.restoreAllMocks());

  describe('locationStatus', () => {
    it('is on only when the OS grant and the stored preference agree', async () => {
      PermissionsAndroid.check.mockResolvedValue(true);
      preferencesService.getPreferences.mockResolvedValue({ locationEnabled: true });

      await expect(permissionsService.locationStatus()).resolves.toEqual({
        granted: true,
        enabled: true,
        effective: true,
      });
    });

    it('stays off when the permission is held but the user turned it off in-app', async () => {
      PermissionsAndroid.check.mockResolvedValue(true);
      preferencesService.getPreferences.mockResolvedValue({ locationEnabled: false });

      const status = await permissionsService.locationStatus();

      expect(status.effective).toBe(false);
      expect(preferencesService.updatePreferences).not.toHaveBeenCalled();
    });

    it('corrects a stored "on" after the permission was revoked in device settings', async () => {
      // Revoking from Android's App info can't notify the app, so the stale
      // preference has to be repaired on read — otherwise the Settings toggle
      // shows "on" over a permission we no longer hold.
      PermissionsAndroid.check.mockResolvedValue(false);
      preferencesService.getPreferences.mockResolvedValue({ locationEnabled: true });

      const status = await permissionsService.locationStatus();

      expect(status).toEqual({ granted: false, enabled: false, effective: false });
      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        locationEnabled: false,
      });
    });

    it('falls back to the device grant when preferences are unreachable', async () => {
      PermissionsAndroid.check.mockResolvedValue(true);
      preferencesService.getPreferences.mockRejectedValue(new Error('offline'));

      await expect(permissionsService.locationStatus()).resolves.toEqual({
        granted: true,
        enabled: true,
        effective: true,
      });
    });
  });

  describe('enableLocation', () => {
    it('requests the OS permission and mirrors the grant into preferences', async () => {
      PermissionsAndroid.check.mockResolvedValue(false);
      PermissionsAndroid.request.mockResolvedValue('granted');

      await expect(permissionsService.enableLocation()).resolves.toEqual({
        granted: true,
        blocked: false,
      });
      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        locationEnabled: true,
      });
    });

    it('reports "blocked" when Android stops showing the prompt', async () => {
      PermissionsAndroid.check.mockResolvedValue(false);
      PermissionsAndroid.request.mockResolvedValue(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );

      await expect(permissionsService.enableLocation()).resolves.toEqual({
        granted: false,
        blocked: true,
      });
    });

    it('does not re-prompt when the permission is already held', async () => {
      PermissionsAndroid.check.mockResolvedValue(true);

      const result = await permissionsService.enableLocation();

      expect(result.granted).toBe(true);
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        locationEnabled: true,
      });
    });
  });

  describe('requestAll', () => {
    it('records that onboarding has prompted', async () => {
      // Regression: this used AsyncStorage.multiSet, removed in v3, so it threw
      // after the dialogs had already been shown — the flag was never written
      // (prompts every launch) and the caller's locationEnabled mirror was
      // skipped entirely.
      PermissionsAndroid.request.mockResolvedValue('granted');

      const result = await permissionsService.requestAll();

      expect(result).toEqual({ camera: true, location: true, notifications: true });
      await expect(permissionsService.hasPrompted()).resolves.toBe(true);
    });

    it('only runs once', async () => {
      PermissionsAndroid.request.mockResolvedValue('granted');

      await permissionsService.ensureRequested();
      await expect(permissionsService.ensureRequested()).resolves.toBeNull();
    });
  });
});
