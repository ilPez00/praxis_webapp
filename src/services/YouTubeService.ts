import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  likedAt?: string;
}

export interface YouTubeSummary {
  likedVideos: YouTubeVideo[];
  topChannels: string[];
  categories: string[];
}

// Reuses stored Google tokens from external_accounts (provider='google')
// youtube.readonly scope must be included when user connects Google (see GoogleCalendarService)
export class YouTubeService {
  private getClient(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const { data } = await supabase
      .from('external_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();
    if (!data?.access_token) return null;

    const client = this.getClient();
    client.setCredentials({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expiry_date:   data.expires_at ? new Date(data.expires_at).getTime() : undefined,
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

  async isLinked(userId: string): Promise<boolean> {
    const { data } = await supabase.from('external_accounts').select('id')
      .eq('user_id', userId).eq('provider', 'google').maybeSingle();
    return !!data;
  }

  async getLikedVideos(userId: string, maxResults = 20): Promise<YouTubeSummary> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) return { likedVideos: [], topChannels: [], categories: [] };

    try {
      const yt = google.youtube({ version: 'v3', auth: client });

      const likedRes = await yt.videos.list({
        part: ['snippet'],
        myRating: 'like',
        maxResults,
      });

      const likedVideos: YouTubeVideo[] = (likedRes.data.items ?? []).map(v => ({
        id:           v.id ?? '',
        title:        v.snippet?.title ?? '',
        channelTitle: v.snippet?.channelTitle ?? '',
        publishedAt:  v.snippet?.publishedAt ?? '',
      }));

      const channelCounts: Record<string, number> = {};
      likedVideos.forEach(v => {
        channelCounts[v.channelTitle] = (channelCounts[v.channelTitle] ?? 0) + 1;
      });
      const topChannels = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ch]) => ch);

      const catSet = new Set<string>();
      (likedRes.data.items ?? []).forEach(v => {
        if (v.snippet?.categoryId) catSet.add(v.snippet.categoryId);
      });

      return { likedVideos, topChannels, categories: Array.from(catSet) };
    } catch (err: any) {
      logger.error('[YouTube] getLikedVideos failed:', err.message);
      return { likedVideos: [], topChannels: [], categories: [] };
    }
  }
}
