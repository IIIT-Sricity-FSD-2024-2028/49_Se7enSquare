import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatMessageRecord, db, nextId, saveDb } from '../../common/utils/in-memory-db';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  remove(id: number, userId: number): { id: number } {
    const index = db.messages.findIndex((item) => item.id === id && item.authorId === userId);
    if (index === -1) throw new NotFoundException('No removable record found');
    db.messages.splice(index, 1);
    saveDb();
    return { id };
  }

  findAll(communityId?: number, channelId?: string): ChatMessageRecord[] {
    return db.messages.filter((item) =>
      (!communityId || item.communityId === communityId) &&
      (!channelId || item.channelId === channelId),
    );
  }

  findByChannel(channelId: string): ChatMessageRecord[] {
    return db.messages.filter((item) => item.channelId === channelId);
  }

  create(payload: Partial<ChatMessageRecord>, authorId: number): ChatMessageRecord {
    const author = db.users.find((user) => user.id === authorId);
    if (!author) throw new NotFoundException('Authenticated message author was not found');
    const created: ChatMessageRecord = {
      id: nextId('message'),
      channelId: payload.channelId || 'general',
      communityId: payload.communityId,
      authorId,
      authorName: author.fullName || [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username,
      content: payload.content || '',
      attachments: payload.attachments || [],
      reactions: {},
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(created);
    saveDb();
    return created;
  }

  react(id: number, emoji: string, actorId: number): ChatMessageRecord {
    const message = this.findOne(id);
    const actor = db.users.find((user) => user.id === actorId);
    if (!message.reactions) {
      message.reactions = {};
    }
    const existing = Array.isArray(message.reactions[emoji]) ? message.reactions[emoji] : [];
    const userId = actorId || 1;
    if (existing.includes(userId)) {
      message.reactions[emoji] = existing.filter((uid) => uid !== userId);
    } else {
      message.reactions[emoji] = [...existing, userId];
    }
    saveDb();

    // Notify the message's author, unless they reacted to their own message.
    if (message.authorId && actorId && String(actorId) !== String(message.authorId)) {
      NotificationsService.push({
        userId: message.authorId,
        type: 'reaction',
        text: `${actor?.username || 'Someone'} reacted ${emoji} to your message`,
        channelId: message.channelId,
        targetId: message.id,
      });
    }

    return message;
  }


  pin(id: number, actorId: number, actorRole: string): ChatMessageRecord {
    const message = this.findOne(id);
    if (message.authorId !== actorId && !['admin', 'community_manager', 'moderator'].includes(actorRole)) {
      throw new ForbiddenException('Only the message author or a moderator can pin this message');
    }
    message.pinned = !message.pinned;
    saveDb();
    return message;
  }

  addAttachment(id: number, fileName: string, actorId: number, actorRole: string): ChatMessageRecord {
    const message = this.findOne(id);
    if (message.authorId !== actorId && !['admin', 'community_manager', 'moderator'].includes(actorRole)) {
      throw new ForbiddenException('Only the message author or a moderator can add attachments');
    }
    message.attachments.push(fileName);
    saveDb();
    return message;
  }

  private findOne(id: number): ChatMessageRecord {
    const message = db.messages.find((item) => item.id === id);
    if (!message) throw new NotFoundException(`Message with id ${id} not found`);
    return message;
  }
}
