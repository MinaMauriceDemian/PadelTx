// Day / night mode. Loaded in <head> so the page never flashes the wrong colors.
// First visit follows the phone/computer setting; after that the person's own choice is remembered.
(function(){
  var t=null;
  try{t=localStorage.getItem("padelTheme")}catch(e){}
  if(t!=="dark"&&t!=="light")t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.setAttribute("data-theme",t);
})();
function currentTheme(){return document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light"}
function applyThemeChrome(){
  var dark=currentTheme()==="dark";
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"#0C1A36":"#0B3D91");
  document.querySelectorAll(".themebtn").forEach(function(b){
    var l=dark?"Switch to day mode":"Switch to night mode";b.setAttribute("aria-label",l);b.setAttribute("title",l)
  });
}
function toggleTheme(){
  var t=currentTheme()==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("padelTheme",t)}catch(e){}
  applyThemeChrome();
}
document.addEventListener("DOMContentLoaded",applyThemeChrome);
