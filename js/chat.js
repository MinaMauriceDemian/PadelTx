// Tournament chat (tournaments/{tid}/chat, newest 200 messages). Everyone with the link can read it.
// Public tournaments: signed-in people write. Private tournaments: everyone writes, with a nickname if not signed in.
// The admin and the writer can delete a message. Unread messages show as a badge on the Chat part.
let chatMsgs=[],chatSending=false,chatLastSent=0;

function chatCanWrite(){return !!authUser||state.visibility==="private"}
function chatMyName(){return authUser?(authUser.displayName||(authUser.email||"").split("@")[0]||"Player").slice(0,30):""}
function chatNick(){try{return localStorage.getItem("padelNick")||""}catch(e){return ""}}
function chatSeenKey(){return "padelChatSeen:"+currentTid}
function chatSeen(){try{return +localStorage.getItem(chatSeenKey())||0}catch(e){return 0}}
function markChatSeen(){
if(!chatMsgs.length)return;
try{localStorage.setItem(chatSeenKey(),String(chatMsgs[chatMsgs.length-1].at))}catch(e){}
partBadge("chat",0)
}
function chatMine(m){return authUser?m.uid===authUser.uid:!m.uid&&m.name===chatNick()}

window.__setChat=function(list){
chatMsgs=list;
if(curPart==="chat"&&!document.hidden)markChatSeen();
else{const s=chatSeen();partBadge("chat",chatMsgs.filter(m=>m.at>s&&!chatMine(m)).length)}
renderChat()
};

function chatTime(t){
const d=new Date(t),today=new Date().toDateString()===d.toDateString();
return today?d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+" "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})
}
function renderChat(){
const box=$("chatList");if(!box)return;
if(!window.CLOUD_ON){box.innerHTML='<p class="note">The chat works on the online site.</p>';$("chatForm").hidden=true;$("chatSignIn").hidden=true;return}
const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<80;
box.innerHTML=chatMsgs.length?chatMsgs.map(m=>{
  const mine=chatMine(m),del=(authUser&&m.uid===authUser.uid)||isAdmin()?`<button type="button" class="chatdel" onclick="deleteChat('${esc(m.id)}')" aria-label="Delete message" title="Delete">×</button>`:"";
  const who=m.uid?`<a href="#p=${esc(m.uid)}" onclick="openProfile('${esc(m.uid)}');return false">${esc(m.name)}</a>`:`${esc(m.name)} <span class="chatguest">guest</span>`;
  return `<div class="chatmsg${mine?" mine":""}"><div class="chathead"><b>${who}</b><time>${esc(chatTime(m.at))}</time>${del}</div><p dir="auto">${esc(m.text)}</p></div>`
}).join(""):'<p class="note chatempty">No messages yet. Say hello to the other players!</p>';
if(atEnd)box.scrollTop=box.scrollHeight;
renderChatForm()
}
function renderChatForm(){
const can=chatCanWrite();
$("chatForm").hidden=!can;$("chatSignIn").hidden=can;
if(!can)return;
const nick=$("chatNick");nick.hidden=!!authUser;
if(!authUser&&!nick.value)nick.value=chatNick();
$("chatAs").textContent=authUser?"Writing as "+chatMyName():"Not signed in: choose a nickname the others will see.";
}
function showChat(){
renderChat();
const box=$("chatList");if(box)box.scrollTop=box.scrollHeight;
markChatSeen()
}

async function sendChat(ev){
if(ev)ev.preventDefault();
if(!chatCanWrite()||chatSending||!window.__cloud)return;
const inp=$("chatText"),text=inp.value.trim().slice(0,500);if(!text)return;
let name=chatMyName();
if(!authUser){
  name=$("chatNick").value.trim().slice(0,30);
  if(!name){toast("Enter a nickname first.");$("chatNick").focus();return}
  try{localStorage.setItem("padelNick",name)}catch(e){}
}
if(Date.now()-chatLastSent<2000){toast("Slow down a little.");return}
chatSending=true;$("chatSend").disabled=true;
const r=await window.__cloud.sendChat({name,text});
chatSending=false;$("chatSend").disabled=false;
if(r.ok){chatLastSent=Date.now();inp.value="";inp.focus();const box=$("chatList");box.scrollTop=box.scrollHeight}
else toast(r.error==="permission-denied"?"You can't write in this chat. Sign in first.":"Could not send ("+r.error+").")
}
async function deleteChat(id){
if(!confirm("Delete this message?"))return;
const r=await window.__cloud.deleteChat(id);if(!r.ok)toast("Could not delete ("+r.error+").")
}
