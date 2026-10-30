# BA Review – Gói G1 Xác thực và Dashboard theo vai trò

Phiên bản 0.1 · 30/10/2026 · Người lập: BA · Đối tượng review: `design/g1-auth-dashboard/` (31 màn hình, `pack.css`, `g1-shell.js`, `g1-charts.js`, `g1-auth.js`, `index.html`) và `docs/ui-ux/01-auth-dashboard.md`.

Trả lời 15 câu hỏi của designer: `docs/ui-ux/ba-answers-01.md` (BA đề xuất — chờ xác nhận). Các cách sửa dưới đây dựa trên các quyết định đó.

## 1. Phạm vi và phương pháp

- **Review tĩnh, không chạy trình duyệt** (môi trường không có trình duyệt, giống designer). Chưa kiểm bố cục thực tế ở 1440, 1024, 768, 390 px, chưa đo tương phản, chưa thử trình đọc màn hình.
- **Đọc đầy đủ**: DSH-01 đến 10 (riêng DSH-05 đọc phần KPI, bảng đầu và biểu đồ), AUT-01, 02, 04, 10, 09 (phần cảnh báo), ERR-05, SHL-02, NTF-02, PRF-01, `g1-shell.js`, `g1-charts.js`, `g1-auth.js`.
- **Kiểm bằng tìm kiếm mẫu**: AUT-03, 05, 06, 07, 08, ERR-01..04, SHL-01, NTF-01, PRF-02 (autocomplete, type password, quy định, focus), toàn bộ `pack.css` (biến, cỡ chữ, màu cứng), toàn bộ thư mục (cỡ chữ dưới 12px, màu cứng trong `style`, `noscript`).
- Mức độ: **Blocker** = vi phạm quy tắc cứng hoặc tiêu chí nghiệm thu, chưa thể chốt gói; **Major** = sai lệch nghiệp vụ, bảo mật hoặc khả năng tiếp cận cần sửa trước khi bàn giao cho dev; **Minor** = hoàn thiện.

## 2. Kết quả tổng

| Mức | Số finding |
| --- | --- |
| Blocker | 2 |
| Major | 12 |
| Minor | 15 |
| **Tổng** | **29** |

## 3. Đối chiếu theo danh mục yêu cầu

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Đủ 31 màn hình | Đạt | Đủ SHL 2, AUT 10, ERR 5, DSH 10, NTF 2, PRF 2; cộng `index.html`, `pack.css`, 3 file js |
| Token và class có thật | Đạt, có ngoại lệ | Mọi `var(--...)` trong `pack.css` đều có trong `tokens.css`; không có màu hex hoặc rgb trong `pack.css`; không có cỡ chữ dưới 12px (chữ biểu đồ 12px). Ngoại lệ: F1-23 |
| Không đăng ký tự do (D-01) | Đạt | AUT-01 chỉ có “Quên mật khẩu”; dòng dẫn nói nhờ quản lý gửi lời mời; AUT-06 kích hoạt bằng lời mời có hạn |
| Lỗi xác thực không lộ tài khoản | Đạt ở giao diện, yếu ở cơ chế | AUT-01, AUT-04, ERR-05 trung lập. Cơ chế khóa chỉ theo (thiết bị + tên) chưa chặn dò phân tán: F1-05 |
| Mỗi role một dashboard đúng design-system §8 | Đạt | Xem bảng 3.1 |
| 10 câu hỏi sáng của chủ garage (BRD §3) | **Không đạt** | Thiếu 3/10 trên DSH-01: F1-01 |
| Biểu đồ đúng §9 | Đạt, có finding nhỏ | Xem bảng 3.2 |
| RULE-015 | **Không đạt** ở nhãn số tạm/chính thức | F1-02, F1-24 |
| 5 đối tượng, trạng thái tách riêng | Đạt | DSH-04, 08 hiện lệnh, thanh toán, hóa đơn là ba badge riêng; báo giá “Chờ khách duyệt” (Warning); “Chờ phụ tùng” là tag lý do của Tạm dừng; hóa đơn lỗi là chỉ báo `sync`, không thành trạng thái |
| Badge luôn có chữ; không 11px | Đạt | Mọi badge, tag, delta có chữ; tìm không thấy cỡ chữ dưới 12px |
| Touch target tablet thợ | Đạt | Nút thợ 52px, lý do tạm dừng 64px, PIN 64/72px, thẻ chi nhánh 64px; segmented lên 44px ở cảm ứng |
| Trạng thái từng thẻ | Một phần | F1-12, F1-13 |
| Accessibility form đăng nhập | Đạt, có finding nhỏ | Label, `autocomplete` đúng (username, current-password, new-password, one-time-code), hiện/ẩn mật khẩu có nhãn và `aria-pressed`, Caps Lock, lỗi nêu cách sửa kèm ví dụ, OTP có `aria-label` từng ô. F1-20, F1-21, F1-22 |
| NFR bảo mật | Một phần | F1-05, F1-06, F1-07, F1-09 |
| Rủi ro dựng bằng JS | Có | Mục 6 |

### 3.1 Dashboard theo vai trò so với design-system §8

| Dashboard | Yêu cầu §8 | Kết quả |
| --- | --- | --- |
| DSH-01 CH | doanh thu chuỗi, lợi nhuận theo chi nhánh, xe đang sửa, chi nhánh tốt/kém, việc cần phê duyệt | Đủ; thiếu phần trả lời câu 3, 4, 5 của BRD (F1-01) |
| DSH-03 QL | xe đang tiếp nhận, việc quá hạn, kỹ thuật viên, kho sắp hết, doanh thu trong ngày | Đủ (có thêm chốt ngày và hàng chờ duyệt); tên “Công việc quá hạn” cần đổi (F1-10) |
| DSH-04 CV | lịch hẹn, xe chờ tiếp nhận, báo giá chờ khách duyệt, xe đang sửa, xe chờ bàn giao | Đủ; “xe chờ tiếp nhận” chỉ có KPI, không có danh sách riêng (chấp nhận được vì nằm trong lịch hẹn) |
| DSH-05 TK | phiếu nhập, phiếu xuất theo lệnh, yêu cầu cấp phụ tùng, tồn thấp, điều chuyển | Đủ; thêm kiểm kê |
| DSH-06 KT | doanh thu, thu chi, công nợ phải thu/trả, hóa đơn, đối soát | Đủ |
| DSH-07 TH | việc được giao | Đủ; không có hoa hồng (đúng) |
| DSH-08 TN | thu tiền, ca, hóa đơn | Đủ |
| DSH-02, 09, 10 | bổ sung của BA (D-09) | Đủ |

### 3.2 Biểu đồ so với design-system §9

| Biểu đồ | Loại | Kết quả |
| --- | --- | --- |
| DSH-01, 02 doanh thu theo ngày | Đường, kỳ trước nét đứt | Đúng; trục từ 0 |
| DSH-01 doanh thu và lợi nhuận theo chi nhánh | Thanh ngang nhóm | Đúng §9 (so sánh nhiều chi nhánh bằng thanh ngang, không tròn) |
| DSH-03 lệnh mở theo loại dịch vụ × trạng thái | Thanh ngang xếp chồng | Đúng; chú giải và bảng thay thế vì màu biểu đồ khác màu badge |
| DSH-05 tồn khả dụng theo nhóm | Cột + vạch định mức | Đúng loại; xem F1-27 về đơn vị |
| DSH-06 tuổi nợ | Thanh xếp chồng | Đúng; số khớp KPI phải thu, lệch phải trả (F1-11) |
| DSH-06 thu chi 7 ngày, DSH-10 đăng nhập thất bại | Cột nhóm | Đúng |
| DSH-09 tải việc thợ | Bảng + thanh tiến độ | Đúng “Table + bar”; có `role=progressbar` và nhãn chữ |
| Chung | Tên + đơn vị + phạm vi + kỳ dưới tên; tooltip chuột, chạm, phím; nút “Bảng số liệu” có tổng; không tròn, 3D, hai trục; không dùng đỏ/xanh lá trang trí (dãy dữ liệu dùng `--chart-series-*`) | Đạt. Hạn chế: bộ lọc chi nhánh/kỳ chưa điều khiển mọi biểu đồ trong prototype (F1-28) |

## 4. Findings

### 4.1 Blocker

**F1-01 – DSH-01 không trả lời đủ 10 câu hỏi buổi sáng của chủ garage** (BRD §3, “hệ thống đạt mục tiêu khi chủ garage trả lời được các câu sau từ dashboard mà không cần gọi từng chi nhánh”)
- Vị trí: `design/g1-auth-dashboard/g1-dsh-01.html:28-87`.
- Đối chiếu: câu 1 (xe đang sửa) đạt, câu 2 (chi nhánh tốt nhất) đạt, câu 6 (doanh thu cao nhưng lợi nhuận thấp) đạt nhờ bảng biên lợi nhuận, câu 7 (khách nợ) đạt, câu 8 (tiền mặt khớp) đạt qua cảnh báo lệch quỹ, câu 9 (khoản chi chưa duyệt) đạt, câu 10 (chi nhánh cần can thiệp) đạt qua tag “Cần chú ý”. **Thiếu**: câu 3 (lệnh nào chậm: chỉ có số “03” ở dòng cảnh báo, không đi tới danh sách và không nói chi nhánh nào ngoài chuỗi chữ phụ), câu 4 (thợ nào quá tải: không có), câu 5 (phụ tùng thiếu hoặc tồn lâu: chỉ có KPI giá trị tồn, không có cảnh báo thiếu hay tồn chậm luân chuyển).
- Cách sửa: thêm vào khối “Cảnh báo ngoại lệ” hai dòng “Thợ quá tải” (số thợ vượt giờ khả dụng, theo chi nhánh, đi sâu tới DSH-09/G2-REC-05 của chi nhánh đó) và “Phụ tùng thiếu hoặc tồn lâu” (số mặt hàng dưới định mức theo tồn khả dụng, số mặt hàng chậm luân chuyển, đi sâu tới G3-INV/FR-RPT-005); dòng “Xe trễ hẹn giao” đi tới danh sách lệnh trễ hẹn (FR-RPT-011, FR-RPT-012) thay vì `href="#"`. Lệnh chậm dùng đúng định nghĩa ở ba-answers câu 7. Cập nhật bảng ánh xạ câu hỏi (§4.4 của `01-auth-dashboard.md`) để có một cột “câu BRD §3 nào”.

**F1-02 – Nhãn số tạm/chính thức mâu thuẫn dữ liệu trên cùng màn hình (RULE-015, FR-RPT-010)**
- Vị trí: `g1-dsh-01.html:12`, `g1-dsh-02.html:12`, `g1-dsh-06.html:12` có `data-figure="Số tạm hôm nay · đã chốt đến 29/10/2026"`. Cùng lúc `g1-dsh-06.html:80`, `g1-dsh-03.html:27`, `g1-dsh-08.html:77` nói “Chưa chốt ngày 29/10” của Quận 7, và `g1-dsh-01.html:82` nói lệch quỹ Thủ Đức 29/10 còn chờ giải trình (FR-ACC-004 chặn chốt khi còn chênh lệch chưa giải trình).
- Hệ quả: người dùng đọc “đã chốt đến 29/10” trong khi có ít nhất hai chi nhánh chưa chốt, đúng điều RULE-015 muốn tránh.
- Cách sửa: áp quy tắc ba-answers câu 5: chuỗi chỉ ghi “Số chính thức” khi mọi chi nhánh trong phạm vi đã chốt, nếu không là “Số tạm”, tooltip liệt kê chi nhánh chưa chốt và ngày chốt gần nhất của từng nơi; KPI tại một thời điểm dùng “Tại hh:mm”. Sửa `data-figure` của DSH-01, 02, 06 và thống nhất dữ liệu mẫu (Quận 7 và Thủ Đức chưa chốt 29/10).

### 4.2 Major

**F1-03 – KPI lợi nhuận gộp ghi công thức thiếu và không nói rõ phạm vi Phase 1**
- Vị trí: `g1-dsh-01.html:30` “công thức theo cấu hình báo cáo (doanh thu trừ giá vốn)”, `g1-dsh-02.html:30`.
- Vấn đề: FR-RPT-013 định nghĩa lợi nhuận gộp quản trị là doanh thu trừ giá vốn phụ tùng **và nhân công trực tiếp**; mỗi báo cáo lợi nhuận phải hiện công thức và phạm vi. Phase 1 chưa có HRM (nhân công) nên con số sẽ cao hơn thực tế nếu không ghi chú.
- Sửa: nhãn “Lợi nhuận gộp (chưa gồm nhân công)” khi thành phần nhân công chưa bật, thêm nút “Cách tính” theo ba-answers câu 6; không dùng cụm “công thức theo cấu hình” như thể là công thức.

**F1-04 – Quyền xem lợi nhuận trái ma trận FRD §2**
- Vị trí: `01-auth-dashboard.md` §4.4 “Lợi nhuận gộp, giá trị tồn: không ở QL…”; `g1-dsh-03.html` không có KPI lợi nhuận; FRD §2 cho QL “X” ở “Báo cáo và dashboard”, KT “X” và “S” ở giá vốn.
- Vấn đề: giả định 5 của designer (chỉ CH, QV) mâu thuẫn FRD; bảng ở §4.4 còn nói KT không thấy lợi nhuận.
- Sửa: theo ba-answers câu 6: QL xem lợi nhuận gộp **của chi nhánh mình** (thêm KPI hoặc dòng trong DSH-03, ẩn được bằng quyền cấu hình), KT xem ở báo cáo (DSH-06 không cần KPI). Cập nhật bảng quyền trong tài liệu gói 1 và đưa quyền “xem lợi nhuận” thành quyền cấu hình ở G4-SYS-04 (FR-SYS-013).

**F1-05 – Khóa tạm chỉ theo (thiết bị + tên nhập), chưa chặn dò mật khẩu phân tán**
- Vị trí: `01-auth-dashboard.md` §4.2 dòng “Khóa tạm áp theo thiết bị + tên nhập”, §7 giả định 2; `g1-aut-01.html:23`.
- Vấn đề: kẻ tấn công đổi thiết bị hoặc trình duyệt thì có lại 5 lần thử; NFR-SEC-01/02 yêu cầu bảo vệ đăng nhập. Khóa cứng theo tài khoản thì bị lợi dụng để khóa người khác.
- Sửa: bộ đếm kép A, B, C trong ba-answers câu 1; giữ nguyên thông báo trung lập; DSH-10 thêm “lượt khóa tạm” và “tài khoản bị dò” (F1-26).

**F1-06 – MFA: mã dự phòng qua email, “tin cậy thiết bị” và “ghi nhớ thiết bị” chưa phân biệt theo rủi ro**
- Vị trí: `g1-aut-02.html:57-58` (nút “Gửi mã qua email thay thế” hiện cho CH, QV, QL, KT, AD), `g1-aut-02.html:40` (tin cậy 14 ngày cho mọi vai trò), `g1-aut-01.html:40` (“Ghi nhớ thiết bị này”).
- Vấn đề: email dự phòng cùng kênh với “Quên mật khẩu” nên hạ hai lớp thành một với vai trò tiền và quản trị. “Ghi nhớ thiết bị” ở bước mật khẩu không có định nghĩa, dễ bị hiểu là bỏ qua MFA hoặc giữ phiên.
- Sửa: theo ba-answers câu 2: ẩn email dự phòng với CH, QV, QL, KT, AD; ẩn ô tin cậy với KT, AD; bỏ “Ghi nhớ thiết bị này” ở AUT-01; thêm lối “Không còn mã? Nhờ người có thẩm quyền đặt lại xác thực” (đã có chữ ở trạng thái quá số lần).

**F1-07 – Email sửa trực tiếp ở hồ sơ, mâu thuẫn với chính dòng gợi ý**
- Vị trí: `g1-prf-01.html:47`: ô email sửa được và có nút Lưu, trong khi gợi ý nói “Đổi email cần xác nhận lại mật khẩu ở mục Bảo mật tài khoản”.
- Vấn đề: email là định danh đăng nhập và kênh khôi phục; phiên bị chiếm có thể đổi email để chiếm tài khoản (NFR-SEC-01).
- Sửa: ô email chỉ đọc kèm nút “Đổi email” (quy trình xác minh trong ba-answers câu 13) và thêm trạng thái “Đã gửi liên kết xác nhận tới email mới” ở PRF-02.

**F1-08 – Thợ mất mạng: DSH-07 chặn, ERR-04 lại thiết kế hàng đợi nhập bù; đồng hồ vẫn chạy**
- Vị trí: `g1-dsh-07.html:124-129` (MutationObserver tắt nút), `g1-err-04.html` (hàng đợi “Nhập bù”, xung đột đồng bộ).
- Vấn đề: hai màn nói hai hành vi khác nhau; thợ không bấm được “Hoàn thành” nhưng đồng hồ vẫn chạy, giờ công bị cộng thừa (BR-HRM-03).
- Sửa: theo ba-answers câu 4: Phase 1 chặn kèm phiếu giấy và “Báo quản đốc ghi hộ”, ghi chú “đồng hồ của hệ thống vẫn chạy”; ERR-04 đánh dấu hàng đợi nhập bù là thao tác của QĐ ở Phase 1 và của thợ ở Phase 2+. Thêm trạng thái xem thử “Mất kết nối” có nội dung này ở DSH-07.

**F1-09 – Thiếu luồng PIN tạm, đặt PIN lần đầu, mở khóa, thu hồi thiết bị xưởng**
- Vị trí: `g1-aut-10.html:44-45` (chỉ “Đã báo quản đốc”), `g1-prf-02.html`.
- Vấn đề: không có màn nào mô tả thợ đặt PIN lần đầu, PIN dễ đoán bị chặn, QĐ cấp lại PIN, mã ghép đăng ký tablet, thu hồi tablet mất (câu 3).
- Sửa: thêm vào AUT-10 trạng thái “Đặt PIN mới” (PIN tạm, chặn PIN dễ đoán, nhập hai lần) và “Thiết bị bị thu hồi”; ghi vào screen-inventory các trạng thái này và yêu cầu G4-SYS-03 có danh sách thiết bị, mã ghép, thu hồi.

**F1-10 – Số “xe trễ hẹn” không thống nhất giữa các dashboard; “Công việc quá hạn” khác nghĩa**
- Vị trí: `g1-dsh-01.html:83` và `g1-dsh-02.html:33` ghi Quận 7 có 2 xe trễ hẹn; `g1-dsh-03.html:34,53-55` và `g1-dsh-09.html:32` ghi Quận 7 có 3, cùng thời điểm 09:15. `g1-dsh-03.html` đặt tên “Công việc quá hạn” (lệnh quá giờ hẹn) trong khi `01-auth-dashboard.md` §7 giả định 4 nói đây là lệnh, còn thuật ngữ gợi hạng mục.
- Sửa: dùng một định nghĩa và một tên “Xe trễ hẹn giao” (ba-answers câu 7), thống nhất con số mẫu (3 ở Quận 7, tổng chuỗi 4 nếu thêm Đà Nẵng 1), danh sách ở DSH-03 khớp bảng điều phối (FR-RPT-012: “danh sách xe trễ hẹn khớp bảng điều phối”).

**F1-11 – Công nợ phải trả: KPI lệch với biểu đồ tuổi nợ**
- Vị trí: `g1-dsh-06.html:32` “15,5 tr ₫ quá hạn”; `g1-dsh-06.html:57` các dãy phải trả quá hạn 28,1 + 9,8 + 5,7 = 43,6 tr ₫. Tổng phải trả 96,0 và toàn bộ phải thu (142,3; quá hạn 63,7) đều khớp, chỉ riêng số quá hạn phải trả lệch.
- Vi phạm: FR-RPT-007 “số dư các nhóm tuổi bằng tổng số dư”, mọi con số đi sâu xuống chứng từ.
- Sửa: sửa “quá hạn” ở KPI thành 43,6 tr ₫ (hoặc sửa dữ liệu biểu đồ), kiểm lại “khoản phải trả đến hạn trong 3 ngày” (22,4 tr ₫) không vượt số chưa đến hạn.

**F1-12 – Thẻ KPI lỗi: nút “Thử lại” lồng trong thẻ liên kết**
- Vị trí: `g1-charts.js:297`; các KPI là `<a class="card kpi" href="#">` (ví dụ `g1-dsh-01.html:29`).
- Vấn đề: `<button>` bên trong `<a>` là HTML không hợp lệ, trình đọc màn hình và bàn phím xử lý sai, bấm nút còn kích hoạt liên kết `#`.
- Sửa: KPI là `<article class="card kpi">` với một liên kết phủ (stretched link) tới danh sách gốc; ở trạng thái lỗi bỏ liên kết. Ghi quy ước này vào component KPI, không chỉ trong prototype.

**F1-13 – Trạng thái “từng thẻ” chưa đủ**
- Vị trí: `g1-charts.js:314,321,328` và các dashboard.
- Vấn đề: (a) “Dữ liệu cũ” và “Mất kết nối” chỉ hiện banner chung, từng KPI vẫn trông như số mới, trong khi RULE-015 yêu cầu nêu thời điểm; (b) “Thiếu quyền” ở DSH-03 đến DSH-10 không có thẻ nào gắn `data-g1-deny` nên hiện “0 khối đã ẩn do vai trò hiện tại chưa được cấp quyền”, vô nghĩa; (c) “Trống” và “Lỗi” chỉ xem được ở những thẻ có `data-g1-empty`/`data-g1-err` (DSH-04 không có lỗi ở KPI, v.v.).
- Sửa: ở trạng thái cũ, mỗi KPI hiện chip “Cập nhật 07:58” và mờ số; ở mất kết nối hiện chip “Số lúc 09:14”; chọn mỗi dashboard một đến hai khối để minh họa “thiếu quyền” (ví dụ DSH-03 khối Kho khi người dùng không có quyền kho, DSH-06 khối Hóa đơn) hoặc ẩn nút xem thử khi không áp dụng; bảng ánh xạ trạng thái × thẻ nên ghi trong tài liệu gói.

**F1-14 – Tìm kiếm toàn cục chưa phân theo vai trò; TH và AD vẫn thấy ô tìm toàn hệ thống**
- Vị trí: `g1-shell.js:94` (ô tìm có cho mọi vai trò), `g1-shl-02.html` (chỉ minh họa vai trò QL; nhóm kết quả đủ 6 loại).
- Vấn đề: FRD §2 chỉ cho AD không xem dữ liệu nghiệp vụ, cho TH chỉ phần của mình, TK không xem hồ sơ khách. Câu hỏi 12 chưa có lời giải trong thiết kế.
- Sửa: theo ma trận ba-answers câu 12; thêm trạng thái xem thử theo vai trò (CV, TH, TK, AD, KT) cho SHL-02; thay thế ô tìm của AD; quy tắc tìm SĐT (đúng số đầy đủ với vai trò bị che, có ghi nhật ký).

### 4.3 Minor

**F1-15 – “Xe đang sửa của tôi” đếm cả lệnh Tạm dừng, trùng tên với “Xe đang sửa” của DSH-01** (`g1-dsh-04.html:33,80-82`). Đổi thành “Xe của tôi trong xưởng” và dùng trường “Cố vấn phụ trách” (ba-answers câu 7); mỗi dòng có badge trạng thái.

**F1-16 – KPI “Thu và chi (sổ quỹ)” hiện số ròng 412,8** (`g1-dsh-06.html:30`; thu 502,1 trừ chi 89,3). Đổi nhãn “Thu ròng (sổ quỹ)” và để thu, chi thành hai dòng phụ.

**F1-17 – Trích dẫn RULE-007 và phiếu cọc gắn báo giá** (`g1-dsh-08.html:42,64`). Phụ đề “Thu tiền luôn gắn với một lệnh sửa chữa (RULE-007)” nhưng RULE-007 (BRD dòng 274) nói về xuất phụ tùng; phiếu `PT-Q7-2610-00213` gắn `BG-Q7-2610-00229` (đặt cọc). Sửa câu chữ viện dẫn và hỏi/ghi rõ: tiền cọc gắn báo giá hoặc lệnh nào (BA đề xuất: cọc gắn báo giá đã gửi, chuyển sang lệnh khi khách duyệt; cần xác nhận cùng G-01).

**F1-18 – Ảnh đại diện: `accept="image/*"` nhưng gợi ý JPG/PNG tối đa 10 MB** (`g1-prf-01.html:32-33`). Đổi `accept="image/jpeg,image/png"`, giới hạn 2 MB, kiểm tra ở máy chủ.

**F1-19 – Bảng chi nhánh–vai trò hiện “Chỉ xem” ở cột Vai trò** (`g1-prf-01.html:54`). “Chỉ xem” là trạng thái do chi nhánh khóa, không phải vai trò; hiện vai trò thật và cờ “Chi nhánh đang khóa, chỉ xem”.

**F1-20 – AUT-04 trạng thái “Đã gửi” ẩn mất `h1` và không báo cho trình đọc màn hình** (`g1-aut-04.html:20,39-46`). Giữ `h1` hoặc chuyển `h2` thành `h1`; chuyển focus tới tiêu đề kết quả hoặc dùng vùng `role=status`.

**F1-21 – Tài liệu nói “focus vào ô đầu” nhưng mã chỉ focus sau khi gửi** (`01-auth-dashboard.md` §4.2; `g1-auth.js:82`, không có focus ban đầu). Hoặc đặt focus khi tải trang biểu mẫu một ô, hoặc sửa tài liệu.

**F1-22 – `aria-describedby` và gợi ý Caps Lock** (`g1-auth.js:44-46`: khi hết lỗi chỉ gỡ `aria-invalid`, giữ `aria-describedby`; `g1-aut-01.html:37` gợi ý Caps Lock không được ô mật khẩu tham chiếu). Gắn `aria-describedby` cho cả gợi ý, bỏ tham chiếu tới phần tử rỗng.

**F1-23 – Kỷ luật “chỉ dùng token trong `pack.css`”**: `g1-dsh-07.html:11-19` có khối `<style>` riêng (kích thước thợ 52px, lưới lý do, tóm tắt); hàng chục thuộc tính `style=` (ví dụ `g1-err-05.html:20`, `g1-aut-10.html:40-41`, `g1-prf-01.html:29,31,44`, `g1-dsh-04.html:73-75`); `.g1-err__code` dùng 64px (`pack.css:74`) không thuộc thang cỡ chữ. Chuyển vào `pack.css` thành class `g1-*` và dùng token (hoặc ghi nhận cỡ 64px là bổ sung có chủ đích cho trang lỗi). Lợi ích: kiểm token và touch target ở một chỗ.

**F1-24 – Điểm số tạm của đường doanh thu chỉ nói ở chú thích** (`g1-dsh-01.html:40`, `g1-dsh-02.html:39`). Điểm 30/10 lúc 09:15 vẽ cùng kiểu với các ngày đã chốt, trong khi giá trị mẫu 66,4 như cả ngày. Dùng điểm rỗng hoặc đoạn nét đứt cho ngày chưa chốt, tooltip ghi “Số tạm”, và nói rõ trong chú giải (không chỉ trong chú thích). Dữ liệu mẫu nên là một phần của ngày.

**F1-25 – Tooltip và vùng đọc của biểu đồ ồn khi rê chuột** (`g1-charts.js:162-163,179`). Vùng `aria-live` được cập nhật cả khi di chuột, gây đọc liên tục; `role="tooltip"` không được tham chiếu bằng `aria-describedby`. Chỉ cập nhật vùng đọc khi dùng bàn phím hoặc chạm có chủ đích; để bảng số liệu là đường chính cho trình đọc màn hình.

**F1-26 – KPI “Đăng nhập bất thường” mô tả theo tài khoản bị khóa** (`g1-dsh-10.html:34`) trong khi cơ chế khóa theo (thiết bị + tên) và có thể áp cho tên không tồn tại. Định nghĩa lại thành “lượt khóa tạm” và “tên đăng nhập bị dò” (ba-answers câu 1, 9); tránh gọi là “tài khoản bị khóa”.

**F1-27 – Biểu đồ tồn khả dụng cộng các đơn vị khác nhau** (`g1-dsh-05.html:55` “đơn vị tính (cái, lít, bộ)”). Cột nhóm “Phanh”, “Lốp” cộng cái và bộ có thể sai nghĩa. Dùng “% so với định mức” hoặc “số mặt hàng dưới định mức theo nhóm”, bảng thay thế liệt kê đơn vị.

**F1-28 – Bộ lọc kỳ và chi nhánh chưa điều khiển biểu đồ; khoảng tùy chọn chưa giới hạn** (`g1-charts.js:36-39,235-239`; `01-auth-dashboard.md` §7 giả định 9). Chấp nhận ở prototype nhưng phải ghi rõ trong handoff; đặt giới hạn 366 ngày, không chọn ngày tương lai, kiểm tra “Đến ≥ Từ” đã có (theo ba-answers câu 8).

**F1-29 – ERR-05 dùng số điện thoại và giờ làm việc trông như thật** (`g1-err-05.html:36-37`, “028 7300 1234”, liên kết `tel:`). Số này phải đến từ cấu hình (ba-answers câu 11); trong prototype dùng placeholder rõ như “[Số tổng đài – cấu hình]” để không bị sao chép thành dữ liệu thật, và bổ sung trạng thái chưa cấu hình số.

## 5. Điểm làm tốt (giữ nguyên)

- Thông báo xác thực trung lập nhất quán (AUT-01, 04, ERR-05); mọi nút bị tắt đều có dòng lý do nhìn thấy.
- Ba badge lệnh, thanh toán, hóa đơn tách riêng; chỉ báo `sync` cho hóa đơn lỗi không thành trạng thái thứ sáu; lý do “Chờ phụ tùng” là tag.
- Số liệu mẫu nhất quán đáng kể: tổng 5 chi nhánh 1.713,9 tr ₫, lợi nhuận 469,0, nhóm Miền Nam 1.525,6 và 431,4; chuỗi ngày khớp tổng; phiếu thu hôm nay 14.600.000 ₫ khớp; quỹ ca 8,4 tr ₫ khớp.
- Biểu đồ có bảng thay thế đầy đủ (có tổng khi xếp chồng), tooltip dùng được bằng bàn phím, kỳ trước là nét đứt, không dùng biểu đồ tròn, không dùng đỏ/xanh lá trang trí.
- Màn thợ: một chạm Bắt đầu và Hoàn thành, Tạm dừng hai chạm, Hoàn tác, nút bị khóa nêu lý do, không có hoa hồng.
- Dữ liệu cá nhân dùng cơ chế `.pii` theo vai trò; KT phải chọn lý do khi Hiện số.

## 6. Rủi ro khi shell và biểu đồ dựng bằng JavaScript

| # | Rủi ro | Mức | Khuyến nghị |
| --- | --- | --- | --- |
| R1 | Không có `noscript`; tắt JS hoặc lỗi JS thì trang trắng (`#g1-content` ẩn cho tới khi shell chạy), mất cả điều hướng. Tablet thợ phụ thuộc hoàn toàn | Cao | Khi chọn stack, dựng shell và nội dung từ máy chủ (hoặc SSR); thêm `noscript` ở prototype; thợ cần điều hướng tối thiểu hoạt động khi biểu đồ lỗi |
| R2 | Phân quyền do thuộc tính `data-role` trên `body` và bảng `ROLE_MENU` ở trình duyệt (`app.js`, `g1-shell.js`); menu tài khoản liệt kê mọi vai trò để xem thử | Cao nếu sao chép | Phân quyền và phạm vi chi nhánh chỉ do máy chủ quyết định và lọc (NFR-ISO-01, FR-SYS-002); menu “xem thử vai trò” chỉ có ở prototype và phải gắn nhãn (đã có) |
| R3 | `esc()` chỉ thay `&` và `<` (`g1-shell.js:27`, `g1-charts.js:23`) nhưng chuỗi được ghép vào `innerHTML` và vào thuộc tính (ví dụ `aria-label` ở `g1-charts.js:52`). Tên chi nhánh, tên khách, tên thợ từ dữ liệu thật sẽ thành lỗ hổng XSS | Cao khi dùng dữ liệu thật | Dùng DOM API (`textContent`, `setAttribute`) hoặc thoát đủ `"`, `'`, `>`; kiểm thử bảo mật theo NFR-SEC-02 |
| R4 | Giờ phiên, đếm lùi 60 giây, khóa tự động tính ở trình duyệt (`setInterval`); tab nền bị làm chậm, người dùng sửa được | Trung bình | Hạn phiên và khóa do máy chủ cấp và kiểm tra; JS chỉ hiển thị |
| R5 | Nội dung hiện sau khi JS dựng xong: nhảy bố cục, chậm hiển thị; biểu đồ vẽ theo `clientWidth` (khi ở thẻ ẩn bằng 0, dùng giá trị dự phòng 600) | Trung bình | Dành chỗ (skeleton cùng kích thước đã có), đo NFR-PERF (thao tác thường dưới 2 giây trên 4G) khi có stack |
| R6 | Tên biểu đồ, bảng thay thế, tooltip do cùng một đối tượng JSON sinh ra (tốt) nhưng toàn bộ nhãn nằm trong mã | Thấp | Khi làm thật, dữ liệu và nhãn từ API, định dạng số theo `vi-VN`; viết test cho hàm định dạng và tính tổng (NFR-MNT-01) |
| R7 | Hai tập sự kiện `data-g1-view` dùng chung tên cho hai việc khác nhau (chuyển trạng thái xem thử ở `g1-auth.js` và chuyển “Biểu đồ/Bảng” ở `g1-charts.js`); trang tải cả hai script (`g1-shl-02.html`) có thể xung đột | Thấp | Đổi tên thuộc tính của một bên (`data-g1-chartview`); chỉ prototype |
| R8 | Chỉ một điểm dừng Tab cho mỗi biểu đồ, lưới thẻ chi nhánh và thợ dùng Tab thay vì roving tabindex | Thấp | Đã được designer ghi nhận; kiểm với người dùng thật |

## 7. Việc cho designer (thứ tự đề xuất)

1. Sửa F1-01, F1-02 (Blocker), cập nhật dữ liệu mẫu cho nhất quán (F1-10, F1-11).
2. Cập nhật AUT-01, AUT-02, AUT-10, PRF-01, PRF-02 theo ba-answers câu 1 đến 4, 13 (F1-05 đến F1-09).
3. Cập nhật DSH-03, DSH-04, DSH-06, DSH-08 theo câu 6 đến 8 (F1-03, F1-04, F1-15 đến F1-17), thêm mục “Cách tính” cho KPI.
4. SHL-02 theo ma trận câu 12; NTF-01/02 theo ma trận câu 10; ERR-05 theo câu 11.
5. Sửa component KPI (F1-12), trạng thái từng thẻ (F1-13), dọn `style` (F1-23), điểm số tạm (F1-24).
6. Cập nhật `01-auth-dashboard.md` (§4.4, §7, §8) và ghi nhận rủi ro mục 6 trong handoff.

## 8. Việc cho BA và các tài liệu

Đã liệt kê ở `ba-answers-01.md` §C và §D (FR đề xuất FR-SYS-019..023, FR-RPT-017, FR-REC-037, FR-ACC-021). Thêm hai điểm phát hiện khi review: (1) BRD RULE-007 chỉ nêu xuất phụ tùng, trong khi `CLAUDE.md` và designer hiểu cả thanh toán, hóa đơn (F1-17); (2) FRD §2 để ô AD “-” ở “Báo cáo và dashboard” trong khi G1-DSH-10 là dashboard sức khỏe hệ thống đã được duyệt ở D-09.
