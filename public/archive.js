import {answerLabel, matchesReading, questionPath} from './answer-links.js';

const root = document.querySelector('[data-archive]');
if (root) runArchive(root);

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function link(label, href, className) {
  const el = node('a', className, label);
  el.href = href;
  return el;
}

function externalLink(label, href) {
  const anchor = link(label, href);
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

async function runArchive(root) {
  const zh = root.dataset.lang === 'zh';
  const prefix = zh ? '/zh' : '';
  const isTopics = root.dataset.archive === 'topics';
  const t = (en, cn) => zh ? cn : en;
  const practiceRoute = exam => exam === 'ESAT' ? '/esat/' : !isTopics && exam === 'TARA' ? '/tara/' : '';
  const initialRoute = practiceRoute(new URLSearchParams(location.search).get('exam'));
  if (initialRoute) {
    location.replace(prefix + initialRoute);
    return;
  }
  const labels = JSON.parse(root.querySelector('[data-topics]').textContent);
  const tags = JSON.parse(root.querySelector('[data-tags]')?.textContent || '{}');
  const originals = JSON.parse(root.querySelector('[data-originals]')?.textContent || '[]');
  const results = root.querySelector('[data-results]');
  const controls = {
    exam: root.querySelector('[data-exam]'),
    year: root.querySelector('[data-year]'),
    kind: root.querySelector('[data-kind]'),
    tag: root.querySelector('[data-tag]'),
    reading: root.querySelector('[data-reading]')
  };
  const picked = new Set();
  const locale = zh ? 'zh-CN' : 'en';
  const number = x => x.toLocaleString(locale);
  const qty = (n, singular, plural, unit) => number(n) + (zh ? ' ' + unit : ' ' + (n === 1 ? singular : plural));
  const paperTitle = p => {
    let a = String(p.label || p.exam);
    if (zh) a = a.replace(/\bPaper (\d+|III|II|I)\b/gi, '试卷 $1')
      .replace(/\bSpecimen\b/gi, '样卷').replace(/\bFall\b/gi, '秋季').replace(/\bSpring\b/gi, '春季');
    const withExam = a.toUpperCase().includes(p.exam.toUpperCase()) ? a : p.exam + ' · ' + a;
    return withExam.includes(String(p.year)) ? withExam : p.year + ' · ' + withExam;
  };
  const questionsLink = id => prefix + '/problems/' + id + '/';
  const worksheetLink = ids => {
    const q = new URLSearchParams();
    for (const id of ids) q.append('add', id);
    return prefix + '/problems/?' + q + '#worksheet';
  };
  function urlWith(updates, hash = '') {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(updates)) {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    }
    u.hash = hash;
    return u.pathname + u.search + u.hash;
  }
  function navLink(label, updates, marker = 'nav', hash = '') {
    const a = link(label, urlWith(updates, hash));
    a.dataset[marker] = 'true';
    return a;
  }
  function paperLink(p, n) {
    const params = new URLSearchParams({ paper: p.id });
    return prefix + '/past-papers/?' + params + (n ? '#q-' + n : '');
  }
  function topicLink(key) {
    return prefix + '/topics/?' + new URLSearchParams({topic:key});
  }
  function readControls(params) {
    for (const [key, control] of Object.entries(controls)) {
      if (!control || key === 'tag') continue;
      const raw = params.get(key) || '';
      const val = key === 'exam' && raw.toUpperCase() === 'USJMO' ? 'USAJMO' : raw;
      control.value = val;
      if (control.selectedIndex < 0) control.value = '';
    }
  }
  function addResultsHeader(title, count, help) {
    const header = node('header', 'arch-page-heading');
    header.append(node('h2', '', title), node('p', 'arch-count', count));
    if (help) header.append(node('p', 'arch-note', help));
    results.append(header);
    return header;
  }
  const worksheetHelp = t(
    'Select questions for a worksheet. Open a question to see its available text, answer or worked methods.',
    '勾选题目即可组卷。点击题名可在本站查看已收录的题干、答案或解法。'
  );
  function addPickBar() {
    const bar = node('div','arch-bulk');
    bar.dataset.bulk = '';
    bar.hidden = !picked.size;
    const status = node('small','',qty(picked.size,'question selected','questions selected','题已勾选'));
    const a = link(t('Add selected to worksheet','将勾选题加入试卷'),worksheetLink(picked));
    a.dataset.addPicked = '';
    const clear = node('button','',t('Clear selection','取消勾选'));
    clear.type = 'button';
    clear.dataset.clearPicked = '';
    bar.append(status, a, clear);
    const prev = results.querySelector('[data-bulk]');
    if (prev) prev.replaceWith(bar);
    else results.append(bar);
  }
  function pickControl(id, title) {
    const label = node('label', 'arch-pick');
    const checkbox = node('input');
    checkbox.type = 'checkbox';
    checkbox.checked = picked.has(id);
    checkbox.dataset.pick = id;
    checkbox.setAttribute('aria-label', t('Select ', '勾选 ') + title);
    label.append(checkbox, document.createTextNode(t('Select', '勾选')));
    return label;
  }
  function questionRow(p, q, inPaper) {
    const row = node('article', 'arch-row');
    const id = p.id + '-q' + q.n;
    row.dataset.question = id;
    if (inPaper) row.id = 'q-' + q.n;
    const no = t('Question ', '第 ') + q.n + t('', ' 题');
    const title = inPaper ? no : paperTitle(p) + ' · ' + no;
    const main = node('div', 'arch-row-main');
    const heading = node('h3');
    const readUrl = prefix + questionPath(id, q);
    heading.append(link(title, readUrl));
    main.append(heading);
    const values = [...new Set([q.topic, ...(q.tags || [])].filter(Boolean))];
    if (values.length) {
      const meta = node('div', 'arch-meta');
      for (const [i,k] of values.entries()) {
        if (i) meta.append(document.createTextNode(' · '));
        if (labels[k]) meta.append(link(labels[k], topicLink(k)));
        else {
          const params = new URLSearchParams({topic:q.topic && labels[q.topic] ? q.topic : 'all',tag:k});
          meta.append(link(tags[k] || k, prefix + '/topics/?' + params + '#questions'));
        }
      }
      main.append(meta);
    }
    const links = node('div', 'arch-links');
    const answer = answerLabel(q, t);
    if (q.inline) links.append(link(t('Read full question','站内阅读全文'), readUrl));
    if (answer) links.append(link(answer, readUrl + '#solutions'));
    else main.append(node('div','arch-meta',t('Index only · Answer pending','题目索引 · 暂无站内答案')));
    if (!inPaper) links.append(link(t('View paper', '查看整卷'), paperLink(p, q.n)));
    links.append(link(q.inline || q.hasCommentary ? t('Add question','加入题目') : t('Add reference', '加入题号'), worksheetLink([id])), pickControl(id, title));
    row.append(main, links);
    return row;
  }
  function practiceRow(item) {
    const row = node('article', 'arch-row');
    row.dataset.question = item.id;
    const main = node('div','arch-row-main');
    const h = node('h3');
    h.append(link(item.title, questionsLink(item.id)));
    main.append(h, node('div','arch-meta',t('Original practice', '原创练习') + ' · ' + item.exam.join(' / ')));
    const links = node('div','arch-links');
    links.append(link(t('Open question','查看题目'),questionsLink(item.id)),
      link(t('Answer & methods','站内答案与解法'),questionsLink(item.id) + '#solutions'),
      link(t('Add question','加入题目'),worksheetLink([item.id])),pickControl(item.id,item.title));
    row.append(main,links);
    return row;
  }
  const byDate = (a,b) => b.year - a.year || a.exam.localeCompare(b.exam) || paperTitle(a).localeCompare(paperTitle(b), 'en', {numeric:true});
  let papers;
  try {
    const response = await fetch('/past-data.json');
    if (!response.ok) throw new Error(String(response.status));
    papers = await response.json();
    if (!Array.isArray(papers)) throw new Error('Invalid catalogue');
    papers.sort(byDate);
  } catch (err) {
    results.setAttribute('aria-busy','false');
    results.replaceChildren(node('p','arch-muted', t('The paper index could not be loaded. Reload this page to try again.', '试卷索引暂时无法加载，请刷新页面重试。')));
    return;
  }

  function showPage(items, size, params, renderOne) {
    const last = Math.ceil(items.length / size);
    const requested = Number(params.get('page'));
    const page = Math.min(last || 1, Math.max(1,Number.isSafeInteger(requested) ? requested : 1));
    for (const item of items.slice((page-1)*size,page*size)) results.append(renderOne(item));
    if (last < 2) return;
    const nav = node('nav','arch-paging');
    nav.setAttribute('aria-label',t('Results pages','结果页码'));
    if (page > 1) nav.append(navLink(t('Previous page','上一页'),{page:page-1}));
    nav.append(node('span','arch-count',t('Page ','第 ')+page+t(' of ',' / ')+last+t('',' 页')));
    if (page < last) nav.append(navLink(t('Next page','下一页'),{page:page+1}));
    results.append(nav);
  }

  function renderPapers(params) {
    const active = papers.find(p => p.id === params.get('paper'));
    const euclidPractice = root.querySelector('[data-euclid-practice]');
    if (euclidPractice) euclidPractice.hidden = !!active || controls.reading.value || controls.exam.value !== 'Euclid'
      || (controls.year.value !== '' && controls.year.value !== '2020');
    if (active) {
      const qs = active.questions || [];
      const top = addResultsHeader(paperTitle(active),active.source);
      const actions = node('div','arch-links');
      actions.append(navLink(t('Back to papers','返回试卷列表'),{paper:'',page:''}));
      const source = node('details','');
      const sourceLinks = node('div','arch-links');
      sourceLinks.append(externalLink(t('Original paper','原卷出处'),active.url));
      if (active.solutionsUrl) sourceLinks.append(externalLink(t('Publisher’s solutions','来源方解答'),active.solutionsUrl));
      source.append(node('summary','',t('External sources','外部来源')),sourceLinks);
      actions.append(source);
      top.append(actions);
      if (!qs.length) {
        top.append(node('p','arch-note', t('This edition is indexed at paper level. Use the source paper to browse its questions.','本场考试按整卷收录，点击原卷可以浏览各题。')));
        return;
      }
      top.append(node('p','arch-note',worksheetHelp));
      const visible = qs.filter(q => matchesReading(q, controls.reading.value));
      if (visible.length !== qs.length) {
        top.append(navLink(t('Show all questions in this paper','查看本卷全部题目'),{reading:'',page:''}));
      }
      visible.forEach(q => results.append(questionRow(active,q,true)));
      addPickBar();
      if (/^#q-\d+$/.test(location.hash)) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
      return;
    }
    const filtered = papers.filter(p => (!controls.exam.value || p.exam === controls.exam.value)
      && (!controls.year.value || p.year === Number(controls.year.value))
      && (!controls.reading.value || p.questions.some(q => matchesReading(q, controls.reading.value))));
    addResultsHeader(t('Paper index','试卷目录'),qty(filtered.length,'paper','papers','份试卷'));
    if (!filtered.length) results.append(node('p','arch-note',t('No papers match these filters. Select another exam or year.','当前条件下没有试卷，请更换考试或年份。')));
    showPage(filtered,15,params,p => {
      const row = node('article','arch-row');
      const main = node('div','arch-row-main');
      const h = node('h3');
      h.append(navLink(paperTitle(p),{paper:p.id,page:''},'paper'));
      const qs = (p.questions || []).length;
      const worked = p.questions.filter(q => matchesReading(q,'solutions')).length;
      const keyed = p.questions.filter(q => matchesReading(q,'answers')).length - worked;
      const meta = [
        qs ? qty(qs,'question','questions','道题') : t('Whole paper','整卷'),
        worked ? qty(worked,'worked solution','worked solutions','道有站内解析') : '',
        keyed ? qty(keyed,'answer key only','answer keys only','道有站内答案') : '',
        qs && !worked && !keyed ? t('Index only','仅题目索引') : ''
      ].filter(Boolean).join(' · ');
      main.append(h,node('div','arch-meta',meta));
      const actions = node('div','arch-links');
      actions.append(navLink(t('Browse paper','查看试卷'),{paper:p.id,page:''},'paper'));
      row.append(main,actions); return row;
    });
  }
  const classified = isTopics ? papers.flatMap(p => (p.questions || [])
    .map(q => ({p,q}))
    .filter(({q}) => [q.topic,...(q.tags || [])].some(k => Object.hasOwn(labels,k)))) : [];
  function renderTopics(params) {
    const key = params.get('topic') || (params.has('tag') ? 'all' : '');
    const active = key === 'all' || Object.hasOwn(labels,key);
    root.querySelector('[data-filterbar]').hidden = !active;
    root.querySelectorAll('[data-topic]').forEach(a => {
      a.href = urlWith({topic:a.dataset.topic,tag:'',page:''}, 'questions');
      if (a.dataset.topic === key) a.setAttribute('aria-current','true');
      else a.removeAttribute('aria-current');
    });
    if (!active) return;
    const fullOnly = controls.kind.value === 'full';
    const items = classified.filter(({p,q}) =>
      (key === 'all' || q.topic === key || q.tags?.includes(key))
      && matchesReading(q, controls.kind.value)
      && (!controls.exam.value || controls.exam.value === p.exam)
      && (!controls.year.value || Number(controls.year.value) === p.year));
    const selectedTag = params.get('tag') || '';
    const availableTags = new Set(items.flatMap(({q}) => (q.tags||[]).filter(k => !Object.hasOwn(labels,k))));
    if (selectedTag) availableTags.add(selectedTag);
    const tagControl = controls.tag;
    tagControl.replaceChildren(new Option(t('All subtopics','所有细分知识点'),''));
    for (const tag of [...availableTags].sort((a,b) => (tags[a] || a).localeCompare(tags[b] || b,locale))) {
      tagControl.add(new Option(tags[tag] || tag,tag));
    }
    tagControl.value = selectedTag;
    const past = controls.kind.value === 'original' ? [] : items.filter(({q}) => !selectedTag || q.tags?.includes(selectedTag));
    const original = controls.kind.value === 'past' || fullOnly || selectedTag || controls.year.value ? [] : originals
      .filter(o => (key === 'all' || o.topic === key) && (!controls.exam.value || o.exam.includes(controls.exam.value)));
    const matched = [...past,...original];
    addResultsHeader(key === 'all' ? t('All topics','所有知识点') : labels[key],[
      qty(past.length,'past question','past questions','道真题'),qty(original.length,'original question','original questions','道原创题')
    ].join(' · '),worksheetHelp);
    if (!matched.length) results.append(node('p','arch-note',t('No questions match these filters. Try another year, exam or source.','未找到匹配题目，可以更换年份、考试或题目来源。')));
    showPage(matched,15,params,item => item.q ? questionRow(item.p,item.q,false) : practiceRow(item));
    addPickBar();
  }
  function render() {
    const params = new URLSearchParams(location.search);
    readControls(params);
    results.replaceChildren();
    if (isTopics) renderTopics(params); else renderPapers(params);
    results.setAttribute('aria-busy','false');
  }
  function scrollToResults() {
    root.querySelector(isTopics ? '#questions' : '[data-results]')?.scrollIntoView({block:'start'});
  }
  root.addEventListener('click',event => {
    if (event.target.closest('[data-clear-picked]')) {
      picked.clear(); root.querySelectorAll('[data-pick]').forEach(c => c.checked = false); addPickBar(); return;
    }
    const a = event.target.closest('a[data-nav],a[data-paper],a[data-topic]');
    if (!a || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    history.pushState(null,'',a.href);
    render(); scrollToResults();
  });
  root.addEventListener('change',event => {
    const pick = event.target.closest('[data-pick]');
    if (pick) {
      if (pick.checked) picked.add(pick.dataset.pick); else picked.delete(pick.dataset.pick);
      addPickBar(); return;
    }
    const entry = Object.entries(controls).find(([,field]) => field === event.target);
    if (!entry) return;
    const [key,field] = entry;
    const route = key === 'exam' && practiceRoute(field.value);
    if (route) { location.assign(prefix + route); return; }
    const changes = {page:'',paper:'',[key]:field.value};
    if (key === 'exam' || key === 'year') changes.tag = '';
    history.pushState(null,'',urlWith(changes)); render();
  });
  window.addEventListener('popstate',render);
  render();
}
