// Player profile: level, level progression, matches, statistics, preferences, partners & opponents, clubs.
// Built from the player's own entries plus their Padel Tour results. The level starts from what the player typed in and is then calculated from their results (calcLevel).
// Every signed-in person gets a profile automatically (ensureMyProfile).
const DAYS=[["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]];
const TIMES=[["morning","Morning"],["afternoon","Afternoon"],["evening","Evening"]];
const HANDS={right:"Right-handed",left:"Left-handed"};
const SIDES={right:"Right side",left:"Left side",both:"Both sides"};
const MTYPES={competitive:"Competitive",friendly:"Friendly",both:"Competitive & friendly"};
let prof={uid:null,data:null,stats:null,showAll:false,tab:null};

function fmtLevel(v){return (Math.round(+v*100)/100).toFixed(2)}
// Level guide on the 0–7 scale: [from, to, name, description]
const LEVELS=[
  [0,0.99,"Starter","First steps on court, little or no racket-sport experience."],
  [1,1.49,"Beginner","Learning the basic shots, the serve and the rules."],
  [1.5,2.49,"Improver","Rallies are getting longer; starting to play the ball off the walls."],
  [2.5,3.49,"Intermediate","Consistent shots, basic tactics, comfortable at the net."],
  [3.5,4.49,"Upper intermediate","Confident with walls, lobs and volleys; plays with a plan."],
  [4.5,5.49,"Advanced","Controls pace and placement; switches between attack and defence."],
  [5.5,7,"Competition","Plays tournaments regularly, from top amateur up to pro."]
];
function levelInfo(v){v=+v;return LEVELS.find(l=>v<=l[1]+0.0001)||LEVELS[LEVELS.length-1]}
function levelBand(v){return levelInfo(v)[2]}
const INFO_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 11v6"></path><circle cx="12" cy="7.6" r=".6" fill="currentColor"></circle></svg>';
// The level guide: every band, with the one matching `v` highlighted
function levelGuideHtml(v){
  const cur=v===null||v===""||isNaN(+v)?null:levelInfo(v);
  return `<p class="note">Pick the level that best describes how you play today. Use decimals to fine-tune, e.g. 2.75.</p><ol class="lvlguide">${LEVELS.map(l=>`<li class="${cur===l?"on":""}"><span class="lg-range">${l[0].toFixed(1)}–${(l[1]===7?7:l[1]+0.01).toFixed(1)}</span><span class="lg-text"><b>${l[2]}</b>${l[3]}</span></li>`).join("")}</ol>`
}
function toggleGuide(btn,boxId){
  const box=$(boxId),open=box.hidden;box.hidden=!open;btn.setAttribute("aria-expanded",String(open));
  if(open)box.innerHTML=levelGuideHtml(boxId==="pfGuide"?$("pfLevel").value.trim().replace(",","."):(prof.data&&prof.data.level))
}

/* ---------- Opening ---------- */
function openProfile(uid){if(!uid)return;if(location.hash!=="#p="+uid)location.hash="p="+uid;else showProfile(uid)}
// A profile with just the account's name and photo, created the first time someone signs in
function defaultProfile(){
  return {displayName:(authUser.displayName||authUser.email.split("@")[0]).slice(0,40),photoURL:authUser.photoURL||"",city:"",homeClub:"",about:"",
    level:null,levelHistory:[],hand:"",side:"",matchType:"",days:[],times:[],whatsapp:"",visibility:"public",createdAt:Date.now()}
}
async function ensureMyProfile(){
  if(!authUser||!window.__cloud||!window.__cloud.getProfile)return null;
  const r=await window.__cloud.getProfile(authUser.uid);
  if(!r.ok)return null;
  if(r.profile)return r.profile;
  const d=defaultProfile(),s=await window.__cloud.saveProfile(d);
  if(s.ok)profileCache=null;
  return {uid:authUser.uid,...d}
}
function openMyProfile(){
  if(!authUser){toLogin();toast("Sign in to see your player profile.");return}
  if($("authDlg").open)$("authDlg").close();
  openProfile(authUser.uid)
}
async function showProfile(uid){
  if(currentTid&&window.__cloud){window.__cloud.leave();currentTid=null}
  prof={uid,data:null,stats:null,showAll:false,tab:null};
  showView("profile");window.scrollTo(0,0);
  $("profileBody").innerHTML='<div class="card"><p class="note">Loading profile…</p></div>';
  if(!window.CLOUD_ON||!window.__cloud){$("profileBody").innerHTML='<div class="card"><p class="note">Player profiles work on the online site.</p></div>';return}
  const [p,t]=await Promise.all([window.__cloud.getProfile(uid),window.__cloud.tournamentsOfPlayer(uid)]);
  if(prof.uid!==uid)return;
  const own=!!authUser&&authUser.uid===uid;
  if(!p.ok){$("profileBody").innerHTML=`<div class="card"><p class="note">Could not load this profile (${esc(p.error)}).</p></div>`;return}
  if(!p.profile&&own)p.profile=await ensureMyProfile()||{uid,...defaultProfile()};
  if(prof.uid!==uid)return;
  if(!p.profile){
    $("profileBody").innerHTML=`<div class="card prof-empty"><h2>${p.private?"This profile is private":"Profile not found"}</h2><p class="note">${p.private?"This player has chosen not to show their profile.":"This player hasn't signed in to Padel Tour yet."}</p><button class="secondary" onclick="brandHome()">← Home</button></div>`;
    return
  }
  prof.data=p.profile;
  prof.stats=computePlayerStats(uid,t.ok?t.list:[]);
  prof.calc=calcLevel(prof.data,prof.stats.matches,await otherLevels(uid,prof.stats.matches));
  if(prof.uid!==uid)return;
  renderProfile()
}

/* ---------- Calculated level (Elo on the 0–7 scale) ---------- */
// Expected result E = 1/(1+10^((them−us)/1.5)), us/them = the average level of each pair.
// After each match: level + K×(share of the points won − E); K is 0.15 at first and 0.05 after 20 matches,
// and one match moves the level by at most ±0.10. Starts from the self-reported level (or 1.5).
const LV_START=1.5,LV_SCALE=1.5,LV_MAX_STEP=0.1;
function lvExpected(us,them){return 1/(1+Math.pow(10,(them-us)/LV_SCALE))}
function lvK(n){return Math.max(0.05,0.15-0.005*n)}
// The self-reported levels of partners and opponents (public profiles only)
async function otherLevels(uid,matches){
  const ids=new Set();
  matches.forEach(m=>[m.partner,...m.oppPlayers].forEach(p=>{if(p&&p.uid&&p.uid!==uid)ids.add(p.uid)}));
  const out={};
  await Promise.all([...ids].slice(0,80).map(async id=>{const r=await window.__cloud.getProfile(id);const l=r.ok&&r.profile?r.profile.level:null;if(l!=null&&l!=="")out[id]=+l}));
  return out
}
function calcLevel(d,matches,levels){
  const list=[...matches].filter(m=>m.us+m.them>0).sort((a,b)=>a.at-b.at||a.slot-b.slot);
  // the level the player gave before their first match counts as the start, so editing it later doesn't rewrite the past
  const hist=(d.levelHistory||[]).filter(h=>h&&h.level!=null).sort((a,b)=>a.at-b.at);
  const before=list.length?hist.filter(h=>h.at<=list[0].at).pop():null;
  const start=before?+before.level:hist.length?+hist[0].level:d.level!=null&&d.level!==""?+d.level:LV_START;
  let lv=start;const steps=[];
  const known=p=>p&&p.uid&&levels[p.uid]!=null?levels[p.uid]:null;
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  list.forEach((m,n)=>{
    // players without a level count as the average of the known ones in the match (or as this player)
    const k=[known(m.partner),...m.oppPlayers.map(known)].filter(v=>v!=null),fill=k.length?avg(k):lv;
    const or=p=>{const v=known(p);return v==null?fill:v};
    const us=m.partner?(lv+or(m.partner))/2:lv,them=m.oppPlayers.length?avg(m.oppPlayers.map(or)):fill;
    const step=Math.max(-LV_MAX_STEP,Math.min(LV_MAX_STEP,lvK(n)*(m.us/(m.us+m.them)-lvExpected(us,them))));
    lv=Math.max(0,Math.min(7,lv+step));m.lvStep=step;
    steps.push({level:lv,at:m.at});
  });
  return {start,level:lv,n:list.length,hist:list.length?[{level:start,at:list[0].at-1},...steps]:[]}
}

/* ---------- Statistics from Padel Tour tournaments ---------- */
function withState(tmp,fn){const saved=state;state=tmp;try{return fn()}finally{state=saved}}
function stateFromDoc(d){return {teams:(d.teams||[]).map(String),teamPlayers:d.teamPlayers||{},scores:d.scores||{},bestOf:d.bestOf||{},moves:d.moves||{},sfPairing:+d.sfPairing||0,settings:{...DEFAULT_SETTINGS,...(d.settings||{})},style:d.style||"groups_ko",visibility:d.visibility||"public"}}
function computePlayerStats(uid,list){
  const matches=[],partners={},opponents={},clubs={},places=[];
  const bump=(o,p,extra)=>{const k=p.uid||("g:"+p.name.toLowerCase());o[k]=o[k]||{uid:p.uid||null,name:p.name,photoURL:p.photoURL||"",n:0,w:0};o[k].n++;if(extra)o[k].w++};
  list.forEach(t=>{
    if(!Array.isArray(t.teams)||t.teams.length<4)return;
    withState(stateFromDoc(t),()=>{
      const ti=t.teams.findIndex((_,i)=>playersOf(i).some(p=>p.uid===uid));if(ti<0)return;
      const partner=playersOf(ti).find(p=>p.uid!==uid)||null,date=state.settings.date||"";
      if(state.settings.venue){const v=state.settings.venue;clubs[v]=clubs[v]||{name:v,n:0,last:""};clubs[v].n++;if(date>clubs[v].last)clubs[v].last=date}
      if(isAm()){amCollectStats(ti,t,{matches,partners,opponents,places,bump});return}
      allMatches().forEach(m=>{
        const A=matchTeam(m.id,"a"),B=matchTeam(m.id,"b");if(A!==ti&&B!==ti)return;
        const s=score(m.id);if(!s)return;
        const mine=A===ti?"a":"b",opp=mine==="a"?B:A,won=s[mine]>s[mine==="a"?"b":"a"];
        const oppPlayers=playersOf(opp);
        matches.push({tid:t.id,tname:t.name||"Tournament",date,time:timeFor(m.slot),slot:m.slot,stage:m.ko?koTitle(m.id):m.stage,team:teamName(ti),partner,opp:teamName(opp),oppPlayers,us:s[mine],them:s[mine==="a"?"b":"a"],won});
        if(partner)bump(partners,partner,won);
        (oppPlayers.length?oppPlayers:[{name:teamName(opp)}]).forEach(p=>bump(opponents,p,!won));
      });
      const P=placements(),pi=P.findIndex(p=>p.t===ti);
      if(pi>=0)places.push({tid:t.id,tname:t.name||"Tournament",place:pi+1,of:P.length,date});
    });
  });
  // when it was played: the tournament date and the match time, or when the tournament was made
  const made={};list.forEach(t=>made[t.id]=t.createdAt||0);
  matches.forEach(m=>{const t=m.date?Date.parse(m.date+"T"+(/^\d\d:\d\d$/.test(m.time)?m.time:"00:00")):NaN;m.at=isNaN(t)?made[m.tid]+m.slot:t});
  matches.sort((a,b)=>b.at-a.at||b.slot-a.slot);
  const won=matches.filter(m=>m.won).length,drawn=matches.filter(m=>m.draw).length,top=o=>Object.values(o).sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name)).slice(0,5);
  return {matches,played:matches.length,won,lost:matches.length-won-drawn,drawn,rate:matches.length?Math.round(won/matches.length*100):null,
    tournaments:new Set(list.filter(t=>(t.teams||[]).some((_,i)=>((t.teamPlayers||{})[i]||[]).some(p=>p.uid===uid))).map(t=>t.id)).size,
    titles:places.filter(p=>p.place===1).length,podiums:places.filter(p=>p.place<=3).length,places,
    partners:top(partners),opponents:top(opponents),clubs:Object.values(clubs).sort((a,b)=>b.n-a.n)}
}

/* ---------- Rendering ---------- */
function section(title,body,note){return `<section class="card psec"><h2>${title}</h2>${note?`<p class="note">${note}</p>`:""}${body}</section>`}
function personLink(p){return p.uid?`<a href="#p=${esc(p.uid)}" onclick="openProfile('${esc(p.uid)}');return false">${esc(p.name)}</a>`:esc(p.name)}
function renderProfile(){
  const d=prof.data,S=prof.stats,own=!!authUser&&authUser.uid===prof.uid,hasLevel=d.level!=null&&d.level!=="";
  const chips=[d.hand&&HANDS[d.hand],d.side&&SIDES[d.side]].filter(Boolean);
  const head=`<section class="card phead">
    ${avatarHtml(d,84)}
    <div class="phead-main">
      <h1 dir="auto">${esc(d.displayName)}</h1>
      <p class="note">${[d.city,d.homeClub].filter(Boolean).map(esc).join(" · ")||"Padel player"}${d.visibility==="private"?' · <span class="chip privchip">Private</span>':""}</p>
      ${chips.length?`<div class="pchips">${chips.map(c=>`<span class="chip chipA">${esc(c)}</span>`).join("")}</div>`:""}
      ${d.about?`<p class="pabout" dir="auto">${esc(d.about)}</p>`:""}
      <div class="actions" style="margin:0">
        ${d.whatsapp?`<a class="btn wa" href="https://wa.me/${esc(d.whatsapp)}" target="_blank" rel="noopener">Message on WhatsApp</a>`:""}
        <button class="secondary" onclick="copyProfileLink()">Share profile</button>
        ${own?`<button class="primary" onclick="editProfile()">Edit profile</button>`:""}
      </div>
    </div>
  </section>`;
  const guideBtn=`<button type="button" class="infobtn" aria-expanded="false" aria-controls="lvGuide" onclick="toggleGuide(this,'lvGuide')" title="What do the levels mean?">${INFO_ICON}<span>Level guide</span></button>`;
  const C=prof.calc||{n:0},calc=C.n>0,lvNow=calc?C.level:d.level;
  const bigLevel=v=>`<div class="plevel"><div class="plevel-n">${fmtLevel(v)}</div><div><b>${levelBand(v)}</b><p class="note">${esc(levelInfo(v)[3])}</p></div></div>`;
  const level=section("Level",(calc?bigLevel(lvNow)+`<p class="calcrep">Calculated from ${C.n} match${C.n>1?"es":""}</p>${hasLevel?`<p class="note">Self-reported: ${fmtLevel(d.level)}</p>`:""}`
    :hasLevel?bigLevel(d.level)+`<p class="selfrep">Self-reported by the player</p><p class="note">It's calculated from the results once a match has been played.</p>`
    :`<p class="note">${own?"Add your level in Edit profile. After that it's calculated from your results.":"No level added yet."}</p>`)+guideBtn+`<div id="lvGuide" class="guidebox" hidden></div>`);
  const hist=calc?C.hist:(d.levelHistory||[]).filter(h=>h&&h.level!=null);
  const progression=section("Level progression",hist.length>1?levelChart(hist):`<p class="note">${hist.length?"The graph appears after the level has been updated at least twice.":"No level history yet."}</p>`,
    calc?`Updated after every match: beating stronger players or winning by a lot raises it more. It started at ${fmtLevel(C.start)}.`:"Based on the levels entered over time.");
  const rows=prof.showAll?S.matches:S.matches.slice(0,8);
  const matches=section("Matches",S.matches.length?`<ol class="pmatches">${rows.map(m=>`<li><span class="res ${m.won?"w":m.draw?"d":"l"}">${m.won?"W":m.draw?"D":"L"}</span><div class="pm-main"><b><a href="#t=${esc(m.tid)}">${esc(m.tname)}</a> · ${esc(m.stage)}</b><small>${m.date?esc(new Date(m.date+"T00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}))+" · ":""}${esc(m.time)} · ${m.partner?"with "+personLink(m.partner)+" ":""}vs ${m.oppPlayers.length?m.oppPlayers.map(personLink).join(" &amp; "):esc(m.opp)}</small></div><span class="pm-score">${m.us}–${m.them}${m.lvStep!=null?`<small class="lvstep ${m.lvStep>=0?"up":"down"}" title="Level change">${m.lvStep>=0?"+":"−"}${Math.abs(m.lvStep).toFixed(2)}</small>`:""}</span></li>`).join("")}</ol>${S.matches.length>8?`<button class="secondary" onclick="prof.showAll=!prof.showAll;renderProfile()">${prof.showAll?"Show fewer":"Show all "+S.matches.length+" matches"}</button>`:""}`
    :`<p class="note">No finished matches yet. Matches appear when a tournament admin adds this player to a team.</p>`,"Finished matches in Padel Tour tournaments.");
  const tile=(n,l)=>`<div class="ptile"><b>${n}</b><span>${l}</span></div>`;
  const stats=section("Statistics",`<div class="ptiles">${tile(S.played,"Played")}${tile(S.won,"Won")}${tile(S.lost,"Lost")}${tile(S.rate==null?"–":S.rate+"%","Win rate")}${tile(S.tournaments,"Tournaments")}${tile(S.titles,"Titles")}${tile(S.podiums,"Podiums")}</div>`);
  const prefs=section("Player preferences",`<dl class="pprefs">
    <div><dt>Dominant hand</dt><dd>${d.hand?esc(HANDS[d.hand]):"–"}</dd></div>
    <div><dt>Court position</dt><dd>${d.side?esc(SIDES[d.side]):"–"}</dd></div>
    <div><dt>Match type</dt><dd>${d.matchType?esc(MTYPES[d.matchType]):"–"}</dd></div>
    <div><dt>Days</dt><dd class="pdays">${DAYS.map(([k,l])=>`<span class="${(d.days||[]).includes(k)?"on":""}">${l}</span>`).join("")}</dd></div>
    <div><dt>Times</dt><dd class="pdays">${TIMES.map(([k,l])=>`<span class="${(d.times||[]).includes(k)?"on":""}">${l}</span>`).join("")}</dd></div>
  </dl>`);
  const plist=(arr,label)=>arr.length?`<ul class="ppeople">${arr.map(p=>`<li>${avatarHtml(p,30)}<span class="pp-name">${personLink(p)}</span><span class="note">${p.n} match${p.n>1?"es":""} · ${label(p)}</span></li>`).join("")}</ul>`:'<p class="note">None yet.</p>';
  const people=section("Players I play most with",`<div class="pcols"><div><h3>Partners</h3>${plist(S.partners,p=>`${p.w} won together`)}</div><div><h3>Opponents</h3>${plist(S.opponents,p=>`${p.w} won against`)}</div></div>`);
  const clubList=[...(d.homeClub?[{name:d.homeClub,home:true}]:[]),...S.clubs.filter(c=>c.name!==d.homeClub)];
  const clubs=section("Clubs",clubList.length?`<ul class="pclubs">${clubList.map(c=>`<li><b dir="auto">${esc(c.name)}</b><span class="note">${c.home?"Home club":c.n+" tournament"+(c.n>1?"s":"")+(c.last?" · last "+esc(new Date(c.last+"T00:00").toLocaleDateString(undefined,{month:"short",year:"numeric"})):"")}</span></li>`).join("")}</ul>`:'<p class="note">No clubs yet. Tournament venues appear here once the admin sets one in Setup.</p>');
  // Like the home page: the header, then one tile per part; a tile opens that part on its own
  const parts={level:level+progression,stats,matches,people,prefs,clubs};
  if(prof.tab&&parts[prof.tab]){
    $("profileBody").innerHTML=head+`<button type="button" class="secondary pback" onclick="profTab(null)">‹ All of ${esc(d.displayName)}'s profile</button>`+parts[prof.tab];
    return
  }
  const last=S.matches[0],top=S.partners[0],when=[...(d.days||[]).map(k=>(DAYS.find(x=>x[0]===k)||[,""])[1]),...(d.times||[]).map(k=>(TIMES.find(x=>x[0]===k)||[,""])[1])];
  const T=(k,ic,title,sub)=>`<button type="button" class="htile" onclick="profTab('${k}')"><span class="ht-ic"><svg class="ic" aria-hidden="true"><use href="#i-${ic}"></use></svg></span><span class="ht-txt"><b>${title}</b><small>${sub}</small></span><span class="ht-go" aria-hidden="true">›</span></button>`;
  const tiles=[
    T("level","trend",lvNow!=null&&lvNow!==""?`Level ${fmtLevel(lvNow)} · ${levelBand(lvNow)}`:"Level",calc?`Calculated from ${C.n} match${C.n>1?"es":""}. See how it changed.`:hasLevel?"Self-reported. Calculated once a match is played.":"No level yet."),
    T("stats","bars","Statistics",S.played?`${S.played} played · ${S.won} won · ${S.rate}% win rate`:"No matches played yet."),
    T("matches","court","Matches",last?`Last: ${last.won?"won":last.draw?"draw":"lost"} ${last.us}–${last.them} vs ${esc(last.oppPlayers.length?last.oppPlayers.map(p=>p.name).join(" & "):last.opp)}`:"No finished matches yet."),
    T("people","users","Partners & opponents",top?`Plays most with ${esc(top.name)}`:"None yet."),
    T("prefs","sliders","Preferences",esc([d.side&&SIDES[d.side],d.matchType&&MTYPES[d.matchType],when.slice(0,4).join(", ")].filter(Boolean).join(" · "))||"Not filled in yet."),
    T("clubs","pin","Clubs",clubList.length?esc(clubList.slice(0,2).map(c=>c.name).join(", "))+(clubList.length>2?` +${clubList.length-2}`:""):"No clubs yet.")
  ].join("");
  $("profileBody").innerHTML=head+`<nav class="hometiles ptabs" aria-label="Profile">${tiles}</nav>`;
}
function profTab(k){prof.tab=k;renderProfile();window.scrollTo(0,0)}
function levelChart(hist){
  // drawn at the real width so the labels stay readable on phones
  const pts=[...hist].sort((a,b)=>a.at-b.at).slice(-30),W=Math.max(280,Math.min(900,(($("profileBody")||{}).clientWidth||640)-48)),H=W<500?170:200,pl=36,pr=16,pt=16,pb=30;
  const vals=pts.map(p=>+p.level),lo=Math.max(0,Math.floor(Math.min(...vals)-.5)),hi=Math.min(7,Math.ceil(Math.max(...vals)+.5));
  const x=i=>pl+(pts.length===1?0:i*(W-pl-pr)/(pts.length-1)),y=v=>pt+(hi-v)*(H-pt-pb)/((hi-lo)||1);
  let g="";for(let v=lo;v<=hi;v++)g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" class="cgrid"></line><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" class="ctext">${v}</text>`;
  const line=pts.map((p,i)=>`${x(i)},${y(+p.level)}`).join(" ");
  const fmt=t=>new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short"});
  const last=pts[pts.length-1];
  return `<div class="pchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Level from ${fmtLevel(pts[0].level)} to ${fmtLevel(last.level)}">${g}<polygon points="${pl},${H-pb} ${line} ${x(pts.length-1)},${H-pb}" class="carea"></polygon><polyline points="${line}" class="cline"></polyline>${pts.map((p,i)=>`<circle cx="${x(i)}" cy="${y(+p.level)}" r="${i===pts.length-1?5.5:3.5}" class="${i===pts.length-1?"cdot last":"cdot"}"><title>${fmt(p.at)}: ${fmtLevel(p.level)}</title></circle>`).join("")}<text x="${x(pts.length-1)}" y="${y(+last.level)-12}" text-anchor="end" class="ctext strong">${fmtLevel(last.level)}</text><text x="${pl}" y="${H-8}" class="ctext">${fmt(pts[0].at)}</text><text x="${W-pr}" y="${H-8}" text-anchor="end" class="ctext">${fmt(last.at)}</text></svg></div>`
}
function copyProfileLink(){
  const url=location.origin+location.pathname+"#p="+prof.uid;
  if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>toast("Profile link copied."),()=>toast(url));else toast(url)
}

/* ---------- Editing ---------- */
function optGroup(name,opts,val,multi){return opts.map(([k,l])=>`<label class="opt"><input type="${multi?"checkbox":"radio"}" name="${name}" value="${k}"${(multi?(val||[]).includes(k):val===k)?" checked":""}><span>${l}</span></label>`).join("")}
async function editProfile(){
  if(!authUser){toLogin();return}
  let d=prof.uid===authUser.uid&&prof.data?prof.data:null;
  if(!d&&window.__cloud){const r=await window.__cloud.getProfile(authUser.uid);d=r.ok?r.profile:null}
  d=d||{displayName:authUser.displayName||authUser.email.split("@")[0],visibility:"public"};
  $("pfName").value=d.displayName||"";$("pfCity").value=d.city||"";$("pfClub").value=d.homeClub||"";$("pfAbout").value=d.about||"";
  $("pfLevel").value=d.level!=null?fmtLevel(d.level):"";$("pfWa").value=d.whatsapp?"+"+d.whatsapp:"";
  $("pfGuide").hidden=true;$("pfGuideBtn").setAttribute("aria-expanded","false");updateLevelHint();
  $("pfHand").innerHTML=optGroup("pfHand",Object.entries(HANDS).map(([k,v])=>[k,v.replace("-handed","")]),d.hand);
  $("pfSide").innerHTML=optGroup("pfSide",[["left","Left"],["right","Right"],["both","Both"]],d.side);
  $("pfType").innerHTML=optGroup("pfType",[["competitive","Competitive"],["friendly","Friendly"],["both","Both"]],d.matchType);
  $("pfDays").innerHTML=optGroup("pfDays",DAYS,d.days,true);$("pfTimes").innerHTML=optGroup("pfTimes",TIMES,d.times,true);
  $("pfVis").value=d.visibility==="private"?"private":"public";$("pfMsg").textContent="";
  $("profileDlg").showModal()
}
function readProfileForm(prev){
  const val=n=>{const el=document.querySelector(`input[name="${n}"]:checked`);return el?el.value:""};
  const vals=n=>[...document.querySelectorAll(`input[name="${n}"]:checked`)].map(e=>e.value);
  const name=$("pfName").value.trim();if(!name)return {error:"Add your name."};
  const lvRaw=$("pfLevel").value.trim().replace(",","."),level=lvRaw===""?null:Math.round(parseFloat(lvRaw)*100)/100;
  if(level!==null&&!(level>=0&&level<=7))return {error:"Level must be a number from 0 to 7, like 3.25."};
  let wa="";const w=$("pfWa").value.trim();if(w){const r=normalizePhone(w);if(r.error)return {error:r.error};wa=r.phone}
  const hist=[...((prev&&prev.levelHistory)||[])];
  if(level!==null&&(!hist.length||+hist[hist.length-1].level!==level))hist.push({level,at:Date.now()});
  return {data:{displayName:name.slice(0,40),photoURL:(prev&&prev.photoURL)||authUser.photoURL||"",city:$("pfCity").value.trim().slice(0,40),homeClub:$("pfClub").value.trim().slice(0,60),
    about:$("pfAbout").value.trim().slice(0,300),level,levelHistory:hist.slice(-100),
    hand:val("pfHand"),side:val("pfSide"),matchType:val("pfType"),days:vals("pfDays"),times:vals("pfTimes"),
    whatsapp:wa,visibility:$("pfVis").value==="private"?"private":"public",createdAt:(prev&&prev.createdAt)||Date.now()}}
}
// Live hint under the level box: the band for the typed level, and the guide follows along when open
function updateLevelHint(){
  const raw=$("pfLevel").value.trim().replace(",","."),v=parseFloat(raw),ok=raw!==""&&v>=0&&v<=7;
  $("pfLevelHint").textContent=raw===""?"":ok?levelBand(v)+": "+levelInfo(v)[3]:"Use a number from 0 to 7.";
  if(!$("pfGuide").hidden)$("pfGuide").innerHTML=levelGuideHtml(ok?v:null)
}
async function saveProfileForm(e){
  e.preventDefault();
  const prev=prof.uid===authUser.uid?prof.data:(await window.__cloud.getProfile(authUser.uid)).profile;
  const r=readProfileForm(prev);if(r.error){$("pfMsg").textContent=r.error;return}
  $("pfMsg").textContent="Saving…";
  const s=await window.__cloud.saveProfile(r.data);
  if(!s.ok){$("pfMsg").textContent=s.error==="permission-denied"?"Not allowed. Check that the latest rules are published in Firebase.":"Could not save ("+s.error+").";return}
  profileCache=null;$("profileDlg").close();toast("Profile saved.");
  if(view==="profile"&&prof.uid===authUser.uid)showProfile(authUser.uid);else openProfile(authUser.uid)
}
