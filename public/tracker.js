/*!
 * tracker.js — AI Crawler Analytics pixel. <2KB, no deps, no build step.
 * Embed: <script async src=".../tracker.js" data-site="SITE_ID"></script>
 * Captures JS-executing agents only — install the middleware for full
 * coverage. See README.md "Pixel snippet" section for full docs/rationale.
 */
(function () {
  var INGEST_URL = "https://onecvommgdocankabufy.supabase.co/functions/v1/ingest";

  try {
    var script = document.currentScript ||
      document.querySelector('script[src*="tracker.js"]');
    if (!script) return;

    var siteId = script.getAttribute("data-site");
    if (!siteId) {
      var src = script.getAttribute("src") || "";
      var m = /[?&]sid=([^&]+)/.exec(src);
      siteId = m && decodeURIComponent(m[1]);
    }
    if (!siteId) return;

    var url = INGEST_URL +
      "?sid=" + encodeURIComponent(siteId) +
      "&u=" + encodeURIComponent(location.href);

    if (window.fetch) {
      fetch(url, { method: "GET", keepalive: true, mode: "no-cors" }).catch(function () {});
    } else {
      new Image().src = url;
    }
  } catch (e) {
    // Fail silently — never break the host page.
  }
})();
