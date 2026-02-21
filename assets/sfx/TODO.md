# SFX Manifest (Current + Missing)

This list is based on current game events and tower/enemy types in:
- `app/(tabs)/index.tsx`
- `src/game/engine.ts`
- `src/game/config.ts`

Use this as a filename target list while searching online packs.

## 1) Core Gameplay SFX

### Have
- `spawn.wav`
- `hit.wav` (generic impact; currently reused by multiple towers)
- `place.wav`
- `upgrade.wav`
- `sell.wav`
- `target-mode.wav`
- `bomb-fire.wav`
- `bomb-hit.wav`
- `cold-fire.wav`
- `cold-hit.wav`
- `lance-fire.wav`
- `laser-fire.wav`

### Missing (high priority)
- `pulse-fire.wav` (currently reusing `hit.wav`)
- `pulse-hit.wav`
- `lance-hit.wav`
- `spray-fire.wav` (currently reusing `hit.wav`)
- `spray-hit.wav`
- `laser-hit.wav` (beam contact / burn tick)

## 2) Enemy SFX

### Missing (high priority)
- `enemy-death-spark.wav`
- `enemy-death-block.wav`
- `enemy-death-spike.wav`

### Optional variants
- `enemy-spawn-spark.wav`
- `enemy-spawn-block.wav`
- `enemy-spawn-spike.wav`

## 3) Base/Core and Match State

### Missing (high priority)
- `core-damage.wav` (plays whenever enemy reaches endpoint)
- `core-damage-alert.wav` (sharper warning layer)
- `core-low-health-loop.wav` (loop when lives are critically low)

### Missing (medium priority)
- `wave-start.wav`
- `wave-cleared.wav`
- `victory.wav`
- `defeat.wav`

## 4) Economy / UI Feedback

### Have
- `place.wav` (buy/place)
- `upgrade.wav`
- `sell.wav`
- `target-mode.wav`

### Missing (high priority)
- `ui-cannot-place.wav`
- `ui-insufficient-funds.wav`

### Missing (optional polish)
- `ui-menu-open.wav`
- `ui-menu-close.wav`
- `ui-pause.wav`
- `ui-resume.wav`
- `ui-speed-toggle.wav`
- `ui-select.wav`
- `ui-deselect.wav`

## 5) Ambient / Loops

### Missing (recommended)
- `ambience-gameplay-low-loop.wav`
- `ambience-gameplay-high-loop.wav`
- `ambience-prewave-tension-loop.wav`
- `ambience-relay-loop.wav`
- `ambience-switchback-loop.wav`
- `ambience-menu-loop.wav`

## 6) Minimal "Complete Enough" Acquisition Set

If you want the shortest path to solid coverage, get these first:
- `pulse-fire.wav`
- `pulse-hit.wav`
- `lance-hit.wav`
- `spray-fire.wav`
- `spray-hit.wav`
- `laser-hit.wav`
- `enemy-death-spark.wav`
- `enemy-death-block.wav`
- `enemy-death-spike.wav`
- `core-damage.wav`
- `core-low-health-loop.wav`
- `ui-insufficient-funds.wav`
- `ui-cannot-place.wav`
- `wave-start.wav`
- `wave-cleared.wav`
- `victory.wav`
- `defeat.wav`
- `ambience-gameplay-low-loop.wav`

## 7) Search Keywords

- "tower defense pulse shot sfx"
- "sci fi projectile impact sfx"
- "laser hit burn impact sfx"
- "enemy robot death sfx"
- "base under attack alert sfx"
- "low health warning loop game sfx"
- "cyber ui error click sfx"
- "industrial ambience loop seamless"
