import { Inferrer } from './inferrer';
import { FleetBridge } from './fleet_bridge';
import { Storage } from './storage';
import { initDefaults } from './models/productive_lane';

const POLL_INTERVAL_MS = 60_000; // 1 minute

async function main() {
  console.log('[IntentInference] Starting engine...');

  const inferrer = new Inferrer();
  const fleetBridge = new FleetBridge();
  const storage = new Storage();

  // Load existing lane or create fresh
  let lane = storage.load() || initDefaults('casey');
  let lastUpdate = storage.getLastUpdate();

  console.log(`[IntentInference] Loaded lane (confidence: ${lane.confidence.toFixed(2)}, goals: ${lane.primary_goals.length})`);

  // Main loop
  while (true) {
    try {
      // Run inference
      const { lane: newLane, newSignals } = await inferrer.infer(lastUpdate || undefined);

      // If we got new signals, update lane
      if (newSignals.length > 0) {
        // Merge: keep existing evidence, append new
        const mergedEvidence = [...lane.evidence, ...newSignals].slice(-100);
        lane = {
          ...newLane,
          evidence: mergedEvidence,
        };

        // Save updated lane
        storage.save(lane);

        // Tell fleet what to work on
        await fleetBridge.tellFleetWhatToWorkOn(lane);

        console.log(`[IntentInference] Processed ${newSignals.length} new signals, confidence: ${lane.confidence.toFixed(2)}`);
        
        // Update lastUpdate to current time (don't re-process signals we just saw)
        lastUpdate = Date.now();
      } else {
        console.log('[IntentInference] No new signals');
      }
    } catch (error) {
      console.error(`[IntentInference] Error in inference cycle: ${error}`);
    }

    // Sleep until next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(error => {
  console.error('[IntentInference] Fatal error:', error);
  process.exit(1);
});