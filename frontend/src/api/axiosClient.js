import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true, // sends the httpOnly refresh-token cookie
});

// Access token lives in memory only (never localStorage) to limit XSS blast
// radius. AuthContext is the only thing that calls setAccessToken.
let accessToken = null;
let onSessionExpired = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function onAuthSessionExpired(handler) {
  onSessionExpired = handler;
}

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On a 401 (expired access token), try one silent refresh via the refresh
// cookie and replay the original request. If the refresh itself fails, the
// session is genuinely over — clear it and let AuthContext react.
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const { data } = await axiosClient.post('/auth/refresh');
        setAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        onSessionExpired?.();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
