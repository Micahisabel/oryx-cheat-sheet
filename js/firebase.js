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
const notificationSubsCollection = db.collection('notificationSubs');
const adminStateCollection = db.collection('adminState');

// --- Supabase (Department Files) -------------------------------------------------
// Department Files are stored entirely in Supabase (a Postgres table + a public Storage
// bucket), not Firebase — Supabase gives real file uploads on a free plan with no card.
// This key is the public "publishable" key: safe to expose in client-side code. Access is
// governed by the row-level rules on the department_files table and department-files bucket.
const SUPABASE_URL = 'https://ylhdsvwzqcshffwohhfy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-8lQTmwPyAsmJXKATTcbpg_OtKG9qJF';
const DEPT_FILES_BUCKET = 'department-files';
const sbClient = (typeof supabase !== 'undefined')
  ? supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
const AUTHOR_KEY = 'oryx-cheatsheet-author-name';
// Google Apps Script Web App that forwards new requests to Slack — the real Slack webhook
// lives only inside that script, never in this public client-side file.
const NOTIFY_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbzhbtDMsdzrpXhHaTQf6hkgtrZLO995vG1L6uqipmaHSzQkvPzMcq9fw_mOd3a_2e3o5g/exec';
const syncStatusEl = document.getElementById('syncStatus');
