// Pin the original non-commercial CEMC books and give each question its own printable extract.
import {execFile} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {PDFDocument, PDFString, StandardFonts, rgb} from 'pdf-lib';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = path.join(root, 'public');
const papers = path.join(publicDir, 'euclid-papers');
const parts = path.join(publicDir, 'euclid-parts');
const stamps = path.join(root, '.astro', 'euclid-stamps');
const manifest = JSON.parse(await readFile(path.join(root, 'src/data/euclid-published.json'), 'utf8'));
const generator = await readFile(fileURLToPath(import.meta.url));
const scratch = await mkdtemp(path.join(os.tmpdir(), 'euclid-extracts-'));
await Promise.all([papers, parts, stamps].map(directory => mkdir(directory, {recursive: true})));

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function readIfPresent(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
async function atomicWrite(target, bytes) {
  const temp = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, bytes);
    await rename(temp, target);
  } finally {
    await rm(temp, {force: true});
  }
}
async function verifiedBook(year, kind, entry) {
  const file = path.join(papers, year + '-' + kind + '.pdf');
  const current = await readIfPresent(file);
  if (current && hash(current) === entry.sha256) return current;
  let bytes;
  if (process.env.EUCLID_PDF_CACHE) {
    const cache = path.join(process.env.EUCLID_PDF_CACHE, year + '-' + (kind === 'question' ? 'paper' : kind) + '.pdf');
    const cached = await readIfPresent(cache);
    if (cached && hash(cached) === entry.sha256) bytes = cached;
  }
  if (!bytes) {
    const download = file + '.' + randomUUID() + '.download';
    try {
      await run('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '3',
        '--max-time', '120', '--output', download, entry.url]);
      bytes = await readFile(download);
    } finally {
      await rm(download, {force: true});
    }
    if (hash(bytes) !== entry.sha256) throw new Error('Unrecognized upstream PDF: ' + entry.url);
  }
  await atomicWrite(file, bytes);
  return bytes;
}

function link(page, rect, target) {
  const context = page.doc.context;
  page.node.addAnnot(context.register(context.obj({
    Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0],
    A: {Type: 'Action', S: 'URI', URI: PDFString.of(target)}
  })));
}
function addCredit(page, contentHeight, title, font, entry) {
  const x = 36;
  const top = contentHeight + 23;
  const label = title + '  |  Official source';
  page.drawText(label, {x, y: top, font, size: 9, color: rgb(.12, .18, .25)});
  link(page, [x, top - 1, x + font.widthOfTextAtSize(label, 9), top + 9], entry.url);
  const line = 'University of Waterloo (CEMC)  |  CC BY-NC 4.0  |  Extract cropped from the original PDF';
  page.drawText(line, {x, y: top - 12, font, size: 8, color: rgb(.28, .30, .33)});
  link(page, [x, top - 14, x + font.widthOfTextAtSize(line, 8), top - 3], manifest.licenseUrl);
}

async function makePart(book, entry, year, number, kind, slices) {
  const cropped = await PDFDocument.create();
  const title = year + ' Euclid, question ' + number + ' - ' + (kind === 'solution' ? 'solutions' : 'problem');
  for (const [physicalPage, top, bottom] of slices) {
    const input = book.getPage(physicalPage - 1);
    const {width, height} = input.getSize();
    if (width !== 612 || height !== 792 || top < 0 || bottom > height || top >= bottom) {
      throw new Error('Invalid crop: ' + [year, number, kind, physicalPage, top, bottom].join('/'));
    }
    const form = await cropped.embedPage(input, {left: 0, right: width, bottom: height - bottom, top: height - top});
    cropped.addPage([width, bottom - top]).drawPage(form);
  }
  // An ordinary PDF CropBox or Form BBox still contains text from the adjacent
  // problem, readable by extractors. Reprint the visible vector scene first.
  const filename = path.join(scratch, year + '-' + number + '-' + kind);
  const inputFile = filename + '.pdf';
  const cleanFile = filename + '-visible.pdf';
  await writeFile(inputFile, await cropped.save());
  await run('pdftocairo', ['-pdf', '-origpagesizes', inputFile, cleanFile]);
  const part = await PDFDocument.load(await readFile(cleanFile));
  if (part.getPageCount() !== slices.length) throw new Error('Missing extract page for ' + title);
  const first = part.getPage(0);
  const size = first.getSize();
  first.setSize(size.width, size.height + 37);
  const font = await part.embedFont(StandardFonts.Helvetica);
  addCredit(first, size.height, title, font, entry);
  part.setTitle(title);
  part.setAuthor(manifest.author);
  part.setSubject([entry.url, manifest.license, manifest.licenseUrl, 'Cropped from the original PDF.'].join(' | '));
  part.setCreationDate(new Date('2000-01-01T00:00:00Z'));
  part.setModificationDate(new Date('2000-01-01T00:00:00Z'));
  await Promise.all([inputFile, cleanFile].map(file => rm(file, {force: true})));
  return part.save();
}

async function materialize({year, kind, entry}) {
  const bytes = await verifiedBook(year, kind, entry);
  const jobs = Array.from({length: 10}, (_, i) => {
    const number = i + 1;
    const item = manifest.questions['euclid-' + year + '-q' + number];
    return {number, slices: item[kind + 'Slices'], file: path.join(parts, year + '-q' + number + '-' + kind + '.pdf')};
  });
  const key = createHash('sha256').update(generator).update(entry.sha256).update(manifest.author).update(manifest.licenseUrl)
    .update(JSON.stringify(jobs.map(job => job.slices))).digest('hex');
  const stampFile = path.join(stamps, year + '-' + kind + '.json');
  const existing = await readIfPresent(stampFile);
  let previous;
  try { previous = JSON.parse(existing ?? 'null'); } catch {}
  if (previous?.key === key && Array.isArray(previous.digests) && previous.digests.length === jobs.length) {
    const checks = await Promise.all(jobs.map(async (job, i) => {
      const saved = await readIfPresent(job.file);
      return saved && hash(saved) === previous.digests[i];
    }));
    if (checks.every(Boolean)) return;
  }
  const book = await PDFDocument.load(bytes);
  if (book.getPageCount() !== entry.pages) throw new Error('Unexpected page count for ' + entry.url);
  const digests = [];
  for (const job of jobs) {
    const excerpt = await makePart(book, entry, year, job.number, kind, job.slices);
    await atomicWrite(job.file, excerpt);
    digests.push(hash(excerpt));
  }
  await atomicWrite(stampFile, JSON.stringify({key, digests}));
}

const jobs = Object.entries(manifest.books).flatMap(([year, book]) =>
  Object.entries(book).map(([kind, entry]) => ({year, kind, entry})));
const remaining = jobs.values();
try {
  await Promise.all(Array.from({length: 3}, async () => {
    for (const job of remaining) await materialize(job);
  }));
  console.log('Verified ' + jobs.length + ' Euclid books and ' + Object.keys(manifest.questions).length * 2 + ' individual extracts.');
} finally {
  await rm(scratch, {recursive: true, force: true});
}
