// Organiser overview (top of Setup): registrations, payments, spots, matches played, what's next, quick actions.
// Also "Finish tournament": marks it finished and shares the final ranking as an image (podium + list).

function dashRanking(){
// [{name, detail}] best first; Americano/Mexicano use the leaderboard, Groups + knockout the final placements
if(isAm())return amTable().map(r=>({name:teamName(r.i),detail:`${fmtPts(r.total)} pts · ${r.w}W ${r.d}D ${r.l}L`}));
return placements().filter(p=>p.t!=null).map(p=>({name:teamName(p.t),detail:""}))
}
function dashMatchLabel(m){return (m.stage||(m.round?"Round "+m.round:"Match"))+" · "+timeFor(m.slot)+" · "+courtName(m.court)}

function renderDash(){
const box=$("orgDash");if(!box)return;
box.hidden=!(window.CLOUD_ON&&isAdmin()&&currentTid);if(box.hidden)return;
const ms=allMatches(),played=ms.filter(m=>score(m.id)).length,total=ms.length;
const next=[...ms].filter(m=>!score(m.id)).sort((a,b)=>a.slot-b.slot||a.court-b.court)[0];
const filled=state.teams.filter((_,i)=>!isFreeSlot(i)).length,N=teamCount(),what=isAm()?"players":"teams";
const reg=entries.filter(e=>e.status!=="declined"),waiting=reg.filter(e=>e.status==="pending").length,ok=reg.filter(e=>e.status==="accepted").length,paid=reg.filter(e=>e.paid).length;
const stat=(n,l,sub,cls)=>`<div class="dstat${cls?" "+cls:""}"><b>${n}</b><span>${l}</span>${sub?`<small>${sub}</small>`:""}</div>`;
const stats=[
  stat(`${filled}/${N}`,`${what} in`,filled<N?`${N-filled} spot${N-filled>1?"s":""} free`:"Full"),
  state.regOpen||reg.length?stat(waiting,"waiting for you",`${ok} confirmed${reg.filter(e=>e.status==="waitlist").length?` · ${reg.filter(e=>e.status==="waitlist").length} on waiting list`:""}`,waiting?"warn":""):"",
  hasPay()&&reg.length?stat(`${paid}/${reg.length}`,"paid",paid<reg.length?`${reg.length-paid} still to pay`:"Everyone paid"):"",
  stat(`${played}/${total}`,"matches played",total&&played===total?"All done":"")
].join("");
const nextTxt=state.finished?"This tournament is finished.":next?`Next up: <b>${esc(dashMatchLabel(next))}</b>`:total?"Every match has a result.":"";
box.innerHTML=`<div class="pubhead"><h2>Overview</h2>${state.finished?'<span class="stchip st-finished">Finished</span>':""}</div>
<div class="dstats">${stats}</div>${nextTxt?`<p class="dnext">${nextTxt}</p>`:""}
<div class="actions" style="margin:0"><button class="wa" onclick="waShare('link')">Share link</button><button class="secondary" onclick="printSheets()">Print court sheets</button>${waiting?`<button class="secondary" onclick="showPart('players')">Registrations (${waiting})</button>`:""}<button class="primary" onclick="${state.finished?"openResultsImage()":"finishT()"}">${state.finished?"🏆 Share results image":"🏁 Finish tournament"}</button></div>`
}

async function finishT(){
if(!isAdmin())return;
const ms=allMatches(),open=ms.filter(m=>!score(m.id)).length;
if(!confirm(open?`${open} match${open>1?"es have":" has"} no result yet. Finish the tournament anyway? The ranking is taken as it is now.`:"Finish the tournament and share the final ranking?"))return;
state.finished=true;cloudWrite({finished:true,finishedAt:Date.now()});renderDash();
openResultsImage()
}
function unfinishT(){if(!isAdmin())return;state.finished=false;cloudWrite({finished:false});renderDash();toast("The tournament is open again.")}

/* ---------- Results image (1080 × 1080, taller for long rankings; made for WhatsApp / Instagram) ---------- */
let resBlob=null;
// One Share button; its list holds every way to share the ranking
function toggleShareMenu(open){
const l=$("resShareList"),on=open===undefined?l.hidden:open;
l.hidden=!on;$("resShareBtn").setAttribute("aria-expanded",String(on))
}
async function openResultsImage(){
const list=dashRanking();
if(!list.length){toast("There's no ranking yet. Enter some results first.");return}
$("resImg").removeAttribute("src");$("resMsg").textContent="Making the image…";$("resultDlg").showModal();
try{if(document.fonts)await Promise.all([document.fonts.load('800 80px "Barlow"'),document.fonts.load('600 40px "Barlow"'),document.fonts.load('800 80px "Barlow Condensed"')])}catch(e){}
const c=drawResults(list);
resBlob=await new Promise(r=>c.toBlob(r,"image/png"));
$("resImg").src=URL.createObjectURL(resBlob);$("resMsg").textContent="";
$("resHow").textContent=canShareImg()?"Opens the share menu: pick WhatsApp and the chat.":"Copies the picture and opens WhatsApp: pick the chat and paste it (Ctrl+V).";toggleShareMenu(false);
$("resUnfinish").hidden=!(isAdmin()&&state.finished)
}
function canShareImg(){try{return !!(navigator.canShare&&navigator.canShare({files:[new File([resBlob],"results.png",{type:"image/png"})]}))}catch(e){return false}}
// Phones: the share menu (WhatsApp is in it). Computers: copy the image, open WhatsApp, the organiser pastes it into the chat.
async function shareResImg(){
if(!resBlob)return;
if(canShareImg()){
  const f=new File([resBlob],fileSafe(tName())+"-results.png",{type:"image/png"});
  try{await navigator.share({files:[f],title:tName(),text:tName()+": final ranking"})}catch(e){}
  return
}
let copied=false;
try{if(navigator.clipboard&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({"image/png":resBlob})]);copied=true}}catch(e){}
if(!copied)downloadResImg();
window.open("https://wa.me/?text="+encodeURIComponent(tName()+": final ranking 🏆"),"_blank","noopener");
toast(copied?"Image copied. In WhatsApp, open the chat and paste it (Ctrl+V).":"Image downloaded. In WhatsApp, open the chat and attach it.")
}
function downloadResImg(){
if(!resBlob)return;
const a=document.createElement("a");a.href=URL.createObjectURL(resBlob);a.download=fileSafe(tName())+"-results.png";document.body.appendChild(a);a.click();a.remove()
}
const fileSafe=s=>String(s).replace(/[^\wÀ-ɏ؀-ۿ -]+/g,"").trim().replace(/\s+/g,"-").slice(0,40)||"padel";

function drawResults(list){
// square (taller only when more than 5 places follow the podium): court in perspective, 3D podium, glass panel
const rest=list.slice(3,12),W=1080,PANEL=780,ROW=54,H=Math.max(1080,PANEL+(rest.length?rest.length*ROW+30:0)+(list.length>12?40:0)+100);
const c=document.createElement("canvas");c.width=W;c.height=H;
const g=c.getContext("2d"),F=(w,s,cond)=>`${w} ${s}px ${cond?'"Barlow Condensed",':""}"Barlow", system-ui, sans-serif`;
const fit=(t,maxW,w,size,min,cond)=>{let s=size;g.font=F(w,s,cond);while(g.measureText(t).width>maxW&&s>min){s-=2;g.font=F(w,s,cond)}
  if(g.measureText(t).width>maxW){while(t.length>1&&g.measureText(t+"…").width>maxW)t=t.slice(0,-1);t+="…"}return t};
const rr=(x,y,w,h,r)=>{g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h)};
const glow=(col,blur,fn)=>{g.save();g.shadowColor=col;g.shadowBlur=blur;fn();g.restore()};
// background
const bg=g.createRadialGradient(W/2,260,60,W/2,420,H);bg.addColorStop(0,"#15386F");bg.addColorStop(.55,"#0B1F44");bg.addColorStop(1,"#050E20");
g.fillStyle=bg;g.fillRect(0,0,W,H);
// the court in perspective, glowing lines (far baseline at the top, near side under the podium)
const FY=350,NY=700,FX=[190,890],NX=[-80,1160];
const P=(t,u)=>{const y=FY+(NY-FY)*t,l=FX[0]+(NX[0]-FX[0])*t,r=FX[1]+(NX[1]-FX[1])*t;return [l+(r-l)*u,y]};
const line=(a,b,w)=>{g.lineWidth=w;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke()};
glow("#8CFF5A",14,()=>{g.strokeStyle="rgba(140,255,90,.55)";
  g.beginPath();[[0,0],[0,1],[1,1],[1,0]].forEach(([t,u],i)=>g[i?"lineTo":"moveTo"](...P(t,u)));g.closePath();g.lineWidth=3;g.stroke();
  [.22,.78].forEach(t=>line(P(t,0),P(t,1),3));line(P(.22,.5),P(.78,.5),3);
  g.strokeStyle="rgba(140,255,90,.8)";line(P(.5,-.02),P(.5,1.02),5)});
// title, name plate, date line
g.textAlign="center";g.textBaseline="alphabetic";
glow("#E4F53B",26,()=>{g.fillStyle="#E4F53B";g.font=F(800,64,1);g.fillText("PADEL TOUR · FINAL RANKING",W/2,96)});
g.fillStyle="#F4FF9A";g.font=F(800,64,1);g.fillText("PADEL TOUR · FINAL RANKING",W/2,96);
const name=fit(tName(),W-260,800,76,40),nw=Math.min(W-140,g.measureText(name).width+80);
glow("rgba(0,0,0,.6)",24,()=>{rr(W/2-nw/2,122,nw,104,22);g.fillStyle="rgba(8,18,40,.9)";g.fill()});
rr(W/2-nw/2,122,nw,104,22);g.strokeStyle="rgba(255,255,255,.28)";g.lineWidth=2;g.stroke();
const metal=g.createLinearGradient(0,140,0,210);metal.addColorStop(0,"#FFFFFF");metal.addColorStop(.55,"#C9D1DC");metal.addColorStop(1,"#8E98A6");
fit(name,W-260,800,76,40);g.fillStyle=metal;g.lineWidth=4;g.strokeStyle="#0B1F44";g.strokeText(name,W/2,200);g.fillText(name,W/2,200);
const s=state.settings||{},d=s.date?new Date(s.date+"T00:00"):null;
const sub=[d&&!isNaN(d)?d.toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}):"",s.venue||"",(STYLES.find(x=>x[0]===(state.style||"groups_ko"))||[,""])[1]].filter(Boolean).join("  •  ");
g.fillStyle="#C9D3E6";g.fillText(fit(sub,W-120,600,32,22),W/2,268);
// podium: 2nd · 1st · 3rd
const BASE=755,BW=290,pod=[
  {i:1,x:85,top:595,front:["#E3E7EE","#8F99A7"],face:"#F4F6F9",edge:"#FFFFFF",num:["#FFFFFF","#7D8796"],n:"2",size:110},
  {i:0,x:395,top:535,front:["#ECFA5A","#AFC21A"],face:"#F6FDA8",edge:"#FFFFB0",num:["#FFF3A0","#B8901E"],n:"1",size:130},
  {i:2,x:705,top:625,front:["#E2A877","#94582B"],face:"#F1C49C",edge:"#FFD3A8",num:["#F6C399","#7E431C"],n:"3",size:110}];
// sparkles around the winner (same pattern every time)
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
glow("#FFD86B",8,()=>{g.fillStyle="#FFE08A";for(let k=0;k<46;k++){const a=rnd()*Math.PI,r=70+rnd()*110,x=540+Math.cos(a)*r*1.5,y=400-Math.sin(a)*r*.6;g.globalAlpha=.4+rnd()*.6;g.beginPath();g.arc(x,y,1+rnd()*2.4,0,7);g.fill()}g.globalAlpha=1});
pod.forEach(b=>{
  const p=list[b.i];if(!p)return;const cx=b.x+BW/2,D=24;
  // top face, front, the light strip along the top edge
  g.beginPath();g.moveTo(b.x+D,b.top-D);g.lineTo(b.x+BW-D,b.top-D);g.lineTo(b.x+BW,b.top);g.lineTo(b.x,b.top);g.closePath();g.fillStyle=b.face;g.fill();
  const fr=g.createLinearGradient(0,b.top,0,BASE);fr.addColorStop(0,b.front[0]);fr.addColorStop(1,b.front[1]);g.fillStyle=fr;g.fillRect(b.x,b.top,BW,BASE-b.top);
  const sh=g.createLinearGradient(b.x,0,b.x+BW,0);sh.addColorStop(0,"rgba(0,0,0,.18)");sh.addColorStop(.5,"rgba(255,255,255,.08)");sh.addColorStop(1,"rgba(0,0,0,.22)");g.fillStyle=sh;g.fillRect(b.x,b.top,BW,BASE-b.top);
  glow(b.edge,18,()=>{g.fillStyle=b.edge;g.fillRect(b.x+10,b.top+14,BW-20,5)});
  // name plate above the block
  const nm=fit(p.name,BW-40,800,42,22),pw=BW-10,py=b.top-D-14-(p.detail?96:70);
  glow("rgba(0,0,0,.55)",18,()=>{rr(cx-pw/2,py,pw,p.detail?96:70,16);g.fillStyle="rgba(10,22,48,.88)";g.fill()});
  rr(cx-pw/2,py,pw,p.detail?96:70,16);g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=2;g.stroke();
  g.fillStyle="#FFFFFF";g.fillText(nm,cx,py+48);
  if(p.detail){g.fillStyle=b.i===0?"#F4FF9A":b.i===2?"#F6C399":"#D6DCE5";g.fillText(fit(p.detail,BW-40,600,26,16),cx,py+82)}
  // big metallic place number
  const ng=g.createLinearGradient(0,py-b.size,0,py-8);ng.addColorStop(0,b.num[0]);ng.addColorStop(1,b.num[1]);
  g.font=F(800,b.size,1);glow("rgba(0,0,0,.6)",14,()=>{g.fillStyle=ng;g.fillText(b.n,cx,py-10)});
  g.lineWidth=3;g.strokeStyle="rgba(11,31,68,.7)";g.strokeText(b.n,cx,py-10);
});
// glass panel with the rest of the ranking
if(rest.length){
  const ph=rest.length*ROW+30;
  rr(80,PANEL,W-160,ph,22);g.fillStyle="rgba(14,32,66,.78)";g.fill();g.strokeStyle="rgba(150,180,230,.35)";g.lineWidth=2;g.stroke();
  rest.forEach((p,k)=>{
    const y=PANEL+15+k*ROW;
    if(k){g.strokeStyle="rgba(150,180,230,.18)";g.lineWidth=1;g.beginPath();g.moveTo(104,y);g.lineTo(W-104,y);g.stroke()}
    g.textAlign="left";g.fillStyle="#E4F53B";g.font=F(800,36,1);g.fillText(String(k+4),118,y+39);
    g.fillStyle="#FFFFFF";g.fillText(fit(p.name,p.detail?470:760,700,34,20),180,y+38);
    if(p.detail){g.textAlign="right";g.fillStyle="#C9D3E6";g.fillText(fit(p.detail,300,600,28,18),W-118,y+37)}
  });
  if(list.length>12){g.textAlign="left";g.fillStyle="#B9C6E4";g.font=F(600,28);g.fillText(`+ ${list.length-12} more`,118,PANEL+ph+36)}
}
// footer and a padel ball
g.textAlign="center";g.fillStyle="#B9C6E4";g.font=F(600,30);g.fillText("Live results on Padel Tour",W/2,H-42);
const bx=W-92,by=H-62,br=36,ball=g.createRadialGradient(bx-12,by-14,6,bx,by,br);ball.addColorStop(0,"#FAFFB0");ball.addColorStop(.6,"#E4F53B");ball.addColorStop(1,"#9DB012");
glow("rgba(228,245,59,.6)",24,()=>{g.fillStyle=ball;g.beginPath();g.arc(bx,by,br,0,7);g.fill()});
g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=3;g.beginPath();g.arc(bx-br*1.25,by,br*.95,-.75,.75);g.stroke();g.beginPath();g.arc(bx+br*1.25,by,br*.95,Math.PI-.75,Math.PI+.75);g.stroke();
return c
}
