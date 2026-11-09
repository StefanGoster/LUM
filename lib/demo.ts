import type { LumDocument, LumLayer, RecipeId } from './types';
import {newId} from './id';
export const uid = newId;
export const RECIPES: {id:RecipeId;name:string;label:string;colors:string[]}[] = [
 {id:'original',name:'Original',label:'Source palette',colors:['#e8e1d4','#252622','#c74838']},
 {id:'archive',name:'Archive',label:'Ink & parchment',colors:['#d8c7a8','#433b2f','#8a503c']},
 {id:'noir',name:'Noir',label:'Bone & carbon',colors:['#222421','#e4e0d6','#96998d']},
 {id:'signal',name:'Signal',label:'Red & graphite',colors:['#242523','#e9e5dd','#e65142']},
 {id:'sand',name:'Field',label:'Olive & sand',colors:['#545e43','#ded6b7','#c39152']},
];
export function layer(kind:LumLayer['kind'], partial:Partial<LumLayer> = {}):LumLayer { return {id:uid(),name:kind==='text'?'New text':'New '+kind,kind,x:250,y:300,width:280,height:240,rotation:0,opacity:1,visible:true,locked:false,fill:'#c74838',...partial}; }
export function makeDemo():LumDocument {
 const ls:LumLayer[]=[];
 ls.push(layer('ellipse',{name:'Signal / red disc',x:400,y:155,width:340,height:340,fill:'#c74838'}));
 ls.push(layer('ellipse',{name:'Orb / paper',x:170,y:275,width:530,height:530,fill:'#e8e1d4',stroke:'#252622',strokeWidth:2}));
 for(let i=0;i<9;i++){const w=70+i*54;ls.push(layer('ellipse',{name:`Meridian / ${String(i+1).padStart(2,'0')}`,x:435-w/2,y:275,width:w,height:530,fill:'transparent',stroke:'#252622',strokeWidth:1.7}));}
 for(let i=0;i<7;i++){const h=80+i*65;ls.push(layer('ellipse',{name:`Latitude / ${String(i+1).padStart(2,'0')}`,x:170,y:540-h/2,width:530,height:h,fill:'transparent',stroke:'#252622',strokeWidth:1.5}));}
 ls.push(layer('path',{name:'Orbit / ascending',path:'M 75 750 C 0 650 710 220 815 350 C 920 480 190 865 75 750 Z',x:55,y:315,width:770,height:470,fill:'transparent',stroke:'#252622',strokeWidth:4}));
 ls.push(layer('ellipse',{name:'Satellite / point',x:704,y:361,width:24,height:24,fill:'#252622'}));
 ls.push(layer('text',{name:'Index / 033',text:'033',x:83,y:88,width:180,height:45,fontSize:44,fontFamily:'Arial',fontWeight:700,fill:'#252622'}));
 ls.push(layer('text',{name:'Edition / header',text:'STUDIES IN TRANSFORMATION',x:414,y:102,width:415,height:20,fontSize:16,fontFamily:'Arial',fontWeight:400,fill:'#252622'}));
 ls.push(layer('rect',{name:'Rule / top',x:82,y:145,width:735,height:2,fill:'#252622'}));
 ls.push(layer('text',{name:'Wordmark / GOSTLUM',text:'GOSTLUM',x:78,y:865,width:750,height:110,fontSize:116,fontFamily:'Georgia',fontWeight:400,fill:'#252622'}));
 ls.push(layer('text',{name:'Edition / footer',text:'FORM IS A RECORD OF CHANGE.',x:84,y:1013,width:440,height:18,fontSize:15,fontFamily:'Arial',fill:'#252622'}));
 ls.push(layer('text',{name:'Archive / footer',text:'VOL. 01  /  2026',x:656,y:1013,width:180,height:18,fontSize:15,fontFamily:'Arial',fill:'#252622'}));
 return {version:1,id:uid(),name:'Signal study / 001',width:900,height:1100,background:'#e8e1d4',transparent:false,layers:ls,references:[],recipe:'original',notes:'An editable study in orbital geometry. Preserve the composition and exact typography. Use red as a deliberate focal point.',revision:0,updatedAt:new Date().toISOString()};
}
export function makeBlank():LumDocument {return {...makeDemo(),id:uid(),name:'Untitled study',layers:[],notes:''};}
