const LOCAL_BACKEND_URL = 'http://localhost:5001';

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlashes(
  (import.meta.env.VITE_API_URL as string | undefined) || `${LOCAL_BACKEND_URL}/api/v1`
);

export const WEBSOCKET_URL = trimTrailingSlashes(
  (import.meta.env.VITE_WS_URL as string | undefined) || LOCAL_BACKEND_URL
);
