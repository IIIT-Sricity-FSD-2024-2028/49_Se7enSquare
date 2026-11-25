import React from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { modNoteChanged, selectModNotes } from "../../../store/slices/adminModerationSlice";

/**
 * Escalated Reports tab - shows only reports with status === 'escalated',
 * enriched with reporter, target and community names.
 * Notes state is managed in Redux adminModerationSlice.modNotes.
 */
export default function EscalatedReportsTab({ reports, users, communities, onAction }) {
  const dispatch = useAppDispatch();
  const notes = useAppSelector(selectModNotes);

  const escalated = (reports || []).filter((r) => r.status === "escalated");

  function enrich(r) {
    const reporter = (users || []).find((u) => u.id === r.reporterId);
    const target = (users || []).find((u) => u.id === r.reportedUserId);
    const comm = (communities || []).find((c) => c.id === r.communityId);
    return {
      reporterName: reporter?.username || `User #${r.reporterId}`,
      targetName: target?.username || `User #${r.reportedUserId}`,
      communityName: comm?.name || (r.communityId ? `Community #${r.communityId}` : "General"),
    };
  }

  const setNote = (reportId, note) => {
    dispatch(modNoteChanged({ reportId, note }));
  };

  return (
    <section className="admin-page active" id="page-escalated-reports">
      <div className="section-header">
        <div>
          <h2>Escalated Reports Queue</h2>
          <p className="section-sub">
            Reports forwarded to admins by community moderators requiring platform-level action.
          </p>
        </div>
      </div>

      <div className="reports-grid">
        {escalated.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: "1/-1" }}>
            <div className="empty-icon">🛡️</div>
            <p>No escalated reports pending admin review.</p>
          </div>
        ) : (
          escalated.map((r) => {
            const { reporterName, targetName, communityName } = enrich(r);
            const note = notes[r.id] ?? "";
            return (
              <div key={r.id} className="report-card escalated-card">
                <div className="report-card-header">
                  <span className="badge badge-escalated">Escalated</span>
                  <span className="report-date">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Recently"}
                  </span>
                </div>

                <div className="report-parties">
                  <div>
                    <span className="report-label">Reported by:</span> <strong>{reporterName}</strong>
                  </div>
                  <div>
                    <span className="report-label">Target user:</span> <strong>{targetName}</strong>
                  </div>
                  <div>
                    <span className="report-label">Community:</span> <span>{communityName}</span>
                  </div>
                  <div>
                    <span className="report-label">Type:</span> <span>{r.itemType || "message"}</span>
                  </div>
                </div>

                <div className="report-reason">
                  <div className="report-label">Violation Reason:</div>
                  <p>{r.reason || "No reason given."}</p>
                </div>

                {r.escalationReason && (
                  <div className="report-escalation-box">
                    <span className="report-label">Moderator Escalation Note:</span>
                    <p>{r.escalationReason}</p>
                  </div>
                )}

                <div className="report-note-field">
                  <label htmlFor={`note-${r.id}`}>Admin Resolution Note:</label>
                  <input
                    id={`note-${r.id}`}
                    type="text"
                    className="admin-input"
                    placeholder="Enter reason or context for action..."
                    value={note}
                    onChange={(e) => setNote(r.id, e.target.value)}
                  />
                </div>

                <div className="report-actions">
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onAction(r, "dismiss", note)}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => onAction(r, "warn", note)}
                  >
                    Warn
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onAction(r, "remove_content", note)}
                  >
                    Remove Content
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onAction(r, "suspend_author", note)}
                  >
                    Suspend User
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onAction(r, "ban_author", note)}
                  >
                    Ban User
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
