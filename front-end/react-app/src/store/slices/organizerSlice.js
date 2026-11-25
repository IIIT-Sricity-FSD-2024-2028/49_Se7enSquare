import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { eventService } from '../../Components/event-management/services/eventService';
import { logout } from './authSlice';
import { selectEvents } from './eventsSlice';

/**
 * Organizer slice: the organizer's plan, earnings, registration counts, and tournament filters.
 * Tournaments themselves live in the events slice; selectMyEvents filters them.
 */

const FREE_PROFILE = { plan: 'free', limits: { maxActiveTournaments: 2, maxParticipants: 64 } };

export const fetchOrganizerData = createAsyncThunk('organizer/fetch', async (_, { getState }) => {
  const userId = getState().auth.user?.id;

  // Registration counts per event (non-critical)
  const regs = await eventService.getRegistrations().catch(() => []);
  const regCountByEvent = {};
  (Array.isArray(regs) ? regs : []).forEach((r) => {
    regCountByEvent[r.eventId] = (regCountByEvent[r.eventId] || 0) + 1;
  });

  if (!userId) return { regCountByEvent, profile: FREE_PROFILE, earnings: '0' };

  const [profile, analytics] = await Promise.all([
    apiRequest(`/organisers/profile?userId=${userId}`).catch(() => null),
    apiRequest(`/organisers/analytics?userId=${userId}`).catch(() => null),
  ]);

  return {
    regCountByEvent,
    profile: profile || FREE_PROFILE,
    earnings: Number(analytics?.estimatedOrganiserEarnings || 0).toLocaleString(),
  };
});

export const upgradeOrganizerPlan = createAsyncThunk('organizer/upgrade', async (_, { getState, rejectWithValue }) => {
  const userId = getState().auth.user?.id;
  try {
    if (userId) {
      await eventService.upgradeOrganizerPlan(userId, 'premium');
    }
    return { plan: 'premium' };
  } catch (err) {
    return rejectWithValue({ message: err?.message || 'Failed to upgrade plan' });
  }
});

// Puts a tournament in the Discover carousel for 7 days
export const promoteEvent = createAsyncThunk('organizer/promote', async (eventId, { getState, rejectWithValue }) => {
  try {
    const data = await apiRequest('/featured-events', {
      method: 'POST',
      body: JSON.stringify({
        eventId: Number(eventId),
        userId: Number(getState().auth.user?.id),
        durationDays: 7,
      }),
    });
    return { eventId: Number(eventId), data };
  } catch (err) {
    return rejectWithValue({ message: err?.message || 'Failed to promote event' });
  }
});

// Removes a tournament promotion from the Discover carousel
export const unpromoteEvent = createAsyncThunk('organizer/unpromote', async (featuredOrEventId, { rejectWithValue }) => {
  try {
    await apiRequest(`/featured-events/${featuredOrEventId}`, { method: 'DELETE' });
    return { id: featuredOrEventId };
  } catch (err) {
    return rejectWithValue({ message: err?.message || 'Failed to remove promotion' });
  }
});

const initialState = {
  profile: null,
  earnings: '0',
  regCountByEvent: {},
  loading: true,
  currentFilter: 'all',
  upgrading: false,
  promoting: false,
  error: null,
};

const organizerSlice = createSlice({
  name: 'organizer',
  initialState,
  reducers: {
    orgFilterChanged(state, action) {
      state.currentFilter = action.payload;
    },
    resetOrganizerState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrganizerData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchOrganizerData.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.profile;
        state.earnings = action.payload.earnings;
        state.regCountByEvent = action.payload.regCountByEvent;
      })
      .addCase(fetchOrganizerData.rejected, (state) => {
        state.loading = false;
        state.profile = FREE_PROFILE;
      })
      .addCase(upgradeOrganizerPlan.pending, (state) => {
        state.upgrading = true;
      })
      .addCase(upgradeOrganizerPlan.fulfilled, (state) => {
        state.upgrading = false;
        state.profile = {
          ...state.profile,
          plan: 'premium',
          limits: { maxActiveTournaments: 'Unlimited', maxParticipants: 'Unlimited' },
        };
      })
      .addCase(upgradeOrganizerPlan.rejected, (state, action) => {
        state.upgrading = false;
        state.error = action.payload?.message || 'Failed to upgrade';
      })
      .addCase(promoteEvent.pending, (state) => {
        state.promoting = true;
      })
      .addCase(promoteEvent.fulfilled, (state) => {
        state.promoting = false;
      })
      .addCase(promoteEvent.rejected, (state, action) => {
        state.promoting = false;
        state.error = action.payload?.message || 'Failed to promote';
      })
      .addCase(unpromoteEvent.fulfilled, (state) => {
        state.promoting = false;
      })
      .addCase(logout, () => initialState);
  },
});

export const { orgFilterChanged, resetOrganizerState } = organizerSlice.actions;

export const selectOrganizer = (state) => state.organizer;
export const selectOrganizerFilter = (state) => state.organizer.currentFilter;
export const selectOrganizerProfile = (state) => state.organizer.profile;
export const selectOrganizerEarnings = (state) => state.organizer.earnings;

const selectAuthUser = (state) => state.auth.user;

// The logged-in organizer's tournaments, taken from the shared events slice
export const selectMyEvents = createSelector([selectEvents, selectAuthUser], (events, user) =>
  events.filter(
    (e) =>
      (user?.id && (e.organiserId === user.id || e.organizerId === user.id)) ||
      (user?.username && e.createdBy === user.username) ||
      (user?.name && e.createdBy === user.name)
  )
);

export default organizerSlice.reducer;
