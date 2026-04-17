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
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Request interceptor
    this.client.interceptors.request.use((config) => {
      // Add auth token if needed
      // const token = localStorage.getItem('token');
      // if (token) {
      //   config.headers.Authorization = `Bearer ${token}`;
      // }
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle errors globally
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          // window.location.href = '/login';
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
}

export const apiClient = new ApiClient();
