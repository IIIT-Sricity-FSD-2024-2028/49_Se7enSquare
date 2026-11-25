import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE, apiRequest, toSessionUser } from '../../services/api';
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

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async () => toSessionUser(await apiRequest('/users/me')),
  {
    condition: (_, { getState }) => {
      const auth = getState().auth;
      return !auth.sessionChecked && !auth.sessionLoading;
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

const initialForm = {
  currentTab: 'login', cardShake: false,
  loginEmail: '', loginPassword: '', loginRole: '', rememberMe: false,
  showLoginPassword: false, loginFieldErrors: {},
  regFullName: '', regEmail: '', regHandle: '', regPassword: '', regConfirm: '',
  regRole: 'user', regTerms: false, showRegPassword: false, showRegConfirm: false,
  regFieldErrors: {}, forgotEmail: '', forgotError: '', forgotLoading: false,
  googleLoading: false,
};

const initialState = {
  user: null,
  sessionChecked: false,
  sessionLoading: false,
  form: initialForm,
  loginLoading: false,
  loginError: null,
  regLoading: false,
  regError: null,
};

// Login and profile updates both replace the session user with the whitelisted fields
const setSessionUser = {
  reducer(state, action) {
    state.user = action.payload;
    state.sessionChecked = true;
    state.sessionLoading = false;
    state.loginLoading = false;
    state.loginError = null;
  },
  prepare(user) {
    return { payload: toSessionUser(user) };
  },
};

export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { getState, dispatch }) => {
  const token = getState().auth.user?.accessToken;
  dispatch(logout());

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Always complete local logout, including when the backend is unreachable.
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authFormChanged(state, { payload }) {
      Object.assign(state.form, payload);
    },
    resetAuthForm(state) {
      state.form = initialForm;
    },
    loginSuccess: setSessionUser,
    profileUpdated(state, action) {
      const updated = toSessionUser(action.payload);
      state.user = {
        ...state.user,
        ...updated,
        accessToken: updated?.accessToken || state.user?.accessToken,
      };
      state.sessionChecked = true;
      state.sessionLoading = false;
    },
    logout(state) {
      state.user = null;
      state.sessionChecked = true;
      state.sessionLoading = false;
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
        state.sessionChecked = true;
        state.sessionLoading = false;
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
      })
      .addCase(restoreSession.pending, (state) => {
        state.sessionLoading = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.sessionLoading = false;
        state.sessionChecked = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.user = null;
        state.sessionLoading = false;
        state.sessionChecked = true;
      });
  },
});

export const {
  authFormChanged,
  resetAuthForm,
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
