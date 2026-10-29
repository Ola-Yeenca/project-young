// Crowd board: swap in fresh numbers every 20 seconds while the tab is visible. The page itself
// never reloads, so the DJ's scroll position stays put.
(function () {
  const board = document.getElementById("crowd-board");
  if (!board) return;
  let busy = false;
  const refresh = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch(board.dataset.src, { credentials: "same-origin", cache: "no-store", redirect: "error" });
      if (res.ok) {
        board.innerHTML = await res.text();
        board.classList.add("settled");
      }
    } catch (e) {
    } finally {
      busy = false;
    }
  };
  setInterval(refresh, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
