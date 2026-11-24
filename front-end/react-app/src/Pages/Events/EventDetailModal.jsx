// Detailed inspection modal dialog for a selected event.
import React from 'react';

export default function EventDetailModal({
  event,
  isOpen,
  onClose,
  isRegistered = false,
  isRegisterPending = false,
  isLeavePending = false,
  onRegister,
  onCancel,
  formatDate,
}) {
  if (!isOpen || !event) return null;

  const formattedDate = formatDate ? formatDate(event.date) : event.date;
  const attendees = event.attendees ?? event.registered ?? 0;
  const capacity = event.maxAttendees || event.capacity || '∞';
  const isFull = Boolean(event.maxAttendees && attendees >= event.maxAttendees);

  return (
    <div
      id="eventModal"
      className="event-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="event-modal-content">
        <button
          className="event-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="modal-status" id="modalStatus">
          <span className="ev-badge badge-live">
            ● {event.status || 'Approved'}
          </span>
        </div>
        <h2 id="modalTitle">{event.title}</h2>
        <p id="modalDesc">{event.description}</p>
        <div className="modal-detail-grid">
          <p id="modalDate">
            🗓 {formattedDate} at {event.time || '—'}
          </p>
          <p id="modalCommunity">🏘️ {event.community || 'Community'}</p>
          <p id="modalCapacity">
            👥 {attendees}/{capacity} registered
          </p>
          <p id="modalCategory">🏆 {event.type || event.category || 'Event'}</p>
        </div>

        <div className="modal-actions-bar" style={{ marginTop: '20px' }}>
          {!isRegistered ? (
            onRegister && (
              <button
                className="btn-publish"
                style={{ width: '100%' }}
                onClick={() => {
                  onClose();
                  onRegister(event);
                }}
                disabled={isFull || isRegisterPending}
              >
                {isRegisterPending ? 'Registering...' : isFull ? 'Event Full' : 'Register Now'}
              </button>
            )
          ) : (
            <div
              className="modal-registered-group"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                width: '100%',
              }}
            >
              <span
                className="badge-registered"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ✓ Registered
              </span>
              {onCancel && (
                <button
                  type="button"
                  className="btn-leave-event"
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px',
                    borderRadius: '10px',
                  }}
                  onClick={async () => {
                    await onCancel(event);
                  }}
                  disabled={isLeavePending}
                >
                  {isLeavePending ? 'Leaving...' : 'Leave Event'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
