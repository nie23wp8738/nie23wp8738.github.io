// Cache the author's CC0 annual books locally. Every input is pinned and verified.
// The manifest identifies the exact pages for each language and question.
import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdir, readFile, rename, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
const run = promisify(execFile);
const manifest = JSON.parse(await readFile(new URL('../src/data/step-published-solutions.json',import.meta.url),'utf8'));
const dest = new URL('../public/step-solutions/',import.meta.url);
await mkdir(dest,{recursive:true});
function verify(bytes, entry) {
  if (bytes.length !== entry.size || !bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) return false;
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') === entry.sha;
}
const jobs = Object.entries(manifest.books).flatMap(([year, langs]) =>
  Object.entries(langs).map(([lang, entry]) => ({year, lang, entry})));
async function cache({year,lang,entry}) {
  const local = fileURLToPath(new URL(year+'-'+lang+'.pdf',dest));
  const existing = await readFile(local).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && verify(existing,entry)) return;
  const temp = local + '.' + randomUUID() + '.tmp';
  const prefix = lang === 'en' ? '' : 'zh-hans/';
  const upstream = 'https://raw.githubusercontent.com/keithmcnulty/step_book_mcnulty/' + manifest.revision +
    '/docs/' + prefix + 'pdf/solutions/beyond-step-worked-solutions-' + year + '.pdf';
  try {
    await run('curl',['--fail','--location','--silent','--show-error','--retry','2','--max-time','90',
      '--output',temp,upstream]);
    if (!verify(await readFile(temp),entry)) throw new Error('Invalid upstream PDF for '+year+' '+lang);
    await rename(temp,local);
  } finally {
    await rm(temp,{force:true});
  }
}
const remaining = jobs.values();
await Promise.all(Array.from({length:4},async () => {
  for (const job of remaining) await cache(job);
}));
console.log('Verified '+jobs.length+' local STEP solution books for '+Object.keys(manifest.questions).length+' questions.');
