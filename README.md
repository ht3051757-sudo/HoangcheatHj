# UGPHONE MOD — Auth + Global Broadcast

## Deploy chắc chắn nhất

### Cách 1: Deploy toàn bộ thư mục `ug/` lên Render
- Build/Install: `npm install`
- Start: `npm start`
- Environment:
  - `DATABASE_URL` = PostgreSQL connection string
  - `ADMIN_PASSWORD` = mật khẩu admin
  - `ALLOWED_ORIGIN` có thể để trống khi frontend và backend cùng domain
- Sau khi chạy, mở chính URL Render. Frontend sẽ tự dùng `/api`.

### Cách 2: GitHub Pages frontend + Render backend
Trong `config.js` đặt:
`window.UG_API_URL = "https://TEN-SERVICE.onrender.com/api";`
Và Render đặt:
`ALLOWED_ORIGIN=https://TEN-USERNAME.github.io`

## Kiểm tra
Mở `/api/health`. Kết quả thành công phải có:
`{"ok":true,"database":"ok",...}`

Đăng ký tạo tài khoản và đăng nhập dùng bcrypt + PostgreSQL.
Ban tài khoản theo user ID không tự ban tài khoản khác; ban IP là cơ chế riêng.
Admin broadcast được lưu vào `messages` và phát realtime qua WebSocket `/ws`.


## Server maintenance controls

Admin panel can set:
- `🔩 Đóng server` → `maintenance`
- `♻️ Đang reset server` → `resetting`
- `🌙 Server đang nghỉ` → `resting`
- `▶️ Mở server` → `normal`

The state is stored in PostgreSQL, so all users see the same state. A public
`/api/server-status` endpoint is polled by the frontend. Normal API operations
return HTTP 503 while the server is not `normal`, while status/health and admin
status controls remain available.


## Verification

Đã kiểm tra tĩnh source và syntax Node.js cho các phần đăng ký, đăng nhập, WebSocket/global chat, admin, maintenance. Runtime PostgreSQL/Render cần kiểm tra sau khi deploy vì ZIP không chứa server/database đang chạy.


## Final deployment check

**Nếu dùng GitHub Pages cho frontend:** `config.js` phải chứa URL Render thật, ví dụ:
`window.UG_API_URL = "https://TEN-SERVICE.onrender.com/api";`

**Nếu deploy cả thư mục `ug/` lên Render:** để `window.UG_API_URL = "/api"`.

Mọi API response không phải JSON giờ sẽ báo lỗi cấu hình API rõ ràng thay vì `Unexpected token '<'`.
Mỗi tài khoản chỉ nhận một KEY trong một ngày VN; KEY của ngày đó được lưu trong `key_claims`.


## Admin key
Set `ADMIN_KEY` in the Render Environment Variables. The key is intentionally not embedded in frontend source. Use the value you choose in your private server environment.


### GitHub Pages fix
Khi mở frontend trên GitHub Pages, app tự hiện hộp **Kết nối Backend** nếu chưa có URL Render. Nhập `https://TEN-SERVICE.onrender.com/api` một lần. URL được lưu trong localStorage.
Giới hạn đăng ký: tối đa 150 tài khoản.
Admin login chấp nhận `ADMIN_PASSWORD` hoặc `ADMIN_KEY` trên Render.


## Single-origin deployment

Bản này không dùng GitHub Pages làm frontend riêng. Node/Express phục vụ luôn `index.html`, CSS, JS và `/api` trên cùng một origin, nên không có popup nhập URL Render và không cần `UG_API_URL` trỏ sang domain khác.

Deploy toàn bộ thư mục `ug` lên một Node host (Render/Railway/VPS/etc.), đặt `DATABASE_URL`, `ADMIN_KEY` và các biến môi trường cần thiết, rồi mở chính URL của service đó.
