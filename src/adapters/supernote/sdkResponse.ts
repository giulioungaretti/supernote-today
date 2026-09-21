import {err, ok, type Result} from '../../domain/result';

export interface SdkFailure {
  readonly kind: 'sdk-failure';
  readonly operation: string;
  readonly message: string;
  readonly code?: number;
}

type Guard<Value> = (value: unknown) => value is Value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sdkFailure = (
  operation: string,
  message: string,
  code?: number,
): SdkFailure =>
  code === undefined
    ? {kind: 'sdk-failure', operation, message}
    : {kind: 'sdk-failure', operation, message, code};

export const readSdkResult = <Value>(
  operation: string,
  response: unknown,
  guard: Guard<Value>,
): Result<Value, SdkFailure> => {
  if (!isRecord(response) || typeof response.success !== 'boolean') {
    return err(sdkFailure(operation, 'SDK returned an invalid response'));
  }

  if (!response.success) {
    const error = isRecord(response.error) ? response.error : {};
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : `${operation} failed`;
    const code = typeof error.code === 'number' ? error.code : undefined;
    return err(sdkFailure(operation, message, code));
  }

  if (!guard(response.result)) {
    return err(
      sdkFailure(operation, 'SDK response did not contain the expected result'),
    );
  }

  return ok(response.result);
};

export const readSdkBoolean = (
  operation: string,
  response: unknown,
): Result<void, SdkFailure> => {
  const parsed = readSdkResult(
    operation,
    response,
    (value): value is boolean => typeof value === 'boolean',
  );

  if (!parsed.ok) {
    return parsed;
  }

  return parsed.value
    ? ok(undefined)
    : err(sdkFailure(operation, 'SDK operation returned false'));
};

export const sdkException = (
  operation: string,
  error: unknown,
): SdkFailure =>
  sdkFailure(
    operation,
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : `${operation} threw an unknown error`,
  );

export const isRecordValue = isRecord;
