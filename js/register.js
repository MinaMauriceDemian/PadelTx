// Registration: people sign up for a tournament themselves, the organiser accepts them.
// Groups + knockout: one signed-in person registers a whole team (their partner can be a guest name
// and link their own account later with an invite link). Americano: one person registers themselves.
// Stored as tournaments/{tid}/entries/{registrant uid} (see firestore.rules); state.regOpen switches it on.
let entries=[],myEntry=null,joinReq=null,joinBusy=false;
const REG_LABEL={pending:"Waiting",waitlist:"Waiting list",accepted:"Accepted",declined:"Declined"};

// A slot is free while it still has its placeholder name ("Team 3" / "Player 7") and no players
function isFreeSlot(i){return !playersOf(i).length&&/^(Team|Player) \d+$/.test(teamName(i))}
function freeSlots(){return state.teams.map((_,i)=>i).filter(isFreeSlot)}
const regGuest=p=>!!p&&!p.uid;
const cleanPlayer=p=>{const o={name:p.name};if(p.uid)o.uid=p.uid;if(p.photoURL)o.photoURL=p.photoURL;return o};
const entryPlayers=e=>[e.me,e.partner].filter(Boolean).map(cleanPlayer);
const entryWho=e=>entryPlayers(e).map(p=>esc(p.name)+(p.uid?"":" <small>(guest)</small>")).join(" &amp; ");

/* ---------- Entry fee: the organiser's IBAN and amount (state.regPay, on the tournament) ---------- */
const fmtIban=s=>String(s||"").replace(/(.{4})/g,"$1 ").trim();
const hasPay=()=>!!(state.regPay&&state.regPay.amount&&(state.regPay.iban||state.regPay.paypal));
// Bank reference so the organiser can match transfers: PT-<first 4 of the ID>-<first name>, e.g. PT-K7M2-Mina
function payRef(e){
const first=String((e&&e.me&&e.me.name)||(e&&e.name)||"").trim().split(/\s+/)[0].normalize("NFD").replace(/[^A-Za-z0-9]/g,"").slice(0,12);
return "PT-"+String(currentTid||"").slice(0,4)+"-"+(first||String((e&&e.uid)||"").slice(0,5))
}
// "20 € per team" → paypal.me/<name>/20EUR (the amount and currency are filled in for the payer)
function paypalUrl(){
const p=state.regPay||{};if(!p.paypal)return "";
const m=/(\d+(?:[.,]\d{1,2})?)/.exec(p.amount||""),cur=/€|eur/i.test(p.amount||"")?"EUR":/£|gbp/i.test(p.amount||"")?"GBP":/\$|usd/i.test(p.amount||"")?"USD":/chf/i.test(p.amount||"")?"CHF":"";
return "https://paypal.me/"+encodeURIComponent(p.paypal)+(m?"/"+m[1].replace(",",".")+cur:"")
}
function payHtml(ref){
if(!hasPay())return "";
const p=state.regPay,pp=paypalUrl();
return `<div class="regpay">💳 Pay <b>${esc(p.amount)}</b> to confirm your spot.`+
  (p.iban?`<br>IBAN <code>${esc(fmtIban(p.iban))}</code> <button type="button" class="secondary" onclick="copyText('${esc(p.iban)}','IBAN copied.')">Copy IBAN</button>${p.holder?`<br>Account holder: <b>${esc(p.holder)}</b>`:""}`:"")+
  (ref?`<br>Reference: <code dir="auto">${esc(ref)}</code> <button type="button" class="secondary" onclick="copyText('${esc(ref)}','Reference copied.')">Copy</button>`:"")+
  (pp?`<br><a class="btn paypal" href="${esc(pp)}" target="_blank" rel="noopener">Pay with PayPal</a>${ref?` <small>Add the reference as a note.</small>`:""}`:"")+
  (p.note?`<br><span dir="auto">${esc(p.note)}</span>`:"")+`</div>`
}
function copyText(t,done){if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast(done),()=>toast(t));else toast(t)}
function saveRegPay(){
if(!isAdmin())return;
const v=id=>$(id).value.trim();
const iban=v("payIban").toUpperCase().replace(/[^A-Z0-9]/g,"");
if(iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$/.test(iban)){toast("That IBAN doesn't look right. It starts with the country code, e.g. DE89 3704 …");return}
const paypal=v("payPaypal").replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i,"").replace(/\/.*$/,"");
if(paypal&&!/^[A-Za-z0-9._-]{1,40}$/.test(paypal)){toast("Type only your PayPal.me name, e.g. minademian.");return}
const p={amount:v("payAmt").slice(0,30),iban,paypal,holder:v("payHolder").slice(0,60),note:v("payNote").slice(0,200)};
state.regPay=p.amount||p.iban||p.paypal?p:null;cloudWrite({regPay:state.regPay||DEL});renderRegistration();
toast(state.regPay?(hasPay()?"Payment details saved. Registrants see them.":"Add the amount and an IBAN or PayPal name so registrants see them."):"Payment details removed.")
}

/* ---------- Invite links: #t=ID&join=<registrant uid>.<code> ---------- */
// Kept for this browser tab until used, so a sign-in that reloads the page (Google on phones) doesn't lose it
function captureJoin(){
const m=/[#&]join=([A-Za-z0-9]+)\.([A-Za-z0-9]+)/.exec(location.hash);
const arg=k=>{const x=new RegExp("[#&]"+k+"=([^&]*)").exec(location.hash);try{return x?decodeURIComponent(x[1]).slice(0,40):""}catch(e){return ""}};
if(m){joinReq={tid:hashId(),uid:m[1],code:m[2],by:arg("by"),team:arg("team")};try{sessionStorage.setItem("padelJoin",JSON.stringify(joinReq))}catch(e){}}
}
function dropJoin(){joinReq=null;try{sessionStorage.removeItem("padelJoin")}catch(e){}}
try{joinReq=JSON.parse(sessionStorage.getItem("padelJoin"))||null}catch(e){}
captureJoin();
async function myPlayer(){
const r=window.__cloud?await window.__cloud.getProfile(authUser.uid):null;
const p=r&&r.ok&&r.profile,name=(p&&p.displayName)||authUser.displayName||(authUser.email||"").split("@")[0]||"Player";
const o={uid:authUser.uid,name:name.slice(0,40)};const photo=(p&&p.photoURL)||authUser.photoURL;if(photo)o.photoURL=photo;return o
}
async function tryJoin(){
if(!joinReq||joinBusy||!authUser||!currentTid||joinReq.tid!==currentTid||!window.__cloud)return;
const j=joinReq;
if(j.uid===authUser.uid){dropJoin();toast("This is your own invite link. Send it to your partner.");return}
if(allPlayerUids().includes(authUser.uid)){dropJoin();toast("You are already in a team in this tournament.");return}
joinBusy=true;
const me=await myPlayer();
const r=await window.__cloud.claimPartner(j.uid,{...me,code:j.code});
joinBusy=false;dropJoin();
toast(r.ok?"Done! Your account is linked to your partner's team.":"This invite link doesn't work any more (it may already have been used).");
renderRegistration()
}

/* ---------- Registering (players) ---------- */
// Not signed in: Google first; once signed in (also after a page reload) the form opens by itself
function openRegAuth(){
try{sessionStorage.setItem("padelAfterAuth",JSON.stringify({tid:currentTid,act:"reg"}))}catch(e){}
openAuth(isAm()?"Sign in to register. It takes 10 seconds, then you fill in a short form.":"Sign in to register your team. It takes 10 seconds, then you fill in a short form.")
}
function runAfterAuth(){
if(!authUser||!currentTid)return;
let a=null;try{a=JSON.parse(sessionStorage.getItem("padelAfterAuth"))}catch(e){}
if(!a||a.tid!==currentTid)return;
try{sessionStorage.removeItem("padelAfterAuth")}catch(e){}
if($("authDlg").open)$("authDlg").close();
if(a.act==="reg"&&state.regOpen&&!myEntry&&!allPlayerUids().includes(authUser.uid)){showPart("players");openReg()}
}
function openReg(){
if(!authUser){openRegAuth();return}
const am=isAm();
$("regTitle").textContent=am?"Register for "+(state.name||"the tournament"):"Register your team";
$("regIntro").textContent=freeSlots().length?(am?"Send your registration; the organiser confirms your place.":"Register yourself and your partner. Your partner can be a guest name now and link their own account later with an invite link."):"The tournament is full. You'll be on the waiting list and get a place if one opens up.";
document.querySelectorAll("[data-rteam]").forEach(el=>el.hidden=am);
["rTeam","rPartner","rPhone"].forEach(id=>$(id).value="");$("rMsg").textContent="";$("rMe").value="";
let last="";try{last=localStorage.getItem("padelPhone")||""}catch(e){}$("rPhone").value=last;
$("rStepPay").hidden=!hasPay();
// no payment request for the waiting list: there's no place to pay for yet
$("rPay").innerHTML=payHtml("");$("rPay").hidden=!hasPay()||!freeSlots().length;
myPlayer().then(p=>{if(!$("rMe").value)$("rMe").value=p.name});
$("regDlg").showModal()
}
async function submitReg(ev){
ev.preventDefault();
const am=isAm(),msg=$("rMsg"),me=await myPlayer();
me.name=$("rMe").value.trim().slice(0,40);
const partner=$("rPartner").value.trim().slice(0,40),phone=$("rPhone").value.replace(/[^0-9]/g,""),email=String(authUser.email||"").slice(0,100);
if(!me.name){msg.textContent="Type your name.";return}
if(!am&&!partner){msg.textContent="Type your partner's name (they can link their account later).";return}
if(phone.length<7||phone.length>15){msg.textContent="Type your WhatsApp number with the country code, e.g. +49 170 1234567.";return}
if(allPlayerUids().includes(authUser.uid)){msg.textContent="You are already in a team in this tournament.";return}
const name=am?me.name:($("rTeam").value.trim()||`${me.name} & ${partner}`).slice(0,40);
const code=Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(36)).join("").slice(0,16).padEnd(8,"0");
const data={kind:am?"player":"team",name,me,partner:am?null:{name:partner},phone,email,status:freeSlots().length?"pending":"waitlist",code,createdAt:Date.now(),updatedAt:Date.now()};
$("rSave").disabled=true;msg.textContent="Sending…";
const r=await window.__cloud.register(data);
$("rSave").disabled=false;
if(!r.ok){msg.textContent=r.error==="permission-denied"?"Registration is closed for this tournament.":"Could not register ("+r.error+").";return}
$("regDlg").close();try{localStorage.setItem("padelPhone","+"+phone)}catch(e){}
toast(data.status==="waitlist"?"You're on the waiting list.":hasPay()?"Registration sent. Pay the entry fee to confirm it (details above the schedule).":am?"Registration sent. The organiser will confirm your place.":"Registration sent. Now invite your partner so they can link their account.")
}
async function cancelReg(){
if(!confirm("Cancel your registration?"))return;
const r=await window.__cloud.cancelEntry();toast(r.ok?"Registration cancelled.":"Could not cancel ("+r.error+").")
}
function invitePartner(){
if(!myEntry)return;
const url=tournamentUrl()+"&join="+myEntry.uid+"."+myEntry.code+"&by="+encodeURIComponent(((myEntry.me&&myEntry.me.name)||"").split(/\s+/)[0])+"&team="+encodeURIComponent(myEntry.name);
const text=`Join our team “${myEntry.name}” in ${state.name||"the tournament"} on Padel Tour: open this link and sign in. ${url}`;
window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener")
}

// The bar above the schedule: register button, or where your registration stands
function renderRegBar(){
const bar=$("regBar");if(!bar)return;
const show=html=>{bar.hidden=!html;bar.innerHTML=html||""};
if(!window.CLOUD_ON||!currentTid)return show("");
if(joinReq&&joinReq.tid===currentTid&&!authUser){
  const j=joinReq,who=j.by?`<b dir="auto">${esc(j.by)}</b> added you`:"You were added",team=j.team?` to team <b dir="auto">“${esc(j.team)}”</b>`:" to a team";
  return show(`<span class="reginv">👋 ${who}${team} in ${esc(state.name||"this tournament")}. Sign in to confirm.</span><button class="primary" onclick="openAuth('Sign in to confirm your place in the team. Your account is linked automatically.')">Sign in to confirm</button>`)
}
const e=myEntry,inv=e&&e.kind==="team"&&regGuest(e.partner)?`<button class="secondary" onclick="invitePartner()">Invite partner (WhatsApp)</button>`:"";
if(e){
  const nm=`“${esc(e.name)}”`,pay=e.paid?"":payHtml(payRef(e)),steps=regSteps(e);
  if(e.status==="pending")return show(`<span class="regtitle">⏳ You're registered: ${nm}</span>${steps}<span class="note regnote">The organizer usually confirms within 24 hours.${hasPay()&&!e.paid?" Paying now gets your spot confirmed faster.":""}</span>${pay}${inv}<button class="secondary" onclick="cancelReg()">Cancel registration</button>`);
  if(e.status==="waitlist")return show(`<span class="regtitle">🕒 You're on the waiting list with ${nm}</span><span class="note regnote">If a spot opens up, the organizer moves you in and lets you know.</span>${inv}<button class="secondary" onclick="cancelReg()">Cancel</button>`);
  if(e.status==="accepted")return show(`<span class="regtitle">✅ You're confirmed: ${nm}</span>${steps}${inv?`<span class="note regnote">Your partner hasn't linked their account yet.</span>${inv}`:""}${pay}`);
  if(e.status==="declined")return show(`Your registration ${nm} was not accepted. <button class="secondary" onclick="cancelReg()">OK, remove it</button>`);
}
if(!state.regOpen||(authUser&&allPlayerUids().includes(authUser.uid)))return show("");
const n=freeSlots().length,what=isAm()?"player":"team",left=n?`${n} ${what} spot${n>1?"s":""} left`:"full, waiting list only";
show(`Registration is open (${left}). <button class="primary" onclick="openReg()">${isAm()?"Register":"Register your team"}</button>`)
}

/* ---------- Managing registrations (organiser) ---------- */
function setRegOpen(on){
if(!isAdmin())return;
state.regOpen=!!on;cloudWrite({regOpen:!!on});renderRegistration();
toast(on?"Registration is open. People see a Register button on the tournament.":"Registration closed.")
}
async function acceptEntry(uid){
const e=entries.find(x=>x.uid===uid);if(!e||!isAdmin())return;
const slot=freeSlots()[0];
if(slot==null){toast(`No free spot. Spots still called “${isAm()?"Player":"Team"} N” without players are free; raise the number of ${isAm()?"players":"teams"} in Setup or remove someone.`);return}
const players=entryPlayers(e),taken=allPlayerUids(),clash=players.find(p=>p.uid&&taken.includes(p.uid));
if(clash){toast(clash.name+" is already in a team in this tournament.");return}
state.teams[slot]=e.name;
const tp={...(state.teamPlayers||{}),[slot]:players};state.teamPlayers=tp;
cloudWrite({teams:[...state.teams],teamPlayers:tp,playerUids:allPlayerUids()});
const r=await window.__cloud.updateEntry(uid,{status:"accepted",slot,linked:!regGuest(e.partner),updatedAt:Date.now()});
rebuild();toast(r.ok?`${e.name} is in (spot ${slot+1}).`:"Could not update the registration ("+r.error+").")
}
async function setEntryStatus(uid,status){
if(!isAdmin())return;
const r=await window.__cloud.updateEntry(uid,{status,updatedAt:Date.now()});if(!r.ok)toast("Could not update ("+r.error+").")
}
async function setEntryPaid(uid,paid){
if(!isAdmin())return;
const r=await window.__cloud.updateEntry(uid,{paid:!!paid,updatedAt:Date.now()});if(!r.ok)toast("Could not update ("+r.error+").")
}
async function removeEntry(uid){
const e=entries.find(x=>x.uid===uid);if(!e||!isAdmin())return;
if(e.status==="accepted"&&e.slot!=null){
  if(!confirm(`Remove “${e.name}” from the tournament? Their spot becomes free again.`))return;
  const i=e.slot,tp={...(state.teamPlayers||{})};delete tp[i];
  state.teams[i]=isAm()?"Player "+(i+1):defaultTeamName(i);state.teamPlayers=tp;
  cloudWrite({teams:[...state.teams],teamPlayers:tp,playerUids:allPlayerUids()});rebuild()
}
const r=await window.__cloud.deleteEntry(uid);if(!r.ok)toast("Could not remove ("+r.error+").")
}
// A partner who used an invite link after the team was accepted: put their profile in place of the guest name
function applyPartnerLinks(){
if(!isAdmin())return;
entries.filter(e=>e.status==="accepted"&&e.slot!=null&&!e.linked&&e.partner&&e.partner.uid).forEach(e=>{
  const p=cleanPlayer(e.partner);
  if(allPlayerUids().includes(p.uid)){window.__cloud.updateEntry(e.uid,{linked:true});return}
  // the registrant stays; the partner's account takes the guest's place
  const next=playersOf(e.slot).filter(x=>x.uid).concat(p).slice(0,2);
  const tp={...(state.teamPlayers||{}),[e.slot]:next};state.teamPlayers=tp;
  cloudWrite({teamPlayers:tp,playerUids:allPlayerUids()});window.__cloud.updateEntry(e.uid,{linked:true});
  toast(p.name+" linked their account to “"+e.name+"”.")
})
}
function renderRegAdmin(){
const box=$("regList");if(!box)return;
const n=freeSlots().length,open=!!state.regOpen,p=state.regPay||{};
[["payAmt",p.amount],["payIban",fmtIban(p.iban)],["payPaypal",p.paypal],["payHolder",p.holder],["payNote",p.note]].forEach(([id,v])=>{const el=$(id);if(el&&document.activeElement!==el)el.value=v||""});
$("regState").innerHTML=`<b>${open?"Registration is open":"Registration is closed"}</b><span class="note">${n} free spot${n===1?"":"s"}</span><span class="grow"></span><button class="${open?"secondary":"primary"}" onclick="setRegOpen(${!open})">${open?"Close registration":"Open registration"}</button>`;
const row=e=>{
  const id=esc(e.uid),btn=(label,call,cls)=>`<button class="${cls||"secondary"}" onclick="${call}">${label}</button>`;
  const accept=btn("Accept",`acceptEntry('${id}')`,"primary"),decline=btn("Decline",`setEntryStatus('${id}','declined')`);
  const acts=e.status==="pending"?accept+btn("Waiting list",`setEntryStatus('${id}','waitlist')`)+decline:
    e.status==="waitlist"?accept+decline:
    e.status==="accepted"?`<span class="note">Spot ${(+e.slot)+1}</span>`+btn("Remove",`removeEntry('${id}')`,"danger"):btn("Delete",`removeEntry('${id}')`,"danger");
  const wa=e.phone?` · <a href="https://wa.me/${esc(e.phone)}" target="_blank" rel="noopener">WhatsApp +${esc(e.phone)}</a>`:"";
  const ref=hasPay()&&e.status!=="declined"?` · Ref <code>${esc(payRef(e))}</code>`:"";
  const msgs=e.phone?(e.status==="accepted"?btn("✅ Send confirmation",`waEntry('${id}','confirm')`,"wa"):"")+(hasPay()&&!e.paid&&e.status!=="declined"?btn("Payment reminder",`waEntry('${id}','pay')`):""):"";
  const mail=e.email?` · <a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`:"";
  const paid=e.status==="declined"?"":`<span class="chip ${e.paid?"regst-accepted":"regst-pending"}">${e.paid?"Paid":"Not paid"}</span>`+btn(e.paid?"Mark unpaid":"Mark paid",`setEntryPaid('${id}',${!e.paid})`);
  return `<div class="mrow2 regrow"><div class="reg-main"><b dir="auto">${esc(e.name)}</b><small dir="auto">${entryWho(e)}${wa}${mail}${ref}</small></div><span class="grow"></span>${msgs}${paid}<span class="chip regst-${e.status}">${REG_LABEL[e.status]||esc(e.status)}</span>${acts}</div>`
};
const order=["pending","waitlist","accepted","declined"],list=[...entries].sort((a,b)=>order.indexOf(a.status)-order.indexOf(b.status)||a.createdAt-b.createdAt);
box.innerHTML=list.length?list.map(row).join(""):'<p class="note">No registrations yet.</p>';
const waiting=entries.filter(e=>e.status==="pending").length;$("regTab").textContent=waiting?`Registrations (${waiting})`:"Registrations";partBadge("players",waiting)
}
// Steps shown to the registrant: Registered → Paid (only with an entry fee) → Confirmed
function regSteps(e){
const st=[["Registered",true]];if(hasPay())st.push(["Paid",!!e.paid]);st.push(["Confirmed",e.status==="accepted"]);
const cur=st.findIndex(s=>!s[1]);
return `<ol class="regsteps">${st.map(([l,d],i)=>`<li class="${d?"done":i===cur?"cur":""}">${l}</li>`).join("")}</ol>`
}
// One-tap WhatsApp messages from the organiser to a registrant
function waEntry(uid,kind){
const e=entries.find(x=>x.uid===uid);if(!e||!e.phone)return;
const first=String((e.me&&e.me.name)||e.name).split(/\s+/)[0],s=state.settings||{},d=s.date?new Date(s.date+"T00:00"):null;
const when=[d&&!isNaN(d)?"on "+d.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}):"",s.venue?"at "+s.venue:"",s.start?"starting "+s.start:""].filter(Boolean).join(" ");
let t;
if(kind==="confirm")t=`Hi ${first}! ✅ You're confirmed for ${tName()}${when?" "+when:""}.${e.kind==="team"?` Team: ${e.name}.`:""}\nSchedule and live scores: ${tournamentUrl()}\nSee you on court! 🎾`;
else{const p=state.regPay||{},pp=paypalUrl();t=`Hi ${first}! A quick reminder: to confirm your spot in ${tName()}, please pay ${p.amount}.${p.iban?`\nIBAN: ${fmtIban(p.iban)}${p.holder?` (${p.holder})`:""}`:""}${pp?`\nPayPal: ${pp}`:""}\nReference: ${payRef(e)}\nThank you!`}
window.open("https://wa.me/"+e.phone+"?text="+encodeURIComponent(t),"_blank","noopener")
}
function renderRegistration(){
const tab=$("regTab");if(!tab)return;
$("registrations").hidden=!(window.CLOUD_ON&&isAdmin());
renderRegBar();renderRegAdmin();tryJoin();runAfterAuth();if(typeof renderDash==="function")renderDash();
if(!isAdmin())partBadge("players",window.CLOUD_ON&&state.regOpen&&!myEntry?"Join":0)
}
window.__setEntries=l=>{entries=l;applyPartnerLinks();renderRegistration()};
window.__setMyEntry=e=>{myEntry=e;renderRegBar();runAfterAuth()};
