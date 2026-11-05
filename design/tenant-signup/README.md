# Gói thiết kế "Đăng ký tenant và onboarding"

Prototype HTML/CSS tĩnh (không dựng máy chủ thật). Nguồn yêu cầu: `docs/ui-ux/tenant-signup-spec.md` (BA, bản đề xuất chưa được khách hàng xác nhận). Token và component dùng chung từ `design/assets` (không đổi). Mở bằng `file://` được.

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
| --- | --- | --- |
| `public/` | Nhóm A (TSU-01..07), B (TSU-08..13), C (TSU-14..18): đăng ký công khai, theo dõi, đăng nhập có mã công ty | Có (18 màn) |
| `platform-admin/` | Nhóm G (TSU-60..68): khung PlatformShell, duyệt đăng ký, cấu hình | Có (9 màn) |
| `onboarding/` | Nhóm D (TSU-20..31): wizard onboarding | Chỗ giữ cho agent khác, chưa có ở bản này |
| `account/` | Nhóm E (TSU-40..44) dashboard trial và gói; nhóm F (TSU-50..57) hạn chế, tạm ngưng, xuất dữ liệu, chấm dứt | Chỗ giữ cho agent khác, chưa có ở bản này |

Tệp dùng chung: `ts-common.js` (thanh "Xem thử trạng thái", kiểm tra biểu mẫu theo bảng V-* của spec, khóa nút kèm lý do, đếm lùi, tệp đính kèm, nháp), `public/ts-public.css` (tiền tố `tsp-`), `platform-admin/ts-admin.css` và `ts-admin.js` (tiền tố `tsa-`), `measure-overflow.js` (đo tràn ngang và lỗi JS bằng Playwright), `overflow-report-public.md` (kết quả đo).

## Cách xem

- Mỗi màn có thanh "Xem thử trạng thái (chỉ prototype)". Có thể vào thẳng trạng thái bằng `?state=<mã>` (mã là giá trị `data-ts-view` của nút).
- Các trạng thái chung có trên mọi màn phù hợp: `skel` (đang tải), `error` (lỗi máy chủ kèm mã REQ), `offline` (mất mạng, giữ dữ liệu đã nhập), `r429` (bị giới hạn, đếm lùi).
- Giá trị thử: TSU-14 mật khẩu `sai` báo sai thông tin, `khoa` khóa tạm, `dieukhoan` sang TSU-18; TSU-60 tương tự (`sai`, `khoa`).
- Kiểm tra người thật, đối chiếu MST, gửi email, đếm hạn mức đều là mô phỏng. Nháp đăng ký lưu ở `localStorage` của trình duyệt và không lưu mật khẩu.

## Mục lục màn hình

### Nhóm A: đăng ký công khai (`public/`)

| Mã | Tệp | Màn hình | Trạng thái xem thử chính |
| --- | --- | --- | --- |
| TSU-01 | `tsu-01.html` | Giới thiệu và chọn gói dùng thử | mở đăng ký, đóng đăng ký, trần ngày đã đạt (xếp hàng), tải, lỗi, mất mạng |
| TSU-02 | `tsu-02.html` | Bước 1: doanh nghiệp và MST | trống, lỗi MST, lỗi nhiều trường, có bản nháp, đã điền đủ |
| TSU-03 | `tsu-03.html` | Bước 2: người sở hữu, email, mật khẩu | trống, mật khẩu yếu, email dùng một lần, mật khẩu không khớp, đã điền đủ |
| TSU-04 | `tsu-04.html` | Bước 3: điều khoản, DPA, kiểm tra người thật, gửi | chưa tích, đủ điều kiện gửi, đang gửi, lỗi kiểm tra người thật, phiên bản điều khoản đổi, đóng đăng ký, 429 |
| TSU-05 | `tsu-05.html` | Đã gửi, kiểm tra email | bình thường, xếp hàng, đang đếm lùi, đã gửi lại quá nhiều, 429 |
| TSU-06 | `tsu-06.html` | Kết quả xác thực email | thành công, hết hạn, đã dùng, không hợp lệ, bị giới hạn, quá hạn đăng ký |
| TSU-07 | `tsu-07.html` | Gửi lại liên kết xác thực | bình thường, điền sẵn email, đang gửi, lỗi kiểm tra người thật, 429 |

### Nhóm B: theo dõi đăng ký (`public/`)

| Mã | Tệp | Màn hình | Trạng thái xem thử chính |
| --- | --- | --- | --- |
| TSU-08 | `tsu-08.html` | Theo dõi đăng ký | xác minh tự động, chờ duyệt, cần bổ sung, bị từ chối, đang cấp phát, liên kết không hợp lệ |
| TSU-09 | `tsu-09.html` | Cần bổ sung thông tin | thiếu tệp bắt buộc, đủ yêu cầu, đang tải tệp, lỗi tệp, quá hạn bổ sung |
| TSU-10 | `tsu-10.html` | Bị từ chối | lý do MST, lý do chung, đã khiếu nại, hết lượt khiếu nại |
| TSU-11 | `tsu-11.html` | Khiếu nại kết quả | trống, giải trình quá ngắn, đang gửi, thành công |
| TSU-12 | `tsu-12.html` | Đang cấp phát tài khoản | đang chạy, chậm hơn dự kiến, hoàn thành |
| TSU-13 | `tsu-13.html` | Sẵn sàng: mã công ty | bình thường, đã gửi lại email chào mừng |

### Nhóm C: đăng nhập có mã công ty (`public/`)

| Mã | Tệp | Màn hình | Trạng thái xem thử chính |
| --- | --- | --- | --- |
| TSU-14 | `tsu-14.html` | Đăng nhập có mã công ty | mặc định, đã nhớ mã công ty, sai thông tin, khóa tạm, hết phiên, đăng nhập đúng (rẽ nhánh) |
| TSU-15 | `tsu-15.html` | Quên mật khẩu có mã công ty | bình thường, đã gửi (phản hồi trung lập), lỗi kiểm tra người thật |
| TSU-16 | `tsu-16.html` | Đặt lại mật khẩu | liên kết hợp lệ, mật khẩu yếu, thành công, hết hạn, đã dùng |
| TSU-17 | `tsu-17.html` | Quên mã công ty | bình thường, đã gửi (phản hồi trung lập), lỗi kiểm tra người thật |
| TSU-18 | `tsu-18.html` | Chấp nhận điều khoản và DPA mới | còn ân hạn, hết ân hạn, không phải chủ garage, đang lưu, đã chấp nhận ở thiết bị khác |

### Nhóm D: wizard onboarding (`onboarding/`)

Chỗ giữ: TSU-20..31 do agent khác dựng tại `design/tenant-signup/onboarding/`. TSU-14 và TSU-13 trỏ tới thư mục này sau khi đăng nhập đúng.

### Nhóm E và F: dashboard trial, gói, trạng thái hạn chế (`account/`)

Chỗ giữ: TSU-40..44 và TSU-50..57 do agent khác dựng tại `design/tenant-signup/account/`. TSU-14 trỏ tới thư mục này cho trường hợp tạm ngưng và đang chấm dứt.

### Nhóm G: quản trị nền tảng (`platform-admin/`)

| Mã | Tệp | Màn hình | Trạng thái xem thử chính |
| --- | --- | --- | --- |
| TSU-60 | `tsu-60.html` | Đăng nhập quản trị nền tảng | mặc định, sai thông tin, khóa tạm, đang xử lý |
| TSU-61 | `tsu-61.html` | Hàng đợi đăng ký | có ca, trống, quá hạn xử lý, gần trần ngày, trống do lọc, chỉ xem |
| TSU-62 | `tsu-62.html` | Chi tiết hồ sơ và quyết định | bình thường, MST trùng, đối chiếu không khớp, 409, QTN, HTN chỉ xem |
| TSU-63 | `tsu-63.html` | Hộp thoại quyết định (xem tĩnh) | duyệt, duyệt MST trùng, yêu cầu bổ sung, từ chối, 409 |
| TSU-64 | `tsu-64.html` | Hàng đợi khiếu nại | có khiếu nại, trống, đã trả lời, chỉ xem |
| TSU-65 | `tsu-65.html` | Hàng đợi lỗi cấp phát | có cả tự thử lại và cần nhân sự, chỉ cần nhân sự, trống |
| TSU-66 | `tsu-66.html` | Cấu hình đăng ký | sửa, xem, lỗi giá trị, xác nhận đổi |
| TSU-67 | `tsu-67.html` | Điều khoản dịch vụ và DPA | danh sách, trống, tạo bản mới, xác nhận hiệu lực |
| TSU-68 | `tsu-68.html` | Danh mục gói | B0, B1, sửa gói, ngừng cung cấp |

## Quy ước thiết kế đã áp dụng

- Trang công khai theo biến thể P (không shell, mobile-first); quản trị nền tảng có khung riêng (thanh trên tối trung tính, nhãn cố định, không bộ chọn chi nhánh, dải "Màn này không hiển thị dữ liệu nghiệp vụ của garage").
- Phản hồi trung lập ở đăng ký, đăng nhập, quên mật khẩu, quên mã công ty, gửi lại liên kết: cùng câu chữ cho trường hợp tồn tại và không tồn tại.
- Số liệu do máy chủ quyết (thời hạn liên kết, số lần thử, đếm lùi, hạn bổ sung, thời lượng dùng thử, trần ngày) chỉ là số minh họa, ghi "(minh họa)" hoặc "cấu hình".
- Mục `[Cần xác nhận]` hiện bằng khối "Giữ chỗ cấu hình" nét đứt, không hard-code nội dung pháp lý hay giá. Văn bản điều khoản, DPA, chính sách quyền riêng tư là chỗ giữ "[Nội dung do luật sư soạn]".
- Khóa nút luôn kèm lý do hiện sẵn; gửi có chống bấm đúp; mất mạng giữ dữ liệu đã nhập; mật khẩu không lưu vào nháp.
- A11y: nhãn cho mọi trường, lỗi theo trường có `aria-invalid` và `aria-describedby`, tóm tắt lỗi `role="alert"` và đưa focus vào lỗi đầu, mọi trạng thái có chữ (không chỉ màu), vùng bấm tối thiểu 44 px trên cảm ứng (do components.css), có phương án thay thế cho kiểm tra người thật (mã qua email), honeypot ẩn khỏi người dùng và trình đọc màn hình.

## Đo tràn ngang và lỗi JS

`node design/tenant-signup/measure-overflow.js` (xem đầu tệp). Kết quả ghi ở `overflow-report-public.md`.
