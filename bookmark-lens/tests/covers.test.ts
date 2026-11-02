import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {publicUrl,coverKey,originPattern,freshCover} from '../lib/cover-policy';
import {readCover,writeCover,removeCover} from '../lib/cover-store';
import {flatten,indexFolders,matchesBookmark,type Node} from '../lib/bookmark-model';
test('automatic covers exclude non-web, local, literal-IP and credential URLs',()=>{
 for(const url of ['chrome://settings','file:///a','http://localhost/a','http://192.168.1.1','http://127.1','http://[::1]','https://app.internal','https://site.local','https://user:pass@example.com'])assert.throws(()=>publicUrl(url),url);
 assert.equal(originPattern('https://Example.com/path?q=1'),'https://example.com/*');
 assert.equal(coverKey('https://Example.com/path?q=1#foo'),'https://example.com/path?q=1');
 assert.notEqual(coverKey('https://example.com/?q=1'),coverKey('https://example.com/?q=2'));
});
test('success cache lasts a week, failed requests cool down for one hour',()=>{
 assert.equal(freshCover({url:'https://example.com/',fetchedAt:Date.now()-2*3600000}),true);
 assert.equal(freshCover({url:'https://example.com/',fetchedAt:Date.now()-2*3600000,error:'failed'}),false);
 assert.equal(freshCover({url:'https://example.com/',fetchedAt:Date.now()-8*86400000}),false);
});
test('sharing covers persist independently and delete across hash aliases',async()=>{
 const url='https://example.com/page';
 await writeCover({url,image:'data:image/webp;base64,AAAA',description:'website',fetchedAt:1});
 assert.equal((await readCover(url+'#section'))?.description,'website');
 await writeCover({url,error:'missing',fetchedAt:2});
 assert.equal((await readCover(url))?.error,'missing');
 await removeCover(url+'#section');assert.equal(await readCover(url),undefined);
});
test('shared bookmark model preserves nested tree and filters actual title and URL',()=>{
 const leaf:Node={syncing:false,id:'3',parentId:'2',title:'设计 Example',url:'https://example.com/path'};
 const tree:Node[]=[{syncing:false,id:'1',title:'root',children:[{syncing:false,id:'2',parentId:'1',title:'nested',children:[leaf]}]}];
 const before=JSON.stringify(tree);
 assert.deepEqual(flatten(tree),[leaf]);assert.equal(indexFolders(tree).get('2')?.parentId,'1');
 assert.equal(matchesBookmark(leaf,'EXAMPLE.COM/path'),true);assert.equal(matchesBookmark(leaf,'设计'),true);assert.equal(matchesBookmark(leaf,'missing'),false);
 assert.equal(JSON.stringify(tree),before);
});

test('share image parsing handles relative URLs, entities, fallback and unsafe targets',async()=>{
 const {parseHTML}=await import('linkedom');
 const {document}=parseHTML('<html><body></body></html>');
 const previous=globalThis.document;Object.assign(globalThis,{document});
 try{
 const {parseCover}=await import('../lib/cover-policy');
 assert.deepEqual(parseCover('<meta property="og:image" content="/cover.png?a=1&amp;b=2"><meta name="description" content="A &amp; B">','https://example.com/path'),{imageUrl:'https://example.com/cover.png?a=1&b=2',description:'A & B'});
 assert.equal(parseCover('<meta name="twitter:image" content="https://cdn.example.com/card.webp">','https://example.com/').imageUrl,'https://cdn.example.com/card.webp');
 assert.throws(()=>parseCover('<meta property="og:image" content="http://127.0.0.1/private">','https://example.com/'));
 assert.throws(()=>parseCover('<html><body>No cover</body></html>','https://example.com/'));
 }finally{Object.assign(globalThis,{document:previous});}
});

test('cover fetching never requests an ungranted image origin and caches failures',async()=>{
 const {parseHTML}=await import('linkedom');const {document}=parseHTML('<html></html>');
 const oldFetch=globalThis.fetch,oldDocument=globalThis.document;
 let requests=0;
 Object.assign(globalThis,{document,chrome:{permissions:{contains:async({origins}:{origins:string[]})=>!origins[0]?.includes('cdn.example.com')}}});
 globalThis.fetch=async()=>{requests++;return new Response('<meta property="og:image" content="https://cdn.example.com/card.png">',{headers:{'content-type':'text/html'}});};
 try{
 const {fetchCover}=await import('../lib/covers');
 const first=await fetchCover('https://cover-test.example.com/page',true);
 assert.equal(requests,1);assert.match(first.error??'',/其他域名/);assert.equal(first.imageUrl,'https://cdn.example.com/card.png');
 await fetchCover('https://cover-test.example.com/page');assert.equal(requests,1);
 Object.assign(globalThis,{chrome:{permissions:{contains:async()=>false}}});
 const denied=await fetchCover('https://ungranted.example.com/page',true);
 assert.match(denied.error??'',/需授权/);assert.equal(requests,1);
 }finally{globalThis.fetch=oldFetch;Object.assign(globalThis,{document:oldDocument});}
});
