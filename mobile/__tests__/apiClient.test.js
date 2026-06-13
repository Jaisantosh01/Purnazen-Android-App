/**
 * Auto-refresh-on-401 behaviour of src/api/client.js, driven through
 * injected axios adapters (no network):
 *  - axiosInstance.defaults.adapter  -> the API under test
 *  - axios.defaults.adapter          -> the bare-axios refresh call
 *
 * @format
 */

import axios from 'axios';
import apiClient, { axiosInstance } from '../src/api/client';
import secureStorage from '../src/utils/secureStorage';
import { useAuthStore } from '../src/store/authStore';

const ok = (config, body) =>
  Promise.resolve({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

// Custom adapters must reject non-2xx themselves (the built-in ones do it
// via settle); a resolved 401 would be treated as success.
const httpError = (config, status, statusText, message) =>
  Promise.reject(
    new axios.AxiosError(
      `Request failed with status code ${status}`,
      axios.AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      {
        data: { success: false, message },
        status,
        statusText,
        headers: {},
        config,
      },
    ),
  );

const unauthorized = (config, message = 'Token has expired') =>
  httpError(config, 401, 'Unauthorized', message);

const authHeader = config =>
  typeof config.headers?.get === 'function'
    ? config.headers.get('Authorization')
    : config.headers?.Authorization;

describe('apiClient auto-refresh on 401', () => {
  let refreshCalls;

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshCalls = 0;
    await secureStorage.setTokens('old-access', 'refresh-token');
    useAuthStore.getState().setAuth({ id: 1, email: 'a@b.com' });

    // Bare-axios adapter: serves /auth/refresh with a new access token
    axios.defaults.adapter = async config => {
      refreshCalls += 1;
      return ok(config, { success: true, data: { access_token: 'new-access' } });
    };
  });

  it('refreshes once and replays the original request', async () => {
    const apiCalls = [];
    axiosInstance.defaults.adapter = async config => {
      apiCalls.push(authHeader(config));
      if (authHeader(config) === 'Bearer new-access') {
        return ok(config, { success: true, data: { items: [42] } });
      }
      return unauthorized(config);
    };

    const body = await apiClient.get('/api/v1/appointments');

    expect(body.data.items).toEqual([42]);
    expect(refreshCalls).toBe(1);
    expect(apiCalls).toEqual(['Bearer old-access', 'Bearer new-access']);
    expect(await secureStorage.getAccessToken()).toBe('new-access');
    expect(await secureStorage.getRefreshToken()).toBe('refresh-token');
  });

  it('queues concurrent 401s behind a single refresh', async () => {
    axiosInstance.defaults.adapter = async config => {
      if (authHeader(config) === 'Bearer new-access') {
        return ok(config, { success: true, data: { url: config.url } });
      }
      return unauthorized(config);
    };

    const [first, second] = await Promise.all([
      apiClient.get('/api/v1/appointments'),
      apiClient.get('/api/v1/therapy-history'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(first.data.url).toBe('/api/v1/appointments');
    expect(second.data.url).toBe('/api/v1/therapy-history');
  });

  it('logs out when the refresh itself fails', async () => {
    axios.defaults.adapter = async config => {
      refreshCalls += 1;
      return unauthorized(config, 'Token has been revoked');
    };
    axiosInstance.defaults.adapter = async config => unauthorized(config);

    await expect(apiClient.get('/api/v1/appointments')).rejects.toThrow(
      'Session expired. Please login again.',
    );

    expect(refreshCalls).toBe(1);
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it('does not try to refresh a 401 from login', async () => {
    axiosInstance.defaults.adapter = async config =>
      unauthorized(config, 'Invalid email or password');

    await expect(
      apiClient.post('/api/v1/auth/login', { email: 'a@b.com', password: 'x' }),
    ).rejects.toThrow('Invalid email or password');

    expect(refreshCalls).toBe(0);
  });

  it('normalizes non-401 errors to the server message', async () => {
    axiosInstance.defaults.adapter = async config =>
      httpError(config, 404, 'Not Found', 'Doctor not found');

    await expect(apiClient.get('/api/v1/doctors/999')).rejects.toThrow(
      'Doctor not found',
    );
    expect(refreshCalls).toBe(0);
  });
});
