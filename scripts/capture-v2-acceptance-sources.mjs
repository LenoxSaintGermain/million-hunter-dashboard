/** Explicit public acceptance sources only. Not a runtime host expansion or scraper. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const sources = [
  ['brevard-septic-current', 'https://abbrokers.com/businesslist/business_details.asp?LID=310961'],
  ['swfl-hvac-current', 'https://www.bizquest.com/business-for-sale/swfl-hvac-and-gas-contractor/BW2329571/'],
];
const directory = new URL('../tests/fixtures/acquisition-v2/current-source-captures/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, url] of sources) {
  const fetchedAt = new Date().toISOString();
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { Accept: 'text/html' } });
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
    await response.body?.cancel();
    console.log(JSON.stringify({ name, url, status: response.status, captured: false }));
    continue;
  }
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try { while (true) { const {value,done}=await reader.read(); if(done)break; bytes+=value.length; if(bytes>1500000)throw Error('Capture too large'); chunks.push(value); } } finally { await reader.cancel(); }
  const html = Buffer.concat(chunks).toString('utf8');
  const $ = load(html);
  $('script,style,nav,footer,header,aside,noscript,iframe,[hidden],[aria-hidden=true]').remove();
  $('br').replaceWith('\n'); $('p,div,li,tr,dt,dd,h1,h2,h3').append('\n');
  const text = ($('main').length === 1 ? $('main').text() : $('body').text()).replace(/[\t\r ]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
  if (/verify you are human|access denied|enable javascript and cookies|just a moment/i.test(text)) { console.log(JSON.stringify({name,url,captured:false,reason:'blocked'})); continue; }
  const receipt={url,fetchedAt,httpStatus:response.status,sha256:createHash('sha256').update(html).digest('hex'),textSha256:createHash('sha256').update(text).digest('hex'),text,label:'Current public source capture; not the historical September golden snapshot. Seller claims, not audited facts.'};
  // Refuse to replace an earlier acceptance capture.
  await writeFile(new URL(name+'.html',directory),html,{flag:'wx'});
  await writeFile(new URL(name+'.json',directory),JSON.stringify(receipt,null,2),{flag:'wx'});
  console.log(JSON.stringify({name,url,captured:true,bytes,sha256:receipt.sha256}));
}
