// App shell: state, roles, login/landing pages, account, access management. Loaded first.
// New tournaments start with neutral names; the organiser types the real ones
const defaultTeams=Array.from({length:8},(_,i)=>"Team "+(i+1));
let state={teams:[...defaultTeams],teamPlayers:{},scores:{},bestOf:{},moves:{},style:"groups_ko",visibility:"public",settings:{start:"12:00",duration:20,date:""}};
const key="padelTournamentV2";
if(!window.CLOUD_ON){try{const s=JSON.parse(localStorage.getItem(key)); if(s) state={...state,...s,settings:{...state.settings,...(s?.settings||{})}}}catch(e){}}
function save(){if(window.CLOUD_ON)return;try{localStorage.setItem(key,JSON.stringify(state))}catch(e){}}
function $(id){return document.getElementById(id)}

/* ---------- Roles, tournaments, account & online sync ---------- */
// viewer = read-only · editor = can enter scores · admin = everything (roles are per tournament)
const DEFAULT_SETTINGS={start:"12:00",duration:20,date:""};
// No "courts" here on purpose: older tournaments keep their court1/court2 names (see courtsCfg in engine.js)
window.__defaults=(n=8,style)=>({teams:Array.from({length:n},(_,i)=>["americano","mexicano","mexicano_time"].includes(style)?"Player "+(i+1):defaultTeamName(i)),settings:{...DEFAULT_SETTINGS,date:todayStr(),courts:[{name:"Court 1"},{name:"Court 2"}]}});
function resetState(){state={teams:[...defaultTeams],teamPlayers:{},scores:{},bestOf:{},moves:{},style:"groups_ko",visibility:"public",settings:{...DEFAULT_SETTINGS},sfPairing:0}}
let role=window.CLOUD_ON?"viewer":"admin", authUser=null, cloudStatus="", view="app", currentTid=null, booted=false, autoOpen=true, myReq=null, requests=[], mine=[];
const canScore=()=>role==="editor"||role==="admin";
const isAdmin=()=>role==="admin";
const DEL="__DEL__";
const pending={teams:null};
function cloudWrite(u){if(window.CLOUD_ON&&window.__cloud)window.__cloud.write(u)}
let toastTimer;
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,5000)}
window.__toast=toast;
function showView(v){view=v;$("loginView").hidden=v!=="login";$("landing").hidden=v!=="landing";$("appView").hidden=v!=="app";$("marketView").hidden=v!=="market";$("profileView").hidden=v!=="profile";$("toursView").hidden=v!=="tours";$("mineView").hidden=v!=="mine"}
// Where "home" is: signed-in people and viewers go to the tournament list, everyone else to the login page
// The home page is the start for everyone; signing in is optional and chosen from there
const homeView=()=>"landing";
function continueAsViewer(){$("loginMsg").textContent="";showView("landing");renderLanding();window.scrollTo(0,0)}
function toLogin(){$("lMsg").textContent="";showView("login");window.scrollTo(0,0);setTimeout(()=>{const e=$("loginEmail");if(e)e.focus()},0)}
// The PADEL TOUR wordmark: always back to the home page
function brandHome(){
if(!window.CLOUD_ON){window.scrollTo({top:0,behavior:"smooth"});return}
if(view==="app"&&currentTid){goHome();window.scrollTo(0,0);return}
if(view==="market"){closeMarket();window.scrollTo(0,0);return}
if(location.hash)history.replaceState(null,"",location.pathname+location.search);
showView("landing");renderLanding();window.scrollTo(0,0)
}
const profileHash=()=>{const m=/^#p=([A-Za-z0-9_-]{6,128})$/.exec(location.hash);return m?m[1]:null};
const hashId=()=>{const m=/[#&]t=([A-Za-z0-9]+)/.exec(location.hash);return m?m[1].toUpperCase():null};
function syncInputs(){
const idle=el=>el&&document.activeElement!==el;
allMatches().forEach(m=>["a","b"].forEach(k=>{const el=$(m.id+k);if(idle(el)){const r=rawScore(m.id);el.value=r?r[k]:""}}));
document.querySelectorAll("[data-team]").forEach(el=>{if(idle(el))el.value=state.teams[+el.dataset.team]||""});
fillCourtRows();
[["start",state.settings.start],["duration",state.settings.duration],["tdate",state.settings.date||""],["tvenue",state.settings.venue||""],["tname",state.name||""],["nteams",String(teamCount())],["style",state.style||"groups_ko"],["vis",state.visibility||"public"],["ampts",String(typeof amPoints==="function"?amPoints():24)],["amrounds",String(typeof amRounds==="function"?amRounds():7)]].forEach(([id,v])=>{const el=$(id);if(idle(el))el.value=v})
}
window.__applyRemote=function(d){
if(d){
  state.name=d.name||"Tournament";state.members=d.members||{};state.ownerUid=d.ownerUid||null;
  if(pending.teams==null&&Array.isArray(d.teams)&&d.teams.length>=MIN_TEAMS&&d.teams.length<=24)state.teams=d.teams.map(String);
  if(d.settings)state.settings={...DEFAULT_SETTINGS,...d.settings};
  state.sfPairing=d.sfPairing!=null?+d.sfPairing:0;
  state.scores=d.scores||{};
  state.bestOf=d.bestOf||{};
  state.moves=d.moves||{};
  state.style=d.style||"groups_ko";
  state.visibility=d.visibility==="private"?"private":"public";
  state.teamPlayers=d.teamPlayers||{};
  state.regOpen=!!d.regOpen;state.finished=!!d.finished;
  state.regPay=d.regPay||null;
  state._visMissing=!d.visibility;
}
if(teamCount()!==lastBuiltN||document.body.dataset.style!==(state.style||"groups_ko")||!document.querySelector("[data-team]")||document.querySelectorAll("[data-team]").length!==teamCount())rebuild();
else renderFormatInfo();
syncInputs();refresh();applyRole()
};
window.__getInitial=()=>({teams:state.teams,settings:state.settings,sfPairing:state.sfPairing||0,scores:state.scores});
window.__cloudStatus=s=>{cloudStatus=s;applyRole()};
window.__setRole=function(r,u){role=r;authUser=u?(authUser&&authUser.uid===u.uid?{...authUser,...u}:u):null;applyRole();if(r==="admin"&&state._visMissing){state._visMissing=false;cloudWrite({visibility:state.visibility})}if($("authDlg").open)updateAuthDlg()};
window.__setRequests=l=>{requests=l;renderAccess();const n=l.filter(r=>r.status==="pending"&&!(state.members||{})[r.uid]).length;$("accessTab").textContent=n?`Access (${n})`:"Access";partBadge("setup",n)};
window.__setMyRequest=st=>{myReq=st;applyRole()};
window.__authState=function(u){
authUser=u;
if(u&&view==="login"){$("loginMsg").textContent="";showView("landing");window.scrollTo(0,0)}
if(u&&typeof ensureMyProfile==="function")ensureMyProfile();
if(view==="landing")renderLanding();
if(view==="mine")showMine();
if(view==="market")renderMarket();
if($("authDlg").open)updateAuthDlg();
if(u&&typeof runAfterAuth==="function")runAfterAuth();
};
window.__cloudReady=function(){
booted=true;
const id=hashId();
const pid=profileHash();
if(location.hash==="#market")showMarket();
else if(location.hash==="#tours")showTours();
else if(location.hash==="#mine")showMine();
else if(pid)showProfile(pid);
else if(id){enterTournament(id,"findMsg")}
};
function applyRole(){
const ed=canScore(),ad=isAdmin();
document.querySelectorAll("input.score,.stepbtn").forEach(el=>el.disabled=!ed);
["start","duration","tdate","tvenue","tname"].forEach(i=>{const el=$(i);if(el)el.disabled=!ad});
document.querySelectorAll("[data-admin]").forEach(el=>el.disabled=!ad);
document.querySelectorAll("[data-team]").forEach(el=>el.disabled=!ed);
const sf=$("sfSel");if(sf)sf.disabled=!ad;
showPart(curPart);renderTInfo();if(typeof renderDash==="function")renderDash();$("partPlayersLbl").textContent=(typeof isAm==="function"&&isAm()?"Players":"Teams");
if(typeof renderTeamPlayers==="function")renderTeamPlayers();
if(typeof renderRegistration==="function")renderRegistration();
document.body.classList.toggle("can-move",ad);document.body.classList.toggle("is-admin",ad);document.body.classList.toggle("can-score",ed);
const dt=$("delTBtn");if(dt)dt.hidden=!(window.CLOUD_ON&&authUser&&((state.ownerUid&&state.ownerUid===authUser.uid)||isSiteAdmin()));
const chip=$("roleChip"),btn=$("loginBtn"),bar=$("viewBanner"),foot=$("footNote");
$("tnameLabel").hidden=!window.CLOUD_ON;$("visLabel").hidden=!window.CLOUD_ON;
if(!window.CLOUD_ON){
  chip.textContent="Local mode";btn.hidden=true;bar.hidden=true;$("access").hidden=true;
  foot.textContent="Local mode: data is stored only in this browser. Add your Firebase settings to share it online."
}else{
  chip.textContent=ad?"Admin":ed?"Editor":"Viewer";btn.textContent=authUser?"Account":"Sign in";
  $("backBtn").hidden=false;$("shareBtn").hidden=!currentTid;
  // header line: what viewers care about (name, day, venue); the ID is for admins
  const s=state.settings||{},d=s.date?new Date(s.date+"T00:00"):null;
  $("hdrSub").textContent=currentTid?[state.name||"Tournament",d&&!isNaN(d)?d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"}):"",s.venue||"",ad?"ID "+currentTid:"",state.visibility==="private"?"🔒 Private":""].filter(Boolean).join(" · "):"";
  $("access").hidden=!ad;
  bar.hidden=ed;
  if(!ed){
    if(!authUser)bar.innerHTML='👁 View only — scores update live. Staff: <b><a href="#" onclick="openAuth();return false">sign in</a></b> to enter scores.';
    else if(myReq==="pending")bar.innerHTML='👁 Your edit-access request is waiting for the admin. <b><a href="#" onclick="nudgeAdmin();return false">Message the admin on WhatsApp</a></b>';
    else bar.innerHTML='👁 View only. <b><a href="#" onclick="requestAccess();return false">Request edit access</a></b> from the tournament admin.';
  }
  foot.textContent=cloudStatus==="live"?"● Live — changes sync automatically for everyone.":"Connecting…"
}
}
async function requestAccess(){
const r=await window.__cloud.requestAccess();
if(r&&r.ok)toast("Request sent. Use “Message the admin on WhatsApp” to let them know.");else toast("Could not send the request.")
}
/* landing page */
// Home page: four tiles, each opening its own page (Follow #tours, My tournaments #mine, Marketplace, profile)
function renderLanding(){
if($("heroSignIn")){$("heroSignIn").hidden=!!authUser;$("heroSignOut").hidden=!authUser;$("heroProfile").hidden=!authUser}
$("tileMineTitle").textContent=authUser?"My tournaments":"Create a tournament";
$("tileMineSub").textContent=authUser?"Create a new one, or open one you run.":"Schedule, live scores and leaderboard, free in a minute.";
$("tileMeTitle").textContent=authUser?"My profile":"Sign in";
$("tileMeSub").textContent=authUser?"Your level, matches and results.":"Create tournaments, register and keep your player profile.";
loadPublic();renderInstallTip();
// "Create a tournament" was pressed before signing in: continue there
let want=false;try{want=sessionStorage.getItem("padelCreate")==="1"}catch(e){}
if(authUser&&want)location.hash="mine"
}
// My tournaments page (#mine)
function showMine(){
showView("mine");window.scrollTo(0,0);
$("lOut").hidden=!!authUser;$("lIn").hidden=!authUser;
if(!authUser)return;
$("lWho").textContent="Signed in as "+authUser.email;loadMine();
let want=false;try{want=sessionStorage.getItem("padelCreate")==="1";sessionStorage.removeItem("padelCreate")}catch(e){}
toggleNewT(want)
}
function goFollow(){location.hash="tours"}
function startCreate(){
try{sessionStorage.setItem("padelCreate","1")}catch(e){}
if(!authUser){toLogin();return}
if(view==="mine")showMine();else location.hash="mine"
}
function toggleNewT(on){
const f=$("newForm");if(!f)return;
f.hidden=on===undefined?!f.hidden:!on;$("newTBtn").hidden=!f.hidden;
if(!f.hidden){wzReset();setTimeout(()=>$("newName").focus(),300)}
}
/* New tournament wizard: 1 Name & day → 2 Style & players → 3 Courts & time → Create */
let wzStep=1;
function wzReset(){
if(!$("newCourts").options.length){
  $("newCourts").innerHTML=Array.from({length:6},(_,i)=>`<option value="${i+1}">${i+1} court${i?"s":""}</option>`).join("");
  $("newDur").innerHTML=[10,12,15,20,25,30,40,45,60].map(m=>`<option value="${m}">${m} minutes</option>`).join("");
  $("newPts").innerHTML=AM_POINTS.map(p=>`<option value="${p}">${p} points</option>`).join("");
}
const n=new Date(),h=Math.min(22,n.getHours()+1);
$("newDate").value=todayStr();$("newStart").value=String(h).padStart(2,"0")+":00";
$("newCourts").value="2";$("newDur").value="20";$("newPts").value="24";
wzStep=1;wzShow();wzHint()
}
function wzShow(){
document.querySelectorAll("#newForm .wz").forEach(x=>x.hidden=+x.dataset.step!==wzStep);
document.querySelectorAll("#newForm .wz-steps li").forEach(x=>{const k=+x.dataset.wz;x.className=k<wzStep?"done":k===wzStep?"on":""});
$("wzBack").hidden=wzStep===1;$("wzNext").hidden=wzStep===3;$("wzCreate").hidden=wzStep!==3;
}
function wzGo(d){
if(d>0&&wzStep===1&&!$("newName").value.trim()){$("lMsg").textContent="Give your tournament a name.";$("newName").focus();return}
$("lMsg").textContent="";wzStep=Math.max(1,Math.min(3,wzStep+d));wzShow();wzHint();
const first=document.querySelector(`#newForm .wz[data-step="${wzStep}"] input,#newForm .wz[data-step="${wzStep}"] select`);if(first)first.focus()
}
const WZ_HINT={groups_ko:"Teams of two play in groups, then the best teams go into a knockout (quarter-finals, semi-finals, final).",
  americano:"Everyone signs up alone and gets a new partner every round. Each match is played to a fixed number of points.",
  mexicano:"Like Americano, but after round 1 the leaderboard decides who plays together, so matches stay close.",
  mexicano_time:"Mexicano where every match lasts a set time; the rounds you win decide your points."};
function wzHint(){
const st=$("newStyle").value||"groups_ko",am=AM_STYLES.includes(st),n=+$("newTeams").value||8,c=+$("newCourts").value||2,dur=+$("newDur").value||20;
$("newPtsLbl").hidden=!(st==="americano"||st==="mexicano");
$("newStyleHint").textContent=WZ_HINT[st]||"";
$("newSummary").textContent=`${n} ${am?"players":"teams"} on ${c} court${c>1?"s":""}, ${dur}-minute matches from ${$("newStart").value||"12:00"}${$("newDate").value?" on "+(dayLabel($("newDate").value)||$("newDate").value):""}. You can add court hours and change anything later in Setup.`
}
// "Add to home screen": the browser's own prompt when it offers one, otherwise short instructions (phones only)
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;renderInstallTip()});
function renderInstallTip(){
const box=$("installTip");if(!box)return;
let off=false;try{off=localStorage.getItem("padelInstallTip")==="off"}catch(e){}
const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone,phone=matchMedia("(max-width:700px)").matches;
box.hidden=off||standalone||!(phone||installEvt);if(box.hidden)return;
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
$("installBtn").hidden=!installEvt;
$("installHow").textContent=installEvt?"Add it to your home screen and open live scores like an app.":ios?"In Safari, tap the Share button, then “Add to Home Screen”.":"In your browser menu (⋮), tap “Add to Home screen” or “Install app”.";
}
async function doInstall(){if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;hideInstallTip()}
function hideInstallTip(){try{localStorage.setItem("padelInstallTip","off")}catch(e){}$("installTip").hidden=true}
/* ---------- Tournament cards (home page) ---------- */
// Status from the tournament's date, start time and results
function tStatus(t){
const today=todayStr();
if(t.finished)return {k:"finished",l:"Finished",o:5};
if(t.date){
  if(t.date>today)return {k:"upcoming",l:"Upcoming",o:2};
  if(t.date<today)return {k:"finished",l:"Finished",o:5};
  const n=new Date(),nm=n.getHours()*60+n.getMinutes(),st=toMin(t.start);
  return t.results>0||(st!=null&&nm>=st)?{k:"live",l:"Live now",o:0}:{k:"today",l:"Today",o:1};
}
return t.results>0?{k:"progress",l:"In progress",o:3}:{k:"new",l:"Not started",o:4};
}
function sortTournaments(list){return list.map(t=>({...t,st:tStatus(t)})).sort((a,b)=>a.st.o-b.st.o||(a.st.k==="finished"?(b.date||"").localeCompare(a.date||""):(a.date||"").localeCompare(b.date||""))||b.createdAt-a.createdAt)}
// "Today", "Tomorrow" or "Sat 8 Nov"
function dayLabel(ds){
const d=ds?new Date(ds+"T00:00"):null;if(!d||isNaN(d))return "";
const t=new Date(todayStr()+"T00:00"),diff=Math.round((d-t)/864e5);
return diff===0?"Today":diff===1?"Tomorrow":diff===-1?"Yesterday":d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})
}
function tMeta(t){
const dl=dayLabel(t.date);
return [dl?dl+(t.start?" · "+t.start:""):"",t.venue,t.results>0&&t.st&&t.st.k!=="finished"?`${t.results} match${t.results>1?"es":""} played`:"",["americano","mexicano","mexicano_time"].includes(t.style)?`${(STYLES.find(x=>x[0]===t.style)||[,""])[1]} · ${t.teams} players`:`${t.teams} teams`].filter(Boolean).map(esc).join(" · ")
}
const statusChip=t=>`<span class="stchip st-${t.st.k}">${t.st.k==="live"?'<i aria-hidden="true"></i>':""}${t.st.l}</span>`;
async function loadMine(){
const box=$("myList");
if(!window.__cloud||!authUser){box.textContent="";return []}
box.innerHTML=skeleton(2);
const r=await window.__cloud.listMine();
if(!r.ok){box.innerHTML='<p class="note">Could not load your tournaments.</p>';return []}
mine=sortTournaments(r.list);
box.innerHTML=mine.length?mine.map(t=>`<div class="tcard mycard" id="my-${esc(t.id)}"><div class="tc-main"><div class="tc-top">${statusChip(t)}<span class="chip ${t.role==="admin"?"chipF":"chipK"}">${t.role==="admin"?"Admin":"Editor"}</span>${t.visibility==="private"?'<span class="chip privchip">🔒 Private</span>':""}<span class="reqbadge" hidden></span></div><b dir="auto">${esc(t.name)}</b><p class="note">${tMeta(t)}</p></div><div class="tc-actions"><button class="primary" onclick="enterTournament('${esc(t.id)}','lMsg')">Open</button>${t.role==="admin"?`<button class="secondary" onclick="duplicateT('${esc(t.id)}')">Duplicate</button>`:""}${t.owner?`<button class="danger" onclick="deleteT('${esc(t.id)}')">Delete</button>`:""}</div></div>`).join(""):'<p class="note">You have no tournaments yet. Press <b>+ New tournament</b> to create your first one.</p>';
// pending edit-access requests, for tournaments you run
mine.filter(t=>t.role==="admin"&&window.__cloud.pendingRequests).forEach(async t=>{
  const q=await window.__cloud.pendingRequests(t.id),b=document.querySelector(`#my-${t.id} .reqbadge`);
  if(b&&q.ok&&q.n){b.hidden=false;b.textContent=`${q.n} access request${q.n>1?"s":""}`}
});
return mine
}
let pubLoading=false,pubCache=[];
const pubBoxes=()=>[$("pubList"),$("allList")].filter(Boolean);
// grey placeholder cards while the list loads
const skeleton=n=>Array.from({length:n},()=>'<div class="tcard skel" aria-hidden="true"><span class="skl w30"></span><span class="skl w70"></span><span class="skl w50"></span></div>').join("");
async function loadPublic(){
if(!pubBoxes().length||pubLoading)return;
const say=h=>pubBoxes().forEach(b=>b.innerHTML=h);
if(!window.__cloud){say('<p class="note">Connecting…</p>');return}
pubLoading=true;say(skeleton(2));
const r=await window.__cloud.listPublic();pubLoading=false;
if(!r.ok){say('<p class="note">Could not load the list ('+esc(r.error)+').</p>');return}
pubCache=sortTournaments(r.list);renderPublic()
}
const pubCard=t=>{
const c=`<button type="button" class="tcard pubcard-item" onclick="enterTournament('${esc(t.id)}','findMsg')"><span class="tc-main"><span class="tc-top">${statusChip(t)}${t.regOpen?'<span class="chip regchip">Registration open</span>':""}</span><b dir="auto">${esc(t.name)}</b><span class="note">${tMeta(t)}</span></span><span class="tc-go" aria-hidden="true">›</span></button>`;
// the site admin gets a Delete button under every tournament
return isSiteAdmin()?`<div class="pubitem">${c}<button type="button" class="danger pubdel" onclick="pubDelete('${esc(t.id)}')">Delete (admin)</button></div>`:c
};
function pubDelete(id){const t=pubCache.find(x=>x.id===id);if(t)deleteT(id,t.name)}
function pubListHtml(list){
const active=list.filter(t=>t.st.k!=="finished"),done=list.filter(t=>t.st.k==="finished");
return (list.length?"":'<p class="note">No public tournaments yet.</p>')+active.map(pubCard).join("")+(done.length?`<h3 class="pubsub">Finished</h3>`+done.map(pubCard).join(""):"")
}
// Open a tournament straight on its Teams / Players part, where the Register button is
async function openToRegister(id){curPart="players";try{sessionStorage.setItem("padelPart","players")}catch(e){}await enterTournament(id,"findMsg")}
const regCard=t=>`<div class="tcard regcard"><span class="tc-main"><span class="tc-top">${statusChip(t)}<span class="chip regchip">Registration open</span></span><b dir="auto">${esc(t.name)}</b><span class="note">${tMeta(t)}</span></span><button type="button" class="primary" onclick="openToRegister('${esc(t.id)}')">Register</button></div>`;
// Home page: tournaments open for registration get their own row; then the 3 most relevant (live and today first,
// then upcoming, then the newest finished); the rest are on the "All tournaments" page (#tours)
function renderPublic(){
const home=$("pubList"),all=$("allList"),reg=pubCache.filter(t=>t.regOpen&&t.st.k!=="finished");
if($("regRow")){$("regRow").hidden=!reg.length;$("regList2").innerHTML=reg.map(regCard).join("")}
if(home)home.innerHTML=pubListHtml(pubCache);
const live=pubCache.filter(t=>t.st.k==="live").length,today=pubCache.filter(t=>t.st.k==="today").length,b=$("tileFollowBadges");
if(b)b.innerHTML=[live?`<span class="stchip st-live"><i aria-hidden="true"></i>${live} live now</span>`:"",today?`<span class="stchip st-today">${today} today</span>`:"",reg.length?`<span class="chip regchip">${reg.length} open for registration</span>`:""].join("");
if(all)all.innerHTML=pubListHtml(pubCache)
}
function showTours(){showView("tours");window.scrollTo(0,0);if(pubCache.length)renderPublic();loadPublic()}
// Organiser tools
async function duplicateT(id){
const m=$("lMsg");m.textContent="Copying…";
const r=await window.__cloud.getTournament(id);
if(!r.ok){m.textContent="Could not copy it ("+r.error+").";return}
const d=r.data,c=await window.__cloud.create((d.name||"Tournament")+" (copy)",{copy:{teams:d.teams,style:d.style,visibility:d.visibility,bestOf:d.bestOf,settings:d.settings,teamPlayers:d.teamPlayers,playerUids:d.playerUids}});
if(!c.ok){m.textContent="Could not copy it ("+c.error+").";return}
m.textContent="";toast("Copied with the same teams, courts and settings. Set the new date in Setup.");
await enterTournament(c.id,"lMsg")
}
async function deleteT(id,name){
const t=(mine||[]).find(x=>x.id===id)||{name:name||state.name};
if(!confirm(`Delete “${t.name}” for everyone? All its matches and scores are removed. This can't be undone.`))return false;
const r=await window.__cloud.deleteTournament(id);
if(!r.ok){toast(r.error==="permission-denied"?"Only the person who created a tournament (or the site admin) can delete it.":"Could not delete it ("+r.error+").");return false}
toast("Tournament deleted.");
if(currentTid===id)goHome();else{pubCache=pubCache.filter(x=>x.id!==id);renderPublic();loadMine();loadPublic()}
return true
}
function deleteCurrent(){if(currentTid)deleteT(currentTid,state.name)}
// After asking for edit access: let the admin know on WhatsApp
function nudgeAdmin(){
const text=`Hi! I asked for edit access to “${state.name||"the tournament"}” on Padel Tour. Could you approve me under Access? ${tournamentUrl()}`;
window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener")
}
async function enterTournament(id,msgId){
const m=msgId?$(msgId):null;if(m)m.textContent="Opening…";
if(!window.__cloud){if(m)m.textContent="Still connecting… try again in a moment.";return false}
resetState();currentTid=id;
const r=await window.__cloud.open(id);
if(!r.ok){
  currentTid=null;
  if(m)m.textContent=r.error==="not-found"?"No tournament found with this ID.":"Could not open it ("+r.error+").";
  const fd=document.querySelector(".findid");if(fd&&msgId==="findMsg")fd.open=true;
  return false
}
if(m)m.textContent="";
if(location.hash.replace(/^#/,"")!=="t="+id)location.hash="t="+id;
showView("app");window.scrollTo(0,0);applyRole();
document.querySelector('.tab[data-tab="schedule"]').click();
return true
}
function goHome(){
autoOpen=false;
if(window.__cloud)window.__cloud.leave();
currentTid=null;myReq=null;requests=[];entries=[];myEntry=null;
history.replaceState(null,"",location.pathname+location.search);
showView(homeView());renderLanding();
$("findMsg").textContent="";$("lMsg").textContent=""
}
async function findTournament(){
const raw=$("findId").value.toUpperCase().replace(/[^A-Z0-9]/g,""),m=$("findMsg");
if(!raw){m.textContent="Enter a tournament ID.";return}
await enterTournament(raw,"findMsg")
}
async function createT(){
const name=$("newName").value.trim()||"My tournament",m=$("lMsg"),teams=+$("newTeams").value||8,style=$("newStyle").value||"groups_ko",visibility=$("newVis").value==="private"?"private":"public";
const nc=+$("newCourts").value||2,settings={date:$("newDate").value||todayStr(),venue:$("newVenue").value.trim().slice(0,60),start:$("newStart").value||"12:00",duration:+$("newDur").value||20,
  courts:Array.from({length:nc},(_,i)=>({name:"Court "+(i+1)}))};
if(style==="americano"||style==="mexicano")settings.points=+$("newPts").value||24;
if(!window.__cloud){m.textContent="Still connecting… try again in a moment.";return}
m.textContent="Creating…";
const r=await window.__cloud.create(name,{teams,style,visibility,settings});
if(!r.ok){m.textContent="Could not create the tournament ("+r.error+").";return}
$("newName").value="";$("newVenue").value="";toggleNewT(false);
curPart="setup";try{sessionStorage.setItem("padelPart","setup")}catch(e){}
await enterTournament(r.id,"lMsg")
}
function tournamentUrl(){return currentTid?location.origin+location.pathname+"#t="+currentTid:""}
function shareT(){openShare()}
function copyLink(){
const url=tournamentUrl();if(!url)return;
if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>toast("Link copied · Tournament ID: "+currentTid),()=>toast("Tournament ID: "+currentTid));else toast("Tournament ID: "+currentTid)
}
function copyId(){if(currentTid&&navigator.clipboard)navigator.clipboard.writeText(currentTid).then(()=>toast("ID copied: "+currentTid))}
window.addEventListener("hashchange",()=>{
if(!window.CLOUD_ON||!booted)return;
captureJoin();if(joinReq&&hashId()===currentTid)renderRegistration();
if(location.hash==="#market"){if(currentTid&&window.__cloud){window.__cloud.leave();currentTid=null}showMarket();return}
if(location.hash==="#tours"){if(currentTid&&window.__cloud){window.__cloud.leave();currentTid=null}showTours();return}
if(location.hash==="#mine"){if(currentTid&&window.__cloud){window.__cloud.leave();currentTid=null}showMine();return}
if((view==="tours"||view==="mine")&&!hashId()){showView("landing");renderLanding();return}
const pid=profileHash();if(pid){if(pid!==prof.uid||view!=="profile")showProfile(pid);return}
if(view==="profile"&&!hashId()){showView("landing");renderLanding();return}
const id=hashId();
if(!id&&currentTid)goHome();
else if(id&&id!==currentTid)enterTournament(id,"findMsg")
});
/* access management (admin) */
function renderAccess(){
if(!$("memList"))return;
$("accId").textContent=currentTid||"";
const members=state.members||{},byUid=Object.fromEntries(requests.map(r=>[r.uid,r]));
const pend=requests.filter(r=>r.status==="pending"&&!members[r.uid]);
$("reqList").innerHTML=pend.length?pend.map(r=>`<div class="mrow2"><span dir="auto">${esc(r.email||r.uid)}</span><span class="grow"></span><button class="secondary" onclick="setMember('${esc(r.uid)}','editor')">Make editor</button><button class="secondary" onclick="setMember('${esc(r.uid)}','admin')">Make admin</button><button class="danger" style="margin-left:0" onclick="dismissReq('${esc(r.uid)}')">Dismiss</button></div>`).join(""):'<p class="note">No pending requests.</p>';
$("memList").innerHTML=Object.keys(members).map(uid=>{
  const r=members[uid],isOwner=uid===state.ownerUid,me=authUser&&uid===authUser.uid;
  const who=(byUid[uid]&&byUid[uid].email)||(me?authUser.email:isOwner?"Owner":uid.slice(0,6)+"…");
  const other=r==="admin"?"editor":"admin";
  return `<div class="mrow2"><span dir="auto">${esc(who)}${me?" (you)":""}</span><span class="chip ${r==="admin"?"chipF":"chipK"}">${isOwner?"Owner · ":""}${r==="admin"?"Admin":"Editor"}</span><span class="grow"></span>${isOwner?"":`<button class="secondary" onclick="setMember('${esc(uid)}','${other}')">Make ${other}</button><button class="danger" style="margin-left:0" onclick="removeMember('${esc(uid)}')">Remove</button>`}</div>`
}).join("")||'<p class="note">No one yet.</p>'
}
async function setMember(uid,r){const x=await window.__cloud.setMember(uid,r);if(!x.ok)toast("Could not change access ("+x.error+").")}
async function removeMember(uid){if(confirm("Remove this person's access?")){const x=await window.__cloud.setMember(uid,null);if(!x.ok)toast("Could not remove access ("+x.error+").")}}
async function dismissReq(uid){await window.__cloud.dismissRequest(uid)}
/* account dialog */
// why: a line saying what signing in is for (registering, joining a team…); Google is the big first option
function openAuth(why){
const w=typeof why==="string"?why:"";
$("authWhy").textContent=w;$("authWhy").hidden=!w;$("authTitle").textContent=w?"Sign in":"Account";$("authEmailBox").open=false;
updateAuthDlg();$("authMsg").textContent="";$("authDlg").showModal()
}
function updateAuthDlg(){
const u=authUser;$("authOut").hidden=!!u;$("authIn").hidden=!u;
if(u){$("authWho").textContent=u.email;$("authRole").textContent=role==="admin"?"Admin":role==="editor"?"Editor":"Viewer"}
$("authRole").parentElement.hidden=view!=="app";
}
const AUTH_ERR={"auth/invalid-credential":"Wrong email or password.","auth/wrong-password":"Wrong email or password.","auth/user-not-found":"No account with this email. Use Register.","auth/email-already-in-use":"This email already has an account. Use Sign in (or Continue with Google if you registered that way).","auth/weak-password":"Password must be at least 6 characters.","auth/invalid-email":"That email address is not valid.","auth/too-many-requests":"Too many attempts. Try again later.","auth/network-request-failed":"Network problem. Check your connection.","auth/operation-not-allowed":"This sign-in method is not switched on in Firebase yet.","auth/unauthorized-domain":"This website is not on the Firebase authorized-domains list.","auth/popup-blocked":"The Google window was blocked. Allow pop-ups and try again.","auth/account-exists-with-different-credential":"This email already uses another sign-in method."};
async function doAuth(kind,p="auth"){
const email=$(p+"Email").value.trim(),pw=$(p+"Pw").value,msg=$(p+"Msg");
if(!window.__auth){msg.textContent="Still connecting… try again in a moment.";return}
if(!email){msg.textContent="Enter your email.";return}
try{
  if(kind==="reset"){await window.__auth.reset(email);msg.textContent="Password reset email sent (check your spam folder).";return}
  if(!pw){msg.textContent="Enter your password.";return}
  msg.textContent="Please wait…";
  
  if(kind==="in")await window.__auth.signIn(email,pw);else await window.__auth.signUp(email,pw);
  msg.textContent="";$(p+"Pw").value=""
}catch(e){msg.textContent=AUTH_ERR[e.code]||("Error: "+(e.message||e.code))}
}
// Google sign-in (popup, falls back to a full-page redirect if pop-ups are blocked)
async function doGoogle(p="auth"){
const msg=$(p+"Msg");
if(!window.__auth){msg.textContent="Still connecting… try again in a moment.";return}
try{
  msg.textContent="Opening Google…";
  await window.__auth.google();
  msg.textContent=""
}catch(e){
  msg.textContent=(e.code==="auth/popup-closed-by-user"||e.code==="auth/cancelled-popup-request")?"":(AUTH_ERR[e.code]||("Error: "+(e.message||e.code)))
}
}
async function doSignOut(){try{await window.__auth.signOut()}catch(e){}if($("authDlg").open){updateAuthDlg();$("authDlg").close()}if(view==="landing")renderLanding();if(view==="mine")showMine();toast("Signed out. You can keep following tournaments as a viewer.")}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
