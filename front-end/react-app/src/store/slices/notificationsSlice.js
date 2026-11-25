import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { logout } from './authSlice';

const hasUser = (_, { getState }) => Boolean(getState().auth.user?.id);

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, { getState }) => {
    const userId = getState().auth.user.id;
    const data = await apiRequest(`/notifications?userId=${encodeURIComponent(userId)}`);
    return { items: Array.isArray(data) ? data : [], fetchedAt: Date.now() };
  },
  {
    condition: (force, context) => {
      const { loading, lastFetched } = context.getState().notifications;
      return hasUser(force, context) && !loading && (force || Date.now() - lastFetched >= 60_000);
    },
  }
);

export const createNotification = createAsyncThunk(
  'notifications/create',
  (payload) => apiRequest('/notifications', { method: 'POST', body: JSON.stringify(payload) }),
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { getState }) => {
    const { auth, notifications } = getState();
    const ids = notifications.items.map(({ id }) => id);
    await apiRequest('/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({ userId: Number(auth.user.id) }),
    });
    return ids;
  },
  { condition: hasUser }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  ({ id, read = true }) => apiRequest(`/notifications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ read }),
  }),
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
);

const initialState = { items: [], loading: false, lastFetched: 0, requestId: null };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        state.loading = true;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.requestId = null;
        state.items = action.payload.items;
        state.lastFetched = action.payload.fetchedAt;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.requestId = null;
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.lastFetched = 0;
        if (state.items.some(({ userId }) => userId === action.payload.userId)) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        const ids = new Set(action.payload);
        state.items.forEach((item) => {
          if (ids.has(item.id)) item.read = true;
        });
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const index = state.items.findIndex(({ id }) => id === action.payload.id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.items = state.items.filter(({ id }) => id !== action.payload.id);
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearNotifications } = notificationsSlice.actions;

export const selectNotifications = (state) => state.notifications.items;
export const selectNotificationsLoading = (state) => state.notifications.loading;

const iconOf = (type) => (type === 'reaction' ? '💬' : type === 'report_status' ? '🛡️' : '🔔');

// The 6 newest, shaped for the Dashboard list
export const selectRecentNotifications = createSelector([selectNotifications], (items) =>
  items.slice(0, 6).map((n) => {
    let formattedTime = 'Recently';
    if (n.createdAt) {
      const d = new Date(n.createdAt);
      if (!isNaN(d.getTime())) {
        formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    return {
      id: n.id,
      icon: iconOf(n.type),
      text: n.text,
      time: formattedTime,
      read: n.read,
    };
  })
);

export const selectUnreadCount = createSelector(
  [selectNotifications],
  (items) => items.filter((n) => !n.read).length
);

export default notificationsSlice.reducer;
