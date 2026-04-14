# Prototype V2 Reference

Snapshot date: `2026-04-13`
Board version: `v0.39`

This document is the current reference for the arena-combat shooter in `/Users/johnchang/Desktop/defender/src/prototype-v2`. It replaces the earlier planning-heavy draft with a snapshot of what is actually implemented today, plus the next major gaps.

## Overview

Prototype V2 is the top-down arena shooter mode in the app. It is currently playable, integrated, and used as the default launch mode.

Core loop:

- the run is endless and tier-based (`T1+`)
- the player ship stays in the lower arena and moves left/right only
- enemies occupy the upper combat band, strafe, bob, and shoot downward
- the player loses when health reaches `0`
- the player fires automatically based on the active build
- salvage, field drops, and armory drafts drive in-run progression

This mode is no longer just a redesign concept. It is a production prototype with live combat, encounters, progression, and Skia rendering.

## Current Playable State

### App / mode state

- `Prototype V2` is a selectable game mode in the shared menu.
- It is currently the default mode on app launch.
- The run supports `Start`, `Pause`, `Resume`, and `Restart`.
- Opening the armory or menu pauses simulation.

### Core combat state

- Fixed-step combat simulation runs through `tickArenaState`.
- The player ship is restricted to the lower section of the board.
- Enemies are restricted to the upper combat zone.
- Enemy bullets, player bullets, drops, effects, encounters, and ultimates are all live.
- The arena is portrait-oriented.

### HUD / UI state

The HUD is compact and live.

Top-level HUD currently shows:

- score
- current pressure tier (`T#`)
- active build short label
- damage
- rate of fire
- projectile speed
- health bar with current / max
- shield bar with current / max
- salvage bar with current / next draft requirement
- armory button with available upgrade count / ready glow
- ultimate charge button / ready state

Other UI behavior:

- center-top status pill shows run state, pickup messages, encounter states, or pause/menu state
- encounter announcements flash over the arena center
- enemy health numbers are rendered as floating labels over enemies
- drop labels are rendered under field pickups
- the armory is opened manually from an in-arena button instead of auto-opening on threshold hit
- the in-game menu allows game switching, build switching, and restart

## Current Combat Rules

### Arena space

- Player ship remains in the lower arena.
- Player movement is horizontal only.
- Enemies spawn above the screen and settle into the upper combat band.
- The normal enemy lower movement limit is controlled by `ARENA_ENEMY_ZONE_RATIO = 0.46`.

### Survival model

- The player has `health` and `shield`.
- Shield absorbs damage first.
- Shield regenerates after a short delay without damage.
- If health reaches `0`, the run ends immediately.

### Progression model

- The run is endless and tier-based.
- Pressure scales through enemy composition, formations, enemy fire, elite encounters, and boss checkpoints.
- Difficulty is not only HP inflation anymore, although HP scaling is still part of the balance model.

## Build System

There are four live builds. The active build can be switched in-run from the menu.

Important implementation note:

- the reference below reflects actual live combat behavior
- some short in-code flavor text may lag behind this document when tuning moves faster than menu copy

### Rail Focus

Identity:

- precision / lane-control build
- fewer guns, tighter spread, higher direct damage, higher pierce

Current behavior:

- normal gun cap: `2`
- overdrive gun cap: `3`
- stronger direct-hit scaling than the wider-area builds
- precision bonus against high-value or high-threat targets
- fastest-feeling long-lane pressure among the non-missile builds

Ultimate: `Rail Surge`

- marks high-priority targets / lanes
- drops concentrated rail strikes on those lanes
- strongest at deleting elites and boss pressure points

### Nova Bloom

Identity:

- fan-shaped primary-fire coverage build
- crowd-control / coverage build

Current behavior:

- normal gun cap: `4`
- overdrive gun cap: `5`
- broader spread than the other primary-gun builds
- slightly lower per-projectile damage than the precision build
- intended to own screen coverage rather than single-target burst

Ultimate: `Solar Bloom`

- fires a large arena-wide solar sweep
- heavily damages enemies across the board
- does not trigger overdrive automatically

### Missile Command

Identity:

- ordnance-only build
- homing missile pressure with splash

Current behavior:

- does not use the standard primary-gun volley loop
- fires missiles one at a time inside a volley window
- missile count per volley depends on current gun count
- normal gun cap: `6`
- overdrive volley count: `12`
- base volley window: `1.0s`
- `Rapid Cycle` reduces the window by `0.1s` per step, capped at `0.5s`
- overdrive forces `12 missiles` in a `0.5s` window
- missiles are larger and heavier-looking than before and do stronger splash damage

Ultimate: `Missile Barrage`

- launches repeated strike volleys and strike-lane effects
- built for lane pressure and formation disruption

### Fracture Core

Identity:

- slow heavy shot into fragmentation build
- impact-to-shard chain build

Current behavior:

- slower firing cadence than the other builds
- normal gun cap: `3`
- overdrive gun cap: `4`
- primary shots are large, rock-like projectiles
- impacts create fragment bursts and shard follow-up damage
- fragment splash radius is larger than before
- current VFX now reads as shard spray instead of a soft circular pulse

Ultimate: `Cascade Break`

- spawns randomized fracture fields in the upper arena
- currently uses one large and one smaller fracture circle
- positions are randomized, but constrained to stay meaningfully inside the arena and above the lower combat line

## Overdrive

Overdrive is a field drop effect, not a separate build.

Current behavior:

- pickup type: `Overdrive`
- duration: `6s`
- temporarily boosts the active build’s stats to `1` level above their normal caps
- adds stronger screen shake and a warm arena overlay
- adds lava-crack / neon-crack background styling during the effect

Current visual behavior:

- crack positions randomize on each new overdrive activation
- cracks remain fixed during that activation
- brightness still subtly fluctuates while active

## Armory / Progression Loop

### Salvage economy

- enemies grant score and salvage on kill
- `salvageBurst` field drops grant additional salvage
- salvage progress is always visible in the HUD

### Standard armory drafts

- the first draft threshold starts at `120`
- each next standard draft increases by `80`
- when salvage reaches the threshold, the run banks an available armory upgrade instead of interrupting the fight
- the armory button lights up when one or more upgrades are available
- multiple armory upgrades can queue if the player keeps collecting salvage before opening the armory

### Boss cache drafts

- boss clears add a free armory upgrade to the same available-upgrade queue
- boss rewards no longer force an immediate armory pause

### Current armory upgrade set

Live upgrades:

- `Damage Matrix`
- `Rapid Cycle`
- `Twin Array`
- `Phase Pierce`
- `Shield Capacitor`
- `Reinforced Plating`
- `Accelerator`

Current behavior:

- the armory shows all available upgrades
- upgrades that are maxed are disabled instead of disappearing
- maxed upgrades show a `MAX` overlay in the modal

Practical meanings:

- `Damage Matrix`: raw damage increase
- `Rapid Cycle`: faster fire loop and slightly tighter spread
- `Twin Array`: more barrels / projectiles
- `Phase Pierce`: more target pass-through
- `Shield Capacitor`: more max shield
- `Reinforced Plating`: more max health
- `Accelerator`: faster, larger projectiles with added pierce

## Drops

Current live drop types:

- `Health` patch
- `Shield` cell
- `Overdrive`
- `Salvage` burst

Current live effects:

- health patch restores health
- shield cell restores shield
- overdrive activates the temporary over-max combat state
- salvage burst adds a flat salvage chunk and can immediately trigger an armory draft if the threshold is crossed

## Enemy Roster

Current live enemy families:

- `hover`
- `burst`
- `tank`
- `orbiter`
- `sniper`
- `bomber`
- `interceptor`
- `prismBoss`

### Current enemy identity summary

- `hover`: baseline ranged pressure, lighter body, orb-style fire
- `burst`: spread / burst pressure, faster read, bolt-style shots
- `tank`: sturdier anchor unit, heavier bomb-like projectiles
- `orbiter`: drifting pattern unit, wave-style projectiles and mirrored motion
- `sniper`: tighter, faster needle shots and more direct threat lines
- `bomber`: heavier bombardment profile and more punishing projectile clusters
- `interceptor`: mini-boss / elite anchor with faster attack pacing
- `prismBoss`: boss anchor with the heaviest health and multi-pattern pressure

### Enemy presentation state

Enemy visuals are no longer basic circles and squares only.

Current presentation improvements:

- hull silhouettes are ship-like rather than raw geometry only
- enemy aim direction rotates the firing tip / gun direction
- enemy wing panels, canopy shapes, and hull accents are rendered in Skia
- enemy projectile styles now vary by family (`orb`, `bolt`, `needle`, `bomb`, `wave`)

## Encounter Structure

### Current live cadence

- mini-boss encounter every `3` tiers
- boss encounter every `6` tiers

### Current live encounter anchors

- `Interceptor Sweep`
  - anchor: `interceptor`
- `Bombard Wing`
  - anchor: `bomber`
- `Prism Core`
  - anchor: `prismBoss`

### Encounter reward behavior

- mini-boss clear awards salvage and ultimate charge
- boss clear awards more salvage, more ultimate charge, clears enemy bullets, and opens a boss cache draft
- encounter announcements flash in the arena center rather than taking a fixed HUD row

## Theme / Visual State

### Arena rendering

The arena board is rendered with Skia.

Current Skia-rendered layers include:

- static background snapshot
- moving background streaks / plates / atmosphere layers
- enemy hulls
- enemy bullets
- player bullets
- hit effects
- ultimate effects
- overdrive arena treatment

### Theme progression

- arena theme changes every `5` tiers
- each theme shifts color balance and background atmosphere
- overdrive adds an additional warm overlay pass on top of the current theme

### Screen shake

- shake is active during overdrive and ultimates only
- it is not used as a constant ambient combat effect

## Performance / Technical State

### Simulation architecture

- fixed-step simulation with bounded catch-up stepping
- real frame delta is converted into capped substeps
- this removed the earlier ship movement and enemy jitter issues

### Input architecture

- player input uses `react-native-gesture-handler`
- ship visual movement uses `react-native-reanimated` shared values
- the ship movement path is intentionally decoupled from the Skia board render path

### Current performance protections

- effect list is capped
- render sampling is used for effects and projectile layers
- dense-effect mode reduces visual complexity when the board is saturated
- impact bursts are throttled under heavy load
- fracture fragment effects were recently reduced again for performance (`8` normal, `6` dense)

### Current known performance hotspots

The build is playable, but these are still the most expensive combat situations:

- high-threat screens with maxed `Nova Bloom`
- maxed `Missile Command` during overdrive
- dense enemy clustering plus frequent simultaneous hit effects
- boss overlaps with large projectile counts and active arena effects

## Current File Map

Primary implementation files:

- `/Users/johnchang/Desktop/defender/src/prototype-v2/types.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/config.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/builds.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/upgrades.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/engine.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaCanvas.tsx`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaPrototypeScreen.tsx`

## Changelog Snapshot

### 2026-04-13

- Advanced arena board label to `v0.39`.
- Synced Arena V2 behavior around the current four-build model.
- Fixed `Solar Bloom` so it no longer triggers overdrive as part of the ultimate.
- Reworked `Missile Command` into a true missile-only ordnance profile with sequential volley timing.
- Increased missile threat through stronger direct damage, stronger splash, larger silhouettes, and heavier missile art.
- Reworked `Fracture Core` into slower heavy shots with clearer shard-burst visuals and larger fragment impact radius.
- Randomized `Cascade Break` fracture-field placement while keeping the effect constrained to the upper arena.
- Improved overdrive environment treatment with randomized lava-crack placement per activation.
- Increased `Fracture Core` overdrive cadence so the fire-rate boost now reads clearly in play.
- Reworked armory flow so upgrade choices queue on the armory button instead of interrupting combat immediately.
- Reduced repeated hit-effect pressure by throttling burst effects under dense combat load.
- Reduced fracture fragment render count again to preserve performance while keeping the burst readable.

### 2026-04-11 to 2026-04-12

- Stabilized portrait-mode ship input and removed the major first-tap / teleport movement issues.
- Removed enemy sideways/upward shake by cleaning up motion interpolation and simulation cadence.
- Added build switching, build-specific ultimates, and stronger build identity in live combat.
- Added enemy ship silhouettes, family-specific projectile styles, and a stronger Skia VFX pass.
- Added mini-boss and boss encounter structure with center-board encounter callouts.
- Added theme cycling, overdrive color treatment, and stronger arena atmosphere.
- Refined HUD layout to keep the arena as the visual focus.

## What Is Still Missing

These are the major areas that still remain after the current polish pass.

### Content expansion

- more enemy families with clearly different jobs
- more encounter scripts beyond the current anchor-cycle structure
- additional boss pattern phases and support-enemy interactions

### Progression expansion

- codex / enemy log / build reference outside the run
- long-term mastery or unlock structure across runs
- more premium-feeling armory picks beyond the current base set

### Retention / presentation

- more arena biomes and environment-specific visual language
- more audio layering and event-specific sound design
- cosmetic surface area for later monetization

### Monetization direction

- monetization should stay strictly non-pay-to-win
- no paid combat power, stronger builds, stat boosts, better drops, or armory advantages
- focus monetization on cosmetics and presentation instead:
  - ship skins / hull variants
  - projectile, impact, overdrive, and ultimate VFX skins
  - arena biome themes / visual packs
  - profile, banner, badge, or codex cosmetics
  - season-pass style cosmetic reward tracks
- the full gameplay power curve should remain earnable through normal play

## Current Next Step Recommendation

The immediate next step should be content expansion, not another major systems rewrite.

Recommended order:

1. Add more encounter scripts and at least `2` more enemy jobs.
2. Expand boss behavior so bosses are more pattern-driven than health-driven.
3. Add one deeper progression layer outside the current run loop:
   - codex
   - mastery
   - unlock track
4. Define the first non-pay-to-win monetization layer around cosmetics, presentation, and optional reward-track content.
5. Continue targeted performance passes only where live playtesting shows saturation.
