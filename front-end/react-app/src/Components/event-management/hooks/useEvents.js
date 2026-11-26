// Custom hook reading events from the Redux events slice, with a page-level category filter.
import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchEvents,
  deleteEvent as deleteEventThunk,
  setCategoryFilter,
  resetEventsFilter,
  selectEvents,
  selectEventsLoading,
  selectEventsError,
  selectCategoryFilter,
} from '../../../store/slices/eventsSlice';
import { selectFilteredEvents } from '../../../store/selectors/eventSelectors';

export function useEvents(initialCategory = 'all') {
  const dispatch = useAppDispatch();
  const events = useAppSelector(selectEvents);
  const error = useAppSelector(selectEventsError);
  const loading = useAppSelector(selectEventsLoading);
  const selectedCategory = useAppSelector(selectCategoryFilter);
  const upcomingEvents = useAppSelector(selectFilteredEvents);

  const loadEvents = useCallback(() => dispatch(fetchEvents()), [dispatch]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Set initial category if specified and different
  useEffect(() => {
    if (initialCategory && initialCategory !== 'all' && selectedCategory === 'all') {
      dispatch(setCategoryFilter(initialCategory));
    }
  }, [dispatch, initialCategory, selectedCategory]);

  // Unmount cleanup: reset filters when navigating away
  useEffect(() => {
    return () => {
      dispatch(resetEventsFilter());
    };
  }, [dispatch]);

  const setSelectedCategory = useCallback(
    (category) => {
      dispatch(setCategoryFilter(category));
    },
    [dispatch]
  );

  const deleteEvent = useCallback((id) => dispatch(deleteEventThunk(id)).unwrap(), [dispatch]);

  return {
    events,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    upcomingEvents,
    loadEvents,
    deleteEvent,
  };
}
