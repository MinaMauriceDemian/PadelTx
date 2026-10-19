// Starts the app. Loaded last of the classic scripts.
init();
initDragDrop();
// Cloud mode starts on the login page (or the tournament list for returning viewers).
// A shared link (#t=ID) skips the login page and opens the tournament directly once connected.
if(window.CLOUD_ON)showView(hashId()?"landing":homeView());
// Switch between the table (computer) and match cards (phone) when the screen size changes
phoneMQ.addEventListener("change",()=>renderAll());
// Keep the live "now" marker up to date
setInterval(()=>{if(view==="app"||!window.CLOUD_ON)applyLive()},30000);
