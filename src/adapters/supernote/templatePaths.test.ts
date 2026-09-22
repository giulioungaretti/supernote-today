import {localImagePath, templatePathCandidates} from './templatePaths';

test('uses only local asset paths and the actual packaged installation-relative path', () => {
  expect(
    templatePathCandidates(
      'file:///data/plugin/drawable-mdpi/assets_today_nomad.png',
      '/data/plugin',
      'drawable-mdpi/assets_today_nomad.png',
    ),
  ).toEqual(['/data/plugin/drawable-mdpi/assets_today_nomad.png']);
});

test('falls back from a Metro resource identifier to the installation directory', () => {
  expect(
    templatePathCandidates(
      'assets_today_nomad',
      '/data/plugin/',
      'drawable-mdpi/assets_today_nomad.png',
    ),
  ).toEqual(['/data/plugin/drawable-mdpi/assets_today_nomad.png']);
});

test('does not accept a remote development-server URL or guess a storage path', () => {
  expect(
    templatePathCandidates(
      'http://localhost:8081/template.png',
      null,
      'drawable-mdpi/assets_today_nomad.png',
    ),
  ).toEqual([]);
  expect(localImagePath('file:///data/%zz.png')).toBeNull();
  expect(localImagePath('file:///data/my%20plugin/page.png')).toBe(
    '/data/my plugin/page.png',
  );
});
