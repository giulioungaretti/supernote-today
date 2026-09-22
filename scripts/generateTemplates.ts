import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {TEMPLATE_FILES, type TemplateId} from '../src/domain/pageLayout';
import {renderTemplatePng, verifyTemplatePng} from './templatePng';

for (const id of ['nomad', 'manta'] satisfies readonly TemplateId[]) {
  const path = resolve(TEMPLATE_FILES[id].source);
  if (process.argv.includes('--check')) {
    verifyTemplatePng(readFileSync(path), id);
    console.log(`Verified shared layout: ${TEMPLATE_FILES[id].source}`);
  } else {
    writeFileSync(path, renderTemplatePng(id));
    console.log(`Generated: ${TEMPLATE_FILES[id].source}`);
  }
}
