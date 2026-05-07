import { ProductiveLane, StoredLane } from './models/productive_lane';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'intent-inference');
const LANE_FILE = path.join(CONFIG_DIR, 'lane_model.json');
const CURRENT_VERSION = 1;

export class Storage {
  /**
   * Load lane model from disk.
   */
  load(): ProductiveLane | null {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        return null;
      }

      if (!fs.existsSync(LANE_FILE)) {
        return null;
      }

      const raw = fs.readFileSync(LANE_FILE, 'utf-8');
      const stored: StoredLane = JSON.parse(raw);

      if (stored.version !== CURRENT_VERSION) {
        console.warn(`[Storage] Lane version mismatch (${stored.version} vs ${CURRENT_VERSION}), migrating...`);
        // For now, just return the lane (migration logic can be added later)
      }

      console.log(`[Storage] Loaded lane model (confidence: ${stored.lane.confidence.toFixed(2)})`);
      return stored.lane;
    } catch (error) {
      console.error(`[Storage] Failed to load lane model: ${error}`);
      return null;
    }
  }

  /**
   * Save lane model to disk.
   */
  save(lane: ProductiveLane): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      const stored: StoredLane = {
        version: CURRENT_VERSION,
        updated_at: Date.now(),
        lane,
      };

      fs.writeFileSync(LANE_FILE, JSON.stringify(stored, null, 2));
      console.log(`[Storage] Saved lane model (confidence: ${lane.confidence.toFixed(2)})`);
    } catch (error) {
      console.error(`[Storage] Failed to save lane model: ${error}`);
    }
  }

  /**
   * Get last update timestamp.
   */
  getLastUpdate(): number {
    try {
      if (!fs.existsSync(LANE_FILE)) {
        return 0;
      }
      const raw = fs.readFileSync(LANE_FILE, 'utf-8');
      const stored: StoredLane = JSON.parse(raw);
      return stored.updated_at;
    } catch {
      return 0;
    }
  }
}