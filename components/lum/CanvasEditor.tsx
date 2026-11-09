'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {Canvas,Rect,Ellipse,FabricText,FabricImage,Path,filters,type FabricObject} from 'fabric';
import type {CanvasHandle,CanvasProps,LumLayer,RecipeId} from '@/lib/types';
import {RECIPES} from '@/lib/demo';
import {newId} from '@/lib/id';
import {DEFAULT_BRUSH} from '@/lib/brush';
import {StabilizedBrush,type LumBrushPath} from './StabilizedBrush';

type Tagged = FabricObject & {lumId?:string};
const inks=Object.fromEntries(RECIPES.map(r=>[r.id,r.colors])) as Record<RecipeId,string[]>;
function ink(value:string|undefined,recipe:RecipeId){if(!value||value==='transparent'||value==='none'||recipe==='original')return value;const hex=value.replace('#','');if(!/^[\da-f]{6}$/i.test(hex))return value;const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);return r>g*1.25&&r>b*1.2?inks[recipe][2]:r+g+b>440?inks[recipe][0]:inks[recipe][1];}
async function makeObject(layer:LumLayer,recipe:RecipeId):Promise<Tagged>{
 const common={originX:'left' as const,originY:'top' as const,fill:ink(layer.fill,recipe),stroke:ink(layer.stroke,recipe),strokeWidth:layer.strokeWidth??0};
 let object:Tagged;
 if(layer.kind==='image'&&layer.src){object=await FabricImage.fromURL(layer.src,{crossOrigin:'anonymous'});const image=object as FabricImage;if(recipe==='noir')image.filters=[new filters.Grayscale()];if(recipe==='archive'||recipe==='sand')image.filters=[new filters.Sepia()];image.applyFilters();}
 else if(layer.kind==='text')object=new FabricText(layer.text??'Text',{...common,fontFamily:layer.fontFamily||'Arial',fontSize:layer.fontSize||48,fontWeight:layer.fontWeight||400});
 else if(layer.kind==='ellipse')object=new Ellipse({...common,rx:layer.width/2,ry:layer.height/2});
 else if(layer.kind==='path')object=new Path(layer.path||'M 0 0 L 100 100',{...common,strokeLineCap:'round',strokeLineJoin:'round'});
 else object=new Rect({...common,width:layer.width,height:layer.height});
 object.lumId=layer.id;
 object.set({left:layer.x,top:layer.y,originX:'left',originY:'top',angle:layer.rotation,opacity:layer.opacity,visible:layer.visible,scaleX:layer.width/Math.max(object.width,1),scaleY:layer.height/Math.max(object.height,1),selectable:!layer.locked,evented:!layer.locked,lockMovementX:layer.locked,lockMovementY:layer.locked,lockRotation:layer.locked,lockScalingX:layer.locked,lockScalingY:layer.locked,cornerColor:'#e26251',cornerStrokeColor:'#1d2020',borderColor:'#e26251',cornerSize:8,transparentCorners:false,padding:3});
 if(layer.mask){const inset=Math.min(.49,Math.max(0,layer.mask.inset));const width=object.width*(1-inset*2),height=object.height*(1-inset*2);object.clipPath=layer.mask.kind==='ellipse'?new Ellipse({rx:width/2,ry:height/2,originX:'center',originY:'center',inverted:!!layer.mask.inverted}):new Rect({width,height,originX:'center',originY:'center',inverted:!!layer.mask.inverted});}
 object.setCoords();return object;
}

const CanvasEditor=forwardRef<CanvasHandle,CanvasProps>(function CanvasEditor(props,ref){
 const element=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),canvas=useRef<Canvas|null>(null),latest=useRef(props),renderId=useRef(0),syncing=useRef(false),renderReady=useRef(false);latest.current=props;
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 function fit(){const p=latest.current;if(!host.current)return;const r=host.current.getBoundingClientRect();p.onZoom(Math.min(1.2,Math.max(.1,Math.min((r.width-72)/p.document.width,(r.height-72)/p.document.height))));}
 useImperativeHandle(ref,()=>({fit,exportPng:()=>{const c=canvas.current,p=latest.current;if(!c||!renderReady.current)return;return c.toDataURL({format:'png',multiplier:1/p.zoom,enableRetinaScaling:false});},exportSvg:()=>renderReady.current?canvas.current?.toSVG({width:String(latest.current.document.width),height:String(latest.current.document.height),viewBox:{x:0,y:0,width:latest.current.document.width,height:latest.current.document.height}}):undefined}));
 useEffect(()=>{if(!element.current)return;const c=new Canvas(element.current,{selection:false,preserveObjectStacking:true,renderOnAddRemove:false,enableRetinaScaling:true,enablePointerEvents:true});canvas.current=c;
 c.freeDrawingBrush=new StabilizedBrush(c,latest.current.brush||DEFAULT_BRUSH);
 const selection=()=>{if(!syncing.current)latest.current.onSelect((c.getActiveObject() as Tagged)?.lumId||null);};
 c.on('selection:created',selection);c.on('selection:updated',selection);c.on('selection:cleared',selection);
 c.on('object:modified',({target})=>{if(!target||syncing.current)return;const obj=target as Tagged,p=latest.current;const layers=p.document.layers.map(l=>l.id===obj.lumId&&!l.locked?{...l,x:obj.left,y:obj.top,width:Math.max(1,obj.width*obj.scaleX),height:Math.max(1,obj.height*obj.scaleY),rotation:obj.angle}:l);p.onChange(layers);});
 c.on('path:created',({path:rawPath})=>{const path=rawPath as LumBrushPath;const p=latest.current;const layer:LumLayer={id:newId(),name:path.lumBrushName||'Sketch stroke',kind:'path',x:path.left,y:path.top,width:Math.max(.01,path.width),height:Math.max(.01,path.height),rotation:0,opacity:path.opacity,visible:true,locked:false,fill:typeof path.fill==='string'?path.fill:'transparent',stroke:typeof path.stroke==='string'?path.stroke:undefined,strokeWidth:path.strokeWidth,path:path.lumPathData??path.path.map(segment=>segment.map(v=>typeof v==='number'?Math.round(v*100)/100:v).join(' ')).join(' ')};p.onChange([...p.document.layers,layer]);p.onSelect(layer.id);});
 setReady(true);fit();const observer=new ResizeObserver(()=>{if(latest.current.preview)fit();});if(host.current)observer.observe(host.current);
 return()=>{renderId.current++;observer.disconnect();(c.freeDrawingBrush as StabilizedBrush)?.cancel();canvas.current=null;void c.dispose();};
 },[]);
 useEffect(()=>{const c=canvas.current;if(!c||!ready)return;let gone=false;const current=++renderId.current;renderReady.current=false;setError('');Promise.all(props.document.layers.map(l=>makeObject(l,props.document.recipe))).then(objects=>{if(gone||current!==renderId.current)return;syncing.current=true;c.remove(...c.getObjects());c.backgroundColor=props.document.transparent?'':ink(props.document.background,props.document.recipe)||'';for(const o of objects){if(props.preview)o.set({selectable:false,evented:false});c.add(o);}const selected=objects.find(o=>o.lumId===latest.current.selectedId);if(selected&&selected.selectable&&!props.preview)c.setActiveObject(selected);c.requestRenderAll();syncing.current=false;renderReady.current=true;}).catch(()=>{if(!gone&&current===renderId.current){renderReady.current=false;setError('An image could not be loaded. Check its source or reimport it.');}});return()=>{gone=true;};},[props.document.layers,props.document.background,props.document.transparent,props.document.recipe,props.preview,ready]);
 useEffect(()=>{const c=canvas.current;if(!c)return;c.setDimensions({width:props.document.width*props.zoom,height:props.document.height*props.zoom});c.setZoom(props.zoom);c.requestRenderAll();},[props.zoom,props.document.width,props.document.height,ready]);
 useEffect(()=>{const c=canvas.current;if(!c)return;if(props.tool!=='draw')(c.freeDrawingBrush as StabilizedBrush)?.cancel();c.isDrawingMode=props.tool==='draw'&&!props.preview;syncing.current=true;const selected=c.getObjects().find(o=>(o as Tagged).lumId===props.selectedId);if(selected?.selectable&&!props.preview)c.setActiveObject(selected);else c.discardActiveObject();c.requestRenderAll();syncing.current=false;},[props.selectedId,props.tool,props.preview,ready]);
 useEffect(()=>{const c=canvas.current;if(c?.freeDrawingBrush instanceof StabilizedBrush)c.freeDrawingBrush.configure(props.brush||DEFAULT_BRUSH);},[props.brush,ready]);
 return <div ref={host} className="lum-canvas-viewport" style={{position:'relative',width:'100%',height:'100%',overflow:'auto'}}><div style={{minWidth:'100%',minHeight:'100%',width:'max-content',height:'max-content',display:'flex',alignItems:'center',justifyContent:'center',padding:32,boxSizing:'border-box'}}><div className="lum-artboard" style={{boxShadow:'0 18px 70px #0005',backgroundColor:'#ddd',backgroundImage:'conic-gradient(#ccc 25%,#eee 0 50%,#ccc 0 75%,#eee 0)',backgroundSize:'16px 16px',lineHeight:0}}><canvas ref={element}/></div></div>{error&&<div role="alert" style={{position:'absolute',bottom:16,left:16,right:16,background:'#4a2624',padding:12,color:'#fff',fontSize:12}}>{error}</div>}</div>;
});
export default CanvasEditor;
