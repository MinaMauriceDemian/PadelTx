// Follow a team (or a player in Americano): highlights their matches and shows "your next match".
// The choice is remembered per tournament in this browser.
const followKey=()=>"padelFollow:"+(currentTid||"local");
function getFollow(){try{const v=localStorage.getItem(followKey());return v===null||v===""?null:+v}catch(e){return null}}
function setFollow(v){
  try{v===""||v==null?localStorage.removeItem(followKey()):localStorage.setItem(followKey(),String(+v))}catch(e){}
  renderFollow();if(typeof refresh==="function")refresh()
}
// Name of one side of a match, for both styles
function sideLabel(m,side){
  if(m.am)return pairName(side==="a"?m.pa:m.pb);
  const t=matchTeam(m.id,side);return t!=null?teamName(t):phText(side==="a"?m.sourceA:m.sourceB)
}
function involves(m,i){return m.am?(m.pa.includes(i)||m.pb.includes(i)):(matchTeam(m.id,"a")===i||matchTeam(m.id,"b")===i)}
function mySide(m,i){return m.am?(m.pa.includes(i)?"a":"b"):(matchTeam(m.id,"a")===i?"a":"b")}
function nextFor(i){
  const ms=[...allMatches()].sort((a,b)=>a.slot-b.slot||a.court-b.court),L=liveInfo();
  const now=ms.find(m=>involves(m,i)&&!score(m.id)&&L&&m.slot===L.cur);
  if(now)return {m:now,now:true};
  const nx=ms.find(m=>involves(m,i)&&!score(m.id));
  if(nx)return {m:nx,now:false};
  // nothing scheduled: either finished or waiting for the knockout draw
  const open=!(typeof isAm==="function"&&isAm())&&ms.some(m=>m.ko&&!score(m.id)&&(matchTeam(m.id,"a")==null||matchTeam(m.id,"b")==null));
  return {m:null,waiting:open}
}
function renderFollow(){
  const bar=$("followBar");if(!bar)return;
  const f=getFollow(),am=typeof isAm==="function"&&isAm(),n=teamCount();
  if(!state.teams||!n){bar.hidden=true;return}
  const opts=`<option value="">${am?"Follow a player…":"Follow a team…"}</option>`+state.teams.map((t,i)=>`<option value="${i}"${f===i?" selected":""}>${esc(teamName(i))}</option>`).join("");
  const sel=`<select id="followSel" aria-label="${am?"Follow a player":"Follow a team"}" onchange="setFollow(this.value)">${opts}</select>`;
  let msg="";
  if(f!=null&&f<n){
    const r=nextFor(f);
    if(r.m){
      const m=r.m,me=mySide(m,f),opp=sideLabel(m,me==="a"?"b":"a"),with_=m.am?" with "+esc(teamName((me==="a"?m.pa:m.pb).find(x=>x!==f))):"";
      msg=`<span class="fb-text">${r.now?'<b class="fb-now">Playing now</b>':`<b>Next match ${timeFor(m.slot)}</b>`} on ${esc(courtName(m.court))}${with_} vs ${esc(opp)}</span><button type="button" class="secondary fb-go" onclick="goToSlot(${m.slot})">Show</button>`;
    }else{
      const P=placements(),pi=P.findIndex(p=>p.t===f);
      msg=`<span class="fb-text">${r.waiting?"Waiting for the knockout draw.":pi>=0?`<b>Finished ${ord(pi+1)}</b>`:"No more matches."}</span>`;
    }
  }
  bar.innerHTML=`<span class="fb-star" aria-hidden="true">★</span>${sel}${msg}`;bar.hidden=false;
  highlightFollow()
}
function highlightFollow(){
  document.querySelectorAll(".followed").forEach(el=>el.classList.remove("followed"));
  const f=getFollow();if(f==null)return;
  allMatches().forEach(m=>{if(involves(m,f)){const el=$(m.id+"-"+mySide(m,f));if(el)el.classList.add("followed")}});
  const name=teamName(f);
  document.querySelectorAll("#standGroups td:nth-child(2)").forEach(td=>{if(td.textContent===name)td.parentElement.classList.add("followed")});
}
// Bring a slot into view: on phones slide the carousel there, on computers scroll to its row
function goToSlot(slot){
  showTab("schedule",document.querySelector('.tab[data-tab="schedule"]'));
  if(document.getElementById("mcar")){carPick();return carGoSlot(slot,true)}
  const el=document.querySelector(`#schedBox [data-slot="${slot}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"})
}
