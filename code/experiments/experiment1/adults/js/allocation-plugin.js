/**
 * jsPsych Allocation Plugin
 *
 * Presents P's cookies (center) flanked by Trash and V panels.
 * Participants drag P's cookies to V or Trash.
 * Records cookies_to_v, cookies_to_trash, cookies_kept_by_p, rt.
 *
 * Requires: jsPsych 7
 */
var jsPsychAllocation = (function (jspsych) {

  const info = {
    name: 'allocation',
    version: '1.0.0',
    parameters: {
      /** How many cookies P currently has (all draggable) */
      p_cookies: { type: jspsych.ParameterType.INT, default: 5 },
      /** How many cookies V has AFTER harm (shown as filled, non-draggable) */
      v_cookies_current: { type: jspsych.ParameterType.INT, default: 2 },
      /** P's initial cookie count shown in the HUD */
      hud_p_cookies: { type: jspsych.ParameterType.INT, default: 5 },
      /** V's initial cookie count shown in the HUD */
      hud_v_cookies: { type: jspsych.ParameterType.INT, default: 5 },
      /** Whether to put the Trash panel on the left (true) or right (false) */
      trash_on_left: { type: jspsych.ParameterType.BOOL, default: true },
      /** Harm description shown above the allocation columns */
      harm_text: { type: jspsych.ParameterType.HTML_STRING, default: '' },
      /** Instruction overlay text (for practice trials) */
      instruction_text: { type: jspsych.ParameterType.HTML_STRING, default: '' },
      /** Require ≥1 cookie given to V before submission (practice) */
      require_v: { type: jspsych.ParameterType.BOOL, default: false },
      /** Require ≥1 cookie put in Trash before submission (practice) */
      require_trash: { type: jspsych.ParameterType.BOOL, default: false },
      /** Require ≥1 cookie in both V AND Trash before submission (practice) */
      require_both: { type: jspsych.ParameterType.BOOL, default: false },
      /** Whether this is a practice trial (changes button label) */
      is_practice: { type: jspsych.ParameterType.BOOL, default: false },
      /** Scenario identifier stored in data */
      scenario_id: { type: jspsych.ParameterType.INT, default: 0 },
      /** harm type stored in data */
      harm_type: { type: jspsych.ParameterType.STRING, default: '' },
    }
  };

  class AllocationPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const startTime = performance.now();

      /* -------------------------------------------------------
         STATE
      ------------------------------------------------------- */
      const MAX_SLOTS = 5;
      const maxGiveV = MAX_SLOTS - trial.v_cookies_current; // empty slots in V panel

      // Each P cookie is tracked by index 0-4
      // destination: 'pool' | 'v' | 'trash'
      const cookieDest = Array.from({ length: trial.p_cookies }, () => 'pool');

      /* -------------------------------------------------------
         HELPER: build cookie grid HTML
         size: 'large' | 'medium' | 'small'
         filled: number filled
         slotClass: extra classes on each slot
         idPrefix: for unique slot ids
      ------------------------------------------------------- */
      function cookieGridHTML(filled, total, size, idPrefix, extraSlotClass) {
        const sc = extraSlotClass || '';
        const layout = [[0, 1, 2], [3, 4]];
        let html = '<div class="cookie-grid' + (size === 'small' ? ' hud-grid' : '') + '">';
        layout.forEach((row, ri) => {
          html += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
          row.forEach(i => {
            if (i >= total) return; // fewer than 5 slots
            const isFilled = i < filled;
            const id = idPrefix ? ' id="' + idPrefix + '-' + i + '"' : '';
            html += '<div class="cookie-slot ' + size + ' ' + (isFilled ? 'filled' : 'empty') + ' ' + sc + '"' + id + '>';
            if (isFilled) html += '<span class="cookie-emoji">🍪</span>';
            html += '</div>';
          });
          html += '</div>';
        });
        html += '</div>';
        return html;
      }

      /* -------------------------------------------------------
         HELPER: build trash panel HTML
      ------------------------------------------------------- */
      function trashPanelHTML() {
        const layout = [[0, 1, 2], [3, 4]];
        let gridHTML = '<div class="drop-grid" id="trash-drop-grid">';
        layout.forEach((row, ri) => {
          gridHTML += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
          row.forEach(i => {
            gridHTML += `<div class="cookie-slot medium empty drop-slot" id="trash-slot-${i}" data-zone="trash" data-index="${i}"></div>`;
          });
          gridHTML += '</div>';
        });
        gridHTML += '</div>';

        return `
          <div class="alloc-panel" id="trash-panel">
            <div class="trash-icon-area">
              <img src="img/cookie_jar.png" class="cookie-jar-img" alt="Cookie jar">
            </div>
            <div class="panel-name">Put the cookie back to the cookie jar</div>
            ${gridHTML}
          </div>`;
      }

      /* -------------------------------------------------------
         HELPER: build V panel HTML
      ------------------------------------------------------- */
      function vPanelHTML() {
        // V's existing (permanent) cookies
        let existingHTML = `<div class="v-existing-grid" id="v-existing-grid">`;
        const layout = [[0, 1, 2], [3, 4]];
        layout.forEach((row, ri) => {
          existingHTML += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
          row.forEach(i => {
            if (i >= trial.v_cookies_current) return;
            existingHTML += `<div class="cookie-slot medium filled" id="v-existing-${i}"><span class="cookie-emoji">🍪</span></div>`;
          });
          existingHTML += '</div>';
        });
        existingHTML += '</div>';

        // V's empty (droppable) slots – only if V can receive more
        let dropHTML = '';
        if (maxGiveV > 0) {
          dropHTML = '<div class="drop-grid" id="v-drop-grid">';
          let emptyCount = 0;
          layout.forEach((row, ri) => {
            const rowSlots = row.filter(i => {
              const slotAbsIndex = trial.v_cookies_current + emptyCount;
              if (i - (ri === 0 ? 0 : 3) + (ri * 3) >= maxGiveV) return false;
              return true;
            });
            // Simpler: just iterate needed empty slots
          });
          // Build empty slots directly
          const emptySlotLayout = buildEmptySlotLayout(maxGiveV);
          dropHTML += emptySlotLayout;
          dropHTML += '</div>';
        }

        const vLabel = trial.v_cookies_current > 0
          ? `Cleo has ${trial.v_cookies_current} cookie${trial.v_cookies_current !== 1 ? 's' : ''}`
          : 'Cleo has 0 cookies';

        return `
          <div class="alloc-panel" id="v-panel">
            <img src="img/Cleo.png" class="alloc-char-img" alt="Cleo">
            <p class="alloc-char-name">Cleo</p>
            <div class="panel-name">${vLabel}</div>
            ${trial.v_cookies_current > 0 ? existingHTML : ''}
            ${dropHTML}
          </div>`;
      }

      /* Build empty drop slot layout for V */
      function buildEmptySlotLayout(count) {
        if (count === 0) return '';
        const layout = [[0, 1, 2], [3, 4]];
        let html = '';
        layout.forEach((row, ri) => {
          const rowSlots = row.filter(i => i < count);
          if (rowSlots.length === 0) return;
          html += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
          rowSlots.forEach(i => {
            html += `<div class="cookie-slot medium empty drop-slot" id="v-slot-${i}" data-zone="v" data-index="${i}"></div>`;
          });
          html += '</div>';
        });
        return html;
      }

      /* -------------------------------------------------------
         HELPER: build P pool HTML (draggable cookies)
      ------------------------------------------------------- */
      function pPoolHTML() {
        const layout = [[0, 1, 2], [3, 4]];
        let html = '<div id="p-pool-grid">';
        layout.forEach((row, ri) => {
          html += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
          row.forEach(i => {
            if (i >= trial.p_cookies) return;
            html += `<div class="cookie-slot medium filled draggable" id="p-cookie-${i}" data-cookie-id="${i}" draggable="false">
              <span class="cookie-emoji">🍪</span>
            </div>`;
          });
          html += '</div>';
        });
        html += '</div>';
        return html;
      }

      /* -------------------------------------------------------
         BUILD FULL SCREEN HTML
      ------------------------------------------------------- */
      const leftPanel = trial.trash_on_left ? trashPanelHTML() : vPanelHTML();
      const rightPanel = trial.trash_on_left ? vPanelHTML() : trashPanelHTML();

      const confirmLabel = trial.is_practice ? 'Done' : 'Confirm';

      const html = `
        <div class="allocation-screen">
          ${trial.harm_text ? `<div class="allocation-harm-text">${trial.harm_text}</div>` : ''}
          ${trial.instruction_text ? `<div class="allocation-instruction">${trial.instruction_text}</div>` : ''}
          <div class="allocation-columns">
            ${leftPanel}
            <div class="p-pool-col">
              <img src="img/Finn.png" class="alloc-char-img" alt="Finn">
              <p class="alloc-char-name">Finn</p>
              <div class="panel-name">Finn has ${trial.p_cookies} cookies</div>
              ${pPoolHTML()}
            </div>
            ${rightPanel}
          </div>
          <div class="allocation-btn-row">
            <button id="confirm-btn" ${needsDisabled() ? 'disabled' : ''}>
              ${confirmLabel}
            </button>
            ${!trial.is_practice ? `<button id="do-nothing-btn">Do Nothing</button>` : ''}
          </div>
        </div>

        <!-- Ghost element for drag visual -->
        <div id="drag-ghost" style="display:none;">
          <div class="cookie-slot medium filled" style="pointer-events:none;">
            <span class="cookie-emoji">🍪</span>
          </div>
        </div>
      `;

      display_element.innerHTML = html;

      function needsDisabled() {
        if (trial.require_v || trial.require_trash || trial.require_both) return true;
        return false;
      }

      /* -------------------------------------------------------
         DRAG AND DROP LOGIC
      ------------------------------------------------------- */
      let dragging = null;
      let ghostEl = display_element.querySelector('#drag-ghost');

      function getCookieEl(id) {
        return display_element.querySelector(`#p-cookie-${id}`);
      }

      // Find the first empty slot in a zone
      function firstEmptySlot(zone) {
        const slots = display_element.querySelectorAll(`.drop-slot[data-zone="${zone}"]`);
        for (const slot of slots) {
          if (!slot.dataset.cookieId) return slot;
        }
        return null;
      }

      // Count cookies currently in a zone
      function countInZone(zone) {
        return cookieDest.filter(d => d === zone).length;
      }

      // Update confirm button state
      function updateConfirmBtn() {
        const btn = display_element.querySelector('#confirm-btn');
        const inV = countInZone('v');
        const inTrash = countInZone('trash');
        let satisfied = true;
        if (trial.require_v && inV < 1) satisfied = false;
        if (trial.require_trash && inTrash < 1) satisfied = false;
        if (trial.require_both && (inV < 1 || inTrash < 1)) satisfied = false;
        btn.disabled = !satisfied;
      }

      // Place cookie into a drop slot (or return to pool)
      function moveCookieTo(cookieId, zone, slotEl) {
        const prevZone = cookieDest[cookieId];

        // Free the previous slot if in trash or v
        if (prevZone === 'trash' || prevZone === 'v') {
          display_element.querySelectorAll(`.drop-slot[data-zone="${prevZone}"]`).forEach(s => {
            if (parseInt(s.dataset.cookieId) === cookieId) {
              s.innerHTML = '';
              s.classList.remove('filled');
              s.classList.add('empty');
              delete s.dataset.cookieId;
            }
          });
        }

        const pEl = getCookieEl(cookieId);
        if (zone === 'pool') {
          cookieDest[cookieId] = 'pool';
          if (pEl) { pEl.style.opacity = '1'; pEl.classList.remove('dragging'); }
        } else {
          cookieDest[cookieId] = zone;
          slotEl.innerHTML = '<span class="cookie-emoji">🍪</span>';
          slotEl.classList.remove('empty');
          slotEl.classList.add('filled');
          slotEl.dataset.cookieId = String(cookieId);
          if (pEl) { pEl.style.opacity = '0.25'; pEl.classList.remove('dragging'); }
        }

        updateConfirmBtn();
      }

      function showGhost(x, y) {
        ghostEl.style.display = 'block';
        ghostEl.style.left = (x - 28) + 'px';
        ghostEl.style.top  = (y - 21) + 'px';
      }

      function hideGhost() {
        ghostEl.style.display = 'none';
      }

      /* Mouse events on the whole display element */
      display_element.addEventListener('mousedown', (e) => {
        const cookieEl = e.target.closest('.cookie-slot.draggable');
        if (!cookieEl) return;
        const cookieId = parseInt(cookieEl.dataset.cookieId);
        if (isNaN(cookieId)) return;
        if (cookieDest[cookieId] !== 'pool') return;

        e.preventDefault();
        dragging = { cookieId };
        cookieEl.classList.add('dragging');
        showGhost(e.clientX, e.clientY);
      });

      // Click a filled drop-slot to return its cookie to P's pool
      display_element.addEventListener('click', (e) => {
        if (dragging) return;
        const slotEl = e.target.closest('.drop-slot.filled');
        if (!slotEl) return;
        const cid = parseInt(slotEl.dataset.cookieId);
        if (isNaN(cid)) return;
        moveCookieTo(cid, 'pool', null);
      });

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      function onMouseMove(e) {
        if (!dragging) return;
        showGhost(e.clientX, e.clientY);
      }

      function onMouseUp(e) {
        if (!dragging) return;

        const { cookieId } = dragging;
        dragging = null;
        hideGhost(); // hide and keep hidden — do NOT re-show

        const pEl = getCookieEl(cookieId);
        if (pEl) pEl.classList.remove('dragging');

        // Ghost has pointer-events:none so document.elementFromPoint sees through it
        const target = document.elementFromPoint(e.clientX, e.clientY);

        // Accept drop on an exact empty slot OR anywhere inside a panel (snap to first empty slot)
        const directSlot = target ? target.closest('.drop-slot.empty') : null;
        const panel      = target ? target.closest('#v-panel, #trash-panel') : null;

        let zone = null;
        let slot = null;

        if (directSlot) {
          zone = directSlot.dataset.zone;
          slot = directSlot;
        } else if (panel) {
          zone = panel.id === 'trash-panel' ? 'trash' : 'v';
          slot = firstEmptySlot(zone);
        }

        if (zone && slot) {
          if (zone === 'v' && countInZone('v') >= maxGiveV) {
            // V is full – leave cookie in pool
            if (pEl) pEl.style.opacity = '1';
          } else {
            moveCookieTo(cookieId, zone, slot);
          }
        } else {
          // Dropped outside any valid zone – return to pool
          if (pEl) pEl.style.opacity = '1';
        }
      }

      /* -------------------------------------------------------
         CONFIRM BUTTON
      ------------------------------------------------------- */
      function finishAllocation(doNothing) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const inV     = doNothing ? 0 : countInZone('v');
        const inTrash = doNothing ? 0 : countInZone('trash');
        const inPool  = doNothing ? trial.p_cookies : countInZone('pool');

        this.jsPsych.finishTrial({
          scenario_id: trial.scenario_id,
          harm_type: trial.harm_type,
          v_initial: trial.hud_v_cookies,
          v_after_harm: trial.v_cookies_current,
          cookies_to_v: inV,
          cookies_to_trash: inTrash,
          cookies_kept_by_p: inPool,
          do_nothing: doNothing,
          trash_on_left: trial.trash_on_left,
          is_practice: trial.is_practice,
          rt: Math.round(performance.now() - startTime),
        });
      }

      display_element.querySelector('#confirm-btn').addEventListener('click', () => {
        finishAllocation.call(this, false);
      });

      if (!trial.is_practice) {
        display_element.querySelector('#do-nothing-btn').addEventListener('click', () => {
          finishAllocation.call(this, true);
        });
      }
    } // end trial()
  } // end class

  AllocationPlugin.info = info;
  return AllocationPlugin;

})(jsPsychModule);
