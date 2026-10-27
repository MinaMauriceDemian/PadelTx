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
window.__defaults=(n=8,style)=>({teams:Array.from({length:n},(_,i)=>style==="americano"?"Player "+(i+1):defaultTeamName(i)),settings:{...DEFAULT_SETTINGS,date:todayStr(),courts:[{name:"Court 1"},{name:"Court 2"}]}});
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
function showView(v){view=v;$("loginView").hidden=v!=="login";$("landing").hidden=v!=="landing";$("appView").hidden=v!=="app";$("marketView").hidden=v!=="market";$("profileView").hidden=v!=="profile";$("toursView").hidden=v!=="tours"}
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
  state.regOpen=!!d.regOpen;
  state.regPay=d.regPay||null;
  state._visMissing=!d.visibility;
}
if(teamCount()!==lastBuiltN||document.body.dataset.style!==(state.style||"groups_ko")||!document.querySelector("[data-team]")||document.querySelectorAll("[data-team]").length!==teamCount())rebuild();
else renderFormatInfo();
syncInputs();refresh();applyRole()
};
window.__getInitial=()=>({teams:state.teams,settings:state.settings,sfPairing:state.sfPairing||0,scores:state.scores});
window.__cloudStatus=s=>{cloudStatus=s;applyRole()};
window.__setRole=function(r,u){role=r;authUser=u;applyRole();if(r==="admin"&&state._visMissing){state._visMissing=false;cloudWrite({visibility:state.visibility})}if($("authDlg").open)updateAuthDlg()};
window.__setRequests=l=>{requests=l;renderAccess();const n=l.filter(r=>r.status==="pending"&&!(state.members||{})[r.uid]).length;$("accessTab").textContent=n?`Access (${n})`:"Access"};
window.__setMyRequest=st=>{myReq=st;applyRole()};
window.__authState=function(u){
authUser=u;
if(u&&view==="login"){$("loginMsg").textContent="";showView("landing");window.scrollTo(0,0)}
if(u&&typeof ensureMyProfile==="function")ensureMyProfile();
if(view==="landing")renderLanding();
if(view==="market")renderMarket();
if($("authDlg").open)updateAuthDlg();
};
window.__cloudReady=function(){
booted=true;
const id=hashId();
const pid=profileHash();
if(location.hash==="#market")showMarket();
else if(location.hash==="#tours")showTours();
else if(pid)showProfile(pid);
else if(id){enterTournament(id,"findMsg")}
};
function applyRole(){
const ed=canScore(),ad=isAdmin();
document.querySelectorAll("input.score,.stepbtn").forEach(el=>el.disabled=!ed);
["start","duration","tdate","tvenue","tname"].forEach(i=>{const el=$(i);if(el)el.disabled=!ad});
document.querySelectorAll("[data-team],[data-admin]").forEach(el=>el.disabled=!ad);
const sf=$("sfSel");if(sf)sf.disabled=!ad;
if(typeof renderTeamPlayers==="function")renderTeamPlayers();
if(typeof renderRegistration==="function")renderRegistration();
document.body.classList.toggle("can-move",ad);document.body.classList.toggle("is-admin",ad);document.body.classList.toggle("can-score",ed);
const dt=$("delTBtn");if(dt)dt.hidden=!(window.CLOUD_ON&&authUser&&((state.ownerUid&&state.ownerUid===authUser.uid)||isSiteAdmin()));
const chip=$("roleChip"),btn=$("loginBtn"),bar=$("viewBanner"),foot=$("footNote");
$("tnameLabel").hidden=!window.CLOUD_ON;$("visLabel").hidden=!window.CLOUD_ON;
if(!window.CLOUD_ON){
  chip.textContent="Local mode";btn.hidden=true;bar.hidden=true;$("accessTab").hidden=true;
  foot.textContent="Local mode: data is stored only in this browser. Add your Firebase settings to share it online."
}else{
  chip.textContent=ad?"Admin":ed?"Editor":"Viewer";btn.textContent=authUser?"Account":"Sign in";
  $("backBtn").hidden=false;$("shareBtn").hidden=!currentTid;
  // header line: what viewers care about (name, day, venue); the ID is for admins
  const s=state.settings||{},d=s.date?new Date(s.date+"T00:00"):null;
  $("hdrSub").textContent=currentTid?[state.name||"Tournament",d&&!isNaN(d)?d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"}):"",s.venue||"",ad?"ID "+currentTid:"",state.visibility==="private"?"🔒 Private":""].filter(Boolean).join(" · "):"";
  $("accessTab").hidden=!ad;
  if(!ad&&$("access").classList.contains("active"))document.querySelector('.tab[data-tab="schedule"]').click();
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
function renderLanding(){
$("lOut").hidden=!!authUser;$("lIn").hidden=!authUser;
if($("heroSignIn")){$("heroSignIn").hidden=!!authUser;$("heroSignOut").hidden=!authUser;$("heroProfile").hidden=!authUser}
loadPublic();
if(authUser){$("lWho").textContent="Signed in as "+authUser.email;loadMine()}
}
/* ---------- Tournament cards (home page) ---------- */
// Status from the tournament's date, start time and results
function tStatus(t){
const today=todayStr();
if(t.date){
  if(t.date>today)return {k:"upcoming",l:"Upcoming",o:2};
  if(t.date<today)return {k:"finished",l:"Finished",o:5};
  const n=new Date(),nm=n.getHours()*60+n.getMinutes(),st=toMin(t.start);
  return t.results>0||(st!=null&&nm>=st)?{k:"live",l:"Live now",o:0}:{k:"today",l:"Today",o:1};
}
return t.results>0?{k:"progress",l:"In progress",o:3}:{k:"new",l:"Not started",o:4};
}
function sortTournaments(list){return list.map(t=>({...t,st:tStatus(t)})).sort((a,b)=>a.st.o-b.st.o||(a.st.k==="finished"?(b.date||"").localeCompare(a.date||""):(a.date||"").localeCompare(b.date||""))||b.createdAt-a.createdAt)}
function tMeta(t){
const d=t.date?new Date(t.date+"T00:00"):null;
return [d&&!isNaN(d)?d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})+(t.start?" · "+t.start:""):"",t.venue,t.style==="americano"?`Americano · ${t.teams} players`:`${t.teams} teams`].filter(Boolean).map(esc).join(" · ")
}
const statusChip=t=>`<span class="stchip st-${t.st.k}">${t.st.k==="live"?'<i aria-hidden="true"></i>':""}${t.st.l}</span>`;
async function loadMine(){
const box=$("myList");
if(!window.__cloud||!authUser){box.textContent="";return []}
box.innerHTML='<p class="note">Loading…</p>';
const r=await window.__cloud.listMine();
if(!r.ok){box.innerHTML='<p class="note">Could not load your tournaments.</p>';return []}
mine=sortTournaments(r.list);
box.innerHTML=mine.length?mine.map(t=>`<div class="tcard mycard" id="my-${esc(t.id)}"><div class="tc-main"><div class="tc-top">${statusChip(t)}<span class="chip ${t.role==="admin"?"chipF":"chipK"}">${t.role==="admin"?"Admin":"Editor"}</span>${t.visibility==="private"?'<span class="chip privchip">🔒 Private</span>':""}<span class="reqbadge" hidden></span></div><b dir="auto">${esc(t.name)}</b><p class="note">${tMeta(t)}</p></div><div class="tc-actions"><button class="primary" onclick="enterTournament('${esc(t.id)}','lMsg')">Open</button>${t.role==="admin"?`<button class="secondary" onclick="duplicateT('${esc(t.id)}')">Duplicate</button>`:""}${t.owner?`<button class="danger" onclick="deleteT('${esc(t.id)}')">Delete</button>`:""}</div></div>`).join(""):'<p class="note">You have no tournaments yet. Create one below.</p>';
// pending edit-access requests, for tournaments you run
mine.filter(t=>t.role==="admin"&&window.__cloud.pendingRequests).forEach(async t=>{
  const q=await window.__cloud.pendingRequests(t.id),b=document.querySelector(`#my-${t.id} .reqbadge`);
  if(b&&q.ok&&q.n){b.hidden=false;b.textContent=`${q.n} access request${q.n>1?"s":""}`}
});
return mine
}
let pubLoading=false,pubCache=[];
const pubBoxes=()=>[$("pubList"),$("allList")].filter(Boolean);
async function loadPublic(){
if(!pubBoxes().length||pubLoading)return;
const say=h=>pubBoxes().forEach(b=>b.innerHTML=h);
if(!window.__cloud){say('<p class="note">Connecting…</p>');return}
pubLoading=true;say('<p class="note">Loading…</p>');
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
// Home page: the 3 most recent (live and upcoming first, then the newest finished); the rest are on the "All tournaments" page (#tours)
function renderPublic(){
const home=$("pubList"),all=$("allList");
if(home)home.innerHTML=pubListHtml(pubCache.slice(0,3))+(pubCache.length>3?`<button type="button" class="secondary puball" onclick="location.hash='tours'">View all ${pubCache.length} tournaments ›</button>`:"");
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
if(!window.__cloud){m.textContent="Still connecting… try again in a moment.";return}
m.textContent="Creating…";
const r=await window.__cloud.create(name,{teams,style,visibility});
if(!r.ok){m.textContent="Could not create the tournament ("+r.error+").";return}
$("newName").value="";
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
if(view==="tours"&&!hashId()){showView("landing");renderLanding();return}
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
function openAuth(){updateAuthDlg();$("authMsg").textContent="";$("authDlg").showModal()}
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
async function doSignOut(){try{await window.__auth.signOut()}catch(e){}if($("authDlg").open){updateAuthDlg();$("authDlg").close()}if(view==="landing")renderLanding();toast("Signed out. You can keep following tournaments as a viewer.")}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
