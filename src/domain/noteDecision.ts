import {err, ok, type Result} from './result';

export interface NoteInspection {
  readonly pageCount: number;
  readonly elementCounts: readonly number[];
}

export type ExistingNoteDecision = 'open-existing' | 'repair-empty';

export const decideExistingNote = (
  inspection: NoteInspection,
): Result<ExistingNoteDecision, string> => {
  const {pageCount, elementCounts} = inspection;
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return err('The note has an invalid page count. It was not changed.');
  }
  if (pageCount > 2) {
    return ok('open-existing');
  }
  if (
    elementCounts.length !== pageCount ||
    elementCounts.some(count => !Number.isInteger(count) || count < 0)
  ) {
    return err(
      'Every page must be inspected before a blank note can be repaired.',
    );
  }
  return ok(
    elementCounts.every(count => count === 0)
      ? 'repair-empty'
      : 'open-existing',
  );
};
