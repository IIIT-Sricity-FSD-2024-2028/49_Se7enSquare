import { createSelector } from '@reduxjs/toolkit';
import { selectAllCommunities } from '../slices/communitiesSlice';
import { selectApprovedEvents } from '../slices/eventsSlice';
import { selectNotifications } from '../slices/notificationsSlice';
import { selectCurrentPlan } from '../slices/pricingSlice';
import { PLANS } from '../../Components/platform/data/pricingPlans';

export const selectDashboardSearch = (state) => state.ui.dashboardSearch;

export const selectDashboardSearchResults = createSelector(
  [selectAllCommunities, selectApprovedEvents, (state) => selectDashboardSearch(state).searchQuery],
  (communities, events, searchQuery) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...communities.filter((c) => c.name?.toLowerCase().includes(query))
        .map((c) => ({ type: 'community', id: c.id, label: c.name, icon: c.icon || '🏘️' })),
      ...events.filter((e) => e.title?.toLowerCase().includes(query))
        .map((e) => ({ type: 'event', id: e.id, label: e.title, icon: '📅' })),
    ].slice(0, 6);
  },
);

export const selectUnreadNotifications = createSelector(
  [selectNotifications],
  (items) => items.filter((item) => !item.read),
);

export const selectActiveSubscriptionPlan = createSelector(
  [selectCurrentPlan],
  (id) => PLANS.find((plan) => plan.id === id) || PLANS[0],
);
