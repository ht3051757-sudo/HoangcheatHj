// UGPHONE MOD API configuration
(function(){
  const q = new URLSearchParams(location.search).get("api");
  if (q) localStorage.setItem("ug_api_url", q.replace(/\/+$/, ""));
  const saved = localStorage.getItem("ug_api_url") || "";
  const isGitHubPages = /github\.io$/i.test(location.hostname);
  window.UG_API_URL = (window.UG_API_URL || saved || (isGitHubPages ? "" : "/api")).replace(/\/+$/, "");
})();