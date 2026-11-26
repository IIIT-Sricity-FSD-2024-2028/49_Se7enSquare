import { logout, loginSuccess, loginUser } from './slices/authSlice';

// A request started by a previous session must never repopulate cleared private state.
export const sessionMiddleware = (store) => {
  let generation = 0;
  const requests = new Map();
  return (next) => (action) => {
    if (!action || typeof action.type !== 'string') return next(action);
    if ((loginSuccess.match(action) || loginUser.fulfilled.match(action)) &&
        store.getState().auth.user && store.getState().auth.user.id !== action.payload?.id) {
      store.dispatch(logout());
    }
    if (logout.match(action)) generation++;
    const { requestId, requestStatus } = action.meta || {};
    if (requestId && !action.type.startsWith('auth/')) {
      if (requestStatus === 'pending') requests.set(requestId, generation);
      else if (requests.has(requestId)) {
        const started = requests.get(requestId);
        requests.delete(requestId);
        if (started !== generation) return action;
      }
    }
    return next(action);
  };
};
