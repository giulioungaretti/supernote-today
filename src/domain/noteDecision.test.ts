import {decideExistingNote} from './noteDecision';

test.each([[0], [0, 0]])(
  'repairs only completely empty one/two-page notes: %j',
  (...elementCounts: number[]) => {
    expect(
      decideExistingNote({pageCount: elementCounts.length, elementCounts}),
    ).toEqual({ok: true, value: 'repair-empty'});
  },
);

test.each([[1], [0, 1], [1, 0], [4, 0], [0, 150]])(
  'preserves every note containing any element: %j',
  (...elementCounts: number[]) => {
    expect(
      decideExistingNote({pageCount: elementCounts.length, elementCounts}),
    ).toEqual({ok: true, value: 'open-existing'});
  },
);

test('leaves more than two pages untouched, even if empty', () => {
  expect(decideExistingNote({pageCount: 3, elementCounts: []})).toEqual({
    ok: true,
    value: 'open-existing',
  });
});

test.each([
  {pageCount: 0, elementCounts: []},
  {pageCount: 2, elementCounts: [0]},
  {pageCount: 2, elementCounts: [0, -1]},
  {pageCount: 1, elementCounts: [NaN]},
  {pageCount: 1, elementCounts: [0.5]},
])('does not treat invalid/incomplete inspections as empty: %j', inspection => {
  expect(decideExistingNote(inspection).ok).toBe(false);
});
