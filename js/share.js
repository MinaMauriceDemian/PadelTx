// Sharing: the share dialog and WhatsApp messages for the tournament link and the results.
function tName(){return state.name||"Padel Tour tournament"}
function openShare(){
$("shareInfo").textContent=currentTid?`Tournament ID: ${currentTid}`:"Send the results as a WhatsApp message.";
document.querySelectorAll("[data-needs-link]").forEach(el=>el.hidden=!currentTid);
$("nativeShare").hidden=!navigator.share;
$("shareDlg").showModal()
}
function linkText(){return `🎾 *${tName()}*\nFollow the scores live:\n${tournamentUrl()}\n\nTournament ID: ${currentTid}`}
// Final ranking once it is complete; otherwise the group standings so far plus any knockout results
function resultsText(){
const P=placements(),done=P.length&&P.every(p=>p.t!=null),med=["🥇","🥈","🥉"],L=[`🎾 *${tName()}*`];
if(done){
  L.push("","🏆 *Final ranking*");
  P.forEach((p,i)=>L.push(`${med[i]||ord(i+1)+"."} ${teamName(p.t)}`));
}else{
  const gl=groupLetters();
  L.push("","📊 *Standings so far*");
  gl.forEach(g=>{
    if(gl.length>1)L.push("",`_Group ${g}_`);
    getStand(g).forEach((x,i)=>L.push(`${i+1}. ${teamName(x.i)}: ${x.pts} pts (${x.w}W ${x.l}L, ${x.diff>0?"+":""}${x.diff})`));
  });
  const ko=allMatches().filter(m=>m.ko&&score(m.id));
  if(ko.length){
    L.push("","🏆 *Knockout results*");
    ko.forEach(m=>{const s=score(m.id);L.push(`${koTitle(m.id)}: ${teamName(matchTeam(m.id,"a"))} ${s.a}–${s.b} ${teamName(matchTeam(m.id,"b"))}`)});
  }
}
if(currentTid)L.push("",`Live scores: ${tournamentUrl()}`);
return L.join("\n")
}
function waShare(kind){
const text=kind==="link"?linkText():resultsText();
window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener")
}
async function nativeShare(){
try{await navigator.share({title:tName(),text:resultsText()})}catch(e){}
}
