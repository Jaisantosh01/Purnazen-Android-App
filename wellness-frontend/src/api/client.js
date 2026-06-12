import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/apiEndpoints';

const STATUS_MESSAGES = {
  401: 'Unauthorized. Please login again.',
  403: 'Access forbidden.',
  404: 'Resource not found.',
  500: 'Server error. Please try again later.',
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach the auth token to every request
client.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize errors so callers can rely on error.message
client.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const serverMessage =
      typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : null;

    const message =
      serverMessage ||
      STATUS_MESSAGES[status] ||
      (status
        ? `Request failed with status ${status}`
        : 'Network error. Please check your connection.');

    return Promise.reject(new Error(message));
  },
);

// Same surface as the old httpInterceptor: methods resolve to the parsed body
const apiClient = {
  get: (endpoint, config) => client.get(endpoint, config).then(response => response.data),
  post: (endpoint, body, config) =>
    client.post(endpoint, body, config).then(response => response.data),
  put: (endpoint, body, config) =>
    client.put(endpoint, body, config).then(response => response.data),
  delete: (endpoint, config) => client.delete(endpoint, config).then(response => response.data),
};

export default apiClient;
