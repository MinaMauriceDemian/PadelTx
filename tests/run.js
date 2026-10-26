// Automated tests for Padel Tour. Run with:  npm install  then  npm test
// The app is loaded into a simulated browser (jsdom) in Local mode, so no Firebase connection is needed.
const {JSDOM}=require("jsdom");
const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..");
// Script files in the same order as index.html (the Firebase module is skipped)
const SCRIPTS=[...fs.readFileSync(path.join(ROOT,"index.html"),"utf8").matchAll(/<script src="js\/([\w-]+)\.js"><\/script>/g)].map(m=>m[1]);

function loadApp({phone=false}={}){
  const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
  const errors=[];
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://padeltx.netlify.app/",beforeParse(w){
    w.addEventListener("error",e=>errors.push(e.message));
    w.confirm=()=>true;w.print=()=>{};w.scrollTo=()=>{};w.opened=[];w.open=u=>{w.opened.push(u)};
    w.matchMedia=()=>({matches:phone,addEventListener(){}});
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  }});
  const w=dom.window,doc=w.document;
  // Same order as index.html; inline <script> tags share globals exactly like the real page
  for(const s of SCRIPTS){
    let code=fs.readFileSync(path.join(ROOT,"js",s+".js"),"utf8");
    if(s==="config")code+="\nwindow.CLOUD_ON=false;"; // always test in Local mode
    const el=doc.createElement("script");el.textContent=code;doc.body.appendChild(el);
  }
  return {w,E:s=>w.eval(s),errors,doc};
}

let failed=0,passed=0;
function check(cond,msg){if(cond)passed++;else{failed++;console.log("  ✗ "+msg)}}
function section(name,fn){console.log("• "+name);try{fn()}catch(e){failed++;console.log("  ✗ crashed: "+e.stack.split("\n").slice(0,3).join(" | "))}}
// Plays every match: group stage with varied valid scores, then knockout matches as soon as both teams are known
function playAll(E){
  const ms=E("allMatches()");let k=0;
  ms.filter(m=>m.group).forEach(m=>{const l=(k++*3)%4;E(`state.scores["${m.id}"]={a:${k%2?4:l},b:${k%2?l:4}}`)});
  for(let g=0;g<10;g++){E("refresh()");ms.filter(m=>m.ko).forEach(m=>{if(E(`score("${m.id}")`))return;if(E(`matchTeam("${m.id}","a")`)!=null&&E(`matchTeam("${m.id}","b")`)!=null)E(`state.scores["${m.id}"]={a:winRounds("${m.id}"),b:1}`)})}
  E("refresh()");
}
const setTeams=(E,n)=>E(`state.teams=Array.from({length:${n}},(_,i)=>"T"+i);state.scores={};state.bestOf={};state.sfPairing=0;rebuild()`);

section("Page loads with the Padel Tour name",()=>{
  const {doc,errors}=loadApp();
  check(doc.title==="Padel Tour","title is Padel Tour");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});

section("8 teams keep the original schedule (existing tournaments are unchanged)",()=>{
  const {E}=loadApp();const ms=E("allMatches()");
  [["gA0",1,1,0,1],["gA1",1,2,2,3],["gB0",2,1,4,5],["gB1",2,2,7,6],["gA2",3,1,0,3],["gA5",5,2,3,1],["gB5",6,2,6,5]]
    .forEach(([id,s,c,a,b])=>{const m=ms.byId[id];check(m&&m.slot===s&&m.court===c&&m.a===a&&m.b===b,"group match "+id)});
  [["qf1",7,1],["qf2",7,2],["sf1",8,1],["sf2",8,2],["final",9,1],["third",9,2],["p7",10,1]]
    .forEach(([id,s,c])=>check(ms.byId[id].slot===s&&ms.byId[id].court===c,"knockout match "+id));
});

section("Every team count from 4 to 16 plays through to a complete final ranking",()=>{
  const {E,doc}=loadApp();
  for(let n=4;n<=16;n++){
    setTeams(E,n);const ms=E("allMatches()");
    const bySlot={};ms.filter(m=>m.group).forEach(m=>(bySlot[m.slot]=bySlot[m.slot]||[]).push(m));
    check(Object.values(bySlot).every(a=>{const t=a.flatMap(m=>[m.a,m.b]);return new Set(t).size===t.length}),`${n} teams: nobody plays twice in a slot`);
    const gm=E("groupMembers()"),need=Object.values(gm).reduce((s,g)=>s+g.length*(g.length-1)/2,0);
    const pairs=new Set(ms.filter(m=>m.group).map(m=>[m.a,m.b].sort((x,y)=>x-y).join("-")));
    check(pairs.size===need,`${n} teams: complete round robin`);
    playAll(E);
    const t=E("placements()").map(p=>p.t);
    check(t.length===n&&t.every(x=>x!=null)&&new Set(t).size===n,`${n} teams: ranking complete`);
    check(doc.querySelectorAll("#rankBody tr").length===n,`${n} teams: ranking rows`);
  }
});

section("Best of: per match and per stage",()=>{
  const {E,doc}=loadApp();setTeams(E,8);
  E('setBestOf("gA0",3);state.scores.gA0={a:2,b:0};refresh()');
  check(E('score("gA0")')!==null,"best of 3 accepts 2–0");
  check(doc.querySelector('[data-bo="gA0"]').value==="3","selector shows best of 3");
  E('setStageBestOf("group",5)');
  check(E('bestOf("gB3")')===5,"whole group stage set to best of 5");
  check(E('score("gA0")')===null,"2–0 no longer a finished match in best of 5");
  check(E('scoreState({a:2,b:0},"gA0")')==="progress","2–0 counts as still being played");
  check(E('scoreState({a:4,b:3},"gA0")')==="bad","4–3 is impossible in best of 5");
});

section("Team count can be changed in Setup",()=>{
  const {E}=loadApp();E("changeTeamCount(10)");
  check(E("teamCount()")===10,"10 teams");
  check(Object.keys(E("state.scores")).length===0,"scores cleared");
});

section("Courts: number of courts and hours per court",()=>{
  const {E,doc}=loadApp();setTeams(E,8);
  E('state.settings={start:"12:00",duration:20,courts:[{name:"A"},{name:"B"},{name:"C"}]};renderAll()');
  let ms=E("allMatches()");
  check(ms.groupSlots<6,"3 courts finish the group stage sooner ("+ms.groupSlots+" slots)");
  check(ms.some(m=>m.court===3),"court 3 is used");
  check(doc.querySelectorAll("#sched thead th").length===6,"table has a column per court (slot, time, 3 courts, stage)");
  E('state.settings={start:"12:00",duration:20,courts:[{name:"A"},{name:"B",from:"",hours:1}]};renderAll()');
  ms=E("allMatches()");
  check(ms.filter(m=>m.court===2).every(m=>m.slot<=3),"court 2 only used in its first hour");
  check(ms.overCount===0,"nothing after hours while court 1 is open all day");
  E('state.settings={start:"12:00",duration:20,courts:[{name:"A"},{name:"B",from:"13:00"}]};renderAll()');
  ms=E("allMatches()");
  check(ms.filter(m=>m.slot<=3).every(m=>m.court===1),"court 2 not used before 13:00");
  E('state.settings={start:"12:00",duration:20,courts:[{name:"A",hours:1},{name:"B",hours:1}]};renderAll()');
  ms=E("allMatches()");
  check(ms.overCount>0,"matches that don't fit are flagged as after court hours");
  check(!doc.getElementById("schedWarn").hidden,"warning shown");
  E('state.settings={start:"12:00",duration:20,court1:"Center",court2:"Side"};renderAll()');
  check(E("courtName(1)")==="Center"&&E("courtName(2)")==="Side","older tournaments keep their court names");
});

section("Phone view: match cards and +/− buttons",()=>{
  const {E,doc,errors}=loadApp({phone:true});setTeams(E,8);
  check(doc.querySelectorAll(".mslot").length===12,"one card per slot, plus 2 extra-time slots");
  check(!doc.getElementById("sched"),"no wide table on phones");
  E('bump("gA0","a",1)');
  check(JSON.stringify(E("state.scores.gA0"))==='{"a":1,"b":0}',"+ starts a live score at 1–0");
  check(doc.getElementById("gA0a").classList.contains("prog"),"shown as still being played");
  for(let i=0;i<3;i++)E('bump("gA0","a",1)');
  check(E('score("gA0")')!==null&&doc.getElementById("gA0-a").classList.contains("won"),"4–0 finishes the match");
  E('bump("gA0","a",-1)');
  check(E("state.scores.gA0.a")===3,"− takes a round away");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});

section("Live “now” marker and late matches",()=>{
  const {E,doc}=loadApp();setTeams(E,8);
  const now=new Date(),nm=now.getHours()*60+now.getMinutes();
  if(nm<30||nm>22*60){console.log("  (skipped: too close to midnight)");return}
  const start=nm-25,hh=String(Math.floor(start/60)).padStart(2,"0"),mm=String(start%60).padStart(2,"0");
  E(`state.settings={start:"${hh}:${mm}",duration:20,date:todayStr(),courts:[{name:"A"},{name:"B"}]};renderAll()`);
  const L=E("liveInfo()");
  check(L&&L.cur===2,"slot 2 is now");
  check(L&&L.late.size===2,"both slot 1 matches are late");
  check(doc.querySelector('#schedBox tr.now[data-slot="2"]')!==null,"slot 2 highlighted");
  check(doc.getElementById("gA0-a").classList.contains("late"),"late match highlighted");
  check(/Now: slot 2/.test(doc.getElementById("liveBar").textContent),"live bar says slot 2");
  E('setFilter("now")');
  const shown=[...doc.querySelectorAll("#schedBox tr[data-slot]")].filter(r=>!r.hidden).map(r=>+r.dataset.slot);
  check(new Set(shown).size===3&&shown.every(s=>s<=3),"Now & next shows the late, current and next slots");
  E('state.settings.date="2000-01-01";refresh()');
  check(E("liveInfo()")===null,"no live marker on other days");
});

section("WhatsApp sharing",()=>{
  const {E,w}=loadApp();setTeams(E,8);
  check(/Standings so far/.test(E("resultsText()")),"before the end: standings");
  playAll(E);
  const txt=E("resultsText()");
  check(/Final ranking/.test(txt)&&txt.includes("🥇"),"after the final: final ranking with medals");
  E('waShare("results")');
  check(w.opened[0]&&w.opened[0].startsWith("https://wa.me/?text="),"opens WhatsApp with the message");
});

section("Printing court sheets",()=>{
  const {E,doc}=loadApp();setTeams(E,8);
  E('state.settings={start:"12:00",duration:20,courts:[{name:"A"},{name:"B"},{name:"C"}]};renderAll();printSheets()');
  check(doc.querySelectorAll(".psheet").length>=3,"sheets for all three courts");
});

section("Moving matches into extra time (admin)",()=>{
  const {E,doc,errors}=loadApp();setTeams(E,8);
  let ms=E("allMatches()");
  check(ms.autoLast===10&&ms.totalSlots===12,"2 extra-time slots after slot 10");
  check(doc.querySelectorAll('.dropcell[data-drop-slot="11"]').length===2,"extra-time slots have free courts to drop on");
  E('state.scores.gA0={a:4,b:1}');
  check(E('moveMatch("gA0",11,1)')===true,"move a group match to slot 11");
  ms=E("allMatches()");
  check(ms.byId.gA0.slot===11&&ms.byId.gA0.court===1&&ms.byId.gA0.moved,"match is now in slot 11, court 1");
  check(E('score("gA0")')!==null,"the score stays with the match");
  check(doc.querySelector('.dropcell[data-drop-slot="1"][data-drop-court="1"]')!==null,"its old place is free");
  check(E('moveMatch("gA1",11,1)')===false,"can't drop onto a taken court");
  check(E("allMatches()").warnings.some(w=>/Quarter-final/.test(w)),"warns: quarter-final now before Group A finishes");
  E('resetMove("gA0")');
  check(E("allMatches()").byId.gA0.slot===1&&!E("state.moves.gA0"),"undo puts it back");
  E('moveMatch("gA0",11,1);moveMatch("gA2",11,2)');
  check(E("allMatches()").warnings.some(w=>/two matches in slot 11/.test(w)),"warns when a team plays twice in one slot");
  E('moveMatch("final",12,1)');
  check(E("allMatches()").byId.final.slot===12,"final moved to the last extra-time slot");
  E('addSpare(1)');check(E("allMatches()").totalSlots===13,"admin can add an extra-time slot");
  E('addSpare(-1);addSpare(-1)');check(E("allMatches()").totalSlots===12,"can't remove a slot that still has a match");
  E('openMove("gB0")');
  check(doc.getElementById("moveDlg").open&&/extra time/.test(doc.getElementById("moveTo").textContent),"Move dialog lists free extra-time courts");
  E('$("moveTo").value="13:1"');
  E('addSpare(1);openMove("gB0");$("moveTo").value="13:1";confirmMove()');
  check(E("allMatches()").byId.gB0.slot===13,"Move dialog moves the match");
  E('role="editor";applyRole()');
  check(E('moveMatch("gB1",13,2)')===false,"editors can't move matches");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});

section("Home page first; sign in is optional; the wordmark goes home",()=>{
  const {E,doc,errors}=loadApp();
  const vis=id=>!doc.getElementById(id).hidden;
  E(`window.CLOUD_ON=true;window.__cloud={listPublic:async()=>({ok:true,list:[]}),listMine:async()=>({ok:true,list:[{id:"AAA1111",name:"Mine",role:"admin",teams:8}]}),open:async()=>({ok:true}),leave(){}};window.__auth={signOut:async()=>{}};showView("landing");renderLanding()`);
  check(vis("landing")&&!vis("loginView"),"starts on the home page, signed out");
  check(vis("heroSignIn")&&!vis("heroSignOut"),"home shows a Sign in button");
  E('toLogin()');check(vis("loginView"),"Sign in opens the login page");
  E('brandHome()');check(vis("landing")&&!vis("loginView"),"wordmark on the login page goes home");
  E('toLogin();continueAsViewer()');check(vis("landing"),"Back to home works");
  E('toLogin();window.__authState({email:"a@b.c",uid:"u1"})');
  check(vis("landing"),"after signing in you land on the home page");
  check(!vis("heroSignIn")&&vis("heroSignOut")&&vis("lIn"),"home shows My tournaments and Sign out when signed in");
  E('window.__cloudReady()');check(vis("landing")&&E("currentTid")===null,"no tournament opens by itself");
  E('currentTid="AAA1111";showView("app");brandHome()');
  check(vis("landing")&&E("currentTid")===null,"wordmark in a tournament goes home");
  E('showView("market");brandHome()');check(vis("landing"),"wordmark in the marketplace goes home");
  E('window.__authState(null)');check(vis("landing")&&vis("heroSignIn"),"signing out keeps you on the home page as a viewer");
  check(doc.querySelectorAll("a.brandlink").length===5,"every header's wordmark is a home link");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});

section("Players on teams",()=>{
  const {E,errors}=loadApp();setTeams(E,8);
  E('addPlayerToTeam(0,{uid:"u1",name:"Mina"});addPlayerToTeam(0,{name:"Omar"})');
  check(E("playersOf(0).length")===2,"two players on a team");
  check(E('addPlayerToTeam(0,{name:"Third"})')===false,"no third player");
  check(E('addPlayerToTeam(1,{uid:"u1",name:"Mina"})')===false,"same profile can't be in two teams");
  check(JSON.stringify(E("allPlayerUids()"))==='["u1"]',"profile ids are collected for look-ups");
  check(document_text(E,"[data-tp=\"0\"]").includes("Mina")&&document_text(E,"[data-tp=\"0\"]").includes("guest"),"players show under the team");
  E('removePlayer(0,1)');check(E("playersOf(0).length")===1,"remove a player");
  E('addPlayerToTeam(7,{name:"Last"});changeTeamCount(6)');
  check(!E("state.teamPlayers[7]")&&E("playersOf(0).length")===1,"fewer teams drops players of removed teams only");
  E('role="viewer";applyRole()');check(!document_text(E,"[data-tp=\"0\"]").includes("+ Player"),"viewers can't add players");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});
function document_text(E,sel){return E(`(document.querySelector('${sel}')||{}).textContent||""`)}

async function profileTests(){
  console.log("• Player profile");
  try{
    const {E,doc,errors,w}=loadApp();
    // a finished 8-team tournament where u1 (with partner u2) plays for team 0
    E(`state.teams=Array.from({length:8},(_,i)=>"T"+i);state.scores={};rebuild()`);
    E(`(function(){const ms=allMatches();let k=0;ms.filter(m=>m.group).forEach(m=>{state.scores[m.id]=(m.a===0||m.b===0)?(m.a===0?{a:4,b:1}:{a:1,b:4}):{a:4,b:k++%4}});
      for(let g=0;g<6;g++){ms.filter(m=>m.ko).forEach(m=>{if(score(m.id))return;const A=matchTeam(m.id,"a"),B=matchTeam(m.id,"b");if(A!=null&&B!=null)state.scores[m.id]=A===0?{a:winRounds(m.id),b:2}:B===0?{a:2,b:winRounds(m.id)}:{a:winRounds(m.id),b:0}})}})()`);
    const T=JSON.parse(E(`JSON.stringify({id:"TOUR1",name:"Autumn Cup",teams:state.teams,scores:state.scores,settings:{...state.settings,date:"2026-10-25",venue:"Padel Club Stuttgart"},teamPlayers:{"0":[{uid:"u1",name:"Mina"},{uid:"u2",name:"Omar"}],"4":[{uid:"u3",name:"Sara"},{name:"Guest Ali"}]},playerUids:["u1","u2","u3"]})`));
    const before=E("JSON.stringify(state.scores)");
    const S=E(`computePlayerStats("u1",${JSON.stringify([T])})`);
    check(E("JSON.stringify(state.scores)")===before,"looking at another tournament doesn't touch the open one");
    check(S.played>0&&S.won===S.played&&S.rate===100,"matches and win rate counted ("+S.played+" played)");
    check(S.titles===1&&S.podiums===1&&S.tournaments===1,"title and podium counted");
    check(S.partners[0]&&S.partners[0].name==="Omar"&&S.partners[0].n===S.played,"partner counted on every match");
    check(S.clubs[0]&&S.clubs[0].name==="Padel Club Stuttgart","venue listed under clubs");
    const profile={displayName:"Mina Morise",city:"Stuttgart",homeClub:"Padel Club Stuttgart",level:3.25,levelHistory:[{level:2.9,at:1750000000000},{level:3.1,at:1755000000000},{level:3.25,at:1760000000000}],hand:"right",side:"left",matchType:"competitive",days:["sat","sun"],times:["morning"],whatsapp:"491701234567",about:"",visibility:"public",createdAt:1}
    let saved=null;
    w.__cloud={getProfile:async uid=>uid==="u1"?{ok:true,profile:{uid:"u1",...profile}}:uid==="priv"?{ok:true,profile:null,private:true}:{ok:true,profile:null},
      tournamentsOfPlayer:async()=>({ok:true,list:[T]}),saveProfile:async d=>{saved=d;return {ok:true}},listPublicProfiles:async()=>({ok:true,list:[]}),leave(){}};
    E('window.CLOUD_ON=true;authUser={uid:"u1",email:"m@x.de",displayName:"Mina",photoURL:""}');
    await E('showProfile("u1")');
    const body=doc.getElementById("profileBody").textContent;
    check(!doc.getElementById("profileView").hidden,"profile page opens");
    ["Level","Level progression","Matches","Statistics","Player preferences","Players I play most with","Clubs"].forEach(s=>check([...doc.querySelectorAll("#profileBody h2")].some(h=>h.textContent===s),"section: "+s));
    check(body.includes("3.25")&&body.includes("Intermediate")&&/Self-reported/.test(body),"level with band and self-reported label");
    check(!/playtomic/i.test(doc.body.innerHTML+[...doc.scripts].map(s=>s.textContent).join("")),"no mention of other apps anywhere");
    E('toggleGuide(document.querySelector("#profileBody .infobtn"),"lvGuide")');
    check(!doc.getElementById("lvGuide").hidden&&doc.querySelectorAll("#lvGuide li").length===7,"level guide opens with all 7 levels");
    check(doc.querySelector("#lvGuide li.on")&&/Intermediate/.test(doc.querySelector("#lvGuide li.on").textContent),"guide highlights the player's level");
    check(doc.querySelectorAll(".pchart circle").length===3,"level progression chart");
    check(doc.querySelectorAll(".pmatches li").length>0&&body.includes("Autumn Cup"),"matches listed");
    check(body.includes("Omar")&&body.includes("Sara"),"partners and opponents listed");
    check(/Edit profile/.test(body),"own profile can be edited");
    await E('showProfile("priv")');check(/This profile is private/.test(doc.getElementById("profileBody").textContent),"private profile message");
    await E('showProfile("nobody")');check(/Profile not found/.test(doc.getElementById("profileBody").textContent),"unknown player message");
    // editing
    await E('showProfile("u1")');await E('editProfile()');
    check(doc.getElementById("profileDlg").open&&doc.getElementById("pfLevel").value==="3.25","edit form filled in");
    E('$("pfLevel").value="9"');await E('saveProfileForm({preventDefault(){}})');
    check(/0 to 7/.test(doc.getElementById("pfMsg").textContent)&&!saved,"level outside 0–7 refused");
    E('$("pfLevel").value="3,5";updateLevelHint()');
    check(/Upper intermediate/.test(doc.getElementById("pfLevelHint").textContent),"typing a level shows what it means");
    E('toggleGuide($("pfGuideBtn"),"pfGuide")');check(/Upper intermediate/.test(doc.querySelector("#pfGuide li.on").textContent),"form guide highlights the typed level");
    await E('saveProfileForm({preventDefault(){}})');
    check(saved&&saved.level===3.5&&saved.levelHistory.length===4&&saved.levelHistory[3].level===3.5,"new level saved and added to the history (comma accepted)");
    check(saved.side==="left"&&saved.days.join()==="sat,sun"&&saved.whatsapp==="491701234567","preferences kept");
    check(!("reliability" in saved)&&!("playtomicUrl" in saved),"only the new fields are saved");
    // an Americano tournament counts too
    const A=JSON.parse(E(`(function(){const keep=state;state={...keep,style:"americano",teams:Array.from({length:8},(_,i)=>"P"+i),teamPlayers:{"0":[{uid:"u1",name:"Mina"}]},scores:{},settings:{...keep.settings,points:24,rounds:7}};
      allMatches().forEach(m=>state.scores[m.id]=(m.pa.includes(0)?{a:15,b:9}:m.pb.includes(0)?{a:9,b:15}:{a:12,b:12}));const d={id:"AM1",name:"Friday Americano",style:"americano",teams:state.teams,teamPlayers:state.teamPlayers,scores:state.scores,settings:state.settings};state=keep;return JSON.stringify(d)})()`));
    const SA=E(`computePlayerStats("u1",${JSON.stringify([A])})`);
    check(SA.played===7&&SA.won===7&&SA.titles===1,"Americano matches, wins and title count on the profile");
    check(SA.partners.length===5&&SA.matches[0].stage.includes("Americano"),"Americano partners listed");
    // a brand-new account gets a profile automatically
    saved=null;w.__cloud.getProfile=async()=>({ok:true,profile:null});
    E('authUser={uid:"new1",email:"lena@x.de",displayName:"Lena Weber",photoURL:""}');
    await E('showProfile("new1")');
    check(saved&&saved.displayName==="Lena Weber"&&saved.visibility==="public","profile created automatically for a new account");
    check(/Lena Weber/.test(doc.getElementById("profileBody").textContent)&&/Edit profile/.test(doc.getElementById("profileBody").textContent)&&!/Create/.test(doc.getElementById("profileBody").textContent),"shown straight away, no Create step");
    saved=null;await E('window.__authState({uid:"new2",email:"tom@x.de",displayName:"",photoURL:""})');await new Promise(r=>setTimeout(r,20));
    check(saved&&saved.displayName==="tom","signing in creates the profile too");
    check(errors.length===0,"no script errors: "+errors.join(" | "));
  }catch(e){failed++;console.log("  ✗ crashed: "+e.stack.split("\n").slice(0,3).join(" | "))}
}

section("Americano: fair rotation for 4–24 players",()=>{
  const {E}=loadApp();
  for(let n=4;n<=24;n++){
    E(`state.style="americano";state.teams=Array.from({length:${n}},(_,i)=>"P"+i);state.settings={start:"10:00",duration:20,courts:[{name:"A"},{name:"B"},{name:"C"},{name:"D"}]};state.scores={};rebuild()`);
    const r=E(`(function(){const ms=allMatches(),P={},g=Array(${n}).fill(0),s=Array(${n}).fill(0);ms.rounds.forEach(rd=>rd.sit.forEach(x=>s[x]++));
      let ok=true;ms.rounds.forEach(rd=>{const seen=new Set([...rd.sit]);rd.ids.forEach(id=>{const m=ms.byId[id];[...m.pa,...m.pb].forEach(x=>{if(seen.has(x))ok=false;seen.add(x)})});if(seen.size!==${n})ok=false});
      ms.forEach(m=>{[m.pa,m.pb].forEach(p=>{const k=Math.min(...p)+"-"+Math.max(...p);P[k]=(P[k]||0)+1});[...m.pa,...m.pb].forEach(x=>g[x]++)});
      return {ok,maxP:Math.max(...Object.values(P)),rep:Object.values(P).filter(c=>c>1).length,gs:Math.max(...g)-Math.min(...g),ss:Math.max(...s)-Math.min(...s),courts:ms.rounds[0].ids.length}})()`);
    check(r.ok,`${n} players: everyone exactly once per round (playing or sitting out)`);
    // with sit-outs a repeat can be unavoidable late on; it must stay rare
    check(n%4===0||n<=9?r.maxP===1:r.maxP<=2&&r.rep<=1,`${n} players: ${n%4===0||n<=9?"nobody repeats a partner":"at most one repeated partnership"} (max ${r.maxP}, repeats ${r.rep})`);
    check(r.gs<=1&&r.ss<=1,`${n} players: games and sit-outs spread evenly`);
    check(r.courts===Math.min(4,Math.floor(n/4)),`${n} players: uses the free courts`);
  }
  E(`state.teams=Array.from({length:8},(_,i)=>"P"+i);state.settings={start:"10:00",duration:20,courts:[{name:"A"},{name:"B"}]};rebuild()`);
  const pairs=E(`(function(){const s=new Set();allMatches().forEach(m=>[m.pa,m.pb].forEach(p=>s.add(Math.min(...p)+"-"+Math.max(...p))));return s.size})()`);
  check(pairs===28&&E("allMatches().rounds.length")===7,"8 players: 7 rounds, everyone partners everyone once");
});

section("Americano: scoring, leaderboard, rounds and points",()=>{
  const {E,doc,errors}=loadApp();
  E(`state.style="americano";state.teams=Array.from({length:9},(_,i)=>"P"+(i+1));state.settings={start:"10:00",duration:20,courts:[{name:"A"},{name:"B"}],points:24,rounds:3};state.scores={};rebuild()`);
  check(doc.getElementById("tabStand").textContent==="Leaderboard"&&doc.getElementById("teamsTitle").textContent==="Players","screens switch to players and leaderboard");
  check(doc.body.classList.contains("is-am"),"Americano settings shown, best-of and bracket hidden");
  const id=E("allMatches()[0].id");
  E(`$("${id}a").value="14";amInput("${id}","a")`);
  check(E(`$("${id}b").value`)==="10"&&JSON.stringify(E(`state.scores["${id}"]`))==='{"a":14,"b":10}',"typing 14 fills in 10 (to 24)");
  E(`$("${id}a").value="";$("${id}b").value="";onScore("${id}");amBump("${id}","a",1)`);
  check(JSON.stringify(E(`state.scores["${id}"]`))==='{"a":13,"b":11}',"+ starts from 12–12 and moves one point across");
  check(E(`scoreState({a:13,b:12},"${id}")`)==="bad"&&E(`scoreState({a:10,b:5},"${id}")`)==="progress","too many points flagged; fewer = still playing");
  E(`allMatches().forEach((m,k)=>state.scores[m.id]={a:12+(k%5),b:12-(k%5)});refresh()`);
  const t=E("amTable()"),sat=t.filter(r=>r.byes>0);
  check(t.every(r=>r.played+r.byes===3),"each player plays or sits out every round");
  check(sat.length===3&&sat.every(r=>r.bonus===12),"sitting out a round gives half the match points (12)");
  check(E("amTable().reduce((s,r)=>s+r.pts,0)")===E("allMatches().length")*48,"all points accounted for");
  check(E("placements().every(p=>p.t!==null)")&&doc.querySelectorAll("#rankBody tr").length===9,"final ranking once all rounds are played");
  check(/Final ranking/.test(E("resultsText()"))&&/pts/.test(E("resultsText()")),"WhatsApp text shows the ranking with points");
  const r1=JSON.stringify(E("allMatches().filter(m=>m.round<=3).map(m=>[m.id,m.pa,m.pb])"));
  E('setAmRounds(5)');
  check(E("allMatches().rounds.length")===5&&JSON.stringify(E("allMatches().filter(m=>m.round<=3).map(m=>[m.id,m.pa,m.pb])"))===r1,"adding rounds keeps the earlier rounds and their scores");
  check(E("placements().every(p=>p.t===null)"),"ranking waits for the new rounds");
  E('setAmPoints(32)');check(E("amPoints()")===32&&Object.keys(E("state.scores")).length===0,"changing points clears old scores");
  E('printSheets()');check(/Americano/.test(doc.getElementById("printArea").textContent),"court sheets print the rounds");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
});

section("Americano: switching style, players and phone view",()=>{
  const {E,doc,errors}=loadApp();setTeams(E,8);
  E('state.scores.gA0={a:4,b:1};state.teamPlayers={"0":[{uid:"u1",name:"Mina"},{uid:"u2",name:"Omar"}]};setStyle("americano")');
  check(E("isAm()")&&Object.keys(E("state.scores")).length===0,"switch to Americano (scores cleared)");
  check(E("playersOf(0).length")===1,"one linked profile per player");
  E('state.teams[1]="Player 2"');check(E('addPlayerToTeam(1,{uid:"u3",name:"Sara"})')&&E("state.teams[1]")==="Sara","linking a profile names an unnamed player");
  E('changeTeamCount(20)');check(E("teamCount()")===20,"up to 24 players");
  check(doc.querySelectorAll("#nteams option").length===21,"player count list goes to 24");
  E('setStyle("groups_ko")');check(!E("isAm()")&&E("teamCount()")===16,"switching back keeps at most 16 teams");
  check(E("allMatches().byId.final")!=null,"groups + knockout schedule is back");
  check(errors.length===0,"no script errors: "+errors.join(" | "));
  const P=loadApp({phone:true});
  P.E(`state.style="americano";state.teams=Array.from({length:8},(_,i)=>"P"+(i+1));state.scores={};rebuild()`);
  check(P.doc.querySelectorAll(".mslot").length===7&&P.doc.querySelectorAll(".mtile").length===14,"phone: one card per round, one tile per court");
  check(P.errors.length===0,"phone: no script errors");
});

// Marketplace: uses a fake online layer instead of Firebase
async function marketTests(){
  console.log("• Marketplace");
  try{
    const {E,w,doc,errors}=loadApp();
    const store=[{id:"L1",category:"gear",title:"Bullpadel Vertex",description:"One season",price:"60 €",location:"Stuttgart",phone:"491701234567",ownerUid:"u1",createdAt:Date.now()-3600e3},
                 {id:"L2",category:"partner",title:"Need a partner",description:"",price:"Intermediate",location:"",phone:"201001234567",ownerUid:"u2",createdAt:Date.now()}];
    w.__cloud={listListings:async()=>({ok:true,list:store.map(x=>({...x}))}),
      createListing:async d=>{store.unshift({...d,id:"L3",ownerUid:"u1",createdAt:Date.now()});return {ok:true,id:"L3"}},
      updateListing:async()=>({ok:true}),deleteListing:async id=>{store.splice(store.findIndex(x=>x.id===id),1);return {ok:true}}};
    E('window.CLOUD_ON=true;authUser={email:"a@b.c",uid:"u1"};showMarket()');
    await new Promise(r=>setTimeout(r,30));
    check(!doc.getElementById("marketView").hidden,"marketplace page opens");
    check(doc.querySelectorAll(".lcard").length===2,"shows all listings");
    E('setMktCat("partner")');
    check(doc.querySelectorAll(".lcard").length===1&&/Need a partner/.test(doc.getElementById("mktList").textContent),"category filter");
    E('setMktCat("all");mkt.q="vertex";renderMarket()');
    check(doc.querySelectorAll(".lcard").length===1,"search");
    E('mkt.q="";renderMarket()');
    check(doc.querySelector('.lcard a.wa').href.startsWith("https://wa.me/"),"WhatsApp button");
    check(doc.querySelectorAll('.lcard button.danger').length===1,"only the owner can remove their listing");
    check(E('normalizePhone("+49 170 1234567").phone')==="491701234567","phone with +country code");
    check(E('normalizePhone("0049 170 1234567").phone')==="491701234567","phone with 00 country code");
    check(!!E('normalizePhone("0170 1234567").error'),"phone without country code is rejected");
    E('startPost()');
    doc.getElementById("lCat").value="gift";E("mktCatChanged()");
    check(doc.getElementById("lPriceLbl").textContent.startsWith("Suggested donation"),"donation gifts ask for a suggested donation");
    doc.getElementById("lTitle").value="Padel Tour T-shirt";doc.getElementById("lPhone").value="+49 170 1234567";
    await E('saveListing({preventDefault(){}})');await new Promise(r=>setTimeout(r,30));
    check(store[0].title==="Padel Tour T-shirt"&&store[0].category==="gift"&&store[0].phone==="491701234567","posting a listing");
    E('confirm=()=>true');await E('removeListing("L3")');
    check(!store.some(x=>x.id==="L3"),"removing a listing");
    check(errors.length===0,"no script errors: "+errors.join(" | "));
  }catch(e){failed++;console.log("  ✗ crashed: "+e.stack.split("\n").slice(0,3).join(" | "))}
}

profileTests().then(marketTests).then(()=>{
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
});
