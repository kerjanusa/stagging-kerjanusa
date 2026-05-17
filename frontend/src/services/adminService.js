import apiClient from '../utils/apiClient';

class AdminService {
  /**
   * Get the live dashboard payload for the authenticated superadmin.
   */
  static async getDashboard() {
    try {
      const response = await apiClient.get('/admin/dashboard');
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Update one managed user account from the superadmin panel.
   */
  static async updateUser(userId, payload) {
    try {
      const response = await apiClient.put(`/admin/users/${userId}`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Ask the backend to send a password-reset link to a selected managed user.
   */
  static async sendResetLink(userId) {
    try {
      const response = await apiClient.post(`/admin/users/${userId}/send-reset-link`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Reassign a job to a different recruiter from the admin workspace.
   */
  static async reassignJob(jobId, recruiterId) {
    try {
      const response = await apiClient.put(`/admin/jobs/${jobId}/reassign`, {
        recruiter_id: recruiterId,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Proxy job updates from the admin panel to the shared jobs endpoint.
   */
  static async updateJob(jobId, payload) {
    try {
      const response = await apiClient.put(`/jobs/${jobId}`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default AdminService;
