import { createSelector } from '@reduxjs/toolkit';
import {
  selectEvents,
  selectApprovedEvents,
  selectCategoryFilter,
  selectSearchQuery,
  selectMyRegistrations,
  selectRegisteredEventIds,
} from '../slices/eventsSlice';
import {
  selectMyEvents,
  selectOrganizerFilter,
  selectOrganizerEarnings,
} from '../slices/organizerSlice';
import { EVENT_STATUSES } from '../../Components/event-management/utils/constants';

/**
 * Reselect memoized selectors for Component (Event Management & Organizer).
 */

/**
 * selectFilteredEvents
 * Filters approved events by category and search query.
 */
export const selectFilteredEvents = createSelector(
  [selectApprovedEvents, selectCategoryFilter, selectSearchQuery],
  (events, category, search) => {
    const cat = (category || 'all').toLowerCase();
    const query = (search || '').toLowerCase().trim();

    return events.filter((e) => {
      const matchCat =
        cat === 'all' ||
        (e.category && e.category.toLowerCase() === cat) ||
        (e.type && e.type.toLowerCase() === cat);
      const matchQuery =
        !query ||
        e.title?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  }
);

/**
 * selectEventsByStatus
 * Groups events by status for approval / management queue.
 */
export const selectEventsByStatus = createSelector(
  [selectEvents],
  (items) => ({
    pending: items.filter((e) => e.status === EVENT_STATUSES.PENDING),
    approved: items.filter((e) => !e.status || e.status === EVENT_STATUSES.APPROVED),
    rejected: items.filter((e) => e.status === EVENT_STATUSES.REJECTED),
  })
);

/**
 * selectEventCategories
 * Derives unique list of categories from events, always prefixed with 'All'.
 */
export const selectEventCategories = createSelector(
  [selectEvents],
  (events) => {
    const set = new Set();
    events.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ['All', ...Array.from(set).sort()];
  }
);

/**
 * selectEventStats
 * Platform-wide event telemetry statistics.
 */
export const selectEventStats = createSelector(
  [selectEvents, selectApprovedEvents, selectMyRegistrations],
  (allEvents, approvedEvents, myRegistrations) => ({
    totalEvents: allEvents.length,
    approvedCount: approvedEvents.length,
    registeredCount: myRegistrations.length,
    totalAttendees: approvedEvents.reduce(
      (sum, e) => sum + Number(e.attendees ?? e.registered ?? 0),
      0
    ),
  })
);

/**
 * selectFeaturedEvent
 * Selects the prominent featured event for the Events banner.
 */
export const selectFeaturedEvent = createSelector(
  [selectApprovedEvents],
  (approvedEvents) => {
    if (!approvedEvents || approvedEvents.length === 0) return null;
    const featured = approvedEvents.find((e) => e.isFeatured || e.featured);
    return featured || approvedEvents[0];
  }
);

/**
 * selectIsRegisteredForEvent(id)
 * Factory selector returning boolean whether user is registered for event id.
 */
export const selectIsRegisteredForEvent = (eventId) =>
  createSelector(
    [selectRegisteredEventIds],
    (registeredIds) => registeredIds.has(String(eventId))
  );

/**
 * selectOrganizerFilteredEvents
 * Filters organizer's tournaments by current filter tab.
 */
export const selectOrganizerFilteredEvents = createSelector(
  [selectMyEvents, selectOrganizerFilter],
  (myEvents, filter) => {
    const f = (filter || 'all').toLowerCase();
    if (f === 'all') return myEvents;
    return myEvents.filter((e) => (e.status || '').toLowerCase() === f);
  }
);

/**
 * selectOrganizerStats
 * Aggregated metrics for the Organizer Dashboard summary cards.
 */
export const selectOrganizerStats = createSelector(
  [selectMyEvents, selectOrganizerEarnings],
  (myEvents, earnings) => {
    const totalTournaments = myEvents.length;
    const pendingApproval = myEvents.filter(
      (e) => (e.status || '').toLowerCase() === 'pending'
    ).length;
    const upcomingApproved = myEvents.filter(
      (e) => (e.status || '').toLowerCase() === 'approved'
    ).length;
    const totalRegistrations = myEvents.reduce(
      (sum, e) => sum + Number(e.attendees ?? e.registered ?? 0),
      0
    );

    return {
      totalTournaments,
      totalRegistrations,
      pendingApproval,
      upcomingApproved,
      estimatedEarnings: earnings || '0',
    };
  }
);
