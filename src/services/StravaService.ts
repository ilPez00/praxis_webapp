import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const AUTH_URL  = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES    = 'read,activity:read_all';
const PROVIDER  = 'strava';

export interface StravaActivity {
  name: string;
  type: string;
  date: string;
  distanceKm: number;
  durationMin: number;
  sufferScore?: number;
  elevationM?: number;
}

export interface StravaSummary {
  athlete?: string;
  activities: StravaActivity[];
  totalKm: number;
  totalMinutes: number;
  days: number;
}

export class StravaService {
  getAuthUrl(userId: string, redirectUri: string): string {
    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) throw new Error('STRAVA_CLIENT_ID not configured');
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      approval_prompt: 'auto',
      scope: SCOPES,
      state: userId,
    });
    return `${AUTH_URL}?${params}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
    const data = await res.json();
    await supabase.from('external_accounts').upsert({
      user_id:       userId,
      provider:      PROVIDER,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    new Date(data.expires_at * 1000).toISOString(),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type:    'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const fresh = await res.json();
    await supabase.from('external_accounts').update({
      access_token:  fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at:    new Date(fresh.expires_at * 1000).toISOString(),
    }).eq('user_id', userId).eq('provider', PROVIDER);
    return fresh.access_token;
  }

  async getRecentActivities(userId: string, days = 14): Promise<StravaSummary> {
    const token = await this.refreshedToken(userId);
    if (!token) return { activities: [], totalKm: 0, totalMinutes: 0, days };

    const after = Math.floor(Date.now() / 1000) - days * 86400;
    try {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { activities: [], totalKm: 0, totalMinutes: 0, days };
      const raw: any[] = await res.json();

      const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const athleteData = athleteRes.ok ? await athleteRes.json() : null;

      const activities: StravaActivity[] = raw.map(a => ({
        name:        a.name,
        type:        a.sport_type ?? a.type,
        date:        (a.start_date_local as string).split('T')[0],
        distanceKm:  Math.round(a.distance / 100) / 10,
        durationMin: Math.round(a.moving_time / 60),
        sufferScore: a.suffer_score ?? undefined,
        elevationM:  a.total_elevation_gain ?? undefined,
      }));

      return {
        athlete:      athleteData ? `${athleteData.firstname} ${athleteData.lastname}`.trim() : undefined,
        activities,
        totalKm:      Math.round(activities.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10,
        totalMinutes: activities.reduce((s, a) => s + a.durationMin, 0),
        days,
      };
    } catch (err: any) {
      logger.error('[Strava] getRecentActivities failed:', err.message);
      return { activities: [], totalKm: 0, totalMinutes: 0, days };
    }
  }
}
