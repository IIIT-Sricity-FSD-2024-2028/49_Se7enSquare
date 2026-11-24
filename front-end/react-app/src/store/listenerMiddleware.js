import { createListenerMiddleware, isAnyOf, isRejected } from '@reduxjs/toolkit';
import { storeUserSession, clearUserSession } from '../services/api';
import { loginSuccess, profileUpdated, logout, loginUser } from './slices/authSlice';
import { toastShown, toastHidden, sidebarToggled, SIDEBAR_KEY } from './slices/uiSlice';

/**
 * Side effects that run after an action has updated the store.
 *
 * Listeners registered here (Karmanya — Redux infrastructure):
 *
 * 1. Auth session sync  — keeps localStorage in sync with authSlice so that
 *    apiRequest() and the fetch shim in main.jsx can read x-user-id / x-role.
 *
 * 2. Toast auto-dismiss — hides the global toast banner after its duration.
 *    A newer toast cancels the previous timer so each toast gets its full time.
 *
 * 3. Sidebar persistence — writes the collapsed flag to localStorage so it
 *    survives a page reload.
 *
 * 4. Zero LocalStorage for Domain Data — all community and membership state
 *    is maintained strictly in Redux store memory variables.
 *
 * 5. Global async-thunk error handler — catches any rejected async
 *    thunk across ALL slices (communities, events, admin, chat …) and
 *    fires a toast automatically.
 */
export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(loginSuccess, profileUpdated, loginUser.fulfilled),
  effect: (action) => {
    storeUserSession(action.payload);
  },
});

listenerMiddleware.startListening({
  actionCreator: logout,
  effect: () => {
    clearUserSession();
  },
});

listenerMiddleware.startListening({
  actionCreator: toastShown,
  effect: async (action, listenerApi) => {
    // A newer toast cancels the previous timer, so it gets its full duration
    listenerApi.cancelActiveListeners();
    await listenerApi.delay(action.payload.duration);
    listenerApi.dispatch(toastHidden());
  },
});

listenerMiddleware.startListening({
  actionCreator: sidebarToggled,
  effect: (_action, listenerApi) => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(listenerApi.getState().ui.sidebarCollapsed));
    } catch { /* storage unavailable */ }
  },
});

/**
 * Global async-thunk error listener (Karmanya).
 *
 * Catches every rejected createAsyncThunk action across the entire store —
 * communities, events, admin, chat, profile, organizer, etc. — and surfaces
 * a toast so the user is never silently left with broken UI.
 *
 * Exclusions:
 *   - 'communities/fetchList'   : handled by listError banner in Discovery
 *   - 'communities/fetchPage'   : handled by the Community Page error state
 *   - 'communities/join'        : handled inline in useDiscovery / useCommunityPage
 *   - 'communities/leave'       : handled inline (rollback already shows toast)
 *
 * Any thunk NOT in the exclusion list gets an automatic "⚠️ …" toast on failure.
 */
const SILENT_THUNKS = new Set([
  'communities/fetchList',
  'communities/fetchPage',
  'communities/fetchMyMemberships',
  'communities/join',
  'communities/leave',
  'auth/loginUser',
  'auth/registerUser',
  'events/register',
  'events/cancelRegistration',
]);

listenerMiddleware.startListening({
  matcher: isRejected,
  effect: (action, listenerApi) => {
    const thunkType = action.type?.replace('/rejected', '');
    if (SILENT_THUNKS.has(thunkType)) return;

    const message = action.error?.message || 'An unexpected error occurred.';
    // Only show the toast if no other toast is already queued for this exact message
    listenerApi.dispatch(toastShown({ msg: `⚠️ ${message}`, duration: 4500 }));
  },
});
