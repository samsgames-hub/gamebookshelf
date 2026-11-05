/* Game Bookshelf online rooms, Firebase edition.
   Rooms live in Cloud Firestore (Google's servers on the normal HTTPS port), so they work on school and work
   networks that block the MQTT relay ports. If Firebase can't be reached, it falls back to the MQTT relays in mp.js.
   It offers the same small API as mp.js:
     db.doc(path).get() / .set(obj) / .update(patch) / .delete() / .onSnapshot(cb, err)
     db.collection(path).onSnapshot(cb, err)
   Each top-level field is stored as a JSON string. That keeps Firestore's rules out of the game's way (it rejects
   nested arrays and undefined values) and gives the same per-field merging as the relay version. */
(function(){
var CONFIG={
 apiKey:"AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY",
 authDomain:"gamebookshelf-9984c.firebaseapp.com",
 projectId:"gamebookshelf-9984c",
 storageBucket:"gamebookshelf-9984c.firebasestorage.app",
 messagingSenderId:"373968261700",
 appId:"1:373968261700:web:c41f30d9f3ef1f50dde211"
};
var relay=window.GWFNet;            // MQTT version from mp.js (fallback)
var fs=null,mode="",onstate=null;

function enc(obj){var o={};Object.keys(obj||{}).forEach(function(k){var v=obj[k];if(v===undefined)return;o[k]=JSON.stringify(v)});return o}
function dec(raw){var o={};Object.keys(raw||{}).forEach(function(k){var v=raw[k];if(typeof v!=="string")return;try{o[k]=JSON.parse(v)}catch(e){}});return o}
function snap(s){var d=s.exists?dec(s.data()):undefined;return{exists:!!s.exists,id:s.id,data:function(){return d===undefined?undefined:JSON.parse(JSON.stringify(d))}}}
function withTimeout(p,ms){return new Promise(function(res,rej){var t=setTimeout(function(){rej(new Error("timeout"))},ms);p.then(function(v){clearTimeout(t);res(v)},function(e){clearTimeout(t);rej(e)})})}

function fbDoc(path){
 var r=fs.doc(path);
 return{
  id:r.id,
  get:function(){return r.get().then(snap)},
  set:function(obj){return r.set(enc(obj))},
  update:function(obj){return r.set(enc(obj),{merge:true})},
  delete:function(){return r.delete()},
  onSnapshot:function(cb,eb){return r.onSnapshot(function(s){cb(snap(s))},function(e){console.warn("room sync:",e&&e.code);eb&&eb(e)})}
 };
}
function fbCol(path){
 var r=fs.collection(path);
 return{onSnapshot:function(cb,eb){return r.onSnapshot(function(q){var docs=q.docs.map(snap);cb({docs:docs,size:docs.length,empty:!docs.length})},function(e){console.warn("room sync:",e&&e.code);eb&&eb(e)})}};
}
function openFirebase(){
 if(!window.firebase||!firebase.firestore)return Promise.reject(new Error("firebase sdk missing"));
 var app=firebase.apps.length?firebase.app():firebase.initializeApp(CONFIG);
 fs=app.firestore();
 // long-polling auto-detection keeps it working behind strict school/office proxies
 try{fs.settings({experimentalAutoDetectLongPolling:true,merge:true})}catch(e){}
 // a real round trip so we only pick Firebase when it actually answers
 return withTimeout(fs.doc("meta/ping").get({source:"server"}),8000).then(function(){
  var was=true;addEventListener("offline",function(){if(was){was=false;onstate&&onstate("reconnecting")}});addEventListener("online",function(){if(!was){was=true;onstate&&onstate("online")}});
 });
}

var GWFNet={
 set onstate(f){onstate=f;if(relay)relay.onstate=f},get onstate(){return onstate},
 open:function(){
  return openFirebase().then(function(){mode="fb";return GWFNet},function(e){
   console.warn("Firebase unreachable, using relay servers:",e&&e.message);
   if(!relay)throw e;return relay.open().then(function(){mode="relay";return GWFNet});
  });
 },
 doc:function(p){return mode==="fb"?fbDoc(p):relay.doc(p)},
 collection:function(p){return mode==="fb"?fbCol(p):relay.collection(p)},
 find:function(path){
  if(mode!=="fb")return relay.find(path);
  return fbDoc(path).get();
 },
 server:function(){return mode==="fb"?"firebase":relay?relay.server():""},
 uid:function(){if(relay)return relay.uid();var k="gwf-uid",v;try{v=localStorage.getItem(k)}catch(e){}if(!v){v="p"+Math.random().toString(36).slice(2,12);try{localStorage.setItem(k,v)}catch(e){}}return v}
};
window.GWFNet=GWFNet;
})();
