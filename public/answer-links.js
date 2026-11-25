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
