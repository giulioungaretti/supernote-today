# Supernote Today

Supernote Today is a TypeScript-only, native-first daily journal and cursive-practice plugin for current Supernote Plugin Preview firmware. Its NOTE toolbar action opens the current date's native `.note` file. When the file is absent, the plugin creates page 0, draws a compact plan, a large ruled journal area, and a 10-minute cursive lesson, then returns control to the native NOTE editor.

The plugin does not ship or install an APK. It packages only the React Native JavaScript bundle, `PluginConfig.json`, and assets into `.snplg`.

## v0.1 behavior

- NOTE-only **Today** toolbar action.
- Plugin-management **Config** entry.
- Fixed journal directory:

  ```text
  /storage/emulated/0/Note/Today/YYYY-MM-DD.note
  ```

- Existing nonblank same-day files open without modification.
- A completely blank one-page dated note is treated as an interrupted generation
  and repaired.
- New files receive one responsive native page:
  - full date;
  - three blank plan/priority rows;
  - large ruled journal region;
  - bottom 10-minute cursive lesson.
- Generated elements carry stable per-component markers.
- A partially generated plugin page is repaired by inserting only missing marked components.
- The 56-lesson curriculum is selected deterministically from the local date, so reopening the same day always produces the same exercise without plugin storage.
- No custom ink engine, task backend, sync, calendar, cloud service, or PARA system.

## TypeScript-only architecture

```text
NOTE toolbar/config events
        |
        v
application/ensureTodayNote.ts
        |
        +--> pure TypeScript date/curriculum/layout logic
        |
        +--> sn-plugin-lib TypeScript adapter
               |
               +--> FILE permission checks
               +--> FileUtils.exists/makeDir
               +--> native NOTE create/open
               +--> native TextBox/geometry insertion
               +--> save/reload/marker verification
```

The checked-in Android/iOS directories come from the official React Native template and support normal project tooling. Supernote's plugin packager takes the no-native path because no custom React package or native module is registered.

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

The lesson index is derived from the number of calendar days since `2026-01-01`, modulo 56. This guarantees same-date idempotence with no persistent plugin state.

**v0.1 limitation:** missed calendar days advance the deterministic schedule. Explicit generated-note progress, reset/start controls, and configurable journal roots are roadmap work pending a documented generic TypeScript storage API.

## Privacy and permissions

`PluginConfig.json` declares only:

- `plugin.permission.FILE:READ`
- `plugin.permission.FILE:WRITE`

There is no INTERNET permission. The plugin reads and writes only beneath the Supernote `Note` directory. It stores no settings database, analytics, credentials, or journal content outside native `.note` files.

## SDK and firmware status

### Verified

- React Native `0.79.2`.
- Official template `@supernote-plugin/sn-plugin-template@1.0.12`.
- `sn-plugin-lib@0.1.65`.
- NOTE toolbar/config registration and PluginHost lifecycle.
- `.snplg` JavaScript bundle/config/assets format.
- `PluginFileAPI.createNote`, `openFile`, and page element APIs.
- `PluginCommAPI.insertPageElements`, `getPageDisplaySize`, and `reloadFile`.
- `PluginNoteAPI.saveCurrentNote`.
- `FileUtils.exists` and `FileUtils.makeDir`.
- FILE:READ/FILE:WRITE declaration and runtime authorization.

### Device-informed constraints

- Boolean SDK calls are accepted only when both the response envelope and `result` indicate success.
- Geometry uses current-page insertion, pixel coordinates, `layer = null`, and pen width of at least `100`.
- Text batches remain small and prompts use printable ASCII.
- Existing-file handoff closes the plugin view before `openFile`.
- A newly rendered note is already current beneath the overlay, so generation closes the overlay without opening the file a second time.

### Page-0 firmware behavior

Current device evidence shows that drawing directly into the seed page created by
`createNote` can produce a blank result. v0.1 therefore uses the proven sequence:

1. create the note;
2. insert a new blank page at index 0;
3. jump to page 0;
4. insert/save/reload/verify the generated elements.

The original seed page remains as a blank page 1. Removing it safely is deferred
until that file-level operation is proven on Plugin Preview firmware.

### Assumptions requiring Plugin Preview device validation

- Immediate automatic close reveals the generated page reliably.
- `style_white`, or a discovered blank equivalent, is accepted.
- Native TextBox content has the expected search behavior. ISO-dated filenames are the guaranteed searchable identifier.
- Marker metadata survives save/reload on target Nomad/Manta firmware.

The plugin reports generation/layout/open failures instead of silently claiming success.

## Local validation

Node.js 18 or newer is sufficient for the TypeScript-only build.

If direct npm access is unavailable:

```powershell
npm config set registry https://packagefeedproxy.microsoft.io/npm/
npm config get registry
```

Then:

```powershell
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
.\buildPlugin.ps1
```

The package is written to:

```text
build/outputs/SupernoteToday.snplg
```

No JDK, Android SDK, Gradle build, APK, `nativeCodePackage`, or `reactPackages` is required.

## GitHub Actions artifact

`.github/workflows/build-plugin.yml` runs on every branch push, pull request to `main`, and manual dispatch. It:

1. configures the Microsoft npm proxy;
2. restores dependencies;
3. runs typecheck, lint, and tests;
4. runs the official PowerShell plugin packager on `windows-latest`;
5. verifies that the `.snplg` contains the JS bundle/config/icon and contains no `app.npk` or native package declarations;
6. uploads `supernote-today-snplg`.

To download:

1. Open the repository **Actions** tab.
2. Open **Build Supernote plugin**.
3. Select a successful run.
4. Download the `supernote-today-snplg` artifact.
5. Extract `SupernoteToday.snplg` and its SHA-256 file.

## Install on Supernote Nomad

The Nomad must run firmware with **Plugin Preview** support. Preview firmware wording can vary.

### USB

1. Connect the Nomad over USB.
2. Copy `SupernoteToday.snplg` to the top-level `MyStyle` directory (`/storage/emulated/0/MyStyle/`, commonly shown as `/MyStyle/`).
3. Disconnect safely.
4. Open **Settings -> Apps -> Plugins**.
5. Choose **Add Plugin**, select the file, and confirm.
6. Grant file read/write access on first use.

### Optional ADB copy

Only when ADB is already enabled and `adb devices` shows the intended device:

```powershell
adb push .\build\outputs\SupernoteToday.snplg /sdcard/MyStyle/SupernoteToday.snplg
```

Then install through **Settings -> Apps -> Plugins**.

### Add Plugin versus Reinstall Plugin

- Use **Add Plugin** for the first installation.
- Use **Reinstall Plugin**, Replace, or the equivalent firmware action when updating the same plugin ID. The exact label may vary.
- v0.1 is JavaScript-only, so no native APK refresh is involved.
- If a preview build has no reinstall action, remove the old plugin and add the new `.snplg` again after confirming the device prompt.

## Manual device checklist

1. New date creates `/Note/Today/YYYY-MM-DD.note`.
2. Page 0 contains the date, plan rows, ruled journal, and cursive exercise.
3. Plugin closes once and native handwriting is immediately available.
4. The generated content is on page 0; the original blank seed is page 1.
5. Second press opens the same file without changing page count/content.
6. Existing nonblank unmarked same-date note opens untouched.
7. A blank one-page note from an interrupted/older build is repaired.
8. Partial marked layout is repaired without duplicate components.
9. Permission denial and SDK failures remain visible with Retry/Settings.
10. Layout fits Nomad (`1404 x 1872`) and Manta (`1920 x 2560`) portrait pages.

## Roadmap

1. Documented TypeScript-only settings/progress persistence.
2. Practice progress that does not skip missed days, plus reset/start controls.
3. Configurable journal root.
4. Carry-over plan lines.
5. Previous/next day navigation.
6. Weekly/monthly archive views.
7. Proven native keywords, titles, links, and backlinks.
8. Local practice history/statistics.

## Clean-room statement

This standalone repository was generated from the official Supernote template. Public projects including SNFolio and Task Hub were studied only for SDK usage and firmware failure lessons; their product code and architecture were not copied wholesale.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
