// Centralized API service for Event Management with automated x-role and x-user-id injection.
import { getRole, EVENT_STATUSES } from '../utils/constants';
import { apiRequest } from '../../../services/api';

export const eventService = {
  async getEvents(headers = {}) {
    const res = await apiRequest(`/events`, {
      headers,
    });
    return res;
  },

  async getEventById(id, headers = {}) {
    const res = await apiRequest(`/events/${id}`, {
      headers,
    });
    return res;
  },

  async createEvent(payload, headers = {}) {
    const role = headers['x-role'] || getRole();
    const safePayload = { ...payload };
    if (role === 'organizer' && safePayload.status === EVENT_STATUSES.APPROVED) {
      safePayload.status = EVENT_STATUSES.PENDING;
    }
    const res = await apiRequest(`/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(safePayload),
    });

    return res;
  },

  async updateEvent(id, payload, headers = {}) {
    const role = headers['x-role'] || getRole();
    const safePayload = { ...payload };
    if (role === 'organizer' && safePayload.status === EVENT_STATUSES.APPROVED) {
      delete safePayload.status;
    }
    const res = await apiRequest(`/events/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(safePayload),
    });

    return res;
  },

  async deleteEvent(id, headers = {}) {
    const res = await apiRequest(`/events/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res;
  },

  async getCommunities(headers = {}) {
    const res = await apiRequest(`/communities`, {
      headers,
    });
    return res;
  },

  async getRegistrations(userIdOrHeaders = null, customHeaders = {}) {
    let url = `/event-registrations`;
    let headers = customHeaders;
    if (typeof userIdOrHeaders === 'number' || typeof userIdOrHeaders === 'string') {
      url += `?userId=${userIdOrHeaders}`;
    } else if (userIdOrHeaders && typeof userIdOrHeaders === 'object') {
      headers = userIdOrHeaders;
    }
    const res = await apiRequest(url, {
      headers,
    });
    return res;
  },

  async registerForEvent(payload, headers = {}) {
    const res = await apiRequest(`/event-registrations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    return res;
  },

  async cancelRegistration(id, headers = {}) {
    const res = await apiRequest(`/event-registrations/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res;
  },

  async getEventRegistrants(eventId, headers = {}) {
    const res = await apiRequest(`/events/${eventId}/registrants`, {
      headers,
    });

    return res;
  },

  async upgradeOrganizerPlan(userId, plan = 'premium', headers = {}) {
    const res = await apiRequest(`/organisers/subscription/upgrade`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: Number(userId), plan }),
    });
    return res;
  },
};
