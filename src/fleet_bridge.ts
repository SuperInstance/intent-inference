import { ProductiveLane, IntentGoal } from './models/productive_lane';
import { extractTheorem } from './inferrer';

const PLATO_API = 'http://localhost:8847';

/**
 * FleetBridge: tells the fleet what to work on based on inferred lane.
 */
export class FleetBridge {
  private lastGoal: IntentGoal | null = null;

  /**
   * Tell the fleet what to work on based on the current lane.
   */
  async tellFleetWhatToWorkOn(lane: ProductiveLane): Promise<void> {
    const topGoal = lane.primary_goals[0];

    if (!topGoal || topGoal.engagement_score < 0.5) {
      console.log('[FleetBridge] No high-confidence goal to broadcast');
      return;
    }

    // Check if goal changed significantly
    if (this.lastGoal && topGoal.goal === this.lastGoal.goal) {
      const scoreDelta = Math.abs(topGoal.engagement_score - this.lastGoal.engagement_score);
      if (scoreDelta < 0.1) {
        // No significant change, skip broadcast
        return;
      }
    }

    this.lastGoal = topGoal;

    // 1. Write goal tile to PLATO intent_signals room
    await this.writeGoalTile(topGoal, lane);

    // 2. If confidence > 0.7, tell murmur worker to focus
    if (lane.confidence > 0.7) {
      await this.focusMurmurWorker(topGoal, lane);
    }

    // 3. If confidence > 0.85, alert Casey (via Telegram)
    if (topGoal.engagement_score > 0.85) {
      await this.alertCasey(topGoal, lane);
    }

    console.log(`[FleetBridge] Broadcast: ${topGoal.goal} (confidence: ${topGoal.engagement_score.toFixed(2)})`);
  }

  private async writeGoalTile(goal: IntentGoal, lane: ProductiveLane): Promise<void> {
    try {
      // Read current intent_signals room to get existing tiles count
      const roomResponse = await fetch(`${PLATO_API}/room/intent_signals_history`);
      const existingTiles = roomResponse.ok ? await roomResponse.json() as Array<unknown> : [];
      const tileId = existingTiles.length + 1;

      const question = `current_goal:${goal.goal} confidence:${goal.engagement_score.toFixed(2)}`;
      const answer = `Fleet inferred to focus on: ${goal.goal}. Supporting signals: ${goal.supporting_signals}. Recommended work: run ${lane.preferred_strategies[0] || 'EXPLORE'} on ${extractTheorem(goal.goal)}.`;

      const tile = {
        id: `intent-signal-${Date.now()}`,
        question,
        answer,
        confidence: goal.engagement_score,
        timestamp: Date.now(),
      };

      const response = await fetch(`${PLATO_API}/room/intent_signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tile),
      });

      if (!response.ok) {
        console.error(`[FleetBridge] Failed to write goal tile: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[FleetBridge] Error writing goal tile: ${error}`);
    }
  }

  private async focusMurmurWorker(goal: IntentGoal, lane: ProductiveLane): Promise<void> {
    try {
      const theorem = extractTheorem(goal.goal);
      const strategy = lane.preferred_strategies[0] || 'EXPLORE';

      const focusTile = {
        id: `murmur-focus-${Date.now()}`,
        question: `focus:${theorem} strategy:${strategy}`,
        answer: `Murmur worker directed to focus on ${theorem} using ${strategy} strategy. Confidence: ${lane.confidence.toFixed(2)}`,
        timestamp: Date.now(),
      };

      await fetch(`${PLATO_API}/room/murmur_directives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(focusTile),
      });

      console.log(`[FleetBridge] Directed murmur worker to ${theorem} (${strategy})`);
    } catch (error) {
      console.error(`[FleetBridge] Error focusing murmur worker: ${error}`);
    }
  }

  private async alertCasey(goal: IntentGoal, lane: ProductiveLane): Promise<void> {
    // This would be handled by the main agent via Telegram
    // For now, write to a briefing room that the main agent monitors
    try {
      const briefing = {
        id: `briefing-${Date.now()}`,
        question: `briefing:${goal.goal}`,
        answer: `You've been focused on: ${goal.goal}. Fleet is working on it. Supporting signals: ${goal.supporting_signals}. Theorems: ${lane.preferred_theorems.slice(0, 3).join(', ')}`,
        timestamp: Date.now(),
      };

      await fetch(`${PLATO_API}/room/casey_briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefing),
      });

      console.log(`[FleetBridge] Posted briefing for Casey: ${goal.goal}`);
    } catch (error) {
      console.error(`[FleetBridge] Error posting briefing: ${error}`);
    }
  }
}