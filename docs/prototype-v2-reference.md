# Prototype V2 Reference

Snapshot date: `2026-04-15`
Board version: `v0.53`

This document is the current reference for the arena-combat shooter in `/Users/johnchang/Desktop/defender/src/prototype-v2`. It replaces the earlier planning-heavy draft with a snapshot of what is actually implemented today, plus the next major gaps.

Versioning note:

- increase `ARENA_VERSION_LABEL` by `0.01` after each Arena V2 code update
- keep this document’s `Board version` line in sync with the live label in `src/prototype-v2/config.ts`

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

The current build also includes persistent between-run `Codex + Mastery` data stored locally, a scripted encounter registry, a rotating three-boss cadence, named biome sectors, Arena-local audio settings plus music / SFX playback, impact + lane-band hazard telegraphs, and a local cosmetic collection / equip layer on top of the meta flow.

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
- Hazard telegraphs / delayed impact zones are now live for artillery pressure.
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
- sector-transition banners now call out the active biome every `6` tiers
- enemy health numbers are rendered as floating labels over enemies
- drop labels are rendered under field pickups
- the player ship now sits higher in the lower arena to keep the live view clearer under the player’s finger
- a semi-transparent move hint sits below the ship and hides while the player is pressing in that control zone
- the armory is opened manually from an in-arena button instead of auto-opening on threshold hit
- the in-game menu now includes `Run`, `Codex`, `Mastery`, and `Collection` tabs
- the `Run` tab now shows active biome / sector info, next boss preview, and Arena-local audio controls
- run-end summary panels now show tier reached, bosses cleared, mastery XP granted, and newly claimable cosmetics
- codex, mastery, and cosmetic collection state persist across relaunches through a versioned AsyncStorage blob
- the in-game menu still allows game switching, build switching, and restart

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
- `warden`
- `lancer`
- `carrier`
- `artillery`
- `prismBoss`
- `hiveCarrierBoss`

### Current enemy identity summary

- `hover`: baseline ranged pressure, lighter body, orb-style fire
- `burst`: spread / burst pressure, faster read, bolt-style shots
- `tank`: sturdier anchor unit, heavier bomb-like projectiles
- `orbiter`: drifting pattern unit, wave-style projectiles and mirrored motion
- `sniper`: tighter, faster needle shots and more direct threat lines
- `bomber`: heavier bombardment profile and more punishing projectile clusters
- `interceptor`: mini-boss / elite anchor with faster attack pacing
- `warden`: support ship that links temporary protection onto nearby allies
- `lancer`: lane-control striker with telegraphed piercing sweep shots
- `carrier`: support ship that deploys escort packets and stretches field pressure
- `artillery`: siege ship that telegraphs delayed lower-arena impact zones
- `weaver`: control ship that deploys paired lane-band hazards while keeping at least one lane open
- `conductor`: control striker that sweeps adjacent lane bands in readable beats
- `prismBoss`: boss anchor with the heaviest health and multi-pattern pressure
- `hiveCarrierBoss`: rotating boss carrier that mixes escort deployment, artillery pressure, and lane sweeps
- `vectorLoomBoss`: rotating control boss that layers thread walls, sweep beats, and support spawns

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
- boss rotation currently runs `Prism Core` at `T6`, `Hive Carrier` at `T12`, `Vector Loom` at `T18`, then repeats every `18` tiers

### Current live encounter anchors

- `Interceptor Sweep`
  - anchor: `interceptor`
- `Bombard Wing`
  - anchor: `bomber`
- `Warden Bastion`
  - anchor: `warden`
- `Lancer Spearhead`
  - anchor: `lancer`
- `Carrier Nest`
  - anchor: `carrier`
- `Artillery Bastion`
  - anchor: `artillery`
- `Weaver Loom`
  - anchor: `weaver`
- `Conductor Array`
  - anchor: `conductor`
- `Prism Core`
  - anchor: `prismBoss`
- `Hive Carrier`
  - anchor: `hiveCarrierBoss`
- `Vector Loom`
  - anchor: `vectorLoomBoss`

### Encounter reward behavior

- mini-boss clear awards salvage and ultimate charge
- boss clear awards more salvage, more ultimate charge, clears enemy bullets / hazards, and opens a boss cache draft
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
- player projectile output now sheds excess volleys / shards under heavy stress instead of letting the live projectile count spike indefinitely
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
- `/Users/johnchang/Desktop/defender/src/prototype-v2/biomes.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/audio.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaCanvas.tsx`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaPrototypeScreen.tsx`

## Changelog Snapshot

### 2026-04-15

- Advanced arena board label to `v0.53`.
- Moved the malformed encoded audio asset URL normalization into Metro middleware so simulator asset requests are rewritten before Metro resolves the filesystem path.
- Advanced arena board label to `v0.52`.
- Added a Metro dev-server rewrite for malformed encoded Arena audio asset paths so simulator builds can resolve `assets/ui-interface` files.
- Advanced arena board label to `v0.51`.
- Restored Arena V2 `ui-interface` audio imports after the asset pack was brought back into source control.
- Advanced arena board label to `v0.50`.
- Replaced the remaining Arena V2 `ui-interface` audio references with tracked `assets/sfx` files so remote Expo / EAS builds can resolve them reliably.
### 2026-04-14

- Advanced arena board label to `v0.49`.
- Replaced Arena V2 `.ogg` audio references with `.wav` / `.mp3` assets to avoid Expo build-time asset resolution failures.
- Advanced arena board label to `v0.48`.
- Replaced the old generic theme cycling with named `Prism Verge`, `Hive Forge`, and `Vector Spindle` biome sectors aligned to the `6`-tier boss cadence.
- Added Arena-local music / SFX playback with persistent audio settings in the `Run` tab.
- Added run-end summary panels for loss / restart flow and surfaced biome + next-boss preview in the menu.
- Added two new global reward hooks and Collection items: `Boss Banner: Prism Shard` and `Codex Frame: Endless Apex`.
- Advanced arena board label to `v0.47`.
- Added `Weaver` and `Conductor` pressure-control enemy jobs plus rectangular lane-band hazards.
- Expanded formations with `Thread Gate`, `Cross Weave`, `Conductor Shift`, `Suppression Rail`, `Pinned Screen`, and `Corridor Collapse`.
- Expanded the mini-boss pool with `Weaver Loom` and `Conductor Array`.
- Added `Vector Loom` as a third rotating three-phase boss and extended the boss cadence to repeat every `18` tiers.
- Added two new global reward hooks and Collection items: `Boss Banner: Loom Static` and `Codex Frame: Triad Grid`.
- Advanced arena board label to `v0.46`.
- Converted reward hooks into a persistent local cosmetic collection with claim and equip flow.
- Added a dedicated `Collection` menu tab plus live ship / HUD / menu presentation from equipped banners, frames, accents, and crests.
- Advanced arena board label to `v0.45`.
- Audited the remaining enemy multi-shot gaps and widened tighter mini-boss, lane-strike, and elite follow-up patterns to match the new dodge standard.
- Advanced arena board label to `v0.44`.
- Widened multi-projectile enemy fan spreads to restore dodge windows after moving the player ship upward.
- Reworked `Nova Bloom` ultimate so the widened sweep only damages enemies inside the visible fan volume.
- Refreshed the ultimate button icon and replaced the move hint glyph with a cursor-style pointer.
- Advanced arena board label to `v0.43`.
- Moved the player ship upward in the lower arena and added an in-arena move hint below the ship.
- Added stress-based projectile / effect shedding to reduce lag during large swarm + overdrive / ultimate overlaps.
- Advanced arena board label to `v0.42`.
- Added `Carrier` and `Artillery` enemy jobs plus hazard telegraphs for lower-arena impact zones.
- Expanded the formation pool with `Escort Relay`, `Carrier Surge`, `Crossfire Lattice`, `Artillery Net`, `Siege Screen`, and `Impact Corridor`.
- Expanded the mini-boss pool with `Carrier Nest` and `Artillery Bastion`.
- Added `Hive Carrier` as a second three-phase boss and rotated bosses every `6` tiers starting from `T6` / `T12`.
- Added persistent cosmetic-ready unlock hooks for `Hive Carrier` clears, full enemy codex discovery, and build mastery milestones.
- Surfaced unlock chips in the `Codex` and `Mastery` menu panels.
- Advanced arena board label to `v0.41`.
- Replaced hard-coded encounter branching with a script registry for formation, mini-boss, and boss encounters.
- Added two new enemy jobs: `Warden` support ships and `Lancer` lane-control strikers.
- Added three regular formation scripts: `Shield Screen`, `Lancer Sweep`, and `Fortified Bombard`.
- Expanded the mini-boss pool with `Warden Bastion` and `Lancer Spearhead`.
- Reworked `Prism Core` into a three-phase boss with `70%` and `35%` health transitions.
- Added persistent `Codex + Mastery` progression with dominant-build run attribution and run-end mastery XP.
- Extended the Arena V2 menu with segmented `Run`, `Codex`, and `Mastery` panels.
- Advanced arena board label to `v0.40`.
- Replaced in-arena armory and ultimate text buttons with icon-first controls.
- Enhanced the armory ready-state glow and slightly reduced side-control size.
- Increased `Fracture Core` firing cadence again.
- Added an explicit versioning rule: bump `ARENA_VERSION_LABEL` by `0.01` after each Arena V2 code update.

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

- more encounter scripts on top of the now broader registry
- more enemy jobs beyond the current `Warden` / `Lancer` / `Carrier` / `Artillery` / `Weaver` / `Conductor` roster expansion
- more bosses after the current `Prism Core` / `Hive Carrier` / `Vector Loom` rotation

### Progression expansion

- more cosmetic content and slot coverage on top of the current local claim / equip layer
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

## Versioning

`ARENA_VERSION_LABEL` is defined in `src/prototype-v2/config.ts`. **Increment it by `0.01` every time code changes are made** to any file under `src/prototype-v2/`. This applies to bug fixes, balance tweaks, UX changes, and refactors alike. The label is displayed in the HUD so players and testers can always identify which build they are running.

## Current Next Step Recommendation

The immediate next step should probably be production follow-through rather than another foundational systems rewrite.

Recommended order:

1. Playtest and balance the new pressure-control pack until `Weaver`, `Conductor`, and `Vector Loom` feel readable under real swarm pressure.
2. Add more cosmetic content and reward destinations on top of the current Collection flow without touching combat power.
3. Expand presentation with audio layering, biome variety, and targeted event polish.
4. Continue performance passes where lane hazards, boss overlaps, and late-tier projectile density still stress the board.
