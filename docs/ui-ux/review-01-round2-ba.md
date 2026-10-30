# BA Review vòng 2 – Gói G1 Xác thực và Dashboard theo vai trò

Phiên bản 0.1 · 30/10/2026 · Người lập: BA · Trạng thái: **bản đầy đủ** (đã ghi nháp sớm rồi hoàn thiện) · Đối tượng: `design/g1-auth-dashboard/*`, `docs/ui-ux/01-auth-dashboard.md` §10 (rủi ro JS), §11 (bảng tự khai), §12 (11 câu hỏi).

Phương pháp: review tĩnh, đối chiếu từng finding vòng 1 với **mã thực tế** (không dựa vào bảng tự khai §11); chưa chạy trình duyệt. Mọi quyết định ở mục 4 là **BA đề xuất — chờ xác nhận**.

## 1. Kết luận

**CHƯA ĐẠT (còn 2 Major nhỏ, sửa nhanh; không còn Blocker).** Sau khi sửa F1R2-01 và F1R2-02 thì ĐẠT mà không cần review lại toàn gói.

| Mức | Còn mở |
| --- | --- |
| Blocker | 0 |
| Major | 2 (F1R2-01, F1R2-02) |
| Minor | 3 (F1R2-03, F1R2-04, F1R2-05) |
| Chuyển cho dev, không chặn | 9 mục (mục 5) |

29/29 finding vòng 1: **26 Đạt, 3 Một phần** (F1-14, F1-23, F1-28) nhưng cả ba đã được BA trả lời ở mục 4 và không còn việc nghiệp vụ nào cho designer ngoài F1R2-05.

## 2. Kiểm từng finding vòng 1 trong mã thực tế

| Finding | Kết quả | Bằng chứng (file:vị trí) |
| --- | --- | --- |
| F1-01 thiếu 3/10 câu | Đạt | `g1-dsh-01.html:86-88`: “Xe trễ hẹn giao” (Quận 7: 3, Đà Nẵng: 1, mở danh sách), “Thợ quá tải” (2), “Phụ tùng thiếu hoặc tồn lâu” (12 + 7). Xem F1R2-03 về đích liên kết |
| F1-02 nhãn số tạm | Đạt | `data-figure="Số tạm"` + `data-figure-tip` nêu chi nhánh/ngày chưa chốt ở dsh-01 (dòng 12), 02, 03, 06, 08; shell hiện tip (`g1-shell.js:113`) |
| F1-03 công thức lợi nhuận | Đạt | `g1-dsh-01.html:30-32`: “Lợi nhuận gộp (chưa gồm nhân công)”, nút “Cách tính” `aria-expanded`, công thức, “Chưa gồm”, phạm vi; giá trị tồn `:35-37` |
| F1-04 quyền lợi nhuận | Đạt | DSH-03 có KPI lợi nhuận chi nhánh; DSH-06 không có KPI |
| F1-05 khóa tạm | Đạt (tài liệu) | Bộ đếm A/B/C trong `01-auth-dashboard.md` §4.2; AUT-01 giữ thông báo trung lập; DSH-10 đổi KPI |
| F1-06 MFA | Đạt | `g1-aut-02.html:17,40,57`: ô “tin cậy” ẩn với KT/AD (`data-hide="kt"`), nút email chỉ ở `optional`; AUT-01 không còn “Ghi nhớ thiết bị” |
| F1-07 email | Đạt | PRF-01 có “Đổi email”; PRF-02 có quy trình (6 điểm khớp “Đổi email/email mới/email cũ”) |
| F1-08 thợ mất mạng | Đạt có lưu ý | `g1-dsh-07.html:27,121-122`: chặn 3 thao tác, “đồng hồ hệ thống vẫn chạy”, phiếu giấy. Lưu ý nút “Báo quản đốc” khi mất mạng: F1R2-02 |
| F1-09 luồng PIN | Đạt | `g1-aut-10.html:17`: trạng thái `setpin`, `locked` (đến khi QĐ/QL mở), `revoked`, mã ghép |
| F1-10 xe trễ hẹn | Đạt | DSH-01: 3 + 1; DSH-02 `late: 3`; DSH-03 KPI 03 (tên “Xe trễ hẹn giao”); DSH-09 03 |
| F1-11 phải trả quá hạn | Đạt | `g1-dsh-06.html:32` “43,6” khớp 28,1 + 9,8 + 5,7 (`:57`) |
| F1-12 button trong `<a>` | Đạt | KPI có nút là `<article>` (dsh-01:30,35); `g1-charts.js:322-337` `retag` đổi `<a>` thành `<div>` khi lỗi/tải/trống |
| F1-13 trạng thái từng thẻ | Đạt | `g1-charts.js:343,357-358` chip “Cập nhật 07:58” / “Số lúc 09:14”; `data-g1-deny` chỉ còn ở DSH-01 (3), 02 (1), 03 (2), nút xem thử không hiện “0 khối” |
| F1-14 tìm kiếm theo vai trò | Đạt (sau câu 10 mục 4) | `g1-shl-02.html:101-107,117-124`: ma trận 10 vai trò, AD không tìm dữ liệu nghiệp vụ, tối thiểu 3 ký tự, SĐT chỉ khớp số đầy đủ với CH/QV/KT, TK/TH/AD không tìm SĐT. TH không có hàng khách: **khớp** quyết định mục 4 câu 10 |
| F1-15 xe của tôi | Đạt | DSH-04 nhãn “Xe của tôi trong xưởng” |
| F1-16 thu ròng | Đạt | DSH-06 KPI “Thu ròng” |
| F1-17 RULE-007/cọc | Đạt | Không còn viện dẫn sai trong DSH-08; câu hỏi cọc trả lời ở mục 4 câu 8 |
| F1-18 ảnh | Đạt | `g1-prf-01.html:32` `accept="image/jpeg,image/png"` |
| F1-19 cột vai trò | Đạt | PRF-01 vai trò thật + cờ khóa |
| F1-20 AUT-04 `h1` | Đạt | Có `data-focus-in` và chuyển focus (`g1-auth.js:26`) |
| F1-21 focus ô đầu | Đạt | `g1-auth.js:216` focus khi tải trang không có shell |
| F1-22 aria-describedby | Đạt | `g1-auth.js:45-47` lưu và khôi phục mô tả gốc |
| F1-23 kỷ luật token | **Một phần, chuyển dev** | Khối `<style>` đã vào `pack.css`; còn **128 dòng `style=`** ở 26 file (nhiều nhất `g1-aut-06` 18, `g1-aut-03` 15, `g1-dsh-09` 8, `g1-aut-09` 8, `g1-err-04` 7). Chủ yếu khoảng cách/căn lề; không có màu cứng. Xem mục 4 |
| F1-24 điểm số tạm | Đạt | `g1-charts.js:51,67,115,149,179` điểm `provisional`, dữ liệu ngày 30/10 là 24,8 (nửa buổi). Xem F1R2-04 về độ lệch của delta |
| F1-25 vùng đọc biểu đồ | Đạt | `role=tooltip` đã bỏ; `aria-live` chỉ cập nhật khi dùng phím |
| F1-26 KPI đăng nhập | Đạt | DSH-10 “Lượt khóa tạm”, “tên đăng nhập bị dò” |
| F1-27 cộng lẫn đơn vị | Đạt | DSH-05 theo % so với định mức |
| F1-28 bộ lọc | **Một phần, chuyển dev** | `g1-charts.js:279` kiểm tra tương lai/366 ngày/Đến ≥ Từ; kỳ và chi nhánh vẫn không điều khiển KPI/biểu đồ (ghi rõ hạn chế). Chấp nhận ở prototype |
| F1-29 số mẫu | Đạt | `g1-err-05.html:40` placeholder “[Số tổng đài – lấy từ cấu hình]”; có hai trạng thái chưa/đã cấu hình |
| R1–R8 | Đạt | `<noscript>` ở cả 32 trang; `esc()` thoát đủ `& < > " '` (`g1-charts.js:24`); `data-g1-chartview` tách khỏi `data-g1-view`; §10 liệt kê 9 điều bàn giao |

Số liệu mẫu sau chỉnh sửa vẫn khớp (đã cộng lại): 5 chi nhánh 496,7 + 400,6 + 355,4 + 235,9 + 183,7 = 1.672,3; lợi nhuận 161,4 + 115,0 + 94,2 + 50,7 + 36,7 = 458,0 (27,4%); chuỗi ngày tháng 10 cộng 1.672,3 (có ngày 30/10 = 24,8); nhóm Miền Nam 1.488,6 và 421,3; mọi biên chi nhánh khớp; DSH-06 phải thu 142,3, phải trả 96,0.

## 3. Finding mới vòng 2 (chỉ điểm có tác động nghiệp vụ/an toàn)

### Major

**F1R2-01 – Chip “Chỉ xem” dưới menu của Chủ garage không phản ánh quyền Duyệt của FRD §2**
- Kết luận về câu hỏi “CH nên có toàn quyền?”: **không**. FRD §2 chủ ý cho CH vai trò giám sát: **X** ở hồ sơ khách, báo giá và lệnh, phân thợ, công thợ, thu tiền, công nợ, hóa đơn, báo cáo; **D (duyệt)** ở danh mục phụ tùng, chuyển kho liên chi nhánh, người dùng/phân quyền/cấu hình; X ở nhập xuất kho. Vì vậy phần lớn chip “Chỉ xem” **đúng**, không cần đổi sang toàn quyền (CH không tạo/sửa chứng từ của chi nhánh, tránh bỏ qua phân tách trách nhiệm).
- Lỗi: `design/assets/app.js:333` đặt CH `inv: 'view'` (Kho phụ tùng) và `set: 'full'` (không chip), trong khi CH có **D** ở danh mục phụ tùng và chuyển kho, và DSH-01 có nút “Mở hàng chờ phê duyệt” cho chính các việc đó. Hiện chip “Chỉ xem” dưới Kho phụ tùng mâu thuẫn với màn hình. Tương tự QV (`:334`) có D ở chuyển kho nhưng `inv: 'view'`. Ngoài ra QL (`:335`) `fin: 'full'` trong khi FRD cho QL **D** ở thu tiền và **X** ở công nợ/giá vốn (không phải S).
- Sửa: thêm chế độ nhãn **“Xem và duyệt”** (`approve`) dùng cho CH: Kho phụ tùng, Cài đặt (Người dùng, cấu hình); QV: Kho phụ tùng (chuyển kho); QL `fin` đổi thành “Duyệt thu chi, xem công nợ” hoặc tách mục. Ghi bảng quyền → chip vào `01-auth-dashboard.md`. (Menu chip là minh họa; quyền thật do máy chủ, §10.1.)

**F1R2-02 – Nút “Báo quản đốc ghi hộ” báo thành công khi đang mất mạng**
- `g1-dsh-07.html:27`: khối chỉ hiện lúc mất mạng, nút dùng `data-toast="success|Đã báo quản đốc|..."`. Khi mất mạng thông báo không thể gửi, nên toast “Đã báo” là xác nhận sai: thợ tin quản đốc đã biết, giờ công bị bỏ (BR-HRM-03).
- Sửa: bỏ nút gửi khi mất mạng; thay bằng chỉ dẫn “Nói trực tiếp với quản đốc, ghi giờ thật lên phiếu giấy” và nút “Gửi khi có mạng” đưa yêu cầu vào hàng chờ cục bộ với trạng thái “Chờ gửi” (không phải trạng thái hạng mục); toast chỉ nói “Sẽ gửi khi có kết nối”.

### Minor

**F1R2-03 – “Thợ quá tải” trên DSH-01 dẫn tới dashboard của vai trò khác**: `g1-dsh-01.html:87` `data-target="G1-DSH-09"` (Tổng quan Quản đốc). CH không có dashboard đó; đích đúng là danh sách phân thợ/tải việc ở chế độ xem (G2-REC-05, CH có X). Sửa đích đến.

**F1R2-04 – Delta “+5,8% so với 01–30/09” so sánh tháng có ngày 30/10 mới nửa buổi (24,8) với cả tháng 9**: `g1-dsh-01.html:29` (và dsh-02, dsh-06). Làm giảm mức tăng so với thực tế (ngày 30/9 là 61,5 tr). Sửa theo quy tắc mục 4 câu 12: khi ngày cuối của kỳ là số tạm thì so với kỳ trước **đến cùng giờ** hoặc ghi “chưa gồm cả ngày 30/10”; dữ liệu mẫu điều chỉnh tương ứng.

**F1R2-05 – Thẻ việc của Thợ chưa có tên khách (tùy chọn)**: tìm kiếm của TH đúng (không hàng khách), nhưng DSH-07 chỉ có biển số và xe; FRD §2 cho TH **Xn** hồ sơ khách (tên + biển số). Bổ sung tên khách rút gọn (ví dụ “Anh An”) vào thẻ việc nếu muốn xưng hô với khách; không SĐT, không địa chỉ. Nhỏ, có thể bỏ nếu khách không cần.

## 4. Trả lời 11 câu §12 và các mục “chưa xử lý trọn vẹn” (BA đề xuất — chờ xác nhận)

1. **KT, QĐ có bắt buộc MFA không**: KT **bắt buộc**, QĐ **không** (cấu hình theo vai trò, vai trò mạnh nhất quyết định khi có nhiều vai trò). Vẫn gửi khách xác nhận; prototype giữ nguyên.
2. **Mốc doanh thu và nhân công**: doanh thu ghi nhận theo **ngày lệnh Hoàn tất/giao xe** (giá trị chưa VAT, sau chiết khấu, trừ hoàn tiền), khớp FR-RPT-003 (phiếu thu + công nợ phát sinh trong ngày). Nhân công trực tiếp **không** tính ở Phase 1; khi HRM có (Phase 2) lấy theo công thức công thợ đã cấu hình, bật bằng cờ. Cả hai chờ kế toán khách ký ví dụ (NFR-MNT-01).
3. **Số tổng đài, giờ làm việc**: khách phải cung cấp; đưa vào **danh sách kiểm tra trước pilot** (không có số thì ERR-05 dùng trạng thái “chưa cấu hình”, đã thiết kế).
4. **Văn bản quy định, thời hạn lưu**: do luật sư của khách soạn và ký; là điều kiện trước khi pilot. Bằng chứng đồng ý lưu trong suốt thời gian tài khoản còn hiệu lực cộng thời hạn theo ý kiến luật sư (BA không ấn định số năm). Prototype giữ “Nội dung mẫu”.
5. **Chặn ghi giờ khi mất mạng ở Phase 1**: đề xuất **chốt chặn**, vì pilot một chi nhánh, mạng mất ngắn, và giờ công ảnh hưởng hoa hồng. Điều kiện kèm theo: phiếu giấy A5 in sẵn tại xưởng và quy trình nhập bù ở câu 6.
6. **Quản đốc nhập bù hộ thợ**: **Có**. Bắt buộc ghi lý do, nhãn “Nhập bù”, giờ khai báo của thợ, nhật ký (FR-SYS-003); chênh lệch so với đồng hồ hệ thống **≤ 15 phút** QĐ tự nhập, **> 15 phút** cần QL duyệt; thợ xác nhận lại bằng PIN khi có mạng. Ngưỡng là tham số.
7. **Định nghĩa**:
   - **Thợ quá tải** = tổng giờ chuẩn của hạng mục chưa Hoàn thành đã giao cho thợ trong ngày **lớn hơn** giờ khả dụng của thợ (ca làm trừ giờ nghỉ/vắng, cấu hình). “Gần đầy” từ 90% (cảnh báo vàng). Dùng giờ chuẩn, không dùng giờ thực.
   - **Chậm luân chuyển** = mặt hàng có tồn khả dụng lớn hơn 0 và **không có xuất kho** trong N ngày; N mặc định **90 ngày**, cấu hình theo nhóm hàng (lốp, ắc quy khác phụ tùng tiêu hao); loại hàng nhập trong vòng N ngày. Căn cứ FR-RPT-005, RULE-008.
8. **Tiền cọc và RULE-007**: chốt **cọc gắn báo giá** (không phải thu ngoài chứng từ); khi lệnh tạo từ báo giá, khoản cọc được liên kết sang lệnh (liên kết mới, không xóa phiếu, RULE-010). Cọc bị hoàn khi khách từ chối ghi bằng phiếu hoàn (“Hoàn tiền”). Đề xuất đổi chữ RULE-007 thành “Phụ tùng xuất, thanh toán và hóa đơn phải gắn với lệnh sửa chữa, phiếu bán lẻ hoặc (riêng tiền cọc) báo giá”. Cách xử lý hóa đơn cho tiền cọc: `[Cần xác nhận]` với kế toán khách.
9. **Hạn đăng ký lại thiết bị xưởng và giới hạn dò tên**: đăng ký lại mỗi **90 ngày**; mỗi thiết bị tối đa **20 lần sai PIN trong 15 phút (tính mọi tên)** thì khóa thiết bị 15 phút, QĐ/QL mở sớm; 5 lần sai trên một tên khóa tên đó đến khi QĐ/QL mở (đã quyết vòng 1). Tham số ở G4-SYS-24.
10. **Tìm kiếm của TH**: nhóm “Việc của tôi” gồm hạng mục và lệnh được giao, hiển thị biển số, xe, mã lệnh; tìm theo biển số, mã lệnh, tên hạng mục. **Không** tìm và không liệt kê khách trong danh sách tìm; tên khách (không SĐT, không địa chỉ) chỉ hiện ở chi tiết việc. Prototype hiện đúng như vậy, chỉ thiếu tên khách ở thẻ việc (F1R2-05, tùy chọn).
11. **QL xem lợi nhuận khi ngày chưa chốt**: **không cần nhãn riêng**; dùng nhãn “Số tạm” hiện có và tooltip nêu ngày chưa chốt. Ghi thêm trong “Cách tính”: giá vốn bình quân gia quyền có thể đổi khi nhập hàng sau, nên lợi nhuận chỉ ổn định khi chốt ngày.
12. **Quy tắc kỳ so sánh khi ngày cuối là số tạm** (bổ sung từ F1R2-04): so sánh với kỳ trước đến cùng giờ, hoặc ghi chú “chưa gồm cả ngày”.

**Mục chưa trọn vẹn**
- **F1-14**: đóng. Câu 10 khớp prototype. Việc còn lại duy nhất là F1R2-05 (tùy chọn).
- **F1-23**: quy tắc đề xuất cho prototype: không dùng `style=` cho bố cục, khoảng cách, cỡ chữ, màu; chỉ cho phép giá trị **động** (độ rộng thanh tiến độ). 128 dòng còn lại thuộc loại khoảng cách/căn lề; **không chặn gói**, ghi vào mục “Chuyển cho dev” để dọn khi dựng component thật (vì đồng thời bị thay bằng component của stack).
- **F1-28**: chấp nhận ở prototype. Hành vi chuẩn cho dev: đổi kỳ hoặc chi nhánh làm mọi KPI, biểu đồ, bảng thay thế đổi theo cùng một truy vấn; KPI tại một thời điểm chỉ đổi theo chi nhánh; giới hạn 366 ngày; trên 92 ngày gộp theo tuần.

## 5. Chuyển cho dev (không chặn)

1. Dọn 128 thuộc tính `style=` (F1-23) thành class/token của component.
2. Bộ lọc kỳ/chi nhánh nối với truy vấn thật, một nguồn dữ liệu cho KPI, biểu đồ, bảng thay thế (F1-28, §10.6).
3. Roving tabindex cho lưới thẻ chi nhánh và thợ (§10.7).
4. Phân quyền, phạm vi chi nhánh, menu, tìm kiếm, tham số `?role=`, menu “xem thử vai trò”: chỉ minh họa; máy chủ lọc và gửi trước (§10.1). SĐT đầy đủ không có trong trang trước khi “Hiện”.
5. Khung điều hướng dựng phía máy chủ; `<noscript>` chỉ là đường lui (§10.2).
6. Hạn phiên, đếm lùi, khóa màn hình, khóa PIN do máy chủ cấp (§10.4).
7. Tương phản màu đo thật, trình đọc màn hình, bố cục ở 1440/1024/768/390 px, phông WOFF2 (phụ thuộc trình duyệt/thiết bị).
8. Liên kết `data-target` sang gói G2/G3/G4 chưa dẫn đi đâu (nối khi các gói hoàn thiện).
9. Dữ liệu mẫu cố định; công thức tổng, tuổi nợ, lợi nhuận cần test đơn vị và ví dụ kế toán duyệt (NFR-MNT-01).

## 6. Tài liệu cần cập nhật (chưa làm)

`01-auth-dashboard.md` §11 (đổi F1-14 thành Đạt, thêm F1R2), §12 (xóa 11 câu đã trả lời), bảng quyền → chip menu; `screen-inventory.md` D-02; FRD đề xuất ở `ba-answers-01.md` §D (thêm: FR-HRM nhập bù giờ công, định nghĩa thợ quá tải/chậm luân chuyển ở FR-RPT-005/006, cọc ở FR-ACC); BRD RULE-007 chữ như câu 8.
