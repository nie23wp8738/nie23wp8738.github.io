import {mountPublishedReader} from './published-reader.js';
const root = document.querySelector('[data-entry]');
const zh = root.dataset.lang === 'zh';
const prefix = zh ? '/zh' : '';
const t = (en, cn) => zh ? cn : en;
const field = name => root.querySelector('[data-' + name + ']');
const id = new URLSearchParams(location.search).get('id') || '';
function link(label, href) {
  const a = document.createElement('a');
  a.textContent = label;
  a.href = href;
  return a;
}
async function loadEntry() {
  const match = /^([a-z0-9-]+)-q([1-9]\d*)$/.exec(id);
  if (!match) throw new Error('Invalid question');
  const response = await fetch('/question-data/' + match[1] + '.json');
  if (!response.ok) throw new Error('Unknown paper');
  const paper = await response.json();
  const index = paper.questions.findIndex(q => q.n === Number(match[2]));
  if (index < 0) throw new Error('Unknown question');
  const q = paper.questions[index];
  const href = row => prefix + (row.worked ? '/questions/' + paper.id + '-q' + row.n + '/' : '/questions/entry/?id=' + paper.id + '-q' + row.n);
  if (q.worked) { location.replace(href(q) + location.hash); return; }

  let paperName = paper.label || paper.exam;
  if (!paperName.toUpperCase().includes(paper.exam.toUpperCase())) paperName = paper.exam + ' · ' + paperName;
  if (!paperName.includes(String(paper.year))) paperName = paper.year + ' · ' + paperName;
  if (zh) paperName = paperName.replace(/\bPaper (\d+)\b/gi,'试卷 $1');
  const title = paperName + t(' · Question ', ' · 第 ') + q.n + t('', ' 题');
  const paperURL = prefix + '/past-papers/?paper=' + paper.id + '#q-' + q.n;
  document.title = title + ' · DR.WANG';
  field('title').textContent = title;
  field('parent').append(' / ', link(paperName, paperURL));
  field('topics').textContent = q.tags.map(tag => zh ? tag.zh : tag.en).join(' · ');
  field('add').href = prefix + '/problems/?add=' + id + '#worksheet';
  field('related').href = paperURL;
  field('answer-panel').hidden = !q.answer;
  field('pending').hidden = !!q.answer || !!q.published;
  if (q.published) {
    field('answer-panel').removeAttribute('id');
    mountPublishedReader(field('publisher'),{id,record:q.published,lang:zh?'zh':'en',title,primary:true});
  }
  if (q.answer) field('answer').textContent = q.value ? q.answer + ' · ' + q.value : q.answer;
  if (q.note) {
    field('key-note').textContent = zh ? q.note.zh : q.note.en;
    field('key-note').hidden = false;
  }
  field('source-name').textContent = paper.source;
  const sources = new Map();
  for (const [label, url] of [
    [t('Original question','原题出处'), q.url || paper.url],
    [t('Answer key source','答案表出处'), paper.keySource],
    [t('Scoring note','计分说明'), q.note?.sourceUrl],
    [t('Publisher’s solution','来源方解答'), q.solutionURL || paper.solutionURL]
  ]) {
    if (!url || sources.has(url) || !/^https?:\/\//i.test(url)) continue;
    const a = link(label, url);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    sources.set(url,a);
  }
  field('sources').append(...sources.values());
  for (const [next, label, rel] of [[index-1,t('Previous question','上一题'),'prev'],[index+1,t('Next question','下一题'),'next']]) {
    if (!paper.questions[next]) continue;
    const a = link(label, href(paper.questions[next])); a.rel = rel; field('adjacent').append(a);
  }
  field('status').hidden = true;
  field('record').hidden = false;
  if(q.published && location.hash==='#solutions') requestAnimationFrame(()=>document.querySelector('#solutions')?.scrollIntoView({block:'nearest'}));
  const openAnswer = () => {
    if (location.hash === '#solutions' && q.answer) { field('answer-panel').open = true; field('answer-panel').scrollIntoView({block:'nearest'}); }
  };
  openAnswer();
  window.addEventListener('hashchange',openAnswer);
}
loadEntry().catch(() => { field('status').textContent = t('This question could not be loaded. Reopen it from Past papers or reload the page.','暂时无法载入本题。请刷新，或从“历年真题”重新选择题号。'); });
