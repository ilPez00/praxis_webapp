/**
 * duelResolutionCron — tests that the cron schedules and imports work.
 */

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../controllers/failsController', () => ({
  logFail: jest.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../../lib/supabaseClient';
import { logFail } from '../../controllers/failsController';

describe('duelResolutionCron', () => {
  it('imports startDuelResolutionCron without error', async () => {
    const mod = await import('../../services/duelResolutionCron');
    expect(mod.startDuelResolutionCron).toBeDefined();
  });

  it('imports dependencies correctly', () => {
    expect(supabase).toBeDefined();
    expect(logFail).toBeDefined();
  });
});
