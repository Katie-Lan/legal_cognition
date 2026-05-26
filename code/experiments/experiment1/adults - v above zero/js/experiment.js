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
    // Collect trial data (replace with JATOS / server POST in deployment)
    const json = jsPsych.data.get().filter({ is_practice: false }).json();
    console.table(jsPsych.data.get().filter({ is_practice: false }).values());
    document.body.innerHTML = `
      <div style="text-align:center; padding:80px; font-family:sans-serif;">
        <h2>Thank you for participating!</h2>
        <p>Your responses have been recorded.</p>
        <button id="view-data-btn" style="padding:10px 24px; font-size:16px; cursor:pointer;">
          View data
        </button>
        <pre id="data-display" style="display:none; text-align:left; max-height:400px;
          overflow:auto; background:#f5f5f5; padding:20px; font-size:13px;
          border-radius:8px; margin-top:24px;">${json}</pre>
      </div>`;
    document.getElementById('view-data-btn').addEventListener('click', function () {
      document.getElementById('data-display').style.display = 'block';
    });
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
    p_cookies: 5, p_after: 5,
    v_initial: 5, v_after_harm: 3, harm_amount: 2,
    event_text: 'Finn spills water and doesn\'t clean it up. Cleo slips on the wet floor and 2 of Cleo\'s cookies are destroyed.',
    event_title: 'Finn Spills Water — Cleo Slips',
    story_slides: ['img/trailppt/finn_cleo/finn_cleo_1.png','img/trailppt/finn_cleo/finn_cleo_2.png','img/trailppt/finn_cleo/finn_cleo_3.png','img/trailppt/finn_cleo/finn_cleo_4.png','img/trailppt/finn_cleo/finn_cleo_5.png','img/trailppt/finn_cleo/finn_cleo_6.png','img/trailppt/finn_cleo/finn_cleo_7.png','img/trailppt/finn_cleo/finn_cleo_8.png','img/trailppt/finn_cleo/finn_cleo_9.png','img/trailppt/finn_cleo/finn_cleo_10.png','img/trailppt/finn_cleo/finn_cleo_11.png']
  }
];

// Second block — always after Finn & Cleo, randomized among themselves
const secondBlockScenarios = [
  {
    id: 5,
    p_name: 'Milo', v_name: 'Sasha', p_img: 'Milo.png', v_img: 'Sasha.png',
    harm_type: 'intentional',
    p_cookies: 5, p_after: 5,
    v_initial: 5, v_after_harm: 3, harm_amount: 2,
    event_text: 'Milo is angry at Sasha. He walks over and deliberately knocks off 2 of Sasha\'s cookies.',
    event_title: 'Milo Knocks Sasha\'s Cookies',
    story_slides: ['img/trailppt/milo_sasha/milo_sasha_1.png','img/trailppt/milo_sasha/milo_sasha_2.png','img/trailppt/milo_sasha/milo_sasha_3.png','img/trailppt/milo_sasha/milo_sasha_4.png','img/trailppt/milo_sasha/milo_sasha_5.png','img/trailppt/milo_sasha/milo_sasha_6.png','img/trailppt/milo_sasha/milo_sasha_7.png','img/trailppt/milo_sasha/milo_sasha_8.png']
  },
  {
    id: 6,
    p_name: 'Zoe', v_name: 'Rex', p_img: 'zoe.png', v_img: 'rex.png',
    harm_type: 'intentional',
    p_cookies: 7, p_after: 7,
    v_initial: 7, v_after_harm: 5, harm_amount: 2,
    event_text: 'Zoe wants Rex to have fewer cookies. She deliberately throws away 2 of Rex\'s cookies.',
    event_title: 'Zoe Throws Rex\'s Cookies Away',
    story_slides: ['img/trailppt/rex_zoe/rex_zoe_1.png','img/trailppt/rex_zoe/rex_zoe_2.png','img/trailppt/rex_zoe/rex_zoe_3.png','img/trailppt/rex_zoe/rex_zoe_4.png','img/trailppt/rex_zoe/rex_zoe_5.png','img/trailppt/rex_zoe/rex_zoe_6.png','img/trailppt/rex_zoe/rex_zoe_7.png']
  },
  {
    id: 7,
    p_name: 'Kai', v_name: 'Ruby', p_img: 'kai.png', v_img: 'Ruby.png',
    harm_type: 'negligent',
    p_cookies: 7, p_after: 7,
    v_initial: 7, v_after_harm: 5, harm_amount: 2,
    event_text: 'Kai walks without looking where he is going and bumps into Ruby. 2 of Ruby\'s cookies fall off.',
    event_title: 'Kai Bumps Into Ruby',
    story_slides: ['img/trailppt/kai_ruby/kai_ruby_1.png','img/trailppt/kai_ruby/kai_ruby_2.png','img/trailppt/kai_ruby/kai_ruby_3.png','img/trailppt/kai_ruby/kai_ruby_4.png','img/trailppt/kai_ruby/kai_ruby_5.png','img/trailppt/kai_ruby/kai_ruby_6.png','img/trailppt/kai_ruby/kai_ruby_7.png','img/trailppt/kai_ruby/kai_ruby_8.png','img/trailppt/kai_ruby/kai_ruby_9.png']
  },
  {
    id: 8,
    p_name: 'Sam', v_name: 'Ella', p_img: 'sam.png', v_img: 'ella.png',
    harm_type: 'strict_liability',
    p_cookies: 5, p_after: 5,
    v_initial: 3, v_after_harm: 1, harm_amount: 2,
    event_text: 'Sam is walking his dog on a leash when the dog breaks free and eats 2 of Ella\'s cookies.',
    event_title: 'Sam\'s Dog Eats Ella\'s Cookies',
    story_slides: ['img/trailppt/sam_ella/sam_ella_1.png','img/trailppt/sam_ella/sam_ella_2.png','img/trailppt/sam_ella/sam_ella_3.png','img/trailppt/sam_ella/sam_ella_4.png','img/trailppt/sam_ella/sam_ella_5.png','img/trailppt/sam_ella/sam_ella_6.png','img/trailppt/sam_ella/sam_ella_7.png','img/trailppt/sam_ella/sam_ella_8.png','img/trailppt/sam_ella/sam_ella_9.png']
  },
  {
    id: 9,
    p_name: 'Catherine', v_name: 'Andy', p_img: 'catherine.png', v_img: 'andy.png',
    harm_type: 'strict_liability',
    p_cookies: 7, p_after: 7,
    v_initial: 7, v_after_harm: 5, harm_amount: 2,
    event_text: 'Andy and Catherine bumped into each other accidentally. Catherine\'s wolf ate 2 of Andy\'s cookies.',
    event_title: 'Catherine\'s Wolf Eats Andy\'s Cookies',
    story_slides: ['img/trailppt/andy_catherine/andy_catherine_1.png','img/trailppt/andy_catherine/andy_catherine_2.png','img/trailppt/andy_catherine/andy_catherine_3.png','img/trailppt/andy_catherine/andy_catherine_4.png','img/trailppt/andy_catherine/andy_catherine_5.png','img/trailppt/andy_catherine/andy_catherine_6.png','img/trailppt/andy_catherine/andy_catherine_7.png','img/trailppt/andy_catherine/andy_catherine_8.png']
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

// Slide 1a – Introduce Michael
const warmupIntroFinn = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:30px 20px;">
      <p class="slide-instruction">This is Michael</p>
      <img src="img/michael.png" class="char-img intro-img" alt="Michael" style="margin:20px auto; display:block;">
      <p class="slide-instruction" style="margin-top:16px;">Michael has 3 cookies</p>
      <div style="display:flex; justify-content:center; margin-top:10px;">
        ${freeCookiesHTML(3, false)}
      </div>
    </div>`,
  choices: ['Next'],
};

// Slide 1b – Introduce Claire
const warmupIntroCleo = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:30px 20px;">
      <p class="slide-instruction">This is Claire</p>
      <img src="img/claire.png" class="char-img intro-img" alt="Claire" style="margin:20px auto; display:block;">
      <p class="slide-instruction" style="margin-top:16px;">Claire has 3 cookies</p>
      <div style="display:flex; justify-content:center; margin-top:10px;">
        ${freeCookiesHTML(3, false)}
      </div>
    </div>`,
  choices: ['Next'],
};

// Slide 2a – Practice: move a cookie to Claire
const warmupPracticeV = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Try it out! Move one of Michael's cookies to Claire's plate.",
  require_v: true,
  require_trash: false,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Michael', v_name: 'Claire',
  p_img: 'michael.png', v_img: 'claire.png',
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
  instruction_text: "Now move one of Michael's cookies to the Cookie Jar.",
  require_v: false,
  require_trash: true,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Michael', v_name: 'Claire',
  p_img: 'michael.png', v_img: 'claire.png',
};

// Slide 2c – Practice: move a cookie to both Claire and the Cookie Jar
const warmupPracticeBoth = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Last one! Move at least one cookie to Claire's plate AND at least one to the Cookie Jar.",
  require_v: false,
  require_trash: false,
  require_both: true,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Michael', v_name: 'Claire',
  p_img: 'michael.png', v_img: 'claire.png',
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

  // Story slide – all slides
  const _storyImgs = scenario.story_slides;
  const storySlide = {
    _debugLabel: `${trialLabel} — Story`,
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding-top:20px;">
        <img id="story-img" src="${_storyImgs[0]}"
             style="max-width:860px; width:100%; max-height:62vh; object-fit:contain; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <button id="story-prev"
                  style="padding:8px 20px; font-size:15px; border-radius:6px; cursor:pointer;">
            ◀ Prev
          </button>
          <span id="story-counter" style="font-size:15px; color:#555;">
            1 / ${_storyImgs.length}
          </span>
          <button id="story-next"
                  style="padding:8px 20px; font-size:15px; border-radius:6px; cursor:pointer;">
            Next ▶
          </button>
        </div>
      </div>`,
    choices: ['Continue'],
    on_start: function() { updateProgressBar(scenarioIdx, total); },
    on_load: function() {
      const imgs = _storyImgs;
      let cur = 0;
      const continueBtn = document.querySelector('.jspsych-btn');
      if (imgs.length > 1) {
        continueBtn.disabled = true;
        continueBtn.style.opacity = '0.4';
        continueBtn.style.cursor = 'not-allowed';
      }
      function update() {
        document.getElementById('story-img').src = imgs[cur];
        document.getElementById('story-counter').textContent = (cur + 1) + ' / ' + imgs.length;
        if (cur === imgs.length - 1) {
          continueBtn.disabled = false;
          continueBtn.style.opacity = '1';
          continueBtn.style.cursor = 'pointer';
        }
      }
      document.getElementById('story-prev').addEventListener('click', () => {
        if (cur > 0) { cur--; update(); }
      });
      document.getElementById('story-next').addEventListener('click', () => {
        if (cur < imgs.length - 1) { cur++; update(); }
      });
    },
  };

  // Decision question slide
  const headerImg = scenario.story_slides[scenario.story_slides.length - 1];
  const questionSlide = {
    _debugLabel: `${trialLabel} — Decision Question`,
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; padding:10px 20px;">
        <img src="${headerImg}" class="allocation-header-img" alt="">
        <p style="font-size:20px; font-weight:600; margin:24px 0 8px;">Do you want to move any of the cookies?</p>
      </div>`,
    choices: ['Yes', 'No'],
  };

  // Slide G – Allocation task (only shown if viewer clicks Yes)
  const slideG = {
    _debugLabel: `${trialLabel} — G: Allocation`,
    type: jsPsychAllocation,
    p_cookies: pAfter,
    v_cookies_current: scenario.v_after_harm,
    hud_p_cookies: scenario.p_cookies,
    hud_v_cookies: scenario.v_initial,
    trash_on_left: TRASH_ON_LEFT,
    header_img: headerImg,
    harm_text: '',
    instruction_text: '',
    p_name: pName, v_name: vName, p_img: pImg, v_img: vImg,
    require_v: false,
    require_trash: false,
    require_both: false,
    is_practice: false,
    scenario_id: scenario.id,
    harm_type: scenario.harm_type,
  };

  const conditionalAlloc = {
    _debugLabel: `${trialLabel} — Allocation (shown only if Yes)`,
    timeline: [slideG],
    conditional_function: function() {
      return jsPsych.data.get().last(1).values()[0].response === 0;
    },
  };

  return [storySlide, questionSlide, conditionalAlloc];
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
warmupIntroFinn._debugLabel = 'Intro: Michael';
warmupIntroCleo._debugLabel = 'Intro: Claire';
warmupPracticeV._debugLabel          = 'Warmup: Practice (Claire)';
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
   *** DELETE THIS ENTIRE BLOCK BEFORE GIVING TO PARTICIPANTS ***
   ============================================================ */
(function () {
  // Read jump target from URL param (?jumpTo=N)
  const params  = new URLSearchParams(window.location.search);
  const jumpTo  = parseInt(params.get('jumpTo') || '0');

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
  `;
  document.body.appendChild(panel);

  document.getElementById('rdp-jump').addEventListener('click', () => {
    const idx = document.getElementById('rdp-select').value;
    window.location.search = '?jumpTo=' + idx;
  });

  // Start experiment from the selected slide
  jsPsych.run(jumpTo > 0 ? timeline.slice(jumpTo) : timeline);
})();
/* *** END OF RESEARCHER DEBUG BLOCK *** */
