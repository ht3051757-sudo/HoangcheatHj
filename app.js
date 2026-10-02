/* UGPHONE MOD - shared online frontend */
const API_URL=(window.UG_API_URL||localStorage.getItem("ug_api_url")||"/api").replace(/\/$/,"");
async function fetchJSON(url,opts={}){
 try{
  const r=await fetch(url,opts);
  const type=r.headers.get("content-type")||"";
  if(!type.includes("application/json")){
   const text=await r.text();
   if(/<html|<!doctype/i.test(text)) throw new Error("API đang trả về trang HTML. Hãy cấu hình đúng URL backend Render trong config.js.");
   throw new Error(`API không trả về JSON (HTTP ${r.status}).`);
  }
  return r;
 }catch(e){
  if(e instanceof Error && e.message.startsWith("API ")) throw e;
  throw new Error(`Không kết nối được API (${API_URL}). Kiểm tra backend Render và URL /api.`);
 }}
const $=id=>document.getElementById(id);
let token=localStorage.getItem("ug_token")||"";
let me=null,adminToken=localStorage.getItem("ug_admin_token")||"";
let chatWS=null,chatReconnectTimer=null;
let poller=null;

function toast(t){const x=$("toast");if(!x)return;x.textContent=t;x.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.style.display="none",2500)}
function msg(t){if($("authMsg"))$("authMsg").textContent=t}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function api(path,opts={}){const h=new Headers(opts.headers||{});h.set("Content-Type","application/json");if(token)h.set("Authorization","Bearer "+token);return fetchJSON(API_URL+path,{...opts,headers:h}).then(async r=>{let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||"Phản hồi không hợp lệ");return d})}
function adminApi(path,opts={}){const h=new Headers(opts.headers||{});h.set("Content-Type","application/json");if(adminToken)h.set("Authorization","Bearer "+adminToken);return fetchJSON(API_URL+path,{...opts,headers:h}).then(async r=>{let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||"Phản hồi không hợp lệ");return d})}

function show(id){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));const el=$(id);if(el)el.classList.add("active");if(id==="chat")loadChat();if(id==="admin")loadAdmin();if(id==="auth")renderProfile()}
function validName(s){return /^[A-Za-z0-9_.-]{3,32}$/.test(s)}
async function register(){const u=$("username")?.value.trim(),p=$("password")?.value||"";if(!validName(u))return msg("Tên tài khoản 3-32 ký tự, chỉ dùng chữ, số, _, -, .");if(p.length<6)return msg("Mật khẩu phải có ít nhất 6 ký tự.");const btn=document.querySelector("button[onclick=\"register()\"]");if(btn)btn.disabled=true;try{const d=await api("/register",{method:"POST",body:JSON.stringify({username:u,password:p})});token=d.token;localStorage.setItem("ug_token",token);me=d.user;msg("Tạo tài khoản thành công.");toast("Đã tạo tài khoản");await refreshAll()}catch(e){msg(e.message)}finally{if(btn)btn.disabled=false}}
async function login(){const u=$("username")?.value.trim(),p=$("password")?.value||"";if(!validName(u))return msg("Tên tài khoản không hợp lệ.");if(!p)return msg("Vui lòng nhập mật khẩu.");const btn=document.querySelector("button[onclick=\"login()\"]");if(btn)btn.disabled=true;try{const d=await api("/login",{method:"POST",body:JSON.stringify({username:u,password:p})});token=d.token;localStorage.setItem("ug_token",token);me=d.user;msg("Đăng nhập thành công.");toast("Đã đăng nhập");await refreshAll()}catch(e){msg(e.message)}finally{if(btn)btn.disabled=false}}
function logout(){if(!token)return;api("/logout",{method:"POST"}).catch(()=>{}).finally(()=>{token="";me=null;localStorage.removeItem("ug_token");renderProfile();toast("Đã đăng xuất");refreshAll()})}
async function loadMe(){if(!token){me=null;return}try{me=(await api("/me")).user}catch{token="";localStorage.removeItem("ug_token");me=null}}
async function claimKey(){if(!me)return toast("Bạn cần đăng nhập.");try{const d=await api("/keys/claim",{method:"POST"});$("keyBox").textContent=d.key;$("keyBox").classList.remove("hidden");navigator.clipboard?.writeText(d.key).catch(()=>{});toast("Đã nhận KEY hôm nay");refreshStats()}catch(e){toast(e.message)}}
function renderProfile(){const box=$("profileBox");if(!box)return;if(!me){box.innerHTML="<p>Chưa đăng nhập.</p>";return}box.innerHTML=`${me.avatar?`<img class="avatarLarge" src="${esc(me.avatar)}">`:""}<p><b>${esc(me.username)}</b></p><input id="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button class="primary" onclick="saveAvatar()">LƯU AVATAR</button><button onclick="removeAvatar()">XÓA AVATAR</button>`}
async function saveAvatar(){const f=$("avatarFile")?.files?.[0];if(!f)return toast("Chọn ảnh trước.");if(f.size>512*1024)return toast("Ảnh tối đa 512 KB.");if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type))return toast("Chỉ PNG, JPG, WebP hoặc GIF.");const r=new FileReader();r.onload=async()=>{try{const d=await api("/profile/avatar",{method:"POST",body:JSON.stringify({avatar:r.result})});me=d.user;renderProfile();toast("Đã đổi avatar")}catch(e){toast(e.message)}};r.readAsDataURL(f)}
async function removeAvatar(){try{const d=await api("/profile/avatar",{method:"POST",body:JSON.stringify({avatar:""})});me=d.user;renderProfile();toast("Đã xóa avatar")}catch(e){toast(e.message)}}
function wsURL(){
 const base=API_URL.startsWith("http")?API_URL:`${location.protocol}//${location.host}${API_URL}`;
 const u=new URL(base); u.protocol=u.protocol==="https:"?"wss:":"ws:"; u.pathname="/ws"; u.search=""; return u.toString();
}
function renderChatMessage(m){
 const box=$("chatMessages"); if(!box)return;
 const el=document.createElement("div"); el.className="chatMsg";
 el.innerHTML=(m.avatar?`<img class="avatar" src="${esc(m.avatar)}">`:`<div class="avatar">${m.username==="Admin"?"A":"U"}</div>`)+`<div class="chatBody"><b>${esc(m.username)}</b><div>${esc(m.message)}</div></div>`;
 box.appendChild(el); box.scrollTop=box.scrollHeight;
}
function connectChatWS(){
 if(chatWS&&[0,1].includes(chatWS.readyState))return;
 try{chatWS=new WebSocket(wsURL());
  chatWS.onopen=()=>{const s=$("chatStatus");if(s)s.textContent="● Realtime";};
  chatWS.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==="global_message")renderChatMessage(d.message);}catch{}};
  chatWS.onclose=()=>{const s=$("chatStatus");if(s)s.textContent="● Đang kết nối lại";clearTimeout(chatReconnectTimer);chatReconnectTimer=setTimeout(connectChatWS,3000);};
  chatWS.onerror=()=>{try{chatWS.close()}catch{}};
 }catch{clearTimeout(chatReconnectTimer);chatReconnectTimer=setTimeout(connectChatWS,3000)}
}
function adminBroadcastSend(){
 const input=$("adminBroadcast"),message=(input?.value||"").trim();
 if(!message)return toast("Nhập thông báo.");
 adminApi("/admin/broadcast",{method:"POST",body:JSON.stringify({message})}).then(d=>{input.value="";toast(`Đã gửi tới ${d.recipients} kết nối`);loadAdmin()}).catch(e=>toast(e.message));
}
async function loadChat(){try{const d=await api("/chat");const box=$("chatMessages");box.innerHTML="";d.messages.forEach(renderChatMessage);connectChatWS()}catch(e){toast(e.message)}}
async function sendChat(){const input=$("chatInput"),text=(input?.value||"").trim();if(!me)return toast("Đăng nhập để chat.");if(!text)return;if(text.length>500)return toast("Tin nhắn tối đa 500 ký tự.");try{await api("/chat",{method:"POST",body:JSON.stringify({message:text})});input.value="";loadChat()}catch(e){toast(e.message)}}
async function refreshStats(){try{const d=await api("/stats");$("onlineCount").textContent=d.online;const s=$("stats");if(s)s.textContent=`Tài khoản: ${d.users} • Online: ${d.online} • KEY: ${d.keys}`}catch{}}
async function adminLogin(){
 const p=$("adminPass")?.value||"";
 if(!p)return toast("Nhập mật khẩu Admin.");
 try{
  const r=await fetchJSON(API_URL+"/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:p})});
  const j=await r.json();
  if(!r.ok)throw new Error(j.error||"Sai mật khẩu Admin.");
  adminToken=j.token;
  localStorage.setItem("ug_admin_token",adminToken);
  toast("Đăng nhập Admin thành công");
  loadAdmin();
 }catch(e){toast(e.message)}
}
async function adminLogout(){try{await adminApi("/admin/logout",{method:"POST"})}catch{}adminToken="";localStorage.removeItem("ug_admin_token");loadAdmin()}
async function loadAdmin(){
 checkApiStatus();const loginBox=$("adminLogin"),panel=$("adminPanel");if(!loginBox||!panel)return;if(!adminToken){loginBox.classList.remove("hidden");panel.classList.add("hidden");return}try{const d=await adminApi("/admin/state");loginBox.classList.add("hidden");panel.classList.remove("hidden");$("statUsers").textContent=d.stats.users;$("statOnline").textContent=d.stats.online;$("statBanned").textContent=d.stats.banned;$("statKeys").textContent=d.stats.keys;renderKeys(d.keys);renderUsers(d.users);$("adminChat").innerHTML=d.messages.map(m=>`<div class="chatMsg">${m.avatar?`<img class="avatar" src="${esc(m.avatar)}">`:""}<div><b>${esc(m.username)}</b>: ${esc(m.message)}</div></div>`).join("")}catch(e){adminToken="";localStorage.removeItem("ug_admin_token");loginBox.classList.remove("hidden");panel.classList.add("hidden");toast(e.message)}}
function renderKeys(keys){$("keyList").innerHTML=keys.map(k=>`<div class="keyitem"><span>${esc(k.date)} — <b>${esc(k.key)}</b> — ${k.used}/${k.limit} — ${k.active?"BẬT":"TẮT"}</span><button onclick="toggleKey('${esc(k.id)}')">${k.active?"TẮT":"BẬT"}</button></div>`).join("")}
function renderUsers(users){$("users").innerHTML=users.map(u=>`<div class="user ${u.banned?"ban":""}"><span><b>${esc(u.username)}</b> — ${u.banned?"BAN":"OK"} — IP: ${esc(u.ip||"")}</span><div class="adminBtns"><button onclick="banUser('${esc(u.id)}')">${u.banned?"GỠ BAN":"BAN"}</button><button class="ipban" onclick="banIP('${encodeURIComponent(u.ip||"")}')">BAN IP</button></div></div>`).join("")}
async function addKey(){const key=$("newKey")?.value.trim(),date=$("keyDate")?.value,limit=Number($("keyLimit")?.value||999999);if(!key)return toast("Nhập KEY.");try{await adminApi("/admin/keys",{method:"POST",body:JSON.stringify({key,date,limit})});$("newKey").value="";loadAdmin();toast("Đã thêm KEY — tất cả máy sẽ thấy")}catch(e){toast(e.message)}}
async function toggleKey(id){try{await adminApi("/admin/keys/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({toggle:true})});loadAdmin()}catch(e){toast(e.message)}}
async function banUser(id){try{await adminApi("/admin/users/"+encodeURIComponent(id)+"/ban",{method:"PATCH"});loadAdmin()}catch(e){toast(e.message)}}
async function banIP(ip){try{await adminApi("/admin/ips/ban",{method:"POST",body:JSON.stringify({ip:decodeURIComponent(ip)})});loadAdmin()}catch(e){toast(e.message)}}
async function refreshAll(){await loadMe();renderProfile();await refreshStats();if($("chat").classList.contains("active"))await loadChat();if($("admin").classList.contains("active"))await loadAdmin()}
connectChatWS();setInterval(()=>{refreshStats();if($("chat")?.classList.contains("active"))loadChat()},10000);
window.register=register;window.login=login;window.logout=logout;window.show=show;window.claimKey=claimKey;window.saveAvatar=saveAvatar;window.removeAvatar=removeAvatar;window.sendChat=sendChat;window.adminLogin=adminLogin;window.adminLogout=adminLogout;window.adminBroadcastSend=adminBroadcastSend;window.addKey=addKey;window.toggleKey=toggleKey;window.banUser=banUser;window.banIP=banIP;
$("keyDate").value=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"});refreshAll();


// Global server status banner and admin controls.
(function(){
  async function loadServerStatus(){
    try{
      const r=await fetch(API_URL+"/server-status",{cache:"no-store"});
      const s=await r.json();
      const b=document.getElementById("serverStatusBanner");
      if(!b) return;
      if(s.status && s.status!=="normal"){
        b.textContent=s.display||"Server đang được bảo trì 🔩";
        b.hidden=false;
        b.dataset.status=s.status;
      }else{
        b.hidden=true;
      }
    }catch(e){}
  }
  window.setServerStatus=async function(status){
    try{
      const r=await fetch(API_URL+"/admin/server-status",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status})
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Không thể đổi trạng thái server.");
      toast?.(d.message||"Đã cập nhật trạng thái server.");
      loadServerStatus();
    }catch(e){ toast?.(e.message); }
  };
  document.addEventListener("DOMContentLoaded",()=>{
    const b=document.createElement("div");
    b.id="serverStatusBanner";
    b.hidden=true;
    b.setAttribute("role","status");
    b.style.cssText="position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px;text-align:center;font-weight:700;background:#222;color:#fff;";
    document.body.appendChild(b);
    loadServerStatus();
    setInterval(loadServerStatus,10000);
  });
})();


(function(){
  function addAdminServerControls(){
    const panel=document.getElementById("adminPanel");
    if(!panel || document.getElementById("serverControls")) return;
    const box=document.createElement("div");
    box.id="serverControls";
    box.innerHTML=`
      <h3>Trạng thái server</h3>
      <button type="button" onclick="setServerStatus('maintenance')">🔩 Đóng server</button>
      <button type="button" onclick="setServerStatus('resetting')">♻️ Đang reset server</button>
      <button type="button" onclick="setServerStatus('resting')">🌙 Server đang nghỉ</button>
      <button type="button" onclick="setServerStatus('normal')">▶️ Mở server</button>
    `;
    panel.appendChild(box);
  }
  document.addEventListener("DOMContentLoaded",addAdminServerControls);
  setTimeout(addAdminServerControls,1500);
})();

async function checkApiStatus(){
 const el=$("apiStatus"); if(!el)return;
 try{
  const r=await fetchJSON(API_URL+"/health",{cache:"no-store"});
  const d=await r.json();
  el.textContent=d.ok&&d.database==="ok"?"API + Database: OK":"API: đang có lỗi";
 }catch(e){el.textContent="API: "+e.message}
}
