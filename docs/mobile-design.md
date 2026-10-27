# Gym Hawk mobile interface

The design uses warm ivory (`#F7F6F2`), white grouped surfaces, deep ink text (`#1B2926`) and a restrained teal accent (`#147D72`). Manrope headings and DM Sans body text are bundled locally for offline use. Body/input text is 16px; secondary text is at least 14px. Touch targets are at least 44×44px. Content is centered within 680px on large screens, with one primary action per task.

Today has a forest-green (`#123E36`) workout hero with subtle decorative arcs, mint metadata and a high-contrast mint action. Supporting cards share delicate borders, soft shadows, rounded corners and tinted icon containers. Navigation floats above the safe area with rounded corners and a pale mint selected state. Charts, focus rings, timers, logging inputs, sheets and completion screens use the same semantic CSS theme variables. Warning and error states retain their distinct colors. Short color transitions respect reduced motion.

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

Progress starts with adherence, recent workouts and a bodyweight trend when data exists. Empty states suggest a relevant first action, rather than showing blank charts or meaningless ratios. Movement, volume, bodyweight and recovery have dedicated detail screens. Movement initially lists recorded exercise/setup identities; All exercises reveals the catalogue. Volume is labelled load × repetitions, in kg × reps or lb × reps.

Daily habit tracking has been removed from Today and Recovery. Existing daily check-ins are discarded on load/import, while version-4 storage and backups retain an empty `daily` array for compatibility. Bodyweight entry, units, history and trends are unchanged. Workout symptoms and technique remain explicit observations; nutrition references, symptom guidance, assisted/bodyweight tracking and progression gates remain intact.

## Layout verification

The action docks reserve scrolling space and follow keyboard offsets. Browser checks cover 320×568 and 390×844, tablet/desktop sizes, a 320×330 keyboard viewport, enlarged text, focus order and overflow. Screenshots are in `artifacts/mobile-redesign/`. See `validation.md` for the current build and package results.
