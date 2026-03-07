import axios from 'axios';
import { supabase } from './supabase';
import { API_URL } from './api';

const axiosInstance = axios.create({ baseURL: API_URL });

axiosInstance.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  res => res,
  async (error) => {
    if (error.response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        error.config.headers.Authorization = `Bearer ${session.access_token}`;
        return axiosInstance(error.config);
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
