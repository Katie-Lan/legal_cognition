/* ============================================================
   CAUSE & FAULT EXPERIMENT 1
   jsPsych 7 – Cookie Allocation Task
   ============================================================ */

/* ----------------------------------------------------------
   INITIALIZE jsPsych
   ---------------------------------------------------------- */
const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  show_progress_bar: true,
  on_finish: function () {
    // Send all non-practice trial data to proliferate for storage.
    // Upload status is shown to the participant in the #thanks element.
    const trials = jsPsych.data.get().filter({ is_practice: false }).values();
    if (typeof proliferate !== 'undefined') {
      proliferate.submit({ "trials": trials });
    } else {
      // Fallback when not launched through proliferate (e.g. local preview):
      // log the data and show a simple thank-you screen so nothing appears broken.
      console.table(trials);
      document.body.innerHTML = `
        <div style="text-align:center; padding:80px; font-family:sans-serif;">
          <h2>Thank you for participating!</h2>
          <p>Your responses have been recorded.</p>
        </div>`;
    }
  }
});

/* ----------------------------------------------------------
   PARTICIPANT-LEVEL RANDOMIZATION
   sessionStorage keeps values stable across jump-reloads so the
   researcher debug panel always lands on the correct slide.
   ---------------------------------------------------------- */
function sessionGet(key, generator) {
  const stored = sessionStorage.getItem(key);
  if (stored !== null) return JSON.parse(stored);
  const val = generator();
  sessionStorage.setItem(key, JSON.stringify(val));
  return val;
}

const TRASH_ON_LEFT = sessionGet('exp1_trash', () => Math.random() < 0.5);

/* ----------------------------------------------------------
   HELPERS
   ---------------------------------------------------------- */

/** Cookie grid HTML (3+2 layout). size = 'large' | 'medium' | 'small' */
function cookieGridHTML(filled, total, size, animate) {
  const layout = [[0, 1, 2], [3, 4]];
  let html = '<div class="cookie-grid' + (size === 'small' ? ' hud-grid' : '') + '">';
  layout.forEach((row, ri) => {
    html += '<div class="cookie-row ' + (ri === 1 ? 'row-bottom' : 'row-top') + '">';
    row.forEach(i => {
      if (i >= total) return;
      const isFilled = i < filled;
      const animClass = animate && isFilled ? ' animate-cookie-appear stagger-' + i : '';
      html += `<div class="cookie-slot ${size} ${isFilled ? 'filled' : 'empty'}${animClass}">`;
      if (isFilled) html += '<span class="cookie-emoji">🍪</span>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** Free-floating cookie icons — no slots, no grid */
function freeCookiesHTML(count, animate) {
  let html = '<div class="free-cookies-row">';
  for (let i = 0; i < count; i++) {
    const cls = animate ? ` animate-cookie-appear stagger-${i}` : '';
    html += `<span class="free-cookie-emoji${cls}">🍪</span>`;
  }
  html += '</div>';
  return html;
}

/** Single-person display for one-at-a-time introductions */
function onePersonHTML(name, imgFile) {
  return `
    <div class="two-person-display">
      <div class="person-col">
        <img src="img/${imgFile}" class="char-img intro-img" alt="${name}">
        <p class="intro-name">${name}</p>
      </div>
    </div>`;
}

/** Two-person display (P left, V right) with optional cookies.
 *  showSlots:   render the 3+2 slot grid (used in outcome slides)
 *  showCookies: render free-floating emoji icons (used in intro slides)
 */
function twoPersonHTML({ pCookies, vCookies, pLabel, vLabel, showSlots, showCookies, animate,
                         pName = 'Finn', vName = 'Cleo',
                         pImg  = 'finn_neutral.png', vImg = 'cleo_neutral.png' }) {
  return `
    <div class="two-person-display">
      <div class="person-col">
        <img src="img/${pImg}" class="char-img" alt="${pName}">
        <p class="person-name">${pName}</p>
        ${showSlots   ? `<div class="cookie-label">${pLabel}</div>${cookieGridHTML(pCookies, 5, 'large', animate)}` : ''}
        ${showCookies ? `<div class="cookie-label">${pLabel}</div>${freeCookiesHTML(pCookies, animate)}` : ''}
      </div>
      <div class="person-col">
        <img src="img/${vImg}" class="char-img" alt="${vName}">
        <p class="person-name">${vName}</p>
        ${showSlots   ? `<div class="cookie-label">${vLabel}</div>${cookieGridHTML(vCookies, 5, 'large', animate)}` : ''}
        ${showCookies ? `<div class="cookie-label">${vLabel}</div>${freeCookiesHTML(vCookies, animate)}` : ''}
      </div>
    </div>`;
}

/** Slide with two-person display on left + instruction text on right */
function slideLayout(mainHTML, instructionHTML) {
  return `
    <div class="slide-wrapper">
      <div>${mainHTML}</div>
      <div class="slide-content-area">
        <p class="slide-instruction">${instructionHTML}</p>
      </div>
    </div>`;
}

/** Event box HTML for a scenario */
function eventBoxHTML(scenario, showHarm) {
  const pName = scenario.p_name || 'Finn';
  const vName = scenario.v_name || 'Cleo';
  const harmTypeLabel = scenario.harm_type === 'intentional' ? 'perpetrator'
                      : scenario.harm_type === 'negligent'   ? 'negligent'
                      : 'strict-liability';
  const eventText = showHarm
    ? `<strong>Oh no!</strong> ${vName} lost ${scenario.harm_amount} cookie${scenario.harm_amount !== 1 ? 's' : ''} during this event.`
    : scenario.event_text;

  return `
    <div class="event-box">
      <div class="event-scene">
        <div class="event-person ${harmTypeLabel}">
          <div class="char-card medium">${pName}</div>
          <div class="event-person-label">${pName}</div>
        </div>
        <div class="event-arrow">→</div>
        <div class="event-person">
          <div class="char-card medium">${vName}</div>
          <div class="event-person-label">${vName}</div>
        </div>
      </div>
      <div class="event-description">${eventText}</div>
    </div>`;
}

/* ----------------------------------------------------------
   SCENARIO DEFINITIONS
   ---------------------------------------------------------- */
// Finn & Cleo scenarios (randomized block)
const finnCleoScenarios = [
  {
    id: 2,
    p_name: 'Finn', v_name: 'Cleo', p_img: 'finn_neutral.png', v_img: 'cleo_neutral.png',
    harm_type: 'negligent',
    p_cookies: 3, p_after: 3,
    v_initial: 3, v_after_harm: 1, harm_amount: 2,
    video: 'mp4/finn%20and%20cleo.mp4',
    event_text: 'Finn spills water and doesn\'t clean it up. Cleo slips on the wet floor and 2 of Cleo\'s cookies are destroyed.',
    event_title: 'Finn Spills Water — Cleo Slips'
  }
];

// Second block — always after Finn & Cleo, randomized among themselves
const secondBlockScenarios = [
  {
    id: 5,
    p_name: 'Milo', v_name: 'Sasha', p_img: 'Milo.png', v_img: 'Sasha.png',
    harm_type: 'intentional',
    p_cookies: 3, p_after: 3,
    v_initial: 3, v_after_harm: 2, harm_amount: 1,
    event_text: 'Milo is angry at Sasha. He walks over and deliberately smashes one of Sasha\'s cookies, destroying it. The cookie is gone. Milo still has 3 cookies. Sasha now has 2 cookies.',
    event_title: 'Milo Destroys Sasha\'s Cookie'
  },
  {
    id: 6,
    p_name: 'Rex', v_name: 'Zoe', p_img: 'rex.png', v_img: 'zoe.png',
    harm_type: 'intentional',
    p_cookies: 3, p_after: 3,
    v_initial: 3, v_after_harm: 1, harm_amount: 2,
    event_text: 'Rex wants Zoe to have fewer cookies. He deliberately knocks two of her cookies into the trash.',
    event_title: 'Rex Knocks Zoe\'s Cookies Away'
  },
  {
    id: 7,
    p_name: 'Kai', v_name: 'Ruby', p_img: 'kai.png', v_img: 'Ruby.png',
    harm_type: 'strict_liability',
    p_cookies: 3, p_after: 3,
    v_initial: 3, v_after_harm: 2, harm_amount: 1,
    event_text: 'Kai is carefully leading his pet wild wolf on a leash. He has taken all safety precautions and is being very careful. Despite this, the wolf suddenly lunges toward Ruby and eats one of her cookies before Kai can stop it. Kai looks horrified and apologetic. Ruby looks shocked and upset.',
    event_title: 'Kai\'s Wolf Eats Ruby\'s Cookie'
  },
  {
    id: 8,
    p_name: 'Sam', v_name: 'Ella', p_img: 'sam.png', v_img: 'ella.png',
    harm_type: 'strict_liability',
    p_cookies: 3, p_after: 3,
    v_initial: 3, v_after_harm: 2, harm_amount: 1,
    slides: ['img/trailppt/sam_ella_1.png', 'img/trailppt/sam_ella_2.png', 'img/trailppt/sam_ella_3.png'],
    event_text: 'Sam is carefully walking his dog on a leash. Even though Sam is holding the leash tightly and being very careful, the dog lunges toward Ella\'s cookies and eats one before Sam can stop it.',
    event_title: 'Sam\'s Dog Eats Ella\'s Cookie'
  }
];

/* ----------------------------------------------------------
   WARMUP TIMELINE
   ---------------------------------------------------------- */

// Slide 0 – Welcome screen
const welcomeScreen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:60px 40px; max-width:700px; margin:0 auto; font-family:sans-serif; color:#333;">
      <p style="font-size:22px; line-height:1.6;">
        Welcome! In this game, you will watch two characters interact.
        Your job is to decide how to move their cookies around.
        Let's practice first!
      </p>
    </div>`,
  choices: ['Next'],
};

// Slide 1a – Introduce Finn
const warmupIntroFinn = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:30px 20px;">
      <p class="slide-instruction">This is Finn</p>
      <img src="img/finn_neutral.png" class="char-img intro-img" alt="Finn" style="margin:20px auto; display:block;">
      <p class="slide-instruction" style="margin-top:16px;">Finn has 3 cookies</p>
      <div style="display:flex; justify-content:center; margin-top:10px;">
        ${freeCookiesHTML(3, false)}
      </div>
    </div>`,
  choices: ['Next'],
};

// Slide 1b – Introduce Cleo
const warmupIntroCleo = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:30px 20px;">
      <p class="slide-instruction">This is Cleo</p>
      <img src="img/cleo_neutral.png" class="char-img intro-img" alt="Cleo" style="margin:20px auto; display:block;">
      <p class="slide-instruction" style="margin-top:16px;">Cleo has 3 cookies</p>
      <div style="display:flex; justify-content:center; margin-top:10px;">
        ${freeCookiesHTML(3, false)}
      </div>
    </div>`,
  choices: ['Next'],
};

// Slide 2a – Practice: move a cookie to Cleo
const warmupPracticeV = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Try it out! Move one of Finn's cookies to Cleo's plate.",
  require_v: true,
  require_trash: false,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Finn', v_name: 'Cleo',
  p_img: 'finn_neutral.png', v_img: 'cleo_neutral.png',
};

// Slide 2b – Practice: move a cookie to the Cookie Jar
const warmupPracticeTrash = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Now move one of Finn's cookies to the Cookie Jar.",
  require_v: false,
  require_trash: true,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Finn', v_name: 'Cleo',
  p_img: 'finn_neutral.png', v_img: 'cleo_neutral.png',
};

// Slide 2c – Practice: move a cookie to both Cleo and the Cookie Jar
const warmupPracticeBoth = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Last one! Move at least one cookie to Cleo's plate AND at least one to the Cookie Jar.",
  require_v: false,
  require_trash: false,
  require_both: true,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Finn', v_name: 'Cleo',
  p_img: 'finn_neutral.png', v_img: 'cleo_neutral.png',
};

// Slide 2d – Practice: do nothing
// Slide 3 – Practice confirmation
const warmupDone = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:80px 40px; max-width:700px; margin:0 auto;">
      <p class="slide-instruction">Great job! Now let's begin.</p>
    </div>`,
  choices: ['Begin'],
};

/* ----------------------------------------------------------
   TEST TRIAL BUILDER
   ---------------------------------------------------------- */
function buildTestTrial(scenario, scenarioIdx, total) {
  const pName  = scenario.p_name  || 'Finn';
  const vName  = scenario.v_name  || 'Cleo';
  const pImg   = scenario.p_img   || 'finn_neutral.png';
  const vImg   = scenario.v_img   || 'cleo_neutral.png';
  const pAfter = scenario.p_after !== undefined ? scenario.p_after : scenario.p_cookies;
  const pGained = pAfter - scenario.p_cookies; // > 0 means P gained cookies

  const trialLabel = `${pName} & ${vName}`;

  // Slide A – characters (blank)
  const slideA = {
    type: jsPsychHtmlButtonResponse,
    stimulus: twoPersonHTML({ showSlots: false, pName, vName, pImg, vImg }),
    choices: ['Next'],
    on_start: function() { updateProgressBar(scenarioIdx, total); },
    _debugLabel: `${trialLabel} — A: Characters`,
  };

  // Slide C – Show initial cookies as free-floating icons (animated)
  const slideC = {
    _debugLabel: `${trialLabel} — C: Initial Cookies`,
    type: jsPsychHtmlButtonResponse,
    stimulus: twoPersonHTML({
      pCookies: scenario.p_cookies,
      vCookies: scenario.v_initial,
      pLabel: `${pName} has ${scenario.p_cookies} cookies`,
      vLabel: `${vName} has ${scenario.v_initial} cookies`,
      showCookies: true, animate: true,
      pName, vName, pImg, vImg
    }),
    choices: ['Next'],
  };

  // Slides D & E — video path present: replace text event + outcome with video + updated-cookies
  let slidesDE;
  if (scenario.video) {
    // Slide D – Video
    const slideD = {
      _debugLabel: `${trialLabel} — D: Video`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding-top:20px;">
          <video width="640" controls style="border-radius:8px; max-width:100%;">
            <source src="${scenario.video}" type="video/mp4">
          </video>
        </div>`,
      choices: ['Next'],
    };

    // Slide E – Updated cookies (post-harm counts, no event box)
    const pGainedNote = pGained > 0
      ? `<br>${pName} now has <strong>${pAfter}</strong> cookie${pAfter !== 1 ? 's' : ''}.`
      : '';
    const slideE = {
      _debugLabel: `${trialLabel} — E: Updated Cookies`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="display:flex; flex-direction:column; align-items:center; gap:20px; padding-top:20px;">
          <p class="slide-instruction">
            Oh no, ${vName} lost ${scenario.harm_amount} cookie${scenario.harm_amount !== 1 ? 's' : ''}.<br>
            ${vName} now only has <strong>${scenario.v_after_harm}</strong>
            cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.${pGainedNote}
          </p>
          ${twoPersonHTML({
            pCookies: pAfter,
            vCookies: scenario.v_after_harm,
            pLabel: `${pName} has ${pAfter} cookie${pAfter !== 1 ? 's' : ''}`,
            vLabel: `${vName} has ${scenario.v_after_harm} cookie${scenario.v_after_harm !== 1 ? 's' : ''}`,
            showCookies: true, animate: false,
            pName, vName, pImg, vImg
          })}
        </div>`,
      choices: ['Next'],
    };

    slidesDE = [slideD, slideE];
  } else if (scenario.slides) {
    // Slide D – Image slideshow exported from PowerPoint
    const _imgs = scenario.slides;
    const slideD = {
      _debugLabel: `${trialLabel} — D: Video`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding-top:20px;">
          <img id="pptx-img" src="${_imgs[0]}"
               style="max-width:860px; width:100%; border-radius:8px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <button id="pptx-prev"
                    style="padding:8px 20px; font-size:15px; border-radius:6px; cursor:pointer;">
              ◀ Prev
            </button>
            <span id="pptx-counter" style="font-size:15px; color:#555;">
              1 / ${_imgs.length}
            </span>
            <button id="pptx-next"
                    style="padding:8px 20px; font-size:15px; border-radius:6px; cursor:pointer;">
              Next ▶
            </button>
          </div>
        </div>`,
      choices: ['Continue'],
      on_load: function() {
        const imgs = _imgs;
        let cur = 0;
        function update() {
          document.getElementById('pptx-img').src = imgs[cur];
          document.getElementById('pptx-counter').textContent = (cur + 1) + ' / ' + imgs.length;
        }
        document.getElementById('pptx-prev').addEventListener('click', () => {
          if (cur > 0) { cur--; update(); }
        });
        document.getElementById('pptx-next').addEventListener('click', () => {
          if (cur < imgs.length - 1) { cur++; update(); }
        });
      },
    };

    // Slide E – Updated cookies (post-harm counts, no event box)
    const pGainedNote = pGained > 0
      ? `<br>${pName} now has <strong>${pAfter}</strong> cookie${pAfter !== 1 ? 's' : ''}.`
      : '';
    const slideE = {
      _debugLabel: `${trialLabel} — E: Updated Cookies`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="display:flex; flex-direction:column; align-items:center; gap:20px; padding-top:20px;">
          <p class="slide-instruction">
            Oh no, ${vName} lost ${scenario.harm_amount} cookie${scenario.harm_amount !== 1 ? 's' : ''}.<br>
            ${vName} now only has <strong>${scenario.v_after_harm}</strong>
            cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.${pGainedNote}
          </p>
          ${twoPersonHTML({
            pCookies: pAfter,
            vCookies: scenario.v_after_harm,
            pLabel: `${pName} has ${pAfter} cookie${pAfter !== 1 ? 's' : ''}`,
            vLabel: `${vName} has ${scenario.v_after_harm} cookie${scenario.v_after_harm !== 1 ? 's' : ''}`,
            showCookies: true, animate: false,
            pName, vName, pImg, vImg
          })}
        </div>`,
      choices: ['Next'],
    };

    slidesDE = [slideD, slideE];
  } else {
    // Slide D – Event description (text)
    const slideD = {
      _debugLabel: `${trialLabel} — D: Event`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="padding-top:20px; display:flex; justify-content:center;">
          ${eventBoxHTML(scenario, false)}
        </div>`,
      choices: ['Next'],
    };

    // Slide E – Outcome with event box
    const pGainedNote = pGained > 0
      ? `<br>${pName} now has <strong>${pAfter}</strong> cookie${pAfter !== 1 ? 's' : ''}.`
      : '';
    const slideE = {
      _debugLabel: `${trialLabel} — E: Outcome`,
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="padding-top:20px; display:flex; flex-direction:column; align-items:center; gap:24px;">
          ${eventBoxHTML(scenario, false)}
          <div class="harm-result-container">
            <p class="harm-result-text">
              Oh no, ${vName} lost ${scenario.harm_amount} cookie${scenario.harm_amount !== 1 ? 's' : ''}.<br>
              ${vName} now only has <strong>${scenario.v_after_harm}</strong>
              cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.${pGainedNote}
            </p>
            <div class="harm-result-chars">
              <div class="harm-result-char">
                <img src="img/${vImg}" class="char-img" alt="${vName}">
                <p class="person-name">${vName}</p>
                <div class="cookie-label">${vName} has ${scenario.v_after_harm} cookie${scenario.v_after_harm !== 1 ? 's' : ''}</div>
                ${freeCookiesHTML(scenario.v_after_harm, false)}
              </div>
              ${pGained > 0 ? `
              <div class="harm-result-char">
                <img src="img/${pImg}" class="char-img" alt="${pName}">
                <p class="person-name">${pName}</p>
                <div class="cookie-label">${pName} has ${pAfter} cookie${pAfter !== 1 ? 's' : ''}</div>
                ${freeCookiesHTML(pAfter, false)}
              </div>` : ''}
            </div>
            <p class="decision-prompt">Please decide whether you would like to move some of ${pName}'s cookies.</p>
          </div>
        </div>`,
      choices: ['Next'],
    };

    slidesDE = [slideD, slideE];
  }

  // Slide F – Move-cookies gate (Yes / No)
  const slideF = {
    _debugLabel: `${trialLabel} — F: Move Decision`,
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; padding:60px 40px; max-width:700px; margin:0 auto;">
        <p style="font-size:26px; font-weight:bold; margin-bottom:48px;">
          Would you like to move some of ${pName}'s cookies?
        </p>
      </div>`,
    choices: ['✓  Yes', '✗  No'],
    button_html: [
      '<button class="jspsych-btn" style="background:#22c55e;color:white;font-size:22px;padding:16px 52px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;margin:0 20px;">%choice%</button>',
      '<button class="jspsych-btn" style="background:#ef4444;color:white;font-size:22px;padding:16px 52px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;margin:0 20px;">%choice%</button>',
    ],
  };

  // Slide G – Allocation task (only shown when viewer chose Yes)
  const slideG = {
    _debugLabel: `${trialLabel} — G: Allocation`,
    type: jsPsychAllocation,
    p_cookies: pAfter,
    v_cookies_current: scenario.v_after_harm,
    hud_p_cookies: scenario.p_cookies,
    hud_v_cookies: scenario.v_initial,
    trash_on_left: TRASH_ON_LEFT,
    harm_text: `Oh no, ${vName} lost ${scenario.harm_amount} cookie${scenario.harm_amount !== 1 ? 's' : ''}. ${vName} now only has ${scenario.v_after_harm} cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.`,
    instruction_text: `Please decide whether you would like to move some of ${pName}'s cookies.`,
    p_name: pName, v_name: vName, p_img: pImg, v_img: vImg,
    require_v: false,
    require_trash: false,
    require_both: false,
    is_practice: false,
    scenario_id: scenario.id,
    harm_type: scenario.harm_type,
    event_title: scenario.event_title || '',
  };

  const conditionalG = {
    timeline: [slideG],
    conditional_function: function() {
      // response 0 = Yes (first button), 1 = No.
      // Fall back to showing allocation when jumped here directly (no prior F-slide data).
      const last = jsPsych.data.get().last(1).values();
      if (last.length === 0) return true;
      return last[0].response === 0;
    },
  };

  return [slideA, slideC, ...slidesDE, slideF, conditionalG];
}

/* ----------------------------------------------------------
   PROGRESS BAR HELPER
   ---------------------------------------------------------- */
function updateProgressBar(scenarioIdx, total) {
  let container = document.getElementById('scenario-progress-container');
  if (!container) {
    // jsPsych may have cleared the body — recreate the bar
    container = document.createElement('div');
    container.id = 'scenario-progress-container';
    container.innerHTML = `
      <div id="scenario-progress-track">
        <div id="scenario-progress-fill"></div>
      </div>`;
    document.body.appendChild(container);
    console.warn('[progress] container was missing — recreated');
  }
  const pct = ((scenarioIdx + 1) / total * 100).toFixed(1);
  container.style.display = 'block';
  document.getElementById('scenario-progress-fill').style.width = pct + '%';
}

/* ----------------------------------------------------------
   BUILD FULL TIMELINE
   ---------------------------------------------------------- */

// Warmup block
const warmupBlock = [
  welcomeScreen,
  warmupIntroFinn,
  warmupIntroCleo,
  warmupPracticeV,
  warmupPracticeTrash,
  warmupPracticeBoth,
  warmupDone,
];

// Finn & Cleo block — randomized order (stable across jump-reloads)
const shuffledFinnCleo = sessionGet('exp1_shuffle_fc',
  () => jsPsych.randomization.shuffle(finnCleoScenarios.map((_, i) => i))
).map(i => finnCleoScenarios[i]);
// Second block — randomized among themselves, always after Finn & Cleo (stable across jump-reloads)
const shuffledSecondBlock = sessionGet('exp1_shuffle_sb',
  () => jsPsych.randomization.shuffle(secondBlockScenarios.map((_, i) => i))
).map(i => secondBlockScenarios[i]);
const totalTrials = shuffledFinnCleo.length + shuffledSecondBlock.length;
const testBlock = [];
let trialIdx = 0;
shuffledFinnCleo.forEach(scenario => {
  buildTestTrial(scenario, trialIdx++, totalTrials).forEach(t => testBlock.push(t));
});
shuffledSecondBlock.forEach(scenario => {
  buildTestTrial(scenario, trialIdx++, totalTrials).forEach(t => testBlock.push(t));
});

// Final screen
const endScreen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:80px 40px; font-family:sans-serif;">
      <h2 style="font-size:36px; font-weight:400; color:#333;">Thank you!</h2>
      <p style="font-size:20px; color:#666; margin-top:20px;">
        You have completed all scenarios.
      </p>
    </div>`,
  choices: ['Finish'],
};

/* ----------------------------------------------------------
   DEBUG LABELS (read by researcher panel — harmless in production)
   ---------------------------------------------------------- */
welcomeScreen._debugLabel   = 'Welcome Screen';
warmupIntroFinn._debugLabel = 'Intro: Finn';
warmupIntroCleo._debugLabel = 'Intro: Cleo';
warmupPracticeV._debugLabel          = 'Warmup: Practice (Cleo)';
warmupPracticeTrash._debugLabel      = 'Warmup: Practice (Jar)';
warmupPracticeBoth._debugLabel       = 'Warmup: Practice (Both)';
warmupDone._debugLabel               = 'Warmup: Done';
endScreen._debugLabel       = 'End Screen';

/* ----------------------------------------------------------
   RUN
   ---------------------------------------------------------- */
const timeline = [
  ...warmupBlock,
  ...testBlock,
  endScreen,
];

/* ============================================================
   RESEARCHER DEBUG PANEL — JUMP TO ANY SCREEN
   Hidden by default for public / participant deployment.
   To reveal it (researcher use only), set SHOW_DEBUG_PANEL = true.
   ============================================================ */
const SHOW_DEBUG_PANEL = false;   // ← change to true to show the Jump-to-Screen panel

(function () {
  // Public deployment: panel stays hidden — just run the experiment normally.
  if (!SHOW_DEBUG_PANEL) {
    jsPsych.run(timeline);
    return;
  }

  const DATA_KEY = 'exp1_debug_data';

  // Read jump target from URL param (?jumpTo=N)
  const params  = new URLSearchParams(window.location.search);
  const jumpTo  = parseInt(params.get('jumpTo') || '0');

  // Restore any data saved from previous jump sessions so accumulated
  // trial responses survive page reloads.
  const savedData = sessionStorage.getItem(DATA_KEY);
  if (savedData) {
    try {
      JSON.parse(savedData).forEach(row => jsPsych.data.write(row));
    } catch(e) { /* ignore corrupt cache */ }
  }

  // Build dropdown: one option per timeline slide
  const options = timeline.map((trial, i) => {
    const label = trial._debugLabel || `Slide ${i}`;
    const sel   = i === jumpTo ? ' selected' : '';
    return `<option value="${i}"${sel}>${i}: ${label}</option>`;
  }).join('');

  const panel = document.createElement('div');
  panel.id = 'researcher-debug-panel';
  panel.innerHTML = `
    <div id="rdp-title">🔬 Researcher: Jump to Screen</div>
    <select id="rdp-select">${options}</select>
    <button id="rdp-jump">▶ Jump</button>
    <button id="rdp-clear" title="Clear saved trial data">🗑 Clear data</button>
  `;
  document.body.appendChild(panel);

  document.getElementById('rdp-jump').addEventListener('click', () => {
    // Save current data before reloading so it survives the jump.
    sessionStorage.setItem(DATA_KEY, jsPsych.data.get().json());
    const idx = document.getElementById('rdp-select').value;
    window.location.search = '?jumpTo=' + idx;
  });

  document.getElementById('rdp-clear').addEventListener('click', () => {
    sessionStorage.removeItem(DATA_KEY);
    location.reload();
  });

  // Start experiment from the selected slide
  jsPsych.run(jumpTo > 0 ? timeline.slice(jumpTo) : timeline);
})();
/* *** END OF RESEARCHER DEBUG BLOCK *** */
