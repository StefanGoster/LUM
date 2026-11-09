import test from 'node:test';
import assert from 'node:assert/strict';
import {Path} from 'fabric';
import {DEFAULT_BRUSH, normalizeBrush, stabilizeSamples, resampleStroke, pressureWidth, strokeOutline, createBrushPath, sprayDots} from '../lib/brush.ts';
const settings=(extra={})=>normalizeBrush({...DEFAULT_BRUSH,...extra});
const sample=(x,y,t=0,pressure=undefined)=>({x,y,t,pressure});

test('stabilizer suppresses small mouse jitter without losing the final release point',()=>{
 const input=Array.from({length:120},(_,i)=>sample(i*3,i%2?3:-3,i*16));
 const raw=stabilizeSamples(input,0),smooth=stabilizeSamples(input,.85);
 const jitter=points=>points.slice(10,-3).reduce((sum,p,i,arr)=>sum+(i?Math.abs(p.y-arr[i-1].y):0),0);
 assert.ok(jitter(smooth)<jitter(raw)*.35);
 assert.deepEqual(smooth[0],input[0]);
 assert.deepEqual(smooth.at(-1),input.at(-1));
});

test('sampling keeps spacing and endpoints independent of pointer-event density',()=>{
 const sparse=[sample(0,0,0),sample(100,0,1000)];
 const dense=Array.from({length:101},(_,i)=>sample(i,0,i*10));
 const a=resampleStroke(sparse,4),b=resampleStroke(dense,4);
 assert.equal(a.length,b.length);
 assert.ok(a.every((p,i)=>Math.abs(p.x-b[i].x)<1e-8&&p.y===b[i].y&&Math.abs(p.t-b[i].t)<1e-8));
 const result=resampleStroke([sample(0,0),sample(100000,0)],.4,150);
 assert.ok(result.length<=150);assert.equal(result.at(-1).x,100000);
});

test('real pen pressure controls width, and a mouse is treated as simulated input',()=>{
 const brush=settings({preset:'marker'});
 assert.ok(pressureWidth(sample(0,0,0,.9),undefined,brush)>pressureWidth(sample(0,0,0,.1),undefined,brush)*2);
 assert.equal(pressureWidth(sample(0,0),undefined,brush),1);
 assert.equal(pressureWidth(sample(0,0,0,.1),undefined,settings({pressure:false})),1);
 const ink=settings({preset:'ink'}),a=sample(0,0,0);
 assert.ok(pressureWidth(sample(100,0,20),a,ink)<pressureWidth(sample(1,0,20),a,ink));
});

test('ink tapers at both ends while a round marker keeps a full nib',()=>{
 const points=[sample(0,0,0),sample(200,0,1000)];
 const ink=strokeOutline(points,settings({preset:'ink',size:40,pressure:false}));
 const marker=strokeOutline(points,settings({preset:'marker',size:40,pressure:false}));
 assert.ok(Math.abs(ink[0].y)<Math.abs(marker[0].y)*.2);
 assert.ok(ink.some(p=>p.x>50&&p.x<150&&Math.abs(p.y)>19));
});

test('chisel nib changes stroke thickness with direction and angle',()=>{
 const s=settings({preset:'chisel',angle:0,size:40,pressure:false});
 const horizontal=strokeOutline([sample(0,0),sample(200,0,1000)],s);
 const vertical=strokeOutline([sample(0,0),sample(0,200,1000)],s);
 assert.ok(Math.abs(horizontal[0].y)<Math.abs(vertical[0].x)*.3);
});

test('spray is repeatable for the same seed, varied for a new stroke and bounded to the nib',()=>{
 const p=[sample(100,200)],s=settings({preset:'spray',size:80,pressure:false});
 const a=sprayDots(p,s,833),b=sprayDots(p,s,833),c=sprayDots(p,s,834);
 assert.deepEqual(a,b);assert.notDeepEqual(a,c);
 assert.ok(a.every(dot=>Math.hypot(dot.x-100,dot.y-200)<=40&&dot.radius>0));
});

test('all brush presets produce finite editable paths, including a single-click dot',()=>{
 for(const preset of ['ink','marker','chisel','spray'])for(const input of [[sample(10,20,0,.7)],[sample(0,0),sample(10,20,16),sample(25,5,32)]]){
  const data=createBrushPath(input,settings({preset}),47,true);
  assert.ok(data.startsWith('M '));assert.ok(data.endsWith(' Z'));assert.doesNotMatch(data,/NaN|Infinity/);
  const path=new Path(data,{fill:'#222222',strokeWidth:0,originX:'left',originY:'top'});
  assert.ok(path.width>0&&path.height>0);
 }
});

test('long spray remains below the saved-layer limit using compact source or rounded fallback',()=>{
 const input=Array.from({length:5000},(_,i)=>sample(i*2,100+Math.sin(i*.1)*30,i*16));
 const data=createBrushPath(input,settings({preset:'spray',size:50}),88);
 const path=new Path(data,{fill:'#222222',strokeWidth:0});
 assert.ok(data.length<300000);
 const serialized=path.path.map(segment=>segment.map(v=>typeof v==='number'?Math.round(v*100)/100:v).join(' ')).join(' ');
 assert.ok(serialized.length<300000,`Path grew to ${serialized.length} bytes`);
});

test('invalid brush settings and bad samples cannot emit invalid coordinates',()=>{
 const s=normalizeBrush({size:Infinity,smoothing:-2,opacity:2,angle:NaN});
 assert.equal(s.size,18);assert.equal(s.smoothing,0);assert.equal(s.opacity,1);assert.equal(s.angle,35);
 assert.equal(createBrushPath([],s),'');
 assert.doesNotMatch(createBrushPath([sample(NaN,2),sample(4,5)],s),/NaN|Infinity/);
});
