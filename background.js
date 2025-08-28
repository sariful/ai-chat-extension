// Background service worker: proxy localhost Ollama requests
// Provides fetch via chrome.runtime.onMessage to avoid content-script level blocking

const ACTIVE_REQUESTS = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return; // let other listeners continue

  if (msg.type === 'OLLAMA_CHAT') {
    const { requestId, payload } = msg;
    if (!requestId) {
      sendResponse({ ok: false, error: 'missing requestId' });
      return; // sync response
    }

    const controller = new AbortController();
    ACTIVE_REQUESTS.set(requestId, controller);

    (async () => {
      try {
        const resp = await fetch(payload.url, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload.body),
            signal: controller.signal
        });
        const text = await resp.text();
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        sendResponse({ ok: resp.ok, status: resp.status, data: json, raw: text });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      } finally {
        ACTIVE_REQUESTS.delete(requestId);
      }
    })();

    return true; // keep channel open async
  }

  if (msg.type === 'ABORT_OLLAMA') {
    const { requestId } = msg;
    const controller = ACTIVE_REQUESTS.get(requestId);
    if (controller) {
      controller.abort();
      ACTIVE_REQUESTS.delete(requestId);
      sendResponse({ ok: true, aborted: true });
    } else {
      sendResponse({ ok: false, aborted: false, error: 'not-found' });
    }
    return true;
  }
});
