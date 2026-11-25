// Verify references before publishing keys to the reader and printable worksheets.
import {readFile, readdir} from 'node:fs/promises';
const data = new URL('../src/data/',import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, data),'utf8'));
const catalogues = (await readdir(data)).filter(file => /^past-.*\.json$/.test(file));
const papers = new Map((await Promise.all(catalogues.map(read))).flat().map(p => [p.id,p]));
const keys = await read('answer-keys.json');
let total = 0;
for (const [id,record] of Object.entries(keys)) {
  const paper = papers.get(id);
  if (!paper || !record.sourceUrl?.startsWith('https://')) throw new Error('Unknown paper or key source: ' + id);
  const nums = new Set(paper.questions.map(q => String(q.n)));
  const rows = Object.entries(record.answers);
  if (rows.length !== nums.size) throw new Error('Answer count differs from catalogue: ' + id);
  for (const [n, answer] of rows) {
    if (!nums.has(n) || typeof answer !== 'string' || !answer.trim()) throw new Error('Invalid key for '+id+' Q'+n);
    if (paper.exam === 'AIME' && !/^\d{3}(?: \/ \d{3})*$/.test(answer)) throw new Error('Invalid AIME answer for '+id+' Q'+n);
  }
  for (const [n,note] of Object.entries(record.notes || {})) {
    if (!nums.has(n) || !note.en || !note.zh) throw new Error('Invalid scoring note for '+id+' Q'+n);
  }
  for (const [n, value] of Object.entries(record.values || {})) {
    if (!nums.has(n) || typeof value !== 'string' || !value.trim()) throw new Error('Invalid option value for '+id+' Q'+n);
  }
  total += rows.length;
}
for (const filename of await readdir(new URL('commentary/',data))) {
  if (!filename.endsWith('.json')) continue;
  const paperId = filename.slice(0,-5);
  const notes = await read('commentary/'+filename);
  for (const [id, note] of Object.entries(notes)) {
    const n = id.slice(paperId.length+2);
    const key = keys[paperId]?.answers[n];
    if (key && ![note.answer,note.answerZh].every(answer => answer.startsWith(key))) throw new Error('Answer disagrees with key: '+id);
  }
}
console.log('Verified '+total+' answers across '+Object.keys(keys).length+' papers.');
