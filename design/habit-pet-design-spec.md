# Habit tracker with an animated pet
## First-version design spec

Help people build consistent health habits through retrospective logging and a pet scene that reflects their progress. The first version is a website. The home screen shows an animated piglet outside a small hut, alongside the current habit check-ins. The piglet moves on its own and stays a piglet. Logging habits drives scene changes and treat animations. A future desktop companion can display the same pet using the same state and artwork.

## Setup and daily use

1. Connect a Google account. The app creates a dedicated spreadsheet in that account and provides a link to open it.
2. Enable the starter habits you want, choose your goals and near-miss thresholds where applicable, and customize which habits control the pet's surroundings and reactions.
3. Log activities after they happen. The sleep check-in presents the previous night and accepts bedtime and sleep duration manually from any tracker. Count habits use one tap per occurrence. History allows backfill, corrections, and undo.

## Starter habits

| Habit | Input | Evaluation | Suggested pet effect |
|---|---|---|---|
| On-time bedtime | Bedtime from tracker | Each night against a personal deadline | Weather |
| Enough sleep | Sleep duration from tracker | Each night against personal duration thresholds | Mood and energy |
| Exercise | Exercise date | Distinct exercise days per week, such as goal 3 and almost goal 2 | Hut |
| Hunger before meals | Hunger rating and meal | Multiple observations per day, with optional logging goals | Optional treat for checking in |
| Post-meal walks | One tap per walk | Occurrences per day, such as goal 2 and almost goal 1 | Optional treat for reaching goal |

A habit definition specifies input type, evaluation period, aggregation, targets, and whether it is logging-only. Support clock times, durations, ratings, event counts, and distinct dates. For example, two exercise logs on Monday count as one exercise day, while two walks on Monday count as two walks. Preserve walks beyond the daily goal in history. A goal for hunger tracking should measure check-ins, independent of the rating entered.

## Progression and skips

Day- and week-based goals use the same progression rules. For each completed evaluation period, determine one outcome and apply it to the habit's progression level.

| Outcome | Level change |
|---|---|
| Goal met | Add one, up to the maximum |
| Almost goal met | Subtract one, down to zero |
| Below almost goal | Halve and round down |
| Explicit skip | Hold the level and preserve the streak without adding to it |

Validate that an almost-goal threshold is easier to meet than the goal. For bedtime, on time means at or before the deadline. Up to 30 minutes late, including the 30-minute mark, is a small infraction. More than 30 minutes late is a big infraction. An unlogged bedtime after the cutoff is a small infraction. Each habit offers Skip, and a skipped period is distinct from an unlogged period in history.

Count goals can award their upgrade once as soon as the target is met. Apply downgrades when the period closes. For weekly exercise with a goal of 3 and almost goal of 2, the third distinct exercise day earns the upgrade. At week close, 2 days costs one level and 0–1 days halves it. A skipped week holds the level. Keep the streak count and the visual level distinct so a miss can end a streak while preserving some progress in the scene.

Use the user's local calendar and associate an overnight sleep entry with its intended night, including bedtimes after midnight. Proposed v1 cutoff for Monday night is the end of Tuesday local time. Backfilling or correcting an entry replaces its previous outcome and recalculates subsequent levels in date order.

## Pet effects

Weather, mood, and hut each accept one controlling habit or can be left unassigned. A user can assign the same habit to multiple effects. Several habits can award treats. Reassigning an effect uses the newly selected habit's existing history immediately. Compute its current level from that history using the receiving effect's range.

- **Weather** has seven levels, 0–6. Start at level 3, overcast. The lowest levels are stormy. At the highest level, show sunshine and rainbows during the day and shooting stars at night.
- **Mood and energy** affect the pig's expression and motion. Weather can make the pig look sad while short sleep can independently make it yawn or move slowly. An on-time bedtime and short sleep can therefore produce a brighter scene with a sleepy pig.
- **Hut condition** visibly improves as its controlling habit makes progress. Plan for seven to ten artwork levels for hut condition and mood.
- **Treats** are brief eating animations. The pet has no favorite foods. The initial catalog is ramen, strawberry cheesecake, chocolate mousse, butternut squash soup, soft tofu soup, shortbread cookie, ice cream, meat skewers, chocolate truffles, and braised short rib. A proposed default is one treat per achieved count goal per period. For observation habits, use the act of checking in if the user enables treat rewards. Historical recalculations should update the scene without replaying rewards.

Keep habit evaluation independent of the renderer. Define each animal through its animation assets, supported mood levels, and anchors for hut placement and food. Define weather scenes, hut art, and treat art independently so adding a new animal or changing the artwork does not require changes to habit rules. The website and a future desktop display should consume the same scene state.

## Artwork and animation workflow

Use ChatGPT Images in ChatGPT Work to generate concept art and individual image assets. Use Codex to assemble the layered scene, implement animations, and test them in the website. Start by approving one reference illustration of the piglet outside its hut. Use that illustration for subsequent art so the assets share the same style, perspective, and scale.

| Asset | Production approach |
|---|---|
| Piglet | Make one canonical three-quarter-view pose on a transparent background. Animate breathing and bobbing in code, with a few matching sprites for blinks, yawns, and chewing. Align the feet and keep the body scale consistent when swapping sprites. |
| Weather | Use one landscape with separate layers for clouds, rain, sunshine, rainbows, and shooting stars. Combine and vary the layers across the seven weather levels and the day and night scenes. |
| Hut | Create one base hut and edit it into condition variants from the same reference. Keep the camera angle, footprint, and placement consistent across levels. |
| Treats | Generate each food as a separate transparent sprite. Use a shared food placement point and reuse the piglet's chewing animation across the catalog. |

Use a few authored poses and animate repeatable motion in code. Independently generated frames can shift the piglet's proportions and position between poses. Keep asset references, placement anchors, and animation definitions reusable across the website and the eventual desktop companion.

### First animation prototype

Build one scene with the piglet, one hut, one landscape, sunshine and rain, and a bowl of ramen. Preview it on the website at phone size. Verify that the piglet breathes, blinks, and eats without visible jumps between poses, that the weather can switch without moving the scene, and that the ramen aligns with the eating animation. Use this prototype to settle the style and asset layout before producing the full set.

## Google Sheets and history

Give each account one dedicated spreadsheet created during setup and reused on later sign-ins. Authorize access for the individual account. Records are available for analysis and charting in Sheets. All habit record corrections go through app history.

Use structured rows with stable record IDs, habit IDs, local dates or period keys, recorded values and units, and an explicit skip status. Keep habit settings separate from observations, including effective dates for settings changes so prior results can be reproduced. Update corrected rows by ID. Retries should avoid duplicate sheets, records, or rewards. Preserve unsynced edits for retry and show their sync status. Direct spreadsheet edits should never be applied as app corrections. The implementation should define how to isolate app-managed data from users' own charts and analysis.

## Defaults to finalize

- Mood and hut artwork counts, duration thresholds, the hunger rating scale, and the default start of the exercise week.
- Confirm the bedtime logging cutoff and define missing-log behavior for other habits where it differs from ordinary count shortfalls.
- Choose how treats are selected from the catalog and confirm which starter habits award them by default.

## Acceptance examples

- At weather level 6, a bedtime exactly 30 minutes late drops it to 5. A bedtime 31 minutes late drops it to 3. A missed bedtime log drops it to 5. An explicit skip holds it at 6.
- Backfilling that missed log with an on-time bedtime restores the resulting level to 6 before any later nights are recalculated.
- On-time bedtime and short sleep can brighten the weather while the pig yawns.
- With exercise targets of 3 and 2, a third distinct day advances the hut once. A week closing at 2 days drops one level. At level 5, a week closing at 1 day drops it to 2.
- Two walk taps meet a daily goal of 2. A third tap remains in history. Reassigning weather to walks updates the scene using existing walk history.
- Two users can choose different goals and pet assignments. Each sees only their own app history and dedicated spreadsheet.
