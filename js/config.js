// ================= FIREBASE SETTINGS =================
// Paste your project's web-app config here (Firebase console > Project settings > Your apps).
// While the values still start with "PASTE", the app runs in Local mode (data stays in this browser, everyone is admin).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDbKIryV22Ry-GluYB1A8l_V0YlWwuY4Yo",
  authDomain: "padeltx-857c6.firebaseapp.com",
  projectId: "padeltx-857c6",
  storageBucket: "padeltx-857c6.firebasestorage.app",
  messagingSenderId: "426314614472",
  appId: "1:426314614472:web:d930b37269610dac20c7fd"
};
window.CLOUD_ON = !!(window.FIREBASE_CONFIG.apiKey && !/^PASTE/.test(window.FIREBASE_CONFIG.apiKey));
// Site admins: can remove any marketplace listing and delete any tournament (must match isSiteAdmin in firestore.rules)
window.MARKET_ADMINS = ["minamorise@gmail.com"];
// Shown under "About & contact" and "Privacy". Leave empty to hide; WhatsApp as digits with country code, e.g. "4917012345678"
window.SITE_CONTACT = { email: "", whatsapp: "" };
