// Americano: players sign up on their own; every round they get a new partner and new opponents.
// Each match is played to a fixed total of points (e.g. 24 → 14–10). Players keep the points their side won;
// the leaderboard ranks by total points. Someone sitting out a round gets half the match points (the round's average).
//
// This file only takes over when a tournament's style is "americano": it wraps the Groups + knockout functions
// (allMatches, score checks, setup, schedule, results, sharing, printing) and calls the originals otherwise.
const AM_MAX=24,AM_POINTS=[16,21,24,32];
const isAm=()=>state.style==="americano";
function amPoints(){const v=+state.settings.points;return v>=4&&v<=64?v:24}
function amDefaultRounds(n){return Math.min(10,n%4===0?n-1:n)}
function amRounds(){const v=Math.round(+state.settings.rounds);return v>=1&&v<=30?v:amDefaultRounds(teamCount())}
const fmtPts=v=>Number.isInteger(v)?String(v):v.toFixed(1);
const pairName=p=>teamName(p[0])+" & "+teamName(p[1]);

/* ---------- Schedule: rotating partners ---------- */
// Same input → same schedule on every device (no randomness; the "shuffles" use a fixed seed).
// Built round by round, so adding rounds later keeps the earlier rounds (and their scores) unchanged.
function seededShuffle(arr,seed){let s=seed>>>0||1;const a=[...arr];for(let i=a.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function amGreedy(order,P,O){
  const rem=[...order],out=[];let cost=0;
  while(rem.length>=4){
    const p=rem.shift();let bi=0,bc=Infinity;
    rem.forEach((q,i)=>{const c=P[p][q];if(c<bc){bc=c;bi=i}});
    const q=rem.splice(bi,1)[0];cost+=bc*100;
    let bx=0,by=1,bo=Infinity;
    for(let i=0;i<rem.length;i++)for(let j=i+1;j<rem.length;j++){
      const x=rem[i],y=rem[j],c=P[x][y]*100+(O[p][x]+O[p][y]+O[q][x]+O[q][y])*10;
      if(c<bo){bo=c;bx=i;by=j}
    }
    const y=rem.splice(by,1)[0],x=rem.splice(bx,1)[0];cost+=bo;
    out.push([[p,q],[x,y]]);
  }
  return {pairs:out,cost}
}
// Round-robin "circle" method: N-1 rounds in which every player partners every other player exactly once
function circlePairs(N,idx){
  let t=[...Array(N).keys()];
  for(let k=0;k<idx%(N-1);k++)t=[t[0],t[N-1],...t.slice(1,N-1)];
  return Array.from({length:N/2},(_,i)=>[t[i],t[N-1-i]])
}
// Put the round's partner pairs against each other, avoiding repeat opponents
function amMatchPairs(pairs,O,seed){
  let best=null;
  for(let t=0;t<80;t++){
    const rem=t===0?[...pairs]:seededShuffle(pairs,seed+t*104729),out=[];let cost=0;
    while(rem.length>=2){
      const a=rem.shift();let bi=0,bc=Infinity;
      rem.forEach((b,i)=>{const c=O[a[0]][b[0]]+O[a[0]][b[1]]+O[a[1]][b[0]]+O[a[1]][b[1]];if(c<bc){bc=c;bi=i}});
      out.push([a,rem.splice(bi,1)[0]]);cost+=bc;
    }
    if(!best||cost<best.cost)best={pairs:out,cost};
    if(best.cost===0)break;
  }
  return best
}
let _am=null,_amKey="",_modeKey="",_mode="greedy";
// Builds R rounds. mode "circle" takes partners from the circle method in rounds where everyone plays.
function amBuild(N,R,mode){
  const P=Array.from({length:N},()=>Array(N).fill(0)),O=Array.from({length:N},()=>Array(N).fill(0)),byes=Array(N).fill(0);
  const m=[],rounds=[];let slot=1;
  const nextCourts=()=>{for(let g=0;g<2000;g++){const c=courtsAt(slot);if(c.list.length)return c;slot++}return {list:[0],over:true}};
  for(let r=1;r<=R;r++){
    const cs=nextCourts(),k=Math.max(1,Math.min(Math.floor(N/4),cs.list.length)),sitN=N-4*k;
    // who sits out: whoever has sat out least, taking turns in player order
    // (among players with equally few sit-outs, several choices are tried and the one giving the fewest repeats wins)
    const turn=x=>((x-(r-1)*sitN)%N+N)%N;
    const base=[...Array(N).keys()].sort((x,y)=>byes[x]-byes[y]||turn(x)-turn(y));
    let best=null,sit=[];
    if(mode==="circle"&&sitN===0&&N%4===0)best=amMatchPairs(circlePairs(N,r-1),O,r*7919);
    else{
      const minB=byes[base[0]],pool=base.filter(x=>byes[x]===minB),rest=base.filter(x=>byes[x]!==minB);
      // search wider only when the quick search can't avoid a repeat
      const tries=sitN&&pool.length>sitN?24:1,more=sitN&&pool.length>sitN?48:1;
      for(let v=0;v<more&&(v<tries||best.cost>0);v++){
        const order=v===0?base:[...seededShuffle(pool,r*31337+v*7877),...rest];
        const s=order.slice(0,sitN).sort((a,b)=>a-b),act=order.slice(sitN).sort((a,b)=>a-b);
        for(let t=0;t<(tries>1?30:80);t++){
          const g=amGreedy(t===0?act:seededShuffle(act,r*7919+t*104729),P,O);
          if(!best||g.cost<best.cost){best=g;sit=s}
          if(best.cost===0)break;
        }
        if(best.cost===0)break;
      }
    }
    best.pairs.forEach(([a,b])=>{
      P[a[0]][a[1]]++;P[a[1]][a[0]]++;P[b[0]][b[1]]++;P[b[1]][b[0]]++;
      a.forEach(x=>b.forEach(y=>{O[x][y]++;O[y][x]++}));
    });
    sit.forEach(x=>byes[x]++);
    const list=best.pairs.map(([a,b],ci)=>({id:`r${r}c${cs.list[ci]+1}`,slot,court:cs.list[ci]+1,over:cs.over,stage:"Round "+r,round:r,am:true,pa:a,pb:b}));
    m.push(...list);rounds.push({round:r,slot,sit,ids:list.map(x=>x.id)});slot++;
  }
  return {m,rounds,slot,P,O}
}
// Pick the method once per player count and courts (judged over a full cycle of N-1 rounds),
// so changing the number of rounds never changes rounds that were already played.
function amMode(N,courtKey){
  const key=N+"|"+courtKey;if(_modeKey===key)return _mode;
  let mode="greedy";
  if(N%4===0){
    const score=b=>{let rep=0,opp=0,sq=0;for(let x=0;x<N;x++)for(let y=x+1;y<N;y++){if(b.P[x][y]>1)rep+=b.P[x][y]-1;opp=Math.max(opp,b.O[x][y]);sq+=b.O[x][y]*b.O[x][y]}return rep*1e6+opp*1e3+sq};
    if(score(amBuild(N,N-1,"circle"))<score(amBuild(N,N-1,"greedy")))mode="circle";
  }
  _modeKey=key;_mode=mode;return mode
}
function amAllMatches(){
  const N=teamCount(),R=amRounds(),courtKey=[state.settings.start,slotDur(),JSON.stringify(courtsCfg())].join("|");
  const key=N+"|"+R+"|"+courtKey;
  if(_am&&_amKey===key)return _am;
  const {m,rounds,slot,P}=amBuild(N,R,amMode(N,courtKey));
  m.rounds=rounds;m.groupSlots=slot-1;m.autoLast=slot-1;m.totalSlots=slot-1;m.tpl={rounds:[],places:[]};m.warnings=[];
  m.byId=Object.fromEntries(m.map(x=>[x.id,x]));m.slots=rounds.map(r=>r.slot);m.autoSlots=m.slots;m.lastSlot=m.slots[m.slots.length-1]||1;
  m.overCount=m.filter(x=>x.over).length;m.partnerRepeats=P.flat().filter(c=>c>1).length/2;
  _am=m;_amKey=key;return m
}

/* ---------- Scores and leaderboard ---------- */
function amValid(s){if(!s)return false;const a=+s.a,b=+s.b;return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a+b===amPoints()}
function amState(s){if(!s)return "";const a=+s.a,b=+s.b;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a+b>amPoints())return "bad";return a+b===amPoints()?"done":"progress"}
function amTable(){
  const ms=allMatches(),half=amPoints()/2;
  const rows=state.teams.map((_,i)=>({i,pts:0,bonus:0,played:0,w:0,d:0,l:0,pf:0,pa:0,byes:0}));
  ms.rounds.forEach(rd=>{
    let done=true;
    rd.ids.forEach(id=>{
      const m=ms.byId[id],s=score(id);if(!s){done=false;return}
      const add=(side,f,a)=>side.forEach(x=>{const r=rows[x];r.pts+=f;r.pf+=f;r.pa+=a;r.played++;if(f>a)r.w++;else if(f<a)r.l++;else r.d++});
      add(m.pa,s.a,s.b);add(m.pb,s.b,s.a);
    });
    if(done)rd.sit.forEach(x=>{rows[x].bonus+=half;rows[x].byes++});
  });
  rows.forEach(r=>{r.total=r.pts+r.bonus;r.diff=r.pf-r.pa});
  return rows.sort((x,y)=>y.total-x.total||y.w-x.w||y.diff-x.diff||teamName(x.i).localeCompare(teamName(y.i)))
}
function amAllDone(){return allMatches().every(m=>score(m.id))}
function amPlacements(){
  if(!amAllDone())return state.teams.map(()=>({t:null,by:"Decided after the last round"}));
  return amTable().map(r=>({t:r.i,by:fmtPts(r.total)+" points · "+r.w+" won"}))
}

/* ---------- Setup ---------- */
function teamCountOptions(am){const max=am?AM_MAX:MAX_TEAMS;return Array.from({length:max-MIN_TEAMS+1},(_,i)=>`<option value="${i+MIN_TEAMS}">${i+MIN_TEAMS} ${am?"players":"teams"}</option>`).join("")}
function onNewStyle(){
  const am=$("newStyle").value==="americano",cur=+$("newTeams").value||8;
  $("newTeams").innerHTML=teamCountOptions(am);$("newTeams").value=String(Math.min(cur,am?AM_MAX:MAX_TEAMS));
  $("newTeamsLbl").textContent=am?"Number of players":"Number of teams"
}
function setAmPoints(v){
  v=+v;if(!isAdmin()||!AM_POINTS.includes(v)||v===amPoints()){syncInputs();return}
  const has=Object.keys(state.scores).length;
  if(has&&!confirm(`Play to ${v} points? Scores entered so far no longer add up and will be cleared.`)){syncInputs();return}
  state.settings={...state.settings,points:v};if(has)state.scores={};
  save();renderAll();cloudWrite(has?{"settings.points":v,scores:{}}:{"settings.points":v})
}
function setAmRounds(v){
  v=Math.round(+v);if(!isAdmin()||!(v>=1&&v<=30)){syncInputs();toast("Choose between 1 and 30 rounds.");return}
  state.settings={...state.settings,rounds:v};save();renderAll();cloudWrite({"settings.rounds":v});
  toast(`${v} rounds. Earlier rounds stay the same.`)
}
function amDescribe(){
  const N=teamCount(),ms=allMatches(),R=ms.rounds.length,P=amPoints(),k=ms.rounds.length?ms.rounds[0].ids.length:0,sit=N-4*k;
  const ex=Math.ceil(P/2)+2;
  return `${N} players play ${R} round${R>1?"s":""} of Americano on ${k} court${k>1?"s":""} at a time. Every round you get a new partner and new opponents (as far as possible). Each match is played to ${P} points in total, e.g. ${ex}–${P-ex}, and every player keeps the points their side won. ${sit>0?`Each round ${sit} player${sit>1?"s sit":" sits"} out in turn and get${sit>1?"":"s"} ${fmtPts(P/2)} points, the average. `:""}The leaderboard ranks players by total points, then wins. The last round ends around ${fmtMin(slotStart(ms.lastSlot)+slotDur())}.`
}

/* ---------- Schedule screens ---------- */
const amInputHtml=(id,side)=>{const r=rawScore(id),v=r?r[side]:"";return `<input class="score" type="number" inputmode="numeric" min="0" max="${amPoints()}" id="${id}${side}" value="${v}" placeholder="–" oninput="amInput('${id}','${side}')" aria-label="Points">`};
function amSitText(rd){return rd.sit.length?"Sitting out: "+rd.sit.map(i=>esc(teamName(i))).join(", "):""}
function amBuildTable(ms){
  const C=courtsCfg().length,span=3+3*C;
  let h=`<colgroup><col style="width:70px"><col style="width:70px">${Array.from({length:C},()=>`<col><col style="width:40px"><col>`).join("")}<col style="width:170px"></colgroup>`;
  h+=`<thead><tr><th>Round</th><th>Time</th>${Array.from({length:C},(_,i)=>`<th colspan="3"${i?' class="c2"':""}><span class="cname${i+1}"></span></th>`).join("")}<th>Info</th></tr></thead><tbody>`;
  h+=`<tr class="band"><td colspan="${span}">Americano<small>${ms.rounds.length} rounds · matches to ${amPoints()} points</small></td></tr>`;
  ms.rounds.forEach(rd=>{
    const s=rd.slot,cls=rd.round%2?"rowA":"rowB",at=c=>rd.ids.map(id=>ms.byId[id]).find(x=>x.court===c);
    let r1=`<tr class="${cls} first" data-slot="${s}"><td class="slotn" rowspan="2">${rd.round}</td><td class="time" rowspan="2" data-time="${s}"></td>`,r2=`<tr class="${cls}" data-slot="${s}">`;
    for(let c=1;c<=C;c++){
      const m=at(c),sep=c>1?" c2s":"";
      if(!m){r1+=`<td class="emptyc${sep}" colspan="3" rowspan="2">–</td>`;continue}
      r1+=`<td class="tn${sep}"${c>1?' data-c2="1"':""} dir="auto" id="${m.id}-a" data-m="${m.id}"></td><td class="vs" rowspan="2">VS</td><td class="tn" dir="auto" id="${m.id}-b" data-m="${m.id}"></td>`;
      r2+=`<td class="sc${sep}" data-m="${m.id}">${amInputHtml(m.id,"a")}</td><td class="sc" data-m="${m.id}">${amInputHtml(m.id,"b")}</td>`;
    }
    const over=rd.ids.some(id=>ms.byId[id].over);
    r1+=`<td class="stage" rowspan="2"><span class="chip chipA">Round ${rd.round}</span>${rd.sit.length?`<small class="amsit">${amSitText(rd)}</small>`:""}${over?'<small class="overtag">after court hours</small>':""}<span class="latebadge" data-slb="${s}" hidden>⏰ Running late</span></td></tr>`;
    h+=r1+r2+`</tr>`;
  });
  return `<div class="table-wrap" style="overflow:auto"><table class="sched am" id="sched" style="min-width:${Math.max(640,320+C*300)}px">${h}</tbody></table></div>`
}
function amBuildCards(ms){
  const side=(m,k)=>`<div class="mteam"><span class="tn" id="${m.id}-${k}" dir="auto"></span><div class="stepper"><button class="stepbtn" onclick="amBump('${m.id}','${k}',-1)" aria-label="One point less">−</button>${amInputHtml(m.id,k)}<button class="stepbtn" onclick="amBump('${m.id}','${k}',1)" aria-label="One point more">+</button></div></div>`;
  const slides=ms.rounds.map(rd=>`<div class="mslot" data-slot="${rd.slot}" data-label="Round ${rd.round} of ${ms.rounds.length}"><div class="mslot-h"><b class="slot-time" data-time="${rd.slot}"></b><span class="slotno">Round ${rd.round}</span><span class="nowtag">Now</span><span class="nexttag">Next</span><span class="latebadge" data-slb="${rd.slot}" hidden>⏰ Late</span></div>${rd.ids.map(id=>{const m=ms.byId[id];return `<div class="mtile" data-m="${m.id}"><div class="mtile-h"><span class="court cname${m.court}"></span>${m.over?'<small class="overtag">after court hours</small>':""}</div>${side(m,"a")}${side(m,"b")}</div>`}).join("")}${rd.sit.length?`<p class="note amsit-card">${amSitText(rd)}</p>`:""}</div>`).join("");
  return `<div class="mcards">${carouselHtml(slides)}<p class="note" id="filterEmpty" hidden>No matches to show here.</p></div>`
}
function amRefreshSchedule(){
  courtsCfg().forEach((c,i)=>document.querySelectorAll(".cname"+(i+1)).forEach(el=>el.textContent=c.name));
  document.querySelectorAll("[data-time]").forEach(el=>{const s=+el.dataset.time;el.textContent=isPhone()?`${timeFor(s)}–${fmtMin(slotStart(s)+slotDur())}`:timeFor(s)});
  const P=amPoints();
  allMatches().forEach(m=>{
    const s=score(m.id),st=amState(rawScore(m.id));
    [["a",m.pa,s&&s.a>s.b],["b",m.pb,s&&s.b>s.a]].forEach(([k,p,won])=>{
      const el=$(m.id+"-"+k);if(!el)return;
      el.textContent=pairName(p);
      el.className="tn"+(won?" won":"")+(s&&!won&&s.a!==s.b?" lost":"")+(el.dataset.c2?" c2s":"");
      const inp=$(m.id+k);if(inp){inp.max=P;inp.title=`Played to ${P} points`;inp.classList.toggle("bad",st==="bad");inp.classList.toggle("prog",st==="progress")}
    });
  });
  applyLive()
}
// Typing one side fills in the other, so the two always add up to the match total
function amInput(id,side){
  if(!canScore())return;
  const P=amPoints(),el=$(id+side),other=$(id+(side==="a"?"b":"a")),v=el.value;
  if(v!==""&&Number.isInteger(+v)&&+v>=0&&+v<=P)other.value=P-+v;
  onScore(id)
}
function amBump(id,side,d){
  if(!canScore())return;
  const P=amPoints(),a=$(id+"a"),b=$(id+"b");
  if(a.value===""||b.value===""){a.value=Math.ceil(P/2);b.value=P-Math.ceil(P/2)}
  const el=side==="a"?a:b,other=side==="a"?b:a,nv=Math.max(0,Math.min(P,(+el.value||0)+d));
  el.value=nv;other.value=P-nv;onScore(id)
}

/* ---------- Leaderboard ---------- */
function amRenderStandings(){
  const P=amPoints();
  $("legend").innerHTML=`<span class="chip chipF">Ranked by total points, then wins</span>${allMatches().rounds.some(r=>r.sit.length)?`<span class="chip chipA">Sitting out = ${fmtPts(P/2)} points</span>`:""}`;
  const rows=amTable();
  $("standGroups").innerHTML=`<div class="card stand-card am-board"><h3><span class="chip chipA">Leaderboard</span></h3><div class="table-wrap" style="overflow:auto"><table class="standings"><thead><tr><th>#</th><th>Player</th><th class="rw">Points</th><th>Played</th><th>W</th><th>D</th><th>L</th><th>+/−</th><th>Sat out</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${i<3&&r.total>0?"qualified":""}"><td class="rank">${i+1}</td><td dir="auto">${esc(teamName(r.i))}</td><td class="rw">${fmtPts(r.total)}</td><td>${r.played}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="${r.diff>0?"pos":r.diff<0?"neg":""}">${r.diff>0?"+":""}${r.diff}</td><td>${r.byes||"–"}</td></tr>`).join("")}</tbody></table></div></div>`
}

/* ---------- Teams card → Players ---------- */
function amRenderTeams(){
  const box=$("teams");box.classList.add("one");
  box.innerHTML=`<div class="group-box gbA am-players">${state.teams.map((_,i)=>`<div class="team"><div class="team-row"><span class="num">${i+1}</span><input data-team="${i}" value="${esc(teamName(i))}" maxlength="40" aria-label="Player name"></div><div class="tplayers" data-tp="${i}"></div></div>`).join("")}</div>`;
  document.querySelectorAll("[data-team]").forEach(x=>x.oninput=()=>{if(!isAdmin())return;state.teams[+x.dataset.team]=x.value;save();refresh();if($("teamsSum"))$("teamsSum").textContent=teamsSummary();clearTimeout(pending.teams);pending.teams=setTimeout(()=>{pending.teams=null;cloudWrite({teams:[...state.teams]})},600)});
}
function amChangeCount(v){
  v=+v;
  if(!isAdmin()||v===teamCount()||v<MIN_TEAMS||v>AM_MAX){syncInputs();return}
  const has=Object.keys(state.scores).length;
  if(!confirm(`Change to ${v} players? The rounds are rebuilt.${has?" All scores will be cleared.":""}`)){syncInputs();return}
  state.teams=Array.from({length:v},(_,i)=>state.teams[i]||"Player "+(i+1));state.scores={};
  const tp={...(state.teamPlayers||{})};Object.keys(tp).forEach(k=>{if(+k>=v)delete tp[k]});state.teamPlayers=tp;
  save();rebuild();cloudWrite({teams:[...state.teams],scores:{},teamPlayers:tp,playerUids:allPlayerUids()})
}

/* ---------- Sharing and printing ---------- */
function amResultsText(){
  const L=[`🎾 *${tName()}* · Americano`],done=amAllDone(),med=["🥇","🥈","🥉"];
  L.push("",done?"🏆 *Final ranking*":"📊 *Leaderboard so far*");
  amTable().forEach((r,i)=>L.push(`${done?(med[i]||ord(i+1)+"."):(i+1)+"."} ${teamName(r.i)}: ${fmtPts(r.total)} pts (${r.w}W ${r.d}D ${r.l}L)`));
  if(currentTid)L.push("",`Live scores: ${tournamentUrl()}`);
  return L.join("\n")
}
function amPrintSheets(){
  const ms=allMatches(),perHour=Math.max(1,Math.round(60/slotDur())),LAST=ms.lastSlot,C=courtsCfg().length;
  let out="";
  for(let from=1;from<=LAST;from+=perHour){
    const to=Math.min(from+perHour-1,LAST);
    for(let c=1;c<=C;c++){
      let rows="";
      for(let sl=from;sl<=to;sl++){
        const m=ms.find(x=>x.slot===sl&&x.court===c);if(!m)continue;
        const cls=(m.round%2)?"":"alt",r=rawScore(m.id),va=r?r.a:"",vb=r?r.b:"";
        rows+=`<tr class="${cls}"><td class="sn">${m.round}</td><td class="tm" rowspan="2">${timeFor(sl)}<small>Round ${m.round} · to ${amPoints()} points</small></td><td class="nm" dir="auto">${esc(pairName(m.pa))}</td><td class="vs" rowspan="2">VS</td><td class="nm" dir="auto">${esc(pairName(m.pb))}</td></tr>`+
              `<tr class="${cls}"><td class="sl">Points</td><td><span class="pbox">${esc(va)}</span></td><td><span class="pbox">${esc(vb)}</span></td></tr>`;
      }
      if(!rows)continue;
      const cn=esc(courtName(c));
      out+=`<div class="psheet"><h2>${cn}</h2><p class="psub">${timeFor(from)} – ${timeFor(to+1)} · Americano</p><table class="ptable"><colgroup><col style="width:16%"><col style="width:18%"><col style="width:30%"><col style="width:8%"><col style="width:28%"></colgroup><thead><tr><th>Round</th><th>Time</th><th colspan="3">${cn}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  }
  $("printArea").innerHTML=out;window.print()
}

/* ---------- Profile statistics for an Americano tournament (called by profile.js) ---------- */
function amCollectStats(ti,t,acc){
  const who=i=>{const p=playersOf(i)[0];return p?{uid:p.uid||null,name:teamName(i),photoURL:p.photoURL||""}:{name:teamName(i)}};
  allMatches().forEach(m=>{
    const mine=m.pa.includes(ti)?"a":m.pb.includes(ti)?"b":null;if(!mine)return;
    const s=score(m.id);if(!s)return;
    const my=mine==="a"?m.pa:m.pb,their=mine==="a"?m.pb:m.pa,us=s[mine],them=s[mine==="a"?"b":"a"];
    const partner=who(my.find(x=>x!==ti)),opps=their.map(who),won=us>them,draw=us===them;
    acc.matches.push({tid:t.id,tname:t.name||"Tournament",date:state.settings.date||"",time:timeFor(m.slot),slot:m.slot,stage:"Round "+m.round+" · Americano",partner,opp:pairName(their),oppPlayers:opps,us,them,won,draw});
    acc.bump(acc.partners,partner,won);opps.forEach(p=>acc.bump(acc.opponents,p,!won&&!draw));
  });
  const P=amPlacements(),pi=P.findIndex(p=>p.t===ti);
  if(pi>=0)acc.places.push({tid:t.id,tname:t.name||"Tournament",place:pi+1,of:P.length,date:state.settings.date||""});
}

/* ---------- Switching style ---------- */
function amSetStyle(v){
  const s=STYLES.find(x=>x[0]===v);
  if(!isAdmin()||!s||!s[2]){syncInputs();toast("That tournament style is coming soon.");return}
  if(v===(state.style||"groups_ko")){syncInputs();return}
  const toAm=v==="americano",has=Object.keys(state.scores).length;
  if(!confirm(`Switch to ${s[1]}? The schedule is rebuilt${has?" and all scores are cleared":""}.`)){syncInputs();return}
  let teams=[...state.teams];
  if(toAm)teams=teams.map((n,i)=>defaultTeams.includes(n)||/^Team \d+$/.test(n)?"Player "+(i+1):n);
  else{teams=teams.slice(0,MAX_TEAMS).map((n,i)=>/^Player \d+$/.test(n)?defaultTeamName(i):n)}
  const tp={};Object.entries(state.teamPlayers||{}).forEach(([k,l])=>{if(+k<teams.length&&l&&l.length)tp[k]=toAm?l.slice(0,1):l});
  Object.assign(state,{style:v,teams,teamPlayers:tp,scores:{},bestOf:{},moves:{},sfPairing:0});
  save();rebuild();
  cloudWrite({style:v,teams,teamPlayers:tp,playerUids:allPlayerUids(),scores:{},bestOf:{},moves:{},sfPairing:0});
  toast(toAm?"Americano: one name per player. Set points and rounds in Setup.":"Groups + knockout.")
}

/* ---------- Take over the shared functions when the style is Americano ---------- */
(function(){
  const G={allMatches,validScore,scoreState,bestOf,placements,defaultTeamName,renderTeams,describeFormat,renderFormatInfo,setupSummary,
    buildSchedule,refreshSchedule,printSheets,renderStandings,renderBracket,resultsText,changeTeamCount,setStyle,fillStatic};
  allMatches=function(){return isAm()?amAllMatches():G.allMatches()};
  validScore=function(s,id){return isAm()?amValid(s):G.validScore(s,id)};
  scoreState=function(s,id){return isAm()?amState(s):G.scoreState(s,id)};
  bestOf=function(id){return isAm()?amPoints():G.bestOf(id)};
  placements=function(){return isAm()?amPlacements():G.placements()};
  defaultTeamName=function(i){return isAm()?"Player "+(i+1):G.defaultTeamName(i)};
  renderTeams=function(){$("teamsTitle").textContent=isAm()?"Players":"Teams";return isAm()?amRenderTeams():G.renderTeams()};
  describeFormat=function(){return isAm()?amDescribe():G.describeFormat()};
  setupSummary=function(){const t=G.setupSummary();return isAm()?t.replace(/(\d+) teams$/,"$1 players · Americano"):t};
  renderFormatInfo=function(){
    const am=isAm();
    document.body.classList.toggle("is-am",am);document.body.dataset.style=state.style||"groups_ko";
    $("nteams").innerHTML=teamCountOptions(am);$("nteams").value=String(teamCount());
    $("nteamsLbl").textContent=am?"Number of players":"Number of teams";
    $("tabStand").textContent=am?"Leaderboard":"Table";
    if($("ampts")&&!$("ampts").options.length)$("ampts").innerHTML=AM_POINTS.map(p=>`<option value="${p}">${p} points</option>`).join("");
    if(am){
      if(document.querySelector('.tab[data-tab="bracket"].active'))document.querySelector('.tab[data-tab="standings"]').click();
      const C=courtsCfg().length,ms=allMatches();
      $("pills").innerHTML=[`${teamCount()} players`,"Americano",`${C} court${C>1?"s":""}`].map(t=>`<span>${t}</span>`).join("");
      $("formatHelp").textContent=amDescribe();
      if($("setupSum"))$("setupSum").textContent=setupSummary();
      if($("teamsSum"))$("teamsSum").textContent=teamsSummary();
      $("ampts").value=String(amPoints());$("amrounds").value=String(amRounds());
      const w=$("schedWarn");w.hidden=!ms.overCount;
      w.innerHTML=ms.overCount?"⚠ "+esc(`${ms.overCount} match${ms.overCount>1?"es are":" is"} outside the court hours. Add a court, add hours, or play fewer rounds.`):"";
      return
    }
    return G.renderFormatInfo()
  };
  buildSchedule=function(){
    if(!isAm())return G.buildSchedule();
    const ms=allMatches();
    $("schedBox").innerHTML=isPhone()?amBuildCards(ms):amBuildTable(ms);if(isPhone())carStart();
    $("schedTools").innerHTML=`<div class="seg" role="group" aria-label="Show">${[["all","All rounds"],["now","Now & next"],["open","Not played yet"]].map(([f,l])=>`<button class="${schedFilter===f?"on":""}" onclick="setFilter('${f}')">${l}</button>`).join("")}</div><span class="amhint" data-staff>Type one side's points; the other side fills in to make ${amPoints()}.</span>`;
  };
  refreshSchedule=function(){return isAm()?amRefreshSchedule():G.refreshSchedule()};
  printSheets=function(){return isAm()?amPrintSheets():G.printSheets()};
  renderStandings=function(){return isAm()?amRenderStandings():G.renderStandings()};
  renderBracket=function(){if(!isAm())return G.renderBracket()};
  resultsText=function(){return isAm()?amResultsText():G.resultsText()};
  changeTeamCount=function(v){return isAm()?amChangeCount(v):G.changeTeamCount(v)};
  setStyle=function(v){return amSetStyle(v)};
  fillStatic=function(){G.fillStatic();if($("ampts"))$("ampts").innerHTML=AM_POINTS.map(p=>`<option value="${p}">${p} points</option>`).join("")};
  // moving matches is a Groups + knockout tool
  const gMove=moveMatch;moveMatch=function(id,s,c){if(isAm()){toast("In Americano the rounds are fixed; matches can't be moved.");return false}return gMove(id,s,c)};
})();
