import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function fileDigest(file) {
  const bytes = await readFile(file);
  return createHash('sha256').update(bytes).digest('hex');
}
