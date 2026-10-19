// Schedule & scores: wide table on computers, match cards on phones, score entry, live "now" marker, printing.
const phoneMQ=window.matchMedia?window.matchMedia("(max-width:760px)"):{matches:false,addEventListener(){}};
const isPhone=()=>phoneMQ.matches;
let schedFilter="all"; // "all" | "now" (now & next) | "open" (not played yet)

function chipFor(m){return m.group?(m.group==="A"?"chipA":"chipB"):(["qf","sf"].includes(koKind(m.id))?"chipK":"chipF")}
const scoreInput=(id,side)=>{const r=rawScore(id);const v=r?r[side]:"";return `<input class="score" type="number" inputmode="numeric" min="0" max="${bestOf(id)}" id="${id}${side}" value="${v}" oninput="onScore('${id}')" aria-label="Score">`};
const boSelect=id=>`<select class="bosel" data-admin data-bo="${id}" onchange="setBestOf('${id}',this.value)" aria-label="Match length">${boOptions()}</select>`;
const sfPicker=()=>`<label for="sfSel">Semi-final pairing <select id="sfSel" data-admin onchange="setSF(this.value)"></select></label>`;
function slotsBySection(ms){
const gs=ms.slots.filter(s=>s<=ms.groupSlots),ks=ms.slots.filter(s=>s>ms.groupSlots);
return {gs,ks,range:a=>a.length?(a[0]===a[a.length-1]?`slot ${a[0]}`:`slots ${a[0]}–${a[a.length-1]}`):""}
}

/* ---------- Building ---------- */
function buildSchedule(){
const ms=allMatches();
$("schedBox").innerHTML=isPhone()?buildCards(ms):buildTable(ms);
$("schedTools").innerHTML=`<div class="seg" role="group" aria-label="Show">${[["all","All matches"],["now","Now & next"],["open","Not played yet"]].map(([f,l])=>`<button class="${schedFilter===f?"on":""}" onclick="setFilter('${f}')">${l}</button>`).join("")}</div>`;
}
function buildTable(ms){
const C=courtsCfg().length,bySlot={};
ms.forEach(m=>(bySlot[m.slot]=bySlot[m.slot]||[]).push(m));
const span=3+3*C,{gs,ks,range}=slotsBySection(ms);
const band=(t,sm,cls)=>`<tr class="band ${cls||""}"><td colspan="${span}">${t}${sm?`<small>${sm}</small>`:""}</td></tr>`;
const stageCell=(s,arr)=>{
  const chips=[...new Set(arr.map(x=>`<span class="chip ${chipFor(x)}">${esc(x.stage)}</span>`))].join(" ");
  const bos=arr.map(x=>`<label class="bol"><span class="cname${x.court}"></span>${boSelect(x.id)}</label>`).join("");
  return `<td class="stage" rowspan="2">${chips}${bos}${arr.some(x=>x.over)?'<small class="overtag">after court hours</small>':""}<span class="latebadge" data-slb="${s}" hidden>⏰ Running late</span></td>`
};
const row=s=>{
  const list=bySlot[s],cls=s%2?"rowA":"rowB",at=c=>list.find(x=>x.court===c);
  let r1=`<tr class="${cls} first" data-slot="${s}"><td class="slotn" rowspan="2">${s}</td><td class="time" rowspan="2" data-time="${s}"></td>`,r2=`<tr class="${cls}" data-slot="${s}">`;
  for(let c=1;c<=C;c++){
    const m=at(c),sep=c>1?" c2s":"";
    if(!m){r1+=`<td class="emptyc${sep}" colspan="3" rowspan="2">–</td>`;continue}
    r1+=`<td class="tn${sep}"${c>1?' data-c2="1"':""} dir="auto" id="${m.id}-a" data-m="${m.id}"></td><td class="vs" rowspan="2">VS</td><td class="tn" dir="auto" id="${m.id}-b" data-m="${m.id}"></td>`;
    r2+=`<td class="sc${sep}" data-m="${m.id}">${scoreInput(m.id,"a")}</td><td class="sc" data-m="${m.id}">${scoreInput(m.id,"b")}</td>`;
  }
  return r1+stageCell(s,list)+`</tr>`+r2+`</tr>`
};
const ls=ms.lastSlot;
let h=`<colgroup><col style="width:58px"><col style="width:70px">${Array.from({length:C},()=>`<col><col style="width:40px"><col>`).join("")}<col style="width:190px"></colgroup>`;
h+=`<thead><tr><th>Slot</th><th>Time</th>${Array.from({length:C},(_,i)=>`<th colspan="3"${i?' class="c2"':""}><span class="cname${i+1}"></span></th>`).join("")}<th>Stage</th></tr></thead><tbody>`;
h+=band("Group stage",range(gs))+gs.map(row).join("");
h+=band("Knockout stage",range(ks));
if(ms.tpl.sfPicker)h+=`<tr class="band pick"><td colspan="${span}">${sfPicker()}</td></tr>`;
h+=ks.map(row).join("");
h+=band("Spare slots","extra time");
h+=[ls+1,ls+2].map((n,i)=>`<tr class="rowB ${i?"":"first"}"><td class="slotn">${n}</td><td class="time" data-time="${n}"></td><td colspan="${span-2}" class="note-cell">${i?"":"extra time for the final"}</td></tr>`).join("");
return `<div class="table-wrap" style="overflow:auto"><table class="sched" id="sched" style="min-width:${Math.max(640,320+C*300)}px">${h}</tbody></table></div>`
}
function buildCards(ms){
const bySlot={};ms.forEach(m=>(bySlot[m.slot]=bySlot[m.slot]||[]).push(m));
const {gs,ks,range}=slotsBySection(ms);
const side=(m,k)=>`<div class="mteam"><span class="tn" id="${m.id}-${k}" dir="auto"></span><div class="stepper"><button class="stepbtn" onclick="bump('${m.id}','${k}',-1)" aria-label="One round less">−</button>${scoreInput(m.id,k)}<button class="stepbtn" onclick="bump('${m.id}','${k}',1)" aria-label="One round more">+</button></div></div>`;
const tile=m=>`<div class="mtile" data-m="${m.id}"><div class="mtile-h"><span class="court cname${m.court}"></span><span class="chip ${chipFor(m)}">${esc(m.stage)}</span></div>${side(m,"a")}${side(m,"b")}<div class="mtile-f">${boSelect(m.id)}${m.over?'<small class="overtag">after court hours</small>':""}</div></div>`;
const card=s=>`<div class="mslot" data-slot="${s}"><div class="mslot-h"><b>Slot ${s}</b><span class="slot-t" data-time="${s}"></span><span class="nowtag">Now</span><span class="nexttag">Next</span><span class="latebadge" data-slb="${s}" hidden>⏰ Late</span></div>${bySlot[s].map(tile).join("")}</div>`;
let h=`<div class="mband">Group stage <small>${range(gs)}</small></div>`+gs.map(card).join("");
h+=`<div class="mband">Knockout stage <small>${range(ks)}</small></div>`;
if(ms.tpl.sfPicker)h+=`<div class="picker">${sfPicker()}</div>`;
h+=ks.map(card).join("");
return `<div class="mcards">${h}<p class="note" id="filterEmpty" hidden>No matches to show here.</p></div>`
}

/* ---------- Refreshing ---------- */
function fill(id,idx,ref,win,lose){
const el=$(id);if(!el)return;
el.textContent=idx!=null?teamName(idx):phText(ref);
el.className="tn"+(idx==null?" ph":"")+(win?" won":"")+(lose?" lost":"")+(el.dataset.c2?" c2s":"")
}
function refreshSchedule(){
courtsCfg().forEach((c,i)=>document.querySelectorAll(".cname"+(i+1)).forEach(el=>el.textContent=c.name));
document.querySelectorAll("[data-time]").forEach(el=>{const s=+el.dataset.time;el.textContent=isPhone()?`${timeFor(s)}–${fmtMin(slotStart(s)+slotDur())}`:timeFor(s)});
for(const m of allMatches()){
  const A=matchTeam(m.id,"a"),B=matchTeam(m.id,"b"),w=winner(m.id),bo=bestOf(m.id);
  fill(m.id+"-a",A,m.sourceA,w!=null&&w===A,w!=null&&w!==A);
  fill(m.id+"-b",B,m.sourceB,w!=null&&w===B,w!=null&&w!==B);
  const sel=document.querySelector(`[data-bo="${m.id}"]`);if(sel&&document.activeElement!==sel)sel.value=String(bo);
  const st=scoreState(rawScore(m.id),m.id);
  ["a","b"].forEach(k=>{const el=$(m.id+k);if(el){el.max=bo;el.title=`Best of ${bo}: first to ${winRounds(m.id)} wins`;el.classList.toggle("bad",st==="bad");el.classList.toggle("prog",st==="progress")}});
}
applyLive()
}

/* ---------- Score entry ---------- */
function onScore(id){
if(!canScore())return;
const a=$(id+"a").value,b=$(id+"b").value;
if(a===""||b===""){delete state.scores[id]}else{state.scores[id]={a:+a,b:+b}}
save();refresh();
cloudWrite(a===""||b===""?{["scores."+id]:DEL}:{["scores."+id]:{a:+a,b:+b}})
}
// Phone +/− buttons. The other side starts at 0, so a running score is saved and shown live.
function bump(id,side,d){
if(!canScore())return;
const el=$(id+side),other=$(id+(side==="a"?"b":"a"));
el.value=Math.max(0,Math.min(bestOf(id),(+el.value||0)+d));
if(other.value==="")other.value=0;
onScore(id)
}

/* ---------- Live "now" marker ---------- */
function todayStr(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
// Only on the tournament day: which slot is running, which is next, which matches are late (slot over, no final score)
function liveInfo(){
const day=state.settings.date;if(!day||day!==todayStr())return null;
const now=new Date(),nm=now.getHours()*60+now.getMinutes(),ms=allMatches(),dur=slotDur();
const cur=ms.slots.find(s=>slotStart(s)<=nm&&nm<slotStart(s)+dur)??null;
const next=ms.slots.find(s=>slotStart(s)>nm)??null;
const late=new Set(ms.filter(m=>slotStart(m.slot)+dur<=nm&&!score(m.id)).map(m=>m.id));
return {nm,cur,next,late,before:nm<slotStart(ms.slots[0]),after:nm>=slotStart(ms.lastSlot)+dur}
}
function applyLive(){
const L=liveInfo(),ms=allMatches();
document.querySelectorAll("#schedBox [data-slot]").forEach(el=>{const s=+el.dataset.slot;el.classList.toggle("now",!!L&&s===L.cur);el.classList.toggle("next",!!L&&s===L.next&&s!==L.cur)});
document.querySelectorAll("#schedBox [data-m]").forEach(el=>el.classList.toggle("late",!!L&&L.late.has(el.dataset.m)));
const lateSlots=new Set(L?[...L.late].map(id=>ms.byId[id].slot):[]);
document.querySelectorAll("[data-slb]").forEach(el=>el.hidden=!lateSlots.has(+el.dataset.slb));
const bar=$("liveBar"),day=state.settings.date;
let html="";
if(L){
  const parts=[];
  if(L.cur!=null)parts.push(`<b>● Now: slot ${L.cur}</b> · ${timeFor(L.cur)}–${fmtMin(slotStart(L.cur)+slotDur())}`);
  else if(L.before)parts.push(`<b>⏳ Starts at ${timeFor(ms.slots[0])}</b>`);
  else if(L.after)parts.push(`<b>Last slot is over</b>`);
  else parts.push(`<b>Break</b>`);
  if(L.next!=null)parts.push(`Next: slot ${L.next} at ${timeFor(L.next)}`);
  if(L.late.size)parts.push(`<span class="latetxt">⏰ ${L.late.size} match${L.late.size>1?"es":""} running late</span>`);
  if(L.cur!=null)parts.push(`<a href="#" onclick="jumpToNow();return false">Jump to now</a>`);
  html=parts.join(" · ");
}else if(day){
  const d=new Date(day+"T00:00");
  html=`📅 Tournament day: ${isNaN(d)?esc(day):d.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})}. The live “now” marker turns on that day.`;
}else if(isAdmin())html=`Set the <b>tournament date</b> in Setup to turn on the live “now” marker and late-match warnings.`;
bar.innerHTML=html;bar.hidden=!html;bar.classList.toggle("on",!!L);
applyFilter(L)
}
function jumpToNow(){const el=document.querySelector("#schedBox .now");if(el)el.scrollIntoView({behavior:"smooth",block:"center"})}
function setFilter(f){schedFilter=f;document.querySelectorAll("#schedTools .seg button").forEach(b=>b.classList.toggle("on",b.getAttribute("onclick").includes(`'${f}'`)));applyFilter(liveInfo())}
function applyFilter(L){
const ms=allMatches(),open=new Set(ms.filter(m=>!score(m.id)).map(m=>m.slot));
let show=null;
if(schedFilter==="open")show=open;
else if(schedFilter==="now"){
  show=new Set();
  if(L){[L.cur,L.next].forEach(s=>s!=null&&show.add(s));L.late.forEach(id=>show.add(ms.byId[id].slot))}
  else ms.slots.filter(s=>open.has(s)).slice(0,2).forEach(s=>show.add(s));
}
let any=false;
document.querySelectorAll("#schedBox [data-slot]").forEach(el=>{const v=!show||show.has(+el.dataset.slot);el.hidden=!v;if(v)any=true});
document.querySelectorAll("#schedBox .band,#schedBox .mband,#schedBox .picker").forEach(el=>el.hidden=!!show);
const e=$("filterEmpty");if(e)e.hidden=any;
}

/* ---------- Printing ---------- */
function printSheets(){
const ms=allMatches(),perHour=Math.max(1,Math.round(60/slotDur())),LAST=ms.lastSlot,C=courtsCfg().length;
const nm=(id,side,ref)=>{const t=matchTeam(id,side);return t!=null?`<td class="nm" dir="auto">${esc(teamName(t))}</td>`:`<td class="nm ph" dir="auto">${esc(phText(ref))}</td>`};
let out="";
for(let from=1;from<=LAST;from+=perHour){
  const to=Math.min(from+perHour-1,LAST);
  for(let c=1;c<=C;c++){
    let rows="";
    for(let sl=from;sl<=to;sl++){
      const m=ms.find(x=>x.slot===sl&&x.court===c); if(!m)continue;
      const cls=(sl%2)?"":"alt", r=rawScore(m.id);
      const va=r&&r.a!==""?r.a:"", vb=r&&r.b!==""?r.b:"";
      rows+=`<tr class="${cls}"><td class="sn">${sl}</td><td class="tm" rowspan="2">${timeFor(sl)}<small>${esc(m.stage)} · best of ${bestOf(m.id)}</small></td>${nm(m.id,"a",m.sourceA)}<td class="vs" rowspan="2">VS</td>${nm(m.id,"b",m.sourceB)}</tr>`+
            `<tr class="${cls}"><td class="sl">Score</td><td><span class="pbox">${esc(va)}</span></td><td><span class="pbox">${esc(vb)}</span></td></tr>`;
    }
    if(!rows)continue;
    const cn=esc(courtName(c));
    out+=`<div class="psheet"><h2>${cn}</h2><p class="psub">${timeFor(from)} – ${timeFor(to+1)} · slots ${from}–${to}</p><table class="ptable"><colgroup><col style="width:16%"><col style="width:18%"><col style="width:30%"><col style="width:8%"><col style="width:28%"></colgroup><thead><tr><th>Slot</th><th>Time</th><th colspan="3">${cn}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
}
$("printArea").innerHTML=out;
window.print()
}
