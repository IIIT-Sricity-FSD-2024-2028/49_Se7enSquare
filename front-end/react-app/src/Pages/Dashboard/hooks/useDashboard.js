import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  fetchCommunityList,
  fetchMyMemberships,
  selectAllCommunities,
  selectJoinedCommunities,
  selectOwnedCommunities,
  selectCommunityListLoading,
  selectCommunityListError,
} from '../../../store/slices/communitiesSlice';
import { fetchEvents, selectApprovedEvents } from '../../../store/slices/eventsSlice';
import {
  clearNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  selectRecentNotifications,
} from '../../../store/slices/notificationsSlice';

import { dashboardSearchChanged, resetDashboardSearch } from '../../../store/slices/uiSlice';
import { selectDashboardSearch, selectDashboardSearchResults, selectUnreadNotifications } from '../../../store/selectors/authDashboardSelectors';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Connects the Dashboard to Redux. Communities and events come from the shared
 * communities and events slices (also used by Discovery and Events), notifications
 * from the notifications slice. Only the search box is page-only state.
 */
export default function useDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector(selectCurrentUser);
  const user = useMemo(() => ({
    id: sessionUser?.id,
    firstName: sessionUser?.firstName || sessionUser?.username || 'User',
    lastName: sessionUser?.lastName || '',
    username: sessionUser?.username || '',
    role: sessionUser?.role || 'user',
  }), [sessionUser]);

  const allCommunities = useAppSelector(selectAllCommunities);
  const communities = useAppSelector(selectJoinedCommunities).slice(0, 8);
  const createdCommunities = useAppSelector(selectOwnedCommunities).slice(0, 8);
  const loading = useAppSelector(selectCommunityListLoading);
  const communityError = useAppSelector(selectCommunityListError);
  const approvedEvents = useAppSelector(selectApprovedEvents);
  const notifications = useAppSelector(selectRecentNotifications);
  const unreadCount = useAppSelector(selectUnreadNotifications).length;
  const { searchQuery, showSearch } = useAppSelector(selectDashboardSearch);
  const searchResults = useAppSelector(selectDashboardSearchResults);
  const setShowSearch = (value) => dispatch(dashboardSearchChanged({ showSearch: value }));

  useEffect(() => () => {
    dispatch(resetDashboardSearch());
    dispatch(clearNotifications());
  }, [dispatch]);

  const fetchData = useCallback(() => {
    if (sessionUser?.id === undefined || sessionUser?.id === null) {
      navigate('/login');
      return;
    }
    dispatch(fetchCommunityList());
    dispatch(fetchMyMemberships());
    dispatch(fetchEvents());
    dispatch(fetchNotifications());
  }, [dispatch, navigate, sessionUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only approved events are public; the next 4 shaped for the Upcoming Events list
  const events = useMemo(() => approvedEvents.slice(0, 4).map((e) => ({
    id: e.id,
    title: e.title,
    community: allCommunities.find((c) => String(c.id) === String(e.communityId))?.name || 'Community',
    date: e.date
      ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'TBD',
    time: e.time || '',
    type: '📅',
  })), [approvedEvents, allCommunities]);

  const handleSearch = (value) => {
    dispatch(dashboardSearchChanged({ searchQuery: value, showSearch: Boolean(value.trim()) }));
  };

  const markAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  return {
    navigate,
    user,
    greeting: getGreeting(),
    communities,
    createdCommunities,
    notifications,
    events,
    unreadCount,
    searchQuery,
    searchResults,
    showSearch,
    setShowSearch,
    handleSearch,
    markAllRead,
    loading,
    communityError,
    refresh: fetchData,
  };
}
