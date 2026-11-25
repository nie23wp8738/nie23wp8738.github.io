// Print the site's own outlines and worked methods for annotated exam questions.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const site = fileURLToPath(new URL('../', import.meta.url));
const commentary = path.join(site, 'src/data/commentary');
const output = path.join(site, 'public/commentary-pdf');
const generator = path.join(site, 'scripts/typeset-questions.mjs');
const tools = [await fs.readFile(generator), await fs.readFile(fileURLToPath(import.meta.url))];
const exe = [process.env.CHROME_BIN,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>file && existsSync(file));
const catalogues = (await fs.readdir(path.join(site,'src/data'))).filter(name=>/^past-.*\.json$/.test(name));
const papers = new Map();
for (const file of catalogues) {
  const rows = JSON.parse(await fs.readFile(path.join(site,'src/data',file),'utf8'));
  for (const row of rows) papers.set(row.id,row);
}
const scratch = await fs.mkdtemp(path.join(os.tmpdir(),'question-notes-'));
try {
  for (const filename of await fs.readdir(commentary)) {
    if (!filename.endsWith('.json')) continue;
    const paperId = path.basename(filename,'.json');
    const paper = papers.get(paperId);
    if (!paper) throw new Error('Unknown commentary paper ' + paperId);
    const json = await fs.readFile(path.join(commentary,filename),'utf8');
    const notes = Object.entries(JSON.parse(json));
    const signature = createHash('sha256').update(json).update(paper.label);
    for (const code of tools) signature.update(code);
    const figures = path.join(site,'public/commentary-figures');
    for (const [id,note] of notes) if (note.figure) {
      if (note.figure.url !== '/commentary-figures/'+id+'.svg' || !note.figure.alt || !note.figure.altZh) throw new Error('Invalid figure '+id);
      signature.update(await fs.readFile(path.join(figures,id+'.svg')));
    }
    const stamp = path.join(output,paperId+'.sha256');
    const digest = signature.digest('hex');
    if (await fs.readFile(stamp,'utf8').catch(()=>null) === digest &&
       notes.every(([id])=>['questions','solutions'].every(kind=>existsSync(path.join(output,kind,id+'.pdf'))))) continue;
    for (const kind of ['questions','solutions']) {
      const rows = notes.map(([id, note]) => {
        const n = Number(id.slice(paperId.length+2));
        if (id !== paperId+'-q'+n || !paper.questions.some(q=>q.n === n) || !note.summary || !note.summaryZh) {
          throw new Error('Invalid commentary outline for ' + id);
        }
        const parts = [];
        if (kind === 'solutions') {
          parts.push({label:'Answer', text:note.answer});
          for (const [i, method] of note.methods.entries()) {
            parts.push({label:'Method '+(i+1),text:[method.title,'Topics: '+method.topics.map(t=>t.en).join(', '),method.steps[0]].join('\n\n')});
            for (const step of method.steps.slice(1)) parts.push({text:step});
          }
        }
        return {id, intro:note.summary, introFigure:note.figure ? id : undefined, parts};
      });
      const input = path.join(scratch,kind+'.json');
      await fs.writeFile(input,JSON.stringify(rows));
      const args = [generator,'--questions',input,'--figures',figures,'--title',paper.label,'--output',path.join(output,kind),
        '--credit','DR.WANG Mathematics | '+(kind === 'solutions' ? 'Problem outline and worked solutions' : 'Problem outline')];
      if (exe) args.push('--chromium',exe);
      const run = spawnSync(process.execPath,args,{stdio:'inherit'});
      if (run.error || run.status !== 0) throw run.error || new Error('Could not render '+filename+'; install Chromium with npx playwright install chromium.');
    }
    await fs.writeFile(stamp,digest);
    console.log('Printed question outlines and worked solutions for '+paper.label+' ('+notes.length+' questions).');
  }
} finally {
  await fs.rm(scratch,{recursive:true,force:true});
}
