# intent-inference

**Reverse-engineers productive lane from agent behavior.**

Part of the reverse-actualization pipeline. When an agent works, something went right. This repo figures out what, and how to repeat it.

## What It Does

Monitors agent behavior across the Cocapn Fleet and infers the *intent* behind successful actions. Not motivation — structure. Given a sequence of actions that produced a verified output, what constraints were implicitly satisfied? What lock algebra patterns emerged?

## Why It Matters

You can't improve what you don't measure. Intent inference closes the loop: agents act → fleet observes → intents are extracted → protocol improves → agents act better.

## The Core Idea

Every successful action is a constraint that was satisfied. Intent inference makes those constraints explicit so the fleet can compile them.

## Fleet Context

- **Upstream**: [flux-research](https://github.com/SuperInstance/flux-research) — lock algebra and constraint theory
- **Downstream**: [purplepincher](https://github.com/SuperInstance/purplepincher) — PLATO tile compilation
- **Parent**: [forgemaster](https://github.com/SuperInstance/forgemaster)

## Status

Active research. Contributions welcome — open an issue with a behavior trace.
