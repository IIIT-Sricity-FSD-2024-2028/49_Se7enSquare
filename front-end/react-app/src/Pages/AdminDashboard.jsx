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
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    changeUserRole,
    suspendUser,
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

  return (
    <AppShell activePage={activePage} onSelectPage={handleSelectPage}>
      <div className="main">
        <AdminHeader
          adminUser={adminUser}
          globalSearch={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
        />

        <AdminNav
          pages={PAGES}
          activePage={activePage}
          counts={counts}
          onSelectPage={handleSelectPage}
        />

        {activePage === 'overview' && (
          <OverviewTab
            counts={counts}
            reports={reports}
            appeals={appeals}
            events={events}
            communities={communities}
            users={users}
            onSelectPage={handleSelectPage}
          />
        )}

        {activePage === 'users' && (
          <UsersTab
            users={users}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            userRoleFilter={userRoleFilter}
            setUserRoleFilter={setUserRoleFilter}
            onChangeRole={changeUserRole}
            onSuspendUser={suspendUser}
            onReinstateUser={reinstateUser}
          />
        )}

        {activePage === 'communities' && (
          <CommunitiesTab
            communities={communities}
            onSuspend={suspendCommunity}
            onReinstate={reinstateCommunity}
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

        {activePage === 'events' && (
          <EventsTab events={events} communities={communities} showToast={notify} />
        )}

        {activePage === 'appeals' && (
          <AppealsTab appeals={appeals} onResolve={handleAppeal} />
        )}

        {activePage === 'applications' && (
          <ApplicationsTab
            organizerApps={organizerApps}
            moderatorApps={moderatorApps}
            onOrganizerAction={handleOrganizerApp}
            onModeratorAction={handleModeratorApp}
          />
        )}

        {activePage === 'audit-log' && <AuditLogTab auditLog={auditLog} />}
      </div>
    </AppShell>
  );
}
