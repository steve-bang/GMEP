# Review lần 3 (kiểm tra cuối) của BA – Gói 6 "Báo cáo và Hệ thống"

Ngày 30/10/2026 · Đối tượng: `design/g4-reports-system/*`, `docs/ui-ux/06-reports-system.md` v0.3 · Đối chiếu: `review-06-round2-ba.md`, `ba-answers-06.md`. Kiểm tra trực tiếp trong mã, không dựa bảng tự khai §15. Chưa mở trình duyệt.

## Kết luận: **ĐẠT** (có 4 Minor nên sửa kèm, không chặn)

Còn mở: **Blocker 0 · Major 0 · Minor 4** (F6R3-01…04). Mọi Major của vòng 2 đã đóng.

## 1. Kiểm tra finding vòng 2

| Finding | Kết quả | Bằng chứng |
| --- | --- | --- |
| F6-04 QV thấy Đà Nẵng, TN chưa lọc | **Đạt** | `g4r-notqv` trên hàng Đà Nẵng ở RPT-03 (`g4-rpt-03.html:91`), RPT-04 (`:38, 61`), RPT-08 (`:59`). RPT-03 có dòng tổng riêng cho QV (4 chi nhánh) 91.954.545 ₫ (đã cộng lại: 28.363.636 + 22.590.909 + 24.000.000 + 17.000.000), RPT-04 KPI QV 35 lệnh (`g4r-v-qv`). RPT-10: lớp `g4r-nottn`/`g4r-tn-only` (`pack.css:75–77`); TN thấy 3 lệnh + 4 phiếu thu của mình, 16.600.000 ₫ gồm thuế (4,25 + 3,45 + 6,9 + 2,0), chưa thuế 15.090.909 ₫, khớp phần còn lại 2.750.000 ₫ |
| F6R2-01 hộp thoại duyệt | **Đạt** | `pack.js:177–190, 494–508`: "Ảnh hưởng" theo từng yêu cầu (tham số `imp`, ngăn bằng ¦), mặc định chỉ dùng cho cấu hình có ngày hiệu lực; cờ `risk` bật ô mật khẩu và nút Duyệt chỉ mở khi đã tick và có mật khẩu (`apCheck`). Đã gắn `risk` cho SYS-04 (đổi quyền), 16 (môi trường thật), 21 (hoàn tác lô, `:35`), 22 (khôi phục thật, nêu hóa đơn đã gửi thuế), 23 (ẩn danh, đã loại trừ khách còn nợ/bảo hành/lệnh mở), 24 (hạ bảo mật). Từ chối vẫn cần lý do ≥ 5 ký tự, không cần mật khẩu |
| F6R2-02 shim menu | **Đạt** | `pack.js:435–438`: chỉ còn `setAttribute('href', firstSys)`; không còn tạo/xóa nhãn hay đổi `hidden`; nhãn do `app.js` (`limited`, `approve`) quyết định |
| F6R2-03 chương trình 10% | **Đạt** | `g4-sys-09.html:52`: tag "Hạn mức riêng đã duyệt (Chủ garage 28/09/2026)" kèm giải thích; nút chỉ QV "Đề xuất đổi"; chương trình không vượt hạn mức QL sửa được (`:53`); drawer mẫu 5% và nút thử lỗi vượt hạn mức (`:67`) |
| F6R2-04 TN, RPT-10, RPT-01 | **Đạt** | Lọc TN như trên; thẻ RPT-10 không còn trong danh sách thẻ RPT-01 (grep trong `pack.js`/trang: RPT-10 chỉ mở từ con số) |
| F6R2-05 Nhóm chi nhánh | **Đạt** | `g4-sys-05.html:49–58`: bảng nhóm (Miền Nam: Quận 7, Quận 1, Thủ Đức, Biên Hòa, QV Nguyễn Văn Hùng; Miền Trung: Đà Nẵng, chưa giao QV), AD đề xuất, drawer đổi nhóm có ngày hiệu lực và CH duyệt, một chi nhánh một nhóm; SYS-02 gán QV theo nhóm |
| F6R2-06 hàng chờ SYS-06, 11, 13 | **Đạt** | `g4rPending` ở SYS-06 (CH), SYS-11 (CH), SYS-13 (QL, tham số `roles`, `who`), cùng component |
| F6R2-07 hạng RPT-02 | **Đạt** | `pack.css:131–134` dùng CSS counter trên hàng đang hiện; tag "Ngừng nhận lệnh mới" cho Đà Nẵng ở RPT-02 và RPT-03 |
| F6R2-08 DSO, số lệnh Đà Nẵng | **Đạt** | RPT-08 không còn `kpi--danger`; SYS-05 `:62` ghi 7 lệnh đang mở (Đã duyệt 1, Đang sửa 3, Tạm dừng 1, Chờ QC 1, Sẵn sàng 1 = 7, khớp chart RPT-04) và 5 lệnh Hoàn tất còn công nợ ở mục riêng |
| F6R2-09 tách quyền xuất | **Đạt (kèm F6R3-01)** | `g4-sys-04.html:82–94`: cột "Xuất báo cáo (đã che)" và "Xuất cột cá nhân đầy đủ" (chỉ ở Hồ sơ khách và xe; chức năng khác hiện "–"); mặc định bật cho CH, KT; AD khóa kèm lý do; bỏ tick Xem thì cả ba cột phụ thuộc bị tắt (`:113–114`) |
| Khóa hai bước SYS-05 | **Đạt (kèm F6R3-02)** | `:62`: bước 1 gõ NGUNG, CH trực tiếp / AD đề xuất; bước 2 chặn khi còn mục treo, bổ sung lệnh bảo hành, kiểm kê chưa duyệt, tiền quỹ, đơn mua chưa nhận, chuyển kho; tồn kho phải chọn cách xử lý; KHOA khi mở nút |

## 2. Finding mới do chỉnh sửa (F6R3)

### F6R3-01 · Minor · "Xuất cột cá nhân đầy đủ" chưa ràng buộc với quyền che dữ liệu cá nhân
- **Vị trí:** `g4-sys-04.html:94` (`allowed = lv !== '-' && ri !== 9`).
- **Vấn đề:** vai trò Thợ (Xn, ở tab "Che dữ liệu cá nhân" luôn Không hiển thị) vẫn bật được ô xuất cột cá nhân; ô này cũng không liên động với trần che (TK không xem địa chỉ). Xuất không được vượt mức hiển thị.
- **Cách sửa:** khóa ô khi mức che của vai trò đó là "Không hiển thị" hoặc "Che, không có Hiện" (TH, TK, AD), kèm lý do; ghi chú liên kết với tab Che dữ liệu cá nhân.

### F6R3-02 · Minor · Hộp thoại khóa chi nhánh: số mục treo và vai trò AD
- **Vị trí:** `g4-sys-05.html:62` (`dlg-lockbr` tiêu đề "còn 4 mục treo" nhưng liệt kê 5 dòng cụ thể + 1 dòng "cũng chặn khi có"); `dlg-stop` dùng một nút "Ngừng nhận lệnh mới" cho cả CH và AD.
- **Vấn đề:** số đếm không khớp danh sách; với AD thao tác phải là "Gửi Chủ garage duyệt" (như đã ghi trong hộp thoại) chứ không báo "Đã ngừng nhận lệnh mới".
- **Cách sửa:** đổi thành "còn 5 mục treo"; đổi nhãn nút và thông báo theo vai trò (AD: "Gửi Chủ garage duyệt").

### F6R3-03 · Minor · RPT-04: chú thích biểu đồ còn ghi tổng 42 cho Quản lý vùng
- **Vị trí:** `g4-rpt-04.html:35` (`unit: '… tổng 42 lệnh'`), bảng và bản ghi mobile chỉ ghi 35 ở KPI.
- **Vấn đề:** QV thấy 4 chi nhánh (35 lệnh) nhưng chú thích đơn vị vẫn "tổng 42" – số không khớp tổng các thanh đang hiển thị (RULE-015, FR-RPT-001 tổng khớp).
- **Cách sửa:** hai biến thể chú thích (`g4r-v-ch` 42 / `g4r-v-qv` 35) như đã làm ở KPI.

### F6R3-04 · Minor · Tài liệu: mục 15 đứng trước mục 14
- **Vị trí:** `06-reports-system.md` (mục 15 ở dòng 340, mục 14 "Điểm yếu còn lại" ở dòng 356).
- **Cách sửa:** đánh số lại: "Finding vòng 2" thành 14, "Điểm yếu còn lại" thành 15, hoặc đổi thứ tự; cập nhật các tham chiếu "mục 14" trong §11 và §13.

## 3. Chuyển cho dev (không chặn)

- **Lọc theo vai trò/phạm vi bằng CSS và `data-*`** (QV, KT, CV, TN, TK, `g4r-v-*`, `g4r-notqv`…) chỉ minh họa; sản phẩm thật phải lọc ở máy chủ, tính tổng theo quyền (NFR-ISO-01, UAT-06).
- **Hàng chờ duyệt thật** thuộc G4-APR-01/02/03 (gói 5): khối "Yêu cầu chờ … duyệt" và hộp thoại "Duyệt yêu cầu" là cơ chế minh họa; mapping loại yêu cầu → cấp duyệt, chuyển cấp khi quá hạn (FR-SYS-015) làm ở gói đó.
- Mật khẩu xác nhận (`ap-pw`, `data-g4r-pw`) chỉ là ô minh họa; xác thực lại phải do máy chủ kiểm.
- `document.write` ghép khung, `SYS_ALLOW` trùng `data-allow`, `title` trên nút `disabled`, roving tabindex ma trận, skeleton theo hình, đo tương phản chữ trắng trên 5 màu biểu đồ, kiểm tra bố cục thực tế 320/768/1280 px (như `review-06-round2-ba.md` mục 5).

## 4. Kiểm tra số liệu cuối

RPT-03: 22.590.909 × 1,1 = 24.850.000; 19.350.000 + 5.500.000 = 24.850.000; tiền vào quỹ 21.650.000 = 19.350.000 + 1.800.000 + 500.000; tổng 5 chi nhánh 116.818.181 (× 1,1 = 128,5 tr), QV 91.954.545. RPT-04: Đà Nẵng 7 lệnh (1 + 3 + 1 + 1 + 1), QV 35 = 42 − 7. RPT-10 (TN): 15.090.909 × 1,1 ≈ 16.600.000. RPT-02, RPT-08 giữ nguyên các số đã kiểm ở vòng 2.
