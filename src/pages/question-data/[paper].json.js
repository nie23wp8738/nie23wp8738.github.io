import { getPastPapers, topicLabel, tagLabel } from '../../lib/catalog.js';

export function getStaticPaths() {
  return getPastPapers().map(paper => ({params:{paper:paper.id},props:{paper}}));
}

export function GET({props:{paper}}) {
  const data = {
    id:paper.id, year:paper.year, exam:paper.exam, label:paper.label, source:paper.source,
    url:paper.url, keySource:paper.keySource, solutionURL:paper.solutionsUrl,
    questions:paper.questions.map(q => ({
      n:q.n, published:q.published, topic:q.topic, tags:[...new Set([q.topic,...(q.tags || [])].filter(Boolean))].map(key => ({
        en:topicLabel(key), zh:topicLabel(key,'zh') === key ? tagLabel(key,'zh') : topicLabel(key,'zh')
      })), url:q.url, solutionURL:q.solutionsUrl, answer:q.keyAnswer, value:q.keyValue, note:q.keyNote, worked:!!(q.inline || q.hasCommentary || q.outlinePdf)
    }))
  };
  return new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json; charset=utf-8'}});
}
