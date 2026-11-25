import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  fetchOwnerOverview,
  openDrill as openDrillThunk,
  drillClosed,
  resetOwnerDashboardState,
  selectOwnerStats,
  selectOwnerRevenue,
  selectDrill,
} from '../../../store/slices/ownerDashboardSlice';
import { selectOwnerKpiSummary } from '../../../store/selectors/adminSelectors';

/**
 * Connects OwnerDashboard to the Redux ownerDashboard slice.
 * Uses memoized selectors and provides automatic unmount cleanup.
 */
export default function useOwnerDashboard() {
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector(selectCurrentUser);
  const currentUser = {
    id: sessionUser?.id,
    username: sessionUser?.username || 'owner',
    firstName: sessionUser?.firstName || 'Owner',
    lastName: sessionUser?.lastName || '',
    role: sessionUser?.role || 'owner',
  };

  const stats = useAppSelector(selectOwnerStats);
  const revenue = useAppSelector(selectOwnerRevenue);
  const drill = useAppSelector(selectDrill);
  const kpiSummary = useAppSelector(selectOwnerKpiSummary);

  useEffect(() => {
    dispatch(fetchOwnerOverview());
  }, [dispatch]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(resetOwnerDashboardState());
    };
  }, [dispatch]);

  const openDrill = (kind, filter) => dispatch(openDrillThunk({ kind, filter }));

  const setDrillModalOpen = (open) => {
    if (!open) dispatch(drillClosed());
  };

  return {
    currentUser,
    stats,
    revenue,
    kpiSummary,
    drillModalOpen: drill.open,
    setDrillModalOpen,
    drillTitle: drill.title,
    drillLoading: drill.loading,
    drillContent: drill.content,
    openDrill,
  };
}
