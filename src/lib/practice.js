import mathematics from '../data/problems.json';
import tara from '../data/tara-originals.json';

for (const q of tara) {
  if (q.module === 'writing-task') continue;
  const key = q.correctOption;
  if (!Number.isInteger(key) || key < 0 || key > 4 || q.options?.length !== 5 ||
      q.answer !== 'ABCDE'[key] + '. ' + q.options[key]) {
    throw new Error('Mismatched multiple-choice answer for ' + q.id);
  }
}
export default [...mathematics, ...tara];
