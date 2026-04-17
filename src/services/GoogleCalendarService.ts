import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  allDay: boolean;
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get auth URL to initiate Google OAuth flow
   */
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: userId, // Pass userId in state to verify in callback
      prompt: 'consent',
    });
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(code: string, userId: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Get user info to get email and provider_id
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id) throw new Error('Failed to get Google user info');

    // Store tokens in database
    const { error } = await supabase
      .from('external_accounts')
      .upsert({
        user_id: userId,
        provider: 'google',
        provider_id: userInfo.id,
        email: userInfo.email,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scopes: tokens.scope?.split(' '),
        metadata: {
          name: userInfo.name,
          picture: userInfo.picture,
        },
      }, { onConflict: 'user_id, provider' });

    if (error) {
      logger.error(`[GoogleCalendar] Error storing tokens for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get events for a specific date range
   */
  async getEvents(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) return [];

    const calendar = google.calendar({ version: 'v3', auth: client });
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      return events.map(event => ({
        id: event.id!,
        title: event.summary || 'Untitled Event',
        description: event.description || undefined,
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || ''),
        location: event.location || undefined,
        allDay: !!event.start?.date,
      }));
    } catch (error) {
      logger.error(`[GoogleCalendar] Error fetching events for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create an event on the user's primary calendar
   */
  async createEvent(userId: string, event: {
    title: string;
    description?: string;
    start: string;      // ISO datetime or YYYY-MM-DD for all-day
    end: string;
    location?: string;
    allDay?: boolean;
  }): Promise<CalendarEvent | null> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) return null;

    const calendar = google.calendar({ version: 'v3', auth: client });

    const eventBody: any = {
      summary: event.title,
      description: event.description,
      location: event.location,
    };

    if (event.allDay) {
      // All-day events use date (YYYY-MM-DD), not dateTime
      eventBody.start = { date: event.start.slice(0, 10) };
      eventBody.end = { date: event.end.slice(0, 10) };
    } else {
      eventBody.start = { dateTime: event.start, timeZone: 'UTC' };
      eventBody.end = { dateTime: event.end, timeZone: 'UTC' };
    }

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
      });

      const created = response.data;
      return {
        id: created.id!,
        title: created.summary || event.title,
        description: created.description || undefined,
        start: new Date(created.start?.dateTime || created.start?.date || event.start),
        end: new Date(created.end?.dateTime || created.end?.date || event.end),
        location: created.location || undefined,
        allDay: !!created.start?.date,
      };
    } catch (error) {
      logger.error(`[GoogleCalendar] Error creating event for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has a linked Google account
   */
  async isLinked(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('external_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();
    return !!data;
  }

  /**
   * Disconnect Google account
   */
  async disconnect(userId: string): Promise<void> {
    const { error } = await supabase
      .from('external_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'google');
    if (error) throw error;
  }

  /**
   * Get an authenticated client for a user, refreshing token if necessary
   */
  private async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const { data: account, error } = await supabase
      .from('external_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (error || !account) return null;

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? new Date(account.expires_at).getTime() : undefined,
    });

    // Handle token refresh automatically
    client.on('tokens', async (tokens) => {
      const updates: any = {
        access_token: tokens.access_token,
        updated_at: new Date().toISOString(),
      };
      
      if (tokens.refresh_token) {
        updates.refresh_token = tokens.refresh_token;
      }
      
      if (tokens.expiry_date) {
        updates.expires_at = new Date(tokens.expiry_date).toISOString();
      }

      await supabase
        .from('external_accounts')
        .update(updates)
        .eq('user_id', userId)
        .eq('provider', 'google');
      
      logger.info(`[GoogleCalendar] Tokens refreshed for user ${userId}`);
    });

    return client;
  }
}
