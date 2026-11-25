# Individual Contribution Report — Redux Architecture & Optimization

**Contributor:** Karmanya Belsare (`Karmanya30`)  
**Assigned Track:** Component 2 — Community Management & App-Wide Redux Infrastructure  
**Scope:** Redux Toolkit (`@reduxjs/toolkit`) Slice Design, Reselect Selectors, Store Middleware, Hook Refactoring & Classroom Rubric Compliance

---

## 1. Executive Summary

I architected and implemented the Redux Toolkit state management layer for **Component 2 (Community Management)** alongside reusable app-wide Redux infrastructure (`store/hooks.js` and global error interception in `store/listenerMiddleware.js`). The implementation satisfies all eight classroom evaluation requirements: 1:1 repository-to-slice mapping, complete 4-operation CRUD thunks, strict database-first `.fulfilled` state mutations, zero `localStorage` usage for domain state, elimination of component form/view `useState` hooks, route unmount state cleanup, and memoized Reselect selectors.

---

## 2. Files Created & Modified (Redux Scope Only)

| File Path                                                                 | Action       | Technical Contribution                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `front-end/react-app/src/store/slices/communitiesSlice.js`                | **Modified** | Refactored into a 1:1 normalized slice with all 4 CRUD thunks (`createCommunity`, `fetchCommunityList`/`fetchCommunityPage`, `updateCommunity`, `deleteCommunity`), normalized `membershipMap`, 60s SWR freshness guard (`LIST_CACHE_MS`), DB-first `.fulfilled` mutations, zero `localStorage`, in-store `createForm` + `discoveryFilter` + `current` state, and unmount cleanup reducers (`resetCreateForm`, `clearCurrentCommunity`, `filterReset`). |
| `front-end/react-app/src/store/selectors/communitySelectors.js`           | **Created**  | Built 6 memoized Reselect selectors (`selectFilteredCommunities`, `selectDiscoveryStats`, `selectDiscoveryCategories`, `selectIsCommunityJoined(id)`, `selectCommunityById(id)`, `selectOwnedCommunitiesCount`) decoupling filtering, sorting, and stat aggregation from UI rendering.                                                                                                                                                                  |
| `front-end/react-app/src/store/hooks.js`                                  | **Created**  | Introduced centralized `useAppDispatch` and `useAppSelector` hooks establishing a uniform import contract across the application.                                                                                                                                                                                                                                                                                                                       |
| `front-end/react-app/src/store/listenerMiddleware.js`                     | **Modified** | Removed `localStorage` domain persistence (`JOINED_KEY`); added a global `isRejected` async-thunk error listener with automatic toast dispatch and a `SILENT_THUNKS` exclusion set for inline-handled operations.                                                                                                                                                                                                                                       |
| `front-end/react-app/src/Components/platform/hooks/useDiscovery.js`       | **Modified** | Migrated inline `useMemo` computations to `communitySelectors.js`, bound `search`/`category`/`sortBy` to Redux `discoveryFilter`, and added `filterReset()` cleanup on unmount.                                                                                                                                                                                                                                                                         |
| `front-end/react-app/src/Components/platform/hooks/useCreateCommunity.js` | **Modified** | Eliminated all **13 local `useState` hooks**; bound every wizard field, channel list operation, validation step, and Live Preview card directly to `state.communities.createForm`, with `resetCreateForm()` on unmount.                                                                                                                                                                                                                                 |
| `front-end/react-app/src/Components/platform/hooks/useCommunityPage.js`   | **Modified** | Moved `activeTab` and `memberSearch` out of `useState` into `state.communities.current`, with `clearCurrentCommunity()` cleanup on unmount.                                                                                                                                                                                                                                                                                                             |

---

## 3. Commit-by-Commit Technical Breakdown

1. **`af31803` — `feat(redux): optimize communitiesSlice with membershipMap, true optimistic counters, SWR cache and persistent discovery filters`**
   - Introduced normalized `membershipMap` (`{ [communityId]: membershipId }`) populated by `fetchMyMemberships`, enabling `leaveCommunity` to issue a direct `DELETE /api/memberships/:id` call without a prior `GET` query (halving network calls).
   - Added `LIST_CACHE_MS` (60s) SWR `condition` guard on `fetchCommunityList` to prevent redundant network requests and loading skeleton flashes on revisit.
   - Lifted `discoveryFilter` (`search`, `category`, `sortBy`) into Redux store state with `searchChanged`, `categoryChanged`, `sortByChanged`, and `filterReset` actions.

2. **`1a2e76e` — `feat(redux): add communitySelectors.js with Reselect memoization for Component 2`**
   - Created `src/store/selectors/communitySelectors.js` with `createSelector` memoization:
     - `selectFilteredCommunities`: Cached multi-field search, category/tag match, and sorting pipeline (`active`, `members`, `trending`, `newest`).
     - `selectDiscoveryStats`: Single-pass cached calculation of `totalCommunities`, `totalMembers`, and `totalOnline`.
     - `selectDiscoveryCategories`: Derived sorted category pills prefixed with `'All'`.
     - `selectIsCommunityJoined(id)` & `selectCommunityById(id)`: Parameterized lookup selectors.
     - `selectOwnedCommunitiesCount`: Derived badge counter.
   - Refactored `useDiscovery.js` to consume these memoized selectors.

3. **`c0674d4` — `feat(redux): add store/hooks.js and global async-thunk error listener`**
   - Created `src/store/hooks.js` exporting `useAppDispatch` and `useAppSelector`.
   - Added a global `isRejected` matcher in `src/store/listenerMiddleware.js` that catches unhandled rejected thunks across all slices and dispatches `toastShown`, while skipping `SILENT_THUNKS` to prevent duplicate notices.

4. **`5801561` — `feat(redux): purge localStorage, enforce strict DB-first thunk lifecycle and add updateCommunity 4th CRUD operation`**
   - Purged `JOINED_KEY` and all `localStorage` reads/writes from `communitiesSlice.js` and `listenerMiddleware.js`, maintaining state strictly in Redux memory synchronized with the backend database.
   - Enforced the **Strict DB-First Thunk Pattern**: removed `.pending` optimistic mutations from `joinCommunity` and `leaveCommunity`; `.pending` updates only loading flags (`joinLoading`, `leaveLoading`), while `joinedIds`, `membershipMap`, and `memberCount` mutate strictly in `.fulfilled` after backend persistence.
   - Added `updateCommunity` (`PATCH /api/communities/:id`) to complete all **4 CRUD operations** alongside `createCommunity` (C), `fetchCommunityList`/`fetchCommunityPage` (R), and `deleteCommunity` (D).

5. **`a22ec60` — `feat(redux): eliminate useState in wizard and view hooks; add component unmount cleanup`**
   - Migrated all **13 local `useState` hooks** in `useCreateCommunity.js` (`name`, `desc`, `slug`, `category`, `icon`, `banner`, `website`, `tags`, `channels`, `privacy`, `permissions`, `rules`, `welcomeMsg`, plus step/tab state) to `state.communities.createForm`.
   - Migrated `activeTab` and `memberSearch` in `useCommunityPage.js` to `state.communities.current`.
   - Implemented `useEffect` unmount cleanup dispatches (`resetCreateForm()`, `clearCurrentCommunity()`, `filterReset()`) across all three Component 2 hooks so transient state resets cleanly on route navigation.

---

## 4. Redux Evaluation Rubric Verification

| Evaluation Criterion                     | Status      | Implementation Evidence                                                                                            |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **1:1 Slice-to-Repository Mapping**      | ✅ Verified | `communitiesSlice.js` $\leftrightarrow$ `communities.controller.ts` & repository                                   |
| **4 CRUD Operations (`repos * 4`)**      | ✅ Verified | `createCommunity` (C), `fetchCommunityList`/`fetchCommunityPage` (R), `updateCommunity` (U), `deleteCommunity` (D) |
| **Strict DB-First Thunk Pattern**        | ✅ Verified | `.pending` tracks loading flags only; state mutations execute strictly in `.fulfilled`                             |
| **Zero `localStorage` for Domain State** | ✅ Verified | `JOINED_KEY` purged; pure in-memory Redux variables populated from REST APIs                                       |
| **Redux-Driven Display & Actions**       | ✅ Verified | 13 wizard `useState` hooks + hub tab/search + discovery filters live in Redux                                      |
| **Component Unmount Cleanup**            | ✅ Verified | `resetCreateForm`, `clearCurrentCommunity`, `filterReset` dispatched on unmount                                    |
| **Reselect Memoized Selectors**          | ✅ Verified | `src/store/selectors/communitySelectors.js`                                                                        |
| **Standardized Hooks & Global Listener** | ✅ Verified | `src/store/hooks.js` + `isRejected` middleware in `src/store/listenerMiddleware.js`                                |

---

## 5. Build & Lint Verification (`upstream/main`)

- `npm --prefix back-end run lint` $\rightarrow$ **Passed (0 errors)**
- `npm --prefix front-end/react-app run lint` $\rightarrow$ **Passed (0 errors, 0 warnings)**
- `npm --prefix back-end run build` $\rightarrow$ **Passed (`nest build`)**
- `npm --prefix front-end/react-app run build` $\rightarrow$ **Passed (`vite build`, 257 modules transformed)**
