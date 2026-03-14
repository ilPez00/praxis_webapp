import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

export const getWidget = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const [profileRes, goalRes] = await Promise.all([
    supabase.from('profiles')
      .select('name, current_streak, praxis_points')
      .eq('id', userId)
      .single(),
    supabase.from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  if (!profile) return res.status(404).send('<p>User not found.</p>');

  const nodes: any[] = goalRes.data?.nodes ?? [];
  const topGoal = nodes
    .filter((n: any) => !n.parentId && !n.parent_id)
    .sort((a: any, b: any) => (b.progress ?? 0) - (a.progress ?? 0))[0];

  const streak = profile.current_streak ?? 0;
  const name = (profile.name ?? 'Praxis User').split(' ')[0];
  const goalName = topGoal?.name || topGoal?.title || '';
  const goalPct = topGoal ? Math.round((topGoal.progress ?? 0) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Praxis — ${name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #0A0B14 0%, #111827 100%);
    color: #fff;
    width: 320px;
    height: 120px;
    display: flex;
    align-items: center;
    padding: 16px;
    gap: 16px;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
  }
  .streak { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .flame { font-size: 2rem; line-height: 1; }
  .streak-num { font-size: 1.4rem; font-weight: 900; color: #F97316; }
  .streak-label { font-size: 0.6rem; color: #6B7280; letter-spacing: 0.05em; text-transform: uppercase; }
  .divider { width: 1px; height: 60px; background: rgba(255,255,255,0.08); flex-shrink: 0; }
  .content { flex: 1; min-width: 0; }
  .name { font-size: 0.75rem; color: #9CA3AF; font-weight: 600; margin-bottom: 4px; }
  .goal-name { font-size: 0.9rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
  .bar-bg { background: rgba(255,255,255,0.06); border-radius: 99px; height: 6px; }
  .bar-fill { background: linear-gradient(90deg, #F59E0B, #8B5CF6); border-radius: 99px; height: 6px; }
  .bar-label { font-size: 0.65rem; color: #6B7280; margin-top: 4px; display: flex; justify-content: space-between; }
  .branding { font-size: 0.55rem; color: #374151; position: absolute; bottom: 6px; right: 10px; letter-spacing: 0.05em; }
</style>
</head>
<body>
  <div class="streak">
    <div class="flame">🔥</div>
    <div class="streak-num">${streak}</div>
    <div class="streak-label">day streak</div>
  </div>
  <div class="divider"></div>
  <div class="content">
    <div class="name">${name} on Praxis</div>
    ${goalName ? `
    <div class="goal-name">${goalName.replace(/[<>&"]/g, (c: string) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]||c))}</div>
    <div class="bar-bg"><div class="bar-fill" style="width:${goalPct}%"></div></div>
    <div class="bar-label"><span>Progress</span><span>${goalPct}%</span></div>
    ` : '<div class="goal-name">Building in public 💪</div>'}
  </div>
  <div class="branding">PRAXIS</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(html);
});

export const getWidgetData = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const [profileRes, goalRes] = await Promise.all([
    supabase.from('profiles').select('name, current_streak, praxis_points').eq('id', userId).single(),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profileRes.data) return res.status(404).json({ error: 'User not found' });
  const nodes: any[] = goalRes.data?.nodes ?? [];
  const topGoal = nodes
    .filter((n: any) => !n.parentId && !n.parent_id)
    .sort((a: any, b: any) => (b.progress ?? 0) - (a.progress ?? 0))[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    name: profileRes.data.name,
    streak: profileRes.data.current_streak ?? 0,
    points: profileRes.data.praxis_points ?? 0,
    topGoal: topGoal
      ? { name: topGoal.name || topGoal.title, progress: Math.round((topGoal.progress ?? 0) * 100) }
      : null,
  });
});
