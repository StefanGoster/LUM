import test from 'node:test';
import assert from 'node:assert/strict';
import {appendLayerBundle,artworkImageContent,blankDocument} from '../lib/server/validation.ts';

const layer=(id,changes={})=>({id,name:id,kind:'image',x:0,y:0,width:900,height:1100,rotation:0,opacity:1,visible:true,locked:false,fill:'transparent',src:'/api/assets/art-'+id,...changes});
const current=()=>({...blankDocument('Original'),revision:7,layers:[layer('source',{locked:true})]});

test('bundle adds aligned objects in one proposal without changing locked source',()=>{
 const before=current(),copy=structuredClone(before);
 const next=appendLayerBundle(before,[layer('head'),layer('church'),layer('type',{kind:'text',src:undefined,text:'GOSTLUM',fill:'#c74838'})],7,'Prepared as separate assets; hidden areas reconstructed.');
 assert.deepEqual(before,copy);assert.deepEqual(next.layers[0],before.layers[0]);
 assert.deepEqual(next.layers.map(l=>l.id),['source','head','church','type']);
 assert.equal(next.layers[1].width,900);assert.equal(next.layers[2].x,0);
 assert.equal(next.layers[1].sourceNote,'Prepared as separate assets; hidden areas reconstructed.');
 assert.equal(next.revision,7,'Persistence, not a pure proposal, increments the revision');
});
test('bundle rejects duplicates, replacement and invalid later entries without partial mutation',()=>{
 for(const proposed of [[layer('head'),layer('head')],[layer('source')],[layer('head'),layer('church',{src:'https://untrusted.example/image.png'})]]){
  const before=current(),copy=structuredClone(before);
  assert.throws(()=>appendLayerBundle(before,proposed,7));assert.deepEqual(before,copy);
 }
});
test('late bundles cannot be applied to newer saved revisions',()=>{
 const before=current();assert.throws(()=>appendLayerBundle(before,[layer('head')],6),error=>error.code==='revision_conflict'&&error.currentRevision===7);
 assert.equal(before.layers.length,1);
});
test('bundle validates combined project capacity and preserves individual provenance',()=>{
 const before=current();before.layers=Array.from({length:200},(_,i)=>layer('old-'+i));
 assert.throws(()=>appendLayerBundle(before,[layer('new')],7));
 const next=appendLayerBundle(current(),[layer('head',{sourceNote:'Original sculpture scan'})],7,'Generic batch note');
 assert.equal(next.layers.at(-1).sourceNote,'Original sculpture scan');
 assert.throws(()=>appendLayerBundle(current(),[],7));
 assert.throws(()=>appendLayerBundle(current(),Array.from({length:51},(_,i)=>layer('n-'+i)),7));
});
test('inspection emits raster as MCP image content while preserving all bytes',()=>{
 const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13]).buffer;
 const image=artworkImageContent(bytes,'image/png');
 assert.equal(image.type,'image');assert.equal(image.mimeType,'image/png');
 assert.deepEqual(Uint8Array.from(atob(image.data),c=>c.charCodeAt(0)),new Uint8Array(bytes));
});
test('inspection rejects SVG, oversized raster, and mislabeled data',()=>{
 const svg=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>').buffer;
 assert.throws(()=>artworkImageContent(svg,'image/svg+xml'),error=>error.code==='inspection_requires_raster');
 assert.throws(()=>artworkImageContent(new ArrayBuffer(8_000_001),'image/png'),error=>error.code==='inspection_too_large');
 assert.throws(()=>artworkImageContent(new TextEncoder().encode('not a PNG').buffer,'image/png'));
});
