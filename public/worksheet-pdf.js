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

function renderPages(problems, { solutions, layout, title }) {
  const pages = [];
  let ops;
  let y;
  let currentProblem = 0;
  const kind = solutions ? 'Solutions' : 'Question paper';

  function newPage(continuing = false) {
    ops = [];
    pages.push(ops);
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

  newPage();
  problems.forEach((problem, index) => {
    currentProblem = index + 1;
    if (index > 0 && (layout === 'spaced' || y - 46 < bottom)) newPage();
    const heading = 'Question ' + currentProblem;
    drawText(ops, heading, margin, y, 14, 'label');
    if (Array.isArray(problem.exam)) {
      const exams = problem.exam.filter((item) => /^[A-Za-z0-9 ]{1,16}$/.test(item)).join(' / ');
      if (exams && textWidth(exams, 'label', 9) < bodyWidth / 2) {
        drawText(ops, exams, width - margin - textWidth(exams, 'label', 9), y + 1, 9, 'label', 0.36);
      }
    }
    y -= 23;
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

  pages.forEach((page, index) => {
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
  for (const operators of pages) {
    const pageId = objects.length + 1;
    pageRefs.push(pageId + ' 0 R');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /body 3 0 R /label 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`
    );
    const stream = operators.join('\n') + '\n';
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
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

export function downloadWorksheet(problems, { solutions = false, layout = 'spaced', title = 'Mathematics Practice' } = {}) {
  if (!problems.length) throw new Error('Select at least one problem.');
  // The stored statements and methods are intentionally written in printable ASCII.
  // Avoid an unsupported browser-provided title corrupting the PDF byte offsets.
  title = String(title).replace(/[^ -~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Mathematics Practice';
  for (const problem of problems) {
    const fields = [problem.statement];
    if (solutions) {
      fields.push(problem.answer, ...problem.solutions.flatMap(method => [method.title, method.text]));
    }
    if (fields.some(value => typeof value !== 'string' || /[^\x20-\x7e\t\r\n]/.test(value))) {
      throw new Error('This worksheet requires English printable text.');
    }
  }

  const description = title + (solutions ? ' - Solutions' : ' - Question paper');
  const pages = renderPages(problems, { solutions, layout, title });
  const blob = serializePages(pages, description);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'DR-WANG-' + (solutions ? 'Solutions' : 'Questions') + '.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
