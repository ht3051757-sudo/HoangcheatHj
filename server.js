const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const crypto=require("crypto");
const postgres=require("postgres");

const app=express();
app.set("trust proxy",true);
app.use(express.json({limit:"1mb"}));
const allowed=(process.env.ALLOWED_ORIGIN||"*").split(",").map(x=>x.trim()).filter(Boolean);
app.use(cors({origin:(origin,cb)=>{if(!origin||allowed.includes("*")||allowed.includes(origin))return cb(null,true);cb(new Error("Origin not allowed"))},credentials:false}));

const sql=postgres(process.env.DATABASE_URL||"",{prepare:false,max:5});
const PORT=Number(process.env.PORT||10000);
const SESSION_DAYS=30;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"";

function now(){return new Date()}
function ip(req){return String(req.ip||req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim().replace(/^::ffff:/,"")}
function todayVN(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date())}
function token(){return crypto.randomBytes(32).toString("hex")}
function fail(res,code,msg){return res.status(code).json({error:msg})}
async function init(){
 await sql`create table if not exists users(
  id uuid primary key default gen_random_uuid(), username text unique not null, password_hash text not null,
  banned boolean not null default false, ip text, avatar text not null default '', created_at timestamptz not null default now(), last_seen timestamptz not null default now())`;
 await sql`create table if not exists keys(
  id uuid primary key default gen_random_uuid(), key text not null, date date not null, limit_count integer not null default 999999,
  used integer not null default 0, active boolean not null default true, created_at timestamptz not null default now())`;
 await sql`create table if not exists banned_ips(ip text primary key, created_at timestamptz not null default now())`;
 await sql`create table if not exists messages(
  id bigserial primary key, user_id uuid references users(id) on delete set null, username text not null, avatar text not null default '',
  message text not null, created_at timestamptz not null default now())`;
 await sql`create table if not exists sessions(
  token text primary key, user_id uuid references users(id) on delete cascade, is_admin boolean not null default false,
  expires_at timestamptz not null)`;
 await sql`create index if not exists messages_created_idx on messages(created_at desc)`;
}

async function auth(req,res,next){
 const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!t)return fail(res,401,"Bạn chưa đăng nhập.");
 const rows=await sql`select s.token,s.is_admin,s.user_id,u.username,u.banned,u.avatar,u.ip from sessions s left join users u on u.id=s.user_id where s.token=${t} and s.expires_at>now() limit 1`;
 if(!rows.length)return fail(res,401,"Phiên đăng nhập hết hạn.");
 req.session=rows[0];if(!rows[0].is_admin&&rows[0].banned)return fail(res,403,"Tài khoản đã bị BAN.");
 if(!rows[0].is_admin&&await sql`select 1 from banned_ips where ip=${rows[0].ip} limit 1`.then(r=>r.length))return fail(res,403,"Thiết bị đã bị BAN IP.");
 next();
}
async function adminAuth(req,res,next){
 const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!t)return fail(res,401,"Chưa đăng nhập Admin.");
 const rows=await sql`select token from sessions where token=${t} and is_admin=true and expires_at>now() limit 1`;
 if(!rows.length)return fail(res,401,"Phiên Admin hết hạn.");req.adminToken=t;next();
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"UGPHONE MOD shared backend",time:Date.now()}));

app.post("/api/register",async(req,res)=>{
 try{const username=String(req.body.username||"").trim(),password=String(req.body.password||"");
 if(!/^[A-Za-z0-9_.-]{3,32}$/.test(username))return fail(res,400,"Tên tài khoản 3-32 ký tự, chỉ chữ, số, _, -, .");
 if(password.length<6)return fail(res,400,"Mật khẩu phải có ít nhất 6 ký tự.");
 const exists=await sql`select 1 from users where lower(username)=lower(${username}) limit 1`;if(exists.length)return fail(res,409,"Tài khoản đã tồn tại.");
 const hash=await bcrypt.hash(password,12),rows=await sql`insert into users(username,password_hash,ip) values(${username},${hash},${ip(req)}) returning id,username,banned,avatar,ip`;
 const t=token();await sql`insert into sessions(token,user_id,is_admin,expires_at) values(${t},${rows[0].id},false,now()+${SESSION_DAYS+" days"}::interval)`;
 res.json({token:t,user:rows[0]});
 }catch(e){console.error(e);fail(res,500,"Lỗi máy chủ khi tạo tài khoản.")}});

app.post("/api/login",async(req,res)=>{
 try{const username=String(req.body.username||"").trim(),password=String(req.body.password||"");const rows=await sql`select * from users where lower(username)=lower(${username}) limit 1`;
 if(!rows.length||!(await bcrypt.compare(password,rows[0].password_hash)))return fail(res,401,"Sai tài khoản hoặc mật khẩu.");
 const u=rows[0];if(u.banned)return fail(res,403,"Tài khoản đã bị BAN.");if((await sql`select 1 from banned_ips where ip=${ip(req)} limit 1`).length)return fail(res,403,"Thiết bị đã bị BAN IP.");
 await sql`update users set ip=${ip(req)},last_seen=now() where id=${u.id}`;const t=token();await sql`insert into sessions(token,user_id,expires_at) values(${t},${u.id},now()+${SESSION_DAYS+" days"}::interval)`;
 res.json({token:t,user:{id:u.id,username:u.username,banned:u.banned,avatar:u.avatar,ip:ip(req)}});
 }catch(e){console.error(e);fail(res,500,"Lỗi máy chủ khi đăng nhập.")}});

app.post("/api/logout",auth,async(req,res)=>{await sql`delete from sessions where token=${req.headers.authorization.replace(/^Bearer\s+/i,"")}`;res.json({ok:true})});
app.get("/api/me",auth,async(req,res)=>{await sql`update users set last_seen=now() where id=${req.session.user_id}`;res.json({user:{id:req.session.user_id,username:req.session.username,avatar:req.session.avatar,ip:req.session.ip,banned:req.session.banned}})});
app.get("/api/stats",async(req,res)=>{const u=await sql`select count(*)::int n from users`;const o=await sql`select count(*)::int n from users where last_seen>now()-interval '90 seconds' and banned=false`;const k=await sql`select count(*)::int n from keys`;res.json({users:u[0].n,online:o[0].n,keys:k[0].n})});

app.post("/api/keys/claim",auth,async(req,res)=>{
 try{await sql.begin(async tx=>{const d=todayVN();const rows=await tx`select * from keys where date=${d} and active=true and used<limit_count order by created_at asc limit 1 for update skip locked`;if(!rows.length)throw Object.assign(new Error("Hôm nay chưa có KEY."),{status:404});const k=rows[0];await tx`update keys set used=used+1 where id=${k.id}`;res.json({key:k.key,remaining:k.limit_count-k.used-1})})}catch(e){fail(res,e.status||500,e.status?e.message:"Lỗi máy chủ khi nhận KEY.")}});

app.get("/api/chat",auth,async(req,res)=>{const rows=await sql`select id,username,avatar,message,created_at from messages order by created_at desc limit 100`;res.json({messages:rows.reverse()})});
app.post("/api/chat",auth,async(req,res)=>{const message=String(req.body.message||"").trim();if(!message)return fail(res,400,"Tin nhắn trống.");if(message.length>500)return fail(res,400,"Tin nhắn tối đa 500 ký tự.");const r=await sql`insert into messages(user_id,username,avatar,message) values(${req.session.user_id},${req.session.username},${req.session.avatar||""},${message}) returning id,username,avatar,message,created_at`;await sql`delete from messages where id not in (select id from messages order by id desc limit 500)`;res.json({message:r[0]})});
app.post("/api/profile/avatar",auth,async(req,res)=>{const avatar=String(req.body.avatar||"");if(avatar.length>700000)return fail(res,400,"Ảnh quá lớn.");if(avatar&&!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar))return fail(res,400,"Ảnh không hợp lệ.");const r=await sql`update users set avatar=${avatar} where id=${req.session.user_id} returning id,username,banned,avatar,ip`;res.json({user:r[0]})});

app.post("/api/admin/login",async(req,res)=>{if(!ADMIN_PASSWORD)return fail(res,503,"Admin chưa được cấu hình ADMIN_PASSWORD trên server.");if(String(req.body.password||"")!==ADMIN_PASSWORD)return fail(res,401,"Sai mật khẩu Admin.");const t=token();await sql`insert into sessions(token,is_admin,expires_at) values(${t},true,now()+${SESSION_DAYS+" days"}::interval)`;res.json({token:t})});
app.post("/api/admin/logout",adminAuth,async(req,res)=>{await sql`delete from sessions where token=${req.adminToken}`;res.json({ok:true})});
app.get("/api/admin/state",adminAuth,async(req,res)=>{
 const users=await sql`select id,username,banned,ip,avatar,created_at,last_seen from users order by created_at desc`;
 const keys=await sql`select id,key,date,limit_count as "limit",used,active,created_at from keys order by date desc,created_at desc`;
 const messages=await sql`select id,username,avatar,message,created_at from messages order by created_at desc limit 100`;
 const online=users.filter(u=>new Date(u.last_seen).getTime()>Date.now()-90000&&!u.banned).length;
 res.json({users,keys,messages:messages.reverse(),stats:{users:users.length,online,banned:users.filter(u=>u.banned).length,keys:keys.length}});
});
app.post("/api/admin/keys",adminAuth,async(req,res)=>{const key=String(req.body.key||"").trim(),date=String(req.body.date||todayVN()),limit=Math.max(1,Number(req.body.limit||999999));if(!key)return fail(res,400,"Nhập KEY.");const r=await sql`insert into keys(key,date,limit_count) values(${key},${date},${limit}) returning id,key,date,limit_count as "limit",used,active`;res.json({key:r[0]})});
app.patch("/api/admin/keys/:id",adminAuth,async(req,res)=>{const r=await sql`update keys set active=not active where id=${req.params.id} returning id,active`;if(!r.length)return fail(res,404,"Không tìm thấy KEY.");res.json(r[0])});
app.patch("/api/admin/users/:id/ban",adminAuth,async(req,res)=>{const r=await sql`update users set banned=not banned where id=${req.params.id} returning id,username,banned`;if(!r.length)return fail(res,404,"Không tìm thấy tài khoản.");res.json(r[0])});
app.post("/api/admin/ips/ban",adminAuth,async(req,res)=>{const x=String(req.body.ip||"").trim();if(!x)return fail(res,400,"Thiếu IP.");await sql`insert into banned_ips(ip) values(${x}) on conflict do nothing`;res.json({ok:true})});
app.post("/api/admin/ips/unban",adminAuth,async(req,res)=>{const x=String(req.body.ip||"").trim();await sql`delete from banned_ips where ip=${x}`;res.json({ok:true})});

app.use((err,req,res,next)=>{console.error(err);if(err.message==="Origin not allowed")return res.status(403).json({error:"Origin không được phép. Kiểm tra ALLOWED_ORIGIN trên Render."});res.status(500).json({error:"Lỗi máy chủ."})});
init().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log("UGPHONE MOD backend listening on "+PORT))).catch(e=>{console.error("DB init failed",e);process.exit(1)});
