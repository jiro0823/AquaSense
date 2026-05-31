import axios, { AxiosError, AxiosInstance } from 'axios';
import type { ApiResponse, SuccessResponse } from '../types/api';

/**
 * API client for backend communication
 */
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.client.interceptors.request.use((config) => {
      const csrfToken = this.getCookieValue('aquasense_csrf');
      if (csrfToken && ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase())) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle errors globally
        if (error.response?.status === 401) {
          localStorage.removeItem('user');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T = unknown>(url: string): Promise<SuccessResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url);
    return response.data as SuccessResponse<T>;
  }

  async post<T = unknown>(url: string, data?: unknown): Promise<SuccessResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data as SuccessResponse<T>;
  }

  async put<T = unknown>(url: string, data?: unknown): Promise<SuccessResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data as SuccessResponse<T>;
  }

  async delete<T = unknown>(url: string): Promise<SuccessResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data as SuccessResponse<T>;
  }

  private getCookieValue(name: string): string | null {
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
  }

  async verifyAuth(): Promise<boolean> {
    try {
      await this.get('/auth/verify');
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.post('/auth/logout');
    localStorage.removeItem('user');
  }
}

export const apiClient = new ApiClient();
