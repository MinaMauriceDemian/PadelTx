// Results views: group standings, knockout bracket, final ranking. Also refresh()/renderAll(), which redraw everything.
/* ---------- Standings, bracket, ranking ---------- */
function renderStandings(){
const q=qualMap(),contender=p=>q[p]&&["qf","sf","final"].includes(koKind(q[p]));
const byTarget={};Object.keys(q).map(Number).sort((a,b)=>a-b).forEach(p=>{const l=koLower(q[p]);(byTarget[l]=byTarget[l]||{id:q[p],ps:[]}).ps.push(p)});
$("legend").innerHTML=Object.entries(byTarget).map(([l,{id,ps}])=>{const k=koKind(id),cls=k==="sf"||k==="final"?"chipF":k==="qf"?"chipK":"chipA";return `<span class="chip ${cls}">${ps.length>2?ord(ps[0])+"–"+ord(ps[ps.length-1]):ps.map(ord).join(" & ")} → ${esc(l)}</span>`}).join("");
const head=`<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th class="rw">Rounds won<small>RW</small></th><th>Rounds lost<small>RL</small></th><th>Diff</th><th>Pts</th></tr></thead>`;
$("standGroups").innerHTML=groupLetters().map(g=>`<div class="card stand-card"><h3><span class="chip chip${g}">Group ${g}</span></h3><div class="table-wrap" style="overflow:auto"><table class="standings">${head}<tbody>${getStand(g).map((x,i)=>`<tr class="${contender(i+1)?"qualified":""}"><td class="rank">${i+1}</td><td dir="auto">${esc(teamName(x.i))}</td><td>${x.p}</td><td>${x.w}</td><td>${x.l}</td><td class="rw">${x.pf}</td><td>${x.pa}</td><td class="${x.diff>0?"pos":x.diff<0?"neg":""}">${x.diff>0?"+":""}${x.diff}</td><td class="pts"><b>${x.pts}</b></td></tr>`).join("")}</tbody></table></div></div>`).join("")
}
function renderBracket(){
const ko=allMatches().filter(x=>x.ko);
const cols=[["Quarter-finals",ko.filter(x=>koKind(x.id)==="qf")],["Semi-finals",ko.filter(x=>koKind(x.id)==="sf")],["Final & placement matches",ko.filter(x=>!["qf","sf"].includes(koKind(x.id)))]].filter(c=>c[1].length);
const lab=(i,ref)=>i==null?`<span class="empty">${esc(phText(ref))}</span>`:esc(teamName(i));
const box=$("bracketBody");box.style.setProperty("--cols",cols.length);
box.innerHTML=cols.map(([title,ms])=>`<div class="round"><h3>${title}</h3><div class="round-body">${ms.map(m=>{
  const A=matchTeam(m.id,"a"),B=matchTeam(m.id,"b"),w=winner(m.id),sc=score(m.id);
  return `<div class="matchbox${m.id==="final"?" final":""}"><div class="mtitle">${koTitle(m.id)} · best of ${bestOf(m.id)}</div><div class="mrow${w!=null&&w===A?" winner":""}"><span dir="auto">${lab(A,m.sourceA)}</span><b class="mscore">${sc?sc.a:"–"}</b></div><div class="mrow${w!=null&&w===B?" winner":""}"><span dir="auto">${lab(B,m.sourceB)}</span><b class="mscore">${sc?sc.b:"–"}</b></div></div>`
}).join("")}</div></div>`).join("")
}
function renderRanking(){
const med=["🥇 ","🥈 ","🥉 "],cls=["gold","silver","bronze"];
$("rankBody").innerHTML=placements().map((p,i)=>`<tr class="${i<3?"medal "+cls[i]:""}"><td class="rank">${med[i]||""}${ord(i+1)}</td><td dir="auto">${p.t!=null?esc(teamName(p.t)):"–"}</td><td class="by">${esc(p.by)}</td></tr>`).join("")
}
function refresh(){renderSFPicker();refreshSchedule();renderStandings();renderBracket();renderRanking()}
function renderAll(){buildSchedule();renderFormatInfo();refresh();applyRole();lastBuiltN=teamCount()}
function showTab(id,btn){document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");const nav=btn.parentElement;if(nav&&nav.scrollWidth>nav.clientWidth)nav.scrollTo({left:btn.offsetLeft-(nav.clientWidth-btn.offsetWidth)/2,behavior:"smooth"})}
