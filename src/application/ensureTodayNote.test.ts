import {ensureTodayNote} from './ensureTodayNote';
import {err, ok} from '../domain/result';
import {fakeDevice} from '../testSupport/fakeDevice';

const clock = {now: () => new Date(2026, 8, 21, 12)};
const notePath = '/storage/emulated/0/Note/Today/2026-09-21.note';

test('creates with a bundled template, verifies file text, closes once then opens', async () => {
  const device = fakeDevice();
  const result = await ensureTodayNote({device, clock});
  expect(result).toEqual(ok({kind: 'generated', date: '2026-09-21', notePath}));
  expect(device.createNote).toHaveBeenCalledWith(
    notePath,
    '/installed/drawable-mdpi/assets_today_nomad.png',
  );
  expect(device.insertTodayText).toHaveBeenCalledWith(
    expect.objectContaining({notePath, fullDate: 'Monday, September 21, 2026'}),
  );
  expect(device.createNote.mock.invocationCallOrder[0]).toBeLessThan(
    device.insertTodayText.mock.invocationCallOrder[0] ?? 0,
  );
  expect(device.insertTodayText.mock.invocationCallOrder[0]).toBeLessThan(
    device.closePluginView.mock.invocationCallOrder[0] ?? 0,
  );
  expect(device.closePluginView.mock.invocationCallOrder[0]).toBeLessThan(
    device.openNote.mock.invocationCallOrder[0] ?? 0,
  );
  expect(device.closePluginView).toHaveBeenCalledTimes(1);
  expect(device.openNote).toHaveBeenCalledWith(notePath);
  expect(device.insertTemplatePage).not.toHaveBeenCalled();
  expect(device.showPluginView).not.toHaveBeenCalled();
});

test.each([[4], [0, 1], [1, 0], [0, 100], [4, 0]])(
  'opens existing content unchanged: %j',
  async (...counts: number[]) => {
    const device = fakeDevice();
    device.noteExists.mockResolvedValue(ok(true));
    device.inspectNote.mockResolvedValue(
      ok({pageCount: counts.length, elementCounts: counts}),
    );
    const result = await ensureTodayNote({device, clock});
    expect(result.ok && result.value.kind).toBe('opened-existing');
    expect(device.createNote).not.toHaveBeenCalled();
    expect(device.resolveTemplate).not.toHaveBeenCalled();
    expect(device.insertTemplatePage).not.toHaveBeenCalled();
    expect(device.insertTodayText).not.toHaveBeenCalled();
    expect(device.removeEmptySeedPages).not.toHaveBeenCalled();
    expect(device.closePluginView).toHaveBeenCalledTimes(1);
    expect(device.openNote).toHaveBeenCalledWith(notePath);
  },
);

test.each([1, 2])(
  'repairs %i entirely empty pages before close/open',
  async count => {
    const device = fakeDevice();
    device.noteExists.mockResolvedValue(ok(true));
    device.inspectNote.mockResolvedValue(
      ok({pageCount: count, elementCounts: Array<number>(count).fill(0)}),
    );
    const result = await ensureTodayNote({device, clock});
    expect(result.ok && result.value.kind).toBe('repaired-empty');
    expect(device.insertTemplatePage).toHaveBeenCalledWith(
      notePath,
      expect.any(String),
      count,
    );
    expect(device.createNote).not.toHaveBeenCalled();
    expect(device.removeEmptySeedPages).toHaveBeenCalledWith(notePath, count);
    expect(device.insertTodayText.mock.invocationCallOrder[0]).toBeLessThan(
      device.removeEmptySeedPages.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      device.removeEmptySeedPages.mock.invocationCallOrder[0],
    ).toBeLessThan(device.closePluginView.mock.invocationCallOrder[0] ?? 0);
  },
);

test('leaves a longer archive note unchanged', async () => {
  const device = fakeDevice();
  device.noteExists.mockResolvedValue(ok(true));
  device.inspectNote.mockResolvedValue(ok({pageCount: 3, elementCounts: []}));
  expect((await ensureTodayNote({device, clock})).ok).toBe(true);
  expect(device.insertTemplatePage).not.toHaveBeenCalled();
});

test.each([
  'ensureFileAccess',
  'resolveTemplate',
  'ensureNoteDirectory',
  'createNote',
  'insertTodayText',
  'closePluginView',
] as const)('does not open after %s fails', async operation => {
  const device = fakeDevice();
  device[operation].mockResolvedValue(
    err({
      kind: 'device-failure',
      step: 'insert-text',
      message: 'deliberate failure',
    }),
  );
  const result = await ensureTodayNote({device, clock});
  expect(result.ok).toBe(false);
  expect(device.openNote).not.toHaveBeenCalled();
});

test('does not remove seed pages or close after text verification fails', async () => {
  const device = fakeDevice();
  device.noteExists.mockResolvedValue(ok(true));
  device.inspectNote.mockResolvedValue(
    ok({pageCount: 2, elementCounts: [0, 0]}),
  );
  device.insertTodayText.mockResolvedValue(
    err({
      kind: 'device-failure',
      step: 'verify-text',
      message: 'Expected 4, found 0',
    }),
  );
  expect((await ensureTodayNote({device, clock})).ok).toBe(false);
  expect(device.removeEmptySeedPages).not.toHaveBeenCalled();
  expect(device.closePluginView).not.toHaveBeenCalled();
});

test('fails safely if either page cannot be inspected', async () => {
  const device = fakeDevice();
  device.noteExists.mockResolvedValue(ok(true));
  device.inspectNote.mockResolvedValue(
    err({
      kind: 'device-failure',
      step: 'inspect-note',
      message: 'Page 1 read failed',
    }),
  );
  expect((await ensureTodayNote({device, clock})).ok).toBe(false);
  expect(device.insertTemplatePage).not.toHaveBeenCalled();
  expect(device.openNote).not.toHaveBeenCalled();
});

test('reopening the newly generated day never decorates twice', async () => {
  const device = fakeDevice();
  await ensureTodayNote({device, clock});
  device.noteExists.mockResolvedValue(ok(true));
  await ensureTodayNote({device, clock});
  expect(device.createNote).toHaveBeenCalledTimes(1);
  expect(device.insertTodayText).toHaveBeenCalledTimes(1);
  expect(device.openNote).toHaveBeenCalledTimes(2);
});
