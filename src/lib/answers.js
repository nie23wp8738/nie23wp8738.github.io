const files = import.meta.glob('../data/answers/*.json', { eager: true, import: 'default' });
const answers = new Map();
for (const file of Object.values(files)) {
  for (const [id, answer] of Object.entries(file)) {
    if (answers.has(id) || !answer.answer || !answer.answerZh || !answer.methods?.length) {
      throw new Error('Missing or duplicate worked answer for ' + id);
    }
    for (const method of answer.methods) {
      if (!method.title || !method.titleZh || !method.steps?.length || !method.stepsZh?.length ||
          !method.topics?.length || method.topics.some(topic => !topic.en || !topic.zh)) {
        throw new Error('Incomplete bilingual solution method in ' + id);
      }
    }
    answers.set(id, answer);
  }
}
export function getWorkedAnswer(id) { return answers.get(id); }

export function originalAnswer(problem) {
  return {
    answer:problem.answer, answerZh:problem.answerZh || problem.answer,
    methods: problem.solutions.map(method => ({
      title:method.title, titleZh:method.titleZh || method.title,
      steps:[method.text], stepsZh:[method.textZh || method.text], topics:method.topics || [],
    })),
  };
}

export function methodTopicKey(en) { return en.normalize('NFKC').trim().toLowerCase(); }
