# UGPHONE MOD — GitHub Pages + Supabase (shared)

Bản này KHÔNG dùng Render/Node server. GitHub Pages chỉ phục vụ giao diện; Supabase là database + Auth + Realtime.

## 1) Tạo Supabase
1. Tạo project trên Supabase.
2. Vào SQL Editor và chạy toàn bộ `supabase_schema.sql`.
3. Vào Authentication → Providers → Email. Nếu muốn đăng ký dùng ngay không cần xác nhận, tắt Confirm email; nếu để bật thì người dùng phải xác nhận email.
4. Vào Project Settings → API, lấy Project URL và anon/public key.
5. Mở `config.js` và điền:
   - `UG_SUPABASE_URL`
   - `UG_SUPABASE_ANON_KEY`

## 2) Tạo Admin
- Đăng ký một tài khoản bình thường bằng email/mật khẩu trên web.
- Trong Supabase SQL Editor chạy:
  `update public.profiles set role='admin' where username='TEN_ADMIN';`
- Sau đó vào mục ADMIN và đăng nhập bằng email + mật khẩu của tài khoản đó.

## 3) Đưa lên GitHub Pages
Chỉ cần upload `index.html`, `style.css`, `app.js`, `config.js` và `supabase_schema.sql` lên repo/branch dùng GitHub Pages. `server.js`, `package.json`, `.env.example` không còn cần thiết.

## 4) Dữ liệu dùng chung
- Chat: insert vào `messages`, Supabase Realtime phát tới mọi máy.
- KEY: lưu trong `keys`, Admin thêm/tắt KEY thì mọi máy đọc cùng database.
- BAN: lưu trong `profiles.banned`; client đang đăng nhập bị BAN sẽ nhận realtime và đăng xuất.
- Server ON/OFF: lưu trong `server_state`, mọi máy nhận thay đổi realtime.
- Tài khoản: Supabase Auth + `profiles`.

## Lưu ý bảo mật
- Chỉ đưa **anon/public key** vào `config.js`. Không đưa `service_role` key vào GitHub.
- Quyền Admin được kiểm tra bằng `role` trong database/RLS; không đặt mật khẩu Admin trong JavaScript.
- Bản GitHub Pages này không thể tự chạy nếu chưa điền Supabase URL/key và chưa chạy SQL schema.
