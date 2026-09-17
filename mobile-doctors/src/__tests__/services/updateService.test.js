/**
 * Update check: version comparison, store links from the backend, Play
 * In-App Updates first on Android, link fallbacks everywhere else.
 */
import { Linking, NativeModules, Platform } from 'react-native';
import apiClient from '../../api/client';
import {
  checkForUpdate,
  compareSemver,
  openStoreListing,
  resumeInterruptedUpdate,
  storeTargets,
} from '../../services/updateService';

jest.mock('../../api/client', () => ({ get: jest.fn() }));

// The service caches the last storeLinks it saw; a response without any
// resets that cache.
const resetLinks = async () => {
  apiClient.get.mockResolvedValue({ data: { version: '99.0.0' } });
  await checkForUpdate({ force: true });
};

describe('updateService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    delete NativeModules.InAppUpdate;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await resetLinks();
  });

  it('compares dotted versions numerically', () => {
    expect(compareSemver('1.2.10', '1.2.9')).toBe(1);
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
  });

  it('reports a newer version and uses the link the backend sent', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        version: '99.0.0',
        forced: true,
        notes: 'Fixes',
        storeLinks: { android: 'https://appdistribution.firebase.dev/i/abc' },
      },
    });
    const u = await checkForUpdate({ force: true });
    expect(u).toEqual(expect.objectContaining({ version: '99.0.0', forced: true }));

    await openStoreListing();
    expect(Linking.openURL).toHaveBeenCalledWith('https://appdistribution.firebase.dev/i/abc');
  });

  it('returns null when up to date or offline', async () => {
    apiClient.get.mockResolvedValue({ data: { version: '0.0.1' } });
    await expect(checkForUpdate({ force: true })).resolves.toBeNull();
    apiClient.get.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate({ force: true })).resolves.toBeNull();
  });

  it('uses Play In-App Updates when the app came from Play', async () => {
    NativeModules.InAppUpdate = { startImmediate: jest.fn().mockResolvedValue('started') };
    await expect(openStoreListing()).resolves.toBe(true);
    expect(NativeModules.InAppUpdate.startImmediate).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('falls back to the Play listing for sideloaded builds', async () => {
    NativeModules.InAppUpdate = { startImmediate: jest.fn().mockResolvedValue('not_from_play') };
    await openStoreListing();
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^market:\/\/details\?id=/));
  });

  it('tries the web listing when the Play app is missing', async () => {
    Linking.openURL.mockRejectedValueOnce(new Error('no handler'));
    await openStoreListing();
    expect(Linking.openURL).toHaveBeenLastCalledWith(
      expect.stringMatching(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/),
    );
  });

  it('opens nothing on iOS until an App Store id or link exists', async () => {
    Platform.OS = 'ios';
    NativeModules.InAppUpdate = { startImmediate: jest.fn() };
    await expect(openStoreListing()).resolves.toBe(false);
    expect(NativeModules.InAppUpdate.startImmediate).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(storeTargets({ ios: 'https://testflight.apple.com/join/X' })).toEqual([
      'https://testflight.apple.com/join/X',
      null,
    ]);
  });

  it('resumes an interrupted Play update, Android only', async () => {
    await expect(resumeInterruptedUpdate()).resolves.toBe('unsupported');
    NativeModules.InAppUpdate = { resumeIfInProgress: jest.fn().mockResolvedValue('started') };
    await expect(resumeInterruptedUpdate()).resolves.toBe('started');
    Platform.OS = 'ios';
    await expect(resumeInterruptedUpdate()).resolves.toBe('unsupported');
  });
});
