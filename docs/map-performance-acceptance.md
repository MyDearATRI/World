# WO-005 measurement contract

Declared after the exact 98c4bc1 baseline and before candidate browser measurement.
The benchmark runs sequentially in local headless Edge 152.0.4191.66, using all
192 approved objects and 605 relations at 1440x1000, 1024x900 and 390x844.
No node or edge may be removed to improve timing. Mobile input is simulated.

Baseline artifacts: `artifacts/wo-005/baseline-measurement/report.json` and separate
`1440-drag-pan.cpuprofile` / `1440-hotspots.json`. The 27 passing checks and three
failed collapse-return checks describe the old interface only.

| Diagnostic p95 (ms)           | 1440 | 1024 |  390 |
| ----------------------------- | ---: | ---: | ---: |
| Cold open input to next RAF   | 84.4 | 88.2 | 74.1 |
| Warm open input to next RAF   | 43.6 | 44.2 | 41.3 |
| Drag input to observed render | 12.2 |  8.7 |  5.4 |
| Pan input to observed render  | 27.0 | 25.0 | 29.1 |
| Zoom input to observed render | 12.1 | 18.6 | 23.9 |

Acceptance tolerances:

- All actual map/reading tasks must pass; zero browser execution errors.
- Pan p95 should improve by at least 20 percent at each viewport, with no geometry
  writes during pure camera translation. This is a measured local target, not a
  promise about every device.
- Drag and zoom p95 must remain below 32 ms. One added view/layout frame is tolerated
  because readable neighboring names are now retained at distant scale.
- Cold/warm map activation must remain below 120 ms for its next observed RAF.
  Compare a cold standalone map open with a cold standalone map open; default-entry
  map construction is reported separately if the changed entrance warms the cache.
- No new long task above 50 ms during continuous pan/drag; opening and final settling
  are reported separately. Verify render counters and positions stop after settling.
- Keep exact source/target sets, collision separation, held pointer alignment,
  original passage, camera history and native canonical links.

These observations are not physical-screen FPS, compositor presentation timing,
production INP or a performance score. Preserve any failures and diagnose them;
do not relax the tolerances after seeing candidate numbers.

## Matched reader-first baseline

The revised entrance opens a map by default, so the comparison additionally starts
both versions at the same direct reader URL with no map ever rendered. The first
map-button activation is cold; the next is warm. This avoids calling the new
default-entry cache a cold-open speedup. The old JS/CSS are fulfilled from their
retained exact bytes; all three viewport responses were hashed and matched.

`artifacts/wo-005/matched-baseline-final/report.json`: 36 checks passed, three old
collapse-return failures retained, no execution errors. The revised matched p95
values (1440 / 1024 / 390) are cold 77.4 / 80.1 / 64.7 ms, warm 33.4 / 36.5 / 30.6,
drag 10.7 / 12.2 / 4.5, pan 26.8 / 23.9 / 28.0 and zoom 10.6 / 9.2 / 17.1.
The stricter of the original and matched pan thresholds is enforced:
21.44 / 19.12 / 22.40 ms. No other tolerance is relaxed.

## Measurement correction before the second matched candidate

The first candidate remains a failed run in `matched-candidate/report.json`:
1024px pan RAF p95 missed its target, and 390px cold open exceeded 120 ms. The
390px purported pan actually dragged a node (confirmed by the actual target and
geometry counters), so that pan sample is invalid rather than fast.

The RAF probe can execute before the application's callback in the same frame.
Also, the first two sub-5px moves intentionally do not activate a pan. Waiting for
a later move in those samples measures gesture activation, not completed panning.
The corrected comparison therefore records both the original all-input RAF series
and a MutationObserver timestamp on the renderer's existing render-count attribute.
It reports activation and continuous movement beyond the existing 5px threshold
separately, without changing the production gesture threshold.

For continuous panning, compare the corrected DOM-completion p95 with the old
runtime measured by exactly the same probe and valid blank-space gesture. Require
at least 20 percent improvement at each width AND the previously declared absolute
pan limits of 21.44 / 19.12 / 22.40 ms. Keep the original RAF results visible as
diagnostics, including any historical-estimator failures. Cold/warm next-RAF
limits (120 ms), drag/zoom RAF limits (32 ms), geometry-write, long-task and actual
task gates remain unchanged. Touch must start at least 30px clear of every node
and label hit rectangle and the actual pointerdown must confirm blank space;
otherwise report the gesture invalid. The DOM timestamp is still not a compositor
presentation measurement. Re-measure both versions; never overwrite the first run.
