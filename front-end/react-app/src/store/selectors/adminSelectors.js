import { createSelector } from '@reduxjs/toolkit';
import { selectAdminUsers } from '../slices/adminUsersSlice';
import { selectAdminCommunities } from '../slices/adminCommunitiesSlice';
import {
  selectReports,
  selectEvents,
  selectAppeals,
  selectOrganizerApps,
  selectModeratorApps,
  selectTotalMessages,
} from '../slices/adminModerationSlice';
import { selectAuditEntries } from '../slices/auditLogSlice';
import {
  selectOwnerStats,
  selectOwnerRevenue,
  selectSubscriptionFilter,
} from '../slices/ownerDashboardSlice';

/**
 * Overview stat counts, derived from three admin slices.
 * createSelector caches the result, so the counts are only recomputed
 * when one of these lists actually changes.
 */
export const selectAdminStats = createSelector(
  [
    selectAdminUsers,
    selectAdminCommunities,
    selectReports,
    selectEvents,
    selectAppeals,
    selectOrganizerApps,
    selectModeratorApps,
    selectTotalMessages,
  ],
  (users, communities, reports, events, appeals, organizerApps, moderatorApps, totalMessages) => {
    const pendingApps =
      organizerApps.filter((a) => a.status === 'pending').length +
      moderatorApps.filter((a) => a.status === 'pending').length;
    return {
      users: users.length,
      comms: communities.length,
      escalatedReports: reports.filter((r) => r.status === 'escalated').length,
      events: events.filter((e) => e.status === 'approved').length,
      appeals: appeals.filter((a) => a.status === 'pending').length,
      applications: pendingApps || organizerApps.length + moderatorApps.length,
      messages: totalMessages,
    };
  }
);

/**
 * selectFilteredAuditLogs
 * Filters audit logs by query or admin search.
 */
export const selectFilteredAuditLogs = createSelector(
  [selectAuditEntries, (state) => state.ownerDashboard?.adminUi?.globalSearch || ''],
  (entries, search) => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.action?.toLowerCase().includes(q) ||
        e.admin?.toLowerCase().includes(q) ||
        e.target?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q)
    );
  }
);

/**
 * selectFilteredSubscriptions
 * Filters subscribers by active subscription plan filter.
 */
export const selectFilteredSubscriptions = createSelector(
  [
    (state) => state.ownerDashboard?.drill?.content?.subData?.subscribers || [],
    selectSubscriptionFilter,
  ],
  (subscribers, filter) => {
    const f = (filter || 'all').toLowerCase();
    if (f === 'all') return subscribers;
    return subscribers.filter((s) => (s.plan || '').toLowerCase() === f);
  }
);

/**
 * selectOwnerKpiSummary
 * Aggregates high-level KPIs for executive portal.
 */
export const selectOwnerKpiSummary = createSelector(
  [selectOwnerStats, selectOwnerRevenue],
  (stats, revenue) => ({
    totalUsers: stats.totalUsers || 0,
    totalCommunities: stats.totalCommunities || 0,
    totalEvents: stats.totalEvents || 0,
    totalRevenue: revenue.totalRevenue || 0,
    monthlyRevenue: revenue.monthlyRevenue || 0,
    verifiedOrganisers: revenue.verifiedOrganisers || 0,
    pendingReports: stats.pendingReportsCount || 0,
    pendingAppeals: stats.pendingAppealsCount || 0,
    backendStatus: stats.backendStatus || 'Reachable',
  })
);
