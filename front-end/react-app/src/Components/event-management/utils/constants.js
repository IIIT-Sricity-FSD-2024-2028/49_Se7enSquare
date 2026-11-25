// Central constants, storage keys, categories, and user helpers for Event Management.
// Use the same API base as the rest of the app (services/api.js):
// VITE_API_URL if set, otherwise "/api", which the Vite dev server proxies to
// the backend on port 3000. It was hardcoded to http://localhost:3000/api,
// which ignored the proxy/env and broke on any other host or port.
import { getStoredUser } from '../../../services/api';
export { API_BASE } from '../../../services/api';

export const STORAGE_KEYS = {
  DRAFT: 'nexus_event_draft',
  USER: 'nexus_user',
  CURRENT_USER: 'currentUser',
  TOKEN: 'token',
};

export const CATEGORIES = [
  'Tournament',
  'Casual Play',
  'Competitive',
  'Workshop',
  'Community Night',
];

export const EVENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

export const DEFAULT_COMMUNITIES = [];

export const getCurrentUser = getStoredUser;

export function getRole() {
  const user = getCurrentUser();
  return user?.role || 'user';
}
