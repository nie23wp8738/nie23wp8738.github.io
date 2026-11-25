import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { printableSolutions } from './solution-edition.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const {values:{edition:id, chromium}} = parseArgs({options:{edition:{type:'string'}, chromium:{type:'string'}}});
if (!id || !/^[a-z\d-]+$/.test(id)) throw new Error('Supply a paper ID with --edition.');
const readJSON = async name => JSON.parse(await fs.readFile(path.join(root, 'src/data', name), 'utf8'));
const [answers, edition, names] = await Promise.all([
  readJSON('answers/' + id + '.json'), readJSON('editions/' + id + '.json'), fs.readdir(path.join(root, 'src/data')),
]);
const papers = (await Promise.all(names.filter(n => /^past-.*\.json$/.test(n)).map(readJSON))).flat();
const paper = papers.find(p => p.id === id);
if (!paper) throw new Error('Unknown catalogue paper: ' + id);
const {title, source} = printableSolutions(edition, paper, answers);
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'math-solutions-'));
try {
  const file = path.join(scratch, 'solutions.json');
  await fs.writeFile(file, JSON.stringify(source));
  const args = [path.join(root, 'scripts/typeset-questions.mjs'), '--questions', file,
    '--title', title, '--output', path.join(root, 'public/solution-pdf'),
    '--figures', path.join(root, 'public/inline-figures')];
  if (chromium) args.push('--chromium', chromium);
  const built = spawnSync(process.execPath, args, {stdio:'inherit'});
  if (built.error) throw built.error;
  if (built.status !== 0) throw new Error('Could not build solutions for ' + id);
} finally {
  await fs.rm(scratch, {recursive:true, force:true});
}
