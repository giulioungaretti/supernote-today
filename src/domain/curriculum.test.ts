import {
  CURRICULUM,
  CURRICULUM_LENGTH,
  lessonAt,
  lessonIndex,
} from './curriculum';

describe('curriculum', () => {
  it('contains a stable 56-lesson multi-week sequence', () => {
    expect(CURRICULUM).toHaveLength(CURRICULUM_LENGTH);
    expect(new Set(CURRICULUM.map(lesson => lesson.id)).size).toBe(
      CURRICULUM_LENGTH,
    );
    expect(CURRICULUM[0]?.phase).toBe('basic-strokes');
    expect(CURRICULUM[55]?.phase).toBe('natural-writing');
  });

  it('covers every lowercase letter', () => {
    const represented = new Set(
      CURRICULUM.filter(lesson => lesson.phase === 'lowercase-families')
        .flatMap(lesson => [...lesson.focusLetters])
        .filter(character => /[a-z]/.test(character)),
    );

    expect([...represented].sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
  });

  it('restarts after natural writing', () => {
    expect(lessonAt(0)).toBe(CURRICULUM[0]);
    expect(lessonAt(55)).toBe(CURRICULUM[55]);
    expect(lessonAt(56)).toBe(CURRICULUM[0]);
    expect(lessonAt(112)).toBe(CURRICULUM[0]);
  });

  it('finds lesson indices and rejects invalid sequences', () => {
    expect(lessonIndex('joins-mixed-rhythm')).toBe(34);
    expect(lessonIndex('missing')).toBe(-1);
    expect(() => lessonAt(-1)).toThrow(
      'Curriculum sequence must be a non-negative safe integer',
    );
  });
});
