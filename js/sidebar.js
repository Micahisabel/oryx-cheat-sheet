function repositionTabIndicator(container, indicatorSelector, activeSelector){
  const indicator = container.querySelector(indicatorSelector);
  const active = container.querySelector(activeSelector);
  if(!indicator) return;
  // offsetParent === null also catches an "active" match that's currently display:none
  // (e.g. a nav item hidden pending an admin-only visibility toggle) — without this,
  // its 0x0 offsets still get drawn at opacity 1, showing up as a stray dot in the corner.
  if(!active || container.offsetParent === null || active.offsetParent === null){
    indicator.style.opacity = '0';
    return;
  }
  indicator.style.top = active.offsetTop + 'px';
  indicator.style.left = active.offsetLeft + 'px';
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.height = active.offsetHeight + 'px';
  indicator.style.opacity = '1';
}
function repositionAllTabIndicators(){
  repositionTabIndicator(platformNav, '.platform-active-indicator', '.platform-item.active, .sidebar-analytics-item.active');
  [sideNav, shortcutNav, chatgptShortcutNav, otherToolsNav].forEach(nav => {
    repositionTabIndicator(nav, '.cat-tab-indicator', '.cat-tab.active');
  });
}
window.addEventListener('resize', repositionAllTabIndicators);
window.addEventListener('load', repositionAllTabIndicators);

function enterShortcutsMode(group){
  exitAnalyticsMode();
  if(typeof exitDeptFilesMode === "function") exitDeptFilesMode();
  viewMode = 'shortcuts';
  shortcutGroup = group;
  const cats = group === 'chatgpt' ? CHATGPT_SHORTCUT_CATS : CLAUDE_SHORTCUT_CATS;
  const nav = group === 'chatgpt' ? chatgptShortcutNav : shortcutNav;
  const otherNav = group === 'chatgpt' ? shortcutNav : chatgptShortcutNav;
  activeCat = cats[0];
  currentPage = 1;
  sideNav.style.display = 'none';
  otherToolsNav.style.display = 'none';
  nav.style.display = 'flex';
  otherNav.style.display = 'none';
  shortcutsBanner.style.display = 'flex';
  shortcutsBannerLabel.textContent = group === 'chatgpt' ? 'ChatGPT Shortcuts' : 'Claude Shortcuts';
  nav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
  document.querySelectorAll('.platform-submenu-item').forEach(b => b.classList.remove('active'));
  const activeSubmenuBtn = document.getElementById(group === 'chatgpt' ? 'chatgptShortcutsBtn' : 'claudeShortcutsBtn');
  if(activeSubmenuBtn) activeSubmenuBtn.classList.add('active');
  updateAddShortcutVisibility();
  repositionAllTabIndicators();
  render();
}

function exitShortcutsMode(){
  viewMode = 'library';
  shortcutNav.style.display = 'none';
  chatgptShortcutNav.style.display = 'none';
  shortcutsBanner.style.display = 'none';
  if(activePlatform === 'other'){
    activeCat = OTHER_TOOLS_CATS[0];
    sideNav.style.display = 'none';
    otherToolsNav.style.display = 'flex';
    otherToolsNav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
  }else{
    activeCat = 'instructions';
    sideNav.style.display = '';
    otherToolsNav.style.display = 'none';
    sideNav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
  }
  document.querySelectorAll('.platform-submenu-item').forEach(b => b.classList.remove('active'));
  updateAddShortcutVisibility();
  repositionAllTabIndicators();
  render();
}

function updateAddShortcutVisibility(){
  const btn = document.getElementById('openAddShortcut');
  if(btn) btn.style.display = (isAdmin && viewMode === 'shortcuts') ? '' : 'none';
}

document.querySelectorAll('.platform-expand-btn').forEach(btn => {
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const target = document.getElementById(btn.dataset.expand + 'Submenu');
    if(!target) return;
    const isOpen = target.style.display !== 'none';
    target.style.display = isOpen ? 'none' : 'flex';
    btn.classList.toggle('open', !isOpen);
    // Expanding/collapsing the submenu shifts every item below it — the active
    // highlight must be recalculated or it's left floating at its old position.
    repositionAllTabIndicators();
  });
});

const claudeShortcutsBtn = document.getElementById('claudeShortcutsBtn');
if(claudeShortcutsBtn){
  claudeShortcutsBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    platformNav.querySelectorAll('.platform-item').forEach(t => t.classList.remove('active'));
    enterShortcutsMode('claude');
  });
}

const chatgptShortcutsBtn = document.getElementById('chatgptShortcutsBtn');
if(chatgptShortcutsBtn){
  chatgptShortcutsBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    platformNav.querySelectorAll('.platform-item').forEach(t => t.classList.remove('active'));
    enterShortcutsMode('chatgpt');
  });
}

document.getElementById('exitShortcuts').addEventListener('click', () => {
  const claudeBtn = platformNav.querySelector('[data-platform="claude"]');
  platformNav.querySelectorAll('.platform-item').forEach(t => t.classList.remove('active'));
  if(claudeBtn) claudeBtn.classList.add('active');
  activePlatform = 'claude';
  exitShortcutsMode();
});

function handleShortcutTabClick(nav, ev){
  const btn = ev.target.closest('.cat-tab');
  if(!btn) return;
  nav.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  currentPage = 1;
  repositionTabIndicator(nav, '.cat-tab-indicator', '.cat-tab.active');
  render();
}
shortcutNav.addEventListener('click', (ev) => handleShortcutTabClick(shortcutNav, ev));
chatgptShortcutNav.addEventListener('click', (ev) => handleShortcutTabClick(chatgptShortcutNav, ev));
platformNav.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.platform-item');
  if(!btn || btn.disabled) return;
  exitAnalyticsMode();
  if(typeof exitDeptFilesMode === "function") exitDeptFilesMode();
  platformNav.querySelectorAll('.platform-item').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  activePlatform = btn.dataset.platform;
  const wasInShortcuts = viewMode === 'shortcuts';
  if(wasInShortcuts){
    viewMode = 'library';
    sideNav.style.display = '';
    shortcutNav.style.display = 'none';
    chatgptShortcutNav.style.display = 'none';
    shortcutsBanner.style.display = 'none';
    document.querySelectorAll('.platform-submenu-item').forEach(b => b.classList.remove('active'));
  }
  if(activePlatform === 'all'){
    activeCat = 'all';
    sideNav.style.display = '';
    otherToolsNav.style.display = 'none';
    sideNav.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  } else if(activePlatform === 'other'){
    activeCat = OTHER_TOOLS_CATS[0];
    sideNav.style.display = 'none';
    otherToolsNav.style.display = 'flex';
    otherToolsNav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
  } else {
    // Claude / ChatGPT — always land on the Instruction tab (visible to everyone) so the
    // view is consistent and the category explainer shows, instead of a stale/"all" selection.
    activeCat = 'instructions';
    sideNav.style.display = '';
    otherToolsNav.style.display = 'none';
    sideNav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
  }
  if(btn.dataset.platform === 'claude' || btn.dataset.platform === 'chatgpt'){
    const submenu = document.getElementById(btn.dataset.platform + 'Submenu');
    const expandBtn = platformNav.querySelector(`.platform-expand-btn[data-expand="${btn.dataset.platform}"]`);
    if(submenu) submenu.style.display = 'flex';
    if(expandBtn) expandBtn.classList.add('open');
  }
  currentPage = 1;
  repositionAllTabIndicators();
  render();
});

sideNav.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.cat-tab');
  if(!btn) return;
  sideNav.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  currentPage = 1;
  repositionTabIndicator(sideNav, '.cat-tab-indicator', '.cat-tab.active');
  render();
});

otherToolsNav.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.cat-tab');
  if(!btn) return;
  otherToolsNav.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  currentPage = 1;
  repositionTabIndicator(otherToolsNav, '.cat-tab-indicator', '.cat-tab.active');
  render();
});

// Keep --header-h in sync with the real (sticky) header height, so the sidebar below it
// always fills exactly the remaining viewport — header height varies as its content wraps.
const siteHeaderEl = document.querySelector('header');
function syncHeaderHeightVar(){
  document.documentElement.style.setProperty('--header-h', siteHeaderEl.offsetHeight + 'px');
}
syncHeaderHeightVar();
new ResizeObserver(syncHeaderHeightVar).observe(siteHeaderEl);

// Default the landing view to All Platforms (the full, unfiltered library).
// Reuses the real click handler so state, indicator, and category selection set up exactly as a user click.
// Deferred to 'load' so every script (e.g. exitAnalyticsMode in analytics.js) is defined first.
window.addEventListener('load', () => {
  const defaultPlatformBtn = platformNav.querySelector('[data-platform="claude"]');
  if(defaultPlatformBtn) defaultPlatformBtn.click();
});

repositionAllTabIndicators();
