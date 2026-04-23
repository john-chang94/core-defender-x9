# Prototype V2 Reference

Snapshot date: `2026-04-22`
Board version: `v0.73`

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

The current build also includes persistent between-run `Codex + Mastery` data stored locally, a scripted encounter registry, a rotating four-boss cadence, named biome sectors, Arena-local audio settings plus music / SFX playback, impact + lane-band hazard telegraphs, one-time coaching chips, a local cosmetic collection / equip layer, and an early cockpit-style Campaign Home Base foundation on top of the meta flow.

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
- the default ship silhouette is now a sharper low-poly rail-shooter hull with a pointed nose, swept triangular wings, rear fins, and twin engine slits
- a semi-transparent move hint sits below the ship and hides while the player is pressing in that control zone
- one-time coaching chips can appear during live play for movement, armory queueing, build switching, overdrive, ultimate charge, hazards, boss phases, Collection claims, and high-tier goals; `Reset tips` in the `Run` menu clears the seen state
- the armory is accessible anytime during a run via the HUD button; if no upgrade choices are pending it opens in browse mode showing upgrade status and the next unlock threshold
- the armory panel has two sub-tabs: `Upgrades` and `Build`; build selection was moved out of the main menu and into the armory `Build` sub-tab
- the in-game menu now includes `Run`, `Codex`, `Mastery`, and `Collection` tabs (the `Builds` tab was removed)
- the `Run` tab now shows active biome / sector info, next boss preview, next reward preview, coaching reset, and Arena-local audio controls
- run-end summary panels now show tier reached, bosses cleared, mastery XP granted, and newly claimable cosmetics
- player death now plays a short closing telemetry transition before the run-end summary appears
- codex, mastery, and cosmetic collection state persist across relaunches through a versioned AsyncStorage blob
- the first `Home Base` shell is live as the Arena V2 entry surface, now using a fixed, no-scroll cockpit command deck with Mission Launch, Collection, Codex, Mastery, Weapon Equip, and Shield Equip stations; station details open as separate Home Base panels with a back button, while Endless and game switching live under `Extras`
- the first campaign mission is `Prism Verge Recon`, a short `T1-T6` sortie ending at `Prism Core`
- campaign runs disable salvage / armory drafts and replace the left arena armory button with a shield ability button
- the in-game menu still allows game switching and restart
- the `Codex` tab shows a compact summary line, a `Rewards` unlock chip row, and the enemy log only (Build Log removed)
- the `Mastery` tab shows mastery cards directly without the showcase header card
- the `Collection` tab uses a compact pill row for build selection instead of a 4-card grid

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

- Endless runs are tier-based and unbounded.
- Campaign missions are tier-based but capped by the mission target tier.
- Pressure scales through enemy composition, formations, enemy fire, elite encounters, and boss checkpoints.
- Difficulty is not only HP inflation anymore, although HP scaling is still part of the balance model.

### Campaign foundation

- Campaign currently reuses the Arena V2 combat runtime instead of introducing a separate engine.
- Campaign mission state is tracked separately from endless run rules.
- Campaign runs use equipped weapons, persistent weapon stat upgrades, and shield ability scaffolding from the Home Base.
- Current campaign weapon IDs map onto the existing four combat implementations: `railCannon`, `bloomEmitter`, `missileRack`, and `fractureDriver`.
- Campaign weapon / ship stat upgrades are permanent campaign-only installs. Each campaign level gained grants `1` shared upgrade point, and the first mission clear is tuned to grant roughly two level-ups from a fresh save.
- Current campaign weapon upgrade tracks are `Damage Matrix`, `Barrel Array`, `Cycle Accelerator`, `Velocity Rails`, and `Stability Core`. `Damage Matrix` has no cap; `Barrel Array` and `Cycle Accelerator` use the same build-specific caps as Endless; `Velocity Rails` and `Stability Core` cap at level `5` per weapon.
- Current campaign ship stat upgrades are `Hull Weave` and `Shield Capacitor`; both are separated from weapon upgrades in the Home Base UI and have no cap.
- Campaign shields provide active abilities. `Aegis Dampener` reduces incoming damage by `60%` for a short window. `Point Screen` is scaffolded as a later unlock that clears `50%` of active enemy projectiles and briefly reduces damage.
- Campaign runs do not use salvage collection or in-run armory drafts.
- Campaign XP is persisted locally and currently unlocks the second weapon slot at campaign level `4`.

## Build System

There are four live builds. The active build can be switched in-run from the armory `Build` sub-tab.

Important implementation note:

- the reference below reflects actual live combat behavior
- some short in-code flavor text may lag behind this document when tuning moves faster than menu copy

### Rail Focus

Identity:

- precision / lane-control build
- fewer guns, tighter spread, higher direct damage, higher pierce

Combat behavior:

- normal gun cap: `2`
- overdrive gun cap: `3`
- runtime damage multiplier: `×1.44` on base damage
- runtime fire interval: `×1.08` (slightly slower than base, but pierce and bullet speed compensate)
- stronger direct-hit scaling than the wider-area builds
- precision bonus (`×1.58` damage) against elites, bosses, and winding-up enemies
- fastest-feeling long-lane pressure among the non-missile builds
- `Rapid Cycle` cap: `5` applications (fire interval floor `0.065s`)
- `Twin Array` cap: `1` application (`1 → 2` guns)

Ultimate: `Rail Surge`

- marks high-priority targets / lanes
- drops concentrated rail strikes on those lanes
- strongest at deleting elites and boss pressure points

### Nova Bloom

Identity:

- fan-shaped primary-fire coverage build
- crowd-control / coverage build

Combat behavior:

- normal gun cap: `4`
- overdrive gun cap: `5`
- runtime damage multiplier: `×0.82` (lower per-shot damage, compensated by volume)
- runtime shotCount floors at `2` (min two barrels always active)
- broader spread than the other primary-gun builds
- intended to own screen coverage rather than single-target burst
- `Rapid Cycle` cap: `3` applications (fire interval floor `0.085s`)
- `Twin Array` cap: `3` applications (`1 → 4` guns)

Ultimate: `Solar Bloom`

- fires a large arena-wide solar sweep
- heavily damages enemies across the board
- does not trigger overdrive automatically

### Missile Command

Identity:

- ordnance-only build
- homing missile pressure with splash

Combat behavior:

- does not use the standard primary-gun volley loop
- fires missiles one at a time inside a volley window
- starts with `2` missiles per volley; upgradeable to `6`
- normal gun cap: `6`
- overdrive volley count: `12`
- base volley window: `1.0s`
- `Rapid Cycle` reduces the burst window by `0.1s` per step (`5` applications caps it at `0.5s`)
- overdrive forces `12 missiles` in a fixed `0.5s` window
- `Twin Array` cap: `4` applications (`2 → 6` missiles)
- missiles are homing with strong splash damage; direct hit damage is `×3.35` of base weapon damage

Ultimate: `Missile Barrage`

- launches repeated strike volleys and strike-lane effects
- built for lane pressure and formation disruption

### Fracture Core

Identity:

- slow heavy shot into fragmentation build
- impact-to-shard chain build

Combat behavior:

- normal gun cap: `3`
- overdrive gun cap: `5`
- runtime damage multiplier: `×2.10` on base damage (highest single-shot damage of any build)
- runtime fire interval: clamped to minimum `0.32s` (`×2.3` multiplier on stored interval); `Rapid Cycle` has no effect and is disabled from game start since the runtime clamp always overrides it
- primary shots are large, rock-like projectiles with `+6.0` bullet size added at runtime (base `8 → 14`), capped at `26.0`
- on primary impact: spawns up to `8` shards in a `±50°` fan, triggers a fracture pulse with radius `90` that deals `24%` of hit damage to all enemies inside, and queues a VFX burst scaled to `×7.0` the projectile size
- shard impact: each shard carries `34%` of primary hit damage and has a fragment splash radius of `60` that deals `42%` of shard damage to nearby enemies
- `Twin Array` cap: `2` applications (`1 → 3` shots)
- overdrive: fire interval drops to `max(0.13s, 0.32 × 0.54) ≈ 0.173s`, damage gets `+16` bonus (vs `+10` for other builds), projectile size cap raises to `30.0`

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

- the first draft threshold starts at `120`; early thresholds were deliberately kept higher so upgrades do not arrive trivially in the first few tiers
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
- upgrade caps for `Twin Array` (max shot count) and `Rapid Cycle` (fire interval floor) are enforced per active build using `weaponsByBuild`, so each build tracks its own independent weapon state
- in browse mode (no pending choices) all upgrade cards are disabled and the prompt shows the next unlock threshold
- each build maintains its own weapon in `weaponsByBuild`; switching builds restores the stored weapon for that build, preserving per-build upgrade progress independently

Practical meanings and caps:

- `Damage Matrix`: `+3` raw damage per shot — **unlimited**
- `Rapid Cycle`: `−12%` fire interval per step, `−6%` spread — **Rail Focus** `5×` (floor `0.065s`), **Nova Bloom** `3×` (floor `0.085s`), **Missile Command** `5×` (floor `0.065s`, reduces burst window by `0.1s` per step to a min of `0.5s`), **Fracture Core** `0×` (disabled — runtime clamp overrides stored interval)
- `Twin Array`: `+1` barrel/missile — **Rail Focus** `1×` (`1→2`), **Nova Bloom** `3×` (`1→4`), **Missile Command** `4×` (`2→6`), **Fracture Core** `2×` (`1→3`)
- `Phase Pierce`: `+1` pierce — **all builds** `3×` (cap: `3` pierce)
- `Shield Capacitor`: `+16` max shield — **unlimited**
- `Reinforced Plating`: `+20` max health — **unlimited**
- `Accelerator`: `+240` bullet speed / `+0.7` bullet size / `+1` pierce — **all builds** `7×` (all three sub-stats max at app 7: speed `980→1700` in 3 apps, pierce `0→4` in 4 apps, size `8→12.5` in 7 apps)

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

## Meta Progression / Collection

Persistent Arena meta is stored as one versioned AsyncStorage blob.

Current persisted layers:

- `Codex`: enemy discovery, first-seen tier, first kill / clear tier, total kills, and boss clears
- `Mastery`: build XP, rank title, run count, best tier, mini-boss clears, and boss clears
- `Collection`: locked / claimable / owned cosmetic inventory plus equipped banner, codex frame, build accent, and build crest
- `Coach hints`: one-time seen state for Arena V2 coaching chips
- `Campaign`: player XP / level, shared upgrade points, per-weapon stat upgrade levels, global health / shield stat upgrade levels, campaign mission progress, equipped campaign weapon slots, and equipped shield ability

Current global reward cosmetics:

- `Boss Banner: Prism Shard`: first `Prism Core` clear
- `Boss Banner: Hive Trace`: first `Hive Carrier` clear
- `Boss Banner: Loom Static`: first `Vector Loom` clear
- `Boss Banner: Eclipse Cut`: first `Eclipse Talon` clear
- `Boss Banner: Triad Breaker`: clear `Prism Core`, `Hive Carrier`, and `Vector Loom` in one run
- `Boss Banner: Deep Cycle`: reach `T45`
- `Codex Frame: Full Spectrum`: discover every enemy / boss signal
- `Codex Frame: Endless Apex`: reach `T24`
- `Codex Frame: Threat Cartographer`: reach `T30`
- `Codex Frame: Triad Grid`: clear the original three bosses across lifetime progression
- `Codex Frame: Full Rotation`: clear all four rotating bosses across lifetime progression
- `Codex Frame: Outer Limit`: reach `T60`

Current build-specific reward cosmetics:

- mastery rank `4`: one build accent per build
- mastery rank `8`: one build crest per build
- mastery rank `10`: one apex build accent per build (`Apex Rail`, `Solar Crown`, `Siege Mesh`, `Singularity Vein`)

Tier and mastery rewards are retroactive from persisted `bestTier` and mastery rank data. The single-run triad banner is intentionally not retroactive unless the current run summary proves all three bosses were cleared in that same run.

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
- `weaver`
- `conductor`
- `raider`
- `hunter`
- `prismBoss`
- `hiveCarrierBoss`
- `vectorLoomBoss`
- `eclipseTalonBoss`

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
- `raider`: fast flank craft that telegraphs a side dash before firing angled crossing bursts
- `hunter`: pursuit marksman that marks a lane, delays, then fires staggered needle volleys around the lock
- `prismBoss`: boss anchor with the heaviest health and multi-pattern pressure
- `hiveCarrierBoss`: rotating boss carrier that mixes escort deployment, artillery pressure, and lane sweeps
- `vectorLoomBoss`: rotating control boss that layers thread walls, sweep beats, and support spawns
- `eclipseTalonBoss`: rotating flank boss that combines raider dashes, hunter marks, and support pressure

### Enemy presentation state

Enemy hulls were refactored from complex custom polygons to clean geometric shapes for better rendering performance.

Current presentation state:

- non-boss enemies use distinct geometric shapes: `hover` and `orbiter` are circles; `burst` and `interceptor` are triangles; `sniper`, `lancer`, `raider`, and `hunter` are diamonds / swept diamonds; `tank` and `warden` are rectangles; `bomber`, `artillery`, and `weaver` are pentagons; `carrier` and `conductor` are hexagons
- boss enemies (`prismBoss`, `hiveCarrierBoss`, `vectorLoomBoss`, `eclipseTalonBoss`) retain custom polygon silhouettes
- enemy aim direction rotates the barrel / gun direction toward the current fire target
- gun barrels are rendered as native `<Line>` primitives instead of custom path objects
- enemy projectile styles vary by family (`orb`, `bolt`, `needle`, `bomb`, `wave`)
- wing panels, canopy shapes, and hull accent overlays were removed as part of the hull simplification

## Encounter Structure

### Current live cadence

- mini-boss encounter every `3` tiers
- boss encounter every `6` tiers
- boss rotation currently runs `Prism Core` at `T6`, `Hive Carrier` at `T12`, `Vector Loom` at `T18`, `Eclipse Talon` at `T24`, then repeats every `24` tiers
- flank / pursuit formation scripts begin after the Vector tier band: `Razor Pincer`, `Hunter Mark`, `Flank Relay`, `Marked Crossfire`, `Shielded Pursuit`, and `Eclipse Net`

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
- `Raider Talon`
  - anchor: `raider`
- `Hunter Pack`
  - anchor: `hunter`
- `Prism Core`
  - anchor: `prismBoss`
- `Hive Carrier`
  - anchor: `hiveCarrierBoss`
- `Vector Loom`
  - anchor: `vectorLoomBoss`
- `Eclipse Talon`
  - anchor: `eclipseTalonBoss`

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

- arena biome sector changes every `6` tiers
- the named sector rotation is `Prism Verge`, `Hive Forge`, and `Vector Spindle`, then repeats every `18` tiers
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
- `renderStress` metric is recalibrated to control VFX and effect budget scaling only; enemy hull rendering cost is no longer a major stress contributor because enemy shapes are now simple geometry
- simplified geometry enemy hulls (`<Circle>` or small polygon paths) replaced the earlier complex custom path allocations for non-boss enemies
- gun barrel rendering was refactored from custom Skia path objects to native `<Line>` primitives across all enemy types
- conditional render flags `skipEnemyDetails`, `simplifiedBullets`, and `simplifiedEnemies` were removed; all bullets now render at full quality and enemy details are not downgraded at high stress
- fracture fragment effects were reduced for performance (`8` normal, `6` dense)
- lane-band hazard bars are hard-capped at `3` total simultaneous active lanes across the entire arena
- regular / mini-boss `weaver` and `conductor` patterns normally budget up to `2` lane bands; `vectorLoomBoss` can budget up to `3`, but the global cap still wins
- high-tier projectile caps tighten further at `T45` and `T60`, with extra shedding for `Missile Command` during overdrive under high combat stress
- extreme render stress now applies an additional projectile / VFX render-budget step to smooth late-tier swarm + ultimate overlaps

### Current known performance hotspots

The build reached `T60` in playtest with mostly stable performance, but these are still the most expensive combat situations:

- high-threat screens with maxed `Nova Bloom`
- maxed `Missile Command` during overdrive or ultimate
- dense enemy clustering plus frequent simultaneous hit effects
- boss overlaps with large projectile counts and active arena effects

## Current File Map

Primary implementation files:

- `/Users/johnchang/Desktop/defender/src/prototype-v2/types.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/config.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/builds.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/upgrades.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/encounters.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/engine.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/biomes.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/audio.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/meta.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/cosmetics.ts`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaCanvas.tsx`
- `/Users/johnchang/Desktop/defender/src/prototype-v2/ArenaPrototypeScreen.tsx`

## Changelog Snapshot

### 2026-04-22

- Advanced arena board label to `v0.73`.
- Added the missing campaign `Barrel Array` gun-count upgrade. Its cap is build-specific and matches the same max gun counts used by Endless builds.
- Updated campaign weapon upgrade caps: `Damage Matrix` is uncapped, `Cycle Accelerator` respects the same build-specific ROF floors as Endless, and capped utility tracks remain capped at level `5`.
- Added uncapped campaign ship stat upgrades for max health and max shield, separated from the weapon-upgrade grid in the Home Base `Weapon Equip` panel.
- Advanced arena board label to `v0.72`.
- Added campaign weapon stat upgrades in the Home Base `Weapon Equip` panel. Campaign level-ups now grant persistent weapon upgrade points, and upgrades are tracked per campaign weapon across `Damage Matrix`, `Cycle Accelerator`, `Velocity Rails`, and `Stability Core`.
- Campaign weapon upgrades are applied when launching campaign missions only; Endless mode still uses salvage / armory drafts and is not affected by campaign weapon installs.
- Advanced arena board label to `v0.71`.
- Reworked `Home Base` to avoid scrolling on the root screen. The main deck now fits in the phone viewport and only exposes Mission Launch, Collection, Codex, Mastery, Weapon Equip, and Shield Equip as primary stations.
- Added Home Base detail panels with a back button for mission info, Collection status / claim-ready rewards, Codex summary, Mastery summary, weapon slot equip, shield ability equip, and `Extras`; Endless Simulation and Switch Game moved into `Extras`.
- Advanced arena board label to `v0.70`.
- Redesigned `Home Base` from a vertical card list into a cockpit-style command deck inspired by the provided reference: top status rail, central map console, ship bay, grouped side stations, compact loadout console, and docked navigation.
- Grouped related Home Base actions to save screen space: `Loadout` covers weapons and shield ability, `Archives` covers Codex and Mastery, `Collection` covers cosmetics and rewards, `Mission Control` covers campaign launch, and `Endless` remains a separate simulation entry.

### 2026-04-21

- Advanced arena board label to `v0.69`.
- Added the first Campaign Home Base shell with campaign mission launch, endless launch, Collection / Codex / Mastery access, campaign XP display, and loadout controls.
- Added persistent campaign state for player XP / level, mission progress, equipped campaign weapon slots, and equipped shield ability.
- Added `Prism Verge Recon` as the first short campaign mission (`T1-T6`) using the existing Arena V2 combat runtime and `Prism Core` as the endpoint boss.
- Added campaign shield abilities and replaced the left in-arena armory button with a shield ability button during campaign runs. `Aegis Dampener` reduces incoming damage by `60%`; `Point Screen` is scaffolded as a later unlock that clears `50%` of active enemy projectiles.
- Campaign runs now disable salvage / armory reward flow while preserving Endless mode’s current salvage, armory, build, and cosmetic systems.
- Advanced arena board label to `v0.68`.
- Added the flank / pursuit combat pack: `Raider` and `Hunter` enemy jobs, six new regular formation scripts, and two new mini-boss scripts (`Raider Talon`, `Hunter Pack`).
- Added `Eclipse Talon` as the fourth rotating three-phase boss; boss cadence is still every `6` tiers and now rotates over `24` tiers (`T6`, `T12`, `T18`, `T24`, repeat).
- Added reward-only Collection items `Boss Banner: Eclipse Cut` and `Codex Frame: Full Rotation`; the original `Boss Triad Complete` reward still tracks only `Prism Core`, `Hive Carrier`, and `Vector Loom`.
- No audio files, cue mappings, settings, or asset-pack behavior changed in this update.
- Advanced arena board label to `v0.67`.
- Updated `Missile Command` ultimate trailing glyphs from stacked glow circles into mini missile silhouettes while preserving the existing colors and opacity.
- Advanced arena board label to `v0.66`.
- Added the T60 cosmetic reward ladder: `Codex Frame: Threat Cartographer` (`T30`), `Boss Banner: Deep Cycle` (`T45`), `Codex Frame: Outer Limit` (`T60`), and `Boss Banner: Triad Breaker` for clearing all three bosses in one run.
- Added mastery rank `10` build accents for all four builds and wired retroactive unlocks from persisted mastery levels.
- Added persisted one-time Arena coaching chips plus `Reset tips` in the `Run` menu.
- Replaced the rounded player ship with a sharper angular rail-shooter silhouette while preserving equipped accent / crest presentation.
- Added late-tier projectile and render-budget tuning for T45 / T60 pressure, especially `Missile Command` overdrive / ultimate overlaps.
- No audio files, cue mappings, settings, or asset-pack behavior changed in this update.
- Advanced arena board label to `v0.65`.
- Added a global hard cap of `3` simultaneous lane-band hazards across the entire arena, regardless of how many mini-boss / boss sources are active.
- Slowed ultimate charge recovery from damage, kills, rail precision hits, mini-boss clears, and boss clears.
- Added a short player-death closing telemetry transition before the run-end summary modal appears.
- Updated stale reference details for current board version, enemy roster, named biome cadence, and lane-band hazard caps.

### 2026-04-15 (continued)

- Advanced arena board label to `v0.63`.
- Buffed `Fracture Core`: damage multiplier raised `1.82 → 2.10`; bullet size add raised `+4.8 → +6.0` (base runtime size `8→14`), normal bullet size cap raised `23.2 → 26.0`; fracture pulse radius widened `66 → 90`; shard fragment splash radius widened `44 → 60`; fracture bits VFX radius on impact raised `×5.8 → ×7.0` of projectile size; shard spawn VFX radius raised `34 → 44`; overdrive fire multiplier tightened `0.67 → 0.54`, overdrive fire floor lowered `0.18s → 0.13s` (effective overdrive interval `~0.214s → ~0.173s`); overdrive bullet size cap raised `27.5 → 30.0`.
- Fixed `Missile Command` `Rapid Cycle` MAX badge: `BUILD_FIRE_INTERVAL_FLOOR['missileCommand']` corrected to `0.065` (matching apply function floor) so the MAX badge triggers after 5 applications.
- Updated reference doc with full per-build combat stats, runtime multipliers, and armory upgrade cap table.
- Advanced arena board label to `v0.62`.
- Fixed `Missile Command` `Rapid Cycle` MAX badge floor from `0.062` to `0.065`.
- Advanced arena board label to `v0.61`.
- Fixed `Missile Command` starting `shotCount` to `2`; updated `BUILD_MAX_SHOT_COUNT['missileCommand']` from `5` to `6` to allow 4 `Twin Array` applications (`2→6`).
- Advanced arena board label to `v0.60`.
- Fixed armory upgrade system root bug: added `weaponsByBuild` to `ArenaGameState` so each build maintains an independent stored weapon. `setArenaBuild` now swaps weapons between builds on switch. `applyArenaArmoryUpgrade` syncs `weaponsByBuild` after each upgrade. Both the engine guard and the screen-side guard now pass `activeBuild` to `isArenaArmoryUpgradeMaxed`.
- Renamed armory "Build" sub-tab to "Builds".
- Fixed armory panel to use fixed height so the modal does not shrink when switching to the Builds tab.
- Advanced arena board label to `v0.59`.
- Refactored main menu: removed the `Builds` tab; moved build selection into a new `Build` sub-tab inside the armory modal. Armory now has two sub-tabs: `Upgrades` and `Build`.
- Armory is now accessible anytime during a run. Opening it without pending choices shows a browse mode with upgrade status and the next threshold.
- Enforced per-build upgrade caps for `Twin Array` and `Rapid Cycle` so each build's max is matched to what its weapon transform can reach. Added `BUILD_MAX_SHOT_COUNT` and `BUILD_FIRE_INTERVAL_FLOOR` lookup tables in `upgrades.ts`.
- Cleaned up main menu tabs: `Codex` no longer shows a showcase header card or Build Log section; `Mastery` no longer shows a showcase header card; `Collection` replaced the 4-card build grid and second showcase card with a compact horizontal pill row.
- Renamed `Reward Hooks` section in Codex tab to `Rewards`.
- Tab bar buttons now use `adjustsFontSizeToFit` to prevent text wrapping; reduced `paddingVertical` on tab buttons.
- Advanced arena board label to `v0.58`.
- Capped lane-band hazard bars at `2` simultaneous lanes for regular enemies (`weaver`, `conductor`) and `3` for `vectorLoomBoss`.
- Buffed `Fracture Core`: increased damage multiplier per level, more aggressive fire interval reduction across levels, overdrive gun cap raised from `4` to `5`, faster overdrive fire floor, larger overdrive damage bonus (`+16` vs `+10` for other builds).
- Advanced arena board label to `v0.57`.
- Enforced per-build armory upgrade caps. `isArenaArmoryUpgradeMaxed` now accepts `buildId` and checks build-specific ceilings for `twinArray` and `rapidCycle`.
- Advanced arena board label to `v0.56`.
- Replaced non-boss enemy hull polygon definitions with simplified geometric shapes (circle, triangle, diamond, rectangle, pentagon, hexagon) in `ArenaCanvas.tsx`. Boss hulls unchanged.
- Removed `renderEnemyShipDetails` function and its helpers (`createEnemyWingPanelPath`, `createEnemyCanopyPath`). Wing panels, canopy shapes, and hull accents are no longer rendered.
- Removed `skipEnemyDetails`, `simplifiedBullets`, and `simplifiedEnemies` conditional flags. All bullets render at full quality. `renderStress` now drives VFX budget scaling only.
- Advanced arena board label to `v0.55`.
- Refactored enemy gun barrel rendering from custom Skia path objects to native `<Line>` primitives across all enemy types.
- Advanced arena board label to `v0.54`.
- Increased early-tier salvage thresholds slightly to slow upgrade pace in the first few tiers.
- Moved player projectile spawn point upward so shots originate directly above the player ship instead of from the bottom of the arena.
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
- more enemy jobs beyond the current `Warden` / `Lancer` / `Carrier` / `Artillery` / `Weaver` / `Conductor` / `Raider` / `Hunter` roster expansion
- more bosses after the current `Prism Core` / `Hive Carrier` / `Vector Loom` / `Eclipse Talon` rotation

### Progression expansion

- more campaign missions after the current `Prism Verge Recon` foundation map
- broader campaign equipment upgrade depth beyond the current per-weapon stat tracks
- campaign weapon slot switching in live combat; the second slot is currently persisted and gated but not yet a live toggle-fire system
- more cosmetic content and slot coverage on top of the current local claim / equip layer
- more premium-feeling armory picks beyond the current base set

### Retention / presentation

- more arena biomes and environment-specific visual language
- more audio layering and event-specific sound design once a stronger sound set is available
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

The immediate next step should validate the new Campaign shell before expanding content volume.

Recommended order:

1. Smoke-test `Prism Verge Recon` from Home Base through completion, including campaign XP persistence and shield ability behavior.
2. Decide whether live campaign weapon slot behavior should be toggle-only first or allow simultaneous dual-fire later.
3. Re-test the new flank / pursuit endless content through at least `T24` / `T30`, with special attention to `Raider` dash reads, `Hunter` mark readability, and `Eclipse Talon` phase transitions.
4. Keep audio expansion deferred until better source sounds are available.
