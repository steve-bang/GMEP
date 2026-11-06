# Gói thiết kế "Đăng ký tenant và onboarding" (bản tối giản, garage một chi nhánh một kho)

Prototype HTML/CSS tĩnh (không dựng máy chủ thật). Nguồn yêu cầu chính: `docs/ui-ux/tenant-signup-simplified.md` (BA, v0.1, đề xuất, chưa được khách hàng xác nhận). Chi tiết trường, kiểm tra giá trị và câu lỗi (V-EMAIL, V-PHONE, V-MST, V-PASS, V-NAME, V-ORG, V-CODE, V-REQ, V-FILE) giữ từ `docs/ui-ux/tenant-signup-spec.md` v0.2. Token và component dùng chung từ `design/assets` (không đổi). Mở bằng `file://` được.

Bản này thay bản 52 màn (TSU-01..68) bằng **18 màn**: 11 giữ mã TSU cũ, 7 mã mới TSX. Màn gộp hoặc hoãn nằm trong `_deferred/` (mục cuối).

## Cấu trúc

| Thư mục | Nội dung | Số màn |
| --- | --- | --- |
| `public/` | Đăng ký một trang, kiểm tra email, tiến trình; đăng nhập bằng email và mật khẩu, quên mật khẩu, đặt lại mật khẩu | 6 |
| `platform-admin/` | Đăng nhập quản trị nền tảng, hàng đợi ca bị cờ (master-detail), cấu hình đăng ký rút gọn | 3 |
| `onboarding/` | Xác nhận garage và bắt đầu dùng (TSX-10), thiết lập nhanh (TSX-11), Thiết lập dần (TSX-20) | 3 (designer khác phụ trách) |
| `account/` | Dùng thử của tôi, banner, hộp thoại chặn, tạm ngưng, xuất dữ liệu, chấm dứt (TSU-41, 50, 51, 53, 55, 56) | 6 (designer khác phụ trách) |
| `_deferred/` | Màn bị bỏ, gộp hoặc hoãn; xem cuối tệp | không tính |

Tệp dùng chung: `ts-config.js` (tên sản phẩm và kênh hỗ trợ, một chỗ duy nhất, nạp trước `ts-common.js` và `onboarding/tsu-app.js`), `ts-common.js` (nút "Xem thử", kiểm tra biểu mẫu theo bảng V-*, khóa nút kèm lý do, đếm lùi, tệp đính kèm, kiểm tra người thật, nháp trình duyệt), `public/ts-public.css` (tiền tố `tsp-`), `platform-admin/ts-admin.css` và `ts-admin.js` (tiền tố `tsa-` và `tsx-`), `measure-overflow.js` (đo tràn ngang và lỗi JS bằng Playwright), `overflow-report-public.md` (kết quả đo; cập nhật khi đo lại).

## Cách xem

- Mỗi màn có nút **"Xem thử"** (thanh "Xem thử trạng thái", chỉ prototype). Trên điện thoại (<= 639 px) bảng chọn trạng thái thu gọn mặc định; bấm "Xem thử" để mở. Nhãn chỉ dùng chữ tiếng Việt, không lộ khóa kỹ thuật.
- Vào thẳng một trạng thái bằng `?state=<mã>` (mã là giá trị `data-ts-view` của nút).
- Trạng thái chung có trên mọi màn phù hợp: đang tải, lỗi máy chủ kèm mã REQ, mất mạng (giữ dữ liệu đã nhập), quá nhiều lần thử (đếm lùi).
- Giá trị thử: TSU-14 và TSU-60, mật khẩu `sai` báo sai thông tin, `khoa` khóa tạm; riêng TSU-14 mật khẩu `nhieu` ra bước "Chọn công ty" (email thuộc nhiều công ty).
- Kiểm tra người thật, đối chiếu MST, gửi email, đếm hạn mức đều là mô phỏng. Nháp đăng ký lưu ở `localStorage` của trình duyệt và không lưu mật khẩu.

## Mục lục 18 màn

### Đăng ký và đăng nhập công khai (`public/`)

| Mã | Tệp | Màn hình | Thay thế | Trạng thái xem thử chính |
| --- | --- | --- | --- | --- |
| TSX-01 | `tsx-01.html` | Đăng ký dùng thử một trang: 5 trường nhập, 2 ô đồng ý Điều khoản và DPA tách riêng (mỗi ô một câu ngắn), kiểm tra người thật chỉ hiện khi nghi ngờ. Loại hình suy ra từ độ dài MST. Không nhập lại mật khẩu. Chân trang có kênh hỗ trợ | TSU-01..04 | mặc định, lỗi nhiều trường, có bản nháp, đã điền đủ, đang gửi, cần kiểm tra người thật, kiểm tra người thật chưa đạt, điều khoản đổi, truy cập sớm, đóng đăng ký |
| TSX-02 | `tsx-02.html` | Kiểm tra email, gửi lại ngay trên màn; thẻ kênh hỗ trợ | TSU-05, 07 | bình thường, vừa gửi lại (đếm lùi), gửi lại quá nhiều, xếp hàng |
| TSX-03 | `tsx-03.html` | Xác thực và tiến trình, một màn nhiều trạng thái, dải 3 chặng. Bấm liên kết ở trình duyệt nào cũng tự đăng nhập và vào thẳng TSX-10 | TSU-06, 08, 09, 10, 12, 13 | đang kiểm tra, đã xác thực (vào thẳng ứng dụng), bấm ở máy hoặc trình duyệt khác (vẫn vào thẳng), chờ duyệt, cần bổ sung (có tải tệp), không đạt, đang tạo chậm, liên kết hết hạn, liên kết đã dùng (một lần, hạn 72 giờ; có nút gửi lại và đăng nhập bằng email), yêu cầu quá hạn |
| TSU-14 | `tsu-14.html` | Đăng nhập bằng email và mật khẩu (không còn ô mã công ty). Chỉ khi email thuộc nhiều công ty thì SAU khi mật khẩu đúng mới hiện bước "Chọn công ty" (nhớ lựa chọn trên thiết bị); rẽ nhánh sau đăng nhập | giữ, chỉnh | mặc định, sai thông tin (một câu trung lập), khóa tạm, hết phiên, chọn công ty, đã nhớ công ty, đăng nhập đúng (rẽ nhánh) |
| TSU-15 | `tsu-15.html` | Quên mật khẩu (chỉ còn một biểu mẫu theo email) | TSU-15, 17 | quên mật khẩu, đã gửi (trung lập), cần kiểm tra người thật, kiểm tra người thật chưa đạt, đang gửi |
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
- **Phản hồi trung lập** (RULE-032): đăng ký mới, trùng email và trùng MST cùng đi tới TSX-02, cùng chữ; TSX-03 `chờ duyệt` không nêu lý do gắn cờ; quên mật khẩu cùng một câu cho mọi kết quả; lỗi đăng nhập một câu trung lập ("Email hoặc mật khẩu chưa đúng"); bước "Chọn công ty" chỉ hiện sau khi mật khẩu đúng.
- **Quy tắc khóa nút** (một quy tắc, thay QĐT-24): nút khóa dùng `aria-disabled="true"`, vẫn focus được, `aria-describedby` trỏ tới lý do hiện sẵn, bấm chỉ đưa focus tới lý do, không dùng thuộc tính `disabled`. Lý do khóa cụ thể, ví dụ "Chưa thể gửi: còn thiếu mã số thuế, email".
- Số liệu do máy chủ quyết (thời hạn liên kết, đếm lùi, số ngày dùng thử, trần ngày, hạn bổ sung) chỉ là số minh họa, ghi "(minh họa)" hoặc "cấu hình".
- Mục `[Cần xác nhận]` hiện bằng khối "Giữ chỗ cấu hình" nét đứt, không hard-code nội dung pháp lý hay giá. Văn bản điều khoản, DPA, chính sách lưu trữ là chỗ giữ "[Nội dung do luật sư soạn]".
- Danh sách chữ có dấu đầu dòng dùng lớp `tsp-bullets` (base.css bỏ dấu mặc định của `ul`).
- A11y: nhãn cho mọi trường, lỗi theo trường có `aria-invalid` và `aria-describedby`, tóm tắt lỗi `role="alert"` và đưa focus vào lỗi đầu, mọi trạng thái có chữ (không chỉ màu), vùng bấm tối thiểu 44 px trên cảm ứng, có phương án thay thế cho kiểm tra người thật (mã qua email), honeypot ẩn khỏi người dùng và trình đọc màn hình, tôn trọng `prefers-reduced-motion`.

## Thay đổi theo feedback của chủ garage (điện thoại)

Các quyết định D1 đến D9 (đề xuất, chờ khách hàng xác nhận; BA ghi cùng nội dung ở `docs/ui-ux/tenant-signup-simplified.md`):

| Mã | Quyết định | Nơi áp dụng |
| --- | --- | --- |
| D1 | Đăng nhập bằng email và mật khẩu; bỏ ô và liên kết "Mã công ty"; email thuộc nhiều công ty thì sau khi mật khẩu đúng mới "Chọn công ty" (nhớ trên thiết bị). Mã công ty chỉ còn là chữ nhỏ ở thông tin tài khoản (TSX-20, trang đầy đủ) và email chào mừng | TSU-14, 15, 16, TSX-01, 03, TSX-20, TSU-60 |
| D2 | Liên kết xác thực email tự đăng nhập ở mọi trình duyệt, vào thẳng TSX-10; liên kết một lần, hạn 72 giờ; hết hạn hoặc đã dùng thì có nút gửi lại và đăng nhập bằng email | TSX-02, 03 |
| D3 | Kênh hỗ trợ (hotline, Zalo, giờ làm việc) ở TSX-01 (chân trang), TSX-02, 03, TSX-20 (thẻ "Hỗ trợ"), TSU-14, 15, 41 (hết dùng thử), 51, 53, 56. Giá trị minh họa [Cần xác nhận] cấu hình `support.phone`, `support.zalo`; đổi ở `ts-config.js` | `ts-config.js` |
| D4 | Ẩn hoàn toàn giá và gói: không còn chữ về giá, gói, so sánh gói, mức dùng theo gói, "Liên hệ chọn gói", "Đổi gói", "Lịch sử gói", thanh toán, nút thanh toán. TSU-41 đổi thành "Dùng thử" (ngày còn lại, ngày kết thúc, trạng thái công ty). Câu trấn an dùng chung: "Hết thời gian dùng thử, dữ liệu của bạn vẫn được giữ; chúng tôi sẽ liên hệ để bạn chọn cách dùng tiếp." TSX-01 chỉ ghi "Dùng thử miễn phí, không cần thẻ"; số ngày chỉ hiện sau khi kích hoạt | TSX-01, 10, 20, TSU-41, 50, 51, 53, 66, banner |
| D5 | TSX-11 hỏi đầu tiên "Bạn đang quản lý garage bằng gì?" (Excel, Phần mềm khác, Sổ sách giấy, Chưa có gì); chọn Excel hiện thẻ "Nhập dữ liệu từ Excel" (tới `g4-sys-20.html`, kèm "Tải file mẫu" mô phỏng); TSX-20 đưa mục Nhập Excel lên đầu khi đã chọn Excel (lưu `localStorage` khóa `ts-src`, chỉ prototype) | TSX-11, 20 |
| D6 | Hóa đơn điện tử nói bằng tiếng thường: "Garage đang dùng hóa đơn điện tử của nhà nào?" (Nhà cung cấp A/B/C là dữ liệu minh họa cấu hình được, "Khác", "Chưa có / chưa biết"). "Chặn phát hành hóa đơn thật" thành "Cần để xuất hóa đơn thật", kèm "Trước đó, hóa đơn chỉ là bản nháp để thử." | TSX-10, 20, banner BAN-C, TSU-50, 51 |
| D7 | Đồng ý Điều khoản rút thành một câu ngắn kèm nút "Đọc"; ý "đại diện hợp pháp" chuyển thành chú nhỏ dưới ô; ô DPA vẫn tách riêng | TSX-01 |
| D8 | Mật khẩu: điều kiện và thanh độ mạnh chỉ hiện khi bắt đầu gõ, chưa đạt là chấm trung tính, đạt thì dấu tích xanh, không X đỏ. "Kiểm tra người thật" ẩn mặc định, chỉ hiện ở trạng thái xem thử "Cần kiểm tra người thật"; gửi bình thường không cần bấm | TSX-01, TSU-15, 16 |
| D9 | Thương hiệu "GMEP" là một hằng duy nhất `TS_CONFIG.brand` trong `ts-config.js`; chỗ hiện tên dùng `<span data-brand>`; tiêu đề tab được thay theo. **[Cần xác nhận] tên sản phẩm "GMEP" chưa được chủ dự án chốt.** | tất cả màn |

Dọn thêm: thanh quản trị nền tảng trên điện thoại còn tối đa hai hàng (tên sản phẩm và nhãn, rồi tên người dùng, đổi giao diện, đăng xuất); thanh lưu dính của TSU-66 trên điện thoại gọn một hàng nút, dòng "n thay đổi chưa lưu" nhỏ phía trên.

Còn sót có chủ ý: TSU-55 vẫn dùng chữ "gói xuất" theo nghĩa bản xuất dữ liệu (không phải gói thuê bao); `platform-admin/ts-admin.js` còn mã của danh mục gói (TSU-68, màn hoãn, không có trên trang đang dùng); các trang `index.html` giữ tên sản phẩm bằng chữ thường (là mục lục, không phải màn người dùng).

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
| TSU-68 (danh mục gói) | Hoãn sang phase sau | Giá và gói đang ẩn hoàn toàn với người dùng (D4); quay lại khi khách hàng chốt cách tính phí |

Các màn cũ của `onboarding/` (TSU-20..31) và `account/` (TSU-40, 42, 43, 44, 52, 54, 57) do designer phụ trách phía trong ứng dụng xử lý riêng.
