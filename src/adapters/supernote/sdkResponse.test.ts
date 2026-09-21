import {readSdkBoolean, readSdkResult} from './sdkResponse';

describe('sdkResponse', () => {
  it('unwraps a typed successful result', () => {
    expect(
      readSdkResult(
        'size',
        {success: true, result: {width: 1404, height: 1872}, error: null},
        (
          value,
        ): value is Readonly<{width: number; height: number}> =>
          typeof value === 'object' &&
          value !== null &&
          'width' in value &&
          typeof value.width === 'number' &&
          'height' in value &&
          typeof value.height === 'number',
      ),
    ).toEqual({
      ok: true,
      value: {width: 1404, height: 1872},
    });
  });

  it('requires boolean operations to return true', () => {
    expect(
      readSdkBoolean('createNote', {
        success: true,
        result: false,
        error: null,
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'sdk-failure',
        operation: 'createNote',
        message: 'SDK operation returned false',
      },
    });
  });

  it('preserves SDK error details', () => {
    expect(
      readSdkBoolean('openFile', {
        success: false,
        result: null,
        error: {code: 1503, message: 'Read permission missing'},
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'sdk-failure',
        operation: 'openFile',
        code: 1503,
        message: 'Read permission missing',
      },
    });
  });
});
