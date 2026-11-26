// Page container component for Events & Tournaments module.
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import SideBar from '../../Components/SideBar';
import '../../styles/global.css';
import '../../styles/events.css';

import { useEvents } from '../../Components/event-management/hooks/useEvents';
import { useRegistrations } from '../../Components/event-management/hooks/useRegistrations';
import { useToast } from '../../Components/event-management/hooks/useToast';
import { CATEGORIES } from '../../Components/event-management/utils/constants';
import { getCommunityObject } from '../../Components/event-management/utils/getCommunityName';
import { selectCurrentUser } from '../../store/slices/authSlice';
import { fetchCommunityList, selectAllCommunities } from '../../store/slices/communitiesSlice';
import {
  openModal,
  closeModal,
  clearCurrentEvent,
  selectEventModalState,
  selectCurrentEvent,
} from '../../store/slices/eventsSlice';
import { selectFeaturedEvent } from '../../store/selectors/eventSelectors';

import PageHeader from '../../Components/event-management/common/PageHeader';
import CategoryFilterChips from './CategoryFilterChips';
import FeaturedEventBanner from './FeaturedEventBanner';
import EventsGrid from './EventsGrid';
import EventDetailModal from './EventDetailModal';
import RegistrationModal from './RegistrationModal';

export default function Events() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const communities = useAppSelector(selectAllCommunities);
  const modalState = useAppSelector(selectEventModalState);
  const currentEvent = useAppSelector(selectCurrentEvent);
  const featuredEvent = useAppSelector(selectFeaturedEvent);

  const isDetailOpen = modalState.isOpen && modalState.mode === 'view';
  const isRegisterOpen = modalState.isOpen && modalState.mode === 'register';

  const { showToast } = useToast();
  const {
    loading: eventsLoading,
    error: eventsError,
    loadEvents,
    selectedCategory,
    setSelectedCategory,
    upcomingEvents,
    deleteEvent,
  } = useEvents();

  useEffect(() => {
    dispatch(fetchCommunityList());
  }, [dispatch]);

  // Unmount cleanup: close modals and clear selected event
  useEffect(() => {
    return () => {
      dispatch(closeModal());
      dispatch(clearCurrentEvent());
    };
  }, [dispatch]);

  const { isRegistered, registerForEvent, cancelRegistration } = useRegistrations();

  const handleOpenRegisterModal = (ev) => {
    if (!user || !user.id) {
      showToast('Please log in to register');
      return;
    }
    dispatch(openModal({ mode: 'register', event: ev }));
  };

  const handleOpenDetailModal = (ev) => {
    dispatch(openModal({ mode: 'view', event: ev }));
  };

  const handleConfirmRegistration = async (ev, regData) => {
    if (!user || !user.id) {
      showToast('Please log in to register');
      return;
    }
    const res = await registerForEvent(ev, regData);
    if (res.success) {
      showToast('Registered successfully!');
      dispatch(closeModal());
    } else {
      showToast(res.error || 'Could not register. Please try again.');
    }
  };

  const handleCancel = async (regOrEv) => {
    if (!window.confirm(`Cancel registration for "${regOrEv.title || regOrEv.eventTitle || 'this event'}"?`)) return;
    try {
      const result = await cancelRegistration(regOrEv);
      if (!result.success) throw new Error(result.error);
      showToast('Registration cancelled.');
    } catch (err) {
      showToast(`⚠️ ${err?.message || 'Could not cancel registration.'}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteEvent(id);
      showToast('Event deleted.');
    } catch (err) {
      showToast(`⚠️ ${err?.message || 'Could not delete event.'}`);
    }
  };

  return (
    <div className="app-shell">
      <SideBar />
      <div className="main">
        <PageHeader title="Events & Tournaments" />

        <div className="content active" id="tab-upcoming">
          <CategoryFilterChips
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {featuredEvent && (
            <FeaturedEventBanner
              event={featuredEvent}
              comm={getCommunityObject(featuredEvent.communityId, communities)}
              isRegistered={isRegistered(featuredEvent.id)}
              onView={handleOpenDetailModal}
              onRegister={handleOpenRegisterModal}
            />
          )}

          <div className="section-header">
            <div>
              <div className="section-title">All Upcoming Events</div>
              <div className="section-sub">{upcomingEvents.length} events across your communities</div>
            </div>
          </div>

          {eventsError && <div role="alert">
            <p>{eventsError}</p>
            <button type="button" onClick={() => loadEvents()} disabled={eventsLoading}>Retry events</button>
          </div>}
          <EventsGrid
            events={upcomingEvents}
            loading={eventsLoading}
            getCommunity={(id) => getCommunityObject(id, communities)}
            isRegistered={isRegistered}
            onView={handleOpenDetailModal}
            onRegister={handleOpenRegisterModal}
            onCancel={handleCancel}
            canDelete={user?.role === 'admin'}
            onDelete={handleDelete}
          />
        </div>

        <EventDetailModal
          event={currentEvent}
          isOpen={isDetailOpen && !!currentEvent}
          onClose={() => dispatch(closeModal())}
          isRegistered={currentEvent ? isRegistered(currentEvent.id) : false}
          onRegister={handleOpenRegisterModal}
        />

        <RegistrationModal
          event={currentEvent}
          isOpen={isRegisterOpen && !!currentEvent}
          onClose={() => dispatch(closeModal())}
          onSubmit={handleConfirmRegistration}
        />
      </div>
    </div>
  );
}
