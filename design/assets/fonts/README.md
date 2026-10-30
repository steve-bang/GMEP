# Phông Be Vietnam Pro (tự host)

Giấy phép: SIL Open Font License 1.1 (cho phép tự host và nhúng).

Cần 4 file WOFF2, subset latin + latin-ext + vietnamese, đặt tên chính xác:

- `BeVietnamPro-Regular.woff2` (400)
- `BeVietnamPro-Medium.woff2` (500)
- `BeVietnamPro-SemiBold.woff2` (600)
- `BeVietnamPro-Bold.woff2` (700)

Trạng thái: CHƯA CÓ file. Môi trường tạo prototype không có mạng nên không tải được. Khai báo `@font-face` trong `../base.css` đã trỏ sẵn tới các tên trên, `font-display: swap`, và thử font cài sẵn trên máy (`local()`) trước. Khi chưa có file, trang dùng font hệ thống (system-ui / Segoe UI / Roboto).

Cách lấy: tải bộ font Be Vietnam Pro từ nguồn phát hành chính thức (tải file về kho, không nhúng link ngoài), chuyển TTF sang WOFF2 (ví dụ `pyftsubset` / `woff2_compress`), subset gồm bảng Unicode Latin, Latin Extended-A/B, Latin Extended Additional (U+1E00–1EFF, chứa chữ có dấu tiếng Việt), kiểm tra hiển thị "Ắ Ằ Ẳ Ẵ Ặ" ở `foundation/index.html`.
