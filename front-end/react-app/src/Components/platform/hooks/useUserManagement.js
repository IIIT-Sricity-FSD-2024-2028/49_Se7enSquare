import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectUserDirectoryCounts } from '../../../store/selectors/userSelectors';
import {
  fetchUsers, selectAdminUsers, selectFilteredUsers, selectUserSearch, selectUserRoleFilter,
  userSearchChanged, userRoleFilterChanged, resetUserFilters,
} from '../../../store/slices/adminUsersSlice';

/**
 * Manages the User Management page. The user list is the same adminUsers slice
 * the Admin Dashboard's Users tab uses; search and role filter are page-only state.
 */
export default function useUserManagement() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectAdminUsers);

  const loading = useAppSelector((state) => state.adminUsers.loading);
  const search = useAppSelector(selectUserSearch);
  const roleFilter = useAppSelector(selectUserRoleFilter);
  const filteredUsers = useAppSelector(selectFilteredUsers);
  const roleCounts = useAppSelector(selectUserDirectoryCounts);
  const setSearch = (value) => dispatch(userSearchChanged(value));
  const setRoleFilter = (value) => dispatch(userRoleFilterChanged(value));

  useEffect(() => {
    dispatch(fetchUsers());
    return () => dispatch(resetUserFilters());
  }, [dispatch]);

  return {
    navigate,
    users, loading,
    filteredUsers,
    search, setSearch,
    roleFilter, setRoleFilter,
    roleCounts,
  };
}
