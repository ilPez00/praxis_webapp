import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

class PresenceService {
  private channels: Map<string, any> = new Map();
  private presenceStates: Map<string, any> = new Map();

  async joinRoom(roomId: string, userId: string, userInfo: { name: string; avatar_url?: string }) {
    const channelKey = `presence:${roomId}`;
    
    if (this.channels.has(channelKey)) {
      logger.info(`Already in presence channel for room ${roomId}`);
      return this.channels.get(channelKey);
    }

    const channel = supabase.channel(channelKey, {
      config: {
        presence: { key: userId },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      this.presenceStates.set(channelKey, state);
      logger.debug(`Presence sync for room ${roomId}: ${Object.keys(state).length} users`);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      logger.info(`User ${key} joined room ${roomId}`);
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      logger.info(`User ${key} left room ${roomId}`);
    });

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url,
          online_at: new Date().toISOString(),
        });
        logger.info(`Joined presence channel for room ${roomId} as user ${userId}`);
      }
    });

    this.channels.set(channelKey, channel);
    return channel;
  }

  async leaveRoom(roomId: string, userId: string) {
    const channelKey = `presence:${roomId}`;
    const channel = this.channels.get(channelKey);

    if (channel) {
      await channel.untrack();
      await channel.unsubscribe();
      this.channels.delete(channelKey);
      this.presenceStates.delete(channelKey);
      logger.info(`Left presence channel for room ${roomId}`);
    }
  }

  getOnlineUsers(roomId: string): any[] {
    const channelKey = `presence:${roomId}`;
    const state = this.presenceStates.get(channelKey);
    
    if (!state) return [];

    const users: any[] = [];
    for (const [key, presence] of Object.entries(state)) {
      if (Array.isArray(presence) && presence.length > 0) {
        users.push(presence[0]);
      }
    }
    return users;
  }

  isUserOnline(roomId: string, userId: string): boolean {
    const users = this.getOnlineUsers(roomId);
    return users.some(u => u.user_id === userId);
  }

  async broadcastTyping(roomId: string, userId: string, isTyping: boolean) {
    const channelKey = `presence:${roomId}`;
    const channel = this.channels.get(channelKey);

    if (channel) {
      await channel.track({
        user_id: userId,
        typing: isTyping,
        online_at: new Date().toISOString(),
      });
    }
  }

  getTypingUsers(roomId: string): string[] {
    const channelKey = `presence:${roomId}`;
    const state = this.presenceStates.get(channelKey);
    
    if (!state) return [];

    const typingUsers: string[] = [];
    for (const [key, presence] of Object.entries(state)) {
      if (Array.isArray(presence) && presence.length > 0 && presence[0].typing) {
        typingUsers.push(key);
      }
    }
    return typingUsers;
  }
}

export const presenceService = new PresenceService();
