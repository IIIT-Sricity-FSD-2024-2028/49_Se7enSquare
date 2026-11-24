import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getStoredUser, toSessionUser } from '../../services/api';
import { authService } from '../../services/authService';

/**
 * Async thunk for user login.
 * Calls the authentication service and rejects with a structured error payload on failure.
 */
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ login, password, role }, { rejectWithValue }) => {
    try {
      const user = await authService.login({ login, password, role });
      return toSessionUser(user);
    } catch (err) {
      const failMsg = err.reason || err.message || 'Cannot reach authentication server';
      const isSanctioned =
        err.code === 'ACCOUNT_BANNED' ||
        err.code === 'ACCOUNT_SUSPENDED' ||
        err.status === 403;
      return rejectWithValue({
        general: failMsg,
        isSanctioned: Boolean(isSanctioned),
        code: err.code || null,
        reason: err.reason || null,
        status: err.status || null,
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const { loginLoading } = getState().auth;
      if (loginLoading) return false;
    },
  }
);

/**
 * Async thunk for user registration.
 */
export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (payload, { rejectWithValue }) => {
    try {
      const createdUser = await authService.register(payload);
      return createdUser;
    } catch (err) {
      const failMsg = err.message || 'Unable to connect to registration server';
      return rejectWithValue({
        general: failMsg,
        status: err.status || null,
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const { regLoading } = getState().auth;
      if (regLoading) return false;
    },
  }
);

/**
 * Auth slice: the logged-in user, shared by every page, plus centralized loading/error states.
 * Starts from localStorage so a page refresh keeps the session.
 * Writing back to localStorage is done by the listener middleware, not here,
 * because reducers must stay pure (no side effects).
 */
const initialState = {
  user: getStoredUser(),
  loginLoading: false,
  loginError: null,
  regLoading: false,
  regError: null,
};

// Login and profile updates both replace the session user with the whitelisted fields
const setSessionUser = {
  reducer(state, action) {
    state.user = action.payload;
    state.loginLoading = false;
    state.loginError = null;
  },
  prepare(user) {
    return { payload: toSessionUser(user) };
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: setSessionUser,
    profileUpdated: setSessionUser,
    logout(state) {
      state.user = null;
      state.loginLoading = false;
      state.loginError = null;
      state.regLoading = false;
      state.regError = null;
    },
    clearAuthErrors(state) {
      state.loginError = null;
      state.regError = null;
    },
    setAuthLoginError(state, action) {
      state.loginError = typeof action.payload === 'string'
        ? { general: action.payload }
        : action.payload;
    },
    setAuthRegError(state, action) {
      state.regError = typeof action.payload === 'string'
        ? { general: action.payload }
        : action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // loginUser
      .addCase(loginUser.pending, (state) => {
        state.loginLoading = true;
        state.loginError = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loginLoading = false;
        state.loginError = null;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loginLoading = false;
        state.loginError = action.payload || { general: action.error?.message || 'Login failed' };
      })
      // registerUser
      .addCase(registerUser.pending, (state) => {
        state.regLoading = true;
        state.regError = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.regLoading = false;
        state.regError = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.regLoading = false;
        state.regError = action.payload || { general: action.error?.message || 'Registration failed' };
      });
  },
});

export const {
  loginSuccess,
  profileUpdated,
  logout,
  clearAuthErrors,
  setAuthLoginError,
  setAuthRegError,
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectUserRole = (state) => (state.auth.user?.role || 'user').toLowerCase();
export const selectIsAuthenticated = (state) => {
  const user = state.auth.user;
  return Boolean(user && user.username && user.id !== undefined && user.id !== null);
};
export const selectLoginLoading = (state) => state.auth.loginLoading;
export const selectLoginError = (state) => state.auth.loginError;
export const selectRegLoading = (state) => state.auth.regLoading;
export const selectRegError = (state) => state.auth.regError;
export const selectAuthLoading = (state) => state.auth.loginLoading || state.auth.regLoading;

export default authSlice.reducer;
