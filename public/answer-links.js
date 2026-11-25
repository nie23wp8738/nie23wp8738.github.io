// An AMC/AIME problem page on LIVE contains the question and its worked answer.
// The other archives distinguish single-question solutions from whole-paper guides.
const liveQuestion = /^https:\/\/live\.poshenloh\.com\/past-contests\/(?:amc8|amc10|amc12|aime)\/\d{4}[a-z]*\/problem\/(\d+)\/?$/i;

export function sourceAnswer(paper, question) {
  if (question.solutionsUrl) return {url:question.solutionsUrl, scope:'question'};
  const match = liveQuestion.exec(question.url || '');
  if (match && Number(match[1]) === question.n) return {url:question.url, scope:'question'};
  if (paper.solutionsUrl) return {url:paper.solutionsUrl, scope:'paper'};
  return null;
}

export function questionPath(id, question) {
  return question.inline || question.hasCommentary || question.outlinePdf
    ? '/questions/' + encodeURIComponent(id) + '/'
    : '/questions/entry/?' + new URLSearchParams({id});
}

export function hasWorkedSolution(q) {
  return Boolean(q.hasWorkedSolution || q.inline?.solutionPdf);
}

export function matchesReading(q, reading) {
  if (reading === 'full') return Boolean(q.inline || q.hasCommentary || q.outlinePdf || q.published?.collection === 'euclid');
  if (reading === 'solutions') return hasWorkedSolution(q) || Boolean(q.outlinePdf) || q.published?.collection === 'euclid';
  if (reading === 'allsolutions') return hasWorkedSolution(q) || Boolean(q.published);
  if (reading === 'answers') return hasWorkedSolution(q) || Boolean(q.published) || q.keyAnswer != null;
  return true;
}

export function answerLabel(q, t) {
  if (hasWorkedSolution(q)) return t('Answer & methods', '站内答案与解法');
  if (q.outlinePdf) return t('Answer & worked solution', '站内答案与解法');
  if (q.published?.collection === 'euclid') return t('Official question and solution (English)', '站内官方原题与解答（英文）');
  if (q.published?.collection === 'step') return t('Worked solution · question at source', '站内双语解法 · 题干见原卷');
  if (q.keyAnswer != null) return t('Answer key', '站内答案');
  return '';
}
