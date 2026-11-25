export const credits = {
  euclid: {name:'University of Waterloo · CEMC', license:'CC BY-NC 4.0', url:'https://cemc.uwaterloo.ca/copyright', licenseUrl:'https://creativecommons.org/licenses/by-nc/4.0/'},
  step: {name:'Keith McNulty · Beyond STEP', license:'CC0 1.0', url:'https://beyondstep.keithmcnulty.org/solutions/', licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'}
};

export function publishedAsset(id, record, kind, lang = 'en') {
  if (!record) return null;
  if (record.collection === 'step' && kind === 'solution') {
    const match = /^step-(\d{4})-p\d+-q\d+$/.exec(id);
    const pages = record[lang];
    if (match && Array.isArray(pages)) return {path:'/step-solutions/'+match[1]+'-'+lang+'.pdf', pages};
  }
  if (record.collection === 'euclid' && /^euclid-\d{4}-q\d+$/.test(id)) {
    return {path:'/euclid-parts/'+id.slice(7)+'-'+kind+'.pdf'};
  }
  return null;
}

export async function loadPdfPages(asset, documents, PDFDocument) {
  const url = new URL(asset.path, location.origin);
  if (url.origin !== location.origin) throw new Error('Expected an on-site PDF.');
  if (!documents.has(url.href)) {
    documents.set(url.href, fetch(url).then(async response => {
      if (!response.ok) throw new Error('PDF unavailable.');
      return PDFDocument.load(await response.arrayBuffer());
    }));
  }
  const doc = await documents.get(url.href);
  const [first,last] = asset.pages || [1,doc.getPageCount()];
  if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 1 && first <= last && last <= doc.getPageCount())) {
    throw new Error('Pages do not match the document.');
  }
  return {doc, pages:doc.getPages().slice(first-1,last), first, last};
}

export async function singleQuestionURL(asset, title) {
  if (!asset.pages) return asset.path;
  const {PDFDocument} = await import('/worksheet-engine.js');
  const {doc,first,last} = await loadPdfPages(asset,new Map(),PDFDocument);
  const output = await PDFDocument.create();
  const indices = Array.from({length:last-first+1}, (_,i) => first-1+i);
  for (const page of await output.copyPages(doc,indices)) output.addPage(page);
  output.setTitle(title);
  output.setAuthor('Keith McNulty');
  output.setSubject('Beyond STEP · CC0 1.0');
  return URL.createObjectURL(new Blob([await output.save()],{type:'application/pdf'}));
}
