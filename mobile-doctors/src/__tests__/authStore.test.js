import { useAuthStore } from '../store/authStore';
import { ENDPOINTS } from '../constants/apiEndpoints';

describe('authStore', () => {
  beforeEach(() => useAuthStore.getState().clearAuth());

  it('starts logged out', () => {
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().doctor).toBeNull();
  });

  it('setAuth marks the doctor logged in', () => {
    useAuthStore.getState().setAuth({ id: 1, full_name: 'Dr. Test' });
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().doctor.full_name).toBe('Dr. Test');
  });

  it('clearAuth logs out', () => {
    useAuthStore.getState().setAuth({ id: 1 });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });
});

describe('apiEndpoints', () => {
  it('builds versioned paths', () => {
    expect(ENDPOINTS.LOGIN).toBe('/api/v1/auth/login');
    expect(ENDPOINTS.AVAILABILITY_ITEM(7)).toBe('/api/v1/doctor-availability/7');
    expect(ENDPOINTS.APPOINTMENT_DETAIL('abc')).toBe('/api/v1/appointments/abc');
  });
});
