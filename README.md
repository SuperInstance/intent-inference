# intent-inference

[![CI](https://github.com/SuperInstance/intent-inference/actions/workflows/ci.yml/badge.svg)](https://github.com/SuperInstance/intent-inference/actions/workflows/ci.yml)

**Infers user intent from navigation, murmur, PLATO, and deliberation signals.**

While [constraint-inference](https://github.com/SuperInstance/constraint-inference) learns constraint boundaries from user overrides, this service learns what the user is *trying to do* from their behavior patterns.

## What It Does

The intent inference engine observes multiple signal sources and maintains a **productive lane** — a model of the user's current goals, priorities, and confidence levels.

```
Navigation → Where are they clicking/visiting?
Murmur     → What are they saying in fleet chat?
PLATO      → What rooms are they reading/writing?
Deliberation → What decisions are they participating in?
     ↓
  Productive Lane
  - primary_goals: [...]
  - confidence: 0.87
  - evidence: [...]
     ↓
  Fleet Bridge → tell agents what to work on
```

## Architecture

```
src/
├── observers/
│   ├── navigation_observer.ts    — Tracks page/room visits
│   ├── murmur_observer.ts        — Monitors fleet chat signals
│   ├── plato_observer.ts         — Tracks PLATO room activity
│   └── deliberation_observer.ts  — Tracks decision participation
├── models/
│   ├── productive_lane.ts        — Goal/confidence/evidence model
│   └── intent_signal.ts          — Signal type + strength
├── inferrer.ts                   — Core inference engine
├── fleet_bridge.ts               — Push goals to fleet agents
├── storage.ts                    — Persist lane state
└── index.ts                      — Main loop (1-minute poll)
```

### Productive Lane

The core data structure — a living model of what the user cares about right now:

```typescript
{
  confidence: 0.87,
  primary_goals: ["ship dodecet-encoder", "fix fleet services"],
  evidence: [
    { signal: "navigation", strength: 0.9, topic: "dodecet-encoder", ts: "..." },
    { signal: "murmur", strength: 0.7, topic: "fleet services down", ts: "..." },
    // ...last 100 signals
  ]
}
```

### Fleet Bridge

When the lane updates, the fleet bridge tells agents what to prioritize. This is how the fleet knows what the human wants without being asked explicitly.

## Why This Matters

The fleet has 9 agents. Without intent inference, they'd all do what they think is best. With intent inference, they align around what the human actually cares about *right now*.

This is **anticipatory alignment** — the fleet starts working on what you need before you ask.

## Usage

```bash
npm install
npm start
```

Polls every 60 seconds. Merges new signals into the lane. Pushes updates to fleet.

## Ecosystem

- **constraint-inference** — Complementary: learns constraints from overrides
- **flux-lucid** — Intent vectors and navigation metaphors
- **fleet-murmur** — Signal source (fleet chat)
- **dodecet-encoder** — Consumer: lighthouse uses intent for task routing

## License

MIT
