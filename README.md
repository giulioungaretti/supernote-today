# Supernote Today

An original, standalone **native-first daily journal for Supernote Plugin Preview**.
Tap **Today** in the NOTE toolbar to land in `/Note/Today/YYYY-MM-DD.note`.
The native Notes app owns all handwriting and journal content.

**v0.2 replaces the failed v0.1/v0.1.1 architecture.** Those builds produced blank
pages on a Nomad despite passing automated checks. There is no longer a live
geometry renderer, open-under-overlay path, or current-note save/reload sequence.
Automated validation and package inspection are not a claim of physical-device
success; the firmware assumptions below still require device confirmation.

## The daily page

The bundled, opaque black/white PNG supplies three blank plan checkboxes, a ruled
journal occupying more than half the page height, and a bottom **10-minute
cursive** area. Four native editable TextBoxes supply the full date, lesson title,
instruction and sample. The sample is text to copy in your own cursive, not a
bundled cursive tracing font. Everything you write uses native note ink.

Separate original PNGs match Nomad **1404 x 1872** and Manta **1920 x 2560**
portrait pages. They are generated from the same pure TypeScript coordinate model
used for native text placement and the browser preview. The PNGs contain no
journal content. There are no custom ink, sync, task, calendar or cloud services.

## Exact note lifecycle

The toolbar uses documented `showType: 0`: the button callback starts the use case
without waiting for React to mount. There is no successful-path plugin splash
screen. Concurrent taps share one in-flight operation.

**New note:** request file access, resolve the bundled PNG, ensure the journal
directory, call `createNote` with that PNG, allocate four
`PluginCommAPI.createElement(Element.TYPE_TEXT)` elements and set their `TextBox`
fields, call **`PluginFileAPI.insertElements(notePath, 0, elements)`**, check the
boolean result and persisted element count, then **close once -> openFile(path, 0)**.
No seed page is added for new notes.

**Existing note containing any elements, or more than two pages:** inspect only
as needed to rule out empty-note repair, then **close once -> openFile(path, 0)**.
Never redraw, add pages, change lessons, or repair individual components.

**Conservative v0.1/v0.1.1 repair:** only a one- or two-page dated note with zero
elements on **every** page is eligible. Reinspect immediately before mutation,
insert a template page at index 0, insert and verify its text, then remove the old
empty pages from the highest index down. Recheck all remaining seed pages and
page counts before every deletion; require successful responses and the expected
page-count decrease. The new page is never deleted.

Any failed permission, path, template, creation, text, repair or open operation
stops the flow and requests `showPluginView` with an actionable error. No note is
opened as a successful generation after verification fails. A failed deletion
retains the new page and remaining seed pages and reports the problem. SDK calls
are not blindly retried.

**Safety takes priority over repairing a visually blank page.** Invisible elements,
old plugin elements, handwriting on page 1, or partially inserted text all count as
content. Those notes open unchanged. Longer empty notes are also left alone.
Back up and inspect such files in native Notes; do not delete a file just because
it looks blank. There is no automatic destructive cleanup of partial writes.

## Curriculum and history

The 56 original lessons form an eight-week sequence:

| Phase | Lessons |
|---|---:|
| Basic strokes and rhythm | 7 |
| Lowercase letter families | 21 |
| Joins | 7 |
| Words | 7 |
| Sentences | 7 |
| Natural cursive writing | 7 |

Lesson selection is deterministic: local calendar days since `2026-01-01`,
modulo 56, using day arithmetic unaffected by DST. Same date, same assigned lesson.
Existing note contents remain authoritative, including any edits made in Notes.

**v0.2 history is the dated note archive.** There is no progress database or custom
storage/APK. Missed calendar days advance this schedule; advancing only on
generation, completion tracking, reset/start controls and configurable roots are
deferred. The fixed native path is
`/storage/emulated/0/Note/Today/YYYY-MM-DD.note`. Config opens a minimal status view.

## Browser/device preview

With Node.js 20.19 or newer and dependencies installed:

```powershell
npm run preview:device
```

Open **http://127.0.0.1:4173/**. The responsive e-ink frame defaults to Nomad.
Switch dates, browse previous/next lessons, restore the date's lesson, or switch
to Manta. The one-tap illustration shows background opening, the generated/native
page, and actionable permission/template/text/open errors.

This is a validation surface, **not a firmware emulator**. It imports the actual
curriculum/date/layout functions and displays the exact PNG files bundled by Metro.
Browser fonts can differ from native TextBoxes. It does not exercise the SDK,
permissions, native ink, cache or file persistence, and never changes journal files.
Lesson navigation in the preview is not a new installed-plugin feature.

After changing layout constants:

```powershell
npm run templates:generate
npm run templates:check
npm run preview:build
```

The check decodes both committed PNGs and compares every pixel to the shared
model, including black/white opacity, dimensions, labels, rules and checkboxes.
The package verifier repeats this check on the PNGs **inside the actual .snplg**.

## Architecture

```text
index.js: AppRegistry -> SDK init -> headless NOTE button / Config listeners
  runtime/todayController.ts: in-flight guard, retained error/status store
    application/ensureTodayNote.ts: create / untouched open / empty repair
      domain/: dates, 56 lessons, schedule, repair decisions, layout (pure)
      adapters/supernote/: file permissions, bundled PNG, file-level text
  App.tsx: renders error/status only; never drives generation from a mount effect

domain/pageLayout.ts -> scripts/templatePng.ts -> assets/today_{nomad,manta}.png
                    -> native TextBox positions
                    -> preview/ (same PNG and text model)
```

All device side effects are isolated behind a typed port. Boolean SDK operations
require both `success === true` and `result === true`. Unknown/invalid counts are
errors, not empty-note defaults. Allocated TextBoxes stay in the native cache until
file insertion and verification finish; only then are those elements recycled.

The official React Native scaffold remains, but no custom React package or native
module is registered. `.snplg` contains JavaScript, config, icon and PNG assets,
not an APK/NPK, native library or storage backend.

## SDK evidence and remaining assumptions

Pinned versions: React Native **0.79.2**, React **19.0.0**,
`sn-plugin-lib` **0.1.65**; initial scaffold
`@supernote-plugin/sn-plugin-template` **1.0.12**.

| Surface | Evidence / status |
|---|---|
| Headless toolbar | [PluginButton](https://docs.supernote.com/en/api-reference/supernote-plugin/types/plugin-button) documents `showType: 0`; [first-plugin guide](https://docs.supernote.com/en/first-plugin) explicitly says events/background logic still run. |
| Custom PNG creation | [`createNote`](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/create-note) explicitly accepts a custom image path. |
| Installed asset paths | [`getPluginDirPath`](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-manager/get-plugin-dir-path) returns the installation directory. Metro's actual archive layout is checked during packaging. |
| File text | [`insertElements`](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/insert-trails) writes directly to a file page; cached element UUIDs must remain alive. [`TextBox`](https://docs.supernote.com/en/api-reference/supernote-plugin/types/text-box) documents pixel rectangles and editable value `0`. |
| Repair | [`insertNotePage`](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/insert-note-page) and [`removeNotePage`](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/remove-note-page) are documented. The former describes `template` as a name: accepting the same custom PNG path for repair is a **firmware assumption**, not claimed proven. Failure is surfaced, with no fallback to a blank template. |
| Pixel sizing/counts | File-level `getPageSize`, `getNoteTotalPageNum` and `getElementCounts` are documented and their result shapes are checked. They inspect persisted files, not a transactional lock against concurrent external edits. |
| Close then open | Uses the file-only lifecycle, not live-page geometry. Automatic headless `closePluginView` -> `openFile` timing, one-time permission lifetime and reopening an already-current file still need physical-device confirmation. |
| Search | Native handwriting remains native; ISO-dated filenames are the dependable identifier. Native TextBox indexing/search behavior is firmware-dependent. No keywords or headings are fabricated. |

The asset resolver explicitly checks:

1. `Image.resolveAssetSource(require(...)).uri`, if it is an absolute local path or
   a `file:///` URI (decoded to a file path);
2. the installation directory plus
   `drawable-mdpi/assets_today_nomad.png` or `drawable-mdpi/assets_today_manta.png`.

It checks existence with SDK `FileUtils.exists`. Resource identifiers and HTTP
development-server URLs are not passed off as local image paths. If neither
candidate exists it reports the checked paths and asks for the complete package
to be reinstalled. There is no silent system-template fallback.

**No `insertPageElements`, `saveCurrentNote`, `reloadFile`, page jumping, live
geometry, or open-under-overlay renderer is used.** Calling a current-note save
after file-level insertion can overwrite file changes with stale editor state;
this architecture does not do that. Count verification proves stored elements,
not visual fidelity. The on-device PNG application, default font metrics and
handoff still need firmware confirmation.

## Privacy

Only `plugin.permission.FILE:READ` and `plugin.permission.FILE:WRITE` are declared
and requested. No INTERNET permission, analytics, account, sync, credentials or
third-party service. Reads are limited to the bundled template in the plugin's
own installation and native notes; writes are native files under `Note/Today`.
Native handwriting/search behavior stays with Supernote.

The development-only Vite server binds to loopback. Its dependencies are not
bundled into the plugin and it does not grant the installed plugin network access.

## Build and validate locally

Node.js **20.19+** and PowerShell are sufficient for the verified no-native build.
No JDK, Android SDK, Gradle build or APK installation is required. Public npm is
unreachable directly in the development environment; use the configured Microsoft
proxy, not repeated requests to the public registry:

```powershell
npm config set registry https://packagefeedproxy.microsoft.io/npm/
npm config get registry
npm ci --no-audit --no-fund
npm run validate
npm run preview:build
.\buildPlugin.ps1
npm run verify:package
```

`validate` runs typechecks for plugin and preview/tooling, ESLint, Jest and exact
template checks. Tests cover the curriculum, both page sizes/all 56 lessons,
empty-note decisions, all-page repair guards, false SDK results, file-text counts,
cache lifetime, deletion order, headless operation, rapid taps, error recovery and
rejection of broken/native/over-permissioned packages.

Output: `build\outputs\SupernoteToday.snplg` and, after verification, its `.sha256`.
The official packager's no-native path is used with fail-fast checks. The official
template also includes a Linux/macOS script, but Windows PowerShell is the
validated release path; Java/Android provisioning is deliberately absent from CI.

## Build/download without local developer tooling

The **Build Supernote plugin** GitHub Actions workflow runs on pushes, PRs to
`main` and manual dispatch. It uses `windows-latest` and Node 20, restores through
the Microsoft npm proxy, validates TypeScript/tests/templates and the preview,
runs the official PowerShell packager, then extracts and inspects the actual
archive. It verifies version/identity, entry paths, permissions, bundle references
and both PNG pixel grids, rejects native payloads/declarations, and emits SHA-256.
Only a successful package check permits artifact upload.

1. Open this repository's **Actions** tab.
2. Select **Build Supernote plugin**.
3. To build a branch, choose **Run workflow**, select the implementation branch,
   then **Run workflow**. Otherwise open its latest successful push run.
4. Check that the run's commit matches the build you want.
5. Under **Artifacts**, download **supernote-today-snplg** (retained for 30 days).
6. Extract the download to obtain `SupernoteToday.snplg` and
   `SupernoteToday.snplg.sha256`. Copy the `.snplg`, not the artifact ZIP.

No Node, Java or Android tools are needed on the machine used to download/install.

## Install on a Nomad

Prerequisite: **Supernote firmware with Plugin Preview support**. Ordinary stable
firmware without Plugins cannot load this package. Device menu wording can vary
by preview release. These steps follow the official
[installation guide](https://docs.supernote.com/en/first-plugin#install-the-plugin).

1. Connect the Nomad over USB.
2. Copy `SupernoteToday.snplg` to the device's top-level **`MyStyle`** directory
   (`/MyStyle/` in the USB file browser; Android path
   `/storage/emulated/0/MyStyle/`).
3. Disconnect safely. Open **Settings -> Apps -> Plugins -> Add Plugin** and
   select the package.
4. For an existing Today installation, follow the firmware's replacement/update
   confirmation. Some releases expose **Reinstall Plugin** for this operation.
5. Open any native note and tap **Today** in the NOTE toolbar. Grant file read/write
   access when requested. A successful run should go straight to today's note.

**Add Plugin vs Reinstall Plugin:** Add Plugin is the documented package selection
entry point. This update changes JS/assets only; no APK/native-module refresh is
involved. Native-module/APK changes in other plugins require a full reinstall, not
just a JavaScript reload. If firmware exposes a separate Reinstall Plugin action,
use that full replacement flow for native changes. Exact update labels and
confirmation behavior remain firmware-dependent. Never delete journal files as
part of a plugin update.

Optional ADB copy, only if already enabled and `adb devices` identifies the intended
device (use `-s SERIAL` when more than one is connected):

```powershell
adb push .\build\outputs\SupernoteToday.snplg /sdcard/MyStyle/SupernoteToday.snplg
```

Then install via the same device settings. Do not install an APK.

## Physical-device acceptance checklist

After CI and archive verification pass, the remaining checks are:

1. New date: one template-backed page with full date, three plan rows, dominant
   journal and current lesson; native ink available immediately, no splash screen.
2. Reopen: unchanged file, lesson and page count.
3. Wholly empty legacy one- and two-page notes: repaired page 0 and confirmed
   empty seed removal. Any element on either page prevents repair.
4. Permission, missing-template, file-text and open errors: visible actionable
   screen; no silent or incomplete generation success.
5. Nomad and Manta portrait sizing, native handwriting and firmware text/search
   behavior. Browser output and counts alone cannot certify these.

## Roadmap

Later phases: carry-over plan tasks without a sync backend; previous/next dated
note navigation; weekly/monthly archive views; reliably supported native keywords,
titles, links/backlinks; practice completion/history/statistics and no-skipped-day
progress through documented local storage. No calendar/cloud/CalDAV or PARA scope.

## Provenance and license

This is not a fork. The shell/build scaffold comes from the official Supernote
template. Public SNFolio and Task Hub were studied for API usage and failure lessons,
not copied wholesale. Domain logic, orchestration, PNG layout/lettering, adapter,
preview and tests are original.

Apache-2.0. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
