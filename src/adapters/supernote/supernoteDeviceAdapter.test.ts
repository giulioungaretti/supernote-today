import {Image} from 'react-native';
import {
  FileUtils,
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
} from 'sn-plugin-lib';
import {lessonForDate} from '../../domain/lessonSchedule';
import {describeDate} from '../../domain/localDate';
import {supernoteDeviceAdapter as device} from './supernoteDeviceAdapter';

jest.mock('react-native', () => ({Image: {resolveAssetSource: jest.fn()}}));
jest.mock('sn-plugin-lib', () => ({
  Element: {TYPE_TEXT: 500},
  TextBox: class {},
  FileUtils: {exists: jest.fn(), makeDir: jest.fn()},
  PluginCommAPI: {createElement: jest.fn(), recycleElement: jest.fn()},
  PluginFileAPI: {
    createNote: jest.fn(),
    getNoteTotalPageNum: jest.fn(),
    getElementCounts: jest.fn(),
    getPageSize: jest.fn(),
    insertElements: jest.fn(),
    insertNotePage: jest.fn(),
    removeNotePage: jest.fn(),
    openFile: jest.fn(),
  },
  PluginManager: {
    getDeviceType: jest.fn(),
    getPluginDirPath: jest.fn(),
    closePluginView: jest.fn(),
    showPluginView: jest.fn(),
  },
}));

const files = jest.mocked(PluginFileAPI);
const comm = jest.mocked(PluginCommAPI);
const manager = jest.mocked(PluginManager);
const fs = jest.mocked(FileUtils);
const image = jest.mocked(Image);
const success = (result: unknown) => ({success: true, result, error: null});
const path = '/storage/emulated/0/Note/Today/2026-09-21.note';
const descriptor = describeDate(new Date(2026, 8, 21));
const content = {
  notePath: path,
  ...descriptor,
  lesson: lessonForDate(descriptor.date),
};
let pages: number[];

beforeEach(() => {
  jest.resetAllMocks();
  pages = [0];
  manager.getDeviceType.mockResolvedValue(4);
  manager.getPluginDirPath.mockResolvedValue('/installed');
  image.resolveAssetSource.mockReturnValue({
    uri: 'assets_today_nomad',
    width: 1404,
    height: 1872,
    scale: 1,
  });
  fs.exists.mockImplementation(async candidate =>
    candidate.startsWith('/installed/'),
  );
  files.getNoteTotalPageNum.mockImplementation(async () =>
    success(pages.length),
  );
  files.getElementCounts.mockImplementation(async (_path, page) =>
    success(pages[page]),
  );
  files.getPageSize.mockResolvedValue(success({width: 1404, height: 1872}));
  comm.createElement.mockImplementation(async () =>
    success({uuid: `uuid-${comm.createElement.mock.calls.length}`, type: 500}),
  );
  files.insertElements.mockImplementation(async (_path, page, elements) => {
    pages[page] = (pages[page] ?? 0) + elements.length;
    return success(true);
  });
  files.insertNotePage.mockImplementation(async () => {
    pages.unshift(0);
    return success(true);
  });
  files.removeNotePage.mockImplementation(async (_path, page) => {
    pages.splice(page, 1);
    return success(true);
  });
  files.createNote.mockResolvedValue(success(true));
});

test('resolves the real Metro asset path under the plugin installation directory', async () => {
  expect(await device.resolveTemplate()).toEqual({
    ok: true,
    value: '/installed/drawable-mdpi/assets_today_nomad.png',
  });
  expect(fs.exists).toHaveBeenCalledWith(
    '/installed/drawable-mdpi/assets_today_nomad.png',
  );
});

test('checks the installation candidate if the resolved URI is missing', async () => {
  image.resolveAssetSource.mockReturnValue({
    uri: 'file:///missing.png',
    width: 1404,
    height: 1872,
    scale: 1,
  });
  expect((await device.resolveTemplate()).ok).toBe(true);
  expect(fs.exists.mock.calls).toEqual([
    ['/missing.png'],
    ['/installed/drawable-mdpi/assets_today_nomad.png'],
  ]);
});

test('uses the Manta PNG and fails visibly when no candidate exists', async () => {
  manager.getDeviceType.mockResolvedValue(5);
  expect(await device.resolveTemplate()).toEqual({
    ok: true,
    value: '/installed/drawable-mdpi/assets_today_manta.png',
  });
  fs.exists.mockResolvedValue(false);
  expect(await device.resolveTemplate()).toEqual({
    ok: false,
    error: expect.objectContaining({
      step: 'template',
      message: expect.stringContaining('Reinstall'),
    }),
  });
  expect(files.createNote).not.toHaveBeenCalled();
});

test('creates directly with the custom PNG, not a system blank or extra page', async () => {
  expect((await device.createNote(path, '/installed/template.png')).ok).toBe(
    true,
  );
  expect(files.createNote).toHaveBeenCalledWith({
    notePath: path,
    template: '/installed/template.png',
    mode: 0,
    isPortrait: true,
  });
  expect(files.insertNotePage).not.toHaveBeenCalled();
  expect(files.openFile).not.toHaveBeenCalled();
});

test('never overwrites a note that appeared during creation', async () => {
  fs.exists.mockResolvedValue(true);
  expect((await device.createNote(path, '/installed/template.png')).ok).toBe(
    false,
  );
  expect(files.createNote).not.toHaveBeenCalled();
});

test('allocates four cached TextBoxes and inserts into the file before releasing them', async () => {
  expect((await device.insertTodayText(content)).ok).toBe(true);
  expect(comm.createElement.mock.calls).toEqual([[500], [500], [500], [500]]);
  expect(files.insertElements).toHaveBeenCalledTimes(1);
  expect(files.insertElements).toHaveBeenCalledWith(path, 0, [
    expect.objectContaining({
      pageNum: 0,
      layerNum: 0,
      textBox: expect.objectContaining({
        textContentFull: descriptor.fullDate,
        textEditable: 0,
      }),
    }),
    expect.objectContaining({
      textBox: expect.objectContaining({textContentFull: content.lesson.title}),
    }),
    expect.objectContaining({
      textBox: expect.objectContaining({
        textContentFull: content.lesson.instruction,
      }),
    }),
    expect.objectContaining({
      textBox: expect.objectContaining({
        textContentFull: content.lesson.sample,
      }),
    }),
  ]);
  expect(files.getElementCounts).toHaveBeenCalledTimes(2);
  expect(comm.recycleElement).toHaveBeenCalledTimes(4);
  expect(comm.recycleElement.mock.invocationCallOrder[0]).toBeGreaterThan(
    files.getElementCounts.mock.invocationCallOrder[1] ?? 0,
  );
  expect(files.openFile).not.toHaveBeenCalled();
});

test.each([false, null, 'true'])(
  'rejects insertElements result %j and never retries insertion',
  async result => {
    files.insertElements.mockResolvedValue(success(result));
    expect((await device.insertTodayText(content)).ok).toBe(false);
    expect(files.insertElements).toHaveBeenCalledTimes(1);
    expect(files.removeNotePage).not.toHaveBeenCalled();
  },
);

test('a success envelope with no persisted elements is a visible error', async () => {
  files.insertElements.mockResolvedValue(success(true));
  expect(await device.insertTodayText(content)).toEqual({
    ok: false,
    error: expect.objectContaining({step: 'verify-text'}),
  });
});

test('never inserts text into a page with existing elements', async () => {
  pages = [1];
  expect((await device.insertTodayText(content)).ok).toBe(false);
  expect(comm.createElement).not.toHaveBeenCalled();
  expect(files.insertElements).not.toHaveBeenCalled();
});

test('failed allocation releases only allocated elements, without partial text writes', async () => {
  comm.createElement.mockResolvedValueOnce(
    success({uuid: 'allocated', type: 500}),
  );
  comm.createElement.mockResolvedValueOnce({
    success: false,
    error: {code: 123, message: 'No cache'},
  });
  expect((await device.insertTodayText(content)).ok).toBe(false);
  expect(files.insertElements).not.toHaveBeenCalled();
  expect(comm.recycleElement).toHaveBeenCalledWith('allocated');
});

test('inspection reads both pages and rejects unknown element counts', async () => {
  pages = [0, 7];
  expect(await device.inspectNote(path)).toEqual({
    ok: true,
    value: {pageCount: 2, elementCounts: [0, 7]},
  });
  expect(files.getElementCounts.mock.calls).toEqual([
    [path, 0],
    [path, 1],
  ]);
  files.getElementCounts.mockResolvedValueOnce(success(-1));
  expect((await device.inspectNote(path)).ok).toBe(false);
});

test('rechecks all pages immediately before repair and refuses newly written ink', async () => {
  pages = [0, 1];
  expect((await device.insertTemplatePage(path, '/template.png', 2)).ok).toBe(
    false,
  );
  expect(files.insertNotePage).not.toHaveBeenCalled();
  expect(files.removeNotePage).not.toHaveBeenCalled();
});

test('inserts the repair page at index zero and checks the page-count increase', async () => {
  pages = [0, 0];
  expect((await device.insertTemplatePage(path, '/template.png', 2)).ok).toBe(
    true,
  );
  expect(files.insertNotePage).toHaveBeenCalledWith({
    notePath: path,
    template: '/template.png',
    page: 0,
  });
  files.insertNotePage.mockResolvedValue(success(true));
  pages = [0, 0];
  expect((await device.insertTemplatePage(path, '/template.png', 2)).ok).toBe(
    false,
  );
});

test('deletes only verified empty seed pages from the end, never page zero', async () => {
  pages = [4, 0, 0];
  expect((await device.removeEmptySeedPages(path, 2)).ok).toBe(true);
  expect(files.removeNotePage.mock.calls).toEqual([
    [path, 2],
    [path, 1],
  ]);
  expect(pages).toEqual([4]);
});

test.each([
  [4, 0, 1],
  [4, 1, 0],
  [4, 0, 0, 0],
])(
  'does not remove pages if content or page count changed: %j',
  async (...counts: number[]) => {
    pages = counts;
    expect((await device.removeEmptySeedPages(path, 2)).ok).toBe(false);
    expect(files.removeNotePage).not.toHaveBeenCalled();
  },
);

test('stops on a false deletion result or unverified page count', async () => {
  pages = [4, 0, 0];
  files.removeNotePage.mockResolvedValue(success(false));
  expect((await device.removeEmptySeedPages(path, 2)).ok).toBe(false);
  expect(files.removeNotePage).toHaveBeenCalledTimes(1);
  files.removeNotePage.mockClear().mockResolvedValue(success(true));
  expect((await device.removeEmptySeedPages(path, 2)).ok).toBe(false);
  expect(files.removeNotePage).toHaveBeenCalledTimes(1);
});
