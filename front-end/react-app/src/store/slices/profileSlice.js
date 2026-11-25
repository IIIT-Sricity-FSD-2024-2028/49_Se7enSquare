import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout, profileUpdated } from './authSlice';
import { DEFAULT_PRIVACY, EMPTY_PASSWORDS, EMPTY_ORGANISER, EMPTY_STATEMENT } from '../../Components/platform/data/profileSettingsData';
import { fetchSubscriptionStatus } from './pricingSlice';

/**
 * Profile slice: the full profile of the logged-in user (GET /users/me) and the
 * status of their organizer / moderator applications.
 * Shared by Profile Settings and Appeal (account status and reason).
 * The plan comes from the pricing slice, so a plan changed on Pricing shows here at once.
 *
 * Thunks reject with a list of messages (rejectWithValue): a thrown error is
 * reduced to { name, message, code }, which would lose the backend's
 * per-field validation messages in err.data.message.
 */

const errorMessages = (err) => (Array.isArray(err.data?.message) ? err.data.message : [err.message]);
const hasUser = (_, { getState }) => Boolean(getState().auth.user?.id);

const ORGANISER_ROLES = ['user', 'organizer'];
const MODERATOR_ROLES = ['user', 'organizer', 'community_manager', 'moderator'];

// Appeal only needs the profile itself
export const fetchMyProfile = createAsyncThunk(
  'profile/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/users/me');
    } catch (err) {
      return rejectWithValue(errorMessages(err));
    }
  },
  { condition: hasUser }
);

// Profile Settings: the profile, then plan + application statuses in parallel.
// A failed status request does not fail the page: its message goes to `errors`.
export const fetchProfileSettings = createAsyncThunk(
  'profile/fetchSettings',
  async (_, { dispatch, rejectWithValue }) => {
    let profile;
    try {
      profile = await apiRequest('/users/me');
    } catch (err) {
      return rejectWithValue(errorMessages(err));
    }

    const errors = {};
    const load = (key, endpoint) => apiRequest(endpoint).catch((err) => {
      errors[key] = err.message;
      return null;
    });
    const [, organiser, moderator] = await Promise.all([
      profile.role !== 'owner'
        ? dispatch(fetchSubscriptionStatus(profile.id)).unwrap().catch((err) => { errors.plan = err.message; })
        : null,
      ORGANISER_ROLES.includes(profile.role) ? load('organiser', '/organisers/profile') : null,
      MODERATOR_ROLES.includes(profile.role) ? load('moderator', '/moderator-certification/status') : null,
    ]);
    return { profile, organiser, moderator, errors, fetchedAt: Date.now() };
  },
  {
    condition: (force, context) => {
      const { lastFetched, settingsRequestId } = context.getState().profile;
      return hasUser(force, context) && !settingsRequestId &&
        (force || Date.now() - lastFetched >= 60_000);
    },
  }
);

// changes: only the fields that differ from the saved profile (plus privacy).
// A new avatar file is uploaded first and its URL saved on the profile.
export const saveProfile = createAsyncThunk(
  'profile/save',
  async ({ changes, avatarFile }, { dispatch, rejectWithValue }) => {
    try {
      const body = { ...changes };
      if (avatarFile) {
        const upload = new FormData();
        upload.append('file', avatarFile);
        const result = await apiRequest('/uploads', { method: 'POST', body: upload });
        body.avatar = result.fileUrl;
      }
      const saved = await apiRequest('/users/me', { method: 'PATCH', body: JSON.stringify(body) });
      // Header, sidebar etc. read the session user from the auth slice
      dispatch(profileUpdated(saved));
      return saved;
    } catch (err) {
      return rejectWithValue(errorMessages(err));
    }
  }
);

export const changePassword = createAsyncThunk(
  'profile/changePassword',
  async (passwords, { dispatch, rejectWithValue }) => {
    try {
      const updated = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(passwords),
      });
      dispatch(profileUpdated(updated));
    } catch (err) {
      return rejectWithValue(errorMessages(err));
    }
  }
);

export const applyOrganizer = createAsyncThunk('profile/applyOrganizer', async (submission, { rejectWithValue }) => {
  try {
    return await apiRequest('/organisers/apply', { method: 'POST', body: JSON.stringify(submission) });
  } catch (err) {
    return rejectWithValue(errorMessages(err));
  }
});

export const fetchModeratorQuiz = createAsyncThunk('profile/fetchQuiz', async () =>
  apiRequest('/moderator-certification/quiz')
);

export const applyModerator = createAsyncThunk(
  'profile/applyModerator',
  async ({ answers, statement }, { rejectWithValue }) => {
    try {
      return await apiRequest('/moderator-certification/apply', {
        method: 'POST',
        body: JSON.stringify({ answers, statement }),
      });
    } catch (err) {
      return rejectWithValue(errorMessages(err));
    }
  }
);

export const deleteAccount = createAsyncThunk('profile/deleteAccount', async (password, { dispatch }) => {
  await apiRequest('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) });
  dispatch(logout());
});

const initialForm = {
  formData: null, privacy: null, passwords: EMPTY_PASSWORDS, showPassword: {},
  avatarPreview: '', activeTab: 'profile', errors: [], toastMsg: '',
  applicationErrors: null, organiserForm: EMPTY_ORGANISER, statement: EMPTY_STATEMENT,
  questions: [], quizAnswers: [], quizOpen: false, showCustomOrganiser: false,
  deletePassword: '',
};

export const profileFieldsOf = (user = {}) => Object.fromEntries(
  ['firstName', 'lastName', 'username', 'email', 'phone', 'bio', 'avatar']
    .map((key) => [key, user[key] ?? '']),
);

export const getProfileFieldDefault = (profile, field) => {
  if (field === 'formData') return profileFieldsOf(profile.me || {});
  if (field === 'privacy') return { ...DEFAULT_PRIVACY, ...profile.me?.privacy };
  if (field === 'applicationErrors') return profile.settingsErrors;
  return initialForm[field];
};

const initialState = {
  settingsErrors: {},
  loadErrors: [],
  lastFetched: 0,
  settingsRequestId: null,
  settingsForm: initialForm,
  me: null,
  loading: true,
  organiser: null,
  moderator: null,
  saving: false,
  applying: false,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    profileFormChanged(state, { payload }) {
      Object.assign(state.settingsForm, payload);
    },
    resetProfileForm(state) {
      state.settingsForm = initialForm;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyProfile.fulfilled, (state, action) => {
        state.me = action.payload;
      })
      .addCase(fetchProfileSettings.pending, (state, action) => {
        state.settingsRequestId = action.meta.requestId;
        state.loading = true;
      })
      .addCase(fetchProfileSettings.fulfilled, (state, action) => {
        if (state.settingsRequestId !== action.meta.requestId) return;
        state.settingsRequestId = null;
        state.lastFetched = action.payload.fetchedAt;
        state.loading = false;
        state.me = action.payload.profile;
        state.organiser = action.payload.organiser;
        state.moderator = action.payload.moderator;
        state.settingsErrors = action.payload.errors;
        state.loadErrors = [];
      })
      .addCase(fetchProfileSettings.rejected, (state, action) => {
        if (state.settingsRequestId !== action.meta.requestId) return;
        state.settingsRequestId = null;
        state.loading = false;
        state.loadErrors = action.payload || [action.error.message];
      })

      .addCase(saveProfile.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.me = action.payload;
      })
      .addCase(saveProfile.rejected, (state) => {
        state.saving = false;
      })
      .addCase(changePassword.pending, (state) => {
        state.saving = true;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.saving = false;
        if (state.me) state.me.hasPassword = true;
      })
      .addCase(changePassword.rejected, (state) => {
        state.saving = false;
      })

      .addCase(applyOrganizer.pending, (state) => {
        state.applying = true;
      })
      .addCase(applyOrganizer.fulfilled, (state, action) => {
        state.applying = false;
        state.organiser = action.payload;
      })
      .addCase(applyOrganizer.rejected, (state) => {
        state.applying = false;
      })
      .addCase(applyModerator.pending, (state) => {
        state.applying = true;
      })
      .addCase(applyModerator.fulfilled, (state, action) => {
        state.applying = false;
        state.moderator = action.payload;
      })
      .addCase(applyModerator.rejected, (state) => {
        state.applying = false;
      })

      .addCase(logout, () => initialState);
  },
});

export const { profileFormChanged, resetProfileForm } = profileSlice.actions;

export const selectProfile = (state) => state.profile.me;
export const selectProfileState = (state) => state.profile;

export default profileSlice.reducer;
