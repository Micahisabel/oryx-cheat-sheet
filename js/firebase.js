// ============= Firebase =============
const firebaseConfig = {
  apiKey: "AIzaSyAyux2Zu-651KTK7w8BowxbV9Hjb6t_2UE",
  authDomain: "oryx-cheat-sheet.firebaseapp.com",
  projectId: "oryx-cheat-sheet",
  storageBucket: "oryx-cheat-sheet.firebasestorage.app",
  messagingSenderId: "449130107014",
  appId: "1:449130107014:web:6539982ce0bdc1fb910107"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const entriesCollection = db.collection('entries');
const suggestionsCollection = db.collection('suggestions');
const favoritesCollection = db.collection('favorites');
const AUTHOR_KEY = 'oryx-cheatsheet-author-name';
// Google Apps Script Web App that forwards new requests to Slack — the real Slack webhook
// lives only inside that script, never in this public client-side file.
const NOTIFY_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbzhbtDMsdzrpXhHaTQf6hkgtrZLO995vG1L6uqipmaHSzQkvPzMcq9fw_mOd3a_2e3o5g/exec';
const syncStatusEl = document.getElementById('syncStatus');
