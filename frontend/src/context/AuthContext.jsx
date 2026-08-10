import { createContext, useContext, useEffect, useState } from 'react';
import axiosClient, { setAccessToken, onAuthSessionExpired } from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while restoring a session on first load

  useEffect(() => {
    onAuthSessionExpired(() => setUser(null));

    // The access token lives only in memory, so a page refresh loses it —
    // silently trade the httpOnly refresh cookie for a new one on mount.
    axiosClient
      .post('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await axiosClient.post('/auth/login', { email, password });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }

  // Self-service signup: same response shape as login (accessToken + user),
  // so a successful registration logs the new School Admin straight in.
  async function register(payload) {
    const { data } = await axiosClient.post('/auth/register', payload);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }

  async function logout() {
    await axiosClient.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  async function verifyEmail(code) {
    const { data } = await axiosClient.post('/auth/verify-email', { code });
    setUser(data.data.user);
    return data.data.user;
  }

  async function resendVerificationCode() {
    await axiosClient.post('/auth/resend-verification');
  }

  async function changePassword(currentPassword, newPassword) {
    const { data } = await axiosClient.post('/auth/change-password', { currentPassword, newPassword });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }

  // Both public — no session exists yet for someone locked out of their account.
  async function forgotPassword(email) {
    await axiosClient.post('/auth/forgot-password', { email });
  }

  async function resetPassword(token, newPassword) {
    await axiosClient.post('/auth/reset-password', { token, newPassword });
  }

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    verifyEmail,
    resendVerificationCode,
    changePassword,
    forgotPassword,
    resetPassword,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
