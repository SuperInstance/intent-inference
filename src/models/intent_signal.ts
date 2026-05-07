export type SignalType =
  | 'page_view'
  | 'tile_read'
  | 'captain_override'
  | 'captain_confirm'
  | 'murmur_expand'
  | 'murmur_skip'
  | 'text_deleted'
  | 'navigation_away';

export interface IntentSignal {
  timestamp: number;
  type: SignalType;
  payload: Record<string, unknown>;
}

export interface PageViewPayload {
  page: string;
  duration: number; // seconds
  tiles_read?: number;
}

export interface CaptainOverridePayload {
  count: number;
  topics?: string[];
}

export interface MurmurExpandPayload {
  theorem: string;
  strategy?: string;
}

export interface TextDeletedPayload {
  text: string;
  page: string;
}

export interface NavigationAwayPayload {
  from_page: string;
  to_page?: string;
}