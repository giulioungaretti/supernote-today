# Supernote Today

Supernote Today is a native-first daily journal and progressive cursive-practice plugin for current Supernote Plugin Preview firmware. Its NOTE toolbar action opens the dated native `.note` file for the current day. If the file does not exist, the plugin creates page 0, adds a compact plan, a large ruled journal area, and a 10-minute cursive exercise, then returns control to the native NOTE editor.

The plugin does **not** implement an ink engine, note editor, sync service, task backend, calendar, CalDAV client, cloud service, or PARA system. All journal handwriting remains native Supernote ink.

## v0.1 behavior

- NOTE-only **Today** toolbar action.
- Plugin-management **Config** entry.
- Default journal location:

  ```text
  /storage/emulated/0/Note/Today/YYYY-MM-DD.note
  ```

- Existing same-day files open untouched.
- A new dated file receives one responsive first-page layout:
  - full date;
  - three blank plan/priority rows;
  - large ruled journal region;
  - bottom 10-minute cursive lesson.
- Reopening the same day does not add a page, redraw the layout, or advance practice.
- Interrupted generation is resumable: generated native elements carry stable private markers, and retries insert only missing components.
- Curriculum progress advances only after the new page is saved, reloaded, and verified.
- Missed calendar days do not skip lessons.
- After lesson 56, the curriculum restarts from basic strokes while dated history remains intact.

## Curriculum

The pure TypeScript curriculum contains 56 explicit lessons:

| Phase | Lessons |
|---|---:|
| Basic strokes and rhythm | 7 |
| Lowercase letter families | 21 |
| Joins | 7 |
| Words | 7 |
| Sentences | 7 |
| Natural cursive writing | 7 |

Settings can reset future practice to lesson 1 or start future notes at the first lesson of any phase. Existing assignments are never rewritten.

## Architecture

```text
NOTE toolbar/config events
        |
        v
application/ensureTodayNote.ts
        |
        +--> pure domain: date, curriculum, progress, layout
        |
        +--> StateStore port --> narrow Kotlin storage module
        |
        +--> DevicePort --> sn-plugin-lib adapter
                              |
                              +--> native NOTE create/open
                              +--> native TextBox/geometry elements
                              +--> save/reload/verification
```

Important boundaries:

- `src/domain/` is pure TypeScript.
- `src/application/` owns the transactional ensure/open behavior.
- `src/ports/` defines explicit side-effect interfaces.
- `src/adapters/supernote/` is the only code that understands `sn-plugin-lib`.
- `TodayStorageModule.kt` stores state and creates/checks directories; it never stores note content or performs network access.
- React Native UI is limited to opening status, actionable failures, and settings.

## Persistence and recovery

The plugin stores only settings and practice metadata:

```text
/storage/emulated/0/Document/SupernoteToday/state.json
```

The JSON file contains:

- schema version;
- journal root;
- next curriculum sequence;
- dated exercise assignments;
- generation status and expected native element IDs.

Writes use a temporary file plus atomic rename where Android supports it. The native module exposes no broad delete API and rejects paths outside the Supernote `Note` root for journal operations.

Generation is transactional:

1. Reserve the dated exercise and persist a pending assignment.
2. Create the native note when absent.
3. Open page 0 beneath the plugin overlay.
4. Insert only missing native elements.
5. Save, reload, and verify all stable markers.
6. Persist completion and advance the curriculum once.
7. Close the plugin overlay once, revealing the generated native note.

If a failure occurs before step 6, the plugin keeps the assignment pending and shows an actionable error. It does not report an incomplete note as success.

## Privacy and permissions

`PluginConfig.json` declares only:

- `plugin.permission.FILE:READ`
- `plugin.permission.FILE:WRITE`

There is no INTERNET permission. The Android manifests also omit INTERNET permission and disable cleartext traffic in the debug manifest.

The plugin reads/writes only:

- the configured folder beneath `/storage/emulated/0/Note`;
- `Document/SupernoteToday/state.json`.

No journal content, handwriting, filenames, settings, or usage data leaves the device.

## SDK and firmware status

### Verified from current official documentation/package metadata

- React Native `0.79.2`.
- Official template `@supernote-plugin/sn-plugin-template@1.0.12`.
- `sn-plugin-lib@0.1.65`.
- PluginHost lifecycle and NOTE toolbar/config registration.
- `.snplg` JS bundle and optional custom native package format.
- `PluginFileAPI.createNote`, `openFile`, `getElements`, and element-count/page APIs.
- Current-page native element insertion through `PluginCommAPI.insertPageElements`.
- `PluginNoteAPI.saveCurrentNote`, `PluginCommAPI.reloadFile`, and plugin-view show/close APIs.
- Native page dimensions through `getPageDisplaySize`.
- FILE:READ/FILE:WRITE declaration and runtime authorization requirements.

### Device-informed behavior from public examples

- Boolean SDK calls are accepted only when both the response envelope and `result` indicate success.
- Geometry is inserted through the current-page API, not file-level insertion.
- Geometry uses pixel coordinates, `layer = null`, and pen width of at least `100`.
- Text batches remain small and practice text is printable ASCII.
- Existing-file handoff closes the plugin view before calling `openFile`.
- A newly rendered note is already current under the overlay, so successful generation closes the overlay without opening the file a second time.

### Assumptions requiring Plugin Preview device validation

- The seed page created by `createNote` accepts direct page-0 element insertion without adding a second page.
- Immediate automatic close after verification reliably reveals page 0 on the target firmware.
- `style_white`, or a discovered blank equivalent, is accepted by the installed firmware.
- Native TextBox content has the expected search behavior. ISO-dated filenames are the guaranteed searchable identifier in v0.1.
- Nomad/Manta firmware accepts the sparse geometry/text batches and marker metadata exactly as documented.

The plugin fails visibly rather than adding a hidden fallback page when these assumptions do not hold.

## Build prerequisites

The repository's GitHub Actions build uses:

- Node.js 18 or newer;
- Temurin JDK 17, because the React Native Gradle plugins resolve a Java 17 toolchain;
- Android SDK Platform 35;
- Android Build Tools 35.0.0;
- Android NDK `27.0.12077973` and `27.1.12297006`.

This project is pinned to React Native `0.79.2`.

Current Supernote environment documentation states JDK 19 or newer, while the generated React Native Gradle build requests a Java 17 toolchain. The checked-in workflow uses the toolchain required by the build and is the canonical packaging environment until those upstream requirements converge.

### npm registry

If direct `registry.npmjs.org` access is unavailable, configure the Microsoft proxy before restore:

```powershell
npm config set registry https://packagefeedproxy.microsoft.io/npm/
npm config get registry
```

Do not alternate repeated restore attempts between the proxy and the public registry.

## Install dependencies and validate

```powershell
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
```

Run all three checks with:

```powershell
npm run validate
```

## Build the plugin

Windows:

```powershell
.\buildPlugin.ps1
```

Linux/macOS:

```bash
./buildPlugin.sh
```

The packaged plugin is written to:

```text
build/outputs/SupernoteToday.snplg
```

The custom Kotlin storage module causes the official build script to package a stripped arm64 APK and declare its React package in the generated plugin config.

## Build without local Android tooling

The workflow at `.github/workflows/build-plugin.yml` runs on every branch push, pull request to `main`, and manual dispatch. It restores exclusively through the configured Microsoft npm proxy, runs typecheck/lint/tests, installs the required Android SDK/NDK versions, builds the native `.snplg`, verifies that the package contains `app.npk`, and uploads the result.

To download a workflow build:

1. Open the repository's **Actions** tab.
2. Open **Build Supernote plugin**.
3. Select a successful branch run, pull-request run, or manually dispatched run.
4. In **Artifacts**, download `supernote-today-snplg`.
5. Extract the downloaded ZIP. It contains:
   - `SupernoteToday.snplg`;
   - `SupernoteToday.snplg.sha256`.

## Install on Supernote Nomad

The device must run firmware that includes the current **Plugin Preview** feature. Settings labels can vary slightly between preview firmware builds.

### Copy over USB

1. Connect the Nomad over USB and expose its internal storage.
2. Copy `SupernoteToday.snplg` into the top-level `MyStyle` directory. The Android path is `/storage/emulated/0/MyStyle/`, commonly shown as `/MyStyle/` over USB.
3. Safely disconnect the device.
4. Open **Settings -> Apps -> Plugins**.
5. Choose **Add Plugin**, select `SupernoteToday.snplg`, and confirm.
6. Grant file read/write access on first use.

### Optional ADB copy

Only use ADB when it is already enabled on the device and `adb devices` shows the intended Nomad:

```powershell
adb push .\build\outputs\SupernoteToday.snplg /sdcard/MyStyle/SupernoteToday.snplg
```

Then continue in **Settings -> Apps -> Plugins**.

### Add versus reinstall

- Use **Add Plugin** for the first installation.
- When updating an existing installation, use **Reinstall Plugin** or the firmware's equivalent replace/update action when it is available.
- v0.1 contains a native module (`app.npk`). For builds that change Kotlin/native code, reinstalling is required so PluginHost refreshes the native code package; copying a new `.snplg` alone is not sufficient.
- If the preview firmware does not expose a reinstall action, remove the installed plugin and use **Add Plugin** again. This fallback wording is device-build dependent; confirm the prompt before removing a plugin. Practice state is stored in `Document/SupernoteToday`, outside the plugin install directory.

## Manual device validation checklist

Run this checklist on each target firmware/device:

1. First press on a new date creates `/Note/Today/YYYY-MM-DD.note`.
2. Page 0 contains the date, three plan rows, ruled journal area, and assigned cursive exercise.
3. The plugin closes once and page 0 is ready for native handwriting.
4. A second press opens the same file without changing its page count or exercise.
5. A manually created same-date note opens untouched and does not advance practice.
6. Denied permissions produce a concise error with Retry and Settings.
7. Force-close during generation, then retry; missing components are repaired without duplicates.
8. Change journal root; only future dates use the new root.
9. Reset/start controls affect only future generated dates.
10. Verify layout and handwriting space on both Nomad (`1404 x 1872`) and Manta (`1920 x 2560`) portrait pages.

## Roadmap

Planned phases, deliberately excluded from v0.1:

1. Carry-over plan lines from the previous day, without cloud sync.
2. Previous/next dated-note navigation.
3. Weekly and monthly archive views.
4. Native keywords, titles, links, and backlinks after firmware behavior is proven reliable.
5. Practice completion, history views, and local statistics.

## Clean-room statement

This repository was created as a new standalone project from the official Supernote plugin template. Public projects including SNFolio and Task Hub were studied only for documented SDK usage, firmware constraints, and failure lessons. Their product architecture and source were not copied wholesale.

## License

Apache License 2.0. See [LICENSE](LICENSE). The official scaffold retains its upstream MIT notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
