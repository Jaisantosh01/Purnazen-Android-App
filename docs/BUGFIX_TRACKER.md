# Bug-Fix Tracker

Rolling tracker for reported bugs across the User, Doctor, and Admin apps.
Status legend: ✅ Fixed · 🔧 In progress · ⏳ Pending · 📷 Needs screenshot · 🧠 ML/model work · 🧩 Product decision · ⚠️ Already present

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
