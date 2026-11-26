// User registration modal dialog for signing up to an event.
import React, { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectRegistrationForm,
  setRegistrationFormField,
  resetRegistrationForm,
} from '../../store/slices/eventsSlice';

export default function RegistrationModal({
  event,
  isOpen,
  onClose,
  onSubmit,
}) {
  const dispatch = useAppDispatch();
  const submitting = useAppSelector(state => state.events.registrationSubmitting);
  const formData = useAppSelector(selectRegistrationForm);

  // Unmount cleanup: reset form on unmount or close
  useEffect(() => {
    return () => {
      dispatch(resetRegistrationForm());
    };
  }, [dispatch]);

  const handleChange = useCallback(
    (field, value) => {
      dispatch(setRegistrationFormField({ field, value }));
    },
    [dispatch]
  );

  if (!isOpen || !event) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.inGameId.trim()) {
      return;
    }
    if (onSubmit) {
      onSubmit(event, formData);
    }
  };

  const handleClose = () => {
    dispatch(resetRegistrationForm());
    if (onClose) onClose();
  };

  return (
    <div
      id="registerModal"
      className="event-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && handleClose) handleClose();
      }}
    >
      <div className="event-modal-content">
        <button
          className="event-modal-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2>
          Register for <span id="regModalEventTitle">{event.title}</span>
        </h2>
        <p
          style={{
            color: 'var(--text-3,#9ca3af)',
            fontSize: '13px',
            marginTop: '-8px',
          }}
        >
          We need a few details before confirming your spot.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full Name *</label>
            <input
              id="regFullName"
              type="text"
              placeholder="Your full name"
              required
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Email *</label>
            <input
              id="regEmail"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Phone Number</label>
            <input
              id="regPhone"
              type="tel"
              placeholder="e.g. 9876543210"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>

          <div className="field">
            <label>In-Game ID / Username *</label>
            <input
              id="regInGameId"
              type="text"
              placeholder="Your in-game handle"
              required
              value={formData.inGameId}
              onChange={(e) => handleChange('inGameId', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-draft"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="btn-publish"
            >
              Confirm Registration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
