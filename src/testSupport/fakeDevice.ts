import {ok, type Result} from '../domain/result';
import type {DeviceFailure, DevicePort} from '../ports/devicePort';

const returns = <Value, Args extends unknown[]>(
  value: Value,
): jest.Mock<Promise<Result<Value, DeviceFailure>>, Args> =>
  jest.fn<Promise<Result<Value, DeviceFailure>>, Args>(async () => ok(value));

export const fakeDevice = (): jest.Mocked<DevicePort> => ({
  ensureFileAccess: returns(undefined),
  ensureNoteDirectory: returns(undefined),
  noteExists: returns(false),
  resolveTemplate: returns('/installed/drawable-mdpi/assets_today_nomad.png'),
  createNote: returns(undefined),
  inspectNote: returns({pageCount: 1, elementCounts: [4]}),
  insertTemplatePage: returns(undefined),
  insertTodayText: returns(undefined),
  removeEmptySeedPages: returns(undefined),
  closePluginView: returns(undefined),
  openNote: returns(undefined),
  showPluginView: returns(undefined),
  diagnostics: returns({deviceType: 4, deviceName: 'Nomad'}),
});
