function repositionTabIndicator(container, indicatorSelector, activeSelector){
  const indicator = container.querySelector(indicatorSelector);
  const active = container.querySelector(activeSelector);
  if(!indicator) return;
  if(!active || container.offsetParent === null){
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
    activeCat = 'skills';
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
  const allBtn = platformNav.querySelector('[data-platform="all"]');
  platformNav.querySelectorAll('.platform-item').forEach(t => t.classList.remove('active'));
  if(allBtn) allBtn.classList.add('active');
  activePlatform = 'all';
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
    sideNav.style.display = '';
    otherToolsNav.style.display = 'none';
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

repositionAllTabIndicators();
