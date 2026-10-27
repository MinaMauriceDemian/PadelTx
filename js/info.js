// About & contact and Privacy, shown from the links at the bottom of every page.
// Contact details come from js/config.js (SITE_CONTACT); nothing is shown until they are filled in.
function openInfo(kind){
  const c=window.SITE_CONTACT||{},contact=[c.email?`Email: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:"",c.whatsapp?`WhatsApp: <a href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">+${esc(c.whatsapp)}</a>`:""].filter(Boolean);
  $("infoBody").innerHTML=kind==="privacy"?`<h2>Privacy</h2>
  <p><b>What we store.</b> If you sign in: your name, email address and (with Google) your profile photo. Your player profile holds what you enter: city, club, level, preferences and, if you add it, a WhatsApp number. Tournaments store team and player names and scores. Marketplace listings store what you write, including your WhatsApp number.</p>
  <p><b>Who can see it.</b> Tournaments and their results can be followed by anyone with the link. Public profiles and marketplace listings, including any WhatsApp number you added, are visible to everyone. Your email address is never shown on the site. A private profile is visible only to you.</p>
  <p><b>Your choices.</b> You can follow tournaments without an account. You can edit your profile at any time, make it private, or remove your WhatsApp number; you can remove your own listings. To delete your account and data completely, contact us.</p>
  <p><b>Where it's kept.</b> Accounts and data are stored with Google Firebase. We don't sell your data or use it for advertising. This site doesn't use tracking cookies; it only remembers settings like day/night mode in your browser.</p>
  ${contact.length?`<p>${contact.join("<br>")}</p>`:""}`
  :`<h2>About Padel Tour</h2>
  <p>Padel Tour is a free tool for running and following padel tournaments: live scores, group tables, knockout brackets, Americano, player profiles and a community marketplace.</p>
  <p>Anyone can follow a tournament without an account. Organisers sign in to create tournaments, and can give helpers edit access to enter scores at the courts.</p>
  <p><b>Contact</b><br>${contact.length?contact.join("<br>"):"Contact details will be added here soon. Meanwhile, ask your tournament organiser."}</p>`;
  $("infoDlg").showModal()
}
