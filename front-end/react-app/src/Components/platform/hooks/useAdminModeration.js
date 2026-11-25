import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchReports,
  fetchEvents,
  fetchAppeals,
  fetchApplications,
  fetchDashboardStats,
  resolveEscalatedReport,
  reviewAppeal,
  reviewOrganizerApp,
  reviewModeratorApp,
  resetAdminModeration,
  selectReports,
  selectEvents,
  selectAppeals,
  selectOrganizerApps,
  selectModeratorApps,
} from '../../../store/slices/adminModerationSlice';

const ACTION_TOASTS = {
  dismiss: '✓ Report dismissed',
  warn: '⚠️ Warning issued and report resolved',
  remove_content: '🗑️ Content marked removed and author sanctioned',
  suspend_author: '⚠️ Author suspended and report resolved',
  ban_author: '⛔ Author permanently banned',
};

/**
 * Custom hook connecting the Escalated Reports, Events, Appeals and Applications
 * tabs to the Redux adminModeration slice.
 */
export default function useAdminModeration(showToast) {
  const dispatch = useAppDispatch();
  const reports = useAppSelector(selectReports);
  const events = useAppSelector(selectEvents);
  const appeals = useAppSelector(selectAppeals);
  const organizerApps = useAppSelector(selectOrganizerApps);
  const moderatorApps = useAppSelector(selectModeratorApps);

  // Initial load once on mount
  useEffect(() => {
    dispatch(fetchReports());
    dispatch(fetchAppeals());
    dispatch(fetchEvents());
    dispatch(fetchApplications());
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(resetAdminModeration());
    };
  }, [dispatch]);

  const handleModerationAction = async (item, actionType, note) => {
    if (actionType === 'dismiss' && !(note || '').trim()) {
      showToast('⚠️ Resolution note is required to dismiss a report');
      return;
    }
    try {
      await dispatch(resolveEscalatedReport({ report: item, actionType, note })).unwrap();
      showToast(ACTION_TOASTS[actionType]);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  const handleAppeal = async (appealId, status) => {
    try {
      await dispatch(reviewAppeal({ appealId, status })).unwrap();
      showToast(`✓ Appeal ${status}`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  // Shared by both application queues: approve maps to the backend's own status word
  const reviewApplication = async (thunk, id, status) => {
    const rejectionReason = status === 'rejected'
      ? window.prompt('Reason for rejecting this application (5–500 characters):')
      : undefined;
    if (status === 'rejected' && !rejectionReason) return;
    try {
      await dispatch(thunk({ id, status, rejectionReason })).unwrap();
      showToast(`Application ${status}`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  const handleOrganizerApp = (id, newStatus) =>
    reviewApplication(reviewOrganizerApp, id, newStatus === 'approved' ? 'verified' : 'rejected');

  const handleModeratorApp = (id, newStatus) =>
    reviewApplication(reviewModeratorApp, id, newStatus === 'approved' ? 'certified' : 'rejected');

  return {
    reports,
    events,
    appeals,
    organizerApps,
    moderatorApps,
    handleModerationAction,
    handleAppeal,
    handleOrganizerApp,
    handleModeratorApp,
  };
}
