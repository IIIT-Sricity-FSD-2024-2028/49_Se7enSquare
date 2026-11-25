// Custom hook for the user's event registrations, backed by the Redux events slice.
import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchMyRegistrations,
  registerForEvent as registerThunk,
  cancelRegistration as cancelThunk,
  selectMyRegistrations,
  selectRegisteredEventIds,
} from '../../../store/slices/eventsSlice';

export function useRegistrations() {
  const dispatch = useAppDispatch();
  const myRegistrations = useAppSelector(selectMyRegistrations);
  const registeredIds = useAppSelector(selectRegisteredEventIds);

  const loadRegistrations = useCallback(() => dispatch(fetchMyRegistrations()), [dispatch]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const isRegistered = useCallback((eventId) => registeredIds.has(String(eventId)), [registeredIds]);

  // The slice also raises the event's attendee count
  const registerForEvent = useCallback(async (event, formData) => {
    try {
      const registration = await dispatch(registerThunk({ event, formData })).unwrap();
      return { success: true, registration };
    } catch (err) {
      return { success: false, error: err.message || 'Could not register. Please try again.' };
    }
  }, [dispatch]);

  // Pass the event or registration; the slice finds the user's own registration for it
  const cancelRegistration = useCallback(async (eventOrReg) => {
    try {
      await dispatch(cancelThunk(eventOrReg)).unwrap();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Could not cancel registration.' };
    }
  }, [dispatch]);

  return {
    myRegistrations,
    loadRegistrations,
    isRegistered,
    registerForEvent,
    cancelRegistration,
  };
}
