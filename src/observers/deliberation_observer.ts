import { IntentSignal } from '../models/intent_signal';

/**
 * DeliberationObserver: tracks how user responds to captain decisions.
 * Reads from fleet-spread tiles or captain_decisions room.
 */
export class DeliberationObserver {
  async fetchDeliberationSignals(since?: number): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    try {
      const url = since
        ? `http://localhost:8847/room/captain_decisions?since=${since}`
        : 'http://localhost:8847/room/captain_decisions';

      const response = await fetch(url);
      if (!response.ok) return signals;

      const data = await response.json() as { tiles?: Array<{question?: string; answer?: string; timestamp?: number}> }; const tiles = data.tiles || [];

      for (const tile of tiles) {
        if (!tile.question) continue;

        // Parse captain_override signals
        if (tile.question.startsWith('override:')) {
          const parts = tile.question.split(' ');
          const count = parseInt(parts.find(p => p.startsWith('count:'))?.split(':')[1] || '1', 10);
          const topics = parts.find(p => p.startsWith('topics:'))?.split(':')[1]?.split(',');

          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'captain_override',
            payload: { count, topics: topics || [] },
          });
        }

        // Parse captain_confirm signals
        if (tile.question.startsWith('confirm:')) {
          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'captain_confirm',
            payload: {},
          });
        }
      }
    } catch (error) {
      console.error(`[DeliberationObserver] Failed to fetch deliberation signals: ${error}`);
    }

    return signals;
  }

  /**
   * Detect constraint adjustment patterns.
   * Returns list of constraint topics the user keeps overriding.
   */
  detectOverridePatterns(signals: IntentSignal[]): string[] {
    const overrideSignals = signals.filter(s => s.type === 'captain_override');
    
    // Count how many times each topic was overridden
    const topicCounts: Record<string, number> = {};
    for (const signal of overrideSignals) {
      const payload = signal.payload as {topics?: string[]};
      if (payload.topics) {
        for (const topic of payload.topics) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    }

    // Return topics overridden 2+ times (pattern, not noise)
    return Object.entries(topicCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);
  }

  /**
   * Compute override-to-confirm ratio.
   * High ratio = user is actively steering, not just rubber-stamping.
   */
  computeSteeringRatio(signals: IntentSignal[]): number {
    const overrides = signals.filter(s => s.type === 'captain_override').length;
    const confirms = signals.filter(s => s.type === 'captain_confirm').length;
    const total = overrides + confirms;
    
    if (total === 0) return 0;
    return overrides / total;
  }
}