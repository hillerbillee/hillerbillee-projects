(() => {
  const STORE = "opr-play-assistant-v12";

  const sampleMineText = `++ Case Mix - Beastmen (v3.5.3), Ghostly Undead (v3.5.3), High Elves (v3.5.3), Vampiric Undead (v3.5.3) [AOF 1000pts] [6 Units] ++

Ancient Banshee [1] Q3+ D6+ | 120pts | Ethereal, Hero, Tough(3), Empyrean Spirit, Resistance, No Retreat Aura
Howl (12", A4, AP(1)), Claws (A3)

Vampire Master [1] Q3+ D3+ | 230pts | Furious, Hero, Tough(6), Cursed Undead, Shred in Melee Aura, Fast, Flying, Impact(2), Mind Control
Heavy Great Weapon (A3, AP(3)), Hooves (A1)

Phoenix Warriors [5] Q3+ D4+ | 130pts | 5x Regeneration, 5x Highborn, Piercing Tag(1)
5x Heavy Halberd (A1, AP(1), Rending)

Hapari Harpies [5] Q5+ D5+ | 80pts | 5x Flying, 5x Scout, 5x Bestial
5x Heavy Claws (A2, AP(1))

Crazed Boars [3] Q4+ D5+ | 155pts | 3x Fast, 3x Impact(2), Tough(3), 3x Unpredictable Fighter, 3x Bestial
3x Heavy Tusks (A2, AP(1))

Slimey Beast [1] Q4+ D3+ | 285pts | Fear(2), Flying, Tough(12), Bestial
Tongue Grasp (12", A3, AP(1), Reliable, Takedown), Acid Maw (A6, Shred), Stomp (A4, AP(1))`;

  const sampleOpponentText = `++ Saurian Starhost (v3.5.3) [GF 995pts] [5 Units] ++

Gecko Champion [1] Q5+ D5+ | 145pts | Hero, Strider, Tough(3), Primal, Scout Aura, Good Shot, Scout, Evasive
Champion Sniper Rifle (30", A2, AP(1), Takedown, Reliable), Dagger (A1)

Chameleons [5] Q5+ D5+ | 145pts | 5x Scout, 5x Strider, 5x Good Shot, 5x Primal, 5x Evasive, Ambush Beacon
5x CCW (A1), 5x Precision Carbine (18", A1, Precise, AP(1))

Raptor Riders [5] Q4+ D3+ | 205pts | 5x Ravage(1), 5x Fast, 5x Fearless, 5x Primal
5x Power Claw (A2, AP(1), Rending), 5x Spike Pistol (9", A2, Rending)

Dragon Lizard [1] Q4+ D3+ | 175pts | Fearless, Regeneration, Tough(6), Primal, Strider, Relentless
Flame Burst (12", A2, AP(1), Blast(3), Reliable), Heavy Claws (A3, AP(1))

Spinosaurus [1] Q4+ D2+ | 325pts | Fear(2), Fearless, Tough(12), Primal, Primal Boost Buff, Impact(+3)
Spit Venom (18", A2, Blast(3), Bane), Stomp (A4, AP(1)), Toxic Bite (A6, Bane)`;

  const ACTIONS = [
    ["deploy", "Deploy"],
    ["shoot", "Move + Shoot"],
    ["charge", "Charge"],
    ["melee", "Melee"],
    ["defend", "Defend"],
    ["morale", "Morale"]
  ];

  const state = loadState();

  installShell();
  installStyles();
  bindEvents();
  render();

  function freshState() {
    return {
      units: [],
      activeId: "",
      contextOpen: false,
      action: "charge",
      weaponId: "",
      targetId: "",
      importSide: "mine",
      importOpen: false,
      tired: false,
      hitMod: 0,
      hits: 0,
      rendingHits: 0,
      incomingHits: 0,
      defenseAp: 0,
      failedSaves: 0,
      woundsPerFail: 1,
      regenPasses: 0,
      ignoreRegen: false,
      log: []
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORE)) || freshState());
    } catch {
      return freshState();
    }
  }

  function normalizeState(raw) {
    const next = { ...freshState(), ...(raw || {}) };
    next.units = Array.isArray(raw?.units) ? raw.units.map(normalizeUnit) : [];
    next.log = Array.isArray(raw?.log) ? raw.log : [];
    next.importSide = normalizeSide(next.importSide);
    next.action = ACTIONS.some(([key]) => key === next.action) ? next.action : "charge";
    next.contextOpen = false;
    return next;
  }

  function normalizeUnit(unit) {
    const startModels = Math.max(1, numberValue(unit.startModels ?? unit.models ?? unit.size, 1));
    const currentModels = Math.max(0, numberValue(unit.currentModels ?? startModels, startModels));
    return {
      id: unit.id || makeId(),
      side: normalizeSide(unit.side),
      name: cleanName(unit.name) || "Army Forge Unit",
      startModels,
      currentModels,
      quality: clampRoll(unit.quality ?? 4),
      defense: clampRoll(unit.defense ?? 4),
      rules: String(unit.rules || ""),
      weapons: normalizeWeapons(unit.weapons),
      wounds: Math.max(0, numberValue(unit.wounds, 0)),
      status: unit.status || "ready",
      activated: Boolean(unit.activated),
      artData: typeof unit.artData === "string" ? unit.artData : ""
    };
  }

  function saveState() {
    localStorage.setItem(STORE, JSON.stringify(state));
  }

  function installShell() {
    document.body.innerHTML = `
      <div class="opr-shell">
        <header class="opr-top">
          <div>
            <span>One Page Rules</span>
            <h1>Play Assistant</h1>
          </div>
          <div class="top-buttons">
            <button type="button" data-command="toggle-import">Import</button>
            <button type="button" data-command="reset">Reset</button>
          </div>
        </header>
        <main id="app" class="opr-main"></main>
        <input id="unitArtInput" type="file" accept="image/*" hidden>
      </div>
    `;
  }

  function installStyles() {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        color-scheme: light;
        --ink: #1f2633;
        --muted: #667085;
        --soft: #f2f5f6;
        --line: #d8dee8;
        --paper: #fffdfa;
        --card: #ffffff;
        --primary: #286b61;
        --primary-soft: #e2f0ec;
        --blue: #435fbb;
        --danger: #b5483e;
        --warn: #9c6d1b;
      }

      * {
        box-sizing: border-box;
        min-width: 0;
      }

      html {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }

      body {
        margin: 0;
        width: 100%;
        max-width: 100%;
        min-height: 100vh;
        background: #f3f0e8;
        color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
        overflow-x: hidden;
      }

      button, input, textarea { font: inherit; }

      button {
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        font-weight: 800;
        padding: 0 12px;
      }

      button:active { transform: translateY(1px); }
      button.is-active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
      button.primary { border-color: var(--primary); background: var(--primary); color: #fff; }
      button.danger { border-color: var(--danger); background: var(--danger); color: #fff; }

      .opr-shell {
        width: min(100%, 720px);
        min-height: 100vh;
        margin: 0 auto;
        background: var(--paper);
        overflow-x: hidden;
      }

      .opr-top {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: calc(12px + env(safe-area-inset-top)) 14px 10px;
        background: #1f2633;
        color: #fff;
      }

      .opr-top span {
        display: block;
        color: #cfd7e4;
        font-size: .72rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .opr-top h1 {
        margin: 0;
        font-size: 1.25rem;
        line-height: 1.1;
      }

      .top-buttons {
        display: flex;
        gap: 7px;
      }

      .top-buttons button {
        min-height: 40px;
        padding: 0 10px;
      }

      .opr-main {
        display: grid;
        gap: 12px;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        padding: 12px;
        padding-bottom: calc(88px + env(safe-area-inset-bottom));
      }

      .play-card, .rail-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
      }

      .play-card {
        display: grid;
        gap: 12px;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        padding: 12px;
      }

      .deck-card {
        display: grid;
        gap: 10px;
        width: 100%;
        height: auto;
        min-height: 138px;
        border-color: var(--line);
        background: #fff;
        padding: 14px;
        text-align: left;
      }

      .deck-card.dead {
        opacity: .45;
        filter: grayscale(1);
        background-image: repeating-linear-gradient(135deg, rgba(31, 38, 51, .08) 0 2px, transparent 2px 7px);
      }

      .deck-card.done { opacity: .68; }

      .deck-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .deck-title {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .deck-title strong {
        overflow-wrap: anywhere;
        font-size: 1.15rem;
        line-height: 1.08;
      }

      .deck-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .deck-meta span {
        border-radius: 8px;
        background: var(--soft);
        padding: 8px;
        color: var(--ink);
        font-size: .84rem;
        font-weight: 850;
        line-height: 1.18;
      }

      .deck-rules {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .deck-hint {
        color: var(--muted);
        font-size: .88rem;
        line-height: 1.28;
      }

      .unit-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      h2, h3, p { margin: 0; }
      h2 { font-size: 1.28rem; line-height: 1.15; }
      h3 { font-size: .95rem; }

      .kicker {
        display: block;
        color: var(--muted);
        font-size: .72rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .muted { color: var(--muted); }

      .pill-row, .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .pill, .chip {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        border-radius: 999px;
        background: var(--soft);
        color: var(--ink);
        padding: 0 9px;
        font-size: .75rem;
        font-weight: 850;
      }

      .pill.mine { background: var(--primary-soft); color: var(--primary); }
      .pill.opponent { background: #fff0e5; color: #9b4e19; }
      .pill.done { opacity: .68; }
      .pill.bad { background: #f7dedb; color: var(--danger); }

      .stats, .math-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .stat, .math-box {
        min-width: 0;
        border-radius: 8px;
        background: var(--soft);
        padding: 10px;
      }

      .stat span, .math-box span, label span {
        display: block;
        color: var(--muted);
        font-size: .68rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .stat strong, .math-box strong {
        display: block;
        overflow-wrap: anywhere;
        font-size: 1.25rem;
        line-height: 1.1;
      }

      .math-box small {
        display: block;
        color: var(--muted);
        line-height: 1.25;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 6px;
      }

      .actions button {
        min-height: 44px;
        padding: 0 8px;
        font-size: .78rem;
        line-height: 1.1;
        white-space: normal;
      }

      .quick {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .block {
        display: grid;
        gap: 8px;
        width: 100%;
        max-width: 100%;
      }

      .block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .targets, .weapons, .steps {
        display: grid;
        gap: 8px;
      }

      .target, .weapon {
        display: grid;
        justify-items: start;
        width: 100%;
        max-width: 100%;
        height: auto;
        min-height: 54px;
        border-color: #c8d0dc;
        background: #edf4f3;
        text-align: left;
        padding: 9px 10px;
      }

      .target strong, .weapon strong {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: normal;
      }

      .target small, .weapon small {
        color: var(--muted);
        font-weight: 750;
      }

      .target.is-active, .weapon.is-active {
        border-color: var(--blue);
        background: #eef1ff;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .field-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }

      label {
        display: grid;
        gap: 5px;
        min-width: 0;
      }

      input, textarea {
        width: 100%;
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        padding: 9px;
      }

      input[type="checkbox"] {
        width: auto;
        min-height: 0;
        transform: scale(1.2);
      }

      textarea {
        min-height: 160px;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: .82rem;
      }

      .bump-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .callout {
        border-left: 4px solid var(--blue);
        border-radius: 8px;
        background: #f1f4fb;
        padding: 12px;
        line-height: 1.45;
        font-size: .96rem;
        overflow-wrap: anywhere;
      }

      .callout.warn {
        border-left-color: var(--warn);
        background: #fff5dd;
      }

      .step {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
      }

      .step b:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #1f2633;
        color: #fff;
      }

      .step p {
        line-height: 1.38;
      }

      .step small {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        line-height: 1.35;
      }

      .import-box {
        display: grid;
        gap: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fafbfc;
        padding: 10px;
      }

      .segmented {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .button-row button {
        flex: 1 1 120px;
      }

      .rail-card {
        position: sticky;
        bottom: 0;
        z-index: 9;
        margin: 0 0 calc(-88px - env(safe-area-inset-bottom));
        padding: 8px 12px calc(9px + env(safe-area-inset-bottom));
        border-right: 0;
        border-bottom: 0;
        border-left: 0;
        border-radius: 0;
        background: rgba(255, 253, 250, .98);
        width: 100%;
        max-width: 100%;
        overflow: hidden;
      }

      .rail {
        display: flex;
        gap: 8px;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        padding-bottom: 3px;
        scroll-snap-type: x proximity;
      }

      .unit-thumb {
        flex: 0 0 156px;
        display: grid;
        justify-items: start;
        gap: 4px;
        min-height: 76px;
        padding: 10px;
        text-align: left;
        scroll-snap-align: start;
      }

      .unit-thumb strong {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: .98rem;
      }

      .unit-thumb span {
        color: var(--muted);
        font-size: .8rem;
        line-height: 1.18;
      }

      .unit-thumb.done { opacity: .58; }
      .unit-thumb.dead {
        opacity: .38;
        filter: grayscale(1);
        background-image: repeating-linear-gradient(135deg, rgba(31, 38, 51, .12) 0 2px, transparent 2px 6px);
      }

      .empty {
        border: 1px dashed var(--line);
        border-radius: 8px;
        padding: 18px;
        color: var(--muted);
        text-align: center;
      }

      .log {
        display: grid;
        gap: 5px;
        color: var(--muted);
        font-size: .8rem;
      }

      .focus-card {
        gap: 10px;
        overflow-x: hidden;
      }

      .focus-hero {
        display: grid;
        grid-template-columns: 118px minmax(0, 1fr);
        gap: 10px;
        align-items: stretch;
        width: 100%;
        max-width: 100%;
      }

      .unit-art,
      .deck-art {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        background-color: #202837;
        background-image: var(--unit-art);
        background-size: cover;
        background-position: center;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.25);
      }

      .focus-art {
        min-height: 142px;
      }

      .unit-art span,
      .deck-art span {
        position: absolute;
        left: 8px;
        bottom: 8px;
        max-width: calc(100% - 16px);
        border-radius: 999px;
        background: rgba(15, 23, 42, .76);
        color: #fff;
        padding: 3px 8px;
        font-size: .68rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .focus-copy {
        display: grid;
        align-content: start;
        gap: 8px;
        min-width: 0;
      }

      .focus-topline {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }

      .focus-buttons {
        display: flex;
        gap: 6px;
        flex: 0 0 auto;
      }

      .focus-buttons button {
        min-height: 34px;
        padding: 0 9px;
        font-size: .78rem;
      }

      .focus-copy h2 {
        font-size: 1.42rem;
        line-height: 1.04;
      }

      .mini-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }

      .mini-stats span {
        min-width: 0;
        border-radius: 8px;
        background: var(--soft);
        padding: 7px 8px;
      }

      .mini-stats b,
      .mini-stats small {
        display: block;
      }

      .mini-stats b {
        overflow-wrap: anywhere;
        font-size: .96rem;
        line-height: 1.05;
      }

      .mini-stats small {
        color: var(--muted);
        font-size: .66rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .action-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        width: 100%;
        max-width: 100%;
        overflow: visible;
      }

      .action-strip button {
        min-height: 38px;
        padding: 0 11px;
        font-size: .82rem;
        white-space: normal;
      }

      .compact-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        width: 100%;
        max-width: 100%;
      }

      .compact-actions button {
        min-height: 38px;
        font-size: .82rem;
      }

      .key-rules {
        flex-wrap: wrap;
        overflow: hidden;
      }

      .deck-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
      }

      .deck-card.art-card {
        position: relative;
        display: block;
        min-height: 172px;
        padding: 0;
        overflow: hidden;
        border-color: rgba(31, 38, 51, .2);
        background: #202837;
      }

      .deck-card.art-card.done,
      .deck-card.art-card.dead {
        opacity: 1;
        filter: none;
      }

      .deck-card.art-card.dead .deck-art {
        filter: grayscale(1);
      }

      .deck-card.art-card.done .deck-art {
        filter: saturate(.55) brightness(.88);
      }

      .deck-card.art-card.dead::after,
      .deck-card.art-card.done::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(255, 253, 250, .28);
        pointer-events: none;
      }

      .deck-card.art-card .deck-art {
        position: absolute;
        inset: 0;
        border-radius: 0;
      }

      .deck-overlay {
        position: absolute;
        inset: auto 0 0;
        z-index: 1;
        display: grid;
        gap: 7px;
        padding: 34px 10px 10px;
        color: #fff;
        background: linear-gradient(180deg, transparent, rgba(13, 18, 28, .9));
        text-shadow: 0 1px 2px rgba(0,0,0,.45);
      }

      .deck-overlay strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 1.05rem;
        line-height: 1.08;
      }

      .deck-overlay .kicker {
        color: rgba(255,255,255,.82);
      }

      .deck-bottom {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .deck-bottom span {
        border-radius: 999px;
        background: rgba(255,255,255,.86);
        color: var(--ink);
        padding: 4px 7px;
        font-size: .72rem;
        font-weight: 900;
        text-shadow: none;
      }

      .targets,
      .weapons {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
      }

      .target,
      .weapon {
        width: 100%;
        max-width: 100%;
        min-height: 58px;
      }

      .stats,
      .math-grid {
        grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
      }

      .field-grid {
        grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
      }

      .field-grid.two {
        grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
      }

      .steps {
        gap: 6px;
      }

      .step {
        grid-template-columns: 32px minmax(0, 1fr);
        gap: 8px;
        padding: 8px;
      }

      .step b:first-child {
        width: 32px;
        height: 32px;
        font-size: .85rem;
      }

      .step p,
      .step small {
        line-height: 1.25;
      }

      .more-steps {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px;
      }

      .more-steps summary {
        cursor: pointer;
        font-weight: 900;
      }

      .more-steps .steps {
        margin-top: 8px;
      }

      .unit-thumb {
        position: relative;
        flex-basis: 124px;
        min-height: 88px;
        align-content: end;
        overflow: hidden;
        border: 0;
        background-color: #202837;
        background-image: linear-gradient(180deg, transparent, rgba(13, 18, 28, .92)), var(--unit-art);
        background-size: cover;
        background-position: center;
        color: #fff;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.2);
      }

      .unit-thumb.home-thumb {
        background-image: linear-gradient(135deg, #f6f7f9, #e8edf1);
        color: var(--ink);
        box-shadow: inset 0 0 0 1px var(--line);
      }

      .unit-thumb strong,
      .unit-thumb span {
        position: relative;
        z-index: 1;
        text-shadow: 0 1px 2px rgba(0,0,0,.45);
      }

      .unit-thumb.home-thumb strong,
      .unit-thumb.home-thumb span {
        text-shadow: none;
      }

      .unit-thumb span {
        color: rgba(255,255,255,.84);
        font-weight: 850;
      }

      .unit-thumb.home-thumb span {
        color: var(--muted);
      }

      .unit-thumb.done {
        opacity: .62;
      }

      .unit-thumb.dead {
        opacity: .42;
        filter: grayscale(1);
        background-image: linear-gradient(180deg, transparent, rgba(13, 18, 28, .92)), var(--unit-art);
      }

      @media (max-width: 640px) {
        .opr-main { padding: 10px; padding-bottom: calc(86px + env(safe-area-inset-bottom)); }
        .opr-top { padding-left: 10px; padding-right: 10px; }
        .top-buttons button { min-height: 38px; padding: 0 8px; }
        .play-card { padding: 10px; }
        .deck-card { min-height: 132px; }
        .deck-card.art-card { min-height: 164px; }
        .deck-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .deck-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .focus-hero { grid-template-columns: 88px minmax(0, 1fr); }
        .focus-art { min-height: 112px; }
        .focus-copy { gap: 6px; }
        .focus-copy h2 { font-size: 1.12rem; }
        .focus-buttons button { min-height: 32px; padding: 0 7px; font-size: .72rem; }
        .pill, .chip { min-height: 25px; padding: 0 7px; font-size: .7rem; }
        .mini-stats b { font-size: .9rem; }
        .mini-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .stats, .math-grid { gap: 6px; }
        .stat, .math-box { padding: 8px; }
        .stat strong, .math-box strong { font-size: 1.05rem; }
        .actions, .quick { gap: 5px; }
        .actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .quick, .compact-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .field-grid, .field-grid.two { grid-template-columns: 1fr; }
        .targets, .weapons { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .action-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .bump-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .unit-head { display: grid; }
        .unit-thumb { flex-basis: 118px; }
      }

      @media (max-width: 370px) {
        .focus-hero { grid-template-columns: 1fr; }
        .focus-art { min-height: 148px; }
        .deck-grid { grid-template-columns: 1fr; }
        .targets, .weapons, .action-strip { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
  }

  function render() {
    const app = document.getElementById("app");
    if (!app) return;

    if (!state.units.length) {
      app.innerHTML = `
        <section class="play-card">
          <div>
            <span class="kicker">Start here</span>
            <h2>Import your list text</h2>
            <p class="muted">Paste the Army Forge text view for clean unit names and rules.</p>
          </div>
          ${renderImportBox()}
        </section>
        <section class="rail-card"><div class="empty">Unit thumbnails appear here after import.</div></section>
      `;
      saveState();
      return;
    }

    const unit = getActiveUnit();
    if (!state.contextOpen || !unit) {
      state.contextOpen = false;
      app.innerHTML = renderUnitDeck();
      saveState();
      return;
    }

    const targetChoices = getTargetChoices(unit);
    if (!targetChoices.some((target) => target.id === state.targetId)) {
      state.targetId = targetChoices[0]?.id || "";
    }
    const target = targetChoices.find((item) => item.id === state.targetId) || null;
    const weapons = getLegalWeapons(unit, state.action);
    if (!weapons.some((weapon) => weapon.id === state.weaponId)) {
      state.weaponId = weapons[0]?.id || "";
    }
    const weapon = weapons.find((item) => item.id === state.weaponId) || null;
    const rules = normalizedRules(unit);
    const dead = unit.currentModels <= 0;
    const tough = ruleRating(unit, "Tough", 1);
    const woundText = tough > 1 ? `${unit.wounds || 0}/${tough} wounds` : "1 wound removes 1 model";
    const morale = moraleState(unit);
    const shownRules = importantRules(unit).slice(0, 6);
    const hiddenRuleCount = Math.max(0, rules.length - shownRules.length);

    app.innerHTML = `
      <section class="play-card focus-card">
        <div class="focus-hero">
          <div class="unit-art focus-art" style="${unitArtStyle(unit)}"><span>${escapeHtml(unitArtLabel(unit))}</span></div>
          <div class="focus-copy">
            <div class="focus-topline">
              <span class="kicker">${sideLabel(unit.side)} - ${dead ? "Destroyed" : unit.activated ? "Done" : unit.status}</span>
              <div class="focus-buttons">
                <button type="button" data-command="home">All</button>
                <button type="button" data-command="choose-art">Image</button>
                ${unit.artData ? `<button type="button" data-command="clear-art">Auto</button>` : ""}
              </div>
            </div>
            <h2>${escapeHtml(unit.name)}</h2>
            <p class="muted">${unit.currentModels}/${unit.startModels} models - Q${unit.quality}+ D${unit.defense}+ - ${escapeHtml(woundText)}</p>
            <div class="pill-row">
              <span class="pill ${unit.side}">${sideLabel(unit.side)}</span>
              <span class="pill ${unit.activated ? "done" : ""}">${unit.activated ? "Done" : "Ready"}</span>
              <span class="pill ${morale.half ? "bad" : ""}">${morale.half ? "Half" : "Above Half"}</span>
              ${dead ? `<span class="pill bad">Dead</span>` : ""}
            </div>
            <div class="mini-stats">
              <span><b>${actionLabel(state.action)}</b><small>Action</small></span>
              <span><b>${state.tired ? "Tired" : "Fresh"}</b><small>Move state</small></span>
              <span><b>${morale.failLabel}</b><small>Failed morale</small></span>
            </div>
          </div>
        </div>

        ${state.importOpen ? renderImportBox() : ""}

        <div class="action-strip" aria-label="Unit actions">
          ${ACTIONS.map(([key, label]) => `<button type="button" class="${key === state.action ? "is-active" : ""}" data-action="${key}">${escapeHtml(label)}</button>`).join("")}
        </div>

        <div class="compact-actions">
          <button type="button" data-command="done">${unit.activated ? "Ready" : "Done"}</button>
          <button type="button" class="${state.tired ? "is-active" : ""}" data-command="tired">${state.tired ? "Tired" : "Fresh"}</button>
          <button type="button" data-command="minus-model">- Model</button>
          <button type="button" data-command="status">Status</button>
        </div>

        <div class="chips key-rules">
          ${shownRules.length ? shownRules.map((rule) => `<span class="chip">${escapeHtml(rule)}</span>`).join("") : `<span class="chip">No rules</span>`}
          ${hiddenRuleCount ? `<span class="chip">+${hiddenRuleCount} more</span>` : ""}
        </div>

        ${renderTargetBlock(targetChoices, target)}
        ${renderWeaponBlock(unit, weapons, weapon)}
        ${state.action === "defend" ? renderDefenseBlock(unit) : state.action === "morale" ? renderMoraleBlock(unit) : renderAttackBlock(unit, weapon, target)}
        ${renderSteps(unit, weapon, target)}
        ${renderLog()}
      </section>
      <section class="rail-card">${renderRail(unit.id)}</section>
    `;

    saveState();
  }

  function renderUnitDeck() {
    const units = sortedUnits();
    const readyCount = units.filter((unit) => unit.currentModels > 0 && !unit.activated).length;
    return `
      <section class="play-card">
        <div class="unit-head">
          <div>
            <span class="kicker">Choose a unit</span>
            <h2>Unit Deck</h2>
            <p class="muted">${units.length} units loaded - ${readyCount} ready. Tap a card when you are about to use that unit.</p>
          </div>
          <div class="pill-row">
            <button type="button" data-command="toggle-import">Import</button>
          </div>
        </div>
        ${state.importOpen ? renderImportBox() : ""}
        <div class="deck-grid">
          ${units.map(renderDeckCard).join("")}
        </div>
      </section>
    `;
  }

  function renderDeckCard(unit) {
    const dead = unit.currentModels <= 0;
    const morale = moraleState(unit);
    return `
      <button type="button" class="deck-card art-card ${unit.activated ? "done" : ""} ${dead ? "dead" : ""}" data-unit="${unit.id}" aria-label="${escapeHtml(unit.name)}">
        <div class="deck-art" style="${unitArtStyle(unit)}"><span>${escapeHtml(unitArtLabel(unit))}</span></div>
        <div class="deck-overlay">
          <div>
            <span class="kicker">${sideLabel(unit.side)} - ${dead ? "Destroyed" : unit.activated ? "Done" : unit.status}</span>
            <strong>${escapeHtml(unit.name)}</strong>
          </div>
          <div class="deck-bottom">
            <span>${unit.currentModels}/${unit.startModels}</span>
            <span>Q${unit.quality}+ D${unit.defense}+</span>
            <span>${morale.half ? "Half" : "Above Half"}</span>
          </div>
        </div>
      </button>
    `;
  }

  function renderImportBox() {
    return `
      <div class="import-box">
        <div class="segmented">
          <button type="button" class="${state.importSide === "mine" ? "is-active" : ""}" data-import-side="mine">My Army</button>
          <button type="button" class="${state.importSide === "opponent" ? "is-active" : ""}" data-import-side="opponent">Opponent</button>
        </div>
        <label>
          <span>Paste list text</span>
          <textarea id="importText" spellcheck="false" placeholder="Paste copied Army Forge text here"></textarea>
        </label>
        <label>
          <span>Or choose a .txt / .json file</span>
          <input id="fileImport" type="file" accept=".txt,.json,text/plain,application/json">
        </label>
        <div class="button-row">
          <button type="button" class="primary" data-command="import-text">Import</button>
          <button type="button" data-command="load-examples">Load Examples</button>
          ${state.units.length ? `<button type="button" data-command="toggle-import">Close</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderTargetBlock(targetChoices, target) {
    if (!["shoot", "charge", "melee"].includes(state.action)) return "";
    if (!targetChoices.length) return "";
    return `
      <section class="block">
        <div class="block-head">
          <h3>Target</h3>
          <span class="kicker">${target ? "Selected" : "Pick one"}</span>
        </div>
        <div class="targets">
          ${targetChoices.map((choice) => `
            <button type="button" class="target ${choice.id === target?.id ? "is-active" : ""}" data-target="${choice.id}">
              <strong>${escapeHtml(choice.name)}</strong>
              <small>${escapeHtml(targetMeta(choice))}</small>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderWeaponBlock(unit, weapons, weapon) {
    if (!["shoot", "charge", "melee"].includes(state.action)) return "";
    const kind = state.action === "shoot" ? "Ranged weapons" : "Melee weapons";
    return `
      <section class="block">
        <div class="block-head">
          <h3>${kind}</h3>
          <span class="kicker">${weapons.length ? `${weapons.length} legal` : "None"}</span>
        </div>
        <div class="weapons">
          ${weapons.length ? weapons.map((item) => `
            <button type="button" class="weapon ${item.id === weapon?.id ? "is-active" : ""}" data-weapon="${item.id}">
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(weaponSummary(unit, item, state.action))}</small>
            </button>
          `).join("") : `<div class="empty">No ${state.action === "shoot" ? "ranged" : "melee"} weapon found for this action.</div>`}
        </div>
      </section>
    `;
  }

  function renderAttackBlock(unit, weapon, target) {
    if (!["shoot", "charge", "melee"].includes(state.action)) return "";
    if (!weapon) return `<div class="callout warn">Pick an action with a legal weapon to see attack numbers.</div>`;

    const dice = attackDice(weapon);
    const hit = hitNeeded(unit, weapon, state.action);
    const baseAp = Math.max(0, numberValue(weapon.ap, 0));
    const rending = weaponHas(weapon, "Rending");
    const bane = weaponHas(weapon, "Bane");
    const rendingHits = rending ? Math.min(numberValue(state.rendingHits), numberValue(state.hits)) : 0;
    const normalHits = Math.max(0, numberValue(state.hits) - rendingHits);
    const tell = buildAttackTell(target, weapon, normalHits, rendingHits, bane);
    const saveBoxTitle = target ? "Target Save" : "Base AP";
    const saveBoxValue = target ? saveNeededText(target.defense, baseAp) : baseAp;
    const saveBoxDetail = target ? saveNeededDetail(target.defense, baseAp) : (rending ? "Rending 6s are AP 4" : "Normal hits");

    return `
      <section class="block">
        <div class="math-grid">
          <div class="math-box"><span>Attack Dice</span><strong>${dice}</strong><small>${escapeHtml(weapon.name)}</small></div>
          <div class="math-box"><span>Hit Roll</span><strong>${hit}+</strong><small>${hitFaces(hit)}</small></div>
          <div class="math-box"><span>${saveBoxTitle}</span><strong>${saveBoxValue}</strong><small>${escapeHtml(saveBoxDetail)}</small></div>
        </div>

        <div class="field-grid ${rending ? "" : "two"}">
          <label><span>Hit mod</span><input type="number" inputmode="numeric" data-field="hitMod" value="${state.hitMod}"></label>
          <label><span>Hits scored</span><input type="number" inputmode="numeric" min="0" data-field="hits" value="${state.hits}"></label>
          ${rending ? `<label><span>Natural 6 hits</span><input type="number" inputmode="numeric" min="0" data-field="rendingHits" value="${state.rendingHits}"></label>` : ""}
        </div>

        <div class="bump-row">
          <button type="button" data-bump="hits" data-by="1">Hit +</button>
          <button type="button" data-bump="hits" data-by="-1">Hit -</button>
          ${rending ? `<button type="button" data-bump="rendingHits" data-by="1">6 +</button><button type="button" data-bump="rendingHits" data-by="-1">6 -</button>` : ""}
        </div>

        <div class="callout">${tell}</div>
      </section>
    `;
  }

  function renderDefenseBlock(unit) {
    const ap = Math.max(0, numberValue(state.defenseAp));
    const failed = Math.max(0, numberValue(state.failedSaves));
    const woundsPerFail = Math.max(1, numberValue(state.woundsPerFail, 1));
    const rawWounds = failed * woundsPerFail;
    const regen = ruleRating(unit, "Regeneration", 5);
    const regenUsed = regen && !state.ignoreRegen ? Math.min(numberValue(state.regenPasses), rawWounds) : 0;
    const damage = Math.max(0, rawWounds - regenUsed);

    return `
      <section class="block">
        <div class="math-grid">
          <div class="math-box"><span>Incoming Hits</span><strong>${state.incomingHits}</strong><small>After opponent rolls</small></div>
          <div class="math-box"><span>Defense Roll</span><strong>${saveNeededText(unit.defense, ap)}</strong><small>${saveNeededDetail(unit.defense, ap)}</small></div>
          <div class="math-box"><span>Damage</span><strong>${damage}</strong><small>After saves${regen && !state.ignoreRegen ? " and regen" : ""}</small></div>
        </div>

        <div class="field-grid">
          <label><span>Incoming hits</span><input type="number" inputmode="numeric" min="0" data-field="incomingHits" value="${state.incomingHits}"></label>
          <label><span>AP</span><input type="number" inputmode="numeric" min="0" data-field="defenseAp" value="${state.defenseAp}"></label>
          <label><span>Failed saves</span><input type="number" inputmode="numeric" min="0" data-field="failedSaves" value="${state.failedSaves}"></label>
          <label><span>Wounds/fail</span><input type="number" inputmode="numeric" min="1" data-field="woundsPerFail" value="${state.woundsPerFail}"></label>
          ${regen ? `<label><span>Regen passes</span><input type="number" inputmode="numeric" min="0" data-field="regenPasses" value="${state.regenPasses}" ${state.ignoreRegen ? "disabled" : ""}></label>` : ""}
          ${regen ? `<label><span>Ignore regen</span><input type="checkbox" data-field="ignoreRegen" ${state.ignoreRegen ? "checked" : ""}></label>` : ""}
        </div>

        <div class="bump-row">
          <button type="button" data-bump="failedSaves" data-by="1">Fail +</button>
          <button type="button" data-bump="failedSaves" data-by="-1">Fail -</button>
          ${regen ? `<button type="button" data-bump="regenPasses" data-by="1">Regen +</button><button type="button" data-bump="regenPasses" data-by="-1">Regen -</button>` : ""}
        </div>

        <div class="callout">${escapeHtml(defenseTell(unit, damage, rawWounds, regen, regenUsed))}</div>
        <button type="button" class="danger" data-command="apply-damage">Apply Damage</button>
      </section>
    `;
  }

  function renderMoraleBlock(unit) {
    const morale = moraleState(unit);
    const fearless = hasRule(unit, "Fearless");
    return `
      <section class="block">
        <div class="math-grid">
          <div class="math-box"><span>Morale Roll</span><strong>Q${unit.quality}+</strong><small>${hitFaces(unit.quality)}</small></div>
          <div class="math-box"><span>Strength</span><strong>${morale.half ? "Half" : "Above"}</strong><small>${unit.currentModels}/${unit.startModels} models</small></div>
          <div class="math-box"><span>If Failed</span><strong>${morale.failLabel}</strong><small>${morale.failShort}</small></div>
        </div>
        <div class="callout ${morale.half ? "warn" : ""}">
          ${escapeHtml(morale.failLong)}
          ${fearless ? `<br>${escapeHtml("Fearless: if this morale test fails, roll one die. On 4+ it counts as passed instead.")}` : ""}
        </div>
      </section>
    `;
  }

  function renderSteps(unit, weapon, target) {
    const steps = buildSteps(unit, weapon, target);
    const visible = steps.slice(0, 4);
    const hidden = steps.slice(4);
    return `
      <section class="block">
        <div class="block-head">
          <h3>Checklist</h3>
          <span class="kicker">${steps.length} steps</span>
        </div>
        <div class="steps">
          ${visible.map((step, index) => `
            <div class="step">
              <b>${index + 1}</b>
              <div>
                <b>${escapeHtml(step.title)}</b>
                <p>${escapeHtml(step.body)}</p>
                ${step.detail ? `<small>${escapeHtml(step.detail)}</small>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
        ${hidden.length ? `
          <details class="more-steps">
            <summary>More reminders (${hidden.length})</summary>
            <div class="steps">
              ${hidden.map((step, index) => `
                <div class="step">
                  <b>${visible.length + index + 1}</b>
                  <div>
                    <b>${escapeHtml(step.title)}</b>
                    <p>${escapeHtml(step.body)}</p>
                    ${step.detail ? `<small>${escapeHtml(step.detail)}</small>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          </details>
        ` : ""}
      </section>
    `;
  }

  function renderRail(activeId = "") {
    const units = sortedUnits().filter((unit) => unit.id !== activeId);
    return `
      <div class="rail">
        <button type="button" class="unit-thumb home-thumb" data-command="home">
          <strong>All Units</strong>
          <span>Back to deck</span>
        </button>
        ${units.map((unit) => {
          const dead = unit.currentModels <= 0;
          return `
            <button type="button" class="unit-thumb ${unit.activated ? "done" : ""} ${dead ? "dead" : ""}" style="${unitArtStyle(unit)}" data-unit="${unit.id}">
              <strong>${escapeHtml(unit.name)}</strong>
              <span>${unit.currentModels}/${unit.startModels} - ${unit.side === "mine" ? "Mine" : "Them"}${unit.activated ? " - done" : ""}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderLog() {
    if (!state.log.length) return "";
    return `
      <section class="log">
        ${state.log.slice(0, 3).map((item) => `<div><b>${escapeHtml(item.title)}:</b> ${escapeHtml(item.body)}</div>`).join("")}
      </section>
    `;
  }

  function buildSteps(unit, weapon, target) {
    const steps = [];
    const action = state.action;
    const impact = ruleRating(unit, "Impact", 0);
    const fast = hasRule(unit, "Fast");
    const flying = hasRule(unit, "Flying");
    const strider = hasRule(unit, "Strider");

    if (action === "deploy") {
      if (hasRule(unit, "Scout")) {
        steps.push(step("Scout placement", "Scout is available during placement. Move up to 24\" if that is the Scout distance you are using.", "Do this before normal activations."));
      } else {
        steps.push(step("Deployment", "No Scout rule found on this unit.", "Use normal deployment unless another rule applies."));
      }
      if (hasRule(unit, "Ambush")) {
        steps.push(step("Ambush", "This unit has Ambush. Keep it off-board and bring it in at the Ambush timing.", "Use the exact Army Forge distance text when placing it."));
      }
    }

    if (action === "shoot") {
      steps.push(step("Move + Shoot", "Move up to half movement, then use ranged weapons only.", "This action does not include melee attacks."));
      if (fast) steps.push(step("Fast", "Fast changes movement distance.", "Reminder: +2\" on Advance and +4\" on Rush/Charge."));
      if (flying || strider) steps.push(step("Terrain", `${[flying ? "Flying" : "", strider ? "Strider" : ""].filter(Boolean).join(" and ")} may change terrain handling.`, ""));
    }

    if (action === "charge") {
      steps.push(step("Charge", "Move into melee, then resolve charge-only effects before normal melee weapon attacks.", "Ranged weapons are not part of this action."));
      if (fast) steps.push(step("Fast", "Fast may extend the charge distance.", "Reminder: +4\" when using Rush/Charge."));
      if (impact) steps.push(step(`Impact(${impact})`, `Roll ${impact} dice before weapon attacks. Hits are ${state.tired ? "6+" : "2+"}.`, state.tired ? "Tired/fatigued changes Impact from 2+ to 6+." : "If tired/fatigued, use 6+ instead."));
      if (hasRule(unit, "Furious")) steps.push(step("Furious", "On a charge, unmodified 6s to hit in melee deal 1 extra hit.", "Only original 6s count."));
    }

    if (action === "melee") {
      steps.push(step("Melee", "Use melee weapons only.", "Do not also shoot with ranged weapons in this action."));
      if (impact) steps.push(step(`Impact(${impact})`, "Impact normally happens after charging.", "If this unit did not charge, skip Impact."));
    }

    if (action === "defend") {
      const regen = ruleRating(unit, "Regeneration", 5);
      const tough = ruleRating(unit, "Tough", 1);
      steps.push(step("Defense", `Roll saves on ${saveNeededText(unit.defense, Math.max(0, numberValue(state.defenseAp)))}.`, "Enter failed saves, then apply damage."));
      if (regen) steps.push(step("Regeneration", `After failed saves, roll one die per wound. Each ${regen}+ ignores 1 wound.`, "Turn on Ignore regen for Rending or Bane hits."));
      if (tough > 1) steps.push(step(`Tough(${tough})`, `Track wounds until the model has ${tough}, then remove one model.`, "Wounds continue onto the next Tough model."));
    }

    if (action === "morale") {
      const morale = moraleState(unit);
      steps.push(step("Morale test", `Roll one die. Pass on Q${unit.quality}+.`, "Use this when the game calls for a morale test."));
      steps.push(step(morale.half ? "Half strength" : "Above half", morale.failLong, morale.half ? "This is the important run/remove check." : "If the unit later drops to half or below, failed morale removes it."));
      if (hasRule(unit, "Fearless")) steps.push(step("Fearless", "If this morale test fails, roll one die. On 4+ it counts as passed instead.", "This reminder is included before applying the failed morale result."));
    }

    if (weapon && ["shoot", "charge", "melee"].includes(action)) {
      steps.push(step(weapon.name, `Roll ${attackDice(weapon)} dice. Hits are ${hitNeeded(unit, weapon, action)}+.`, `${weapon.range ? `Range ${weapon.range}. ` : ""}Base AP(${weapon.ap || 0}).`));
      if (weaponHas(weapon, "Reliable")) steps.push(step("Reliable", "This attack hits on 2+.", "The hit number already includes this."));
      if (weaponHas(weapon, "Precise")) steps.push(step("Precise", "This attack gets +1 to hit.", "The hit number already includes this."));
      if (hasRule(unit, "Good Shot") && action === "shoot") steps.push(step("Good Shot", "This unit gets +1 to hit when shooting.", "The hit number already includes this."));
      if (weaponHas(weapon, "Rending")) steps.push(step("Rending", "Keep natural 6s to hit separate. Those hits are AP(4) and ignore Regeneration.", "Other hits use the weapon's normal AP."));
      if (weaponHas(weapon, "Bane")) steps.push(step("Bane", "This attack ignores Regeneration, and the target rerolls unmodified defense rolls of 6.", "Tell your opponent before saves."));
      if (weaponHas(weapon, "Blast")) {
        const blast = weaponRating(weapon, "Blast", 1);
        steps.push(step(`Blast(${blast})`, "After other special rules, each hit is multiplied by Blast.", target ? `Can multiply up to the target's ${target.currentModels} current models.` : "Pick a target for the model cap."));
      }
      if (weapon.deadly > 1 || weaponHas(weapon, "Deadly")) steps.push(step(`Deadly(${weapon.deadly})`, `Each failed save causes ${weapon.deadly} wounds.`, "Apply Tough after multiplying wounds."));
      if (weaponHas(weapon, "Shred")) steps.push(step("Shred", "Watch for the target's unmodified defense rolls of 1.", "This can add extra wounds depending on the rule text."));
      if (weaponHas(weapon, "Takedown")) steps.push(step("Takedown", "This weapon may pick an individual model as its target.", "Resolve before other weapons if needed."));
      if (weaponHas(weapon, "Thrust")) steps.push(step("Thrust", "This weapon has a charge-sensitive rule.", "Keep this visible during a Charge action."));
      if (weaponHas(weapon, "Tear")) steps.push(step("Tear", "This weapon has Tear. Resolve its defense or damage effect with the attack.", "Use the Army Forge wording for the exact effect."));
    }

    if (["shoot", "charge", "melee"].includes(action) && hasRule(unit, "Bestial")) {
      steps.push(step("Bestial", "Opponent rerolls unmodified defense rolls of 6 against this unit's weapons.", "Tell them before they roll saves."));
    }

    return steps.length ? steps : [step("Ready", "Pick an action to see the relevant rules.", "")];
  }

  function buildAttackTell(target, weapon, normalHits, rendingHits, bane) {
    const ap = Math.max(0, numberValue(weapon.ap, 0));
    const lines = [];
    if (!target) {
      lines.push(`Report ${normalHits + rendingHits} hit${normalHits + rendingHits === 1 ? "" : "s"}.`);
      if (rendingHits) lines.push(`${rendingHits} Rending hit${rendingHits === 1 ? "" : "s"} are AP(4) and ignore Regeneration.`);
      if (bane) lines.push("Bane hits ignore Regeneration and make the target reroll defense 6s.");
      return lines.map(escapeHtml).join("<br>");
    }

    if (normalHits) {
      lines.push(`Tell opponent: ${normalHits} normal save${normalHits === 1 ? "" : "s"} on ${saveNeededText(target.defense, ap)} (${saveNeededDetail(target.defense, ap)}).`);
    }
    if (rendingHits) {
      lines.push(`Tell opponent: ${rendingHits} Rending save${rendingHits === 1 ? "" : "s"} on ${saveNeededText(target.defense, 4)} (${saveNeededDetail(target.defense, 4)}), no Regeneration.`);
    }
    if (!normalHits && !rendingHits) {
      lines.push(`${target.name}: after you roll hits, tell them saves are ${saveNeededText(target.defense, ap)} (${saveNeededDetail(target.defense, ap)}).`);
    }
    const regen = ruleRating(target, "Regeneration", 5);
    if (regen && !rendingHits && !bane) lines.push(`${target.name} has Regeneration ${regen}+.`);
    if (bane) lines.push("Bane ignores Regeneration and makes the target reroll defense 6s.");
    if (hasRule({ rules: weapon.special }, "Bestial")) lines.push("Bestial note: target rerolls defense 6s.");
    return lines.map(escapeHtml).join("<br>");
  }

  function defenseTell(unit, damage, rawWounds, regen, regenUsed) {
    if (!rawWounds) return "Enter failed saves to see damage.";
    const regenText = regen && !state.ignoreRegen ? ` Regeneration ignored ${regenUsed}.` : state.ignoreRegen ? " Regeneration ignored by the attack." : "";
    return `${unit.name}: ${rawWounds} wound${rawWounds === 1 ? "" : "s"} before prevention.${regenText} Apply ${damage} damage.`;
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]");
    if (action) {
      state.action = action.dataset.action;
      state.hits = 0;
      state.rendingHits = 0;
      ensureLegalWeapon();
      render();
      return;
    }

    const unitButton = event.target.closest("[data-unit]");
    if (unitButton) {
      state.activeId = unitButton.dataset.unit;
      state.contextOpen = true;
      state.hits = 0;
      state.rendingHits = 0;
      ensureLegalWeapon();
      render();
      return;
    }

    const targetButton = event.target.closest("[data-target]");
    if (targetButton) {
      state.targetId = targetButton.dataset.target;
      render();
      return;
    }

    const weaponButton = event.target.closest("[data-weapon]");
    if (weaponButton) {
      state.weaponId = weaponButton.dataset.weapon;
      state.hits = 0;
      state.rendingHits = 0;
      render();
      return;
    }

    const sideButton = event.target.closest("[data-import-side]");
    if (sideButton) {
      state.importSide = normalizeSide(sideButton.dataset.importSide);
      render();
      return;
    }

    const bump = event.target.closest("[data-bump]");
    if (bump) {
      const key = bump.dataset.bump;
      const by = numberValue(bump.dataset.by, 0);
      state[key] = Math.max(0, numberValue(state[key], 0) + by);
      if (key === "rendingHits") state.rendingHits = Math.min(numberValue(state.rendingHits), numberValue(state.hits));
      render();
      return;
    }

    const command = event.target.closest("[data-command]");
    if (command) runCommand(command.dataset.command);
  }

  function handleInput(event) {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    const key = input.dataset.field;
    if (input.type === "checkbox") {
      state[key] = input.checked;
      render();
      return;
    } else {
      state[key] = input.value === "" ? 0 : Number(input.value);
    }
    if (key === "hits") state.rendingHits = Math.min(numberValue(state.rendingHits), numberValue(state.hits));
    saveState();
  }

  async function handleChange(event) {
    const input = event.target.closest("[data-field]");
    if (input) {
      render();
      return;
    }
    if (event.target.id === "unitArtInput") {
      const file = event.target.files?.[0];
      const unit = getActiveUnit();
      if (file && unit) {
        try {
          unit.artData = await readImageFileAsDataUrl(file);
          addLog("Image saved", `${unit.name} now uses your image.`);
        } catch {
          addLog("Image skipped", "That image could not be loaded.");
        }
        render();
      }
      event.target.value = "";
      return;
    }
    if (event.target.id !== "fileImport") return;
    const file = event.target.files?.[0];
    if (!file) return;
    importText(await file.text(), state.importSide);
    event.target.value = "";
  }

  function runCommand(command) {
    const unit = getActiveUnit();
    if (command === "toggle-import") {
      state.importOpen = !state.importOpen;
      render();
      return;
    }
    if (command === "home") {
      state.contextOpen = false;
      state.targetId = "";
      state.weaponId = "";
      state.hits = 0;
      state.rendingHits = 0;
      render();
      return;
    }
    if (command === "choose-art") {
      document.getElementById("unitArtInput")?.click();
      return;
    }
    if (command === "reset") {
      if (!confirm("Clear the app and imported units?")) return;
      localStorage.removeItem(STORE);
      Object.assign(state, freshState());
      render();
      return;
    }
    if (command === "import-text") {
      const textarea = document.getElementById("importText");
      importText(textarea?.value || "", state.importSide);
      return;
    }
    if (command === "load-examples") {
      importText(sampleMineText, "mine", false);
      importText(sampleOpponentText, "opponent", false);
      state.importOpen = false;
      addLog("Loaded examples", "Sample armies imported.");
      render();
      return;
    }
    if (!unit) return;

    if (command === "done") {
      unit.activated = !unit.activated;
      addLog(unit.activated ? "Done" : "Ready", unit.name);
      if (unit.activated) moveToNextReady(unit.id);
      render();
      return;
    }
    if (command === "tired") {
      state.tired = !state.tired;
      render();
      return;
    }
    if (command === "minus-model") {
      unit.currentModels = Math.max(0, unit.currentModels - 1);
      unit.wounds = 0;
      if (unit.currentModels <= 0) {
        unit.status = "destroyed";
        moveToNextReady(unit.id);
      }
      addLog("Model removed", `${unit.name}: ${unit.currentModels}/${unit.startModels} left.`);
      render();
      return;
    }
    if (command === "status") {
      const order = ["ready", "shaken", "stunned", "ready"];
      unit.status = order[order.indexOf(unit.status) + 1] || "ready";
      addLog("Status", `${unit.name}: ${unit.status}.`);
      render();
      return;
    }
    if (command === "clear-art") {
      unit.artData = "";
      addLog("Auto image", `${unit.name} is using generated art again.`);
      render();
      return;
    }
    if (command === "apply-damage") {
      applyDamage(unit);
      render();
    }
  }

  function importText(text, side = state.importSide, shouldRender = true) {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      addLog("Import skipped", "No text found.");
      render();
      return;
    }

    let units = [];
    try {
      units = parseJsonUnits(JSON.parse(trimmed), side);
    } catch {
      units = parseListText(trimmed, side);
    }

    if (!units.length) {
      addLog("Import failed", "No units were found in that file/text.");
      if (shouldRender) render();
      return;
    }

    state.units.push(...units.map(normalizeUnit));
    state.importOpen = false;
    addLog("Imported", `${units.length} unit${units.length === 1 ? "" : "s"} to ${sideLabel(side)}.`);
    if (shouldRender) render();
  }

  function parseListText(text, side) {
    const units = [];
    let latest = [];
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      if (/^\+\+/.test(line)) continue;
      const match = line.match(/^(?:(\d+)x\s+)?(.+?)\s+\[(\d+)\]\s+Q(\d)\+\s+D(\d)\+.*?\|\s*(.*)$/i);
      if (match) {
        const copies = Math.max(1, numberValue(match[1], 1));
        const baseName = cleanName(match[2]);
        const startModels = Math.max(1, numberValue(match[3], 1));
        const rules = String(match[6] || "").replace(/^\d+pts\s*\|\s*/i, "").trim();
        latest = [];
        for (let index = 0; index < copies; index += 1) {
          const unit = {
            id: makeId(),
            side,
            name: copies > 1 ? `${baseName} ${index + 1}` : baseName,
            startModels,
            currentModels: startModels,
            quality: clampRoll(match[4]),
            defense: clampRoll(match[5]),
            rules,
            weapons: [],
            wounds: 0,
            status: "ready",
            activated: false
          };
          units.push(unit);
          latest.push(unit);
        }
        continue;
      }

      const weapons = parseWeaponList(line);
      if (weapons.length && latest.length) {
        latest.forEach((unit) => {
          unit.weapons.push(...weapons.map((weapon) => ({ ...weapon, id: makeId() })));
        });
      }
    }

    return units.map((unit) => ({ ...unit, weapons: normalizeWeapons(unit.weapons) }));
  }

  function parseJsonUnits(data, side) {
    const rawUnits = Array.isArray(data) ? data : data?.list?.units || data?.units || data?.roster?.units || [];
    if (!Array.isArray(rawUnits)) return [];
    return rawUnits.map((raw, index) => ({
      id: raw.selectionId || raw.uid || raw.id || makeId(),
      side: normalizeSide(raw.side || side),
      name: cleanName(raw.customName || raw.name || raw.unitName || raw.label) || `Army Forge Unit ${index + 1}`,
      startModels: raw.size ?? raw.models ?? raw.modelCount ?? raw.count ?? 1,
      currentModels: raw.currentModels ?? raw.modelsLeft ?? raw.size ?? raw.models ?? 1,
      quality: raw.quality ?? raw.q ?? raw.Quality ?? 4,
      defense: raw.defense ?? raw.d ?? raw.Defense ?? 4,
      rules: rulesToString(raw.rules || raw.traits || raw.specialRules),
      weapons: normalizeWeapons(raw.weapons || raw.loadout),
      wounds: 0,
      status: "ready",
      activated: false
    }));
  }

  function applyDamage(unit) {
    const failed = Math.max(0, numberValue(state.failedSaves));
    const woundsPerFail = Math.max(1, numberValue(state.woundsPerFail, 1));
    const rawWounds = failed * woundsPerFail;
    const regen = ruleRating(unit, "Regeneration", 5);
    const regenUsed = regen && !state.ignoreRegen ? Math.min(numberValue(state.regenPasses), rawWounds) : 0;
    const damage = Math.max(0, rawWounds - regenUsed);
    if (!damage) {
      addLog("No damage", `${unit.name}: all wounds prevented or no failed saves.`);
      return;
    }

    const before = `${unit.currentModels}/${unit.startModels}`;
    const tough = ruleRating(unit, "Tough", 1);
    if (tough > 1) {
      unit.wounds = (unit.wounds || 0) + damage;
      while (unit.wounds >= tough && unit.currentModels > 0) {
        unit.currentModels -= 1;
        unit.wounds -= tough;
      }
    } else {
      unit.currentModels = Math.max(0, unit.currentModels - damage);
      unit.wounds = 0;
    }
    if (unit.currentModels <= 0) {
      unit.status = "destroyed";
      unit.wounds = 0;
      moveToNextReady(unit.id);
    }
    addLog("Damage applied", `${unit.name}: ${damage} damage, models ${before} -> ${unit.currentModels}/${unit.startModels}.`);
    state.incomingHits = 0;
    state.failedSaves = 0;
    state.regenPasses = 0;
  }

  function ensureActiveUnit() {
    if (state.units.some((unit) => unit.id === state.activeId)) return;
    const fallback = sortedUnits().find((unit) => unit.currentModels > 0 && unit.side === "mine") || sortedUnits().find((unit) => unit.currentModels > 0) || sortedUnits()[0];
    state.activeId = fallback?.id || "";
  }

  function ensureLegalWeapon() {
    const unit = getActiveUnit();
    if (!unit) return;
    const legal = getLegalWeapons(unit, state.action);
    if (!legal.some((weapon) => weapon.id === state.weaponId)) state.weaponId = legal[0]?.id || "";
  }

  function getActiveUnit() {
    return state.units.find((unit) => unit.id === state.activeId) || null;
  }

  function moveToNextReady(previousId) {
    const unit = state.units.find((item) => item.id === previousId);
    const sameSide = unit?.side || "mine";
    const next = sortedUnits().find((item) => item.id !== previousId && item.side === sameSide && item.currentModels > 0 && !item.activated)
      || sortedUnits().find((item) => item.id !== previousId && item.currentModels > 0 && !item.activated)
      || sortedUnits().find((item) => item.id !== previousId && item.currentModels > 0);
    if (next) state.activeId = next.id;
  }

  function sortedUnits() {
    return [...state.units].sort((a, b) => {
      const group = unitSortGroup(a) - unitSortGroup(b);
      if (group) return group;
      const side = (a.side === "mine" ? 0 : 1) - (b.side === "mine" ? 0 : 1);
      if (side) return side;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  function unitSortGroup(unit) {
    if (unit.currentModels <= 0) return 4;
    if (unit.activated) return 3;
    if (unit.status === "stunned" || unit.status === "shaken") return 1;
    return 0;
  }

  function getTargetChoices(unit) {
    if (!unit) return [];
    return state.units.filter((item) => item.id !== unit.id && item.currentModels > 0 && item.side !== unit.side);
  }

  function getLegalWeapons(unit, action) {
    const weapons = normalizeWeapons(unit.weapons);
    if (action === "shoot") return weapons.filter((weapon) => Boolean(weapon.range));
    if (action === "charge" || action === "melee") return weapons.filter((weapon) => !weapon.range);
    return [];
  }

  function normalizedRules(unit) {
    return splitTopLevelComma(unit?.rules || "")
      .map((rule) => rule.replace(/^\d+x\s+/i, "").trim())
      .filter(Boolean);
  }

  function hasRule(unit, name) {
    const lower = name.toLowerCase();
    return normalizedRules(unit).some((rule) => {
      const clean = rule.toLowerCase();
      return clean === lower || clean.startsWith(`${lower}(`);
    });
  }

  function ruleRating(unit, name, fallback) {
    const lower = name.toLowerCase();
    for (const rule of normalizedRules(unit)) {
      const clean = rule.toLowerCase();
      if (clean === lower) return fallback;
      const match = clean.match(new RegExp(`^${escapeRegExp(lower)}\\(([+-]?\\d+)\\)$`));
      if (match) return numberValue(match[1], fallback);
    }
    return 0;
  }

  function weaponHas(weapon, name) {
    return hasRule({ rules: weapon?.special || "" }, name);
  }

  function weaponRating(weapon, name, fallback) {
    return ruleRating({ rules: weapon?.special || "" }, name, fallback);
  }

  function hitNeeded(unit, weapon, action) {
    let needed = clampRoll(unit.quality + numberValue(state.hitMod));
    if (weaponHas(weapon, "Reliable")) needed = 2;
    if (weaponHas(weapon, "Precise")) needed -= 1;
    if (hasRule(unit, "Good Shot") && action === "shoot") needed -= 1;
    return clampRoll(needed);
  }

  function attackDice(weapon) {
    return Math.max(0, numberValue(weapon?.count, 1) * numberValue(weapon?.attacks, 1));
  }

  function weaponSummary(unit, weapon, action) {
    return `${attackDice(weapon)} dice, Q${hitNeeded(unit, weapon, action)}+, AP ${weapon.ap || 0}${weapon.range ? `, ${weapon.range}` : ""}${weapon.special ? `, ${weapon.special}` : ""}`;
  }

  function targetMeta(unit) {
    const parts = [
      unit.side === "mine" ? "Mine" : "Them",
      `D${unit.defense}+`,
      `${unit.currentModels}/${unit.startModels} models`
    ];
    const tough = ruleRating(unit, "Tough", 1);
    const regen = ruleRating(unit, "Regeneration", 5);
    if (tough > 1) parts.push(`Tough ${tough}`);
    if (regen) parts.push(`Regen ${regen}+`);
    return parts.join(" - ");
  }

  function unitArtStyle(unit) {
    const image = unit.artData || generatedUnitArtUrl(unit);
    return escapeHtml(`--unit-art: url("${image}");`);
  }

  function unitArtLabel(unit) {
    return unitArtProfile(unit).label;
  }

  function unitArtProfile(unit) {
    const weaponText = normalizeWeapons(unit.weapons).map((weapon) => `${weapon.name} ${weapon.special}`).join(" ");
    const text = `${unit.name} ${unit.rules} ${weaponText}`.toLowerCase();
    const profile = (kind, label, colors) => ({ kind, label, colors });
    if (/boar|hog|pig|tusk/.test(text)) return profile("boar", "Boar", ["#5b3a27", "#c2874c", "#e7d3a9"]);
    if (/banshee|ghost|spirit|ethereal/.test(text)) return profile("spirit", "Spirit", ["#263a5d", "#9ec7d9", "#e9fbff"]);
    if (/vampire|undead|skeleton|zombie|necrom/.test(text)) return profile("vampire", "Undead", ["#2b1724", "#8c2736", "#e9d5d5"]);
    if (/phoenix|harpy|wing|flying|bird/.test(text)) return profile("winged", "Winged", ["#672c38", "#df7e3c", "#ffe1a8"]);
    if (/dragon|lizard|raptor|saurian|gecko|chameleon|spino|dino/.test(text)) return profile("reptile", "Reptile", ["#183f35", "#5aa06a", "#d6f0b8"]);
    if (/centaur|rider|horse|hoof|cavalry|chariot/.test(text)) return profile("rider", "Rider", ["#34291f", "#a67845", "#f1d49b"]);
    if (/hound|wolf|beast|claw|fang/.test(text)) return profile("beast", "Beast", ["#283126", "#73855c", "#d5d9b1"]);
    if (/rifle|sniper|bow|shot|shooter|carbine|pistol|throw/.test(text)) return profile("shooter", "Shooter", ["#233243", "#5e8fa3", "#dce8ef"]);
    if (/hero|champion|master|boss|lord/.test(text)) return profile("hero", "Hero", ["#222638", "#5969b2", "#e4e6ff"]);
    return profile("warrior", "Warrior", ["#24313a", "#697789", "#e8edf1"]);
  }

  function generatedUnitArtUrl(unit) {
    const profile = unitArtProfile(unit);
    const [dark, mid, light] = profile.colors;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${light}"/>
            <stop offset=".52" stop-color="${mid}"/>
            <stop offset="1" stop-color="${dark}"/>
          </linearGradient>
          <radialGradient id="glow" cx=".34" cy=".28" r=".74">
            <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>
            <stop offset=".48" stop-color="#ffffff" stop-opacity=".08"/>
            <stop offset="1" stop-color="#000000" stop-opacity=".35"/>
          </radialGradient>
        </defs>
        <rect width="320" height="220" fill="url(#bg)"/>
        <rect width="320" height="220" fill="url(#glow)"/>
        <path d="M0 176 C58 150 83 170 136 146 C199 118 252 140 320 112 L320 220 L0 220 Z" fill="#101827" opacity=".28"/>
        ${unitShapeSvg(profile.kind)}
        <path d="M0 0 H320 V220 H0 Z" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function unitShapeSvg(kind) {
    const ink = "#111827";
    const shine = "#fff8e8";
    const soft = "#ffffff";
    const shapes = {
      boar: `
        <g transform="translate(34 50)" fill="${ink}">
          <ellipse cx="128" cy="92" rx="78" ry="42" opacity=".9"/>
          <path d="M187 74 C224 70 246 92 246 115 C230 104 218 105 202 113 C199 96 194 84 187 74 Z"/>
          <path d="M226 104 C249 102 260 111 270 126 C248 126 234 121 220 112 Z" fill="${shine}" opacity=".8"/>
          <path d="M79 65 C96 31 132 30 160 58 C132 49 106 53 79 65 Z"/>
          <rect x="72" y="122" width="16" height="44" rx="7"/>
          <rect x="126" y="126" width="16" height="42" rx="7"/>
          <rect x="178" y="120" width="16" height="46" rx="7"/>
          <circle cx="218" cy="91" r="5" fill="${soft}" opacity=".85"/>
        </g>
      `,
      spirit: `
        <g transform="translate(74 26)">
          <path d="M84 9 C127 10 154 46 146 90 C140 125 158 144 169 179 C136 167 126 150 106 172 C85 193 66 168 37 184 C55 140 25 122 22 83 C18 42 43 9 84 9 Z" fill="${ink}" opacity=".84"/>
          <circle cx="68" cy="73" r="8" fill="${soft}" opacity=".9"/>
          <circle cx="104" cy="73" r="8" fill="${soft}" opacity=".9"/>
          <path d="M58 119 C75 105 100 105 118 119" fill="none" stroke="${soft}" stroke-opacity=".62" stroke-width="8" stroke-linecap="round"/>
        </g>
      `,
      vampire: `
        <g transform="translate(78 24)">
          <path d="M82 52 L24 178 L84 151 L144 178 Z" fill="${ink}" opacity=".9"/>
          <circle cx="82" cy="41" r="28" fill="${ink}" opacity=".9"/>
          <path d="M55 28 C71 1 101 1 116 28 C95 18 75 18 55 28 Z" fill="${ink}"/>
          <path d="M59 84 L82 121 L106 84" fill="none" stroke="${shine}" stroke-opacity=".8" stroke-width="8" stroke-linecap="round"/>
        </g>
      `,
      winged: `
        <g transform="translate(28 35)" fill="${ink}">
          <path d="M132 76 C87 8 29 1 9 13 C39 52 51 96 116 112 Z" opacity=".82"/>
          <path d="M151 76 C196 8 254 1 274 13 C244 52 232 96 167 112 Z" opacity=".82"/>
          <ellipse cx="142" cy="100" rx="31" ry="54" opacity=".9"/>
          <path d="M121 151 L93 186 M163 151 L195 186" stroke="${ink}" stroke-width="17" stroke-linecap="round"/>
          <circle cx="142" cy="45" r="21"/>
          <path d="M127 42 L102 31 M157 42 L184 31" stroke="${shine}" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/>
        </g>
      `,
      reptile: `
        <g transform="translate(26 54)" fill="${ink}">
          <path d="M33 105 C82 44 169 27 238 72 C264 90 274 112 287 140 C248 126 211 124 165 142 C105 166 59 146 33 105 Z" opacity=".9"/>
          <path d="M31 105 C11 117 4 133 3 155 C34 136 52 128 83 128 Z"/>
          <path d="M209 63 L236 26 L241 76 Z"/>
          <path d="M116 48 L131 17 L145 49 L162 19 L175 56" fill="${shine}" opacity=".72"/>
          <rect x="101" y="124" width="17" height="43" rx="8"/>
          <rect x="187" y="121" width="17" height="47" rx="8"/>
          <circle cx="240" cy="78" r="5" fill="${soft}" opacity=".9"/>
        </g>
      `,
      rider: `
        <g transform="translate(38 41)" fill="${ink}">
          <ellipse cx="126" cy="105" rx="83" ry="32" opacity=".9"/>
          <path d="M194 91 C225 85 246 103 253 126 C226 117 211 117 192 127 Z"/>
          <rect x="61" y="126" width="14" height="49" rx="7"/>
          <rect x="126" y="129" width="14" height="46" rx="7"/>
          <rect x="186" y="126" width="14" height="49" rx="7"/>
          <path d="M112 72 L126 20 L144 72 Z"/>
          <circle cx="128" cy="19" r="18"/>
          <path d="M145 33 L199 11" stroke="${shine}" stroke-opacity=".78" stroke-width="8" stroke-linecap="round"/>
        </g>
      `,
      beast: `
        <g transform="translate(42 50)" fill="${ink}">
          <path d="M50 116 C47 61 96 29 150 52 C193 70 214 101 242 145 C194 131 161 134 119 154 C82 171 56 151 50 116 Z" opacity=".9"/>
          <path d="M145 55 C165 13 211 7 245 42 C202 39 176 49 145 55 Z"/>
          <path d="M217 58 L246 38 L239 73 Z" fill="${shine}" opacity=".8"/>
          <rect x="84" y="137" width="16" height="39" rx="7"/>
          <rect x="165" y="135" width="16" height="42" rx="7"/>
          <circle cx="207" cy="70" r="5" fill="${soft}" opacity=".9"/>
        </g>
      `,
      shooter: `
        <g transform="translate(58 33)" fill="${ink}">
          <circle cx="86" cy="36" r="24"/>
          <path d="M61 66 C81 51 103 52 124 66 L132 151 L50 151 Z" opacity=".9"/>
          <path d="M99 87 L230 63" stroke="${ink}" stroke-width="15" stroke-linecap="round"/>
          <path d="M146 78 L166 108" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>
          <path d="M41 94 L108 95" stroke="${shine}" stroke-opacity=".8" stroke-width="9" stroke-linecap="round"/>
        </g>
      `,
      hero: `
        <g transform="translate(82 25)" fill="${ink}">
          <path d="M80 62 L42 180 L118 180 Z" opacity=".9"/>
          <circle cx="80" cy="39" r="30"/>
          <path d="M41 85 L3 136 M119 85 L157 136" stroke="${ink}" stroke-width="17" stroke-linecap="round"/>
          <path d="M80 64 L80 176" stroke="${shine}" stroke-opacity=".72" stroke-width="8" stroke-linecap="round"/>
          <path d="M55 25 L80 2 L106 25 Z" fill="${shine}" opacity=".65"/>
        </g>
      `,
      warrior: `
        <g transform="translate(83 27)" fill="${ink}">
          <circle cx="76" cy="31" r="27"/>
          <path d="M38 72 C61 54 91 54 115 72 L126 181 L27 181 Z" opacity=".9"/>
          <path d="M138 19 L145 184" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
          <path d="M118 52 L172 52" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
          <path d="M7 91 Q35 73 62 91 L55 153 Q35 171 15 153 Z" fill="${shine}" opacity=".72"/>
        </g>
      `
    };
    return shapes[kind] || shapes.warrior;
  }

  function importantRules(unit) {
    const priority = ["Impact", "Regeneration", "Tough", "Bestial", "Rending", "Bane", "Fearless", "Fast", "Flying", "Scout", "Good Shot", "Reliable", "Precise"];
    const rules = normalizedRules(unit);
    return [
      ...rules.filter((rule) => priority.some((name) => rule.toLowerCase() === name.toLowerCase() || rule.toLowerCase().startsWith(`${name.toLowerCase()}(`))),
      ...rules.filter((rule) => !priority.some((name) => rule.toLowerCase() === name.toLowerCase() || rule.toLowerCase().startsWith(`${name.toLowerCase()}(`)))
    ];
  }

  function moraleState(unit) {
    const half = unit.currentModels > 0 && unit.currentModels <= unit.startModels / 2;
    return {
      half,
      failLabel: half ? "Runs" : "Shaken",
      failShort: half ? "Fail morale: removed" : "Fail morale: shaken",
      failLong: half
        ? `${unit.name} is at half strength or below. If it fails morale, it runs and is removed.`
        : `${unit.name} is above half strength. If it fails morale, apply the failed morale status instead of removing it.`
    };
  }

  function sideLabel(side) {
    return normalizeSide(side) === "mine" ? "Mine" : "Opponent";
  }

  function actionLabel(action) {
    return ACTIONS.find(([key]) => key === action)?.[1] || "Charge";
  }

  function saveNeededText(defense, ap) {
    const needed = modifiedSave(defense, ap);
    return `${needed.roll}+${needed.capped ? " max" : ""}`;
  }

  function saveNeededDetail(defense, ap) {
    const needed = modifiedSave(defense, ap);
    const base = `D${numberValue(defense, 4)}+ with AP(${Math.max(0, numberValue(ap, 0))})`;
    return needed.capped ? `${base}, capped at 6+` : base;
  }

  function modifiedSave(defense, ap) {
    const raw = Math.max(2, numberValue(defense, 4) + Math.max(0, numberValue(ap, 0)));
    return { roll: Math.min(6, raw), capped: raw > 6 };
  }

  function hitFaces(needed) {
    return `success ${needed}-6, fail 1-${needed - 1}`;
  }

  function normalizeWeapons(weapons) {
    if (!Array.isArray(weapons) || !weapons.length) return [defaultWeapon()];
    return weapons
      .flatMap((weapon) => typeof weapon === "string" ? parseWeaponList(weapon) : [parseWeaponObject(weapon)])
      .filter(Boolean)
      .map((weapon) => ({
        ...defaultWeapon(),
        ...weapon,
        id: weapon.id || makeId(),
        count: Math.max(1, numberValue(weapon.count, 1)),
        attacks: Math.max(1, numberValue(weapon.attacks, 1)),
        ap: Math.max(0, numberValue(weapon.ap, 0)),
        deadly: Math.max(1, numberValue(weapon.deadly, 1))
      }));
  }

  function defaultWeapon() {
    return { id: makeId(), name: "Basic Attack", count: 1, attacks: 1, range: "", ap: 0, deadly: 1, special: "" };
  }

  function parseWeaponObject(raw = {}) {
    const specialRules = Array.isArray(raw.specialRules)
      ? raw.specialRules.map((rule) => typeof rule === "string" ? rule : rule.label || rule.name || "").filter(Boolean)
      : [];
    const special = [raw.special, ...specialRules].filter(Boolean).join(", ");
    return {
      id: raw.id || raw.uid || makeId(),
      name: raw.name || raw.label || "Weapon",
      count: raw.count ?? 1,
      attacks: raw.attacks ?? raw.a ?? 1,
      range: formatRange(raw.range ?? raw.rangeText),
      ap: raw.ap ?? readValue(special, "AP", 0),
      deadly: raw.deadly ?? readValue(special, "Deadly", 1),
      special
    };
  }

  function parseWeaponList(line) {
    const clean = String(line || "").trim();
    if (!clean || /^\+\+/.test(clean)) return [];
    return splitTopLevelComma(clean).map(parseWeaponLine).filter(Boolean);
  }

  function parseWeaponLine(line) {
    const clean = line.trim().replace(/\s+/g, " ");
    const open = clean.indexOf("(");
    const close = clean.lastIndexOf(")");
    const nameText = open > 0 && close > open ? clean.slice(0, open).trim() : clean;
    if (!nameText || nameText === "-") return null;
    const countMatch = nameText.match(/^(\d+)x\s+(.+)$/i);
    const count = countMatch ? numberValue(countMatch[1], 1) : 1;
    const name = cleanName(countMatch ? countMatch[2] : nameText);
    const detailText = open > 0 && close > open ? clean.slice(open + 1, close) : "";
    const parts = splitTopLevelComma(detailText).map((part) => part.trim()).filter(Boolean);
    const rangePart = parts.find((part) => /^\d+\s*"?$/.test(part));
    const special = parts
      .filter((part) => !/^A\s*[+-]?\d+$/i.test(part))
      .filter((part) => !/^AP\s*(?:\([+-]?\d+\)|[+-]?\d+)$/i.test(part))
      .filter((part) => !/^Deadly\s*(?:\([+-]?\d+\)|[+-]?\d+)$/i.test(part))
      .filter((part) => part !== rangePart)
      .filter((part) => part !== "-")
      .join(", ");
    return {
      id: makeId(),
      name,
      count,
      attacks: readValue(detailText, "A", 1),
      range: formatRange(rangePart),
      ap: readValue(detailText, "AP", 0),
      deadly: readValue(detailText, "Deadly", 1),
      special
    };
  }

  function formatRange(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "-") return "";
    const match = text.match(/^(\d+)"+$/) || text.match(/^(\d+)$/);
    return match ? `${match[1]}"` : text;
  }

  function splitTopLevelComma(text) {
    const parts = [];
    let depth = 0;
    let start = 0;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (char === "(") depth += 1;
      if (char === ")" && depth > 0) depth -= 1;
      if (char === "," && depth === 0) {
        parts.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    const last = value.slice(start).trim();
    if (last) parts.push(last);
    return parts;
  }

  function readValue(text, name, fallback) {
    const match = String(text || "").match(new RegExp(`\\b${escapeRegExp(name)}\\s*(?:\\(([+-]?\\d+)\\)|([+-]?\\d+))`, "i"));
    return match ? numberValue(match[1] || match[2], fallback) : fallback;
  }

  function rulesToString(rules) {
    if (!Array.isArray(rules)) return "";
    return rules.map((rule) => {
      if (typeof rule === "string") return rule;
      const name = rule.label || rule.name || rule.id || "";
      return rule.rating ? `${name}(${rule.rating})` : name;
    }).filter(Boolean).join(", ");
  }

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("image failed"));
        image.onload = () => {
          const maxSide = 720;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function addLog(title, body) {
    state.log.unshift({ title, body });
    state.log = state.log.slice(0, 10);
    saveState();
  }

  function step(title, body, detail) {
    return { title, body, detail };
  }

  function cleanName(value) {
    const text = String(value || "").trim();
    if (/^Unit\s+[a-z0-9_-]{6,}$/i.test(text)) return "";
    if (/^[a-z0-9_-]{6,}$/i.test(text) && /[a-z]/i.test(text) && /\d/.test(text)) return "";
    return text;
  }

  function normalizeSide(side) {
    return ["opponent", "enemy", "them"].includes(String(side || "").toLowerCase()) ? "opponent" : "mine";
  }

  function clampRoll(value) {
    return Math.max(2, Math.min(6, numberValue(value, 4)));
  }

  function numberValue(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
