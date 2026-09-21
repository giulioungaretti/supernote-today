import {ensureTodayNote} from './ensureTodayNote';
import {lessonAt} from '../domain/curriculum';
import {parseLocalDate} from '../domain/localDate';
import {PAGE_COMPONENT_IDS} from '../domain/pageLayout';
import {
  completeAssignment,
  defaultState,
  reserveAssignment,
  serializeState,
} from '../domain/progress';
import {err, ok, type Result} from '../domain/result';
import type {Clock} from '../ports/clock';
import type {
  DeviceDiagnostics,
  DeviceFailure,
  DevicePort,
  TodayPageContent,
} from '../ports/devicePort';
import type {
  StateStore,
  StorageFailure,
} from '../ports/stateStore';

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

class FakeStateStore implements StateStore {
  stateJson: string | null = null;
  existingPaths = new Set<string>();
  writes: string[] = [];
  ensuredDirectories: string[] = [];

  externalStorageRoot = async (): Promise<
    Result<string, StorageFailure>
  > => ok('/storage/emulated/0');

  readState = async (): Promise<Result<string | null, StorageFailure>> =>
    ok(this.stateJson);

  writeState = async (
    json: string,
  ): Promise<Result<void, StorageFailure>> => {
    this.stateJson = json;
    this.writes.push(json);
    return ok(undefined);
  };

  ensureDirectory = async (
    path: string,
  ): Promise<Result<void, StorageFailure>> => {
    this.ensuredDirectories.push(path);
    return ok(undefined);
  };

  exists = async (
    path: string,
  ): Promise<Result<boolean, StorageFailure>> =>
    ok(this.existingPaths.has(path));
}

class FakeDevice implements DevicePort {
  markers = new Set<string>();
  created: string[] = [];
  rendered: TodayPageContent[] = [];
  existingHandoffs: string[] = [];
  generatedHandoffs: string[] = [];
  renderFailure: DeviceFailure | null = null;

  ensureFileAccess = async (): Promise<Result<void, DeviceFailure>> =>
    ok(undefined);

  createNote = async (
    path: string,
  ): Promise<Result<void, DeviceFailure>> => {
    this.created.push(path);
    return ok(undefined);
  };

  readGeneratedComponentIds = async (): Promise<
    Result<ReadonlySet<string>, DeviceFailure>
  > => ok(new Set(this.markers));

  renderMissingPageComponents = async (
    content: TodayPageContent,
    missing: ReadonlySet<string>,
  ): Promise<Result<void, DeviceFailure>> => {
    if (this.renderFailure !== null) {
      return err(this.renderFailure);
    }
    this.rendered.push(content);
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
  it('opens an existing unassigned note without advancing progress', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();
    stateStore.existingPaths.add(notePath);

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'opened-existing',
        date,
        notePath,
        assignment: null,
      },
    });
    expect(stateStore.writes).toHaveLength(0);
    expect(device.rendered).toHaveLength(0);
    expect(device.existingHandoffs).toEqual([notePath]);
  });

  it('creates, renders, verifies, completes, and hands off a new note', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result.ok).toBe(true);
    expect(device.created).toEqual([notePath]);
    expect(device.rendered).toHaveLength(1);
    expect(device.rendered[0]?.lesson).toEqual(lessonAt(0));
    expect(device.generatedHandoffs).toEqual([notePath]);
    expect(stateStore.ensuredDirectories).toEqual([
      '/storage/emulated/0/Note/Today',
    ]);
    expect(stateStore.writes).toHaveLength(2);

    const persisted = JSON.parse(stateStore.writes[1] ?? '{}') as {
      nextSequence?: number;
      assignments?: Record<string, {status?: string}>;
    };
    expect(persisted.nextSequence).toBe(1);
    expect(persisted.assignments?.[date]?.status).toBe('complete');
  });

  it('reopens a completed same-day assignment without mutation', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();
    const reserved = reserveAssignment({
      state: defaultState(),
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: fixedDate.toISOString(),
    }).state;
    stateStore.stateJson = serializeState(
      completeAssignment(reserved, date, fixedDate.toISOString()),
    );
    stateStore.existingPaths.add(notePath);

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result.ok).toBe(true);
    expect(device.rendered).toHaveLength(0);
    expect(device.created).toHaveLength(0);
    expect(device.existingHandoffs).toEqual([notePath]);
    expect(stateStore.writes).toHaveLength(0);
  });

  it('commits a pending page that was already fully rendered', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();
    const pending = reserveAssignment({
      state: defaultState(),
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: fixedDate.toISOString(),
    }).state;
    stateStore.stateJson = serializeState(pending);
    stateStore.existingPaths.add(notePath);
    PAGE_COMPONENT_IDS.forEach(componentId => device.markers.add(componentId));

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result.ok).toBe(true);
    expect(device.rendered).toHaveLength(0);
    expect(device.existingHandoffs).toEqual([notePath]);
    expect(stateStore.writes).toHaveLength(1);
  });

  it('keeps the pending assignment when rendering fails', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();
    device.renderFailure = {
      kind: 'device-failure',
      step: 'insert-elements',
      message: 'Insertion failed',
    };

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'ensure-today-failure',
        step: 'render-page',
        message: 'Insertion failed',
      },
    });
    expect(stateStore.writes).toHaveLength(1);
    const pending = JSON.parse(stateStore.writes[0] ?? '{}') as {
      nextSequence?: number;
      assignments?: Record<string, {status?: string}>;
    };
    expect(pending.nextSequence).toBe(0);
    expect(pending.assignments?.[date]?.status).toBe('pending');
  });

  it('regenerates a deleted completed note without advancing twice', async () => {
    const stateStore = new FakeStateStore();
    const device = new FakeDevice();
    const reserved = reserveAssignment({
      state: defaultState(),
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: fixedDate.toISOString(),
    }).state;
    stateStore.stateJson = serializeState(
      completeAssignment(reserved, date, fixedDate.toISOString()),
    );

    const result = await ensureTodayNote({clock, stateStore, device});

    expect(result.ok).toBe(true);
    expect(device.created).toEqual([notePath]);
    const persisted = JSON.parse(
      stateStore.writes[stateStore.writes.length - 1] ?? '{}',
    ) as {nextSequence?: number};
    expect(persisted.nextSequence).toBe(1);
  });
});
