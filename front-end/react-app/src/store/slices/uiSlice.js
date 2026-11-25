import { createSlice } from '@reduxjs/toolkit';

const initialDashboardSearch = { searchQuery: '', showSearch: false };
const initialLandingUi = {
  stats: { users: '0', comms: '0', msgs: '0' },
  activeStep: 0,
  tiltStyle: { transform: 'rotateY(-6deg) rotateX(3deg)' },
  joinedCommunities: { devNexus: true, designStudio: false, openSourceHub: false, hackathonHQ: false },
};

const initialState = {
  toast: { show: false, icon: '', msg: '', duration: 3000 },
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  dashboardSearch: initialDashboardSearch,
  landingUi: initialLandingUi,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    dashboardSearchChanged(state, { payload }) {
      Object.assign(state.dashboardSearch, payload);
    },
    resetDashboardSearch(state) {
      state.dashboardSearch = initialDashboardSearch;
    },
    landingUiChanged(state, { payload }) {
      Object.assign(state.landingUi, payload);
    },
    advanceLandingStep(state, { payload }) {
      state.landingUi.activeStep = (state.landingUi.activeStep + 1) % payload;
    },
    toggleLandingCommunity(state, { payload }) {
      const joined = state.landingUi.joinedCommunities;
      joined[payload] = !joined[payload];
    },
    resetLandingUi(state) {
      state.landingUi = initialLandingUi;
    },
    toastShown: {
      reducer(state, action) {
        state.toast = { show: true, ...action.payload };
      },
      // dispatch(toastShown({ msg, icon?, duration? }))
      prepare({ msg, icon = '', duration = 3000 }) {
        return { payload: { msg, icon, duration } };
      },
    },
    toastHidden(state) {
      state.toast.show = false;
    },
    setSidebarMobileOpen(state, { payload }) {
      state.sidebarMobileOpen = payload;
    },
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { toastShown, toastHidden, sidebarToggled, setSidebarMobileOpen, dashboardSearchChanged, resetDashboardSearch,
  landingUiChanged, advanceLandingStep, toggleLandingCommunity, resetLandingUi } = uiSlice.actions;

// Selectors
export const selectToast = (state) => state.ui.toast;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;

export default uiSlice.reducer;
