// Schedule & scores: wide table on computers, match cards on phones, score entry, live "now" marker, printing.
const phoneMQ=window.matchMedia?window.matchMedia("(max-width:760px)"):{matches:false,addEventListener(){}};
const isPhone=()=>phoneMQ.matches;
let schedFilter="all"; // "all" | "now" (now & next) | "open" (not played yet)

function chipFor(m){return m.group?(m.group==="A"?"chipA":"chipB"):(["qf","sf"].includes(koKind(m.id))?"chipK":"chipF")}
const scoreInput=(id,side)=>{const r=rawScore(id);const v=r?r[side]:"";return `<input class="score" type="number" inputmode="numeric" min="0" max="${bestOf(id)}" id="${id}${side}" value="${v}" placeholder="–" oninput="onScore('${id}')" aria-label="Score">`};
const boSelect=id=>`<select class="bosel" data-admin data-bo="${id}" onchange="setBestOf('${id}',this.value)" aria-label="Match length">${boOptions()}</select>`;
const sfPicker=()=>`<label for="sfSel">Semi-final pairing <select id="sfSel" data-admin onchange="setSF(this.value)"></select></label>`;
function slotsBySection(ms){
// Every slot that has (or originally had) matches, plus the extra-time slots
const all=[...new Set([...ms.autoSlots,...ms.slots,...Array.from({length:ms.totalSlots-ms.autoLast},(_,i)=>ms.autoLast+1+i)])].sort((a,b)=>a-b);
const gs=all.filter(s=>s<=ms.groupSlots),ks=all.filter(s=>s>ms.groupSlots&&s<=ms.autoLast),xs=all.filter(s=>s>ms.autoLast);
return {gs,ks,xs,range:a=>a.length?`${timeFor(a[0])}–${fmtMin(slotStart(a[a.length-1])+slotDur())}`:""}
}
// Admin tools shown next to each match: move button, and "undo" when it was moved
const moveTools=x=>`<span class="adminonly mvtools"><button type="button" class="mvbtn" onclick="openMove('${x.id}')" title="Move this match">⇄ Move</button>${x.moved?`<button type="button" class="mvbtn undo" onclick="resetMove('${x.id}')" title="Back to its original slot">↺ Undo</button>`:""}</span>`;
const spareTools=()=>`<span class="adminonly spare-tools"><button type="button" class="mvbtn" onclick="addSpare(1)">+ Add extra-time slot</button><button type="button" class="mvbtn" onclick="addSpare(-1)">− Remove one</button></span>`;

/* ---------- Building ---------- */
function buildSchedule(){
const ms=allMatches();
$("schedBox").innerHTML=isPhone()?buildCards(ms):buildTable(ms);if(isPhone())carStart();
$("schedTools").innerHTML=`<div class="seg" role="group" aria-label="Show">${[["all","All matches"],["now","Now & next"],["open","Not played yet"]].map(([f,l])=>`<button class="${schedFilter===f?"on":""}" onclick="setFilter('${f}')">${l}</button>`).join("")}</div><span class="adminonly drag-hint">Admin: drag a team name to a free court (for example an extra-time slot) to move that match.</span>`;
}
function buildTable(ms){
const C=courtsCfg().length,bySlot={};
ms.forEach(m=>(bySlot[m.slot]=bySlot[m.slot]||[]).push(m));
const span=3+3*C,{gs,ks,xs,range}=slotsBySection(ms);
const band=(t,sm,cls,extra)=>`<tr class="band ${cls||""}"><td colspan="${span}">${t}${sm?`<small>${sm}</small>`:""}${extra||""}</td></tr>`;
const stageCell=(s,arr)=>{
  if(!arr.length)return `<td class="stage" rowspan="2"><small class="note">${s>ms.autoLast?"Extra time: free":"Free"}</small></td>`;
  const chips=[...new Set(arr.map(x=>`<span class="chip ${chipFor(x)}">${esc(x.stage)}</span>`))].join(" ");
  const bos=arr.map(x=>`<div class="bol"><span class="cname${x.court}"></span>${boSelect(x.id)}${moveTools(x)}</div>`).join("");
  return `<td class="stage" rowspan="2">${chips}${bos}${arr.some(x=>x.over)?'<small class="overtag">after court hours</small>':""}<span class="latebadge" data-slb="${s}" hidden>⏰ Running late</span></td>`
};
const row=s=>{
  const list=bySlot[s]||[],cls=s>ms.autoLast?"rowX":s%2?"rowA":"rowB",at=c=>list.find(x=>x.court===c);
  let r1=`<tr class="${cls} first" data-slot="${s}"><td class="slotn" rowspan="2">${s}</td><td class="time" rowspan="2" data-time="${s}"></td>`,r2=`<tr class="${cls}" data-slot="${s}">`;
  for(let c=1;c<=C;c++){
    const m=at(c),sep=c>1?" c2s":"";
    if(!m){r1+=`<td class="emptyc dropcell${sep}" colspan="3" rowspan="2" data-drop-slot="${s}" data-drop-court="${c}"><span class="dropmsg">Drop here</span><span class="emptymsg">–</span></td>`;continue}
    const mv=m.moved?" movedcell":"";
    r1+=`<td class="tn${sep}${mv}"${c>1?' data-c2="1"':""} dir="auto" id="${m.id}-a" data-m="${m.id}" data-drag="${m.id}" draggable="true"></td><td class="vs" rowspan="2">VS</td><td class="tn${mv}" dir="auto" id="${m.id}-b" data-m="${m.id}" data-drag="${m.id}" draggable="true"></td>`;
    r2+=`<td class="sc${sep}" data-m="${m.id}">${scoreInput(m.id,"a")}</td><td class="sc" data-m="${m.id}">${scoreInput(m.id,"b")}</td>`;
  }
  return r1+stageCell(s,list)+`</tr>`+r2+`</tr>`
};
let h=`<colgroup><col style="width:58px"><col style="width:70px">${Array.from({length:C},()=>`<col><col style="width:40px"><col>`).join("")}<col style="width:200px"></colgroup>`;
h+=`<thead><tr><th>Slot</th><th>Time</th>${Array.from({length:C},(_,i)=>`<th colspan="3"${i?' class="c2"':""}><span class="cname${i+1}"></span></th>`).join("")}<th>Stage</th></tr></thead><tbody>`;
h+=band("Group stage",range(gs))+gs.map(row).join("");
h+=band("Knockout stage",range(ks));
if(ms.tpl.sfPicker)h+=`<tr class="band pick"><td colspan="${span}">${sfPicker()}</td></tr>`;
h+=ks.map(row).join("");
h+=band("Extra time",xs.length?range(xs)+" · reserved for delays and the final":"none reserved","xband",spareTools());
h+=xs.map(row).join("");
// fixed-width table (cells keep the width set by the columns): wraps team names instead of overflowing
return `<div class="table-wrap" style="overflow:auto"><table class="sched" id="sched" style="min-width:${Math.max(640,330+C*300)}px">${h}</tbody></table></div>`
}
function buildCards(ms){
const bySlot={};ms.forEach(m=>(bySlot[m.slot]=bySlot[m.slot]||[]).push(m));
const {gs,ks,xs}=slotsBySection(ms);
const side=(m,k)=>`<div class="mteam"><span class="tn" id="${m.id}-${k}" dir="auto"></span><div class="stepper"><button class="stepbtn" onclick="bump('${m.id}','${k}',-1)" aria-label="One round less">−</button>${scoreInput(m.id,k)}<button class="stepbtn" onclick="bump('${m.id}','${k}',1)" aria-label="One round more">+</button></div></div>`;
const tile=m=>`<div class="mtile${m.moved?" movedtile":""}" data-m="${m.id}"><div class="mtile-h"><span class="court cname${m.court}"></span><span class="chip ${chipFor(m)}">${esc(m.stage)}</span></div>${side(m,"a")}${side(m,"b")}<div class="mtile-f">${boSelect(m.id)}${moveTools(m)}${m.over?'<small class="overtag">after court hours</small>':""}</div></div>`;
const part=s=>s>ms.autoLast?"Extra time":s>ms.groupSlots?"Knockout":"Group stage";
const card=s=>{const list=bySlot[s]||[];return `<div class="mslot${s>ms.autoLast?" xslot":""}" data-slot="${s}" data-label="${part(s)}"><div class="mslot-h"><b class="slot-time" data-time="${s}"></b><span class="slotno">${part(s)}</span><span class="nowtag">Now</span><span class="nexttag">Next</span><span class="latebadge" data-slb="${s}" hidden>⏰ Late</span></div>${list.length?list.map(tile).join(""):`<p class="note mfree">${s>ms.autoLast?"Extra time: free":"Free"}</p>`}</div>`};
let h=(ms.tpl.sfPicker?`<div class="picker">${sfPicker()}</div>`:"")+`<div class="mcar-admin adminonly">${spareTools()}</div>`;
return `<div class="mcards">${h}${carouselHtml([...gs,...ks,...xs].map(card).join(""))}<p class="note" id="filterEmpty" hidden>No matches to show here.</p></div>`
}
// Swipeable row of slots (phones): one slot per view, arrows and a position label
function carouselHtml(slides){
return `<div class="mcar-nav"><button type="button" class="mcar-btn" onclick="carStep(-1)" aria-label="Previous slot">‹</button><div class="mcar-pos" id="mcarPos" aria-live="polite"></div><button type="button" class="mcar-btn" onclick="carStep(1)" aria-label="Next slot">›</button></div><div class="mcar" id="mcar" onscroll="carScrolled()" ontouchstart="carPick()" onpointerdown="carPick()">${slides}</div>`
}
let carSlot=null,carTimer=null,carPicked=null;
// Remember a slot only when the person moved the row themselves (per tournament)
function carPick(){carPicked=currentTid||"local"}
const carSlides=()=>[...document.querySelectorAll("#mcar > .mslot")].filter(el=>!el.hidden);
function carIndex(){const car=$("mcar"),sl=carSlides();if(!car||!sl.length)return -1;let bi=0,bd=Infinity;sl.forEach((el,i)=>{const d=Math.abs(el.offsetLeft-car.scrollLeft);if(d<bd){bd=d;bi=i}});return bi}
function carUpdate(){
const sl=carSlides(),i=carIndex(),pos=$("mcarPos");if(!pos)return;
if(i<0){pos.textContent="";return}
const el=sl[i],s=+el.dataset.slot;carSlot=s;
pos.innerHTML=`<b>${timeFor(s)}–${fmtMin(slotStart(s)+slotDur())}</b><span>${esc(el.dataset.label)} · ${i+1} of ${sl.length}</span>`;
document.querySelectorAll(".mcar-btn").forEach((b,k)=>b.disabled=k===0?i===0:i===sl.length-1)
}
function carScrolled(){clearTimeout(carTimer);carTimer=setTimeout(carUpdate,60)}
function carStep(d){carPick();const sl=carSlides(),i=carIndex();const t=sl[Math.max(0,Math.min(sl.length-1,i+d))];if(t)carGoSlot(+t.dataset.slot,true)}
function carGoSlot(s,smooth){
const car=$("mcar");if(!car)return;
const sl=carSlides(),t=sl.find(el=>+el.dataset.slot===s)||sl.find(el=>+el.dataset.slot>s)||sl[sl.length-1];if(!t)return;
if(car.scrollTo)car.scrollTo({left:t.offsetLeft,behavior:smooth?"smooth":"auto"});else car.scrollLeft=t.offsetLeft;carSlot=+t.dataset.slot;setTimeout(carUpdate,smooth?350:0)
}
// Where the row opens: the slot you were on, else what's playing now, else the first slot still to play
function carStart(){
const car=$("mcar");if(!car)return;
const L=liveInfo(),ms=allMatches(),open=ms.filter(m=>!score(m.id)).map(m=>m.slot).sort((a,b)=>a-b);
const s=carSlot!=null&&carPicked===(currentTid||"local")?carSlot:L&&L.cur!=null?L.cur:open.length?open[0]:ms.slots[0];
requestAnimationFrame(()=>carGoSlot(s,false))
}

/* ---------- Drag & drop (computer) and the Move dialog (phone or keyboard) ---------- */
let dragId=null;
function initDragDrop(){
const box=$("schedBox");if(!box||box.dataset.dnd)return;box.dataset.dnd="1";
const cellOf=e=>e.target&&e.target.closest?e.target.closest(".dropcell"):null;
box.addEventListener("dragstart",e=>{
  const el=e.target.closest&&e.target.closest("[data-drag]");if(!el)return;
  if(!isAdmin()){e.preventDefault();return}
  dragId=el.dataset.drag;e.dataTransfer.setData("text/plain",dragId);e.dataTransfer.effectAllowed="move";
  document.body.classList.add("dragging");
  box.querySelectorAll(`[data-m="${dragId}"]`).forEach(x=>x.classList.add("dragsrc"));
});
box.addEventListener("dragend",()=>{dragId=null;document.body.classList.remove("dragging");box.querySelectorAll(".dropover,.dragsrc").forEach(x=>x.classList.remove("dropover","dragsrc"))});
box.addEventListener("dragover",e=>{const c=cellOf(e);if(!c||!dragId)return;e.preventDefault();e.dataTransfer.dropEffect="move";c.classList.add("dropover")});
box.addEventListener("dragleave",e=>{const c=cellOf(e);if(c&&!c.contains(e.relatedTarget))c.classList.remove("dropover")});
box.addEventListener("drop",e=>{
  const c=cellOf(e);if(!c)return;e.preventDefault();
  const id=(e.dataTransfer&&e.dataTransfer.getData("text/plain"))||dragId;
  if(id)moveMatch(id,+c.dataset.dropSlot,+c.dataset.dropCourt)
});
}
let moveId=null;
function openMove(id){
if(!isAdmin())return;
const ms=allMatches(),m=ms.byId[id];if(!m)return;moveId=id;
const C=courtsCfg().length,taken=new Set(ms.map(x=>x.slot+":"+x.court)),opts=[];
for(let s=1;s<=ms.totalSlots;s++)for(let c=1;c<=C;c++){
  if(taken.has(s+":"+c))continue;
  const tag=s>ms.autoLast?" · extra time":m.autoSlot===s&&m.autoCourt===c?" · original place":"";
  opts.push(`<option value="${s}:${c}">Slot ${s} · ${timeFor(s)} · ${esc(courtName(c))}${tag}</option>`);
}
const A=matchTeam(id,"a"),B=matchTeam(id,"b");
$("moveWhat").textContent=`${m.ko?koTitle(id):m.stage}: ${A!=null?teamName(A):phText(m.sourceA)} vs ${B!=null?teamName(B):phText(m.sourceB)}. Now in slot ${m.slot} (${timeFor(m.slot)}) on ${courtName(m.court)}.`;
$("moveTo").innerHTML=opts.join("")||'<option value="">No free court. Add an extra-time slot first.</option>';
const firstX=opts.findIndex(o=>o.includes("extra time"));if(firstX>=0)$("moveTo").selectedIndex=firstX;
$("moveDlg").showModal()
}
function confirmMove(){
const v=$("moveTo").value;if(!v||!moveId)return;
const [s,c]=v.split(":").map(Number);
if(moveMatch(moveId,s,c))$("moveDlg").close()
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
const nowList=s=>ms.filter(m=>m.slot===s).sort((a,b)=>a.court-b.court).map(m=>`<span class="lb-m"><b>${esc(courtName(m.court))}</b> ${esc(sideLabel(m,"a"))} <i>vs</i> ${esc(sideLabel(m,"b"))}</span>`).join("");
let html="";
if(L){
  let head="";
  if(L.cur!=null)head=`<b class="lb-now">● Now playing</b> <span>${timeFor(L.cur)}–${fmtMin(slotStart(L.cur)+slotDur())}</span>`;
  else if(L.before)head=`<b>⏳ Starts at ${timeFor(ms.slots[0])}</b>`;
  else if(L.after)head=`<b>All matches are over</b>`;
  else head=`<b>Break</b>`;
  const extra=[];
  if(L.next!=null)extra.push(`Next at ${timeFor(L.next)}`);
  if(L.late.size)extra.push(`<span class="latetxt">⏰ ${L.late.size} match${L.late.size>1?"es":""} running late</span>`);
  if(L.cur!=null)extra.push(`<a href="#" onclick="jumpToNow();return false">Show</a>`);
  html=`<div class="lb-head">${head}${extra.length?" · "+extra.join(" · "):""}</div>${L.cur!=null?`<div class="lb-list">${nowList(L.cur)}</div>`:""}`;
}else if(day){
  const d=new Date(day+"T00:00");
  html=`📅 ${isNaN(d)?esc(day):d.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})}${state.settings.start?" · starts "+esc(state.settings.start):""}${state.settings.venue?" · "+esc(state.settings.venue):""}`;
}else if(isAdmin())html=`Set the <b>tournament date</b> in Setup to show what's playing now and which matches run late.`;
bar.innerHTML=html;bar.hidden=!html;bar.classList.toggle("on",!!L);
applyFilter(L);
if(typeof renderFollow==="function")renderFollow()
}
function jumpToNow(){const L=liveInfo();if(L&&L.cur!=null)goToSlot(L.cur)}
function setFilter(f){schedFilter=f;document.querySelectorAll("#schedTools .seg button").forEach(b=>b.classList.toggle("on",b.getAttribute("onclick").includes(`'${f}'`)));applyFilter(liveInfo());if($("mcar")){const s=carSlides();if(s.length&&!s.some(el=>+el.dataset.slot===carSlot))carSlot=+s[0].dataset.slot;carGoSlot(carSlot,false)}}
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
if($("mcar")){const nav=document.querySelector(".mcar-nav");if(nav)nav.hidden=!any}
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
