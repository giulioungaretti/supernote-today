import {readdirSync, readFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import manifest from '../PluginConfig.json';
import {verifyPackageContents} from './packageVerification';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Pass the extracted .snplg directory to verifyPackage.ts.');
}
const root = resolve(directory);
const files = new Map<string, Buffer>();
const collect = (path: string): void => {
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      collect(child);
    } else if (entry.isFile()) {
      files.set(relative(root, child).replace(/\\/g, '/'), readFileSync(child));
    } else {
      throw new Error(`Unexpected package entry: ${child}`);
    }
  }
};
collect(root);
verifyPackageContents(files, manifest);
console.log(
  `Verified v${manifest.versionName}: JS-only package, permissions, identity, bundle and both exact template pixel grids.`,
);
console.log([...files.keys()].join('\n'));
