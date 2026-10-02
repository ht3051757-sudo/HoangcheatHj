const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),url=require("url");
const PORT=Number(process.env.PORT||3000);
const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||"admin123");
const DATA_DIR=path.join(__dirname,"data"),DB_FILE=path.join(DATA_DIR,"db.json");
fs.mkdirSync(DATA_DIR,{recursive:true});
const empty={users:[],keys:[],bannedIPs:[],messages:[]};
function load(){
  try{
    const d=JSON.parse(fs.readFileSync(DB_FILE,"utf8"));
    d.users ||= []; d.keys ||= []; d.bannedIPs ||= []; d.messages ||= [];
    return d;
  }catch{
    fs.writeFileSync(DB_FILE,JSON.stringify(empty,null,2));
    return JSON.parse(JSON.stringify(empty));
  }
}
let db=load();
function save(){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2))}
function send(res,status,data){let body=JSON.stringify(data);res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"});res.end(body)}
function hash(s){return crypto.createHash("sha256").update(s).digest("hex")}
function readBody(req){return new Promise((resolve,reject)=>{let b="";req.on("data",c=>{b+=c;if(b.length>1e6)req.destroy()});req.on("end",()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(new Error("JSON không hợp lệ"))}})})}
function token(){return crypto.randomBytes(32).toString("hex")}
const adminTokens=new Map();
function authAdmin(req){let h=req.headers.authorization||"";let t=h.startsWith("Bearer ")?h.slice(7):"";let exp=adminTokens.get(t);if(!exp)return false;if(exp<=Date.now()){adminTokens.delete(t);return false}return true}
function validName(s){return typeof s==="string"&&/^[A-Za-z0-9_.-]{3,32}$/.test(s)}
function online(u){return u.lastSeen&&Date.now()-u.lastSeen<90000}

function normalizeIP(ip){
  if(!ip) return "";
  if(ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}
function requestIP(req){
  // Use the direct socket IP. Do not trust X-Forwarded-For unless the
  // application is behind a configured/trusted reverse proxy.
  return normalizeIP(req.socket.remoteAddress||"");
}
function isIPBanned(ip){ return !!ip && db.bannedIPs.includes(ip); }

async function handler(req,res){
  let u=url.parse(req.url,true),p=u.pathname;
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS"});return res.end()}
  if(req.method==="GET" && p==="/api/stats")return send(res,200,{users:db.users.length,online:db.users.filter(x=>!x.banned&&online(x)).length,banned:db.users.filter(x=>x.banned).length,keys:db.keys.length,bannedIPs:db.bannedIPs.length});
  try{
    if(req.method==="POST"&&p==="/api/register"){
      let b=await readBody(req),ip=requestIP(req); if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});if(!validName(b.username)||typeof b.password!=="string"||b.password.length<4||b.password.length>128)return send(res,400,{error:"Tên tài khoản 3-32 ký tự; mật khẩu 4-128 ký tự."});
      if(db.users.some(x=>x.username.toLowerCase()===b.username.toLowerCase()))return send(res,409,{error:"Tên tài khoản đã tồn tại."});
      db.users.push({username:b.username,passwordHash:hash(b.password),banned:false,ip,avatar:"",createdAt:Date.now(),lastSeen:Date.now()});save();
      return send(res,201,{username:b.username});
    }
    if(req.method==="POST"&&p==="/api/login"){
      let b=await readBody(req),ip=requestIP(req),name=String(b.username||"").trim(),x=db.users.find(x=>x.username.toLowerCase()===name.toLowerCase()); if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});
      if(!x||x.passwordHash!==hash(String(b.password||"")))return send(res,401,{error:"Sai tài khoản hoặc mật khẩu."});
      if(x.banned)return send(res,403,{error:"Tài khoản của bạn đã bị BAN!"});
      x.lastSeen=Date.now();x.ip=ip;save();return send(res,200,{username:x.username,avatar:x.avatar||""});
    }
    if(req.method==="POST"&&p==="/api/presence"){
      let b=await readBody(req),ip=requestIP(req),name=String(b.username||"").trim(),x=db.users.find(x=>x.username.toLowerCase()===name.toLowerCase()); if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});
      if(!x||x.banned)return send(res,403,{error:"Tài khoản không hợp lệ hoặc đã bị BAN."});
      x.lastSeen=Date.now();x.ip=ip;save();return send(res,200,{ok:true});
    }
    if(req.method==="POST"&&p==="/api/claim-key"){
      let b=await readBody(req),ip=requestIP(req),x=db.users.find(x=>x.username===b.username); if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});
      if(!x||x.banned)return send(res,403,{error:"Tài khoản không hợp lệ hoặc đã bị BAN."});
      x.lastSeen=Date.now();x.ip=ip;
      let today=new Date().toISOString().slice(0,10),k=db.keys.find(k=>k.date===today&&k.active&&k.used<k.limit);
      if(!k)return send(res,404,{error:"Hôm nay chưa có KEY hoặc KEY đã hết lượt."});
      k.used++;k.claimedBy=(k.claimedBy||[]);k.claimedBy.push({username:x.username,at:Date.now()});save();
      return send(res,200,{key:k.key});
    }
    if(req.method==="GET"&&p==="/api/profile"){
      let username=String(u.query.username||""),x=db.users.find(x=>x.username===username);
      if(!x)return send(res,404,{error:"Không tìm thấy tài khoản."});
      return send(res,200,{username:x.username,avatar:x.avatar||""});
    }
    if(req.method==="POST"&&p==="/api/profile/avatar"){
      let b=await readBody(req),ip=requestIP(req),x=db.users.find(x=>x.username===b.username);
      if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});
      if(!x||x.banned)return send(res,403,{error:"Tài khoản không hợp lệ hoặc đã bị BAN."});
      let avatar=String(b.avatar||"");
      // Accept browser-selected images encoded as data URLs.
      if(avatar && !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(avatar))
        return send(res,400,{error:"Ảnh avatar không hợp lệ."});
      if(avatar.length>1_500_000)return send(res,413,{error:"Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn."});
      x.avatar=avatar;x.lastSeen=Date.now();x.ip=ip;save();
      return send(res,200,{username:x.username,avatar:x.avatar});
    }
    if(req.method==="GET"&&p==="/api/messages"){
      let q=u.query||{},since=Math.max(0,Number(q.since)||0);
      let msgs=db.messages.filter(m=>m.id>since).slice(-200);
      return send(res,200,{messages:msgs,nextId:db.messages.length?db.messages[db.messages.length-1].id:0});
    }
    if(req.method==="POST"&&p==="/api/messages"){
      let b=await readBody(req),ip=requestIP(req),x=db.users.find(x=>x.username===b.username);
      if(isIPBanned(ip))return send(res,403,{error:"IP của thiết bị đã bị BAN."});
      if(!x||x.banned)return send(res,403,{error:"Tài khoản không hợp lệ hoặc đã bị BAN."});
      let msg=String(b.message||"").trim();
      if(!msg)return send(res,400,{error:"Tin nhắn trống."});
      if(msg.length>500)return send(res,400,{error:"Tin nhắn tối đa 500 ký tự."});
      x.lastSeen=Date.now();x.ip=ip;
      let item={id:(db.messages.length?db.messages[db.messages.length-1].id:0)+1,username:x.username,avatar:x.avatar||"",message:msg,at:Date.now()};
      db.messages.push(item);db.messages=db.messages.slice(-1000);save();
      return send(res,201,item);
    }
    if(req.method==="POST"&&p==="/api/admin/login"){
      let b=await readBody(req);if(String(b.password||"")!==ADMIN_PASSWORD)return send(res,401,{error:"Sai mật khẩu Admin"});
      let t=token();adminTokens.set(t,Date.now()+86400000);return send(res,200,{token:t});
    }
    if(p.startsWith("/api/admin/")){
      if(!authAdmin(req))return send(res,401,{error:"Phiên Admin không hợp lệ hoặc đã hết hạn."});
      if(req.method==="GET"&&p==="/api/admin/messages")return send(res,200,{messages:db.messages.slice(-500)});
            if(req.method==="GET"&&p==="/api/admin/stats")return send(res,200,{users:db.users.length,online:db.users.filter(x=>!x.banned&&online(x)).length,banned:db.users.filter(x=>x.banned).length,keys:db.keys.length,bannedIPs:db.bannedIPs.length});
      if(req.method==="GET"&&p==="/api/admin/users")return send(res,200,{users:db.users.map(x=>({username:x.username,banned:x.banned,ip:x.ip||"",avatar:x.avatar||"",createdAt:x.createdAt,lastSeen:x.lastSeen}))});
      if(req.method==="GET"&&p==="/api/admin/keys")return send(res,200,{keys:db.keys});
      if(req.method==="POST"&&p==="/api/admin/keys"){
        let b=await readBody(req),key=String(b.key||"").trim(),date=String(b.date||""),limit=Math.max(1,Number(b.limit)||1);
        if(!key||!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,{error:"KEY và ngày không hợp lệ."});
        if(db.keys.some(x=>x.key===key))return send(res,409,{error:"KEY đã tồn tại."});
        db.keys.push({id:crypto.randomUUID(),key,date,limit,used:0,active:true,createdAt:Date.now(),claimedBy:[]});save();return send(res,201,{ok:true});
      }
      if(req.method==="PATCH"&&p.startsWith("/api/admin/keys/")){
        let id=decodeURIComponent(p.split("/").pop()),b=await readBody(req),k=db.keys.find(x=>x.id===id);if(!k)return send(res,404,{error:"Không tìm thấy KEY."});
        if(typeof b.active==="boolean")k.active=b.active;save();return send(res,200,{ok:true});
      }
      if(req.method==="POST"&&p==="/api/admin/ip-ban"){
        let b=await readBody(req),ip=normalizeIP(String(b.ip||"").trim());
        if(!ip)return send(res,400,{error:"IP không hợp lệ."});
        if(!db.bannedIPs.includes(ip))db.bannedIPs.push(ip);
        save();return send(res,200,{ok:true,ip});
      }
      if(req.method==="DELETE"&&p.startsWith("/api/admin/ip-ban/")){
        let ip=decodeURIComponent(p.split("/").pop());
        db.bannedIPs=db.bannedIPs.filter(x=>x!==ip);save();return send(res,200,{ok:true});
      }
      if(req.method==="GET"&&p==="/api/admin/ip-bans")return send(res,200,{ips:db.bannedIPs});
      if(req.method==="PATCH"&&p.startsWith("/api/admin/users/")){
        let username=decodeURIComponent(p.split("/").pop()),b=await readBody(req),x=db.users.find(x=>x.username===username);if(!x)return send(res,404,{error:"Không tìm thấy tài khoản."});
        if(typeof b.banned==="boolean")x.banned=b.banned;save();return send(res,200,{ok:true});
      }
    }
    send(res,404,{error:"Không tìm thấy API."});
  }catch(e){console.error(e);send(res,500,{error:"Lỗi máy chủ."})}
}
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
const WEB_ROOT=__dirname;
http.createServer((req,res)=>{
  if(req.url.startsWith("/api/"))return handler(req,res);
  let pathname=decodeURIComponent(url.parse(req.url).pathname);
  if(pathname==="/")pathname="/index.html";
  const root=path.resolve(WEB_ROOT);
  const f=path.resolve(WEB_ROOT,"."+pathname);
  if(f!==root && !f.startsWith(root+path.sep))return send(res,403,{error:"Forbidden"});
  fs.readFile(f,(e,d)=>{
    if(e)return send(res,404,{error:"Not found"});
    res.writeHead(200,{"Content-Type":mime[path.extname(f)]||"application/octet-stream"});
    res.end(d);
  });
}).listen(PORT,()=>console.log(`UGPHONE MOD running on http://localhost:${PORT}`));
