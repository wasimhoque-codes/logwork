# Gym Hawk mobile interface

The design uses a cool blue-gray canvas (`#F4F7FB`), white surfaces, dark purple-derived text (`#27283F`) and sky blue (`#66C7F4`) as its main color. Purple (`#6C6EA0`) supplies secondary controls and focus, pink (`#FF1053`) marks observations, and blue-gray (`#C1CAD6`) supports borders. Manrope headings and DM Sans body text are bundled locally for offline use. Body/input text is 16px; secondary text is generally 14px, with compact 12–13px chart annotations. Touch targets are at least 44×44px. Content is centered within 680px on large screens, with one primary action per task.

Today has a sky-blue workout hero with subtle decorative arcs, dark text and a white action. Supporting cards share delicate borders, soft shadows, rounded corners and tinted icon containers. Navigation floats above the safe area with a pale-blue selected state. Charts, focus rings, timers, logging inputs, sheets and completion screens share semantic CSS variables. Primary sky-blue controls use dark text; purple controls use white text. Error text uses an accessible pink-derived shade. Motion respects reduced-motion preferences.

This visual update preserves routes, version-4 storage, programme prescriptions, logging behaviour and session-only extra sets. It does not migrate or reset records.

## Navigation

The three bottom destinations are **Today**, **Programme** and **Progress**. History sits beside Overview inside Progress. Settings opens from the header and returns to its originating screen. Progress details have their own full screen and a Back action. Historical workout details fill the screen; brief entries and choices use bottom sheets. Sheets trap focus, restore it on close and respect Escape and reduced motion.

Routes are `#today`, `#programme`, `#progress`, `#progress/history`, `#progress/movement`, `#progress/volume`, `#progress/bodyweight`, `#progress/recovery`, `#settings`, `#workout`, `#workout/review` and `#workout/saved`. Older `#plan`, `#insights` and `#history` links redirect to their current destinations.

## Today and Programme

Today shows the actual date, current programme week and a single Start or named Resume action. The four-session count is explicitly for the programme week/attempt, rather than the calendar week. Four completed main sessions reveal a week-review action; advancement remains manual. Log bodyweight and pending recovery follow-ups sit below the main task.

The weekday/session selector belongs to Programme. It previews the source weekly split without calendar dates. “Train this session today” states that the workout is recorded on the actual training date. An active workout appears in its own named Resume banner; starting another session is disabled until it is finished or discarded. Programme settings, exercise choices, setup, preparation, guidance and the roadmap remain accessible without competing with the training action.

## One working set in focus

The logger presents exercise name, target, tempo/effort, current set number and large inputs. Assistance, bodyweight, seconds, per-hand loads and per-side work are labelled explicitly. A full-width Log set button stays in the bottom action dock. Invalid inputs display an inline message and receive focus.

Logging moves the focus to the next unfinished set without forcing another exercise or opening the keyboard. Rest begins automatically if enabled; Pause, +30s and Skip do not block logging. Once the current exercise is complete, the main action becomes Next exercise, or Review & finish on the final exercise. Exercise jumping stays available and leaves bypassed sets unlogged.

All sets is expandable. Edit uses a draft until Save set; Cancel edit preserves the original record. Undo marks that set unlogged. The list remains open after an edit. Technique, exact matching previous-session reuse, notes and optional actual RIR remain secondary. Warm-up is available without a mandatory interstitial.

The selected exercise, originating screen and running/paused timer are optional session resume metadata within the existing version-4 schema. Existing version-4 sessions without metadata open at their first unfinished exercise. A running timer uses an absolute end time; expired rest clears the timer without logging or advancing. A paused timer stores remaining seconds. Reload and service-worker updates retain these values. No storage reset or programme migration accompanies this redesign.

## Review and save

Review & finish opens a full screen with completion/partial status, unfinished-set details, optional symptom/technique feedback and an inline cool-down checklist. Opening or closing the checklist never leaves review. Save is disabled until at least one set is logged. Partial sessions remain in history but do not count as completed main workouts.

One save leads to a short confirmation with Back to Today and View workout. It does not automatically open editing. Discard and historical deletion remain separate actions with explicit confirmation.

## Progress and quick entries

Progress starts with adherence, recent workouts and a shared bodyweight trend card, with a logging prompt when empty. Empty states suggest a relevant first action, rather than showing blank charts or meaningless ratios. Movement, volume, bodyweight and recovery have dedicated detail screens. Movement initially lists recorded exercise/setup identities; All exercises reveals the catalogue. Volume is labelled load × repetitions, in kg × reps or lb × reps.

Daily habit tracking has been removed from Today and Recovery. Existing daily check-ins are discarded on load/import, while version-4 storage and backups retain an empty `daily` array for compatibility. Bodyweight records, entry, units and history are preserved. Workout symptoms and technique remain explicit observations; nutrition references, symptom guidance, assisted/bodyweight tracking and progression gates remain intact.

## Layout verification

The action docks reserve scrolling space and follow keyboard offsets. Browser checks cover 320×568 and 390×844, tablet/desktop sizes, a 320×330 keyboard viewport, enlarged text, focus order and overflow. Screenshots are in `artifacts/mobile-redesign/`. See `validation.md` for the current build and package results.

## Bodyweight chart

Overview and bodyweight detail show all saved weigh-ins as pink dots, with a purple 7-day rolling-average line and a light sky-blue fill. Dates use actual calendar spacing. Each average includes readings on its date and the preceding six calendar days; missing days add no observations. The chart has no date-range controls, point selection or tooltips. Latest weight, latest 7-day average/read count and change since the first reading have explicit dates and units. The axis follows the data with padding and a minimum 1 kg span, converted for pounds. A single reading stays a single point with explanatory copy; empty history prompts logging. A screen-reader table exposes every reading and its average without affecting layout. Weekly summaries and programme nutrition calculations retain their existing rules.
