import { IntentSignal } from '../models/intent_signal';

/**
 * MurmurObserver: tracks which insights user expands vs skips.
 * Reads from murmur_insights room in PLATO.
 */
export class MurmurObserver {
  async fetchMurmurSignals(since?: number): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    try {
      const url = since
        ? `http://localhost:8847/room/murmur_insights`
        : 'http://localhost:8847/room/murmur_insights';

      const response = await fetch(url);
      if (!response.ok) return signals;

      const data = await response.json() as { tiles?: Array<{question?: string; answer?: string; timestamp?: number}> }; const tiles = data.tiles || [];

      for (const tile of tiles) {
        if (!tile.question) continue;

        // Parse murmur_expand signals
        if (tile.question.startsWith('expand:')) {
          const parts = tile.question.split(' ');
          const theorem = parts.find(p => p.startsWith('theorem:'))?.split(':')[1] || 'unknown';
          const strategy = parts.find(p => p.startsWith('strategy:'))?.split(':')[1];

          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'murmur_expand',
            payload: { theorem, strategy },
          });
        }

        // Parse murmur_skip signals
        if (tile.question.startsWith('skip:')) {
          const parts = tile.question.split(' ');
          const theorem = parts.find(p => p.startsWith('theorem:'))?.split(':')[1] || 'unknown';

          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'murmur_skip',
            payload: { theorem },
          });
        }
      }
    } catch (error) {
      console.error(`[MurmurObserver] Failed to fetch murmur signals: ${error}`);
    }

    return signals;
  }

  /**
   * Extract preferred theorems from murmur engagement.
   */
  extractPreferredTheorems(signals: IntentSignal[]): string[] {
    const theorems: string[] = [];

    for (const signal of signals) {
      if (signal.type === 'murmur_expand') {
        const theorem = (signal.payload as {theorem: string}).theorem;
        theorems.push(theorem);
      }
    }

    return theorems;
  }

  /**
   * Extract preferred strategies from murmur engagement.
   */
  extractPreferredStrategies(signals: IntentSignal[]): string[] {
    const strategies: string[] = [];

    for (const signal of signals) {
      if (signal.type === 'murmur_expand') {
        const strategy = (signal.payload as {strategy?: string}).strategy;
        if (strategy) strategies.push(strategy);
      }
    }

    return strategies;
  }

  /**
   * Detect topics user consistently ignores (avoided topics).
   */
  detectAvoidedTopics(signals: IntentSignal[]): string[] {
    const expandCounts: Record<string, number> = {};
    const skipCounts: Record<string, number> = {};

    for (const signal of signals) {
      const theorem = (signal.payload as {theorem: string}).theorem;
      
      if (signal.type === 'murmur_expand') {
        expandCounts[theorem] = (expandCounts[theorem] || 0) + 1;
      } else if (signal.type === 'murmur_skip') {
        skipCounts[theorem] = (skipCounts[theorem] || 0) + 1;
      }
    }

    // Topic is "avoided" if skipped 3+ times and expanded < skip count
    const avoided: string[] = [];
    for (const theorem of Object.keys(skipCounts)) {
      const skips = skipCounts[theorem] || 0;
      const expands = expandCounts[theorem] || 0;
      
      if (skips >= 3 && expands < skips) {
        avoided.push(theorem);
      }
    }

    return avoided;
  }

  /**
   * Compute engagement score for a theorem.
   */
  theoremEngagementScore(signals: IntentSignal[], theorem: string): number {
    const theoremSignals = signals.filter(s => {
      const p = s.payload as {theorem?: string};
      return p.theorem === theorem;
    });

    const expands = theoremSignals.filter(s => s.type === 'murmur_expand').length;
    const skips = theoremSignals.filter(s => s.type === 'murmur_skip').length;
    const total = expands + skips;

    if (total === 0) return 0;
    return expands / total;
  }
}