# Prototype Shooter Reference

Snapshot date: `2026-04-08`

This document describes the current prototype shooter mode that lives in the same app as the tower defense game. It is intended to be a durable reference for future iteration, rebalancing, refactors, and feature planning.

## Scope

- App-level entry and orientation behavior
- Player-facing non-technical summary
- Core gameplay loop
- Weapons, upgrades, builds, ultimates, enemies, encounters, and bosses
- Technical architecture and current constraints
- Balance intent and practical next steps

## Important Files

- `/Users/johnchang/Desktop/defender/app/(tabs)/index.tsx`
  - Chooses between the tower defense game and the prototype
  - Defaults to the prototype on app launch
  - Locks the prototype to portrait orientation
- `/Users/johnchang/Desktop/defender/src/prototype/PrototypeShooterScreen.tsx`
  - Single-file implementation of the entire prototype
  - Owns game state, simulation, rendering, progression, builds, bosses, and UI

## Non-Technical Summary

### What the prototype is

The prototype is a portrait-mode survival shooter built around a single ship at the bottom of the screen. The ship auto-fires upward continuously, and the player only controls horizontal movement. Enemies spawn from the top and move downward. Every enemy displays its current health number inside its body, and the run ends the moment any enemy reaches the bottom.

The game is designed to feel like a neon geometric horde defense game rather than a traditional arcade shmup. The player’s focus is not precision aiming, but positioning, upgrade collection, pressure management, and choosing a run-defining combat build after boss fights.

### Core player fantasy

- Hold a defensive line with a simple but highly upgradable weapon system
- Survive escalating geometric swarms rather than memorizing fixed levels
- Build into a specific combat identity instead of only stacking generic stats
- Use boss fights and ultimate abilities as punctuation moments
- Feel increasing spectacle without turning the game into a full bullet hell

### How a run feels

Early game is intentionally readable:

- The player starts paused and presses `Start` to begin
- The ship auto-fires a basic weapon
- Early upgrades guarantee access to the core weapon path
- Enemies begin relatively small and manageable

Midgame is where the prototype tries to differentiate itself:

- More weak enemies start appearing after `T10`
- The board becomes more crowd-oriented instead of only spawning giant tanks
- Encounters and boss checkpoints interrupt the default flow
- Boss clears pause the action, then open a build-selection armory modal

Lategame is meant to feel like:

- A large geometric battlefront
- Many disposable weak enemies mixed with a smaller number of stronger anchors
- Strong build identity through ultimates and build scaling
- Pressure driven by composition and crowd control, not just enemy HP inflation

### Current player-facing systems

- Horizontal drag movement
- Automatic continuous firing
- Falling upgrade pickups that must be physically collected by the ship
- Four build paths
- One ultimate per build
- Timed encounters
- Boss fights every five tiers
- Endless progression rather than a fixed campaign end

### Current build fantasies

#### Rail Focus

- Precision-focused build
- Fewer visible rails, but much stronger and faster shots
- Feels like a focused strike platform

#### Nova Bloom

- Wide, aggressive primary fire build
- Strongest “screen coverage through the primary weapon” fantasy
- Feels loud, hot, and overclocked

#### Missile Command

- Converts missiles from support fire into a major damage source
- Strongest off-axis and secondary-fire identity
- Best build for “board-wide barrage” fantasy

#### Fracture Core

- Converts shatter fire into fragment-heavy burst pressure
- Intended to feel like controlled explosive fragmentation
- Current implementation is functional but still the least visually clear of the four builds

## Core Gameplay Loop

1. The player starts the run from a paused state.
2. The ship begins auto-firing once the run starts.
3. The player drags left and right to reposition.
4. Enemies fall from above.
5. The player catches upgrades to evolve the weapon.
6. Pressure tiers advance automatically with time.
7. Special encounters and bosses interrupt the default pacing.
8. Boss kills trigger a short transition and then an armory build choice.
9. The run continues until an enemy breaches the bottom edge.

There is currently no victory condition for the prototype. It is an endless pressure ramp.

## Controls and UX

### Control model

- Input is horizontal drag only
- The ship does not aim manually
- The ship auto-fires while the simulation is running
- The player collects upgrades by overlap, not tapping

### Start/pause flow

- App loads into the prototype by default
- The prototype starts paused
- Top-left button becomes `Start`, then `Pause` and `Resume`, then `Restart` after defeat

### UI structure

- Top bar:
  - Start/Pause/Resume/Restart button
  - central status pill
  - menu button
- HUD row:
  - score
  - pressure tier
  - ultimate charge or readiness
  - active build
- Build stat row:
  - damage
  - rate of fire
  - pierce
- Board overlays:
  - encounter announcements flash in the center of the board
  - boss-clear transition overlay
  - armory modal after boss clears

### Visual communication

- Enemy HP is shown directly on enemies
- Bosses show phase pips
- Enemy archetypes have small visual markers
- Background atmosphere changes based on tier, encounter, boss state, and breach pressure
- Health is compacted to `k`/`M` notation, with one decimal in the thousands

## Technical Summary

## App Integration

The prototype is integrated into the main app rather than being a separate route tree.

- `activeGame` defaults to `'prototype'`
- When the prototype is active, the app locks orientation to `PORTRAIT_UP`
- When the tower defense game is active, the app locks to landscape
- Switching between the two happens through shared app-level state

This means the prototype is currently a mode of the app, not a standalone package.

## Architecture

### High-level structure

The prototype is currently implemented as one large React component plus helper functions in a single file:

- simulation logic
- state transitions
- build math
- upgrade rules
- enemy spawning
- boss logic
- ultimate logic
- rendering
- UI

This is good for fast experimentation, but it is the main maintainability bottleneck now.

### Simulation model

The game uses a fixed-step simulation:

- simulation step: `1 / 60` seconds
- frame delta clamp: `0.1`
- max catch-up steps per frame: `5`

The render loop runs through `requestAnimationFrame`, but the actual gameplay simulation advances in discrete fixed steps. This is important because:

- balance is tied to stable simulation timing
- projectile collision reliability depends on it
- late-game behavior is more deterministic than a pure variable-step loop

### Rendering model

The prototype playfield is still rendered with React Native `View` and `Text` nodes.

This includes:

- enemies
- projectiles
- upgrades
- effects
- background grid and atmosphere

Skia is not currently used by the prototype.

Practical implication:

- iteration speed is high
- the current architecture is acceptable for prototype-scale counts
- the main future performance ceiling is the React Native view tree, not the simulation math

## Core State Model

The primary state object includes:

- elapsed time
- score
- player position
- bullets
- enemies
- upgrades
- effects
- weapon stats
- cooldowns for primary fire, missiles, shatter, enemies, upgrades, boss escorts
- temporary chaos timer
- revealed upgrades
- collected upgrade count
- active encounter
- boss/armory transition state
- build selection and per-build saved levels
- ultimate charge
- encounter announcement state

The prototype does not currently persist run state between app launches. All progress is run-local only.

## Progression Model

### Pressure tiers

- Internal difficulty tier = `floor(elapsed / 15 seconds)`
- Displayed tier = internal tier + 1

So each displayed tier currently lasts 15 seconds.

### Major structure

- Every `5th` displayed tier is a boss tier
- Even displayed tiers starting at `T6` can trigger a non-boss encounter
- Normal waves continue indefinitely

### Early upgrade guarantee

Through displayed `T8`, the prototype forces the early appearance of:

- `Rapid`
- `Twin`
- `Heavy`
- `Flare`

This is meant to prevent dead or overly narrow early runs.

### Late utility unlocks

`Chaos` and `Bombard` do not appear before displayed `T10`.

After `T10`, both become more likely as enemy count rises, with `Chaos` weighted more heavily than `Bombard`.

## Weapon System

## Base weapon

Starting weapon values:

- damage: `1`
- fire interval: `0.1`
- shot count: `1`
- pierce: `0`
- bullet size: `8`
- bullet speed: `760`
- spread: `15`
- aim assist: `0`
- spread jitter: `0`
- effect intensity: `1`
- trail scale: `1`
- missile level: `0`
- shatter level: `0`

### Active weapon derivation

The live weapon the player actually fires is built in stages:

1. Base weapon
2. Permanent upgrades
3. Build transformation
4. Temporary chaos overdrive if active
5. Build-specific caps unless chaos is active

### Weapon caps

Current visible caps:

- Straight guns:
  - default builds: `3`
  - `Nova Bloom`: `4`
  - `Fracture Core`: `2`
- Missile count:
  - default builds: `2`
  - `Missile Command`: `6`
- Chaos bypasses the normal build caps

### Permanent upgrade types

#### Rapid

- Reduces fire interval
- Minimum interval from the base upgrade path is `0.045`

#### Twin

- Adds a straight gun up to the current cap
- Adds spread
- If the gun cap is already reached, Twin converts into payload instead of doing nothing
- Under Rail Focus, Twin becomes doctrine-aware and can become a rail payload upgrade

#### Heavy

- Increases base damage
- Slightly increases bullet size

#### Pierce

- Increases pierce

#### Focus

- Increases bullet speed
- Increases damage
- Adds aim assist
- Slightly increases effect intensity
- Changes projectile colors toward a pink precision theme

#### Flare

- Increases damage
- Increases bullet size
- Increases effect intensity and trail scale
- Gives a warmer brighter shot presentation

#### Missile

- Increases missile level up to the permanent cap
- Improves missile access and effect intensity

#### Shatter

- Increases shatter level
- Increases effect intensity

### Temporary / utility upgrades

#### Chaos

- Temporary 6-second overdrive
- Bypasses normal build caps
- Boosts damage, fire rate, visible gun count, pierce, size, bullet speed, aim assist, spread, jitter, effect intensity, trail scale, missile level, and shatter level
- This is the “everything becomes too much for a few seconds” relief tool

#### Bombard

- One-shot screenwide strike when collected
- Damages all enemies on screen immediately
- Does not permanently modify the weapon
- Intended as emergency board relief

## Build System

## Build identities

There are four build paths:

- Rail Focus
- Nova Bloom
- Missile Command
- Fracture Core

### How build selection works

- Boss kills queue an armory choice
- A short boss-clear transition plays first
- The run then pauses for the armory modal
- The player can:
  - maintain the current build and increase its level
  - switch to another build
  - resume a previously used build at its saved level

### Build level persistence during a run

Each build tracks its own level inside the run.

That means:

- switching away from a build does not erase it
- switching back resumes its saved level
- the current build and all previously unlocked builds have independent stored levels

### Rail Focus

Intent:

- fewer visible barrels
- stronger precision damage
- faster shots
- better pierce and aim correction

Key behavior:

- compresses the primary to at most 2 visible rails
- scales damage, speed, pierce, aim assist, and fire rate
- Twin becomes rail-specific when already saturated

Ultimate:

- `Sky Lance`
- focused strike columns on top-threat enemies

### Nova Bloom

Intent:

- make the primary weapon the whole show
- wider, hotter, more chaotic flare volleys

Key behavior:

- highest straight-gun ceiling
- strong spread and shot-count growth
- large, bright, dense primary fire

Ultimate:

- `Solar Bloom`
- board-wide bloom sweep that overloads the primary battery

### Missile Command

Intent:

- missiles become a real primary damage pillar instead of side support

Key behavior:

- guarantees missile access
- raises missile floor with build level
- stronger missile damage
- lower missile cooldown
- better missile turn behavior

Ultimate:

- `Missile Storm`
- visible missile barrage across the board

### Fracture Core

Intent:

- turn shatter into dense fragment cascades

Key behavior:

- primary visible gun count is kept lower
- guarantees shatter access
- fires multiple shatter shells
- larger shells
- more fragments
- higher shatter damage
- lower shatter cooldown

Ultimate:

- `Cascade Break`
- multi-point shard bursts across the board

Current design note:

Fracture Core is significantly better than earlier versions, but it is still the build most likely to need another readability pass because its special fire can still visually compete with the primary weapon layer.

## Ultimate System

### Charge model

- Maximum charge: `100`
- Charge gain multiplier: `1.3`
- Ultimate charge is earned from:
  - dealing damage
  - killing enemies
- Bosses grant much more charge than normal enemies

### Current ultimate set

#### Pulse Crash

- Fallback ultimate when no build is selected
- Generic screen-clearing pulse

#### Sky Lance

- Rail Focus ultimate
- Selects high-threat enemies
- Fires focused rail-like strikes and bombard-style columns

#### Solar Bloom

- Nova Bloom ultimate
- Board-wide primary sweep
- Multiple bloom bursts layered into the sweep
- Damages every active enemy with stronger scaling based on threat position

#### Missile Storm

- Missile Command ultimate
- Launches a visible barrage of missiles across the screen
- Hits multiple high-threat targets

#### Cascade Break

- Fracture Core ultimate
- Spawns multiple shard-burst effects around the screen
- Emphasizes screenwide fracture detonations

## Enemy System

## Shapes

Current shapes:

- circle
- square
- diamond

These are used as both readable enemy silhouettes and as carriers for HP text.

## Enemy archetypes

### Standard

- baseline enemy
- can still become dangerous through scaling and elite replacement

### Swarm

- smaller
- weaker individually
- faster
- lower reward
- now intended to dominate the board mix after `T10`

### Tank

- larger
- much higher health
- slower
- higher reward
- intended to be an anchor, not the main population

### Splitter

- medium-heavy threat
- splits once into two swarm children on death
- important for target-priority variety

### Boss

- special encounter enemy
- large
- phased
- carries the armory progression system

## Enemy stat scaling

Enemy health is computed from:

- difficulty tier
- base size
- archetype health multipliers
- time pressure multiplier
- upgrade-pressure multiplier
- draft-level multipliers

Important practical behavior:

- time scaling is deliberately flatter for swarm and splitter enemies than for heavy enemies
- upgrade accumulation increases enemy pressure
- very high-health enemies become substantially slower

### Health scaling profile

- weak enemies are intended to remain killable
- anchors and bosses still scale hard
- the current design goal is “lots of weak bodies, a few meaningful anchors,” especially after `T10`

### Speed scaling profile

Enemy speed is influenced by:

- base speed roll
- archetype speed multiplier
- upgrade-based speed penalty
- health-based slowdown
- some targeted compensating boosts for certain heavier enemies

The health-speed penalty is aggressive:

- enemies above 100 HP begin slowing
- higher-health enemies progressively slow harder
- very large HP enemies can become near-snail pace

This is intentional to avoid late-game impossible rushes by giant enemies.

### Enemy size

Enemy render size is tied to health, but capped.

This gives:

- visible growth with threat
- consistent relation between size and danger
- a hard ceiling so enemies do not completely cover the board

## Encounters

### Encounter cadence

- Non-boss encounters start at displayed `T6`
- They occur on even tiers that are not boss tiers

### Encounter types

#### Swarm Rush

- heavy weak-enemy emphasis
- lower durability, higher count feel

#### Fortress Line

- tankier line pressure
- heavier center threat

#### Splitter Storm

- emphasizes splitters and supporting swarm pressure

#### Salvage Drift

- lower-pressure event
- softer enemies
- helps surface upgrades faster

#### Boss Intercept

- boss encounter state
- spawns the boss and later manages escort behavior

## Bosses

### Boss cadence

- Every 5th displayed tier

### Boss variants

#### Prism Core

- diamond boss

#### Bulwark Array

- square boss

### Boss phase model

Bosses have three phases based on remaining health:

- phase 1: above 66%
- phase 2: above 33%
- phase 3: below 33%

Phase transitions:

- increase boss speed slightly
- accelerate boss escort pacing
- trigger messaging and effects

### Boss escorts

Bosses can summon small escorts on side lanes.

Current intent:

- escorts support the boss
- escorts should not become a second full wave
- boss fights should read as a set piece, not a density collapse

### Boss death flow

When a boss dies:

- lingering escort enemies are cleared
- reward effects play
- centered notification appears
- a transition overlay plays
- the armory choice is queued
- only after the transition does the modal appear

That transition exists so the boss death and any ultimate used to finish it are still visible.

## Spawning and Composition

## Current normal-wave intent

Normal waves are no longer supposed to become “mostly giant enemies.”

From `T10+`, the spawn system increasingly biases toward:

- more weak swarms
- side swarms
- flank swarms
- extra weak packs even outside formal swarm encounters

Heavy enemies still exist, but they should read as mixed-in anchors, not the whole wave composition.

## Current composition rules

Current regular-wave system includes:

- a lead draft
- optional swarm conversion
- optional side spawn
- optional flank burst
- optional extra swarm pack
- optional tank or splitter conversion
- optional elite upgrade
- optional weak escorts for stronger lead enemies

This is the current answer to late-game boredom: more bodies of lower individual importance, plus occasional anchors.

## Projectile and Collision Systems

Projectile types:

- standard bullet
- missile
- shatter shell
- shatter shard

### Collision model

Projectile collision is not checked only at the endpoint. It uses a swept path hit test between previous and current positions.

That reduces tunneling during frame spikes and is one of the most important mechanical correctness fixes already in the prototype.

### Aim assist

Aim assist is soft and score-based.

Targets are favored based on:

- progress down the board
- horizontal offset
- enemy speed

Missiles have additional curved-launch and turn-rate logic.

## Visual and Presentation Systems

### Background atmosphere

The board background dynamically changes based on:

- difficulty tier
- current encounter
- active boss
- build color
- ultimate readiness
- breach pressure

This is a low-cost way of making the board feel less static without expensive rendering.

### Effects

Effect kinds include:

- muzzle flashes
- bursts
- pickups
- bombard columns
- generic ultimates
- rail lances
- nova sweeps
- missile storm visuals
- shatter storm visuals

### Board announcements

Encounter messaging is currently shown as flashing centered text on the board instead of occupying persistent HUD space.

This keeps the HUD lighter while still preserving situational awareness.

## Balance Intent

### Current design goals

- Simple controls, layered systems
- Endless escalation without pure stat inflation as the only tool
- Strong build identity
- Boards that feel like geometric battle scenes, not just a few giant sponges
- Enough spectacle to stay engaging without immediately overheating the device

### Current late-game philosophy

Late game should feel like:

- many weak or moderate enemies
- fewer high-health anchors
- bosses as pacing punctuation
- ultimates as pressure-release moments

It should not feel like:

- only giant HP walls
- every enemy being equally tanky
- a board clogged mostly by slow giant shapes

## Current Constraints and Risks

### Single-file implementation

Most of the prototype lives in one file. That makes:

- experimentation easy
- onboarding harder
- refactoring harder
- regression risk higher when changing unrelated systems

### Rendering bottleneck risk

Because the playfield is still a React Native view tree:

- late-game density has a practical upper bound
- more persistent effects will eventually need a more efficient renderer
- Skia is the likely future path if this mode grows

### Balance complexity

Difficulty is currently a mix of:

- time
- upgrade count
- archetype multipliers
- encounters
- boss phases
- build scaling
- temporary relief tools

That is enough complexity that future balance changes should be deliberate and measured, not “tweak one number and guess.”

## Recommended Technical Refactor Path

If the prototype continues beyond experimentation, the next clean refactor would be:

1. Split simulation helpers from rendering
2. Move constants and balance data into separate modules
3. Separate enemy spawning, build math, and ultimate logic into dedicated files
4. Keep UI state and shell in the screen component
5. Consider moving the playfield renderer to Skia once enemy/effect density grows further

## Recommended Design Iteration Path

Highest-value future work:

1. Continue refining enemy composition rather than only scaling HP
2. Improve Fracture Core readability and impact
3. Add more late-game variation through enemy behaviors, not just more numbers
4. Keep bosses as set pieces, not as density multipliers
5. Add instrumentation or debug overlays if balancing continues to be a major task

## Changelog

Use this section as the running historical record for the prototype. The summary above should describe the current state. This changelog should capture when and why that state changed.

### Changelog Format

For future entries, prefer this structure:

- `YYYY-MM-DD`
  - system or feature changed
  - player-facing impact
  - balancing or technical rationale
  - files touched if the change was structurally important

### 2026-04-08

- Added this reference document as the baseline source of truth for the prototype.
- Documented the current architecture, player loop, progression, build system, enemy composition, encounter model, boss flow, and performance constraints.
- Established that the prototype currently defaults to portrait mode and launches by default from `/Users/johnchang/Desktop/defender/app/(tabs)/index.tsx`.
- Captured the current balance direction:
  - weak-enemy bias after `T10+`
  - build-specific scaling and ultimates
  - persistent per-build levels during a run
  - boss-clear transition before armory selection
  - endless pressure-tier progression

### Recent Prototype Milestones Captured In This Snapshot

- Prototype became the default app mode at launch.
- Fixed per-build level persistence so switching builds preserves previously earned build levels within the same run.
- Reworked the HUD to keep a smaller top footprint and replaced the old dense stat summary with `Damage`, `RoF`, and `Pierce`.
- Moved encounter messaging out of persistent HUD chips and into flashing board-center announcements.
- Added boss-clear transitions so ultimates and death moments remain visible before the armory modal appears.
- Expanded build identity:
  - `Rail Focus`
  - `Nova Bloom`
  - `Missile Command`
  - `Fracture Core`
- Added build-specific ultimates:
  - `Sky Lance`
  - `Solar Bloom`
  - `Missile Storm`
  - `Cascade Break`
- Shifted spawning away from mostly giant late-tier enemies toward larger groups of weaker enemies with fewer anchor threats.
- Added encounter types and boss checkpoints as the main pacing changes instead of relying only on HP inflation.
- Kept the prototype on the React Native view renderer for now, with Skia still reserved as a likely future performance move if the playfield becomes denser.

## Known Issues / Open Questions

This section is for active uncertainty, not historical notes. Keep it current.

### Known Issues

- `Fracture Core` remains the least visually clear build.
  - The build is mechanically stronger than earlier versions, but its special-fire identity can still get visually buried under the primary projectile stream.
  - Likely future work:
    - stronger visual separation for shatter shells
    - more distinct fragment coloration or motion
    - different spawn offset or cadence pattern

- The prototype playfield is still limited by the React Native view tree.
  - This is acceptable for current iteration, but it remains the main late-game performance ceiling.
  - If enemy count, effect count, or persistent projectile complexity rises much further, a playfield-only Skia migration becomes the practical next move.

- Balance tuning still depends on hand adjustment rather than instrumentation.
  - The current system has enough interacting variables that manual tuning is workable but inefficient.
  - The biggest missing tools are:
    - late-tier enemy-count visibility
    - build DPS comparators
    - per-tier survival snapshots
    - encounter density metrics

- Boss escort pacing is improved, but still sensitive to spawn composition changes elsewhere.
  - Boss fights can regress quickly if normal swarm pressure and escort pressure are tuned independently without checking the combined board state.

- Large portions of gameplay logic still live in one file.
  - This is a maintenance problem more than a player-facing bug, but it directly increases the risk of accidental balance regressions.

### Open Questions

- Is the prototype still intended to remain endless, or should it eventually include a milestone, soft ending, or run-complete state?

- Should builds remain freely swappable during a run after boss clears, or eventually become more mutually exclusive?

- Does `Fracture Core` deserve another rework instead of continued tuning?
  - Current candidate directions:
    - keep the build and improve readability
    - reduce the primary emphasis further and let shatter dominate
    - replace it with a different build if its fantasy remains hard to communicate

- Should late-game difficulty continue to lean toward swarm-heavy composition, or should additional enemy behaviors eventually replace part of that pressure?

- Does the prototype need a meta layer?
  - examples:
    - score milestones
    - unlock track
    - ship modules
    - persistent run modifiers

- Should the current single-screen HUD stay minimal, or eventually expose more debug/advanced combat detail in a separate menu or overlay?

## Balance Tuning History

This section is specifically for gameplay tuning history. Use it to record why the balance changed, what pressure problem it was solving, and what the intended new behavior is.

### Balance Logging Format

For future entries, prefer this structure:

- `YYYY-MM-DD`
  - system changed
  - exact pressure problem being addressed
  - direction of the change
  - expected player-facing result
  - whether follow-up validation is still needed

### Current Balance Baseline

This snapshot assumes the following balance direction is intentional:

- Early game is readable and gives guaranteed access to core upgrade paths.
- `T10+` begins shifting toward larger weak-enemy groups rather than mostly giant targets.
- Higher-health enemies slow down heavily so they remain pressure anchors instead of unavoidable rush threats.
- Bosses act as pacing events, not just giant stat spikes.
- Builds scale indefinitely, but highly abusable properties still have practical caps or floors.
- `Chaos` and `Bombard` act as relief mechanics, not the default build path.

### Balance Themes Already Reflected In This Snapshot

#### Enemy composition

- Late normal waves were pushed away from “mostly giant HP bodies.”
- More weak enemies now appear after `T10`, not only during dedicated swarm encounters.
- Tanks and splitters still matter, but are meant to be anchors mixed into crowds.

#### Enemy scaling

- Health scaling was flattened for weaker archetypes relative to stronger enemies.
- High-health enemies slow significantly as their HP rises.
- Enemy size is tied to health, but capped for readability.

#### Boss pacing

- Boss fights now clear into a transition before armory choice.
- Escort pressure was tuned down so bosses remain the focal point.
- Boss phase changes now act as readable pacing shifts instead of massive raw stat spikes.

#### Upgrade pacing

- Early upgrade reveals are partially guaranteed to avoid dead starts.
- `Chaos` and `Bombard` are intentionally gated later in the run.
- Their probability is influenced by board state so they can act as pressure valves.

#### Build scaling

- Build levels are persistent within a run even when switching builds.
- Build growth is effectively indefinite, but constrained by practical caps on some visual and fire-rate properties.
- Current build balance intent:
  - `Rail Focus`: precision anchor killer
  - `Nova Bloom`: dominant primary-fire coverage
  - `Missile Command`: visible barrage / support-heavy offense
  - `Fracture Core`: fragment-heavy burst pressure

### Balance Follow-Up Priorities

When revisiting balance, check these in order:

1. Board composition before raw HP numbers
2. Boss readability before boss health
3. Build identity before build DPS parity
4. Upgrade pacing before adding more upgrade types
5. Renderer cost before adding more persistent VFX

## Current Snapshot Conclusion

The prototype has moved beyond “single gun shooting number blocks” and now has a clear structure:

- endless pressure tiers
- guaranteed early weapon path access
- escalating encounters
- boss gates
- persistent build identities
- build-specific ultimates
- a spawn system that is increasingly biased toward mixed hordes rather than only giant tanks

The next meaningful step is not adding more raw content immediately. It is making the current systems easier to maintain and easier to tune, because the prototype now has enough moving parts that future work will benefit from a stable reference and a cleaner code split.
