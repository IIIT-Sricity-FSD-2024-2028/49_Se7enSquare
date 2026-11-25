import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { DEFAULT_STATS, DEFAULT_REVENUE } from '../../Components/platform/data/ownerDashboardData';
import { logout } from './authSlice';

/**
 * Owner Dashboard slice: executive stats, revenue KPIs, drill-down breakdown modal,
 * subscription filter, and admin UI state.
 */

const asArray = (v) => (Array.isArray(v) ? v : []);

export const fetchOwnerOverview = createAsyncThunk('ownerDashboard/fetchOverview', async () => {
  const [statsRes, revenueRes] = await Promise.allSettled([
    apiRequest('/dashboard/stats'),
    apiRequest('/dashboard/revenue'),
  ]);

  const data = statsRes.status === 'fulfilled' ? statsRes.value : null;
  const rev = revenueRes.status === 'fulfilled' ? revenueRes.value : null;

  return {
    stats: data && {
      totalUsers: data.totalUsers || 0,
      totalMemberships: data.totalMemberships || 0,
      totalCommunities: data.totalCommunities || 0,
      allCommunitiesCount: data.allCommunitiesCount ?? data.totalCommunities ?? 0,
      suspendedCommunitiesCount: data.suspendedCommunitiesCount || 0,
      totalEvents: data.totalEvents || 0,
      allEventsCount: data.allEventsCount ?? data.totalEvents ?? 0,
      suspendedEventsCount: data.suspendedEventsCount || 0,
      pendingReportsCount: data.pendingReportsCount || 0,
      pendingEventsCount: data.pendingEventsCount || 0,
      pendingAppealsCount: data.pendingAppealsCount || 0,
    },
    revenue: rev && {
      totalRevenue: rev.totalRevenue || 0,
      monthlyRevenue: rev.monthlyRevenue || 0,
      subscriptionRevenue: rev.subscriptionRevenue || 0,
      organiserRevenue: rev.organiserRevenue || 0,
      featuredEventRevenue: rev.featuredEventRevenue || 0,
      premiumUsers: rev.premiumUsers || 0,
      verifiedOrganisers: rev.verifiedOrganisers || 0,
      pendingOrganiserApplications: rev.pendingOrganiserApplications || 0,
    },
    reachable: statsRes.status === 'fulfilled' && revenueRes.status === 'fulfilled',
  };
});

function drillTitleOf(kind, filter) {
  if (kind === 'communities') return 'Communities Breakdown';
  if (kind === 'events') return 'Events Overview';
  if (kind === 'revenue') return 'Revenue — All Transactions';
  if (kind === 'subscriptions') return 'Subscriptions Status';
  if (kind === 'organisers') return filter === 'verified' ? 'Verified Organizers' : 'Pending Organizer Applications';
  return 'Details';
}

export const openDrill = createAsyncThunk('ownerDashboard/openDrill', async ({ kind, filter }) => {
  try {
    if (kind === 'communities') {
      const [communities, users] = await Promise.all([apiRequest('/communities'), apiRequest('/users')]);
      return { kind, communities: asArray(communities), users: asArray(users), loadError: '' };
    }
    if (kind === 'events') {
      const [events, communities] = await Promise.all([
        apiRequest('/events?includeSuspended=true'),
        apiRequest('/communities'),
      ]);
      return { kind, events: asArray(events), communities: asArray(communities), loadError: '' };
    }
    if (kind === 'revenue') {
      return { kind, payments: asArray(await apiRequest('/payments/history')), loadError: '' };
    }
    if (kind === 'subscriptions') {
      return { kind, subData: await apiRequest('/subscriptions'), loadError: '' };
    }
    if (kind === 'organisers') {
      return { kind, orgs: asArray(await apiRequest(`/organisers?status=${filter}`)), filter, loadError: '' };
    }
    return null;
  } catch (err) {
    const fallback = {
      communities: { communities: [], users: [] },
      events: { events: [], communities: [] },
      revenue: { payments: [] },
      subscriptions: { subData: { byPlan: { free: 0, plus: 0, ultra_pro: 0 }, subscribers: [] } },
      organisers: { orgs: [], filter },
    }[kind];
    return { kind, ...fallback, loadError: err.message || 'Could not reach the backend.' };
  }
});

const initialState = {
  stats: DEFAULT_STATS,
  revenue: DEFAULT_REVENUE,
  drill: { open: false, title: 'Details', loading: false, content: null, requestId: null },
  subscriptionFilter: 'all',
  adminUi: {
    activePage: 'overview',
    globalSearch: '',
  },
};

const ownerDashboardSlice = createSlice({
  name: 'ownerDashboard',
  initialState,
  reducers: {
    drillClosed(state) {
      state.drill.open = false;
    },
    subscriptionFilterChanged(state, action) {
      state.subscriptionFilter = action.payload;
    },
    adminUiActivePageChanged(state, action) {
      state.adminUi.activePage = action.payload;
    },
    adminUiGlobalSearchChanged(state, action) {
      state.adminUi.globalSearch = action.payload;
    },
    resetOwnerDashboardState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOwnerOverview.fulfilled, (state, action) => {
        const { stats, revenue, reachable } = action.payload;
        if (stats) state.stats = { ...state.stats, ...stats };
        if (revenue) state.revenue = revenue;
        state.stats.backendStatus = reachable ? 'Reachable' : '⚠️ Unreachable';
      })
      .addCase(openDrill.pending, (state, action) => {
        const { kind, filter } = action.meta.arg;
        state.drill.open = true;
        state.drill.loading = true;
        state.drill.title = drillTitleOf(kind, filter);
        state.drill.requestId = action.meta.requestId;
      })
      .addCase(openDrill.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.drill.requestId) return;
        state.drill.loading = false;
        state.drill.content = action.payload;
      })
      .addCase(logout, () => initialState);
  },
});

export const {
  drillClosed,
  subscriptionFilterChanged,
  adminUiActivePageChanged,
  adminUiGlobalSearchChanged,
  resetOwnerDashboardState,
} = ownerDashboardSlice.actions;

export const selectOwnerStats = (state) => state.ownerDashboard.stats;
export const selectOwnerRevenue = (state) => state.ownerDashboard.revenue;
export const selectDrill = (state) => state.ownerDashboard.drill;
export const selectSubscriptionFilter = (state) => state.ownerDashboard.subscriptionFilter;
export const selectAdminUi = (state) => state.ownerDashboard.adminUi;

export default ownerDashboardSlice.reducer;
