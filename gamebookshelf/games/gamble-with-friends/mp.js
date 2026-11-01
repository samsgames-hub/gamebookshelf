/* Game Bookshelf online rooms.
   A tiny realtime "database" that runs over MQTT on free public brokers, so shared rooms work on any static
   website (GitHub Pages, Netlify, a USB stick...). It offers the small part of the claude.ai db API the game uses:
     db.doc(path).get() / .set(obj) / .update(patch) / .onSnapshot(cb)
     db.collection(path).onSnapshot(cb)
   Every document is a retained MQTT message. Fields carry timestamps and are merged last-writer-wins per field,
   so two players changing different things at the same moment never overwrite each other. */
(function(){
var DEFAULT_BROKERS=["wss://broker.emqx.io:8084/mqtt","wss://broker-cn.emqx.io:8084/mqtt","wss://broker.hivemq.com:8884/mqtt"];
var PREFIX="gamebookshelf-gwf/v1/";
var enc=new TextEncoder(),dec=new TextDecoder();
function brokersList(){
 try{var q=new URLSearchParams(location.search).get("broker");if(q)return[q]}catch(e){}
 return window.GWF_BROKERS||DEFAULT_BROKERS;
}
function rid(n){var s="abcdefghijklmnopqrstuvwxyz0123456789",o="";var a=new Uint8Array(n);crypto.getRandomValues(a);for(var i=0;i<n;i++)o+=s[a[i]%36];return o}
function now(){return Date.now()}
function clone(o){return o==null?o:JSON.parse(JSON.stringify(o))}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

/* ---------- minimal MQTT 3.1.1 over WebSocket (QoS 0, retained) ---------- */
function vlen(n){var o=[];do{var b=n%128;n=Math.floor(n/128);if(n>0)b|=128;o.push(b)}while(n>0);return o}
function str(s){var b=enc.encode(s);return[b.length>>8,b.length&255].concat(Array.from(b))}
function packet(h,body){return new Uint8Array([h].concat(vlen(body.length),body))}
function Client(url){
 this.url=url;this.ws=null;this.pid=1;this.subs={};this.waitAck={};this.onmsg=null;this.onstate=null;this.connected=false;this.closed=false;this.buf=new Uint8Array(0);this.tries=0;
}
Client.prototype.connect=function(timeout){
 var self=this;
 return new Promise(function(res,rej){
  var done=false,t=setTimeout(function(){if(!done){done=true;try{self.ws.close()}catch(e){}rej(new Error("timeout"))}},timeout||6000);
  var ws;try{ws=new WebSocket(self.url,["mqtt"])}catch(e){clearTimeout(t);rej(e);return}
  self.ws=ws;ws.binaryType="arraybuffer";
  ws.onopen=function(){
   var cid="gbs"+rid(12);
   var body=str("MQTT").concat([4,2,0,60]).concat(str(cid));
   ws.send(packet(0x10,body));
  };
  ws.onmessage=function(ev){self._data(new Uint8Array(ev.data),function(ok){if(!done){done=true;clearTimeout(t);ok?res():rej(new Error("refused"))}})};
  ws.onerror=function(){};
  ws.onclose=function(){
   var was=self.connected;self.connected=false;clearInterval(self.ping);
   if(!done){done=true;clearTimeout(t);rej(new Error("closed"));return}
   if(was&&!self.closed){self.onstate&&self.onstate("reconnecting");self._reconnect()}
  };
 });
};
Client.prototype._reconnect=function(){
 var self=this,d=Math.min(15000,800*Math.pow(1.7,this.tries++));
 setTimeout(function(){
  if(self.closed)return;
  self.connect(8000).then(function(){self.tries=0;self.onstate&&self.onstate("online");Object.keys(self.subs).forEach(function(f){self._sendSub(f)})}).catch(function(){self._reconnect()});
 },d);
};
Client.prototype._data=function(chunk,onConnack){
 var b=new Uint8Array(this.buf.length+chunk.length);b.set(this.buf);b.set(chunk,this.buf.length);
 var i=0;
 while(i<b.length){
  var h=b[i],mul=1,len=0,j=i+1,c;
  do{if(j>=b.length){this.buf=b.slice(i);return}c=b[j++];len+=(c&127)*mul;mul*=128}while(c&128);
  if(j+len>b.length){this.buf=b.slice(i);return}
  var p=b.subarray(j,j+len);i=j+len;
  var type=h>>4;
  if(type===2){var ok=p[1]===0;this.connected=ok;if(ok){var self=this;clearInterval(this.ping);this.ping=setInterval(function(){self._raw(new Uint8Array([0xC0,0]))},20000)}onConnack&&onConnack(ok)}
  else if(type===3){
   var tl=(p[0]<<8)|p[1],topic=dec.decode(p.subarray(2,2+tl)),k=2+tl,qos=(h>>1)&3;
   if(qos>0)k+=2;
   var payload=p.subarray(k);
   this.onmsg&&this.onmsg(topic,payload,!!(h&1));
  }
  else if(type===9){var id=(p[0]<<8)|p[1];var w=this.waitAck[id];if(w){delete this.waitAck[id];w()}}
 }
 this.buf=new Uint8Array(0);
};
Client.prototype._raw=function(bytes){if(this.ws&&this.ws.readyState===1)this.ws.send(bytes)};
Client.prototype._sendSub=function(filter,cb){
 var id=this.pid=(this.pid%65000)+1;if(cb)this.waitAck[id]=cb;
 this._raw(packet(0x82,[id>>8,id&255].concat(str(filter),[0])));
};
Client.prototype.subscribe=function(filter){
 var self=this;
 if(this.subs[filter])return this.subs[filter];
 this.subs[filter]=new Promise(function(res){self._sendSub(filter,res);setTimeout(res,4000)});
 return this.subs[filter];
};
Client.prototype.publish=function(topic,text,retain){
 var body=str(topic).concat(Array.from(enc.encode(text)));
 this._raw(packet(0x30|(retain?1:0),body));
};
Client.prototype.close=function(){this.closed=true;clearInterval(this.ping);try{this._raw(new Uint8Array([0xE0,0]));this.ws.close()}catch(e){}};

/* ---------- document store ---------- */
function merge(a,b){
 // a, b: {d:{}, f:{}, s:number, w:string}
 if(!a)return clone(b);if(!b)return clone(a);
 var s=Math.max(a.s||0,b.s||0),o={d:{},f:{},s:s,w:b.w},keys={};
 Object.keys(a.d||{}).forEach(function(k){keys[k]=1});Object.keys(b.d||{}).forEach(function(k){keys[k]=1});
 Object.keys(keys).forEach(function(k){
  var ha=a.d&&k in a.d,hb=b.d&&k in b.d,fa=ha?(a.f[k]||0):-1,fb=hb?(b.f[k]||0):-1;
  var useB=fb>fa||(fb===fa&&String(b.w)>String(a.w));
  var src=useB?b:a,f=useB?fb:fa;
  if(f<0||f<s)return;
  o.d[k]=clone(src.d[k]);o.f[k]=f;
 });
 return o;
}
function Store(client,url){
 this.c=client;this.url=url;this.cache={};this.docL={};this.colL={};this.mine={};this.me=rid(8);this.heal={};
 var self=this;
 client.onmsg=function(t,payload,retained){self._in(t,payload)};
}
Store.prototype._t=function(path){return PREFIX+path.replace(/^\/+|\/+$/g,"")};
Store.prototype._in=function(t,payload){
 var inc=null;
 if(payload.length){try{inc=JSON.parse(dec.decode(payload))}catch(e){return}if(!inc||typeof inc!=="object"||!inc.d)return}
 var old=this.cache[t],m;
 if(!inc){if(!old)return;m=null}else m=merge(old,inc);
 if(m&&old&&same(m,old))return;
 if(m)this.cache[t]=m;else delete this.cache[t];
 // if we hold newer fields that this message dropped, re-publish so the retained copy converges
 if(m&&inc&&!same(m.d,inc.d)&&this.mine[t]){var self=this;clearTimeout(this.heal[t]);this.heal[t]=setTimeout(function(){self._pub(t)},150+Math.random()*450)}
 this._notify(t);
};
Store.prototype._pub=function(t){var v=this.cache[t];this.c.publish(t,v?JSON.stringify(v):"",true)};
Store.prototype._notify=function(t){
 var v=this.cache[t],snap={exists:!!v,id:t.split("/").pop(),data:function(){return v?clone(v.d):undefined}};
 (this.docL[t]||[]).forEach(function(l){try{l(snap)}catch(e){console.error(e)}});
 var parent=t.slice(0,t.lastIndexOf("/"));
 if(this.colL[parent])this._colNotify(parent);
};
Store.prototype._colNotify=function(parent){
 var self=this,docs=Object.keys(this.cache).filter(function(k){return k.slice(0,k.lastIndexOf("/"))===parent}).map(function(k){var v=self.cache[k];return{id:k.split("/").pop(),exists:true,data:function(){return clone(v.d)}}});
 var snap={docs:docs,size:docs.length,empty:!docs.length};
 (this.colL[parent]||[]).forEach(function(l){try{l(snap)}catch(e){console.error(e)}});
};
Store.prototype._write=function(t,data,full){
 var ts=now(),cur=this.cache[t],o;
 if(full||!cur){o={d:clone(data),f:{},s:ts,w:this.me};Object.keys(o.d).forEach(function(k){o.f[k]=ts})}
 else{o=clone(cur);o.w=this.me;Object.keys(data).forEach(function(k){o.d[k]=clone(data[k]);o.f[k]=ts})}
 this.cache[t]=o;this.mine[t]=1;this.c.publish(t,JSON.stringify(o),true);this._notify(t);
 return Promise.resolve();
};
Store.prototype.doc=function(path){
 var self=this,t=this._t(path);
 return{
  id:t.split("/").pop(),
  get:function(){
   return self.c.subscribe(t).then(function(){return new Promise(function(r){setTimeout(r,self.cache[t]?0:900)})}).then(function(){
    var v=self.cache[t];return{exists:!!v,id:t.split("/").pop(),data:function(){return v?clone(v.d):undefined}};
   });
  },
  set:function(obj){self.c.subscribe(t);return self._write(t,obj,true)},
  update:function(obj){
   if(self.cache[t])return self._write(t,obj,false);
   return this.get().then(function(){return self._write(t,obj,!self.cache[t])});
  },
  delete:function(){delete self.cache[t];self.c.publish(t,"",true);self._notify(t);return Promise.resolve()},
  onSnapshot:function(cb,eb){
   (self.docL[t]=self.docL[t]||[]).push(cb);self.c.subscribe(t);
   if(self.cache[t])setTimeout(function(){self._notify(t)},0);
   return function(){self.docL[t]=(self.docL[t]||[]).filter(function(x){return x!==cb})};
  }
 };
};
Store.prototype.collection=function(path){
 var self=this,p=this._t(path);
 return{
  onSnapshot:function(cb,eb){
   (self.colL[p]=self.colL[p]||[]).push(cb);self.c.subscribe(p+"/+");
   setTimeout(function(){self._colNotify(p)},0);
   return function(){self.colL[p]=(self.colL[p]||[]).filter(function(x){return x!==cb})};
  }
 };
};

/* ---------- public API ---------- */
var current=null,clients={};
function connectTo(url){
 if(clients[url])return clients[url];
 var c=new Client(url);
 clients[url]=c.connect(6000).then(function(){var s=new Store(c,url);c.onstate=function(st){GWFNet.onstate&&GWFNet.onstate(st)};return s}).catch(function(e){delete clients[url];throw e});
 return clients[url];
}
var GWFNet={
 onstate:null,
 open:function(){
  var list=brokersList(),i=0;
  return new Promise(function(res,rej){
   (function next(){
    if(i>=list.length){rej(new Error("No online server could be reached"));return}
    var url=list[i++];
    connectTo(url).then(function(s){current=s;res(GWFNet)}).catch(next);
   })();
  });
 },
 doc:function(p){return current.doc(p)},
 collection:function(p){return current.collection(p)},
 // look for a room on every server; switch to the one that has it
 find:function(path){
  var list=brokersList(),start=current;
  return current.doc(path).get().then(function(s){
   if(s.exists)return s;
   var idx=0;
   return new Promise(function(res){
    (function next(){
     if(idx>=list.length){current=start;res(s);return}
     var url=list[idx++];if(start&&url===start.url){next();return}
     connectTo(url).then(function(st){return st.doc(path).get().then(function(r){if(r.exists){current=st;res(r)}else next()})}).catch(next);
    })();
   });
  });
 },
 server:function(){return current?current.url.replace(/^wss?:\/\//,"").split(/[:/]/)[0]:""},
 uid:function(){var k="gwf-uid",v;try{v=localStorage.getItem(k)}catch(e){}if(!v){v="p"+rid(10);try{localStorage.setItem(k,v)}catch(e){}}return v}
};
window.GWFNet=GWFNet;
})();
