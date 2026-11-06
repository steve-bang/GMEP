# Giai đoạn 2: đối chiếu màn hình với prototype hiện có

Cập nhật: 06/11/2026 · Người lập: designer · Không sửa FRD/BRD, không sửa `docs/dev/phase-2-plan.md` (BA đang viết). Không thiết kế đồng sơn (slice 2.9 chưa khảo sát).

## 0. Cách đối chiếu và giới hạn

- Nguồn: `screen-inventory.md` (§4, §8), mã FR/RULE trong FRD, và nội dung file `design/`. **Đọc sâu file** cho slice 2.5, 2.1, 2.6 (dev bắt đầu ở đó). Các slice 2.2, 2.3, 2.4, 2.7, 2.8 chỉ đối chiếu theo danh mục và sự tồn tại của file; cột "Cần kiểm khi dev tới" ghi điều chưa mở file kiểm.
- Kết luận chung: giai đoạn 1 của thiết kế đã phủ **toàn bộ 184 màn** gồm cả kho, mua hàng, nhân sự, công nợ, phê duyệt (đã dựng trước dưới nhãn P2). Khoảng trống thật nhỏ và nằm ở **chi tiết nối giữa các màn** (loại yêu cầu duyệt mới, drill-down, kiểm tra khớp hợp nhất), cộng với các câu hỏi nghiệp vụ chưa có đáp án.
- Màn mới dùng tên **GMEP** trong khung. Màn cũ vẫn ghi "GARAGE OS" (xem §4, mục đổi tên).

## 1. Bảng khoảng trống theo slice

Ký hiệu trạng thái: **Có** (đã có, đủ cho dev bắt đầu), **Chỉnh** (có nhưng thiếu một phần, đã chỉnh hoặc cần chỉnh), **Thiếu** (chưa có màn). Ưu tiên: Cao (chặn dev slice đó), TB, Thấp.

| Slice | Màn cần | Trạng thái | Ưu tiên | File `design/` | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 2.5 Phê duyệt đầy đủ | APR-01 hàng chờ | Chỉnh (đã làm) | Cao | `g4-finance/g4-apr-01.html` | Thêm 3 loại: chuyển kho giá trị lớn, điều chỉnh tồn sau kiểm kê, yêu cầu mua vượt hạn mức; lọc theo loại; liên kết sang APR-04. Các loại này duyệt riêng, không duyệt hàng loạt |
| | APR-02 chi tiết (giảm giá, hoàn tiền, chi, hóa đơn) | Có | Cao | `g4-finance/g4-apr-02.html` | Giữ nguyên |
| | Chi tiết cho loại kho và mua hàng, trạng thái tự chuyển cấp | **Thiếu, đã dựng** | Cao | `g4-finance/g4-apr-04.html` (mới) | 3 loại x 2 tình trạng (đang chờ tôi, đã tự chuyển cấp). Cấp trước bị khóa kèm lý do sau khi chuyển cấp |
| | APR-03 ma trận hạn mức | Chỉnh (đã làm) | Cao | `g4-finance/g4-apr-03.html` | Thêm 3 dòng: yêu cầu mua hàng, nhập không đơn mua, điều chỉnh công thủ công. Ngưỡng ghi "Chưa chốt" (yêu cầu mua cấp 1 lấy 20.000.000 ₫ minh họa theo PUR-03). Ủy quyền Quản lý vùng đã có cho mở lại ngày/kỳ theo nhóm chi nhánh |
| | Ủy quyền duyệt theo cá nhân (người vắng mặt) | Thiếu, **chưa dựng** | TB | không có | FRD không có yêu cầu này (chỉ FR-SYS-004, 015). Chờ BA: Q-2.5-01 |
| | Theo dõi thời hạn duyệt, quá hạn, chuyển cấp (báo cáo) | Thiếu, **chưa dựng** | TB | không có | Không phải yêu cầu bắt buộc của FR-SYS-015 (chỉ nhắc và chuyển cấp). Chờ BA: Q-2.5-02 |
| | ACC-05/06 chi theo hạn mức | Có | Cao | `g4-finance/g4-acc-05.html`, `g4-acc-06.html` | Cần kiểm khi dev tới: dùng cùng ma trận APR-03 |
| 2.1 Hợp nhất đa chi nhánh, dashboard chủ/quản lý vùng | DSH-01 (CH), DSH-02 (QV) | Có | Cao | `g1-auth-dashboard/g1-dsh-01.html`, `g1-dsh-02.html` | Đã có nhãn số tạm/chính thức |
| | RPT-02 so sánh chi nhánh | Có | Cao | `g4-reports-system/g4-rpt-02.html` | Có trạng thái chỉ một chi nhánh |
| | Bộ chọn phạm vi, nhóm chi nhánh | Có | Cao | `g5-scope-auth/`, `g4-reports-system/g4-sys-05.html` | Định nghĩa nhóm: câu hỏi mở Q-2.1-01 |
| | Kiểm tra "chi nhánh nào vào số", "tổng chi nhánh = toàn chuỗi" | **Thiếu, đã dựng** | Cao | `g4-reports-system/g4-rpt-12.html` (mới) | Đáp ứng tiêu chí FR-RPT-001 (tổng các chi nhánh bằng số toàn chuỗi) và RULE-015. Có trạng thái lệch, một chi nhánh, QV/KT không thấy kiểm tra toàn chuỗi |
| | ACC-15 lãi lỗ theo chi nhánh | Có | TB | `g4-finance/g4-acc-15.html` | P3 theo FRD, dev có thể để sau |
| 2.6 Nhân công | HRM-06 quy tắc, HRM-07 công theo lệnh, HRM-08 bảng công, HRM-09 hoa hồng, HRM-10 năng suất | Có | Cao | `g3-inventory-hr/g3-hrm-06..10.html` | Công thức là giá trị mẫu, chờ khách (FR-HRM-015) |
| | Drill-down từ bảng công xuống từng dòng của một nhân viên | **Thiếu, đã dựng** | Cao | `g3-inventory-hr/g3-hrm-11.html` (mới), liên kết từ `g3-hrm-08.html` | Cần cho FR-RPT-011 và đối chiếu "khớp bảng công". Có kỳ đang mở, kỳ đã khóa, dòng đảo, điều chỉnh chờ duyệt, dòng chưa tính kỳ này |
| | HRM-04 ca/chấm công, HRM-05 tải việc, TEC-05 công của tôi | Có | TB | `g3-hrm-04.html`, `g3-hrm-05.html`, `g2-quote-delivery/g2-tec-05.html` | |
| | Yêu cầu nhập bù giờ công (badge, tên) | Thiếu một phần | TB | không có | Đang chờ BA đóng bảng A.2b (đã ghi trong `STATUS.md`). Q-2.6-03 |
| 2.2 Chuyển kho liên chi nhánh, kho tổng | INV-12 danh sách, INV-13 tạo/gửi, INV-14 nhận và biên bản chênh lệch | Có | Cao | `g3-inventory-hr/g3-inv-12..14.html` | Cần kiểm khi dev tới: ca nhận một phần |
| | Hàng chờ cấp của kho tổng (chi nhánh xin, kho tổng cấp) | Thiếu, **chưa dựng** | TB | không có | Chờ BA: kho tổng là kho của một chi nhánh hay đơn vị riêng (Q-2.2-01). Phê duyệt chuyển kho lớn đã có ở APR-04 |
| 2.3 Kiểm kê | INV-15 danh sách đợt, INV-16 đếm mù và quét camera, INV-17 duyệt chênh lệch | Có | Cao | `g3-inv-15.html`, `g3-inv-16.html`, `g3-inv-17.html` | Chi tiết duyệt cấp cao: APR-04 (loại điều chỉnh tồn). Cần kiểm khi dev tới: đếm lại lần hai (Q-2.3-01) |
| 2.4 Mua hàng | PUR-01..03 yêu cầu và duyệt, PUR-04..06 đơn mua phiên bản và nhận nhiều lần, PUR-07 đối chiếu ba bên, PUR-08 trả NCC, PUR-09..10 NCC | Có | Cao | `g3-inventory-hr/g3-pur-01..10.html` | Hạn mức duyệt yêu cầu mua đã được thêm vào ma trận APR-03 |
| 2.7 Công nợ, phân bổ, chi tiền, hoàn tiền | ACC-03 phân bổ nhiều-nhiều, ACC-05/06 chi có duyệt, ACC-07 hoàn tiền, ACC-10..13 công nợ phải thu/trả, ACC-21 khoản nhận trước | Có | Cao | `g4-finance/g4-acc-03.html`, `g4-acc-05..07.html`, `g4-acc-10..13.html`, `g4-acc-21.html` | Cần kiểm khi dev tới: quy tắc phân bổ tự động hay thủ công (Q-2.7-01) |
| 2.8 Thông báo khách, nhắc, lịch hẹn, bảo hành | CRM-09/10 nhắc và gửi tin, APT-01..04 lịch hẹn, DLV-05/06 bảo hành, NTF-01/02, SYS-11 và SYS-17 cấu hình | Có | TB | `g2-workshop/g2-crm-09.html`, `g2-crm-10.html`, `g2-apt-01..04.html`, `g2-quote-delivery/g2-dlv-05.html`, `g2-dlv-06.html`, `g4-reports-system/g4-sys-11.html`, `g4-sys-17.html` | Cần kiểm khi dev tới: trạng thái gửi, lỗi, thử lại (FR-CRM-009); chọn kênh khi chưa có nhà cung cấp |
| 2.9 Đồng sơn | | Không làm | | `g2-workshop/g2-rec-07.html` có sẵn bản P2+ | Chưa khảo sát quy trình |

## 2. Màn đã dựng ở lượt này

| Mã | File | Slice | Ghi chú nội dung |
| --- | --- | --- | --- |
| G4-APR-04 | `design/g4-finance/g4-apr-04.html` | 2.5 | Thanh "Xem thử loại" (chuyển kho, điều chỉnh tồn, yêu cầu mua) và "Tình trạng" (đang chờ tôi, đã tự chuyển cấp); đổi vai trò ở menu tài khoản để thấy khóa nút kèm lý do; Duyệt có hộp xác nhận, Từ chối bắt buộc lý do, Chuyển cấp bắt buộc ghi chú |
| G4-RPT-12 | `design/g4-reports-system/g4-rpt-12.html` | 2.1 | Trạng thái: có dữ liệu, đang tải, trống, lỗi, không quyền, **chưa khớp**, **một chi nhánh** |
| G3-HRM-11 | `design/g3-inventory-hr/g3-hrm-11.html` | 2.6 | Trạng thái: kỳ đang mở, kỳ đã khóa, đang tải, trống, lỗi, không quyền. Thợ chỉ xem công của mình |
| Chỉnh | `g4-apr-01.html`, `g4-apr-03.html`, `g3-hrm-08.html`, ba `pack.js`, ba `index.html` | | Xem `screen-inventory.md` §10 |

Số tiền, hạn mức, đơn giá, hạn xử lý trong màn mới là **giá trị mẫu** (gắn nhãn "minh họa"); ngưỡng thật do khách chốt và Chủ garage ban hành.

## 3. Kết quả đo Playwright

**Chưa chạy.** Môi trường làm việc lần này không có công cụ chạy lệnh (không có shell), nên không đo được tràn ngang ở 390px, lỗi JS và lỗi console cho ba màn mới và bốn màn đã chỉnh. Đây là việc còn mở, không phải kết quả "sạch". Lệnh gợi ý (cùng cách đã dùng ở `mobile-overflow-report.md` và `design/tenant-signup/measure-overflow.js`): mở từng trang ở 1440px và 390px, ghi `document.documentElement.scrollWidth > innerWidth` và lỗi `pageerror`/`console.error`; các trang cần kiểm: `g4-finance/g4-apr-04.html`, `g4-apr-01.html`, `g4-apr-03.html`, `g4-reports-system/g4-rpt-12.html`, `g3-inventory-hr/g3-hrm-11.html`, `g3-hrm-08.html`, kèm một trang cũ cùng gói để chắc việc đổi `pack.js` không làm hỏng. Tự rà tĩnh đã làm: dùng lại class có sẵn (`g4f-`, `g3-`, `g4r-`), bảng nằm trong `table-scroll`, lưới `g4f-two` co về một cột dưới 1280px. Rủi ro tràn đáng nghi nhất: hàng dài của bảng APR-01 (thêm 3 dòng) và dòng `cell-sub` dài của HRM-11 ở 390px (bảng chuyển thành thẻ qua `data-g3-cards`).

## 4. Việc cho dev và quyết định cho chủ dự án

1. Đổi tên "GARAGE OS" thành "GMEP" cho toàn bộ màn cũ: ba `pack.js` đã có điểm đổi (`P.brand` ở `g4-finance`, `window.G3_BRAND` ở `g3-inventory-hr`, `data-brand` ở `g4-reports-system`); đổi giá trị mặc định thành 'GMEP' là sửa một dòng mỗi gói, nhưng các gói `g1`, `g2`, `g5`, `foundation` còn chữ cứng. Chờ chủ dự án chốt cách làm hàng loạt (mục việc của designer ở `STATUS.md`).
2. `docs/design-system.md` không sửa (token không đổi); không thêm CSS mới cho màn mới.
3. G4-APR-04 và ma trận APR-03 dùng ba mã loại yêu cầu mới (`xfer`, `adj`, `buy`) trong `pack.js`; dev ánh xạ sang `approval type` thật của slice 2.5.

## 5. Câu hỏi cho BA (designer không tự quyết)

| Mã | Slice | Câu hỏi | Màn bị ảnh hưởng |
| --- | --- | --- | --- |
| Q-2.1-01 | 2.1 | Nhóm chi nhánh (Miền Nam, Miền Trung) ai định nghĩa? Một chi nhánh thuộc một hay nhiều nhóm? Vai trò Quản lý vùng có tồn tại chính thức không (BRD §5 vẫn `[Cần xác nhận]`)? | DSH-02, RPT-12, ScopePicker, APR-03 ủy quyền theo nhóm |
| Q-2.1-02 | 2.1 | Chi nhánh đã khóa hoặc đóng có tính vào số hợp nhất của kỳ còn phát sinh không? Chi nhánh có ngày chưa chốt: số hợp nhất gộp số tạm (như thiết kế) hay chỉ gộp ngày đã chốt? | RPT-12, DSH-01 |
| Q-2.1-03 | 2.1 | Khi có nhiều pháp nhân: kiểm tra "tổng chi nhánh = toàn chuỗi" làm theo từng pháp nhân (thiết kế đang ghi như vậy). Đồng ý không? | RPT-12 |
| Q-2.2-01 | 2.2 | Kho tổng là kho của một chi nhánh, hay đơn vị riêng không có xe vào? Ai tạo phiếu cấp: kho tổng chủ động hay chi nhánh xin? Chi phí vận chuyển ghi ở đâu? Chuyển kho giữa hai pháp nhân khác nhau có cần hóa đơn không? | Hàng chờ cấp của kho tổng (chưa dựng), INV-12..14 |
| Q-2.3-01 | 2.3 | Khi một mã lệch quá ngưỡng, có buộc đếm lại lần hai (người khác đếm) trước khi trình duyệt không? Ngưỡng chênh lệch cần chuyển CH/QV là bao nhiêu (đã dùng 3.000.000 ₫ minh họa)? Có khóa xuất nhập kho của mã đang kiểm kê không? | INV-16, INV-17, APR-04 |
| Q-2.4-01 | 2.4 | Yêu cầu mua: ngưỡng cấp Quản lý và cấp trên (đang minh họa 20.000.000 ₫); sửa đơn mua phiên bản mới có phải nhà cung cấp xác nhận lại không; dung sai ba bên cho phép bao nhiêu trước khi chặn ghi công nợ; trả NCC nhận tiền hoàn hay giấy giảm trừ? | PUR-03, PUR-05..08, APR-03, APR-04 |
| Q-2.5-01 | 2.5 | Có cần ủy quyền duyệt tạm thời theo cá nhân (người duyệt vắng mặt, có ngày bắt đầu và kết thúc) không, hay chỉ có chuyển cấp tự động và ủy quyền Quản lý vùng theo nhóm như APR-03 hiện có? Nếu có: người nhận ủy quyền phải cùng cấp hay thấp hơn? Người ủy quyền có thấy việc đã duyệt thay? | APR-01..03, màn mới nếu có |
| Q-2.5-02 | 2.5 | Chuyển cấp tự động: có nhắc trước hạn (thiết kế minh họa nhắc ở nửa thời hạn, 12 giờ trên 24 giờ) hay không; sau cấp cuối mà vẫn quá hạn thì hết hiệu lực hay giữ chờ; có cần báo cáo theo dõi thời hạn duyệt (số quá hạn, thời gian chờ) cho CH/QV không? | APR-04, APR-01 |
| Q-2.5-03 | 2.5 | Khi chỉ một người có quyền duyệt nhưng chính người đó lập yêu cầu (ví dụ Quản lý chi nhánh đề xuất chuyển kho): chuyển cấp ngay hay chờ hết hạn? | APR-04, APR-02 |
| Q-2.6-01 | 2.6 | Quy tắc tính công khi thợ đổi chi nhánh giữa kỳ: công theo chi nhánh lúc phát sinh (thiết kế đang theo). Làm lại: tính công thế nào (cấu hình, nhưng cần ví dụ để màn quy tắc minh họa đúng)? | HRM-06, HRM-07, HRM-11 |
| Q-2.6-02 | 2.6 | Thợ có xem tiền công của chính mình trên HRM-11 không (thiết kế giả định có, chỉ xem công của mình); Nhân sự có xem tiền công không hay chỉ giờ? Hoa hồng chia cho nhiều người trên một lệnh và hoàn tiền sau khi đã ghi hoa hồng thì đảo thế nào? | HRM-08, HRM-09, HRM-11 |
| Q-2.6-03 | 2.6 | Yêu cầu nhập bù giờ công (bảng A.2b): tên trạng thái, ai duyệt, giới hạn số ngày bù. | HRM-04, TEC-05 |
| Q-2.7-01 | 2.7 | Phân bổ một khoản thanh toán cho nhiều hóa đơn: thủ công do kế toán chọn, hay tự động theo quy tắc (cũ nhất trước)? Hạn mức công nợ khách vượt có chặn giao xe hay chỉ cảnh báo (`[Cần xác nhận chính sách]`)? | ACC-03, ACC-11 |
| Q-2.8-01 | 2.8 | Nhà cung cấp Zalo/SMS (chưa chọn): màn gửi thông báo cần hiện gì khi chưa cấu hình; khung giờ cấm gửi, giới hạn số tin mỗi khách mỗi tháng; chi nhánh nào chịu chi phí bảo hành chéo chi nhánh (đã có trường cấu hình ở DLV-06, cần chốt mặc định). | CRM-09/10, DLV-06, SYS-17 |

Các câu trên cộng với các `[Cần xác nhận]` đã có ở `docs/ui-ux/ba-decisions.md`. Khi BA trả lời, designer cập nhật màn tương ứng; riêng Q-2.5-01 và Q-2.2-01 quyết định có dựng thêm màn mới hay không.
