import React from 'react';

/**
 * Pinned messages panel — sliding overlay showing pinned items.
 */
export default function PinnedMessagesModal({ onClose, messages }) {
  return (
    <div id="pinnedPanel" className="pinned-panel" style={{ display: 'block' }}>
      <div className="pinned-panel-header">
        <span>📌 Pinned Messages</span>
        <button className="pinned-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="pinned-panel-list" id="pinnedList">
        {messages.length ? messages.map((message) => (
          <div className="pinned-item" key={message.id}>
            <strong>{message.author}</strong>
            <p>{message.text}</p>
          </div>
        )) : <div id="pinnedEmpty" className="pinned-empty">No pinned messages yet.</div>}
      </div>
    </div>
  );
}
