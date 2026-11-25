import {getPastPapers} from '../lib/catalog.js';
import {coverageOf} from '../lib/coverage.js';

export function GET() {
  return new Response(JSON.stringify(coverageOf(getPastPapers())), {headers:{'Content-Type':'application/json; charset=utf-8'}});
}
