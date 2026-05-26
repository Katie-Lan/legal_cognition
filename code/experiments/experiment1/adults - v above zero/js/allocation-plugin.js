/**
 * jsPsych Allocation Plugin — Plate Edition
 *
 * Both P's and V's cookies are draggable.
 * P's cookies start on P's plate; V's cookies start on V's plate.
 * Any cookie can be moved to any plate or the Cookie Jar.
 * Records full allocation for both characters.
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
      /** How many cookies V has AFTER harm (shown on V's plate, draggable) */
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
      /** Require ≥1 of V's cookies moved to P's plate before submission (practice) */
      require_from_v:    { type: jspsych.ParameterType.BOOL,        default: false },
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
      /** Optional image shown above the allocation columns (replaces harm/instruction text) */
      header_img: { type: jspsych.ParameterType.STRING, default: '' },
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
         cookieDest[i]  — current zone of P's cookie i: 'pool' | 'v' | 'trash'
         vCookieDest[i] — current zone of V's cookie i: 'v'   | 'p' | 'trash'
      ------------------------------------------------------- */
      const cookieDest  = Array.from({ length: trial.p_cookies         }, () => 'pool');
      const vCookieDest = Array.from({ length: trial.v_cookies_current }, () => 'v');

      /* -------------------------------------------------------
         PLATE GEOMETRY
      ------------------------------------------------------- */
      const PLATE_D  = 200;
      const PLATE_R  = PLATE_D / 2;
      const COOKIE_R = 24;

      const OFFSETS = [
        { x: -48, y: -36 },
        { x:  30, y: -52 },
        { x:  62, y:  10 },
        { x: -60, y:  24 },
        { x:   6, y:  56 },
        { x:  46, y: -26 },
        { x:   0, y:   0 },
      ];

      function offsetToPlatePos(i) {
        const o = OFFSETS[i % OFFSETS.length];
        return { left: PLATE_R + o.x, top: PLATE_R + o.y };
      }

      const homePositions  = Array.from({ length: trial.p_cookies         }, (_, i) => offsetToPlatePos(i));
      const vHomePositions = Array.from({ length: trial.v_cookies_current }, (_, i) => offsetToPlatePos(i));

      function clampToPlate(plateEl, clientX, clientY) {
        const rect = plateEl.getBoundingClientRect();
        const cx = rect.left + PLATE_R, cy = rect.top + PLATE_R;
        let dx = clientX - cx, dy = clientY - cy;
        const maxR = PLATE_R - COOKIE_R;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        return { left: PLATE_R + dx, top: PLATE_R + dy };
      }

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
          const { left, top } = vHomePositions[i];
          plateHTML += `<div class="plate-cookie draggable" id="v-existing-${i}" data-v-cookie-id="${i}" style="left:${left}px;top:${top}px;"><span class="cookie-emoji">🍪</span></div>`;
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

      const html = `
        <div class="allocation-screen">
          ${trial.header_img      ? `<img src="${trial.header_img}" class="allocation-header-img" alt="">` : ''}
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
          <div id="alloc-hint" class="alloc-hint-hidden"></div>
          <div class="allocation-btn-row">
            <button id="confirm-btn" disabled>${confirmLabel}</button>
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
      function countVInZone(zone) {
        return vCookieDest.filter(d => d === zone).length;
      }

      function updateConfirmBtn() {
        const btn    = display_element.querySelector('#confirm-btn');
        const hintEl = display_element.querySelector('#alloc-hint');
        const inV     = countInZone('v'),    inTrash  = countInZone('trash');
        const vToP    = countVInZone('p'),   vToTrash = countVInZone('trash');
        let ok = true;
        let hintMsg = '';

        if (trial.require_both) {
          if (inV < 1 && inTrash < 1) { ok = false; hintMsg = `⚠️ Move at least one cookie to ${trial.v_name}'s plate and at least one to the Cookie Jar.`; }
          else if (inV < 1)           { ok = false; hintMsg = `⚠️ Don't forget to move a cookie to ${trial.v_name}'s plate too.`; }
          else if (inTrash < 1)       { ok = false; hintMsg = '⚠️ Don\'t forget to move a cookie to the Cookie Jar too.'; }
        } else if (trial.require_from_v && vToTrash < 1) { ok = false; hintMsg = `⚠️ Move at least one of ${trial.v_name}'s cookies to the Cookie Jar to continue.`; }
        else if   (trial.require_v     && inV < 1)     { ok = false; hintMsg = `⚠️ Move at least one cookie to ${trial.v_name}'s plate to continue.`; }
        else if   (trial.require_trash && inTrash < 1) { ok = false; hintMsg = '⚠️ Move at least one cookie to the Cookie Jar to continue.'; }
        else if   (inV + inTrash + vToP + vToTrash < 1) { ok = false; }

        btn.disabled = !ok;
        if (hintEl) {
          hintEl.textContent = hintMsg;
          hintEl.className   = hintMsg ? 'alloc-hint-visible' : 'alloc-hint-hidden';
        }
      }

      function getPCookieEl(id) { return display_element.querySelector(`#p-cookie-${id}`); }
      function getVCookieEl(id) { return display_element.querySelector(`#v-existing-${id}`); }

      function placePCookie(cookieEl, containerEl, left, top, zone, id) {
        containerEl.appendChild(cookieEl);
        cookieEl.style.left    = left + 'px';
        cookieEl.style.top     = top  + 'px';
        cookieEl.style.opacity = '1';
        cookieDest[id] = zone;
        updateConfirmBtn();
      }

      function placeVCookie(cookieEl, containerEl, left, top, zone, id) {
        containerEl.appendChild(cookieEl);
        cookieEl.style.left    = left + 'px';
        cookieEl.style.top     = top  + 'px';
        cookieEl.style.opacity = '1';
        vCookieDest[id] = zone;
        updateConfirmBtn();
      }

      function returnToPool(id) {
        const pPlate = display_element.querySelector('#p-plate');
        const { left, top } = homePositions[id];
        placePCookie(getPCookieEl(id), pPlate, left, top, 'pool', id);
      }

      function returnVToHome(id) {
        const vPlate = display_element.querySelector('#v-plate');
        const { left, top } = vHomePositions[id];
        placeVCookie(getVCookieEl(id), vPlate, left, top, 'v', id);
      }

      /* -------------------------------------------------------
         DRAG AND DROP
      ------------------------------------------------------- */
      // dragging: { type: 'p'|'v', id: number } | null
      let dragging = null;
      const ghostEl = display_element.querySelector('#drag-ghost');

      function showGhost(x, y) {
        ghostEl.style.display = 'block';
        ghostEl.style.left    = (x - 22) + 'px';
        ghostEl.style.top     = (y - 22) + 'px';
      }

      function hideGhost() { ghostEl.style.display = 'none'; }

      function clearDropHovers() {
        display_element.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
      }

      display_element.addEventListener('mousedown', (e) => {
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const pId = parseInt(cookieEl.dataset.cookieId);
        const vId = parseInt(cookieEl.dataset.vCookieId);
        if (!isNaN(pId))      { dragging = { type: 'p', id: pId }; }
        else if (!isNaN(vId)) { dragging = { type: 'v', id: vId }; }
        else return;
        e.preventDefault();
        cookieEl.style.opacity = '0';
        showGhost(e.clientX, e.clientY);
      });

      // Click a displaced cookie to return it home
      display_element.addEventListener('click', (e) => {
        if (dragging) return;
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const pId = parseInt(cookieEl.dataset.cookieId);
        const vId = parseInt(cookieEl.dataset.vCookieId);
        if (!isNaN(pId) && cookieDest[pId]  !== 'pool') returnToPool(pId);
        if (!isNaN(vId) && vCookieDest[vId] !== 'v')    returnVToHome(vId);
      });

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);

      function onMouseMove(e) {
        if (!dragging) return;
        showGhost(e.clientX, e.clientY);
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
        const { type, id } = dragging;
        dragging = null;
        hideGhost();
        clearDropHovers();

        const target     = document.elementFromPoint(e.clientX, e.clientY);
        const vPlate     = display_element.querySelector('#v-plate');
        const pPlate     = display_element.querySelector('#p-plate');
        const trashPlate = display_element.querySelector('#trash-plate');

        if (type === 'p') {
          const cookieEl = getPCookieEl(id);
          if (target?.closest('#v-panel')) {
            const pos = clampToPlate(vPlate, e.clientX, e.clientY);
            placePCookie(cookieEl, vPlate, pos.left, pos.top, 'v', id);
          } else if (target?.closest('#trash-panel')) {
            const pos = clampToPlate(trashPlate, e.clientX, e.clientY);
            placePCookie(cookieEl, trashPlate, pos.left, pos.top, 'trash', id);
          } else if (target?.closest('#p-plate')) {
            const pos = clampToPlate(pPlate, e.clientX, e.clientY);
            placePCookie(cookieEl, pPlate, pos.left, pos.top, 'pool', id);
          } else {
            returnToPool(id);
          }
        } else {
          const cookieEl = getVCookieEl(id);
          if (target?.closest('.p-pool-col')) {
            const pos = clampToPlate(pPlate, e.clientX, e.clientY);
            placeVCookie(cookieEl, pPlate, pos.left, pos.top, 'p', id);
          } else if (target?.closest('#trash-panel')) {
            const pos = clampToPlate(trashPlate, e.clientX, e.clientY);
            placeVCookie(cookieEl, trashPlate, pos.left, pos.top, 'trash', id);
          } else if (target?.closest('#v-panel')) {
            const pos = clampToPlate(vPlate, e.clientX, e.clientY);
            placeVCookie(cookieEl, vPlate, pos.left, pos.top, 'v', id);
          } else {
            returnVToHome(id);
          }
        }
      }

      /* -------------------------------------------------------
         CONFIRM BUTTON
      ------------------------------------------------------- */
      function finishAllocation() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);

        this.jsPsych.finishTrial({
          scenario_id:            trial.scenario_id,
          harm_type:              trial.harm_type,
          v_initial:              trial.hud_v_cookies,
          v_after_harm:           trial.v_cookies_current,
          // P cookie allocations
          p_cookies_to_v:         countInZone('v'),
          p_cookies_to_trash:     countInZone('trash'),
          p_cookies_kept:         countInZone('pool'),
          // V cookie allocations
          v_cookies_to_p:         countVInZone('p'),
          v_cookies_to_trash:     countVInZone('trash'),
          v_cookies_kept:         countVInZone('v'),
          do_nothing:             false,
          trash_on_left:          trial.trash_on_left,
          is_practice:            trial.is_practice,
          rt:                     Math.round(performance.now() - startTime),
        });
      }

      display_element.querySelector('#confirm-btn').addEventListener('click', () => {
        finishAllocation.call(this);
      });
    } // end trial()
  } // end class

  AllocationPlugin.info = info;
  return AllocationPlugin;

})(jsPsychModule);
