# Bug-Fix Tracker

Rolling tracker for reported bugs across the User, Doctor, and Admin apps.
Status legend: ✅ Fixed · 🔧 In progress · ⏳ Pending · 📷 Needs screenshot · 🧠 ML/model work · 🧩 Product decision · ⚠️ Already present

---

## User + Doctor apps — batch 2026-07-25 (Soubhagya's report)

Everything Soubhagya reported against **USERS** and **DOCTORS** that wasn't
already marked fixed by him. Admin-only rows from the same report are **not**
covered here (see [Admin — still open](#admin--still-open-from-the-2026-07-25-report)).

### User app ✅

| Feature | Issue | Fix | Location |
|---------|-------|-----|----------|
| Appointment Booking | "Back to home" returns to the confirmation screen when Book Consult is reopened | `navigate('Home')` only switched **tab** — the confirmation stayed on top of the Consult stack. Now switches tab first (so the pop is off-screen), then `popToTop()` unwinds the stack | `mobile-users/src/screens/BookingConfirmedScreen.js` |
| Appointment Booking | "Select Time" is an empty gap until a date is picked | Added a "Pick a date first" empty state (tapping it opens the date picker). The old `timeSlots.length === 0 && selectedDate` branch fell through to an empty grid | `BookAppointmentScreen.js` |
| Profile | Edit Profile has too few fields | Added **profile photo** (picker → `POST /users/me/avatar`), **blood group**, **height**, **weight**, **allergies**, **conditions**, **medication**. The modal body now scrolls (pixel `maxHeight` — a % never resolves inside the content-sized overlay) with the actions pinned | `SettingsScreen.js`, `authService.js`, `backend/app/models/user.py`, `schemas/auth.py`, `services/auth_service.py`, migration `bc23de45fa67` |
| Profile | Add Health report | New **My Health Report** screen (Profile → menu): vitals + BMI band, medical background, therapy totals, consultation history and the latest face/tongue scan, with pull-to-refresh and share. Backed by `GET /users/me/health-report`, which only aggregates existing rows | `HealthReportScreen.js`, `healthReportService.js`, `backend/app/services/health_report_service.py`, `endpoints/users.py` |
| App updates | Force update never appears before login, and not after login either — only via the manual check | Two causes. (a) `/app-releases/latest` + `/download` required a JWT, so the pre-login check 401'd — and the api client turned that 401 into a *session-expired reset*. Both are now unauthenticated; `/download` only ever serves the version `/latest` just advertised, so the release archive stays closed. (b) `UpdatePrompt` checked exactly once on mount and never again. It now re-checks whenever auth state flips **and** whenever the app returns to the foreground | `backend/app/api/v1/endpoints/app_releases.py`, `mobile-{users,doctors,admin}/src/components/UpdatePrompt.js` |
| Wellness videos | Disabled sessions still listed | `GET /sessions` declared `active_only` as `Optional[bool] = Query(None)`; the `None` reached the repository as falsy and skipped the filter. Defaults to `True` now (admin still passes `false` explicitly) | `backend/app/api/v1/endpoints/sessions.py` |
| Wellness videos | Marking a session active says "failed to update" | `WellnessSessionRepository.get_by_id` filtered on `is_active`, so a deactivated session was unreachable — re-activating it 404'd. The filter is gone (it backs edit/delete/reorder). Also fixes the admin **"Wellness session not found" on reorder** and **"failed to update session" on edit** | `backend/app/repositories/session_catalog_repository.py` |
| Wellness videos | Asks for pain; feedback comes too early | Dropped the pre-session "Initial Pain Assessment" entirely and the pain slider from the end dialog — wellness isn't a pain-relief programme. The prompt now fires only from `onEnd` (it used to fire at 90% of *any* video, popping over the still-playing last one) and bails out if the completed-count call fails instead of interrupting mid-session. Therapy History's manual "Mark Complete" skips the pain slider for wellness too | `VideoPlayerScreen.js`, `TherapyHistoryScreen.js` |
| Therapy History | Too much space around the KPIs | Two 96px stacked tiles → one compact strip (icon + value + label per cell, hairline divider); ~100px of vertical space returned to the list | `TherapyHistoryScreen.js` |
| Profile | Version should auto-update; "Powered by Calypsion" instead of "Crafted for your wellness" | New shared `AppVersionFooter` reads `APP_VERSION` (injected from the gradle `versionName`) — Help & Support had a hardcoded `v1.0.0` that went stale every release. Added to Profile, Settings and Help & Support | `components/AppVersionFooter.js`, `ProfileScreen.js`, `SettingsScreen.js`, `HelpSupportScreen.js` |
| Settings | In-app language does nothing | **Removed** (the reporter's own "either implement it or remove it"). It wrote a code to `user_preferences` but nothing was ever translated. The `language` column is untouched so it can come back with real i18n | `SettingsScreen.js` (users + doctors) |
| Profile settings | User shouldn't delete their own account | "Delete Account" → **"Request Account Deletion"**. New `POST /auth/me/deletion-request` notifies every admin and leaves the account alone; the session stays live. `DELETE /auth/me` stays for back-office use | `SettingsScreen.js`, `authService.js`, `backend/app/services/auth_service.py`, `endpoints/auth.py` |
| Quick relief & Wellness | Seed the correct data | Seeded the **full MVP symptom set** from the SRS (§4.1) — was 2 of 9. Added Shoulder, Back, Knee, Ankle, Migraine, Sciatica and Stress, each with its own 3-step chat flow, icon and colour pair. Also fixed a `NameError` in `seed.py` that crashed any re-run over a populated DB | `backend/seed_data.py`, `backend/seed.py` |
| Book Consultation | Wrong doctor ratings / years of experience | There's no review system yet, so `average_rating`/`reviews_count` are 0 for everyone and the card rendered "★ 0.0 (0)" — which reads as a bad score. Stars are hidden until a doctor actually has reviews; experience (real admin-entered data) is shown on its own and hidden when 0 | `ConsultScreen.js`, `DoctorProfileScreen.js` |

### Doctor app ✅

| Feature | Issue | Fix | Location |
|---------|-------|-----|----------|
| Login | Top icon cropped on small screens | The bottom-anchored card squeezed the hero until the badge clipped. Root now respects the top safe-area inset, the card is capped at 74% of screen height, and below 720dp the badge/title scale down (84→64px, 27→22pt) | `mobile-doctors/src/screens/LoginScreen.js` |
| Appointments | Top filter UI | Two stacked rows (date label + status chip, then four full-width time chips) collapsed into **one scrollable row of dropdown chips** — date, status, type, time — plus a Clear chip that appears once anything is off-default. Status/type/time share a single bottom sheet | `AppointmentsScreen.js` |
| Appointments | No home visit / clinic visit / video call filter | Added the **Consultation Type** filter, matching on both the display name (`"Clinic Visit"`) and the legacy `visit_type` slug | `AppointmentsScreen.js` |
| Leave History | UI needs enhancement | Five 96px status tiles were crammed edge-to-edge into one fixed row, so "Cancelled" wrapped and the counts collided → now a scrollable chip row (label + count). Cards get a status stripe, a one-line header with the badge, and a divided footer. Status colours are derived from one accent hue per state, so dark mode is legible (the old table baked in pale fills with dark text). Removed a dead `StatusBadge` referencing two undefined symbols, and a crash on a null `status` | `LeaveHistoryScreen.js` |
| Schedule > Leave | Multi-date partial slot list goes messy | The real bug: slot cards were `width: 48.5%` with a `3%` left margin — `48.5 + 3 + 48.5 = 100%` exactly, so one rounded-up pixel wrapped every second card onto its own line. Replaced with a real `gap` grid. Day cards get a fixed min-height and a one-line count pill ("3 Slots" used to wrap and stagger the strip), and each day gains a **Select all / Clear** action | `ApplyLeaveScreen.js` |
| Profile | "Above KPI what data is it showing?" | They're appointment counts, which the bare "Today / Upcoming / Completed" labels never said. Added a **MY APPOINTMENTS** caption and made each tile open the Appointments tab so the numbers are traceable | `ProfileScreen.js` |
| Profile | Remove Apply for leave / Leave requests | Removed. Both pointed at routes that live in the **Schedule** stack, not the Profile stack, so navigation never resolved them — they were dead taps. Leave lives under Schedule → Leave | `ProfileScreen.js` |
| Profile | Editing profile needs gender + DOB | Added, reusing the user app's `GenderSelect` / `DobInput` (copied into the doctor app). `PUT /auth/me` already accepted both | `SettingsScreen.js`, `authService.js`, `components/{GenderSelect,DobInput}.js` |

### Notes

- **Security call worth reviewing:** `/app-releases/latest` and `/app-releases/<slug>/<version>/download` are now anonymous. There is no way to force-update a build that can't reach the login screen otherwise. `/download` is narrowed to the current version per slug, so past releases can't be enumerated — but if you'd rather keep it authenticated, the pre-login forced update has to go with it.
- **"Seed the correct data based on mockup"** was interpreted as the SRS §4.1 MVP symptom set (also [TASKS.md](TASKS.md) G1), since no mockup is in the repo. The **video assets are still placeholders** — both seeded videos point at `Ankle_Pain/Ankle Pain.mp4`. Real clips need uploading before this row is genuinely closed.
- The migration (`bc23de45fa67`) adds six nullable columns to `users` and branches off `ab12cd34ef56`, keeping the head count unchanged.
- **Not device-verified.** The layout work (login hero, filter bar, leave cards, slot grid, KPI strip, health report) needs a build to confirm visually.

### CI repair (same batch)

Both CI jobs were red on `main` before this batch, for four unrelated reasons.
All four are fixed; none were caused by the bug-fix work above.

| Job | Failures | Cause | Fix |
|-----|----------|-------|-----|
| Backend | 26 across `test_scan_dashboard`, `test_face_scan`, `test_video_folder_import`, `test_leave_slots` | Registration runs a **live MX lookup** on the email domain. The fixtures sign up as `@t.com` / `@test.com`, which genuinely have no mail server, so every `register` 400'd and the dependent tests died on `KeyError: 'data'`. It also made the suite depend on the runner's DNS | New `EMAIL_CHECK_DELIVERABILITY` setting (default on); `tests/conftest.py` turns it off. Added `tests/test_email_validation.py` (network-free) so the syntax + disposable-domain rules keep their coverage | 
| Backend | 1 in `test_leave_slots` | `test_date = date(2026, 7, 20)` hardcoded. `create_leave` rejects a past `start_date`, so this test turned CI red **on 2026-07-21** with no code change | `date.today() + timedelta(days=7)` |
| Backend | 1 in `test_support_faqs` | The test still asserted soft-delete semantics after `a399fa0` shipped hard delete | Rewritten for hard delete: deactivate keeps the row, delete removes it, and the id 404s afterwards |
| Backend | 1 in `test_video_folder_import_real` | Integration test hitting **real Azure**, asserting `count > 0`. CI has no storage credentials | `pytest.mark.skipif` on the credentials — the same pattern `test_video_upload.py` already used for its six tests |
| Frontend | 2 in `TherapyHistoryScreen.smoke` | The screen fetches `getSessionGroups()` **and** `getTherapyHistory()` in one `Promise.all`; the mock only defined the first, so the pair rejected and the screen fell into its error state | Added `getTherapyHistory` to the mock |

Verified locally with the CI environment emulated (Azure credentials blanked, so
the run matches a runner with no secrets):

- **Backend** — `python -m pytest -q` → **187 passed, 7 skipped, 0 failed** (the 7 skips are all Azure-gated). Runtime also dropped from ~24 min to ~1.5 min, because the failing tests had been sitting in DNS timeouts.
- **Frontend** — `jest --ci` **73 passed / 15 suites**, `tsc --noEmit` clean, `eslint src App.tsx` exit 0 (129 warnings, 0 errors).

Confirmed by stashing the whole batch and re-running that the frontend failure
predates this work. Still failing and **out of scope** (not part of either CI
job): 8 pre-existing eslint errors in the doctor app's `ScheduleScreen.js` /
`LeaveDetailScreen.js`, and the admin `App.test.tsx` transform error.

### Admin — still open from the 2026-07-25 report

Out of scope for this batch; listed so they aren't lost. Doctor management save error,
clinic latitude/longitude entry, clinic form guard, doctor-filter popup overlap,
home-visit location in the appointment popup, dark-mode popup contrast, delete
confirmation dialogs, wellness-video autoplay + scroll lock, video sort save
button under the nav bar, video folder alignment, video card metadata overlap,
video-group player height, pause on edit, Azure video metadata editing, "Create
content" active-button placement + refresh + privacy-policy placeholders.

Two of them are already fixed as a side effect of the shared backend change
above: **"Wellness session not found" on sort** and **"failed to update session"
on edit** both came from `WellnessSessionRepository.get_by_id`.

---

## User App — batch 2026-07-18 (branch `bugfix/bugfix_18thJuly_AG`)

### Fixed ✅
| # | Issue | Fix | Location |
|---|-------|-----|----------|
| 1 | Create-account bottom green area looks empty | Safe-area bottom padding + branding footer fills it | `mobile-users/src/screens/RegisterScreen.js` |
| 2 | Add "Powered by Calypsion" | Footer added | `RegisterScreen.js` |
| 3 | Screen not framed / footer band | Safe-area inset padding on card | `RegisterScreen.js` |
| 4 | Email accepts any `.com` | Stricter `EMAIL_RE` (proper local@domain.tld) | `RegisterScreen.js` |
| 25 | "Dr" shown twice in name | `format_doctor_name()` strips existing title before prefixing | `backend/app/utils/names.py` (+ doctors.py, appointment.py, appointment_service.py, tests) |
| 26 | Calendar extra bottom padding | Render only the weeks the month needs | `mobile-users/src/screens/BookAppointmentScreen.js` |
| 27 | Can select past time slots | `isSlotPast` disables elapsed slots for today | `BookAppointmentScreen.js` |
| 28 | Unpaid booking blocks re-booking same slot | User's own unpaid hold is resumed, not blocked | `backend/app/services/appointment_service.py`, `appointment_repository.py` |
| 6 | Trouble tracing back while video plays | Seek-pending guard via `onSeek` | `mobile-users/src/components/VideoPlayer.js` |
| 7 | No play button after video completes once | Backward scrub clears `ended` | `VideoPlayer.js` |
| 15 | Wellness & skin-age shared but not shown in results | Added chips to results screen | `mobile-users/src/screens/ScanResultsScreen.js` |
| 18 | Share shows skin analysis for tongue scan | Tongue-aware `buildShareText` | `ScanResultsScreen.js` |
| 20 | Tongue markers show "Body Colour" | Relabelled "Tongue Colour" | `ScanResultsScreen.js` |
| 17 | Tongue results shown with no tongue | Reddish-coverage detection gate rejects frame | `backend/app/ai/tongue/__init__.py`, `segmenter.py`, `scan_pipeline_service.py` |
| 19 | Past scans mix tongue & skin | `ScanHistoryScreen` is scanType-aware | `mobile-users/src/screens/ScanHistoryScreen.js` |
| — | Recommendations "…" not expandable | Read more/less toggle | `mobile-users/src/components/scan/RecommendationCard.js` |
| 13 | Photo taken with face half in circle | Manual shutter gated on blocking quality issues | `mobile-users/src/screens/FaceScanScreen.js` |

### Already present ⚠️
| # | Issue | Note |
|---|-------|------|
| 12 | Green ring when face placed | Oval already turns green on "ready"; verify on-device face detection is active |

> #5 (DOB cursor at far right) and image 6 (home address not visible) were confirmed real and fixed in the 2026-07-22 batch below.

### Needs screenshot 📷
- Image 5 — video "marked area centered in black space"

### ML / model work 🧠
- Same face, different lighting → different score
- "Reports not accurate"
- Tongue-marker accuracy + positive/negative distinguishing indicators (#22)

### Product decisions 🧩
- Are scan recommendations customer-defined? (#9)
- Unpaid-hold **expiry policy** for *other* users (timed hold vs release) — needs scheduler
- Tongue **dashboard** toggle in Face Glow (#24) — new feature
- Skin dashboard graph redesign (more informative)
- Tongue past-scan comparison UI (backend stores them; ScanComparison is face-only)

---

## User App — batch 2026-07-22 (branch `bugfix/bugfix_18thJuly_AG`)

### Fixed ✅
| # | Issue | Fix | Location |
|---|-------|-----|----------|
| 5 | DOB cursor renders at the far right of the field instead of the middle | Fields were already `textAlign: 'center'`, but on Android the caret is laid out against the *hint*, so an empty centered field parks the cursor past the "DD"/"MM"/"YYYY" text. New `DobBox` drops the native `placeholder` and draws the hint as a centered overlay (cleared on focus so the caret isn't drawn through it); focused box also gets a primary-color border | `mobile-users/src/screens/ProfileCompletionScreen.js` |
| 29 | Video controls never appear in fullscreen | Two causes: (a) every overlay (poster, tap layer, controls, spinner/error) now carries an explicit `zIndex` **and** `elevation` above the video — document order alone isn't enough on Android, since fullscreen elevates the wrapper to 1000 and the video's SurfaceView then composites above any sibling left at Z 0; (b) entering/leaving fullscreen now calls `reveal()`, so an auto-hide timer armed before the toggle can't blank the freshly expanded player | `mobile-users/src/components/VideoPlayer.js` |
| 30 / img 6 | Sticky "Total Amount + Confirm Booking" footer overlaps the page end — home address / Change Address hidden behind it or behind the keyboard | Scroll padding was a hardcoded `120` while the footer grows and shrinks with the date/time summary lines; it is now measured via `onLayout` and fed back as the scroll padding. Footer also picks up `insets.bottom`, and hides while the keyboard is open (with `adjustResize` it otherwise parks straight on top of the keyboard); added `keyboardShouldPersistTaps` / `keyboardDismissMode="on-drag"` | `mobile-users/src/screens/BookAppointmentScreen.js` |
| 31 | Address select modal: oversized header, "Add New Address" and later options running under the sticky Close button | Root cause: `maxHeight: '92%'` never applied — the card's parent (the `KeyboardAvoidingView`) is content-sized, so a percentage max-height has nothing to resolve against and Yoga drops it; the card grew past the screen and pushed its own pinned action row off the bottom. Now capped in pixels via `useWindowDimensions`. Added a `compact` dialog variant (used by the address picker): the 56px centered icon badge + 19px centered title collapse into one left-aligned row (34px badge, 16px title, 12px subtitle) with tighter padding, freeing the room for the list | `mobile-users/src/components/AppDialog.js`, `BookAppointmentScreen.js` |

### Notes
- The `compact` prop is opt-in; existing dialogs (`AppAlertHost`, `SettingsScreen`, `VideoPlayerScreen` feedback) keep the roomy centered header. The pixel `maxHeight` applies to **all** of them — previously none were actually capped.
- If fullscreen controls still hide behind the video on a specific device, the remaining lever is `viewType={ViewType.TEXTURE}` on `<Video>`. Left alone since it changes the render path app-wide.
- Not yet verified on-device — these are layout/render fixes that need a build to confirm visually. Lint is clean (only the files' pre-existing warnings).

---

## Doctor App — batch 2026-07-18

### Fixed ✅
| Issue | Fix | Location |
|-------|-----|----------|
| Add "Powered by Calypsion" | Footer added to doctor Login | `mobile-doctors/src/screens/LoginScreen.js` |
| Appointments only show ~1 week | Added "Next 7 days / Next 10 days / This month" range pills (client-side date-range filter over all appointments) | `mobile-doctors/src/screens/AppointmentsScreen.js` |
| Can't find how to apply for leave | Apply Leave already existed under Schedule → Leave tab; added discoverable **Apply for Leave** + **Leave Requests** entries to Profile menu | `mobile-doctors/src/screens/ProfileScreen.js` (routes `ApplyLeave`, `LeaveHistory`) |
| Patients screen showed raw API/error text ("some API is showing up" in Schedule & Patients) | Error state now shows friendly copy, raw axios message only logged; Schedule surfaces errors via toasts only | `mobile-doctors/src/screens/PatientsScreen.js` |

---

## Admin App — batch 2026-07-18

### Fixed ✅
| Issue | Fix | Location |
|-------|-----|----------|
| Doctor mgmt Edit/Delete menu not closing | Replaced inline anchored dropdown with a transparent Modal action sheet (dismisses on outside tap / back) | `DoctorManagementScreen.js` |
| Expertise/Specialities/Languages Edit/Delete not closing | Swipe list made single-direction (right→left) reveal + `closeOnRowBeginSwipe`/`closeOnScroll`; symmetric swipe let rows rest half-open | `MetadataManagementScreen.js` |
| Upload Video button never enables | Auto-selects the browsed folder as the target (the "Upload to…" selector was buried below a long list, so no folder was ever selected) | `UploadVideoScreen.js` |
| Schedule Manager can't add >1 slot | Fresh time defaults per new slot + surface real backend error (stale time reused → duplicate/overlap) | `SlotManagementScreen.js` |
| Wellness video edit crashes app | Coerced numeric `duration` (and null title/description) to strings — a non-string `TextInput` value hard-crashes RN | `VideoManagementScreen.js` |
| User Management scroll not working | Hoisted the per-row `<Modal>` (one per user) out to a single screen-level Modal + explicit `flex:1` on the list | `UserManagementScreen.js` |
| Doctor Leaves text overflowing card (image 3) | Constrained header (`flex:1` + `minWidth:0`), ellipsized long date/doctor values, badge `flexShrink:0` | `DoctorLeaveManagementScreen.js` |
| "Scheduled Appts" KPI opens nothing | Added `onPress` → appointments filtered to `booked`; added `filterStatus` param support | `HomeScreen.js`, `AppointmentManagementScreen.js` |
| Doctor profile fee shown as `$` | Changed to `₹` (INR) to match the rest of the app | `DoctorDetailScreen.js` |

### Needs screenshot / clarification 📷
- **Image 1** — Doctor Leaves "UI not fitting in the box" (approved leaves too): fixed the card text overflow; if another element still clips, need the image.
- **Image 2** — "both have total leaves": dashboard has distinct **Today Leaves** + **Total Leaves** KPIs; if these should be merged/renamed, confirm intent.
- **Doctor profile "UI not looking good"** — subjective; fixed the `$`→`₹`. Need specifics/image for further polish.
- **"video groups"** (item left incomplete in the report) — awaiting the actual ask.

---

## Cross-app — batch 2026-07-18 (#4)

### Fixed ✅
| App | Issue | Fix | Location |
|-----|-------|-----|----------|
| User | Remove GitHub from sign-up/login | Dropped GitHub social button (kept Google, relabeled "Continue with Google") | `mobile-users` `RegisterScreen.js`, `LoginScreen.js` |
| User | Remove GitHub from linked accounts | Link dialog + subtitle now Google-only | `mobile-users/src/screens/SettingsScreen.js` |
| User | Chatbot re-asks "How is your pain?" after chat | "Browse Sessions" goes straight to the session; removed the redundant pre-session pain popup | `mobile-users/src/screens/ChatAssistantScreen.js` |
| Doctor | Remove GitHub from login (image 2) | Dropped GitHub social button | `mobile-doctors/src/screens/LoginScreen.js` |
| Doctor | Remove GitHub from linked accounts (image 2) | Link dialog + subtitle now Google-only | `mobile-doctors/src/screens/SettingsScreen.js` |
| Doctor | Calendar breaking (image 3) | Month grid rebuilt as a true 7-column % grid (fixed-px cells wrapped/misaligned on narrower screens); applied to leave + appointments calendars | `mobile-doctors` `ApplyLeaveScreen.js`, `AppointmentsScreen.js` |
| Admin | Manage>Doctors card "breaks" (image 4) | Doctor detail no longer fails the whole screen when the secondary slot/availability calls error (best-effort); fee `$`→`₹` | `mobile-admin/src/screens/DoctorDetailScreen.js` |

### Needs screenshot 📷
- **Image 1 (User Main screen breaking)** — couldn't reproduce a definite layout break from the code (Quick Relief grid renders 2+1 by design). Need the screenshot to pinpoint.

### Notes
- Pre-existing (unrelated) lint errors remain in `mobile-doctors/ApplyLeaveScreen.js` around an **abandoned partial-day time-picker** (`fromTime`/`toTime` never declared). It's dead code — `openTimePickerModal` is never called, so no runtime crash. Left as-is (out of scope).
