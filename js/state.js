let entries = [];
// Admin overrides for whether an Other AI Tools card shows as "used" (no glass) or not.
// Keyed by entry id -> boolean. Lives in adminState/otherToolsUsage. When an id is absent
// here, isOtherToolUsed() falls back to the USED_OTHER_TOOLS code list in constants.js.
let otherToolsUsage = {};
let activeCat = 'instructions';
let activePlatform = 'claude';
let searchTerm = '';
let activeDepartment = 'all';
let currentPage = 1;
let viewMode = 'library';
let shortcutGroup = 'claude';
const PAGE_SIZE = 8;

const grid = document.getElementById('grid');
const pagination = document.getElementById('pagination');
const countRow = document.getElementById('countRow');
const catExplainer = document.getElementById('catExplainer');
const sideNav = document.getElementById('sideNav');
const otherToolsNav = document.getElementById('otherToolsNav');
const shortcutNav = document.getElementById('shortcutNav');
const chatgptShortcutNav = document.getElementById('chatgptShortcutNav');
const shortcutsBanner = document.getElementById('shortcutsBanner');
const shortcutsBannerLabel = document.getElementById('shortcutsBannerLabel');
const platformNav = document.getElementById('platformNav');
const overlay = document.getElementById('overlay');
const searchInput = document.getElementById('searchInput');
const recentStrip = document.getElementById('recentStrip');
const recentRow = document.getElementById('recentRow');
