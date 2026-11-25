function startBank(root) {
  const data = JSON.parse(root.querySelector('[data-problem-data]').textContent);
  const byId = new Map(data.map(problem => [problem.id, problem]));
  const cards = [...root.querySelectorAll('[data-problem]')];
  const normalized = value => value.normalize('NFKC').toLocaleLowerCase().trim();
  const searchText = new Map(data.map(problem => [problem.id, normalized([
    problem.id, problem.title, ...problem.exam, problem.topic, problem.method,
    problem.level, problem.statement,
  ].join(' '))]));
  const form = root.querySelector('[data-filters]');
  const list = root.querySelector('[data-selected]');
  const status = root.querySelector('[data-status]');
  const filterKeys = ['q', 'exam', 'topic', 'method', 'level'];
  const storageKey = 'drwang.worksheet.v1';
  let selected = [];
  let layout = 'spaced';
  let busy = false;
  let dragging = null;

  function restore(raw) {
    try {
      const saved = JSON.parse(raw || '{}');
      selected = Array.isArray(saved?.ids) ? [...new Set(saved.ids)].filter(id => byId.has(id)) : [];
      layout = saved?.layout === 'compact' ? 'compact' : 'spaced';
    } catch {
      selected = [];
      layout = 'spaced';
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ids: selected, layout }));
    } catch {
      // Browsing and downloads also work without persistent storage.
    }
  }

  function updateFilters(syncAddress) {
    const values = Object.fromEntries(new FormData(form));
    const tokens = normalized(values.q).split(/\s+/u).filter(Boolean);
    let count = 0;
    cards.forEach(card => {
      const problem = byId.get(card.dataset.problem);
      const fits = (!values.exam || problem.exam.includes(values.exam))
        && (!values.topic || problem.topic === values.topic)
        && (!values.method || problem.method === values.method)
        && (!values.level || problem.level === values.level)
        && tokens.every(token => searchText.get(problem.id).includes(token));
      card.hidden = !fits;
      if (fits) count++;
    });
    root.querySelector('[data-results]').textContent = '共 ' + count + ' 道题';
    root.querySelector('[data-none]').hidden = count > 0;
    root.querySelector('[data-reset]').hidden = !filterKeys.some(key => values[key]);
    if (syncAddress) {
      const url = new URL(location.href);
      filterKeys.forEach(key => {
        if (values[key]) url.searchParams.set(key, values[key]);
        else url.searchParams.delete(key);
      });
      history.replaceState(null, '', url);
    }
  }

  function readFilters() {
    const params = new URLSearchParams(location.search);
    filterKeys.forEach(key => { form.elements.namedItem(key).value = params.get(key) || ''; });
    updateFilters(false);
  }

  function toolButton(action, label, accessibleLabel, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.textContent = label;
    button.setAttribute('aria-label', accessibleLabel);
    button.title = accessibleLabel;
    button.disabled = disabled;
    return button;
  }

  function renderSheet() {
    list.replaceChildren();
    selected.forEach((id, index) => {
      const problem = byId.get(id);
      const item = document.createElement('li');
      item.dataset.selectedId = id;
      item.draggable = true;
      const name = document.createElement('a');
      name.href = '/problems/' + encodeURIComponent(id) + '/';
      name.textContent = problem.title;
      const controls = document.createElement('div');
      controls.className = 'bank-row-controls';
      controls.append(
        toolButton('up', '上移', '上移「' + problem.title + '」', index === 0),
        toolButton('down', '下移', '下移「' + problem.title + '」', index === selected.length - 1),
        toolButton('remove', '移除', '移除「' + problem.title + '」')
      );
      item.append(name, controls);
      list.append(item);
    });
    const chosen = new Set(selected);
    root.querySelectorAll('[data-add]').forEach(button => {
      const active = chosen.has(button.dataset.add);
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? '已加入' : '加入试卷';
      button.title = active ? '从试卷移除这道题' : '将这道题加入试卷';
    });
    root.querySelector('[data-empty]').hidden = selected.length > 0;
    root.querySelector('[data-sheet-actions]').hidden = selected.length === 0;
    root.querySelector('[data-sheet-count]').textContent = selected.length + ' 道题';
    root.querySelector('[data-mobile-count]').textContent = selected.length;
    root.querySelectorAll('[name="paper-layout"]').forEach(input => {
      input.checked = input.value === layout;
    });
    root.querySelectorAll('[data-pdf]').forEach(button => {
      button.disabled = busy || selected.length === 0;
    });
  }

  function commit(message) {
    save();
    renderSheet();
    status.textContent = message;
  }

  try { restore(localStorage.getItem(storageKey)); } catch { restore(null); }
  const initialURL = new URL(location.href);
  const incoming = initialURL.searchParams.get('add');
  if (byId.has(incoming) && !selected.includes(incoming)) {
    selected.push(incoming);
    save();
    status.textContent = '已加入「' + byId.get(incoming).title + '」。';
  }
  if (initialURL.searchParams.has('add')) {
    initialURL.searchParams.delete('add');
    history.replaceState(null, '', initialURL);
  }
  readFilters();
  renderSheet();
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => updateFilters(true));
  window.addEventListener('popstate', readFilters);
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      restore(event.newValue);
      renderSheet();
    }
  });

  root.querySelector('[data-reset]').addEventListener('click', () => {
    form.reset();
    updateFilters(true);
    form.elements.namedItem('q').focus();
  });
  root.querySelector('.bank-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-add]');
    if (!button) return;
    const id = button.dataset.add;
    const active = selected.includes(id);
    selected = active ? selected.filter(saved => saved !== id) : [...selected, id];
    commit((active ? '已移除「' : '已加入「') + byId.get(id).title + '」。');
  });
  root.querySelector('[data-clear]').addEventListener('click', () => {
    selected = [];
    commit('试卷已清空。');
    form.elements.namedItem('q').focus();
  });
  root.querySelector('.bank-layout').addEventListener('change', event => {
    layout = event.target.value;
    save();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.closest('li').dataset.selectedId;
    const previousIndex = selected.indexOf(id);
    const action = button.dataset.action;
    const name = byId.get(id).title;
    let focusId = id;
    if (action === 'remove') {
      selected.splice(previousIndex, 1);
      focusId = selected[Math.min(previousIndex, selected.length - 1)];
      commit('已移除「' + name + '」。');
    } else {
      const nextIndex = previousIndex + (action === 'up' ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= selected.length) return;
      [selected[previousIndex], selected[nextIndex]] = [selected[nextIndex], selected[previousIndex]];
      commit('「' + name + '」已移至第 ' + (nextIndex + 1) + ' 题。');
    }
    const nextRow = [...list.children].find(row => row.dataset.selectedId === focusId);
    if (nextRow) {
      const target = nextRow.querySelector('[data-action="' + action + '"]:not(:disabled)') || nextRow.querySelector('button:not(:disabled)');
      target?.focus();
    } else {
      root.querySelector('[data-add="' + id + '"]')?.focus();
    }
  });
  list.addEventListener('dragstart', event => {
    const row = event.target.closest('li');
    if (!row || !event.dataTransfer) return;
    dragging = row.dataset.selectedId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragging);
    row.classList.add('bank-dragging');
  });
  list.addEventListener('dragover', event => {
    if (!dragging || !event.target.closest('li')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', event => {
    if (!dragging) return;
    event.preventDefault();
    const target = event.target.closest('li')?.dataset.selectedId;
    const from = selected.indexOf(dragging);
    const to = selected.indexOf(target);
    if (from >= 0 && to >= 0 && from !== to) {
      selected.splice(to, 0, selected.splice(from, 1)[0]);
      commit('已调整试卷题序。');
    }
    dragging = null;
  });
  list.addEventListener('dragend', () => {
    dragging = null;
    list.querySelector('.bank-dragging')?.classList.remove('bank-dragging');
  });

  root.querySelector('.bank-downloads').addEventListener('click', async event => {
    const button = event.target.closest('button[data-pdf]');
    if (!button || busy || !selected.length) return;
    const solutions = button.dataset.pdf === 'solutions';
    const paper = selected.map(id => byId.get(id));
    busy = true;
    renderSheet();
    status.textContent = '正在生成 PDF…';
    try {
      const { downloadWorksheet } = await import('/worksheet-pdf.js');
      await downloadWorksheet(paper, { solutions, layout, title: 'Mathematics Practice' });
      status.textContent = solutions ? '解析卷已生成。' : '题目卷已生成。';
    } catch (error) {
      console.error('Worksheet download failed', error);
      status.textContent = 'PDF 生成失败，请刷新后再试。';
    } finally {
      busy = false;
      renderSheet();
    }
  });
}

const bank = document.querySelector('[data-bank]');
if (bank) startBank(bank);
