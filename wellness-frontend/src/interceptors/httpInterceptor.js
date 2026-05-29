import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/apiEndpoints';

class HttpInterceptor {

  // Runs before every request — adds headers and auth token
  async onRequest(url, options = {}) {

    // Get token from AsyncStorage and add to every request
    const token = await AsyncStorage.getItem('access_token');

    const headers = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    console.log(`[REQUEST]  ${options.method || 'GET'} ${url}`);

    return { ...options, headers };
  }

  // Runs after every response — handles status codes globally
  async onResponse(response, url) {

    console.log(`[RESPONSE] ${response.status} ${url}`);

    if (response.status === 401) {
      // Token expired or user not logged in
      // Uncomment when auth/navigation is ready 
      // await AsyncStorage.removeItem('token');
      // NavigationService.navigate('Login');
      throw new Error('Unauthorized. Please login again.');
    }

    if (response.status === 403) {
      throw new Error('Access forbidden.');
    }

    if (response.status === 404) {
      throw new Error('Resource not found.');
    }

    if (response.status === 500) {
      throw new Error('Server error. Please try again later.');
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Error Interceptor
  onError(error) {
    console.error('[ERROR]', error.message);
    throw error;
  }

  // GET request
  async get(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const options  = await this.onRequest(url, { method: 'GET' });
      const response = await fetch(url, options);
      return this.onResponse(response, url);
    } catch (error) {
      this.onError(error);
    }
  }

  // POST request
  async post(endpoint, body) {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const options  = await this.onRequest(url, {
        method: 'POST',
        body:   JSON.stringify(body),
      });
      const response = await fetch(url, options);
      return this.onResponse(response, url);
    } catch (error) {
      this.onError(error);
    }
  }

   // PUT request
  async put(endpoint, body) {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const options  = await this.onRequest(url, {
        method: 'PUT',
        body:   JSON.stringify(body),
      });
      const response = await fetch(url, options);
      return this.onResponse(response, url);
    } catch (error) {
      this.onError(error);
    }
  }

  // DELETE request
  async delete(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const options  = await this.onRequest(url, { method: 'DELETE' });
      const response = await fetch(url, options);
      return this.onResponse(response, url);
    } catch (error) {
      this.onError(error);
    }
  }

}

export default new HttpInterceptor();
