import consultService from '../../services/consultService';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('ConsultService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getFilterTabs', () => {
    it('returns filter tabs from api', async () => {
      const filterTabs = [{ id: '1', label: 'All' }, { id: '2', label: 'Video Call' }];
      apiClient.get.mockResolvedValue({ success: true, data: { filterTabs } });

      const result = await consultService.getFilterTabs();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(filterTabs);
    });

    it('propagates error', async () => {
      apiClient.get.mockRejectedValue(new Error('Server error'));

      await expect(consultService.getFilterTabs()).rejects.toThrow('Server error');
    });
  });

  describe('getDoctors', () => {
    it('returns doctors with hasMore pagination flag', async () => {
      const doctors = [{ id: 1, name: 'Dr. Smith', fee: 500 }];
      apiClient.get.mockResolvedValue({ success: true, data: { doctors, total: 1 } });

      const result = await consultService.getDoctors('All', '', 1);

      expect(result.doctors).toEqual(doctors);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false); // 1 * 10 >= 1
    });

    it('includes search param in query when provided', async () => {
      apiClient.get.mockResolvedValue({ success: true, data: { doctors: [], total: 0 } });

      await consultService.getDoctors('All', 'cardio', 1);

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('search=cardio'));
    });

    it('propagates error', async () => {
      apiClient.get.mockRejectedValue(new Error('Timeout'));

      await expect(consultService.getDoctors()).rejects.toThrow('Timeout');
    });
  });

  describe('getDoctorDetail', () => {
    it('returns doctor detail data', async () => {
      const detail = { about: 'Specialist in cardiology', education: 'MBBS' };
      apiClient.get.mockResolvedValue({ success: true, data: detail });

      const result = await consultService.getDoctorDetail(42);

      expect(result).toEqual(detail);
    });
  });

  describe('bookAppointment', () => {
    it('returns booking confirmation data', async () => {
      const booking = { bookingRef: 'BK-001', appointmentId: 1 };
      apiClient.post.mockResolvedValue({ success: true, data: booking });

      const result = await consultService.bookAppointment({ doctorId: 1, date: '2026-07-01' });

      expect(result).toEqual(booking);
    });

    it('propagates booking error', async () => {
      apiClient.post.mockRejectedValue(new Error('Slot unavailable'));

      await expect(consultService.bookAppointment({})).rejects.toThrow('Slot unavailable');
    });
  });

  describe('processPayment', () => {
    it('returns payment order data', async () => {
      const order = { orderId: 'ORD-001', sandboxPaymentId: 'pay_test' };
      apiClient.post.mockResolvedValue({ success: true, data: order });

      const result = await consultService.processPayment({ amount: 590, method: 'card' });

      expect(result).toEqual(order);
    });
  });
});
