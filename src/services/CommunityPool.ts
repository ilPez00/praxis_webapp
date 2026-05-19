import { supabase } from '../lib/supabaseClient';

export interface SterileFlow {
  will: string;
  action: string;
  effect: string;
  grade: string;
  outcome: string;
  domain: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Compact heuristic vector: [grade_norm, effect_density, outcome_density]
function flowToVector(flow: SterileFlow): number[] {
  const gradeNum = parseFloat(flow.grade) || 0;
  return [
    Math.min(gradeNum / 10, 1),
    Math.min(flow.effect.length  / 200, 1),
    Math.min(flow.outcome.length / 200, 1),
  ];
}

export class CommunityPool {
  /** Strip any remaining identifiers and persist to community_flows. */
  async push(flow: SterileFlow, domain: string): Promise<void> {
    const sterile: SterileFlow = {
      will:    flow.will.slice(0, 120),
      action:  flow.action.slice(0, 200),
      effect:  flow.effect.slice(0, 200),
      grade:   flow.grade,
      outcome: flow.outcome.slice(0, 200),
      domain,
    };
    const { error } = await supabase.from('community_flows').insert(sterile);
    if (error) throw new Error(`CommunityPool.push failed: ${error.message}`);
  }

  /**
   * Retrieve k flows for domain.
   * tailored: ranked by cosine similarity to userVector.
   * generic:  random sample — no push required for caller.
   */
  async retrieve(
    domain: string,
    userVector: number[],
    k: number,
    mode: 'tailored' | 'generic',
  ): Promise<SterileFlow[]> {
    if (mode === 'generic') {
      const { data } = await supabase
        .from('community_flows')
        .select('will, action, effect, grade, outcome, domain')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(k * 4);
      const rows = (data || []) as SterileFlow[];
      return rows.sort(() => Math.random() - 0.5).slice(0, k);
    }

    const { data } = await supabase
      .from('community_flows')
      .select('will, action, effect, grade, outcome, domain')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(k * 10);

    const rows = (data || []) as SterileFlow[];
    return rows
      .map(f => ({ flow: f, score: cosineSimilarity(userVector, flowToVector(f)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(x => x.flow);
  }
}
