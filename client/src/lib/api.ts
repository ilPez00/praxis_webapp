import axios from 'axios';
import { supabase } from './supabase';

/**
 * Base URL for all backend API calls.
 * Set VITE_API_URL in client/.env for production.
 */
const getBaseUrl = () => {
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : undefined;
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    return 'https://web-production-646a4.up.railway.app/api';
  }

  return 'http://localhost:3001/api';
};

export const API_URL = getBaseUrl();

/**
 * Centralized API client with automatic authentication.
 */
const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add Supabase JWT
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
