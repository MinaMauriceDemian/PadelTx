// Tournament engine: format, groups, schedule, best-of, results and ranking logic (no page layout).
/* ---------- Format: teams, groups, knockout ---------- */
// Tournament styles. Only "groups_ko" is built; the others are placeholders for later.
const STYLES=[["groups_ko","Groups + knockout",true],["americano","Americano",false],["mexicano","Mexicano",false],["single_elim","Single elimination",false],["league","League (round robin only)",false]];
const MIN_TEAMS=4,MAX_TEAMS=16;
const BO_CHOICES=[1,3,5,7,9,11,13,15];
let lastBuiltN=0;
function teamCount(){return state.teams.length}
function defaultTeamName(i){return defaultTeams[i]||("Team "+(i+1))}
function ord(n){const s=n%100>10&&n%100<14?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return n+s}
// 4–5 teams: one group. 6+ teams: Group A gets the extra team when the count is odd.
function groupMembers(){
const n=teamCount();
if(n<=5)return {A:[...Array(n).keys()]};
const a=Math.ceil(n/2);
return {A:[...Array(a).keys()],B:Array.from({length:n-a},(_,i)=>a+i)}
}
function groupLetters(){return Object.keys(groupMembers())}
function groupOfTeam(i){const gm=groupMembers();return Object.keys(gm).find(g=>gm[g].includes(i))}
// Round-robin rounds (local indices inside a group). 4-team groups keep the original fixed order.
const ROUNDS4={A:[[[0,1],[2,3]],[[0,3],[1,2]],[[0,2],[3,1]]],B:[[[0,1],[3,2]],[[0,2],[1,3]],[[0,3],[2,1]]]};
function rrRounds(size,g){
if(size===4)return ROUNDS4[g];
let t=[...Array(size).keys()];if(size%2)t.push(null);
const n=t.length,out=[];
for(let r=0;r<n-1;r++){
  const p=[];
  for(let i=0;i<n/2;i++){const a=t[i],b=t[n-1-i];if(a!=null&&b!=null)p.push(r%2?[b,a]:[a,b])}
  out.push(p);t=[t[0],t[n-1],...t.slice(1,n-1)]
}
return out
}
// Semi-final pairing choices (8 teams only): 1st of each group + the two quarter-final winners
const SF_PAIRINGS=[[["1A","W:qf1"],["1B","W:qf2"]],[["1A","1B"],["W:qf1","W:qf2"]],[["1A","W:qf2"],["1B","W:qf1"]]];
// Knockout per team count. References: "2A" = 2nd of Group A, "W:qf1" = winner of qf1, "L:sf1" = loser of sf1.
// places = how places 1, 2, 3… are decided; teams not covered are ranked by group position from restFrom.
function koTemplate(){
const n=teamCount();
const base=[["w","final"],["l","final"],["w","third"],["l","third"]];
const finals=[["final","W:sf1","W:sf2"],["third","L:sf1","L:sf2"]];
if(n<=5)return {rounds:[[["final","1A","2A"],["third","3A","4A"]]],places:base,restFrom:5};
if(n<=7)return {rounds:[[["sf1","1A","2B"],["sf2","1B","2A"]],finals,[["p5","3A","3B"]]],places:[...base,["w","p5"],["l","p5"]],restFrom:4};
if(n===8){
  const pr=SF_PAIRINGS[state.sfPairing||0]||SF_PAIRINGS[0];
  return {sfPicker:true,rounds:[[["qf1","2A","3B"],["qf2","2B","3A"]],[["sf1",...pr[0]],["sf2",...pr[1]]],finals,[["p7","4A","4B"]]],places:[...base,["pool",["qf1","qf2"]],["w","p7"],["l","p7"]],restFrom:5}
}
return {rounds:[[["qf1","1A","4B"],["qf2","2B","3A"],["qf3","1B","4A"],["qf4","2A","3B"]],[["sf1","W:qf1","W:qf2"],["sf2","W:qf3","W:qf4"]],finals],places:[...base,["pool",["qf1","qf2","qf3","qf4"]]],restFrom:5}
}
function koKind(id){return /^g/.test(id)?"group":/^qf/.test(id)?"qf":/^sf/.test(id)?"sf":id==="final"?"final":id==="third"?"third":"place"}
function stageGroup(id){const k=koKind(id);return k==="third"?"place":k}
function placeNo(id){return +(/^p(\d+)$/.exec(id)||[])[1]}
function koTitle(id){const k=koKind(id),n=(/\d+$/.exec(id)||[""])[0];return k==="qf"?"Quarter-final "+n:k==="sf"?"Semi-final "+n:k==="final"?"Final":k==="third"?"3rd place match":ord(placeNo(id))+" place match"}
function koStage(id){const k=koKind(id);return k==="qf"?"Quarter-finals":k==="sf"?"Semi-finals":koTitle(id)}
function koLower(id){const k=koKind(id);return k==="qf"?"quarter-final":k==="sf"?"semi-final":k==="final"?"final":k==="third"?"3rd-place match":ord(placeNo(id))+"-place match"}
/* ---------- Courts and time ---------- */
const MAX_COURTS=8;
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||"");return m?+m[1]*60+ +m[2]:null};
const fmtMin=v=>String(Math.floor(v/60)%24).padStart(2,"0")+":"+String(v%60).padStart(2,"0");
// Courts: [{name, from:"HH:MM" ("" = tournament start), hours (0 = until the end)}]. Older tournaments only have court1/court2.
function courtsCfg(){
const s=state.settings,raw=Array.isArray(s.courts)&&s.courts.length?s.courts:[{name:s.court1||"Court 1"},{name:s.court2||"Court 2"}];
return raw.slice(0,MAX_COURTS).map((x,i)=>({name:String((x&&x.name)||("Court "+(i+1))),from:(x&&toMin(x.from)!=null)?x.from:"",hours:Math.max(0,+(x&&x.hours)||0)}))
}
function courtName(c){const cs=courtsCfg();return cs[c-1]?cs[c-1].name:"Court "+c}
function slotDur(){return Math.max(5,+state.settings.duration||20)}
function slotStart(slot){return (toMin(state.settings.start)??720)+(slot-1)*slotDur()}
function timeFor(slot){return fmtMin(slotStart(slot))}
function courtWindows(){const st=toMin(state.settings.start)??720;return courtsCfg().map(c=>{const from=toMin(c.from)??st;return {from,to:c.hours?from+Math.round(c.hours*60):Infinity}})}
// Courts free for the whole of a slot. After every court has closed, all courts are used and the matches are flagged "after hours".
function courtsAt(slot){
const w=courtWindows(),a=slotStart(slot),b=a+slotDur();
const free=w.map((x,i)=>x.from<=a&&b<=x.to?i:-1).filter(i=>i>=0);
if(free.length)return {list:free,over:false};
if(w.every(x=>x.to<b&&x.to!==Infinity)&&w.every(x=>x.from<=a||x.to<=a))return {list:w.map((_,i)=>i),over:true};
return {list:[],over:false}
}
// All matches with slot + court. Group matches fill the free courts of each slot (a team never plays twice in one slot);
// each knockout round starts after the previous one.
let _mc=null,_mk="";
function allMatches(){
const key=[teamCount(),state.sfPairing||0,state.settings.start,slotDur(),JSON.stringify(courtsCfg())].join("|");
if(_mc&&_mk===key)return _mc;
const gm=groupMembers(),gl=Object.keys(gm),rr={},cnt={};
gl.forEach(g=>{rr[g]=rrRounds(gm[g].length,g);cnt[g]=0});
const queue=[],maxR=Math.max(...gl.map(g=>rr[g].length));
for(let r=0;r<maxR;r++)gl.forEach(g=>(rr[g][r]||[]).forEach(p=>queue.push({id:`g${g}${cnt[g]++}`,stage:"Group stage "+g,group:g,a:gm[g][p[0]],b:gm[g][p[1]]})));
const m=[];let slot=1;
const nextCourts=()=>{for(let g=0;g<2000;g++){const c=courtsAt(slot);if(c.list.length)return c;slot++}return {list:[0],over:true}};
while(queue.length){
  const cs=nextCourts(),used=new Set(),pick=[];
  for(let i=0;i<queue.length&&pick.length<cs.list.length;i++){const x=queue[i];if(used.has(x.a)||used.has(x.b))continue;used.add(x.a);used.add(x.b);pick.push(i)}
  const items=pick.map(i=>queue[i]);
  for(let j=pick.length-1;j>=0;j--)queue.splice(pick[j],1);
  items.forEach((x,k)=>m.push({...x,slot,court:cs.list[k]+1,over:cs.over}));
  slot++
}
const groupSlots=slot-1,tpl=koTemplate();
tpl.rounds.forEach(round=>{
  const rest=[...round];
  while(rest.length){const cs=nextCourts();rest.splice(0,cs.list.length).forEach(([id,sa,sb],k)=>m.push({id,slot,court:cs.list[k]+1,over:cs.over,stage:koStage(id),ko:true,sourceA:sa,sourceB:sb}));slot++}
});
m.groupSlots=groupSlots;m.lastSlot=slot-1;m.tpl=tpl;m.byId=Object.fromEntries(m.map(x=>[x.id,x]));
m.slots=[...new Set(m.map(x=>x.slot))].sort((a,b)=>a-b);
m.overCount=m.filter(x=>x.over).length;
_mc=m;_mk=key;return m
}

/* ---------- Match length (best of) ---------- */
const DEF_BO={qf:9,sf:9,final:11};
function defaultBestOf(id){return DEF_BO[koKind(id)]||7}
function bestOf(id){const v=+((state.bestOf||{})[id]);return BO_CHOICES.includes(v)?v:defaultBestOf(id)}
function winRounds(id){return Math.ceil(bestOf(id)/2)}
const boOptions=()=>BO_CHOICES.map(n=>`<option value="${n}">Best of ${n}</option>`).join("");
function setBestOf(id,v){
if(!isAdmin()){refresh();return}
v=+v;if(!BO_CHOICES.includes(v))return;
state.bestOf={...(state.bestOf||{}),[id]:v};save();refresh();cloudWrite({["bestOf."+id]:v})
}
function setStageBestOf(kind,v){
v=+v;if(!isAdmin()||!BO_CHOICES.includes(v))return;
const u={};state.bestOf={...(state.bestOf||{})};
allMatches().filter(m=>stageGroup(m.id)===kind).forEach(m=>{state.bestOf[m.id]=v;u["bestOf."+m.id]=v});
save();refresh();cloudWrite(u);toast("All "+kind.replace("qf","quarter-final").replace("sf","semi-final").replace("place","placement")+" matches set to best of "+v+".")
}

/* ---------- Results logic ---------- */
function setSF(v){
if(!isAdmin()){refresh();return}
if(Object.keys(state.scores).some(k=>["sf1","sf2","final","third"].includes(k))&&!confirm("Changing the semi-final pairings clears the semi-final, 3rd-place and final scores. Continue?")){refresh();return}
delete state.scores.sf1;delete state.scores.sf2;delete state.scores.final;delete state.scores.third;
state.sfPairing=+v;save();renderAll();cloudWrite({sfPairing:+v,"scores.sf1":DEL,"scores.sf2":DEL,"scores.final":DEL,"scores.third":DEL})
}
function refLabel(ref){const t=resolve(ref);return t!=null?teamName(t):phText(ref)}
function renderSFPicker(){
const sel=$("sfSel");if(!sel)return;
sel.innerHTML=SF_PAIRINGS.map((pr,i)=>{
  const txt=pr.map(([a,b])=>{
    const ta=resolve(a),tb=resolve(b),warn=ta!=null&&tb!=null&&groupOfTeam(ta)===groupOfTeam(tb);
    return refLabel(a)+" vs "+refLabel(b)+(warn?" ⚠ same group":"")
  }).join("   |   ");
  return `<option value="${i}">${esc((i+1)+". "+txt)}</option>`
}).join("");
sel.value=String(state.sfPairing||0)
}
function validScore(s,id){if(!s)return false;const a=+s.a,b=+s.b;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0)return false;return a!==b&&Math.max(a,b)>=winRounds(id)&&a+b<=bestOf(id)}
function rawScore(id){return state.scores[id]||null}
// "done" = finished, "progress" = still being played (a live score), "bad" = impossible for this match length
function scoreState(s,id){
if(!s)return "";const a=+s.a,b=+s.b,bo=bestOf(id),w=winRounds(id);
if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a+b>bo||(a>=w&&b>=w))return "bad";
return validScore(s,id)?"done":"progress"
}
function score(id){const s=state.scores[id];return validScore(s,id)?{a:+s.a,b:+s.b}:null}
function groupDone(g){return allMatches().filter(x=>x.group===g).every(x=>score(x.id))}
function getStand(group){
const ids=groupMembers()[group]||[],st=ids.map(i=>({i,p:0,w:0,l:0,pf:0,pa:0,pts:0}));
for(const m of allMatches().filter(x=>x.group===group)){const s=score(m.id);if(!s)continue;const A=st.find(x=>x.i===m.a),B=st.find(x=>x.i===m.b);A.p++;B.p++;A.pf+=s.a;A.pa+=s.b;B.pf+=s.b;B.pa+=s.a;if(s.a>s.b){A.w++;B.l++;A.pts+=3}else{B.w++;A.l++;B.pts+=3}}
st.forEach(x=>x.diff=x.pf-x.pa);st.sort((x,y)=>y.pts-x.pts||y.diff-x.diff||y.pf-x.pf||teamName(x.i).localeCompare(teamName(y.i)));
return st
}
function statsAll(){const o={};groupLetters().forEach(g=>getStand(g).forEach(x=>o[x.i]=x));return o}
const cmpStats=st=>(x,y)=>st[y].pts-st[x].pts||st[y].pf-st[x].pf||st[y].diff-st[x].diff||teamName(x).localeCompare(teamName(y));
// "2A" resolves only once Group A has finished all its matches
function rankRef(ref){const mm=/^(\d+)([A-Z])$/.exec(ref);if(!mm||!groupMembers()[mm[2]]||!groupDone(mm[2]))return null;const x=getStand(mm[2])[+mm[1]-1];return x?x.i:null}
function winner(id){const s=score(id);if(!s)return null;return s.a>s.b?matchTeam(id,"a"):matchTeam(id,"b")}
function loser(id){const w=winner(id);if(w==null)return null;const A=matchTeam(id,"a"),B=matchTeam(id,"b");return w===A?B:A}
function matchTeam(id,side){const m=allMatches().byId[id];if(!m)return null;if(m[side]!=null)return m[side];return resolve(side==="a"?m.sourceA:m.sourceB)}
function resolve(ref){
if(!ref)return null;
if(ref.startsWith("W:"))return winner(ref.slice(2));
if(ref.startsWith("L:"))return loser(ref.slice(2));
return rankRef(ref)
}
function phText(ref){
if(!ref)return "TBD";
const mm=/^(\d+)([A-Z])$/.exec(ref);if(mm)return ord(+mm[1])+" "+mm[2];
const id=ref.slice(2),short=koKind(id)==="qf"||koKind(id)==="sf"?id.toUpperCase():koTitle(id);
return (ref[0]==="W"?"Winner ":"Loser ")+short
}
function teamName(i){return state.teams[i]||("Team "+(i+1))}
// Which knockout match each group position leads to, e.g. {1:"sf", 2:"qf", 4:"place"}
function qualMap(){
const res={};
allMatches().filter(x=>x.ko).forEach(x=>[x.sourceA,x.sourceB].forEach(r=>{const mm=/^(\d+)[A-Z]$/.exec(r||"");if(mm&&!res[+mm[1]])res[+mm[1]]=x.id}));
return res
}
// Final ranking: one entry per place, {t: team index or null, by: explanation}
function placements(){
const tpl=allMatches().tpl,out=[],done=groupLetters().every(groupDone);
tpl.places.forEach(([type,arg])=>{
  if(type==="w")out.push({t:winner(arg),by:"Winner of the "+koLower(arg)});
  else if(type==="l")out.push({t:loser(arg),by:"Loser of the "+koLower(arg)});
  else{
    const ls=arg.map(loser),ok=done&&ls.every(x=>x!=null),sorted=ok?[...ls].sort(cmpStats(statsAll())):[];
    arg.forEach((_,i)=>out.push({t:ok?sorted[i]:null,by:"Quarter-final losers, ranked by group-stage points, then rounds won"}))
  }
});
const restN=teamCount()-out.length;
if(restN>0){
  let rest=[];
  if(done){const st=statsAll();for(let pos=tpl.restFrom;;pos++){const tier=groupLetters().map(g=>getStand(g)[pos-1]).filter(Boolean).map(x=>x.i);if(!tier.length)break;rest.push(...tier.sort(cmpStats(st)))}}
  for(let i=0;i<restN;i++)out.push({t:rest[i]??null,by:"Not in the knockout: ranked by group position, then points and rounds won"})
}
return out
}
