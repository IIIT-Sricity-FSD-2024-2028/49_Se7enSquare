import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout } from './authSlice';
import { addAuditEntry } from './auditLogSlice';

/**
 * Admin users slice: the user directory plus the Users tab's search, role filter
 * and the row whose role is being edited.
 * Every action calls the API first, then re-fetches the list (no optimistic updates).
 */

export const fetchUsers = createAsyncThunk('adminUsers/fetch', async () => {
  const data = await apiRequest('/users');
  return Array.isArray(data) ? data : [];
});

const userLabel = (users, userId) => {
  const u = users.find((x) => x.id === userId);
  return u?.username ? `@${u.username}` : `user #${userId}`;
};

export const updateUserRole = createAsyncThunk(
  'adminUsers/updateRole',
  async ({ userId, role }, { getState, dispatch }) => {
    const target = userLabel(getState().adminUsers.users, userId);
    await apiRequest(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    dispatch(addAuditEntry({ action: 'User Role Changed', target, reason: `Role set to ${role}` }));
    await dispatch(fetchUsers());
  }
);

export const suspendUser = createAsyncThunk(
  'adminUsers/suspend',
  async ({ userId, reason }, { getState, dispatch }) => {
    const target = userLabel(getState().adminUsers.users, userId);
    await apiRequest(`/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    dispatch(addAuditEntry({ action: 'User Suspended', target, reason }));
    await dispatch(fetchUsers());
  }
);

export const banUser = createAsyncThunk(
  'adminUsers/ban',
  async ({ userId, reason }, { getState, dispatch }) => {
    const target = userLabel(getState().adminUsers.users, userId);
    await apiRequest(`/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    dispatch(addAuditEntry({ action: 'User Banned', target, reason }));
    await dispatch(fetchUsers());
  }
);

export const reinstateUser = createAsyncThunk(
  'adminUsers/reinstate',
  async (userId, { getState, dispatch }) => {
    const target = userLabel(getState().adminUsers.users, userId);
    const reason = 'Reinstated by admin';
    await apiRequest(`/users/${userId}/reinstate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    dispatch(addAuditEntry({ action: 'User Reinstated', target, reason }));
    await dispatch(fetchUsers());
  }
);

export const createUser = createAsyncThunk(
  'adminUsers/create',
  (payload) => apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) }),
);

export const deleteUser = createAsyncThunk('adminUsers/delete', async (id) => {
  await apiRequest(`/users/${id}`, { method: 'DELETE' });
  return id;
});

const initialState = {
  loading: true,
  users: [],
  userSearch: '',
  userRoleFilter: 'all',
  editingUser: null,
};

const adminUsersSlice = createSlice({
  name: 'adminUsers',
  initialState,
  reducers: {
    resetUserFilters(state) {
      state.userSearch = '';
      state.userRoleFilter = 'all';
      state.editingUser = null;
    },
    userSearchChanged(state, action) {
      state.userSearch = action.payload;
    },
    userRoleFilterChanged(state, action) {
      state.userRoleFilter = action.payload;
    },
    editingUserChanged(state, action) {
      state.editingUser = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(updateUserRole.fulfilled, (state) => {
        state.editingUser = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        if (!state.users.some(({ id }) => id === action.payload.id)) state.users.push(action.payload);
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter(({ id }) => id !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export const { userSearchChanged, userRoleFilterChanged, editingUserChanged, resetUserFilters } = adminUsersSlice.actions;

export const selectAdminUsers = (state) => state.adminUsers.users;
export const selectUserSearch = (state) => state.adminUsers.userSearch;
export const selectUserRoleFilter = (state) => state.adminUsers.userRoleFilter;
export const selectEditingUser = (state) => state.adminUsers.editingUser;

// Users matching the role dropdown and the search text (name, username or email)
export const selectFilteredUsers = createSelector(
  [selectAdminUsers, selectUserSearch, selectUserRoleFilter],
  (users, userSearch, userRoleFilter) => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => {
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }
);

export default adminUsersSlice.reducer;
