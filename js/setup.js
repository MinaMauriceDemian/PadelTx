// Setup card: tournament settings, courts and their hours, teams, team count, style, visibility, match length.
let courtsDirty=false; // true while the admin has unsaved court edits

function fillStatic(){
const teamOpts=Array.from({length:MAX_TEAMS-MIN_TEAMS+1},(_,i)=>`<option value="${i+MIN_TEAMS}">${i+MIN_TEAMS} teams</option>`).join("");
const styleOpts=STYLES.map(([v,l,on])=>`<option value="${v}"${on?"":" disabled"}>${l}${on?"":" (coming soon)"}</option>`).join("");
const courtOpts=Array.from({length:MAX_COURTS},(_,i)=>`<option value="${i+1}">${i+1} court${i?"s":""}</option>`).join("");
["nteams","newTeams"].forEach(id=>{const el=$(id);if(el)el.innerHTML=teamOpts});
["style","newStyle"].forEach(id=>{const el=$(id);if(el)el.innerHTML=styleOpts});
if($("ncourts"))$("ncourts").innerHTML=courtOpts;
if($("newTeams"))$("newTeams").value="8";
}
function renderTeams(){
const gm=groupMembers(),gl=Object.keys(gm),box=$("teams");
box.classList.toggle("one",gl.length===1);
box.innerHTML=gl.map(g=>`<div class="group-box gb${g}"><h3 class="group-title"><span class="chip chip${g}">Group ${g}</span></h3>${gm[g].map((i,k)=>`<div class="team-row"><span class="num">${k+1}</span><input data-team="${i}" value="${esc(teamName(i))}" maxlength="40" aria-label="Team name"></div>`).join("")}</div>`).join("");
document.querySelectorAll("[data-team]").forEach(x=>x.oninput=()=>{if(!isAdmin())return;state.teams[+x.dataset.team]=x.value;save();refresh();clearTimeout(pending.teams);pending.teams=setTimeout(()=>{pending.teams=null;cloudWrite({teams:[...state.teams]})},600)});
}
function init(){fillStatic();rebuild();syncInputs();applyRole()}
function rebuild(){renderTeams();renderAll()}

/* ---------- Courts ---------- */
function courtRowsHtml(list){
return list.map((c,i)=>`<div class="courtrow"><span class="num">${i+1}</span>`+
`<label>Name<input class="cr-name" data-admin maxlength="30" value="${esc(c.name)}" oninput="courtsDirty=true"></label>`+
`<label>From<input class="cr-from" data-admin type="time" value="${esc(c.from)}" oninput="courtsDirty=true;courtHint(${i})"></label>`+
`<label>Hours<input class="cr-hours" data-admin type="number" min="0" max="24" step="0.5" value="${c.hours||""}" placeholder="all day" oninput="courtsDirty=true;courtHint(${i})"></label>`+
`<small class="cr-hint" id="crh${i}"></small></div>`).join("")
}
function readCourtRows(){
return [...document.querySelectorAll("#courtRows .courtrow")].map((r,i)=>({name:r.querySelector(".cr-name").value.trim()||("Court "+(i+1)),from:r.querySelector(".cr-from").value||"",hours:Math.max(0,+r.querySelector(".cr-hours").value||0)}))
}
function setCourtCount(n){
if(!isAdmin())return;
n=Math.max(1,Math.min(MAX_COURTS,+n||2));
const cur=readCourtRows(),list=Array.from({length:n},(_,i)=>cur[i]||{name:"Court "+(i+1),from:"",hours:0});
courtsDirty=true;$("courtRows").innerHTML=courtRowsHtml(list);list.forEach((_,i)=>courtHint(i));applyRole();
toast("Press “Apply settings” to rebuild the schedule.")
}
// Show the saved courts, unless the admin is in the middle of editing them
function fillCourtRows(force){
const box=$("courtRows");if(!box)return;
const a=document.activeElement;
if(!force&&(courtsDirty||(a&&a.closest&&a.closest("#courtRows"))))return;
const list=courtsCfg();
box.innerHTML=courtRowsHtml(list);$("ncourts").value=String(list.length);list.forEach((_,i)=>courtHint(i))
}
function courtHint(i){
const r=document.querySelectorAll("#courtRows .courtrow")[i];if(!r)return;
const from=r.querySelector(".cr-from").value||($("start")&&$("start").value)||state.settings.start,h=+r.querySelector(".cr-hours").value||0,f=toMin(from);
$("crh"+i).textContent=f==null?"":h?`${from}–${fmtMin(f+Math.round(h*60))}`:`from ${from}, until the end`
}

/* ---------- Saving settings ---------- */
function generate(){
if(!isAdmin())return;
state.settings={start:$("start").value||"12:00",duration:Math.max(5,+$("duration").value||20),date:$("tdate").value||"",courts:readCourtRows()};
if(window.CLOUD_ON)state.name=$("tname").value.trim()||state.name||"Tournament";
courtsDirty=false;save();renderAll();fillCourtRows(true);applyRole();
cloudWrite({settings:state.settings,name:state.name});
const n=allMatches().overCount;
toast(n?`Saved. ⚠ ${n} match${n>1?"es don't":" doesn't"} fit in the court hours (see the schedule).`:"Settings saved.")
}
function resetAll(){if(!isAdmin())return;if(confirm("Reset all match scores?")){state.scores={};save();renderAll();cloudWrite({scores:{}})}}
function changeTeamCount(v){
v=+v;
if(!isAdmin()||v===teamCount()||v<MIN_TEAMS||v>MAX_TEAMS){syncInputs();return}
const msg=Object.keys(state.scores).length?"All scores and match lengths will be cleared.":"Match lengths go back to the defaults.";
if(!confirm(`Change to ${v} teams? The groups and schedule are rebuilt. ${msg}`)){syncInputs();return}
state.teams=Array.from({length:v},(_,i)=>state.teams[i]||defaultTeamName(i));
state.scores={};state.bestOf={};state.sfPairing=0;
save();rebuild();cloudWrite({teams:[...state.teams],scores:{},bestOf:{},sfPairing:0})
}
function setStyle(v){
const s=STYLES.find(x=>x[0]===v);
if(!isAdmin()||!s||!s[2]){syncInputs();toast("That tournament style is coming soon.");return}
state.style=v;save();cloudWrite({style:v})
}
function setVisibility(v){
if(!isAdmin()||!["public","private"].includes(v)){syncInputs();return}
state.visibility=v;state._visMissing=false;$("vis").value=v;applyRole();cloudWrite({visibility:v});
toast(v==="private"?"Private: hidden from the public list. People with the ID or link can still follow it.":"Public: listed on the home page.")
}

/* ---------- Format summary ---------- */
function describeFormat(){
const n=teamCount(),gm=groupMembers(),gl=Object.keys(gm),m=allMatches(),C=courtsCfg().length;
const grp=gl.length===1?`All ${n} teams play each other once in one group (${n*(n-1)/2} matches).`:`The ${n} teams are split into Group A (${gm.A.length} teams) and Group B (${gm.B.length} teams); everyone plays each team in their group once.`;
const ko=m.tpl.rounds.flat().map(([id])=>koTitle(id));
const end=fmtMin(slotStart(m.lastSlot)+slotDur());
return `${grp} Matches are spread over ${C} court${C>1?"s":""} (only while each court is available). The group stage runs ${timeFor(1)}–${fmtMin(slotStart(m.groupSlots)+slotDur())}, then the knockout stage: ${ko.join(", ")}. The last match ends around ${end}. The Final ranking tab shows how every place is decided.`
}
function renderFormatInfo(){
const gl=groupLetters(),C=courtsCfg().length,ms=allMatches();
$("pills").innerHTML=[`${teamCount()} teams`,`${gl.length} group${gl.length>1?"s":""}`,`${C} court${C>1?"s":""}`].map(t=>`<span>${t}</span>`).join("");
$("formatHelp").textContent=describeFormat();
const kinds=[["group","Group matches"],["qf","Quarter-finals"],["sf","Semi-finals"],["final","Final"],["place","Placement matches"]].filter(([k])=>ms.some(x=>stageGroup(x.id)===k));
$("stageBo").innerHTML=kinds.map(([k,l])=>`<label>${l}<select data-admin onchange="setStageBestOf('${k}',this.value);this.value=''"><option value="">Set all…</option>${boOptions()}</select></label>`).join("");
const w=$("schedWarn");
w.hidden=!ms.overCount;
if(ms.overCount)w.textContent=`⚠ ${ms.overCount} match${ms.overCount>1?"es don't":" doesn't"} fit in the court hours, so ${ms.overCount>1?"they are":"it is"} scheduled after the courts close (marked “after court hours”). Add a court, add hours, or shorten the minutes per slot in Setup.`;
}
