export type Result<Value, Failure> =
  | Readonly<{ok: true; value: Value}>
  | Readonly<{ok: false; error: Failure}>;

export const ok = <Value>(value: Value): Result<Value, never> => ({
  ok: true,
  value,
});

export const err = <Failure>(error: Failure): Result<never, Failure> => ({
  ok: false,
  error,
});

export const mapResult = <Value, Next, Failure>(
  result: Result<Value, Failure>,
  map: (value: Value) => Next,
): Result<Next, Failure> => (result.ok ? ok(map(result.value)) : result);

export const flatMapResult = <Value, Next, Failure, NextFailure>(
  result: Result<Value, Failure>,
  map: (value: Value) => Result<Next, NextFailure>,
): Result<Next, Failure | NextFailure> =>
  result.ok ? map(result.value) : result;
