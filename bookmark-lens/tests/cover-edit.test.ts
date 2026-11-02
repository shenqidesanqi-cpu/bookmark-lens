import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {geometry,defaultCrop,exportCover} from '../lib/cover-edit';
import {saveCustomCover,readCustomCover} from '../lib/custom-covers';
test('landscape, portrait, square and high resolution crops fill without stretching or blank edges',()=>{
 for(const [width,height] of [[2000,1000],[1000,2000],[1000,1000],[8000,6000]]){
  const g=geometry(width!,height!,{...defaultCrop,x:1e6,y:-1e6,zoom:2});
  assert.ok(Math.abs(g.width/g.height-width!/height!)<1e-9);
  assert.ok(g.left<=0&&g.top<=0);assert.ok(g.left+g.width>=960&&g.top+g.height>=540);
  const contain=geometry(width!,height!,{...defaultCrop,mode:'contain',x:1e6,y:1e6});
  assert.ok(contain.width<=960.00001&&contain.height<=540.00001);
  assert.equal(contain.crop.x,0);assert.equal(contain.crop.y,0);
 }
 assert.equal(geometry(1000,1000,{...defaultCrop,zoom:100}).crop.zoom,3);
});
test('export draws exactly the shared preview geometry and closes bitmap',async()=>{
 const oldDocument=globalThis.document,oldBitmap=globalThis.createImageBitmap;
 let coordinates:number[]=[],closed=false;
 const canvas={width:0,height:0,getContext:()=>({fillStyle:'',fillRect:()=>{},drawImage:(_:unknown,...args:number[])=>{coordinates=args;}}),toBlob:(cb:(v:Blob)=>void)=>cb(new Blob(['result'],{type:'image/webp'}))};
 Object.assign(globalThis,{document:{createElement:()=>canvas},createImageBitmap:async()=>({width:1000,height:2000,close:()=>{closed=true;}})});
 try{const crop={...defaultCrop,zoom:1.5,y:123};const expected=geometry(1000,2000,crop);const result=await exportCover(new Blob(['source']),crop,100);
 assert.deepEqual(coordinates,[expected.left,expected.top,expected.width,expected.height]);assert.equal(canvas.width,960);assert.equal(canvas.height,540);assert.equal(result.finalSize,result.blob.size);assert.equal(closed,true);
 }finally{Object.assign(globalThis,{document:oldDocument,createImageBitmap:oldBitmap});}
});
test('source and crop survive reopening and invalid replacement does not erase previous record',async()=>{
 const source=new Blob(['original source'],{type:'image/webp'}),crop={...defaultCrop,zoom:1.7,x:90};
 const result={blob:new Blob(['final']),source,crop,width:960,height:540,originalSize:100,finalSize:5,reduction:95};
 await saveCustomCover('editor-a',result);await saveCustomCover('editor-b',{...result,crop:defaultCrop});
 const saved=await readCustomCover('editor-a');assert.equal(await saved?.source?.text(),'original source');assert.deepEqual(saved?.crop,crop);
 await assert.rejects(()=>saveCustomCover('editor-a',{...result,uncloneable:()=>{}} as typeof result));
 assert.deepEqual((await readCustomCover('editor-a'))?.crop,crop);assert.deepEqual((await readCustomCover('editor-b'))?.crop,defaultCrop);
});
