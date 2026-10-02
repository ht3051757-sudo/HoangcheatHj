# UGPHONE MOD — SHARED ONLINE

Bản này **không dùng localStorage làm database** nữa.

- GitHub Pages: chạy `index.html`, `style.css`, `app.js`.
- Render: chạy `server.js` làm API backend.
- Supabase: cung cấp PostgreSQL để lưu tài khoản, KEY, chat, ban.
- Vì dữ liệu nằm trên database online, Admin thêm KEY trên máy A thì máy B/C cũng thấy.

## 1) Tạo database Supabase

Tạo một project Supabase mới, vào phần **Connect** và lấy PostgreSQL connection string. Supabase hướng dẫn lấy connection string từ Connect; với backend Node chạy lâu dài có thể dùng kết nối PostgreSQL phù hợp. 

Bạn không cần tạo bảng thủ công: `server.js` tự tạo các bảng khi khởi động lần đầu.

## 2) Đưa backend lên Render

Đưa `server.js` và `package.json` lên một repo GitHub (có thể dùng repo riêng, không bắt buộc chung repo Pages).

Trên Render chọn **New → Web Service**.
- Language: Node
- Build Command: `npm install`
- Start Command: `npm start`

Render Web Service chạy được Express/Node và phải bind port `0.0.0.0`; code này đã làm sẵn. 

### Environment Variables trên Render

Thêm:

`DATABASE_URL` = PostgreSQL connection string lấy từ Supabase

`ADMIN_PASSWORD` = `UGP!H0ANG#2026$MOD`

`ALLOWED_ORIGIN` = `https://ht3051757-sudo.github.io`

Sau khi lưu biến môi trường, Render deploy lại service. Không đưa `DATABASE_URL` hoặc mật khẩu Admin vào file JavaScript frontend. Render hỗ trợ lưu secret bằng Environment Variables. 

Sau deploy bạn sẽ có URL kiểu:

`https://ten-service-cua-ban.onrender.com`

Test:

`https://ten-service-cua-ban.onrender.com/api/health`

Nếu trả JSON có `"ok":true` là backend chạy.

## 3) Nối GitHub Pages với backend

Mở `app.js`, dòng đầu có:

`const API_URL=(window.UG_API_URL||"https://YOUR-UGPHONE-BACKEND.onrender.com/api")...`

Thay `https://YOUR-UGPHONE-BACKEND.onrender.com/api` bằng URL Render thật của bạn, ví dụ:

`https://ugphone-mod-backend.onrender.com/api`

Sau đó upload/commit các file frontend vào repo GitHub Pages.

## 4) Kiểm tra

1. Máy A đăng ký tài khoản.
2. Admin đăng nhập.
3. Admin thêm KEY.
4. Máy B mở lại trang → KEY đó được đọc từ database chung.
5. Máy A/B đăng nhập tài khoản khác nhau → vẫn dùng chung danh sách KEY.
6. Chat cũng là chat chung.
7. BAN user/IP được lưu server.

## Lưu ý quan trọng

GitHub Pages một mình **không thể** làm phần database/server. Bản cũ dùng `localStorage`, nên mỗi máy có dữ liệu riêng. Bản này đã tách backend để giải quyết đúng vấn đề đó.

Mật khẩu Admin hiện được đọc từ biến `ADMIN_PASSWORD` trên Render, không hardcode trong `app.js`. Hãy giữ `DATABASE_URL` và các secret trong Environment Variables, không commit chúng vào GitHub.
