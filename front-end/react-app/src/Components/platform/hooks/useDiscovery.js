import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toastShown } from '../../../store/slices/uiSlice';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  fetchCommunityList,
  fetchMyMemberships,
  joinCommunity,
  leaveCommunity,
  searchChanged,
  categoryChanged,
  sortByChanged,
  filterReset,
  selectCommunityList,
  selectCommunityListLoading,
  selectCommunityListError,
  selectJoinedIds,
  selectDiscoveryFilter,
} from '../../../store/slices/communitiesSlice';
import {
  selectFilteredCommunities,
  selectDiscoveryStats,
  selectDiscoveryCategories,
} from '../../../store/selectors/communitySelectors';
import { fetchEvents, selectEvents, selectEventsLoaded } from '../../../store/slices/eventsSlice';

/**
 * Manages community listings, search/category filters, sorting, and
 * join/leave toggling for the Discovery page.
 *
 * Improvement (Karmanya): filtering, sorting and stat aggregation are now
 * handled by memoized Reselect selectors in communitySelectors.js rather
 * than inline useMemo calls, so the computed values are shared and cached
 * across all components that subscribe to them.
 *
 * search, category and sortBy live in Redux (discoveryFilter) so the user's
 * chosen filters survive navigating into a community and returning to /discovery.
 */
export default function useDiscovery() {
  const dispatch = useDispatch();
  const user       = useSelector(selectCurrentUser);
  const communities = useSelector(selectCommunityList);
  const loading    = useSelector(selectCommunityListLoading);
  const loadWarning = useSelector(selectCommunityListError);
  const joinedIds  = useSelector(selectJoinedIds);

  // Persistent filter state lives in Redux
  const { search, category: activeCategory, sortBy } = useSelector(selectDiscoveryFilter);
  const setSearch       = (val) => dispatch(searchChanged(val));
  const setActiveCategory = (val) => dispatch(categoryChanged(val));
  const setSortBy       = (val) => dispatch(sortByChanged(val));

  // Purely transient: whether the sort dropdown is open (doesn't need to survive navigation)
  const [showSort, setShowSort] = useState(false);

  // Memoized derived state from Reselect selectors
  const filtered   = useSelector(selectFilteredCommunities);
  const { totalMembers, totalOnline } = useSelector(selectDiscoveryStats);
  const categories = useSelector(selectDiscoveryCategories);

  // Event count for the stats bar
  const events      = useSelector(selectEvents);
  const eventsLoaded = useSelector(selectEventsLoaded);
  const eventCount  = eventsLoaded ? events.length : null;

  const showToast = (msg) => dispatch(toastShown({ msg }));

  useEffect(() => {
    dispatch(fetchCommunityList());
    dispatch(fetchMyMemberships());
    dispatch(fetchEvents());

    // Clean up filter state when unmounting / navigating away
    return () => {
      dispatch(filterReset());
    };
  }, [dispatch]);

  const joinedSet = new Set(joinedIds);
  const [pendingIds, setPendingIds] = useState(new Set());

  const handleJoin = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!user || user.id === undefined || user.id === null) {
      showToast('⚠️ Please log in to join communities.');
      return;
    }
    const idStr = String(id);
    if (pendingIds.has(idStr)) return;

    setPendingIds((prev) => new Set(prev).add(idStr));
    try {
      await dispatch(joinCommunity(idStr)).unwrap();
      const comm = communities.find((c) => String(c.id) === idStr);
      showToast(comm ? `Welcome to ${comm.name}! ⚡` : 'Joined community.');
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    }
  };

  const handleLeave = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!user || user.id === undefined || user.id === null) {
      showToast('⚠️ Please log in to manage community membership.');
      return;
    }
    const idStr = String(id);
    if (pendingIds.has(idStr)) return;

    setPendingIds((prev) => new Set(prev).add(idStr));
    try {
      await dispatch(leaveCommunity(idStr)).unwrap();
      showToast('Left community.');
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    }
  };

  const toggleJoin = (id, e) => {
    const idStr = String(id);
    if (joinedSet.has(idStr)) {
      return handleLeave(id, e);
    } else {
      return handleJoin(id, e);
    }
  };

  return {
    communities, loading, loadWarning,
    search, setSearch,
    activeCategory, setActiveCategory,
    sortBy, setSortBy,
    showSort, setShowSort,
    joinedIds: joinedSet,
    pendingIds,
    onJoin: handleJoin,
    onLeave: handleLeave,
    toggleJoin,
    categories, filtered,
    totalMembers, totalOnline, eventCount,
  };
}
