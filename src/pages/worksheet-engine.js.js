import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const prerender = true;

export async function GET() {
  const [bundle, licence] = await Promise.all([
    readFile(require.resolve('pdf-lib/dist/pdf-lib.esm.min.js'), 'utf8'),
    readFile(require.resolve('pdf-lib/LICENSE.md'), 'utf8'),
  ]);
  const code = bundle.replace(/\/\/# sourceMappingURL=[^\n]+/, '');
  return new Response('/*\n' + licence + '\n*/\n' + code, {
    headers: {'Content-Type': 'text/javascript; charset=utf-8'},
  });
}
