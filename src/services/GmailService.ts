import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface GmailSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  isActionable: boolean;
  actionKeywords: string[];
}

const ACTION_KEYWORDS = [
  'deadline', 'due', 'urgent', 'asap', 'please', 'by ', 'confirm',
  'review', 'approve', 'respond', 'reply', 'action required', 'follow up',
  'reminder', 'meeting', 'call', 'interview', 'submit', 'send',
  'complete', 'finish', 'deliver', 'scadenza', 'entro', 'urgente',
];

export class GmailService {
  private getClient(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const { data: account } = await supabase
      .from('external_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (!account?.access_token) return null;

    const client = this.getClient();
    client.setCredentials({
      access_token:  account.access_token,
      refresh_token: account.refresh_token,
      expiry_date:   account.expires_at ? new Date(account.expires_at).getTime() : undefined,
    });

    client.on('tokens', async (tokens) => {
      const update: Record<string, any> = {};
      if (tokens.access_token) update.access_token = tokens.access_token;
      if (tokens.expiry_date) update.expires_at = new Date(tokens.expiry_date).toISOString();
      if (Object.keys(update).length) {
        await supabase.from('external_accounts').update(update)
          .eq('user_id', userId).eq('provider', 'google');
      }
    });

    return client;
  }

  async getInboxSummary(userId: string, maxResults = 10): Promise<GmailSummary[]> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) return [];

    try {
      const gmail = google.gmail({ version: 'v1', auth: client });

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'is:inbox is:unread',
      });

      const messages = listRes.data.messages ?? [];

      const summaries = await Promise.all(
        messages.map(async (msg) => {
          if (!msg.id) return null;
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'Date'],
            });

            const headers = detail.data.payload?.headers ?? [];
            const get = (name: string) =>
              headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

            const subject = get('Subject');
            const from    = get('From');
            const date    = get('Date');
            const snippet = detail.data.snippet ?? '';

            const lc = (subject + ' ' + snippet).toLowerCase();
            const found = ACTION_KEYWORDS.filter(kw => lc.includes(kw));

            return {
              id: msg.id,
              subject,
              from,
              snippet,
              date,
              isActionable: found.length > 0,
              actionKeywords: found,
            } satisfies GmailSummary;
          } catch {
            return null;
          }
        })
      );

      return summaries.filter((s): s is GmailSummary => s !== null);
    } catch (err: any) {
      logger.error('[Gmail] getInboxSummary failed:', err.message);
      return [];
    }
  }

  async isLinked(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('external_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();
    return !!data;
  }
}
