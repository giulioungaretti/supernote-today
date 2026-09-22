import './style.css';
import nomadTemplate from '../assets/today_nomad.png?url';
import mantaTemplate from '../assets/today_manta.png?url';
import {CURRICULUM_LENGTH} from '../src/domain/curriculum';
import {describeDate, parseLocalDate} from '../src/domain/localDate';
import {TEMPLATE_FILES, type TemplateId} from '../src/domain/pageLayout';
import {previewPage} from './model';

const select = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Preview element missing: ${selector}`);
  }
  return element;
};
const dateInput = select<HTMLInputElement>('#date');
const deviceInput = select<HTMLSelectElement>('#device');
const flowInput = select<HTMLSelectElement>('#flow');
const screen = select<HTMLElement>('#screen');
const page = select<SVGSVGElement>('#page');
const errorScreen = select<HTMLElement>('#error');
const status = select<HTMLElement>('#status');
const templateLink = select<HTMLAnchorElement>('#template-link');
const svgNamespace = 'http://www.w3.org/2000/svg';

let date = new Date();
let lessonOffset = 0;
let device: TemplateId = 'nomad';
let openingTimer: ReturnType<typeof setTimeout> | undefined;

const scenarios: Readonly<
  Record<string, Readonly<{step: string; message: string}>>
> = {
  permission: {
    step: 'Permission read',
    message:
      'File access was not granted. Open plugin settings and allow file access.',
  },
  template: {
    step: 'Template',
    message:
      'Bundled PNG not found. Reinstall the complete v0.2 .snplg. No note was changed.',
  },
  text: {
    step: 'Verify text',
    message:
      'Text insertion was incomplete: expected 4 elements, found 0. No old pages were removed. Do not delete a note containing handwriting.',
  },
  open: {
    step: 'Open note',
    message:
      'Supernote did not open the dated note. Check file access and unlock the journal folder, then retry.',
  },
};

const render = (): void => {
  clearTimeout(openingTimer);
  const model = previewPage(date, lessonOffset, device);
  const {width, height} = model.layout.pageSize;
  const template = device === 'nomad' ? nomadTemplate : mantaTemplate;
  dateInput.value = model.descriptor.date;
  select('#lesson').textContent = `${
    model.index + 1
  } / ${CURRICULUM_LENGTH} - ${
    model.lesson.title
  } (${model.lesson.phase.replace(/-/g, ' ')})`;
  select('#filename').textContent = `/Note/Today/${model.descriptor.date}.note`;
  templateLink.href = template;
  templateLink.textContent = `Bundled PNG: ${TEMPLATE_FILES[device].source}`;
  page.setAttribute('viewBox', `0 0 ${width} ${height}`);
  page.replaceChildren();
  const image = document.createElementNS(svgNamespace, 'image');
  image.setAttribute('href', template);
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  page.append(image);
  for (const text of model.layout.texts) {
    const element = document.createElementNS(svgNamespace, 'text');
    element.setAttribute('x', String(text.rect.left));
    element.setAttribute('y', String(text.rect.top + text.fontSize));
    element.setAttribute('font-size', String(text.fontSize));
    element.setAttribute('font-weight', text.bold ? '700' : '400');
    element.setAttribute('font-family', 'Arial, sans-serif');
    element.textContent = text.text;
    page.append(element);
  }

  const scenario = scenarios[flowInput.value];
  errorScreen.hidden = !scenario;
  if (scenario) {
    screen.dataset.state = 'error';
    select('#error-step').textContent = scenario.step;
    select('#error-message').textContent = scenario.message;
    status.textContent =
      'Error illustration: the plugin explicitly shows its actionable error screen.';
  } else if (flowInput.value === 'opening') {
    screen.dataset.state = 'opening';
    status.textContent =
      'Opening in background: ensure dated file, use PNG, insert and verify text, close once, open native note. No full-screen intermediary.';
  } else {
    screen.dataset.state = 'page';
    status.textContent =
      'Native page illustration. Existing notes open unchanged; no duplicate pages or text.';
  }
};

const shiftDay = (delta: number): void => {
  date = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + delta,
    12,
  );
  lessonOffset = 0;
  render();
};
select('#previous-day').addEventListener('click', () => shiftDay(-1));
select('#next-day').addEventListener('click', () => shiftDay(1));
select('#previous-lesson').addEventListener('click', () => {
  lessonOffset -= 1;
  render();
});
select('#next-lesson').addEventListener('click', () => {
  lessonOffset += 1;
  render();
});
select('#scheduled-lesson').addEventListener('click', () => {
  lessonOffset = 0;
  render();
});
dateInput.addEventListener('change', () => {
  const parsed = parseLocalDate(dateInput.value);
  if (!parsed.ok) {
    status.textContent = 'Choose a complete, valid calendar date.';
    return;
  }
  date = new Date(`${parsed.value}T12:00:00`);
  lessonOffset = 0;
  render();
});
deviceInput.addEventListener('change', () => {
  if (deviceInput.value !== 'nomad' && deviceInput.value !== 'manta') {
    throw new Error('Unsupported preview device.');
  }
  device = deviceInput.value;
  render();
});
flowInput.addEventListener('change', render);
const simulateToday = (): void => {
  flowInput.value = 'opening';
  render();
  openingTimer = setTimeout(() => {
    flowInput.value = 'page';
    render();
  }, 750);
};
select('#open-today').addEventListener('click', simulateToday);
select('#retry').addEventListener('click', simulateToday);
select('#close').addEventListener('click', () => {
  flowInput.value = 'page';
  render();
});
select('#settings').addEventListener('click', () => {
  status.textContent = `Status illustration: /Note/Today, ${
    describeDate(date).date
  }, ${device}. No saved settings or progress backend.`;
});
render();
