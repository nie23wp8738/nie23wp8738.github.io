// Ingestion tool, run only when adding or changing a full-text edition. Requires
// Playwright with Chromium and the site's normal KaTeX and pdf-lib dependencies.
// node scripts/typeset-questions.mjs --questions edition.json --figures figures
//   --output strips --title "2025 Euclid Contest"
//   [--chromium /path/to/chromium]
// An edition object supplies credit, license, licenseURL, sourceURL, changes,
// instructions and questions. A standalone question array also needs --credit.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';
import katex from 'katex';
import { PDFDocument } from 'pdf-lib';
import { fileDigest } from './inline-digest.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { values } = parseArgs({options:Object.fromEntries(
  ['questions','figures','output','title','credit','chromium'].map(name => [name,{type:'string'}])
)});
for (const key of ['questions','output','title']) {
  if (!values[key]) throw new Error('Missing --' + key);
}
const source = JSON.parse(await fs.readFile(values.questions, 'utf8'));
const questions = Array.isArray(source) ? source : source.questions;
const figureDigests = {};
const credit = values.credit || [source.credit, source.license, source.changes].filter(Boolean).join(' · ');
if (!credit) throw new Error('Supply an edition credit or --credit.');
const widthPt = 480;
const maxHeightPt = 500;
const encode = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;');
function creditLink(label, url) {
  if (!label) return '';
  if (!url) return encode(label);
  if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS attribution link.');
  return '<a href="' + encode(url) + '">' + encode(label) + '</a>';
}

function typeset(text) {
  const fragments = String(text).split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);
  return fragments.map(fragment => {
    if (!fragment.startsWith('$') || fragment.length < 2) return encode(fragment).replaceAll('\n\n','<br><br>').replaceAll('\n',' ');
    const display = fragment.startsWith('$$');
    const size = display ? 2 : 1;
    return katex.renderToString(fragment.slice(size, -size), {
      displayMode:display, output:'html', throwOnError:true, trust:false,
    });
  }).join('');
}

async function figure(key) {
  if (!key) return '';
  if (!/^[a-zA-Z0-9_-]+$/.test(key) || !values.figures) throw new Error('Invalid figure ' + key);
  for (const ext of ['.svg','.png','.jpg','.webp']) {
    const file = path.resolve(values.figures, key + ext);
    try {
      await fs.access(file);
      figureDigests[key + ext] ??= await fileDigest(file);
      return '<img alt="" src="' + encode(pathToFileURL(file)) + '">';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Missing figure ' + key);
}

async function renderQuestion(page, scratch, question) {
  if (!/^[a-zA-Z0-9_-]+-q\d+$/.test(question.id)) throw new Error('Invalid question ID');
  const number = Number(question.id.split('-q').at(-1));
  const attribution = question.author ? credit + ' · Problem by ' + question.author : credit;
  const creditHtml = values.credit ? encode(attribution) : [
    creditLink(source.credit, source.sourceURL), creditLink(source.license, source.licenseURL),
    encode(source.changes || ''), question.author ? 'Problem by ' + encode(question.author) : '',
  ].filter(Boolean).join(' · ');
  const blocks = ['<header><b>' + encode(values.title) + ', Question ' + number + '</b><small>' +
    creditHtml + '</small></header>'];
  async function block(text, image, label, response) {
    if (!text && !image) return;
    const responseLabel = {short:'Short answer',full:'Full solution'}[response];
    const prefix = (label ? '<strong>(' + encode(label) + ')</strong> ' : '') +
      (responseLabel ? '<i>[' + responseLabel + ']</i> ' : '');
    blocks.push('<section>' + prefix + typeset(text || '') + (await figure(image)) + '</section>');
  }
  if (source.instructions) blocks.push('<aside>' + typeset(source.instructions) + '</aside>');
  await block(question.intro, question.introFigure);
  for (const p of question.parts || []) await block(p.text, p.figure, p.label, p.response);
  await block(question.outro, question.outroFigure);
  if (blocks.length < 2) throw new Error('Missing question text for ' + question.id);

  const katexCss = pathToFileURL(require.resolve('katex/dist/katex.min.css'));
  const html = '<!doctype html><html lang="en"><meta charset="utf-8"><link rel="stylesheet" href="' +
    encode(katexCss) + '"><style>@page{margin:0}*{box-sizing:border-box}html,body{padding:0;margin:0}' +
    'body{width:' + widthPt + 'pt;color:#161616;font:12pt/1.45 "Times New Roman",serif}' +
    'header,section,aside{padding:1pt 2pt 4pt}header{font:10pt/1.35 Arial,sans-serif}small{display:block;font-size:8pt;margin-top:2pt;color:#333}aside{font:italic 10pt/1.35 "Times New Roman",serif}' +
    'a{color:inherit}section{overflow-wrap:break-word}.katex{font-size:1.02em}.katex-display{margin:.35em 0}' +
    'img{display:block;max-height:102pt;max-width:80%;width:auto;height:auto;margin:5pt auto 0}</style><main>' +
    blocks.join('') + '</main></html>';
  const input = path.join(scratch, question.id + '.html');
  await fs.writeFile(input, html);
  await page.goto(pathToFileURL(input).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.decode()));
  });
  const sizes = await page.locator('main > *').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height * 72/96));
  // Break only between complete question parts. Each embedded page is tightly
  // cropped; the worksheet composer can place it below preceding questions.
  const groups = [];
  let group = {start:0, height:0};
  for (let index=0; index<sizes.length; index++) {
    if (sizes[index] > maxHeightPt - 3) throw new Error(question.id + ': split the long part at a paragraph before typesetting.');
    if (group.height + sizes[index] > maxHeightPt - 3) {
      groups.push({...group, end:index});
      group = {start:index, height:0};
    }
    group.height += sizes[index];
  }
  groups.push({...group, end:sizes.length});
  const result = await PDFDocument.create();
  for (const group of groups) {
    await page.locator('main > *').evaluateAll((nodes, range)=>{
      nodes.forEach((node,i)=>node.hidden=i<range.start || i>=range.end);
    }, group);
    const buffer = await page.pdf({width:widthPt/72+'in', height:(Math.ceil(group.height)+2)/72+'in',
      margin:{top:0,left:0,right:0,bottom:0}, printBackground:true, tagged:false});
    const part = await PDFDocument.load(buffer);
    if (part.getPageCount() !== 1) throw new Error('Unexpected page break in ' + question.id);
    const [copied] = await result.copyPages(part, [0]);
    result.addPage(copied);
  }
  result.setTitle(values.title + ', Question ' + number);
  result.setSubject(attribution);
  result.setCreationDate(new Date(0));
  result.setModificationDate(new Date(0));
  await fs.writeFile(path.join(scratch, question.id + '.pdf'), await result.save());
}

const scratch = await fs.mkdtemp(path.join(os.tmpdir(),'math-question-pdf-'));
let browser;
try {
  await fs.mkdir(values.output,{recursive:true});
  browser = await chromium.launch({executablePath:values.chromium, args:['--allow-file-access-from-files','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.emulateMedia({media:'print'});
  for (const question of questions) await renderQuestion(page, scratch, question);
  const pdfs = {};
  for (const question of questions) {
    const filename = question.id + '.pdf';
    const file = path.join(scratch, filename);
    pdfs[filename] = await fileDigest(file);
    await fs.copyFile(file, path.join(values.output, filename));
  }
  if (source.paperId) {
    const manifest = {
      version:1, title:values.title, sourceSha256:await fileDigest(values.questions),
      generatorSha256:await fileDigest(fileURLToPath(import.meta.url)), figures:figureDigests, pdfs,
    };
    const filename = source.paperId + '.build.json';
    await fs.writeFile(path.join(scratch, filename), JSON.stringify(manifest,null,2) + '\n');
    await fs.copyFile(path.join(scratch, filename), path.join(values.output, filename));
  }
} finally {
  if (browser) await browser.close();
  await fs.rm(scratch, {recursive:true, force:true});
}
