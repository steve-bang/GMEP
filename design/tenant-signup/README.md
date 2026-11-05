# Gói thiết kế "Đăng ký tenant và onboarding" (bản tối giản, garage một chi nhánh một kho)

Prototype HTML/CSS tĩnh (không dựng máy chủ thật). Nguồn yêu cầu chính: `docs/ui-ux/tenant-signup-simplified.md` (BA, v0.1, đề xuất, chưa được khách hàng xác nhận). Chi tiết trường, kiểm tra giá trị và câu lỗi (V-EMAIL, V-PHONE, V-MST, V-PASS, V-NAME, V-ORG, V-CODE, V-REQ, V-FILE) giữ từ `docs/ui-ux/tenant-signup-spec.md` v0.2. Token và component dùng chung từ `design/assets` (không đổi). Mở bằng `file://` được.

Bản này thay bản 52 màn (TSU-01..68) bằng **18 màn**: 11 giữ mã TSU cũ, 7 mã mới TSX. Màn gộp hoặc hoãn nằm trong `_deferred/` (mục cuối).

## Cấu trúc

| Thư mục | Nội dung | Số màn |
| --- | --- | --- |
| `public/` | Đăng ký một trang, kiểm tra email, tiến trình; đăng nhập có mã công ty, quên mật khẩu hoặc mã công ty, đặt lại mật khẩu | 6 |
| `platform-admin/` | Đăng nhập quản trị nền tảng, hàng đợi ca bị cờ (master-detail), cấu hình đăng ký rút gọn | 3 |
| `onboarding/` | Xác nhận garage và bắt đầu dùng (TSX-10), thiết lập nhanh (TSX-11), Thiết lập dần (TSX-20) | 3 (designer khác phụ trách) |
| `account/` | Gói của tôi, banner, hộp thoại chặn, tạm ngưng, xuất dữ liệu, chấm dứt (TSU-41, 50, 51, 53, 55, 56) | 6 (designer khác phụ trách) |
| `_deferred/` | Màn bị bỏ, gộp hoặc hoãn; xem cuối tệp | không tính |

Tệp dùng chung: `ts-common.js` (nút "Xem thử", kiểm tra biểu mẫu theo bảng V-*, khóa nút kèm lý do, đếm lùi, tệp đính kèm, kiểm tra người thật, nháp trình duyệt), `public/ts-public.css` (tiền tố `tsp-`), `platform-admin/ts-admin.css` và `ts-admin.js` (tiền tố `tsa-` và `tsx-`), `measure-overflow.js` (đo tràn ngang và lỗi JS bằng Playwright), `overflow-report-public.md` (kết quả đo; cập nhật khi đo lại).

## Cách xem

- Mỗi màn có nút **"Xem thử"** (thanh "Xem thử trạng thái", chỉ prototype). Trên điện thoại (<= 639 px) bảng chọn trạng thái thu gọn mặc định; bấm "Xem thử" để mở. Nhãn chỉ dùng chữ tiếng Việt, không lộ khóa kỹ thuật.
- Vào thẳng một trạng thái bằng `?state=<mã>` (mã là giá trị `data-ts-view` của nút).
- Trạng thái chung có trên mọi màn phù hợp: đang tải, lỗi máy chủ kèm mã REQ, mất mạng (giữ dữ liệu đã nhập), quá nhiều lần thử (đếm lùi).
- Giá trị thử: TSU-14 và TSU-60, mật khẩu `sai` báo sai thông tin, `khoa` khóa tạm.
- Kiểm tra người thật, đối chiếu MST, gửi email, đếm hạn mức đều là mô phỏng. Nháp đăng ký lưu ở `localStorage` của trình duyệt và không lưu mật khẩu.

## Mục lục 18 màn

### Đăng ký và đăng nhập công khai (`public/`)

| Mã | Tệp | Màn hình | Thay thế | Trạng thái xem thử chính |
| --- | --- | --- | --- | --- |
| TSX-01 | `tsx-01.html` | Đăng ký dùng thử một trang: 5 trường nhập, 2 ô đồng ý Điều khoản và DPA tách riêng, kiểm tra người thật. Loại hình suy ra từ độ dài MST. Không nhập lại mật khẩu | TSU-01..04 | mặc định, lỗi nhiều trường, có bản nháp, đã điền đủ, đang gửi, lỗi kiểm tra người thật, điều khoản đổi, truy cập sớm, đóng đăng ký |
| TSX-02 | `tsx-02.html` | Kiểm tra email, gửi lại ngay trên màn | TSU-05, 07 | bình thường, vừa gửi lại (đếm lùi), gửi lại quá nhiều, xếp hàng |
| TSX-03 | `tsx-03.html` | Xác thực và tiến trình, một màn nhiều trạng thái, dải 3 chặng | TSU-06, 08, 09, 10, 12, 13 | đang kiểm tra, sẵn sàng (cùng và khác trình duyệt), chờ duyệt, cần bổ sung (có tải tệp), không đạt, đang tạo chậm, liên kết hết hạn, liên kết không dùng được, yêu cầu quá hạn |
| TSU-14 | `tsu-14.html` | Đăng nhập có mã công ty; nhớ mã công ty, nút "Đổi công ty"; rẽ nhánh sau đăng nhập | giữ, chỉnh | mặc định, đã nhớ mã công ty, sai thông tin, khóa tạm, hết phiên, đăng nhập đúng (rẽ nhánh) |
| TSU-15 | `tsu-15.html` | Quên mật khẩu hoặc mã công ty (hai thẻ) | TSU-15, 17 | quên mật khẩu, quên mã công ty, đã gửi (trung lập), lỗi kiểm tra người thật, đang gửi |
| TSU-16 | `tsu-16.html` | Đặt lại mật khẩu | giữ | liên kết hợp lệ, mật khẩu yếu, đang lưu, thành công, hết hạn, đã dùng |

### Quản trị nền tảng (`platform-admin/`)

| Mã | Tệp | Màn hình | Thay thế | Trạng thái xem thử chính |
| --- | --- | --- | --- | --- |
| TSU-60 | `tsu-60.html` | Đăng nhập quản trị nền tảng (khe xác thực mạnh để trống, C-14) | giữ | mặc định, sai thông tin, khóa tạm, đang xử lý |
| TSX-30 | `tsx-30.html` | Hàng đợi ca bị cờ và hồ sơ: danh sách bên trái, hồ sơ bên phải; dưới 1280 px đổi qua lại hai ngăn. Ba nhóm: Cần xử lý, Lỗi cấp phát, Đã xử lý 7 ngày. Quyết định là hộp thoại trong màn | TSU-61..65 | có ca, trống, trống do lọc, đã đạt trần ngày, mở hồ sơ, MST trùng, đối chiếu không khớp, đã có người xử lý (409), quản trị nền tảng, hỗ trợ chỉ xem |
| TSU-66 | `tsu-66.html` | Cấu hình đăng ký, 7 thẻ: mở/đóng và trần ngày, xác thực email, MST và tự duyệt, chống lạm dụng, dùng thử, danh mục lý do (accordion), dịch vụ mẫu. Mỗi thẻ ngắn | giữ, rút gọn | sửa, xem (chỉ đọc), lỗi giá trị, xác nhận mở hoặc đóng đăng ký |

### Trong ứng dụng (`onboarding/`, `account/`, designer khác phụ trách)

TSX-10, TSX-11, TSX-20, TSU-41, TSU-50, TSU-51, TSU-53, TSU-55, TSU-56. Các màn này không thuộc lượt dựng lại này của phía công khai và quản trị nền tảng; liên kết từ `public/` tới chúng dùng `onboarding/tsx-10.html` (giả định đường dẫn), `account/tsu-53.html`, `account/tsu-56.html`.

## Quy ước thiết kế đã áp dụng

- Trang công khai theo biến thể P (không shell, mobile-first); quản trị nền tảng có khung riêng (thanh trên tối trung tính, nhãn cố định, không bộ chọn chi nhánh, dải "Màn này không hiển thị dữ liệu nghiệp vụ của garage").
- **Phản hồi trung lập** (RULE-032): đăng ký mới, trùng email và trùng MST cùng đi tới TSX-02, cùng chữ; TSX-03 `chờ duyệt` không nêu lý do gắn cờ; quên mật khẩu hoặc mã công ty cùng một câu cho mọi kết quả.
- **Quy tắc khóa nút** (một quy tắc, thay QĐT-24): nút khóa dùng `aria-disabled="true"`, vẫn focus được, `aria-describedby` trỏ tới lý do hiện sẵn, bấm chỉ đưa focus tới lý do, không dùng thuộc tính `disabled`. Lý do khóa cụ thể, ví dụ "Chưa thể gửi: còn thiếu mã số thuế, email".
- Số liệu do máy chủ quyết (thời hạn liên kết, đếm lùi, số ngày dùng thử, trần ngày, hạn bổ sung) chỉ là số minh họa, ghi "(minh họa)" hoặc "cấu hình".
- Mục `[Cần xác nhận]` hiện bằng khối "Giữ chỗ cấu hình" nét đứt, không hard-code nội dung pháp lý hay giá. Văn bản điều khoản, DPA, chính sách lưu trữ là chỗ giữ "[Nội dung do luật sư soạn]".
- Danh sách chữ có dấu đầu dòng dùng lớp `tsp-bullets` (base.css bỏ dấu mặc định của `ul`).
- A11y: nhãn cho mọi trường, lỗi theo trường có `aria-invalid` và `aria-describedby`, tóm tắt lỗi `role="alert"` và đưa focus vào lỗi đầu, mọi trạng thái có chữ (không chỉ màu), vùng bấm tối thiểu 44 px trên cảm ứng, có phương án thay thế cho kiểm tra người thật (mã qua email), honeypot ẩn khỏi người dùng và trình đọc màn hình, tôn trọng `prefers-reduced-motion`.

## Đo tràn ngang và lỗi JS

`node design/tenant-signup/measure-overflow.js` (xem đầu tệp; tự mở thanh "Xem thử" trước khi bấm trạng thái; quét `tsu-*.html` và `tsx-*.html`). Kết quả ghi ở `overflow-report-public.md`.

## Màn bị bỏ hoặc hoãn (`_deferred/`)

Lý do và điều kiện quay lại theo bảng mục 5 của `docs/ui-ux/tenant-signup-simplified.md`. Tệp được chuyển bằng `_deferred/move-deferred.sh` (git mv rồi sửa đường dẫn tương đối); chạy một lần. Không trang đang dùng nào liên kết tới `_deferred/`.

| Màn cũ | Quyết định | Thay bằng, hoặc điều kiện quay lại |
| --- | --- | --- |
| TSU-01..04 (giới thiệu và 3 bước đăng ký) | Gộp | TSX-01 |
| TSU-05, 07 (đã gửi, gửi lại) | Gộp | TSX-02 |
| TSU-06, 08, 09, 10, 12 (xác thực, theo dõi, bổ sung, từ chối, cấp phát) | Gộp | TSX-03 |
| TSU-11 (khiếu nại) | Hoãn | Khiếu nại qua hỗ trợ; nút "Chuyển lại xem xét" ở TSX-30. Quay lại khi số ca bị từ chối vượt ngưỡng vận hành hoặc luật sư yêu cầu quy trình chính thức (C-S07) |
| TSU-13 (mã công ty) | Bỏ | Email chào mừng; mã công ty xem ở TSX-20 |
| TSU-17 (quên mã công ty) | Gộp | TSU-15, thẻ thứ hai |
| TSU-18 (chấp nhận điều khoản mới) | Hoãn | Phải có trước khi công bố phiên bản điều khoản hoặc DPA mới (FR-TEN-037, RULE-029; C-S08) |
| TSU-61, 62, 63, 65 (hàng đợi, chi tiết, hộp thoại, lỗi cấp phát) | Gộp | TSX-30 |
| TSU-64 (hàng đợi khiếu nại) | Gộp, hoãn | TSX-30 "Chuyển lại xem xét"; cùng điều kiện TSU-11 |
| TSU-67 (điều khoản và DPA, quản trị) | Hoãn | Cùng điều kiện TSU-18: cần khi có phiên bản thứ hai |
| TSU-68 (danh mục gói) | Hoãn | Giai đoạn B1 khi có nhiều gói; B0 một gói nạp qua cấu hình có nhật ký |

Các màn cũ của `onboarding/` (TSU-20..31) và `account/` (TSU-40, 42, 43, 44, 52, 54, 57) do designer phụ trách phía trong ứng dụng xử lý riêng.
