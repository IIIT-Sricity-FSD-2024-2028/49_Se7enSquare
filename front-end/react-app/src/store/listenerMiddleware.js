import { createListenerMiddleware, isRejected } from '@reduxjs/toolkit';
import { toastShown, toastHidden } from './slices/uiSlice';

export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: toastShown,
  effect: async (action, listenerApi) => {
    // A newer toast cancels the previous timer, so it gets its full duration
    listenerApi.cancelActiveListeners();
    await listenerApi.delay(action.payload.duration);
    listenerApi.dispatch(toastHidden());
  },
});

/**
 * Global async-thunk error listener.
 * Catches rejected createAsyncThunk actions and surfaces a toast.
 *
 * Registered SILENT_THUNKS handle their own notifications/errors inline
 * (e.g. form modals, unwrap catches), preventing duplicate error toasts.
 */
const SILENT_THUNKS = new Set([
  'communities/fetchList',
  'communities/fetchPage',
  'communities/fetchMyMemberships',
  'communities/join',
  'communities/leave',
  'auth/loginUser',
  'auth/registerUser',
  'events/register',
  'events/cancelRegistration',
  // Event Management inline-handled thunks
  'events/save',
  'events/updateStatus',
  // Organizer inline-handled thunks
  'organizer/upgrade',
  'organizer/promote',
  // Community Settings inline-handled thunks
  'communitySettings/save',
  'pricing/fetchSubscriptionStatus',
  'pricing/createSubscription',
  'pricing/changePlan',
  'pricing/cancelSubscription',
  'chat/send',
  'chat/toggleReaction',
  'appeal/submit',
  'modPanel/takeAction',
  'modPanel/escalate',
  'modPanel/moveToReview',
  'report/submitReport',
  'profile/fetchSettings',
  'profile/fetchQuiz',
  'profile/save',
  'profile/changePassword',
  'profile/deleteAccount',
  'profile/applyOrganizer',
  'profile/applyModerator',
  'adminUsers/updateRole',
  'adminUsers/suspend',
  'adminUsers/ban',
  'adminUsers/reinstate',
]);

listenerMiddleware.startListening({
  matcher: isRejected,
  effect: (action, listenerApi) => {
    const thunkType = action.type?.replace('/rejected', '');
    if (action.meta?.aborted || action.meta?.condition || SILENT_THUNKS.has(thunkType)) return;

    const message = action.payload?.message || action.error?.message || 'An unexpected error occurred.';
    listenerApi.dispatch(toastShown({ msg: `⚠️ ${message}`, duration: 4500 }));
  },
});
