import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBrief} from '../modules/image-lab/core.ts';
import {allowedFileUrl,downloadArtwork,MAX_ASSET_BYTES} from '../modules/image-lab/transfer.ts';
import {checkpoint} from '../modules/image-lab/checkpoint.ts';
test('dissect stays in chat by default and a brief is not generation',()=>{
 const r=buildBrief({actions:['dissect','hd']});assert.equal(r.destination,'chat');assert.equal(r.generationPerformed,false);assert.match(r.prompt,/Do not create a LUM project/);assert.match(r.prompt,/one transparent|each selected object/);assert.throws(()=>buildBrief({actions:[]}));
});
test('optional bridge does not restart generation after transfer failure',()=>{assert.match(buildBrief({actions:['reimagine'],destination:'lum'}).prompt,/failure must not restart generation/);});
test('file URL guard blocks SSRF, credentials, ports, deceptive suffix and non-https',()=>{
 for(const u of ['http://files.oaiusercontent.com/a','https://127.0.0.1/a','https://169.254.169.254/a','https://files.oaiusercontent.com.evil.test/a','https://x:secret@files.oaiusercontent.com/a','https://files.oaiusercontent.com:444/a','data:image/png;base64,AA','https://other.blob.core.windows.net/a'])assert.throws(()=>allowedFileUrl(u));
 assert.equal(allowedFileUrl('https://oaisdmntprtest.blob.core.windows.net/a?secret=redacted').protocol,'https:');
});
test('download rejects redirects, wrong MIME and oversized declared bodies',async()=>{
 const url='https://files.oaiusercontent.com/a';
 for(const response of [new Response(null,{status:302,headers:{location:'https://127.0.0.1'}}),new Response('bad',{headers:{'content-type':'text/html'}}),new Response('x',{headers:{'content-type':'image/png','content-length':String(MAX_ASSET_BYTES+1)}})])await assert.rejects(downloadArtwork(url,async()=>response));
});
test('stream cap catches oversized body even without content length',async()=>{
 let cancelled=false;const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_ASSET_BYTES));c.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png'}});
 await assert.rejects(downloadArtwork('https://files.oaiusercontent.com/a',async()=>response),/12 MB/);assert.equal(cancelled,true);
});
test('transport keeps bytes in memory and disables redirects',async()=>{
 const r=await downloadArtwork('https://files.oaiusercontent.com/a?secret=abc',async(u,o)=>{assert.equal(o.redirect,'manual');return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});});assert.equal(r.byteLength,3);assert.deepEqual([...new Uint8Array(r.bytes)],[1,2,3]);assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('checkpoint cannot claim completed outputs without references or store encoded images',()=>{
 const base={source_ref:'file_source',actions:['dissect'],items:[]};
 assert.equal(checkpoint.parse(base).source_ref,'file_source');
 assert.throws(()=>checkpoint.parse({...base,source_ref:'https://signed.example/a?token=secret'}));
 assert.throws(()=>checkpoint.parse({...base,source_ref:'A'.repeat(200)}));
 assert.throws(()=>checkpoint.parse({...base,items:[{name:'head',status:'generated'}]}));
 assert.throws(()=>checkpoint.parse({...base,items:[{name:'head',status:'saved',output_ref:'file_1'}]}));
 assert.doesNotThrow(()=>checkpoint.parse({...base,items:[{name:'head',status:'generated',output_ref:'file_1'},{name:'church',status:'planned'}]}));
});
