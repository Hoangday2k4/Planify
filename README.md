# 📅 Planify - Hệ Thống Quản Lý Lịch Biểu & Công Việc Fullstack

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org)
[![Database](https://img.shields.io/badge/database-PostgreSQL-blue.svg)](https://www.postgresql.org)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20Tailwind-teal.svg)](https://react.dev)

🔗 **Website chính thức:** [https://planify-frontend-nine.vercel.app](https://planify-frontend-nine.vercel.app)

**Planify** là một ứng dụng web giúp quản lý công việc và lịch biểu cá nhân/nhóm một cách trực quan, tối giản nhưng vô cùng mạnh mẽ. Dự án được tối ưu hóa khả năng chịu tải lớn và xử lý tác vụ bất đồng bộ thông qua các luồng chạy ngầm (background queue worker).

## 🚀 Các Tính Năng Nổi Bật

- 📅 **Lịch biểu thông minh:** Xem theo ngày/tuần/tháng, dời lịch kéo thả trực quan. Hỗ trợ sự kiện lặp lại (Hàng ngày, Hàng tuần, Hàng tháng,...).
- 🔔 **Hệ thống nhắc nhở đa kênh:** Nhắc nhở qua giao diện Web (Socket.io real-time) hoặc qua Email tự động (SMTP) trước thời điểm diễn ra sự kiện.
- 📋 **Quản lý công việc (Kanban & Lists):** Tạo dự án, công việc phụ (subtasks), thiết lập hạn chót (deadlines), hiển thị trạng thái và tính toán tiến độ tự động.
- 🔗 **Đồng bộ & Chia sẻ:** Xuất bản và chia sẻ lịch biểu công khai qua định dạng liên kết iCalendar feed tiêu chuẩn (đồng bộ trực tiếp sang Google Calendar).
- 🛡️ **Bảo mật & Tối ưu:** Đăng nhập mã hóa mật khẩu, avatar trực tiếp, hệ thống hàng đợi công việc chạy ngầm (Database Job Queue) tối ưu hóa CPU cho server.

## 🛠️ Tech Stack & Kiến Trúc

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide Icons, FullCalendar.
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, Socket.io, Node-cron.
- **Database:** PostgreSQL.
- **Background Jobs:** Hàng đợi SQLite/PostgreSQL queue worker tùy chỉnh.

## 📦 Hướng Dẫn Cài Đặt và Chạy Dự Án

### Yêu cầu hệ thống
* Node.js phiên bản >= 18
* PostgreSQL đang chạy cục bộ (cổng 5432)

### 1. Cấu hình Backend (`/server`)
Di chuyển vào thư mục server, tạo tệp `.env` dựa theo mẫu `.env.example`:
```env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/planify?schema=public"
JWT_SECRET="YOUR_JWT_SECRET"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
