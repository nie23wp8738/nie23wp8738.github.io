import { createHash } from 'node:crypto';

// The solution booklet reuses the same print layout and equation renderer as the paper.
export function printableSolutions(edition, paper, answers) {
  const questions = edition.questions.filter(q => Object.hasOwn(answers, q.id)).map(q => {
    const { answer, methods } = answers[q.id];
    if (!answer?.trim() || !methods?.length) throw new Error('Missing worked solution for ' + q.id);
    const parts = [...(q.parts || [])];
    if (q.outro || q.outroFigure) parts.push({text:q.outro, figure:q.outroFigure});
    parts.push({label:'Answer', text:answer});
    for (const [i, method] of methods.entries()) {
      const topics = method.topics.map(topic => topic.en);
      if (!topics.length || topics.some(topic => !topic?.trim()) || !method.title || !method.steps?.length) {
        throw new Error('Missing method text or topics for ' + q.id);
      }
      const first = [method.title, 'Topics: ' + topics.join(', ')];
      if (method.credit) first.push('Adapted from the published solution by ' + method.credit + '.');
      first.push(method.steps[0]);
      parts.push({label:'Method ' + (i + 1), text:first.join('\n\n')});
      for (const text of method.steps.slice(1)) parts.push({text});
    }
    return {id:q.id, author:q.author, intro:q.intro, introFigure:q.introFigure, parts};
  });
  if (questions.length !== Object.keys(answers).length) throw new Error('Unknown solution ID in ' + paper.id);
  return {
    title:paper.label + ' — Worked solutions',
    source:{
      paperId:paper.id, credit:edition.credit, sourceURL:paper.solutionsUrl || edition.sourceURL,
      license:edition.license, licenseURL:edition.licenseURL,
      changes:'Problems retypeset. Adapted solution methods are credited individually.',
      questions
    }
  };
}

export function sourceDigest(source) {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}
