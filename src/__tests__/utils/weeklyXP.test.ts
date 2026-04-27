import { supabase } from '../../lib/supabaseClient';

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return { select: mockSelect, insert: mockInsert, update: mockUpdate, eq: mockEq, maybeSingle: mockMaybeSingle };
    },
  },
}));

import { bumpWeeklyXP } from '../../utils/weeklyXP';

describe('bumpWeeklyXP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnThis();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
  });

  it('does nothing if xpAmount is 0 or negative', async () => {
    await bumpWeeklyXP('user-1', 0);
    await bumpWeeklyXP('user-1', -5);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates existing weekly progress row', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'row-1', weekly_xp: 50 }, error: null });
    mockUpdate.mockResolvedValue({ error: null });

    await bumpWeeklyXP('user-1', 30);

    expect(mockFrom).toHaveBeenCalledWith('weekly_challenge_progress');
    expect(mockUpdate).toHaveBeenCalledWith({ weekly_xp: 80, claimed_tiers: undefined });
  });

  it('inserts new row if none exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    await bumpWeeklyXP('user-1', 30);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', weekly_xp: 30 })
    );
  });

  it('does not throw on supabase error (fire-and-forget)', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('DB error'));
    await expect(bumpWeeklyXP('user-1', 30)).resolves.toBeUndefined();
  });
});
