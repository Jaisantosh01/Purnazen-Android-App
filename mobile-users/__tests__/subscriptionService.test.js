/**
 * subscriptionService unwraps the { success, message, data } envelope and
 * posts the snake_case plan_code the backend expects.
 *
 * @format
 */

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import apiClient from '../src/api/client';
import subscriptionService from '../src/services/subscriptionService';

describe('subscriptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getPlans returns the plans array from the envelope', async () => {
    apiClient.get.mockResolvedValue({ data: { plans: [{ code: 'free' }, { code: 'premium' }] } });
    await expect(subscriptionService.getPlans()).resolves.toEqual([
      { code: 'free' },
      { code: 'premium' },
    ]);
  });

  it('getPlans defaults to [] when the payload is missing', async () => {
    apiClient.get.mockResolvedValue({ data: {} });
    await expect(subscriptionService.getPlans()).resolves.toEqual([]);
  });

  it('getCurrent returns the subscription object', async () => {
    apiClient.get.mockResolvedValue({ data: { subscription: { planCode: 'premium' } } });
    await expect(subscriptionService.getCurrent()).resolves.toEqual({ planCode: 'premium' });
  });

  it('getCurrent returns null when absent', async () => {
    apiClient.get.mockResolvedValue({ data: {} });
    await expect(subscriptionService.getCurrent()).resolves.toBeNull();
  });

  it('subscribe posts { plan_code } and returns the subscription', async () => {
    apiClient.post.mockResolvedValue({ data: { subscription: { planCode: 'pro' } } });
    const res = await subscriptionService.subscribe('pro');
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.stringMatching(/subscriptions\/subscribe$/),
      { plan_code: 'pro' },
    );
    expect(res).toEqual({ planCode: 'pro' });
  });
});
