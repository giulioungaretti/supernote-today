import {ensureTodayNote} from './ensureTodayNote';
import {parseLocalDate} from '../domain/localDate';
import {PAGE_COMPONENT_IDS} from '../domain/pageLayout';
import {err, ok, type Result} from '../domain/result';
import type {Clock} from '../ports/clock';
import type {
  DeviceDiagnostics,
  DeviceFailure,
  DevicePort,
  NotePageInspection,
  TodayPageContent,
} from '../ports/devicePort';

const fixedDate = new Date(2026, 8, 21, 8, 0, 0);
const clock: Clock = {now: () => new Date(fixedDate)};
const date = (() => {
  const parsed = parseLocalDate('2026-09-21');
  if (!parsed.ok) {
    throw new Error('Test date is invalid');
  }
  return parsed.value;
})();
const notePath = `/storage/emulated/0/Note/Today/${date}.note`;

class FakeDevice implements DevicePort {
  exists = false;
  markers = new Set<string>();
  created: string[] = [];
  ensuredDirectories: string[] = [];
  rendered: TodayPageContent[] = [];
  existingHandoffs: string[] = [];
  generatedHandoffs: string[] = [];
  renderFailure: DeviceFailure | null = null;
  inspection: NotePageInspection = {
    pageCount: 1,
    pageZeroElementCount: 1,
  };
  insertGeneratedPageFlags: boolean[] = [];

  ensureFileAccess = async (): Promise<Result<void, DeviceFailure>> =>
    ok(undefined);

  ensureNoteDirectory = async (
    path: string,
  ): Promise<Result<void, DeviceFailure>> => {
    this.ensuredDirectories.push(path);
    return ok(undefined);
  };

  noteExists = async (): Promise<Result<boolean, DeviceFailure>> =>
    ok(this.exists);

  createNote = async (
    path: string,
  ): Promise<Result<void, DeviceFailure>> => {
    this.created.push(path);
    return ok(undefined);
  };

  readGeneratedComponentIds = async (): Promise<
    Result<ReadonlySet<string>, DeviceFailure>
  > => ok(new Set(this.markers));

  inspectNotePage = async (): Promise<
    Result<NotePageInspection, DeviceFailure>
  > => ok(this.inspection);

  renderMissingPageComponents = async (
    content: TodayPageContent,
    missing: ReadonlySet<string>,
    insertGeneratedPage: boolean,
  ): Promise<Result<void, DeviceFailure>> => {
    if (this.renderFailure !== null) {
      return err(this.renderFailure);
    }
    this.rendered.push(content);
    this.insertGeneratedPageFlags.push(insertGeneratedPage);
    missing.forEach(componentId => this.markers.add(componentId));
    return ok(undefined);
  };

  handoffGeneratedNote = async (
    path: string,
  ): Promise<Result<void, DeviceFailure>> => {
    this.generatedHandoffs.push(path);
    return ok(undefined);
  };

  handoffExistingNote = async (
    path: string,
  ): Promise<Result<void, DeviceFailure>> => {
    this.existingHandoffs.push(path);
    return ok(undefined);
  };

  closePluginView = async (): Promise<Result<void, DeviceFailure>> =>
    ok(undefined);

  showPluginView = async (): Promise<Result<void, DeviceFailure>> =>
    ok(undefined);

  diagnostics = async (): Promise<
    Result<DeviceDiagnostics, DeviceFailure>
  > => ok({deviceType: 4, deviceName: 'Nomad'});
}

describe('ensureTodayNote', () => {
  it('opens an existing unmarked note untouched', async () => {
    const device = new FakeDevice();
    device.exists = true;

    const result = await ensureTodayNote({clock, device});

    expect(result).toEqual({
      ok: true,
      value: {kind: 'opened-existing', date, notePath},
    });
    expect(device.rendered).toHaveLength(0);
    expect(device.existingHandoffs).toEqual([notePath]);
  });

  it('creates, renders, verifies, and hands off a new note', async () => {
    const device = new FakeDevice();

    const result = await ensureTodayNote({clock, device});

    expect(result.ok).toBe(true);
    expect(device.created).toEqual([notePath]);
    expect(device.ensuredDirectories).toEqual([
      '/storage/emulated/0/Note/Today',
    ]);
    expect(device.rendered).toHaveLength(1);
    expect(device.insertGeneratedPageFlags).toEqual([true]);
    expect(device.generatedHandoffs).toEqual([notePath]);
  });

  it('repairs the blank one-page note created by the previous build', async () => {
    const device = new FakeDevice();
    device.exists = true;
    device.inspection = {pageCount: 1, pageZeroElementCount: 0};

    const result = await ensureTodayNote({clock, device});

    expect(result.ok).toBe(true);
    expect(device.rendered).toHaveLength(1);
    expect(device.insertGeneratedPageFlags).toEqual([true]);
    expect(device.generatedHandoffs).toEqual([notePath]);
  });

  it('opens a complete generated note without redrawing it', async () => {
    const device = new FakeDevice();
    device.exists = true;
    PAGE_COMPONENT_IDS.forEach(componentId => device.markers.add(componentId));

    const result = await ensureTodayNote({clock, device});

    expect(result.ok).toBe(true);
    expect(device.rendered).toHaveLength(0);
    expect(device.existingHandoffs).toEqual([notePath]);
  });

  it('repairs only missing components when markers are partial', async () => {
    const device = new FakeDevice();
    device.exists = true;
    device.markers.add(PAGE_COMPONENT_IDS[0] ?? 'title');

    const result = await ensureTodayNote({clock, device});

    expect(result.ok).toBe(true);
    expect(device.rendered).toHaveLength(1);
    expect(device.insertGeneratedPageFlags).toEqual([false]);
    expect(device.generatedHandoffs).toEqual([notePath]);
    expect(device.markers.size).toBe(PAGE_COMPONENT_IDS.length);
  });

  it('reports rendering failure without claiming success', async () => {
    const device = new FakeDevice();
    device.renderFailure = {
      kind: 'device-failure',
      step: 'insert-elements',
      message: 'Insertion failed',
    };

    const result = await ensureTodayNote({clock, device});

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'ensure-today-failure',
        step: 'render-page',
        message: 'Insertion failed',
      },
    });
  });
});
