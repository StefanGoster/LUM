import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument,parseDocument,assertLockedLayers,applyLayerPatches,assertRevision,LumError } from '../lib/server/validation.ts';

const layer = (changes={})=>({id:'one',name:'Original',kind:'rect',x:0,y:0,width:100,height:100,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...changes});
const doc = (layers=[layer()])=>({...blankDocument('Study'),revision:3,layers});

test('valid document retains geometry, normalized mask and provenance',()=>{
  const original=doc([layer({mask:{kind:'ellipse',inset:.1},sourceNote:'Original scan. No architectural reconstruction.',role:'source'})]);
  assert.deepEqual(parseDocument(original),original);
});
test('stale edits reject with latest revision rather than overwrite',()=>{
  const current=doc();assert.doesNotThrow(()=>assertRevision(current,3));
  assert.throws(()=>assertRevision(current,2),e=>e instanceof LumError&&e.code==='revision_conflict'&&e.currentRevision===3);
});
test('locked artwork rejects transformation, deletion and same-request covert unlock',()=>{
  const current=doc([layer({locked:true})]);
  for(const changes of [{x:15},{fill:'#ff0000'},{locked:false,x:20}])assert.throws(()=>applyLayerPatches(current,[{id:'one',changes}]),e=>e.code==='layer_locked');
  assert.throws(()=>assertLockedLayers(current,{...current,layers:[]}),e=>e.code==='layer_locked');
  assert.equal(current.layers[0].x,0);
});
test('a deliberate unlock can be saved separately, and explicit unlock permits edit',()=>{
  const current=doc([layer({locked:true})]);
  assert.equal(applyLayerPatches(current,[{id:'one',changes:{locked:false}}]).layers[0].locked,false);
  const result=applyLayerPatches(current,[{id:'one',changes:{locked:false,x:25}}],['one']);
  assert.equal(result.layers[0].x,25);assert.equal(current.layers[0].locked,true);
});
test('unlocked edit leaves unrelated locked geometry and original doc untouched',()=>{
  const current=doc([layer({locked:true}),layer({id:'two',name:'Accent'})]);
  const next=applyLayerPatches(current,[{id:'two',changes:{rotation:45,opacity:.5}}]);
  assert.deepEqual(next.layers[0],current.layers[0]);assert.equal(next.layers[1].rotation,45);assert.equal(current.layers[1].rotation,0);
});
test('duplicate IDs, invalid mask inset and nonfinite transforms reject',()=>{
  assert.throws(()=>parseDocument(doc([layer(),layer()])));
  assert.throws(()=>parseDocument(doc([layer({mask:{kind:'ellipse',inset:20}})])));
  assert.throws(()=>parseDocument(doc([layer({x:NaN})])));
});
test('asset source policy rejects arbitrary network and SVG data URLs',()=>{
  for(const src of ['https://example.com/a.png','javascript:alert(1)','data:image/svg+xml,<svg onload="alert(1)"/>'])assert.throws(()=>parseDocument(doc([layer({kind:'image',src})])));
  assert.doesNotThrow(()=>parseDocument(doc([layer({kind:'image',src:'/api/assets/abc-def'})])));
});
test('paths accept geometry but reject markup and script',()=>{
  assert.doesNotThrow(()=>parseDocument(doc([layer({kind:'path',path:'M0 0 C 20 20 30 30 40 0 Z'})])));
  assert.throws(()=>parseDocument(doc([layer({kind:'path',path:'<svg onload="alert(1)"/>'})])));
});
test('missing and repeated patch IDs cannot silently alter a different object',()=>{
  assert.throws(()=>applyLayerPatches(doc(),[{id:'absent',changes:{x:10}}]),e=>e.code==='layer_not_found');
  assert.throws(()=>applyLayerPatches(doc(),[{id:'one',changes:{x:10}},{id:'one',changes:{x:20}}]));
});

const {validateAsset}=await import('../lib/server/validation.ts');
const encoded=(text)=>new TextEncoder().encode(text).buffer;
test('plain SVG with canonical xmlns is accepted; active and remote SVG is rejected',()=>{
  assert.equal(validateAsset(encoded('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M 0 0 L20 20"/></svg>'),'image/svg+xml'),'image/svg+xml');
  for(const body of ['<script>alert(1)</script>','<image href="https://example.com/x"/>','<path onclick="alert(1)"/>','<foreignObject><div>bad</div></foreignObject>','<style>@import "//evil.invalid/x"</style>','<path style="fill:url(//evil.invalid/x)"/>'])assert.throws(()=>validateAsset(encoded(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`),'image/svg+xml'),e=>e.code==='unsafe_svg');
});
test('mislabeled image data, unsupported media and oversized assets reject',()=>{
  assert.throws(()=>validateAsset(encoded('not a PNG'),'image/png'));
  assert.throws(()=>validateAsset(encoded('<html>bad</html>'),'text/html'),e=>e.code==='unsupported_asset');
  assert.throws(()=>validateAsset(new ArrayBuffer(12_000_001),'image/png'),e=>e.code==='asset_too_large');
});
test('deleting or inserting unrelated layers does not spuriously modify locked content',()=>{
  const current=doc([layer(),layer({id:'locked',locked:true})]);
  assert.doesNotThrow(()=>assertLockedLayers(current,{...current,layers:[current.layers[1]]}));
  assert.doesNotThrow(()=>assertLockedLayers(current,{...current,layers:[layer({id:'new'}),...current.layers]}));
});
