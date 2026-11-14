import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Aaharva-Web' }
});

client.interceptors.response.use(
  response => response.data?.data ?? response.data,
  error => {
    const serverError = error.response?.data?.error;
    const normalized = new Error(serverError?.message || (error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : error.response ? `Request failed (${error.response.status}).` : 'Cannot reach Aaharva API. Check that the backend is running.'));
    normalized.status = error.response?.status;
    normalized.code = serverError?.code || error.code || 'NETWORK_ERROR';
    normalized.details = serverError?.details;
    normalized.original = error;
    return Promise.reject(normalized);
  }
);

export const api = {
  get: (url, config) => client.get(url, config),
  post: (url, body, config) => client.post(url, body, config),
  patch: (url, body, config) => client.patch(url, body, config),
  put: (url, body, config) => client.put(url, body, config),
  delete: (url, config) => client.delete(url, config)
};
export default client;
