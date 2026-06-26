/**
 * jsPsych Allocation Plugin — Plate Edition
 *
 * P's cookies sit on an open circular plate in the center.
 * Participants drag them freely onto V's plate or the Trash panel.
 * Records cookies_from_p_to_v, cookies_from_p_to_c, cookies_kept_by_p, cookies_from_v_to_c, gate_rt, allocation_rt.
 *
 * Requires: jsPsych 7
 */
var jsPsychAllocation = (function (jspsych) {

  const info = {
    name: 'allocation',
    version: '1.0.0',
    parameters: {
      p_cookies:          { type: jspsych.ParameterType.INT,         default: 5 },
      v_cookies_current:  { type: jspsych.ParameterType.INT,         default: 2 },
      hud_p_cookies:      { type: jspsych.ParameterType.INT,         default: 5 },
      hud_v_cookies:      { type: jspsych.ParameterType.INT,         default: 5 },
      trash_on_left:      { type: jspsych.ParameterType.BOOL,        default: true },
      harm_text:          { type: jspsych.ParameterType.HTML_STRING, default: '' },
      instruction_text:   { type: jspsych.ParameterType.HTML_STRING, default: '' },
      require_v:          { type: jspsych.ParameterType.BOOL,        default: false },
      require_trash:      { type: jspsych.ParameterType.BOOL,        default: false },
      require_both:       { type: jspsych.ParameterType.BOOL,        default: false },
      require_from_v:     { type: jspsych.ParameterType.BOOL,        default: false },
      require_v_to_p:     { type: jspsych.ParameterType.BOOL,        default: false },
      allow_v_to_p:       { type: jspsych.ParameterType.BOOL,        default: false },
      locked:             { type: jspsych.ParameterType.BOOL,        default: false },
      is_practice:        { type: jspsych.ParameterType.BOOL,        default: false },
      scenario_id:        { type: jspsych.ParameterType.INT,         default: 0 },
      harm_type:          { type: jspsych.ParameterType.STRING,      default: '' },
      event_title:        { type: jspsych.ParameterType.STRING,      default: '' },
      p_name: { type: jspsych.ParameterType.STRING, default: 'Finn' },
      v_name: { type: jspsych.ParameterType.STRING, default: 'Cleo' },
      p_img:  { type: jspsych.ParameterType.STRING, default: 'finn_neutral.png' },
      v_img:  { type: jspsych.ParameterType.STRING, default: 'cleo_neutral.png' },
      header_img:         { type: jspsych.ParameterType.STRING,      default: '' },
      /** Show yes/no gate question on the allocation screen before cookies are movable */
      show_gate_question: { type: jspsych.ParameterType.BOOL,        default: false },
    }
  };

  class AllocationPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const startTime = performance.now();
      let gate_rt      = null;
      let allocStartTime = null;

      /* -------------------------------------------------------
         STATE
      ------------------------------------------------------- */
      const cookieDest  = Array.from({ length: trial.p_cookies         }, () => 'pool');
      const vCookieDest = Array.from({ length: trial.v_cookies_current }, () => 'v');

      /* -------------------------------------------------------
         PLATE GEOMETRY
      ------------------------------------------------------- */
      const PLATE_D  = 220;
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

      const homePositions   = Array.from({ length: trial.p_cookies        }, (_, i) => offsetToPlatePos(i));
      const vFixedPositions = Array.from({ length: trial.v_cookies_current }, (_, i) => offsetToPlatePos(i));

      function clampToPlate(plateEl, clientX, clientY) {
        const rect = plateEl.getBoundingClientRect();
        const cx = rect.left + PLATE_R, cy = rect.top + PLATE_R;
        let dx = clientX - cx, dy = clientY - cy;
        const maxR = PLATE_R - COOKIE_R;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        return { left: PLATE_R + dx, top: PLATE_R + dy };
      }

      /* -------------------------------------------------------
         HTML BUILDERS
      ------------------------------------------------------- */
      function pPlateHTML() {
        const draggable = (trial.show_gate_question || trial.locked) ? '' : ' draggable';
        let html = `<div class="cookie-plate" id="p-plate">`;
        for (let i = 0; i < trial.p_cookies; i++) {
          const { left, top } = homePositions[i];
          html += `<div class="plate-cookie${draggable}" id="p-cookie-${i}" data-cookie-id="${i}" style="left:${left}px;top:${top}px;"><span class="cookie-emoji">🍪</span></div>`;
        }
        html += `</div>`;
        return html;
      }

      function vPanelHTML() {
        const draggable = (trial.show_gate_question || trial.locked) ? '' : ' draggable';
        let plateHTML = `<div class="cookie-plate" id="v-plate">`;
        for (let i = 0; i < trial.v_cookies_current; i++) {
          const { left, top } = vFixedPositions[i];
          plateHTML += `<div class="plate-cookie${draggable}" id="v-existing-${i}" data-v-cookie-id="${i}" style="left:${left}px;top:${top}px;"><span class="cookie-emoji">🍪</span></div>`;
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
      const leftPanel    = trial.trash_on_left ? trashPanelHTML() : vPanelHTML();
      const rightPanel   = trial.trash_on_left ? vPanelHTML()     : trashPanelHTML();
      const confirmLabel = trial.locked ? 'Next' : (trial.is_practice ? 'Done' : 'Confirm');

      function needsDisabled() {
        return !trial.locked && (trial.require_v || trial.require_trash || trial.require_both || trial.require_from_v || trial.require_v_to_p);
      }

      const html = `
        <div class="allocation-screen">
          ${trial.header_img ? `<img src="${trial.header_img}" class="allocation-header-img" alt="">` : ''}
          ${trial.harm_text        ? `<div class="allocation-harm-text">${trial.harm_text}</div>`         : ''}
          ${trial.instruction_text ? `<div class="allocation-instruction">${trial.instruction_text}</div>` : ''}
          ${trial.show_gate_question ? `
            <div id="gate-question" style="text-align:center; margin:0 0 6px 0;">
              <p style="font-size:18px; font-weight:600; margin:0 0 6px 0;">Now that you saw what happened, do you think anyone should be punished?</p>
              <div style="display:flex; gap:20px; justify-content:center;">
                <button id="gate-yes" class="jspsych-btn" style="padding:8px 28px; font-size:15px; margin-top:8px;">Yes</button>
                <button id="gate-no"  class="jspsych-btn" style="padding:8px 28px; font-size:15px; margin-top:8px;">No</button>
              </div>
            </div>
            <p id="move-instruction" style="display:none; text-align:center; font-size:18px; font-weight:600; margin:0 0 6px 0;">Please move cookies wherever you'd like.</p>
          ` : ''}
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
          <div class="allocation-btn-row"${trial.show_gate_question ? ' style="display:none"' : ''}>
            <button id="confirm-btn" ${needsDisabled() ? 'disabled' : ''}>${confirmLabel}</button>
          </div>
        </div>
        <div id="drag-ghost">🍪</div>
      `;

      display_element.innerHTML = html;

      /* -------------------------------------------------------
         GATE QUESTION LISTENERS
      ------------------------------------------------------- */
      if (trial.show_gate_question) {
        const gateEl     = display_element.querySelector('#gate-question');
        const moveInstr  = display_element.querySelector('#move-instruction');
        const confirmRow = display_element.querySelector('.allocation-btn-row');

        display_element.querySelector('#gate-yes').addEventListener('click', () => {
          gate_rt        = Math.round(performance.now() - startTime) / 1000;
          allocStartTime = performance.now();
          display_element.querySelectorAll('.plate-cookie').forEach(el => el.classList.add('draggable'));
          gateEl.style.display     = 'none';
          moveInstr.style.display  = 'block';
          confirmRow.style.display = '';
          display_element.querySelector('#confirm-btn').disabled = true;
        });

        display_element.querySelector('#gate-no').addEventListener('click', () => {
          gate_rt = Math.round(performance.now() - startTime) / 1000;
          finishAllocation.call(this, true);
        });
      }

      /* -------------------------------------------------------
         HELPERS
      ------------------------------------------------------- */
      function countInZone(zone) {
        return cookieDest.filter(d => d === zone).length;
      }

      function updateConfirmBtn() {
        if (trial.locked) return;
        const btn    = display_element.querySelector('#confirm-btn');
        const hintEl = display_element.querySelector('#alloc-hint');
        const inV    = countInZone('v'), inTrash = countInZone('trash');
        const vToP   = vCookieDest.filter(d => d === 'p').length;
        let ok = true;
        let hintMsg = '';

        if (trial.require_both) {
          if (inV < 1 && inTrash < 1) { ok = false; hintMsg = `⚠️ Move at least one cookie to ${trial.v_name}'s plate and at least one to the Cookie Jar.`; }
          else if (inV < 1)           { ok = false; hintMsg = `⚠️ Don't forget to move a cookie to ${trial.v_name}'s plate too.`; }
          else if (inTrash < 1)       { ok = false; hintMsg = "⚠️ Don't forget to move a cookie to the Cookie Jar too."; }
        } else if (trial.require_v_to_p  && vToP < 1)                                         { ok = false; hintMsg = `⚠️ Move at least one of ${trial.v_name}'s cookies to ${trial.p_name}'s plate to continue.`; }
        else if   (trial.require_v      && inV < 1)                              { ok = false; hintMsg = `⚠️ Move at least one cookie to ${trial.v_name}'s plate to continue.`; }
        else if   (trial.require_trash  && inTrash < 1)                          { ok = false; hintMsg = "⚠️ Move at least one cookie to the Cookie Jar to continue."; }
        else if   (trial.require_from_v && vCookieDest.filter(d => d === 'trash').length < 1) { ok = false; hintMsg = `⚠️ Move at least one of ${trial.v_name}'s cookies to the Cookie Jar to continue.`; }
        else if   (inV + inTrash + vToP + vCookieDest.filter(d => d === 'trash').length < 1) { ok = false; }

        btn.disabled = !ok;
        if (hintEl) {
          hintEl.textContent = hintMsg;
          hintEl.className   = hintMsg ? 'alloc-hint-visible' : 'alloc-hint-hidden';
        }
      }

      function getCookieEl(id)  { return display_element.querySelector(`#p-cookie-${id}`); }
      function getVCookieEl(id) { return display_element.querySelector(`#v-existing-${id}`); }

      function placeCookie(cookieEl, containerEl, left, top, zone, cookieId) {
        containerEl.appendChild(cookieEl);
        cookieEl.style.left  = left + 'px';
        cookieEl.style.top   = top  + 'px';
        cookieEl.style.opacity = '1';
        cookieDest[cookieId] = zone;
        updateConfirmBtn();
      }

      function returnToPool(cookieId) {
        const pPlate = display_element.querySelector('#p-plate');
        const { left, top } = homePositions[cookieId];
        placeCookie(getCookieEl(cookieId), pPlate, left, top, 'pool', cookieId);
      }

      function returnVToPlate(vCookieId) {
        const vPlate = display_element.querySelector('#v-plate');
        const { left, top } = vFixedPositions[vCookieId];
        const cookieEl = getVCookieEl(vCookieId);
        vPlate.appendChild(cookieEl);
        cookieEl.style.left    = left + 'px';
        cookieEl.style.top     = top  + 'px';
        cookieEl.style.opacity = '1';
        vCookieDest[vCookieId] = 'v';
        updateConfirmBtn();
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
      function hideGhost() { ghostEl.style.display = 'none'; }

      function clearDropHovers() {
        display_element.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
      }

      display_element.addEventListener('mousedown', (e) => {
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const pId = parseInt(cookieEl.dataset.cookieId);
        const vId = parseInt(cookieEl.dataset.vCookieId);
        if (!isNaN(pId))      { dragging = { cookieId: pId, isVCookie: false }; }
        else if (!isNaN(vId)) { dragging = { cookieId: vId, isVCookie: true  }; }
        else return;
        e.preventDefault();
        cookieEl.style.opacity = '0';
        showGhost(e.clientX, e.clientY);
      });

      display_element.addEventListener('click', (e) => {
        if (dragging) return;
        const cookieEl = e.target.closest('.plate-cookie.draggable');
        if (!cookieEl) return;
        const pId = parseInt(cookieEl.dataset.cookieId);
        const vId = parseInt(cookieEl.dataset.vCookieId);
        if (!isNaN(pId) && cookieDest[pId]  !== 'pool') returnToPool(pId);
        if (!isNaN(vId) && vCookieDest[vId] !== 'v')    returnVToPlate(vId);
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
        if (dragging.isVCookie) {
          if (target?.closest('#trash-panel')) trashPlate.classList.add('drop-hover');
          else if (trial.allow_v_to_p && target?.closest('.p-pool-col')) pPlate.classList.add('drop-hover');
        } else {
          if      (target?.closest('#v-panel'))     vPlate.classList.add('drop-hover');
          else if (target?.closest('#trash-panel')) trashPlate.classList.add('drop-hover');
          else if (target?.closest('.p-pool-col'))  pPlate.classList.add('drop-hover');
        }
      }

      function onMouseUp(e) {
        if (!dragging) return;
        const { cookieId, isVCookie } = dragging;
        dragging = null;
        hideGhost();
        clearDropHovers();

        const cookieEl   = isVCookie ? getVCookieEl(cookieId) : getCookieEl(cookieId);
        const target     = document.elementFromPoint(e.clientX, e.clientY);
        const vPlate     = display_element.querySelector('#v-plate');
        const pPlate     = display_element.querySelector('#p-plate');
        const trashPlate = display_element.querySelector('#trash-plate');

        if (isVCookie) {
          if (target?.closest('#trash-panel')) {
            const pos = clampToPlate(trashPlate, e.clientX, e.clientY);
            trashPlate.appendChild(cookieEl);
            cookieEl.style.left    = pos.left + 'px';
            cookieEl.style.top     = pos.top  + 'px';
            cookieEl.style.opacity = '1';
            vCookieDest[cookieId]  = 'trash';
            updateConfirmBtn();
          } else if (trial.allow_v_to_p && target?.closest('.p-pool-col')) {
            const pos = clampToPlate(pPlate, e.clientX, e.clientY);
            pPlate.appendChild(cookieEl);
            cookieEl.style.left    = pos.left + 'px';
            cookieEl.style.top     = pos.top  + 'px';
            cookieEl.style.opacity = '1';
            vCookieDest[cookieId]  = 'p';
            updateConfirmBtn();
          } else {
            returnVToPlate(cookieId);
          }
        } else {
          if (target?.closest('#v-panel')) {
            const pos = clampToPlate(vPlate, e.clientX, e.clientY);
            placeCookie(cookieEl, vPlate, pos.left, pos.top, 'v', cookieId);
          } else if (target?.closest('#trash-panel')) {
            const pos = clampToPlate(trashPlate, e.clientX, e.clientY);
            placeCookie(cookieEl, trashPlate, pos.left, pos.top, 'trash', cookieId);
          } else if (target?.closest('.p-pool-col')) {
            if (target?.closest('#p-plate')) {
              const pos = clampToPlate(pPlate, e.clientX, e.clientY);
              placeCookie(cookieEl, pPlate, pos.left, pos.top, 'pool', cookieId);
            } else {
              returnToPool(cookieId);
            }
          } else {
            returnToPool(cookieId);
          }
        }
      }

      /* -------------------------------------------------------
         CONFIRM BUTTON
      ------------------------------------------------------- */
      function finishAllocation(doNothing) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);

        const fromPToV = doNothing ? 0 : countInZone('v');
        const fromPToC = doNothing ? 0 : countInZone('trash');
        const keptByP  = doNothing ? trial.p_cookies : countInZone('pool');
        const fromVToC = doNothing ? 0 : vCookieDest.filter(d => d === 'trash').length;
        const fromVToP = doNothing ? 0 : vCookieDest.filter(d => d === 'p').length;

        const finalGateRt = trial.show_gate_question
          ? gate_rt
          : (() => {
              const prev = this.jsPsych.data.get().last(1).values();
              return (prev.length > 0 && prev[0].trial_type === 'html-button-response') ? prev[0].rt / 1000 : null;
            })();
        const finalAllocRt = trial.show_gate_question
          ? (allocStartTime ? Math.round(performance.now() - allocStartTime) / 1000 : null)
          : Math.round(performance.now() - startTime) / 1000;

        this.jsPsych.finishTrial({
          scenario_id:         trial.scenario_id,
          harm_type:           trial.harm_type,
          event_title:         trial.event_title,
          p_name:              trial.p_name,
          v_name:              trial.v_name,
          v_initial:           trial.hud_v_cookies,
          v_after_harm:        trial.v_cookies_current,
          cookies_from_p_to_v: fromPToV,
          cookies_from_p_to_c: fromPToC,
          cookies_kept_by_p:   keptByP,
          cookies_from_v_to_p: fromVToP,
          cookies_from_v_to_c: fromVToC,
          do_nothing:          !!doNothing,
          trash_on_left:       trial.trash_on_left,
          is_practice:         trial.is_practice,
          gate_rt:             finalGateRt,
          allocation_rt:       finalAllocRt,
        });
      }

      display_element.querySelector('#confirm-btn').addEventListener('click', () => {
        finishAllocation.call(this, false);
      });

    } // end trial()
  } // end class

  AllocationPlugin.info = info;
  return AllocationPlugin;

})(jsPsychModule);
