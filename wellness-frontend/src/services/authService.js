import AsyncStorage from '@react-native-async-storage/async-storage';
import httpInterceptor from '../interceptors/httpInterceptor';
import { ENDPOINTS } from '../constants/apiEndpoints';

class AuthService {

  post(endpoint, body) {
    return httpInterceptor.post(endpoint, body);
  }

  async login(email, password) {
    try {
      const json = await this.post(ENDPOINTS.LOGIN, { email, password });
      const { access_token, refresh_token, user } = json?.data;
      await AsyncStorage.setItem('access_token',  access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);
      await AsyncStorage.setItem('user',          JSON.stringify(user));
      return user;
    } catch (err) {
      throw new Error(err?.message ?? 'Login failed');
    }
  }

  async logout() {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user');
  }

  getToken() {
    return AsyncStorage.getItem('access_token');
  }

  async getUser() {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  async isLoggedIn() {
    const token = await this.getToken();
    return !!token;
  }

}

export default new AuthService();
