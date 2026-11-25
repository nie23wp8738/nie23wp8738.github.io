import guide from '../data/tara-guide.json';
import notes from '../data/tara-guide-notes.json';
import {topicLabel} from './catalog.js';

// Worksheet body text is set in the built-in Latin PDF fonts.
function printable(text) {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, '-')
    .replace(/×/g, 'x').replace(/÷/g, '/').replace(/[–—]/g, '-');
}

export function guideWorksheetItems(lang) {
  return guide.questions.map(question => {
    const note = notes[question.id];
    const writing = question.module === 'writing-task';
    const options = question.options || [];
    if (!note || (!writing && (options.length !== 5 || question.optionsZh?.length !== 5 ||
      !/^[A-E]\./.test(note.answer) || note.answer[0] !== note.answerZh[0]))) {
      throw new Error('Incomplete TARA worksheet example: ' + question.id);
    }
    const topicKey = writing ? 'argument-writing' : question.module;
    const code = question.id.slice('tara-guide-'.length).replace('-', ' ').toUpperCase();
    const title = lang === 'zh' ? 'TARA 指南 '+code+' · '+question.labelZh : 'TARA guide '+code+' · '+question.label;
    return {
      id:question.id, kind:'guide', exam:['TARA'], title, topicKey, topic:topicLabel(topicKey,lang),
      module:question.module, code, sourcePage:question.page, statement:printable(note.outline),
      preview:lang === 'zh' ? note.outlineZh : note.outline,
      options:options.map(printable), answer:printable(note.answer),
      solutions:note.methods.map(method => ({
        title:printable(method.title), text:printable(method.steps.join('\n')), topics:method.topics
      }))
    };
  });
}
