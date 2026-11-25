import React, { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectCurrentUser } from '../store/slices/authSlice';
import { selectAdminStats } from '../store/selectors/adminSelectors';
import {
  adminUiActivePageChanged,
  adminUiGlobalSearchChanged,
  selectAdminUi,
} from '../store/slices/ownerDashboardSlice';
import AppShell from '../Components/platform/layout/AppShell';
import useToast from '../Components/platform/hooks/useToast';
import useAdminUsers from './AdminDashboard/hooks/useAdminUsers';
import useAdminCommunities from './AdminDashboard/hooks/useAdminCommunities';
import useAdminModeration from './AdminDashboard/hooks/useAdminModeration';
import useAuditLog from './AdminDashboard/hooks/useAuditLog';
import { PAGES } from '../Components/platform/data/adminData';
import AdminHeader from './AdminDashboard/components/AdminHeader';
import AdminNav from './AdminDashboard/components/AdminNav';
import OverviewTab from './AdminDashboard/components/OverviewTab';
import UsersTab from './AdminDashboard/components/UsersTab';
import CommunitiesTab from './AdminDashboard/components/CommunitiesTab';
import EscalatedReportsTab from './AdminDashboard/components/EscalatedReportsTab';
import EventsTab from './AdminDashboard/components/EventsTab';
import AppealsTab from './AdminDashboard/components/AppealsTab';
import ApplicationsTab from './AdminDashboard/components/ApplicationsTab';
import AuditLogTab from './AdminDashboard/components/AuditLogTab';
import '../styles/global.css';
import '../styles/sidebar.css';
import '../styles/admin-dashboard.css';

function toAdminUser(raw) {
  const u = raw || {};
  return {
    id: u.id,
    role: u.role || 'admin',
    firstName: u.firstName || u.name?.split(' ')[0] || 'Admin',
    username: u.username || 'admin',
  };
}

/**
 * Admin Dashboard Page Component
 * Orchestrates sub-hooks and subcomponents for platform administration.
 * All state is managed through Redux Toolkit with zero component useState.
 */
export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const adminUser = toAdminUser(useAppSelector(selectCurrentUser));
  const [searchParams, setSearchParams] = useSearchParams();

  const { activePage, globalSearch } = useAppSelector(selectAdminUi);

  const setActivePage = useCallback(
    (page) => {
      dispatch(adminUiActivePageChanged(page));
    },
    [dispatch]
  );

  const setGlobalSearch = useCallback(
    (q) => {
      dispatch(adminUiGlobalSearchChanged(q));
    },
    [dispatch]
  );

  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'overview';
    if (currentTab !== activePage) {
      setActivePage(currentTab);
    }
  }, [searchParams, activePage, setActivePage]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(adminUiActivePageChanged('overview'));
      dispatch(adminUiGlobalSearchChanged(''));
    };
  }, [dispatch]);

  const handleSelectPage = useCallback((pageId) => {
    setActivePage(pageId);
    setSearchParams({ tab: pageId });
  }, [setActivePage, setSearchParams]);

  const { showToast } = useToast();
  const notify = useCallback((msg) => showToast('ℹ️', msg), [showToast]);

  const { auditLog } = useAuditLog();

  const {
    users,
    filteredUsers,
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    editingUser,
    setEditingUser,
    updateUserRole,
    suspendUser,
    banUser,
    reinstateUser,
  } = useAdminUsers(notify);

  const { communities, suspendCommunity, reinstateCommunity } = useAdminCommunities(notify);

  const {
    reports,
    events,
    appeals,
    organizerApps,
    moderatorApps,
    handleModerationAction,
    handleAppeal,
    handleOrganizerApp,
    handleModeratorApp,
  } = useAdminModeration(notify);

  const counts = useAppSelector(selectAdminStats);
  const currentPage = PAGES.find((page) => page.id === activePage) || PAGES[0];

  return (
    <AppShell activePage={activePage} onSelectPage={handleSelectPage}>
      <div className="main">
        <AdminHeader
          currentPage={currentPage}
          adminUser={adminUser}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
        />

        <AdminNav
          pages={PAGES}
          activePage={activePage}
          counts={counts}
          onSelectPage={handleSelectPage}
        />

        {activePage === 'overview' && (
          <OverviewTab
            stats={counts}
            auditLog={auditLog}
            onNavigate={handleSelectPage}
          />
        )}

        {activePage === 'users' && (
          <UsersTab
            filteredUsers={filteredUsers}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            userRoleFilter={userRoleFilter}
            setUserRoleFilter={setUserRoleFilter}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            updateUserRole={updateUserRole}
            suspendUser={suspendUser}
            banUser={banUser}
            reinstateUser={reinstateUser}
            adminUser={adminUser}
          />
        )}

        {activePage === 'communities' && (
          <CommunitiesTab
            communities={communities}
            users={users}
            suspendCommunity={suspendCommunity}
            reinstateCommunity={reinstateCommunity}
          />
        )}

        {activePage === 'escalated-reports' && (
          <EscalatedReportsTab
            reports={reports}
            users={users}
            communities={communities}
            onAction={handleModerationAction}
          />
        )}

        {activePage === 'events-mgmt' && (
          <EventsTab events={events} />
        )}

        {activePage === 'appeals' && (
          <AppealsTab appeals={appeals} onAppeal={handleAppeal} />
        )}

        {activePage === 'applications' && (
          <ApplicationsTab
            organizerApps={organizerApps}
            moderatorApps={moderatorApps}
            onOrganizerApp={handleOrganizerApp}
            onModeratorApp={handleModeratorApp}
          />
        )}

        {activePage === 'audit' && <AuditLogTab auditLog={auditLog} />}
      </div>
    </AppShell>
  );
}
