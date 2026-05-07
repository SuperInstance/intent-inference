import { IntentSignal } from './intent_signal';

export type GoalStatus = 'active' | 'dormant' | 'completed';

export interface IntentGoal {
  goal: string; // e.g. "understand_emergence", "fix_trust_convergence"
  engagement_score: number; // 0-1
  last_engaged: number; // timestamp
  supporting_signals: number;
  status: GoalStatus;
}

export interface NavigationPattern {
  avg_session_duration: number;
  pages_per_session: number;
  most_visited: string[];
}

export interface ProductiveLane {
  user_id: string;
  updated_at: number;
  primary_goals: IntentGoal[];
  avoided_topics: string[];
  navigation_pattern: NavigationPattern;
  peak_hours: number[]; // 0-23 UTC
  preferred_theorems: string[];
  preferred_strategies: string[];
  override_patterns: string[];
  confidence: number; // 0-1
  evidence: IntentSignal[];
}

export function initDefaults(userId: string = 'default'): ProductiveLane {
  return {
    user_id: userId,
    updated_at: Date.now(),
    primary_goals: [],
    avoided_topics: [],
    navigation_pattern: {
      avg_session_duration: 0,
      pages_per_session: 0,
      most_visited: [],
    },
    peak_hours: [],
    preferred_theorems: [],
    preferred_strategies: [],
    override_patterns: [],
    confidence: 0,
    evidence: [],
  };
}

export interface StoredLane {
  version: number;
  updated_at: number;
  lane: ProductiveLane;
}