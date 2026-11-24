(function () {
  const userId = window.CURRENT_USER_ID;
  if (!userId) return;

  let heartbeatInterval = null;

  async function sendHeartbeat() {
    try {
      await fetch('/actions/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    } catch (e) {}
  }

  function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeat(); // immédiatement
    heartbeatInterval = setInterval(sendHeartbeat, 30_000);
  }

  // Exposé globalement pour que session_timer.js puisse le contrôler
  window._heartbeat = { start: startHeartbeat, stop: stopHeartbeat };

  window.addEventListener('beforeunload', () => {
    stopHeartbeat();
  });

  // Démarrage initial
  startHeartbeat();

})();