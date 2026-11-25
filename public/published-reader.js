import {credits, publishedAsset, singleQuestionURL} from './published-pdf.js';

export function mountPublishedReader(host, {id, record, lang, title, primary=false, withOutline=false}) {
  const t = (en,zh) => lang==='zh' ? zh : en;
  const euclid = record.collection === 'euclid';
  const credit = credits[record.collection];
  const make = (tag,text) => {const item=document.createElement(tag); if(text) item.textContent=text; return item;};
  function anchor(text,href) {
    const a=make('a',text); a.href=href; return a;
  }

  const source = make('p'); source.className='reader-source';
  source.append(anchor(credit.name,credit.url),' · ',anchor(credit.license,credit.licenseUrl));
  if(euclid) source.append(t(' · English original, cropped to this question. Free noncommercial use.',' · 英文原版，按题截取，仅限免费非商业使用。'));

  function documentPanel(parent, kind) {
    const asset=publishedAsset(id,record,kind,lang);
    if(!asset) return;
    const question=kind==='question';
    const label=question ? t('Open this question PDF','打开此题 PDF') : t('Open this worked solution PDF','打开此题解析 PDF');
    const directURL=asset.path+(asset.pages ? '#page='+asset.pages[0] : '');
    const actions=make('p'); actions.className='published-links';
    const open=anchor(asset.pages ? t('Open the on-site book at this question','在本站年册中定位此题') : label,directURL);
    open.target='_blank'; open.rel='noopener'; actions.append(open);
    const frame=make('iframe'); frame.className='published-preview'; frame.title=title+' · '+(question?t('Question','题目'):t('Solution','解答'));
    parent.append(actions,frame);
    let pending=false;
    async function display() {
      if(pending || frame.hasAttribute('src')) return;
      pending=true;
      try {
        const url=await singleQuestionURL(asset,frame.title);
        frame.src=url+'#view=FitH';
        if(asset.pages) {
          const single=anchor(label,url); single.target='_blank'; single.rel='noopener';
          actions.prepend(single, ' · ');
          window.addEventListener('pagehide',event=>{if(!event.persisted) URL.revokeObjectURL(url);},{once:true});
        }
      } catch {
        frame.src=directURL;
      } finally {pending=false;}
    }
    if(parent instanceof HTMLDetailsElement) {
      parent.addEventListener('toggle',()=>{if(parent.open) display();});
      if(parent.open) display();
    } else display();
  }

  if(euclid) {
    const panel=make(primary?'section':'details');
    panel.append(make(primary?'h2':'summary',t('Official English question','官方英文原题')));
    host.append(panel); documentPanel(panel,'question');
  } else if(primary && !withOutline) {
    host.append(make('p',t('The English and Chinese worked solutions are available below. The original question is available under Original sources.','下方可在本站阅读中英文解法。题干尚待补充，原卷可在“原始资料”中查阅。')));
  }
  const solution=make('details');
  solution.id=primary?'solutions':'published-solution';
  solution.className='published-solution';
  solution.append(make('summary', euclid?t('Show official English solution','展开官方英文解析'):t('Show the worked solution','展开本站收录的详细解法')));
  host.append(solution,source);
  documentPanel(solution,'solution');
  function syncHash(){if(location.hash==='#'+solution.id){solution.open=true;requestAnimationFrame(()=>solution.scrollIntoView({block:'nearest'}));}}
  syncHash(); window.addEventListener('hashchange',syncHash);
}

for(const block of document.querySelectorAll('[data-published-note]')){
  mountPublishedReader(block,{
    id:block.dataset.id, record:JSON.parse(block.dataset.publishedNote), lang:block.dataset.lang, title:block.dataset.title,
    primary:block.dataset.withOutline==='true', withOutline:block.dataset.withOutline==='true'
  });
}
