# UI/UX – Gói G1: Xác thực và Dashboard theo vai trò

Trạng thái: đang thực hiện (giai đoạn 1: kế hoạch). Tài liệu này sẽ được hoàn thiện ở giai đoạn 4.

## 0. Kế hoạch (giai đoạn 1)

Phạm vi: 31 màn hình của `screen-inventory.md` §2 (G1-SHL 2, AUT 10, ERR 5, DSH 10, NTF 2, PRF 2). Thư mục sản phẩm `design/g1-auth-dashboard/`, tiền tố class `g1-`. Dùng `design/assets/*` nguyên trạng; style bổ sung nằm ở `pack.css`.

Cách dựng để giữ file gọn và nhất quán (không có công cụ build, mở bằng `file://`):
- `g1-shell.js` dựng Application Shell chuẩn (sidebar, topbar, branch selector 3 cấp, chuông thông báo, menu tài khoản, banner phạm vi RULE-015, bottom nav) cho mọi trang có `data-g1-shell`, rồi `app.js` chạy như cũ (menu theo vai trò, phạm vi chi nhánh). Trang xác thực và lỗi không dùng shell.
- `g1-charts.js` vẽ biểu đồ SVG thuần (đường, cột/thanh nhóm hoặc xếp chồng) từ JSON trong trang: có tên + đơn vị, tooltip (chuột, focus, phím mũi tên), bảng số liệu thay thế, legend có chữ. Đồng thời xử lý bộ lọc thời gian, bộ chuyển trạng thái thẻ (loading, rỗng, lỗi từng thẻ, không quyền, dữ liệu cũ, mất mạng).
- `g1-auth.js` xử lý biểu mẫu xác thực giả lập, bộ chuyển trạng thái (`?state=...`), PIN pad, đếm lùi.

Thứ tự làm: (2) shell + dashboard + đăng nhập/MFA/chọn chi nhánh; (3) các màn hình còn lại (kích hoạt, quên mật khẩu, lỗi, thông báo, hồ sơ); (4) index, tài liệu, tự review.
