# BA review lần 3 (kiểm tra cuối) – Gói G2 phần 1 (CRM, APT, REC, INS)

Phiên bản 0.1 · 30/10/2026 · BA. Đối tượng: `design/g2-workshop/*` và `docs/ui-ux/02-workshop-intake.md` §13, §14. Chuẩn: `design-system.md`, `00-foundation.md` (§7 vai trò MH, NS), `ba-decisions.md`.
Phương pháp: đọc code thực tế (`pack.js` toàn bộ, REC-02, REC-03, REC-04, CRM-08 toàn bộ; grep toàn gói cho `checked`, `data-g2w-deny`, `data-g2w-money`, mã lệnh/biển số, câu hạn mức nợ). Chưa chạy trình duyệt. Các Minor vòng 2 không nêu dưới đây (F2R2-05..F2R2-12) chỉ kiểm bằng grep/đọc mẫu, ghi "Đạt (kiểm mẫu)".

## 1. Kết luận

**ĐẠT — không còn Blocker/Major.** Còn 3 Minor mới (F2R3-01..03) sửa nhanh hoặc ghi handoff, không chặn chốt gói. Cộng 1 finding foundation riêng (F-FND-01), không tính vào gói 2.

Số liệu: Blocker 0 · Major 0 · Minor 3 (gói 2) · Foundation 1.

## 2. Kiểm 4 Major còn mở của vòng 2

| ID | Kết quả | Bằng chứng trong code |
| --- | --- | --- |
| F2-01 Thợ thấy tiền công | Đạt | `g2-rec-04.html:150,164,177` "Công …" đã bọc `data-g2w-money`; `:216` dòng hạng mục 3 và `:218` tổng giờ `data-g2w-hide-for="TH"`; `pack.js:186-190` che `••• ₫` cho TH |
| F2-07 Hộp Tạm dừng | Đạt | Nút `data-pause-ok` khởi tạo `disabled` (REC-04 `:391`, REC-03 `:146`); `pauseCheck` (`pack.js:296-300`) mở nút chỉ khi có lý do, "Khác" cần ghi chú từ 5 ký tự, lý do khóa hiện ở `[data-pause-why]`; thẻ REC-03 chuyển cột Tạm dừng kèm tag lý do (`g2wForceMove`, `pack.js:286-294`); REC-04 chuyển biến thể paused (`:482`) |
| F2-10 CRM-08 cột B | Đạt | `g2-crm-08.html:37-40` cặp `data-b-full`/`data-b-min`; `minView()` `:93-97` chỉ QL ở `cross` bị mức tối thiểu (tên viết tắt, SĐT `data-mask`, email "không hiện", bảng đồng ý ẩn `:53`, `:52` giải thích); QV, CH xem đủ khớp ba-answers câu 5. Nút Hợp nhất khóa theo tình huống `:101` |
| F2R2-01 Ô đồng ý đánh sẵn | Đạt | grep `checked`: CRM-02 chỉ còn ô bắt buộc dịch vụ `disabled` (`:63`); APT-02, CRM-10/11 không còn ô đồng ý đánh sẵn; không có JS đặt `checked` |

## 3. Kiểm Minor vòng 2

| ID | Kết quả | Ghi chú |
| --- | --- | --- |
| F2-16 | Đạt một phần | working/paused nhất quán (09:25, 09:28, cập nhật 09:30, còn 6 giờ 30 phút). Biến thể có `hoursFull` còn lệch: xem F2R3-02 |
| F2-19 | Đạt | Tag "Số km bất thường" ở REC-02 `:88` và REC-04 `:52`, chỉ `data-g2w-roles="QL QV CH"` |
| F2-27 | Đạt | "9 biến thể" thống nhất ở tài liệu `:39,325` và `index.html:25` |
| F2R2-03 | Đạt | `g2-rec-02.html:77` `data-g2w-hidecols="8,9|TH QD"`, bộ lọc Thanh toán `:50` ẩn TH QD. Thẻ mobile: xem mục 5 quyết định 1 |
| F2R2-05 | Đạt một phần | CRM-03 `:56` đã sửa câu và `:63` ẩn tab với TH QD CV. Câu sai còn ở nơi khác: F2R3-01 |
| F2R2-06..F2R2-12 | Đạt (kiểm mẫu) | Mã lệnh/biển nhất quán: 00124 = Ford Ranger 51A-246.80 ở REC-02, 03, 05, 07, CRM-04/09, APT-01; 00129 = Ertiga 51M-345.67 ở REC-03, 05; REC-04 đã có biến thể ok2qc, khóa `data-v-late` từ qc/ready; PN 00098, 00099 |

## 4. Finding mới do chỉnh sửa vòng 2 (F2R3)

| ID | Mức | Vị trí | Vấn đề | Cách sửa |
| --- | --- | --- | --- | --- |
| F2R3-01 | Minor | `g2-rec-04.html:416`; `g2-crm-02.html:55` | Quy tắc hạn mức nợ còn nói sai ở 2 chỗ: "thu tiền và giao xe cần duyệt" / "cảnh báo khi thu tiền và giao xe". Đã sửa ở `rec-04:130`, `crm-03:56` (thu tiền làm giảm nợ nên không chặn; chặn giao xe, mở thêm lệnh). Ba chỗ nói ba kiểu sẽ làm khách và dev hiểu sai | Sửa hai câu thành "giao xe hoặc mở thêm lệnh cần duyệt vượt hạn mức; thu tiền không bị chặn" (FR-ACC-020, G4-APR-02) |
| F2R3-02 | Minor | `g2-rec-04.html:214-218` | Tab Công thợ là HTML tĩnh (hạng mục 2 = 0,1 giờ, tổng thực 0,6) trong khi biến thể ok2qc/qc/ready/done/locked hiện hạng mục 2 = 1,4 và hạng mục 3 = 1,0 (`apply()` `:457-458`). Giờ công là dữ liệu tính công nên demo mâu thuẫn trước khách | Cho `apply()` cập nhật tab Công thợ (giờ thực, mốc, tổng 3,0/2,9) theo `hoursFull` |
| F2R3-03 | Minor | `g2-rec-04.html:482` | Xác nhận Tạm dừng luôn chuyển sang biến thể "chờ phụ tùng" bất kể lý do chọn (Nghỉ, Khác) nên tag và ghi chú sai lý do | Truyền lý do đã chọn vào `ro-tag`, `ro-note`; hoặc ghi chú rõ "mẫu" ở hộp thoại |

## 5. Quyết định các mục designer báo chưa xử lý (BA đề xuất — chờ xác nhận)

1. **Thẻ mobile REC-02 còn badge Thanh toán, Hóa đơn cho Quản đốc**: không chặn gói. Quy tắc chốt: mọi biểu diễn (bảng, thẻ, xuất file) dùng cùng một chính sách quyền do máy chủ quyết định; QĐ không thấy trạng thái thanh toán/hóa đơn (câu 11, FR-REC-028 phần quyền). Designer ẩn `record__foot` badge với QĐ khi chạm file lần sau (1 dòng, `g2-rec-02.html:107-109`); nếu chưa kịp thì ghi handoff (mục 6). Không nâng thành finding vì QĐ làm việc trên tablet/desktop và bảng đã đúng.
2. **Điều kiện thứ 6 "thu đủ trước khi xuất hóa đơn"**: chốt hoãn. Danh sách kiểm hiện 5 mục (`g2-rec-04.html:401`); điều kiện thứ 6 chỉ hiện khi cấu hình chi nhánh/loại khách bật, mặc định tắt (ba-answers vòng 2 câu 4), có ngày hiệu lực. Vẽ ở vòng thiết kế sau cùng cấu hình EIN (G4-EIN-02), không chặn gói 2. Ghi vào FRD khi BA cập nhật FR-EIN. Cần khách xác nhận: bật theo loại khách nào.
3. **Vai trò MH, NS bị chặn mặc định ở G2**: chốt "chặn mặc định (default-deny)". Theo ma trận `00-foundation.md` §7 và `app.js:343-344`, MH chỉ có Mua hàng, Kho (xem), Báo cáo; NS chỉ Nhân sự, Báo cáo; không có Phiếu sửa chữa, Lịch hẹn, Khách hàng. Hiện 25 màn không liệt kê MH, NS trong `data-g2w-deny` nên mở bằng `?role=MH` vẫn thấy nội dung (SĐT bị che nhưng danh sách lệnh, tiền hiện). Cách làm: trong `pack.js`, coi `data-g2w-deny` là danh sách chặn cộng thêm danh sách cố định `MH NS` cho mọi trang gói G2 (một chỗ, không sửa 25 trang). Đây là hạn chế prototype, không phải lỗi nghiệp vụ vì `pack.js` không có nút chuyển sang MH/NS; nên ghi vào mục 6. Quy tắc cho bản thật: quyền theo allow-list, vai trò mới mặc định không có quyền.

## 6. Chuyển cho dev (không chặn)

- Ẩn/khóa theo vai trò và theo chi nhánh phải do dữ liệu máy chủ quyết định (API không trả giá, SĐT, thanh toán cho TH; không trả hồ sơ B đủ cho QL ngoài phạm vi). `?role=`, bảng `PHONES` chỉ có ở demo.
- Quyền xem giá chi nhánh khác (F2-17): điều kiện thật là phạm vi dữ liệu được gán, không phải danh sách vai trò.
- Default-deny cho vai trò mới (MH, NS và vai trò thêm sau) ở mọi màn, kể cả xuất file.
- Một chính sách quyền cho mọi biểu diễn (bảng, thẻ mobile, in, xuất), xem quyết định 1.
- Thông báo "đủ điều kiện gửi QC", tag thẻ REC-03, cờ "Giữ xe" cho QĐ: thuộc hệ thống thông báo, chưa vẽ.
- "Tính phí khi hủy" (FR-REC-037 đề xuất), "giữ làm đặt trước", "trừ phí": chờ kế toán và khách; mặc định tắt.
- Cờ km bất thường: ngưỡng đề xuất giảm hơn 1.000 km, cấu hình có ngày hiệu lực.
- Kéo thả kanban, bàn phím, cảm ứng, safe-area, hành vi dialog trên thiết bị thật: kiểm trên trình duyệt/thiết bị đích sau khi chọn stack.
- Ủy quyền sự kiện gom một chỗ thay nhiều `document.addEventListener` (đã ghi đầu `pack.js`).

## 7. Finding foundation riêng (ngoài gói 2)

| ID | Mức | Vị trí | Vấn đề |
| --- | --- | --- | --- |
| F-FND-01 | Major (foundation, theo ảnh chụp thật do điều phối viên báo) | `design/assets/app.js:357-362` chèn `.nav-item__mode`; CSS tương ứng trong `design/assets/components.css` | Badge chế độ menu ("Chỉ xem", "Của tôi", "Danh mục", "Hệ thống") bị tràn/cắt ngoài sidebar rộng 248px, nhất là khi kèm `count-pill`. Tôi chưa chụp lại được bằng trình duyệt; xác nhận dựa trên báo cáo của điều phối viên. Gợi ý: cho nhãn `flex-shrink:0` + `white-space:nowrap`, rút thành biểu tượng/tooltip hoặc để nhãn dưới tên mục khi sidebar hẹp; không thêm màu mới. Giao designer sửa ở vòng foundation, không tính vào kết luận gói 2 |

## 8. Kết luận cuối

**ĐẠT — không còn Blocker/Major** cho Gói 2 (CRM, APT, REC, INS). Còn 3 Minor (F2R3-01..03), sửa cùng lượt tới hoặc ghi handoff. Finding foundation F-FND-01 xử lý riêng.
