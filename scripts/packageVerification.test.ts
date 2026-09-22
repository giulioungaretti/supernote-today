import {readFileSync} from 'node:fs';
import manifest from '../PluginConfig.json';
import {
  TEMPLATE_FILES,
  PAGE_SIZES,
  type TemplateId,
} from '../src/domain/pageLayout';
import {verifyPackageContents} from './packageVerification';
import {
  renderTemplatePng,
  templatePixels,
  verifyTemplatePng,
} from './templatePng';

const packagedManifest = {...manifest, iconPath: '/icon.png'};
const baseline = new Map([
  ['PluginConfig.json', Buffer.from(JSON.stringify(packagedManifest))],
  [
    'SupernoteToday.bundle',
    Buffer.from('today_nomad today_manta '.repeat(100)),
  ],
  ['icon.png', Buffer.from('icon')],
  ['drawable-mdpi/assets_icon.png', Buffer.from('icon')],
  [TEMPLATE_FILES.nomad.packaged, renderTemplatePng('nomad')],
  [TEMPLATE_FILES.manta.packaged, renderTemplatePng('manta')],
]);

test('accepts only a complete JavaScript-only package with both exact layouts', () => {
  expect(() => verifyPackageContents(baseline, manifest)).not.toThrow();
});

test.each(['nomad', 'manta'] satisfies readonly TemplateId[])(
  '%s committed PNG matches the shared model, dimensions and black/white pixels',
  id => {
    const file = readFileSync(TEMPLATE_FILES[id].source);
    expect(() => verifyTemplatePng(file, id)).not.toThrow();
    const pixels = templatePixels(id);
    expect(new Set(pixels)).toEqual(new Set([255, 0]));
    const {width, height} = PAGE_SIZES[id];
    expect(pixels.length).toBe(width * height);
  },
);

test('rejects a missing template rather than shipping a blank page', () => {
  const files = new Map(baseline);
  files.delete(TEMPLATE_FILES.nomad.packaged);
  expect(() => verifyPackageContents(files, manifest)).toThrow('missing');
});

test('rejects corrupt or mismatched PNGs', () => {
  const files = new Map(baseline);
  files.set(TEMPLATE_FILES.nomad.packaged, renderTemplatePng('manta'));
  expect(() => verifyPackageContents(files, manifest)).toThrow('1404x1872');
  files.set(TEMPLATE_FILES.nomad.packaged, Buffer.from('not a PNG'));
  expect(() => verifyPackageContents(files, manifest)).toThrow('PNG signature');
});

test.each([
  {...packagedManifest, nativeCodePackage: 'app.npk'},
  {...packagedManifest, reactPackages: []},
  {...packagedManifest, versionName: '0.1.1'},
  {
    ...packagedManifest,
    'uses-permissions': [
      ...manifest['uses-permissions'],
      'plugin.permission.INTERNET',
    ],
  },
])('rejects native, stale and over-permissioned manifests', config => {
  const files = new Map(baseline);
  files.set('PluginConfig.json', Buffer.from(JSON.stringify(config)));
  expect(() => verifyPackageContents(files, manifest)).toThrow();
});

test.each(['app.npk', 'hidden/plugin.apk', 'lib/arm64/test.so'])(
  'rejects a native payload at any path: %s',
  path => {
    const files = new Map(baseline);
    files.set(path, Buffer.from('native'));
    expect(() => verifyPackageContents(files, manifest)).toThrow(
      'native payload',
    );
  },
);
