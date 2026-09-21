import {PluginManager} from 'sn-plugin-lib';

import {err, ok, type Result} from '../../domain/result';
import type {DeviceFailure, DeviceStep} from '../../ports/devicePort';

const READ_PERMISSION = 'plugin.permission.FILE:READ';
const WRITE_PERMISSION = 'plugin.permission.FILE:WRITE';

const ensurePermission = async (
  permission: string,
  step: DeviceStep,
  description: string,
): Promise<Result<void, DeviceFailure>> => {
  try {
    const current = await PluginManager.hasPermission(permission);
    if (current === 1) {
      return ok(undefined);
    }

    const requested = await PluginManager.requestPermission(
      permission,
      description,
    );
    return requested === 1 || requested === 2
      ? ok(undefined)
      : err({
          kind: 'device-failure',
          step,
          message:
            'File access was not granted. Open plugin settings and allow file access.',
        });
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step,
      message:
        error instanceof Error
          ? error.message
          : 'The permission request failed',
    });
  }
};

export const ensureFileAccess = async (): Promise<
  Result<void, DeviceFailure>
> => {
  const read = await ensurePermission(
    READ_PERMISSION,
    'permission-read',
    'Today needs read access to find and verify dated native notes.',
  );
  if (!read.ok) {
    return read;
  }

  return ensurePermission(
    WRITE_PERMISSION,
    'permission-write',
    'Today needs write access to create the dated native note and its first page.',
  );
};
