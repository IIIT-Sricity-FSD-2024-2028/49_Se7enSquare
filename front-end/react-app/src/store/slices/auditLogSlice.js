import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout } from './authSlice';

/**
 * Audit log slice: administrative actions stored by the backend (GET/POST /api/audit-log).
 * CRUD Operations:
 * - Read:   fetchAuditLog  (GET  /api/audit-log)
 * - Create: addAuditEntry  (POST /api/audit-log)
 * - Update: updateAuditEntry (Backend Gap: AuditController does not expose PUT/PATCH /audit-log/:id)
 * - Delete: deleteAuditEntry (Backend Gap: AuditController does not expose DELETE /audit-log/:id)
 */

export const fetchAuditLog = createAsyncThunk(
  'auditLog/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/audit-log');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to fetch audit logs' });
    }
  }
);

// Called by admin thunks after an action succeeds. Actor is the logged-in admin.
export const addAuditEntry = createAsyncThunk(
  'auditLog/add',
  async ({ action, target, reason }, { getState, dispatch, rejectWithValue }) => {
    try {
      const actor = getState().auth.user?.username || 'admin';
      const created = await apiRequest('/audit-log', {
        method: 'POST',
        body: JSON.stringify({
          action: String(action).slice(0, 100),
          actor: String(actor).slice(0, 60),
          ...(target ? { target: String(target).slice(0, 100) } : {}),
          ...(reason ? { reason: String(reason).slice(0, 200) } : {}),
        }),
      });
      await dispatch(fetchAuditLog());
      return created;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to add audit entry' });
    }
  }
);

// [CRUD: UPDATE] - Handled with explicit DB-first rejection documenting the backend gap
export const updateAuditEntry = createAsyncThunk(
  'auditLog/update',
  async ({ id, patch }, { rejectWithValue }) => {
    try {
      const res = await apiRequest(`/audit-log/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return res;
    } catch (err) {
      return rejectWithValue({
        message: err?.message || 'Backend endpoint gap: PATCH /audit-log/:id is not supported by backend AuditController.',
      });
    }
  }
);

// [CRUD: DELETE] - Handled with explicit DB-first rejection documenting the backend gap
export const deleteAuditEntry = createAsyncThunk(
  'auditLog/delete',
  async (id, { rejectWithValue }) => {
    try {
      await apiRequest(`/audit-log/${id}`, { method: 'DELETE' });
      return id;
    } catch (err) {
      return rejectWithValue({
        message: err?.message || 'Backend endpoint gap: DELETE /audit-log/:id is not supported by backend AuditController.',
      });
    }
  }
);

const initialState = {
  records: [],
  loading: false,
  error: null,
};

const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState,
  reducers: {
    resetAuditLogState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLog.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuditLog.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload;
        state.error = null;
      })
      .addCase(fetchAuditLog.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch audit log';
      })
      .addCase(logout, () => initialState);
  },
});

export const { resetAuditLogState } = auditLogSlice.actions;

const selectAuditRecords = (state) => state.auditLog.records;

// Newest first, with display-ready fields. createSelector re-computes only when records change.
export const selectAuditEntries = createSelector([selectAuditRecords], (records) =>
  [...records]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((l) => {
      let formattedTime = '—';
      if (l.createdAt) {
        const d = new Date(l.createdAt);
        if (!isNaN(d.getTime())) {
          formattedTime = d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        }
      }
      return {
        id: l.id,
        time: formattedTime,
        admin: l.actor || 'system',
        action: l.action,
        target: l.target || 'general',
        reason: l.reason || '',
      };
    })
);

export default auditLogSlice.reducer;
