(()=>{
"use strict";
const TAU=Math.PI*2, INK='#2b2342';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
function angDiff(a,b){let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hx(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function shade(h,f){const c=hx(h).map(v=>Math.round(f<0?v*(1+f):v+(255-v)*f));return`rgb(${c.join(',')})`}
function hexA(h,a){const c=hx(h);return`rgba(${c.join(',')},${a})`}
const $=id=>document.getElementById(id);

// ---------------- materials & upgrades
const MAT={
  iron:{n:'鉄',c:'#ff8f7a',h:1},
  ice:{n:'氷',c:'#7fe3ff',h:1},
  copper:{n:'銅',c:'#ffbf4d',h:2},
  crystal:{n:'水晶',c:'#b98bff',h:3},
  star:{n:'星晶',c:'#fff36b',h:4},
};
const ORES=Object.keys(MAT);
const UPG=[
  {k:'drill',n:'ドリル',ic:'⛏',lv:[
    {v:{tier:1,spd:16},t:'Tier1：表層だけ掘れる'},
    {c:{iron:6},v:{tier:2,spd:20},t:'Tier2：中層と銅が掘れる'},
    {c:{iron:10,copper:6},v:{tier:3,spd:26},t:'Tier3：深層と水晶が掘れる'},
    {c:{copper:12,crystal:6},v:{tier:4,spd:32},t:'Tier4：星晶が掘れる'},
    {c:{crystal:12,star:3},v:{tier:4,spd:54},t:'掘るスピード大幅アップ'}]},
  {k:'engine',n:'エンジン',ic:'🔥',u:'推力',lv:[{v:140},{c:{iron:6},v:175},{c:{iron:8,copper:6},v:215},{c:{copper:10,crystal:5},v:260},{c:{crystal:10,star:3},v:320}]},
  {k:'tank',n:'燃料タンク',ic:'⛽',u:'容量',lv:[{v:100},{c:{iron:5},v:150},{c:{copper:7},v:220},{c:{crystal:6},v:320}]},
  {k:'hull',n:'船体',ic:'🛡',u:'耐久',lv:[{v:100},{c:{iron:5},v:140},{c:{copper:6},v:190},{c:{crystal:6},v:260}]},
  {k:'cargo',n:'貨物室',ic:'📦',u:'積載',lv:[{v:20},{c:{iron:4},v:32},{c:{copper:6},v:48},{c:{crystal:5},v:72}]},
  {k:'legs',n:'着陸脚',ic:'🦿',u:'着陸できる速度',lv:[{v:55},{c:{iron:4},v:75},{c:{copper:5},v:100}]},
  {k:'magnet',n:'吸い込み磁石',ic:'🧲',u:'範囲',lv:[{v:70},{c:{iron:4},v:120},{c:{copper:5},v:190}]},
  {k:'nav',n:'軌道予測',ic:'🛰',u:'予測秒数',lv:[{v:10},{c:{iron:3},v:25},{c:{copper:4,ice:4},v:60}]},
  {k:'refinery',n:'氷→燃料 変換器',ic:'🧊',lv:[{v:0,t:'未搭載'},{c:{ice:8,iron:4},v:1,t:'氷1個で燃料+15。宇宙のどこでも給油'}]},
  {k:'goal',n:'星間エンジン',ic:'🌟',lv:[{v:0,t:'最終目標'},{c:{star:10,crystal:10,copper:10},v:1,t:'完成させてクリア！'}]},
];
const UPGM={};UPG.forEach(u=>UPGM[u.k]=u);
let up={};
const val=k=>UPGM[k].lv[up[k]].v;
const BURN=7;

// ---------------- world
const PDEF=[
  {id:'home',name:'ふるさと星',x:0,y:0,R:220,g:60,col:'#9fe6b8',base:true,ores:[['iron',.02,.14,12,10],['ice',.01,.1,7,9],['copper',.2,.42,5,9]]},
  {id:'moon',name:'こつき',par:'home',orb:950,ph:.6,R:70,g:22,col:'#e6defa',ores:[['copper',.04,.3,7,8],['iron',.03,.2,4,7]]},
  {id:'rust',name:'さびいろ星',x:3300,y:-1500,R:260,g:70,col:'#ffb894',ores:[['iron',.02,.15,10,11],['copper',.05,.3,10,10],['crystal',.32,.55,6,10]]},
  {id:'icy',name:'こおり星',x:-2700,y:2100,R:200,g:45,col:'#b2e6ff',ores:[['ice',.01,.2,16,11],['crystal',.16,.4,8,9],['copper',.08,.3,4,8]]},
  {id:'giant',name:'おおきな星',x:6200,y:3600,R:430,g:100,col:'#cdb8ff',ores:[['crystal',.04,.3,16,12],['star',.32,.56,8,12]]},
  {id:'m1',name:'まめ星A',par:'giant',orb:1050,ph:2.2,R:48,g:14,col:'#ffe7a3',ores:[['star',.08,.4,4,8],['crystal',.05,.3,3,7]]},
  {id:'m2',name:'まめ星B',par:'giant',orb:1500,ph:5.0,R:40,g:12,col:'#ffd0e4',ores:[['star',.08,.4,4,7],['copper',.05,.3,2,6]]},
];
const BASE_ANG=-Math.PI/2;
let planets=[], simT=0;

function buildWorld(){
  planets=PDEF.map((d,idx)=>{
    const r=rng(4242+idx*977);
    const p=Object.assign({},d);
    p.GM=d.g*d.R*d.R; p.x=d.x||0; p.y=d.y||0; p.vx=0; p.vy=0;
    p.N=Math.max(56,Math.round(TAU*d.R/7)); p.segW=TAU*d.R/p.N;
    p.h=new Float32Array(p.N); p.fill=new Float32Array(p.N); p.prot=new Uint8Array(p.N);
    const s1=r()*TAU,s2=r()*TAU,s3=r()*TAU;
    for(let i=0;i<p.N;i++){
      const a=i/p.N*TAU;
      let h=d.R*(1+0.022*(Math.sin(3*a+s1)*.5+Math.sin(7*a+s2)*.3+Math.sin(13*a+s3)*.2))+(r()-.5)*1.2;
      if(d.base){const ad=Math.abs(angDiff(a,BASE_ANG));if(ad<.34){const t=clamp((ad-.24)/.1,0,1);h=lerp(d.R+3,h,t*t*(3-2*t));}if(ad<.3)p.prot[i]=1;}
      p.h[i]=h;
    }
    p.deps=[];
    for(const [t,dmin,dmax,cnt,sz] of d.ores){
      for(let k=0;k<cnt;k++){
        let a;do{a=r()*TAU}while(d.base&&Math.abs(angDiff(a,BASE_ANG))<.4);
        const rr=d.R*(1-lerp(dmin,dmax,r())), s=sz*(.75+r()*.5);
        p.deps.push({t,x:Math.cos(a)*rr,y:Math.sin(a)*rr,s,s2:s*s,sp:r()*TAU});
      }
    }
    p.c1=d.col; p.c2=shade(d.col,-.16); p.c3=shade(d.col,-.32); p.c4=shade(d.col,.55);
    p.acc={}; p.ouch=0; p.settle=0; p.bo=r()*4;
    return p;
  });
  for(const p of planets){ if(p.par){p.parent=planets.find(q=>q.id===p.par);p.om=Math.sqrt(p.parent.GM/Math.pow(p.orb,3));} }
  updatePlanets(simT);
}
function updatePlanets(t){
  for(const p of planets){ if(!p.parent) continue;
    const a=p.ph+p.om*t, q=p.parent;
    p.x=q.x+Math.cos(a)*p.orb; p.y=q.y+Math.sin(a)*p.orb;
    p.vx=q.vx-Math.sin(a)*p.orb*p.om; p.vy=q.vy+Math.cos(a)*p.orb*p.om;
  }
}
function posAt(p,t,o){ if(!p.parent){o[0]=p.x;o[1]=p.y;return}
  posAt(p.parent,t,o); const a=p.ph+p.om*t; o[0]+=Math.cos(a)*p.orb; o[1]+=Math.sin(a)*p.orb; }
function hAt(p,ang){let f=(((ang%TAU)+TAU)%TAU)/TAU*p.N;const i=f|0,t=f-i;const a=p.h[i%p.N],b=p.h[(i+1)%p.N];return a+(b-a)*t}
function idxAt(p,ang){return Math.round((((ang%TAU)+TAU)%TAU)/TAU*p.N)%p.N}
function normalAt(p,ang){
  const d=p.segW/p.R, a1=ang-d, a2=ang+d, h1=hAt(p,a1), h2=hAt(p,a2);
  const tx=Math.cos(a2)*h2-Math.cos(a1)*h1, ty=Math.sin(a2)*h2-Math.sin(a1)*h1;
  let nx=ty, ny=-tx; const l=Math.hypot(nx,ny)||1; return [nx/l,ny/l];
}
const G=[0,0];
function gravAt(x,y){let ax=0,ay=0;for(const p of planets){const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1,dd=Math.max(d,p.R*.6),a=p.GM/(dd*dd);ax+=dx/d*a;ay+=dy/d*a}G[0]=ax;G[1]=ay;return G}
function nearest(x,y){let best=planets[0],bd=1e18;for(const p of planets){const d=Math.hypot(x-p.x,y-p.y)-p.R;if(d<bd){bd=d;best=p}}
  const ang=Math.atan2(y-best.y,x-best.x);return [best,Math.hypot(x-best.x,y-best.y)-hAt(best,ang)]}
function layerOf(p,r){const d=(p.R-r)/p.R;return d<.15?1:d<.35?2:d<.58?3:9}
function cellAt(p,a,r,i){
  if(p.fill[i]>.4) return ['rock',1,p.c1];
  const lx=Math.cos(a)*r, ly=Math.sin(a)*r, L=layerOf(p,r);
  for(const d of p.deps){const dx=lx-d.x,dy=ly-d.y;if(dx*dx+dy*dy<d.s2)return[d.t,Math.max(MAT[d.t].h,Math.min(L,3)),MAT[d.t].c]}
  return ['rock',L,L===1?p.c1:L===2?p.c2:L===3?p.c3:p.c4];
}

// ---------------- ship
const ship={x:0,y:0,vx:0,vy:0,a:0,state:'landed',body:null,phi:BASE_ANG,fuel:100,hull:100,cargo:{},cargoN:0,thrusting:false,drilling:false,dcd:0,deadT:0};
let store={}, won=false;
const home=()=>planets[0];
function atBase(){return ship.state==='landed'&&ship.body&&ship.body.base&&Math.abs(angDiff(ship.phi,BASE_ANG))<.15}
function clearCargo(){ORES.forEach(o=>ship.cargo[o]=0);ship.cargoN=0}
function respawn(){
  ship.state='landed';ship.body=home();ship.phi=BASE_ANG;ship.a=BASE_ANG;
  ship.fuel=val('tank');ship.hull=val('hull');clearCargo();setPose(1);
}
function setPose(k){
  const p=ship.body, phi=ship.phi, hc=hAt(p,phi), dl=9/hc;
  const hL=hAt(p,phi-dl), hR=hAt(p,phi+dl);
  const x1=Math.cos(phi-dl)*hL,y1=Math.sin(phi-dl)*hL,x2=Math.cos(phi+dl)*hR,y2=Math.sin(phi+dl)*hR;
  let ux=y2-y1, uy=-(x2-x1); const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
  let mx=(x1+x2)/2, my=(y1+y2)/2; const rm=Math.hypot(mx,my);
  if(rm<hc){mx+=Math.cos(phi)*(hc-rm);my+=Math.sin(phi)*(hc-rm)}
  ship.x=p.x+mx+ux*16; ship.y=p.y+my+uy*16;
  ship.a+=angDiff(Math.atan2(uy,ux),ship.a)*k;
  ship.vx=p.vx; ship.vy=p.vy;
}

// ---------------- input
const inp={l:false,r:false,t:false,d:false};
let uiOpen=false;
function hold(el,key){
  const on=e=>{e.preventDefault();inp[key]=true;el.classList.add('on');try{el.setPointerCapture(e.pointerId)}catch(_){}};
  const off=()=>{inp[key]=false;el.classList.remove('on')};
  el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
hold($('bL'),'l');hold($('bR'),'r');hold($('bT'),'t');hold($('bD'),'d');
const KEYS={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'t',KeyW:'t',Space:'d',ArrowDown:'d',KeyS:'d'};
addEventListener('keydown',e=>{
  if(KEYS[e.code]){inp[KEYS[e.code]]=true;e.preventDefault()}
  if(e.repeat)return;
  if(e.code==='KeyE'&&atBase())toggleShop();
  if(e.code==='KeyM')toggleMap();
  if(e.code==='KeyT')cycleWarp();
});
addEventListener('keyup',e=>{if(KEYS[e.code])inp[KEYS[e.code]]=false});
addEventListener('blur',()=>{for(const k in inp)inp[k]=false});

// ---------------- toast & pops
let toastT=0;const toastLast={};
function toast(msg,key,cool){const now=performance.now();if(key){if(toastLast[key]&&now-toastLast[key]<(cool||2500))return;toastLast[key]=now}
  const t=$('toast');t.textContent=msg;t.classList.add('show');toastT=2.2}
const pops=[];
function pop(x,y,txt,col){pops.push({x,y,txt,col,life:1})}

// ---------------- particles
const parts=[];
function spawnOre(p,i,mat,col,isOre){
  if(!isOre&&parts.length>520)return;
  const a=i/p.N*TAU, h=p.h[i], n=normalAt(p,a), tx=-n[1], ty=n[0];
  const sp=60+Math.random()*80, ts=(Math.random()-.5)*120;
  parts.push({k:isOre?'ore':'rock',b:p,mat,col,x:p.x+Math.cos(a)*(h+2),y:p.y+Math.sin(a)*(h+2),
    vx:p.vx+n[0]*sp+tx*ts,vy:p.vy+n[1]*sp+ty*ts,age:0,life:isOre?14:2+Math.random()*1.5,r:isOre?3.2:2+Math.random()*1.6});
}
function puff(x,y,vx,vy,n,col,spd,life,r){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=Math.random()*spd;parts.push({k:'fx',x,y,vx:vx+Math.cos(a)*s,vy:vy+Math.sin(a)*s,age:0,life:life*(.6+Math.random()*.6),r:r*(.6+Math.random()*.8),col})}}
function updateParts(dt){
  const mag=val('magnet'), cap=val('cargo');
  for(let i=parts.length-1;i>=0;i--){
    const q=parts[i]; q.age+=dt;
    if(q.age>q.life){parts.splice(i,1);continue}
    if(q.k==='fx'){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;continue}
    const b=q.b; let dx=b.x-q.x,dy=b.y-q.y; const d=Math.hypot(dx,dy)||1, ga=b.GM/(d*d);
    q.vx+=dx/d*ga*dt; q.vy+=dy/d*ga*dt;
    let pulled=false;
    if(q.k==='ore'&&q.age>.3&&ship.state!=='dead'){
      const sx=ship.x-q.x, sy=ship.y-q.y, sd=Math.hypot(sx,sy)||1;
      if(sd<mag){
        if(ship.cargoN<cap){
          pulled=true; q.vx+=sx/sd*1100*dt; q.vy+=sy/sd*1100*dt; q.vx=lerp(q.vx,ship.vx,.04); q.vy=lerp(q.vy,ship.vy,.04);
          if(sd<15){ship.cargo[q.mat]++;ship.cargoN++;pop(ship.x,ship.y,'+1 '+MAT[q.mat].n,MAT[q.mat].c);parts.splice(i,1);continue}
        } else toast('📦 貨物がいっぱい！基地へ戻ろう','full',4000);
      }
    }
    q.x+=q.vx*dt; q.y+=q.vy*dt;
    if(!pulled){
      const lx=q.x-b.x, ly=q.y-b.y, r=Math.hypot(lx,ly), a=Math.atan2(ly,lx), h=hAt(b,a);
      if(r<h+q.r*.5){
        const n=normalAt(b,a); q.x=b.x+Math.cos(a)*(h+q.r*.5); q.y=b.y+Math.sin(a)*(h+q.r*.5);
        let rvx=q.vx-b.vx, rvy=q.vy-b.vy; const vn=rvx*n[0]+rvy*n[1];
        if(vn<0){rvx-=1.45*vn*n[0];rvy-=1.45*vn*n[1];rvx*=.82;rvy*=.82}
        q.vx=b.vx+rvx; q.vy=b.vy+rvy;
      }
    }
  }
}

// ---------------- physics
function legsTol(){return val('legs')}
function damage(v){
  if(ship.dcd>0)return; ship.dcd=.25; ship.hull-=v; shake=Math.min(14,4+v*.3); flash=.35;
  toast('💥 ガツン！ -'+Math.round(v),'dmg',600);
  if(ship.hull<=0) explode();
}
function explode(){
  ship.hull=0; ship.state='dead'; ship.deadT=2.6; ship.body=null; shake=18;
  puff(ship.x,ship.y,ship.vx*.3,ship.vy*.3,50,'#ffb347',220,1.4,5);
  puff(ship.x,ship.y,ship.vx*.3,ship.vy*.3,30,'#fff6e6',160,1.6,4);
  puff(ship.x,ship.y,ship.vx*.3,ship.vy*.3,20,'#ff8f7a',120,1.8,6);
  toast('ロケット大破…基地で作り直します（貨物は失われた）');
}
function land(p){
  ship.state='landed'; ship.body=p; ship.phi=Math.atan2(ship.y-p.y,ship.x-p.x); setPose(.5);
  const ux=Math.cos(ship.a),uy=Math.sin(ship.a);
  puff(ship.x-ux*16,ship.y-uy*16,p.vx,p.vy,10,'rgba(255,246,230,.8)',50,.7,3);
  if(atBase()) onBase(); else toast('🛬 '+p.name+'に着陸！','land',1500);
}
function onBase(){
  if(ship.cargoN>0){
    const list=ORES.filter(o=>ship.cargo[o]>0).map(o=>MAT[o].n+'×'+ship.cargo[o]).join(' ');
    ORES.forEach(o=>store[o]+=ship.cargo[o]); clearCargo();
    toast('🏠 荷下ろし：'+list); save();
  } else toast('🏠 基地に帰還','base',3000);
}
function collide(){
  const ux=Math.cos(ship.a),uy=Math.sin(ship.a),px=-uy,py=ux;
  const pts=[[ship.x-ux*16+px*9,ship.y-uy*16+py*9],[ship.x-ux*16-px*9,ship.y-uy*16-py*9],[ship.x+ux*16,ship.y+uy*16],[ship.x+px*8,ship.y+py*8],[ship.x-px*8,ship.y-py*8]];
  for(const p of planets){
    if(Math.hypot(ship.x-p.x,ship.y-p.y)>p.R*1.08+26) continue;
    let w=null;
    for(const [x,y] of pts){const lx=x-p.x,ly=y-p.y,r=Math.hypot(lx,ly),a=Math.atan2(ly,lx),h=hAt(p,a);if(r<h&&(!w||h-r>w.pen))w={a,pen:h-r}}
    if(!w) continue;
    const n=normalAt(p,w.a), tx=-n[1], ty=n[0];
    ship.x+=n[0]*w.pen; ship.y+=n[1]*w.pen;
    const rvx=ship.vx-p.vx, rvy=ship.vy-p.vy, vn=rvx*n[0]+rvy*n[1], vt=rvx*tx+rvy*ty, impact=-vn;
    const rad=Math.atan2(ship.y-p.y,ship.x-p.x), upr=Math.cos(angDiff(ship.a,rad)), tol=legsTol();
    if(impact<tol&&Math.abs(vt)<tol*1.2&&upr>.55&&!inp.t){land(p);return}
    if(impact>tol) damage((impact-tol)*.6+3);
    if(ship.state==='dead')return;
    if(vn<0){const nvn=-vn*.3,nvt=vt*.75;ship.vx=p.vx+n[0]*nvn+tx*nvt;ship.vy=p.vy+n[1]*nvn+ty*nvt}
    ship.a+=angDiff(rad,ship.a)*.02;
  }
}
function stepFly(h){
  const rot=(inp.r?1:0)-(inp.l?1:0); ship.a+=rot*2.8*h;
  const g=gravAt(ship.x,ship.y); let ax=g[0],ay=g[1];
  ship.thrusting=false;
  if(inp.t&&ship.fuel>0){const th=val('engine');ax+=Math.cos(ship.a)*th;ay+=Math.sin(ship.a)*th;ship.fuel=Math.max(0,ship.fuel-BURN*h);ship.thrusting=true}
  ship.vx+=ax*h; ship.vy+=ay*h; ship.x+=ship.vx*h; ship.y+=ship.vy*h;
  collide();
}
let wallT=0;
function stepLanded(h){
  const p=ship.body;
  if(inp.t&&ship.fuel>0){
    const ux=Math.cos(ship.a),uy=Math.sin(ship.a);
    ship.state='flying'; ship.body=null; ship.x+=ux*3; ship.y+=uy*3; ship.vx=p.vx+ux*30; ship.vy=p.vy+uy*30; return;
  }
  ship.thrusting=false;
  const dir=(inp.r?1:0)-(inp.l?1:0);
  if(dir&&!inp.d){
    const hc=hAt(p,ship.phi), ahead=hAt(p,ship.phi+dir*11/hc);
    if(ahead-hc<8) ship.phi+=dir*42*h/hc; else if(wallT<=0){toast('壁だ！🔥で飛び出そう','wall');wallT=1}
  }
  setPose(.25);
}
function drillStep(dt){
  ship.drilling=false;
  if(ship.state!=='landed'||!inp.d) return;
  const p=ship.body;
  if(atBase()){toast('基地の上は掘れないよ','basedrill');return}
  const dv=val('drill'), tier=dv.tier, hc=hAt(p,ship.phi), half=10+tier*1.5, ah=half/hc;
  const i0=Math.floor((ship.phi-ah)/TAU*p.N), i1=Math.ceil((ship.phi+ah)/TAU*p.N);
  let hard=false, core=false, dug=false;
  for(let k=i0;k<=i1;k++){
    const i=((k%p.N)+p.N)%p.N; if(p.prot[i])continue;
    const a=k/p.N*TAU, w=1-Math.min(1,Math.abs(angDiff(a,ship.phi))/ah)*.6;
    const [m,hd,col]=cellAt(p,a,p.h[i]-1,i);
    if(hd>tier){if(hd>=9)core=true;else hard=true;continue}
    const dh=dv.spd/hd*w*dt;
    p.h[i]-=dh; if(p.fill[i]>0)p.fill[i]=Math.max(0,p.fill[i]-dh); dug=true;
    const isOre=m!=='rock', key=isOre?m:'rock:'+col;
    p.acc[key]=(p.acc[key]||0)+dh*p.segW;
    const unit=isOre?26:44;
    while(p.acc[key]>=unit){p.acc[key]-=unit; if(isOre||Math.random()<.6) spawnOre(p,i,m,col,isOre)}
  }
  if(dug){ship.drilling=true;p.ouch=.3;p.settle=2.5;shake=Math.max(shake,1.6)}
  else if(core) toast('ここから先はコア。掘れないよ','core');
  else if(hard) toast('かたい！ドリルの強化が必要（Tier'+(tier+1)+'）','hard');
}
function settle(p){
  const maxd=p.segW*2.2;
  for(let pass=0;pass<2;pass++) for(let i=0;i<p.N;i++){
    const j=(i+1)%p.N; if(p.prot[i]||p.prot[j])continue;
    const d=p.h[i]-p.h[j], ad=Math.abs(d); if(ad<=maxd)continue;
    const m=(ad-maxd)*.3, hi=d>0?i:j, lo=d>0?j:i;
    p.h[hi]-=m; p.fill[hi]=Math.max(0,p.fill[hi]-m); p.h[lo]+=m; p.fill[lo]+=m;
  }
}

// ---------------- prediction
let pred=[], predHit=null;
const tmp=[0,0];
function predict(){
  pred.length=0; predHit=null;
  if(ship.state!=='flying') return;
  const st=1/20, n=Math.round(val('nav')/st); let x=ship.x,y=ship.y,vx=ship.vx,vy=ship.vy;
  const P=planets.map(p=>[p.x,p.y,p]);
  for(let k=1;k<=n;k++){
    const t=simT+k*st;
    for(const e of P){if(e[2].parent){posAt(e[2],t,tmp);e[0]=tmp[0];e[1]=tmp[1]}}
    let ax=0,ay=0;
    for(const e of P){const dx=e[0]-x,dy=e[1]-y,d=Math.hypot(dx,dy)||1,dd=Math.max(d,e[2].R*.6),a=e[2].GM/(dd*dd);ax+=dx/d*a;ay+=dy/d*a}
    vx+=ax*st; vy+=ay*st; x+=vx*st; y+=vy*st;
    let hit=null;
    for(const e of P){const p=e[2],dx=x-e[0],dy=y-e[1],d=Math.hypot(dx,dy);if(d<p.R*1.06&&d<hAt(p,Math.atan2(dy,dx))+14){hit=p;break}}
    pred.push(x,y);
    if(hit){
      let pvx=0,pvy=0; if(hit.parent){const a=hit.ph+hit.om*t;pvx=hit.parent.vx-Math.sin(a)*hit.orb*hit.om;pvy=hit.parent.vy+Math.cos(a)*hit.orb*hit.om}
      predHit={x,y,p:hit,spd:Math.hypot(vx-pvx,vy-pvy),t:k*st}; break;
    }
  }
}

// ---------------- camera & render
const cv=$('c'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=1, zoom=1, camX=0, camY=0, camRot=0, shake=0, flash=0, mapMode=false, warp=1;
const bg=document.createElement('canvas');
const stars=[];
function resize(){
  DPR=Math.min(2,devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=W*DPR; cv.height=H*DPR;
  bg.width=Math.max(1,W);bg.height=Math.max(1,H);const b=bg.getContext('2d');
  const g=b.createLinearGradient(0,0,0,H);g.addColorStop(0,'#241d45');g.addColorStop(1,'#33285a');b.fillStyle=g;b.fillRect(0,0,W,H);
  const r=rng(7);
  for(const c of ['#ff9ad5','#8fd8ff','#b98bff','#9fe6b8']){const x=r()*W,y=r()*H,s=Math.max(W,H)*(.35+r()*.3);const rg=b.createRadialGradient(x,y,0,x,y,s);rg.addColorStop(0,hexA(c,.13));rg.addColorStop(1,hexA(c,0));b.fillStyle=rg;b.fillRect(0,0,W,H)}
}
(function(){const r=rng(99);for(let L=0;L<3;L++)for(let i=0;i<70;i++)stars.push({L,x:r()*1000,y:r()*1000,s:.8+r()*1.4+L*.5,tw:r()*TAU})})();
function w2s(x,y){const dx=(x-camX)*zoom,dy=(y-camY)*zoom,c=Math.cos(camRot),s=Math.sin(camRot);return[W/2+dx*c-dy*s,H/2+dx*s+dy*c]}
function baseZoom(){return clamp(Math.min(W,H)/520,.7,1.5)}
function mapFit(){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of planets){x0=Math.min(x0,p.x-p.R);y0=Math.min(y0,p.y-p.R);x1=Math.max(x1,p.x+p.R);y1=Math.max(y1,p.y+p.R)}
  x0=Math.min(x0,ship.x);x1=Math.max(x1,ship.x);y0=Math.min(y0,ship.y);y1=Math.max(y1,ship.y);
  const m=420;return{x:(x0+x1)/2,y:(y0+y1)/2,z:Math.min(W/(x1-x0+m*2),(H-180)/(y1-y0+m*2))};
}
function updateCamera(dt,nb,alt){
  let tz,tx=ship.x,ty=ship.y,tr=camRot;
  if(mapMode){const f=mapFit();tz=f.z;tx=f.x;ty=f.y;tr=0;camRot+=angDiff(0,camRot)*Math.min(1,dt*4)}
  else{
    tz=baseZoom()*clamp(430/(Math.max(0,alt)+300),.07,1.3)*(ship.state==='landed'?1.12:1);
    const d=Math.hypot(ship.x-nb.x,ship.y-nb.y), wgt=clamp(1-(d-nb.R)/(nb.R*2.5+500),0,1);
    tr=-Math.PI/2-Math.atan2(ship.y-nb.y,ship.x-nb.x);
    camRot+=angDiff(tr,camRot)*Math.min(1,dt*3.2*wgt);
  }
  zoom=Math.exp(lerp(Math.log(zoom),Math.log(tz),Math.min(1,dt*(mapMode?4:2.2))));
  const k=mapMode?Math.min(1,dt*4):Math.min(1,dt*12);
  camX=lerp(camX,tx,k); camY=lerp(camY,ty,k);
}
function drawStars(){
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(camRot);
  const R=Math.hypot(W,H)/2+20, par=[.03,.07,.14], T=performance.now()/1000;
  for(let L=0;L<3;L++){
    const ox=((-camX*par[L])%1000+1000)%1000, oy=((-camY*par[L])%1000+1000)%1000, k=Math.ceil(R/1000)+1;
    ctx.fillStyle=L===2?'#fff6e6':'#cfc4ff';
    for(const s of stars){ if(s.L!==L)continue;
      const al=.45+.4*Math.sin(T*1.7+s.tw); ctx.globalAlpha=al;
      for(let ix=-k;ix<k;ix++)for(let iy=-k;iy<k;iy++){
        const x=s.x+ox+ix*1000-500, y=s.y+oy+iy*1000-500; if(x<-R||x>R||y<-R||y>R)continue;
        ctx.fillRect(x-s.s/2,y-s.s/2,s.s,s.s);
      }
    }
  }
  ctx.globalAlpha=1; ctx.restore();
}
function drawPlanet(p){
  const sc=w2s(p.x,p.y), rs=p.R*1.5*zoom+10;
  if(sc[0]+rs<0||sc[0]-rs>W||sc[1]+rs<0||sc[1]-rs>H) return;
  const lw=1/zoom, small=p.R*zoom<5;
  ctx.save(); ctx.translate(p.x,p.y);
  const g=ctx.createRadialGradient(0,0,p.R*.9,0,0,p.R*1.5);g.addColorStop(0,hexA(p.col,.3));g.addColorStop(1,hexA(p.col,0));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,p.R*1.5,0,TAU);ctx.fill();
  if(small){ctx.fillStyle=p.col;ctx.strokeStyle=INK;ctx.lineWidth=2*lw;ctx.beginPath();ctx.arc(0,0,Math.max(p.R,4*lw),0,TAU);ctx.fill();ctx.stroke();ctx.restore();return}
  const step=p.R*zoom<60?Math.max(1,Math.floor(p.N/64)):1, path=new Path2D();
  for(let i=0;i<p.N;i+=step){const a=i/p.N*TAU,h=p.h[i];if(i===0)path.moveTo(Math.cos(a)*h,Math.sin(a)*h);else path.lineTo(Math.cos(a)*h,Math.sin(a)*h)}
  path.closePath();
  ctx.save(); ctx.clip(path);
  ctx.fillStyle=p.c1; ctx.fillRect(-p.R*1.2,-p.R*1.2,p.R*2.4,p.R*2.4);
  for(const [rr,c] of [[.85,p.c2],[.65,p.c3],[.42,p.c4]]){ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,p.R*rr,0,TAU);ctx.fill()}
  ctx.strokeStyle=hexA(INK,.12);ctx.lineWidth=2*lw;
  for(const rr of [.85,.65]){ctx.beginPath();ctx.arc(0,0,p.R*rr,0,TAU);ctx.stroke()}
  if(p.R*zoom>22){
    const T=performance.now()/1000;
    for(const d of p.deps){
      ctx.fillStyle=MAT[d.t].c; ctx.strokeStyle=INK; ctx.lineWidth=1.6*lw;
      ctx.beginPath(); for(let j=0;j<=10;j++){const a=j/10*TAU,rr=d.s*(1+.13*Math.sin(a*3+d.sp));j?ctx.lineTo(d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr):ctx.moveTo(d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr)} ctx.closePath(); ctx.fill(); ctx.stroke();
      if(zoom>.45){ctx.fillStyle='rgba(255,255,255,'+(.55+.4*Math.sin(T*3+d.sp))+')';ctx.beginPath();ctx.arc(d.x-d.s*.3,d.y-d.s*.3,d.s*.18,0,TAU);ctx.fill()}
    }
  }
  ctx.strokeStyle=shade(p.col,.45); ctx.lineWidth=7*lw; ctx.stroke(path);
  if(p.R*zoom>10) drawFace(p);
  ctx.restore();
  ctx.lineJoin='round'; ctx.strokeStyle=INK; ctx.lineWidth=3*lw; ctx.stroke(path);
  if(p.base) drawBase(p);
  ctx.restore();
}
function drawFace(p){
  const s=p.R*.42; ctx.save(); ctx.rotate(-camRot);
  const dx=ship.x-p.x, dy=ship.y-p.y, c=Math.cos(camRot), sn=Math.sin(camRot);
  let lx=dx*c-dy*sn, ly=dx*sn+dy*c; const l=Math.hypot(lx,ly)||1; lx/=l; ly/=l;
  ctx.strokeStyle=INK; ctx.fillStyle=INK; ctx.lineWidth=s*.055; ctx.lineCap='round'; ctx.lineJoin='round';
  const ex=s*.34, ey=-s*.08, er=s*.11, ouch=p.ouch>0;
  if(ouch){
    for(const sd of [-1,1]){const x=sd*ex;ctx.beginPath();ctx.moveTo(x-sd*er*.8,ey-er*.8);ctx.lineTo(x+sd*er*.6,ey);ctx.lineTo(x-sd*er*.8,ey+er*.8);ctx.stroke()}
  } else {
    const blink=((simT+p.bo)%4.3)<.14;
    for(const sd of [-1,1]){
      ctx.save(); ctx.translate(sd*ex+lx*s*.05, ey+ly*s*.05); ctx.scale(1,blink?.12:1);
      ctx.fillStyle=INK; ctx.beginPath(); ctx.ellipse(0,0,er*.8,er,0,0,TAU); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-er*.2+lx*er*.25,-er*.35+ly*er*.25,er*.3,0,TAU); ctx.fill(); ctx.restore();
    }
  }
  ctx.fillStyle='rgba(255,120,150,.42)';
  for(const sd of [-1,1]){ctx.beginPath();ctx.ellipse(sd*s*.58,s*.14,s*.14,s*.085,0,0,TAU);ctx.fill()}
  ctx.fillStyle=INK; ctx.beginPath();
  if(ouch){ctx.ellipse(0,s*.22,s*.075,s*.1,0,0,TAU);ctx.fill()}
  else{ctx.arc(0,s*.08,s*.13,.15*Math.PI,.85*Math.PI);ctx.stroke()}
  ctx.restore();
}
function drawBase(p){
  const a=BASE_ANG, h=hAt(p,a), T=performance.now()/1000, lw=Math.max(1.5,1.4/zoom);
  ctx.save(); ctx.rotate(a+Math.PI/2); ctx.translate(0,-h);
  ctx.strokeStyle=INK; ctx.lineWidth=lw; ctx.lineJoin='round';
  ctx.fillStyle='#5b4f7a'; ctx.beginPath(); ctx.roundRect(-26,-5,52,6,3); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffe08a'; for(let i=-20;i<=16;i+=9){ctx.fillRect(i,-4,4,4)}
  for(const sx of [-28,28]){ctx.fillStyle=(Math.sin(T*4+sx)>0)?'#9ff0bd':'#3c6650';ctx.beginPath();ctx.arc(sx,-3,2.4,0,TAU);ctx.fill();ctx.stroke()}
  ctx.fillStyle='#fff6e6'; ctx.beginPath(); ctx.arc(-50,0,16,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#8fd8ff'; ctx.beginPath(); ctx.arc(-50,-7,4.5,0,TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffb7a3'; ctx.beginPath(); ctx.roundRect(-57,-6,6,6,1.5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(46,0); ctx.lineTo(46,-38); ctx.stroke();
  ctx.fillStyle='#ffb7a3'; ctx.beginPath(); ctx.moveTo(46,-38); ctx.quadraticCurveTo(54+Math.sin(T*3)*2,-36,60,-33); ctx.lineTo(46,-29); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=(T%1.4<.7)?'#ff8f7a':'#7a3a3a'; ctx.beginPath(); ctx.arc(46,-40,2.6,0,TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawOrbits(){
  ctx.save(); ctx.strokeStyle='rgba(255,246,230,.12)'; ctx.lineWidth=2/zoom; ctx.setLineDash([10/zoom,14/zoom]);
  for(const p of planets) if(p.parent){ctx.beginPath();ctx.arc(p.parent.x,p.parent.y,p.orb,0,TAU);ctx.stroke()}
  ctx.restore();
}
function drawPred(){
  if(pred.length<4) return;
  ctx.save(); ctx.lineWidth=2.2/zoom; ctx.setLineDash([5/zoom,8/zoom]); ctx.lineCap='round';
  const n=pred.length/2;
  for(let s=0;s<4;s++){
    const a=Math.floor(n*s/4), b=Math.floor(n*(s+1)/4); if(b<=a)continue;
    ctx.strokeStyle='rgba(255,246,230,'+(.75-s*.16)+')'; ctx.beginPath(); ctx.moveTo(pred[a*2],pred[a*2+1]);
    for(let i=a+1;i<=Math.min(b,n-1);i++) ctx.lineTo(pred[i*2],pred[i*2+1]); ctx.stroke();
  }
  ctx.restore();
  if(predHit){
    const ok=predHit.spd<legsTol(), r=7/zoom;
    ctx.save(); ctx.translate(predHit.x,predHit.y); ctx.strokeStyle=ok?'#9ff0bd':'#ff8f8f'; ctx.lineWidth=3/zoom;
    if(ok){ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke()}else{ctx.beginPath();ctx.moveTo(-r,-r);ctx.lineTo(r,r);ctx.moveTo(r,-r);ctx.lineTo(-r,r);ctx.stroke()}
    ctx.restore();
  }
}
const DRILLC=['#d8d3e6','#ff8f7a','#ffbf4d','#b98bff','#fff36b'];
function drawShip(){
  if(ship.state==='dead') return;
  const sc=Math.max(1,.5/zoom), T=performance.now()/1000;
  ctx.save(); ctx.translate(ship.x,ship.y); ctx.rotate(ship.a+Math.PI/2); ctx.scale(sc,sc);
  ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round';
  if(ship.thrusting){
    const f=1+Math.sin(T*40)*.15+Math.random()*.25, big=1+up.engine*.12;
    ctx.fillStyle='#ffb347'; ctx.beginPath(); ctx.ellipse(0,15+9*f*big,6*big,11*f*big,0,0,TAU); ctx.fill();
    ctx.fillStyle='#fff1a8'; ctx.beginPath(); ctx.ellipse(0,14+6*f*big,3.2*big,6*f*big,0,0,TAU); ctx.fill();
  }
  if(ship.state==='landed'){
    const L=ship.drilling?9+Math.sin(T*30)*1.5:3;
    ctx.fillStyle=DRILLC[up.drill]; ctx.beginPath(); ctx.moveTo(-5,11); ctx.lineTo(5,11); ctx.lineTo(0,14+L); ctx.closePath(); ctx.fill(); ctx.stroke();
    if(ship.drilling){ctx.beginPath();const o=(T*40)%4;for(let y=12+o;y<13+L;y+=4){const w=5*(1-(y-11)/(3+L));ctx.moveTo(-w,y);ctx.lineTo(w,y-2)}ctx.stroke()}
  }
  ctx.beginPath(); ctx.moveTo(-5,8); ctx.lineTo(-10,16); ctx.moveTo(5,8); ctx.lineTo(10,16); ctx.moveTo(-12.5,16); ctx.lineTo(-7.5,16); ctx.moveTo(7.5,16); ctx.lineTo(12.5,16); ctx.stroke();
  ctx.fillStyle='#ff9a8a';
  ctx.beginPath(); ctx.moveTo(-7,1); ctx.lineTo(-13,11); ctx.lineTo(-6,9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7,1); ctx.lineTo(13,11); ctx.lineTo(6,9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#fff6e6'; ctx.beginPath(); ctx.ellipse(0,-1,8,13.5,0,0,TAU); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0,-1,8,13.5,0,0,TAU); ctx.clip(); ctx.fillStyle='#ff9a8a'; ctx.fillRect(-9,-16,18,8); ctx.fillStyle='#e8dcc8'; ctx.fillRect(-9,8,18,6); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0,-1,8,13.5,0,0,TAU); ctx.stroke();
  ctx.fillStyle='#8fd8ff'; ctx.beginPath(); ctx.arc(0,-1,4,0,TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(-1.3,-2.4,1.3,0,TAU); ctx.fill();
  ctx.restore();
}
function drawParts(){
  for(const q of parts){
    const a=q.k==='fx'?clamp(1-q.age/q.life,0,1):q.k==='rock'?clamp((q.life-q.age)/.6,0,1):clamp((q.life-q.age)/1.5,0,1);
    ctx.globalAlpha=a; ctx.fillStyle=q.col;
    const r=Math.max(q.r,(q.k==='fx'?1:1.6)/zoom);
    ctx.beginPath(); ctx.arc(q.x,q.y,r,0,TAU); ctx.fill();
    if(q.k==='ore'){ctx.strokeStyle=INK;ctx.lineWidth=1.2/zoom;ctx.stroke()}
  }
  ctx.globalAlpha=1;
}
function drawIndicators(){
  ctx.font='800 12px "M PLUS Rounded 1c",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const top=118, bot=H-150, m=26;
  for(const p of planets){
    const [sx,sy]=w2s(p.x,p.y), rs=p.R*zoom;
    const dist=Math.max(0,Math.round((Math.hypot(ship.x-p.x,ship.y-p.y)-p.R)/10));
    if(mapMode||(sx>-rs&&sx<W+rs&&sy>-rs&&sy<H+rs)){
      if(mapMode||rs<30){const hw=ctx.measureText(p.name).width/2+4;ctx.fillStyle='rgba(255,246,230,.9)';ctx.fillText(p.name,clamp(sx,hw,W-hw),sy+Math.max(rs,6)+11)}
      continue;
    }
    if(p.parent){const [px,py]=w2s(p.parent.x,p.parent.y),pr=p.parent.R*zoom;if(!(px>-pr&&px<W+pr&&py>-pr&&py<H+pr))continue}
    const dx=sx-W/2, dy=sy-H/2;
    let t=Infinity;
    if(dx>0)t=Math.min(t,(W-m-W/2)/dx); if(dx<0)t=Math.min(t,(m-W/2)/dx);
    if(dy>0)t=Math.min(t,(bot-H/2)/dy); if(dy<0)t=Math.min(t,(top-H/2)/dy);
    const ex=W/2+dx*t, ey=H/2+dy*t, ang=Math.atan2(dy,dx);
    ctx.save(); ctx.translate(ex,ey);
    ctx.save(); ctx.rotate(ang); ctx.fillStyle='rgba(255,246,230,.85)'; ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(8,-5); ctx.lineTo(8,5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle=p.col; ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,6,0,TAU); ctx.fill(); ctx.stroke();
    const ly=ey>H/2?-16:16;
    const lab=p.name+' '+dist+'km', hw=ctx.measureText(lab).width/2+6;
    ctx.fillStyle='rgba(255,246,230,.9)'; ctx.fillText(lab,clamp(0,-ex+hw,W-ex-hw),ly);
    ctx.restore();
  }
}
function drawPops(dt){
  ctx.font='800 13px "M PLUS Rounded 1c",sans-serif'; ctx.textAlign='center';
  for(let i=pops.length-1;i>=0;i--){const q=pops[i];q.life-=dt*1.1;if(q.life<=0){pops.splice(i,1);continue}
    const [sx,sy]=w2s(q.x,q.y); ctx.globalAlpha=clamp(q.life*2,0,1); ctx.lineWidth=3; ctx.strokeStyle=INK; const y=sy-34-(1-q.life)*30;
    ctx.strokeText(q.txt,sx,y); ctx.fillStyle=q.col; ctx.fillText(q.txt,sx,y)}
  ctx.globalAlpha=1;
}
function render(dt){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.drawImage(bg,0,0,W,H);
  drawStars();
  ctx.save();
  const sx=(Math.random()-.5)*shake, sy=(Math.random()-.5)*shake;
  ctx.translate(W/2+sx,H/2+sy); ctx.rotate(camRot); ctx.scale(zoom,zoom); ctx.translate(-camX,-camY);
  drawOrbits();
  for(const p of planets) drawPlanet(p);
  drawPred(); drawParts(); drawShip();
  ctx.restore();
  drawIndicators(); drawPops(dt);
  if(mapMode&&ship.state!=='dead'){const [x,y]=w2s(ship.x,ship.y);ctx.strokeStyle='#ffe08a';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,12+Math.sin(performance.now()/200)*2,0,TAU);ctx.stroke()}
  if(flash>0){ctx.fillStyle='rgba(255,120,120,'+flash*.6+')';ctx.fillRect(0,0,W,H)}
}

// ---------------- HUD & UI
let hudT=0;
function updateHUD(nb,alt){
  const fm=val('tank'), hm=val('hull');
  const fb=$('fuelB'); fb.style.width=(ship.fuel/fm*100)+'%'; fb.style.background=ship.fuel/fm<.2?'#ff8f8f':'#ffbf4d';
  const hb=$('hullB'); hb.style.width=(Math.max(0,ship.hull)/hm*100)+'%'; hb.style.background=ship.hull/hm<.3?'#ff8f8f':'#7ad9a0';
  let c='📦 '+ship.cargoN+'/'+val('cargo')+' ';
  for(const o of ORES) if(ship.cargo[o]>0) c+='<span><i class="dot" style="background:'+MAT[o].c+'"></i>'+ship.cargo[o]+'</span>';
  $('cargo').innerHTML=c;
  const spd=Math.hypot(ship.vx-nb.vx,ship.vy-nb.vy), tol=legsTol();
  let s='';
  if(ship.state==='dead') s='…再建中…';
  else if(ship.state==='landed') s=nb.name+(atBase()?'　🏠 基地':'　着陸中')+(ship.drilling?'　⛏ 掘削中':'');
  else{
    s=nb.name+'　高度 '+Math.max(0,Math.round(alt))+'　速度 <span class="'+(alt<220&&spd>tol?'warn':alt<220?'ok':'')+'">'+Math.round(spd)+'</span>';
    if(alt<220&&spd>tol) s+='　<span class="warn">⚠ はやすぎ</span>';
    if(predHit&&!mapMode) s+='<br><span class="'+(predHit.spd<tol?'ok':'warn')+'">'+predHit.p.name+'へ '+predHit.t.toFixed(1)+'秒後に'+(predHit.spd<tol?'着地':'衝突')+'</span>';
    if(ship.fuel<=0) s+='<br><span class="warn">燃料切れ！</span>';
  }
  $('info').innerHTML=s;
  $('bD').classList.toggle('off',ship.state!=='landed');
  $('bShop').classList.toggle('show',atBase());
  $('bIce').classList.toggle('show',up.refinery>0&&ship.cargo.ice>0&&ship.fuel<fm-1&&ship.state!=='dead');
  $('bSos').classList.toggle('show',ship.fuel<.5&&!atBase()&&ship.state!=='dead');
  const eff=effWarp(nb,alt); $('bWarp').textContent=(warp>1&&eff===1)?'x'+warp+'⏸':'x'+warp; $('bWarp').classList.toggle('act',warp>1);
}
function effWarp(nb,alt){return(ship.state!=='flying'||alt<180||inp.t)?1:warp}
function cycleWarp(){warp=warp===1?2:warp===2?4:warp===4?8:1;toast(warp===1?'時間：ふつう':'時間 x'+warp+'（星の近くでは自動でふつう）','warp',100)}
function toggleMap(){mapMode=!mapMode;$('bMap').classList.toggle('act',mapMode)}
$('bMap').onclick=toggleMap; $('bWarp').onclick=cycleWarp;
$('bMenu').onclick=()=>{$('menu').classList.remove('hide');uiOpen=true};
$('menuX').onclick=()=>{$('menu').classList.add('hide');uiOpen=false};
$('mHelp').onclick=()=>{$('menu').classList.add('hide');$('title').classList.remove('hide');$('startB').textContent='とじる';uiOpen=true};
let sosArm=0;
function sos(){respawn();toast('🆘 救難シャトルで基地へ戻った（貨物は失われた）');save()}
$('mSos').onclick=()=>{$('menu').classList.add('hide');uiOpen=false;sos()};
$('bSos').onclick=()=>{if(sosArm>0){sosArm=0;sos()}else{sosArm=3;toast('もう一度押すと基地へ帰還（貨物は失う）')}};
let resetArm=0;
$('mReset').onclick=()=>{if(resetArm>0){resetArm=0;try{localStorage.removeItem(SKEY)}catch(_){};newGame();$('menu').classList.add('hide');uiOpen=false;toast('最初からやり直します')}else{resetArm=3;$('mReset').textContent='🗑 本当に？もう一度押すとリセット'}};
$('bIce').onclick=()=>{const fm=val('tank'),need=Math.ceil((fm-ship.fuel)/15),use=Math.min(need,ship.cargo.ice);if(use<=0)return;ship.cargo.ice-=use;ship.cargoN-=use;ship.fuel=Math.min(fm,ship.fuel+use*15);toast('🧊 氷×'+use+' → 燃料 +'+use*15)};
$('bShop').onclick=toggleShop; $('shopX').onclick=toggleShop;
$('startB').onclick=()=>{$('title').classList.add('hide');uiOpen=false};
$('winB').onclick=()=>{$('win').classList.add('hide');uiOpen=false};
function toggleShop(){const s=$('shop');if(s.classList.contains('hide')){buildShop();s.classList.remove('hide');uiOpen=true}else{s.classList.add('hide');uiOpen=false}}
function chip(o,n,have){return'<span class="chip'+(have!==undefined&&have<n?' no':'')+'"><i class="dot" style="background:'+MAT[o].c+'"></i>'+MAT[o].n+' '+(have!==undefined?have+'/':'')+n+'</span>'}
function fmtV(u,v){return typeof v==='object'?'':v}
function buildShop(){
  $('storeRow').innerHTML='<span style="font-weight:800;font-size:13px;align-self:center">倉庫：</span>'+ORES.map(o=>chip(o,store[o])).join('');
  let h='';
  for(const u of UPG){
    const lv=up[u.k], max=u.lv.length-1, cur=u.lv[lv], nx=u.lv[lv+1];
    let desc;
    if(!nx) desc=(cur.t||(u.u+' '+cur.v))+'　<b>MAX</b>';
    else if(nx.t) desc=nx.t;
    else desc=u.u+' '+cur.v+' → <b>'+nx.v+'</b>';
    let cost='', can=!!nx;
    if(nx) for(const o in nx.c){cost+=chip(o,nx.c[o],store[o]);if(store[o]<nx.c[o])can=false}
    const lvTxt=(u.k==='refinery'||u.k==='goal')?(lv?'完成':'未完成'):'Lv'+(lv+1)+'/'+(max+1);
    h+='<div class="up"><div class="ui">'+u.ic+'</div><div class="ut"><b>'+u.n+' <small>'+lvTxt+'</small></b><div class="ud">'+desc+'</div><div class="uc">'+cost+'</div></div>'+
       (nx?'<button class="buy" data-k="'+u.k+'"'+(can?'':' disabled')+'>'+(u.k==='goal'?'つくる':'強化')+'</button>':'')+'</div>';
  }
  $('upList').innerHTML=h;
  $('upList').querySelectorAll('.buy').forEach(b=>b.onclick=()=>buy(b.dataset.k));
}
function buy(k){
  const u=UPGM[k], nx=u.lv[up[k]+1]; if(!nx)return;
  for(const o in nx.c) if(store[o]<nx.c[o]) return;
  for(const o in nx.c) store[o]-=nx.c[o];
  up[k]++; ship.fuel=val('tank'); ship.hull=val('hull');
  toast('✨ '+u.n+' を強化した！'); save(); buildShop();
  if(k==='goal'){won=true;$('shop').classList.add('hide');$('win').classList.remove('hide');uiOpen=true;save()}
}

// ---------------- save / load
const SKEY='hoshihori_v1';
function save(){try{localStorage.setItem(SKEY,JSON.stringify({up,store,won,pl:planets.map(p=>({h:Array.from(p.h,v=>Math.round(v*4)),f:Array.from(p.fill,v=>Math.round(v*4))}))}))}catch(_){}}
function load(){
  try{const s=localStorage.getItem(SKEY);if(!s)return false;const o=JSON.parse(s);
    Object.assign(up,o.up||{}); for(const u of UPG) up[u.k]=clamp(up[u.k]|0,0,u.lv.length-1);
    Object.assign(store,o.store||{}); won=!!o.won;
    (o.pl||[]).forEach((d,i)=>{const p=planets[i];if(!p||!d||d.h.length!==p.N)return;for(let j=0;j<p.N;j++){p.h[j]=d.h[j]/4;p.fill[j]=(d.f[j]||0)/4}});
    return true;
  }catch(_){return false}
}
function newGame(){
  simT=0; up={}; UPG.forEach(u=>up[u.k]=0); store={}; ORES.forEach(o=>store[o]=0); won=false; parts.length=0;
  buildWorld(); respawn(); camX=ship.x; camY=ship.y; camRot=0; zoom=baseZoom();
}

// ---------------- loop
let last=performance.now(), saveT=0;
function update(dt){
  if(sosArm>0)sosArm-=dt; if(resetArm>0){resetArm-=dt;if(resetArm<=0)$('mReset').textContent='🗑 最初からやり直す'}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').classList.remove('show')}
  if(wallT>0)wallT-=dt;
  shake=Math.max(0,shake-dt*30); flash=Math.max(0,flash-dt); ship.dcd=Math.max(0,ship.dcd-dt);
  let [nb,alt]=nearest(ship.x,ship.y);
  const wf=uiOpen?1:effWarp(nb,alt), sim=dt*wf, n=Math.max(1,Math.ceil(sim/(1/180))), h=sim/n;
  if(uiOpen){for(const k in inp)inp[k]=false}
  for(let i=0;i<n;i++){
    simT+=h; updatePlanets(simT);
    if(ship.state==='flying') stepFly(h);
    else if(ship.state==='landed') stepLanded(h);
  }
  if(ship.state==='dead'){ship.deadT-=dt;if(ship.deadT<=0){respawn();save()}}
  drillStep(dt);
  if(ship.thrusting){const ux=Math.cos(ship.a),uy=Math.sin(ship.a);for(let i=0;i<2;i++)parts.push({k:'fx',x:ship.x-ux*22,y:ship.y-uy*22,vx:ship.vx-ux*(90+Math.random()*60)+(Math.random()-.5)*40,vy:ship.vy-uy*(90+Math.random()*60)+(Math.random()-.5)*40,age:0,life:.45,r:2.5+Math.random()*2.5,col:Math.random()<.5?'#ffb347':'#fff1a8'})}
  updateParts(sim);
  for(const p of planets){if(p.ouch>0)p.ouch-=dt;if(p.settle>0){p.settle-=dt;settle(p)}}
  if(atBase()){ship.fuel=Math.min(val('tank'),ship.fuel+60*dt);ship.hull=Math.min(val('hull'),ship.hull+40*dt)}
  [nb,alt]=nearest(ship.x,ship.y);
  predict();
  updateCamera(dt,nb,alt);
  hudT-=dt; if(hudT<=0){hudT=.1;updateHUD(nb,alt)}
  saveT+=dt; if(saveT>20){saveT=0;save()}
}
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  update(dt); render(dt);
  requestAnimationFrame(frame);
}
addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
resize(); newGame(); if(load()){respawn();camX=ship.x;camY=ship.y}
window.__game={ship,planets,inp,store,up,val,get simT(){return simT}};
requestAnimationFrame(frame);
})();
