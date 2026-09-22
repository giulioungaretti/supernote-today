import {err, ok} from '../domain/result';
import {fakeDevice} from '../testSupport/fakeDevice';
import {createTodayController} from './todayController';

const clock = {now: () => new Date(2026, 8, 21)};
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

test('runs headlessly without a mounted component or subscription', async () => {
  const device = fakeDevice();
  const controller = createTodayController({device, clock});
  await controller.openToday();
  expect(device.openNote).toHaveBeenCalledTimes(1);
  expect(device.showPluginView).not.toHaveBeenCalled();
  expect(controller.getSnapshot()).toEqual({kind: 'idle'});
});

test('coalesces rapid presses and always releases the in-flight guard', async () => {
  const device = fakeDevice();
  const controller = createTodayController({device, clock});
  const first = controller.openToday();
  expect(controller.openToday()).toBe(first);
  expect(controller.showSettings()).toBe(first);
  await first;
  device.noteExists.mockResolvedValue(ok(true));
  await controller.openToday();
  expect(device.createNote).toHaveBeenCalledTimes(1);
  expect(device.openNote).toHaveBeenCalledTimes(2);
  expect(device.closePluginView).toHaveBeenCalledTimes(2);
});

test('reveals retained actionable errors, even when the view mounts after failure', async () => {
  const device = fakeDevice();
  device.ensureFileAccess.mockResolvedValue(
    err({
      kind: 'device-failure',
      step: 'permission-read',
      message: 'Allow file access in settings.',
    }),
  );
  const controller = createTodayController({device, clock});
  await controller.openToday();
  expect(device.showPluginView).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot()).toEqual({
    kind: 'error',
    failure: expect.objectContaining({step: 'permission-read'}),
  });
  expect(device.closePluginView).not.toHaveBeenCalled();
  expect(device.openNote).not.toHaveBeenCalled();
});

test('restores the error screen after a post-close open failure', async () => {
  const device = fakeDevice();
  device.openNote.mockResolvedValue(
    err({
      kind: 'device-failure',
      step: 'open-note',
      message: 'Unlock the note folder.',
    }),
  );
  const controller = createTodayController({device, clock});
  await controller.openToday();
  expect(device.closePluginView).toHaveBeenCalledTimes(1);
  expect(device.showPluginView).toHaveBeenCalledTimes(1);
  expect(device.showPluginView.mock.invocationCallOrder[0]).toBeGreaterThan(
    device.openNote.mock.invocationCallOrder[0] ?? 0,
  );
});

test('unexpected rejection is visible and Retry is not stuck', async () => {
  const device = fakeDevice();
  device.noteExists.mockRejectedValueOnce(new Error('Bridge unavailable'));
  const controller = createTodayController({device, clock});
  await controller.openToday();
  expect(controller.getSnapshot()).toEqual({
    kind: 'error',
    failure: expect.objectContaining({message: 'Bridge unavailable'}),
  });
  await controller.openToday();
  expect(device.openNote).toHaveBeenCalledTimes(1);
});

test('config shows status without opening or mutating a note', async () => {
  const device = fakeDevice();
  const controller = createTodayController({device, clock});
  await controller.showSettings();
  expect(controller.getSnapshot().kind).toBe('settings');
  expect(device.showPluginView).toHaveBeenCalledTimes(1);
  expect(device.openNote).not.toHaveBeenCalled();
  expect(device.createNote).not.toHaveBeenCalled();
});
