// UGPHONE MOD API configuration
// 1) If frontend and backend are deployed together, leave this as "/api".
// 2) If frontend is on GitHub Pages, set the Render URL below.
//    Example: window.UG_API_URL = "https://your-service.onrender.com/api";
//
// You can also set it at runtime:
// localStorage.setItem("ug_api_url", "https://your-service.onrender.com/api");

window.UG_API_URL = window.UG_API_URL || localStorage.getItem("ug_api_url") || "/api";
