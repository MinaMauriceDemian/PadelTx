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
const nextTxt=state.finished?"🏁 This tournament is finished.":next?`⏭ Next up: <b>${esc(dashMatchLabel(next))}</b>`:total?"✅ Every match has a result.":"";
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

/* ---------- Results image (1080 × 1350, made for WhatsApp / Instagram) ---------- */
let resBlob=null;
async function openResultsImage(){
const list=dashRanking();
if(!list.length){toast("There's no ranking yet. Enter some results first.");return}
$("resImg").removeAttribute("src");$("resMsg").textContent="Making the image…";$("resultDlg").showModal();
try{if(document.fonts)await Promise.all([document.fonts.load('800 80px "Barlow"'),document.fonts.load('600 40px "Barlow"')])}catch(e){}
const c=drawResults(list);
resBlob=await new Promise(r=>c.toBlob(r,"image/png"));
$("resImg").src=URL.createObjectURL(resBlob);$("resMsg").textContent="";
$("resShare").hidden=!(navigator.canShare&&navigator.canShare({files:[new File([resBlob],"results.png",{type:"image/png"})]}));
$("resUnfinish").hidden=!(isAdmin()&&state.finished)
}
async function shareResImg(){
if(!resBlob)return;
const f=new File([resBlob],fileSafe(tName())+"-results.png",{type:"image/png"});
try{await navigator.share({files:[f],title:tName(),text:resultsText()})}catch(e){}
}
function downloadResImg(){
if(!resBlob)return;
const a=document.createElement("a");a.href=URL.createObjectURL(resBlob);a.download=fileSafe(tName())+"-results.png";document.body.appendChild(a);a.click();a.remove()
}
const fileSafe=s=>String(s).replace(/[^\wÀ-ɏ؀-ۿ -]+/g,"").trim().replace(/\s+/g,"-").slice(0,40)||"padel";

function drawResults(list){
const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;
const g=c.getContext("2d"),F=(w,s)=>`${w} ${s}px "Barlow", system-ui, sans-serif`;
const bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0B1F44");bg.addColorStop(1,"#0B3D91");g.fillStyle=bg;g.fillRect(0,0,W,H);
// a padel ball in the corner
g.save();g.globalAlpha=.12;g.fillStyle="#E4F53B";g.beginPath();g.arc(W-60,120,260,0,7);g.fill();g.restore();
// fit a line of text into maxW by shrinking it, then cutting it with …
const fit=(t,maxW,w,size,min)=>{let s=size;g.font=F(w,s);while(g.measureText(t).width>maxW&&s>min){s-=2;g.font=F(w,s)}
  if(g.measureText(t).width>maxW){while(t.length>1&&g.measureText(t+"…").width>maxW)t=t.slice(0,-1);t+="…"}return t};
g.textAlign="center";g.textBaseline="alphabetic";
g.fillStyle="#E4F53B";g.font=F(800,34);g.fillText("PADEL TOUR · FINAL RANKING",W/2,96);
g.fillStyle="#FFFFFF";g.fillText(fit(tName(),W-120,800,72,40),W/2,184);
const s=state.settings||{},d=s.date?new Date(s.date+"T00:00"):null;
const sub=[d&&!isNaN(d)?d.toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}):"",s.venue||"",(STYLES.find(x=>x[0]===(state.style||"groups_ko"))||[,""])[1]].filter(Boolean).join("  ·  ");
g.fillStyle="#B9C6E4";g.fillText(fit(sub,W-120,600,32,22),W/2,236);
// podium: 2nd · 1st · 3rd
const pod=[[1,"#C9D1DC",210,"2"],[0,"#E4F53B",290,"1"],[2,"#D9A066",160,"3"]],bw=300,gap=24,x0=(W-3*bw-2*gap)/2,base=760;
pod.forEach(([i,col,h,n],k)=>{
  const p=list[i];if(!p)return;
  const x=x0+k*(bw+gap),cx=x+bw/2;
  g.fillStyle=col;g.beginPath();g.roundRect?g.roundRect(x,base-h,bw,h,[18,18,0,0]):g.rect(x,base-h,bw,h);g.fill();
  g.fillStyle="#0B1F44";g.font=F(800,110);g.fillText(n,cx,base-h+122);
  // medal
  g.fillStyle=col;g.beginPath();g.arc(cx,base-h-150,46,0,7);g.fill();
  g.fillStyle="#0B1F44";g.font=F(800,48);g.fillText(n,cx,base-h-133);
  g.fillStyle="#FFFFFF";g.fillText(fit(p.name,bw+10,800,40,22),cx,base-h-60);
  if(p.detail){g.fillStyle="#B9C6E4";g.fillText(fit(p.detail,bw+10,600,26,18),cx,base-h-22)}
});
// the rest of the ranking
const rest=list.slice(3,9);let y=base+80;
g.textAlign="left";
rest.forEach((p,k)=>{
  g.fillStyle=k%2?"#ffffff10":"#ffffff1c";g.fillRect(60,y-44,W-120,62);
  g.fillStyle="#E4F53B";g.font=F(800,34);g.fillText(String(k+4),84,y);
  g.fillStyle="#FFFFFF";g.fillText(fit(p.name,p.detail?560:840,700,34,20),150,y);
  if(p.detail){g.textAlign="right";g.fillStyle="#B9C6E4";g.fillText(fit(p.detail,300,600,28,18),W-84,y);g.textAlign="left"}
  y+=66;
});
if(list.length>9){g.fillStyle="#B9C6E4";g.font=F(600,28);g.fillText(`+ ${list.length-9} more`,84,y+4)}
g.textAlign="center";g.fillStyle="#B9C6E4";g.font=F(600,28);g.fillText("Live results on Padel Tour",W/2,H-36);
return c
}
