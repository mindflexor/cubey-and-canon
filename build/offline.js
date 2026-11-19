import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Materials are generated in-game. Only the water normal and audio files are loaded from public.
async function gameFiles(directory, relative = '') {
  const files = [];
  for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isDirectory()) {
      if (relative || ['assets', 'audio', 'textures'].includes(name)) files.push(...await gameFiles(directory, name + '/'));
    } else if (/\.(html|js|css|png|jpg|wav|ogg|webmanifest)$/.test(name) && name !== 'sw.js') files.push(name);
  }
  return files;
}

export function offlineGame() {
  return {
    name: 'offline-game',
    apply: 'build',
    async writeBundle({ dir }) {
      const files = (await gameFiles(dir)).sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(await readFile(join(dir, file)));
      const worker = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
      const version = hash.update(worker).digest('hex').slice(0, 16);
      await writeFile(join(dir, 'sw.js'), worker
        .replace('__BUILD_ID__', version)
        .replace('/* __FILES__ */ []', JSON.stringify(files)));
    },
  };
}
