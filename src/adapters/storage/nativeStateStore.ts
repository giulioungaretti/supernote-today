import {NativeModules} from 'react-native';

import {err, ok, type Result} from '../../domain/result';
import type {
  StateStore,
  StorageFailure,
  StorageOperation,
} from '../../ports/stateStore';

interface TodayStorageNativeModule {
  readonly externalStorageRoot: () => Promise<string>;
  readonly readState: () => Promise<string | null>;
  readonly writeStateAtomic: (json: string) => Promise<boolean>;
  readonly ensureDirectory: (absolutePath: string) => Promise<boolean>;
  readonly exists: (absolutePath: string) => Promise<boolean>;
}

const nativeModule = (): TodayStorageNativeModule | null => {
  const candidate = NativeModules.TodayStorage as unknown;
  if (typeof candidate !== 'object' || candidate === null) {
    return null;
  }

  const module = candidate as Partial<TodayStorageNativeModule>;
  return typeof module.externalStorageRoot === 'function' &&
    typeof module.readState === 'function' &&
    typeof module.writeStateAtomic === 'function' &&
    typeof module.ensureDirectory === 'function' &&
    typeof module.exists === 'function'
    ? (module as TodayStorageNativeModule)
    : null;
};

const failure = (
  operation: StorageOperation,
  error: unknown,
): StorageFailure => ({
  kind: 'storage-failure',
  operation,
  message:
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Native storage operation failed',
});

const invoke = async <Value>(
  operation: StorageOperation,
  action: (module: TodayStorageNativeModule) => Promise<Value>,
): Promise<Result<Value, StorageFailure>> => {
  const module = nativeModule();
  if (module === null) {
    return err(
      failure(operation, 'TodayStorage native module is not available'),
    );
  }

  try {
    return ok(await action(module));
  } catch (error: unknown) {
    return err(failure(operation, error));
  }
};

const requireTrue = async (
  operation: StorageOperation,
  action: (module: TodayStorageNativeModule) => Promise<boolean>,
): Promise<Result<void, StorageFailure>> => {
  const result = await invoke(operation, action);
  if (!result.ok) {
    return result;
  }

  return result.value
    ? ok(undefined)
    : err(failure(operation, 'Native storage operation returned false'));
};

export const nativeStateStore: StateStore = {
  externalStorageRoot: () =>
    invoke('external-root', module => module.externalStorageRoot()),
  readState: () => invoke('read-state', module => module.readState()),
  writeState: json =>
    requireTrue('write-state', module => module.writeStateAtomic(json)),
  ensureDirectory: absolutePath =>
    requireTrue('ensure-directory', module =>
      module.ensureDirectory(absolutePath),
    ),
  exists: absolutePath =>
    invoke('exists', module => module.exists(absolutePath)),
};
