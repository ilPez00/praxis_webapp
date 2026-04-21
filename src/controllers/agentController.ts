import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { randomBytes } from 'crypto';

function generateApiKey(): string {
  return 'pk_live_' + randomBytes(24).toString('hex');
}

function generateCode(): string {
  return randomBytes(32).toString('hex');
}

export const listAgents = catchAsync(async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('name');

  if (error) {
    throw new BadRequestError(error.message);
  }
  res.json({ agents: data });
});

export const connectAgent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { slug } = req.params;
  if (!slug) {
    throw new BadRequestError('Agent slug is required');
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('slug', slug)
    .single();

  if (agentError || !agent) {
    throw new NotFoundError('Agent not found');
  }

  const code = generateCode();

  const { error: insertError } = await supabase
    .from('agent_connect_codes')
    .insert({ user_id: userId, agent_id: agent.id, code });

  if (insertError) {
    throw new BadRequestError('Failed to create connect code');
  }

  const connectUrl = agent.website + '/connect?code=' + code + '&user_id=' + userId;
  res.json({ connect_url: connectUrl, code: code });
});

export const exchangeCode = catchAsync(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    throw new BadRequestError('Code is required');
  }

  const { data: codeRow, error: codeError } = await supabase
    .from('agent_connect_codes')
    .select('*')
    .eq('code', code)
    .single();

  if (codeError || !codeRow) {
    throw new BadRequestError('Invalid or expired code');
  }
  if (codeRow.used_at) {
    throw new BadRequestError('Code already used');
  }
  if (new Date(codeRow.expires_at) < new Date()) {
    throw new BadRequestError('Code expired');
  }

  const apiKey = generateApiKey();

  const { error: keyError } = await supabase
    .from('agent_keys')
    .insert({
      user_id: codeRow.user_id,
      agent_id: codeRow.agent_id,
      api_key: apiKey,
      scope: ['read', 'write'],
    });

  if (keyError) {
    throw new BadRequestError('Failed to create API key');
  }

  await supabase
    .from('agent_connect_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', codeRow.id);

  const { data: agent } = await supabase
    .from('agents')
    .select('name')
    .eq('id', codeRow.agent_id)
    .single();

  const agentName = agent && agent.name ? agent.name : 'agent';
  res.json({
    message: 'Connected to ' + agentName + ' successfully',
    api_key: apiKey,
    scope: ['read', 'write'],
  });
});

export const getKey = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = req.params;

  const { data, error } = await supabase
    .from('agent_keys')
    .select('api_key')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new NotFoundError('API key not found');
  }

  res.json({ api_key: data.api_key });
});

export const listKeys = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { data, error } = await supabase
    .from('agent_keys')
    .select('id, api_key, scope, created_at, last_used_at, expires_at, agents:agents(*)')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new BadRequestError(error.message);
  }

  const keys = (data || []).map(function(k: any) {
    return {
      id: k.id,
      api_key: k.api_key.slice(0, 12) + '...',
      agent: k.agents,
      scope: k.scope,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      expires_at: k.expires_at,
    };
  });

  res.json({ keys });
});

export const revokeKey = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = req.params;

  const { error: updateError } = await supabase
    .from('agent_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (updateError) {
    throw new BadRequestError('Failed to revoke key');
  }

  res.json({ message: 'Agent access revoked' });
});

export const authenticateApiKey = async function(apiKey: string): Promise<string | null> {
  if (!apiKey.startsWith('pk_live_')) {
    return null;
  }

  const { data, error } = await supabase
    .from('agent_keys')
    .select('user_id, expires_at, revoked_at')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) {
    return null;
  }
  if (data.revoked_at) {
    return null;
  }
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  await supabase
    .from('agent_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key', apiKey);

  return data.user_id;
};

export const createKeyDirect = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { agent_id, name } = req.body;
  if (!agent_id) {
    throw new BadRequestError('Agent ID is required');
  }

  const apiKey = generateApiKey();

  const { error: insertError } = await supabase
    .from('agent_keys')
    .insert({
      user_id: userId,
      agent_id: agent_id,
      api_key: apiKey,
      scope: ['read', 'write'],
    });

  if (insertError) {
    throw new BadRequestError('Failed to create API key');
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('name')
    .eq('id', agent_id)
    .single();

  res.json({
    message: 'API key created for ' + (agent?.name || 'agent'),
    api_key: apiKey,
    name: name || agent?.name || 'API Key',
    scope: ['read', 'write'],
  });
});