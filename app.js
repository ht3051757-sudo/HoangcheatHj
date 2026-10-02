const API="/api";
const $=id=>document.getElementById(id);
const state={chatId:0,avatar:localStorage.getItem("ug_avatar")||"",token:localStorage.getItem("ug_admin_token")||"",user:localStorage.getItem("ug_user")||""};

function show(id){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");if(id==="admin")renderAdmin()}
function toast(t){let x=$("toast");x.textContent=t;x.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>x.style.display="none",2300)}
async function api(path,opts={}){let headers={"Content-Type":"application/json",...(opts.headers||{})};if(state.token)headers.Authorization="Bearer "+state.token;let r=await fetch(API+path,{...opts,headers});let text=await r.text();let d;try{d=text?JSON.parse(text):{}}catch{throw new Error(`Máy chủ không trả JSON (HTTP ${r.status}). Hãy mở website bằng http://... và chạy node server.js.`)}if(!r.ok)throw new Error(d.error||`Lỗi máy chủ (HTTP ${r.status})`);return d}

function setAuthMsg(t){$("authMsg").textContent=t}

async function register(){
  let u=$("username").value.trim(),p=$("password").value;
  if(!u||!p)return setAuthMsg("Nhập đủ thông tin.");
  try{let d=await api("/register",{method:"POST",body:JSON.stringify({username:u,password:p})});
    state.user=d.username;state.avatar=d.avatar||"";localStorage.setItem("ug_user",d.username);localStorage.setItem("ug_avatar",state.avatar);setAuthMsg("Tạo tài khoản thành công.");toast("Tài khoản đã được tạo");refreshAll();
  }catch(e){setAuthMsg(e.message)}
}
async function login(){
  let u=$("username").value.trim(),p=$("password").value;
  if(!u||!p)return setAuthMsg("Nhập đủ thông tin.");
  try{let d=await api("/login",{method:"POST",body:JSON.stringify({username:u,password:p})});
    state.user=d.username;state.avatar=d.avatar||"";localStorage.setItem("ug_user",d.username);localStorage.setItem("ug_avatar",state.avatar);setAuthMsg("Đăng nhập thành công.");toast("Xin chào "+u);refreshAll();
  }catch(e){setAuthMsg(e.message)}
}
async function touch(){if(!state.user)return;try{await api("/presence",{method:"POST",body:JSON.stringify({username:state.user})})}catch{}}
async function refreshStats(){
  try{let d=await api("/stats");$("onlineCount").textContent=d.online;$("statOnline").textContent=d.online}
  catch{$("onlineCount").textContent="0"}
}
async function claimKey(){
  if(!state.user){show("auth");return}
  try{await touch();let d=await api("/claim-key",{method:"POST",body:JSON.stringify({username:state.user})});
    $("keyBox").textContent=d.key;$("keyBox").classList.remove("hidden");
    navigator.clipboard?.writeText(d.key).catch(()=>{});toast("KEY hôm nay đã được cấp • đã copy");renderAdmin();
  }catch(e){toast(e.message)}
}
async function adminLogin(){
  let password=$("adminPass").value;
  try{let d=await api("/admin/login",{method:"POST",body:JSON.stringify({password})});
    state.token=d.token;localStorage.setItem("ug_admin_token",d.token);renderAdmin();toast("Đăng nhập Admin thành công");
  }catch(e){toast(e.message)}
}
async function addKey(){
  if(!state.token)return toast("Cần đăng nhập Admin");
  let key=$("newKey").value.trim(),date=$("keyDate").value,limit=Math.max(1,Number($("keyLimit").value)||1);
  if(!key||!date)return toast("Nhập KEY và ngày");
  try{await api("/admin/keys",{method:"POST",body:JSON.stringify({key,date,limit})});
    $("newKey").value="";$("keyLimit").value="";renderAdmin();toast("Đã thêm KEY UGPHONE MOD");
  }catch(e){toast(e.message)}
}
async function toggleKey(id,active){try{await api("/admin/keys/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({active:!active})});renderAdmin()}catch(e){toast(e.message)}}
async function toggleBan(username,banned){
  try{await api("/admin/users/"+encodeURIComponent(username),{method:"PATCH",body:JSON.stringify({banned:!banned})});renderAdmin()}
  catch(e){toast(e.message)}
}
function fmt(t){return t?new Date(t).toLocaleString("vi-VN"):"—"}
async function renderAdmin(){
  let ok=!!state.token;
  $("adminLogin").classList.toggle("hidden",ok);$("adminPanel").classList.toggle("hidden",!ok);
  if(!ok)return;
  try{
    let [s,u,k]=await Promise.all([api("/admin/stats"),api("/admin/users"),api("/admin/keys")]);
    $("statUsers").textContent=s.users;$("statOnline").textContent=s.online;$("statBanned").textContent=s.banned;$("statKeys").textContent=s.keys;
    $("users").innerHTML=u.users.length?u.users.map(x=>`<div class="user"><span class="userIdentity"><img class="avatarSmall" src="${x.avatar||defaultAvatar()}" alt=""><span><b>${esc(x.username)}</b> ${x.banned?"— <b>ĐÃ BAN</b>":""}<br><small>Tạo: ${fmt(x.createdAt)} • Hoạt động cuối: ${fmt(x.lastSeen)}</small></span><button class="${x.banned?"":"ban"}" onclick="toggleBan(decodeURIComponent('${encodeURIComponent(x.username).replace(/'/g,'%27')}'),${x.banned})">${x.banned?"GỠ BAN":"BAN"}</button></div>`).join(""):"Chưa có tài khoản.";
    renderAdminChat();
    $("keyList").innerHTML=k.keys.length?k.keys.map(x=>`<div class="keyitem"><div><b>${esc(x.key)}</b><br><small>${x.date} • ${x.used}/${x.limit} lượt • ${x.active?"ĐANG BẬT":"TẮT"}</small></div><button onclick="toggleKey(decodeURIComponent('${encodeURIComponent(x.id)}'),${x.active})">${x.active?"TẮT":"BẬT"}</button></div>`).join(""):"Chưa có KEY.";
  }catch(e){if(/Admin|token|hết hạn/i.test(e.message)){state.token="";localStorage.removeItem("ug_admin_token")}toast(e.message)}
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

let chatTimer=null;
function defaultAvatar(){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='#171122'/><circle cx='32' cy='25' r='11' fill='#9d7cff'/><path d='M13 56c3-14 35-14 38 0' fill='#9d7cff'/></svg>")}
function chatScroll(){let box=$("chatMessages");if(box)box.scrollTop=box.scrollHeight}
function renderChat(msgs,admin=false){
  let box=$(admin?"adminChat":"chatMessages"); if(!box)return;
  box.innerHTML=msgs.map(m=>`<div class="chatMsg"><img class="avatar" src="${m.avatar||defaultAvatar()}" alt=""><div class="chatBody"><div><b>${esc(m.username)}</b><small>${fmt(m.at)}</small></div><p>${esc(m.message)}</p></div></div>`).join("");
  if(!admin)chatScroll();
}

function showProfile(){
  $("profileBox")?.classList.toggle("hidden",!state.user);
  if(state.avatar){$("avatarPreview").src=state.avatar;$("avatarPreview").classList.remove("hidden")}
  else $("avatarPreview").classList.add("hidden");
}
function previewAvatar(ev){
  let f=ev.target.files?.[0];if(!f)return;
  if(f.size>1000000)return toast("Ảnh tối đa 1 MB.");
  if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type))return toast("Chỉ nhận PNG/JPG/WebP/GIF.");
  let r=new FileReader();r.onload=()=>{$("avatarPreview").src=r.result;$("avatarPreview").classList.remove("hidden");$("avatarPreview").dataset.pending=r.result};r.readAsDataURL(f);
}
async function saveAvatar(){
  if(!state.user)return show("auth");
  let avatar=$("avatarPreview").dataset.pending;if(!avatar)return toast("Hãy chọn ảnh trước.");
  try{
    let d=await api("/profile/avatar",{method:"POST",body:JSON.stringify({username:state.user,avatar})});
    state.avatar=d.avatar;localStorage.setItem("ug_avatar",state.avatar);$("avatarPreview").dataset.pending="";renderChat(await api("/messages?since=0").then(x=>x.messages||[]));toast("Đã đổi avatar");
  }catch(e){toast(e.message)}
}
async function removeAvatar(){
  if(!state.user)return;
  try{
    let d=await api("/profile/avatar",{method:"POST",body:JSON.stringify({username:state.user,avatar:""})});
    state.avatar="";localStorage.removeItem("ug_avatar");$("avatarPreview").classList.add("hidden");$("avatarPreview").dataset.pending="";toast("Đã xóa avatar");
  }catch(e){toast(e.message)}
}

async function loadChat(){
  if(!state.user)return;
  try{
    let d=await api("/messages?since="+state.chatId);
    if(d.messages?.length){
      let box=$("chatMessages"), old=box?box.innerHTML:"";
      d.messages.forEach(m=>{state.chatId=Math.max(state.chatId,m.id);});
      let all=await api("/messages?since=0");
      renderChat(all.messages||[]);
    }
    if($("chatStatus"))$("chatStatus").textContent="● Kết nối";
  }catch(e){if($("chatStatus"))$("chatStatus").textContent="● Mất kết nối"}
}
async function sendMessage(){
  if(!state.user){show("auth");return}
  let inp=$("chatText"),msg=inp.value.trim();if(!msg)return;
  try{await api("/messages",{method:"POST",body:JSON.stringify({username:state.user,message:msg})});inp.value="";await loadChat()}
  catch(e){toast(e.message)}
}
async function renderAdminChat(){
  if(!state.token)return;
  try{let d=await api("/admin/messages");renderChat(d.messages||[],true)}
  catch(e){}
}

async function refreshAll(){touch();showProfile();refreshStats();if($("admin").classList.contains("active"))renderAdmin()}
setInterval(refreshAll,15000);setInterval(loadChat,2500);refreshAll();loadChat();

const c=$("particles"),ctx=c.getContext("2d",{alpha:true});let W,H,DPR,pts=[],last=0,frames=0,lastAdjust=performance.now();
function resize(){DPR=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;c.width=W*DPR;c.height=H*DPR;c.style.width=W+"px";c.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);resetPts()}
function resetPts(){let n=Math.min(85,Math.max(28,Math.round(W*H/12000)));pts=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,r:.5+Math.random()*1.4,a:.15+Math.random()*.4}))}
function frame(t){let dt=Math.min(32,t-last||16);last=t;ctx.clearRect(0,0,W,H);for(const p of pts){p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.globalAlpha=p.a;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="#b98cff";ctx.fill()}ctx.globalAlpha=1;frames++;if(t-lastAdjust>1500){let f=frames*1000/(t-lastAdjust);if(f<45&&pts.length>28)pts.length=Math.max(28,pts.length-10);else if(f>57&&pts.length<85)pts.length=Math.min(85,pts.length+5);frames=0;lastAdjust=t}requestAnimationFrame(frame)}
addEventListener("resize",resize,{passive:true});resize();requestAnimationFrame(frame);
