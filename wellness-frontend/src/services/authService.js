import AsyncStorage from '@react-native-async-storage/async-storage';
import httpInterceptor from '../interceptors/httpInterceptor';
import { ENDPOINTS } from '../constants/apiEndpoints';

class AuthService {

  post(endpoint, body) {
    return httpInterceptor.post(endpoint, body);
  }

  async login(email, password) {
    try {
      const response = await this.post(ENDPOINTS.LOGIN, {
        email,
        password,
      });

      console.log(response);


      if (!response.success) {
        throw new Error(response.message || "Login failed");
      }

      console.log("1");


      const { access_token, refresh_token, user } = response.data;

      console.log("2");


      console.log(access_token);
      console.log(refresh_token);
      console.log(user);

      await AsyncStorage.setItem("access_token", access_token);
      await AsyncStorage.setItem("refresh_token", refresh_token);
      await AsyncStorage.setItem("user", JSON.stringify(user));

      console.log("3");



      return user;
    } catch (err) {
      throw new Error(err?.message || "Login failed");
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
