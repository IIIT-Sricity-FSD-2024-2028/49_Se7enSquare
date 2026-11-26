/**
 * Se7enSquare - Central API Client Module
 * Provides unified request configuration, headers, identity injection, and account status handling.
 */

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

let readSession = () => null;
let endSession = () => {};

export function configureSession({ read, end }) {
  readSession = read;
  endSession = end;
}

export function getStoredUser() {
  return readSession();
}

export function clearUserSession() {
  endSession();
}

/**
 * Reduces a backend user object to the whitelisted session fields.
 */
export function toSessionUser(user) {
  if (!user) return null;

  const rawId = user.id ?? user.userId ?? user._id;
  const parsedId = rawId !== undefined && rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : rawId;

  return {
    id: parsedId,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatar: user.avatar || null,
    status: user.status || 'active',
    ...(typeof user.accessToken === 'string' ? { accessToken: user.accessToken } : {}),
  };
}

export function handleRoleMismatch(data) {
  const message = data && typeof data === 'object' ? String(data.message || '') : '';
  if (!message.includes('declared role does not match')) return false;
  clearUserSession();
  if (typeof window !== 'undefined') {
    window.location.href = '/login?roleChanged=1';
  }
  return true;
}

/**
 * Standardized HTTP request handler with automatic JSON serialization and role/identity headers.
 */
export async function apiRequest(endpoint, options = {}) {
  const user = getStoredUser();

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(user?.role ? { 'x-role': user.role } : {}),
    ...(user?.id !== undefined && user?.id !== null ? { 'x-user-id': String(user.id) } : {}),
    ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
    ...(options.headers || {}),
  };

  const timeoutSignal = AbortSignal.timeout(15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal,
      headers,
    });
  } catch (netErr) {
    if (timeoutSignal.aborted) throw new Error('The server took too long to respond. Please retry.', { cause: netErr });
    if (netErr instanceof TypeError && (netErr.message.includes('fetch') || netErr.message.includes('Network'))) {
      const connErr = new Error(
        'Unable to connect to Se7enSquare server. Please ensure the backend is running.'
      );
      connErr.status = 0;
      connErr.isNetworkError = true;
      throw connErr;
    }
    throw netErr;
  }

  const contentType = response.headers.get('content-type') || '';
  const data = (contentType && contentType.includes('application/json'))
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const rawMessage = (data && typeof data === 'object' && data.message)
      ? data.message
      : `Request failed with status ${response.status}`;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;

    const error = new Error(message);
    error.status = response.status;
    error.code = data?.code || null;
    error.reason = data?.reason || null;
    error.until = data?.until || null;
    error.data = data;

    // Only expire the session that issued this request; a later login must survive.
    if (response.status === 401 && user && getStoredUser() === user && !endpoint.startsWith('/auth/')) {
      clearUserSession();
    }

    // Stale role in the session (admin changed it) -> log out, go to /login
    if (response.status === 403) handleRoleMismatch(data);

    // Handle suspended and banned accounts
    if (data?.code === 'ACCOUNT_BANNED' || data?.code === 'ACCOUNT_SUSPENDED') {
      const isAppeal = typeof window !== 'undefined' && window.location.pathname.startsWith('/appeal');
      if (data.code === 'ACCOUNT_BANNED' || !isAppeal) {
        clearUserSession();
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams();
          params.set('accountStatus', data.code);
          if (data.reason) params.set('reason', data.reason);
          if (data.until) params.set('until', data.until);
          window.location.href = `/login?${params.toString()}`;
        }
      }
    }

    throw error;
  }

  if (response.status !== 204 && !contentType.includes('application/json')) {
    throw new Error('The server returned an unexpected response. Check the API address and retry.');
  }
  return data;
}
