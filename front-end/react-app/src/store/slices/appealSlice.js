import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { appealService } from '../../services/appealService';
import { logout } from './authSlice';

/**
 * Appeal slice (user side): the active ban/suspension being appealed and the
 * user's own appeals. The admin's appeal queue lives in adminModerationSlice.
 */

const hasUser = (_, { getState }) => Boolean(getState().auth.user?.id);

// Newest active ban/suspension from GET /sanctions/mine, or null.
// Backend SanctionRecord: status 'active' | 'reversed', expiresAt null = permanent.
export const fetchActiveSanction = createAsyncThunk(
  'appeal/fetchActiveSanction',
  async () => {
    const sanctions = await apiRequest('/sanctions/mine');
    if (!Array.isArray(sanctions)) return null;
    const now = Date.now();
    const active = [...sanctions].reverse().find(
      (s) => s.status === 'active' &&
        (s.type === 'ban' || s.type === 'suspend') &&
        (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
    );
    return active
      ? {
          type: active.type === 'ban' ? 'Account Ban' : 'Account Suspension',
          reason: active.reason || 'Violation of community guidelines',
          until: active.expiresAt || null,
          id: `SAN-${active.id}`,
        }
      : null;
  },
  { condition: hasUser }
);

export const fetchMyAppeals = createAsyncThunk(
  'appeal/fetchMine',
  async (_, { getState }) => {
    const userId = getState().auth.user.id;
    const data = await appealService.getAppeals(userId);
    return Array.isArray(data) ? data.filter((a) => String(a.userId) === String(userId)) : [];
  },
  { condition: hasUser }
);

export const submitAppeal = createAsyncThunk(
  'appeal/submit',
  (payload) => appealService.createAppeal(payload),
  { condition: (_, { getState }) => !getState().appeal.submitting },
);

export const updateAppealStatus = createAsyncThunk(
  'appeal/updateStatus',
  ({ id, status }) => apiRequest(`/appeals/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  }),
);

export const addAppealEvidence = createAsyncThunk(
  'appeal/addEvidence',
  ({ id, ...evidence }) => apiRequest(`/appeals/${id}/evidence`, {
    method: 'POST', body: JSON.stringify(evidence),
  }),
);

export const withdrawAppeal = createAsyncThunk(
  'appeal/withdraw',
  (id) => apiRequest(`/appeals/${id}`, { method: 'DELETE' }),
);

const initialForm = { appealType: '', statement: '', commitment: '', errors: {}, submitted: false, refId: '' };

const initialState = {
  form: initialForm,
  sanction: null,
  myAppeals: [],
  loadingAppeals: false,
  submitting: false,
  submissionRequestId: null,
};

const appealSlice = createSlice({
  name: 'appeal',
  initialState,
  reducers: {
    appealFormChanged(state, { payload }) {
      Object.assign(state.form, payload);
    },
    resetAppealForm(state) {
      state.form = initialForm;
      state.submissionRequestId = null;
      state.submitting = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveSanction.fulfilled, (state, action) => {
        state.sanction = action.payload;
      })
      .addCase(fetchMyAppeals.pending, (state) => {
        state.loadingAppeals = true;
      })
      .addCase(fetchMyAppeals.fulfilled, (state, action) => {
        state.loadingAppeals = false;
        state.myAppeals = action.payload;
      })
      .addCase(fetchMyAppeals.rejected, (state) => {
        state.loadingAppeals = false;
      })
      .addCase(submitAppeal.pending, (state, action) => {
        state.submitting = true;
        state.submissionRequestId = action.meta.requestId;
      })
      .addCase(submitAppeal.fulfilled, (state, action) => {
        if (state.submissionRequestId !== action.meta.requestId) return;
        state.submitting = false;
        state.submissionRequestId = null;
        state.myAppeals.unshift(action.payload);
        state.form.refId = `APL-${action.payload.id}`;
        state.form.submitted = true;
      })
      .addCase(submitAppeal.rejected, (state, action) => {
        if (state.submissionRequestId !== action.meta.requestId) return;
        state.submitting = false;
        state.submissionRequestId = null;
        state.form.errors = { submit: `Appeal not sent: ${action.error.message}` };
      })
      .addCase(withdrawAppeal.fulfilled, (state, action) => {
        state.myAppeals = state.myAppeals.filter(({ id }) => id !== action.payload.id);
      })
      .addCase(logout, () => initialState)
      .addMatcher(
        (action) => updateAppealStatus.fulfilled.match(action) || addAppealEvidence.fulfilled.match(action),
        (state, action) => {
          const index = state.myAppeals.findIndex(({ id }) => id === action.payload.id);
          if (index !== -1) state.myAppeals[index] = action.payload;
        },
      );
  },
});

export const { appealFormChanged, resetAppealForm } = appealSlice.actions;

export const selectAppealState = (state) => state.appeal;

export default appealSlice.reducer;
