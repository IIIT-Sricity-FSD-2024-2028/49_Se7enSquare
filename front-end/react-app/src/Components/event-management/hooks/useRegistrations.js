// Custom hook for the user's event registrations, backed by the Redux events slice.
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMyRegistrations,
  registerForEvent as registerThunk,
  cancelRegistration as cancelThunk,
  selectMyRegistrations,
  selectRegisteredEventIds,
} from '../../../store/slices/eventsSlice';
import { selectCurrentUser } from '../../../store/slices/authSlice';

export function useRegistrations() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const myRegistrations = useSelector(selectMyRegistrations);
  const registeredIds = useSelector(selectRegisteredEventIds);

  const [pendingRegisterIds, setPendingRegisterIds] = useState(new Set());
  const [pendingLeaveIds, setPendingLeaveIds] = useState(new Set());

  const loadRegistrations = useCallback(() => {
    if (user?.id) {
      dispatch(fetchMyRegistrations());
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const isRegistered = useCallback(
    (eventId) => registeredIds.has(String(eventId)),
    [registeredIds]
  );

  const isRegisterPending = useCallback(
    (eventId) => pendingRegisterIds.has(String(eventId)),
    [pendingRegisterIds]
  );

  const isLeavePending = useCallback(
    (eventId) => pendingLeaveIds.has(String(eventId)),
    [pendingLeaveIds]
  );

  const isPending = useCallback(
    (eventId) =>
      pendingRegisterIds.has(String(eventId)) || pendingLeaveIds.has(String(eventId)),
    [pendingRegisterIds, pendingLeaveIds]
  );

  // The slice also raises the event's attendee count
  const registerForEvent = useCallback(
    async (event, formData = {}) => {
      if (!user || !user.id) {
        return { success: false, error: 'Please log in to register' };
      }
      const eventIdStr = String(event.id);
      if (pendingRegisterIds.has(eventIdStr)) {
        return { success: false, error: 'Registration request already in progress' };
      }
      if (registeredIds.has(eventIdStr)) {
        return { success: false, error: 'You are already registered for this event' };
      }

      setPendingRegisterIds((prev) => new Set(prev).add(eventIdStr));
      try {
        const registration = await dispatch(registerThunk({ event, formData })).unwrap();
        return { success: true, registration };
      } catch (err) {
        return { success: false, error: err.message || 'Could not register. Please try again.' };
      } finally {
        setPendingRegisterIds((prev) => {
          const next = new Set(prev);
          next.delete(eventIdStr);
          return next;
        });
      }
    },
    [dispatch, user, pendingRegisterIds, registeredIds]
  );

  // Pass the event (or eventId); the slice finds the user's own registration for it
  const cancelRegistration = useCallback(
    async (eventOrId) => {
      if (!user || !user.id) {
        return { success: false, error: 'Please log in to manage registrations' };
      }
      const eventId = eventOrId?.id ?? eventOrId?.eventId ?? eventOrId;
      const eventIdStr = String(eventId);

      if (pendingLeaveIds.has(eventIdStr)) {
        return { success: false, error: 'Cancellation request already in progress' };
      }

      setPendingLeaveIds((prev) => new Set(prev).add(eventIdStr));
      try {
        await dispatch(cancelThunk(eventOrId)).unwrap();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || 'Could not leave event. Please try again.' };
      } finally {
        setPendingLeaveIds((prev) => {
          const next = new Set(prev);
          next.delete(eventIdStr);
          return next;
        });
      }
    },
    [dispatch, user, pendingLeaveIds]
  );

  return {
    myRegistrations,
    loadRegistrations,
    isRegistered,
    isRegisterPending,
    isLeavePending,
    isPending,
    registerForEvent,
    cancelRegistration,
  };
}
