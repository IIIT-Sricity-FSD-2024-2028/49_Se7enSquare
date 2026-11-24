// User registration modal dialog for signing up to an event.
import React, { useState, useEffect } from 'react';

export default function RegistrationModal({
  event,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  currentUser = null,
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    inGameId: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && currentUser) {
      setFormData((prev) => ({
        fullName: prev.fullName || currentUser.name || currentUser.username || '',
        email: prev.email || currentUser.email || '',
        phone: prev.phone || '',
        inGameId: prev.inGameId || '',
      }));
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !event) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required.';
    if (!formData.email.trim()) newErrors.email = 'Email is required.';
    if (!formData.inGameId.trim()) newErrors.inGameId = 'In-game handle is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (onSubmit) {
      onSubmit(event, formData);
    }
  };

  return (
    <div
      id="registerModal"
      className="event-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose && !isSubmitting) onClose();
      }}
    >
      <div className="event-modal-content">
        <button
          className="event-modal-close"
          onClick={onClose}
          aria-label="Close"
          disabled={isSubmitting}
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
              value={formData.fullName}
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData((f) => ({ ...f, fullName: e.target.value }))
              }
            />
            {errors.fullName && <div className="error-msg">{errors.fullName}</div>}
          </div>

          <div className="field">
            <label>Email *</label>
            <input
              id="regEmail"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData((f) => ({ ...f, email: e.target.value }))
              }
            />
            {errors.email && <div className="error-msg">{errors.email}</div>}
          </div>

          <div className="field">
            <label>Phone Number</label>
            <input
              id="regPhone"
              type="tel"
              placeholder="e.g. 9876543210"
              value={formData.phone}
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label>In-Game ID / Username *</label>
            <input
              id="regInGameId"
              type="text"
              placeholder="Your in-game handle"
              value={formData.inGameId}
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData((f) => ({ ...f, inGameId: e.target.value }))
              }
            />
            {errors.inGameId && (
              <div className="error-msg">{errors.inGameId}</div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-draft"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-publish"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
