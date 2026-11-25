import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout } from './authSlice';

/**
 * Report slice: the 4-step report wizard.
 * The wizard clears its draft when the report page unmounts.
 */

// GET /users?search= -> first 6 matches
export const searchUsers = createAsyncThunk('report/searchUsers', async (query) => {
  const data = await apiRequest(`/users?search=${encodeURIComponent(query)}`);
  return Array.isArray(data) ? data.slice(0, 6) : [];
});

// POST /reports. Reads the wizard fields and the reporter from the store with getState().
export const submitReport = createAsyncThunk('report/submitReport', async (_, { getState }) => {
  const { report, auth } = getState();
  const { selectedReason, additionalContext, selectedTarget } = report;

  // Backend CreateReportDto: reason 8-200 chars, ids are positive integers, targetType in ['post', 'user', 'community']
  const reasonText = (selectedReason + (additionalContext ? `: ${additionalContext}` : '')).slice(0, 195);
  const targetType = selectedTarget?.type === 'community'
    ? 'community'
    : (selectedTarget?.type === 'post' || selectedTarget?.type === 'message')
      ? 'post'
      : 'user';
  const reportData = {
    reporterId: Number(auth.user?.id),
    targetType,
    targetId: Number(selectedTarget?.id),
    reason: reasonText.length >= 8 ? reasonText : `${reasonText} - reported by user`,
  };

  const data = await apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
  return data;
});

export const fetchMyReports = createAsyncThunk('report/fetchMine', () => apiRequest('/reports/mine'));

export const updateReportStatus = createAsyncThunk(
  'report/updateStatus',
  ({ id, ...update }) => apiRequest(`/reports/${id}/status`, {
    method: 'PATCH', body: JSON.stringify(update),
  }),
);

export const deleteReport = createAsyncThunk('report/delete', async (id) => {
  await apiRequest(`/reports/${id}`, { method: 'DELETE' });
  return id;
});

const initialState = {
  myReports: [],
  submissionRequestId: null,
  step: 1,
  selectedTarget: null,
  selectedReason: '',
  additionalContext: '',
  confirmed: false,
  submitting: false,
  submitted: false,
  refId: '',
  userSearch: '',
  searchResults: [],
};

const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    // A link like /report?user=7 starts a fresh report for that target
    reportStarted(state, action) {
      return { ...initialState, myReports: state.myReports, selectedTarget: action.payload };
    },
    resetReportForm(state) {
      return { ...initialState, myReports: state.myReports };
    },
    stepChanged(state, action) {
      state.step = action.payload;
    },
    targetSelected(state, action) {
      state.selectedTarget = action.payload;
    },
    reasonSelected(state, action) {
      state.selectedReason = action.payload;
    },
    contextChanged(state, action) {
      state.additionalContext = action.payload;
    },
    confirmedChanged(state, action) {
      state.confirmed = action.payload;
    },
    userSearchChanged(state, action) {
      state.userSearch = action.payload;
      if (!action.payload.trim()) state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchUsers.fulfilled, (state, action) => {
        // Ignore an older, slower response: only results for the current text count
        if (action.meta.arg === state.userSearch) {
          state.searchResults = action.payload;
        }
      })
      .addCase(searchUsers.rejected, (state, action) => {
        if (action.meta.arg === state.userSearch) {
          state.searchResults = [];
        }
      })
      .addCase(submitReport.pending, (state, action) => {
        state.submissionRequestId = action.meta.requestId;
        state.submitting = true;
      })
      .addCase(submitReport.fulfilled, (state, action) => {
        state.myReports.unshift(action.payload);
        if (state.submissionRequestId !== action.meta.requestId) return;
        state.submissionRequestId = null;
        // The success step only appears once the backend has saved the report
        state.submitting = false;
        state.refId = `RPT-${action.payload.id}`;
        state.step = 4;
        state.submitted = true;
      })
      .addCase(submitReport.rejected, (state, action) => {
        if (state.submissionRequestId !== action.meta.requestId) return;
        state.submissionRequestId = null;
        state.submitting = false;
      })
      .addCase(fetchMyReports.fulfilled, (state, action) => {
        state.myReports = action.payload;
      })
      .addCase(updateReportStatus.fulfilled, (state, action) => {
        const index = state.myReports.findIndex(({ id }) => id === action.payload.id);
        if (index !== -1) state.myReports[index] = action.payload;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.myReports = state.myReports.filter(({ id }) => id !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export const {
  reportStarted,
  resetReportForm,
  stepChanged,
  targetSelected,
  reasonSelected,
  contextChanged,
  confirmedChanged,
  userSearchChanged,
} = reportSlice.actions;

export const reportReset = resetReportForm;

export const selectReport = (state) => state.report;

export default reportSlice.reducer;
