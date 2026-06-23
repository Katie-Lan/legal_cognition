/* ============================================================
   CAUSE & FAULT EXPERIMENT 1
   jsPsych 7 – Cookie Allocation Task
   ============================================================ */

/* ----------------------------------------------------------
   INITIALIZE jsPsych
   ---------------------------------------------------------- */
var participantConsented = false;
var _demoData = {}; // captured before jsPsych clears the display

const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  show_progress_bar: true,
  on_finish: function () {
    if (!participantConsented) {
      document.getElementById('jspsych-target').innerHTML = `
        <div style="text-align:center; padding:80px 40px; max-width:700px; margin:0 auto; font-family:sans-serif; color:#333;">
          <p style="font-size:20px;">You have chosen not to participate in this study.</p>
          <p style="font-size:18px; color:#666; margin-top:16px;">You may close this browser window.</p>
        </div>`;
      return;
    }
    // Send trial and demographic data to proliferate for storage.
    // Upload status is shown to the participant in the #thanks element.
    const trials      = jsPsych.data.get().values().filter(row => row.is_practice === false && !row.is_demographic).sort((a, b) => a.scenario_id - b.scenario_id);
    const demographics = jsPsych.data.get().filter({ is_demographic: true }).values();
    if (typeof proliferate !== 'undefined') {
      proliferate.submit({ "trials": trials, "demographics": demographics });
    } else {
      // Fallback when not launched through proliferate (e.g. local preview):
      // log the data and show a simple thank-you screen so nothing appears broken.
      console.table(trials);
      console.table(demographics);
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
    p_cookies: 5, p_after: 5,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
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
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Milo is angry at Sasha. He walks over and deliberately knocks off 2 of Sasha\'s cookies.',
    event_title: 'Milo Knocks Sasha\'s Cookies',
    story_slides: ['img/trailppt/milo_sasha/milo_sasha_1.png','img/trailppt/milo_sasha/milo_sasha_2.png','img/trailppt/milo_sasha/milo_sasha_3.png','img/trailppt/milo_sasha/milo_sasha_4.png','img/trailppt/milo_sasha/milo_sasha_5.png','img/trailppt/milo_sasha/milo_sasha_6.png','img/trailppt/milo_sasha/milo_sasha_7.png','img/trailppt/milo_sasha/milo_sasha_8.png']
  },
  {
    id: 6,
    p_name: 'Zoe', v_name: 'Rex', p_img: 'zoe.png', v_img: 'rex.png',
    harm_type: 'intentional',
    p_cookies: 7, p_after: 7,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Zoe wants Rex to have fewer cookies. She deliberately throws away 2 of Rex\'s cookies.',
    event_title: 'Zoe Throws Rex\'s Cookies Away',
    story_slides: ['img/trailppt/rex_zoe/rex_zoe_1.png','img/trailppt/rex_zoe/rex_zoe_2.png','img/trailppt/rex_zoe/rex_zoe_3.png','img/trailppt/rex_zoe/rex_zoe_4.png','img/trailppt/rex_zoe/rex_zoe_5.png','img/trailppt/rex_zoe/rex_zoe_6.png','img/trailppt/rex_zoe/rex_zoe_7.png']
  },
  {
    id: 7,
    p_name: 'Kai', v_name: 'Ruby', p_img: 'kai.png', v_img: 'Ruby.png',
    harm_type: 'negligent',
    p_cookies: 7, p_after: 7,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Kai walks without looking where he is going and bumps into Ruby. 2 of Ruby\'s cookies fall off.',
    event_title: 'Kai Bumps Into Ruby',
    story_slides: ['img/trailppt/kai_ruby/kai_ruby_1.png','img/trailppt/kai_ruby/kai_ruby_2.png','img/trailppt/kai_ruby/kai_ruby_3.png','img/trailppt/kai_ruby/kai_ruby_4.png','img/trailppt/kai_ruby/kai_ruby_5.png','img/trailppt/kai_ruby/kai_ruby_6.png','img/trailppt/kai_ruby/kai_ruby_7.png','img/trailppt/kai_ruby/kai_ruby_8.png','img/trailppt/kai_ruby/kai_ruby_9.png']
  },
  {
    id: 8,
    p_name: 'Sam', v_name: 'Ella', p_img: 'sam.png', v_img: 'ella.png',
    harm_type: 'strict_liability',
    p_cookies: 5, p_after: 5,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Sam is walking his dog on a leash when the dog breaks free and eats 2 of Ella\'s cookies.',
    event_title: 'Sam\'s Dog Eats Ella\'s Cookies',
    story_slides: ['img/trailppt/sam_ella/sam_ella_1.png','img/trailppt/sam_ella/sam_ella_2.png','img/trailppt/sam_ella/sam_ella_3.png','img/trailppt/sam_ella/sam_ella_4.png','img/trailppt/sam_ella/sam_ella_5.png','img/trailppt/sam_ella/sam_ella_6.png','img/trailppt/sam_ella/sam_ella_7.png','img/trailppt/sam_ella/sam_ella_8.png','img/trailppt/sam_ella/sam_ella_9.png']
  },
  {
    id: 9,
    p_name: 'Catherine', v_name: 'Andy', p_img: 'catherine.png', v_img: 'andy.png',
    harm_type: 'strict_liability',
    p_cookies: 7, p_after: 7,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Andy and Catherine bumped into each other accidentally. Catherine\'s wolf ate 2 of Andy\'s cookies.',
    event_title: 'Catherine\'s Wolf Eats Andy\'s Cookies',
    story_slides: ['img/trailppt/andy_catherine/andy_catherine_1.png','img/trailppt/andy_catherine/andy_catherine_2.png','img/trailppt/andy_catherine/andy_catherine_3.png','img/trailppt/andy_catherine/andy_catherine_4.png','img/trailppt/andy_catherine/andy_catherine_5.png','img/trailppt/andy_catherine/andy_catherine_6.png','img/trailppt/andy_catherine/andy_catherine_7.png','img/trailppt/andy_catherine/andy_catherine_8.png']
  },
  {
    id: 10,
    p_name: 'Tony', v_name: 'Katie', p_img: 'tony.png', v_img: 'katie.png',
    harm_type: 'strict_liability',
    p_cookies: 5, p_after: 5,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'Katie and Tony are having a picnic when a gust of wind blows 2 of Katie\'s cookies away.',
    event_title: 'Wind Blows Away Katie\'s Cookies',
    story_slides: ['img/trailppt/harry_katie/harry_katie_1.png','img/trailppt/harry_katie/harry_katie_2.png','img/trailppt/harry_katie/harry_katie_3.png','img/trailppt/harry_katie/harry_katie_4.png','img/trailppt/harry_katie/harry_katie_5.png','img/trailppt/harry_katie/harry_katie_6.png','img/trailppt/harry_katie/harry_katie_7.png','img/trailppt/harry_katie/harry_katie_8.png']
  },
  {
    id: 11,
    p_name: 'Nora', v_name: 'Eric', p_img: 'nora.png', v_img: 'eric.png',
    harm_type: 'strict_liability',
    p_cookies: 7, p_after: 7,
    v_initial: 2, v_after_harm: 0, harm_amount: 2,
    event_text: 'While Eric is tying his shoelaces, a squirrel eats 2 of Eric\'s cookies.',
    event_title: 'Squirrel Eats Eric\'s Cookies',
    story_slides: ['img/trailppt/nora_eric/nora_eric_1.png','img/trailppt/nora_eric/nora_eric_2.png','img/trailppt/nora_eric/nora_eric_3.png','img/trailppt/nora_eric/nora_eric_4.png','img/trailppt/nora_eric/nora_eric_5.png','img/trailppt/nora_eric/nora_eric_6.png','img/trailppt/nora_eric/nora_eric_7.png']
  }
];

/* ----------------------------------------------------------
   CONSENT SCREEN (first page of study)
   ---------------------------------------------------------- */
const consentScreen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div id="consent-scroll" style="max-width:720px; margin:0 auto; padding:36px 48px 28px 48px; font-family:'Helvetica Neue', Arial, sans-serif; color:#333; font-size:14px; line-height:1.5; text-align:left; max-height:calc(100vh - 220px); overflow-y:auto; background-color:#b8d4e8; border-radius:4px;">
      <h2 style="text-align:center; font-size:16px; font-weight:bold; letter-spacing:0.04em; margin:0 0 24px 0; text-transform:uppercase;">Consent Form</h2>
      <p style="margin:0 0 14px 0;">Thank you for agreeing to take part in this study. We appreciate your time and effort. In this study, we will present you with a fictional scenario, and then we will ask you to answer a brief series of questions about that scenario. The questions have no right or wrong answers-- we're just exploring features of human psychology in this research. You will be paid $0.45 for your time and efforts. We do not anticipate any risks from participating in this research. While you will not directly benefit from taking part in this research study, we hope society and the scientific community will benefit from the knowledge gained about human psychology and judgment.</p>
      <p style="margin:0 0 14px 0;">Your involvement should take about 5 minutes. Your participation is voluntary and you can stop at any time. If you consent to take part in this survey, please indicate so below, and then click the arrow to advance. If not, simply close your browser window.</p>
      <p style="margin:0 0 14px 0;">The research data will be collected anonymously. We will not ask you to provide any personally identifiable information (such as an email-address, name, etc.) and will not be able to link your response to you. We anticipate that your participation in this survey presents no greater risk than everyday use of the Internet. Of course, please note that there is always the possible risk of intrusion by outside agents (i.e. hacking) whenever information shared over the Internet. In order to keep your identifying information and data from this study separate, we will host the survey on an unaffiliated platform, Qualtrics. Thus, Prolific will not have access to the data you provide us. Additionally, we will not ask for directly or indirectly identifiable information in the survey.</p>
      <p style="margin:0 0 14px 0;">If you have any questions about the research study, please contact Shaun Nichols (sbn44@cornell.edu) at Cornell University. If you have any questions or concerns regarding your rights as a subject in this study, you may contact the Institutional Review Board (IRB) for Human Participants at 607-255-5138 or access their website at <a href="http://www.irb.cornell.edu" target="_blank">http://www.irb.cornell.edu</a>. You may also report your concerns or complaints anonymously through Ethicspoint online at <a href="http://www.hotline.cornell.edu" target="_blank">www.hotline.cornell.edu</a> or by calling toll free at 1-866-293-3077. Ethicspoint is an independent organization that serves as a liaison between the University and the person bringing the complaint so that anonymity can be ensured.</p>
      <p style="margin:0 0 14px 0;">Taking part in this study is voluntary. You can stop at any time. Withdrawal or refusal to participate will not result in any penalty. You do not waive any legal rights or release any agent from liability for negligence by consenting to participate.</p>
      <p style="margin:20px 0 0 0;">If you consent to take part in this survey, please indicate so below:</p>
    </div>`,
  choices: ['I Agree'],
  on_load: function() {
    const btn = document.querySelector('#jspsych-html-button-response-btngroup .jspsych-btn');
    if (btn) {
      btn.style.cssText = 'background:#fff; border:1px solid #999; padding:4px 20px; font-size:14px; color:#333; cursor:pointer; border-radius:2px; font-family:sans-serif; box-shadow:none;';
    }
  },
  on_finish: function(data) {
    participantConsented = true;
  },
  _debugLabel: 'Consent Form',
};

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

// Slide 2d – Practice: move a cookie FROM Claire to Michael
const warmupPracticeFromV = {
  type: jsPsychAllocation,
  p_cookies: 3,
  v_cookies_current: 3,
  hud_p_cookies: 3,
  hud_v_cookies: 3,
  trash_on_left: TRASH_ON_LEFT,
  harm_text: '',
  instruction_text: "Now try the other direction! Move one of Claire's cookies to the Cookie Jar.",
  require_v: false,
  require_trash: false,
  require_both: false,
  require_from_v: true,
  is_practice: true,
  scenario_id: 0,
  p_name: 'Michael', v_name: 'Claire',
  p_img: 'michael.png', v_img: 'claire.png',
};

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

  // Allocation screen with gate question integrated
  const headerImg = scenario.story_slides[scenario.story_slides.length - 1];
  const slideG = {
    _debugLabel: `${trialLabel} — Allocation`,
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
    event_title: scenario.event_title || '',
    show_gate_question: true,
  };

  return [storySlide, slideG];
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
  warmupPracticeFromV,
  warmupDone,
];

// All scenarios combined — fully randomized per participant (stable across jump-reloads)
const allScenarios = [...finnCleoScenarios, ...secondBlockScenarios];
const shuffledAll = sessionGet('exp1_shuffle_all',
  () => jsPsych.randomization.shuffle(allScenarios.map((_, i) => i))
).map(i => allScenarios[i]);
const totalTrials = shuffledAll.length;
const testBlock = [];
shuffledAll.forEach((scenario, idx) => {
  buildTestTrial(scenario, idx, totalTrials).forEach(t => testBlock.push(t));
});

/* ----------------------------------------------------------
   DEMOGRAPHIC & FEEDBACK SCREENS
   ---------------------------------------------------------- */
const demographicsScreen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:680px; margin:0 auto; padding:40px 30px; font-family:sans-serif; color:#333; font-size:15px; text-align:left;">
      <p style="text-align:center; font-weight:bold; font-size:17px; margin-bottom:28px;">Demographic information:</p>

      <table style="width:100%; border-collapse:collapse; line-height:2;">

        <!-- Age -->
        <tr>
          <td style="padding:10px 24px 10px 0; vertical-align:middle; white-space:nowrap;">1. Age:</td>
          <td style="padding:10px 0; vertical-align:middle;">
            <input type="number" id="demo-age" min="18" max="120"
              style="width:70px; padding:3px 7px; font-size:15px; border:1px solid #999; border-radius:3px;">
          </td>
        </tr>

        <!-- Gender -->
        <tr>
          <td style="padding:10px 24px 10px 0; vertical-align:top; white-space:nowrap;">2. Gender:</td>
          <td style="padding:10px 0;">
            <div style="margin-bottom:6px;">
              <label style="margin-right:18px; cursor:pointer;"><input type="radio" name="gender" value="Female" style="margin-right:5px;">Female</label>
              <label style="margin-right:18px; cursor:pointer;"><input type="radio" name="gender" value="Male" style="margin-right:5px;">Male</label>
              <label style="cursor:pointer;"><input type="radio" name="gender" value="Non-binary" style="margin-right:5px;">Non-binary</label>
            </div>
            <div>
              <label style="cursor:pointer;">
                <input type="radio" name="gender" value="__other__" style="margin-right:5px;">Other:
                <input type="text" id="gender-other" style="margin-left:6px; padding:2px 7px; font-size:14px; border:1px solid #999; border-radius:3px; width:180px;">
              </label>
            </div>
          </td>
        </tr>

        <!-- Race -->
        <tr>
          <td style="padding:10px 24px 10px 0; vertical-align:top; white-space:nowrap;">3. Race:</td>
          <td style="padding:10px 0;">
            ${['White','Black/African American','American Indian/Alaska Native','Asian',
               'Native Hawaiian/Pacific Islander','Multiracial/Mixed']
              .map(r => `<div><label style="cursor:pointer;"><input type="radio" name="race" value="${r}" style="margin-right:5px;">${r}</label></div>`).join('')}
            <div>
              <label style="cursor:pointer;">
                <input type="radio" name="race" value="__other__" style="margin-right:5px;">Other:
                <input type="text" id="race-other" style="margin-left:6px; padding:2px 7px; font-size:14px; border:1px solid #999; border-radius:3px; width:180px;">
              </label>
            </div>
          </td>
        </tr>

        <!-- Ethnicity -->
        <tr>
          <td style="padding:10px 24px 10px 0; vertical-align:middle; white-space:nowrap;">4. Ethnicity:</td>
          <td style="padding:10px 0;">
            <label style="margin-right:18px; cursor:pointer;"><input type="radio" name="ethnicity" value="Hispanic" style="margin-right:5px;">Hispanic</label>
            <label style="cursor:pointer;"><input type="radio" name="ethnicity" value="Non-Hispanic" style="margin-right:5px;">Non-Hispanic</label>
          </td>
        </tr>

      </table>

      <p style="margin-top:28px; font-size:15px;">Please press <strong>Submit</strong> to complete the experiment.</p>
      <p id="demo-error" style="color:#cc0000; font-size:14px; margin-top:8px; display:none; font-weight:500;">Please answer all questions before submitting.</p>
    </div>`,
  choices: ['Submit'],
  on_load: function() {
    const btn = document.querySelector('.jspsych-btn');
    if (!btn) return;
    btn.addEventListener('click', function(e) {
      const age       = document.getElementById('demo-age')?.value?.trim();
      const gender    = document.querySelector('input[name="gender"]:checked');
      const race      = document.querySelector('input[name="race"]:checked');
      const ethnicity = document.querySelector('input[name="ethnicity"]:checked');
      const errEl     = document.getElementById('demo-error');
      if (!age || !gender || !race || !ethnicity) {
        e.stopImmediatePropagation();
        if (errEl) errEl.style.display = 'block';
      } else {
        if (errEl) errEl.style.display = 'none';
        // Capture values NOW — jsPsych clears the DOM before on_finish runs
        _demoData.age       = age;
        _demoData.gender    = gender.value === '__other__'
          ? 'Other: ' + (document.getElementById('gender-other')?.value || '')
          : gender.value;
        _demoData.race      = race.value === '__other__'
          ? 'Other: ' + (document.getElementById('race-other')?.value || '')
          : race.value;
        _demoData.ethnicity = ethnicity.value;
      }
    }, true); // capture phase fires before jsPsych's own listener
  },
  on_finish: function(data) {
    data.age       = _demoData.age       || '';
    data.gender    = _demoData.gender    || '';
    data.race      = _demoData.race      || '';
    data.ethnicity = _demoData.ethnicity || '';
  },
  data: { is_demographic: true, is_practice: false },
  _debugLabel: 'Demographics',
};

const feedbackScreen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:center; padding:40px; max-width:700px; margin:0 auto; font-family:sans-serif;">
      <p style="font-size:20px; margin-bottom:20px;">Was anything confusing, or do you have any feedback about any part of this study?</p>
      <textarea id="feedback-input" rows="6"
        style="width:100%; font-size:16px; padding:12px; border:2px solid #ccc;
               border-radius:8px; resize:vertical; font-family:inherit;"
        placeholder="Your feedback here (optional)..."></textarea>
    </div>`,
  choices: ['Submit'],
  on_load: function() {
    const btn = document.querySelector('.jspsych-btn');
    if (!btn) return;
    // Capture feedback before jsPsych clears the DOM
    btn.addEventListener('click', function() {
      _demoData.feedback = document.getElementById('feedback-input')?.value || '';
    }, true);
  },
  on_finish: function(data) {
    data.feedback = _demoData.feedback || '';
  },
  data: { is_demographic: true, demographic_type: 'feedback', is_practice: false },
  _debugLabel: 'Feedback',
};

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
consentScreen._debugLabel   = 'Consent Form';
welcomeScreen._debugLabel   = 'Welcome Screen';
warmupIntroFinn._debugLabel = 'Intro: Michael';
warmupIntroCleo._debugLabel = 'Intro: Claire';
warmupPracticeV._debugLabel          = 'Warmup: Practice (Claire)';
warmupPracticeTrash._debugLabel      = 'Warmup: Practice (Jar)';
warmupPracticeBoth._debugLabel       = 'Warmup: Practice (Both)';
warmupPracticeFromV._debugLabel      = 'Warmup: Practice (move from Claire)';
warmupDone._debugLabel               = 'Warmup: Done';
demographicsScreen._debugLabel = 'Demographics';
feedbackScreen._debugLabel = 'Feedback';
endScreen._debugLabel       = 'End Screen';

/* ----------------------------------------------------------
   RUN
   ---------------------------------------------------------- */
const timeline = [
  consentScreen,
  ...warmupBlock,
  ...testBlock,
  demographicsScreen,
  feedbackScreen,
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
