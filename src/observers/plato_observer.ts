import { IntentSignal } from '../models/intent_signal';

// Pages mapped to theorems they likely involve
const PAGE_TO_THEOREMS: Record<string, string[]> = {
  'fleet-spread': ['emergence', 'collective_behavior'],
  'plato-dashboard': ['graph_theory', 'rigidity'],
  'murmur-insights': ['information_theory', 'pattern_detection'],
  'captain-deliberation': ['decision_theory', 'constraint_satisfaction'],
  'trust-convergence': ['convergence', 'distributed_systems'],
  'rigidity-viewer': ['laman_rigidity', 'bar_joint'],
  'constraint-satisfaction': ['constraint_satisfaction', 'graph_coloring'],
};

export function pageToTheorems(page: string): string[] {
  return PAGE_TO_THEOREMS[page] || [];
}

/**
 * PlatoObserver: reads signals from PLATO rooms.
 * The engine reads intent_signal tiles from various rooms.
 */
export class PlatoObserver {
  private readonly apiBase: string;

  constructor(apiBase: string = 'http://localhost:8847') {
    this.apiBase = apiBase;
  }

  async fetchSignals(room: string, sinceTimestamp?: number): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    try {
      // PLATO: GET /room/{room} returns {tiles: [...], tile_count: N}
      const url = `${this.apiBase}/room/${room}`;

      const response = await fetch(url);
      if (!response.ok) return signals;

      const data = await response.json() as { tiles?: Array<{question?: string; answer?: string; timestamp?: number}> };
      const tiles = data.tiles || [];
      
      for (const tile of tiles) {
        const signal = this.parseTile(tile, room);
        if (signal) signals.push(signal);
      }
    } catch (error) {
      console.error(`[PlatoObserver] Failed to fetch ${room}: ${error}`);
    }

    return signals;
  }

  private parseTile(tile: {question?: string; answer?: string; timestamp?: number}, room: string): IntentSignal | null {
    if (!tile.question) return null;

    // Parse user_focus tiles from browser agent
    if (room === 'user_focus' && tile.question.startsWith('page_view:')) {
      const parts = tile.question.split(' ');
      const duration = parseInt(parts.find(p => p.startsWith('duration:'))?.split(':')[1] || '0', 10);
      const page = parts.find(p => p.startsWith('page:'))?.split(':')[1] || 'unknown';
      
      return {
        timestamp: tile.timestamp || Date.now(),
        type: 'page_view',
        payload: { page, duration },
      };
    }

    // Parse tile_read from PLATO client
    if (tile.question.startsWith('tile_read:')) {
      const tilesRead = parseInt(tile.question.split('tiles:')[1] || '1', 10);
      return {
        timestamp: tile.timestamp || Date.now(),
        type: 'tile_read',
        payload: { tiles: tilesRead, room },
      };
    }

    return null;
  }

  async fetchAllSignals(sinceTimestamp?: number): Promise<IntentSignal[]> {
    const rooms = ['user_focus', 'plato_tiles', 'captain_decisions', 'murmur_insights'];
    const allSignals: IntentSignal[] = [];

    for (const room of rooms) {
      const signals = await this.fetchSignals(room, sinceTimestamp);
      allSignals.push(...signals);
    }

    // Sort by timestamp
    allSignals.sort((a, b) => a.timestamp - b.timestamp);
    return allSignals;
  }
}