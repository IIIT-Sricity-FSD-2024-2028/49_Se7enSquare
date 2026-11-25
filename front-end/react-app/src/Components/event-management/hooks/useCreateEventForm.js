import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setCreateFormField,
  setCreateForm,
  resetCreateForm,
  closeModal,
  saveEvent,
  selectCreateEventForm,
  selectEventModalState,
} from '../../../store/slices/eventsSlice';
import { useToast } from './useToast';

/**
 * useCreateEventForm hook: encapsulates event creation/editing form logic,
 * eliminating local component useState and reading/writing directly to eventsSlice.createForm.
 */
export function useCreateEventForm() {
  const dispatch = useAppDispatch();
  const formData = useAppSelector(selectCreateEventForm);
  const modalState = useAppSelector(selectEventModalState);
  const { showToast } = useToast();

  // Unmount cleanup: reset the draft form so navigating away clears state
  useEffect(() => {
    return () => {
      dispatch(resetCreateForm());
    };
  }, [dispatch]);

  const updateField = useCallback(
    (field, value) => {
      dispatch(setCreateFormField({ field, value }));
    },
    [dispatch]
  );

  const setForm = useCallback(
    (data) => {
      dispatch(setCreateForm(data));
    },
    [dispatch]
  );

  const resetForm = useCallback(() => {
    dispatch(resetCreateForm());
  }, [dispatch]);

  const submitForm = useCallback(
    async (id) => {
      try {
        const res = await dispatch(saveEvent({ id, payload: formData })).unwrap();
        showToast(id ? '✅ Tournament updated' : '🏆 Tournament created');
        dispatch(closeModal());
        return { success: true, event: res.event };
      } catch (err) {
        showToast(`⚠️ ${err.message || 'Failed to save tournament'}`);
        return { success: false, error: err.message };
      }
    },
    [dispatch, formData, showToast]
  );

  return {
    formData,
    modalState,
    updateField,
    setForm,
    resetForm,
    submitForm,
  };
}
