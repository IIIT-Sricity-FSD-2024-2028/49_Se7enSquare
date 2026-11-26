import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getAuthSession, readSessionCookie } from '../utils/auth-sessions';
import { db } from '../utils/in-memory-db';
import { OrganisersService } from '../../modules/organisers/organisers.service';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service';
import { FileLoggerService } from '../logger/file-logger.service';

const FREE_COMMUNITY_LIMIT = 4;

// Middleware runs before guards: resolve the same opaque session token, never body identity.
function sessionUser(req: Request) {
  const authorization = req.headers.authorization || '';
  const token = /^Bearer\s+/i.test(authorization)
    ? authorization.replace(/^Bearer\s+/i, '').trim()
    : readSessionCookie(req.headers.cookie);
  const id = token ? getAuthSession(token) : null;
  return id === null ? undefined : db.users.find(user => user.id === id);
}

/** Enforce community limits for the authenticated creator. */
@Injectable()
export class SubscriptionLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly logger: FileLoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const ownerId = sessionUser(req)?.id;
    if (!ownerId) {
      return next(); // The authentication guard rejects missing/expired sessions.
    }

    const { plan } = this.subscriptionsService.status(ownerId);
    if (plan === 'free') {
      const owned = db.communities.filter((item) => item.ownerId === ownerId).length;
      if (owned >= FREE_COMMUNITY_LIMIT) {
        this.logger.warn(`[FeatureGating: Subscription] user ${ownerId} hit the free-plan community limit (${FREE_COMMUNITY_LIMIT})`);
        throw new ForbiddenException(
          `Free plan is limited to ${FREE_COMMUNITY_LIMIT} communities — upgrade to Plus or Ultra Pro to create more.`,
        );
      }
    }

    next();
  }
}

/**
 * Router-level middleware scoped to POST /api/events (doc §9/§20 — Organizer
 * Subscription feature gating). Applies to the authenticated organizer.
 * Free Organizer is capped at 1 active tournament and
 * 100 participants; Premium is unlimited.
 */
@Injectable()
export class OrganizerLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly organisersService: OrganisersService,
    private readonly logger: FileLoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const user = sessionUser(req);
    if (!user || user.role !== 'organizer') return next();
    const organiserId = user.id;

    const { maxActiveTournaments, maxParticipants } = this.organisersService.limitsFor(organiserId);

    if (maxActiveTournaments !== null) {
      const active = db.events.filter(
        (item) => item.organiserId === organiserId && item.status !== 'cancelled' && item.status !== 'rejected',
      ).length;
      if (active >= maxActiveTournaments) {
        this.logger.warn(`[FeatureGating: Organizer] user ${organiserId} hit the free-tier tournament limit (${maxActiveTournaments})`);
        throw new ForbiddenException(
          `Free Organizer plan is limited to ${maxActiveTournaments} active tournament(s) — upgrade to Premium Organizer for unlimited tournaments.`,
        );
      }
    }

    if (maxParticipants !== null && req.body?.maxAttendees && Number(req.body.maxAttendees) > maxParticipants) {
      throw new ForbiddenException(
        `Free Organizer plan is limited to ${maxParticipants} participants per tournament — upgrade to Premium Organizer for unlimited participants.`,
      );
    }

    next();
  }
}
