const editions = import.meta.glob('../data/editions/*.json', { eager: true, import: 'default' });
const records = new Map();

for (const edition of Object.values(editions)) {
  const { paperId, questions } = edition;
  for (const [index, question] of questions.entries()) {
    const { id } = question;
    const number = Number(id.slice(paperId.length + 2));
    if (!Number.isSafeInteger(number) || number < 1 || id !== paperId + '-q' + number || records.has(id)) {
      throw new Error('Invalid or duplicate full-text question ID: ' + id);
    }
    records.set(id, {
      id, number, question, edition,
      previousId: questions[index - 1]?.id,
      nextId: questions[index + 1]?.id,
    });
  }
}

export function getInlineQuestions() {
  return [...records.values()];
}

export function getInlineRecord(id) {
  return records.get(id);
}
