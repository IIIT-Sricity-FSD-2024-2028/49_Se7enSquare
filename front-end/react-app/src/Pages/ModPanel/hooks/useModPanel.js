import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toastShown } from '../../../store/slices/uiSlice';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  fetchModReports,
  takeModAction,
  escalateReport as escalateReportThunk,
  moveToReview as moveToReviewThunk,
  selectModReports,
  selectModReportsLoading,
  selectModProcessing,
  resetModPanelState,
  modPanelUiChanged,
  selectRecentModActions,
} from '../../../store/slices/modPanelSlice';
import { selectFilteredModReports, selectSelectedModReport, selectModQueueCounts, selectModPanelUi } from '../../../store/selectors/modPanelSelectors';
import { QUEUE_TABS, MOD_ACTIONS } from '../../../Components/platform/data/modPanelData';

/**
 * Connects ModPanel to the Redux modPanel slice.
 * Reports and their statuses live in the store; the queue tab, search box,
 * selected report and note box are page-only UI state.
 */
export default function useModPanel() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector(selectCurrentUser);
  const user = {
    role: sessionUser?.role || 'moderator',
    firstName: sessionUser?.firstName || sessionUser?.username || 'Moderator',
    username: sessionUser?.username || 'moderator',
  };

  const reports = useAppSelector(selectModReports);
  const loading = useAppSelector(selectModReportsLoading);
  const processing = useAppSelector(selectModProcessing);
  const queueCounts = useAppSelector(selectModQueueCounts);
  const recentActions = useAppSelector(selectRecentModActions);

  const { activeQTab, queueSearch, actionNote } = useAppSelector(selectModPanelUi);
  const setActiveQTab = (value) => dispatch(modPanelUiChanged({ activeQTab: value }));
  const setQueueSearch = (value) => dispatch(modPanelUiChanged({ queueSearch: value }));
  const setActionNote = (value) => dispatch(modPanelUiChanged({ actionNote: value }));
  const setSelectedReport = (report) => dispatch(modPanelUiChanged({ selectedId: report?.id ?? null }));

  useEffect(() => () => dispatch(resetModPanelState()), [dispatch]);

  const showToast = (msg) => dispatch(toastShown({ msg }));

  useEffect(() => {
    dispatch(fetchModReports());
  }, [dispatch, user.role]);

  const selectedReport = useAppSelector(selectSelectedModReport);
  const filteredReports = useAppSelector(selectFilteredModReports);

  const takeAction = async (modAction, report) => {
    const result = await dispatch(takeModAction({ modAction, report, note: actionNote.trim() }));
    if (result.meta.condition) {
      // The thunk's condition skipped it: sanctions need a user report
      showToast('⚠️ Sanctions need a user report. Dismiss or escalate this one.');
    } else if (takeModAction.fulfilled.match(result)) {
      setActionNote('');
      showToast(`✅ Action taken: ${modAction.label}`);
    } else {
      showToast(`❌ ${result.payload?.message || result.error.message}`);
    }
  };

  // Escalated reports appear in the admin dashboard's "Escalated Reports" tab
  const escalateReport = async (report) => {
    try {
      await dispatch(escalateReportThunk({ report, note: actionNote.trim() })).unwrap();
      setActionNote('');
      showToast('⬆️ Escalated to admin');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  const moveToReview = async (reportId) => {
    try {
      await dispatch(moveToReviewThunk(reportId)).unwrap();
      showToast('📋 Moved to In Review');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  return {
    navigate,
    user,
    // Reports
    reports,
    loading,
    filteredReports,
    selectedReport,
    setSelectedReport,
    // Queue
    activeQTab,
    setActiveQTab,
    queueSearch,
    setQueueSearch,
    queueCounts,
    // Actions
    actionNote,
    setActionNote,
    takeAction,
    escalateReport,
    moveToReview,
    processing,
    // Derived
    recentActions,
    MOD_ACTIONS,
    QUEUE_TABS,
  };
}
