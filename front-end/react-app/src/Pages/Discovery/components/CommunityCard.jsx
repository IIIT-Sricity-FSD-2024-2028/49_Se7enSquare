import React from 'react';
import { useNavigate } from 'react-router-dom';
import { memberCountOf, onlineCountOf } from '../../../Components/platform/data/discoveryData';

/**
 * Individual community card: banner, icon, name, stats, tags, and Join/Leave button.
 * CSS classes from discovery.css: c-card, c-banner, c-banner-inner, c-card-body,
 * c-top, c-icon, c-badges, c-badge, c-name, c-cat, c-desc, c-footer, c-stats, c-stat, btn-join.
 */
export default function CommunityCard({
  comm,
  isJoined,
  isPending = false,
  onJoin,
  onLeave,
  onToggleJoin,
}) {
  const navigate = useNavigate();
  const icon = comm.icon || '🏘️';
  const memberCount = memberCountOf(comm);
  const onlineCount = onlineCountOf(comm);

  // grad from data (e.g. "grad-purple") maps banner background class to "banner-purple"
  const grad = comm.grad || 'grad-purple';
  const bannerClass = grad.replace('grad-', 'banner-');

  const getFallbackBanner = (c) => {
    const text = `${c.category || ''} ${c.name || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
    if (text.includes('fps') || text.includes('shooter') || text.includes('arena') || text.includes('combat')) {
      return '/assets/gaming/fps-banner.svg';
    }
    if (text.includes('tourn') || text.includes('esport') || text.includes('champ') || text.includes('cup')) {
      return '/assets/gaming/tournament-banner.svg';
    }
    if (text.includes('indie') || text.includes('dev') || text.includes('arcade') || text.includes('retro')) {
      return '/assets/gaming/indie-banner.svg';
    }
    return '/assets/gaming/tournament-banner.svg';
  };

  const bannerUrl = comm.banner || getFallbackBanner(comm);
  const bannerStyle = {
    backgroundImage: bannerUrl.includes('gradient(') ? bannerUrl : `url(${bannerUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div
      className="c-card"
      onClick={() => navigate(`/community/${comm.id}`)}
    >
      <div className={`c-banner ${bannerClass}`} style={bannerStyle}>
        <div className="c-banner-inner">{icon}{icon}{icon}</div>
      </div>

      <div className="c-card-body">
        <div className="c-top">
          <div className={`c-icon ${grad}`}>{icon}</div>
          <div className="c-badges">
            {memberCount > 15000 && <span className="c-badge badge-trending">🔥 Trending</span>}
            {onlineCount > 1000  && <span className="c-badge badge-hot">⭐ Hot</span>}
          </div>
        </div>

        <div>
          <div className="c-name">{comm.name}</div>
          <div className="c-cat">
            {comm.category || 'Gaming'}
            {comm.tags?.length ? ` · ${comm.tags.slice(0, 2).join(', ')}` : ''}
          </div>
        </div>

        <div className="c-desc">{comm.description}</div>

        <div className="c-footer">
          <div className="c-stats">
            <span className="c-stat">👥 {memberCount.toLocaleString()}</span>
            <span className="c-stat">🟢 {onlineCount.toLocaleString()} online</span>
          </div>

          {!isJoined ? (
            <button
              type="button"
              className={`btn-join${isPending ? ' loading' : ''}`}
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (onJoin) onJoin(comm.id, e);
                else onToggleJoin(comm.id, e);
              }}
            >
              {isPending ? 'Joining…' : 'Join'}
            </button>
          ) : (
            <div className="c-joined-actions">
              <span className="badge-joined">✓ Joined</span>
              <button
                type="button"
                className={`btn-leave${isPending ? ' loading' : ''}`}
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onLeave) onLeave(comm.id, e);
                  else onToggleJoin(comm.id, e);
                }}
              >
                {isPending ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
