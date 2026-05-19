import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const AUTH_URL  = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES    = 'user-read-recently-played user-top-read user-read-currently-playing user-read-playback-state';
const PROVIDER  = 'spotify';

export interface SpotifyTrack {
  title: string;
  artist: string;
  playedAt?: string;
}

export interface SpotifySummary {
  currentlyPlaying?: SpotifyTrack;
  recentTracks: SpotifyTrack[];
  topTracks: SpotifyTrack[];
  topArtists: string[];
}

export class SpotifyService {
  private b64Credentials(): string {
    return Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');
  }

  getAuthUrl(userId: string, redirectUri: string): string {
    if (!process.env.SPOTIFY_CLIENT_ID) throw new Error('SPOTIFY_CLIENT_ID not configured');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     process.env.SPOTIFY_CLIENT_ID,
      scope:         SCOPES,
      redirect_uri:  redirectUri,
      state:         userId,
    });
    return `${AUTH_URL}?${params}`;
  }

  async handleCallback(code: string, userId: string, redirectUri: string): Promise<void> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.b64Credentials()}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
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
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.b64Credentials()}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }),
    });
    if (!res.ok) return null;
    const fresh = await res.json();
    await supabase.from('external_accounts').update({
      access_token: fresh.access_token,
      expires_at:   new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      ...(fresh.refresh_token ? { refresh_token: fresh.refresh_token } : {}),
    }).eq('user_id', userId).eq('provider', PROVIDER);
    return fresh.access_token;
  }

  private async spotifyGet(token: string, path: string): Promise<any | null> {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    if (res.status === 204) return {};
    return res.json();
  }

  async getSummary(userId: string): Promise<SpotifySummary> {
    const token = await this.refreshedToken(userId);
    if (!token) return { recentTracks: [], topTracks: [], topArtists: [] };

    try {
      const [nowData, recentData, topTracksData, topArtistsData] = await Promise.all([
        this.spotifyGet(token, '/me/player/currently-playing'),
        this.spotifyGet(token, '/me/player/recently-played?limit=10'),
        this.spotifyGet(token, '/me/top/tracks?limit=10&time_range=short_term'),
        this.spotifyGet(token, '/me/top/artists?limit=5&time_range=short_term'),
      ]);

      const toTrack = (item: any): SpotifyTrack => ({
        title:  item?.name ?? '',
        artist: (item?.artists ?? []).map((a: any) => a.name).join(', '),
      });

      const currentlyPlaying = nowData?.item ? {
        ...toTrack(nowData.item),
      } : undefined;

      const recentTracks = (recentData?.items ?? []).map((i: any) => ({
        ...toTrack(i.track),
        playedAt: i.played_at,
      }));

      const topTracks   = (topTracksData?.items ?? []).map(toTrack);
      const topArtists  = (topArtistsData?.items ?? []).map((a: any) => a.name as string);

      return { currentlyPlaying, recentTracks, topTracks, topArtists };
    } catch (err: any) {
      logger.error('[Spotify] getSummary failed:', err.message);
      return { recentTracks: [], topTracks: [], topArtists: [] };
    }
  }
}
