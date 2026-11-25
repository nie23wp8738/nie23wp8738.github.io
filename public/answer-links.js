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
  return question.inline || question.hasCommentary
    ? '/questions/' + encodeURIComponent(id) + '/'
    : '/questions/entry/?' + new URLSearchParams({id});
}

export function hasWorkedSolution(q) {
  return Boolean(q.hasWorkedSolution || q.inline?.solutionPdf);
}

export function matchesReading(q, reading) {
  if (reading === 'full') return Boolean(q.inline);
  if (reading === 'solutions') return hasWorkedSolution(q);
  if (reading === 'answers') return hasWorkedSolution(q) || q.keyAnswer != null;
  return true;
}

export function answerLabel(q, t) {
  if (hasWorkedSolution(q)) return t('Answer & methods', '站内答案与解法');
  if (q.keyAnswer != null) return t('Answer key', '站内答案');
  return '';
}
