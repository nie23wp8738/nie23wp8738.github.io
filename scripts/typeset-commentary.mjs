// Print the site's own outlines and worked methods for annotated exam questions.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {credits} from '../public/published-pdf.js';

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
function figureKey(figure, solution = false) {
  if (!figure) return undefined;
  const match = /^\/commentary-figures\/([a-z0-9-]+-q[1-9]\d*(?:-method-[1-9]\d*)?)\.svg$/.exec(figure.url);
  if (!match || match[1].includes('-method-') !== solution || !figure.alt || !figure.altZh) {
    throw new Error('Invalid '+(solution ? 'solution' : 'question')+' figure: '+figure.url);
  }
  return match[1];
}
try {
  const outlineDir = path.join(site,'src/data/step-outlines');
  const entries = [
    ...(await fs.readdir(commentary)).map(filename=>({filename,dir:commentary,kinds:['questions','solutions']})),
    ...(await fs.readdir(outlineDir)).map(filename=>({filename,dir:outlineDir,kinds:['questions']}))
  ];
  for (const {filename,dir,kinds} of entries) {
    if (!filename.endsWith('.json')) continue;
    const paperId = path.basename(filename,'.json');
    const paper = papers.get(paperId);
    if (!paper) throw new Error('Unknown commentary paper ' + paperId);
    const json = await fs.readFile(path.join(dir,filename),'utf8');
    const notes = Object.entries(JSON.parse(json));
    const sourceCredit = paper.exam === 'Euclid'
      ? ' | Problem adapted from ' + credits.euclid.name + ', ' + credits.euclid.license + ' (' + credits.euclid.licenseUrl + '). Free noncommercial use.'
      : '';
    const signature = createHash('sha256').update(json).update(paper.label).update(sourceCredit);
    for (const code of tools) signature.update(code);
    const figures = path.join(site,'public/commentary-figures');
    for (const [,note] of notes) {
      const images=[figureKey(note.figure),...(note.methods || []).map(method=>figureKey(method.figure,true))];
      for (const name of images) if (name) {
        signature.update(await fs.readFile(path.join(figures,name+'.svg')));
      }
    }
    const stamp = path.join(output,paperId+(kinds.length===1?'.outlines':'')+'.sha256');
    const digest = signature.digest('hex');
    if (await fs.readFile(stamp,'utf8').catch(()=>null) === digest &&
       notes.every(([id])=>kinds.every(kind=>existsSync(path.join(output,kind,id+'.pdf'))))) continue;
    for (const kind of kinds) {
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
            if (method.figure) parts.push({figure:figureKey(method.figure,true),figurePrintHeightPt:method.figure.printHeightPt});
          }
        }
        return {id, intro:note.summary, introFigure:figureKey(note.figure), introFigurePrintHeightPt:note.figure?.printHeightPt, parts};
      });
      const input = path.join(scratch,kind+'.json');
      await fs.writeFile(input,JSON.stringify(rows));
      const args = [generator,'--questions',input,'--figures',figures,'--title',paper.label,'--output',path.join(output,kind),
        '--credit','DR.WANG Mathematics | '+(kind === 'solutions' ? 'Problem outline and worked solutions' : 'Problem outline') + sourceCredit];
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
