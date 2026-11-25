function startBank(root) {
  const zh = root.dataset.lang === 'zh';
  const t = (en, cn) => zh ? cn : en;
  const prefix = zh ? '/zh' : '';
  const countLabel = n => t(n + (n === 1 ? ' question' : ' questions'), n + ' 道题');
  const compact = s => String(s || '').normalize('NFKC').toLocaleLowerCase().trim();
  const get = name => root.querySelector('[data-' + name + ']');
  const form = get('filters');
  const control = key => form.elements.namedItem(key);
  const list = get('list');
  const chosenList = get('selected');
  const topicNames = new Map([...control('topic').options].map(o => [o.value,o.text]));
  const translations = JSON.parse(get('tag-translations').textContent);
  const originals = JSON.parse(get('practice-data').textContent).map(p => ({
    ...p, kind:'practice', topicKeys:[p.topicKey], href:prefix + '/problems/' + p.id + '/',
    search:compact([p.id,p.title,...p.exam,p.topic,p.method,p.level,p.statement].join(' ')),
  }));
  const byId = new Map(originals.map(q => [q.id, q]));
  const originalExams = [...new Set(originals.flatMap(q => q.exam))];
  const storageKey = 'drwang.worksheet.v1';
  const pageSize = 20;
  let past = [], sourceState = 'loading', selected = [], layout = 'spaced', exporting = false, dragId;
  let page = 1, maxPages = 1;
  const filters = ['kind','q','exam','topic','year','number','method','level'];
  function el(tag, text, cls) {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (cls) item.className = cls;
    return item;
  }
  function link(label, url, cls) {
    const a = el('a',label,cls); a.href = url; return a;
  }
  function safeWebURL(input) {
    try { const u = new URL(input); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  }
  function loadPapers(papers) {
    const questions = [];
    for (const paper of papers) {
      if (!paper.id || !paper.year || !paper.exam || !paper.url) continue;
      const label = paper.label || paper.exam;
      const titleParts = [];
      if (!String(label).includes(String(paper.year))) titleParts.push(paper.year);
      if (!compact(label).replace(/\s+/g,'').includes(compact(paper.exam).replace(/\s+/g,''))) titleParts.push(paper.exam);
      titleParts.push(label);
      const paperTitle = titleParts.join(' ');
      for (const q of paper.questions || []) {
        if (!Number.isInteger(q.n) || q.n <= 0) continue;
        const id = paper.id + '-q' + q.n;
        const tags = q.tags || [];
        const concepts = tags.filter(key => !topicNames.has(key)).map(tag => translations[tag] || tag);
        const topicKeys = [...new Set([q.topic,...(q.topics || []),...tags].filter(key => key && topicNames.has(key)))];
        const topic = topicKeys.map(key => topicNames.get(key)).join(zh ? '、' : ' · ');
        const path = '/past-papers/?paper=' + encodeURIComponent(paper.id) + '#q-' + q.n;
        const record = {
          id, kind:'past', paperId:paper.id, paperTitle, n:q.n, year:String(paper.year), exam:[paper.exam],
          source:paper.source, sourceURL:safeWebURL(q.url) || safeWebURL(paper.url), solutionURL:safeWebURL(q.solutionsUrl) || safeWebURL(paper.solutionsUrl),
          title:paperTitle + t(' · Question ',' · 第 ') + q.n + (zh ? ' 题' : ''), topicKeys, topic, concepts,
          href:prefix + path, permalink:'https://nie23wp8738.github.io' + path,
          search:compact([paper.id,paper.exam,label,paper.year,'Q'+q.n,'#'+q.n,'question '+q.n,'problem '+q.n,'第'+q.n+'题',topic,...topicKeys,...tags,...concepts].join(' ')),
        };
        byId.set(id, record); questions.push(record);
      }
    }
    past = questions.sort((a,b) => Number(b.year)-Number(a.year) || a.paperTitle.localeCompare(b.paperTitle,'en',{numeric:true}) || a.n-b.n);
  }
  function readStorage(raw) {
    try {
      const saved = JSON.parse(raw || '{}');
      selected = Array.isArray(saved?.ids) ? [...new Set(saved.ids.filter(id => typeof id === 'string'))] : [];
      layout = saved?.layout === 'compact' ? 'compact' : 'spaced';
    } catch { selected = []; layout = 'spaced'; }
  }
  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify({ids:selected,layout})); } catch {}
  }
  function replaceOptions(select, items, defaultText) {
    const previous = select.value;
    select.replaceChildren(new Option(defaultText,''));
    for (const value of items) select.add(new Option(value,value));
    if (items.includes(previous)) select.value = previous;
  }
  function refreshMode() {
    const historical = control('kind').value === 'past';
    root.querySelectorAll('[data-past-only]').forEach(x => { x.hidden = !historical; x.querySelector('input,select').disabled = !historical; });
    root.querySelectorAll('[data-practice-only]').forEach(x => { x.hidden = historical; x.querySelector('select').disabled = historical; });
    const exams = historical ? [...new Set(past.map(q=>q.exam[0]))] : originalExams;
    replaceOptions(control('exam'),exams.sort(),t('All exams','全部考试'));
    control('q').placeholder = historical ? t('Exam, year, paper or question number','考试、年份、试卷或题号') : t('Title, keyword or question text','题名、关键词或英文题干');
  }
  function syncURL() {
    const url = new URL(location.href);
    const data = new FormData(form);
    for (const key of filters) {
      const val = data.get(key);
      if (!val || (key === 'kind' && val === 'past')) url.searchParams.delete(key);
      else url.searchParams.set(key,val);
    }
    history.replaceState(null,'',url);
    // The global language switch should carry the current filter state.
    window.dispatchEvent(new Event('bank:urlchange'));
  }
  function applyURL() {
    const params = new URLSearchParams(location.search);
    const kind = params.get('kind') || (params.has('method') || params.has('level') ? 'practice' : 'past');
    control('kind').value = kind === 'practice' ? 'practice' : 'past';
    refreshMode();
    for (const key of filters.slice(1)) {
      const field = control(key), value = params.get(key) || '';
      field.value = value;
      // Old shared topic and level URLs used localized labels.
      if (value && !field.value && field.options) {
        const matching = [...field.options].find(o=>o.text === value);
        if (matching) field.value = matching.value;
        else if (key === 'topic') field.value = originals.find(p=>p.topic===value)?.topicKey || '';
      }
    }
    page = 1; renderResults();
  }
  function addButton(q) {
    const button = el('button');
    button.type = 'button'; button.dataset.add = q.id;
    styleAddButton(button,selected.includes(q.id));
    return button;
  }
  function styleAddButton(button,added) {
    button.setAttribute('aria-pressed',String(added));
    button.textContent = added ? t('Added','已加入') : t('Add to worksheet','加入试卷');
    button.title = added ? t('Remove from worksheet','从试卷中移除') : t('Add to worksheet','加入试卷');
  }
  function renderCard(q) {
    const isPast = q.kind === 'past';
    const article = el('article',null,'bank-card' + (isPast ? ' bank-past-card' : ''));
    article.dataset.problem = q.id;
    const meta = el('div',null,'bank-card-meta');
    for(const tag of [q.exam.join(' / '),q.topic,isPast ? null : q.level].filter(Boolean)) meta.append(el('span',tag));
    const heading = el('h3'); heading.append(link(q.title,q.href));
    article.append(meta,heading);
    if (isPast && q.concepts.length) {
      article.append(el('p',q.concepts.join(zh ? '、' : ' · '),'bank-source-block'));
    }
    if (!isPast) {
      const statement = el('p',q.statement); statement.lang = 'en'; article.append(statement);
    }
    const foot = el('div',null,'bank-card-foot');
    foot.append(isPast ? link(t('Open original question','打开原题'),q.sourceURL,'bank-card-source') : el('span',q.method),addButton(q));
    article.append(foot); return article;
  }
  function renderResults() {
    const values = Object.fromEntries(new FormData(form));
    const isPast = values.kind === 'past';
    const tokens = compact(values.q).split(/\s+/u).filter(Boolean);
    const filtered = (isPast ? past : originals).filter(q =>
      (!values.exam || q.exam.includes(values.exam)) && (!values.topic || q.topicKeys.includes(values.topic))
      && (!values.year || q.year === values.year) && (!values.number || String(q.n) === values.number)
      && (!values.method || q.methodKey === values.method) && (!values.level || q.levelKey === values.level)
      && tokens.every(word=>q.search.includes(word)));
    maxPages = Math.max(1,Math.ceil(filtered.length / pageSize));
    page = Math.max(1,Math.min(maxPages,page));
    list.replaceChildren(...filtered.slice((page-1)*pageSize,page*pageSize).map(renderCard));
    const pending = isPast && sourceState !== 'ready';
    get('results').textContent = pending && sourceState === 'loading' ? t('Loading questions…','正在载入题目…') : countLabel(filtered.length);
    get('none').hidden = filtered.length > 0 || pending;
    get('source-error').hidden = sourceState !== 'error';
    get('reset').hidden = !filters.slice(1).some(key=>values[key]);
    get('pager').hidden = maxPages === 1;
    get('prev').disabled = page <= 1; get('next').disabled = page >= maxPages;
    get('page').textContent = t('Page '+page+' of '+maxPages,'第 '+page+' / '+maxPages+' 页');
  }
  function renderSheet() {
    const rows = selected.map(id => byId.get(id)).filter(Boolean);
    chosenList.replaceChildren();
    rows.forEach((q, i) => {
      const li = el('li'); li.dataset.selectedId = q.id; li.draggable = true;
      li.append(link(q.title,q.href));
      const controls = el('div',null,'bank-row-controls');
      for (const [action,label] of [['up',t('Up','上移')],['down',t('Down','下移')],['remove',t('Remove','移除')]]) {
        const button = el('button',label); button.type='button';button.dataset.action=action;
        button.disabled = (action==='up' && i===0) || (action==='down' && i===rows.length-1);
        button.setAttribute('aria-label',label + ' · '+q.title); controls.append(button);
      }
      li.append(controls); chosenList.append(li);
    });
    const known = new Set(selected);
    list.querySelectorAll('[data-add]').forEach(b=>styleAddButton(b,known.has(b.dataset.add)));
    const refs = rows.filter(q=>q.kind==='past').length;
    get('sheet-count').textContent = countLabel(rows.length);
    get('mobile-count').textContent = rows.length;
    get('empty').hidden = rows.length>0; get('sheet-actions').hidden=rows.length===0;
    get('reference-note').hidden=refs===0;
    root.querySelectorAll('[name=paper-layout]').forEach(input=>input.checked=input.value===layout);
    root.querySelectorAll('[data-pdf]').forEach(b=>b.disabled=exporting || rows.length===0 || rows.length!==selected.length);
    const answers = root.querySelector('[data-pdf=solutions]');
    answers.textContent = refs === 0 ? t('Download solutions PDF','下载解析卷 PDF') : refs === rows.length ?
      t('Download source guide PDF','下载题源索引 PDF') : t('Download solutions & sources PDF','下载解析与题源 PDF');
  }
  function changed(message) { save(); renderSheet(); get('status').textContent=message; }
  function addIncoming() {
    const url = new URL(location.href); const ids=url.searchParams.getAll('add');
    if (!ids.length) return;
    const available = [...new Set(ids)].filter(id=>byId.has(id));
    for(const id of available) if (!selected.includes(id)) selected.push(id);
    if (available.length) changed(t('Worksheet updated.','试卷已更新。'));
    const waitForSources = sourceState !== 'ready' && available.length !== new Set(ids).size;
    if (!waitForSources) { url.searchParams.delete('add'); history.replaceState(null,'',url); }
    if (!available.length && sourceState==='ready') get('status').textContent=t('These questions could not be found.','未找到指定题目。');
  }
  async function loadArchive() {
    sourceState='loading';renderResults();
    try {
      const resp=await fetch('/past-data.json'); if (!resp.ok) throw Error('HTTP '+resp.status);
      const records=await resp.json(); if(!Array.isArray(records)) throw Error('Invalid archive data');
      loadPapers(records); sourceState='ready';
      replaceOptions(control('year'),[...new Set(past.map(q=>q.year))].sort((a,b)=>Number(b)-Number(a)),t('All years','全部年份'));
      selected=selected.filter(id=>byId.has(id)); save(); addIncoming(); applyURL(); renderSheet();
    } catch {
      sourceState='error'; renderResults(); renderSheet();
    }
  }
  try { readStorage(localStorage.getItem(storageKey)); } catch { readStorage(null); }
  applyURL(); addIncoming(); renderSheet(); loadArchive();
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('input',e=>{
    page=1;
    if(e.target.name==='kind') refreshMode();
    syncURL(); renderResults();
  });
  get('retry').addEventListener('click',loadArchive);
  window.addEventListener('popstate',applyURL);
  window.addEventListener('storage',e=>{ if(e.key===storageKey || e.key===null) { readStorage(e.newValue);renderSheet(); }});
  get('reset').addEventListener('click',()=>{for(const key of filters.slice(1)) control(key).value='';page=1;syncURL();renderResults();control('q').focus();});
  for(const [key,step] of [['prev',-1],['next',1]]) get(key).addEventListener('click',()=>{
    page+=step;renderResults();get('results').scrollIntoView({block:'start'});const first=list.querySelector('a');first?.focus({preventScroll:true});
  });
  list.addEventListener('click',e=>{
    const b=e.target.closest('[data-add]');if(!b) return;
    const id=b.dataset.add,exists=selected.includes(id);
    selected=exists ? selected.filter(item=>item!==id) : [...selected,id];
    changed(exists ? t('Question removed.','已移除题目。') : t('Question added.','已加入题目。'));
  });
  get('clear').addEventListener('click',()=>{selected=[];changed(t('Worksheet cleared.','试卷已清空。'));});
  root.querySelector('.bank-layout').addEventListener('change',e=>{layout=e.target.value;save();});
  chosenList.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b) return;
    const id=b.closest('li').dataset.selectedId,from=selected.indexOf(id);
    const action=b.dataset.action;
    let focusId=id;
    if(action==='remove') { selected.splice(from,1);focusId=selected[Math.min(from,selected.length-1)]; }
    else {
      const to=from+(action==='up'?-1:1);
      if(to<0 || to>=selected.length) return;
      [selected[from], selected[to]] = [selected[to], selected[from]];
    }
    changed(action==='remove' ? t('Question removed.','已移除题目。') : t('Question order updated.','题序已调整。'));
    const next=[...chosenList.children].find(row=>row.dataset.selectedId===focusId);
    if(next) (next.querySelector('[data-action="'+action+'"]:not(:disabled)') || next.querySelector('button:not(:disabled)')).focus();
    else control('q').focus();
  });
  chosenList.addEventListener('dragstart',e=>{const li=e.target.closest('li'); if(li && e.dataTransfer){dragId=li.dataset.selectedId;e.dataTransfer.setData('text/plain',dragId);li.classList.add('bank-dragging');}});
  chosenList.addEventListener('dragover',e=>{if(dragId && e.target.closest('li'))e.preventDefault();});
  chosenList.addEventListener('drop',e=>{
    if(!dragId)return; e.preventDefault();
    const from=selected.indexOf(dragId),to=selected.indexOf(e.target.closest('li')?.dataset.selectedId);
    if(from>=0 && to>=0 && from!==to){selected.splice(to,0,selected.splice(from,1)[0]);changed(t('Question order updated.','题序已调整。'));}
    dragId=null;
  });
  chosenList.addEventListener('dragend',()=>{dragId=null;chosenList.querySelector('.bank-dragging')?.classList.remove('bank-dragging');});
  root.querySelector('.bank-downloads').addEventListener('click',async e=>{
    const b=e.target.closest('[data-pdf]'); if(!b || exporting || !selected.length)return;
    exporting=true;renderSheet();get('status').textContent=t('Preparing PDF…','正在生成 PDF…');
    try{
      const {downloadWorksheet}=await import('/worksheet-pdf.js');
      await downloadWorksheet(selected.map(id=>byId.get(id)),{solutions:b.dataset.pdf==='solutions',layout});
      get('status').textContent=t('PDF downloaded.','PDF 已生成。');
    }catch {get('status').textContent=t('Could not create the PDF. Please try again.','PDF 生成失败，请重试。');}
    finally {exporting=false;renderSheet();}
  });
}
const root = document.querySelector('[data-bank]');
if(root) startBank(root);
