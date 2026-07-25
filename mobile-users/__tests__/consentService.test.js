/**
 * consentService.getConsents() must key its map on the API's camelCase
 * `consentType` field. Regression guard: it previously read `consent_type`,
 * so every key came out `undefined` and the consent toggles all read as OFF.
 *
 * @format
 */

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import apiClient from '../src/api/client';
import consentService from '../src/services/consentService';

describe('consentService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps camelCase consentType keys to granted booleans', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        consents: [
          { consentType: 'scan_storage', granted: true },
          { consentType: 'ai_training', granted: false },
        ],
      },
    });
    await expect(consentService.getConsents()).resolves.toEqual({
      scan_storage: true,
      ai_training: false,
    });
  });

  it('also accepts the snake_case consent_type form', async () => {
    apiClient.get.mockResolvedValue({
      data: { consents: [{ consent_type: 'gdpr_data', granted: true }] },
    });
    await expect(consentService.getConsents()).resolves.toEqual({ gdpr_data: true });
  });

  it('hasConsent reflects the resolved map', async () => {
    apiClient.get.mockResolvedValue({
      data: { consents: [{ consentType: 'scan_storage', granted: true }] },
    });
    await expect(consentService.hasConsent('scan_storage')).resolves.toBe(true);
    await expect(consentService.hasConsent('ai_training')).resolves.toBe(false);
  });

  it('setConsent posts the snake_case payload', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await consentService.setConsent('ai_training', true);
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.stringMatching(/consent\/$/),
      { consent_type: 'ai_training', granted: true },
    );
  });
});
