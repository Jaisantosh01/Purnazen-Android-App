import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

const userService = {
  /** Fetch detailed profile info of a specific user/patient. */
  async getUser(userId) {
    // apiClient.get resolves to response.data (the full FastAPI JSON body:
    //   { success: true, message: "...", data: { id, full_name, email, ... } })
    // so the patient record lives at res.data.
    const res = await apiClient.get(ENDPOINTS.USER_DETAIL(userId));
    return res?.data ?? null;
  },
};

export default userService;
