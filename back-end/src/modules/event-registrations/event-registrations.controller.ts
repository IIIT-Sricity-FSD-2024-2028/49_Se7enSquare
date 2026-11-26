import { Body, ForbiddenException, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { db, UserRecord } from '../../common/utils/in-memory-db';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../rbac/role.enum';
import { EventRegistrationsService } from './event-registrations.service';

@ApiTags('event-registrations')
@Controller('event-registrations')
export class EventRegistrationsController {
  constructor(private readonly service: EventRegistrationsService) {}

  @Get()
  @Roles(AppRole.ADMIN, AppRole.COMMUNITY_MANAGER, AppRole.MODERATOR, AppRole.USER, AppRole.ORGANIZER)
  findAll(@CurrentUser() user: UserRecord, @Query('userId') userId?: string, @Query('eventId') eventId?: string) {
    if (!['admin', 'community_manager', 'organizer'].includes(user.role)) {
      if (userId && Number(userId) !== user.id) throw new ForbiddenException('You may only view your own registrations');
      userId = String(user.id);
    }
    const registrations = this.service.findAll(userId ? Number(userId) : undefined, eventId ? Number(eventId) : undefined);
    if (user.role === 'organizer') {
      const owned = new Set(db.events.filter(e => e.organiserId === user.id).map(e => e.id));
      return registrations.filter(r => r.userId === user.id || owned.has(r.eventId));
    }
    return registrations;
  }

  @Post()
  @Roles(AppRole.ADMIN, AppRole.COMMUNITY_MANAGER, AppRole.MODERATOR, AppRole.USER, AppRole.ORGANIZER)
  create(@Body() payload: any, @CurrentUser() user: UserRecord) {
    return this.service.create({ ...payload, userId: user.id });
  }

  @Delete(':id')
  @Roles(AppRole.ADMIN, AppRole.COMMUNITY_MANAGER, AppRole.MODERATOR, AppRole.USER, AppRole.ORGANIZER)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserRecord) {
    const registration = this.service.findAll().find(item => item.id === id);
    if (registration && registration.userId !== user.id && user.role !== 'admin') throw new ForbiddenException('You may only cancel your own registrations');
    return this.service.remove(id);
  }
}
