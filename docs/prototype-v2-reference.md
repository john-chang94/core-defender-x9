# Prototype V2 Reference

Snapshot date: `2026-04-08`

This document defines the redesign direction for the next shooter prototype. It is the working reference for the new arena-combat model, separate from the current falling-enemy prototype.

## Purpose

Prototype V2 exists to solve the main long-term limitations of the current prototype:

- too much difficulty comes from enemy HP inflation
- enemy identity is still too tied to shape and stat scaling
- late-game variety is limited
- the combat loop does not yet support richer enemy weapons, formations, and reactions

The new prototype changes the combat model instead of only extending the existing one.

## Core Redesign

### Current Prototype

- enemies fall downward from the top
- player loses when an enemy reaches the bottom
- pressure is driven mostly by crowding and health scaling

### Prototype V2

- enemies occupy the upper half of the board
- enemies move laterally and within bounded vertical space
- enemies can shoot at the player
- player loses when health reaches `0`
- pressure is driven by:
  - enemy composition
  - enemy movement
  - enemy projectile patterns
  - build decisions
  - tactical pickup usage

This is a real combat redesign, not just a content update.

## Design Pillars

### 1. Readable arena combat

The player should always understand:

- where enemies are allowed to move
- where projectiles are coming from
- what enemy is most dangerous right now
- how much safe space remains

### 2. Endless but evolving

The game should remain endless, but it cannot rely on “higher HP forever” as its main escalation tool.

Endless progression should come from:

- new enemy families entering the pool
- harder formations
- build evolution
- boss and mini-boss checkpoints
- biome/theme shifts
- rare pickups and utility spikes

### 3. Hybrid progression

The game should use multiple progression layers:

- tactical field drops during the run
- structured run upgrades
- long-term mastery across runs

This avoids overloading a single system.

### 4. Non-pay-to-win monetization

Monetization should focus on cosmetics, themes, and optional sidegrade content rather than raw stat advantages.

## Combat Space Rules

### Player space

- player ship stays in the lower half
- movement remains left/right only for now
- player fires automatically

### Enemy space

- enemies spawn above the screen and settle into the upper half
- enemies should not move lower than roughly `45-50%` of the board height
- bosses may visually encroach slightly for tension, but the normal rule remains intact

### Threat model

- enemies are dangerous because they shoot, reposition, and combine with each other
- losing a run means taking too much damage, not letting a single body cross the bottom

## Health Model

Prototype V2 introduces player survivability as a first-class system.

### Initial direction

- `Hull` or health pool
- optional `Shield` on top of hull
- shield can regenerate if the player has not been hit recently
- enemy bullets damage shield first, then hull
- the run ends when hull reaches `0`

### Why this matters

This makes the player react to sustained combat pressure rather than only positional failure.

## Enemy Design Direction

The new prototype should separate enemy identity from raw health scaling.

## Initial enemy families

### Hover Shooter

- baseline ranged enemy
- moves left and right in the upper half
- fires slow single shots
- low to medium health

### Burst Striker

- moves into position
- pauses briefly
- fires a short spread or burst
- encourages player repositioning

### Tank Gunner

- slower and sturdier
- fires fewer but more dangerous shots
- acts as an anchor unit, not the default enemy

### Splitter

- breaks into weaker enemies on death
- good for target-priority pressure

## Later enemy candidates

- Orbiter
- Sniper
- Bomber
- Support/Shield unit
- Summoner/Hive unit
- Suppression field enemy

## Enemy Density Rules

Because enemies now shoot back, density has to be capped more carefully than in the current prototype.

### Initial target limits

- active enemies: `6-8`
- late-game soft cap: `10-12`
- active enemy bullets: `12-20`

These are starting numbers, not final numbers.

The main escalation tool should be formations and behavior, not uncontrolled count.

## Weapon and Upgrade Philosophy

## High-level recommendation

Keep a hybrid system.

### Field pickups

These remain in the game, but shift to tactical functions:

- temporary overclocks
- shield repair
- emergency strikes
- temporary drones
- projectile clear pulses
- pickup magnet

These should create moment-to-moment tension and movement.

### Run upgrades

These become the main long-term in-run progression system.

Recommended triggers:

- every `2-3` tiers
- mini-boss clears
- boss clears
- salvage/resource thresholds

Recommended format:

- choose `1 of 3` armory cards

### Meta progression

Across runs, add mastery rather than in-run XP per build.

Good uses for mastery:

- unlock new upgrade cards
- unlock new enemy families
- unlock build evolutions
- unlock new cosmetic tracks
- unlock codex entries

## Upgrade categories

### Primary

- damage
- fire rate
- extra barrels
- spread / cone shaping
- precision bonuses

### Payload

- pierce
- explosive impact
- burn
- chain
- shatter
- armor break

### Support

- missiles
- drones
- orbitals
- mines
- interceptors

### Defense

- shield size
- repair
- bullet slow
- barrier pulse
- dodge burst

### Utility

- salvage gain
- pickup magnet
- ultimate charge
- rerolls
- cooldown reduction

## Build System Direction

The four main builds should carry forward, but their identities need to fit the new arena model.

### Rail Focus

- precision deletion of elite threats
- weakpoint / pierce / long-range identity

### Nova Bloom

- strongest primary-gun coverage
- anti-swarm and burn identity

### Missile Command

- lock-on and off-axis pressure
- strong against formations and evasive enemies

### Fracture Core

- fragment storms and area denial
- should either become much clearer visually or be replaced if the fantasy remains muddy

## Ultimate Direction

Ultimates should stay build-specific.

In V2, ultimates should also help solve bullet pressure and board control:

- targeted deletion
- projectile clearing
- formation disruption
- emergency breathing room

## Encounter Structure

Prototype V2 should keep the endless tier structure but evolve the encounter format.

### Recommended cadence

- every `2-3` tiers: upgrade checkpoint
- every `5` tiers: boss
- every `8-10` tiers: environment or enemy-pool shift
- ongoing: occasional special encounters or mini-bosses

### Example encounter types

- sniper formation
- swarm carrier rush
- suppression zone
- missile volley gauntlet
- salvage storm

## Boss Direction

Bosses should become pattern-driven rather than mostly health-driven.

Each boss should have:

- movement identity
- attack identity
- phase changes
- safe windows
- interaction with support enemies

Bosses should not simply be giant enemies with escorts.

## Technical Direction

## Separate third mode

Prototype V2 should live as its own third game screen rather than replacing the current prototype immediately.

Recommended app mode list:

- `Defender`
- `Prototype`
- `Arena Prototype` or `Prototype V2`

### Why

- preserves the current prototype for comparison
- reduces rewrite risk
- allows tuning V2 without destabilizing the current shooter

## Suggested file structure

- `/Users/johnchang/Desktop/defender/src/prototype-v2/types.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/config.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/engine.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaPrototypeScreen.tsx`

Possible future files:

- `/Users/johnchang/Desktop/defender/src/prototype-v2/enemies.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/upgrades.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/builds.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ultimates.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaCanvas.tsx`

## Renderer direction

Recommended long-term split:

- React Native:
  - shell UI
  - menus
  - modal flows
  - HUD
- Skia:
  - playfield
  - enemies
  - player projectiles
  - enemy projectiles
  - telegraphs
  - VFX

### Current implementation stance

It is acceptable to start the skeleton without a full Skia migration, but V2 makes Skia more valuable than before because:

- enemy bullets add another dense projectile layer
- enemy movement adds more simultaneous motion
- telegraphs and hit effects matter more
- the prototype needs room to grow visually

## Monetization Direction

Monetization should not sell direct combat advantage.

### Strong candidates

- ship skins
- projectile/trail skins
- ultimate VFX skins
- arena/biome themes
- UI themes
- music packs
- cosmetic bundles
- seasonal cosmetic track

### Acceptable but sensitive

- alternate starting ships as balanced sidegrades

### Avoid

- premium guns with higher stats
- paid permanent combat power
- paywalled progression strength

## Development Roadmap

### Phase 1: Combat Skeleton

- separate third game screen
- player HP and shield
- enemy bullets
- top-half enemy movement boundary
- `2-3` basic enemy archetypes
- lose condition based on health

### Phase 2: Hybrid Progression

- salvage/resource loop
- armory draft system
- keep tactical field drops
- boss reward flow

### Phase 3: Build Conversion

- adapt the 4 builds to the arena model
- build-specific ultimates
- improve special-fire readability

### Phase 4: Content Expansion

- more enemy families
- mini-bosses
- biome/theme changes
- more encounter types

### Phase 5: Retention

- codex
- mastery
- unlock tracks
- milestone rewards

### Phase 6: Monetization

- cosmetics
- themes
- VFX packs
- premium cosmetic bundles

## Initial Implementation Goal

The first playable V2 slice should prove the new combat model, not the full progression system.

That means the first version should include:

- player movement
- player health/shield
- enemy movement in the upper half
- enemy bullets
- player bullets
- a small enemy cap
- a simple start/pause/restart loop
- enough UI to read the game state

It does not need full armory drafts, mastery, or monetization systems yet.

## Current Next Step

The immediate next step after this document is to build the first playable V2 combat sandbox on a third screen and validate one question:

Is the upper-half ranged-enemy combat loop more engaging than the current falling-shape pressure model?

If the answer is yes, V2 becomes the future path. If not, the current prototype remains the main shooter line and V2 stays experimental.
