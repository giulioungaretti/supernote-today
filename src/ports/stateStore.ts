import type {Result} from '../domain/result';

export type StorageOperation =
  | 'external-root'
  | 'read-state'
  | 'write-state'
  | 'ensure-directory'
  | 'exists';

export interface StorageFailure {
  readonly kind: 'storage-failure';
  readonly operation: StorageOperation;
  readonly message: string;
}

export interface StateStore {
  readonly externalStorageRoot: () => Promise<Result<string, StorageFailure>>;
  readonly readState: () => Promise<Result<string | null, StorageFailure>>;
  readonly writeState: (
    json: string,
  ) => Promise<Result<void, StorageFailure>>;
  readonly ensureDirectory: (
    absolutePath: string,
  ) => Promise<Result<void, StorageFailure>>;
  readonly exists: (
    absolutePath: string,
  ) => Promise<Result<boolean, StorageFailure>>;
}
