# Ảnh chụp màn hình các phần dev đã làm

67 ảnh chụp từ bản build thật chạy trên Firebase Emulator Suite (chưa có GCP project), ngày 04/11/2026.
Dữ liệu demo là dữ liệu mẫu (seed cơ bản + dữ liệu tạo qua chính API: báo giá nháp/đã gửi/đã duyệt,
lệnh đang sửa, chờ phân thợ, sẵn sàng giao, đã giao và đã thu tiền, hóa đơn đã phát hành, rollup báo cáo ngày).

Chụp lại: `pnpm build`, rồi
`PLAYWRIGHT_CHROMIUM_PATH=<chromium> pnpm exec firebase emulators:exec --only firestore,auth,storage --project demo-gmep "pnpm exec tsx --tsconfig tsconfig.json scripts/seed-emulator.ts && pnpm exec playwright test -c scripts/screenshots/playwright.config.ts"`.

| Thư mục | Nội dung |
| --- | --- |
| `00-auth` | Đăng nhập, quên mật khẩu |
| `01-shell` | Tổng quan, thông báo, phê duyệt |
| `02-sys` | Người dùng, chi nhánh, kho, dịch vụ, bảng giá, cấu hình, nhật ký kiểm toán |
| `03-rec` | Bảng điều phối, tiếp nhận, báo giá (nháp/đã gửi/đã duyệt/in), link khách duyệt, lệnh sửa chữa, QC, bàn giao, yêu cầu phụ tùng, màn hình thợ (tablet) |
| `04-crm` | Khách hàng, xe, tra cứu, yêu cầu dữ liệu, xuất dữ liệu |
| `05-inv` | Phụ tùng, tồn kho, cảnh báo đặt hàng, phiếu kho |
| `06-acc` | Phiếu thu chi, sổ quỹ, chốt ca, chốt ngày, công nợ, công nợ theo lệnh |
| `07-ein` | Hóa đơn điện tử: danh sách, chi tiết, kiểm tra phát hành, hàng đợi lỗi, cảnh báo, kết nối |
| `08-rpt` | Dashboard, báo cáo ngày, drill-down, cảnh báo ngoại lệ, góc nhìn thu ngân |
| `09-mobile` | Màn hình điện thoại (390 px) |

Ghi chú: ảnh full-page nên thanh bên trái bị cắt ở chiều cao cửa sổ; đó là do cách chụp, không phải lỗi giao diện.
