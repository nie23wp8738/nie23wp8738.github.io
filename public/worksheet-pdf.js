// A4 worksheet export using PDF's built-in Latin fonts. All sheet content is English.
const width = 595.28;
const height = 841.89;
const margin = 55;
const bodyWidth = width - 2 * margin;
const bottom = 65;

// Standard PDF font widths, in thousandths of an em, for ASCII 32 through 126.
const widths = {
  body: [
    250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,
    500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,
    921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,
    556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,
    333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,
    500,500,333,389,278,500,500,722,500,500,444,480,200,480,541
  ],
  label: [
    278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
    975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
    333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
    611,611,389,556,333,611,556,778,556,556,500,389,280,389,584
  ]
};

function escapePdf(value) {
  return value.replace(/[()\\]/g, (character) => '\\' + character);
}

function textWidth(value, font, size) {
  let total = 0;
  for (const character of value) total += widths[font][character.charCodeAt(0) - 32];
  return total * size / 1000;
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const combined = line ? line + ' ' + word : word;
    if (textWidth(combined, font, size) <= maxWidth) {
      line = combined;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    // Long mathematical expressions can have no suitable word boundary.
    for (const character of word) {
      if (line && textWidth(line + character, font, size) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(ops, value, x, y, size, font = 'body', gray = 0.1) {
  ops.push(`BT /${font} ${size} Tf ${gray} g 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(value)}) Tj ET`);
}

function drawRule(ops, y, gray) {
  ops.push(`${gray} G 0.6 w ${margin} ${y} m ${width - margin} ${y} l S`);
}

function plainLabel(value) {
  return String(value).normalize('NFKD').replace(/[–—]/g, '-').replace(/[’‘]/g, "'")
    .replace(/[^ -~]/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function sheetKind(problems, solutions) {
  const refs = problems.filter(p => p.kind === 'past' && (solutions || !p.inline?.pdf)).length;
  if (refs === 0) return solutions ? 'Solutions' : 'Question paper';
  if (refs === problems.length) return solutions ? 'Source guide' : 'Question references';
  return solutions ? 'Solutions and sources' : 'Questions and references';
}

function renderPages(problems, { solutions, layout, title }, questionStrips) {
  const pages = [];
  let ops;
  let links;
  let y;
  let currentProblem = 0;
  const kind = sheetKind(problems, solutions);

  function newPage(continuing = false) {
    ops = [];
    links = [];
    pages.push({ops, links, strips:[]});
    drawText(ops, 'DR.WANG', margin, height - 51, 11, 'label');
    const headerKind = kind.toUpperCase();
    drawText(ops, headerKind, width - margin - textWidth(headerKind, 'label', 9),
      height - 50, 9, 'label', 0.32);
    drawRule(ops, height - 64, 0.48);
    y = height - 99;
    if (pages.length === 1) {
      for (const line of wrap(title, 'body', 24, bodyWidth)) {
        drawText(ops, line, margin, y, 24);
        y -= 28;
      }
      const count = problems.length;
      drawText(ops, count + (count === 1 ? ' question' : ' questions'), margin, y + 5, 10, 'label', 0.36);
      y -= 33;
    } else if (continuing) {
      drawText(ops, 'Question ' + currentProblem + ' (continued)', margin, y, 11, 'label');
      y -= 26;
    }
  }

  function paragraph(value, font = 'body', size = 12, leading = 18) {
    for (const block of String(value).split(/\r?\n/)) {
      for (const line of wrap(block, font, size, bodyWidth)) {
        if (y < bottom) newPage(true);
        drawText(ops, line, margin, y, size, font);
        y -= leading;
      }
      y -= 4;
    }
  }

  function sourceLink(label, target) {
    const url = safeURL(target);
    if (!url) return;
    if (y - 17 < bottom) newPage(true);
    drawText(ops, label, margin, y, 10, 'label', .23);
    const right = margin + textWidth(label, 'label', 10);
    ops.push(`0.33 G 0.5 w ${margin} ${y-2} m ${right.toFixed(2)} ${y-2} l S`);
    links.push({ url, rect:[margin, y-3, right, y+10] });
    y -= 21;
  }

  function section(label, value) {
    const labelLines = wrap(label, 'label', 10, bodyWidth);
    if (y - labelLines.length * 15 - 18 < bottom) newPage(true);
    for (const line of labelLines) {
      drawText(ops, line, margin, y, 10, 'label', 0.25);
      y -= 15;
    }
    paragraph(value);
    y -= 5;
  }

  function richSourceLinks(problem) {
    let x = margin;
    for (const [label, target] of [['Original paper', problem.sourceURL], ['Licence', problem.inline.licenseUrl]]) {
      const url = safeURL(target);
      if (!url) continue;
      const right = x + textWidth(label, 'label', 9);
      drawText(ops, label, x, y, 9, 'label', .34);
      ops.push(`0.4 G 0.45 w ${x} ${y-2} m ${right.toFixed(2)} ${y-2} l S`);
      links.push({url, rect:[x, y-3, right, y+9]});
      x = right + 18;
    }
    y -= 14;
  }

  newPage();
  problems.forEach((problem, index) => {
    currentProblem = index + 1;
    const strips = questionStrips?.get(problem.id);
    const required = strips ? 37 + strips[0].height : 46;
    if (index > 0 && (layout === 'spaced' || y - required < bottom)) newPage();
    const heading = 'Question ' + currentProblem;
    drawText(ops, heading, margin, y, 14, 'label');
    if (Array.isArray(problem.exam)) {
      const exams = problem.exam.filter((item) => /^[A-Za-z0-9 ]{1,16}$/.test(item)).join(' / ');
      if (exams && textWidth(exams, 'label', 9) < bodyWidth / 2) {
        drawText(ops, exams, width - margin - textWidth(exams, 'label', 9), y + 1, 9, 'label', 0.36);
      }
    }
    y -= 23;
    if (strips) {
      richSourceLinks(problem);
      for (const strip of strips) {
        if (y - strip.height < bottom) newPage(true);
        y -= strip.height;
        pages[pages.length - 1].strips.push({...strip, x:margin, y});
      }
      y -= 22;
      return;
    }
    if (problem.kind === 'past') {
      const edition = plainLabel(problem.paperTitle) || plainLabel(problem.exam.join(' ') + ' ' + problem.year);
      paragraph(edition + ', Question ' + problem.n);
      sourceLink('Open original question', problem.sourceURL);
      if (solutions && problem.solutionURL) sourceLink('Open published solutions', problem.solutionURL);
      if (solutions && !problem.solutionURL) {
        paragraph('For solutions, consult the source if available.', 'body', 11, 16);
      }
      paragraph('Reference: ' + problem.permalink, 'body', 9, 14);
      y -= solutions ? 12 : 27;
      return;
    }
    paragraph(problem.statement);
    if (solutions) {
      y -= 4;
      section('Answer', problem.answer);
      for (const [methodIndex, method] of problem.solutions.entries()) {
        section('Method ' + (methodIndex + 1) + ' - ' + method.title, method.text);
      }
    }
    y -= solutions ? 15 : 32;
  });

  pages.forEach(({ops:page}, index) => {
    drawRule(page, 48, 0.72);
    drawText(page, 'DR.WANG Mathematics', margin, 32, 9, 'body', 0.34);
    const number = 'Page ' + (index + 1) + ' of ' + pages.length;
    drawText(page, number, width - margin - textWidth(number, 'body', 9), 32, 9, 'body', 0.34);
  });
  return pages;
}

function serializePages(pages, description) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '', // Filled after page objects have been numbered.
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${escapePdf(description)}) /Author (DR.WANG) >>`
  ];
  const pageRefs = [];
  for (const {ops:operators,links} of pages) {
    const pageId = objects.length + 1;
    pageRefs.push(pageId + ' 0 R');
    const annotations = links.length ? '/Annots [' + links.map((_, i) => (pageId + 2 + i) + ' 0 R').join(' ') + ']' : '';
    objects.push(
      `<< /Type /Page ${annotations} /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /body 3 0 R /label 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`
    );
    const stream = operators.join('\n') + '\n';
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    for (const {url,rect} of links) {
      objects.push(`<< /Type /Annot /Subtype /Link /Rect [${rect.map(x=>x.toFixed(2)).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${escapePdf(url)}) >> >>`);
    }
  }
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`;

  let file = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(file.length);
    file += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = file.length;
  file += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    file += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  file += `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([file], {type: 'application/pdf'});
}

async function buildRichWorksheet(problems, options, description) {
  const {PDFDocument} = await import('/worksheet-engine.js');
  const assets = new Map();
  const strips = new Map();
  for (const problem of problems) {
    if (problem.kind !== 'past' || !problem.inline?.pdf) continue;
    const url = new URL(problem.inline.pdf, location.origin);
    if (url.origin !== location.origin) throw new Error('Invalid question PDF location.');
    if (!assets.has(url.href)) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Question PDF unavailable.');
      const document = await PDFDocument.load(await response.arrayBuffer());
      const parts = document.getPages().map(page => {
        const size = page.getSize();
        const scale = Math.min(1, bodyWidth / size.width);
        const height = size.height * scale;
        if (!(height > 0 && height < 575)) throw new Error('Invalid question PDF height.');
        return {page, width:size.width * scale, height};
      });
      if (!parts.length) throw new Error('Empty question PDF.');
      assets.set(url.href, parts);
    }
    strips.set(problem.id, assets.get(url.href));
  }
  const pages = renderPages(problems, options, strips);
  const base = serializePages(pages, description);
  const output = await PDFDocument.load(await base.arrayBuffer());
  const embedded = new Map();
  for (const [index, page] of pages.entries()) {
    const target = output.getPage(index);
    for (const strip of page.strips) {
      if (!embedded.has(strip.page)) embedded.set(strip.page, await output.embedPage(strip.page));
      target.drawPage(embedded.get(strip.page), {x:strip.x, y:strip.y, width:strip.width, height:strip.height});
    }
  }
  return new Blob([await output.save()], {type:'application/pdf'});
}

export async function downloadWorksheet(problems, { solutions = false, layout = 'spaced', title = 'Mathematics Practice' } = {}) {
  if (!problems.length) throw new Error('Select at least one problem.');
  // The stored statements and methods are intentionally written in printable ASCII.
  // Avoid an unsupported browser-provided title corrupting the PDF byte offsets.
  title = String(title).replace(/[^ -~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Mathematics Practice';
  for (const problem of problems) {
    if (problem.kind === 'past') {
      if (!Number.isInteger(problem.n) || !safeURL(problem.sourceURL) || !safeURL(problem.permalink)) {
        throw new Error('Invalid past-paper reference.');
      }
      continue;
    }
    const fields = [problem.statement];
    if (solutions) {
      fields.push(problem.answer, ...problem.solutions.flatMap(method => [method.title, method.text]));
    }
    if (fields.some(value => typeof value !== 'string' || /[^\x20-\x7e\t\r\n]/.test(value))) {
      throw new Error('This worksheet requires English printable text.');
    }
  }

  const kind = sheetKind(problems, solutions);
  const description = title + ' - ' + kind;
  const options = {solutions, layout, title};
  const hasInline = !solutions && problems.some(p => p.kind === 'past' && p.inline?.pdf);
  const blob = hasInline ? await buildRichWorksheet(problems, options, description)
    : serializePages(renderPages(problems, options), description);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'DR-WANG-' + (kind === 'Question paper' ? 'Questions' : kind.replaceAll(' ', '-')) + '.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
