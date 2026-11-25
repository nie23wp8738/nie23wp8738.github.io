import mathematics from '../data/problems.json';
import tara from '../data/tara-originals.json';

const problems = [...mathematics, ...tara];
for (const problem of problems) {
  if (!problem.statement?.trim() || !problem.statementZh?.trim() || !problem.hint?.trim() || !problem.hintZh?.trim() ||
      !problem.answer?.trim() || !problem.answerZh?.trim() || !problem.solutions?.length) {
    throw new Error('Incomplete bilingual original problem: ' + problem.id);
  }
  for (const method of problem.solutions) {
    if (!method.title || !method.titleZh || !method.text || !method.textZh ||
        !method.topics?.length || method.topics.some(topic => !topic.en || !topic.zh)) {
      throw new Error('Incomplete bilingual original solution: ' + problem.id);
    }
  }
}
for (const q of tara) {
  if (q.module === 'writing-task') continue;
  const key = q.correctOption;
  if (!Number.isInteger(key) || key < 0 || key > 4 || q.options?.length !== 5 ||
      q.optionsZh?.length !== q.options.length || q.optionsZh.some(option => !option.trim()) ||
      q.answer !== 'ABCDE'[key] + '. ' + q.options[key]) {
    throw new Error('Mismatched multiple-choice answer for ' + q.id);
  }
}
export default problems;
