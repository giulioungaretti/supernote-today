export const CURRICULUM_LENGTH = 56;

export type CurriculumPhase =
  | 'basic-strokes'
  | 'lowercase-families'
  | 'joins'
  | 'words'
  | 'sentences'
  | 'natural-writing';

export interface CursiveLesson {
  readonly id: string;
  readonly phase: CurriculumPhase;
  readonly title: string;
  readonly instruction: string;
  readonly sample: string;
  readonly focusLetters: string;
}

const lesson = (
  id: string,
  phase: CurriculumPhase,
  title: string,
  instruction: string,
  sample: string,
  focusLetters = '',
): CursiveLesson => ({
  id,
  phase,
  title,
  instruction,
  sample,
  focusLetters,
});

export const CURRICULUM: readonly CursiveLesson[] = [
  lesson(
    'strokes-entry-exit',
    'basic-strokes',
    'Entry and exit strokes',
    'Keep each light stroke smooth and evenly spaced.',
    '////  ////  ////',
  ),
  lesson(
    'strokes-underturn',
    'basic-strokes',
    'Underturns',
    'Glide down, turn softly, and rise without stopping.',
    'uuuu  uuuu  uuuu',
  ),
  lesson(
    'strokes-overturn',
    'basic-strokes',
    'Overturns',
    'Rise lightly, curve over, and descend with steady rhythm.',
    'nnnn  nnnn  nnnn',
  ),
  lesson(
    'strokes-compound',
    'basic-strokes',
    'Compound curves',
    'Join an overturn to an underturn without a corner.',
    'unun  unun  unun',
  ),
  lesson(
    'strokes-ovals',
    'basic-strokes',
    'Counter-clockwise ovals',
    'Close each oval at the upper right with even pressure.',
    'oooo  oooo  oooo',
  ),
  lesson(
    'strokes-ascenders',
    'basic-strokes',
    'Ascender loops',
    'Make tall narrow loops that return cleanly to the baseline.',
    'llll  llll  llll',
  ),
  lesson(
    'strokes-descenders',
    'basic-strokes',
    'Descender loops and rhythm',
    'Keep loops narrow and repeat the movement at a calm pace.',
    'jjyy  ggqq  jjyy',
  ),
  lesson(
    'lower-i-u-w',
    'lowercase-families',
    'Underturn family: i, u, w',
    'Keep each underturn the same width and height.',
    'i u w   ui wi uw',
    'iuw',
  ),
  lesson(
    'lower-t-j',
    'lowercase-families',
    'Underturn family: t, j',
    'Keep t tall and let j descend in one relaxed loop.',
    't j   it jut taj',
    'tj',
  ),
  lesson(
    'lower-l-e',
    'lowercase-families',
    'Loop family: l, e',
    'Use narrow loops and keep e open.',
    'l e   le el eel',
    'le',
  ),
  lesson(
    'lower-b-h',
    'lowercase-families',
    'Loop family: b, h',
    'Match the ascender height and keep humps rounded.',
    'b h   bh hub ebb',
    'bh',
  ),
  lesson(
    'lower-k-f',
    'lowercase-families',
    'Loop family: k, f',
    'Keep k compact and let f cross the baseline smoothly.',
    'k f   kef fit folk',
    'kf',
  ),
  lesson(
    'lower-c-o',
    'lowercase-families',
    'Oval family: c, o',
    'Begin at the upper right and keep both forms open and round.',
    'c o   co oc cocoa',
    'co',
  ),
  lesson(
    'lower-a-d',
    'lowercase-families',
    'Oval family: a, d',
    'Close the oval before adding the final stem.',
    'a d   ad dad add',
    'ad',
  ),
  lesson(
    'lower-g-q',
    'lowercase-families',
    'Oval family: g, q',
    'Close the oval, then descend with a narrow loop or tail.',
    'g q   go quiet gag',
    'gq',
  ),
  lesson(
    'lower-n-m',
    'lowercase-families',
    'Hump family: n, m',
    'Keep every overturn the same height and spacing.',
    'n m   minimum name',
    'nm',
  ),
  lesson(
    'lower-r-p',
    'lowercase-families',
    'Hump family: r, p',
    'Make r compact and let p descend without twisting.',
    'r p   paper proper',
    'rp',
  ),
  lesson(
    'lower-s',
    'lowercase-families',
    'Compact s',
    'Keep the upper curve small and finish with a clear exit.',
    's s   sea says soft',
    's',
  ),
  lesson(
    'lower-v',
    'lowercase-families',
    'Pointed v',
    'Make a soft point at the baseline and a clean exit stroke.',
    'v v   vivid velvet',
    'v',
  ),
  lesson(
    'lower-x',
    'lowercase-families',
    'Crossed x',
    'Write the first curve continuously, then add a light cross.',
    'x x   extra index',
    'x',
  ),
  lesson(
    'lower-y',
    'lowercase-families',
    'Descending y',
    'Keep the first underturn simple and the loop narrow.',
    'y y   yearly yellow',
    'y',
  ),
  lesson(
    'lower-z',
    'lowercase-families',
    'Cursive z',
    'Keep the top compact and let the lower loop flow forward.',
    'z z   lazy breeze',
    'z',
  ),
  lesson(
    'lower-underturn-review',
    'lowercase-families',
    'Underturn family review',
    'Repeat the family without lifting between letters.',
    'it jut wit twin',
    'itju',
  ),
  lesson(
    'lower-loop-review',
    'lowercase-families',
    'Loop family review',
    'Match ascender height while keeping the baseline steady.',
    'hello life belief',
    'lbhkf',
  ),
  lesson(
    'lower-oval-review',
    'lowercase-families',
    'Oval family review',
    'Close every oval before continuing into the next stroke.',
    'good cocoa radio',
    'coad',
  ),
  lesson(
    'lower-descender-review',
    'lowercase-families',
    'Descender family review',
    'Keep every descender narrow and return smoothly.',
    'joggy quiet joy',
    'gqyj',
  ),
  lesson(
    'lower-hump-review',
    'lowercase-families',
    'Hump family review',
    'Use consistent arches and avoid retracing.',
    'minimum proper',
    'nmrp',
  ),
  lesson(
    'lower-angular-review',
    'lowercase-families',
    'Final lowercase review',
    'Keep pointed and compact forms flowing at one slant.',
    'swift lazy vex',
    'svwxyz',
  ),
  lesson(
    'joins-light-to-underturn',
    'joins',
    'Light joins into underturns',
    'Keep the connecting stroke low and relaxed.',
    'ai ei li ti ui',
  ),
  lesson(
    'joins-underturn-to-oval',
    'joins',
    'Underturns into ovals',
    'Approach each oval at its upper-right entry point.',
    'ua wo io va',
  ),
  lesson(
    'joins-oval-to-hump',
    'joins',
    'Ovals into humps',
    'Close the oval before rising into the next arch.',
    'an on om ar',
  ),
  lesson(
    'joins-ascenders',
    'joins',
    'Ascender joins',
    'Keep tall loops narrow and preserve the word rhythm.',
    'bl cl fl hl',
  ),
  lesson(
    'joins-descenders',
    'joins',
    'Descender joins',
    'Return from each loop directly into the next letter.',
    'gy jy py qu',
  ),
  lesson(
    'joins-difficult-pairs',
    'joins',
    'Difficult pairs',
    'Slow down only at the transition, not through the whole word.',
    'br os rv ve',
  ),
  lesson(
    'joins-mixed-rhythm',
    'joins',
    'Mixed joining rhythm',
    'Write each chain in one continuous, even movement.',
    'minimum oval rhythm',
  ),
  lesson(
    'words-calm',
    'words',
    'Short even words',
    'Keep letter size consistent from start to finish.',
    'calm  note  today',
  ),
  lesson(
    'words-loops',
    'words',
    'Loop-rich words',
    'Match ascenders and keep counters open.',
    'hello  belief  coffee',
  ),
  lesson(
    'words-ovals',
    'words',
    'Oval-rich words',
    'Close each oval cleanly without pausing.',
    'radio  cocoa  good',
  ),
  lesson(
    'words-humps',
    'words',
    'Hump-rich words',
    'Keep arches even and avoid cramped spacing.',
    'minimum  morning',
  ),
  lesson(
    'words-descenders',
    'words',
    'Descender-rich words',
    'Let loops descend fully while the baseline remains steady.',
    'joyful  quickly  giddy',
  ),
  lesson(
    'words-spacing',
    'words',
    'Word spacing',
    'Leave one small letter-width between words.',
    'quiet mind  clear page',
  ),
  lesson(
    'words-fluency',
    'words',
    'Fluent word groups',
    'Write the phrase twice without sacrificing legibility.',
    'steady rhythm grows',
  ),
  lesson(
    'sentence-morning',
    'sentences',
    'Sentence rhythm',
    'Keep a steady baseline through the full sentence.',
    'A quiet morning begins with one clear line.',
  ),
  lesson(
    'sentence-patience',
    'sentences',
    'Relaxed spacing',
    'Pause between words, not between letters.',
    'Patient practice makes movement feel natural.',
  ),
  lesson(
    'sentence-slant',
    'sentences',
    'Consistent slant',
    'Let every tall stroke lean at the same gentle angle.',
    'Light loops lean together across the page.',
  ),
  lesson(
    'sentence-size',
    'sentences',
    'Consistent size',
    'Keep small letters low and ascenders clearly taller.',
    'Small letters stay even while tall letters rise.',
  ),
  lesson(
    'sentence-speed',
    'sentences',
    'Controlled speed',
    'Increase speed only while every word stays readable.',
    'Smooth writing is calm, clear, and continuous.',
  ),
  lesson(
    'sentence-pressure',
    'sentences',
    'Light pressure',
    'Relax your grip and let the pen glide.',
    'A lighter touch keeps each curve open and easy.',
  ),
  lesson(
    'sentence-flow',
    'sentences',
    'Natural sentence flow',
    'Write once slowly, then once at a comfortable pace.',
    'Today I will write with purpose and ease.',
  ),
  lesson(
    'natural-intention',
    'natural-writing',
    'Set an intention',
    'Write three connected lines about your intention for today.',
    'Today I intend to...',
  ),
  lesson(
    'natural-observation',
    'natural-writing',
    'Notice a detail',
    'Describe one small detail you noticed this morning.',
    'This morning I noticed...',
  ),
  lesson(
    'natural-gratitude',
    'natural-writing',
    'Write gratitude',
    'Write three specific things you appreciate.',
    'I am grateful for...',
  ),
  lesson(
    'natural-reflection',
    'natural-writing',
    'Reflect on progress',
    'Describe one thing that is becoming easier.',
    'I can see progress in...',
  ),
  lesson(
    'natural-description',
    'natural-writing',
    'Describe a place',
    'Write four flowing lines about a familiar place.',
    'A place I know well...',
  ),
  lesson(
    'natural-story',
    'natural-writing',
    'Tell a small story',
    'Write a brief beginning, middle, and ending.',
    'A small moment worth remembering...',
  ),
  lesson(
    'natural-freewrite',
    'natural-writing',
    'Natural free writing',
    'Write continuously for ten minutes without correcting.',
    'Begin anywhere and keep the pen moving.',
  ),
] as const;

if (CURRICULUM.length !== CURRICULUM_LENGTH) {
  throw new Error(
    `Curriculum length must be ${CURRICULUM_LENGTH}, received ${CURRICULUM.length}`,
  );
}

export const lessonAt = (sequence: number): CursiveLesson => {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error('Curriculum sequence must be a non-negative safe integer');
  }

  const selected = CURRICULUM[sequence % CURRICULUM_LENGTH];
  if (selected === undefined) {
    throw new Error('Curriculum selection failed');
  }

  return selected;
};

export const lessonIndex = (lessonId: string): number =>
  CURRICULUM.findIndex(candidate => candidate.id === lessonId);
