export const coverageStates = ['bilingual', 'officialEnglish', 'solutionOnly', 'keyOnly', 'sourceOnly'];

export function coverageOf(papers) {
  const empty = () => ({total:0,bilingual:0,officialEnglish:0,solutionOnly:0,keyOnly:0,sourceOnly:0});
  const total = empty();
  const exams = {};
  for (const p of papers) {
    const exam = exams[p.exam] ??= empty();
    for (const q of p.questions) {
      let state = 'sourceOnly';
      if (((q.hasCommentary || q.inline) && q.hasWorkedSolution) || (q.outlinePdf && q.published?.collection === 'step')) state = 'bilingual';
      else if (q.published?.collection === 'euclid') state = 'officialEnglish';
      else if (q.published) state = 'solutionOnly';
      else if (q.keyAnswer) state = 'keyOnly';
      exam[state]++; exam.total++; total[state]++; total.total++;
    }
  }
  return {total,exams};
}
