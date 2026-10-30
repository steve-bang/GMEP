# BA Review vòng 3 (kiểm tra cuối) – Gói G3 (Kho, Mua hàng, Nhân sự)

Ngày 30/10/2026 · BA · Kiểm bằng đọc mã `design/g3-inventory-hr/*` (không có Bash/Playwright, không chụp ảnh). Không sửa file khác, không commit.

## Kết luận: CHƯA ĐẠT (còn 1 Major nhỏ; sửa xong là ĐẠT, không cần review lại toàn gói)

| Mức | Còn mở | Mã |
| --- | --- | --- |
| Blocker | 0 | – |
| Major | 1 | F4R3-01 |
| Minor | 2 | F4R3-02, F4R3-03 |
| Chuyển dev (không chặn) | 6 | mục 4 |

## 1. Hai Blocker cũ vẫn đạt

- **Tab "Chi nhánh khác"** (`g3-inv-03.html:70-78`): chỉ cột Khả dụng, Số có thể cho, Tính đến. Chữ "Thực tế/Giữ chỗ" ở dòng 70 nằm trong câu giải thích "không hiện". Không có chi nhánh ngoài phạm vi. Đạt.
- **Thẻ mobile bốn số** (`g3-inv-04.html:53`, `pack.js:269-272, 305`): đủ Thực tế · Giữ chỗ · Đang vận chuyển · Khả dụng. Đạt.
- **Đang về vs Đã đặt – chờ giao:** không đổi so với vòng 2 (`pack.js:257-266`, `g3-inv-05.html:39-43`): Đạt.

## 2. Kiểm các mục vòng 2

| Mã | Kết quả | Bằng chứng |
| --- | --- | --- |
| F4R2-01 MH lập đơn mua | **Đạt** | `g3-pur-04.html:23` và `g3-pur-03.html:61` đã có `TK QL MH`; PUR-06 nhận hàng giữ `TK` (đúng tách nhiệm vụ) |
| F4R2-02 Mua gấp ở phiếu nhập | **Đạt** | `g3-inv-09.html:43` ô "Chứng từ gốc" chọn DM / YM Mua gấp / không có đơn mua; `:48-49` khối YM có hạn hậu duyệt và ảnh hóa đơn bắt buộc; ví dụ mua gấp đã bỏ khỏi nhánh "không có đơn mua" (`:50`). Còn thiếu phía yêu cầu mua: F4R3-01 |
| F4R2-03 điều kiện đề xuất R2-D1 | **Đạt** | `g3-inv-05.html:41, 43` PT-0008 và PT-0002 đề xuất 0 kèm dòng theo dõi (3+4+10=17 > 6); PT-0003, PT-0005 vẫn đề xuất; chân bảng `:46` ghi điều kiện |
| F4R2-04 một việc hai phương pháp | **Đạt** | `g3-hrm-07.html:42` RO-126 là "sửa chữa chung" giờ chuẩn; hoa hồng 18% nay thuộc RO-Q7-2610-00122 "Sơn cản trước (đồng sơn)" (`g3-hrm-09.html:44`); số HRM-08 không đổi và vẫn khớp |
| F4R2-05 đơn giá giờ công | **Đạt** | `g3-hrm-06.html:44-50` bảng đơn giá theo chức danh × chi nhánh, phiên bản d1, hiệu lực, snapshot khi ghi công; khớp 90.000/85.000/80.000/50.000 ở HRM-08 |
| F4R2-06 quy cách NCC | **Đạt (có F4R3-02)** | `g3-pur-10.html:46-51` cột Đơn vị đặt (bội số), SL tối thiểu NCC, quy tắc làm tròn lên; INV-05 `:46` liên kết sang |
| F4R2-07 badge | **Đạt** | `g3-pur-04.html:37` "Trễ 1 ngày" nay `tag--danger`; "Chờ gửi" không còn ở INV-11 |
| F4R2-08 thẻ stock4 theo vai trò | **Đạt** | `pack.js:271` ẩn riêng ô Thực tế và Giữ chỗ (`data-g3-hide="CV MH"`), giữ Đang vận chuyển và Khả dụng cho MH |
| F4-08 (còn dở) | **Đạt** | Cảnh báo "mã đang trong đợt kiểm kê" nay có ở INV-07 (`:32, 34`), INV-09 (`:33, 36`), INV-13 (`:47`); đóng băng chuyển sang G4-SYS theo quyết định |
| F4-16 (còn dở) | **Đạt (chấp nhận)** | Hoa hồng cố vấn có phiên bản h1/h2 (`g3-hrm-06.html:52`); v1 và bảng đơn giá bị khóa cho đến khi "Soạn nháp" (script `#f-rule .table input`). So sánh nháp–bản hiện hành để backlog (đã chấp nhận ở vòng 2) |

## 3. Finding mới

**F4R3-01 · Major · Hậu duyệt "Mua gấp" không có chỗ thực hiện**
Quyết định câu 8 và Phụ lục E #5: Mua gấp trong hạn mức được ghi nhận ngay và **hậu duyệt** trong 24 giờ (RULE-011). Phiếu nhập `g3-inv-09.html:43, 48` tham chiếu `YM-Q7-2610-00006` "đã ghi nhận, chờ hậu duyệt đến 10:30 31/10", nhưng (a) YM này không có trong danh sách `g3-pur-01.html` (chỉ YM-…00001…00005, không dòng nào có tag "Mua gấp"; chân trang `:44` chỉ giải thích bằng chữ), (b) `g3-pur-03.html` chỉ có các trạng thái Chờ duyệt / Đã duyệt / trong hạn mức / cấp CH-QV, không có trạng thái "đã ghi nhận – chờ hậu duyệt" với nút Duyệt hoặc Không chấp nhận (kèm hậu quả: gắn cờ cho KT). Hệ quả: khoản đã chi nhưng người duyệt không có màn hình xử lý, không theo dõi được hạn.
Sửa: thêm dòng YM-…00006 vào PUR-01 (tag "Mua gấp" Warning, trạng thái "Chờ hậu duyệt" Warning, hạn còn lại); thêm trạng thái `post` ở PUR-03 (Duyệt hậu kiểm / Không chấp nhận có lý do, hiện đã nhập N đơn vị, giá trị, ảnh hóa đơn). Bảng badge Phụ lục A (yêu cầu mua) thêm trạng thái "Chờ hậu duyệt" (Warning) là tag của "Đã duyệt tạm" khi cần.

**F4R3-02 · Minor · PUR-10 tab "Bảng giá" chưa khóa theo vai trò chỉ xem**
Điểm designer tự nêu, xác nhận đúng: `g3-pur-10.html:36` chỉ tab 1 nằm trong `data-g3-edit="TK QL MH"`; ô "Bội số đặt" và "SL tối thiểu NCC" ở tab 2 (`:47-50`) là input mở cho mọi vai trò mở được màn hình (CH, QV, KT chỉ xem). Người không có quyền thấy và gõ được vào cấu hình đặt hàng (dù nút "Cập nhật giá" `:52` đã khóa). Sửa: bọc tab 2 trong `data-g3-edit="TK QL MH"` (hoặc `readonly` theo vai trò). Bảng giá có hiệu lực/phiên bản của chính NCC cũng nên chỉ đọc cho đến khi bấm "Cập nhật giá".

**F4R3-03 · Minor · Dữ liệu mẫu mua gấp**
Cùng gốc với F4R3-01: hạn "10:30 31/10/2026" tính từ lúc nhận 29/10 là hơn 24 giờ làm việc theo quy định mẫu; chỉnh dữ liệu cho khớp quy tắc "hết ngày làm việc kế tiếp" (nếu mua 29/10 thì hạn cuối ngày 30/10). Không ảnh hưởng thiết kế.

Điểm designer nêu thứ hai: **`applyExtraRole` không dùng** (`pack.js:395-415, 427`) – chỉ chạy khi thiếu `[data-role-label]`, đã được `app.js` (đã vá MH/NS) thay thế. Không có tác động nghiệp vụ/an toàn: ghi vào mục 4.

## 4. Chuyển cho dev (không chặn)

1. Bỏ hàm dự phòng `applyExtraRole`, `EXTRA_MENU`, `EXTRA_MODE` (`pack.js:14-15, 395-415`) khi chủ Phase 0 hợp nhất bản vá `app.js` và `00-foundation.md` §7.
2. Thẻ mobile vẫn sinh từ DOM một lần; nút trên thẻ INV-05 chưa mang mã hàng của thẻ; production dùng một component hai bố cục.
3. `data-g3-block` khóa kỳ công là tĩnh; production tính theo ngày kết thúc kỳ và điều chỉnh chờ duyệt.
4. Lựa chọn trong ô "Chứng từ gốc" của INV-09 chưa tự mở khối YM/không có đơn (chỉ qua nút mô phỏng); production gắn theo lựa chọn.
5. Chưa chạy trình duyệt: cần Playwright 375 px và 1280 px cho INV-04/05, PUR-03/10, HRM-06/08, đổi vai trò MH, NS, CV, TK; kiểm in A5/nhiệt 80 mm thật.
6. Dọn tài liệu 04 (mục 4, 10) theo `ba-answers-04.md` khi đóng gói; `document.write` shell và PII mô phỏng giữ ghi chú handoff như vòng trước.

## 5. Điều kiện để chuyển thành ĐẠT

Sửa F4R3-01 (thêm dòng và trạng thái hậu duyệt) và F4R3-02 (khóa tab bảng giá theo quyền); F4R3-03 sửa cùng lượt. BA chỉ cần kiểm lại `g3-pur-01.html`, `g3-pur-03.html`, `g3-pur-10.html`.
