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
let mkt={list:[],cat:"all",q:"",mine:false,loading:false,editing:null,reports:null,photos:[],photosDirty:false,photoBusy:false};
// Listings stay up for 30 days; the owner can renew them
const LISTING_DAYS=30,DAY_MS=86400000;
const daysLeft=l=>Math.ceil(((l.createdAt||0)+LISTING_DAYS*DAY_MS-Date.now())/DAY_MS);
const isExpired=l=>daysLeft(l)<=0;
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
const live=mkt.list.filter(l=>!isExpired(l)),counts={};live.forEach(l=>counts[l.category]=(counts[l.category]||0)+1);
$("mktCats").innerHTML=[["all","🛒","All"],...MARKET_CATS].map(([k,ic,l])=>`<button class="${mkt.cat===k?"on":""}" onclick="setMktCat('${k}')">${ic} ${l}${k==="all"?(mkt.list.length?` (${mkt.list.length})`:""):(counts[k]?` (${counts[k]})`:"")}</button>`).join("");
$("mktMine").hidden=!authUser;
$("mktMine").classList.toggle("on",mkt.mine);
$("mktPost").textContent=authUser?"+ Post a listing":"Sign in to post";
$("mktReports").hidden=!isSiteAdmin();
}
function setMktCat(k){mkt.cat=k;renderMarket()}
function toggleMine(){mkt.mine=!mkt.mine;renderMarket()}
function mktFiltered(){
const q=mkt.q.trim().toLowerCase();
const own=l=>authUser&&l.ownerUid===authUser.uid;
return mkt.list.filter(l=>(mkt.cat==="all"||l.category===mkt.cat)&&(!mkt.mine||own(l))&&(!isExpired(l)||(mkt.mine&&own(l)))&&(!q||[l.title,l.description,l.location,l.price].join(" ").toLowerCase().includes(q)))
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
  const left=daysLeft(l);
  return `<article class="lcard${isExpired(l)?" expired":""}"><div class="lcard-h"><span class="chip lcat lcat-${esc(l.category)}">${cat[1]} ${cat[2]}</span><small>${ago(l.createdAt)}</small></div>`+
  (own?`<p class="lexp">${left>0?`Visible for ${left} more day${left>1?"s":""}`:"Expired: hidden from others"}${left<=7?` · <button type="button" class="linkbtn" onclick="renewListing('${id}')">Renew for ${LISTING_DAYS} days</button>`:""}</p>`:"")+
  (typeof l.thumb==="string"&&l.thumb.startsWith("data:image/")?`<button type="button" class="lthumb" onclick="openPhotos('${id}')" aria-label="Show photos"><img src="${esc(l.thumb)}" alt="" loading="lazy">${l.photoCount>1?`<span class="lcount">📷 ${l.photoCount}</span>`:""}</button>`:"")+
  `<h3 dir="auto">${esc(l.title)}</h3>`+
  (l.price?`<p class="lprice"><span>${esc(MKT_PRICE[l.category]?MKT_PRICE[l.category][0]:"Price")}:</span> ${esc(l.price)}</p>`:"")+
  (l.description?`<p class="ldesc" dir="auto">${esc(l.description)}</p>`:"")+
  (l.location?`<p class="note lloc">📍 ${esc(l.location)}</p>`:"")+
  `<div class="lcard-f"><a class="btn wa" href="${waListingLink(l)}" target="_blank" rel="noopener">Message on WhatsApp</a>`+
  (own?`<button class="secondary" onclick="editListing('${id}')">Edit</button>`:"")+
  (own||isSiteAdmin()?`<button class="danger" onclick="removeListing('${id}')">${own?"Remove":"Remove (admin)"}</button>`:"")+
  (!own?`<button type="button" class="linkbtn lreport" onclick="reportListing('${id}')">Report</button>`:"")+
  `</div></article>`
}).join(""):`<div class="mkt-empty"><p><b>Nothing here yet.</b></p><p class="note">${authUser?"Be the first to post a listing.":"Sign in to post the first listing."}</p></div>`
}

/* ---------- Posting and editing ---------- */
function startPost(){
if(!authUser){openAuth();$("authMsg").textContent="Sign in or register to post a listing.";return}
mkt.editing=null;mkt.photos=[];mkt.photosDirty=false;fillListingForm({category:mkt.cat==="all"?"gear":mkt.cat});renderPhotoEdit();
$("mktDlgTitle").textContent="Post a listing";$("lSave").textContent="Publish";$("mktDlg").showModal()
}
function editListing(id){
const l=mkt.list.find(x=>x.id===id);if(!l)return;
mkt.editing=id;mkt.photos=[];mkt.photosDirty=false;fillListingForm(l);
$("mktDlgTitle").textContent="Edit listing";$("lSave").textContent="Save changes";$("mktDlg").showModal();
if(l.photoCount){
  mkt.photoBusy=true;renderPhotoEdit();
  window.__cloud.listingPhotos(id).then(r=>{if(mkt.editing!==id)return;mkt.photoBusy=false;mkt.photos=r.ok?r.list:[];renderPhotoEdit()})
}else renderPhotoEdit()
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
if(mkt.photoBusy){msg.textContent="Photos are still loading, one moment…";return}
const data={category:$("lCat").value,title:title.slice(0,80),description:$("lDesc").value.trim().slice(0,1000),price:$("lPrice").value.trim().slice(0,40),location:$("lLoc").value.trim().slice(0,60),phone:ph.phone};
const withPhotos=mkt.photosDirty||(!mkt.editing&&mkt.photos.length);
msg.textContent="Saving…";
if(withPhotos){data.photoCount=mkt.photos.length;data.thumb=mkt.photos.length?await shrinkImage(mkt.photos[0],480,45000):""}
const r=mkt.editing?await window.__cloud.updateListing(mkt.editing,data):await window.__cloud.createListing(data);
if(!r.ok){msg.textContent=r.error==="permission-denied"?"Not allowed. Check that the marketplace rules are published in Firebase.":"Could not save ("+r.error+").";return}
if(withPhotos){
  msg.textContent="Uploading photos…";
  const p=await window.__cloud.setListingPhotos(mkt.editing||r.id,mkt.photos);
  if(!p.ok){msg.textContent=p.error==="permission-denied"?"The listing is saved, but the photos weren't allowed. Publish the latest Firebase rules, then edit the listing to add them.":"The listing is saved, but the photos could not be uploaded ("+p.error+").";loadMarket();return}
}
try{localStorage.setItem("padelPhone","+"+ph.phone)}catch(e){}
$("mktDlg").close();toast(mkt.editing?"Listing updated.":"Listing published.");
if(!mkt.editing){mkt.cat=data.category}
loadMarket()
}
/* ---------- Photos ---------- */
// Any image file → JPEG data URL, at most maxSide px and about maxLen characters (lower quality, then smaller, until it fits)
function shrinkImage(src,maxSide,maxLen){
return new Promise((res,rej)=>{
  const img=new Image(),url=typeof src==="string"?src:URL.createObjectURL(src);
  img.onload=()=>{
    if(typeof src!=="string")URL.revokeObjectURL(url);
    let side=maxSide,q=.82,out="";
    for(let i=0;i<12;i++){
      const k=Math.min(1,side/Math.max(img.width,img.height)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
      out=c.toDataURL("image/jpeg",q);if(out.length<=maxLen)break;
      if(q>.55)q-=.1;else side=Math.round(side*.8);
    }
    res(out)
  };
  img.onerror=()=>{if(typeof src!=="string")URL.revokeObjectURL(url);rej(new Error("not an image"))};
  img.src=url
})
}
async function addPhotos(files){
const msg=$("lMsgM"),list=[...files].filter(f=>/^image\//.test(f.type)),room=4-mkt.photos.length;
if(!list.length)return;
if(room<=0){msg.textContent="You can add up to 4 photos.";return}
if(list.length>room)msg.textContent=`Only the first ${room} photo${room>1?"s were":" was"} added (4 at most).`;
mkt.photoBusy=true;renderPhotoEdit();
for(const f of list.slice(0,room)){
  try{mkt.photos.push(await shrinkImage(f,1600,600000));mkt.photosDirty=true}
  catch(e){msg.textContent=`“${f.name}” could not be read as a photo.`}
}
mkt.photoBusy=false;renderPhotoEdit()
}
function removePhoto(i){mkt.photos.splice(i,1);mkt.photosDirty=true;renderPhotoEdit()}
function firstPhoto(i){const [p]=mkt.photos.splice(i,1);mkt.photos.unshift(p);mkt.photosDirty=true;renderPhotoEdit()}
function renderPhotoEdit(){
const box=$("lPhotos");if(!box)return;
box.innerHTML=mkt.photos.map((p,i)=>`<div class="lph"><img src="${esc(p)}" alt="Photo ${i+1}">${i?`<button type="button" class="lph-main" onclick="firstPhoto(${i})">Make first</button>`:'<span class="lph-main on">First</span>'}<button type="button" class="lph-x" onclick="removePhoto(${i})" aria-label="Remove photo ${i+1}">×</button></div>`).join("")+
  (mkt.photoBusy?'<div class="lph lph-add busy">Working…</div>':mkt.photos.length<4?`<button type="button" class="lph lph-add" onclick="$('lPhotoIn').click()"><span aria-hidden="true">📷</span>Add photo</button>`:"")
}
async function openPhotos(id){
const l=mkt.list.find(x=>x.id===id);if(!l)return;
$("pvTitle").textContent=l.title;$("pvBody").innerHTML=`<img src="${esc(l.thumb)}" alt="">`;$("photoDlg").showModal();
const r=await window.__cloud.listingPhotos(id);
if(r.ok&&r.list.length)$("pvBody").innerHTML=r.list.map((p,i)=>`<img src="${esc(p)}" alt="Photo ${i+1} of ${r.list.length}">`).join("")
}
async function removeListing(id){
if(!confirm("Remove this listing? This can't be undone."))return;
const r=await window.__cloud.deleteListing(id);
if(!r.ok){toast("Could not remove it ("+r.error+").");return}
mkt.list=mkt.list.filter(l=>l.id!==id);renderMarket();toast("Listing removed.")
}

/* ---------- Renewing, reporting and reviewing reports ---------- */
async function renewListing(id){
  const r=await window.__cloud.updateListing(id,{createdAt:Date.now()});
  if(!r.ok){toast("Could not renew it ("+r.error+").");return}
  const l=mkt.list.find(x=>x.id===id);if(l)l.createdAt=Date.now();renderMarket();toast(`Renewed: visible for ${LISTING_DAYS} days.`)
}
async function reportListing(id){
  if(!authUser){openAuth();$("authMsg").textContent="Sign in to report a listing.";return}
  const reason=prompt("What's wrong with this listing? (e.g. scam, offensive, already sold)");
  if(reason===null)return;
  const r=await window.__cloud.reportListing(id,reason.trim().slice(0,300));
  toast(r.ok?"Thanks. The site admin will review this listing.":"Could not send the report ("+r.error+").")
}
async function toggleReports(){
  const box=$("mktReportsBox");
  if(!box.hidden){box.hidden=true;return}
  box.hidden=false;box.innerHTML='<p class="note">Loading reports…</p>';
  const r=await window.__cloud.listReports();
  if(!r.ok){box.innerHTML=`<p class="note">Could not load reports (${esc(r.error)}).</p>`;return}
  mkt.reports=r.list;renderReports()
}
function renderReports(){
  const box=$("mktReportsBox"),list=mkt.reports||[];
  box.innerHTML=`<h3>Reported listings</h3>`+(list.length?list.map(rp=>{const l=mkt.list.find(x=>x.id===rp.listingId);return `<div class="rprow"><div class="rp-main"><b dir="auto">${l?esc(l.title):"Listing already removed"}</b><small>${esc(rp.reason||"No reason given")} · ${ago(rp.createdAt)}</small></div>${l?`<button class="danger" onclick="removeReported('${esc(rp.id)}','${esc(rp.listingId)}')">Remove listing</button>`:""}<button class="secondary" onclick="dismissReport('${esc(rp.id)}')">Dismiss</button></div>`}).join(""):'<p class="note">No reports. All clear.</p>')
}
async function dismissReport(rid){await window.__cloud.dismissReport(rid);mkt.reports=(mkt.reports||[]).filter(x=>x.id!==rid);renderReports()}
async function removeReported(rid,lid){
  if(!confirm("Remove this listing for everyone?"))return;
  const r=await window.__cloud.deleteListing(lid);
  if(!r.ok){toast("Could not remove it ("+r.error+").");return}
  mkt.list=mkt.list.filter(l=>l.id!==lid);await dismissReport(rid);renderMarket();toast("Listing removed.")
}
