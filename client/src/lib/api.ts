/**
 * Base URL for all backend API calls.
 * Set REACT_APP_API_URL in client/.env for production.
 * Defaults to /api for production (co-located with frontend)
 * or http://localhost:3001/api for local development.
 */
const getBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // If we are in the browser
  if (typeof window !== 'undefined') {
    // If we are on localhost but NOT port 3001 (i.e., we are the frontend at 3000)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    
    // In production, we assume the API is co-located at /api on the same domain
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3001/api';
};

export const API_URL = getBaseUrl();
