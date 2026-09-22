import {TEMPLATE_FILES, type TemplateId} from '../src/domain/pageLayout';
import {verifyTemplatePng} from './templatePng';

export interface PackageIdentity {
  readonly versionName: string;
  readonly versionCode: string;
  readonly pluginID: string;
}

export const verifyPackageContents = (
  files: ReadonlyMap<string, Buffer>,
  identity: PackageIdentity,
): void => {
  const required = [
    'PluginConfig.json',
    'SupernoteToday.bundle',
    'icon.png',
    'drawable-mdpi/assets_icon.png',
    TEMPLATE_FILES.nomad.packaged,
    TEMPLATE_FILES.manta.packaged,
  ];
  for (const path of required) {
    if (!files.get(path)?.length) {
      throw new Error(`Package is missing ${path}`);
    }
  }
  for (const path of files.keys()) {
    if (/\.(apk|npk|dex|so|class)$/i.test(path)) {
      throw new Error(
        `TypeScript-only package contains native payload: ${path}`,
      );
    }
  }
  const configBytes = files.get('PluginConfig.json');
  if (!configBytes) {
    throw new Error('Package config is missing');
  }
  const config: unknown = JSON.parse(
    configBytes.toString('utf8').replace(/^\uFEFF/, ''),
  );
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('Package config must be an object');
  }
  if ('nativeCodePackage' in config || 'reactPackages' in config) {
    throw new Error('Package declares native code');
  }
  if (
    !('pluginKey' in config) ||
    config.pluginKey !== 'SupernoteToday' ||
    !('jsMainPath' in config) ||
    config.jsMainPath !== 'index' ||
    !('iconPath' in config) ||
    config.iconPath !== '/icon.png'
  ) {
    throw new Error(
      'Plugin entry point or asset paths do not match the official package',
    );
  }
  if (
    !('versionName' in config) ||
    config.versionName !== identity.versionName ||
    !('versionCode' in config) ||
    config.versionCode !== identity.versionCode ||
    !('pluginID' in config) ||
    config.pluginID !== identity.pluginID
  ) {
    throw new Error(
      'Packaged version/identity does not match the source manifest',
    );
  }
  if (
    !('uses-permissions' in config) ||
    !Array.isArray(config['uses-permissions']) ||
    JSON.stringify([...config['uses-permissions']].sort()) !==
      JSON.stringify([
        'plugin.permission.FILE:READ',
        'plugin.permission.FILE:WRITE',
      ])
  ) {
    throw new Error('Package must declare only FILE:READ and FILE:WRITE');
  }
  const bundle = files.get('SupernoteToday.bundle')?.toString('utf8') ?? '';
  if (
    bundle.length < 1000 ||
    !bundle.includes('today_nomad') ||
    !bundle.includes('today_manta')
  ) {
    throw new Error(
      'JavaScript bundle does not reference both bundled templates',
    );
  }
  for (const id of ['nomad', 'manta'] satisfies readonly TemplateId[]) {
    const png = files.get(TEMPLATE_FILES[id].packaged);
    if (!png) {
      throw new Error(`Missing ${id} template`);
    }
    verifyTemplatePng(png, id);
  }
};
