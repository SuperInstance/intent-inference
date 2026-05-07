import { IntentSignal } from '../models/intent_signal';
import { PlatoObserver } from './plato_observer';

export interface NavigationMetrics {
  avgSessionDuration: number;
  pagesPerSession: number;
  mostVisited: string[];
  navigationAwayCount: number;
}

/**
 * NavigationObserver: tracks browser navigation patterns.
 * Reads from PLATO tiles submitted by browser agent.
 */
export class NavigationObserver {
  private observer: PlatoObserver;
  private lastTimestamp: number = 0;

  constructor(observer?: PlatoObserver) {
    this.observer = observer || new PlatoObserver();
  }

  async fetchNavigationSignals(since?: number): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    try {
      const url = since
        ? `http://localhost:8847/room/navigation`
        : 'http://localhost:8847/room/navigation';

      const response = await fetch(url);
      if (!response.ok) return signals;

      const data = await response.json() as { tiles?: Array<{question?: string; timestamp?: number}> }; const tiles = data.tiles || [];

      for (const tile of tiles) {
        if (!tile.question) continue;

        // Parse navigation_away signals
        if (tile.question.startsWith('nav_away:')) {
          const parts = tile.question.split(' ');
          const fromPage = parts.find(p => p.startsWith('from:'))?.split(':')[1] || 'unknown';
          const toPage = parts.find(p => p.startsWith('to:'))?.split(':')[1];

          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'navigation_away',
            payload: { from_page: fromPage, to_page: toPage },
          });
        }

        // Parse page_view signals from browser agent
        if (tile.question.startsWith('page_view:')) {
          const parts = tile.question.split(' ');
          const page = parts.find(p => p.startsWith('page:'))?.split(':')[1] || 'unknown';
          const duration = parseInt(parts.find(p => p.startsWith('duration:'))?.split(':')[1] || '0', 10);

          signals.push({
            timestamp: tile.timestamp || Date.now(),
            type: 'page_view',
            payload: { page, duration },
          });
        }
      }
    } catch (error) {
      console.error(`[NavigationObserver] Failed to fetch navigation signals: ${error}`);
    }

    return signals;
  }

  async computeMetrics(signals: IntentSignal[]): Promise<NavigationMetrics> {
    const pageViews = signals.filter(s => s.type === 'page_view');
    const navAways = signals.filter(s => s.type === 'navigation_away');

    // Group by sessions (30 min gap = new session)
    const sessions = this.groupIntoSessions(pageViews);

    const durations = sessions.map(s => {
      if (s.length < 2) return 0;
      return (s[s.length - 1].timestamp - s[0].timestamp) / 1000;
    });

    const pageCounts = sessions.map(s => s.length);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const avgPages = pageCounts.length > 0
      ? pageCounts.reduce((a, b) => a + b, 0) / pageCounts.length
      : 0;

    // Most visited pages
    const pageCountsMap: Record<string, number> = {};
    for (const pv of pageViews) {
      const page = (pv.payload as {page: string}).page;
      pageCountsMap[page] = (pageCountsMap[page] || 0) + 1;
    }
    const mostVisited = Object.entries(pageCountsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page]) => page);

    return {
      avgSessionDuration: avgDuration,
      pagesPerSession: avgPages,
      mostVisited,
      navigationAwayCount: navAways.length,
    };
  }

  private groupIntoSessions(signals: IntentSignal[]): IntentSignal[][] {
    const sessions: IntentSignal[][] = [];
    let currentSession: IntentSignal[] = [];
    let lastTimestamp = 0;

    for (const signal of signals) {
      const gap = signal.timestamp - lastTimestamp;
      if (gap > 30 * 60 * 1000 && currentSession.length > 0) {
        // 30 min gap = new session
        sessions.push(currentSession);
        currentSession = [];
      }
      currentSession.push(signal);
      lastTimestamp = signal.timestamp;
    }

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    return sessions;
  }
}