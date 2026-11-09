export type LayerKind = 'rect'|'ellipse'|'text'|'image'|'path';
export type ReferenceRole = 'structure'|'style'|'palette'|'subject'|'source';
export type LayerMask = {kind:'ellipse'|'rect'; inset:number; inverted?:boolean};
export interface LumLayer {id:string;name:string;kind:LayerKind;x:number;y:number;width:number;height:number;rotation:number;opacity:number;visible:boolean;locked:boolean;fill:string;stroke?:string;strokeWidth?:number;text?:string;fontSize?:number;fontFamily?:string;fontWeight?:number;src?:string;path?:string;mask?:LayerMask|null;role?:ReferenceRole;structureStrength?:number;sourceNote?:string;}
export interface LumReference {id:string;name:string;src:string;role:ReferenceRole;note?:string;strength:number;}
export type RecipeId='original'|'archive'|'noir'|'signal'|'sand';
export interface LumDocument {version:1;id:string;name:string;width:number;height:number;background:string;transparent:boolean;layers:LumLayer[];references:LumReference[];recipe:RecipeId;notes:string;revision:number;updatedAt:string;}
export interface ProjectSummary {id:string;name:string;revision:number;updatedAt:string;}
export interface CanvasHandle {exportPng:()=>string|undefined; exportSvg:()=>string|undefined; fit:()=>void;}
export interface CanvasProps {document:LumDocument;selectedId:string|null;onSelect:(id:string|null)=>void;onChange:(layers:LumLayer[])=>void;tool:'select'|'draw'|'mask';zoom:number;onZoom:(zoom:number)=>void;preview?:boolean;}
