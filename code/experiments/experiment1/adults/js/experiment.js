/* ============================================================
   CAUSE & FAULT EXPERIMENT 1
   jsPsych 7 – Cookie Allocation Task
   ============================================================ */

/* ----------------------------------------------------------
   INITIALIZE jsPsych
   ---------------------------------------------------------- */
const jsPsych = initJsPsych({
  on_finish: function () {
    // Display data at the end (replace with JATOS / server POST in deployment)
    const data = jsPsych.data.get().filter({ is_practice: false }).values();
    console.table(data);
    document.body.innerHTML = `
      <div style="text-align:center; padding:80px; font-family:sans-serif;">
        <h2>Thank you for participating!</h2>
        <p>Your responses have been recorded.</p>
        <button onclick="jsPsych.data.displayData('json')" style="padding:10px 24px; font-size:16px; cursor:pointer;">
          View data
        </button>
      </div>`;
  }
});

/* ----------------------------------------------------------
   PARTICIPANT-LEVEL RANDOMIZATION
   ---------------------------------------------------------- */
// Trash panel position is fixed for the whole session
const TRASH_ON_LEFT = Math.random() < 0.5;

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

/** Two-person display (P left, V right) with optional cookies */
function twoPersonHTML({ pCookies, vCookies, pLabel, vLabel, showSlots, animate }) {
  return `
    <div class="two-person-display">
      <div class="person-col">
        <img src="img/finn_neutral.png" class="char-img" alt="Finn">
        <div class="char-card large">Finn</div>
        ${showSlots ? `<div class="cookie-label">${pLabel}</div>
          ${cookieGridHTML(pCookies, 5, 'large', animate)}` : ''}
      </div>
      <div class="person-col">
        <img src="img/cleo_neutral.png" class="char-img" alt="Cleo">
        <div class="char-card large">Cleo</div>
        ${showSlots ? `<div class="cookie-label">${vLabel}</div>
          ${cookieGridHTML(vCookies, 5, 'large', animate)}` : ''}
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
  const harmTypeLabel = scenario.harm_type === 'intentional' ? 'perpetrator' : 'negligent';
  const vCookiesNow = showHarm ? scenario.v_after_harm : scenario.v_initial;
  const eventText = showHarm
    ? `<strong>Oh no!</strong> Cleo lost ${scenario.harm_amount} cookies during this event.`
    : scenario.event_text;

  return `
    <div class="event-box">
      <div class="event-scene">
        <div class="event-person ${harmTypeLabel}">
          <div class="char-card medium">Finn</div>
          <div class="event-person-label">Finn</div>
        </div>
        <div class="event-arrow">→</div>
        <div class="event-person">
          <div class="char-card medium">Cleo</div>
          <div class="event-person-label">Cleo</div>
        </div>
      </div>
      <div class="event-description">${eventText}</div>
    </div>`;
}

/* ----------------------------------------------------------
   SCENARIO DEFINITIONS
   ---------------------------------------------------------- */
const scenarios = [
  {
    id: 1,
    harm_type: 'intentional',
    p_cookies: 5,
    v_initial: 4,
    v_after_harm: 2,
    harm_amount: 2,
    event_text: 'Finn walks up to Cleo and deliberately kicks 2 of Cleo\'s cookies, destroying them.',
    event_title: 'Finn Kicks Cleo\'s Cookies'
  },
  {
    id: 2,
    harm_type: 'negligent',
    p_cookies: 5,
    v_initial: 3,
    v_after_harm: 1,
    harm_amount: 2,
    event_text: 'Finn spills water and doesn\'t clean it up. Cleo slips on the wet floor and 2 of Cleo\'s cookies are destroyed.',
    event_title: 'Finn Spills Water — Cleo Slips'
  },
  {
    id: 3,
    harm_type: 'negligent',
    p_cookies: 5,
    v_initial: 4,
    v_after_harm: 2,
    harm_amount: 2,
    event_text: 'Finn is looking at their phone while riding a bicycle. Not paying attention, Finn crashes into Cleo and 2 of Cleo\'s cookies are destroyed.',
    event_title: 'Finn Crashes Into Cleo'
  },
  {
    id: 4,
    harm_type: 'intentional',
    p_cookies: 5,
    v_initial: 3,
    v_after_harm: 1,
    harm_amount: 2,
    event_text: 'Finn picks up a rock and throws it at Cleo\'s cookies. The rock hits and destroys 2 of them.',
    event_title: 'Finn Throws a Rock'
  }
];

/* ----------------------------------------------------------
   WARMUP TIMELINE
   ---------------------------------------------------------- */

// Slide 1 – Introduce P and V
const warmupIntroPersons = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    ${twoPersonHTML({ pCookies: 0, vCookies: 0, showSlots: false })}
    <div style="text-align:center; margin-top:30px;">
      <p class="slide-instruction" style="display:inline-block; text-align:left;">
        You will be introduced to different people today
      </p>
    </div>`,
  choices: ['Next'],
};

// Slide 3 – Show 5 empty slots
const warmupShowSlots = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    ${twoPersonHTML({
      pCookies: 0, vCookies: 0,
      pLabel: 'Finn can carry 5 cookies', vLabel: 'Cleo can carry 5 cookies',
      showSlots: true, animate: false
    })}
    <div style="text-align:center; margin-top:10px;">
      <p class="slide-instruction" style="display:inline-block; text-align:left;">
        Each person has 5 slots for carrying cookies
      </p>
    </div>`,
  choices: ['Next'],
};

// Slide 4 – Fill in P=5, V=5 (animated)
const warmupFillCookies = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    ${twoPersonHTML({
      pCookies: 5, vCookies: 5,
      pLabel: 'Finn has 5 cookies', vLabel: 'Cleo has 5 cookies',
      showSlots: true, animate: true
    })}
    <div style="text-align:center; margin-top:10px;">
      <p class="slide-instruction" style="display:inline-block; text-align:left;">
        You will then learn about how many cookies each person has.<br>
        Here Finn has 5 and Cleo has 5
      </p>
    </div>`,
  choices: ['Next'],
};

// Slide 5 – "You will learn something P does"
const warmupLearnEvent = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout(
    twoPersonHTML({ pCookies: 5, vCookies: 5, pLabel: 'Finn has 5 cookies', vLabel: 'Cleo has 5 cookies', showSlots: true }),
    'You will then learn about something Finn does'
  ),
  choices: ['Next'],
};

// Slide 6 – V loses 2 cookies (V: 5→3)
const warmupVLoses = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout(
    twoPersonHTML({
      pCookies: 5, vCookies: 3,
      pLabel: 'Finn has 5 cookies', vLabel: 'Cleo has 3 cookies',
      showSlots: true, animate: false
    }),
    'After Finn does something, Cleo will lose some cookies.<br>Here Finn did something and Cleo lost 2 cookies'
  ),
  choices: ['Next'],
};

// Slide 7 – "You will decide what should happen"
const warmupDecide = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout(
    twoPersonHTML({
      pCookies: 5, vCookies: 3,
      pLabel: 'Finn has 5 cookies', vLabel: 'Cleo has 3 cookies',
      showSlots: true
    }),
    'You will then decide what should happen'
  ),
  choices: ['Next'],
};

// Slide 8 – Explain P→V option (static)
const warmupExplainPtoV = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout(
    '',
    'You can decide to take some cookies from Finn and give them to Cleo'
  ),
  choices: ['Next'],
};

// Slide 10 – Practice P→V (must move ≥1 to V)
const warmupPracticeV = {
  type: jsPsychAllocation,
  p_cookies: 5,
  v_cookies_current: 3,
  hud_p_cookies: 5,
  hud_v_cookies: 5,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Let's give it a try! Try moving cookies from Finn to Cleo",
  require_v: true,
  require_trash: false,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
};

// Slide 11 – Explain P→Trash option (static)
const warmupExplainPtoTrash = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout('', 'You can also decide to take some cookies from Finn and put them in the trash'),
  choices: ['Next'],
};

// Slide 12 – Practice P→Trash (must move ≥1 to Trash)
const warmupPracticeTrash = {
  type: jsPsychAllocation,
  p_cookies: 5,
  v_cookies_current: 3,
  hud_p_cookies: 5,
  hud_v_cookies: 5,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Let's give it a try! Try moving cookies from Finn to the trash",
  require_v: false,
  require_trash: true,
  require_both: false,
  is_practice: true,
  scenario_id: 0,
};

// Slide 13 – Explain both option
const warmupExplainBoth = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout('', 'You can also decide to take cookies from Finn and put them in the trash and give some to Cleo'),
  choices: ['Next'],
};

// Slide 14 – Practice both
const warmupPracticeBoth = {
  type: jsPsychAllocation,
  p_cookies: 5,
  v_cookies_current: 3,
  hud_p_cookies: 5,
  hud_v_cookies: 5,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Let's give it a try! Try moving cookies from Finn to the trash and to Cleo",
  require_v: false,
  require_trash: false,
  require_both: true,
  is_practice: true,
  scenario_id: 0,
};

// Slide 15 – "Choice is yours"
const warmupChoiceYours = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout('', "The choice is yours! You decide where you want to put Finn's cookies"),
  choices: ['Next'],
};

// Slide 16 – "Ready to begin"
const warmupReady = {
  type: jsPsychHtmlButtonResponse,
  stimulus: slideLayout('', "If you're ready to begin, please click next"),
  choices: ['Begin'],
};

/* ----------------------------------------------------------
   TEST TRIAL BUILDER
   ---------------------------------------------------------- */
function buildTestTrial(scenario, scenarioIdx, total) {

  // Slide A – Finn and V (blank)
  const slideA = {
    type: jsPsychHtmlButtonResponse,
    stimulus: twoPersonHTML({ showSlots: false }),
    choices: ['Next'],
    on_start: function() { updateProgressBar(scenarioIdx, total); },
  };

  // Slide B – Show empty slots
  const slideB = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      ${twoPersonHTML({
        pCookies: 0, vCookies: 0,
        pLabel: `Finn can carry 5 cookies`,
        vLabel: `Cleo can carry 5 cookies`,
        showSlots: true, animate: false
      })}`,
    choices: ['Next'],
  };

  // Slide C – Fill in initial cookies (animated)
  const slideC = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      ${twoPersonHTML({
        pCookies: scenario.p_cookies,
        vCookies: scenario.v_initial,
        pLabel: `Finn has ${scenario.p_cookies} cookies`,
        vLabel: `Cleo has ${scenario.v_initial} cookies`,
        showSlots: true,
        animate: true
      })}`,
    choices: ['Next'],
  };

  // Slide D – Event animation/description
  const slideD = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="padding-top:40px; display:flex; justify-content:center;">
        ${eventBoxHTML(scenario, false)}
      </div>`,
    choices: ['Next'],
  };

  // Slide E – V loses cookies (harm result)
  const slideE = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="padding-top:40px; display:flex; flex-direction:column; align-items:center; gap:24px;">
        ${eventBoxHTML(scenario, false)}
        <div class="harm-result-container">
          <p class="harm-result-text">
            Oh no, Cleo lost ${scenario.harm_amount} cookies.<br>
            Cleo now only has <strong>${scenario.v_after_harm}</strong>
            cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.
          </p>
          <div class="char-card large">Cleo</div>
          <div class="cookie-label">Cleo has ${scenario.v_after_harm} cookies</div>
          ${cookieGridHTML(scenario.v_after_harm, 5, 'large', false)}
        </div>
      </div>`,
    choices: ['Next'],
  };

  // Slide F – Allocation task
  const slideF = {
    type: jsPsychAllocation,
    p_cookies: scenario.p_cookies,
    v_cookies_current: scenario.v_after_harm,
    hud_p_cookies: scenario.p_cookies,
    hud_v_cookies: scenario.v_initial,
    trash_on_left: TRASH_ON_LEFT,
    harm_text: `Oh no, Cleo lost ${scenario.harm_amount} cookies. Cleo now only has ${scenario.v_after_harm} cookie${scenario.v_after_harm !== 1 ? 's' : ''} left.`,
    instruction_text: '',
    require_v: false,
    require_trash: false,
    require_both: false,
    is_practice: false,
    scenario_id: scenario.id,
    harm_type: scenario.harm_type,
  };

  return [slideA, slideB, slideC, slideD, slideE, slideF];
}

/* ----------------------------------------------------------
   PROGRESS BAR HELPER
   ---------------------------------------------------------- */
function updateProgressBar(scenarioIdx, total) {
  const pct = ((scenarioIdx + 1) / total * 100).toFixed(1);
  document.getElementById('scenario-progress-container').style.display = 'block';
  document.getElementById('scenario-progress-fill').style.width = pct + '%';
  document.getElementById('scenario-progress-label').textContent =
    `Scenario ${scenarioIdx + 1} of ${total}`;
}

/* ----------------------------------------------------------
   BUILD FULL TIMELINE
   ---------------------------------------------------------- */

// Warmup block
const warmupBlock = [
  warmupIntroPersons,
  warmupShowSlots,
  warmupFillCookies,
  warmupLearnEvent,
  warmupVLoses,
  warmupDecide,
  warmupExplainPtoV,
  warmupPracticeV,
  warmupExplainPtoTrash,
  warmupPracticeTrash,
  warmupExplainBoth,
  warmupPracticeBoth,
  warmupChoiceYours,
  warmupReady,
];

// Test trial block – randomized order
const shuffledScenarios = jsPsych.randomization.shuffle(scenarios);
const testBlock = [];
shuffledScenarios.forEach((scenario, idx) => {
  buildTestTrial(scenario, idx, shuffledScenarios.length).forEach(t => testBlock.push(t));
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
   RUN
   ---------------------------------------------------------- */
const timeline = [
  ...warmupBlock,
  ...testBlock,
  endScreen,
];

jsPsych.run(timeline);
