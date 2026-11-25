import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { appealService } from '../../services/appealService';
import { logout } from './authSlice';
import { addAuditEntry } from './auditLogSlice';
import { fetchUsers } from './adminUsersSlice';

/**
 * Admin moderation slice: escalated reports, events, appeals, organizer/moderator
 * applications, moderation notes, and the platform message count.
 * All mutations call the backend first, updating state strictly in .fulfilled.
 */

const asArray = (data) => (Array.isArray(data) ? data : []);

export const fetchReports = createAsyncThunk('adminModeration/fetchReports', async () =>
  asArray(await apiRequest('/reports'))
);

export const fetchEvents = createAsyncThunk('adminModeration/fetchEvents', async () =>
  asArray(await apiRequest('/events'))
);

export const fetchAppeals = createAsyncThunk('adminModeration/fetchAppeals', async () =>
  asArray(await apiRequest('/appeals'))
);

export const fetchDashboardStats = createAsyncThunk('adminModeration/fetchStats', async () => {
  const s = await apiRequest('/dashboard/stats');
  return s?.totalMessages ?? 0;
});

// Both application queues plus /users to show usernames instead of ids, fetched in parallel
export const fetchApplications = createAsyncThunk('adminModeration/fetchApplications', async () => {
  const [orgRes, modRes, usersRes] = await Promise.all([
    apiRequest('/organisers'),
    apiRequest('/moderator-certification'),
    apiRequest('/users'),
  ]);
  const userMap = new Map(asArray(usersRes).map((u) => [u.id, u]));
  const nameOf = (userId) => userMap.get(userId)?.username || `User #${userId}`;
  const dateOf = (d) => {
    if (!d) return 'Recently';
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? 'Recently' : parsed.toLocaleDateString();
  };

  return {
    organizerApps: asArray(orgRes).map((o) => ({
      id: o.id,
      user: nameOf(o.userId),
      experience: o.experienceNote || 'Experience note on file',
      applied: dateOf(o.appliedAt),
      status: o.status || 'pending',
    })),
    moderatorApps: asArray(modRes).map((m) => ({
      id: m.id,
      user: nameOf(m.userId),
      quizScore: `${m.quizScore ?? 0}%`,
      applied: dateOf(m.appliedAt),
      status: m.status || 'pending',
    })),
  };
});

// Delete an escalated report from the database (DELETE /api/reports/:id)
export const deleteEscalatedReport = createAsyncThunk(
  'adminModeration/deleteReport',
  async (reportId, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(`/reports/${reportId}`, { method: 'DELETE' });
      dispatch(addAuditEntry({ action: 'Report Deleted', target: `report #${reportId}`, reason: 'Deleted by moderator' }));
      return reportId;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to delete report' });
    }
  }
);

// Dismiss / reject an appeal (POST /api/appeals/:id/rejected)
export const dismissAppeal = createAsyncThunk(
  'adminModeration/dismissAppeal',
  async ({ appealId, notes }, { dispatch, rejectWithValue }) => {
    try {
      const res = await appealService.reviewAppeal(appealId, 'rejected', notes || 'Dismissed by moderator');
      dispatch(addAuditEntry({ action: 'Appeal Dismissed', target: `appeal #${appealId}`, reason: notes || 'Dismissed' }));
      return { appealId, res };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to dismiss appeal' });
    }
  }
);

// Resolve escalated report
export const resolveEscalatedReport = createAsyncThunk(
  'adminModeration/resolveEscalatedReport',
  async ({ report, actionType, note }, { dispatch, rejectWithValue }) => {
    try {
      const reportId = report.id;
      const newStatus = actionType === 'dismiss' ? 'dismissed' : 'resolved';
      await apiRequest(`/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, resolutionNote: note }),
      });
      dispatch(addAuditEntry({ action: `Report ${newStatus}`, target: `report #${reportId}`, reason: note || actionType }));
      await dispatch(fetchReports());
      return { reportId, status: newStatus };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to resolve report' });
    }
  }
);

export const reviewAppeal = createAsyncThunk(
  'adminModeration/reviewAppeal',
  async ({ appealId, status, notes }, { dispatch, rejectWithValue }) => {
    try {
      const res = await appealService.reviewAppeal(appealId, status, notes);
      dispatch(addAuditEntry({
        action: `Appeal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        target: `appeal #${appealId}`,
        reason: notes || `Appeal ${status}`,
      }));
      await dispatch(fetchAppeals());
      return { appealId, status, res };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to review appeal' });
    }
  }
);

export const reviewOrganizerApp = createAsyncThunk(
  'adminModeration/reviewOrganizerApp',
  async ({ id, status, rejectionReason }, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(`/organisers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason }),
      });
      dispatch(addAuditEntry({
        action: `Organizer Application ${status}`,
        target: `organizer #${id}`,
        reason: rejectionReason || `Status set to ${status}`,
      }));
      await Promise.all([dispatch(fetchApplications()), dispatch(fetchUsers())]);
      return { id, status };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to review organizer application' });
    }
  }
);

export const reviewModeratorApp = createAsyncThunk(
  'adminModeration/reviewModeratorApp',
  async ({ id, status, rejectionReason }, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(`/moderator-certification/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason }),
      });
      dispatch(addAuditEntry({
        action: `Moderator Application ${status}`,
        target: `moderator application #${id}`,
        reason: rejectionReason || `Status set to ${status}`,
      }));
      await Promise.all([dispatch(fetchApplications()), dispatch(fetchUsers())]);
      return { id, status };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to review moderator application' });
    }
  }
);

export const resolveReport = (actionName, newStatus) =>
  createAsyncThunk(
    `adminModeration/${actionName}`,
    async ({ reportId, reason, target }, { dispatch }) => {
      await apiRequest(`/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      dispatch(addAuditEntry({ action: `Report ${newStatus}`, target: target || `report #${reportId}`, reason }));
      await dispatch(fetchReports());
    }
  );

export const dismissReport = resolveReport('dismissReport', 'dismissed');
export const resolveReportAction = resolveReport('resolveReport', 'resolved');

export const escalateReport = createAsyncThunk(
  'adminModeration/escalateReport',
  async ({ reportId, reason, target }, { dispatch }) => {
    await apiRequest(`/reports/${reportId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'escalated' }),
    });
    dispatch(addAuditEntry({ action: 'Report Escalated', target: target || `report #${reportId}`, reason }));
    await dispatch(fetchReports());
  }
);

const eventLabel = (events, eventId) =>
  events.find((e) => e.id === eventId)?.title || `event #${eventId}`;

export const suspendEvent = createAsyncThunk(
  'adminModeration/suspendEvent',
  async ({ eventId, reason }, { getState, dispatch }) => {
    const target = eventLabel(getState().adminModeration.events, eventId);
    await apiRequest(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended', suspendedReason: reason }),
    });
    dispatch(addAuditEntry({ action: 'Event Suspended', target, reason }));
    await dispatch(fetchEvents());
  }
);

export const reinstateEvent = createAsyncThunk(
  'adminModeration/reinstateEvent',
  async (eventId, { getState, dispatch }) => {
    const target = eventLabel(getState().adminModeration.events, eventId);
    const reason = 'Reinstated by admin';
    await apiRequest(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved', suspendedReason: null }),
    });
    dispatch(addAuditEntry({ action: 'Event Reinstated', target, reason }));
    await dispatch(fetchEvents());
  }
);

export const resolveAppeal = createAsyncThunk(
  'adminModeration/resolveAppeal',
  async ({ appealId, status, notes }, { dispatch }) => {
    await appealService.reviewAppeal(appealId, status, notes);
    dispatch(
      addAuditEntry({
        action: `Appeal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        target: `appeal #${appealId}`,
        reason: notes || `Appeal ${status}`,
      })
    );
    await dispatch(fetchAppeals());
  }
);

export const reviewApplication = createAsyncThunk(
  'adminModeration/reviewApplication',
  async ({ type, appId, action }, { dispatch }) => {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const isOrg = type === 'organizer';
    await apiRequest(isOrg ? `/organisers/${appId}` : `/moderator-certification/${appId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    dispatch(
      addAuditEntry({
        action: `${isOrg ? 'Organizer' : 'Moderator'} Application ${newStatus}`,
        target: `application #${appId}`,
        reason: `Admin ${action}d`,
      })
    );
    await Promise.all([dispatch(fetchApplications()), dispatch(fetchUsers())]);
  }
);

const initialState = {
  reports: [],
  events: [],
  appeals: [],
  applications: { organizerApps: [], moderatorApps: [] },
  messageCount: 0,
  loading: false,
  error: null,
  modNotes: {},
};

const adminModerationSlice = createSlice({
  name: 'adminModeration',
  initialState,
  reducers: {
    modNoteChanged(state, action) {
      const { reportId, note } = action.payload;
      state.modNotes[reportId] = note;
    },
    resetAdminModeration() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports = action.payload;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.events = action.payload;
      })
      .addCase(fetchAppeals.fulfilled, (state, action) => {
        state.appeals = action.payload;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.messageCount = action.payload;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications = action.payload;
      })
      .addCase(deleteEscalatedReport.fulfilled, (state, action) => {
        state.reports = state.reports.filter((r) => r.id !== action.payload);
      })
      .addCase(dismissAppeal.fulfilled, (state, action) => {
        state.appeals = state.appeals.filter((a) => a.id !== action.payload.appealId);
      })
      .addCase(logout, () => initialState);
  },
});

export const { modNoteChanged, resetAdminModeration } = adminModerationSlice.actions;

export const selectAdminReports = (state) => state.adminModeration.reports;
export const selectReports = (state) => state.adminModeration.reports;
export const selectAdminEvents = (state) => state.adminModeration.events;
export const selectEvents = (state) => state.adminModeration.events;
export const selectAdminAppeals = (state) => state.adminModeration.appeals;
export const selectAppeals = (state) => state.adminModeration.appeals;
export const selectAdminApplications = (state) => state.adminModeration.applications;
export const selectOrganizerApps = (state) => state.adminModeration.applications?.organizerApps || [];
export const selectModeratorApps = (state) => state.adminModeration.applications?.moderatorApps || [];
export const selectAdminMessageCount = (state) => state.adminModeration.messageCount;
export const selectTotalMessages = (state) => state.adminModeration.messageCount;
export const selectModNotes = (state) => state.adminModeration.modNotes;

export default adminModerationSlice.reducer;
