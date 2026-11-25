# Individual Contribution Report — Redux Architecture & Event Management

**Contributor:** Awadhesh (`Awadhesh-collab`)  
**Project:** Se7enSquare  
**Role:** React / Redux Developer  
**Assigned Pages / Routes:**
1. **Events Page** (`/events`)
2. **Event Approval** (`/event-approval`) — partial contribution
3. **Event Registration & Cancellation**
4. **Organizer Dashboard** (`/organizer-dashboard`)

**Key Areas:** Redux Toolkit architecture, async thunks, state management, Reselect selectors, API integration, UI improvements, and build/lint verification.

---

## 1. Executive Summary

Contributed to the Se7enSquare frontend by implementing and improving Redux Toolkit state management across the Events and Organizer modules. Key work included event registration and cancellation, Redux-driven forms and modals, memoized selectors, API integration, and organizer dashboard improvements. Also contributed to the Event Approval page by migrating its modal state to Redux; the core approval workflow was collaborative.

---

## 2. Files & Key Contributions

| Area | Main Files | Contribution |
|---|---|---|
| **Redux Infrastructure** | `store/index.js`, `store/hooks.js`, `store/listenerMiddleware.js` | Used the centralized Redux store, standardized dispatch/selector hooks, and global async-thunk error handling. |
| **Events Page** | `Pages/Events/Events.jsx`, `eventsSlice.js`, `eventSelectors.js` | Modularized the page, moved modal and category-filter state into Redux, and added memoized selectors. |
| **Event Approval** *(partial)* | `Pages/EventApproval/EventApproval.jsx`, `eventsSlice.js` | Migrated approval detail-modal state to Redux and connected the page to memoized selectors. Core approval logic was collaborative. |
| **Registration & Cancellation** | `eventsSlice.js`, `useRegistrations.js`, `RegistrationModal.jsx`, event components | Implemented registration/cancellation flows, registration-ID resolution, duplicate prevention, attendee-count updates, and Redux-managed form state. |
| **Organizer Dashboard** | `organizerSlice.js`, `useOrganizerData.js`, `OrganizerDashboard.jsx`, `admin-dashboard.css` | Moved dashboard filters and modal/form state into Redux, added cleanup, and fixed action-button layout. |

---

## 3. Main Technical Contributions

1. **Redux Toolkit state management**
   - Used `createAsyncThunk` for API operations with pending, fulfilled, and rejected states.
   - Used Reselect selectors for filtered events, event statistics, and organizer data.
   - Added a 60-second cache guard for event-list fetching.
   - Removed the Events module's offline `localStorage` fallback so API errors are handled explicitly.

2. **Event registration and cancellation**
   - Integrated registration with `POST /api/event-registrations`.
   - Integrated cancellation with `DELETE /api/event-registrations/:id`, resolving the actual registration ID rather than using the event ID.
   - Prevented duplicate registrations and updated attendee counts after successful API responses.
   - Moved registration-form state into Redux.

3. **Events and approval pages**
   - Refactored the Events page into reusable components and hooks.
   - Migrated event modal, category filter, and approval detail-modal state into Redux.
   - Added cleanup actions to reset temporary page state when leaving the pages.

4. **Organizer Dashboard**
   - Migrated filters, modal state, and form data into Redux.
   - Added state cleanup on unmount.
   - Fixed overlapping Edit, Promote, and Registrants buttons in the events table.

---

## 4. Backend Integration

| Operation | API |
|---|---|
| Fetch events | `GET /api/events` |
| Create/update event | `POST /api/events`, `PATCH /api/events/:id` |
| Delete event | `DELETE /api/events/:id` |
| Fetch registrations | `GET /api/event-registrations?userId=:id` |
| Register/cancel | `POST /api/event-registrations`, `DELETE /api/event-registrations/:id` |
| Fetch event registrants | `GET /api/events/:eventId/registrants` |
| Organizer profile/analytics | `GET /api/organisers/profile`, `GET /api/organisers/analytics` |
| Promote event | `POST /api/featured-events` |

---

## 5. Build & Lint Verification

- **Frontend ESLint:** Passed — 0 errors and 0 warnings.
- **Frontend Vite build:** Passed.
- **Backend ESLint:** Passed — 0 errors.
- **Backend NestJS build:** Passed.
- **Automated frontend test suite:** No standalone Jest/Vitest suite was reported; verification used linting, production build, compilation, and regression checks.

---

## 6. Git Contribution Evidence

Commits identified in the contribution report:

`647a7ab`, `7fe50ce`, `e31839c`, `29d5869`, `74f5c6d`, `f1595b2`, `23f375d`, `5e6abf1`, `0dbd4a6`, `60fe470`.

*Note: Event Approval was a partial contribution. The core approval workflow and status-update logic were collaborative contributions, not solely implemented by this contributor.*
