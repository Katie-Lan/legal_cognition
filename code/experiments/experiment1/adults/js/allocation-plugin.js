/**
 * jsPsych Allocation Plugin — Plate Edition
 *
 * P's cookies sit on an open circular plate in the center.
 * Participants drag them freely onto V's plate or the Trash panel.
 * Cookies land where dropped (no slot snapping). No capacity cap on V's plate.
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
      p_cookies:         { type: jspsych.ParameterType.INT,         default: 5 },
      /** How many cookies V has AFTER harm (shown on V's plate, non-draggable) */
      v_cookies_current: { type: jspsych.ParameterType.INT,         default: 2 },
      /** P's initial cookie count shown in the HUD */
      hud_p_cookies:     { type: jspsych.ParameterType.INT,         default: 5 },
      /** V's initial cookie count shown in the HUD */
      hud_v_cookies:     { type: jspsych.ParameterType.INT,         default: 5 },
      /** Whether to put the Trash panel on the left (true) or right (false) */
      trash_on_left:     { type: jspsych.ParameterType.BOOL,        default: true },
      /** Harm description shown above the allocation columns */
      harm_text:         { type: jspsych.ParameterType.HTML_STRING, default: '' },
      /** Instruction overlay text (for practice trials) */
      instruction_text:  { type: jspsych.ParameterType.HTML_STRING, default: '' },
      /** Require ≥1 cookie given to V before submission (practice) */
      require_v:         { type: jspsych.ParameterType.BOOL,        default: false },
      /** Require ≥1 cookie put in Trash before submission (practice) */
      require_trash:     { type: jspsych.ParameterType.BOOL,        default: false },
      /** Require ≥1 cookie in both V AND Trash before submission (practice) */
      require_both:      { type: jspsych.ParameterType.BOOL,        default: false },
      /** Whether this is a practice trial (changes button label) */
      is_practice:       { type: jspsych.ParameterType.BOOL,        default: false },
      /** Scenario identifier stored in data */
      scenario_id:       { type: jspsych.ParameterType.INT,         default: 0 },
      /** harm type stored in data */
      harm_type:         { type: jspsych.ParameterType.STRING,      default: '' },
      /** Character names and images (overridable per scenario) */
      p_name: { type: jspsych.ParameterType.STRING, default: 'Finn' },
      v_name: { type: jspsych.ParameterType.STRING, default: 'Cleo' },
      p_img:  { type: jspsych.ParameterType.STRING, default: 'finn_neutral.png' },
      v_img:  { type: jspsych.ParameterType.STRING, default: 'cleo_neutral.png' },
      /** Show "Do Nothing" button even on practice trials */
      allow_do_nothing: { type: jspsych.ParameterType.BOOL, default: false },
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
      // 'pool' | 'v' | 'trash'
      const cookieDest = Array.from({ length: trial.p_cookies }, () => 'pool');

      /* -------------------------------------------------------
         PLATE GEOMETRY
      ------------------------------------------------------- */
      const PLATE_D  = 220;      // diameter of each plate (px)
      const PLATE_R  = PLATE_D / 2;  // 110
      const COOKIE_R = 24;       // half of cookie element size, used for clamping

      // Preset scatter positions for cookies (offsets from plate center).
      // Distances all < PLATE_R - COOKIE_R = 86, so cookies stay fully on plate.
      const OFFSETS = [
        { x: -48, y: -36 },
        { x:  30, y: -52 },
        { x:  62, y:  10 },
        { x: -60, y:  24 },
        { x:   6, y:  56 },
        { x:  46, y: -26 },
      ];

      // Convert an offset to absolute left/top within the plate element
      function offsetToPlatePos(i) {
        const o = OFFSETS[i % OFFSETS.length];
        return { left: PLATE_R + o.x, top: PLATE_R + o.y };
      }

      // Home positions for P's cookies on P's plate (used when returning)
      const homePositions   = Array.from({ length: trial.p_cookies        }, (_, i) => offsetToPlatePos(i));
      // Fixed positions for V's non-draggable existing cookies
      const vFixedPositions = Array.from({ length: trial.v_cookies_current }, (_, i) => offsetToPlatePos(i));

      /* Clamp a cursor point to within the usable area of a circular plate.
         Returns { left, top } as px from plate element's top-left corner.
         The cookie CENTER will be placed at (left, top). */
      function clampToPlate(plateEl, clientX, clientY) {
        const rect = plateEl.getBoundingClientRect();
        const cx = rect.left + PLATE_R, cy = rect.top + PLATE_R;
        let dx = clientX - cx, dy = clientY - cy;
        const maxR = PLATE_R - COOKIE_R;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        return { left: PLATE_R + dx, top: PLATE_R + dy };
      }

      /* Clamp a cursor point to within a rectangular element.
         Returns { left, top } relative to element's top-left corner. */
      function clampToRect(el, clientX, clientY) {
        const rect = el.getBoundingClientRect();
        return {
          left: Math.max(COOKIE_R, Math.min(clientX - rect.left, rect.width  - COOKIE_R)),
          top:  Math.max(COOKIE_R, Math.min(clientY - rect.top,  rect.height - COOKIE_R)),
        };
      }

      /* -------------------------------------------------------
         HTML BUILDERS
      ------------------------------------------------------- */
      function pPlateHTML() {
        let html = `<div class="cookie-plate" id="p-plate">`;
        for (let i = 0; i < trial.p_cookies; i++) {
          const { left, top } = homePositions[i];
          html += `<div class="plate-cookie draggable" id="p-cookie-${i}" data-cookie-id="${i}" style="left:${left}px;top:${top}px;"><span class="cookie-emoji">🍪</span></div>`;
        }
        html += `</div>`;
        return html;
      }

      function vPanelHTML() {
        let plateHTML = `<div class="cookie-plate" id="v-plate">`;
        for (let i = 0; i < trial.v_cookies_current; i++) {
          const { left, top } = vFixedPositions[i];
          plateHTML += `<div class="plate-cookie" id="v-existing-${i}" style="left:${left}px;top:${top}px;"><span class="cookie-emoji">🍪</span></div>`;
        }
        plateHTML += `</div>`;

        const vLabel = `${trial.v_name} has ${trial.v_cookies_current} cookie${trial.v_cookies_current !== 1 ? 's' : ''}`;
        return `
          <div class="alloc-panel" id="v-panel">
            <img src="img/${trial.v_img}" class="alloc-char-img" alt="${trial.v_name}">
            <p class="alloc-char-name">${trial.v_name}</p>
            <div class="panel-name">${vLabel}</div>
            ${plateHTML}
          </div>`;
      }

      function trashPanelHTML() {
        return `
          <div class="alloc-panel" id="trash-panel">
            <img src="img/cookie_jar.png" class="alloc-char-img" alt="The Cookie Jar">
            <p class="alloc-char-name">The Cookie Jar</p>
            <div class="panel-name" style="visibility:hidden">Cookie Jar</div>
            <div class="cookie-plate" id="trash-plate"></div>
          </div>`;
      }

      /* -------------------------------------------------------
         BUILD FULL SCREEN HTML
      ------------------------------------------------------- */
      const leftPanel  = trial.trash_on_left ? trashPanelHTML() : vPanelHTML();
      const rightPanel = trial.trash_on_left ? vPanelHTML()     : trashPanelHTML();
      const confirmLabel = trial.is_practice ? 'Done' : 'Confirm';

      function needsDisabled() {
        return trial.require_v || trial.require_trash || trial.require_both;
      }

      const html = `
        <div class="allocation-screen">
          ${trial.harm_text       ? `<div class="allocation-harm-text">${trial.harm_text}</div>`        : ''}
          ${trial.instruction_text ? `<div class="allocation-instruction">${trial.instruction_text}</div>` : ''}
          <div class="allocation-columns">
            ${leftPanel}
            <div class="p-pool-col">
              <img src="img/${trial.p_img}" class="alloc-char-img" alt="${trial.p_name}">
              <p class="alloc-char-name">${trial.p_name}</p>
              <div class="panel-name">${trial.p_name} has ${trial.p_cookies} cookie${trial.p_cookies !== 1 ? 's' : ''}</div>
              ${pPlateHTML()}
            </div>
            ${rightPanel}
          </div>
          ${needsDisabled() ? `<div id="alloc-hint" class="alloc-hint-hidden"></div>` : ''}
          <div class="allocation-btn-row">
            <button id="confirm-btn" ${needsDisabled() ? 'disabled' : ''}>${confirmLabel}</button>
            ${(!trial.is_practice || trial.allow_do_nothing) ? `<button id="do-nothing-btn">Do Nothing</button>` : ''}
          </div>
        </div>
        <div id="drag-ghost">🍪</div>
      `;

      display_element.innerHTML = html;

      /* -------------------------------------------------------
         HELPERS
      ------------------------------------------------------- */
      function countInZone(zone) {
        return cookieDest.filter(d => d === zone).length;
      }

      function updateConfirmBtn() {
        const btn     = display_element.querySelector('#confirm-btn');
        const hintEl  = display_element.querySelector('#alloc-hint');
        const inV     = countInZone('v'), inTrash = countInZone('trash');
        let ok = true;
        let hintMsg = '';

        if (trial.require_both) {
          if (inV < 1 && inTrash < 1) { ok = false; hintMsg = '⚠️ Move at least one cookie to Cleo\'s plate and at least one to the Cookie Jar.'; }
          else if (inV < 1)           { ok = false; hintMsg = '⚠️ Don\'t forget to move a cookie to Cleo\'s plate too.'; }
          else if (inTrash < 1)       { ok = false; hintMsg = '⚠️ Don\'t forget to move a cookie to the Cookie Jar too.'; }
        } else if (trial.require_v     && inV < 1)     { ok = false; hintMsg = '⚠️ Move at least one cookie to Cleo\'s plate to continue.'; }
        else if   (trial.require_trash && inTrash < 1) { ok = false; hintMsg = '⚠️ Move at least one cookie to the Cookie Jar to continue.'; }

        btn.disabled = !ok;
        if (hintEl) {
          hintEl.textContent = hintMsg;
          hintEl.className   = hintMsg ? 'alloc-hint-visible' : 'alloc-hint-hidden';
        }
      }

      function getCookieEl(id) {
        return display_element.querySelector(`#p-cookie-${id}`);
      }

      // Move a cookie element to a new container at (left, top) within that container.
      // left/top are the desired CENTER position of the cookie within containerEl.
      function placeCookie(cookieEl, containerEl, left, top, zone, cookieId) {
        containerEl.appendChild(cookieEl);
        cookieEl.style.left    = left + 'px';
        cookieEl.style.top     = top  + 'px';
        cookieEl.style.opacity = '1';
        cookieDest[cookieId]   = zone;
        updateConfirmBtn();
      }

      // Return a P cookie to its home position on P's plate.
      function returnToPool(cookieId) {
        const cookieEl = getCookieEl(cookieId);
        const pPlate   = display_element.querySelector('#p-plate');
        const { left, top } = homePositions[cookieId];
        placeCookie(cookieEl, pPlate, left, top, 'pool', cookieId);
      }

      /* -------------------------------------------------------
         DRAG AND DROP
      ------------------------------------------------------- */
      let dragging = null;
      const ghostEl = display_element.querySelector('#drag-ghost');

      function showGhost(x, y) {
        ghostEl.style.display = 'block';
        ghostEl.style.left    = (x - 22) + 'px';
        ghostEl.style.top     = (y - 22) + 'px';
      }

      function hideGhost() {
        ghostEl.style.display = 'none';
      }

      function clearDropHovers() {
        display_element.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
      }

      // Start drag on any draggable plate-cookie (pool, v, or trash)
      display_element.addEventListener('mousedown', (e) => {
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const cookieId = parseInt(cookieEl.dataset.cookieId);
        if (isNaN(cookieId)) return;

        e.preventDefault();
        dragging = { cookieId };
        cookieEl.style.opacity = '0';
        showGhost(e.clientX, e.clientY);
      });

      // Click a cookie that is NOT in the pool → return it to P's plate
      display_element.addEventListener('click', (e) => {
        if (dragging) return;
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const cid = parseInt(cookieEl.dataset.cookieId);
        if (!isNaN(cid) && cookieDest[cid] !== 'pool') returnToPool(cid);
      });

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);

      function onMouseMove(e) {
        if (!dragging) return;
        showGhost(e.clientX, e.clientY);

        // Highlight the plate the cursor is over
        const target     = document.elementFromPoint(e.clientX, e.clientY);
        const vPlate     = display_element.querySelector('#v-plate');
        const pPlate     = display_element.querySelector('#p-plate');
        const trashPlate = display_element.querySelector('#trash-plate');

        clearDropHovers();
        if      (target?.closest('#v-panel'))     vPlate.classList.add('drop-hover');
        else if (target?.closest('#trash-panel')) trashPlate.classList.add('drop-hover');
        else if (target?.closest('.p-pool-col'))  pPlate.classList.add('drop-hover');
      }

      function onMouseUp(e) {
        if (!dragging) return;
        const { cookieId } = dragging;
        dragging = null;
        hideGhost();
        clearDropHovers();

        const cookieEl   = getCookieEl(cookieId);
        const target     = document.elementFromPoint(e.clientX, e.clientY);
        const vPlate     = display_element.querySelector('#v-plate');
        const pPlate     = display_element.querySelector('#p-plate');
        const trashPlate = display_element.querySelector('#trash-plate');

        if (target?.closest('#v-panel')) {
          // Drop onto V's panel → land on V's plate at cursor position
          const pos = clampToPlate(vPlate, e.clientX, e.clientY);
          placeCookie(cookieEl, vPlate, pos.left, pos.top, 'v', cookieId);

        } else if (target?.closest('#trash-panel')) {
          // Drop onto trash panel → land on trash plate at cursor position
          const pos = clampToPlate(trashPlate, e.clientX, e.clientY);
          placeCookie(cookieEl, trashPlate, pos.left, pos.top, 'trash', cookieId);

        } else if (target?.closest('.p-pool-col')) {
          // Drop onto P's panel → return to plate at cursor position if on plate,
          // else snap to home
          if (target?.closest('#p-plate')) {
            const pos = clampToPlate(pPlate, e.clientX, e.clientY);
            placeCookie(cookieEl, pPlate, pos.left, pos.top, 'pool', cookieId);
          } else {
            returnToPool(cookieId);
          }

        } else {
          // Dropped outside any valid target → return to home
          returnToPool(cookieId);
        }
      }

      /* -------------------------------------------------------
         CONFIRM / DO NOTHING BUTTONS
      ------------------------------------------------------- */
      function finishAllocation(doNothing) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);

        const inV     = doNothing ? 0 : countInZone('v');
        const inTrash = doNothing ? 0 : countInZone('trash');
        const inPool  = doNothing ? trial.p_cookies : countInZone('pool');

        this.jsPsych.finishTrial({
          scenario_id:       trial.scenario_id,
          harm_type:         trial.harm_type,
          v_initial:         trial.hud_v_cookies,
          v_after_harm:      trial.v_cookies_current,
          cookies_to_v:      inV,
          cookies_to_trash:  inTrash,
          cookies_kept_by_p: inPool,
          do_nothing:        doNothing,
          trash_on_left:     trial.trash_on_left,
          is_practice:       trial.is_practice,
          rt:                Math.round(performance.now() - startTime),
        });
      }

      display_element.querySelector('#confirm-btn').addEventListener('click', () => {
        finishAllocation.call(this, false);
      });

      const doNothingBtn = display_element.querySelector('#do-nothing-btn');
      if (doNothingBtn) {
        doNothingBtn.addEventListener('click', () => {
          finishAllocation.call(this, true);
        });
      }
    } // end trial()
  } // end class

  AllocationPlugin.info = info;
  return AllocationPlugin;

})(jsPsychModule);
