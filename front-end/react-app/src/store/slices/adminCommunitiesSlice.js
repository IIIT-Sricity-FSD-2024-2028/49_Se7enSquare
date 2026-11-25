import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout } from './authSlice';
import { addAuditEntry } from './auditLogSlice';

/**
 * Admin communities slice — 1:1 repository mapping with backend Communities repository:
 * [CRUD Operations]:
 * - Create: createAdminCommunity (POST /api/communities)
 * - Read:   fetchCommunities      (GET  /api/communities)
 * - Update: suspendCommunity      (POST /api/admin/communities/:id/suspend)
 *           reinstateCommunity    (POST /api/admin/communities/:id/reinstate)
 * - Delete: deleteAdminCommunity  (DELETE /api/communities/:id)
 */

export const fetchCommunities = createAsyncThunk(
  'adminCommunities/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/communities');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to fetch communities' });
    }
  }
);

export const createAdminCommunity = createAsyncThunk(
  'adminCommunities/create',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const created = await apiRequest('/communities', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      dispatch(addAuditEntry({ action: 'Community Created', target: created.name || `community #${created.id}`, reason: 'Created by admin' }));
      return created;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to create community' });
    }
  }
);

const communityLabel = (communities, communityId) =>
  communities.find((c) => c.id === communityId)?.name || `community #${communityId}`;

export const suspendCommunity = createAsyncThunk(
  'adminCommunities/suspend',
  async ({ communityId, reason }, { getState, dispatch, rejectWithValue }) => {
    try {
      const target = communityLabel(getState().adminCommunities.communities, communityId);
      const res = await apiRequest(`/admin/communities/${communityId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      dispatch(addAuditEntry({ action: 'Community Suspended', target, reason }));
      return { communityId, reason, res };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to suspend community' });
    }
  }
);

export const reinstateCommunity = createAsyncThunk(
  'adminCommunities/reinstate',
  async (communityId, { getState, dispatch, rejectWithValue }) => {
    try {
      const target = communityLabel(getState().adminCommunities.communities, communityId);
      const reason = 'Reinstated by admin';
      const res = await apiRequest(`/admin/communities/${communityId}/reinstate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      dispatch(addAuditEntry({ action: 'Community Reinstated', target, reason }));
      return { communityId, reason, res };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to reinstate community' });
    }
  }
);

export const deleteAdminCommunity = createAsyncThunk(
  'adminCommunities/delete',
  async (communityId, { getState, dispatch, rejectWithValue }) => {
    try {
      const target = communityLabel(getState().adminCommunities.communities, communityId);
      await apiRequest(`/communities/${communityId}`, { method: 'DELETE' });
      dispatch(addAuditEntry({ action: 'Community Deleted', target, reason: 'Deleted by admin' }));
      return communityId;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to delete community' });
    }
  }
);

const initialState = {
  communities: [],
  loading: false,
  error: null,
};

const adminCommunitiesSlice = createSlice({
  name: 'adminCommunities',
  initialState,
  reducers: {
    resetAdminCommunities() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCommunities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCommunities.fulfilled, (state, action) => {
        state.loading = false;
        state.communities = action.payload;
        state.error = null;
      })
      .addCase(fetchCommunities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch communities';
      })
      .addCase(createAdminCommunity.fulfilled, (state, action) => {
        state.communities.unshift(action.payload);
      })
      .addCase(suspendCommunity.fulfilled, (state, action) => {
        const comm = state.communities.find((c) => c.id === action.payload.communityId);
        if (comm) {
          comm.status = 'suspended';
          comm.suspendedReason = action.payload.reason;
        }
      })
      .addCase(reinstateCommunity.fulfilled, (state, action) => {
        const comm = state.communities.find((c) => c.id === action.payload.communityId);
        if (comm) {
          comm.status = 'active';
          delete comm.suspendedReason;
        }
      })
      .addCase(deleteAdminCommunity.fulfilled, (state, action) => {
        state.communities = state.communities.filter((c) => c.id !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export const { resetAdminCommunities } = adminCommunitiesSlice.actions;

export const selectAdminCommunities = (state) => state.adminCommunities.communities;
export const selectAdminCommunitiesLoading = (state) => state.adminCommunities.loading;

export default adminCommunitiesSlice.reducer;
