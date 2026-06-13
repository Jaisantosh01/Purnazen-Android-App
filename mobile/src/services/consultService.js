import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

const PAGE_SIZE = 10;

const FILTER_ENDPOINT_MAP = {
  'All':             ENDPOINTS.DOCTORS,
  'Available Today': ENDPOINTS.DOCTORS_TODAY,
  'Video Call':      ENDPOINTS.DOCTORS_VIDEO,
  'Home Visit':      ENDPOINTS.DOCTORS_HOME,
  'Top Rated':       ENDPOINTS.DOCTORS_TOP,
};

class ConsultService {

  get(endpoint) {
    return apiClient.get(endpoint);
  }

  post(endpoint, body) {
    return apiClient.post(endpoint, body);
  }

  async getFilterTabs() {
    try {
      const json = await this.get(ENDPOINTS.FILTER_TABS);
      return json?.data?.filterTabs;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch filter tabs');
    }
  }

  async getDoctors(activeFilter = 'All', searchQuery = '', pageNum = 1) {
    try {
      const endpointPath = FILTER_ENDPOINT_MAP[activeFilter] || ENDPOINTS.DOCTORS;
      const params = new URLSearchParams({ page: pageNum, limit: PAGE_SIZE });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const json = await this.get(`${endpointPath}?${params.toString()}`);
      return {
        doctors: json?.data?.doctors,
        hasMore: pageNum * PAGE_SIZE < json?.data?.total,
        total:   json?.data?.total,
      };
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch doctors');
    }
  }

  async getDoctorDetail(doctorId) {
    try {
      const json = await this.get(ENDPOINTS.DOCTOR_DETAIL(doctorId));
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch doctor details');
    }
  }

  async getVisitTypes(doctorId) {
    try {
      const json = await this.get(ENDPOINTS.VISIT_TYPES(doctorId));
      return json?.data?.visitTypes;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch visit types');
    }
  }

  async getTimeSlots(doctorId, date) {
    try {
      const params = new URLSearchParams({ date });
      const json = await this.get(`${ENDPOINTS.TIME_SLOTS(doctorId)}?${params.toString()}`);
      return json?.data?.slots;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch time slots');
    }
  }

  async bookAppointment(appointmentData) {
    try {
      const json = await this.post(ENDPOINTS.BOOK_APPOINTMENT, appointmentData);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to book appointment');
    }
  }

  async processPayment(paymentData) {
    try {
      const json = await this.post(ENDPOINTS.PAYMENT, paymentData);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Payment failed');
    }
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    try {
      const json = await this.post(ENDPOINTS.PAYMENT_VERIFY, {
        orderId,
        paymentId,
        signature,
      });
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Payment verification failed');
    }
  }

}

export default new ConsultService();
