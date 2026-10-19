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

marketTests().then(()=>{
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
});
