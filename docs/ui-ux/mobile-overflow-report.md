# Trang còn tràn ngang ở 390px

Đo bằng Playwright/Chromium (scrollWidth - clientWidth, viewport 390x844). Desktop 1440px: 0 trang tràn. Không có lỗi JavaScript ở 193 trang.

Lịch sử: 94 lượt tải tràn ban đầu → 34 (sửa topbar dùng chung) → 11 (.table-scroll position:relative) → 5 (.segmented, .card/.table-wrap min-width:0) → còn lại bên dưới.

Còn lại:
- +215px  design/foundation/components.html
- +143px  design/foundation/index.html
- +98px  design/g2-workshop/index.html

Ghi chú: foundation/components.html và foundation/index.html là trang showcase thiết kế; g2-workshop/index.html là trang mục lục — không phải màn hình sản phẩm.

## 07/11/2026: sửa tràn 320px

Đầu vào: điều phối đo ở viewport 320px, 11 màn sản phẩm tràn (số trong ngoặc là `scrollWidth`). Designer không có shell nên tìm nguyên nhân bằng đọc HTML/CSS và tính bề rộng; **cần đo lại** ở 320/390/768/1440. Không sửa `tokens.css`, `components.css`, không sửa HTML của màn, không đổi nội dung nghiệp vụ. Ba trang showcase/mục lục không sửa (nhưng `g2-workshop/index.html` dùng chung `pack.css` của gói nên có thể đổi theo).

### Nguyên nhân và cách sửa từng màn

| Màn | Nguyên nhân (phần tử gây tràn) | Cách sửa (file) |
| --- | --- | --- |
| G1-AUT-02 (365) | Ô OTP: 6 ô cố định 48px + 5 khe 8px = 328px, thẻ đăng nhập ở 320px chỉ còn 248px (16 + 20 padding mỗi bên). Ở 390px ô OTP cũng lấn 10px vào padding thẻ, chỉ không vượt trang. | `.otp { max-width: 100% }`, `.otp__cell { flex: 0 1 48px; width: auto; min-width: 0 }`: đủ chỗ vẫn 48px như cũ, thiếu chỗ thì 6 ô co đều (khoảng 35px ở 320px, vẫn trên 24px vùng bấm). `g1-auth-dashboard/pack.css` |
| G1-AUT-10 (352) | Nút `btn--lg` "Không thấy tên tôi? Đăng nhập đầy đủ" có `white-space: nowrap` (từ `.btn`), rộng khoảng 316px trong vùng 248px. | Dưới 360px nút được xuống dòng (`.btn { white-space: normal; text-align: center }`). `g1-auth-dashboard/pack.css` |
| G2-DLV-03 (331) | Nút `btn--sm` "Đề nghị duyệt giao xe còn nợ (ngoại lệ)" (nowrap) trong cột phải của dòng điều kiện bàn giao `.g2q-cond` (cột chỉ còn khoảng 212px ở 320px). | Dưới 360px nút xuống dòng. `g2-quote-delivery/pack.css` |
| G2-QUO-03 (340) | Tooltip ẩn (`visibility: hidden` vẫn tính vào vùng cuộn) của nút khóa "Tạo phiên bản mới": rộng 280px, căn giữa trên nút nằm sát mép phải hàng nút `justify-content: flex-end`, nên lòi ra mép phải. Phụ: dòng "Đối tượng liên quan" (mã chứng từ nowrap + badge "Thanh toán một phần") sát mép. | Dưới 360px tooltip thành dải cố định `position: fixed` cách hai mép 16px, phía trên bottom nav (phần tử fixed không làm trang cuộn); nút xuống dòng; `.g2q-links__item` chuyển sang flex-wrap để badge xuống dòng khi thiếu chỗ; `.g2q-head` giảm padding còn 16px. `g2-quote-delivery/pack.css` |
| G2-QUO-04 (342) | `.card__header` (flex không xuống dòng) chứa tiêu đề có mã `BG-Q7-2610-00231-v2` (`.code` nowrap) và nút "Quay lại soạn". | Dưới 360px `.card__header`, `.card__footer` xuống dòng; `.code` ngoài bảng ngắt được sau dấu gạch. Tin nhắn xem trước có URL dài trong hộp thoại: `overflow-wrap: break-word` ở body dưới 360px. `g2-quote-delivery/pack.css` |
| G2-QUO-05 (351) | Như QUO-04: header thẻ có mã báo giá + nút "Quay lại chi tiết". Phụ: ô OTP 328px trong hộp thoại (vùng 272px ở 320px). | Như QUO-04, cộng quy tắc ô OTP co đều như G1. `g2-quote-delivery/pack.css` |
| G2-CRM-03 (364) | Thẻ xe `.vehicle-card` (lưới `56px 1fr`): cột `1fr` có min-content = biển số + badge "Đang sửa chữa" trên hàng `.row--nowrap`, nên thẻ bị kéo rộng hơn khung (ở 390px thẻ cũng lấn khỏi khung nhưng chưa vượt trang). | `.vehicle-card { grid-template-columns: 56px minmax(0, 1fr) }`, `.vehicle-card .row--nowrap { flex-wrap: wrap }` (mọi cỡ: đủ chỗ vẫn một hàng); dưới 360px giảm padding/gap thẻ còn 12px. Thêm: tên khách trên hồ sơ dùng class mã lệnh (nowrap), biến thể tên doanh nghiệp dài sẽ tràn ở mọi cỡ điện thoại, nay cho xuống dòng (`.g2w-profile .g2w-ro-head__code`). `g2-workshop/pack.css` |
| G2-REC-01 (344) | Bước 1: cùng thẻ xe như CRM-03 (biển số + badge "Đã có hồ sơ"). Bước 4 (ẩn mặc định): bảng phụ tùng khách mang đến nằm trong `fieldset`. | Như CRM-03; `fieldset { min-width: 0 }`. `g2-workshop/pack.css` |
| G2-REC-06 (358) | `fieldset` "Xử lý từng phụ tùng đã xuất" có `min-width: min-content` mặc định của trình duyệt, nên bảng (3 select) bên trong đẩy fieldset và cả trang rộng ra thay vì cuộn trong `.table-scroll`. Phụ: `.card__footer` hai nút không xuống dòng (tràn về mép trái, bị cắt chứ không cuộn). | `fieldset { min-width: 0 }` (mọi cỡ) để bảng cuộn ngang trong khung bảng; dưới 360px `.card__footer` xuống dòng. `g2-workshop/pack.css` |
| G3-INV-06 (341) | Header thẻ yêu cầu cấp phụ tùng: mã lệnh `h2.card__title.code` (nowrap) + badge "Đang sửa chữa" trên `.card__header` không xuống dòng. | Dưới 360px `.card__header` xuống dòng, `.code` ngoài bảng ngắt sau dấu gạch, nút xuống dòng. `g3-inventory-hr/pack.css` |
| G4-SYS-05 (361) | Cây tổ chức lồng 2 cấp (thụt 44px): cụm `.g4r-tree__actions` "Nhận lệnh mới trở lại" + "Khóa hoàn toàn…" (và "Cấu hình" + "Ngừng nhận lệnh mới…") là flex không xuống dòng. Phụ: tag "Ngừng nhận lệnh mới từ 25/10/2026" cao cố định 24px. | `.g4r-tree__actions` thêm `flex-wrap: wrap; max-width: 100%` (mọi cỡ, chỉ xuống dòng khi thiếu chỗ); dưới 360px thụt lề cây còn 16px + 8px, tag trong cây cao tự do và xuống dòng. `g4-reports-system/pack.css` |

### Khối dùng chung đã thêm vào 5 `pack.css`

Mỗi gói (`g1-auth-dashboard`, `g2-quote-delivery`, `g2-workshop`, `g3-inventory-hr`, `g4-reports-system`) có cùng một khối, để màn khác của gói không tái phạm cùng nguyên nhân:

- `fieldset { min-width: 0; }` (mọi cỡ; chỉ khác khi nội dung rộng hơn khung).
- Trong `@media (max-width: 359px)`: `.btn` xuống dòng (giữ nowrap trong `.table`), `.code` ngắt được (giữ nowrap trong `.table`), `.card__header`/`.card__footer` flex-wrap, `body { overflow-wrap: break-word }`, `.tooltip` thành dải cố định phía trên bottom nav.

Lý do chọn mốc 359px: các quy tắc này đổi cách hiển thị (nút hai dòng, tooltip dạng dải) mà ở 390px không cần, nên giữ nguyên 390/768/1440. Đây là mốc phụ của gói, không phải breakpoint mới trong design-system (640/1024/1280 giữ nguyên). Đề xuất cho lần sau: cân nhắc đưa tooltip dạng dải cho mọi màn dưới 640px vì tooltip căn giữa 280px vẫn có thể lòi ra mép phải ở 390px khi nút nằm sát mép.

### Chỗ còn nghi ngờ, cần đo kỹ

1. **G2-QUO-03:** chưa chắc tooltip là nguyên nhân duy nhất; nếu còn tràn, xem `.g2q-links__item` và nút "Xem lệnh RO-Q7-2610-00128" (hàng nút `justify-content: flex-end`).
2. **G2-DLV-03, G1-AUT-10:** sau khi nút xuống dòng, kiểm tra nút hai dòng vẫn cao tối thiểu 44px và chữ căn giữa.
3. **G1-AUT-02 ở 390px:** ô OTP nay co còn khoảng 46px (trước lấn padding thẻ 10px); xem lại bằng mắt.
4. **Thẻ xe (CRM-03, REC-01) ở 390px và 768px:** badge có thể xuống hàng dưới biển số (trước đây lấn ra ngoài thẻ); xác nhận không xấu.
5. **Tooltip dạng dải dưới 360px** ở màn có hộp thoại (G4-SYS-05 nút "Khóa hoàn toàn"): kiểm tra hiện đúng phía trên nội dung hộp thoại khi focus.
6. **`g2-workshop/index.html`** (trang mục lục, không sửa) dùng chung `pack.css`: số tràn có thể đổi.
7. Các màn **ẩn mặc định** (bước 2 đến 5 của G2-REC-01, biến thể "biz" của CRM-03, các trạng thái khác trong thanh xem thử) chưa được đo; nên đo thêm vài biến thể bằng tham số `?v=` hoặc bấm nút trạng thái.
