import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchAuditLog, resetAuditLogState } from '../../../store/slices/auditLogSlice';
import { selectFilteredAuditLogs } from '../../../store/selectors/adminSelectors';

/**
 * Custom hook reading the administrative audit log from the Redux auditLog slice.
 * Uses memoized Reselect selector and provides automatic unmount cleanup.
 */
export default function useAuditLog() {
  const dispatch = useAppDispatch();
  const auditLog = useAppSelector(selectFilteredAuditLogs);

  const refreshAuditLog = useCallback(() => dispatch(fetchAuditLog()), [dispatch]);

  // Initial load once on mount
  useEffect(() => {
    refreshAuditLog();
  }, [refreshAuditLog]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(resetAuditLogState());
    };
  }, [dispatch]);

  return {
    auditLog,
    refreshAuditLog,
  };
}
