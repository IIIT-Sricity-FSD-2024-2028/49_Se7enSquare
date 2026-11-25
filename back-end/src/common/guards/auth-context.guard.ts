import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { db } from '../utils/in-memory-db';
import { getAuthSession, readSessionCookie } from '../utils/auth-sessions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const rawUrl = request.originalUrl || request.url || '';
    const cleanUrl = rawUrl.split('?')[0];

    // Auth endpoints and Swagger docs are inherently public
    const isAuthOrDoc =
      ['/api/auth/login', '/api/auth/register', '/api/auth/google', '/auth/login', '/auth/register', '/auth/google'].includes(cleanUrl) ||
      cleanUrl.startsWith('/api/docs') ||
      cleanUrl.startsWith('/uploads');

    const rawAuthorization = request.headers.authorization;
    const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
    const bearerToken = typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)
      ? authorization.replace(/^Bearer\s+/i, '').trim()
      : null;
    const sessionToken = bearerToken || readSessionCookie(request.headers.cookie);

    if (isPublic || isAuthOrDoc) {
      if (authorization && !bearerToken) {
        throw new UnauthorizedException('Invalid bearer authorization header');
      }
      if (sessionToken) {
        const userId = getAuthSession(sessionToken);
        const user = userId === null ? undefined : db.users.find((u) => u.id === userId);
        if (!user) {
          if (bearerToken || (!isPublic && !isAuthOrDoc)) {
            throw new UnauthorizedException('Invalid or expired session');
          }
        } else {
          (request as any).user = user;
          (request as any).userRole = user.role;
        }
      }
      return true;
    }

    if (!sessionToken) {
      throw new UnauthorizedException('Missing or invalid session');
    }

    const userId = getAuthSession(sessionToken);
    if (userId === null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // x-user-id remains as a compatibility hint for clients and logs, but it
    // can never establish identity or select a different account.
    const rawUserId = request.headers['x-user-id'];
    const userIdHeader = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    if (userIdHeader !== undefined && Number(userIdHeader) !== user.id) {
      throw new ForbiddenException('User ID header does not match authenticated session');
    }

    // Role verification against database record
    const rawRole = request.headers['x-role'];
    const roleValue = Array.isArray(rawRole) ? rawRole[0] : rawRole;
    if (roleValue && typeof roleValue === 'string') {
      let clientRole = roleValue.trim().toLowerCase();
      if (clientRole === 'gamer') clientRole = 'user';
      if (
        clientRole === 'community-manager' ||
        clientRole === 'community manager' ||
        clientRole === 'cm'
      ) {
        clientRole = 'community_manager';
      }
      if (clientRole === 'organiser') clientRole = 'organizer';

      if (clientRole !== user.role) {
        throw new ForbiddenException(
          'Role mismatch: declared role does not match user account role in database',
        );
      }
    }

    (request as any).user = user;
    (request as any).userRole = user.role;

    // Account status check (suspended or banned)
    if (user.status === 'suspended' || user.status === 'banned') {
      const method = (request.method || 'GET').toUpperCase();
      const isRestrictedRouteAllowed =
        (method === 'GET' &&
          (cleanUrl.endsWith('/users/me') ||
            cleanUrl.endsWith('/sanctions/mine') ||
            cleanUrl.endsWith('/notifications'))) ||
        cleanUrl.includes('/appeals');

      if (!isRestrictedRouteAllowed) {
        throw new ForbiddenException({
          code: user.status === 'banned' ? 'ACCOUNT_BANNED' : 'ACCOUNT_SUSPENDED',
          message: `Account is ${user.status}`,
          reason: user.statusReason || `Your account has been ${user.status}.`,
          until: user.statusUntil || null,
        });
      }
    }

    return true;
  }
}
