// Marketplace: partner search, used gear, coaches & lessons, donation gifts.
// Any signed-in user can post; people get in touch on WhatsApp (no payments in the app).
const MARKET_CATS=[
  ["partner","🤝","Partner search","Find a partner or a team for a tournament"],
  ["gear","🎾","Used gear","Rackets, shoes, bags and more"],
  ["coach","🧑‍🏫","Coaches & lessons","Lessons, clinics and training"],
  ["gift","🎁","Donation gifts","Merchandise as a thank-you for a donation"]
];
const MKT_PRICE={partner:["Level / when","e.g. Intermediate, Saturday mornings"],gear:["Price","e.g. 60 €"],coach:["Price per lesson","e.g. 40 € / hour"],gift:["Suggested donation","e.g. 20 €"]};
const MKT_TITLE_PH={partner:"e.g. Looking for a right-side partner for the Autumn Cup",gear:"e.g. Bullpadel Vertex 03, used one season",coach:"e.g. Beginner lessons, groups of 4",gift:"e.g. Padel Tour T-shirt for a 20 € donation"};
let mkt={list:[],cat:"all",q:"",mine:false,loading:false,editing:null};
const mktCat=k=>MARKET_CATS.find(c=>c[0]===k)||MARKET_CATS[1];
function isSiteAdmin(){return !!(authUser&&(window.MARKET_ADMINS||[]).map(x=>x.toLowerCase()).includes((authUser.email||"").toLowerCase()))}

/* ---------- Opening / closing ---------- */
function openMarket(){if(location.hash!=="#market")location.hash="market";else showMarket()}
function showMarket(){
showView("market");window.scrollTo(0,0);renderMarketTools();
if(!window.CLOUD_ON){$("mktList").innerHTML='<p class="note">The marketplace works on the online site only.</p>';return}
loadMarket()
}
function closeMarket(){history.replaceState(null,"",location.pathname+location.search);showView(homeView());renderLanding()}

/* ---------- Loading and showing listings ---------- */
async function loadMarket(){
const box=$("mktList");
if(!window.__cloud){box.innerHTML='<p class="note">Connecting…</p>';return}
if(mkt.loading)return;
mkt.loading=true;box.innerHTML='<p class="note">Loading…</p>';
const r=await window.__cloud.listListings();mkt.loading=false;
if(!r.ok){box.innerHTML=`<p class="note">Could not load the marketplace (${esc(r.error)}).</p>`;return}
mkt.list=r.list;renderMarket()
}
function renderMarketTools(){
const counts={};mkt.list.forEach(l=>counts[l.category]=(counts[l.category]||0)+1);
$("mktCats").innerHTML=[["all","🛒","All"],...MARKET_CATS].map(([k,ic,l])=>`<button class="${mkt.cat===k?"on":""}" onclick="setMktCat('${k}')">${ic} ${l}${k==="all"?(mkt.list.length?` (${mkt.list.length})`:""):(counts[k]?` (${counts[k]})`:"")}</button>`).join("");
$("mktMine").hidden=!authUser;
$("mktMine").classList.toggle("on",mkt.mine);
$("mktPost").textContent=authUser?"+ Post a listing":"Sign in to post";
}
function setMktCat(k){mkt.cat=k;renderMarket()}
function toggleMine(){mkt.mine=!mkt.mine;renderMarket()}
function mktFiltered(){
const q=mkt.q.trim().toLowerCase();
return mkt.list.filter(l=>(mkt.cat==="all"||l.category===mkt.cat)&&(!mkt.mine||(authUser&&l.ownerUid===authUser.uid))&&(!q||[l.title,l.description,l.location,l.price].join(" ").toLowerCase().includes(q)))
}
function ago(ms){
if(!ms)return "";const m=Math.round((Date.now()-ms)/60000);
if(m<60)return m<=1?"just now":m+" min ago";const h=Math.round(m/60);if(h<24)return h+" h ago";const d=Math.round(h/24);
return d<30?d+" day"+(d>1?"s":"")+" ago":new Date(ms).toLocaleDateString()
}
function waListingLink(l){return "https://wa.me/"+l.phone+"?text="+encodeURIComponent(`Hi! I saw your listing “${l.title}” on Padel Tour.`)}
function renderMarket(){
renderMarketTools();
const list=mktFiltered(),c=mkt.cat==="all"?null:mktCat(mkt.cat);
$("mktIntro").textContent=c?c[3]+".":"Partner search, used gear, coaches & lessons, and donation gifts from the padel community.";
$("mktList").innerHTML=list.length?list.map(l=>{
  const cat=mktCat(l.category),own=authUser&&l.ownerUid===authUser.uid,id=esc(l.id);
  return `<article class="lcard"><div class="lcard-h"><span class="chip lcat lcat-${esc(l.category)}">${cat[1]} ${cat[2]}</span><small>${ago(l.createdAt)}</small></div>`+
  `<h3 dir="auto">${esc(l.title)}</h3>`+
  (l.price?`<p class="lprice"><span>${esc(MKT_PRICE[l.category]?MKT_PRICE[l.category][0]:"Price")}:</span> ${esc(l.price)}</p>`:"")+
  (l.description?`<p class="ldesc" dir="auto">${esc(l.description)}</p>`:"")+
  (l.location?`<p class="note lloc">📍 ${esc(l.location)}</p>`:"")+
  `<div class="lcard-f"><a class="btn wa" href="${waListingLink(l)}" target="_blank" rel="noopener">Message on WhatsApp</a>`+
  (own?`<button class="secondary" onclick="editListing('${id}')">Edit</button>`:"")+
  (own||isSiteAdmin()?`<button class="danger" onclick="removeListing('${id}')">${own?"Remove":"Remove (admin)"}</button>`:"")+
  `</div></article>`
}).join(""):`<div class="mkt-empty"><p><b>Nothing here yet.</b></p><p class="note">${authUser?"Be the first to post a listing.":"Sign in to post the first listing."}</p></div>`
}

/* ---------- Posting and editing ---------- */
function startPost(){
if(!authUser){openAuth();$("authMsg").textContent="Sign in or register to post a listing.";return}
mkt.editing=null;fillListingForm({category:mkt.cat==="all"?"gear":mkt.cat});
$("mktDlgTitle").textContent="Post a listing";$("lSave").textContent="Publish";$("mktDlg").showModal()
}
function editListing(id){
const l=mkt.list.find(x=>x.id===id);if(!l)return;
mkt.editing=id;fillListingForm(l);
$("mktDlgTitle").textContent="Edit listing";$("lSave").textContent="Save changes";$("mktDlg").showModal()
}
function fillListingForm(l){
$("lCat").innerHTML=MARKET_CATS.map(([k,ic,n])=>`<option value="${k}">${ic} ${n}</option>`).join("");
$("lCat").value=l.category||"gear";
$("lTitle").value=l.title||"";$("lDesc").value=l.description||"";$("lPrice").value=l.price||"";$("lLoc").value=l.location||"";
let last="";try{last=localStorage.getItem("padelPhone")||""}catch(e){}
$("lPhone").value=l.phone?"+"+l.phone:last;
$("lMsgM").textContent="";mktCatChanged()
}
function mktCatChanged(){
const k=$("lCat").value,p=MKT_PRICE[k]||MKT_PRICE.gear;
$("lPriceLbl").textContent=p[0]+" (optional)";$("lPrice").placeholder=p[1];
$("lTitle").placeholder=MKT_TITLE_PH[k]||"";$("lCatHint").textContent=mktCat(k)[3]+".";
}
// "+49 170 123", "0049 170 123" → "49170123" (digits only, with country code, as wa.me expects)
function normalizePhone(v){
let p=String(v||"").trim().replace(/[\s\-().\/]/g,"");
if(p.startsWith("+"))p=p.slice(1);else if(p.startsWith("00"))p=p.slice(2);else return {error:"Start the number with your country code, e.g. +49 170 1234567."};
if(!/^[0-9]{7,15}$/.test(p))return {error:"That WhatsApp number doesn't look right. Use digits only, e.g. +49 170 1234567."};
return {phone:p}
}
async function saveListing(e){
e.preventDefault();
const msg=$("lMsgM"),title=$("lTitle").value.trim(),ph=normalizePhone($("lPhone").value);
if(!authUser){msg.textContent="Please sign in first.";return}
if(!title){msg.textContent="Add a title.";return}
if(ph.error){msg.textContent=ph.error;return}
const data={category:$("lCat").value,title:title.slice(0,80),description:$("lDesc").value.trim().slice(0,1000),price:$("lPrice").value.trim().slice(0,40),location:$("lLoc").value.trim().slice(0,60),phone:ph.phone};
msg.textContent="Saving…";
const r=mkt.editing?await window.__cloud.updateListing(mkt.editing,data):await window.__cloud.createListing(data);
if(!r.ok){msg.textContent=r.error==="permission-denied"?"Not allowed. Check that the marketplace rules are published in Firebase.":"Could not save ("+r.error+").";return}
try{localStorage.setItem("padelPhone","+"+ph.phone)}catch(e){}
$("mktDlg").close();toast(mkt.editing?"Listing updated.":"Listing published.");
if(!mkt.editing){mkt.cat=data.category}
loadMarket()
}
async function removeListing(id){
if(!confirm("Remove this listing? This can't be undone."))return;
const r=await window.__cloud.deleteListing(id);
if(!r.ok){toast("Could not remove it ("+r.error+").");return}
mkt.list=mkt.list.filter(l=>l.id!==id);renderMarket();toast("Listing removed.")
}
