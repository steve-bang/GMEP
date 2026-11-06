# Giai đoạn 2: kế hoạch slice, quyết định mở, câu hỏi và brief giao dev

Phiên bản 0.1 · 06/11/2026 · Người lập: BA · Trạng thái: **BA đề xuất theo ủy quyền của chủ dự án, chờ khách xác nhận** (mục `[Cần xác nhận]` là việc của Khách, Kế toán, Luật sư hoặc Chủ dự án; dev làm theo mặc định trong tài liệu này, mọi giá trị mặc định là cấu hình có ngày hiệu lực, không viết cứng).

Căn cứ: `docs/functional-requirements.md` (FRD bản 0.5: §13 "Phạm vi giai đoạn 2", FR mới INV-030..034, PUR-009..012, HRM-017..021, ACC-022/026/027/028, SYS-033/034, UAT-P2-01..11), `docs/business-requirements.md` (RULE-036..038, §9), `docs/user-journey-business-workflow.md` (§4 luồng chuyển kho bằng chữ, §7 ma trận phê duyệt bổ sung), `docs/dev/implementation-plan.md` §4 và §7, `docs/dev/multi-tenant-requirements-for-dev.md`, `docs/dev/ba-answers-for-dev.md` (§10, §16, §24), `docs/ui-ux/ba-answers-04.md` (công thợ, kiểm kê, chuyển kho, hạn mức mẫu Phụ lục E) và `docs/dev/index-budget.md`.

Không sửa ở đợt này (dev đang sửa): `docs/dev/status.md`, `docs/dev/index-budget.md`, `docs/dev/open-questions-for-ba.md`, `CLAUDE.md`. Câu hỏi mới của giai đoạn 2 nằm ở mục 6 của tệp này; dev có thể chép sang `open-questions-for-ba.md` khi tiện.

## 1. Quyết định theo ủy quyền và điều chỉnh của BA so với kế hoạch sơ bộ

Quyết định điều phối đã chốt theo ủy quyền 06/11/2026: (a) slice 2.5 làm trước; (b) ACC-006, 007, 016 vào giai đoạn 2, chờ khách xác nhận (Q83); (c) cách giải ngân sách chỉ mục do dev đề xuất ở đầu slice 2.1, ưu tiên gộp hình truy vấn và bỏ chỉ mục thừa, không nâng trần 200 trừ khi dev chứng minh cần.

BA chỉnh kế hoạch sơ bộ ở các điểm sau (có lý do, chủ dự án có thể đảo):

| # | Điều chỉnh | Lý do |
| --- | --- | --- |
| 1 | Kiểm kê là FR-INV-011, 012 (và INV-033 mới), **không** phải INV-015..018. INV-015 là nhà cung cấp, 016 hàng khách mang, 017 vật tư tiêu hao, 018 bán lẻ | Kế hoạch sơ bộ gán nhầm mã; theo FRD §5 |
| 2 | INV-004 (đơn mua) sang 2.4, không ở 2.2; INV-014 (gợi ý lấy hàng và nhà cung cấp thay thế) sang 2.4 | Cần đơn mua và nhà cung cấp; INV-013 (định mức) ở lại 2.2 vì chỉ cần số dư |
| 3 | INV-016, 017, 022, 023, 018/028 tách thành **2.3b** (kho đặc biệt) để 2.3a (kiểm kê) nhỏ và có UAT-05 riêng | Hai nhóm không chung nghiệp vụ |
| 4 | ACC-015 và ACC-019 chuyển từ 2.5 sang 2.7; 2.5 chỉ gồm SYS-004, 015, 033, 034 | ACC-015 (phân bổ thanh toán) và ACC-019 (năm đối tượng) không phải điều kiện của slice nào khác; giữ 2.5 nhỏ để làm sớm |
| 5 | ACC-007 (công nợ phải trả) sang 2.4, không ở 2.7 | Nợ phải trả phát sinh từ phiếu nhập và đối chiếu ba bên (PUR-006, 011); UAT-16 đóng ở 2.4 |
| 6 | RPT-005 sang 2.3a, RPT-006 sang 2.6b, RPT-007 và phần công nợ của RPT-015 sang 2.7 (phải trả ở 2.4), RPT-016 chia hai (phần cần kiểm kê ở 2.3a) | Mỗi báo cáo đi cùng slice sinh ra dữ liệu của nó; 2.1 chỉ làm phần không phụ thuộc |
| 7 | SYS-008 (kênh email, Zalo) sang 2.8; trong 2.1 chỉ có SYS-014 và SYS-016 | Kênh gửi cần cổng nhà cung cấp; thông báo trong ứng dụng đã có |
| 8 | 2.6 chia 2.6a (lõi tính công, không cần duyệt) và 2.6b (kỳ công, hoa hồng, năng suất, cần 2.5) | 2.6a chạy song song 2.1 mà không chờ 2.5 |
| 9 | FR-SYS-017 (API ngoài) chưa xếp slice, đề xuất sang giai đoạn 4 | Kế hoạch §7 ghi cả giai đoạn 2 và 4; chưa có hệ thống ngoài cần gọi (Q88) |
| 10 | 2.8 chia 2.8a (cổng thông báo, nhắc, mẫu tin) và 2.8b (lịch hẹn, bảo hành, báo giá hết hạn, gói bảo dưỡng) khi thấy quá lớn | 2.8 có 22 FR |

## 2. Bảng slice

Quy ước: "phụ thuộc cứng" là slice phải xong trước; "tenant" nghĩa là viết theo kiểu `tenantId` ngoài cùng ngay từ đầu (mục 8). Màn hình theo `docs/ui-ux/screen-inventory.md` (mã G1 đến G4). Nhu cầu truy vấn là mô tả nghiệp vụ để dev tính ngân sách chỉ mục, không chọn thiết kế chỉ mục.

| Slice | Mục tiêu | FR | RULE | Phụ thuộc cứng | Màn hình | UAT | Nhu cầu truy vấn (cho ngân sách chỉ mục) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **2.5** Phê duyệt đầy đủ (làm trước) | Ma trận duyệt cấu hình, chuyển cấp theo hạn, ủy quyền, hàng chờ chung, duyệt hàng loạt cùng loại | SYS-004, 015, 033, 034 | RULE-011, 036 | Cơ chế duyệt tối thiểu đã có (slice 1.7) | G4-APR-01, 02, 03; khối "chờ duyệt" ở màn SYS | UAT-P2-01 | Hàng chờ theo người duyệt và cấp; yêu cầu quá hạn cần nhắc (công việc nền theo tenant) |
| **2.1** Hợp nhất đa chi nhánh, dashboard chi nhánh và vùng | Mở bằng đề xuất giải ngân sách chỉ mục; xếp hạng chi nhánh; dashboard vùng; lịch sử đăng nhập; phát hành danh mục từ trụ sở | RPT-002 (xếp hạng), 008, 010, 015 (không công nợ), 016 (không kiểm kê); SYS-014, 016 | RULE-015 | Không (chạy song song 2.6a) | G1-DSH-01, 02 (vùng), 03; G4-RPT; G4-SYS (đăng nhập, danh mục) | UAT-P2-10 | Đọc rollup theo khóa từng chi nhánh x ngày; không hình mới cho báo cáo |
| **2.6a** Nhân công, lõi tính công | Hồ sơ nhân sự, giờ chuẩn có hiệu lực, giờ thực, phương pháp tính công cấu hình, công khi qua QC, đổi thợ, làm lại, hủy | HRM-001, 004, 005, 006, 007, 008, 015, 020 | RULE-038 | Phần REC đã có (sự kiện thời gian, QC); ví dụ ký của khách (UAT-11) để **đóng** slice | G3-HRM-01, 02, 06, 07 | UAT-11 | Dòng công theo (chi nhánh, thợ, kỳ); theo lệnh; đề nghị đọc theo khóa hoặc tài liệu giới hạn |
| **2.2** Chuyển kho liên chi nhánh, kho tổng | YK, CK hai bước, đang vận chuyển, biên bản chênh lệch, kho tổng, khả dụng liên chi nhánh | INV-010, 013, 026, 030, 031, 032 | RULE-008, 009, 037 | 2.5 (duyệt giá trị lớn, xử lý chênh lệch) | G3-INV-12, 13, 14, 04 (tab chi nhánh khác), 05 | UAT-04, UAT-P2-02 | CK theo (chi nhánh gửi, trạng thái) và theo (chi nhánh nhận, trạng thái); "đang vận chuyển" theo kho nhận |
| **2.7** Công nợ phải thu, phân bổ thanh toán, chi tiền có duyệt, hoàn tiền | Tuổi nợ và nhắc, phân bổ nhiều-nhiều, khoản nhận trước, chi theo hạn mức cộng dồn, năm đối tượng liên kết | ACC-006, 015, 016 (phần còn lại), 018, 019, 022, 026, 028; RPT-007 (phải thu), 015 (công nợ) | RULE-010, 011, 036 | 2.5 | G4-ACC-03, 05, 06, 07, 10, 11, 21 | UAT-14, UAT-P2-06, 07 | Công nợ mở theo (chi nhánh, trạng thái, hạn) đã có (`debts`); thêm tổng theo khách |
| **2.8a** Cổng thông báo và nhắc | Cổng nhà cung cấp trung lập và nhà cung cấp giả; nhắc bảo dưỡng, đăng kiểm, bảo hiểm; mẫu tin; kết quả gửi | SYS-008; CRM-006, 007, 008, 009 | RULE-024, 028 | Không | G4-SYS (thông báo), G1-DSH-04 | thuộc UAT-P2 riêng khi có | Hàng nhắc đến hạn theo (tenant, ngày); tin theo trạng thái |
| **2.8b** Lịch hẹn, bảo hành, gói bảo dưỡng | Lịch hẹn và công suất, đặt lịch trực tuyến, bảo hành và bảo hành chéo (phép chiếu P4), gói bảo dưỡng, hạng mục bị từ chối, khách doanh nghiệp, gộp khách | REC-011, 018, 019, 020, 024, 027, 029, 034, 035, 036; CRM-003, 005, 012, 015, 016, 018 | RULE-012 | 2.8a (REC-034, 035); 2.5 (nếu duyệt); chính sách bảo hành (Q77) | G2-REC (lịch, bảo hành), G1-DSH-04 | Lịch theo (chi nhánh, ngày); bảo hành theo xe |
| **2.4** Mua hàng và công nợ phải trả | Yêu cầu mua, duyệt, đơn mua có phiên bản, nhận nhiều lần, ba bên, trả nhà cung cấp, nợ phải trả, nhà cung cấp | PUR-001..012; INV-004, 014, 015, 034; ACC-007, 027; RPT-007 (phải trả) | RULE-008, 009, 010, 036 | 2.5; 2.2 (INV-014 gợi ý lấy hàng) | G3-PUR-01..10, G4-ACC-12, 13 | UAT-16, UAT-P2-04, 05 | Đơn mua theo (chi nhánh, trạng thái); phiếu nhập theo đơn; hóa đơn nhà cung cấp theo nhà cung cấp |
| **2.3a** Kiểm kê | Đợt kiểm kê, đếm mù, quét camera, đếm lại, duyệt chênh lệch, phiếu điều chỉnh | INV-011, 012, 033; RPT-005, 016 (độ chính xác tồn) | RULE-009, 010 | 2.5 | G3-INV-15, 16, 17 | UAT-05, UAT-P2-03 | Dòng đếm theo đợt (đọc theo khóa đợt); đợt theo (kho, trạng thái) |
| **2.3b** Kho đặc biệt | Hàng khách mang, vật tư tiêu hao, khách trả phụ tùng, xuất nội bộ, bán lẻ | INV-016, 017, 022, 023, 018 và 028; INV-024 (Could) | RULE-007, 008 | 2.5 (duyệt xuất nội bộ); INV-022 sau hóa đơn cần EIN-007 (giai đoạn 3) | G3-INV-10, 11, 18 | UAT-02 (mở rộng) | Phiếu theo (kho, loại, ngày) đã có phần lớn |
| **2.6b** Kỳ công, hoa hồng, năng suất | Chấm công, kỳ công duyệt và khóa, nhập bù, hoa hồng, năng suất, tải việc, làm lại, điều chuyển, chính sách lưu | HRM-010, 017, 019, 003, 009, 021, 011, 018, 014, 016, 002, 012 (013 Could); RPT-006 | RULE-038 | 2.6a; 2.5 (mở kỳ, điều chỉnh công) | G3-HRM-03, 04, 05, 08, 09, 10; G4-RPT-08 | UAT-11, UAT-P2-08, 09 | Kỳ công theo (chi nhánh, kỳ); hoa hồng theo lệnh |
| **2.9** Đồng sơn | Luồng theo loại dịch vụ, công đoạn đồng sơn | REC-033 | | Khảo sát xưởng (Q86); **bị chặn** | G2-REC (công đoạn) | UAT-21 | |

## 3. Thứ tự và song song

Thứ tự: **2.5 trước**; sau đó song song 2.1 và 2.6a (không chung dữ liệu); rồi 2.2, 2.7, 2.8a; rồi 2.4, 2.8b; rồi 2.3a, 2.3b, 2.6b; 2.9 cuối. Tối đa 2 agent chạy song song (CLAUDE.md, implementation-plan §3). Các cặp không nên chạy song song vì cùng sửa một lõi: 2.2 với 2.3a (cùng sổ kho, cùng loại phiếu ADJ), 2.4 với 2.7 (cùng công nợ). 2.6a và 2.5 chạm chung khái niệm "loại yêu cầu duyệt" (điều chỉnh công thủ công): 2.6a dùng cơ chế duyệt tối thiểu hiện có với một loại mới, 2.5 giữ tương thích ngược.

Điều kiện chặn thật (dev vẫn làm được bằng cấu hình mặc định, nhưng slice chưa "đóng" nếu thiếu): ví dụ công thợ ký (UAT-11, Q73), bảng ví dụ giá vốn ký (UAT-25, Q66), nhà cung cấp Zalo/SMS (gửi thật, Q78), khảo sát đồng sơn (2.9, Q86), chính sách bảo hành chéo (Q77), hạn mức duyệt ban hành (Q67; trước go-live thật bắt buộc nhập, không để seed minh họa).

Tiêu chí thoát giai đoạn 2 (FRD §13, implementation-plan §7): mọi FR Must giai đoạn 2 qua UAT-04, 05, 11, 14, 16, 19, 24 và UAT-P2-01..11; công khớp ví dụ khách ký; đối soát kho đạt sau kiểm kê nhiều chi nhánh; kiểm tra tải với số chi nhánh thực tế; ma trận cô lập có trục tenant và trục chi nhánh cho mọi danh sách, tìm kiếm, báo cáo, xuất và tệp mới.

## 4. Đánh giá FR theo phân hệ

Ký hiệu: **Đủ** = đủ rõ và có tiêu chí kiểm thử được; **Bổ sung** = đã thêm FR hoặc tiêu chí ở FRD bản 0.5; **Mở** = còn phụ thuộc quyết định của khách. "Đã có" lấy từ `docs/dev/status.md` (dev xác nhận lại trước khi bắt đầu slice).

### 4.1 INV còn lại

| FR | Đánh giá | Chỗ thiếu và cách bổ sung |
| --- | --- | --- |
| INV-004 | Bổ sung | Chỉ có 4 trạng thái; thiếu hủy, đóng, nhà cung cấp xác nhận, phiên bản. Đã thêm PUR-010 |
| INV-010 | Bổ sung | Tiêu chí mỏng (không có trạng thái, khóa chống trùng, xử lý chênh lệch, giá vốn, duyệt). Đã thêm INV-030, 032 và RULE-037; luồng bằng chữ ở Journey §4 |
| INV-011 | Bổ sung | Thiếu quy tắc đếm khi kho vẫn hoạt động, đếm lại, chặn chốt. Đã thêm INV-033; quét camera là chức năng trình duyệt, thiết bị thật chưa chốt (Q72) |
| INV-012 | Bổ sung | Ngưỡng duyệt chưa có số; phân tách người đếm và người duyệt. Đã đưa vào INV-033 và ma trận (SYS-033) |
| INV-013 | Đủ (phần còn thiếu) | Cảnh báo theo tồn khả dụng đã có; còn tối đa theo chi nhánh x kho. Công thức gợi ý ở INV-034 |
| INV-014 | Bổ sung | Phải không lộ tồn thực tế của chi nhánh khác: INV-031 (phép chiếu P5); công thức: INV-034 |
| INV-015 | Đủ | Nhà cung cấp là dữ liệu tenant; dư nợ chỉ CH, QV, QL, KT xem (ba-answers-04 câu 19); bảng giá có hiệu lực theo cấu hình |
| INV-016 | Đủ | Dòng của khách chỉ tính công; ghi điều kiện bảo hành |
| INV-017 | Mở | `[Cần xác nhận]` cách phân bổ vật tư tiêu hao theo lệnh hay chi nhánh (Q90) |
| INV-018, 028 | Mâu thuẫn nhẹ | Cùng một nghiệp vụ bán lẻ; Discovery đã xác nhận có bán lẻ; xây một lần dưới INV-028 (ghi chú ở FRD §5) |
| INV-022 | Mở, có phụ thuộc | Tiêu chí "hóa đơn liên quan có điều chỉnh" cần FR-EIN-007 (giai đoạn 3); hiện tại hệ thống chặn trả khi lệnh có hóa đơn hợp lệ (`order_has_valid_invoice`). Giai đoạn 2 kiểm tiêu chí trước khi xuất hóa đơn và bán lẻ; phần sau hóa đơn khóa đến giai đoạn 3. Chính sách cửa sổ trả: Q89 |
| INV-023 | Đủ | Hạn mức xuất nội bộ ở ma trận duyệt (mẫu: thủ kho 500.000; quản lý 2.000.000; trên đó CH hoặc QV) |
| INV-024 | Đủ (Could) | Làm nếu còn chỗ; lô hiện hiểu là lớp nhập (ba-answers §16 I6) |
| INV-026 | Đủ | Kho tổng là kho của đơn vị trụ sở (ba-answers §3); đi cùng luồng chuyển kho |

### 4.2 PUR

| FR | Đánh giá | Chỗ thiếu và cách bổ sung |
| --- | --- | --- |
| PUR-001 | Đủ | |
| PUR-002 | Mở | Hạn mức duyệt chưa ban hành (Q67); dùng ma trận SYS-033 |
| PUR-003 | Đủ, giả định | "Nhà cung cấp xác nhận" ghi nhận thủ công (tệp hoặc ghi chú), không có cổng nhà cung cấp; đây là giả định BA, không có trong FRD |
| PUR-004, 005 | Đủ | Trạng thái và phiên bản ở PUR-010 |
| PUR-006 | Bổ sung | Tiêu chí "chênh lệch hiện danh sách" chưa nói dung sai và quan hệ một hóa đơn nhiều phiếu nhập. Đã thêm PUR-011 |
| PUR-007 | Mở | Giá vốn xuất trả và ai chịu hàng lỗi (Q82); INV-027 chỉ nói "xử lý riêng" |
| PUR-008 | Đủ (Could) | Ba tỷ lệ riêng kèm mẫu số, chưa có điểm tổng (ba-answers-04 câu 17) |
| Toàn PUR | Mở | Quy trình mua của khách chưa xác nhận (Q64, Q65): đã thêm PUR-012 để cấu hình được; PUR-009 mua gấp |

### 4.3 HRM

| FR | Đánh giá | Chỗ thiếu và cách bổ sung |
| --- | --- | --- |
| HRM-001, 002 | Đủ | Hồ sơ nhân sự khác tài khoản đăng nhập (liên kết); dữ liệu cá nhân che theo ba-answers-04 Phụ lục D; không thu lương, tài khoản ngân hàng, bảo hiểm |
| HRM-003 | Đủ | Định nghĩa ca và giờ nghỉ giữa ca là cấu hình |
| HRM-004, 005 | Đủ, một phần đã có | Giờ chuẩn và sự kiện thời gian đã có ở REC (slice 1.5, 1.6); cần dòng công và lịch sử hiệu lực |
| HRM-006 | Mở | Tiêu chí kiểm bằng ví dụ khách cung cấp, chưa có ví dụ. Cơ chế ở HRM-020; ví dụ ở Q73 |
| HRM-007 | Đủ | |
| HRM-008 | Bổ sung | "Làm lại theo quy tắc cấu hình" mơ hồ. Đã đưa 6 ví dụ vào tiêu chí HRM-020 (đổi thợ chia theo giờ thực; làm lại; hủy đảo công) |
| HRM-009 | Bổ sung | Thu một phần, hoàn tiền và thợ khoán chưa nói. Đã thêm HRM-021 |
| HRM-010 | Bổ sung | Thiếu chu kỳ, ai khóa, điều kiện, mở lại. Đã thêm HRM-017 |
| HRM-011 | Bổ sung | Ba chỉ số cần định nghĩa đầu vào. Đã thêm HRM-018. Lưu ý FRD RPT-006 viết "khớp bảng công" chỉ đúng khi mọi phương pháp là giờ chuẩn |
| HRM-012 | Mở | Chính sách lưu và ẩn danh nhân viên nghỉ việc chờ luật sư (Q87) |
| HRM-013 | Đủ (Could) | |
| HRM-014 | Mở nhỏ | "Giờ khả dụng" chưa định nghĩa; đề xuất = giờ ca trừ nghỉ giữa ca trừ ngày nghỉ phép |
| HRM-015, 016 | Đủ | |
| Nhập bù | Bổ sung | HRM-019 (NFR-OFF-01); hai dòng NFR-OFF-01 trong FRD còn khác nhau (đề xuất C-11 ở `docs/ui-ux/proposed-doc-changes.md` chưa áp dụng) |

### 4.4 ACC (phê duyệt, công nợ, hoàn tiền)

| FR | Đánh giá | Chỗ thiếu và cách bổ sung |
| --- | --- | --- |
| ACC-006 | Bổ sung | Phải thu tối thiểu đã có (nợ duyệt khi bàn giao, `getOrderBalance`); thiếu tuổi nợ, hạn, nhắc. Đã thêm ACC-026 |
| ACC-007 | Bổ sung | Tiêu chí mỏng. Đã thêm ACC-027; chuyển sang 2.4 |
| ACC-015 | Mở nhỏ | FR nói phân bổ giữa thanh toán và **hóa đơn**, dev giữ công nợ theo **lệnh**. Hiện hóa đơn phát hành từ một lệnh nên hai cách tương đương; đề xuất phân bổ vào công nợ theo lệnh và hiện hóa đơn liên kết (QĐ2-10). Xem lại nếu có hóa đơn gộp |
| ACC-016 | Đủ, đã dựng | Đã có ở giai đoạn 1 (phiếu chi hoàn có duyệt, trần hoàn dùng chung với hoàn cọc, ca mở khi hoàn tiền mặt). Còn: hạn mức hoàn của thu ngân, liên kết hóa đơn điều chỉnh (EIN-007, giai đoạn 3). Theo ủy quyền, vào giai đoạn 2 để kiểm lại ở UAT-P2 |
| ACC-018 | Bổ sung | Bước "đối soát" chưa định nghĩa: đề xuất đối soát = khớp phiếu chi với chứng từ gốc hoặc hóa đơn chi phí; phiếu chi vượt hạn mức có duyệt đã có; thêm ACC-028 (cộng dồn, chưa chốt thì lên cấp cao nhất) |
| ACC-019 | Đủ | Dev xác nhận phần đã có ở trang lệnh; phần còn lại là liên kết ngược từ lệnh tới báo giá, hóa đơn, thanh toán, phiếu thu |
| ACC-022 (mới) | Bổ sung | Khoản nhận trước (từ ACC-015, ACC-016) |
| SYS-004, 015 | Bổ sung | Cơ chế tối thiểu đã có; thiếu chuyển cấp theo hạn, ủy quyền, hàng chờ chung, cấp quản lý vùng. Đã thêm SYS-033, 034 |

## 5. Quyết định mở: mặc định, lựa chọn, khuyến nghị

Mọi mục đều là `[Cần xác nhận]`; BA không chốt thay khách. "Mặc định" là giá trị dev dùng ngay, là cấu hình có ngày hiệu lực.

| # | Quyết định | Mặc định tạm | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác | Câu hỏi |
| --- | --- | --- | --- | --- | --- | --- |
| QĐ2-01 | **Giá vốn** | Bình quân di động theo kho x phụ tùng, lưu giá trị tồn nguyên đồng (đã dựng, ba-answers §16 I5); kiểm kê thừa nhập theo giá bình quân; đổi phương pháp chỉ ở ranh kỳ | (a) bình quân di động; (b) bình quân cuối kỳ; (c) nhập trước xuất trước | (a), kế toán ký bảng ví dụ (UAT-25: 10 cái giá 100.000 và 20 cái giá 120.000 cho khoảng 113.333) | (c) cần lớp nhập (I6) và đổi cách tính trả, chuyển kho, kiểm kê; (b) cần kỳ khóa (giai đoạn 3) | 66 |
| QĐ2-02 | **Công thức công và hoa hồng** | Một phương pháp cho mỗi (loại dịch vụ x chức danh x chi nhánh) có hiệu lực; thứ tự ưu tiên chi nhánh trước công ty; công ghi khi qua QC; hoa hồng ghi khi lệnh thu đủ; cơ sở hoa hồng là tiền công đã thu chưa VAT (ba-answers-04 câu 14) | Phương pháp: giờ chuẩn, khoán, giờ thực được duyệt, tỷ lệ phần trăm, cố định cộng thưởng; cơ sở hoa hồng: tiền công, cộng phụ tùng, lợi nhuận gộp; thu một phần: không ghi hoặc chia theo tỷ lệ | Giữ mặc định; cần tối thiểu 6 ví dụ ký (HRM-020) | Đổi cơ sở hoặc thu một phần: đổi cấu hình, thêm ca kiểm thử; không đổi mã nếu cơ chế đủ tổng quát | 73, 74 |
| QĐ2-03 | **Hạn mức duyệt chi** | Không có số cứng; hạn mức chưa ban hành thì chuyển lên cấp cao nhất; seed minh họa chỉ ở tenant demo (ví dụ Phụ lục E của ba-answers-04); cửa sổ cộng dồn chống chia nhỏ cấu hình | (a) khách ban hành bảng số trước go-live; (b) dùng số minh họa làm khởi điểm rồi chỉnh; (c) không có hạn mức, mọi khoản qua chủ | (a); tenant thật không bật chức năng cần hạn mức khi chưa có số | (b) rủi ro số minh họa thành số thật; (c) nghẽn ở chủ | 67 |
| QĐ2-04 | **Quy trình mua hàng** | Mọi bước bật; bước yêu cầu mua tắt được theo chi nhánh; nhập không có đơn mua luôn là phiếu bất thường cần duyệt; nguồn mua cấu hình | (A) đầy đủ yêu cầu, duyệt, đơn, nhận, ba bên; (B) rút gọn không yêu cầu; (C) chỉ nhận hàng theo hóa đơn | Xây máy trạng thái đầy đủ với bước bật tắt (PUR-012), chọn A cho chi nhánh lớn, B cho chi nhánh nhỏ | Cố định A: chi nhánh nhỏ vướng; cố định C: mất đối chiếu ba bên | 64, 65 |
| QĐ2-05 | **Bảo hành chéo** | Tra cứu lịch sử và điều kiện qua phép chiếu P4; lệnh bảo hành liên kết lệnh gốc, không mở được lệnh gốc; chi phí ghi tại chi nhánh thực hiện kèm trường "bên chịu chi phí" (mặc định chi nhánh gốc); không bù trừ liên chi nhánh tự động | Bên chịu: chi nhánh gốc, chi nhánh thực hiện, công ty | Ghi dữ liệu và hiện cả hai; chưa làm quyết toán liên chi nhánh | Quyết toán tự động cần chứng từ nội bộ (kế toán) | 77 |
| QĐ2-06 | **Ngưỡng kiểm kê** | Đếm mù; không đóng băng kho; điều chỉnh quản lý đến 2.000.000 đồng ròng; lệch trên 5% số lượng một mã cần giải trình; mã lệch từ 2 lần trong 60 ngày gắn cờ (Phụ lục E, mẫu) | Ngưỡng theo giá trị, theo phần trăm, theo nhóm hàng | Giữ ba tham số, khách chốt số; ngưỡng riêng cho nhóm hàng giá trị cao là mở rộng sau | Chỉ đổi cấu hình | 72 |
| QĐ2-07 | **Chuyển kho: bên chịu chênh lệch, giá vốn, pháp nhân** | Bên chịu chọn từng lần kèm lý do; giá vốn bên gửi mang theo, không hiện cho bên nhận; ngưỡng "giá trị lớn" mẫu 5.000.000 đồng; chuyển giữa hai pháp nhân chặn đến khi kế toán quy định chứng từ | Xem ba-answers-04 câu 11 | Giữ; chưa hỗ trợ chuyển giữa hai pháp nhân ở giai đoạn 2 | Hỗ trợ chuyển hai pháp nhân: thêm chứng từ và thuế | 69 |
| QĐ2-08 | **Công nợ** | Nhóm tuổi 0 đến 30, 31 đến 60, 61 đến 90, trên 90 ngày; tính từ hạn thanh toán, không có hạn thì từ ngày giao xe; nhắc không gửi khách chưa đồng ý | Nhóm tuổi khác; tính từ ngày lập hóa đơn | Giữ mặc định | Đổi nhóm tuổi: cấu hình có hiệu lực | 70, 71 |
| QĐ2-09 | **Chu kỳ kỳ công** | Tháng dương lịch; quản lý chi nhánh duyệt rồi khóa từ ngày kết thúc kỳ; mở lại cần chủ | Nửa tháng, tuần, ngày chốt tùy chỉnh | Giữ tháng, hỗ trợ khác bằng cấu hình | Chỉ đổi cấu hình | 75 |
| QĐ2-10 | **Đối tượng nhận phân bổ thanh toán** | Công nợ theo lệnh, hiện hóa đơn liên kết | Theo hóa đơn; theo lệnh | Theo lệnh (tương đương khi một hóa đơn một lệnh) | Có hóa đơn gộp nhiều lệnh: cần quan hệ nhiều-nhiều hai tầng | 81 |
| QĐ2-11 | **Mã FR giữ chỗ chưa áp dụng** | Dùng INV-030..034, PUR-009..012, HRM-017..021, ACC-022/026..028, SYS-033/034; bỏ trống INV-029, ACC-021/023/024/025, SYS-019..032, REC-037..043 | Áp dụng cả gói `proposed-doc-changes.md` | Áp dụng riêng, vì phần đã dựng ở giai đoạn 1 (đảo bút toán, mở ca, đánh số, chi nhánh làm việc) chưa có FR | Không áp dụng: nợ truy vết | |

## 6. Câu hỏi cho khách (số 64 trở đi, nối tiếp bảng câu 1 đến 63 ở `ba-answers-for-dev.md` §12 và §25.4)

Số Q1 đến Q41 của multi-tenant ở `docs/multi-tenant-open-questions.md` là bộ đánh số riêng; số ở đây dùng tiền tố "Giai đoạn 2" khi trích dẫn chéo (ví dụ "Q64 giai đoạn 2").

| # | Gửi | Câu hỏi | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- | --- |
| 64 | Khách | Quy trình mua phụ tùng hiện nay: chi nhánh có tạo yêu cầu mua và ai duyệt; có chi nhánh nhỏ không qua bước yêu cầu | A đầy đủ; B rút gọn; C chỉ theo hóa đơn | Bước bật tắt theo chi nhánh (PUR-012) | Cố định một cách: chi nhánh còn lại vướng |
| 65 | Khách | Có kho tổng riêng; mua tập trung hay chi nhánh tự mua; mua gấp trực tiếp khi nào | Kho tổng có hoặc không; tập trung, tự mua, kết hợp | Kho tổng là kho của đơn vị trụ sở (ba-answers §3); nguồn mua cấu hình | Không có kho tổng: bỏ INV-026, cấp hàng chỉ qua chuyển kho giữa chi nhánh |
| 66 | Kế toán khách | Chốt phương pháp giá vốn và cung cấp bảng ví dụ ký (bình quân di động hay cuối kỳ hay nhập trước xuất trước); xử lý giá vốn khi trả nhà cung cấp, hàng lỗi, kiểm kê thừa, chuyển kho | Như QĐ2-01 | Bình quân di động, giá vốn bên gửi mang theo, kiểm kê thừa theo giá bình quân | Đổi phương pháp sau khi có dữ liệu thật: tính lại tồn |
| 67 | Chủ dự án | Ban hành bảng hạn mức duyệt (chi, mua, mua gấp, nhập lệch, xuất nội bộ, chuyển kho giá trị lớn, điều chỉnh kho, điều chỉnh công, hoàn tiền) theo cấp quản lý chi nhánh, quản lý vùng, chủ; cửa sổ cộng dồn chống chia nhỏ | Bảng số; dùng số minh họa làm khởi điểm | Khách ban hành trước go-live; chưa ban hành thì lên cấp cao nhất | Số minh họa thành số thật nếu không ai xem lại |
| 68 | Chủ dự án | Ủy quyền duyệt: ai được ủy quyền cho ai, thời hạn tối đa; nhắc sau bao lâu và chuyển cấp sau bao lâu theo từng loại (mẫu: nhắc 1 ngày làm việc, chuyển cấp thêm 2 ngày, mua gấp 2 giờ); duyệt hàng loạt cho loại nào | Cấu hình theo loại | Ủy quyền mặc định tắt, chỉ chủ cấu hình, có hạn; duyệt hàng loạt chỉ loại rủi ro thấp | Cho ủy quyền rộng: nguy cơ lách phân tách nhiệm vụ |
| 69 | Kế toán khách, Chủ dự án | Chuyển kho: bên chịu giá trị chênh lệch mặc định; có hiện giá vốn cho bên nhận; ngưỡng giá trị lớn; chuyển giữa hai pháp nhân dùng chứng từ nào; hạn chờ hàng bù | Như QĐ2-07 | Chọn từng lần; không hiện giá vốn; 5.000.000 đồng (mẫu); chưa hỗ trợ hai pháp nhân | Hiện giá vốn: lộ giá nhập giữa chi nhánh |
| 70 | Kế toán khách | Công nợ phải thu: nhóm tuổi, hạn thanh toán mặc định cho khách lẻ và khách doanh nghiệp, ngày bắt đầu tính tuổi nợ, tần suất nhắc | Như QĐ2-08 | Mặc định ở QĐ2-08 | Chỉ đổi cấu hình |
| 71 | Kế toán khách | Công nợ phải trả: điều khoản thanh toán mỗi nhà cung cấp, lịch chi, ai được chi, có cần ba bên mới ghi nợ ở mọi chi nhánh | Ba bên bắt buộc hoặc tùy chi nhánh | Ba bên bật mặc định, tắt được theo chi nhánh trong quyền | Bắt buộc mọi nơi: chậm chi nhánh nhỏ |
| 72 | Khách, Chủ dự án | Kiểm kê: tần suất, ngưỡng giá trị và phần trăm, có đóng băng nhóm hàng khi đếm, thiết bị quét (điện thoại hay máy quét) | Như QĐ2-06 | Đếm mù, không đóng băng, ngưỡng mẫu | Đóng băng: chặn xuất trong lúc đếm |
| 73 | Khách, Kế toán khách | **Công thức công thợ** theo loại việc và chức danh: giờ chuẩn, khoán, giờ thực được duyệt, tỷ lệ, cố định cộng thưởng; hệ số chức danh; tiền công mỗi giờ; 6 ví dụ ký (thay dầu 0,3 giờ chuẩn; khoán; phần trăm; đổi thợ giữa chừng; làm lại sau QC; hủy lệnh sau khi ghi công); chi nhánh nào khác chính sách chuẩn | Như QĐ2-02 | Khách ký 6 ví dụ trước khi đóng 2.6a | Không có ví dụ: không đóng được UAT-11 |
| 74 | Khách | **Hoa hồng** cố vấn và thợ: cơ sở (tiền công, cộng phụ tùng, lợi nhuận gộp), thu một phần có chia không, hoàn tiền sau đó xử lý ra sao | Như QĐ2-02 | Tiền công đã thu chưa VAT; thu một phần chưa ghi; hoàn tiền tạo dòng đảo | Đổi cấu hình |
| 75 | Khách | Kỳ công: chu kỳ (tháng, nửa tháng, tuần, ngày chốt như 26 đến 25), ai khóa, ai mở lại | Như QĐ2-09 | Tháng dương lịch; quản lý chi nhánh khóa; chủ duyệt mở lại | Chỉ đổi cấu hình |
| 76 | Khách | Nhập bù giờ công khi mất mạng: ngưỡng quản đốc xác nhận và quản lý duyệt (mẫu 15 phút); thợ khai thế nào | Ngưỡng phút | 15 phút (mẫu) | Đổi tham số |
| 77 | Khách, Chủ dự án | **Bảo hành chéo chi nhánh**: thời hạn và số km bảo hành theo loại việc; chi nhánh nào chịu chi phí; chi nhánh tiếp nhận được tự mở lệnh bảo hành hay cần chi nhánh gốc đồng ý | Như QĐ2-05 | Tra cứu và mở lệnh liên kết; ghi bên chịu chi phí; chưa quyết toán liên chi nhánh | Quyết toán: cần chứng từ nội bộ |
| 78 | Chủ dự án, Khách | Nhà cung cấp Zalo và SMS (và email) để gửi thật; mẫu tin và khung giờ gửi; xác nhận chỉ gửi cho khách đã đồng ý | Chọn nhà cung cấp | Chọn trước khi 2.8a đóng; trước đó chỉ nhà cung cấp giả | Chưa chọn: slice đóng với nhà cung cấp giả |
| 79 | Khách | Nhắc bảo dưỡng và đăng kiểm: chu kỳ theo số km, theo thời gian, theo loại xe và năm sản xuất; báo trước bao nhiêu ngày; nhắc bảo hiểm | Bảng chu kỳ | Bảng chu kỳ theo BRD §7, sửa được có hiệu lực | Chỉ đổi cấu hình |
| 80 | Kế toán khách | Hoàn tiền: hạn mức hoàn của thu ngân; hoàn có kèm hóa đơn điều chỉnh khi lệnh đã xuất hóa đơn (liên quan EIN-007) | Hạn mức; luồng | Chặn hoàn khi lệnh có hóa đơn hợp lệ cho đến giai đoạn 3 (hiện đã chặn) | Cho hoàn sớm: cần hóa đơn điều chỉnh giai đoạn 3 |
| 81 | Kế toán khách | Phân bổ thanh toán: khách doanh nghiệp trả gộp nhiều hóa đơn; phần dư thành khoản nhận trước rồi bù hay hoàn; có hóa đơn gộp nhiều lệnh không | QĐ2-10 | Phân bổ theo lệnh; nhận trước bù cùng khách hoặc hoàn có duyệt | Hóa đơn gộp: thêm quan hệ |
| 82 | Kế toán khách, Khách | Trả hàng nhà cung cấp và hàng lỗi: giá vốn xuất trả, ai chịu, nhập kho hàng lỗi | Theo INV-027 | Xuất trả theo giá vốn hiện tại, hàng lỗi vào kho chờ xử lý | Đổi cách ghi giá vốn |
| 83 | Chủ dự án | Xác nhận đưa ACC-006, 007, 016 vào giai đoạn 2 (đã chốt theo ủy quyền) và ACC-015, 019 ở 2.7 | Xác nhận; đảo | Xác nhận | Đảo: giai đoạn 2 không có công nợ, UAT-14, UAT-16 dời |
| 84 | Chủ dự án | Có vai trò quản lý vùng; nhóm chi nhánh theo vùng; QV duyệt giảm giá, chuyển kho giá trị lớn | Có; không (chủ duyệt hết) | Có, nhóm chi nhánh là cấu hình (BRD §5 còn `[Cần xác nhận]`) | Không có QV: bỏ G1-DSH-02, mọi duyệt lên chủ |
| 85 | Chủ dự án | Xếp hạng chi nhánh: ai được xem (chủ, QV; quản lý chi nhánh có thấy thứ hạng chi nhánh khác không); chỉ số xếp hạng | Chủ và QV; thêm quản lý chi nhánh | Chủ và QV; quản lý chi nhánh chỉ thấy của mình | Lộ doanh thu chi nhánh khác (ba-answers §10) |
| 86 | Khách | Khảo sát xưởng đồng sơn: công đoạn, người phụ trách, thời gian, vật tư sơn | Lịch khảo sát | Khảo sát trước khi bắt đầu 2.9 | Không khảo sát: 2.9 không bắt đầu |
| 87 | Luật sư khách | Thời hạn lưu và ẩn danh hồ sơ nhân viên đã nghỉ (HRM-012), phần bắt buộc theo luật | Thời hạn | Không đặt số tới khi có trả lời; mặc định không xóa | Đặt số sai: mất dữ liệu bắt buộc |
| 88 | Chủ dự án | Có hệ thống bên ngoài cần gọi API của GMEP ở giai đoạn 2 (FR-SYS-017) | Có; không | Không, dời giai đoạn 4 | Có: thêm slice API, khóa API theo tenant |
| 89 | Khách | Khách trả phụ tùng chưa lắp: cửa sổ trả (mẫu 7 ngày), điều kiện, phí xử lý, hàng không nhận trả | Chính sách | Như ba-answers-04 câu 18 (cấu hình) | Chỉ đổi cấu hình |
| 90 | Khách, Kế toán khách | Vật tư tiêu hao (dầu mỡ, giẻ, hóa chất): phân bổ theo lệnh hay theo chi nhánh; danh mục | Theo lệnh; theo chi nhánh | Theo chi nhánh theo tháng, báo cáo riêng | Theo lệnh: cần định mức mỗi hạng mục |

Câu hỏi cho dev (không phải khách): (D1) số chỉ mục thực đo hiện là 192 hay 193 (`docs/dev/index-budget.md` ghi 192 và nói `status.md` lệch; `CLAUDE.md` và `multi-tenant-requirements-for-dev.md` §5 ghi 193): chạy `pnpm check:indexes` và thống nhất một số; (D2) các phần "đã có" ở mục 4 (giờ chuẩn, sự kiện thời gian, liên kết năm đối tượng ở trang lệnh) cần dev xác nhận trước khi cắt phạm vi slice.

## 7. Cấu hình có hiệu lực dev phải tách khỏi code

Mỗi dòng là cấu hình có ngày hiệu lực và lịch sử, theo tầng tenant, Company, chi nhánh (đổi tầng trên không sửa chứng từ đã phát hành, RULE-019); tầng nền tảng chỉ cho danh mục pháp lý (FR-TEN-019, MT-1). Tên khóa do dev đặt; BA chỉ nêu nội dung.

| # | Cấu hình | Nội dung | Tầng | Người sửa | FR |
| --- | --- | --- | --- | --- | --- |
| 1 | Phương pháp giá vốn | bình quân di động, cuối kỳ hoặc nhập trước xuất trước; ranh kỳ đổi | tenant, Company | KT, CH duyệt | INV-009, 027 |
| 2 | Ma trận phê duyệt | loại yêu cầu x tham số x giá trị x cấp duyệt; hạn dùng của duyệt; cửa sổ cộng dồn | tenant, Company, chi nhánh | CH | SYS-033, ACC-028 |
| 3 | Nhắc và chuyển cấp | T1, T2 theo loại; giờ làm việc để tính ngày làm việc | tenant, chi nhánh (giờ) | CH | SYS-015, 034 |
| 4 | Ủy quyền duyệt | người ủy quyền, người nhận, phạm vi, thời hạn | tenant | CH | SYS-033 |
| 5 | Quy trình mua | bật tắt bước yêu cầu, duyệt, mua gấp, nhập không đơn; nguồn mua | chi nhánh trong quyền | QL trong quyền, CH | PUR-012 |
| 6 | Mua gấp | giá trị tự quyết, hạn hậu duyệt | tenant, chi nhánh | CH | PUR-009 |
| 7 | Dung sai nhận hàng và ba bên | % lệch giá, đồng mỗi đơn vị, lệch số lượng | tenant, chi nhánh | KT, CH | PUR-011, INV-005 |
| 8 | Định mức tồn | tối thiểu, tối đa, thời gian giao x kho x phụ tùng | kho | TK, QL | INV-013 |
| 9 | Gợi ý đặt hàng | công thức, thứ tự nguồn, ngưỡng giá trị chuyển kho đáng làm | tenant, chi nhánh | CH, QL | INV-034 |
| 10 | Chuyển kho | ngưỡng giá trị lớn; danh mục kết quả xử lý chênh lệch; hạn chờ hàng bù; danh mục bên chịu giá trị; cờ xem khả dụng liên chi nhánh và nhóm chi nhánh | tenant, nhóm | CH | INV-030, 031, 032 |
| 11 | Kiểm kê | đếm mù mặc định; ngưỡng giá trị và phần trăm; cửa sổ lệch lặp lại; đóng băng nhóm hàng | tenant, chi nhánh | CH, QL | INV-033 |
| 12 | Chính sách trả hàng khách | cửa sổ trả, điều kiện, phí, cờ "không nhận trả" trên danh mục | tenant | CH | INV-022 |
| 13 | Vật tư tiêu hao | danh mục, cách phân bổ | tenant | KT | INV-017 |
| 14 | Tính công | phương pháp theo (loại dịch vụ x chức danh x chi nhánh); hệ số chức danh; đơn giá giờ; làm tròn; ngưỡng điều chỉnh thủ công; giờ chuẩn hạng mục | tenant, chi nhánh trong quyền | CH, KT | HRM-004, 006, 015, 020 |
| 15 | Hoa hồng | cơ sở, tỷ lệ, điều kiện ghi nhận | tenant, chi nhánh trong quyền | CH | HRM-021 |
| 16 | Ca và kỳ công | định nghĩa ca, nghỉ giữa ca; chu kỳ kỳ công; ngưỡng nhập bù; điều kiện khóa | chi nhánh | QL, CH | HRM-003, 017, 019 |
| 17 | Công nợ | nhóm tuổi; hạn thanh toán mặc định; điều khoản nhà cung cấp; kỳ nhắc nợ | tenant | KT | ACC-006, 007, 026, 027 |
| 18 | Thông báo | kênh, mẫu tin, khung giờ, nhà cung cấp và bí mật (của tenant, RULE-024); bảng chu kỳ nhắc bảo dưỡng, đăng kiểm, bảo hiểm | tenant, Company | CH, QT | SYS-008, CRM-006, 007, 008, 009 |
| 19 | Lịch và bảo hành | công suất xưởng mỗi ngày; thời hạn, km, điều kiện bảo hành; bên chịu chi phí; hạn hết hạn báo giá | tenant, chi nhánh | CH, QL | REC-011, 018, 019, 036 |
| 20 | Báo cáo và vùng | nhóm chi nhánh theo vùng; chỉ số xếp hạng; ngưỡng cảnh báo (mở rộng `report-policy`); kỳ so sánh | tenant | CH | RPT-002, 008, 010 |
| 21 | Mẫu in chứng từ kho | khổ giấy, trường, theo chi nhánh | chi nhánh | QT | INV-021 (mẫu) |
| 22 | Chính sách lưu nhân sự | thời hạn, hành động | tenant | CH, luật sư | HRM-012 |

## 8. Ảnh hưởng của `tenantId` lên từng nhóm FR

Áp dụng chung cho mọi slice (multi-tenant-requirements-for-dev §4): `tenantId` do hệ thống suy ra từ phiên (không từ dữ liệu client), có trong mọi đọc, ghi, hình truy vấn, chỉ mục, đường dẫn tệp, mục nhật ký, khóa đánh số, khóa chống trùng; ma trận cô lập có trục tenant cho mọi danh sách, tìm kiếm, báo cáo, xuất, tệp mới (UAT-P2-11). Slice mới viết kiểu có tenant ngay, không retrofit.

| FR | Đánh số (RULE-018, duy nhất trong tenant) | Idempotency (khóa chứa tenant, risky write cần `Idempotency-Key`) | Cấu hình theo tenant | Ghi chú cô lập |
| --- | --- | --- | --- | --- |
| SYS-004, 015, 033, 034 | Không có số riêng; yêu cầu duyệt dùng khóa xác định | Quyết định duyệt và thực hiện một lần; chuyển cấp tự động (công việc nền) idempotent theo (tenant, yêu cầu, cấp) | Ma trận, ủy quyền, T1, T2 | Người duyệt chỉ chọn trong tenant; nhắc không gửi sang tenant khác; công việc nền chạy theo tenant, lỗi tenant này không chặn tenant khác (FR-TEN-015) |
| INV-010, 026, 030, 031, 032 | YK và CK đánh số theo **chi nhánh gửi** trong tenant (LOẠI-MÃCN-YYMM-STT); biên bản kèm số CK | Gửi, nhận, xử lý chênh lệch: khóa theo (tenant, CK, bước); gửi lặp trừ một lần; nhận lặp ghi một lần | Ngưỡng giá trị lớn, danh mục kết quả, nhóm chi nhánh | **Kho nhận phải cùng tenant** (kiểm ở máy chủ, không tin giá trị từ giao diện); khả dụng liên chi nhánh chỉ phép chiếu trong tenant (danh sách trường trắng, có test) |
| INV-011, 012, 033 | KK và ADJ theo chi nhánh | Nộp đợt, duyệt, ghi ADJ: khóa theo (tenant, đợt, bước) | Ngưỡng, đếm mù, đóng băng | Biên bản và ảnh kiểm kê lưu dưới đường dẫn có tenant; không URL đoán được |
| INV-004, PUR-001..012 | YM, DM (hậu tố `-vN`), PN, TR theo chi nhánh; hóa đơn nhà cung cấp dùng số của nhà cung cấp, duy nhất trong (tenant, nhà cung cấp) | Gửi đơn, nhận hàng, ghi hóa đơn, trả hàng: khóa theo (tenant, chứng từ, bước); ghi nợ phải trả không trùng khi nhận lặp | Quy trình mua, mua gấp, dung sai, bảng giá nhà cung cấp | Danh bạ và bảng giá nhà cung cấp là dữ liệu tenant, không dùng chung; ảnh hóa đơn nhà cung cấp theo tenant |
| INV-013, 014, 034 | Không có số | Không (đọc) | Định mức, công thức, nguồn | Gợi ý lấy hàng chỉ trong tenant |
| INV-016, 017, 022, 023, 018/028 | HK, XN, BL theo chi nhánh | Tạo và ghi sổ: khóa theo (tenant, phiếu); bán lẻ gắn thanh toán idempotent | Chính sách trả, vật tư tiêu hao | Phiếu bán lẻ và hoàn tiền theo chi nhánh làm việc |
| HRM-001..008, 015, 020 | Mã nhân viên duy nhất trong tenant (không dùng đăng nhập); dòng công định danh bằng (tenant, lệnh, hạng mục, phiên bản quy tắc) | Sinh dòng công khi QC đạt: id xác định theo (tenant, hạng mục, lần QC) nên QC lặp hoặc phát lại không tạo trùng; đảo công cũng xác định | Phương pháp, hệ số, giờ chuẩn | Một người làm ở hai tenant là hai hồ sơ nhân sự độc lập (danh tính một-nhiều chỉ ở tầng đăng nhập, RULE-034); dữ liệu cá nhân che theo vai trò |
| HRM-009, 021 | Dòng hoa hồng theo (tenant, lệnh, người nhận) | Ghi khi thu đủ: id xác định, bấm hai lần ra một dòng; đảo khi hoàn tiền xác định theo (phiếu hoàn) | Cơ sở, tỷ lệ | Báo cáo hoa hồng chỉ trong tenant, xuất có nhật ký |
| HRM-010, 017, 019, 003, 011, 014, 016, 018, 002, 012 | Kỳ công định danh (tenant, chi nhánh, kỳ), không cần số tuần tự | Duyệt, khóa, mở lại: khóa theo (tenant, kỳ, bước) | Chu kỳ, ngưỡng nhập bù, ca | Tệp xuất bảng công có nhãn số tạm hoặc chính thức, nhật ký xuất theo tenant; chính sách xóa khi nghỉ việc theo tenant |
| ACC-006, 026, 015, 022, 016, 018, 019, 028 | Phiếu thu, chi, hoàn theo chi nhánh (đã có); phân bổ định danh theo (tenant, thanh toán, đối tượng) | Phân bổ, hoàn tiền, chi: khóa theo (tenant, chứng từ, bước), thực hiện một lần; đảo một lần | Nhóm tuổi, hạn, hạn mức | Công nợ không cộng gộp giữa tenant; cờ "vượt hạn mức nợ toàn chuỗi" chỉ trong tenant (P9) |
| ACC-007, 027 | Theo PN và TR (trên) | Ghi nợ phải trả từ PN: khóa xác định theo (tenant, PN) | Điều khoản nhà cung cấp, ba bên | Số dư nhà cung cấp theo tenant |
| RPT-002, 008, 010, 015, 016, 005, 006, 007 | Không | Rollup idempotent theo băm nội dung (đã có), theo (tenant, chi nhánh, ngày) | Nhóm chi nhánh, ngưỡng, kỳ so sánh | Xếp hạng và hợp nhất **trong tenant**; không có báo cáo chéo tenant (RULE-017); QV chỉ thấy nhóm được giao |
| SYS-008, CRM-006..009, REC-034, 035 | Mẫu tin theo tenant; tin có mã duy nhất trong tenant | Gửi tin: khóa xác định theo (tenant, sự kiện, người nhận, kênh) để không gửi trùng khi thử lại | Nhà cung cấp và bí mật theo tenant (RULE-024); khung giờ | Tenant chưa xác minh không gửi hàng loạt (RULE-028); thông báo không gửi nhầm tenant; nhà cung cấp giả chỉ trong môi trường thử |
| REC-018, 036 (bảo hành chéo) | Lệnh bảo hành đánh số theo chi nhánh tiếp nhận | Mở lệnh bảo hành: khóa theo (tenant, lệnh gốc, lần) | Chính sách bảo hành | Phép chiếu P4 chỉ trong tenant, không mở được lệnh gốc |

Điểm chung cần lưu ý: (1) mọi điểm tạo mới của slice nên đi qua điểm kiểm tra hạn mức và tính năng của tenant nếu đã có (mặc định cho phép; MT-2, RULE-023: không chặn hoàn tất chứng từ đang mở); (2) tenant `suspended` hoặc `terminating` chỉ đọc (đã có), nên các công việc nền sinh dữ liệu mới (nhắc, chuyển cấp, sinh công) phải bỏ qua tenant chỉ đọc; (3) xuất dữ liệu một tenant (`scripts/export-tenant.ts`) phải gồm các bộ sưu tập mới của giai đoạn 2, và test "mọi bộ sưu tập mang `tenantId` phải nằm trong danh sách di chuyển" bắt buộc cập nhật.

## 9. Luồng chuyển kho liên chi nhánh (mô tả bằng chữ)

Sơ đồ gốc bị mất khi xuất tài liệu. Bản đầy đủ nằm ở `docs/user-journey-business-workflow.md` §4, tiểu mục "Luồng chuyển kho liên chi nhánh". Tóm tắt: (1) phát hiện thiếu hàng, hệ thống gợi ý kho tổng, chi nhánh dư (chỉ số "có thể cho"), rồi nhà cung cấp; (2) chi nhánh nhận lập yêu cầu chuyển YK; (3) chi nhánh gửi xác nhận, sinh phiếu CK (hoặc lập CK trực tiếp); (4) CK vượt ngưỡng giá trị lớn chờ chủ hoặc quản lý vùng duyệt, đây là điểm quyết định duy nhất; (5) gửi: tồn thực tế bên gửi giảm, "đang vận chuyển" gắn kho nhận tăng, khả dụng hai bên không tăng; (6) nhận: tồn thực tế bên nhận tăng đúng số nhận, "đang vận chuyển" giảm đúng số gửi; (7) lệch thì biên bản kèm ảnh, phần lệch treo, đề xuất kết quả (chờ bù, ghi mất, hàng hỏng, điều chỉnh) và bên chịu giá trị, bên gửi đồng thuận, vượt ngưỡng hoặc khác vùng thì cấp cao hơn duyệt; (8) đóng phiếu khi phần treo về 0; bất biến: tổng (tồn thực tế + đang vận chuyển) của tenant không đổi qua chuyển kho trừ phần ghi mất hoặc điều chỉnh đã duyệt; (9) ngoại lệ: kho ngừng dùng hoặc chi nhánh khóa khi còn CK chưa đóng bị chặn; chuyển giữa hai pháp nhân và hiện giá vốn là `[Cần xác nhận]` (Q69).

## 10. Định nghĩa hoàn thành cho slice giai đoạn 2

Theo `docs/dev/implementation-plan.md` §4 (14 mục), đọc cùng các điều chỉnh sau. **Quy trình kiểm tra:** dev chạy `pnpm check:fast` trong vòng lặp bên trong (kiểm kiểu, eslint và prettier, test liên quan, ranh giới module); CI trên PR chạy phần còn lại (toàn bộ test tích hợp trên emulator, e2e, `pnpm check:indexes`, `pnpm check:bundle`, build) và deep review `/code-review medium` làm trên PR, không làm hai lần. Dev không cần chạy tay toàn bộ bộ kiểm tra trước khi mở PR, nhưng PR chỉ gộp khi CI xanh.

Một slice xong khi:

1. Mỗi tiêu chí nghiệm thu của FR trong slice có test tự động đạt (đơn vị, tích hợp hoặc e2e), tên test chứa mã FR, RULE hoặc UAT-P2; không bỏ qua hoặc làm yếu test.
2. Công thức (giá vốn, công, hoa hồng, tuổi nợ, hạn mức cộng dồn, gợi ý đặt hàng) có bảng ví dụ trong `tests/fixtures/...` có trường `signedOffBy` và `signedAt`; ví dụ chưa ký ghi rõ "minh họa" và slice báo "chưa đóng UAT" cho phần đó (NFR-MNT-01).
3. **Trục tenant và trục chi nhánh** trong ma trận cô lập cho mọi danh sách, tìm kiếm, báo cáo, xuất và tệp của slice; hai tenant trở lên trong seed (NFR-TEN-01); UAT-P2-11.
4. Mọi ghi có nhật ký trong cùng giao dịch (FR-SYS-003); Firestore: mọi đọc trước ghi đầu tiên.
5. Ghi tiền, kho, đơn mua, kỳ công, duyệt có `Idempotency-Key` hoặc khóa xác định chứa tenant và test phát lại; test đồng thời cho tồn (gửi, nhận, kiểm kê, xuất) và cho sinh công, hoa hồng.
6. Phân quyền theo hành động có test cho vai trò có quyền và không có quyền; người đề xuất không tự duyệt (RULE-036); dữ liệu cá nhân nhân sự che theo vai trò.
7. Không số tiền, ngưỡng, nhóm tuổi, hạn mức, tỷ lệ viết cứng trong mã; mọi giá trị qua cấu hình có ngày hiệu lực (mục 7); đổi cấu hình không đổi chứng từ đã phát hành (RULE-019).
8. Ngân sách chỉ mục: `pnpm check:indexes` không vượt 195; mọi hình truy vấn mới đăng ký ở `repos/queries.ts`, dùng lại hình có sẵn, đọc theo khóa, lọc trong bộ nhớ trên tập có giới hạn hoặc phi chuẩn hóa; muốn thêm chỉ mục phải gỡ chỉ mục tương ứng trong cùng PR.
9. Màn hình theo `design/` (prototype G1 đến G4) có đủ trạng thái tải, rỗng, lỗi, không quyền, chỉ đọc, mất kết nối; i18n tiếng Việt, VND, `dd/MM/yyyy`; axe, bàn phím, chạm 44 px; sai lệch với thiết kế báo cho designer.
10. Báo cáo thay đổi hành vi cho BA (BA cập nhật FRD, Journey, ma trận truy vết); dev cập nhật `docs/dev/status.md`, `docs/dev/index-budget.md` và `CLAUDE.md` (phần Status) khi slice đóng.

## 11. Mâu thuẫn và khoảng trống tài liệu phát hiện khi lập kế hoạch

1. Kế hoạch sơ bộ gán nhầm mã kiểm kê (INV-015..018); đã sửa (mục 1).
2. FRD INV-018 và INV-028 trùng nghiệp vụ; đã ghi chú ở FRD §5, xây một lần.
3. FRD INV-022 (điều chỉnh hóa đơn) phụ thuộc EIN-007 (giai đoạn 3); hiện hệ thống chặn trả khi lệnh có hóa đơn hợp lệ.
4. FRD §13 xếp SYS-017 ở giai đoạn 2, kế hoạch triển khai ghi giai đoạn 4.
5. FRD RPT-007 (Must, tuổi nợ phải thu và phải trả) cần ACC-006, 007; kế hoạch sơ bộ đặt RPT-007 ở 2.1; đã dời.
6. FRD RPT-006 "khớp bảng công" chỉ kiểm được từ HRM-010 và chỉ đúng khi phương pháp là giờ chuẩn (ba-answers-04 câu 13).
7. Các mã FR đã dùng trong tài liệu BA nhưng chưa có trong FRD (INV-029, 031 cũ, ACC-021, 023..025, SYS-019..032, REC-037..043, HRM-019 cũ): bản 0.5 chỉ áp dụng phần giai đoạn 2; phần giai đoạn 1 vẫn là nợ truy vết (QĐ2-11).
8. Journey §7 ví dụ hạn mức "2 triệu và 10 triệu" khác Phụ lục E "20 triệu và 100 triệu" của `ba-answers-04`; cả hai chỉ là minh họa, không tài liệu nào là hạn mức thật (Q67).
9. Số chỉ mục 192 hay 193 (mục 6, D1).
10. NFR-OFF-01 có hai dòng khác nhau trong FRD (đề xuất C-11 chưa áp dụng) ảnh hưởng HRM-019.
11. Journey §4 viết quy trình mua có thể không có bước yêu cầu và duyệt ở chi nhánh nhỏ; FRD PUR-001, 002 chưa cho phép bỏ bước; PUR-012 giải quyết.

## 12. Việc BA đã làm và việc còn lại cho tài liệu khác

Đã sửa: `docs/functional-requirements.md` (đếm, 20 FR mới, §13 phạm vi giai đoạn 2, UAT-P2, ma trận truy vết), `docs/business-requirements.md` (RULE-036..038, §9), `docs/user-journey-business-workflow.md` (§4 luồng chuyển kho bằng chữ, §7 phê duyệt bổ sung), `docs/dev/implementation-plan.md` §7 (con trỏ, thứ tự), tệp này.

Còn lại (không làm ở đợt này): BA kiểm lại `docs/ui-ux/screen-inventory.md` mã FR cho màn mới (không có màn mới bắt buộc; designer chỉ cần đối chiếu G3-HRM-06 hai đại lượng công, G4-APR-03 ủy quyền, G3-INV-16 đếm mù); `docs/dev/open-questions-for-ba.md` (dev chép Q64..Q90); `docs/ui-ux/proposed-doc-changes.md` (đánh dấu các mã đã áp dụng); BRD bảng BR nếu khách yêu cầu BR mới cho đánh số chứng từ (ba-answers §14.3).

## 13. Brief giao dev

Chung cho cả ba brief: đọc `CLAUDE.md` (trừ phần dev đang sửa), mục 8 và 10 của tệp này, `docs/dev/multi-tenant-requirements-for-dev.md` §4, §5; `docs/dev/status.md` chỉ phần của module chạm tới; `docs/dev/implementation-plan.md` §4. Viết kế hoạch slice ngắn (phạm vi, tệp, test, hình truy vấn mới) trước khi code. Dừng và hỏi BA nếu gặp quyết định không có trong tài liệu; không chọn thay khách.

### 13.1 Slice 2.5: Phê duyệt đầy đủ (làm trước)

**Mục tiêu.** Hoàn thiện lõi phê duyệt để các slice sau (2.2, 2.3, 2.4, 2.6b, 2.7) chỉ khai báo "loại yêu cầu" và gọi lõi: ma trận phê duyệt cấu hình, chuyển cấp theo hạn, ủy quyền, hàng chờ dùng chung, duyệt hàng loạt cùng loại.

**Tài liệu đọc.** FRD: FR-SYS-004, 015, 033, 034, FR-SYS-012, 013; RULE-011, 036; UAT-P2-01; Journey §7 (ma trận và đoạn bổ sung bản 0.5); `docs/ui-ux/ba-answers-04.md` Phụ lục E (hạn mức mẫu, chỉ minh họa), `docs/ui-ux/ba-answers-05.md` (ủy quyền, chênh lệch quỹ, "kế toán trưởng" là cờ quyền), `docs/ui-ux/review-05-round2-ba.md` mục 5, 8 và `review-06-round2-ba.md` mục 7, 8; `docs/dev/ba-answers-for-dev.md` §20 (R54..R68: cấp 1, cấp 2, trần theo ca của thu ngân R58, hoàn cọc R57), §24 (R105, R106: duyệt dùng một lần, hạn dùng, nhập lại mật khẩu của chủ); `docs/dev/status.md` phần SYS approvals và ACC; `design/` G4-APR-01, 02, 03.

**Ràng buộc.**
- Giữ tương thích ngược: các loại yêu cầu đang chạy (hoàn tiền khách, hoàn cọc, mở lại ngày, hủy lệnh, đảo thanh toán, phiếu chi vượt hạn mức, hóa đơn điều chỉnh, thay thế, hủy, duyệt phiếu kho bất thường) giữ hành vi và test hiện có; yêu cầu đang chờ khi nâng cấp không bị mất (cảnh báo `approvalSlots` trỏ id cấu hình cũ đã ghi nhận ở status).
- Người đề xuất không bao giờ tự duyệt, kể cả có quyền duyệt hoặc nhận ủy quyền; ủy quyền không vượt quyền xem dữ liệu của người ủy quyền (RULE-036).
- Hạn mức chưa cấu hình thì chuyển lên cấp cao nhất, không cho qua; **không có số tiền hay ngưỡng nào viết cứng**; seed minh họa chỉ ở tenant demo, gắn nhãn "minh họa" (Q67).
- Chuyển cấp: nhắc sau T1, chuyển cấp sau T2 theo loại; tính theo giờ làm việc của chi nhánh; công việc nền theo tenant, idempotent theo (tenant, yêu cầu, cấp), bỏ qua tenant chỉ đọc; yêu cầu đã chuyển cấp vẫn "chờ duyệt".
- Duyệt hàng loạt chỉ cùng loại và chỉ loại cấu hình cho phép.
- Cấp quản lý vùng (Q84) là cấu hình nhóm chi nhánh; nếu khách chưa xác nhận vai trò QV thì làm theo cờ quyền, không thêm vai trò cứng.
- Không thêm chỉ mục tổng hợp nếu tránh được (còn 3 chỗ trước ngưỡng 195): hàng chờ theo người duyệt đọc theo khóa hoặc lọc trong bộ nhớ trên tập giới hạn; nếu cần, nêu trong kế hoạch slice và gỡ chỉ mục tương ứng.
- Mọi ghi có nhật ký cùng giao dịch; quyết định duyệt và thực hiện dùng một lần, có hạn dùng; nhập lại mật khẩu của chủ cho loại cấu hình yêu cầu (R106).

**Kết quả mong đợi.** (1) Tiêu chí của FR-SYS-004, 015, 033, 034 có test; (2) UAT-P2-01 chạy xanh trên hai tenant; (3) màn G4-APR-01 (hàng chờ), G4-APR-02 (chi tiết, drawer), G4-APR-03 (ma trận, ủy quyền, chuyển cấp) đúng prototype hoặc báo lệch cho designer; (4) ma trận cô lập: người duyệt, ủy quyền, hàng chờ không lẫn tenant và chi nhánh; (5) báo cáo cho BA: loại yêu cầu đã có, loại thêm, giá trị mặc định đã đặt, hành vi đổi so với trước; (6) cập nhật `status.md`, `index-budget.md` (dev).

**Không làm.** Chuỗi duyệt theo chi phí mua, kiểm kê, công (các slice sau khai báo loại của mình); cộng dồn chống chia nhỏ chi (ACC-028, slice 2.7; chỉ cần để lõi cho phép một "bộ cộng dồn" gắn vào loại).

### 13.2 Slice 2.1: Hợp nhất đa chi nhánh, dashboard chi nhánh và vùng

**Mục tiêu.** (a) **Bước đầu: đề xuất giải ngân sách chỉ mục** trước khi dựng gì thêm; (b) xếp hạng chi nhánh và hợp nhất trong tenant; (c) dashboard quản lý vùng; (d) lịch sử đăng nhập; (e) phát hành danh mục từ trụ sở cho chi nhánh được chọn.

**Tài liệu đọc.** FRD: FR-RPT-002 (kể cả "Làm rõ FR-RPT-002", AC-RPT-002-1..9; xếp hạng là nửa còn lại, R85), 008, 010, 015, 016; FR-SYS-014, 016; FR-RPT-001, 011, 014; RULE-015, 017; NFR-PERF (dashboard hợp nhất dưới 5 giây), NFR-ISO-01; `docs/dev/index-budget.md` (chính sách, ứng viên gộp, bảng 192 chỉ mục); `docs/dev/ba-answers-for-dev.md` §10 (phép chiếu), §22, §25 (Q-A, Q-B, F-1, F-2; Q58 đến Q63); `docs/ui-ux/screen-inventory.md` G1-DSH-01..03, G4-RPT; Q84, Q85.

**Ràng buộc.**
- Đề xuất giải ngân sách là tài liệu ngắn (một trang) nêu: số đo hiện tại (đối chiếu 192 hay 193), các chỉ mục sẽ gộp hoặc bỏ, hình truy vấn nào đổi, **đo trước và sau** (độ trễ truy vấn, số lần đọc) cho chủ (đọc nhiều chi nhánh) ở 8 và 20 chi nhánh, và bằng chứng hành vi không đổi (ma trận cô lập, kết quả báo cáo trùng bản gốc). Ưu tiên gộp hình truy vấn và bỏ chỉ mục thừa (ví dụ cặp "toàn công ty" và "@scope", `auditLogs`, biến thể asc/desc, `parts.list.*`); **không nâng trần 200** trừ khi dev chứng minh bằng số liệu là cần; `pnpm check:indexes` vẫn fail trên 195.
- BA ràng buộc hành vi khi gộp: không làm lộ dữ liệu chi nhánh ngoài phạm vi (NFR-ISO-01), kết quả báo cáo và danh sách không đổi, mọi hình vẫn có `tenantId`.
- Số hợp nhất: tổng các chi nhánh bằng số toàn tenant (FR-RPT-001); xếp hạng tính trên cùng kỳ; ngày chưa chốt là số tạm có nhãn (RPT-010); không có báo cáo chéo tenant (RULE-017).
- Dashboard vùng chỉ thấy nhóm chi nhánh được giao (Q84 chưa trả lời: làm theo cấu hình nhóm, không thêm vai trò cứng); ai xem xếp hạng theo Q85 (mặc định: chủ và QV; quản lý chi nhánh chỉ thấy của mình).
- Báo cáo đọc rollup theo khóa; không hình truy vấn mới cho báo cáo; công nợ, kiểm kê, bảng công **chưa có** nên chỉ làm phần không phụ thuộc (RPT-015 không có công nợ; RPT-016 không có độ chính xác tồn).
- SYS-016: phát hành danh mục (mẫu kiểm tra, dịch vụ mẫu, giảm giá, hình thức thanh toán) từ trụ sở cho chi nhánh được chọn, trong tenant, có ngày hiệu lực; đổi ở trụ sở không sửa chứng từ cũ.

**Kết quả mong đợi.** (1) Đề xuất giải ngân sách và PR đầu tiên chỉ chứa việc giải ngân sách, đã qua CI; (2) FR-RPT-002 (xếp hạng), 008, 010, 015, 016 (phần áp dụng), FR-SYS-014, 016 đạt tiêu chí, có test; (3) UAT-P2-10; (4) số đo tải với 8 và 20 chi nhánh mô phỏng (dashboard hợp nhất dưới 5 giây là NFR đề xuất, chưa kiểm chứng đến khi đo staging, Q63); (5) ma trận cô lập có trục tenant, chi nhánh, vùng; (6) báo cáo cho BA các thay đổi hành vi.

### 13.3 Slice 2.6a: Nhân công, lõi tính công

**Mục tiêu.** Dựng lõi tính công cấu hình được, không hard-code công thức: hồ sơ nhân sự, giờ chuẩn có hiệu lực, giờ thực từ sự kiện thời gian đã có, phương pháp tính công theo (loại dịch vụ x chức danh x chi nhánh), ghi công khi qua QC, đổi thợ, làm lại, hủy.

**Tài liệu đọc.** FRD: FR-HRM-001, 004, 005, 006, 007, 008, 015, 020; RULE-038; UAT-11; Journey §5 (mô hình công), §8 (đổi thợ, hủy sau khi xuất phụ tùng); BRD §4 (không tính lương), §8 (rủi ro công thức), §10 bảng TBD; `docs/ui-ux/ba-answers-04.md` câu 13, 14, 15 và Phụ lục A (badge dòng công), D (che dữ liệu nhân sự); `docs/dev/ba-answers-for-dev.md` §19 (R39..R53: sự kiện thời gian, hai thợ cộng theo từng người) và §24 R101 (b); `design/` G3-HRM-01, 02, 06, 07; `docs/dev/status.md` phần REC slice 1.6.

**Ràng buộc.**
- **Không có công thức hay con số nào viết cứng** (NFR-MNT-01, RULE-038): phương pháp, hệ số chức danh, đơn giá giờ, làm tròn, ngưỡng điều chỉnh là cấu hình có hiệu lực. Công thức của khách **chưa chốt** (Q73): xây cơ chế tổng quát; dữ liệu mẫu chỉ ở tenant demo, nhãn "minh họa"; bảng ví dụ ký (`tests/fixtures/...`, `signedOffBy` rỗng đến khi khách ký) và slice **không đóng UAT-11** khi chưa có chữ ký.
- Lưu hai đại lượng: giờ công quy đổi và tiền công VND nguyên; cộng dồn và xuất cho kế toán là tiền công; không gộp hoa hồng vào công (hoa hồng ở 2.6b).
- Công chỉ ghi khi hạng mục qua QC (HRM-007); hạng mục chờ QC hiển thị "chờ QC"; QC trả lại không phát sinh công; đổi thợ chia theo giờ thực; làm lại theo quy tắc cấu hình, gắn hạng mục gốc (HRM-016 ở 2.6b nhưng dữ liệu liên kết phải có); hủy đảo công.
- Dòng công giữ phiên bản quy tắc và định mức đã áp; đổi quy tắc có hiệu lực từ ngày D không đổi dòng công trước D; id dòng công xác định theo (tenant, hạng mục, lần QC) để QC lặp không tạo trùng.
- Điều chỉnh công thủ công: dùng cơ chế duyệt tối thiểu hiện có với loại mới; vượt ngưỡng cấu hình cần chủ (Phụ lục E #9 mẫu); khi 2.5 xong chỉ cần khai báo vào ma trận.
- Hồ sơ nhân sự: dữ liệu cá nhân che theo vai trò (Phụ lục D), không thu lương, tài khoản ngân hàng, bảo hiểm; hồ sơ khác tài khoản đăng nhập (liên kết); mã nhân viên duy nhất trong tenant; một người ở hai tenant là hai hồ sơ.
- Kỳ công, khóa kỳ, nhập bù, hoa hồng, năng suất, chấm công thuộc 2.6b, không làm ở đây.
- Truy vấn dòng công theo (chi nhánh, thợ, kỳ) và theo lệnh: đề nghị dùng hình có sẵn, đọc theo khóa hoặc tài liệu tổng hợp giới hạn; nêu trong kế hoạch slice, không thêm chỉ mục nếu tránh được.

**Kết quả mong đợi.** (1) FR-HRM-001, 004, 005, 006, 007, 008, 015, 020 đạt tiêu chí, mỗi tiêu chí một test; (2) sáu ca kiểm thử tự động theo sáu ví dụ (thay dầu 0,3 giờ chuẩn; khoán; phần trăm; đổi thợ giữa chừng; làm lại sau QC; hủy lệnh sau khi ghi công), dữ liệu minh họa gắn cờ chưa ký; (3) màn G3-HRM-01, 02, 06, 07 đúng prototype hoặc báo lệch; (4) ma trận cô lập tenant và chi nhánh cho nhân sự, quy tắc, dòng công; (5) test phát lại QC; (6) báo cáo cho BA: phương pháp hỗ trợ, thứ tự ưu tiên ghi đè, quy tắc làm tròn đã chọn và lý do.

## 14. Trả lời BA cho slice 2.5, 2.1, 2.6a (06/11/2026, theo ủy quyền của chủ dự án; chờ khách xác nhận)

Nguồn câu hỏi: `docs/dev/status.md` mục "Slice 2.5", "Slice 2.1", "Slice 2.6a" của ba nhánh `feat/p2-5-approvals`, `feat/p2-1-consolidation`, `feat/p2-6a-labor`. Cột "Dev" dùng hai giá trị: **GIỮ** (chấp nhận nguyên trạng, không đổi code) và **SỬA** (đổi hành vi, dev phải làm). Mọi quyết định còn `[Cần xác nhận]` vẫn là cấu hình có ngày hiệu lực, không viết cứng. FRD và BRD đã cập nhật chỗ bị ảnh hưởng (không thêm hay đổi mã FR/RULE, nên số đếm FRD, BRD không đổi): FR-SYS-014, 016, 033/034 (đoạn "Làm rõ bản 0.6"), AC-RPT-002-10, 11 (mới), FR-HRM-020, UAT-P2-10, RULE-036.

### 14.1 Slice 2.5: phê duyệt đầy đủ

| # | Câu hỏi | Quyết định BA và lý do | Dev |
| --- | --- | --- | --- |
| 2.5-1 | T2 tính "thêm sau T1" | **Chấp nhận.** Khớp mẫu của FRD-SYS-034 ("nhắc sau 1 ngày làm việc, chuyển cấp sau thêm 2 ngày"): chuyển cấp ở T1 + T2. Ghi vào FRD. "Mua gấp 2 giờ" là tham số chuyển cấp của chính yêu cầu mua gấp (T1 + T2 = 2 giờ, tách T1 và T2 khi 2.4 khai báo loại); không lẫn với hạn hậu duyệt N giờ (mẫu 24) của FR-PUR-009 | GIỮ |
| 2.5-2 | Chưa có work-hours thì tính giờ đồng hồ | **Chấp nhận.** Lỗi an toàn (chuyển cấp sớm, không muộn). Điều kiện: chi nhánh chưa cấu hình hiển thị cảnh báo ở màn cấu hình ("đang tính theo giờ đồng hồ") và có trong checklist go-live; tenant mới nên được seed `work-hours` mặc định (thứ Hai đến thứ Bảy, giờ hành chính, `[Cần xác nhận: Khách]` giờ thực) | GIỮ; cảnh báo ở màn cấu hình là việc nhỏ khi làm G4-APR-03 |
| 2.5-3 | Phạm vi ủy quyền là danh sách chi nhánh tường minh | **Chấp nhận.** An toàn hơn: đổi nhóm chi nhánh (slice 2.1) không âm thầm nới quyền ủy quyền. Khi giao diện có "chọn theo nhóm", nhóm được mở thành danh sách tại lúc tạo và ghi nhật ký. Không thêm vai trò QV cứng (Q84 chưa trả lời) | GIỮ |
| 2.5-4 | Hạn mức theo chi nhánh hoặc Company ở giai đoạn 2 | **Chưa cần.** FRD-SYS-033 cho phép ba tầng nhưng ma trận mẫu (Journey §7, Phụ lục E) theo cấp duyệt, không theo chi nhánh; hiện một Company (FR-SYS-018 mở). Tầng tenant đủ cho pilot và 2.2 đến 2.7; ghi đè chi nhánh làm khi khách nêu nhu cầu (câu hỏi P2-A bên dưới). Ràng buộc: không dùng khóa làm khó mở rộng, giữ tiền tố `branch:<id>:` như các cấu hình khác để thêm được không migrate | GIỮ |
| 2.5-5 | Mua gấp 2 giờ chờ 2.4 | **Chấp nhận.** 2.5 chỉ cung cấp cơ chế T1/T2 theo loại; 2.4 khai báo loại `urgent_purchase` kèm T1, T2 | GIỮ |
| 2.5-6 | Ủy quyền của quản lý không với tới yêu cầu đã chuyển cấp 2 | **Đúng nghiệp vụ, thành quy tắc.** Người ủy quyền chỉ trao quyền họ đang có ở cấp hiện tại của yêu cầu (RULE-036 đã bổ sung câu này). Hệ quả vận hành: khi chuyển cấp, người nhận ủy quyền của cấp 1 mất khả năng duyệt, hàng chờ của họ phải bỏ yêu cầu đó và hiện ở hàng chờ cấp 2 | GIỮ; kiểm tra hàng chờ của người nhận ủy quyền không còn hiện yêu cầu đã chuyển cấp (có test thì tốt) |
| 2.5-7 | Tenant chưa có hạn mức lên cấp 2 thay vì rơi về hằng cũ (dev ghi là thay đổi hành vi) | **Chấp nhận, đúng RULE-036.** Rủi ro vận hành: pilot thật mà chưa ban hành hạn mức thì mọi yêu cầu dồn về chủ. Đưa "ban hành bảng hạn mức" vào checklist go-live (Q67) và hiện biểu ngữ ở hàng chờ và G4-APR-03 khi tenant chưa có phiên bản hiệu lực | GIỮ; biểu ngữ là việc nhỏ cho G4-APR-03 |
| 2.5-8 | Hàng loạt bỏ qua loại cần nhập lại mật khẩu; tối đa 50; duyệt từng yêu cầu giao dịch riêng | **Chấp nhận** (khớp FRD-SYS-034, R106) | GIỮ |

### 14.2 Slice 2.1: hợp nhất, dashboard vùng

| # | Câu hỏi | Quyết định BA và lý do | Dev |
| --- | --- | --- | --- |
| 2.1-1 | Q84: QV chỉ xem nhóm được giao ngoài phân công chi nhánh? | **Không thêm ràng buộc thứ hai.** Một nguồn sự thật cho quyền xem là phân công chi nhánh; nhóm chi nhánh chỉ là bộ lọc, không cấp quyền (đúng dev đã làm). "Nhóm được giao" trong UAT-P2-10 hiểu là "nhóm giao với phân công". Bổ sung: nhóm chỉ giao một phần thì hiện nhãn "gồm n trên m chi nhánh, chỉ phần trong phạm vi của bạn" để không ai đọc nhầm là tổng của cả nhóm. Việc có vai trò QV hay không vẫn là `[Cần xác nhận: Chủ dự án, Q84]` | GIỮ; SỬA nhỏ: thêm nhãn giao một phần ở UI và DTO nếu chưa có |
| 2.1-2 | Q85: QL không có xếp hạng, hay xếp hạng ẩn tên chi nhánh khác | **Giữ QL không có xếp hạng** (ba-answers §10: không lộ doanh thu chi nhánh khác; thứ hạng "3 trên 8" tuy không lộ tên vẫn lộ vị thế, nên để chủ quyết). Phương án B (QL thấy hạng của mình, không thấy chi nhánh khác) chỉ làm khi chủ yêu cầu, là thay đổi cấu hình quyền cộng một DTO ẩn tên | GIỮ; `[Cần xác nhận: Chủ dự án, Q85]` |
| 2.1-3 | Xếp hạng khi chi nhánh thiếu ngày | **Chọn phương án so ngày chung** (AC-RPT-002-10), vì FRD-RPT-002 yêu cầu "tính trên cùng kỳ"; xếp theo số ngày khác nhau cho chi nhánh thiếu dữ liệu xuống hạng oan. Chi tiết: ngày chung = ngày mọi chi nhánh trong so sánh đều có số; ngày trước khi mở hoặc sau khi đóng chi nhánh không tính là thiếu (dùng ngày mở và trạng thái chi nhánh); số thực từng chi nhánh vẫn hiện kèm "thiếu n ngày"; không có ngày chung thì không xếp hạng; tỷ lệ tính lại từ tử và mẫu của ngày chung; tổng hợp nhất (FR-RPT-001) vẫn là tổng mọi ngày có số | **SỬA** (`rpt/domain/consolidation.ts`): đổi cơ sở xếp hạng sang ngày chung; thêm test ví dụ tay (hai chi nhánh, một thiếu 3 ngày; chi nhánh mở giữa kỳ; không có ngày chung) |
| 2.1-4 | Khách mới và quay lại | **Chấp nhận định nghĩa của dev** (mới = hồ sơ tạo trong ngày; quay lại = tạo trước; đếm lượt theo ngày) làm mặc định tạm, vì không cần trường mới hay chỉ mục. Hai chỉnh: (a) khách nhập từ Excel (SYS-007) luôn tính "quay lại", nếu không ngày nhập sẽ có đột biến "khách mới"; (b) nhãn ghi "theo lượt" (không phải số khách khác nhau trong kỳ). Định nghĩa theo lệnh đầu tiên của khách chính xác hơn nhưng cần trường `firstOrderAt`; để khi khách yêu cầu (`[Cần xác nhận: Khách]`) | **SỬA nhỏ**: đánh dấu nguồn nhập Excel (hoặc ngày tạo của lô nhập) để loại khỏi "mới"; thêm nhãn "theo lượt". Rollup v6 cần dựng lại phần khách |
| 2.1-5 | Tỷ lệ báo giá được duyệt | **Chấp nhận** công thức duyệt / (duyệt + từ chối + hết hạn), theo báo giá tạo trong kỳ, trạng thái hiện tại, hết hạn lấy từ trạng thái lưu. Bổ sung: đếm theo mã báo giá chứ không theo từng phiên bản; hiện riêng số "đã gửi chưa quyết" ngoài mẫu số; duyệt một phần tính là duyệt và hiện kèm số duyệt toàn bộ / một phần | GIỮ; SỬA nhỏ nếu hiện đếm theo phiên bản; thêm số "chưa quyết" vào DTO |
| 2.1-6 | Ghi lần đăng nhập sai theo tài khoản | **Không ghi ở giai đoạn 2** (đồng ý dev): ngoài lý do lộ email tồn tại, một email có thể thuộc nhiều tenant (RULE-034) nên ghi theo tenant làm lộ tư cách thành viên ở tenant khác. Khóa tạm vẫn theo bộ đếm của ba-answers §1.4. FRD-SYS-014 đã sửa: kết quả = trạng thái phiên. Việc cần luật sư (Q87-loại): thời hạn lưu và IP | GIỮ |
| 2.1-7 | SYS-016: danh mục nào là thực thể ở giai đoạn 2 | Dịch vụ mẫu **bắt buộc** (đã là thực thể ở `sys/application/catalog.ts`) và chính sách giảm giá; hình thức thanh toán khi có bảng riêng (Phase 2 ACC); mẫu kiểm tra khi có INS. Rút khỏi chi nhánh không áp cho chứng từ đang mở (đồng ý dev, RULE-019). Vì AC của FR-SYS-016 là "thay đổi ở trụ sở áp dụng cho chi nhánh được chọn", **chưa nối vào danh sách dịch vụ thì FR chưa đạt** | **SỬA**: gọi `isReleasedToBranch` ở danh sách dịch vụ chọn trong báo giá và ở danh sách dịch vụ của chi nhánh, thêm test (chi nhánh không được phát hành không thấy dịch vụ; chưa có bản phát hành thì thấy; chứng từ cũ giữ dịch vụ đã rút). Hình thức thanh toán, mẫu kiểm tra: khai báo khóa, chưa nối |
| 2.1-8 | RPT-015, 016 phần còn lại (công nợ theo khách, độ chính xác tồn, hao hụt, vòng quay) | **Chấp nhận chờ**: công nợ theo khách sang 2.7; độ chính xác tồn và hao hụt sang 2.3a. Vòng quay tồn kho theo giá vốn nên chờ bảng ví dụ giá vốn ký (UAT-25, Q66) và đi cùng 2.3a. Trong lúc chờ, màn không hiện thẻ trống: ẩn hẳn chỉ số chưa có nguồn | GIỮ |
| 2.1-9 | Hạn mức tải: dev chỉ đo chi phí logic trong bộ nhớ | **Chấp nhận**; số đo thật trên staging vẫn là điều kiện đóng UAT-P2-10 (Q63). Ghi cảnh báo: rollup mỗi ngày kèm `refs` và `alerts` nặng, nếu staging chậm thì thêm bản tóm tắt theo tháng (đã ghi) | GIỮ |

### 14.3 Slice 2.6a: nhân công, lõi tính công

| # | Câu hỏi | Quyết định BA và lý do | Dev |
| --- | --- | --- | --- |
| 2.6a-1 | Phương pháp tỷ lệ % ghi công khi QC hay hoa hồng khi thu đủ | **Hoa hồng khi thu đủ** (ba-answers-04 câu 14 A-09, F4-13; FRD-HRM-021: thợ khoán hoặc giờ chuẩn không chờ thu, hàm ý tỷ lệ % có chờ). Nhưng 6 ví dụ của HRM-020 vẫn có "một hạng mục theo phần trăm" cần tính được. Cách dung hòa (đã ghi vào FRD-HRM-020): khi QC đạt, dòng công của thợ theo tỷ lệ % được tạo với giá trị đã tính (giữ phiên bản quy tắc) nhưng ở trạng thái **"chờ thu đủ"**, không vào đại lượng cộng dồn và tệp xuất cho kế toán; khi lệnh thu đủ (2.6b, HRM-021) dòng chuyển sang ghi nhận, hoàn tiền thì có dòng đảo. Cả hai điều kiện (QC và thu đủ) phải đạt | **SỬA**: thêm trạng thái "chờ thu đủ" cho dòng phương pháp `percent`; loại khỏi tổng đã ghi ở G3-HRM-07 và hiện cột riêng "chờ thu đủ"; id dòng và đảo giữ nguyên; test (ví dụ phần trăm: chưa thu thì tổng đã ghi không gồm; kết nối chuyển sang ghi nhận để 2.6b). Việc chuyển trạng thái khi thu đủ là 2.6b |
| 2.6a-2 | Nhiều thợ một hạng mục: phương pháp theo thợ làm nhiều giờ nhất; khoán, cố định chia theo giờ thực; hệ số chức danh chỉ áp cho phương pháp giờ | **Chấp nhận**, vì một khoản khoán hay cố định chỉ có một số tiền để chia, nên cần một phương pháp cho cả hạng mục. Bổ sung đã ghi vào FRD-HRM-020: hòa giờ thì thợ được phân công trước; phương pháp theo giờ thì mỗi thợ nhân giờ của mình với hệ số chức danh của mình. Thêm ví dụ thứ 7 vào bảng chờ khách ký: hai thợ khác chức danh trên cùng một hạng mục (cho thấy việc chọn theo thợ làm nhiều nhất). `[Cần xác nhận: Khách, Kế toán, Q73]` | GIỮ; thêm một ca test và một dòng fixture "minh họa, chưa ký" |
| 2.6a-3 | `reworkMode` mặc định "giữ công đã ghi"; làm lại của khách giữ, đảo hay trả thêm | **Chấp nhận mặc định giữ** (làm lại do lỗi thợ không trả hai lần; giờ làm lại vẫn tính vào giờ thực của năng suất, ba-answers-04 câu 13). Phân biệt hai trường hợp: (a) làm lại vì QC trả hoặc khiếu nại do lỗi, đi theo `reworkMode`; (b) khách yêu cầu thêm việc là **hạng mục mới có báo giá** nên có công như mọi hạng mục, không phải làm lại. `reworkMode` có ba giá trị (giữ, đảo, trả thêm theo giờ làm lại) là đúng, đặt theo chi nhánh. Ví dụ "làm lại sau QC" trong 6 ví dụ ký phải nói rõ đang chọn giá trị nào `[Cần xác nhận: Khách, Q73]` | GIỮ |
| 2.6a-4 | Đơn giá giờ nằm trong phương pháp (ghi đè theo chức danh bằng khóa `:pos:`) thay bảng đơn giá chức danh x chi nhánh của HRM-06 | **Chấp nhận**: không mất chức năng vì khóa phương pháp đã gồm chi nhánh, loại việc, chức danh nên ma trận chức danh x chi nhánh là cách xem, không phải dữ liệu thứ hai. Việc cho designer: G3-HRM-06 hiển thị ma trận suy ra từ quy tắc, chỉnh sửa thành đề xuất phiên bản mới. Đổi riêng đơn giá là một phiên bản mới của quy tắc (đúng RULE-038) | GIỮ; báo designer |
| 2.6a-5 | Vai trò NS không có trong ma trận 10 vai trò; QL và CH đảm nhiệm hồ sơ nhân sự | **Chấp nhận tạm cho 2.6a.** `ba-answers-04` câu 5 (Phase 2, chờ khách) đã quyết thêm hai vai trò MH và NS và NS tách khỏi QL vì quyền tối thiểu với dữ liệu cá nhân. Điều kiện: quyền gắn theo hành động (`employee:view|update`, `labor:*`), không gắn cứng tên vai trò, để thêm NS là top-up quyền, không sửa code; NS thêm trước go-live HRM (cùng 2.6b), MH thêm ở 2.4. Chủ dự án xác nhận hai vai trò (câu P2-D) | GIỮ |
| 2.6a-6 | Ngưỡng điều chỉnh chưa cấu hình thì mọi điều chỉnh cần chủ | **Chấp nhận** (cùng nguyên tắc RULE-036: chưa ban hành thì lên cấp cao nhất). Số mẫu Phụ lục E #9 chỉ ở seed demo | GIỮ |
| 2.6a-7 | QĐ có `employee:view` chưa có `labor:view` | **Chấp nhận cho 2.6a.** Đề xuất cho 2.6b: QĐ xem **giờ công và trạng thái** của thợ trong chi nhánh (cần để xác nhận nhập bù, HRM-019), **không xem tiền công (VND)** của từng người; thợ chỉ thấy của mình (đã có). Tách hai quyền xem giờ và xem tiền khi làm 2.6b `[Cần xác nhận: Chủ dự án]` | GIỮ |
| 2.6a-8 | Một chi nhánh hiện tại cho mỗi nhân sự, kèm lịch sử chức danh; đổi chi nhánh để 2.6b | **Chấp nhận.** Lưu ý: chi nhánh của dòng công là chi nhánh của **lệnh** nơi thợ làm việc, không phải chi nhánh hồ sơ nhân sự; dev xác nhận đúng như vậy (thợ hỗ trợ chi nhánh khác vẫn có công ở đúng chi nhánh). Hỏi khách: có thợ làm thường xuyên ở hai chi nhánh cùng lúc không (P2-E) | GIỮ; xác nhận chi nhánh dòng công = chi nhánh lệnh, thêm test nếu chưa có |
| 2.6a-9 | Mục "chưa kiểm": hủy lệnh thật sau QC đạt rồi mở lại do báo giá bổ sung; e2e trình duyệt; Firestore Emulator | **Không đóng slice khi chưa kiểm hai nhánh REC cùng dùng một cổng**: bắt buộc một test tích hợp đi qua đường hủy thật (không gọi `prepareCancel` trực tiếp). UAT-11 vẫn chưa đóng đến khi kế toán khách ký | **SỬA**: thêm test tích hợp đường hủy thật |

### 14.4 Nhân viên không có email (thợ) đăng nhập thế nào

Vấn đề: ba-answers-for-dev §1.6 và D-03 quyết thợ không có email đăng nhập bằng mã nhân viên cộng mật khẩu tạm do QL cấp. Sau MT-0 (FR-TEN-016, 017; RULE-034) đăng nhập chỉ bằng email duy nhất toàn nền tảng, mã nhân viên chỉ duy nhất trong tenant nên **thợ không có email hiện không đăng nhập được**: mâu thuẫn giữa hai tài liệu.

| Phương án | Nội dung | Ưu | Nhược |
| --- | --- | --- | --- |
| A (khuyến nghị) | Người dùng nhập **mã công ty (tenant) + mã nhân viên + mật khẩu**; hệ thống ánh xạ sang một định danh đăng nhập nội bộ duy nhất (ví dụ địa chỉ giả trên tên miền dành riêng, không nhận thư; cách lưu do dev chọn). Tài khoản loại này: một tư cách thành viên duy nhất (không đa tenant), không có kênh khôi phục, đặt lại mật khẩu chỉ do QL (mật khẩu tạm, buộc đổi lần đầu), đăng nhập sai trả lỗi trung lập như thường (UAT-TEN-21). Thợ dùng hằng ngày tablet xưởng với PIN (AUT-10, do chủ dự án cung cấp sau), đăng nhập mật khẩu chỉ khi cần | Khớp thực tế xưởng và D-03; không phá RULE-034; không đòi email | Thêm ô "mã công ty" ở AUT-01; hai kiểu định danh |
| B | Bắt buộc mọi người có email (tạo email miễn phí) | Một kiểu định danh | Không thực tế với thợ; phụ thuộc người dùng giữ hộp thư |
| C | Thợ không có tài khoản, chỉ dùng PIN trên thiết bị xưởng | Đơn giản | Không tự xem công của mình, không đổi mật khẩu, PIN chưa có (chủ dự án cung cấp sau) |

Quyết định BA theo ủy quyền: **A**. `[Cần xác nhận: Chủ dự án]` vì chạm RULE-034 (câu P2-C). Dev: **SỬA, việc riêng ngoài ba slice này**, làm trước go-live pilot: (1) tạo người dùng không email (QL cấp mật khẩu tạm); (2) màn đăng nhập nhận mã công ty + mã nhân viên; (3) test cô lập (cùng mã NV0001 ở hai tenant không lẫn), test thời gian đồng đều, test không lộ mã công ty có tồn tại hay không. Nếu pilot chưa có thợ đăng nhập (chỉ QĐ, QL, CV có email) thì không chặn pilot; ghi rõ trạng thái đó ở `status.md`.

### 14.5 Danh sách thay đổi bắt buộc cho dev (tóm tắt)

1. Slice 2.1: xếp hạng theo **ngày chung** (2.1-3); nối `isReleasedToBranch` vào danh sách dịch vụ (2.1-7); loại khách nhập Excel khỏi "mới" và nhãn "theo lượt" (2.1-4); đếm báo giá theo mã, thêm số "chưa quyết" (2.1-5); nhãn "chỉ phần trong phạm vi của bạn" cho nhóm giao một phần (2.1-1).
2. Slice 2.6a: dòng phương pháp tỷ lệ % có trạng thái **"chờ thu đủ"**, không vào tổng đã ghi (2.6a-1); test hủy lệnh qua đường REC thật (2.6a-9); thêm ví dụ thứ 7 (2.6a-2); xác nhận chi nhánh dòng công = chi nhánh lệnh (2.6a-8); quyền theo hành động, không theo tên vai trò (2.6a-5).
3. Slice 2.5: không đổi hành vi; việc nhỏ khi làm G4-APR-03: cảnh báo chưa có `work-hours`, biểu ngữ chưa ban hành hạn mức, hàng chờ của người nhận ủy quyền không còn yêu cầu đã chuyển cấp.
4. Việc riêng: đăng nhập cho nhân viên không có email (14.4).
5. Chấp nhận nguyên trạng: 2.5-1 đến 2.5-6, 2.5-8; 2.1-2, 2.1-6, 2.1-8, 2.1-9; 2.6a-2 (cơ chế), 2.6a-3, 2.6a-4, 2.6a-6, 2.6a-7, 2.6a-8 (cơ chế).

### 14.6 Câu hỏi mới còn mở (tiếp nối bảng ở mục 6)

| # | Gửi | Câu hỏi | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- | --- |
| P2-A (mở rộng Q68) | Chủ dự án | Các chi nhánh có hạn mức duyệt khác nhau không (ví dụ chi nhánh lớn nhận hạn mức cao hơn)? | Chung toàn tenant; theo chi nhánh | Chung ở giai đoạn 2 | Theo chi nhánh: thêm giao diện và test ghi đè chi nhánh trong 2.5 (khóa đã giữ chỗ) |
| P2-B (mở rộng Q85) | Chủ dự án | Quản lý chi nhánh có thấy thứ hạng của mình không (không thấy chi nhánh khác)? | Không; thấy hạng của mình | Không | Thấy hạng: thêm một DTO ẩn tên, quyền riêng |
| P2-C | Chủ dự án | Chọn phương án đăng nhập cho nhân viên không email (14.4) | A, B, C | A | B hoặc C: đổi FR-SYS-001 và luồng tạo người dùng |
| P2-D (mở rộng ba-answers-04 câu 5) | Chủ dự án | Xác nhận thêm hai vai trò NS (nhân sự) và MH (mua hàng) và thời điểm thêm | Thêm ở Phase 2; để QL và CH kiêm | Thêm: NS cùng 2.6b, MH cùng 2.4 | Kiêm nhiệm: QL xem toàn bộ dữ liệu cá nhân nhân sự chi nhánh |
| P2-E | Khách | Thợ có làm thường xuyên ở hai chi nhánh cùng lúc (hỗ trợ cố định) không; công tính ở chi nhánh nào | Chỉ một chi nhánh hiện tại; nhiều chi nhánh | Một chi nhánh, công theo chi nhánh của lệnh | Nhiều chi nhánh: hồ sơ nhân sự có danh sách chi nhánh, ảnh hưởng 2.6b |
| P2-F | Khách | Khách mới và khách quay lại tính theo hồ sơ tạo mới hay theo lệnh đầu tiên; tỷ lệ tính theo lượt hay theo số khách khác nhau | Hồ sơ hay lệnh đầu; lượt hay người | Hồ sơ cộng loại trừ nhập Excel, theo lượt (tạm) | Lệnh đầu hoặc theo người: thêm trường `firstOrderAt`, rollup lưu tập khách |
| P2-G | Chủ dự án, Khách | Giờ làm việc mặc định của từng chi nhánh (ngày làm trong tuần, khung giờ) để tính "ngày làm việc" cho nhắc và chuyển cấp | Bảng giờ | Thứ Hai đến Thứ Bảy, giờ hành chính, chỉnh theo chi nhánh | Chỉ đổi cấu hình `work-hours` |

Câu hỏi đã có từ trước và vẫn mở, không lặp lại: Q67 (hạn mức), Q68 (ủy quyền, T1, T2), Q73, Q74 (công và hoa hồng), Q84, Q85, Q87 (luật sư, lưu nhân sự), Q63 (đo tải staging), Q66 (giá vốn).
