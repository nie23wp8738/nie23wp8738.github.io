// Only exact question matches with verified document ranges enter the public catalogue.
import step from '../data/step-published-solutions.json';
import euclid from '../data/euclid-published.json';
const files = import.meta.glob('../data/step-outlines/*.json',{eager:true,import:'default'});
const outlines = new Map();
for (const file of Object.values(files)) for (const [id,outline] of Object.entries(file)) {
  if (outlines.has(id) || !step.questions[id] || !outline.summary || !outline.summaryZh ||
      !outline.answer || !outline.answerZh || !outline.topics?.length || outline.topics.some(t=>!t.en || !t.zh)) {
    throw new Error('Incomplete or duplicate bilingual STEP outline for '+id);
  }
  outlines.set(id,outline);
}
export function getPublishedOutline(id) { return outlines.get(id); }

export function publishedRecord(id) {
  const pages = step.questions[id];
  if (pages) return {collection:'step', en:pages.en, zh:pages.zh};
  if (euclid.questions[id]) return {collection:'euclid'};
}
