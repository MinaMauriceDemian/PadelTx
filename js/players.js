// Players on teams: each team can have up to two players, either a linked profile or a guest name.
// Stored on the tournament as teamPlayers {"<team index>": [{uid,name}|{name}]} plus playerUids (for profile look-ups).
// Groups + knockout: two players per team. Americano: each entry is one player, so one linked profile.
const maxPlayers=()=>typeof isAm==="function"&&isAm()?1:2;
let profileCache=null,pickTeam=null;

function playersOf(i){const v=(state.teamPlayers||{})[i];return Array.isArray(v)?v:[]}
function allPlayerUids(){const s=new Set();Object.values(state.teamPlayers||{}).forEach(l=>(l||[]).forEach(p=>p&&p.uid&&s.add(p.uid)));return [...s]}
function initials(name){return String(name||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase()||"?"}
function avatarHtml(p,size){
  const s=size||28,st=`width:${s}px;height:${s}px;font-size:${Math.round(s*.42)}px`;
  return p&&p.photoURL?`<img class="avatar" src="${esc(p.photoURL)}" alt="" style="${st}" referrerpolicy="no-referrer">`:`<span class="avatar" style="${st}" aria-hidden="true">${esc(initials(p&&(p.displayName||p.name)))}</span>`
}
function playerChip(p,i,k){
  const rm=isAdmin()?`<button type="button" class="pchip-x" onclick="removePlayer(${i},${k})" aria-label="Remove ${esc(p.name)} from this team">×</button>`:"";
  return p.uid
    ?`<span class="pchip"><a href="#p=${esc(p.uid)}" onclick="openProfile('${esc(p.uid)}');return false">${avatarHtml(p,22)}<span>${esc(p.name)}</span></a>${rm}</span>`
    :`<span class="pchip guest">${avatarHtml(p,22)}<span>${esc(p.name)}</span><small>guest</small>${rm}</span>`
}
function renderTeamPlayers(){
  document.querySelectorAll("[data-tp]").forEach(el=>{
    const i=+el.dataset.tp,ps=playersOf(i);
    el.innerHTML=ps.map((p,k)=>playerChip(p,i,k)).join("")+(isAdmin()&&ps.length<maxPlayers()?`<button type="button" class="addp" onclick="openPlayerPicker(${i})">${maxPlayers()===1?"+ Link profile":"+ Player"}</button>`:"");
    el.hidden=!ps.length&&!isAdmin();
  })
}
function setTeamPlayers(i,list){
  if(!isAdmin())return;
  const tp={...(state.teamPlayers||{})};
  if(list.length)tp[i]=list;else delete tp[i];
  state.teamPlayers=tp;save();renderTeamPlayers();
  cloudWrite({teamPlayers:tp,playerUids:allPlayerUids()})
}
function removePlayer(i,k){const l=[...playersOf(i)];l.splice(k,1);setTeamPlayers(i,l)}
function addPlayerToTeam(i,p){
  const l=playersOf(i);
  if(l.length>=maxPlayers()){toast(maxPlayers()===1?"This player is already linked to a profile.":"A team has at most two players.");return false}
  if(p.uid&&allPlayerUids().includes(p.uid)){toast(p.name+" is already in a team in this tournament.");return false}
  // Americano: linking a profile to a still-unnamed player also takes over the profile's name
  if(maxPlayers()===1&&/^Player \d+$/.test(teamName(i))){state.teams[i]=p.name;cloudWrite({teams:[...state.teams]});renderTeams()}
  setTeamPlayers(i,[...l,p]);return true
}

/* ---------- Picker dialog ---------- */
async function openPlayerPicker(i){
  if(!isAdmin())return;
  pickTeam=i;$("ppTeam").textContent=teamName(i);$("ppQ").value="";$("ppGuest").value="";$("ppMsg").textContent="";
  $("ppMe").hidden=!(window.CLOUD_ON&&authUser);
  $("playerDlg").showModal();
  if(!window.CLOUD_ON){$("ppList").innerHTML='<p class="note">Player profiles work on the online site. Add a guest name below.</p>';return}
  if(!profileCache){
    $("ppList").innerHTML='<p class="note">Loading players…</p>';
    const r=window.__cloud?await window.__cloud.listPublicProfiles():{ok:false,error:"not connected"};
    if(!r.ok){$("ppList").innerHTML=`<p class="note">Could not load players (${esc(r.error)}).</p>`;return}
    profileCache=r.list.sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName)));
  }
  renderPicker()
}
function renderPicker(){
  const q=$("ppQ").value.trim().toLowerCase(),taken=new Set(allPlayerUids());
  const list=(profileCache||[]).filter(p=>!q||[p.displayName,p.city,p.homeClub].join(" ").toLowerCase().includes(q));
  $("ppList").innerHTML=list.length?list.slice(0,50).map(p=>`<div class="pprow">${avatarHtml(p,34)}<div class="pp-main"><b dir="auto">${esc(p.displayName)}</b><small>${[p.level!=null?"Level "+fmtLevel(p.level):"",p.city,p.homeClub].filter(Boolean).map(esc).join(" · ")}</small></div>${taken.has(p.uid)?'<span class="note">In a team</span>':`<button type="button" class="secondary" onclick="pickProfile('${esc(p.uid)}')">Add</button>`}</div>`).join("")
    :`<p class="note">${(profileCache||[]).length?"No public player matches that search.":"No public player profiles yet."} You can add a guest name below.</p>`
}
function pickProfile(uid){
  const p=(profileCache||[]).find(x=>x.uid===uid);if(!p)return;
  const entry={uid:p.uid,name:p.displayName};if(p.photoURL)entry.photoURL=p.photoURL;
  if(addPlayerToTeam(pickTeam,entry)){$("playerDlg").close();toast(p.displayName+" added to "+teamName(pickTeam)+".")}
}
function pickGuest(){
  const n=$("ppGuest").value.trim().slice(0,40);
  if(!n){$("ppMsg").textContent="Type the player's name first.";return}
  if(addPlayerToTeam(pickTeam,{name:n})){$("playerDlg").close();toast(n+" added as a guest.")}
}
async function pickMe(){
  if(!authUser)return;
  const r=window.__cloud?await window.__cloud.getProfile(authUser.uid):{ok:false};
  const p=r&&r.profile,name=(p&&p.displayName)||authUser.displayName||authUser.email.split("@")[0];
  const entry={uid:authUser.uid,name};const photo=(p&&p.photoURL)||authUser.photoURL;if(photo)entry.photoURL=photo;
  if(addPlayerToTeam(pickTeam,entry)){$("playerDlg").close();toast("You were added to "+teamName(pickTeam)+".")}
}
