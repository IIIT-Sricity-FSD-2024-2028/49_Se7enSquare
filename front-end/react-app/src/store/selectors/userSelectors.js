import { createSelector } from '@reduxjs/toolkit';
import { selectAdminUsers } from '../slices/adminUsersSlice';

export const selectUserDirectoryCounts = createSelector([selectAdminUsers], (users) => ({
  total: users.length,
  admin: users.filter(({ role }) => role === 'admin').length,
  moderator: users.filter(({ role }) => role === 'moderator').length,
  user: users.filter(({ role }) => role === 'user').length,
}));
