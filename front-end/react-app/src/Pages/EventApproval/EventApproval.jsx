// Page container component for the Event Approval Dashboard.
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import SideBar from '../../Components/SideBar';
import '../../styles/global.css';
import '../../styles/sidebar.css';
import '../../styles/event-approval.css';

import { useToast } from '../../Components/event-management/hooks/useToast';
import { getCommunityName } from '../../Components/event-management/utils/getCommunityName';
import { EVENT_STATUSES } from '../../Components/event-management/utils/constants';
import {
  fetchEvents,
  updateEventStatus,
  openApprovalModal,
  closeApprovalModal,
  selectEventsLoading,
  selectApprovalModalState,
} from '../../store/slices/eventsSlice';
import { selectEventsByStatus } from '../../store/selectors/eventSelectors';
import { fetchCommunityList, selectAllCommunities } from '../../store/slices/communitiesSlice';

import SummaryBar from './SummaryBar';
import ApprovalList from './ApprovalList';
import EventDetailModal from './EventDetailModal';

export default function EventApproval() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectEventsLoading);
  const { pending: pendingList, approved: approvedList, rejected: rejectedList } = useAppSelector(selectEventsByStatus);
  const communities = useAppSelector(selectAllCommunities);
  const approvalModal = useAppSelector(selectApprovalModalState);

  const { showToast } = useToast();

  useEffect(() => {
    dispatch(fetchEvents());
    dispatch(fetchCommunityList());
  }, [dispatch]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(closeApprovalModal());
    };
  }, [dispatch]);

  const changeStatus = async (id, status, onlineMsg) => {
    try {
      await dispatch(updateEventStatus({ id, status })).unwrap();
      showToast(onlineMsg);
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Status update failed'}`);
    }
  };

  const handleApprove = (id) => changeStatus(
    id, EVENT_STATUSES.APPROVED, '✅ Event approved — all users will now see it.'
  );

  const handleReject = (id) => changeStatus(
    id, EVENT_STATUSES.REJECTED, '❌ Event rejected.'
  );

  const openDetails = (ev) => {
    dispatch(openApprovalModal({ event: ev, action: 'view' }));
  };

  return (
    <div className="app-shell">
      <SideBar />

      <main className="approval-main">
        <header className="approval-header">
          <div>
            <p className="approval-kicker">Community Operations</p>
            <h1>Event Requests</h1>
          </div>
          <button className="approval-secondary-btn" onClick={() => navigate('/events')}>
            View Events
          </button>
        </header>

        <SummaryBar
          pendingCount={pendingList.length}
          approvedCount={approvedList.length}
          rejectedCount={rejectedList.length}
        />

        <ApprovalList
          title="Pending Events"
          description="Approve requests to make them visible on the events page."
          events={pendingList}
          loading={loading}
          emptyMessage="No pending event requests."
          communityNameFn={(id) => getCommunityName(id, communities)}
          onViewDetails={openDetails}
          onApprove={handleApprove}
          onReject={handleReject}
        />

        <ApprovalList
          title="Approved Events"
          description="Live events currently visible to members."
          events={approvedList}
          loading={loading}
          emptyMessage="No events in this list."
          communityNameFn={(id) => getCommunityName(id, communities)}
          onViewDetails={openDetails}
        />

        <ApprovalList
          title="Rejected Events"
          description="Requests that were declined by the management team."
          events={rejectedList}
          loading={loading}
          emptyMessage="No rejected events."
          communityNameFn={(id) => getCommunityName(id, communities)}
          onViewDetails={openDetails}
        />
      </main>

      <EventDetailModal
        event={approvalModal.event}
        isOpen={approvalModal.open && !!approvalModal.event}
        onClose={() => dispatch(closeApprovalModal())}
        communityName={approvalModal.event ? getCommunityName(approvalModal.event.communityId, communities) : ''}
      />
    </div>
  );
}
