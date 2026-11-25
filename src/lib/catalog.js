import { getInlineRecord } from './inline-editions.js';
import { getWorkedAnswer } from './answers.js';
import {publishedRecord,getPublishedOutline} from './published.js';
import answerKeys from '../data/answer-keys.json';

// Keep the question browser's index light. Full text lives on static reader pages.
const archives = import.meta.glob('../data/past-*.json', { eager: true, import: 'default' });
const translations = import.meta.glob('../data/*-concepts.json', { eager: true, import: 'default' });
const sourceLabels = Object.assign({}, ...Object.values(translations));
const preferredCase = new Map();
export const tagTranslations = {};
for (const [name, label] of Object.entries(sourceLabels)) {
  const key = name.trim().toLowerCase();
  preferredCase.set(key, preferredCase.get(key) || name);
  tagTranslations[preferredCase.get(key)] = label;
}
const canonicalTag = raw => preferredCase.get(raw.toLowerCase()) ?? raw;
export function tagLabel(raw, lang) {
  return lang === 'zh' ? (tagTranslations[canonicalTag(raw)] || raw) : raw;
}
const taxonomy = [
  ['algebra','Algebra','代数'], ['geometry','Geometry','几何'],
  ['counting','Counting & combinatorics','组合计数'], ['number-theory','Number theory','数论'],
  ['logic','Logic & proof','逻辑与证明'], ['functions','Functions & graphs','函数与图像'],
  ['calculus','Calculus','微积分'], ['probability','Probability','概率'],
  ['statistics','Statistics','统计'], ['mechanics','Mechanics','力学'],
  ['trigonometry','Trigonometry','三角学'], ['sequences','Sequences & series','数列与级数'],
  ['vectors','Vectors','向量'], ['arithmetic','Arithmetic','算术'],
  ['problem-solving','Problem-solving strategies','解题策略'],
  ['critical-thinking','Critical thinking','批判性思维'], ['argument-writing','Argumentative writing','论证写作']
];
export const topicEntries = taxonomy.map(([key,en,zh]) => ({key,en,zh}));
const topics = new Map(topicEntries.map(topic => [topic.key,topic]));
const paperIndex = Object.values(archives).flat().map(paper => ({
  ...paper,
  ...(answerKeys[paper.id] ? {keySource:answerKeys[paper.id].sourceUrl} : {}),
  questions: (paper.questions || []).map(question => {
    const id = paper.id + '-q' + question.n;
    const record = getInlineRecord(id);
    const answer = getWorkedAnswer(id);
    const published = publishedRecord(id);
    const outline = getPublishedOutline(id);
    if (outline && (!published || answer)) throw new Error('Missing or conflicting published solution for '+id);
    const keyAnswer = answerKeys[paper.id]?.answers[question.n];
    return {
      ...question,
      ...(published ? {published} : {}),
      ...(outline ? {outlinePdf:'/commentary-pdf/questions/'+id+'.pdf'} : {}),
      ...(keyAnswer ? {keyAnswer} : {}),
      ...(answerKeys[paper.id]?.values?.[question.n] ? {keyValue:answerKeys[paper.id].values[question.n]} : {}),
      ...(answerKeys[paper.id]?.notes?.[question.n] ? {keyNote:answerKeys[paper.id].notes[question.n]} : {}),
      ...(answer ? {hasWorkedSolution:true} : {}),
      ...(answer?.summary ? {hasCommentary:true, commentary:{
        pdf:'/commentary-pdf/questions/' + id + '.pdf', solutionPdf:'/commentary-pdf/solutions/' + id + '.pdf'
      }} : {}),
      ...(record ? {inline: {pdf: '/inline-pdf/' + id + '.pdf', licenseUrl: record.edition.licenseURL,
        ...(answer ? {solutionPdf:'/solution-pdf/' + id + '.pdf'} : {})}} : {}),
      ...(question.tags ? {tags: [...new Set(question.tags.map(tag => topics.has(tag) ? tag : canonicalTag(tag)))]} : {})
    };
  })
})).sort((a,b) =>
  b.year - a.year || a.exam.localeCompare(b.exam, 'en') || a.label.localeCompare(b.label, 'en', {numeric:true}));
export function getPastPapers() { return paperIndex; }

export function getReadingPaths() {
  return paperIndex.flatMap(paper => paper.questions.filter(q => q.inline || q.hasCommentary || q.outlinePdf).map(q => {
    const id = paper.id + '-q' + q.n;
    return {params:{id}, props:{record:getInlineRecord(id), paperId:paper.id, number:q.n}};
  }));
}

export function topicLabel(key, lang='en') {
  return topics.get(key)?.[lang] ?? key;
}
const titles = {
  'count-spaced-lamps':'Lights at the ends of a row',
  'count-ink-packets':'Distributing ink cartridges',
  'count-detour':'Around a closed intersection',
  'count-residue-draw':'Drawing three cards modulo three',
  'count-letter-blocks':'Arrangements of LEVEL',
  'count-signal-times':'When exactly one light flashes',
  'count-octagon':'Opposite vertices of an octagon',
  'count-painted-tiles':'Tiles of three lengths',
  'count-return-walks':'A single intermediate return',
  'count-marked-rectangles':'Rectangles with one marked cell',
  'count-parity-gaps':'Gaps and even sums',
  'count-coin-runs':'Runs of heads and tails',
  'alg-quadratic-parameter':'Two positive roots',
  'proof-fourth-power':'Factoring a fourth power plus four',
  'proof-two-fractions':'The minimum of two fractions',
  'logic-finite-mean':'Negating a statement about the mean',
  'nt-fixed-remainder':'Divisibility with a fixed remainder',
  'alg-absolute-roots':'Counting roots of an absolute-value equation'
};
const methods = {
  '间隔法':'Gap method','隔板法与容斥':'Stars and bars with inclusion–exclusion',
  '补集计数':'Complementary counting','按余数分类':'Residue classes',
  '捆绑法与容斥':'Block counting and inclusion–exclusion','容斥原理':'Inclusion–exclusion',
  '分步计数':'Multiplication principle','分类排列':'Arrangements by cases',
  '路径分解':'Path decomposition','间隔法与奇偶性':'Gaps and parity',
  '条件概率':'Conditional probability','韦达定理':"Vieta’s formulas",
  '配方与因式分解':'Completing the square and factoring','柯西不等式':'Cauchy–Schwarz inequality',
  '量词与反证法':'Quantifiers and contradiction','带余除法':'Division with remainder','分类讨论':'Case analysis'
};
const levels = {'基础':['basic','Foundation'],'提高':['intermediate','Intermediate'],'挑战':['challenge','Challenge']};
const originalTopics = {'组合计数':'counting','代数':'algebra','数论':'number-theory','逻辑与证明':'logic'};
export function localPractice(p, lang='en') {
  const topicKey = p.topicKey || (p.id === 'count-coin-runs' ? 'probability' : originalTopics[p.topic]);
  const [levelKey,englishLevel] = levels[p.level];
  return {...p, title:lang === 'zh' ? p.title : p.titleEn || titles[p.id], topic:topicLabel(topicKey,lang),
    topicKey, method:lang === 'zh' ? p.method : p.methodEn || methods[p.method],
    level:lang === 'zh' ? p.level : englishLevel, levelKey};
}
