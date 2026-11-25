import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileDigest } from './inline-digest.mjs';
import { printableSolutions, sourceDigest } from './solution-edition.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const data = path.join(site, 'src/data');
const publicDir = path.join(site, 'public');
const output = path.join(publicDir, 'inline-pdf');
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));

async function checkHash(file, expected) {
  if (await fileDigest(file) !== expected) {
    throw new Error(`${path.relative(site, file)} has changed. Regenerate the affected question PDFs.`);
  }
}

function checkKeys(actual, expected, label) {
  const entries = new Set(actual);
  if (entries.size !== expected.size || [...expected].some(key => !entries.has(key))) {
    throw new Error(`${label} does not match the edition. Regenerate its question PDFs.`);
  }
}

async function verify() {
  const archives = (await readdir(data)).filter(name => /^past-.*\.json$/.test(name));
  const papers = new Map();
  for (const name of archives) {
    for (const paper of await readJSON(path.join(data, name))) papers.set(paper.id, paper);
  }
  const editionDir = path.join(data, 'editions');
  const editions = (await readdir(editionDir)).filter(name => name.endsWith('.json'));
  const expectedOutputs = new Set();
  const generator = path.join(site, 'scripts/typeset-questions.mjs');
  const generatorSha256 = await fileDigest(generator);
  let total = 0;
  for (const name of editions) {
    const file = path.join(editionDir, name);
    const edition = await readJSON(file);
    const {paperId, questions} = edition;
    const paper = papers.get(paperId);
    if (!paper || name !== paperId + '.json') throw new Error(`Unknown or misnamed edition: ${name}`);
    const manifestName = paperId + '.build.json';
    const manifest = await readJSON(path.join(output, manifestName));
    expectedOutputs.add(manifestName);
    if (manifest.version !== 1 || manifest.generatorSha256 !== generatorSha256 || manifest.title !== paper.label) {
      throw new Error(`${manifestName} is out of date. Regenerate this edition with its current paper title.`);
    }
    await checkHash(file, manifest.sourceSha256);
    const questionIds = new Set(paper.questions.map(q => paperId + '-q' + q.n));
    const pdfNames = new Set();
    const figureNames = new Set();
    for (const question of questions) {
      const pdf = question.id + '.pdf';
      if (!questionIds.has(question.id) || pdfNames.has(pdf)) throw new Error(`Unexpected question ID: ${question.id}`);
      pdfNames.add(pdf);
      expectedOutputs.add(pdf);
      await checkHash(path.join(output, pdf), manifest.pdfs[pdf]);
      const figures = [question.introFigure, ...(question.parts || []).map(part => part.figure), question.outroFigure];
      for (const key of figures.filter(Boolean)) {
        const url = edition.figures?.[key]?.url || '';
        if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(svg|png|jpg|webp)$/.test(url) || path.parse(url).name !== key) {
          throw new Error(`Missing or invalid public figure URL for ${key} in ${name}`);
        }
        const figure = path.basename(url);
        if (!figureNames.has(figure)) {
          await checkHash(path.join(publicDir, url.slice(1)), manifest.figures[figure]);
          figureNames.add(figure);
        }
      }
    }
    checkKeys(Object.keys(manifest.pdfs), pdfNames, manifestName + ' PDF list');
    checkKeys(Object.keys(manifest.figures), figureNames, manifestName + ' figure list');
    total += pdfNames.size;
  }
  const outputs = (await readdir(output)).filter(name => name.endsWith('.pdf') || name.endsWith('.build.json'));
  checkKeys(outputs, expectedOutputs, 'Published question PDFs and manifests');
  console.log(`Verified ${total} question PDFs across ${editions.length} editions.`);

  const solutionsDir = path.join(data, 'answers');
  const solvedEditions = (await readdir(solutionsDir)).filter(name => name.endsWith('.json'));
  const solvedOutputs = new Set();
  const solutionOutput = path.join(publicDir, 'solution-pdf');
  for (const name of solvedEditions) {
    const id = path.basename(name, '.json');
    const paper = papers.get(id);
    if (!paper) throw new Error('Unknown solution edition: ' + name);
    const edition = await readJSON(path.join(editionDir, name));
    const {title, source} = printableSolutions(edition, paper, await readJSON(path.join(solutionsDir, name)));
    const manifestName = id + '.build.json';
    const manifest = await readJSON(path.join(solutionOutput, manifestName));
    if (manifest.version !== 1 || manifest.generatorSha256 !== generatorSha256 || manifest.title !== title ||
        manifest.sourceSha256 !== sourceDigest(source)) throw new Error('Stale solution PDF manifest: ' + name);
    const filenames = new Set(source.questions.map(q => q.id + '.pdf'));
    checkKeys(Object.keys(manifest.pdfs), filenames, manifestName + ' solution PDF list');
    for (const [figure, hash] of Object.entries(manifest.figures)) {
      await checkHash(path.join(publicDir, 'inline-figures', figure), hash);
    }
    for (const filename of filenames) {
      await checkHash(path.join(solutionOutput, filename), manifest.pdfs[filename]);
      solvedOutputs.add(filename);
    }
    solvedOutputs.add(manifestName);
  }
  const included = (await readdir(solutionOutput)).filter(name => name.endsWith('.pdf') || name.endsWith('.build.json'));
  checkKeys(included, solvedOutputs, 'Published solution PDFs and manifests');
  console.log(`Verified ${solvedOutputs.size - solvedEditions.length} worked-solution PDFs.`);
}

await verify();
