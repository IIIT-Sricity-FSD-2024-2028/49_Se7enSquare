# Individual Contribution Report — Redux Architecture & Optimization

**Contributor:** Karmanya Belsare (`Karmanya30`)  
**Assigned Track:** Component 2 — Community Management & App-Wide Redux Infrastructure  
**Assigned Pages / Routes:**  
1. **Community Discovery** (`discovery.html` $\rightarrow$ `/discovery`)  
2. **Create Community Wizard** (`create-community.html` $\rightarrow$ `/create-community`)  
3. **Community Hub Page** (`community-page.html` $\rightarrow$ `/community-page/:id`)  
4. **Owner Dashboard** (`owner-dashboard.html` $\rightarrow$ `/owner-dashboard`, `/owner`)  

**Pull Request:** `rajatjain3366/React-conversion_49_Se7enSquare#4` (Branch `Karmanya30/karmanya/redux-improvements` — **MERGED** at `a6e31d5`)  
**Scope:** Redux Toolkit (`@reduxjs/toolkit`) Slice Normalization, Full 4-Operation CRUD, DB-First Thunk Lifecycle, Zero `localStorage`, Component `useState` Elimination, Unmount Cleanup, Reselect Selectors & App-Wide Store Infrastructure

---

## 1. Executive Summary

Through **PR #4** (merged at `a6e31d5`), **Component 2 (Community Discovery, Create Community, Community Hub, and Owner Dashboard)** was architected and optimized on **Redux Toolkit** alongside reusable app-wide store infrastructure (`src/store/hooks.js` and global `isRejected` error handling in `src/store/listenerMiddleware.js`). The implementation satisfies all classroom Redux criteria: 1:1 repository-to-slice mapping, full 4-operation CRUD (`createCommunity`, `fetchCommunityList`/`fetchCommunityPage`, `updateCommunity`, `deleteCommunity`), strict DB-first `.fulfilled` state mutations, zero `localStorage` usage, Redux-controlled wizard/view forms, route unmount state cleanups, and memoized Reselect selectors.

---

## 2. Files by Assigned Page & Redux Layer

| Assigned Page | Redux Slice & Selectors | Custom Hooks & Page Components | Key Redux Capabilities |
|---|---|---|---|
| **1. Community Discovery**<br>`/discovery` | `communitiesSlice.js`<br>`selectors/communitySelectors.js` | `Pages/Discovery.jsx`<br>`hooks/useDiscovery.js` | • Read/Membership CRUD: `fetchCommunityList` (with 60s `LIST_CACHE_MS` SWR cache guard), `fetchMyMemberships`, DB-first `joinCommunity` & `leaveCommunity` via normalized `membershipMap` (single `DELETE` call without extra `GET`).<br>• Reselect selectors (`selectFilteredCommunities`, `selectDiscoveryStats`, `selectDiscoveryCategories`, `selectIsCommunityJoined(id)`) replace inline `useMemo` computations.<br>• Search, category, and sort filters (`discoveryFilter`) live in Redux; dispatches `filterReset()` on unmount. |
| **2. Create Community Wizard**<br>`/create-community` | `communitiesSlice.js` | `Pages/CreateCommunity.jsx`<br>`CreateCommunityHeader.jsx`<br>`CreateCommunityLiveCard.jsx`<br>`hooks/useCreateCommunity.js` | • Create CRUD: `createCommunity` (`POST /api/communities`) updates `state.all` and `joinedIds` strictly in `.fulfilled`.<br>• Eliminated all **13 local `useState` hooks** (`name`, `desc`, `slug`, `category`, `icon`, `banner`, `website`, `tags`, `channels`, `privacy`, `permissions`, `rules`, `welcomeMsg`, plus step/tab flags) by migrating the entire form & Live Preview card to `state.communities.createForm`.<br>• Dispatches `resetCreateForm()` on unmount to clear draft inputs. |
| **3. Community Hub Page**<br>`/community-page/:id` | `communitiesSlice.js`<br>`selectors/communitySelectors.js` | `Pages/CommunityPage.jsx`<br>`hooks/useCommunityPage.js` | • Single-Read, Update & Delete CRUD: `fetchCommunityPage`, `fetchCommunityExtras`, `updateCommunity` (`PATCH /api/communities/:id`), `deleteCommunity` (`DELETE /api/communities/:id`).<br>• Synchronizes member/online counters across both `state.all` cards and `state.current.community` via `adjustMemberCount`.<br>• Moved `activeTab` and `memberSearch` out of `useState` into `state.communities.current`; dispatches `clearCurrentCommunity()` on unmount. |
| **4. Owner Dashboard**<br>`/owner-dashboard`, `/owner` | `ownerDashboardSlice.js`<br>`communitiesSlice.js`<br>`selectors/communitySelectors.js`<br>`selectors/adminSelectors.js` | `Pages/OwnerDashboard.jsx`<br>`SubscriptionsTab.jsx`<br>`hooks/useOwnerDashboard.js` | • Reads live executive overview & drill-down breakdowns (`fetchOwnerOverview`, `openDrill`) alongside `selectOwnedCommunitiesCount` and `selectOwnerKpiSummary`.<br>• Replaced `SubscriptionsTab` local `filter` `useState` with Redux `subscriptionFilter` and dispatches `resetOwnerDashboardState()` on unmount. |
| **App-Wide Store Infrastructure** | `src/store/hooks.js`<br>`src/store/listenerMiddleware.js` | Shared across all 5 team tracks | • Created standardized `useAppDispatch` and `useAppSelector` wrappers in `src/store/hooks.js`.<br>• Purged `JOINED_KEY` `localStorage` persistence and built the global `isRejected` async-thunk error interceptor with `SILENT_THUNKS` exclusion in `src/store/listenerMiddleware.js`. |

---

## 3. Commit-by-Commit Technical Breakdown (`PR #4` -> `a6e31d5`)

1. **`af31803` — `feat(redux): optimize communitiesSlice with membershipMap, true optimistic counters, SWR cache and persistent discovery filters`**
   - Introduced normalized `membershipMap` (`{ [communityId]: membershipId }`) populated by `fetchMyMemberships`, halving network requests when leaving a community.
   - Added `LIST_CACHE_MS` (60s) SWR `condition` guard on `fetchCommunityList` to prevent redundant network calls and skeleton flashes on revisit.
   - Lifted `discoveryFilter` (`search`, `category`, `sortBy`) into Redux with `searchChanged`, `categoryChanged`, `sortByChanged`, and `filterReset` actions.
2. **`1a2e76e` — `feat(redux): add communitySelectors.js with Reselect memoization for Component 2`**
   - Created `src/store/selectors/communitySelectors.js` with 6 memoized selectors: `selectFilteredCommunities`, `selectDiscoveryStats`, `selectDiscoveryCategories`, `selectIsCommunityJoined(id)`, `selectCommunityById(id)`, and `selectOwnedCommunitiesCount`.
   - Refactored `useDiscovery.js` to consume these selectors instead of inline `useMemo`.
3. **`c0674d4` — `feat(redux): add store/hooks.js and global async-thunk error listener`**
   - Created `src/store/hooks.js` exporting `useAppDispatch` and `useAppSelector`.
   - Added a global `isRejected` matcher in `src/store/listenerMiddleware.js` to surface unhandled async thunk errors as toasts while skipping `SILENT_THUNKS`.
4. **`5801561` — `feat(redux): purge localStorage, enforce strict DB-first thunk lifecycle and add updateCommunity 4th CRUD operation`**
   - Purged `JOINED_KEY` and all `localStorage` reads/writes from `communitiesSlice.js` and `listenerMiddleware.js`, maintaining state strictly in Redux memory.
   - Enforced the **Strict DB-First Thunk Pattern**: `.pending` updates only loading flags (`joinLoading`, `leaveLoading`); `joinedIds`, `membershipMap`, and `memberCount` mutate strictly in `.fulfilled` after backend persistence.
   - Added `updateCommunity` (`PATCH /api/communities/:id`) to complete all **4 CRUD operations** alongside `createCommunity` (C), `fetchCommunityList`/`fetchCommunityPage` (R), and `deleteCommunity` (D).
5. **`a22ec60` — `feat(redux): eliminate useState in wizard and view hooks; add component unmount cleanup`**
   - Migrated all **13 local `useState` hooks** in `useCreateCommunity.js` and view state (`activeTab`, `memberSearch`) in `useCommunityPage.js` into Redux (`state.communities.createForm` and `state.communities.current`).
   - Added `useEffect` unmount cleanup dispatches (`resetCreateForm()`, `clearCurrentCommunity()`, `filterReset()`) across all three Component 2 hooks.

---

## 4. Redux Evaluation Rubric Verification (Component 2)

| Evaluation Criterion | Status | Implementation Evidence |
|---|---|---|
| **1:1 Slice-to-Repository Mapping** | ✅ Verified | `communitiesSlice.js` $\leftrightarrow$ `communities.controller.ts` & repository |
| **4 CRUD Operations (`repos * 4`)** | ✅ Verified | `createCommunity` (C), `fetchCommunityList`/`fetchCommunityPage` (R), `updateCommunity` (U), `deleteCommunity` (D) |
| **Strict DB-First Thunk Pattern** | ✅ Verified | `.pending` tracks loading flags only; state mutations execute strictly in `.fulfilled` |
| **Zero `localStorage` for Domain State** | ✅ Verified | `JOINED_KEY` purged; pure in-memory Redux variables populated from REST APIs |
| **Redux-Driven Display & Actions** | ✅ Verified | Eliminated 13 wizard `useState` hooks + hub tab/search + discovery filters live in Redux |
| **Component Unmount Cleanup** | ✅ Verified | `resetCreateForm`, `clearCurrentCommunity`, `filterReset`, `resetOwnerDashboardState` dispatched on unmount |
| **Reselect Memoized Selectors** | ✅ Verified | `src/store/selectors/communitySelectors.js` + `selectOwnerKpiSummary` |
| **Standardized Hooks & Global Listener** | ✅ Verified | `src/store/hooks.js` + `isRejected` middleware in `src/store/listenerMiddleware.js` |

---

## 5. Build & Lint Verification (`upstream/main`)

- `npm --prefix back-end run lint` $\rightarrow$ **Passed (0 errors)**
- `npm --prefix front-end/react-app run lint` $\rightarrow$ **Passed (0 errors, 0 warnings)**
- `npm --prefix back-end run build` $\rightarrow$ **Passed (`nest build`)**
- `npm --prefix front-end/react-app run build` $\rightarrow$ **Passed (`vite build`, 257 modules transformed)**
