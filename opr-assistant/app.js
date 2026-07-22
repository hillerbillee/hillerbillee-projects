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
  const pieces = await Promise.all(files.map(async (file) => {
    const response = await fetch(file, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${file}`);
    return atob((await response.text()).trim());
  }));
  (0, eval)(pieces.join(""));
})().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("afterbegin", '<div style="margin:12px;padding:12px;border:1px solid #bc4636;border-radius:8px;background:#f8dfdc;color:#202631;font-family:system-ui,sans-serif">App failed to load. Refresh once, or clear the browser cache and try again.</div>');
});
