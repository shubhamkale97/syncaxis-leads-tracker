// =====================================================================
// Tab Navigation Overlay for Syncaxis Leads Tracker
// =====================================================================
// This script transforms the existing stacked layout into a tabbed UI
// without modifying index.html. It runs after the page is fully loaded,
// wraps existing sections into tab panels, and adds a tab bar.
// =====================================================================
(function() {
  'use strict';

  // ---- Inject CSS ----
  const css = `
    .tab-bar{display:flex;gap:0;border-bottom:2px solid var(--line);margin:0 0 20px;padding:0 20px;flex-wrap:wrap;}
    .tab-btn{background:none;border:none;color:var(--text-muted);padding:12px 20px;font:600 13px/1.4 inherit;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s;white-space:nowrap;}
    .tab-btn:hover{color:var(--text);}
    .tab-btn.active{color:var(--accent);border-bottom-color:var(--accent);}
    .tab-btn .tab-badge{display:inline-block;background:var(--panel2);color:var(--text-muted);font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;min-width:20px;text-align:center;}
    .tab-btn.active .tab-badge{background:rgba(74,144,217,.16);color:var(--accent);}
    .tab-panel{display:none;}
    .tab-panel.active{display:block;}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- Wait for the page to render ----
  function initTabs() {
    // Find the key elements
    const kpiRow = document.getElementById('kpiRow');
    if (!kpiRow) return; // page not ready yet

    // Check if tabs are already initialized
    if (document.getElementById('tabBar')) return;

    // Find all top-level sections
    const allSections = document.querySelectorAll('.section');
    if (allSections.length === 0) return;

    // Identify each section by its title
    let followUpSection = null, pipelineSection = null, demandSection = null,
        matrixSection = null, leadDetailSection = null;
    allSections.forEach(sec => {
      const title = sec.querySelector('.section-title');
      if (!title) return;
      const t = title.textContent.trim();
      if (t === 'Follow-Up Activity') followUpSection = sec;
      else if (t === 'Pipeline Health') pipelineSection = sec;
      else if (t === 'Where the demand is') demandSection = sec;
      else if (t === 'Area \u00d7 Application Matrix') matrixSection = sec;
      else if (t === 'Lead Detail \u2014 Edit & Follow Up') leadDetailSection = sec;
    });

    if (!pipelineSection || !leadDetailSection) return; // not the right page

    // Find the parent container
    const mainContainer = kpiRow.parentElement;

    // Create tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    tabBar.id = 'tabBar';
    tabBar.innerHTML = `
      <button class="tab-btn active" data-tab="overview">\u{1F4CA} Overview</button>
      <button class="tab-btn" data-tab="followup">\u{1F514} Follow-Up Activity <span class="tab-badge" id="followupBadge">0</span></button>
      <button class="tab-btn" data-tab="leads">\u{1F4CB} All Leads <span class="tab-badge" id="leadsBadge">0</span></button>
    `;

    // Create tab panels
    const overviewPanel = document.createElement('div');
    overviewPanel.className = 'tab-panel active';
    overviewPanel.id = 'tab-overview';

    const followUpPanel = document.createElement('div');
    followUpPanel.className = 'tab-panel';
    followUpPanel.id = 'tab-followup';

    const leadsPanel = document.createElement('div');
    leadsPanel.className = 'tab-panel';
    leadsPanel.id = 'tab-leads';

    // Move elements into panels
    if (kpiRow) overviewPanel.appendChild(kpiRow);
    if (pipelineSection) overviewPanel.appendChild(pipelineSection);
    if (demandSection) overviewPanel.appendChild(demandSection);
    if (matrixSection) overviewPanel.appendChild(matrixSection);
    if (followUpSection) followUpPanel.appendChild(followUpSection);
    if (leadDetailSection) leadsPanel.appendChild(leadDetailSection);

    // Insert into DOM
    const footer = mainContainer.querySelector('footer');
    if (footer) {
      mainContainer.insertBefore(tabBar, footer);
      mainContainer.insertBefore(overviewPanel, footer);
      mainContainer.insertBefore(followUpPanel, footer);
      mainContainer.insertBefore(leadsPanel, footer);
    } else {
      mainContainer.appendChild(tabBar);
      mainContainer.appendChild(overviewPanel);
      mainContainer.appendChild(followUpPanel);
      mainContainer.appendChild(leadsPanel);
    }

    // ---- Tab switching logic ----
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        const panel = document.getElementById('tab-' + this.dataset.tab);
        if (panel) panel.classList.add('active');
        if (this.dataset.tab === 'leads' && typeof renderTable === 'function') {
          renderTable();
        }
      });
    });

    // ---- Update tab badges ----
    function updateBadges() {
      const followUpList = document.getElementById('followUpList');
      const badge = document.getElementById('followupBadge');
      if (followUpList && badge) {
        const items = followUpList.querySelectorAll('.followup-item, .followup-item-company, [class*="followup"]');
        const kpis = document.getElementById('followUpKpiRow');
        if (kpis) {
          const kpiTexts = kpis.querySelectorAll('.kpi b, .kpi-card b, [class*="kpi"] b');
          let total = 0;
          kpiTexts.forEach(b => {
            const n = parseInt(b.textContent.replace(/[^0-9]/g, ''));
            if (!isNaN(n)) total += n;
          });
          badge.textContent = total || items.length;
        } else {
          badge.textContent = items.length;
        }
      }

      const leadsBody = document.getElementById('leadsBody');
      const leadsBadge = document.getElementById('leadsBadge');
      if (leadsBody && leadsBadge) {
        const count = leadsBody.querySelectorAll('tr').length;
        leadsBadge.textContent = count;
      }
    }

    // Hook into render functions to update badges
    const origRenderAll = window.renderAll;
    if (typeof origRenderAll === 'function') {
      window.renderAll = function() {
        origRenderAll.apply(this, arguments);
        setTimeout(updateBadges, 50);
      };
    }

    const origRenderTable = window.renderTable;
    if (typeof origRenderTable === 'function') {
      window.renderTable = function() {
        origRenderTable.apply(this, arguments);
        setTimeout(updateBadges, 50);
      };
    }

    // Initial badge update
    setTimeout(updateBadges, 500);

    // Observe DOM changes
    const observer = new MutationObserver(() => {
      setTimeout(updateBadges, 50);
    });
    const leadsBody = document.getElementById('leadsBody');
    const followUpList = document.getElementById('followUpList');
    if (leadsBody) observer.observe(leadsBody, { childList: true });
    if (followUpList) observer.observe(followUpList, { childList: true, subtree: true });

    console.log('[Tabs] Tab navigation initialized');
  }

  // Run after the page is fully loaded and rendered
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initTabs, 100));
  } else {
    setTimeout(initTabs, 100);
  }
  setTimeout(initTabs, 2000);
  setTimeout(initTabs, 5000);
})();
