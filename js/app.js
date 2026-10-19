// App shell: state, roles, login/landing pages, account, access management. Loaded first.
const defaultTeams=["Viboras","Padeliators","Elsawaree5","O&H","H & H","شباب المستقبل","M&Ms","Eskendriaa"];
let state={teams:[...defaultTeams],scores:{},bestOf:{},style:"groups_ko",visibility:"public",settings:{start:"12:00",duration:20,date:""}};
const key="padelTournamentV2";
if(!window.CLOUD_ON){try{const s=JSON.parse(localStorage.getItem(key)); if(s) state={...state,...s,settings:{...state.settings,...(s?.settings||{})}}}catch(e){}}
function save(){if(window.CLOUD_ON)return;try{localStorage.setItem(key,JSON.stringify(state))}catch(e){}}
function $(id){return document.getElementById(id)}

/* ---------- Roles, tournaments, account & online sync ---------- */
// viewer = read-only · editor = can enter scores · admin = everything (roles are per tournament)
const DEFAULT_SETTINGS={start:"12:00",duration:20,date:""};
// No "courts" here on purpose: older tournaments keep their court1/court2 names (see courtsCfg in engine.js)
window.__defaults=(n=8)=>({teams:Array.from({length:n},(_,i)=>defaultTeamName(i)),settings:{...DEFAULT_SETTINGS,date:todayStr(),courts:[{name:"Court 1"},{name:"Court 2"}]}});
function resetState(){state={teams:[...defaultTeams],scores:{},bestOf:{},style:"groups_ko",visibility:"public",settings:{...DEFAULT_SETTINGS},sfPairing:0}}
let role=window.CLOUD_ON?"viewer":"admin", authUser=null, cloudStatus="", view="app", currentTid=null, booted=false, autoOpen=true, myReq=null, requests=[], mine=[];
// guest = the person chose "Continue as viewer" on the login page (remembered for this browser tab)
let guest=false;try{guest=sessionStorage.getItem("padelGuest")==="1"}catch(e){}
function setGuest(v){guest=v;try{v?sessionStorage.setItem("padelGuest","1"):sessionStorage.removeItem("padelGuest")}catch(e){}}
const canScore=()=>role==="editor"||role==="admin";
const isAdmin=()=>role==="admin";
const DEL="__DEL__";
const pending={teams:null};
function cloudWrite(u){if(window.CLOUD_ON&&window.__cloud)window.__cloud.write(u)}
let toastTimer;
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,5000)}
window.__toast=toast;
function showView(v){view=v;$("loginView").hidden=v!=="login";$("landing").hidden=v!=="landing";$("appView").hidden=v!=="app"}
// Where "home" is: signed-in people and viewers go to the tournament list, everyone else to the login page
const homeView=()=>authUser||guest?"landing":"login";
function continueAsViewer(){setGuest(true);$("loginMsg").textContent="";showView("landing");renderLanding();setTimeout(()=>$("findId").focus(),0)}
function toLogin(){setGuest(false);$("lMsg").textContent="";showView("login")}
const hashId=()=>{const m=/[#&]t=([A-Za-z0-9]+)/.exec(location.hash);return m?m[1].toUpperCase():null};
function syncInputs(){
const idle=el=>el&&document.activeElement!==el;
allMatches().forEach(m=>["a","b"].forEach(k=>{const el=$(m.id+k);if(idle(el)){const r=rawScore(m.id);el.value=r?r[k]:""}}));
document.querySelectorAll("[data-team]").forEach(el=>{if(idle(el))el.value=state.teams[+el.dataset.team]||""});
fillCourtRows();
[["start",state.settings.start],["duration",state.settings.duration],["tdate",state.settings.date||""],["tname",state.name||""],["nteams",String(teamCount())],["style",state.style||"groups_ko"],["vis",state.visibility||"public"]].forEach(([id,v])=>{const el=$(id);if(idle(el))el.value=v})
}
window.__applyRemote=function(d){
if(d){
  state.name=d.name||"Tournament";state.members=d.members||{};state.ownerUid=d.ownerUid||null;
  if(pending.teams==null&&Array.isArray(d.teams)&&d.teams.length>=MIN_TEAMS&&d.teams.length<=MAX_TEAMS)state.teams=d.teams.map(String);
  if(d.settings)state.settings={...DEFAULT_SETTINGS,...d.settings};
  state.sfPairing=d.sfPairing!=null?+d.sfPairing:0;
  state.scores=d.scores||{};
  state.bestOf=d.bestOf||{};
  state.style=d.style||"groups_ko";
  state.visibility=d.visibility==="private"?"private":"public";
  state._visMissing=!d.visibility;
}
if(teamCount()!==lastBuiltN||!document.querySelector("[data-team]")||document.querySelectorAll("[data-team]").length!==teamCount())rebuild();
else renderFormatInfo();
syncInputs();refresh();applyRole()
};
window.__getInitial=()=>({teams:state.teams,settings:state.settings,sfPairing:state.sfPairing||0,scores:state.scores});
window.__cloudStatus=s=>{cloudStatus=s;applyRole()};
window.__setRole=function(r,u){role=r;authUser=u;applyRole();if(r==="admin"&&state._visMissing){state._visMissing=false;cloudWrite({visibility:state.visibility})}if($("authDlg").open)updateAuthDlg()};
window.__setRequests=l=>{requests=l;renderAccess()};
window.__setMyRequest=st=>{myReq=st;applyRole()};
window.__authState=function(u){
authUser=u;
if(u&&view==="login"){$("loginMsg").textContent="";showView("landing")}
else if(!u&&view==="landing"&&!guest)showView("login");
if(view==="landing"){renderLanding();if(booted&&u&&autoOpen)autoOpenMine()}
if($("authDlg").open)updateAuthDlg();
};
window.__cloudReady=function(){
booted=true;
const id=hashId();
if(id){enterTournament(id,"findMsg")}
else if(authUser&&autoOpen)autoOpenMine()
};
function applyRole(){
const ed=canScore(),ad=isAdmin();
document.querySelectorAll("input.score,.stepbtn").forEach(el=>el.disabled=!ed);
["start","duration","tdate","tname"].forEach(i=>{const el=$(i);if(el)el.disabled=!ad});
document.querySelectorAll("[data-team],[data-admin]").forEach(el=>el.disabled=!ad);
const sf=$("sfSel");if(sf)sf.disabled=!ad;
const chip=$("roleChip"),btn=$("loginBtn"),bar=$("viewBanner"),foot=$("footNote");
$("tnameLabel").hidden=!window.CLOUD_ON;$("visLabel").hidden=!window.CLOUD_ON;
if(!window.CLOUD_ON){
  chip.textContent="Local mode";btn.hidden=true;bar.hidden=true;$("accessTab").hidden=true;
  foot.textContent="Local mode: data is stored only in this browser. Add your Firebase settings to share it online."
}else{
  chip.textContent=ad?"Admin":ed?"Editor":"Viewer";btn.textContent=authUser?"Account":"Sign in";
  $("backBtn").hidden=false;$("shareBtn").hidden=!currentTid;
  $("hdrSub").textContent=currentTid?(state.name||"Tournament")+" · ID "+currentTid+(state.visibility==="private"?" · 🔒 Private":""):"";
  $("accessTab").hidden=!ad;
  if(!ad&&$("access").classList.contains("active"))document.querySelector('.tab[data-tab="schedule"]').click();
  bar.hidden=ed;
  if(!ed){
    if(!authUser)bar.innerHTML='👁 View only — scores update live. Staff: <b><a href="#" onclick="openAuth();return false">sign in</a></b> to enter scores.';
    else if(myReq==="pending")bar.textContent="👁 View only — your edit-access request is waiting for the admin.";
    else bar.innerHTML='👁 View only. <b><a href="#" onclick="requestAccess();return false">Request edit access</a></b> from the tournament admin.';
  }
  foot.textContent=cloudStatus==="live"?"● Live — changes sync automatically for everyone.":"Connecting…"
}
}
async function requestAccess(){
const r=await window.__cloud.requestAccess();
if(r&&r.ok)toast("Request sent. The admin will see it under Access.");else toast("Could not send the request.")
}
/* landing page */
function renderLanding(){
$("lOut").hidden=!!authUser;$("lIn").hidden=!authUser;
loadPublic();
if(authUser){$("lWho").textContent="Signed in as "+authUser.email;loadMine()}
}
async function loadMine(){
const box=$("myList");
if(!window.__cloud||!authUser){box.textContent="";return []}
box.innerHTML='<p class="note">Loading…</p>';
const r=await window.__cloud.listMine();
if(!r.ok){box.innerHTML='<p class="note">Could not load your tournaments.</p>';return []}
mine=r.list;
box.innerHTML=mine.length?mine.map(t=>`<div class="tcard"><div><b dir="auto">${esc(t.name)}</b><span class="chip ${t.role==="admin"?"chipF":"chipK"}">${t.role==="admin"?"Admin":"Editor"}</span>${t.visibility==="private"?' <span class="chip privchip">🔒 Private</span>':""}<p class="note">${t.teams?t.teams+" teams · ":""}ID ${esc(t.id)}</p></div><button class="primary" onclick="enterTournament('${esc(t.id)}','lMsg')">Open</button></div>`).join(""):'<p class="note">You have no tournaments yet. Create one below, or open one with its ID.</p>';
return mine
}
let pubLoading=false;
async function loadPublic(){
const box=$("pubList");if(!box||pubLoading)return;
if(!window.__cloud){box.innerHTML='<p class="note">Connecting…</p>';return}
pubLoading=true;box.innerHTML='<p class="note">Loading…</p>';
const r=await window.__cloud.listPublic();pubLoading=false;
if(!r.ok){box.innerHTML='<p class="note">Could not load the list ('+esc(r.error)+').</p>';return}
box.innerHTML=r.list.length?r.list.map(t=>`<div class="tcard"><div><b dir="auto">${esc(t.name)}</b><p class="note">${t.teams} teams · ${t.results} result${t.results===1?"":"s"} · ID ${esc(t.id)}</p></div><button class="primary" onclick="enterTournament('${esc(t.id)}','findMsg')">Open</button></div>`).join(""):'<p class="note">No public tournaments yet.</p>'
}
async function autoOpenMine(){
const list=await loadMine();
if(list.length===1&&view==="landing"&&autoOpen)enterTournament(list[0].id,"lMsg")
}
async function enterTournament(id,msgId){
const m=msgId?$(msgId):null;if(m)m.textContent="Opening…";
if(!window.__cloud){if(m)m.textContent="Still connecting… try again in a moment.";return false}
resetState();currentTid=id;
const r=await window.__cloud.open(id);
if(!r.ok){
  currentTid=null;
  if(m)m.textContent=r.error==="not-found"?"No tournament found with this ID.":"Could not open it ("+r.error+").";
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
currentTid=null;myReq=null;requests=[];
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
  autoOpen=true;
  if(kind==="in")await window.__auth.signIn(email,pw);else await window.__auth.signUp(email,pw);
  msg.textContent="";$(p+"Pw").value=""
}catch(e){msg.textContent=AUTH_ERR[e.code]||("Error: "+(e.message||e.code))}
}
// Google sign-in (popup, falls back to a full-page redirect if pop-ups are blocked)
async function doGoogle(p="auth"){
const msg=$(p+"Msg");
if(!window.__auth){msg.textContent="Still connecting… try again in a moment.";return}
try{
  msg.textContent="Opening Google…";autoOpen=true;
  await window.__auth.google();
  msg.textContent=""
}catch(e){
  msg.textContent=(e.code==="auth/popup-closed-by-user"||e.code==="auth/cancelled-popup-request")?"":(AUTH_ERR[e.code]||("Error: "+(e.message||e.code)))
}
}
async function doSignOut(){setGuest(false);try{await window.__auth.signOut()}catch(e){}if($("authDlg").open){updateAuthDlg();$("authDlg").close()}}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
