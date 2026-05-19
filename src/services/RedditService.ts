import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const AUTH_URL  = 'https://www.reddit.com/api/v1/authorize';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const SCOPES    = 'identity history read saved';
const PROVIDER  = 'reddit';
const UA        = 'Praxis-Ayu/1.0 by Praxis';

export interface RedditPost {
  title: string;
  subreddit: string;
  url: string;
  score: number;
  saved?: boolean;
  createdUtc: number;
}

export interface RedditSummary {
  username?: string;
  saved: RedditPost[];
  recentUpvoted: RedditPost[];
  recentComments: Array<{ body: string; subreddit: string; score: number }>;
}

export class RedditService {
  private b64Credentials(): string {
    return Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  }

  getAuthUrl(userId: string, redirectUri: string): string {
    if (!process.env.REDDIT_CLIENT_ID) throw new Error('REDDIT_CLIENT_ID not configured');
    const params = new URLSearchParams({
      client_id:     process.env.REDDIT_CLIENT_ID,
      response_type: 'code',
      state:         userId,
      redirect_uri:  redirectUri,
      duration:      'permanent',
      scope:         SCOPES,
    });
    return `${AUTH_URL}?${params}`;
  }

  async handleCallback(code: string, userId: string, redirectUri: string): Promise<void> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.b64Credentials()}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'User-Agent':    UA,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!res.ok) throw new Error(`Reddit token exchange failed: ${res.status}`);
    const data = await res.json();
    await supabase.from('external_accounts').upsert({
      user_id:       userId,
      provider:      PROVIDER,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
  }

  async isLinked(userId: string): Promise<boolean> {
    const { data } = await supabase.from('external_accounts').select('id')
      .eq('user_id', userId).eq('provider', PROVIDER).maybeSingle();
    return !!data;
  }

  async disconnect(userId: string): Promise<void> {
    await supabase.from('external_accounts').delete().eq('user_id', userId).eq('provider', PROVIDER);
  }

  private async refreshedToken(userId: string): Promise<string | null> {
    const { data } = await supabase.from('external_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId).eq('provider', PROVIDER).maybeSingle();
    if (!data) return null;

    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    if (Date.now() < expiresAt - 60_000) return data.access_token;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.b64Credentials()}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'User-Agent':    UA,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }),
    });
    if (!res.ok) return null;
    const fresh = await res.json();
    await supabase.from('external_accounts').update({
      access_token: fresh.access_token,
      expires_at:   new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
    }).eq('user_id', userId).eq('provider', PROVIDER);
    return fresh.access_token;
  }

  private async redditGet(token: string, path: string): Promise<any | null> {
    const res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent':  UA,
      },
    });
    if (!res.ok) return null;
    return res.json();
  }

  private toPost(child: any, saved = false): RedditPost {
    const d = child.data;
    return {
      title:      d.title ?? d.body?.slice(0, 80) ?? '',
      subreddit:  d.subreddit ?? '',
      url:        d.url ?? `https://reddit.com${d.permalink}`,
      score:      d.score ?? 0,
      createdUtc: d.created_utc ?? 0,
      saved,
    };
  }

  async getSummary(userId: string, limit = 10): Promise<RedditSummary> {
    const token = await this.refreshedToken(userId);
    if (!token) return { saved: [], recentUpvoted: [], recentComments: [] };

    try {
      const [meData, savedData, upvotedData, commentsData] = await Promise.all([
        this.redditGet(token, '/api/v1/me'),
        this.redditGet(token, `/user/me/saved?limit=${limit}&type=links`),
        this.redditGet(token, `/user/me/upvoted?limit=${limit}`),
        this.redditGet(token, `/user/me/comments?limit=${limit}&sort=new`),
      ]);

      const username: string | undefined = meData?.name;

      const saved = (savedData?.data?.children ?? [])
        .filter((c: any) => c.kind === 't3')
        .map((c: any) => this.toPost(c, true));

      const recentUpvoted = (upvotedData?.data?.children ?? [])
        .filter((c: any) => c.kind === 't3')
        .map((c: any) => this.toPost(c));

      const recentComments = (commentsData?.data?.children ?? [])
        .filter((c: any) => c.kind === 't1')
        .map((c: any) => ({
          body:      (c.data.body as string).slice(0, 200),
          subreddit: c.data.subreddit as string,
          score:     c.data.score as number,
        }));

      return { username, saved, recentUpvoted, recentComments };
    } catch (err: any) {
      logger.error('[Reddit] getSummary failed:', err.message);
      return { saved: [], recentUpvoted: [], recentComments: [] };
    }
  }
}
