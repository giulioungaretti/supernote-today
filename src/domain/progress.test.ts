import {CURRICULUM, lessonAt} from './curriculum';
import {parseLocalDate} from './localDate';
import {PAGE_COMPONENT_IDS} from './pageLayout';
import {
  DEFAULT_JOURNAL_ROOT,
  completeAssignment,
  defaultState,
  notePathForDate,
  parseStateJson,
  reopenAssignment,
  reserveAssignment,
  resetPractice,
  serializeState,
  startPracticeAt,
  updateJournalRoot,
} from './progress';

const date = (() => {
  const parsed = parseLocalDate('2026-09-21');
  if (!parsed.ok) {
    throw new Error('Test date is invalid');
  }
  return parsed.value;
})();

describe('progress', () => {
  it('reserves once and advances only after completion', () => {
    const initial = defaultState();
    const notePath = `${DEFAULT_JOURNAL_ROOT}/${date}.note`;
    const reserved = reserveAssignment({
      state: initial,
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: '2026-09-21T08:00:00.000Z',
    });

    expect(reserved.created).toBe(true);
    expect(reserved.assignment.exerciseId).toBe(lessonAt(0).id);
    expect(reserved.state.nextSequence).toBe(0);

    const repeated = reserveAssignment({
      state: reserved.state,
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: '2026-09-21T09:00:00.000Z',
    });
    expect(repeated.created).toBe(false);
    expect(repeated.state).toBe(reserved.state);

    const completed = completeAssignment(
      reserved.state,
      date,
      '2026-09-21T08:05:00.000Z',
    );
    expect(completed.nextSequence).toBe(1);
    expect(completed.assignments[date]?.status).toBe('complete');

    expect(
      completeAssignment(completed, date, '2026-09-21T09:00:00.000Z'),
    ).toBe(completed);
  });

  it('reopens a deleted completed assignment without rewinding progress', () => {
    const notePath = `${DEFAULT_JOURNAL_ROOT}/${date}.note`;
    const pending = reserveAssignment({
      state: defaultState(),
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: '2026-09-21T08:00:00.000Z',
    }).state;
    const completed = completeAssignment(
      pending,
      date,
      '2026-09-21T08:05:00.000Z',
    );
    const reopened = reopenAssignment(completed, date);

    expect(reopened.nextSequence).toBe(1);
    expect(reopened.assignments[date]?.status).toBe('pending');
  });

  it('supports future reset and explicit starting lessons', () => {
    const advanced = {...defaultState(), nextSequence: 42};
    expect(resetPractice(advanced).nextSequence).toBe(0);

    const selected = startPracticeAt(advanced, 'joins-mixed-rhythm');
    expect(selected.ok).toBe(true);
    if (selected.ok) {
      expect(selected.value.nextSequence).toBe(34);
    }
    expect(startPracticeAt(advanced, 'missing').ok).toBe(false);
  });

  it('normalizes and validates journal roots and dated paths', () => {
    const updated = updateJournalRoot(
      defaultState(),
      '\\storage\\emulated\\0\\Note\\Journal\\',
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.value.settings.journalRoot).toBe(
      '/storage/emulated/0/Note/Journal',
    );
    expect(notePathForDate(updated.value.settings.journalRoot, date)).toEqual({
      ok: true,
      value: '/storage/emulated/0/Note/Journal/2026-09-21.note',
    });
    expect(updateJournalRoot(defaultState(), '/storage/emulated/0/Document').ok)
      .toBe(false);
    expect(updateJournalRoot(defaultState(), '/storage/emulated/0/Notebook').ok)
      .toBe(false);
  });

  it('round-trips valid state and rejects corrupted state', () => {
    const notePath = `${DEFAULT_JOURNAL_ROOT}/${date}.note`;
    const reserved = reserveAssignment({
      state: defaultState(),
      date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: '2026-09-21T08:00:00.000Z',
    }).state;
    const completed = completeAssignment(
      reserved,
      date,
      '2026-09-21T08:05:00.000Z',
    );

    expect(parseStateJson(serializeState(completed))).toEqual({
      ok: true,
      value: completed,
    });
    expect(parseStateJson('{')).toEqual({
      ok: false,
      error: expect.objectContaining({kind: 'invalid-state'}),
    });
    expect(
      parseStateJson(
        JSON.stringify({...completed, schemaVersion: 999}),
      ).ok,
    ).toBe(false);
  });

  it('cycles the curriculum after the final lesson', () => {
    const end = {...defaultState(), nextSequence: CURRICULUM.length};
    const reservation = reserveAssignment({
      state: end,
      date,
      notePath: `${DEFAULT_JOURNAL_ROOT}/${date}.note`,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: '2026-09-21T08:00:00.000Z',
    });

    expect(reservation.assignment.exerciseId).toBe(CURRICULUM[0]?.id);
  });
});
