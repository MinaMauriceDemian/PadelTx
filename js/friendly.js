// Friendly matches outside tournaments (matches/{mid}). A player logs the result with their partner and the two
// opponents (all with Padel Tour profiles). It's pending until one of the opponents confirms it; then it counts on all
// four profiles and in the calculated level, exactly like a tournament match. An opponent can also reject it.
let fm=null; // the form being filled in

function fmGames(sets){let us=0,them=0,su=0,st=0;sets.forEach(([a,b])=>{us+=a;them+=b;if(a>b)su++;else if(b>a)st++});return {us,them,su,st}}
function fmSetsStr(sets){return sets.map(s=>s[0]+"–"+s[1]).join("  ")}
function fmDate(d){const t=d?new Date(d+"T00:00"):null;return t&&!isNaN(t)?t.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):""}
// A stored match seen from one player's side, in the shape of the profile's tournament matches
function friendlyToMatch(uid,m){
  const inA=m.a.some(p=>p.uid===uid),mine=inA?m.a:m.b,theirs=inA?m.b:m.a;
  const sets=inA?m.sets:m.sets.map(([a,b])=>[b,a]),g=fmGames(sets);
  return {fid:m.id,tid:null,tname:"Friendly match",date:m.date||"",time:"",slot:0,stage:"Friendly",team:"",partner:mine.find(p=>p.uid!==uid)||null,
    opp:theirs.map(p=>p.name).join(" & "),oppPlayers:theirs,us:g.us,them:g.them,won:g.su>g.st,sets,venue:m.venue||"",createdAt:m.createdAt||0}
}

/* ---------- logging a match ---------- */
async function openMatchDlg(){
  if(!authUser){toLogin();return}
  const own=prof.data&&prof.uid===authUser.uid?prof.data:null;
  fm={date:new Date().toISOString().slice(0,10),venue:(own&&own.homeClub)||"",me:own?fmPerson({...own,uid:authUser.uid}):null,slots:{p:null,o1:null,o2:null},sets:[["",""],["",""],["",""]],pick:null,q:"",msg:""};
  $("matchDlg").showModal();renderMatchDlg();
  const f=fm,jobs=[];
  if(!profileCache)jobs.push(window.__cloud.listPublicProfiles().then(r=>{if(r.ok)profileCache=r.list.sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName)))}));
  if(!own)jobs.push(window.__cloud.getProfile(authUser.uid).then(r=>{if(r.ok&&r.profile){f.me=fmPerson(r.profile);if(!f.venue&&r.profile.homeClub)f.venue=r.profile.homeClub}}));
  if(jobs.length){await Promise.all(jobs);if(fm===f)renderMatchDlg()}
}
function fmMe(){return fm&&fm.me||{uid:authUser.uid,name:authUser.displayName||authUser.email.split("@")[0],photoURL:authUser.photoURL||""}}
function fmPerson(p){return {uid:p.uid,name:p.displayName||p.name,photoURL:p.photoURL||""}}
function renderMatchDlg(){
  const f=fm;if(!f)return;
  const slot=(k,label)=>{const p=f.slots[k];return `<button type="button" class="fm-slot${f.pick===k?" on":""}${p?" filled":""}" onclick="fmPick('${k}')"><small>${label}</small>${p?`${avatarHtml(p,28)}<b dir="auto">${esc(p.name)}</b>`:`<b class="note">Choose a player</b>`}</button>`};
  let list="";
  if(f.pick){
    const taken=new Set([authUser.uid,...Object.values(f.slots).filter(Boolean).map(p=>p.uid)]),q=f.q.trim().toLowerCase();
    const all=(profileCache||[]).filter(p=>!taken.has(p.uid)&&(!q||[p.displayName,p.city,p.homeClub].join(" ").toLowerCase().includes(q)));
    list=`<div class="fm-pick"><input type="search" id="fmQ" value="${esc(f.q)}" placeholder="Search players by name, city or club" oninput="fm.q=this.value;renderMatchDlg()" aria-label="Search players">
      <div class="pplist">${profileCache?all.length?all.slice(0,40).map(p=>`<button type="button" class="pprow" onclick="fmChoose('${esc(p.uid)}')">${avatarHtml(p,34)}<span class="pp-main"><b dir="auto">${esc(p.displayName)}</b><small>${[p.level!=null&&p.level!==""?"Level "+fmtLevel(p.level):"",p.city,p.homeClub].filter(Boolean).map(esc).join(" · ")}</small></span></button>`).join(""):'<p class="note">No public player matches that search. Players need a public Padel Tour profile to be part of a logged match.</p>':'<p class="note">Loading players…</p>'}</div></div>`;
  }
  const setRow=(s,i)=>`<div class="fm-set"><span>Set ${i+1}</span><input inputmode="numeric" maxlength="2" value="${esc(s[0])}" aria-label="Set ${i+1}, your games" oninput="fm.sets[${i}][0]=this.value"><i>–</i><input inputmode="numeric" maxlength="2" value="${esc(s[1])}" aria-label="Set ${i+1}, their games" oninput="fm.sets[${i}][1]=this.value"></div>`;
  $("matchDlgBody").innerHTML=`<h2>Add a match</h2>
    <p class="note">The result counts on all four profiles once one of your opponents confirms it.</p>
    <div class="fm-teams"><div><h3>You</h3><div class="fm-slot me">${avatarHtml({displayName:fmMe().name,photoURL:fmMe().photoURL},28)}<b>You</b></div>${slot("p","Your partner")}</div>
    <div><h3>Opponents</h3>${slot("o1","Opponent 1")}${slot("o2","Opponent 2")}</div></div>${list}
    <div class="fm-score"><h3>Score <small class="note">your games first</small></h3>${f.sets.map(setRow).join("")}</div>
    <div class="fm-row"><label>Date<input type="date" value="${esc(f.date)}" max="${new Date().toISOString().slice(0,10)}" onchange="fm.date=this.value"></label><label>Club or venue (optional)<input maxlength="60" value="${esc(f.venue)}" oninput="fm.venue=this.value"></label></div>
    <p class="note" role="status">${esc(f.msg)}</p>
    <div class="actions" style="margin:0"><button type="button" class="primary" onclick="saveMatch()">Send for confirmation</button><button type="button" class="secondary" onclick="fm=null;$('matchDlg').close()">Cancel</button></div>`;
  if(f.pick){const q=$("fmQ");if(q&&document.activeElement!==q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}}
}
function fmPick(k){fm.pick=fm.pick===k?null:k;fm.q="";renderMatchDlg()}
function fmChoose(uid){const p=(profileCache||[]).find(x=>x.uid===uid);if(!p||!fm.pick)return;fm.slots[fm.pick]=fmPerson(p);
  const next=["p","o1","o2"].find(k=>!fm.slots[k]);fm.pick=next||null;fm.q="";renderMatchDlg()}
async function saveMatch(){
  const f=fm;if(!f||!authUser)return;
  const fail=t=>{f.msg=t;renderMatchDlg()};
  if(!f.slots.p||!f.slots.o1||!f.slots.o2)return fail("Choose your partner and both opponents.");
  const sets=[];for(const [a,b] of f.sets){if(a===""&&b==="")continue;const x=parseInt(a,10),y=parseInt(b,10);
    if(isNaN(x)||isNaN(y)||x<0||y<0||x>9||y>9)return fail("Enter the games of each set, for example 6 – 4.");if(x===y)return fail("A set can't end level.");sets.push([x,y])}
  if(!sets.length)return fail("Enter at least one set.");
  const g=fmGames(sets);if(g.su===g.st)return fail("One pair has to win more sets than the other.");
  if(!/^\d{4}-\d\d-\d\d$/.test(f.date))return fail("Pick the date.");
  const me=fmMe();
  const m={createdBy:authUser.uid,uids:[me.uid,f.slots.p.uid,f.slots.o1.uid,f.slots.o2.uid],a:[me,f.slots.p],b:[f.slots.o1,f.slots.o2],sets,date:f.date,venue:f.venue.trim().slice(0,60),status:"pending",confirmedBy:null,createdAt:Date.now(),updatedAt:Date.now()};
  f.msg="Saving…";renderMatchDlg();
  const r=await window.__cloud.createMatch(m);
  if(!r.ok)return fail("Could not save the match ("+r.error+").");
  fm=null;$("matchDlg").close();toast("Match sent. It counts once "+f.slots.o1.name+" or "+f.slots.o2.name+" confirms it.");
  fmRefresh();
}
// after a change: reload whichever page shows the matches
function fmRefresh(){
  if(view==="profile"&&prof.uid)showProfile(prof.uid);
  else if(view==="mine")loadMyMatches();
}
async function answerMatch(id,status){
  if(status==="rejected"&&!confirm("Reject this result? The player who logged it will see that you did."))return;
  const r=await window.__cloud.answerMatch(id,status);
  if(!r.ok){toast("Could not update the match ("+r.error+").");return}
  toast(status==="confirmed"?"Match confirmed. It now counts on all four profiles.":"Match rejected.");
  fmRefresh();
}
async function deleteMatch(id){
  if(!confirm("Delete this match?"))return;
  const r=await window.__cloud.deleteMatch(id);
  if(!r.ok){toast("Could not delete the match ("+r.error+").");return}
  fmRefresh();
}
// The own profile: matches waiting for an answer, and the ones this player logged that are still open
function pendingMatchesHtml(list){
  if(!authUser||prof.uid!==authUser.uid)return "";
  const open=list.filter(m=>m.status!=="confirmed");if(!open.length)return "";
  return `<section class="card psec fm-pending"><h2>Matches to confirm</h2><ul class="pmatches fm-list">${fmRows(open)}</ul></section>`;
}
// one row per match, seen from the signed-in player's side
function fmRows(list){
  const me=authUser.uid,names=t=>t.map(p=>personLink(p)).join(" &amp; ");
  return list.map(m=>{
    const isOpp=m.b.some(p=>p.uid===me),mineSide=isOpp?m.b:m.a,g=fmGames(m.sets),won=isOpp?g.st>g.su:g.su>g.st;
    const what=`<b>${names(m.a)}</b> ${g.su>g.st?"beat":"lost to"} <b>${names(m.b)}</b> <span class="pm-sets">${esc(fmSetsStr(m.sets))}</span>${m.date?" · "+esc(fmDate(m.date)):""}${m.venue?" · "+esc(m.venue):""}`;
    if(m.status==="rejected")return `<li><div class="pm-main"><small class="fm-tag bad">Rejected${m.confirmedBy?" by "+esc((m.b.find(p=>p.uid===m.confirmedBy)||{}).name||"an opponent"):""}</small><span>${what}</span></div>${m.createdBy===me?`<button type="button" class="secondary" onclick="deleteMatch('${esc(m.id)}')">Delete</button>`:""}</li>`;
    if(m.status==="confirmed")return `<li><div class="pm-main"><small class="fm-tag ${won?"win":"loss"}">${won?"Won":"Lost"}${m.confirmedBy?" · confirmed by "+(m.confirmedBy===me?"you":esc((m.b.find(p=>p.uid===m.confirmedBy)||{}).name||"an opponent")):""}</small><span>${what}</span></div></li>`;
    if(isOpp)return `<li><div class="pm-main"><small class="fm-tag">Is this right? You ${won?"won":"lost"}</small><span>${what}</span></div><span class="fm-btns"><button type="button" class="primary" onclick="answerMatch('${esc(m.id)}','confirmed')">Confirm</button><button type="button" class="secondary" onclick="answerMatch('${esc(m.id)}','rejected')">Reject</button></span></li>`;
    return `<li><div class="pm-main"><small class="fm-tag">Waiting for ${esc(m.b[0].name)} or ${esc(m.b[1].name)} to confirm</small><span>${what}</span></div>${m.createdBy===me?`<button type="button" class="secondary" onclick="deleteMatch('${esc(m.id)}')">Delete</button>`:""}</li>`;
  }).join("");
}

/* ---------- "My matches" card on the My tournaments page ---------- */
let myMatchesReq=0;
async function loadMyMatches(){
  const box=$("myMatches");if(!box)return;
  if(!authUser||!window.__cloud){box.hidden=true;return}
  box.hidden=false;const req=++myMatchesReq;
  if(!box.innerHTML)box.innerHTML='<div class="pubhead"><h2>My matches</h2></div><p class="note">Loading…</p>';
  const r=await window.__cloud.matchesOfPlayer(authUser.uid);if(req!==myMatchesReq)return;
  const list=r.ok?r.list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)):[];
  const open=list.filter(m=>m.status!=="confirmed"),done=list.filter(m=>m.status==="confirmed");
  box.innerHTML=`<div class="pubhead"><div><h2>My matches</h2><p class="note" style="margin:0">Single matches outside tournaments. They count on all four profiles once an opponent confirms them.</p></div><button class="primary" onclick="openMatchDlg()">+ Add a match</button></div>
    ${!r.ok?'<p class="note">Could not load your matches ('+esc(r.error)+').</p>':!list.length?'<p class="note">No matches yet. Press <b>+ Add a match</b> to log a match you played with three other Padel Tour players, with up to five sets.</p>':""}
    ${open.length?`<section class="card psec fm-pending fm-inner"><h2>To confirm</h2><ul class="pmatches fm-list">${fmRows(open)}</ul></section>`:""}
    ${done.length?`<section class="psec fm-inner"><h2>Confirmed</h2><ul class="pmatches fm-list">${fmRows(done.slice(0,20))}</ul>${done.length>20?`<p class="note">All ${done.length} matches are on <a href="#p=${esc(authUser.uid)}" onclick="openProfile('${esc(authUser.uid)}');return false">your profile</a>.</p>`:""}</section>`:""}`;
}
