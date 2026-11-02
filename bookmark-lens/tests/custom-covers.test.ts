import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCustomCover,readCustomCover,removeCustomCover,coverSource} from '../lib/custom-covers';
import {compressImage,outputSize,validateImage} from '../lib/image-compression';
test('custom Blob covers persist, replace and remain isolated by bookmark ID',async()=>{
 const first={blob:new Blob(['first'],{type:'image/webp'}),originalSize:100,finalSize:5,width:100,height:50,reduction:95};
 await saveCustomCover('a',first);await saveCustomCover('b',{...first,blob:new Blob(['second'])});
 assert.equal(await (await readCustomCover('a'))?.blob.text(),'first');
 assert.equal(await (await readCustomCover('b'))?.blob.text(),'second');
 await saveCustomCover('a',{...first,blob:new Blob(['replacement'])});
 assert.equal(await (await readCustomCover('a'))?.blob.text(),'replacement');
 // Titles and folder paths are deliberately not part of the storage key.
 assert.equal((await readCustomCover('a'))?.bookmarkId,'a');
 await removeCustomCover('a');assert.equal(await readCustomCover('a'),undefined);
 assert.equal(await (await readCustomCover('b'))?.blob.text(),'second');
});
test('custom priority survives automatic screenshot changes and restores fallback',()=>{
 assert.deepEqual(coverSource('custom','new-shot','og'),{image:'custom',label:'自定义封面'});
 assert.equal(coverSource(undefined,'shot','og').image,'shot');
 assert.equal(coverSource(undefined,undefined,'og').image,'og');
 assert.equal(coverSource().image,undefined);
});
test('size rules preserve aspect ratio, reject invalid input, and do not upscale',()=>{
 assert.deepEqual(outputSize(2400,1600),{width:1200,height:800});
 assert.deepEqual(outputSize(400,800),{width:400,height:800});
 assert.throws(()=>validateImage(new Blob(['svg'],{type:'image/svg+xml'})),/仅支持/);
 assert.throws(()=>validateImage(new Blob([],{type:'image/png'})),/为空/);
});
test('compression bounds attempts, keeps statistics accurate, and releases bitmap',async()=>{
 const previousDocument=globalThis.document,previousBitmap=globalThis.createImageBitmap;
 let calls=0,closed=0;const dimensions:number[][]=[];
 const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{dimensions.push([canvas.width,canvas.height]);}}),toBlob:(callback:(blob:Blob)=>void,type:string,quality:number)=>{calls++;assert.equal(type,'image/webp');assert.ok(quality>=.65);callback(new Blob([new Uint8Array(400*1024)],{type}));}};
 Object.assign(globalThis,{document:{createElement:()=>canvas},createImageBitmap:async()=>({width:2400,height:1600,close:()=>closed++})});
 try{
 const result=await compressImage(new Blob([new Uint8Array(1024*1024)],{type:'image/png'}));
 assert.equal(calls,6);assert.equal(closed,1);assert.deepEqual(dimensions[0],[1200,800]);
 assert.equal(result.originalSize,1024*1024);assert.equal(result.finalSize,result.blob.size);assert.equal(result.reduction,60.9375);
 calls=0;Object.assign(globalThis,{createImageBitmap:async()=>({width:400,height:200,close:()=>closed++})});
 const tiny=new Blob(['tiny'],{type:'image/png'});const kept=await compressImage(tiny);
 assert.equal(kept.blob,tiny);assert.equal(kept.reduction,0);assert.equal(kept.width,400);
 Object.assign(globalThis,{createImageBitmap:async()=>{throw new Error('decode');}});
 await assert.rejects(()=>compressImage(tiny),/损坏/);
 }finally{Object.assign(globalThis,{document:previousDocument,createImageBitmap:previousBitmap});}
});
