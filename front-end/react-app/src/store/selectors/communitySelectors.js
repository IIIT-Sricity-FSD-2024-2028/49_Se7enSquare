import { createSelector } from '@reduxjs/toolkit';
import {
  selectAllCommunities,
  selectCommunityList,
  selectJoinedIds,
  selectDiscoveryFilter,
} from '../slices/communitiesSlice';

/**
 * Memoized Reselect selectors for Component 2 — Community Management (Karmanya).
 *
 * Motivation: the original implementation computed filtering, sorting, and aggregated
 * stats inside useDiscovery with useMemo, coupling business logic to React rendering.
 * Moving it here means:
 *   - Any component can subscribe to exactly the data it needs.
 *   - Reselect guarantees the derived array is only rebuilt when its inputs change,
 *     preventing unnecessary re-renders across all consumers.
 *   - Other team members' pages (Dashboard, Events) can import these selectors
 *     without duplicating filter logic.
 */

// ─── Helpers (mirror discoveryData.js) ───────────────────────────────────────

const memberCountOf = (c) => c?.memberCount ?? c?.members ?? 0;
const onlineCountOf  = (c) => c?.onlineCount ?? c?.online  ?? 0;

// ─── Filtered & Sorted Community List ────────────────────────────────────────

/**
 * selectFilteredCommunities
 *
 * Returns the public (non-suspended) community list filtered by the user's
 * current search query, active category and sort preference — all sourced
 * from discoveryFilter in the Redux store.
 *
 * Re-computes only when `all`, or any filter value changes.
 */
export const selectFilteredCommunities = createSelector(
  [selectCommunityList, selectDiscoveryFilter],
  (communities, { search, category, sortBy }) => {
    const q   = (search || '').toLowerCase().trim();
    const cat = (category || 'All').toLowerCase();

    const filtered = communities.filter((c) => {
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q);
      const matchCat =
        category === 'All' ||
        (c.category || '').toLowerCase() === cat ||
        (c.tags || []).some((t) => String(t).toLowerCase() === cat);
      return matchSearch && matchCat;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'members')  return memberCountOf(b) - memberCountOf(a);
      if (sortBy === 'trending') {
        return (
          onlineCountOf(b) / Math.max(memberCountOf(b), 1) -
          onlineCountOf(a) / Math.max(memberCountOf(a), 1)
        );
      }
      if (sortBy === 'newest') {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (tb - ta) || (Number(b.id) - Number(a.id));
      }
      return onlineCountOf(b) - onlineCountOf(a); // 'active' (default)
    });
  }
);

// ─── Platform-wide Aggregated Stats ──────────────────────────────────────────

/**
 * selectDiscoveryStats
 *
 * Computes aggregated totals for the Discovery hero banner stats bar.
 * Re-computes only when `all` changes (independent of filters).
 */
export const selectDiscoveryStats = createSelector(
  [selectCommunityList],
  (communities) => ({
    totalCommunities: communities.length,
    totalMembers:     communities.reduce((s, c) => s + memberCountOf(c), 0),
    totalOnline:      communities.reduce((s, c) => s + onlineCountOf(c), 0),
  })
);

// ─── Dynamic Category List ────────────────────────────────────────────────────

/**
 * selectDiscoveryCategories
 *
 * Derives the unique sorted category pill list from the live community data.
 * Always starts with 'All'.
 */
export const selectDiscoveryCategories = createSelector(
  [selectCommunityList],
  (communities) => {
    const seen = new Set();
    communities.forEach((c) => { if (c.category) seen.add(c.category); });
    return ['All', ...Array.from(seen).sort()];
  }
);

// ─── Per-Community Membership Lookup ─────────────────────────────────────────

/**
 * selectIsCommunityJoined(communityId)
 *
 * Factory selector — returns a memoized boolean for whether the logged-in
 * user has joined a specific community. Each call with a different id creates
 * its own independent memoization slot.
 *
 * Usage:
 *   const isJoined = useSelector(selectIsCommunityJoined(communityId));
 */
export const selectIsCommunityJoined = (communityId) =>
  createSelector(
    [selectJoinedIds],
    (ids) => ids.includes(String(communityId))
  );

// ─── Community Lookup by ID ───────────────────────────────────────────────────

/**
 * selectCommunityById(id)
 *
 * Returns a single community by ID from the full list (including suspended),
 * useful for event pages and admin panels that need community names by ID.
 *
 * Usage:
 *   const community = useSelector(selectCommunityById(eventCommunityId));
 */
export const selectCommunityById = (id) =>
  createSelector(
    [selectAllCommunities],
    (all) => all.find((c) => String(c.id) === String(id)) ?? null
  );

// ─── Owned Communities Count ──────────────────────────────────────────────────

/**
 * selectOwnedCommunitiesCount
 *
 * Derives the number of communities owned by the current user.
 * Useful for the Owner Dashboard header badge.
 */
export const selectOwnedCommunitiesCount = createSelector(
  [selectAllCommunities, (state) => state.auth.user?.id],
  (all, userId) =>
    userId == null ? 0 : all.filter((c) => String(c.ownerId) === String(userId)).length
);
