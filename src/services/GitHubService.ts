import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface GitHubSummary {
  date: string;
  pushes: number;
  commits: number;
  repos: string[];
  recentMessages: string[];
  prActions: string[];
  issueActions: string[];
}

export class GitHubService {
  private async getToken(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('external_accounts')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'github')
      .maybeSingle();
    return data?.access_token ?? null;
  }

  async isLinked(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('external_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'github')
      .maybeSingle();
    return !!data;
  }

  async savePat(userId: string, pat: string): Promise<void> {
    await supabase.from('external_accounts').upsert(
      { user_id: userId, provider: 'github', access_token: pat, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' },
    );
  }

  async removePat(userId: string): Promise<void> {
    await supabase.from('external_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'github');
  }

  async getRecentActivity(userId: string, days = 7): Promise<GitHubSummary> {
    const token = await this.getToken(userId);
    if (!token) return this.empty();

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Praxis-Ayu/1.0',
    };

    try {
      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) return this.empty();
      const user = await userRes.json();

      const eventsRes = await fetch(
        `https://api.github.com/users/${user.login}/events?per_page=100`,
        { headers },
      );
      if (!eventsRes.ok) return this.empty();
      const events: any[] = await eventsRes.json();

      const since = new Date();
      since.setDate(since.getDate() - days);
      const recent = events.filter(e => new Date(e.created_at) >= since);

      const summary: GitHubSummary = {
        date: new Date().toISOString().split('T')[0],
        pushes: 0, commits: 0, repos: [],
        recentMessages: [], prActions: [], issueActions: [],
      };

      for (const ev of recent) {
        if (!summary.repos.includes(ev.repo.name)) summary.repos.push(ev.repo.name);
        const repoShort = (ev.repo.name as string).replace(/^[^/]+\//, '');

        if (ev.type === 'PushEvent') {
          summary.pushes++;
          const commits: any[] = ev.payload?.commits ?? [];
          summary.commits += commits.length;
          commits.slice(0, 2).forEach((c: any) => {
            const msg = (c.message as string).split('\n')[0].trim().slice(0, 80);
            if (msg) summary.recentMessages.push(`[${repoShort}] ${msg}`);
          });
        } else if (ev.type === 'PullRequestEvent' && ev.payload?.action) {
          const title = (ev.payload?.pull_request?.title as string | undefined)?.slice(0, 60) ?? 'untitled';
          summary.prActions.push(`${ev.payload.action} PR: ${title}`);
        } else if (ev.type === 'IssuesEvent' && ev.payload?.action) {
          const title = (ev.payload?.issue?.title as string | undefined)?.slice(0, 60) ?? 'untitled';
          summary.issueActions.push(`${ev.payload.action} issue: ${title}`);
        }
      }

      summary.recentMessages = summary.recentMessages.slice(0, 10);
      summary.prActions      = summary.prActions.slice(0, 5);
      summary.issueActions   = summary.issueActions.slice(0, 5);
      summary.repos          = summary.repos.slice(0, 10);

      return summary;
    } catch (err: any) {
      logger.error('[GitHub] getRecentActivity failed:', err.message);
      return this.empty();
    }
  }

  private empty(): GitHubSummary {
    return { date: '', pushes: 0, commits: 0, repos: [], recentMessages: [], prActions: [], issueActions: [] };
  }
}
