(async () => {
  const files = [
    "./app-code-00.b64",
    "./app-code-01.b64",
    "./app-code-02.b64",
    "./app-code-03.b64",
    "./app-code-04.b64",
    "./app-code-05.b64",
    "./app-code-06.b64"
  ];
  const parts = await Promise.all(files.map(async (file) => {
    const response = await fetch(file, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load " + file);
    return response.text();
  }));

  (0, eval)(parts.map((part) => atob(part.trim())).join(""));

  const style = document.createElement("style");
  style.textContent = `
    .target-picker.is-optional { padding: 8px 10px; }
    .target-picker.is-optional .mini-heading { margin-bottom: 4px; }
    .target-picker.is-optional .inline-empty {
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--muted);
    }
    @media (max-width: 560px) {
      .app-shell { width: 100%; box-shadow: none; }
      .topbar { padding: calc(10px + env(safe-area-inset-top)) 12px 10px; }
      .icon-button { min-width: 48px; }
      main { padding: 12px; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
      .tabs {
        gap: 4px;
        padding: 6px;
        top: calc(59px + env(safe-area-inset-top));
      }
      .tab { min-height: 34px; font-size: 0.78rem; }
      .panel { padding: 10px; }
      .combat-panel { gap: 10px; }
      .attack-focus,
      .target-picker { padding: 10px; }
      .result-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }
      .result-strip div,
      .rules-callout,
      .step-card { padding: 10px; }
      .result-strip span { font-size: 0.65rem; }
      .result-strip strong { font-size: 1.35rem; }
      .result-strip small {
        display: block;
        font-size: 0.7rem;
        line-height: 1.2;
      }
    }
  `;
  document.head.append(style);

  const cleanOptionalTarget = () => {
    const selected = document.getElementById("selectedAttackName");
    const targetButtons = document.getElementById("targetButtons");
    const targetHint = document.getElementById("targetHint");
    if (!selected || !targetButtons) return;

    const hasAttack = !/tap an attack/i.test(selected.textContent || "");
    const text = targetButtons.textContent || "";
    const needsOptionalMessage = hasAttack && /pick an attack first/i.test(text);
    const alreadyOptional = hasAttack && /you can still roll attacks/i.test(text);
    const isOptional = needsOptionalMessage || alreadyOptional;
    const picker = targetButtons.closest(".target-picker");
    if (picker) picker.classList.toggle("is-optional", isOptional);
    if (!needsOptionalMessage) return;

    targetButtons.innerHTML = '<div class="inline-empty">No target selected. You can still roll attacks.</div>';
    if (targetHint) targetHint.textContent = "Optional";
  };

  cleanOptionalTarget();
  new MutationObserver(cleanOptionalTarget).observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
  });
})().catch((error) => {
  console.error(error);
  document.body.innerHTML = '<main style="padding:16px;font-family:system-ui,sans-serif"><h1>OPR Assistant could not load</h1><p>Please refresh once. If it keeps happening, clear the site data and open it again.</p></main>';
});