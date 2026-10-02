# UGPHONE MOD — Daily Key System

Bản này đã sửa lỗi dữ liệu chỉ nằm trên `localStorage`.

## Đã thay đổi

- Đổi thương hiệu giao diện từ **AURA** thành **UGPHONE MOD**.
- Nút chính thành **NHẬN KEY UGPHONE MOD HÔM NAY**.
- Tài khoản được lưu ở server, nên máy A tạo tài khoản thì máy B vào Admin cũng thấy.
- KEY được lưu ở server, nên Admin thêm KEY trên một máy thì máy khác dùng cùng website cũng thấy.
- Hoạt động online được cập nhật theo heartbeat 15 giây và Admin xem được `Hoạt động cuối`.
- BAN/GỠ BAN và trạng thái KEY được đồng bộ qua server.
- Mật khẩu tài khoản không còn lưu plaintext trong trình duyệt; server lưu SHA-256 hash.
- Admin token có thời hạn 24 giờ.
- Dữ liệu demo nằm trong `data/db.json`.

## Chạy

Cần Node.js 18+.

Linux/macOS:
```bash
export ADMIN_PASSWORD='mat-khau-admin-rat-manh'
npm start
```

Windows PowerShell:
```powershell
$env:ADMIN_PASSWORD="mat-khau-admin-rat-manh"
npm start
```

Mở:
`http://localhost:3000`

## Cho máy khác truy cập

Server phải chạy trên máy/server có IP mà các máy khác truy cập được, ví dụ:
`http://IP-MAY-CHAY-SERVER:3000`

Không dùng `localhost` trên máy client khác.

## Lưu ý production

Đây là bản backend nhỏ gọn để thay thế demo localStorage. Nếu public Internet, nên đặt sau HTTPS/reverse proxy, dùng database thật, rate-limit login/API, session store bền vững và secret quản lý bằng environment/secret manager. Không commit mật khẩu Admin vào Git.


## BAN IP

Trong Admin, mỗi tài khoản có hai nút:

- **BAN**: chỉ khóa tài khoản đó.
- **BAN IP**: thêm IP của thiết bị vào danh sách cấm. Mọi tài khoản đăng nhập/đăng ký/heartbeat/nhận KEY từ IP đó sẽ bị chặn.

Admin có thể **GỠ BAN IP** trong danh sách IP đã ban.

IP được lấy từ kết nối TCP trực tiếp (`req.socket.remoteAddress`). Nếu triển khai sau Nginx/Cloudflare/reverse proxy, cần cấu hình trusted proxy trước khi dùng `X-Forwarded-For`; bản này cố ý không tin header đó mặc định để tránh client tự giả mạo IP.


## Chat

Đã thêm phòng **CHAT UGPHONE MOD** dùng chung backend:

- Người dùng đăng nhập mới gửi được tin nhắn.
- Tin nhắn được lưu trên server, nên các máy khác cùng hệ thống thấy được.
- Tối đa 500 ký tự/tin nhắn.
- Admin xem được chat gần đây trong bảng quản trị.
- Polling 2.5 giây để cập nhật tin nhắn mà không cần WebSocket.
- IP BAN cũng áp dụng cho chat.


## Avatar

- Vào **TÀI KHOẢN** sau khi đăng nhập.
- Chọn ảnh trực tiếp từ thiết bị bằng nút chọn file.
- Hỗ trợ PNG/JPG/WebP/GIF, tối đa 1 MB ở giao diện.
- Avatar được lưu trên server cùng tài khoản và hiển thị trong chat/Admin.


## Mật khẩu Admin mặc định

Nếu chưa đặt biến môi trường `ADMIN_PASSWORD`, mật khẩu Admin mặc định là `admin123`. Có thể đổi bằng biến môi trường `ADMIN_PASSWORD`.

**Không mở `index.html` trực tiếp bằng file://.** Hãy chạy `npm start` rồi mở `http://localhost:3000`.
