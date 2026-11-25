import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import ErrorBoundary from './Components/ErrorBoundary.jsx';
import './styles/global.css';
import App from './App.jsx';
import { API_BASE, clearUserSession, handleRoleMismatch } from './services/api';

/**
 * TEMPORARY: Person A fetch shim
 * (Person B deletes this in B6 once no raw fetch calls remain across frontend).
 * Injects x-user-id and x-role on requests to API_BASE and catches ACCOUNT_BANNED /
 * ACCOUNT_SUSPENDED errors to ensure session cleanup and redirect to login.
 */
const originalFetch = window.fetch;
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
  const isApi =
    url.startsWith('/api') ||
    url.includes('/api/') ||
    (API_BASE && url.startsWith(API_BASE)) ||
    url.includes('localhost:3000');

  if (isApi) {
    const user = store.getState().auth.user;
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
    if (user?.id && !headers.has('x-user-id')) {
      headers.set('x-user-id', String(user.id));
    }
    if (user?.role && !headers.has('x-role')) {
      headers.set('x-role', user.role);
    }

    const modifiedInit = {
      ...init,
      headers,
    };

    const response = await originalFetch(input, modifiedInit);

    try {
      const clone = response.clone();
      const contentType = clone.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await clone.json();
        // Same stale-role check as apiRequest, for pages that call fetch directly
        if (response.status === 403) handleRoleMismatch(body);
        if (body && (body.code === 'ACCOUNT_BANNED' || body.code === 'ACCOUNT_SUSPENDED')) {
          const isAppeal = window.location.pathname.startsWith('/appeal');
          if (body.code === 'ACCOUNT_BANNED' || !isAppeal) {
            clearUserSession();
            const params = new URLSearchParams();
            params.set('accountStatus', body.code);
            if (body.reason) params.set('reason', body.reason);
            if (body.until) params.set('until', body.until);
            window.location.href = `/login?${params.toString()}`;
          }
        }
      }
    } catch { /* Ignore unreadable response bodies. */ }

    return response;
  }

  return originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
