// UGPHONE MOD API configuration
// For GitHub Pages, set the real Render backend URL here, including /api.
// Example: window.UG_API_URL = "https://your-service.onrender.com/api";
//
// You may also open the site once with ?api=https%3A%2F%2Fyour-service.onrender.com%2Fapi
// and it will be remembered in localStorage.
(function(){
  const q=new URLSearchParams(location.search).get("api");
  if(q) localStorage.setItem("ug_api_url",q.replace(/\/+$/,""));
  window.UG_API_URL=window.UG_API_URL||localStorage.getItem("ug_api_url")||"/api";
})();