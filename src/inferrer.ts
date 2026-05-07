import { IntentSignal } from './models/intent_signal';
import { ProductiveLane, IntentGoal, initDefaults } from './models/productive_lane';
import { PlatoObserver } from './observers/plato_observer';
import { NavigationObserver } from './observers/navigation_observer';
import { DeliberationObserver } from './observers/deliberation_observer';
import { MurmurObserver } from './observers/murmur_observer';

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

/**
 * Inferrer: the core inference engine.
 * Takes raw signals, produces ProductiveLane model.
 */
export class Inferrer {
  private navObserver: NavigationObserver;
  private deliberationObserver: DeliberationObserver;
  private murmurObserver: MurmurObserver;

  constructor() {
    this.navObserver = new NavigationObserver();
    this.deliberationObserver = new DeliberationObserver();
    this.murmurObserver = new MurmurObserver();
  }

  /**
   * Run full inference cycle: fetch signals, update lane, return diff.
   */
  async infer(sinceTimestamp?: number): Promise<{lane: ProductiveLane; newSignals: IntentSignal[]}> {
    // 1. Fetch signals from all observers
    const navSignals = await this.navObserver.fetchNavigationSignals(sinceTimestamp);
    const deliberationSignals = await this.deliberationObserver.fetchDeliberationSignals(sinceTimestamp);
    const murmurSignals = await this.murmurObserver.fetchMurmurSignals(sinceTimestamp);

    // Also fetch from plato observer for tile_read and other signals
    const platoObserver = new PlatoObserver();
    const platoSignals = await platoObserver.fetchAllSignals(sinceTimestamp);

    // Combine all signals
    const allSignals = [...navSignals, ...deliberationSignals, ...murmurSignals, ...platoSignals];
    allSignals.sort((a, b) => a.timestamp - b.timestamp);

    // 2. Build lane from signals
    const lane = await this.inferLane(allSignals);

    // 3. Return lane + new signals (not already in stored model)
    return { lane, newSignals: allSignals };
  }

  /**
   * Core inference algorithm.
   */
  async inferLane(signals: IntentSignal[]): Promise<ProductiveLane> {
    const lane = initDefaults();

    // 1. Score theorem engagement
    for (const signal of signals) {
      if (signal.type === 'page_view') {
        const page = (signal.payload as {page: string}).page;
        const theorems = PAGE_TO_THEOREMS[page] || [];
        theorems.forEach(t => lane.preferred_theorems.push(t));
      }
      if (signal.type === 'murmur_expand') {
        const theorem = (signal.payload as {theorem: string}).theorem;
        lane.preferred_theorems.push(theorem);
      }
    }

    // 2. Score strategy preference
    for (const signal of signals) {
      if (signal.type === 'murmur_expand') {
        const strategy = (signal.payload as {strategy?: string}).strategy;
        if (strategy) lane.preferred_strategies.push(strategy);
      }
    }

    // 3. Detect override patterns
    lane.override_patterns = this.deliberationObserver.detectOverridePatterns(signals);

    // 4. Detect peak hours
    lane.peak_hours = detectPeakHours(signals);

    // 5. Detect avoided topics
    lane.avoided_topics = this.murmurObserver.detectAvoidedTopics(signals);

    // 6. Score goals
    lane.primary_goals = this.scoreGoals(lane);

    // 7. Compute navigation pattern
    const navMetrics = await this.navObserver.computeMetrics(signals);
    lane.navigation_pattern = {
      avg_session_duration: navMetrics.avgSessionDuration,
      pages_per_session: navMetrics.pagesPerSession,
      most_visited: navMetrics.mostVisited,
    };

    // 8. Compute confidence (more signals = higher confidence)
    lane.confidence = Math.min(1.0, signals.length / 50);

    // 9. Store raw evidence (keep last 100 signals)
    lane.evidence = signals.slice(-100);
    lane.updated_at = Date.now();

    return lane;
  }

  /**
   * Score goals from lane preferences.
   */
  private scoreGoals(lane: ProductiveLane): IntentGoal[] {
    const goalScores: Record<string, number> = {};

    // "understand X" goals get boosted by theorem engagement + page views
    for (const theorem of lane.preferred_theorems) {
      const goal = `understand_${theorem}`;
      goalScores[goal] = (goalScores[goal] || 0) + 1;
    }

    // "fix X" goals get boosted by override patterns (weight more)
    for (const override of lane.override_patterns) {
      const goal = `fix_${override}`;
      goalScores[goal] = (goalScores[goal] || 0) + 2;
    }

    return Object.entries(goalScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([goal, score]) => ({
        goal,
        engagement_score: Math.min(1.0, score / 10),
        last_engaged: Date.now(),
        supporting_signals: score,
        status: 'active' as const,
      }));
  }
}

/**
 * Detect peak hours from signal timestamps.
 */
function detectPeakHours(signals: IntentSignal[]): number[] {
  const hourCounts: number[] = new Array(24).fill(0);

  for (const signal of signals) {
    const hour = new Date(signal.timestamp).getUTCHours();
    hourCounts[hour]++;
  }

  // Return hours with above-average activity
  const avg = hourCounts.reduce((a, b) => a + b, 0) / 24;
  const peakHours: number[] = [];
  
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] > avg * 1.5) {
      peakHours.push(i);
    }
  }

  return peakHours;
}

/**
 * Extract theorem from goal string.
 */
export function extractTheorem(goal: string): string {
  if (goal.startsWith('understand_')) {
    return goal.replace('understand_', '');
  }
  if (goal.startsWith('fix_')) {
    return goal.replace('fix_', '');
  }
  return goal;
}