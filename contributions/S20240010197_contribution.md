# Individual Contribution Report — Redux Architecture & Optimization

**Contributor:** Rajat Jain (`rajatjain3366`)  
**Assigned Track:** Component 5 — Administration & Platform Management  
**Assigned Pages / Routes:**  
1. **Admin Dashboard** (`admin-dashboard.html` $\rightarrow$ `/admin-dashboard`, `/admin`)  
2. **Community Settings** (`community-settings.html` $\rightarrow$ `/community-settings/:id`)  
3. **Abuse Reporting** (`report.html` $\rightarrow$ `/report`)  
4. **Pricing & Subscriptions** (`pricing.html` $\rightarrow$ `/pricing`)  

**Scope:** Redux Toolkit (`@reduxjs/toolkit`) Slice Architecture, 4-Operation CRUD Thunks, DB-First State Updates, Zero `localStorage`, Component `useState` Elimination, Unmount Cleanup & Memoized Selectors Across Component 5

---

## 1. Executive Summary

Across **Component 5 (Admin Dashboard, Community Settings, Abuse Reporting, and Pricing)**, all four subsystems run on normalized **Redux Toolkit** slices integrated with NestJS REST APIs (`admin-communities`, `users`, `reports`, `audit`, `subscriptions`, and `communities`). Every slice enforces strict database-first `.fulfilled` state mutations, full Create/Read/Update/Delete (CRUD) operations, pure in-memory store state (zero `localStorage`), Redux-controlled forms/tabs/filters with route unmount cleanups, and memoized Reselect selectors.

---

## 2. Files by Assigned Page & Redux Layer

| Assigned Page | Redux Slice & Selectors | Custom Hooks & Page Components | Key Redux Capabilities |
|---|---|---|---|
| **1. Admin Dashboard**<br>`/admin-dashboard` | `adminCommunitiesSlice.js`<br>`adminModerationSlice.js`<br>`adminUsersSlice.js`<br>`auditLogSlice.js`<br>`ownerDashboardSlice.js` *(adminUi state)*<br>`selectors/adminSelectors.js`<br>`selectors/userSelectors.js` | `Pages/AdminDashboard.jsx`<br>`EscalatedReportsTab.jsx`<br>`hooks/useAdminCommunities.js`<br>`hooks/useAdminModeration.js`<br>`hooks/useAdminUsers.js`<br>`hooks/useAuditLog.js` | • Full 4-CRUD across communities (`fetchCommunities`, `createAdminCommunity`, `suspendCommunity`/`reinstateCommunity`, `deleteAdminCommunity`), users (`fetchUsers`, `createUser`, `updateUserRole`/`suspendUser`/`banUser`, `deleteUser`), moderation reports, and audit logs (`fetchAuditLog`, `addAuditEntry`, `updateAuditEntry`, `deleteAuditEntry`).<br>• Reselect selectors (`selectAdminStats`, `selectFilteredAuditLogs`, `selectFilteredUsers`) compute live KPI counts and filtered tables in memory.<br>• Lifted `activePage`, `globalSearch`, and `EscalatedReportsTab` inline notes into Redux with zero component `useState` and automatic unmount resets (`resetAdminCommunities`, `resetAdminModeration`, `resetUserFilters`, `resetAuditLogState`). |
| **2. Community Settings**<br>`/community-settings/:id` | `communitySettingsSlice.js` | `Pages/CommunitySettings.jsx`<br>`CommunityHeader.jsx`<br>`hooks/useCommunitySettings.js` | • Thunks for Create (`createChannel`), Read (`fetchCommunitySettings`), Update (`saveCommunitySettings`, `uploadBanner`), and Delete (`removeMember`).<br>• Tracked `activeTab`, `modalOpen`, `newChName`, `newChType`, and dirty-form state (`isDirty`) in Redux store variables.<br>• Dispatches `resetCommunitySettings()` on unmount and registered `communitySettings/save` in `SILENT_THUNKS` (`listenerMiddleware.js`). |
| **3. Abuse Reporting**<br>`/report` | `reportSlice.js` | `Pages/Report.jsx`<br>`hooks/useReportForm.js` | • Complete 4-CRUD mapped to `/reports`: `submitReport` (C), `searchUsers` & `fetchMyReports` (R), `updateReportStatus` (U), and `deleteReport` (D).<br>• Multi-step reporting wizard form, target search, and `submissionRequestId` race-condition guard live inside Redux; `resetReportForm()` clears draft state on route exit. |
| **4. Pricing & Subscriptions**<br>`/pricing` | `pricingSlice.js`<br>`selectors/authDashboardSelectors.js` | `Pages/Pricing.jsx`<br>`hooks/usePricing.js` | • Full 4-CRUD mapped to `/subscriptions`: `createSubscription` (C), `fetchSubscriptionStatus` (R), `changePlan` (U), and `cancelSubscription` (D).<br>• Uses `selectActiveSubscriptionPlan` memoized selector and `useAppDispatch`/`useAppSelector`; dispatches `resetPricingState()` on unmount. |

---

## 3. Slice & CRUD Architecture Breakdown

1. **Admin Governance (`adminCommunitiesSlice`, `adminModerationSlice`, `adminUsersSlice`, `auditLogSlice`):**
   - **`adminCommunitiesSlice.js`:** `fetchCommunities` (R), `createAdminCommunity` (C), `suspendCommunity` / `reinstateCommunity` (U), `deleteAdminCommunity` (D), `resetAdminCommunities` (unmount cleanup).
   - **`adminModerationSlice.js`:** `fetchReports` / `fetchEvents` / `fetchAppeals` / `fetchDashboardStats` / `fetchApplications` (R), `resolveEscalatedReport` / `escalateReport` / `reviewAppeal` / `reviewOrganizerApp` / `reviewModeratorApp` / `suspendEvent` / `reinstateEvent` (U), `deleteEscalatedReport` / `dismissAppeal` (D), plus `modNoteChanged` and `resetAdminModeration`.
   - **`adminUsersSlice.js`:** `fetchUsers` (R), `createUser` (C), `updateUserRole` / `suspendUser` / `banUser` / `reinstateUser` (U), `deleteUser` (D), plus `selectFilteredUsers` and `resetUserFilters`.
   - **`auditLogSlice.js`:** `fetchAuditLog` (R), `addAuditEntry` (C), `updateAuditEntry` (U), `deleteAuditEntry` (D), plus `resetAuditLogState`.
2. **Community Settings (`communitySettingsSlice.js`):**
   - `fetchCommunitySettings` (R), `createChannel` (C), `saveCommunitySettings` & `uploadBanner` (U), `removeMember` (D), with `selectSettingsActiveTab`, `selectSettingsModalOpen`, `selectNewChName`, `selectNewChType`, and unmount reset.
3. **Abuse Reporting (`reportSlice.js`):**
   - `submitReport` (C), `searchUsers` & `fetchMyReports` (R), `updateReportStatus` (U), `deleteReport` (D), and `resetReportForm` / `reportReset` cleanup.
4. **Pricing (`pricingSlice.js`):**
   - `createSubscription` (C), `fetchSubscriptionStatus` (R), `changePlan` (U), `cancelSubscription` (D), and `resetPricingState` cleanup.

---

## 4. Redux Evaluation Rubric Verification (Component 5)

| Evaluation Criterion | Status | Implementation Evidence |
|---|---|---|
| **1:1 Slice-to-Repository Mapping** | ✅ Verified | `adminCommunities`, `adminModeration`, `adminUsers`, `auditLog`, `communitySettings`, `report`, and `pricing` slices map to their respective NestJS controllers & repositories. |
| **4 CRUD Operations per Slice** | ✅ Verified | Create, Read, Update, and Delete thunks implemented across Admin, Audit, Community Settings, Report, and Pricing slices. |
| **Strict DB-First Thunk Pattern** | ✅ Verified | `.pending` reducers set only loading/saving flags (`loading`, `saving`, `submitting`, `isSubmitting`); store data mutates strictly in `.fulfilled` after backend confirmation. |
| **Zero `localStorage`** | ✅ Verified | Zero `localStorage` reads/writes across all Component 5 slices, hooks, and pages. |
| **All Display Data & Actions from Redux** | ✅ Verified | Eliminated local `useState` across `AdminDashboard.jsx`, `EscalatedReportsTab.jsx`, `useCommunitySettings.js`, `useReportForm.js`, and `usePricing.js`. |
| **Component Unmount Cleanup** | ✅ Verified | Cleanup reducers (`resetAdminCommunities`, `resetAdminModeration`, `resetUserFilters`, `resetAuditLogState`, `resetCommunitySettings`, `resetReportForm`, `resetPricingState`) run on route exit. |
| **Memoized Selectors** | ✅ Verified | `adminSelectors.js` (`selectAdminStats`, `selectFilteredAuditLogs`, `selectFilteredSubscriptions`), `userSelectors.js`, and `selectActiveSubscriptionPlan`. |
| **Centralized Hooks & Middleware** | ✅ Verified | Admin, Settings, Report & Pricing hooks consume `useAppDispatch`/`useAppSelector` (`src/store/hooks.js`) and register inline error flows in `SILENT_THUNKS`. |

---

## 5. Build & Lint Verification (`upstream/main`)

- `npm --prefix back-end run lint` $\rightarrow$ **Passed (0 errors)**
- `npm --prefix front-end/react-app run lint` $\rightarrow$ **Passed (0 errors, 0 warnings)**
- `npm --prefix back-end run build` $\rightarrow$ **Passed (`nest build`)**
- `npm --prefix front-end/react-app run build` $\rightarrow$ **Passed (`vite build`)**
