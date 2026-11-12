# 07. Sản phẩm bàn giao và tiêu chí nghiệm thu

Tài liệu nêu rõ bạn phải giao gì, theo đợt nào, ở chuẩn nào, cách làm việc và bảng chấm điểm nghiệm thu có trọng số. Người đọc: designer lập báo giá, kế hoạch và tự kiểm tra trước khi nộp.

## 1. Cấu trúc file thiết kế

Dùng Figma hoặc công cụ tương đương hỗ trợ biến (variables), component có biến thể, auto layout/constraints và prototype. Chủ dự án cần quyền xem và bình luận; đội phát triển cần quyền xem chế độ phát triển (dev mode/inspect). Công cụ chính thức: [điền].

Đề nghị cấu trúc trang của file (bạn được điều chỉnh nhưng giữ được thứ tự ý nghĩa):

| Trang | Nội dung |
| --- | --- |
| 00 Cover và Changelog | Phiên bản, ngày, nội dung thay đổi, trạng thái từng màn (Nháp/Chờ review/Đã duyệt) |
| 01 Foundations | Màu, chữ, khoảng cách, bo góc, độ cao, lưới, chuyển động, icon |
| 02 Semantic tokens | Vai trò màu (chữ, nền, viền, thương hiệu, trạng thái, biểu đồ, tương tác) |
| 03 Components | Thư viện component đủ biến thể và trạng thái (mục 4) |
| 04 Patterns | Tìm và lọc, bảng dữ liệu, form, xác nhận ba mức, phê duyệt, timeline, trạng thái rỗng/lỗi/mất mạng, phạm vi dữ liệu, che dữ liệu |
| 05 Templates | Khung ứng dụng, dashboard, danh sách, chi tiết, tạo/sửa, cấu hình, wizard, trang công khai |
| 06 Product screens – P0 | Màn hình đợt 1, mỗi màn có các trạng thái và 3 độ rộng chính |
| 07 Product screens – P1, P2 | Các đợt sau |
| 08 Responsive | Bản 320, 390, 768, 1024, 1440 |
| 09 Print | Mẫu in |
| 10 Prototypes | Luồng tương tác |
| 11 Handoff | Ghi chú, redline, ma trận trạng thái, nội dung |
| 99 Archive | Thử nghiệm bị loại (không đưa vào bản giao) |

Quy ước đặt tên: component `Nhóm/Tên/Biến thể` (tiếng Anh, ví dụ `Badge/Status/Warning`); màn hình theo mã trong tài liệu 03 (ví dụ `G2-REC-04 Chi tiết lệnh sửa chữa / Desktop / Mặc định`); biến token theo ý nghĩa (`color/text/primary`), không theo giá trị (`color/purple-500` chỉ ở lớp giá trị gốc).

## 2. Danh sách giao theo đợt

| Đợt | Nội dung | Bắt buộc |
| --- | --- | --- |
| Đợt 0: Hướng thị giác | Moodboard hoặc 3 màn mẫu (khung ứng dụng + `G2-REC-04` + một dashboard) để chốt hướng | Có, trước khi làm tiếp |
| Đợt 1: Nền tảng | Tokens, thư viện component, mẫu trang | Có |
| Đợt 1: Màn hình P0 | 65 màn P0 (tài liệu 03), đủ trạng thái và độ rộng; prototype luồng P0 | Có |
| Đợt 1: In ấn | Phiếu nhiệt 80mm và A4 cho các chứng từ P0 | Có |
| Đợt 2: P1 | 51 màn P1 | Theo thỏa thuận |
| Đợt 3: P2 | 88 màn P2 (gồm 17 màn đăng ký công ty) | Theo thỏa thuận |

Danh sách màn **bắt buộc đợt 1 (P0)** nằm ở tài liệu 03 (cột "Ưu"); 25 màn quan trọng nhất có brief chi tiết ở tài liệu 08. Với P1, P2, bạn có thể giao mẫu đại diện cho mỗi nhóm cộng quy tắc áp dụng; các màn còn lại có thể được dựng bằng template nếu thỏa thuận như vậy [điền].

### 2.1 Luồng prototype tương tác bắt buộc (P0)

| # | Luồng | Màn liên quan |
| --- | --- | --- |
| F1 | Đăng nhập → chọn công ty/chi nhánh → dashboard theo vai trò (CV, QL, CH) | `G1-AUT-01`, `G1-AUT-08`, `G1-DSH-03/04/01` |
| F2 | Tiếp nhận xe mới (biển số chưa có) → báo giá → gửi khách | `G2-REC-01`, `G2-QUO-02`, `G2-QUO-04` |
| F3 | Khách duyệt một phần trên điện thoại → lệnh mở | `G2-QUO-06`, `G2-QUO-03`, `G2-REC-04` |
| F4 | Thợ trên tablet: chọn tên + PIN → bắt đầu hạng mục → yêu cầu phụ tùng → kết thúc; gồm trạng thái khóa nút do phát sinh chờ duyệt và mất mạng | `G1-AUT-10`, `G1-DSH-07`, `G2-TEC-02`, `G2-TEC-03` |
| F5 | Thủ kho xuất phụ tùng theo yêu cầu; trường hợp thiếu hàng làm lệnh tạm dừng | `G3-INV-06`, `G3-INV-07`, `G3-INV-04` |
| F6 | QC không đạt (trả hạng mục) rồi đạt → sẵn sàng bàn giao | `G2-DLV-01`, `G2-DLV-02` |
| F7 | Thu tiền một phần rồi thu nốt → phát hành hóa đơn (gồm timeout và thử lại) → giao xe | `G4-ACC-01`, `G4-EIN-02`, `G4-EIN-03`, `G2-DLV-04` |
| F8 | Chốt ca có chênh lệch → quản lý chốt ngày | `G4-ACC-08`, `G4-ACC-09` |
| F9 | Giảm giá vượt hạn mức → hàng chờ phê duyệt (duyệt trên điện thoại) | `G4-APR-01`, `G4-APR-02` |
| F10 | Tạo phiên bản cấu hình có ngày hiệu lực (thuế suất) | `G4-SYS-10` |

Mỗi prototype dùng bộ dữ liệu mẫu ở tài liệu 11, có trạng thái lỗi/nhánh rẽ chính (không chỉ đường đi đẹp).

## 3. Design tokens

Giao dưới dạng **bảng trong file thiết kế và tệp JSON xuất được** (ưu tiên cấu trúc của chuẩn Design Tokens hoặc định dạng xuất từ Figma Variables), gồm ba lớp:

| Lớp | Nội dung | Ví dụ |
| --- | --- | --- |
| 1. Giá trị gốc (primitive) | Thang màu, thang cỡ chữ, thang khoảng cách | `palette/purple/500`, `space/4` |
| 2. Ngữ nghĩa (semantic) | Vai trò | `color/text/primary`, `color/surface/page`, `color/status/success/bg`, `color/status/success/text`, `color/border/focus`, `chart/series/1` |
| 3. Thành phần (component) | Giá trị gắn từng component | `button/height/md`, `input/border`, `table/row-height`, `sidebar/item/active-bg` |

Bắt buộc có:

- **Màu**: chữ (chính, phụ, nhạt, vô hiệu, liên kết), nền (trang, thẻ, khu phụ, overlay), viền (mặc định, nổi, ô nhập, focus), thương hiệu (chính, hover, nhấn, nhạt), **trạng thái** (Success, Warning, Danger, Info, Neutral, và màu riêng cho "Chờ QC"), mỗi trạng thái có **nền nhạt + chữ đậm + viền**, màu biểu đồ (dãy màu tối đa 6, phân biệt được cả với người mù màu).
- **Chữ**: họ phông, thang cỡ/chiều cao dòng/độ đậm cho tiêu đề, nội dung, nhãn, chú thích, số hiển thị lớn (KPI); số đều chiều rộng.
- **Khoảng cách** (đơn vị 4px đề nghị), **bo góc**, **độ cao (shadow)**, **lưới** (cột, gutter, lề cho từng điểm gãy), **kích thước vùng chạm**, **chuyển động** (thời lượng, đường cong), **z-index** (hộp thoại, toast, dropdown).
- **Kích thước nút**: ít nhất nhỏ, vừa, lớn và "rất lớn" cho tablet xưởng (khoảng 52px).
- **Chế độ sáng** là bắt buộc. **Chế độ tối**: không bắt buộc đợt 1, **nhưng cấu trúc token phải sẵn sàng** (không dùng màu cố định trong component); nếu giao dark mode phải kiểm tương phản đủ.
- **Bảng kiểm tương phản**: từng cặp chữ/nền và thành phần đồ họa chính, kèm tỷ lệ tính toán (chữ thường ≥ 4,5:1; chữ lớn và thành phần đồ họa ≥ 3:1).
- **Bảng ánh xạ token cũ → mới** nếu bạn thay đổi (tên và giá trị token hiện tại ở tài liệu 06 mục 2).

## 4. Thư viện component

Mỗi component có **đủ biến thể và trạng thái**: mặc định · hover · focus (bàn phím) · active/pressed · disabled · loading · error · read-only · selected · empty · skeleton (áp dụng khi phù hợp). Với nút "bị chặn nêu lý do": trạng thái khóa mềm vẫn focus được kèm đoạn lý do.

| Nhóm | Component bắt buộc |
| --- | --- |
| Hành động | Button (chính, phụ, ghi chú/ghost, nguy hiểm; cỡ nhỏ, vừa, lớn, rất lớn), icon button, split button, dropdown menu, nút **khóa kèm lý do** |
| Nhập liệu | Input văn bản, ô mật khẩu (hiện/ẩn), ô OTP/PIN (6 ô, dán chia ô), select, **combobox** (tìm biển số, phụ tùng, khách; gợi ý, không dấu), **ô chọn ngày** (tuần bắt đầu Thứ Hai, ngày khóa sổ vô hiệu, nhập tay), **ô số lượng** (stepper), **ô tiền VND**, textarea, checkbox, radio, switch, **tải ảnh/chụp ảnh**, tag input |
| Hiển thị dữ liệu | **Bảng dữ liệu** (sticky header, sắp xếp, chọn dòng, bulk action, cột hiển thị, tổng cuối), **danh sách thẻ trên mobile**, phân trang, chip bộ lọc đang áp dụng, avatar, tooltip, KPI card (có phạm vi, thời điểm, delta có mũi tên + chữ), biểu đồ (đường, thanh ngang, thanh chồng, donut) + **bảng thay thế**, timeline, progress, stepper, kanban |
| Trạng thái | **Huy hiệu trạng thái** theo 5 bộ + bộ phụ (tài liệu 05 mục 1.1), tag lý do, tag phụ ("Đang vận chuyển N", "Mua gấp", "Quá hạn", "Nhập bù", "Tạm"), huy hiệu số đếm, chip biển số |
| Điều hướng | Sidebar (mở/thu gọn), topbar, breadcrumb, tabs (có bộ đếm), thanh điều hướng dưới trên mobile, **bộ chọn phạm vi** (chi nhánh/nhóm/hợp nhất), **bộ chọn công ty**, menu tài khoản (đổi vai trò, đổi công ty) |
| Phản hồi | Toast (kể cả toast **Hoàn tác 10 giây**), alert, banner (mất mạng, chi nhánh khóa, tình trạng công ty), hộp thoại (thường, tiền, nguy hiểm), drawer, bottom sheet, hộp thoại lưu nháp khi rời trang/đổi phạm vi |
| Khối trạng thái | Rỗng lần đầu, rỗng do lọc, đang tải (skeleton đúng hình), lỗi theo khối + thử lại, không quyền, mất kết nối, dữ liệu cũ ("Cập nhật lúc"), xung đột phiên bản |
| Thành phần riêng garage | Thẻ xe, thẻ lệnh sửa chữa, thẻ thợ, **dòng phụ tùng bốn số** (Stock4), checklist kiểm tra (xanh/vàng/đỏ + ảnh), **bảng duyệt** (hai kiểu: duyệt từng hạng mục của báo giá; duyệt chứng từ theo hạn mức), **trường dữ liệu cá nhân** (che/hiện), dải hành trình lệnh, tóm tắt ba huy hiệu song song, hàng bảng "một hành động chính" |
| Mẫu trang | Khung ứng dụng, đăng nhập/xác thực, trang khách công khai, wizard, màn cấu hình, mẫu in |

## 5. Mẫu dữ liệu và mẫu in cụ thể

### 5.1 Bảng dữ liệu (mẫu cốt lõi cho kế toán, thủ kho, quản lý, cố vấn)

Tìm kiếm nhanh không dấu · bộ lọc (chi nhánh, trạng thái, thời gian) với chip đang áp dụng và "Xóa tất cả" · sắp xếp có ý nghĩa mặc định (ví dụ tồn khả dụng tăng dần) · phân trang hoặc cuộn ảo · ẩn/hiện cột · sticky header · chọn dòng → bulk action có kiểm soát · tổng số bản ghi và tổng tiền khi phù hợp (tổng ròng) · hàng 52–56px (gọn 44px) làm chuẩn gợi ý · số/tiền căn phải, chữ căn trái · chữ bảng ≥ 14px · **một hành động chính mỗi dòng**, hành động phụ trong menu · mobile: chuyển thành thẻ (khai báo trường nào là tiêu đề, phụ đề, huy hiệu, metadata) · trạng thái tải/rỗng/lỗi/không quyền/dữ liệu bị che · **không có "Xóa"** cho chứng từ đã ghi sổ.

### 5.2 Form

Nhãn luôn hiện; dấu `*` bắt buộc + giải thích; lỗi theo trường **nêu cách sửa**; tóm tắt lỗi đầu form; trạng thái mặc định/focus/lỗi/vô hiệu/chỉ đọc; chia nhóm, wizard khi quy trình dài, thanh footer dính (Lưu nháp / Tiếp tục / Hủy); cảnh báo rời trang chưa lưu; "đã lưu nháp lúc …"; xung đột phiên bản; trạng thái chỉ đọc kèm lý do (chi nhánh khóa, ngày/kỳ đã khóa).

### 5.3 Hộp thoại, toast, bộ chọn phạm vi, huy hiệu, biểu đồ

- **Hộp thoại**: ba mức theo tài liệu 05 mục 13; có phiên bản bottom sheet trên mobile; focus bẫy trong hộp thoại, Esc đóng, trả focus.
- **Toast**: có thể có nút **Hoàn tác**; có `aria-live`; không che nút quan trọng.
- **Bộ chọn phạm vi**: trạng thái đóng/mở/có tìm kiếm không kết quả/chọn khác phạm vi hiện tại/không đổi/mất kết nối/có nháp/đang tải sau khi đổi; popover trên desktop, bottom sheet trên mobile; hợp nhất khóa kèm lý do khi không được phép.
- **Huy hiệu**: toàn bộ bộ trạng thái ở tài liệu 05 mục 1.1, kèm cách xử lý khi nhãn dài.
- **Biểu đồ/KPI**: tên, đơn vị, tooltip, bảng thay thế, nhãn "Tạm/Chính thức", phạm vi + kỳ + thời điểm, trạng thái lỗi từng thẻ; có phiên bản dành cho điện thoại.

### 5.4 Mẫu in

Thiết kế mẫu theo **khổ giấy, không theo hãng máy**. Máy in và khổ chính xác chưa chốt: thiết kế phải chịu được cả nhiệt 80mm (có cấu hình 58mm), A4, A5.

| Chứng từ | Khổ mặc định | Ghi chú |
| --- | --- | --- |
| Phiếu tiếp nhận xe | A5 hoặc A4 | Biển số, khách, hiện trạng, tài sản để lại, chữ ký |
| Báo giá | A4 (nhiều trang) | Giá đã gồm thuế + "Trong đó thuế" cho khách cá nhân; tiêu đề lặp, số trang thật |
| Lệnh sửa chữa cho xưởng | A5 | **Không đơn giá, không số điện thoại** |
| Phiếu giao nhận/biên bản giao xe | A5 | Chữ ký khách |
| Phiếu thu | A5 hoặc nhiệt 80mm | Số tiền, hình thức, người thu |
| Hóa đơn (bản thể hiện) | A4 | Theo thông tin nhà cung cấp trả về |
| Phiếu xuất kho | A5 | |
| Phiếu nhập kho | A4 | |

Yêu cầu: xem trước trong hộp thoại; nhật ký in mỗi lần; **in lại cần lý do bắt buộc** với biên bản và chứng từ tài chính; chứng từ thiếu thông tin bắt buộc in nháp có dấu **"NHÁP – THIẾU THÔNG TIN"**; khi in, ẩn khung ứng dụng; tên đơn vị trên chứng từ dùng tên garage (ví dụ "Garage Minh Phát · Chi nhánh Quận 7"), không in tên sản phẩm GMEP như đơn vị bán hàng; mẫu in dùng một nguồn cho cả in trình duyệt và PDF lưu/gửi khách (giống hệt nhau).

## 6. Nội dung và microcopy tiếng Việt

- Bạn **đề xuất microcopy** cho toàn bộ màn hình bạn thiết kế (tiêu đề, nhãn, nút, mô tả, trạng thái rỗng, lỗi, xác nhận, toast, tooltip lý do). Chủ dự án sẽ duyệt giọng văn [điền: ai duyệt].
- Nguyên tắc câu chữ: điều gì xảy ra + vì sao (nếu biết) + cách khắc phục; xưng "bạn"; câu ngắn; không chấm than; không viết hoa toàn bộ; nút dùng động từ cụ thể ("Đăng nhập lại", "Xem bản mới nhất"), tránh "OK/Đồng ý" trơ trọi; tránh thuật ngữ kỹ thuật (không hiện mã lỗi thô, stack trace, tên bảng); mã tham chiếu lỗi hiện ở dòng nhỏ + nút sao chép.
- Dùng đúng thuật ngữ nghiệp vụ ở tài liệu 10 ("lệnh sửa chữa", "tồn khả dụng", "chốt ca"…). Không tự đặt thuật ngữ khác cho cùng khái niệm.
- Dùng dữ liệu mẫu thật (tài liệu 11), không Lorem ipsum. Kiểm tra chuỗi dài (tên khách, tên phụ tùng, địa chỉ) và nhãn dài không vỡ layout.
- Không nêu giá, gói, dùng thử, "miễn phí vĩnh viễn".
- Số trong mockup (hạn mức, thuế suất, đơn giá giờ công) là minh họa, không để trông như quy tắc kinh doanh đã chốt (ví dụ ghi chú "ví dụ" khi cần).

## 7. Responsive và trợ năng

### 7.1 Responsive: bắt buộc 320, 390, 768, 1024, 1440

| Dải | Hành vi bắt buộc |
| --- | --- |
| 320 (điện thoại nhỏ) | Không cuộn ngang toàn trang; không vỡ chữ; nút ≥ 44px |
| 390 (điện thoại phổ biến) | Thanh điều hướng dưới; bảng thành thẻ; hộp thoại thành bottom sheet; dashboard một cột |
| 768 (tablet) | Sidebar thu gọn; lưới 2 cột; vùng chạm ≥ 44px; màn thợ ở đây là trọng tâm |
| 1024 (desktop nhỏ) | Sidebar gọn; lưới 2–3 cột |
| 1440 (desktop chuẩn) | Bố cục đầy đủ, lưới 12 cột; nội dung giới hạn chiều rộng tối đa ở màn rất lớn |

Quy tắc: bảng rộng và kanban/lịch tuần **cuộn ngang trong khung** chứ không cuộn ngang cả trang; cột phụ của trang chi tiết xuống dưới trên màn hẹp; điều khiển ≥ 44px trên cảm ứng (có thể nhỏ hơn chỉ khi con trỏ chính xác và màn rộng); biểu đồ chữ trục ≥ 12px; mỗi màn P0 giao tối thiểu **bản 1440, 768 và 390**, và kiểm tra 320 + 1024.

### 7.2 Trợ năng: WCAG 2.2 mức AA

| Hạng mục | Yêu cầu |
| --- | --- |
| Tương phản | Chữ thường ≥ 4,5:1; chữ lớn và thành phần đồ họa ≥ 3:1; viền ô nhập liệu ≥ 3:1; chữ trên huy hiệu dùng sắc đậm, không dùng màu trạng thái gốc làm chữ trên nền trắng |
| Không chỉ màu | Mọi trạng thái có chữ/icon; delta KPI có mũi tên + chữ; trễ hẹn có chữ "Trễ"; tuổi nợ có nhãn + số; biểu đồ có bảng thay thế |
| Bàn phím | Mọi chức năng dùng được bằng bàn phím; thứ tự Tab hợp lý; **vòng focus nhìn rõ**; hộp thoại/drawer bẫy focus, Esc đóng, trả focus; tab và menu dùng phím mũi tên, Home/End; liên kết "bỏ qua tới nội dung" |
| Vùng chạm | ≥ 44×44px trên tablet/điện thoại (thợ: nút chính khoảng 52px); tối thiểu 24×24 theo WCAG 2.2 ở mọi nơi |
| Biểu mẫu | Nhãn luôn hiện; lỗi gắn với trường và nêu cách sửa; trạng thái bắt buộc có chữ giải thích |
| Trình đọc màn hình | Cấu trúc tiêu đề, vùng (landmark), tên truy cập, thông báo động (toast, banner mất mạng, kết quả đổi phạm vi); nút khóa mềm giữ focus |
| Chuyển động | Tôn trọng tùy chọn giảm chuyển động; không nhấp nháy |
| Ngôn ngữ | Tiếng Việt dễ hiểu |
| Phóng to | Dùng được khi phóng chữ 200% mà không mất chức năng |

Giao kèm: **ghi chú trợ năng cho từng component và từng màn P0** (thứ tự Tab, tên truy cập, thông báo, thao tác bàn phím) và bảng tương phản.

## 8. Tài liệu bàn giao cho lập trình viên (handoff)

**Bối cảnh công nghệ:** sản phẩm là ứng dụng web dựng bằng React (khung Next.js), TypeScript; giao diện tiếng Việt; component dùng chung, token CSS. Máy chủ quyết định quyền và phạm vi dữ liệu; trình duyệt chỉ hiển thị. Vì vậy thiết kế cần bám component web chuẩn, tránh hiệu ứng không dựng được hoặc phụ thuộc client để che dữ liệu. Chọn thư viện component cụ thể là việc của đội phát triển; nếu bạn đề xuất dùng thư viện cụ thể, nêu rõ giấy phép và lý do.

Bạn giao:

| Hạng mục | Nội dung |
| --- | --- |
| Spacing/redline | Khoảng cách, kích thước, căn lề của từng component (không cần redline từng màn nếu auto layout đúng) |
| Hành vi | Ghi chú tương tác cho mỗi component: mở/đóng, phím tắt, focus, ngưỡng hiển thị, cách xử lý nhãn dài |
| Trạng thái | Ma trận trạng thái cho từng component và từng màn (tải, rỗng, lỗi, không quyền, mất mạng, xung đột, chỉ đọc, đang lưu) |
| Quyền | Với mỗi màn: phần nào ẩn/che/khóa theo vai trò (dùng ma trận ở tài liệu 02) |
| Dữ liệu | Trường nào hiển thị, định dạng, quy tắc rút gọn, đơn vị |
| Xác thực dữ liệu | Quy tắc và câu chữ lỗi từng trường |
| Responsive | Quy tắc thích ứng và khi nào đổi bố cục |
| Nội dung | Bảng microcopy (khóa chuỗi + nội dung tiếng Việt) xuất được ở dạng bảng để đưa vào hệ thống chuỗi |
| Tài sản | Icon (SVG), logo, minh họa, ảnh; phông và giấy phép |
| Token | JSON + bảng ánh xạ token cũ → mới |
| Kiểm tra | Bảng tương phản, danh sách kiểm trợ năng đã tự đánh giá |

## 9. Cách làm việc

| Hạng mục | Đề nghị | Ghi chú |
| --- | --- | --- |
| Mốc review | M1 hướng thị giác; M2 token + component; M3 màn P0 + prototype; M4 nghiệm thu đợt 1; mỗi mốc có buổi demo | Ngày: [điền] |
| Kênh phản hồi | Bình luận trực tiếp trên file thiết kế + một kênh trò chuyện chung | [điền] |
| Số vòng phản hồi mỗi mốc | [điền] | |
| Người ra quyết định | [điền] | |
| Hỏi đáp nghiệp vụ | Gửi đầu mối phía dự án theo lô, mỗi câu kèm màn hình và mã quy tắc liên quan; chủ dự án trả lời trong [điền] ngày làm việc | |
| Câu hỏi chưa chốt | Thiết kế linh hoạt, ghi giả định (tài liệu 09 mục 4); không chờ | |
| Báo cáo tiến độ | Cập nhật trang Changelog + tóm tắt hằng tuần | [điền] |
| Kiểm thử khả dụng (đề nghị) | Nếu có thể, thử nhanh với 3–5 người dùng thật (cố vấn, thợ, thủ kho, chủ) trên 5 tác vụ: tiếp nhận xe mới; lập báo giá và gửi khách duyệt; giao việc cho thợ; xuất phụ tùng cho lệnh; thu tiền và xem công nợ; ghi thời gian, số lỗi, điểm nhầm, tỷ lệ hoàn thành | [điền: khả năng tổ chức] |
| Thay đổi phạm vi | [điền] | |

## 10. Bảng chấm điểm nghiệm thu

Thang điểm mỗi tiêu chí: 0 (không đạt) · 1 (yếu) · 2 (đạt tối thiểu) · 3 (tốt) · 4 (xuất sắc). Điểm tiêu chí = (điểm thang 0–4 / 4) × trọng số. Trọng số và ngưỡng là **đề xuất của chủ dự án**, [điền: xác nhận trước kickoff].

| # | Tiêu chí | Trọng số | Kiểm tra cụ thể |
| --- | --- | --- | --- |
| 1 | **Tuân thủ ràng buộc cứng** (H1–H20, tài liệu 06 mục 4) | 20 | Duyệt từng ràng buộc trên các màn P0; **cổng chặn**: vi phạm nghiêm trọng bất kỳ (gộp trạng thái, có nút xóa chứng từ ghi sổ, hiện tồn thực tế thay khả dụng, lộ dữ liệu cá nhân, không có lý do cho nút khóa…) thì không đạt dù tổng điểm cao |
| 2 | **Hiệu quả thao tác ở quầy và tablet** | 15 | Số bước/click các luồng F2, F4, F7; thợ bắt đầu/kết thúc ≤ 2 chạm; tìm xe theo biển số tức thì; cố vấn lập báo giá nhanh; nút đủ lớn; phím tắt/thứ tự Tab ở quầy |
| 3 | **Phân cấp và thiết kế thông tin** | 12 | 5 giây đầu nhìn ra "đang ở đâu, tình trạng, làm gì tiếp"; một hành động chính; mật độ phù hợp, không như bảng Excel; dashboard trả lời được 10 câu hỏi buổi sáng |
| 4 | **Chất lượng thị giác và cảm giác sản phẩm** | 10 | Chuyên nghiệp, bình tĩnh, đáng tin; cân đối khoảng trắng; màu có tiết chế; typography tiếng Việt đẹp, dấu không bị cắt; icon nhất quán |
| 5 | **Trợ năng (WCAG 2.2 AA)** | 13 | Bảng tương phản đạt; bàn phím và focus; không chỉ màu; vùng chạm; ghi chú trợ năng đầy đủ |
| 6 | **Nhất quán và hệ thống** | 10 | Token 3 lớp; component tái sử dụng; cùng việc cùng cách làm; không phiên bản component riêng cho từng nhóm màn; đặt tên rõ |
| 7 | **Responsive** | 10 | Đủ 320/390/768/1024/1440; bảng → thẻ; không cuộn ngang toàn trang; màn thợ tối ưu cho tablet, chủ/quản lý tối ưu cho điện thoại |
| 8 | **Khả thi phát triển (React/Next.js)** | 10 | Bố cục dựng được bằng web chuẩn; component có đủ trạng thái; nội dung và dữ liệu thật; xử lý chuỗi dài; handoff đầy đủ; thư viện/giấy phép rõ ràng |
| | **Tổng** | **100** | |

### 10.1 Thang chi tiết (ví dụ cho tiêu chí 2)

| Điểm | Mô tả |
| --- | --- |
| 0 | Luồng không hoàn thành được hoặc cần nhiều thao tác bất hợp lý |
| 1 | Hoàn thành nhưng chậm, nhiều bước thừa, nút nhỏ |
| 2 | Hoàn thành với số bước chấp nhận được; nút đạt kích thước tối thiểu |
| 3 | Gọn, có mặc định thông minh, thao tác bàn phím tốt |
| 4 | Xuất sắc: ngắn nhất có thể, giảm lỗi, thợ/cố vấn dùng được không cần hướng dẫn |

### 10.2 Ngưỡng kết quả (đề xuất)

| Tổng điểm | Kết quả |
| --- | --- |
| ≥ 80 và không vi phạm cổng ở tiêu chí 1 | Đạt, áp dụng vào sản phẩm |
| 65 đến 79, hoặc có vi phạm sửa được | Đạt có điều kiện, chỉnh sửa theo danh sách và chấm lại phần liên quan |
| < 65, hoặc vi phạm nghiêm trọng ràng buộc cứng | Chưa đạt, làm lại phần liên quan |

Ngưỡng: [điền: chủ dự án xác nhận].
