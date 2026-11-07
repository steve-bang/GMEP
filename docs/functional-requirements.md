# Garage ERP – Functional Requirements (FRD)

Oct 30, 2026 · @Sang PHAM

## 1. Giới thiệu, phạm vi và quy ước

Tài liệu này đặc tả 261 yêu cầu chức năng (FR) cho 11 phân hệ của Garage ERP (10 phân hệ nghiệp vụ và phân hệ nền tảng TEN), trong đó 135 mức Must, 114 mức Should và 12 mức Could (đã gồm 4 FR-REC Should, 044 đến 047, thêm ngày 07/11/2026); gồm 113 yêu cầu ban đầu, 53 yêu cầu bổ sung ở bản 0.2, 16 yêu cầu ở bản 0.3 từ câu trả lời Discovery của khách, 20 yêu cầu giai đoạn 2 ở bản 0.5 (INV, PUR, HRM, ACC, SYS; 9 Must, 11 Should; **đề xuất BA 06/11/2026 theo ủy quyền, chờ khách xác nhận**; kế hoạch ở `docs/dev/phase-2-plan.md`) (206 FR cho 10 phân hệ nghiệp vụ: 105 Must, 93 Should, 8 Could) và 55 yêu cầu multi-tenant ở bản 0.4 (FR-TEN-001 đến 055: 30 Must, 21 Should, 4 Could; cập nhật 06/11/2026 khi FR-TEN-017 nâng lên Must). Bản 0.4 cụ thể hóa quyết định của khách ngày 05/11/2026 (thiết kế multi-tenant từ đầu, tự đăng ký và tự triển khai, gói dịch vụ thu tiền làm sau); các FR-TEN là **đề xuất BA, chờ khách xác nhận**. Mỗi FR trỏ về một yêu cầu nghiệp vụ (BR) trong tài liệu BRD và có tiêu chí nghiệm thu kiểm tra được; luồng nghiệp vụ và trạng thái nằm trong tài liệu User Journey và Business Workflow.

### Quy ước

| Quy ước | Ý nghĩa |
| --- | --- |
| FR-REC-001 | Mã yêu cầu: FR, mã phân hệ (REC, INS, CRM, INV, PUR, HRM, ACC, EIN, RPT, SYS, và TEN cho nền tảng multi-tenant), số thứ tự |
| Must, Should, Could | Mức ưu tiên MoSCoW; Must là điều kiện để nghiệm thu giai đoạn chứa nó |
| BR | Mã yêu cầu nghiệp vụ trong BRD mà FR thực hiện |
| \[Cần xác nhận\] | Nội dung phụ thuộc quyết định của khách hoặc xác nhận của kế toán, luật sư |
| Tenant | Một khách hàng độc lập của nền tảng; một ranh giới dữ liệu, cấu hình, người dùng. Phân cấp: Nền tảng → Tenant → Company (pháp nhân) → Chi nhánh → Kho. Mọi "toàn chuỗi", "toàn hệ thống" trong tài liệu này hiểu là **trong phạm vi một tenant** |
| Chi nhánh | Một cửa hàng; dữ liệu nghiệp vụ luôn gắn với một chi nhánh (và một tenant) |
| Lệnh sửa chữa | Chứng từ gốc của một lần xe vào xưởng, chứa công, phụ tùng, giờ làm, thanh toán và hóa đơn |
| Giờ chuẩn | Số giờ định mức cho một hạng mục dịch vụ, dùng để tính giá công và công thợ |
| Đơn vị phát hành | Pháp nhân hoặc chi nhánh đứng tên bán trên hóa đơn điện tử |

### Nguyên tắc xuyên suốt

- Mọi dữ liệu nghiệp vụ có người tạo, thời điểm và chi nhánh; mọi thay đổi ghi nhật ký (FR-SYS-003).
- Quy tắc có thể đổi theo luật hoặc chính sách (thuế suất, chu kỳ đăng kiểm, mẫu chứng từ, công thức tính công) là cấu hình có ngày hiệu lực, không viết cứng trong mã.
- Không có xuất kho, thu tiền hay hóa đơn nằm ngoài một chứng từ gốc.

## 2. Vai trò và ma trận phân quyền đa chi nhánh

Quyền được xác định bởi hai thứ cùng lúc: vai trò và phạm vi chi nhánh. Chủ garage thấy toàn chuỗi, quản lý vùng thấy nhóm chi nhánh được giao, các vai trò còn lại chỉ thấy chi nhánh của mình; một người được gán nhiều chi nhánh thì cộng quyền theo từng chi nhánh.

Ký hiệu: **S** tạo và sửa, **X** chỉ xem, **D** duyệt (kèm xem), **Xn** chỉ xem phần của mình, **-** không có quyền. Cột: Chủ garage (CH), Quản lý vùng (QV), Quản lý chi nhánh (QL), Cố vấn dịch vụ (CV), Quản đốc (QĐ), Thợ (TH), Thủ kho (TK), Thu ngân (TN), Kế toán (KT), Quản trị hệ thống (AD).

| Chức năng | CH | QV | QL | CV | QĐ | TH | TK | TN | KT | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hồ sơ khách và xe | X | X | S | S | X | Xn | - | X | X | - |
| Báo giá và lệnh sửa chữa | X | X | D | S | X | Xn | X | X | X | - |
| Phân thợ, kiểm tra chất lượng | X | X | D | X | S | Xn | - | - | - | - |
| Danh mục phụ tùng và bảng giá | D | X | X | X | - | - | S | - | X | - |
| Nhập, xuất, kiểm kê kho | X | X | D | - | - | - | S | - | X | - |
| Chuyển kho liên chi nhánh | D | D | S | - | - | - | S | - | X | - |
| Công thợ và hoa hồng | X | X | D | Xn | X | Xn | - | - | X | - |
| Thu tiền và sổ quỹ | X | X | D | X | - | - | - | S | X | - |
| Công nợ và giá vốn | X | X | X | - | - | - | - | - | S | - |
| Hóa đơn điện tử | X | X | X | - | - | - | - | S | S | - |
| Báo cáo và dashboard | X | X | X | Xn | Xn | Xn | Xn | Xn | X | - |
| Người dùng, phân quyền, cấu hình | D | - | S | - | - | - | - | - | - | S |

Ghi chú:

- Hóa đơn điều chỉnh, thay thế, hủy cần kế toán trưởng duyệt; kế toán trưởng là một cấu hình quyền của vai trò kế toán (xem FR-EIN-007).
- Quản trị hệ thống cấu hình được nhưng không xem được dữ liệu nghiệp vụ nhạy cảm của khách, vì luật bảo vệ dữ liệu cá nhân yêu cầu hạn chế truy cập theo nhu cầu. Từ bản 0.4, AD là **quản trị tenant**: phạm vi là một tenant, không có quyền nền tảng nào (xem ma trận quyền nền tảng bên dưới).
- Quản lý chi nhánh chỉ tạo và sửa người dùng trong chi nhánh của mình; người dùng thuộc vai trò cao hơn do chủ garage hoặc quản trị hệ thống tạo.

### Bổ sung ở bản 0.2

- Một tài khoản có thể gán nhiều vai trò; quyền là phần hợp của các vai trò theo từng chi nhánh (FR-SYS-012). Người kiêm thủ kho và thu ngân có đủ quyền hai vai trò và không hơn.
- Quyền chia theo hành động: xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất dữ liệu, quản lý (FR-SYS-013). Ví dụ thủ kho được tạo phiếu xuất nhưng không tự duyệt phiếu xuất bất thường; không có quyền xuất thì không tải được danh sách khách.
- Hai chức năng mới theo cùng quy ước ký hiệu: kiểm tra xe số do quản đốc và thợ thực hiện (S), quản lý chi nhánh, cố vấn, chủ garage và quản lý vùng xem (X); mua hàng do nhân viên mua hàng và thủ kho tạo (S), quản lý chi nhánh duyệt (D), kế toán xem (X).
- Nhân viên mua hàng, nhân sự và nhân viên kiểm tra chất lượng là vai trò bổ sung của bản 0.2, cấu hình như các vai trò khác.

### Vai trò bổ sung MH, NS (làm rõ ở bản 0.4)

Bản 0.2 bổ sung bốn vai trò (quản trị trụ sở, nhân viên kiểm tra chất lượng, nhân viên mua hàng, nhân sự). Hai trong số đó đã được dùng với mã trong thiết kế và tài liệu UI: **MH** (nhân viên mua hàng) và **NS** (nhân sự). Chúng là vai trò riêng, **không gộp** vào TK hay QL (BA đã trả lời ở `docs/ui-ux/ba-answers-04.md` §5, chờ khách xác nhận), nhưng chưa có cột trong ma trận 10 vai trò ở trên (đây là khoảng trống L-13 nay đã ghi). Quyền mặc định đã nêu trong tài liệu: MH tạo yêu cầu mua, đơn mua và nhận hàng cùng thủ kho (S), xem tồn và danh mục (X); NS tạo và sửa hồ sơ nhân sự, ca và giờ công (S), xem công thợ và hoa hồng (X); mọi chức năng khác mặc định **không có quyền** (default-deny, kể cả xuất dữ liệu). Bảng quyền đầy đủ nằm ở Phụ lục C của `ba-answers-04.md` và cấu hình được theo FR-SYS-013; một người kiêm nhiều vai trò được cộng quyền (FR-SYS-012). Hai vai trò còn lại (quản trị trụ sở, kiểm tra chất lượng) **chưa có mã vai trò trong tài liệu nào**; BA không tự đặt mã, chờ chủ dự án. Mở rộng ma trận chính thức khi khách xác nhận.

### Ma trận quyền nền tảng (bản 0.4, FR-TEN-011, đề xuất, `[Cần xác nhận: Chủ dự án, Q24, C-16]`)

Nhân sự nền tảng **không thuộc tenant nào**, tách hẳn khỏi 10 vai trò trên; không tài khoản nào vừa là nhân sự nền tảng vừa là người dùng tenant. Mặc định **không vai trò nền tảng nào xem được dữ liệu nghiệp vụ của tenant** (khách, xe, lệnh, kho, tiền, hóa đơn); ngoại lệ duy nhất là phiên hỗ trợ có kiểm soát (FR-TEN-012, RULE-022). Cột: Chủ nền tảng (CNT), Quản trị nền tảng (QTN), Hỗ trợ nền tảng (HTN), Vận hành billing (VHB). Ký hiệu như bảng trên; **P** chỉ trong phiên hỗ trợ được cấp.

| Chức năng nền tảng | CNT | QTN | HTN | VHB |
| --- | --- | --- | --- | --- |
| Hồ sơ tenant (tên, MST, trạng thái, gói; không có dữ liệu nghiệp vụ) | X | S | X | X |
| Cấp phát tenant thủ công, xử lý lỗi cấp phát (cấp phát tự động không cần người, FR-TEN-042) | D | S | - | - |
| Duyệt, từ chối ca đăng ký bị cờ; yêu cầu bổ sung | D | S (chỉ yêu cầu bổ sung) | X | - |
| Đổi trạng thái tenant: ngưng, chấm dứt, xóa/ẩn danh (hai người, RULE-027) | D | S (đề xuất) | - | - |
| Xuất gói dữ liệu, ghi nhận tenant đã nhận | D | S | - | - |
| Cấu hình nền tảng: mặc định, danh mục pháp lý, cấu hình đăng ký, `support.*`, `brand.name` | D | S | - | - |
| Đổi gói, thuê bao, tính năng bật/tắt (MT-2) | D | S | X | X |
| Mức dùng, kỳ thanh toán, công nợ phí (MT-2, MT-3) | X | X | - | S |
| Dữ liệu nghiệp vụ của tenant | - | - | P | - |
| Phiên hỗ trợ: mở (cần tenant cho phép) | D (khẩn cấp, người duyệt thứ hai) | - | S | - |
| Nhật ký nền tảng | X | X | Xn | - |
| Báo cáo nền tảng (tổng hợp, không đào sâu bản ghi) | X | X | X (sức khỏe) | X (thương mại) |

Ghi chú: (1) duyệt hoặc từ chối đăng ký là thao tác một người, nằm ngoài danh sách hai người của RULE-027 (đề xuất BA, QĐT-38); (2) MFA nằm ngoài phạm vi theo quyết định owner và **bỏ cả cho vai trò nền tảng** (quyết định 06/11/2026, Q36): đây là rủi ro chấp nhận có thời hạn xem lại (R-TEN-13), bù bằng hai người duyệt (RULE-027), nhật ký nền tảng bất biến (FR-TEN-013), phiên hỗ trợ có đồng ý (RULE-022); (3) việc chủ garage của tenant mời quản trị tenant, đồng ý cho hỗ trợ truy cập, yêu cầu chấm dứt là quyền của CH trong tenant (FR-TEN-012), không phải quyền nền tảng.

## 3. FR: Tiếp nhận và lệnh sửa chữa (REC)

40 yêu cầu: 19 Must, 20 Should, 1 Could, gồm 22 yêu cầu ban đầu, 8 yêu cầu ở bản 0.2 (FR-REC-023 đến 030), 6 yêu cầu ở bản 0.3 (FR-REC-031 đến 036) và 4 yêu cầu cải tiến lịch hẹn ngày 07/11/2026 (FR-REC-044 đến 047; 037 đến 043 giữ chỗ); phân hệ kiểm tra xe số INS nằm ở cuối mục này.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-REC-001 | Tạo hồ sơ tiếp nhận từ biển số; nếu xe đã có thì tự điền xe và chủ xe | Must | Nhập biển số đã có, thông tin xe và khách hiện ngay; biển số mới mở form tạo xe | BR-REC-01 |
| FR-REC-002 | Bắt buộc ghi số km và yêu cầu của khách theo lời khách; cho ghi hiện trạng và đính kèm ảnh | Must | Không lưu được khi thiếu số km hoặc yêu cầu; ảnh xem được trong lệnh | BR-REC-01 |
| FR-REC-003 | Cảnh báo khi số km thấp hơn số km lần sửa trước | Should | Hiện cảnh báo; cho tiếp tục khi nhập lý do | BR-REC-01 |
| FR-REC-004 | Lập báo giá gồm dòng công và dòng phụ tùng: loại, số lượng, đơn giá, thuế, thành tiền | Must | Tổng tiền và thuế khớp công thức cấu hình; sửa dòng thì tính lại | BR-REC-02 |
| FR-REC-005 | Tự điền giờ chuẩn và đơn giá giờ công theo hạng mục và chi nhánh | Must | Chọn hạng mục thì giờ chuẩn và giá công hiện đúng bảng của chi nhánh | BR-REC-02 |
| FR-REC-006 | Khi chọn phụ tùng hiện tồn tại chi nhánh và các chi nhánh khác | Should | Hiện số tồn; phụ tùng hết hàng có biểu tượng cảnh báo | BR-REC-02 |
| FR-REC-007 | Đánh dấu mỗi dòng là bắt buộc hoặc tùy chọn; khách chọn được từng dòng | Must | Báo giá chia hai nhóm; tổng cập nhật theo dòng khách chọn | BR-REC-02 |
| FR-REC-008 | Gửi báo giá cho khách qua liên kết (SMS, Zalo, email) và in được | Must | Khách mở liên kết xem được báo giá không cần tài khoản; có bản in | BR-REC-02 |
| FR-REC-009 | Ghi nhận khách duyệt qua liên kết, mã OTP hoặc chữ ký tại quầy, lưu thời điểm và người duyệt | Must | Báo giá đã duyệt hiện bằng chứng duyệt, không sửa được nội dung đã duyệt | BR-REC-03 |
| FR-REC-010 | Mở lệnh sửa chữa từ báo giá đã duyệt, chỉ gồm dòng được duyệt | Must | Lệnh chỉ chứa dòng được duyệt; báo giá chưa duyệt không mở được lệnh | BR-REC-03, BR-REC-05 |
| FR-REC-011 | Báo giá hết hạn sau số ngày cấu hình | Could | Báo giá quá hạn chuyển trạng thái hết hạn và nhắc cố vấn | BR-REC-02 |
| FR-REC-012 | Phân thợ cho từng hạng mục; mỗi hạng mục một thợ chịu trách nhiệm; đổi thợ ghi vết | Must | Hạng mục có đúng một thợ chính; lịch sử đổi thợ xem được | BR-REC-06 |
| FR-REC-013 | Thợ xem việc của mình trên tablet, bấm bắt đầu, tạm dừng, kết thúc từng hạng mục | Must | Thợ chỉ thấy việc được giao; mỗi lần bấm ghi thời điểm; giờ thực tính từ các mốc | BR-REC-06, BR-HRM-03 |
| FR-REC-014 | Hạng mục phát sinh: thợ tạo đề xuất kèm ảnh, cố vấn lập báo giá bổ sung, hạng mục chờ khách duyệt | Must | Hạng mục phát sinh không bắt đầu được khi chưa có duyệt; có bằng chứng duyệt | BR-REC-04 |
| FR-REC-015 | Trạng thái lệnh: đã duyệt, đang sửa, tạm dừng, chờ kiểm tra, sẵn sàng giao, hoàn tất, đã hủy; chỉ chuyển khi đủ điều kiện (bộ trạng thái riêng của hạng mục, thanh toán, hóa đơn xem FR-REC-028) | Must | Chuyển trạng thái trái quy tắc bị chặn kèm lý do; mỗi lần chuyển ghi người và thời điểm | BR-REC-05 |
| FR-REC-016 | Checklist kiểm tra chất lượng cấu hình theo loại dịch vụ; không đạt thì trả thợ và ghi lỗi | Should | Lệnh chưa đạt kiểm tra không sang được bước thu tiền; lỗi gắn với thợ | BR-REC-07 |
| FR-REC-017 | Biên bản giao xe có xác nhận của khách | Should | In và lưu biên bản; có xác nhận của khách trên màn hình hoặc bản ký | BR-REC-07 |
| FR-REC-018 | Bảo hành: tạo lệnh bảo hành gắn với lệnh gốc; hiện thời hạn bảo hành từng hạng mục | Should | Lệnh bảo hành liên kết lệnh gốc và thợ gốc; chi phí ghi vào loại bảo hành | BR-REC-08 |
| FR-REC-019 | Lịch hẹn theo ngày giờ, hiện công suất xưởng theo số xe mỗi ngày | Should | Đặt hẹn vượt công suất cấu hình thì cảnh báo; dời lịch sang ngày khác cũng kiểm công suất ngày mới như đặt mới (cảnh báo, xác nhận mới dời được) và trả chỗ ngày cũ (FR-REC-046); ngày trong cảnh báo hiển thị dd/MM/yyyy (FR-REC-047) | BR-REC-09 |
| FR-REC-020 | Gói dịch vụ bảo dưỡng định kỳ gồm hạng mục và giá cố định, áp dụng vào báo giá | Should | Chọn gói thì tự thêm đủ dòng và giá của gói | BR-REC-10 |
| FR-REC-021 | Hủy báo giá hoặc lệnh có lý do; lệnh đã xuất phụ tùng chỉ hủy khi có phiếu hoàn kho và quản lý duyệt | Must | Lệnh đã xuất kho không hủy được khi thiếu phiếu hoàn kho hoặc duyệt | BR-REC-05 |
| FR-REC-022 | Bảng điều phối chi nhánh: xe theo trạng thái, xe trễ hẹn, xe chờ phụ tùng | Must | Bảng cập nhật khi trạng thái đổi; lọc theo thợ, trạng thái, ngày | BR-REC-06 |

### FR-REC bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-REC-023 | Phiên bản báo giá: sửa sau khi đã gửi thì tạo phiên bản mới; xem lại mọi phiên bản | Must | Phiên bản cũ không sửa được; khách luôn duyệt một phiên bản cụ thể | BR-REC-12 |
| FR-REC-024 | Lưu hạng mục khách từ chối hoặc chưa làm; nhắc cố vấn ở lần sau | Should | Khi xe vào lại, cố vấn thấy danh sách hạng mục từng bị từ chối | BR-REC-11 |
| FR-REC-025 | Ghi nhận đồ đạc và tài sản trong xe lúc tiếp nhận | Should | Phiếu tiếp nhận có mục tài sản, in được | BR-REC-01 |
| FR-REC-026 | Duyệt báo giá bằng liên kết, chữ ký tại quầy hoặc xác nhận bằng lời do nhân viên ghi nhận | Should | Mỗi cách duyệt lưu người ghi, thời điểm, cách duyệt; duyệt bằng lời bắt buộc ghi chú | BR-REC-03 |
| FR-REC-027 | Lịch hẹn: xem theo ngày hoặc tuần, trạng thái lịch (chờ, đã đến, hủy, vắng), phân cố vấn tiếp nhận; tiếp nhận xe không hẹn trước | Should | Lịch hẹn đã đến chuyển thành hồ sơ tiếp nhận; xe vãng lai tạo hồ sơ không cần lịch; danh sách tách tab Sắp tới, Trễ hẹn, Đã đến, Đã hủy, Vắng có bộ đếm (FR-REC-044); "Trễ hẹn" là nhãn tính khi đọc, không phải trạng thái lưu, trạng thái lưu vẫn là chờ, đã đến, hủy, vắng; hủy chọn lý do từ danh mục (FR-REC-045); dời lịch có lý do, giữ mã lịch (FR-REC-046) | BR-REC-09 |
| FR-REC-028 | Trạng thái riêng cho báo giá, lệnh, hạng mục, thanh toán, hóa đơn; đổi trạng thái hạng mục không làm lệnh chuyển trái quy tắc | Must | Có lệnh đang sửa với một hạng mục hoàn thành, một hạng mục chưa làm và thanh toán chưa thu | BR-REC-05 |
| FR-REC-029 | Hạng mục có độ ưu tiên, checklist con, bình luận nội bộ, chuyển người phụ trách | Should | Thợ và quản đốc trao đổi trong hạng mục; chuyển người được ghi nhận | BR-REC-06 |
| FR-REC-030 | Sinh mã lệnh duy nhất theo chi nhánh và thời gian | Must | Không có hai lệnh trùng mã **trong cùng một tenant**; hai tenant được phép trùng mã (RULE-018, FR-TEN-020) | BR-REC-05 |

### FR-REC bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-REC-031 | Báo giá lưu phiên bản giá tại thời điểm gửi; đổi bảng giá không làm đổi báo giá đã gửi | Must | Cập nhật bảng giá sau khi gửi thì báo giá cũ giữ giá cũ, báo giá mới dùng giá mới | BR-REC-12 |
| FR-REC-032 | Quy trình theo loại dịch vụ cấu hình được: bộ bước, trạng thái hạng mục, người phụ trách | Must | Hai loại dịch vụ có hai bộ bước khác nhau trên cùng một lệnh | BR-REC-13 |
| FR-REC-033 | Luồng đồng sơn theo công đoạn: xem xe ở công đoạn nào, người phụ trách, ngày dự kiến hoàn thành \[Cần khảo sát xưởng\] | Should | Bảng đồng sơn hiện công đoạn, người phụ trách và ngày dự kiến của từng xe | BR-REC-14 |
| FR-REC-034 | Gửi liên kết duyệt báo giá qua Zalo hoặc SMS; hiển thị hạng mục, phụ tùng, công, thuế, tổng tiền, ảnh và video \[Cần chọn nhà cung cấp\] | Should | Khách mở liên kết trên điện thoại và duyệt từng hạng mục; kênh duyệt được lưu | BR-REC-03 |
| FR-REC-035 | Đặt lịch trực tuyến: khách chọn chi nhánh, dịch vụ, khung giờ; nhân viên xác nhận | Should | Lịch chờ xác nhận hiện ở lịch chi nhánh; xác nhận gửi thông báo cho khách | BR-REC-09 |
| FR-REC-036 | Bảo hành chéo chi nhánh: chi nhánh tiếp nhận tra lịch sử sửa chữa và điều kiện bảo hành của chi nhánh gốc | Should | Mở được lệnh bảo hành gắn với lệnh gốc ở chi nhánh khác | BR-REC-08 |

### FR-REC bổ sung ngày 07/11/2026 (cải tiến màn Lịch hẹn, đề xuất BA theo yêu cầu chủ dự án, chờ khách xác nhận)

Mã FR-REC-037 đến 043 giữ chỗ cho các đề xuất cũ chưa áp dụng (`docs/ui-ux/proposed-doc-changes.md`), nên các FR dưới đây bắt đầu từ 044. Đặc tả đầy đủ, quyết định và tiêu chí kiểm thử: `docs/ui-ux/appointments-improvements-ba.md`.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-REC-044 | Danh sách lịch hẹn tách tab Sắp tới, Trễ hẹn, Đã đến, Đã hủy, Vắng, mỗi tab có bộ đếm. "Trễ hẹn" = lịch chờ mà khách không đến đúng giờ hẹn (hẹn 08:00, từ 08:01 chưa Đã đến), thời gian châm chước là cấu hình theo chi nhánh, mặc định 0 phút (chủ dự án chốt 07/11/2026), giờ Việt Nam, tính khi đọc, không lưu thêm trạng thái. Tab Trễ hẹn không phụ thuộc ngày đang xem; có hành động nhanh gọi khách, dời lịch, đánh dấu vắng. Tên nhãn `[Cần xác nhận]` | Should | Lịch chờ qua phút hẹn nằm ở Trễ hẹn và rời tab khi Đã đến, Vắng, Hủy hoặc Dời sang tương lai; bộ đếm bằng số dòng; đổi châm chước có hiệu lực ngay; vai trò chỉ xem không có nút thao tác; không lộ lịch của chi nhánh hoặc tenant khác | BR-REC-09 |
| FR-REC-045 | Hủy lịch chọn lý do từ danh mục cấu hình theo tenant (mã ổn định, có hiệu lực theo ngày, có mặc định mẫu); lý do "Khác" bắt buộc ghi chú tối thiểu 3 ký tự; lưu mã, tên lý do tại lúc hủy, người, thời điểm; dữ liệu đủ để thống kê lý do hủy | Should | Hủy không chọn lý do bị chặn; "Khác" thiếu ghi chú bị chặn; đổi tên hoặc ngừng dùng lý do không đổi lịch đã hủy; nhật ký ghi người và lý do; tenant khác không thấy danh mục | BR-REC-09 |
| FR-REC-046 | Dời lịch: đổi ngày hoặc giờ của chính lịch chờ (kể cả trễ hẹn), giữ mã lịch, không thêm trạng thái; bắt buộc lý do từ danh mục lý do dời cấu hình và bên đề nghị (khách hoặc xưởng); lưu lịch sử dời (cũ, mới, lý do, bên đề nghị, người, thời điểm); kiểm công suất ngày mới; giới hạn số lần dời và cảnh báo dời sát giờ là cấu hình `[Cần xác nhận]`; kiểm phiên bản, `Idempotency-Key`; báo khách chỉ qua cổng thông báo (nhà cung cấp giả) khi khách đồng ý | Should | Dời giữ nguyên mã và trạng thái, có dòng lịch sử và nhật ký; dời thiếu lý do hoặc bên đề nghị bị chặn; ngày mới đủ công suất thì cảnh báo, xác nhận mới dời; bấm đôi chỉ một lần dời; hai người dời cùng lúc thì người sau nhận xung đột phiên bản; lịch đã đến, hủy, vắng không dời được | BR-REC-09 |
| FR-REC-047 | Phần chọn ngày màn Lịch hẹn: nút Trước, Hôm nay, Sau; tiêu đề "Thứ Sáu, 30/10/2026" kèm nhãn Hôm nay hoặc Ngày mai; tuần "Tuần 45 (02/11 – 08/11/2026)" (tuần từ Thứ Hai, ISO 8601 `[Cần xác nhận]`); múi giờ `Asia/Ho_Chi_Minh` tính ở máy chủ; ngày ở mọi thông báo, cảnh báo, toast hiển thị `dd/MM/yyyy`, không hiện dạng ISO | Should | Tiêu đề đúng thứ, ngày, nhãn; máy khách sai giờ vẫn ra đúng "hôm nay"; không có thông điệp hướng người dùng chứa yyyy-MM-dd; nhập ngày không có thật bị báo lỗi | BR-REC-09 |

### FR-INS: Kiểm tra xe số

9 yêu cầu: 8 Should, 1 Could. Phân hệ này theo mô hình kiểm tra xe số có ảnh, video và mức xanh, vàng, đỏ của các sản phẩm benchmark ([Tekmetric](https://tours.tekmetric.com/answers/digital-vehicle-inspection-software-7-features-to-look-for)); mức Should vì khách chưa xác nhận cần kiểm tra xe số \[Cần xác nhận\].

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-INS-001 | Mẫu kiểm tra theo loại dịch vụ, tạo và phát hành từ trụ sở cho chi nhánh | Should | Chi nhánh dùng mẫu được phát hành; sửa mẫu có phiên bản | BR-INS-01 |
| FR-INS-002 | Thực hiện kiểm tra trên tablet: từng hạng mục, kết quả, ghi chú | Should | Lưu ngay khi chọn từng hạng mục; không mất dữ liệu khi chuyển màn hình | BR-INS-01 |
| FR-INS-003 | Ba mức xanh, vàng, đỏ cho từng hạng mục | Should | Mỗi hạng mục có đúng một mức | BR-INS-01 |
| FR-INS-004 | Đính kèm ảnh và video vào từng hạng mục | Should | Ảnh, video lưu trên hệ thống, xem lại từ hồ sơ xe | BR-INS-01 |
| FR-INS-005 | Hạng mục vàng và đỏ tự vào danh sách lỗi; chuyển thành dòng báo giá bằng một thao tác | Should | Dòng báo giá sinh ra có công và phụ tùng gợi ý từ dịch vụ mẫu; hạng mục xanh không sinh dòng | BR-INS-01 |
| FR-INS-006 | Gửi kết quả kiểm tra cho khách qua liên kết kèm báo giá | Should | Khách xem ảnh, mức và đề xuất không cần tài khoản | BR-INS-01 |
| FR-INS-007 | Ghi chú chẩn đoán và dịch vụ đề xuất | Should | Ghi chú gắn với hạng mục và người ghi | BR-INS-01 |
| FR-INS-008 | Lịch sử kiểm tra tra cứu theo xe | Should | Mở lại kết quả các lần kiểm tra trước của xe | BR-INS-01 |
| FR-INS-009 | Đính kèm dữ liệu quét lỗi hoặc chẩn đoán từ thiết bị | Could | Tệp đính kèm lưu vào kết quả kiểm tra | BR-INS-01 |

## 4. FR: Khách hàng và xe (CRM)

18 yêu cầu: 8 Must, 9 Should, 1 Could, gồm 13 yêu cầu ban đầu, 4 yêu cầu ở bản 0.2 (FR-CRM-014 đến 017) và 1 yêu cầu ở bản 0.3 (FR-CRM-018). Các FR về đồng ý và quyền của chủ dữ liệu bắt nguồn từ Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-CRM-001 | Hồ sơ khách cá nhân hoặc doanh nghiệp: tên, điện thoại, email, địa chỉ, mã số thuế nếu có; một khách nhiều xe | Must | Tạo khách có nhiều xe; khách doanh nghiệp bắt buộc tên pháp nhân khi cần xuất hóa đơn | BR-CRM-01 |
| FR-CRM-002 | Hồ sơ xe: biển số, số khung, số máy, hãng, dòng, năm sản xuất, xe có kinh doanh vận tải hay không, số km gần nhất | Must | Biển số duy nhất trong hệ thống; năm sản xuất và loại hình dùng được cho nhắc đăng kiểm | BR-CRM-01 |
| FR-CRM-003 | Phát hiện trùng khách theo điện thoại hoặc biển số và gợi ý hợp nhất | Should | Hợp nhất giữ toàn bộ lịch sử của hai hồ sơ và ghi nhật ký | BR-CRM-01 |
| FR-CRM-004 | Lịch sử sửa chữa của xe xem được ở mọi chi nhánh: ngày, chi nhánh, hạng mục, phụ tùng, số km, giá | Must | Xe sửa ở chi nhánh A hiện lịch sử khi tiếp nhận ở chi nhánh B, trong phạm vi quyền | BR-CRM-02 |
| FR-CRM-005 | Chuyển chủ xe, đổi biển số có lưu lịch sử | Should | Lịch sử cũ vẫn gắn với xe; chủ cũ không còn thấy dữ liệu của chủ mới | BR-CRM-01 |
| FR-CRM-006 | Nhắc bảo dưỡng theo số km hoặc thời gian của từng loại dịch vụ | Should | Đến hạn thì tạo nhắc trong danh sách và gửi theo kênh khách đồng ý | BR-CRM-03 |
| FR-CRM-007 | Nhắc đăng kiểm tính từ bảng chu kỳ cấu hình theo loại xe và năm sản xuất | Should | Bảng chu kỳ sửa được có ngày hiệu lực; hạn tính đúng theo bảng chu kỳ trong BRD | BR-CRM-03 |
| FR-CRM-008 | Nhắc hạn bảo hiểm khi có ngày hết hạn | Should | Nhập ngày hết hạn thì có nhắc trước số ngày cấu hình | BR-CRM-03 |
| FR-CRM-009 | Gửi thông báo qua SMS hoặc Zalo theo mẫu, ghi kết quả gửi | Should | Mỗi tin có trạng thái đã gửi, lỗi; lỗi được thử lại theo cấu hình | BR-CRM-04 |
| FR-CRM-010 | Quản lý căn cứ xử lý dữ liệu cá nhân: mục đích, thời điểm, kênh, đồng ý hoặc căn cứ pháp lý khác; khách rút lại đồng ý được | Must | Rút đồng ý thì dừng các hoạt động cần đồng ý; lịch sử đồng ý xem được | BR-CRM-05 |
| FR-CRM-011 | Xử lý yêu cầu của chủ dữ liệu: xem, chỉnh sửa, xóa | Must | Mỗi yêu cầu có người xử lý, thời hạn, kết quả; xóa giữ lại dữ liệu bắt buộc theo luật \[Cần xác nhận\] | BR-CRM-05 |
| FR-CRM-012 | Khách doanh nghiệp theo hợp đồng: bảng giá riêng, chiết khấu, công nợ theo kỳ | Could | Báo giá cho khách hợp đồng tự áp bảng giá riêng | BR-CRM-06 |
| FR-CRM-013 | Không gửi tin quảng cáo cho khách chưa đồng ý | Must | Chiến dịch tự loại khách chưa có đồng ý quảng cáo, báo số khách bị loại | BR-CRM-05 |

### FR-CRM bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-CRM-014 | Quan hệ sở hữu xe có hiệu lực từ ngày đến ngày: một xe có nhiều chủ theo thời gian, một khách có nhiều xe | Must | Xe đổi chủ giữ nguyên lịch sử sửa chữa; chủ hiện tại là bản ghi sở hữu còn hiệu lực | BR-CRM-07 |
| FR-CRM-015 | Ghi chú và nhãn phân loại khách | Should | Lọc được khách theo nhãn; ghi chú có người ghi | BR-CRM-01 |
| FR-CRM-016 | Thông tin bảo hành xe và ảnh xe trong hồ sơ | Should | Hồ sơ xe hiện bảo hành còn hạn và xem được ảnh | BR-CRM-01 |
| FR-CRM-017 | Xuất danh sách khách cần quyền xuất dữ liệu riêng; mỗi lần xuất ghi nhật ký | Must | Nhân viên không có quyền xuất không tải được danh sách khách | BR-SYS-06 |

### FR-CRM bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-CRM-018 | Khách doanh nghiệp: hạn mức công nợ, kỳ thanh toán, người liên hệ, nhiều xe thuộc một doanh nghiệp | Should | Hồ sơ doanh nghiệp liệt kê xe và người liên hệ; hạn mức và kỳ cấu hình được | BR-ACC-13 |

## 5. FR: Kho và phụ tùng (INV)

33 yêu cầu: 19 Must, 13 Should, 1 Could, gồm 19 yêu cầu ban đầu, 5 yêu cầu ở bản 0.2 (FR-INV-020 đến 024), 4 yêu cầu ở bản 0.3 (FR-INV-025 đến 028) và 5 yêu cầu giai đoạn 2 ở bản 0.5 (FR-INV-030 đến 034; mã 029 đang được giữ chỗ cho "trạng thái yêu cầu phụ tùng của thợ" ở `docs/ui-ux/proposed-doc-changes.md`, chưa áp dụng nên bỏ trống); phân hệ mua hàng PUR nằm ở cuối mục này.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-INV-001 | Danh mục phụ tùng: mã, tên, hãng, đơn vị, mã vạch, nhóm, dòng xe tương thích | Must | Tìm theo mã, tên, mã vạch hoặc dòng xe ra đúng phụ tùng | BR-INV-01 |
| FR-INV-002 | Mã phụ tùng duy nhất toàn chuỗi; kiểm tra trùng khi tạo | Must | Tạo mã trùng bị chặn và gợi ý mã đã có | BR-INV-01 |
| FR-INV-003 | Tồn kho theo chi nhánh và theo lô kèm giá nhập | Must | Tổng tồn của phụ tùng bằng tổng các lô; mỗi chi nhánh một kho riêng | BR-INV-02 |
| FR-INV-004 | Đơn mua với nhà cung cấp, trạng thái: nháp, đã gửi, nhận một phần, nhận đủ | Should | Phiếu nhập từ đơn mua tự cập nhật trạng thái đơn | BR-INV-03 |
| FR-INV-005 | Phiếu nhập kho đối chiếu đơn mua; cảnh báo khi lệch số lượng hoặc giá | Must | Lệch vượt ngưỡng cấu hình phải được quản lý duyệt mới ghi nhập | BR-INV-03 |
| FR-INV-006 | Phiếu xuất kho chỉ tạo từ lệnh sửa chữa, phiếu bán lẻ hoặc phiếu điều chuyển | Must | Không có chức năng xuất kho thủ công không chứng từ gốc | BR-INV-04 |
| FR-INV-007 | Thợ yêu cầu phụ tùng trong lệnh; thủ kho xác nhận xuất và ghi người nhận | Must | Thợ chỉ yêu cầu được phụ tùng có trong lệnh; phiếu ghi thợ nhận | BR-INV-04 |
| FR-INV-008 | Phiếu hoàn kho gắn với lệnh | Must | Hoàn kho làm tăng tồn và giảm giá vốn của lệnh tương ứng | BR-INV-04 |
| FR-INV-009 | Giá vốn xuất kho theo phương pháp cấu hình: bình quân gia quyền hoặc nhập trước xuất trước \[Cần xác nhận\] | Must | Chọn phương pháp một lần cho mỗi kỳ; số liệu kiểm tra được bằng ví dụ do kế toán cung cấp | BR-ACC-03 |
| FR-INV-010 | Chuyển kho liên chi nhánh: phiếu hai bước gửi và nhận, trạng thái đang đi đường, biên bản chênh lệch | Must | Hàng đang đi đường không tính vào tồn bán được của cả hai chi nhánh; đóng phiếu khi bên nhận xác nhận | BR-INV-05 |
| FR-INV-011 | Đợt kiểm kê theo nhóm hàng hoặc toàn kho; chụp tồn lúc bắt đầu; nhập số đếm; quét mã vạch bằng camera điện thoại | Must | Hệ thống tính chênh lệch từng mã; quét mã vạch điền đúng dòng | BR-INV-06 |
| FR-INV-012 | Điều chỉnh chênh lệch kiểm kê cần duyệt và lý do | Must | Tồn chỉ đổi sau khi phiếu điều chỉnh được duyệt; có nhật ký | BR-INV-06 |
| FR-INV-013 | Định mức tồn tối thiểu và tối đa theo chi nhánh; cảnh báo theo tồn khả dụng | Should | Hàng dưới định mức hiện trong danh sách cảnh báo của chi nhánh | BR-INV-07 |
| FR-INV-014 | Gợi ý đặt hàng và gợi ý lấy từ chi nhánh đang dư | Should | Gợi ý nêu chi nhánh dư, số lượng và nhà cung cấp thay thế | BR-INV-07 |
| FR-INV-015 | Nhà cung cấp: thông tin, bảng giá, điều khoản thanh toán | Should | Giá trên đơn mua lấy từ bảng giá, sửa được kèm lý do | BR-INV-08 |
| FR-INV-016 | Phụ tùng khách mang đến ghi trong lệnh, không vào tồn kho | Should | Dòng đánh dấu của khách chỉ tính công, không tạo phiếu xuất | BR-INV-09 |
| FR-INV-017 | Vật tư tiêu hao của xưởng theo dõi riêng, phân bổ theo lệnh hoặc chi nhánh \[Cần xác nhận\] | Should | Báo cáo chi phí vật tư tiêu hao theo tháng và chi nhánh | BR-INV-09 |
| FR-INV-018 | Bán lẻ phụ tùng tại quầy bằng phiếu bán lẻ \[Cần xác nhận có bán lẻ\] | Should | Phiếu bán lẻ trừ kho và liên thông thu tiền, hóa đơn | BR-INV-04 |
| FR-INV-019 | Không cho tồn âm; ngoại lệ phải cấu hình và có duyệt | Must | Xuất vượt tồn bị chặn khi chưa có duyệt | BR-INV-02 |

### FR-INV bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-INV-020 | Phân biệt tồn thực tế, tồn giữ chỗ, tồn khả dụng; giữ chỗ khi khách duyệt báo giá hoặc mở lệnh; nhả giữ chỗ khi hủy, từ chối hoặc xuất | Must | Tồn thực tế 20, giữ chỗ 5 thì khả dụng 15 và lệnh khác chỉ thấy 15; xuất vượt khả dụng bị chặn | BR-INV-10 |
| FR-INV-021 | Chứng từ kho theo loại có số riêng: nhập (GRN), xuất (GIN), chuyển (STO), điều chỉnh (ADJ), trả (RTN); không sửa trực tiếp số lượng trên danh mục | Must | Mọi thay đổi tồn đều truy được về một chứng từ | BR-INV-04 |
| FR-INV-022 | Khách trả lại phụ tùng chưa lắp: phiếu nhập trả, hoàn kho, điều chỉnh hóa đơn nếu đã xuất | Should | Tồn tăng đúng; hóa đơn liên quan có điều chỉnh | BR-INV-12 |
| FR-INV-023 | Xuất dùng nội bộ có lý do, người duyệt và chứng từ riêng | Should | Phiếu xuất nội bộ vượt hạn mức cần duyệt; có báo cáo riêng | BR-INV-12 |
| FR-INV-024 | Theo dõi số lô hoặc serial cho mặt hàng được đánh dấu bắt buộc | Could | Xuất mặt hàng này bắt buộc chọn lô hoặc serial | BR-INV-11 |

### FR-INV bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-INV-025 | Bảng giá chuẩn toàn hệ thống; hạn mức giảm theo chi nhánh và theo chương trình có thời hạn; vượt hạn mức cần duyệt | Must | Giảm quá hạn mức bị chặn đến khi quản lý khu vực hoặc chủ duyệt | BR-INV-13 |
| FR-INV-026 | Kho tổng cấp hàng cho kho chi nhánh; theo dõi hàng đang vận chuyển | Should | Cấp hàng từ kho tổng tạo chứng từ chuyển; tồn kho nhận chỉ tăng sau khi xác nhận | BR-INV-14 |
| FR-INV-027 | Giá vốn bình quân gia quyền cấu hình được; xử lý riêng xuất, trả, điều chỉnh, chuyển kho, hàng lỗi, kiểm kê \[Kế toán xác nhận\] | Must | Nhập 10 cái giá 100.000 và 20 cái giá 120.000 cho giá vốn khoảng 113.333 đồng | BR-INV-16 |
| FR-INV-028 | Phiếu bán phụ tùng lẻ tại quầy, trừ kho và ghi nhận thanh toán, không cần lệnh sửa chữa | Should | Phiếu bán lẻ trừ kho đúng chi nhánh và vào báo cáo doanh thu | BR-INV-15 |

Ghi chú bản 0.5: FR-INV-018 và FR-INV-028 cùng nói về bán lẻ tại quầy; Discovery của khách đã xác nhận có bán phụ tùng lẻ (BRD §10, "Mở rộng"), nên `[Cần xác nhận có bán lẻ]` của FR-INV-018 coi như đã trả lời; hai FR được xây một lần dưới FR-INV-028 (FR-INV-018 là bản gốc, không đổi mã).

### FR-INV bổ sung ở bản 0.5 (giai đoạn 2, đề xuất BA theo ủy quyền 06/11/2026, chờ khách xác nhận)

Mọi quy tắc dưới đây hiểu **trong phạm vi một tenant** (RULE-016, 017): chuyển kho, khả dụng liên chi nhánh và gợi ý lấy hàng không bao giờ vượt ranh giới tenant. Các con số là tham số cấu hình có ngày hiệu lực, không viết cứng (NFR-MNT-01).

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-INV-030 | Xử lý chênh lệch chuyển kho: bên nhận ghi biên bản nhận thiếu hoặc hỏng kèm ảnh; phần lệch treo trên hàng đang vận chuyển; kết quả xử lý chọn trong danh mục cấu hình (chờ hàng bù trong N ngày, ghi mất trong vận chuyển, hàng hỏng nhập kho lỗi hoặc chờ xử lý, điều chỉnh với bên gửi) kèm trường "bên chịu giá trị"; quản lý bên nhận đề xuất, quản lý bên gửi đồng thuận, khác vùng hoặc vượt ngưỡng cấu hình thì quản lý vùng hoặc chủ garage duyệt \[Cần xác nhận: bên chịu mặc định, Kế toán khách\] | Must (nâng từ Should ở đề xuất cũ vì FR-INV-010 và UAT-04 đã đòi biên bản và duyệt xử lý) | Phiếu chỉ đóng khi mọi chênh lệch có kết quả xử lý được duyệt; tồn thực tế kho nhận chỉ tăng đúng số xác nhận nhận; tổng (tồn thực tế + đang vận chuyển) của toàn tenant không đổi khi chuyển kho, trừ phần "ghi mất" hoặc "điều chỉnh" đã duyệt | BR-INV-05 |
| FR-INV-031 | Hiển thị khả dụng liên chi nhánh: chỉ số "có thể cho" của chi nhánh khác trong nhóm được phép (cờ `xem_khả_dụng_liên_chi_nhánh`, mặc định bật trong cùng nhóm); không lộ tồn thực tế, giữ chỗ, đang vận chuyển, giá vốn của chi nhánh khác (phép chiếu P5, `ba-answers-for-dev.md` §10.2) | Should | Người dùng chỉ thấy chi nhánh trong nhóm được phép; danh sách trường của phép chiếu là danh sách trắng có test; tenant khác không bao giờ xuất hiện | BR-INV-05, BR-INV-14 |
| FR-INV-032 | Quy tắc phiếu chuyển kho (CK, loại STO) và yêu cầu chuyển (YK): CK có trạng thái nháp, chờ duyệt (giá trị lớn), chờ gửi, đang vận chuyển, có chênh lệch, đã nhận, đã đóng, từ chối, hủy (chỉ trước khi gửi); chi nhánh nhận lập YK, chi nhánh gửi xác nhận mới sinh CK; khi gửi: tồn thực tế kho gửi giảm, "đang vận chuyển" gắn kho nhận tăng, không bên nào tăng khả dụng; khi nhận: tồn thực tế kho nhận tăng theo số xác nhận, "đang vận chuyển" giảm theo số đã gửi; CK đánh số theo chi nhánh gửi; giá vốn mang theo của bên gửi, không hiện cho bên nhận \[Cần xác nhận: Kế toán khách\]; chuyển giữa hai pháp nhân chưa có quy tắc chứng từ \[Cần xác nhận: Kế toán khách\] | Must | Gửi hai lần cùng `Idempotency-Key` chỉ trừ kho một lần; xác nhận nhận hai lần chỉ ghi một lần; hủy sau khi gửi bị chặn; kho nhận không tồn tại hoặc không cùng tenant bị từ chối; CK vượt ngưỡng giá trị lớn không gửi được khi chưa có duyệt; không ngừng dùng kho hoặc khóa chi nhánh khi còn CK chưa đóng | BR-INV-05, BR-INV-14 |
| FR-INV-033 | Quy tắc kiểm kê: đếm mù là mặc định (cấu hình theo đợt); không đóng băng kho, mỗi dòng đếm ghi thời điểm đếm và chênh lệch tính trên tồn sổ sách tại thời điểm đếm (tồn lúc bắt đầu cộng trừ chứng từ đã ghi sổ trong khoảng); không chốt khi còn dòng chưa đếm (nhập 0 có chủ đích hoặc quản lý loại dòng kèm lý do); dòng lệch vượt ngưỡng phải đếm lại một lần; người duyệt khác người đếm (quản lý vừa đếm vừa duyệt thì chuyển cấp trên); mã lệch lặp lại trong cửa sổ cấu hình gắn cờ; ngưỡng giá trị và phần trăm là cấu hình \[Cần xác nhận: ngưỡng, Chủ dự án, Kế toán khách\] | Must | Tồn lúc bắt đầu 10, sau đó xuất 2 ghi sổ trước thời điểm đếm, đếm được 8 thì chênh lệch bằng 0; không nộp được đợt còn dòng chưa đếm; người đếm không tự duyệt được đợt của mình; mã lệch lần thứ hai trong cửa sổ cấu hình hiện cờ "lệch lặp lại" | BR-INV-06 |
| FR-INV-034 | Gợi ý đặt hàng: công thức cấu hình có hiệu lực, mặc định đề xuất cần đặt = tối đa trừ (khả dụng + đã đặt chờ giao + đang vận chuyển đến), tối thiểu bằng 0; thứ tự nguồn gợi ý kho tổng, chi nhánh dư cùng nhóm, nhà cung cấp; có ngưỡng giá trị tối thiểu để chuyển kho đáng làm \[Cần xác nhận chính sách ưu tiên, Journey §4\] | Should | Tối thiểu 5, tối đa 20, khả dụng 3, đã đặt chờ giao 4, đang đến 0 thì gợi ý 13; dưới ngưỡng giá trị thì ưu tiên nhà cung cấp; "đã đặt chờ giao" không cộng vào bốn con số tồn | BR-INV-07 |

### FR-PUR: Mua hàng

12 yêu cầu: 11 Should, 1 Could (8 yêu cầu ban đầu và 4 yêu cầu giai đoạn 2 ở bản 0.5: FR-PUR-009 đến 012). Mức Should vì quy trình mua hàng của khách chưa được xác nhận \[Cần xác nhận\]; FR-INV-004 và FR-INV-015 vẫn là phần đơn mua và nhà cung cấp ở mức cơ bản.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-PUR-001 | Yêu cầu mua hàng tạo từ chi nhánh hoặc từ danh sách hàng dưới định mức | Should | Yêu cầu có người đề xuất, mặt hàng, số lượng, lý do | BR-PUR-01 |
| FR-PUR-002 | Phê duyệt yêu cầu mua theo hạn mức | Should | Yêu cầu vượt hạn mức chờ đúng người duyệt | BR-PUR-01 |
| FR-PUR-003 | Lập đơn mua từ yêu cầu đã duyệt, gửi nhà cung cấp, ghi nhận nhà cung cấp xác nhận | Should | Đơn mua liên kết yêu cầu gốc; trạng thái xác nhận được lưu | BR-PUR-01 |
| FR-PUR-004 | Điều chỉnh đơn mua có phiên bản | Should | Mọi phiên bản đơn mua xem được; phiên bản đã gửi không bị ghi đè | BR-PUR-01 |
| FR-PUR-005 | Nhận hàng nhiều lần cho một đơn mua | Should | Đơn mua còn mở đến khi nhận đủ; mỗi lần nhận một phiếu nhập | BR-PUR-01 |
| FR-PUR-006 | Hóa đơn nhà cung cấp, đối chiếu ba bên giữa đơn mua, phiếu nhập và hóa đơn | Should | Chênh lệch hiện danh sách cần xử lý trước khi ghi công nợ | BR-PUR-01 |
| FR-PUR-007 | Trả hàng cho nhà cung cấp | Should | Phiếu trả trừ tồn và giảm công nợ phải trả | BR-PUR-01 |
| FR-PUR-008 | Đánh giá nhà cung cấp: giao đúng hạn, lệch số lượng, chất lượng | Could | Báo cáo theo nhà cung cấp và kỳ | BR-PUR-01 |

### FR-PUR bổ sung ở bản 0.5 (giai đoạn 2, đề xuất BA theo ủy quyền 06/11/2026, chờ khách xác nhận)

Quy trình mua hàng của khách vẫn chưa được xác nhận (BRD §10 câu 8, Journey §4); các FR dưới đây làm cho quy trình **cấu hình được** thay vì chốt một cách làm. Nhà cung cấp, bảng giá, đơn mua là dữ liệu của tenant, không dùng chung (RULE-016).

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-PUR-009 | Mua gấp: yêu cầu mua đánh dấu "mua gấp" cho phép mua trước và hậu duyệt trong N giờ làm việc (mẫu 24, cấu hình), tự quyết đến một giá trị cấu hình; ảnh hóa đơn bắt buộc; người đề xuất không tự duyệt; không được chấp nhận thì gắn cờ cho Kế toán \[Cần xác nhận: giá trị tự quyết và thời hạn, Chủ dự án\] | Should | Trạng thái "chờ hậu duyệt" lọc và đếm được; quá hạn thì nhắc và chuyển cấp (FR-SYS-015, FR-SYS-034); mua gấp vượt giá trị tự quyết bị chặn | BR-PUR-01 |
| FR-PUR-010 | Trạng thái và quy tắc: yêu cầu mua (nháp, chờ duyệt, đã duyệt, từ chối, đã lập đơn, hủy); đơn mua (nháp, đã gửi, nhà cung cấp xác nhận, nhận một phần, nhận đủ, đã đóng, hủy chỉ khi còn nháp) với phiên bản và hậu tố `-vN`; đóng đơn khi chưa nhận đủ cần duyệt theo giá trị phần còn lại; "đã đặt chờ giao" là chỉ số riêng, không thuộc bốn số tồn kho | Should | Chuyển trạng thái trái bảng bị chặn; phiên bản đã gửi không bị ghi đè; đơn đóng khi chưa nhận đủ không còn nhận được hàng; số "đã đặt chờ giao" không đổi tồn khả dụng | BR-PUR-01 |
| FR-PUR-011 | Dung sai nhận hàng và đối chiếu ba bên: đối chiếu theo "hóa đơn nhà cung cấp với tập các phiếu nhập của một đơn mua", không 1:1; dung sai lệch giá và số lượng cấu hình (mẫu: lệch giá nhận kho trên 5% cần duyệt hai chiều, dung sai ba bên 1.000 đồng mỗi đơn vị và 0 số lượng); nhận vượt đơn cần duyệt, nhận thiếu giữ đơn mở; chênh lệch chưa xử lý chặn ghi công nợ phải trả \[Cần xác nhận: các ngưỡng, Kế toán khách\] | Should | Hai phiếu nhập cho một hóa đơn khớp theo tổng; lệch trong dung sai coi là khớp; lệch ngoài dung sai vào danh sách xử lý và chưa tạo công nợ; nhận thiếu không cần duyệt và đơn còn mở | BR-PUR-01 |
| FR-PUR-012 | Quy trình mua cấu hình theo chi nhánh trong quyền được cấp: bật hoặc tắt bước yêu cầu mua, bước duyệt, mua gấp, nhập không có đơn mua (luôn là phiếu bất thường cần duyệt), nguồn mua (kho tổng, nhà cung cấp, chi nhánh khác); mặc định mọi bước bật; dữ liệu ghi rõ bước nào bị bỏ qua \[Cần xác nhận: Khách, Q64\] | Should | Chi nhánh tắt bước yêu cầu vẫn lập được đơn mua trực tiếp; bước bị tắt hiện trong nhật ký; đổi cấu hình có ngày hiệu lực không đổi đơn đã lập | BR-PUR-01 |

## 6. FR: Nhân sự và nhân công (HRM)

21 yêu cầu: 10 Must, 10 Should, 1 Could, gồm 12 yêu cầu ban đầu, 2 yêu cầu ở bản 0.2 (FR-HRM-013, 014), 2 yêu cầu ở bản 0.3 (FR-HRM-015, 016) và 5 yêu cầu giai đoạn 2 ở bản 0.5 (FR-HRM-017 đến 021). Hệ thống cung cấp dữ liệu công và hoa hồng, không thay phần mềm tính lương và bảo hiểm.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-HRM-001 | Hồ sơ nhân sự: họ tên, chức danh, chi nhánh, ngày vào làm, ngày nghỉ, chứng chỉ nghề | Must | Mỗi nhân sự thuộc ít nhất một chi nhánh và một chức danh | BR-HRM-01 |
| FR-HRM-002 | Điều chuyển nhân sự giữa chi nhánh, giữ lịch sử | Should | Công đã ghi vẫn thuộc chi nhánh lúc phát sinh | BR-HRM-01 |
| FR-HRM-003 | Chấm công theo ca, tách khỏi đồng hồ công việc | Should | Ghi giờ vào, giờ ra; quản lý sửa kèm lý do | BR-HRM-02 |
| FR-HRM-004 | Danh mục hạng mục dịch vụ có giờ chuẩn; thay đổi giờ chuẩn có lịch sử và ngày hiệu lực | Must | Đổi giờ chuẩn không làm đổi các lệnh cũ | BR-HRM-03 |
| FR-HRM-005 | Ghi giờ thực tế từng hạng mục từ thao tác bắt đầu và kết thúc | Must | Giờ thực bằng tổng các khoảng làm việc, trừ các khoảng tạm dừng | BR-HRM-03 |
| FR-HRM-006 | Quy tắc tính công cấu hình theo chi nhánh và chức danh: giờ chuẩn, khoán, phần trăm, cố định cộng thưởng | Must | Cùng một lệnh cho kết quả công khác nhau khi đổi quy tắc, đúng với ví dụ do khách cung cấp | BR-HRM-03 |
| FR-HRM-007 | Ghi nhận công khi hạng mục qua kiểm tra chất lượng | Must | Hạng mục chưa đạt kiểm tra không phát sinh công | BR-HRM-03 |
| FR-HRM-008 | Xử lý công khi đổi thợ, làm lại hoặc hủy hạng mục | Must | Đổi thợ chia công theo giờ thực; làm lại theo quy tắc cấu hình; hủy đảo công | BR-HRM-03 |
| FR-HRM-009 | Hoa hồng cho cố vấn và thợ theo doanh thu đã thu | Should | Hoa hồng chỉ ghi nhận sau khi lệnh được thu đủ | BR-HRM-04 |
| FR-HRM-010 | Bảng công theo kỳ: quản lý duyệt, khóa kỳ, xuất cho kế toán | Must | Kỳ đã khóa không sửa trực tiếp; xuất được tệp bảng công | BR-HRM-04 |
| FR-HRM-011 | Báo cáo năng suất: hiệu suất làm việc, mức sử dụng, năng suất tổng | Should | Ba chỉ số tính từ giờ chuẩn, giờ thực và giờ có mặt, theo thợ và chi nhánh | BR-HRM-05 |
| FR-HRM-012 | Ẩn danh hoặc xóa dữ liệu cá nhân của nhân viên đã nghỉ theo chính sách, giữ phần bắt buộc theo luật \[Cần xác nhận\] | Should | Quản trị chạy được chính sách theo thời hạn; nhật ký ghi phạm vi đã xóa | BR-HRM-01 |

### FR-HRM bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-HRM-013 | Hồ sơ kỹ năng và chứng chỉ của thợ; gợi ý khi phân việc | Could | Màn hình phân việc hiện kỹ năng phù hợp | BR-HRM-01 |
| FR-HRM-014 | Lịch làm việc và tải việc của thợ; cảnh báo thợ quá tải | Should | Xem được số giờ chuẩn đã giao so với giờ khả dụng từng ngày | BR-HRM-05 |

### FR-HRM bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-HRM-015 | Phương pháp tính công cấu hình được theo loại việc (giờ chuẩn, khoán, giờ thực được duyệt, tỷ lệ); bảng định mức có hiệu lực áp dụng và lịch sử thay đổi; chi nhánh điều chỉnh trong quyền được cấp | Must | Thay dầu định mức 0,3 giờ chuẩn; đổi định mức có ngày hiệu lực và không làm đổi công đã tính | BR-HRM-06 |
| FR-HRM-016 | Ghi nhận việc làm lại, gắn với thợ và hạng mục gốc | Should | Báo cáo hiện số việc làm lại theo thợ | BR-HRM-05 |

### FR-HRM bổ sung ở bản 0.5 (giai đoạn 2, đề xuất BA theo ủy quyền 06/11/2026, chờ khách xác nhận)

Công thức công và hoa hồng của khách **chưa chốt** (BRD §10, bảng TBD "Công thợ và hoa hồng"; rủi ro BRD §8). Các FR dưới đây quy định cơ chế, dữ liệu và ví dụ nghiệm thu; con số, hệ số, tỷ lệ do khách ký ở bảng ví dụ (UAT-11), không viết cứng. Hồ sơ nhân viên, mã nhân viên, kỳ công, quy tắc công là dữ liệu của tenant. Hệ thống chỉ cung cấp dữ liệu công và hoa hồng, không tính lương, bảo hiểm, thuế thu nhập (BRD §4).

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-HRM-017 | Chu kỳ kỳ công mặc định tháng dương lịch, cấu hình theo chi nhánh (tháng, nửa tháng, tuần, ngày chốt tùy chỉnh) có ngày hiệu lực; quản lý chi nhánh duyệt rồi khóa, chỉ từ ngày kết thúc kỳ; điều kiện khóa: không còn điều chỉnh công chờ duyệt và không còn ca thiếu giờ ra chưa xử lý; hạng mục chờ kiểm tra chất lượng không chặn khóa (công ghi vào kỳ nơi kiểm tra đạt); mở lại cần chủ garage duyệt kèm lý do, kỳ chưa khóa gắn nhãn "số tạm"; sau khi khóa chỉ điều chỉnh bằng dòng điều chỉnh \[Cần xác nhận: chu kỳ, Khách\] | Should | Kỳ đã khóa không sửa trực tiếp; khóa trước ngày kết thúc bị chặn; mở lại không có duyệt của chủ bị chặn; tệp xuất trước khóa có nhãn "số tạm", sau khóa là bản chính thức | BR-HRM-04 |
| FR-HRM-018 | Ba chỉ số năng suất, mỗi chỉ số hiện công thức và đi sâu được: hiệu suất làm việc = giờ chuẩn bán ra chia giờ thực làm; mức sử dụng = giờ thực làm chia giờ có mặt; năng suất tổng = giờ chuẩn bán ra chia giờ có mặt; giờ có mặt lấy từ chấm công theo ca (FR-HRM-003); giờ chuẩn bán ra chỉ tính hạng mục đã qua kiểm tra chất lượng trong kỳ, làm lại không cộng hai lần; mẫu số bằng 0 hiện "–" | Should | Giờ có mặt nhân mức sử dụng nhân hiệu suất bằng giờ chuẩn bán ra (kiểm thử bằng tính chất); hiệu suất trên 100% hợp lệ; ví dụ số do khách ký (NFR-MNT-01) | BR-HRM-05 |
| FR-HRM-019 | Nhập bù giờ công khi thợ mất mạng không ghi được mốc giờ: thợ khai giờ thực; quản đốc xác nhận (không quá ngưỡng cấu hình, mẫu 15 phút) hoặc quản lý duyệt (quá ngưỡng); thợ xác nhận lại; nhãn "nhập bù", lý do bắt buộc, nhật ký trước và sau; báo cáo số lần nhập bù theo thợ (NFR-OFF-01) | Must | Không mốc giờ nào ghi theo giờ thiết bị; mốc nhập bù không xóa được; quá ngưỡng thì cần cấp trên duyệt; ngưỡng là tham số | BR-HRM-03 |
| FR-HRM-020 | Dòng công thợ: lưu hai đại lượng, giờ công quy đổi (khi phương pháp theo giờ) và tiền công (VND nguyên); đại lượng cộng dồn và xuất cho kế toán là tiền công, không gộp hoa hồng; phương pháp áp theo thứ tự chi nhánh với loại việc và chức danh, chi nhánh với loại việc, công ty với loại việc và chức danh, công ty với loại việc; hệ số chức danh là bảng có hiệu lực riêng; mỗi dòng giữ phiên bản quy tắc và định mức đã áp, quy tắc làm tròn cố định; trạng thái dòng: chờ kiểm tra chất lượng, đã ghi, kiểm tra trả lại, đã đảo; riêng phương pháp tỷ lệ phần trăm: dòng được tạo khi qua kiểm tra chất lượng với giá trị đã tính nhưng ở trạng thái "chờ thu đủ", chưa vào đại lượng cộng dồn và tệp xuất cho kế toán cho đến khi lệnh thu đủ (FR-HRM-021; bản 0.6); khi nhiều thợ cùng một hạng mục thì phương pháp chọn theo chức danh của thợ làm nhiều giờ thực nhất (hòa thì thợ được phân công trước), khoán và cố định chia theo giờ thực, hệ số chức danh chỉ áp cho phương pháp theo giờ; làm lại do khách yêu cầu thêm việc là hạng mục mới, không phải làm lại; điều chỉnh thủ công vượt ngưỡng cấu hình cần chủ garage duyệt \[Cần xác nhận: công thức, hệ số, ngưỡng điều chỉnh, Khách\] | Must | Tối thiểu 6 ví dụ do kế toán khách ký (thay dầu 0,3 giờ chuẩn; một hạng mục khoán; một hạng mục theo phần trăm; đổi thợ giữa chừng chia theo giờ thực; làm lại sau kiểm tra; hủy lệnh sau khi đã ghi công) thành 6 ca kiểm thử tự động; đổi quy tắc có hiệu lực từ ngày D không đổi dòng công trước D; có ghi đè của chi nhánh thì chọn đúng phương pháp theo thứ tự ưu tiên | BR-HRM-03, BR-HRM-06 |
| FR-HRM-021 | Hoa hồng cố vấn, và hoa hồng thợ khi phương pháp là tỷ lệ phần trăm: cơ sở mặc định là tiền công dịch vụ đã thu chưa VAT (tùy chọn cấu hình: gồm phụ tùng, hoặc lợi nhuận gộp); ghi nhận khi lệnh thu đủ, thu một phần thì "chưa ghi nhận"; hoàn tiền hoặc hủy sau khi đã ghi tạo dòng đảo; thợ theo khoán hoặc giờ chuẩn không chờ thu tiền; trạng thái: chưa ghi nhận, chờ duyệt, đã duyệt, đã đảo \[Cần xác nhận: cơ sở và xử lý thu một phần, Khách\] | Should | Lệnh thu một phần chưa sinh hoa hồng; thu đủ thì sinh đúng một dòng dù bấm hai lần; hoàn tiền sau khi ghi sinh dòng đảo và tổng về đúng; thợ khoán vẫn nhận công khi chưa thu | BR-HRM-04 |

## 7. FR: Doanh thu, kế toán và công nợ (ACC)

24 yêu cầu: 16 Must, 7 Should, 1 Could, gồm 14 yêu cầu ban đầu, 5 yêu cầu ở bản 0.2 (FR-ACC-015 đến 019), 1 yêu cầu ở bản 0.3 (FR-ACC-020) và 4 yêu cầu giai đoạn 2 ở bản 0.5 (FR-ACC-022, 026, 027, 028; mã 021, 023, 024, 025 đang được giữ chỗ ở `docs/ui-ux/proposed-doc-changes.md` cho đảo bút toán, điều kiện khóa ngày, tiền thối, mở ca, chưa áp dụng vào bản này nên bỏ trống). Hệ thống làm kế toán vận hành và hạch toán tự động; báo cáo tài chính và khai thuế do kế toán thực hiện trên phần mềm kế toán của khách \[Cần xác nhận\].

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-ACC-001 | Phiếu thu nhiều hình thức: tiền mặt, chuyển khoản, thẻ, ví; nhiều lần thanh toán cho một lệnh | Must | Tổng các lần thu và số còn nợ của lệnh luôn khớp | BR-ACC-01 |
| FR-ACC-002 | Tiền đặt cọc: ghi nhận và trừ vào thanh toán cuối | Must | Lệnh hiện số cọc đã thu; cọc hoàn lại có phiếu chi | BR-ACC-01 |
| FR-ACC-003 | Sổ quỹ tiền mặt theo chi nhánh; phiếu chi có loại chi phí | Must | Số dư quỹ bằng tổng thu trừ tổng chi theo ngày | BR-ACC-04 |
| FR-ACC-004 | Chốt ca và chốt ngày: liệt kê lệnh mở, lệnh chưa thu tiền, chênh lệch quỹ rồi khóa | Must | Không chốt được khi còn chênh lệch chưa giải trình; ngày đã khóa chặn sửa trực tiếp | BR-ACC-05 |
| FR-ACC-005 | Khóa kỳ kế toán; mở lại cần chủ garage duyệt kèm lý do | Must | Chứng từ trong kỳ khóa không sửa; mở lại có nhật ký | BR-ACC-05 |
| FR-ACC-006 | Công nợ phải thu theo khách và theo lệnh; tuổi nợ; nhắc theo hạn | Must | Số dư công nợ của khách bằng tổng nợ các lệnh; báo cáo tuổi nợ đúng nhóm | BR-ACC-02 |
| FR-ACC-007 | Công nợ phải trả theo nhà cung cấp; lịch thanh toán đối chiếu phiếu nhập | Must | Mỗi lần chi gắn với phiếu nhập; số dư khớp báo cáo nhà cung cấp | BR-ACC-02 |
| FR-ACC-008 | Giá vốn dịch vụ: giá vốn phụ tùng cộng nhân công và chi phí chung phân bổ \[Cần xác nhận cách phân bổ\] | Must | Báo cáo lãi gộp từng lệnh tính đủ ba thành phần theo quy tắc đã chốt | BR-ACC-03 |
| FR-ACC-009 | Thuế suất theo ngày hiệu lực và nhóm hàng, dịch vụ; mặc định theo chính sách hiện hành | Must | Đổi thuế suất có ngày hiệu lực; lệnh lập sau ngày đó áp mức mới mà không sửa mã nguồn | BR-ACC-08 |
| FR-ACC-010 | Định khoản tự động theo sự kiện nghiệp vụ với sơ đồ tài khoản cấu hình | Should | Kế toán sửa được sơ đồ; mỗi sự kiện sinh bút toán cân đối nợ và có | BR-ACC-07 |
| FR-ACC-011 | Lãi lỗ theo chi nhánh và theo nguồn doanh thu (công, phụ tùng) | Must | Tổng lãi lỗ các chi nhánh bằng lãi lỗ toàn chuỗi | BR-ACC-06 |
| FR-ACC-012 | Kết xuất dữ liệu sang phần mềm kế toán đang dùng \[Cần xác nhận định dạng\] | Should | Tệp kết xuất nhập được vào phần mềm đích với số liệu khớp mẫu thử | BR-ACC-07 |
| FR-ACC-013 | Phân bổ chi phí chung toàn chuỗi cho chi nhánh \[Cần xác nhận\] | Could | Phân bổ theo tiêu chí cấu hình, có thể chạy lại cho kỳ chưa khóa | BR-ACC-06 |
| FR-ACC-014 | Chứng từ kế toán dùng mẫu tham khảo theo Thông tư 99/2025 (hoặc Thông tư 152/2025 cho hộ kinh doanh) | Should | Phiếu thu, chi, nhập, xuất kho in đúng thông tin bắt buộc theo mẫu kế toán xác nhận | BR-ACC-04 |

### FR-ACC bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-ACC-015 | Phân bổ thanh toán nhiều-nhiều giữa thanh toán và hóa đơn; phần dư thành khoản nhận trước | Must | Một khoản trả cho ba hóa đơn phân bổ đúng; một hóa đơn nhận hai khoản; tổng khớp | BR-ACC-09 |
| FR-ACC-016 | Hoàn tiền cho khách có phê duyệt, phiếu chi hoàn, liên kết hóa đơn điều chỉnh nếu cần | Should | Hoàn vượt hạn mức cần duyệt; số dư công nợ đúng sau hoàn | BR-ACC-11 |
| FR-ACC-017 | Giao dịch ngân hàng: nhập hoặc nhập từ sao kê, đối soát với phiếu thu và phiếu chi \[Cần xác nhận định dạng\] | Should | Giao dịch chưa khớp hiện trong danh sách cần xử lý | BR-ACC-12 |
| FR-ACC-018 | Quy trình chi: đề xuất chi, duyệt theo hạn mức, chi tiền, ghi nhận chi phí, đối soát | Must | Khoản chi vượt hạn mức không chi được khi chưa duyệt; mỗi bước có người và thời điểm | BR-ACC-10 |
| FR-ACC-019 | Báo giá, lệnh, hóa đơn, thanh toán, phiếu thu là năm đối tượng riêng, liên kết với nhau | Must | Từ một lệnh xem được mọi báo giá, hóa đơn, thanh toán, phiếu thu liên quan | BR-ACC-09 |

### FR-ACC bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-ACC-020 | Hạn mức công nợ và kỳ thanh toán của khách doanh nghiệp; cảnh báo khi vượt | Should | Lập lệnh vượt hạn mức hiện cảnh báo theo chính sách | BR-ACC-13 |

### FR-ACC bổ sung ở bản 0.5 (giai đoạn 2, đề xuất BA theo ủy quyền 06/11/2026, chờ khách xác nhận)

Phạm vi giai đoạn 2 của ACC theo ủy quyền: FR-ACC-006, 007, 015, 016, 018, 019 và bốn FR dưới đây. FR-ACC-016 (hoàn tiền) đã được dựng sớm ở giai đoạn 1 (phiếu chi hoàn có duyệt); phần còn lại của giai đoạn 2 là liên kết hóa đơn điều chỉnh, nằm ở FR-EIN-007 (giai đoạn 3). Kỳ kế toán, hạn mức chi, phê duyệt, công nợ theo tenant và Company; công nợ không cộng gộp giữa tenant.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-ACC-022 | Khoản nhận trước của khách (thu vượt thật): bù vào lệnh sau của cùng khách hoặc hoàn lại có duyệt (FR-ACC-016); không chuyển giữa khách | Should | Phần dư hiện đúng số trên hồ sơ khách; bù trừ không vượt số dư; không bù sang khách khác | BR-ACC-09 |
| FR-ACC-026 | Tuổi nợ phải thu và nhắc nợ: số dư công nợ của khách bằng tổng nợ các lệnh còn nợ; nhóm tuổi nợ cấu hình có hiệu lực (đề xuất 0 đến 30, 31 đến 60, 61 đến 90, trên 90 ngày) tính từ hạn thanh toán, không có hạn thì từ ngày giao xe; nhắc theo hạn qua cổng thông báo, không gửi cho khách chưa đồng ý nhận tin; hạn mức công nợ doanh nghiệp (FR-ACC-020) chỉ là cờ đúng sai khi tiếp nhận ở chi nhánh khác, không lộ số dư \[Cần xác nhận: nhóm tuổi, hạn mặc định, Kế toán khách, Q70\] | Must | Số dư các nhóm tuổi bằng tổng số dư công nợ; lệnh đã thu đủ không còn trong tuổi nợ; khách có ba lệnh nợ ở ba nhóm tuổi thì mỗi nhóm đúng một lệnh; đổi nhóm tuổi có ngày hiệu lực không đổi số đã chốt | BR-ACC-02 |
| FR-ACC-027 | Công nợ phải trả theo nhà cung cấp: phát sinh từ phiếu nhập đã ghi sổ (và đã qua đối chiếu ba bên khi bật, FR-PUR-011); mỗi lần chi gắn một hoặc nhiều phiếu nhập qua phân bổ; phiếu trả nhà cung cấp (FR-PUR-007) giảm nợ; lịch thanh toán theo điều khoản của nhà cung cấp; chi tiền đi qua FR-ACC-018 và 028; bản ghi đã ghi sổ không xóa, sửa bằng bút toán đảo (RULE-010) | Must | Số dư từng nhà cung cấp bằng tổng phiếu nhập trừ chi trừ trả hàng; một lần chi cho hai phiếu nhập phân bổ đúng; phiếu nhập có chênh lệch ba bên chưa xử lý không tạo nợ | BR-ACC-02 |
| FR-ACC-028 | Kiểm soát hạn mức chi: hạn mức theo loại chi và cấp duyệt (quản lý chi nhánh, quản lý vùng, chủ garage) có ngày hiệu lực; người đề xuất không tự duyệt; các khoản chi cùng loại, cùng nhà cung cấp, cùng chi nhánh trong cửa sổ cấu hình được cộng dồn khi so với hạn mức để chống chia nhỏ; hạn mức chưa chốt thì chuyển lên cấp cao nhất, không cho qua; duyệt hết hạn thì không dùng được và dùng một lần \[Cần xác nhận: hạn mức, cửa sổ cộng dồn, Chủ dự án, Q67\] | Must | Hai khoản chi dưới hạn mức nhưng cộng dồn vượt hạn mức trong cửa sổ thì khoản sau cần duyệt cấp trên; hạn mức chưa cấu hình không cho tự duyệt; người đề xuất duyệt chính mình bị từ chối | BR-ACC-10 |

## 8. FR: Hóa đơn điện tử (EIN)

13 yêu cầu: 11 Must, 2 Should, gồm 12 yêu cầu ban đầu và FR-EIN-013 ở bản 0.3. Khung pháp lý hiện hành là Nghị định 254/2026/NĐ-CP, có hiệu lực từ 1/7/2026 và thay Nghị định 123/2020 cùng Nghị định 70/2025 ([Thuế MAN](https://thue.man.net.vn/nghi-dinh-254-2026/)); các điều kiện cụ thể cần kế toán của khách xác nhận.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-EIN-001 | Xuất hóa đơn từ lệnh sửa chữa, dữ liệu người mua, hàng hóa, thuế tự điền | Must | Xuất không phải nhập lại thông tin đã có trong lệnh | BR-EIN-01 |
| FR-EIN-002 | Hóa đơn cho khách lẻ và khách có mã số thuế | Must | Khách doanh nghiệp thiếu mã số thuế hoặc tên pháp nhân thì chặn xuất | BR-EIN-01 |
| FR-EIN-003 | Cấu hình đơn vị phát hành theo pháp nhân, chi nhánh, ký hiệu và loại hóa đơn (giá trị gia tăng hoặc bán hàng, theo Phụ lục I Thông tư 91/2026) | Must | Hóa đơn của mỗi chi nhánh mang đúng đơn vị phát hành đã cấu hình | BR-EIN-04 |
| FR-EIN-004 | Tích hợp với một nhà cung cấp hóa đơn qua lớp tích hợp có thể thay nhà cung cấp | Must | Môi trường thử và môi trường chạy thật tách biệt; thay nhà cung cấp không đổi nghiệp vụ | BR-EIN-01 |
| FR-EIN-005 | Nhận và cập nhật trạng thái hóa đơn, mã của cơ quan thuế | Must | Trạng thái trên lệnh khớp trạng thái ở nhà cung cấp; hóa đơn lỗi hiện lý do | BR-EIN-03 |
| FR-EIN-006 | Lưu bản XML và PDF; tra cứu theo lệnh, khách, ngày | Must | Mở lại được hóa đơn đã phát hành từ lệnh gốc | BR-EIN-03 |
| FR-EIN-007 | Hóa đơn điều chỉnh, thay thế, hủy; liên kết hóa đơn gốc; kế toán trưởng duyệt; xử lý các trường hợp hóa đơn lập sai theo Thông tư 91/2026 \[Cần kế toán xác nhận từng trường hợp\] | Must | Mọi phiên bản hóa đơn của một lệnh xem được theo thứ tự; thao tác cần duyệt trước khi gửi | BR-EIN-02 |
| FR-EIN-008 | Gửi hóa đơn cho khách qua email, SMS hoặc Zalo | Should | Có trạng thái đã gửi; gửi lại được | BR-EIN-05 |
| FR-EIN-009 | Cảnh báo lệnh hoàn tất chưa có hóa đơn | Must | Danh sách cuối ngày liệt kê đủ các lệnh hoàn tất chưa có hóa đơn hợp lệ | BR-EIN-01 |
| FR-EIN-010 | Xử lý lỗi gửi: hàng chờ thử lại và thông báo kế toán | Must | Lỗi mạng hoặc lỗi nhà cung cấp không làm mất yêu cầu xuất; được thử lại và báo | BR-EIN-03 |
| FR-EIN-011 | Kiểm tra điều kiện trước khi xuất: thuế suất, thông tin người mua, đơn vị phát hành | Must | Thiếu điều kiện thì hiện danh sách lỗi cần sửa, không gửi đi | BR-EIN-01 |
| FR-EIN-012 | Thời điểm lập hóa đơn và xử lý tiền đặt cọc theo cấu hình phù hợp Nghị định 254/2026 \[Cần xác nhận\] | Should | Kế toán chốt quy tắc bằng ví dụ; hệ thống áp đúng ví dụ mẫu | BR-EIN-01 |

### FR-EIN bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-EIN-013 | Chống phát hành trùng: khóa chống trùng cho mỗi yêu cầu phát hành; khi timeout thì truy vấn trạng thái trước khi gửi lại; lớp tích hợp thay được nhà cung cấp | Must | Bấm phát hành hai lần chỉ tạo một hóa đơn; timeout rồi thử lại không sinh hóa đơn thứ hai | BR-EIN-01 |

Nhà cung cấp hóa đơn như MISA meInvoice cho tích hợp qua API hoặc SDK, có môi trường thử và môi trường chính thức tách biệt ([MISA meInvoice](https://doc.meinvoice.vn/about)). Một số nhà cung cấp thu phí tích hợp từ 2 đến 5 triệu đồng theo MISA ([MISA meInvoice](https://www.meinvoice.vn/?p=9621)); chi phí này cần đưa vào phần chi phí triển khai.

## 9. FR: Báo cáo và dashboard (RPT)

16 yêu cầu: 9 Must, 6 Should, 1 Could, gồm 11 yêu cầu ban đầu và 5 yêu cầu bổ sung (FR-RPT-012 đến 016) ở bảng thứ hai. Mọi con số trên báo cáo phải đi sâu xuống được chứng từ gốc.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-RPT-001 | Dashboard chủ garage: doanh thu, lợi nhuận gộp, số xe, xe trong xưởng, giá trị tồn kho, công nợ; lọc theo chi nhánh và thời gian | Must | Tổng các chi nhánh bằng số toàn chuỗi; đổi bộ lọc thì số liệu đổi theo | BR-RPT-01 |
| FR-RPT-002 | So sánh chi nhánh theo chỉ số được chọn (xếp hạng chi nhánh); so sánh theo thời gian trên báo cáo tháng một chi nhánh xem "Làm rõ FR-RPT-002" bên dưới `[Cần xác nhận]` | Must | Bảng xếp hạng đúng thứ tự, tính trên cùng kỳ; tiêu chí so sánh theo thời gian: AC-RPT-002-1 đến 9 | BR-RPT-01 |
| FR-RPT-003 | Báo cáo chi nhánh theo ngày và tháng | Must | Số doanh thu ngày khớp tổng phiếu thu và công nợ phát sinh của ngày | BR-RPT-02 |
| FR-RPT-004 | Báo cáo đối chiếu giữa lệnh sửa chữa, xuất kho, hóa đơn và thu tiền | Must | Liệt kê được lệnh thiếu một trong bốn thành phần | BR-RPT-03 |
| FR-RPT-005 | Báo cáo kho: tồn, hàng chậm luân chuyển, hàng dưới định mức, chênh lệch kiểm kê | Should | Mỗi dòng đi sâu tới phiếu nhập, xuất | BR-RPT-02 |
| FR-RPT-006 | Báo cáo năng suất và công thợ | Should | Khớp với bảng công của kỳ | BR-RPT-02 |
| FR-RPT-007 | Báo cáo tuổi nợ phải thu và phải trả | Must | Số dư các nhóm tuổi bằng tổng số dư công nợ | BR-RPT-02 |
| FR-RPT-008 | Cảnh báo ngoại lệ: xuất kho không chứng từ, lệch quỹ, xe trễ hẹn, lệnh chưa có hóa đơn | Should | Cảnh báo hiện cho chủ và quản lý chi nhánh trong phạm vi quyền | BR-RPT-03 |
| FR-RPT-009 | Xuất báo cáo ra Excel và PDF | Could | Tệp xuất khớp số trên màn hình và tôn trọng phạm vi quyền | BR-RPT-04 |
| FR-RPT-010 | Dữ liệu dashboard: ngày đã chốt là số chính thức, ngày chưa chốt là số tạm có nhãn \[Cần xác nhận\] | Should | Số tạm hiển thị nhãn rõ ràng và đổi thành chính thức sau khi chốt | BR-RPT-01 |
| FR-RPT-011 | Đi sâu từ chỉ số xuống danh sách chứng từ gốc | Must | Từ một con số mở được danh sách lệnh, phiếu cấu thành | BR-RPT-03 |

### FR-RPT bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-RPT-012 | Báo cáo lệnh sửa chữa: xe đang sửa, thời gian hoàn thành trung bình, tỷ lệ đúng hạn | Must | Danh sách xe trễ hẹn khớp bảng điều phối | BR-RPT-02 |
| FR-RPT-013 | Báo cáo lợi nhuận nêu rõ cách tính, ví dụ lợi nhuận gộp quản trị là doanh thu trừ giá vốn phụ tùng và nhân công trực tiếp, không đồng nghĩa lợi nhuận sau thuế | Must | Mỗi báo cáo lợi nhuận hiện công thức và phạm vi | BR-RPT-01 |
| FR-RPT-014 | Bộ lọc dùng chung: thời gian, chi nhánh, loại dịch vụ, nhân viên, trạng thái lệnh, nhóm doanh thu | Must | Mọi báo cáo chính hỗ trợ các bộ lọc này trong phạm vi quyền | BR-RPT-01 |
| FR-RPT-015 | Báo cáo khách hàng: khách mới, khách quay lại, giá trị, công nợ | Should | Tỷ lệ khách quay lại tính được theo kỳ | BR-RPT-02 |
| FR-RPT-016 | Chỉ số bổ sung: giá trị trung bình mỗi lệnh, tỷ lệ báo giá được duyệt, vòng quay tồn kho, độ chính xác tồn, hao hụt | Should | Mỗi chỉ số hiện công thức và đi sâu được | BR-RPT-01 |

### Làm rõ FR-RPT-002

FR-RPT-002 gốc là xếp hạng nhiều chi nhánh (thuộc báo cáo hợp nhất, phụ thuộc có từ hai chi nhánh; không làm ở pilot một chi nhánh, R85). Nửa còn lại là so sánh theo thời gian trên báo cáo tháng của một chi nhánh (BR-RPT-02; liên quan FR-RPT-003, RULE-015; kiểm bằng UAT-01 mở rộng). Các tiêu chí dưới đây bổ sung, không đổi nghĩa tiêu chí gốc. Câu hỏi và quyết định tạm: `docs/dev/open-questions-for-ba.md` R110 đến R115.

| Mã | Tiêu chí nghiệm thu so sánh theo thời gian | Trạng thái |
| --- | --- | --- |
| AC-RPT-002-1 | Mặc định so với tháng liền trước trên cùng khoảng ngày: tháng đang chạy đến ngày N so với ngày 1 đến N của tháng trước; tháng đã kết thúc so cả tháng với cả tháng trước. Nếu tháng trước ít ngày hơn N thì lấy hết tháng trước và có nhãn. Kỳ so sánh là tham số, không hard-code; "cùng kỳ năm trước" là mở rộng sau, không đổi cách tính hiện có | Mặc định `[Cần xác nhận]` (Chủ dự án) |
| AC-RPT-002-2 | Màn hình và tệp xuất ghi rõ hai khoảng ngày cụ thể của kỳ hiện tại và kỳ so sánh | Chốt |
| AC-RPT-002-3 | Kỳ so sánh thiếu bản tổng hợp (rollup) một phần hoặc toàn bộ thì hiện "n/a" kèm lý do ("chưa có dữ liệu so sánh" hoặc "thiếu n ngày"), không coi là 0 và không tính phần trăm trên số liệu thiếu | Hành vi "n/a" theo yêu cầu; câu chữ `[Cần xác nhận]` |
| AC-RPT-002-4 | Kỳ trước bằng 0 (có đủ dữ liệu) thì không chia cho 0 và không hiện +∞%; cách hiển thị (n/a, "—" hay "mới") | `[Cần xác nhận]` |
| AC-RPT-002-5 | Chênh lệch tuyệt đối và phần trăm cùng hiển thị; phần trăm tính từ số nguyên VND/số đếm, làm tròn theo quy ước cố định, có ví dụ tay (tăng, giảm, thiếu ngày, chia cho 0) được kế toán ký (NFR-MNT-01) | Quy ước làm tròn `[Cần xác nhận]` |
| AC-RPT-002-6 | Chỉ số dòng chảy trong kỳ (doanh thu, số lệnh hoàn tất, tiền thu) có so sánh; chỉ số tồn tại một thời điểm (công nợ tồn, lệnh đang mở) có hoặc không có so sánh là quyết định chưa chốt | Dòng chảy: mặc định; chỉ số tồn `[Cần xác nhận]` |
| AC-RPT-002-7 | So sánh tôn trọng bộ lọc loại dịch vụ và phạm vi quyền; tổng theo loại cộng "Không gắn lệnh" vẫn bằng tổng không lọc ở cả hai kỳ | Chốt (R108) |
| AC-RPT-002-8 | So sánh giữa các chi nhánh (xếp hạng) thuộc báo cáo hợp nhất, ngoài phạm vi pilot | Chốt (R85) |
| AC-RPT-002-9 | Chỉ số dẫn xuất "bình quân mỗi lệnh" = doanh thu chưa thuế / số lệnh hoàn tất cùng kỳ, VND nguyên làm tròn nửa lên, tính lại theo bộ lọc (không cộng dồn qua loại). Kỳ nào có 0 lệnh thì giá trị, chênh lệch và phần trăm đều "—" (không phải 0, không "mới"). Tổng giá trị lệnh gồm thuế và giá trị hóa đơn đã xuất không có cột so sánh ở pilot (R114) | `[Cần xác nhận]` (Chủ dự án, Kế toán) |
| AC-RPT-002-10 | Xếp hạng chi nhánh (giai đoạn 2, bản 0.6): xếp hạng thi đấu (1, 1, 3); chỉ số cộng dồn (doanh thu, tiền thu, số lệnh) xếp trên các ngày mà mọi chi nhánh trong so sánh đều có số ("ngày chung"), ngày trước khi mở hoặc sau khi đóng chi nhánh không tính là thiếu; số thực của từng chi nhánh vẫn hiện cùng nhãn "thiếu n ngày"; không có ngày chung thì không xếp hạng; chỉ số tỷ lệ tính lại từ tử và mẫu của chính ngày chung; chi nhánh không có số xếp cuối không hạng; quản lý vùng chỉ được xếp trong các chi nhánh thuộc phân công của mình và có nhãn "trong phạm vi của bạn" (Q84, Q85) | `[Cần xác nhận]` (Chủ dự án) |
| AC-RPT-002-11 | Định nghĩa chỉ số khách và báo giá (giai đoạn 2, bản 0.6): "khách mới" là khách có hồ sơ tạo trong ngày, khách nhập từ Excel luôn tính "quay lại"; đếm theo lượt khách mỗi ngày (một khách đến ba ngày tính ba lượt), nhãn ghi rõ "theo lượt"; tỷ lệ báo giá được duyệt = báo giá duyệt (đủ hoặc một phần) chia (duyệt cộng từ chối cộng hết hạn), tính theo báo giá tạo trong kỳ và theo mã báo giá (không đếm từng phiên bản), báo giá đã gửi chưa quyết hiện riêng ngoài mẫu số | `[Cần xác nhận]` (Chủ dự án, Kế toán) |

## 10. FR: Quản trị hệ thống, đa chi nhánh, nhật ký (SYS)

20 yêu cầu: 13 Must, 7 Should, gồm 10 yêu cầu ban đầu, 7 yêu cầu ở bản 0.2 (FR-SYS-011 đến 017), 1 yêu cầu ở bản 0.3 (FR-SYS-018) và 2 yêu cầu giai đoạn 2 ở bản 0.5 (FR-SYS-033, 034; mã 019 đến 032 đang được giữ chỗ ở `docs/dev/ba-answers-for-dev.md` §14 và `docs/ui-ux/proposed-doc-changes.md`, chưa áp dụng nên bỏ trống).

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-SYS-001 | Đăng nhập bằng tài khoản cá nhân, chính sách mật khẩu, xác thực hai lớp cho vai trò quản lý trở lên | Must | Không dùng chung tài khoản; vai trò quản lý trở lên bắt buộc lớp xác thực thứ hai | BR-SYS-01 |
| FR-SYS-002 | Phân quyền theo vai trò và chi nhánh theo ma trận ở mục 2; dữ liệu ngoài phạm vi không hiện ở danh sách, tìm kiếm và báo cáo | Must | Tài khoản chi nhánh A không thấy, không tìm thấy, không xuất được dữ liệu chi nhánh B | BR-SYS-01 |
| FR-SYS-003 | Nhật ký thao tác: ai, khi nào, làm gì, giá trị trước và sau; không sửa, không xóa được | Must | Mọi thay đổi ở khách, xe, lệnh, kho, tiền, hóa đơn, phân quyền đều có dòng nhật ký | BR-SYS-02 |
| FR-SYS-004 | Phê duyệt theo hạn mức cấu hình cho giảm giá, hủy lệnh, điều chỉnh kho, chênh lệch quỹ, chuyển kho | Should | Vượt hạn mức thì chờ người duyệt đúng vai trò; hết hạn thì nhắc | BR-SYS-03 |
| FR-SYS-005 | Cấu hình chi nhánh: địa chỉ, giờ làm, kho, đơn vị phát hành hóa đơn, bảng giá | Must | Thêm chi nhánh mới không cần sửa mã nguồn | BR-SYS-01 |
| FR-SYS-006 | Danh mục dùng chung: dịch vụ, giờ chuẩn, bảng giá, thuế, chu kỳ đăng kiểm, mẫu chứng từ | Must | Mỗi danh mục có ngày hiệu lực và lịch sử thay đổi | BR-ACC-08 |
| FR-SYS-007 | Nhập dữ liệu từ Excel theo mẫu: kiểm tra, báo lỗi theo dòng, xem trước, hoàn tác theo lô | Must | Tệp lỗi không ghi một phần; hoàn tác một lô thì mất đúng dữ liệu của lô đó | BR-SYS-05 |
| FR-SYS-008 | Thông báo trong hệ thống và qua email hoặc Zalo theo sự kiện | Should | Người dùng chọn được sự kiện muốn nhận; không nhận ngoài phạm vi quyền | BR-SYS-03 |
| FR-SYS-009 | Tiếng Việt, tiền tệ VND, ngày dạng ngày/tháng/năm | Must | Mọi màn hình, phiếu in, báo cáo theo định dạng này | BR-SYS-01 |
| FR-SYS-010 | Sao lưu hằng ngày và khôi phục theo thời điểm; quản trị chạy thử khôi phục | Must | Có bản sao lưu mỗi ngày; thử khôi phục thành công theo lịch quản trị định | BR-SYS-04 |

### FR-SYS bổ sung ở bản 0.2

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-SYS-011 | Cấu trúc tổ chức: trụ sở và chi nhánh trực thuộc; khóa hoặc mở chi nhánh | Must | Chi nhánh bị khóa không tạo được chứng từ mới nhưng tra cứu được lịch sử | BR-SYS-01 |
| FR-SYS-012 | Một tài khoản có nhiều vai trò; quyền cộng gộp theo từng chi nhánh | Must | Người kiêm thủ kho và thu ngân có đủ quyền hai vai trò, không hơn | BR-SYS-06 |
| FR-SYS-013 | Quyền theo hành động: xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất dữ liệu, quản lý; vai trò cấu hình được | Must | Thủ kho tạo phiếu xuất nhưng không tự duyệt phiếu bất thường | BR-SYS-06 |
| FR-SYS-014 | Lịch sử đăng nhập của người dùng | Should | Xem được thời điểm, thiết bị, kết quả mỗi lần đăng nhập. Giai đoạn 2: "kết quả" là trạng thái phiên của lần đăng nhập thành công (đang đăng nhập, đã đăng xuất, hết hạn); lần đăng nhập sai không ghi theo tài khoản vì lộ email có tồn tại và vì email có thể thuộc nhiều tenant (RULE-034); khóa tạm do đăng nhập sai vẫn theo bộ đếm của ba-answers-for-dev §1.4 `[Cần xác nhận: Chủ dự án, luật sư về thời hạn lưu và IP]` | BR-SYS-02 |
| FR-SYS-015 | Chuyển cấp và nhắc việc khi phê duyệt quá hạn | Should | Quá hạn cấu hình thì yêu cầu chuyển cấp trên và người duyệt nhận nhắc | BR-SYS-07 |
| FR-SYS-016 | Danh mục dùng chung tạo ở trụ sở và phát hành cho chi nhánh được chọn: mẫu kiểm tra, dịch vụ mẫu, giảm giá, hình thức thanh toán. Giai đoạn 2 chỉ áp cho danh mục đã là thực thể có dữ liệu: dịch vụ mẫu (bắt buộc ở slice 2.1) và chính sách giảm giá; hình thức thanh toán khi có bảng riêng, mẫu kiểm tra khi có INS; chưa có bản phát hành thì mọi chi nhánh dùng được; rút khỏi chi nhánh không ảnh hưởng chứng từ đang mở | Should | Thay đổi ở trụ sở áp dụng cho chi nhánh được chọn mà không sửa từng nơi; danh sách dịch vụ ở báo giá của chi nhánh không được phát hành thì không hiện dịch vụ đó | BR-SYS-01 |
| FR-SYS-017 | API cho hệ thống bên ngoài, có xác thực và giới hạn theo quyền | Should | Có tài liệu API, khóa riêng cho từng hệ thống, nhật ký gọi | BR-SYS-06 |

### FR-SYS bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-SYS-018 | Cấu trúc Company, Branch, Warehouse; mở rộng sang nhiều pháp nhân, mỗi pháp nhân có đơn vị phát hành hóa đơn riêng | Must | Thêm pháp nhân thứ hai không phải đổi cấu trúc dữ liệu; mỗi chi nhánh thuộc đúng một pháp nhân tại một thời điểm | BR-SYS-01 |

### FR-SYS bổ sung ở bản 0.5 (giai đoạn 2, đề xuất BA theo ủy quyền 06/11/2026, chờ khách xác nhận)

Hai FR dưới đây làm đầy FR-SYS-004 và FR-SYS-015 (cơ chế duyệt tối thiểu đã dựng ở giai đoạn 1: người đề xuất không tự duyệt, cấp 1 và cấp 2, thực hiện một lần, hạn dùng của duyệt) và là điều kiện cho INV-012, INV-010, PUR-002, ACC-018, HRM-010. Ma trận, ủy quyền và hàng chờ là dữ liệu của tenant, không có số liệu nào viết cứng trong mã.

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-SYS-033 | Ma trận phê duyệt cấu hình và ủy quyền duyệt: mỗi loại yêu cầu (giảm giá vượt hạn mức, hủy lệnh, điều chỉnh kho, chênh lệch quỹ, chuyển kho giá trị lớn, nhập lệch, xuất nội bộ, mua hàng, chi tiền, hoàn tiền, kỳ công, mở lại ngày hoặc kỳ) có tham số, giá trị và cấp duyệt (quản lý chi nhánh, quản lý vùng, chủ garage hoặc cờ quyền) có ngày hiệu lực, theo chi nhánh, Company hoặc tenant; ủy quyền duyệt có thời hạn, phạm vi (loại, nhóm chi nhánh), người ủy quyền và người nhận, mặc định tắt, chỉ chủ garage sửa, có nhật ký; người nhận ủy quyền không duyệt yêu cầu của chính mình và không nhận ủy quyền cho dữ liệu mình không có quyền xem; loại yêu cầu chưa có dòng cấu hình thì chuyển lên cấp cao nhất \[Cần xác nhận: hạn mức và cấp, Chủ dự án, Q67, Q68\] | Must | Đổi hạn mức có ngày hiệu lực không đổi yêu cầu đã duyệt; yêu cầu vượt hạn mức chờ đúng cấp; ủy quyền hết hạn thì quyền duyệt mất ngay; người đề xuất kiêm người nhận ủy quyền vẫn không tự duyệt được; tenant khác không thấy và không dùng được ma trận này | BR-SYS-03 |
| FR-SYS-034 | Hàng chờ phê duyệt dùng chung và chuyển cấp: một hàng chờ lọc theo người duyệt; nhắc sau T1 và chuyển cấp sau T2 (mẫu: nhắc sau 1 ngày làm việc, chuyển cấp sau thêm 2 ngày, mua gấp 2 giờ) cấu hình theo loại \[Cần xác nhận: T1, T2, Q68\]; yêu cầu đã chuyển cấp vẫn ở trạng thái "chờ duyệt" kèm cấp hiện tại; khi cấp hiện tại chỉ có người đề xuất đủ quyền thì chuyển cấp trên; duyệt hàng loạt chỉ cho các loại cấu hình cho phép và chỉ cùng loại; duyệt hết hạn dùng không được | Should | Yêu cầu quá T2 hiện ở hàng chờ của cấp trên và người duyệt nhận nhắc; chọn hai loại khác nhau để duyệt hàng loạt bị chặn; chuyển cấp ghi nhật ký người, thời điểm, lý do | BR-SYS-07 |

**Làm rõ bản 0.6 (trả lời BA cho slice 2.5, 06/11/2026; chờ khách xác nhận, chi tiết ở `docs/dev/phase-2-plan.md` §14):** (a) T2 là thời gian chờ thêm sau lần nhắc ở T1, tổng thời gian đến lúc chuyển cấp là T1 cộng T2; "mua gấp 2 giờ" là tham số chuyển cấp của chính yêu cầu mua gấp, khác hạn hậu duyệt N giờ của FR-PUR-009; (b) giờ làm việc theo chi nhánh; chi nhánh chưa cấu hình thì tính giờ đồng hồ và hệ thống cảnh báo người cấu hình; (c) phạm vi ủy quyền là danh sách chi nhánh chọn tường minh (chọn theo nhóm thì nhóm được mở thành danh sách tại lúc tạo); (d) ủy quyền chỉ có hiệu lực ở đúng cấp mà người ủy quyền đang giữ: yêu cầu đã chuyển cấp 2 thì ủy quyền của quản lý cấp 1 không với tới; (e) giai đoạn 2 hạn mức cấu hình ở tầng tenant; ghi đè theo chi nhánh hoặc Company làm khi khách nêu nhu cầu (khóa cấu hình giữ chỗ cho tiền tố `branch:`).

## 10A. FR: Multi-tenant (TEN)

55 yêu cầu: 30 Must, 21 Should, 4 Could (bản 0.4, 06/11/2026; FR-TEN-017 nâng Could thành Must và từ MT-3 về MT-0 theo quyết định của chủ dự án). **Đây là đề xuất BA cụ thể hóa quyết định của khách ngày 05/11/2026** (D1 thiết kế multi-tenant từ đầu; D2 chủ garage khác tự đăng ký và tự triển khai; D3 có gói dịch vụ thu tiền, làm sau theo phase). Khách chỉ quyết ba điều đó; mọi FR bên dưới chờ khách xác nhận. FR-TEN-053 đến 055 và các chỉnh sửa ở FR-TEN-004, 016, 030, 039 đến 045 theo feedback 06/11/2026 và bản tối giản đăng ký (`docs/ui-ux/tenant-signup-simplified.md`), cũng là đề xuất chưa xác nhận.

Cách đọc ưu tiên: **tương đối với chương trình multi-tenant**. Must là cần trước khi mở đăng ký tự phục vụ cho người ngoài; trong đó nhóm "nền" **MT-0 (15 FR) thuộc giai đoạn 1 pilot** (mục 13). Should là cần trước khi thu tiền hoặc mở rộng thương mại; thu tiền là Should vì "thu tiền sau" nhưng thiết kế nền không được chặn. Cột "Đợt, UAT": MT-0 nền, MT-1 tự phục vụ có kiểm soát, MT-2 gói tùy chọn và hạn mức (gói mặc định miễn phí, không trial), MT-3 thu tiền và mở rộng. Các điểm chưa chốt ghi `[Cần xác nhận]`; danh sách gom ở `docs/multi-tenant-open-questions.md`. Nội dung đầy đủ, vòng đời tenant, journey J1 đến J10 ở `docs/multi-tenant-analysis.md`.

**Làm rõ các FR-SYS hiện có theo tenant:** FR-SYS-002 (phân quyền theo vai trò và chi nhánh), FR-SYS-005 (cấu hình chi nhánh, thêm chi nhánh không sửa mã), FR-SYS-006 (danh mục có hiệu lực), FR-SYS-007 (nhập Excel), FR-SYS-010 (sao lưu và khôi phục), FR-SYS-011 (cấu trúc tổ chức), FR-SYS-012 (nhiều vai trò), FR-SYS-017 (API ngoài, khóa riêng), FR-SYS-018 (Company, Branch, Warehouse; nhiều pháp nhân) đều hiểu là **trong phạm vi một tenant**; FR-SYS-018 phân biệt Company (pháp nhân trong tenant) với tenant (khách hàng của nền tảng). Cô lập chi nhánh (FR-SYS-002) nằm **bên trong** cô lập tenant (FR-TEN-009), không thay thế.

### Nhóm A. Hồ sơ và vòng đời tenant

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-001 | Hồ sơ tenant: mã tenant bất biến, tên, liên hệ, pháp nhân đại diện, tham chiếu hợp đồng, gói (mặc định: gói miễn phí, RULE-035), trạng thái, ngày tạo; không xóa | Must | Mã không đổi được sau khi tạo; không có thao tác xóa hồ sơ; mọi thay đổi có nhật ký nền tảng | BR-TEN-02; RULE-016, 027 | MT-0; UAT-TEN-01 |
| FR-TEN-002 | Cấp phát tenant theo checklist (lõi dùng chung cho cấp phát thủ công và tự động FR-TEN-042): tạo tenant, Company đầu tiên, cấu hình mặc định nền tảng, tài khoản chủ garage; chạy lại không tạo bản trùng; lỗi giữa chừng cho thử lại từng bước hoặc hủy | Must | Cấp phát hai lần cùng một yêu cầu cho một tenant; lỗi giữa chừng thử lại hoàn tất không có dữ liệu trùng; tenant mới không thấy dữ liệu tenant khác | BR-TEN-02, 03; RULE-018 | MT-0; UAT-TEN-01 |
| FR-TEN-003 | Vòng đời trạng thái tenant (13 trạng thái, tách khỏi năm đối tượng hiện có); mỗi chuyển trạng thái có người thực hiện, người duyệt (bước nhạy cảm), lý do, thời điểm; chuyển trái quy tắc bị chặn | Must | Không chuyển được `purged` về `active`; ngưng/chấm dứt/xóa thiếu người duyệt hoặc lý do bị từ chối; có đủ dòng nhật ký | BR-TEN-02; RULE-020, 027 | MT-0; UAT-TEN-02 |
| FR-TEN-004 | Kiểm tra trước kích hoạt, tự động hóa: Company, chi nhánh, kho do hệ thống tạo; đơn vị phát hành mặc định `fake`; điều khoản đã chấp nhận và chính sách lưu trữ đã xem ở lúc đăng ký; **kích hoạt = chủ garage bấm "Bắt đầu dùng"**; muốn phát hành hóa đơn thật thì cần đạt xác minh (FR-TEN-040) và đã khai nhà cung cấp | Must | Thiếu điều kiện thì không `active` và nêu mục thiếu; chưa khai hoặc chưa xác minh thì nút phát hành thật bị khóa kèm lý do, không phát hành hóa đơn thật | BR-TEN-02, 07; RULE-024, 028, 029 | MT-1; UAT-TEN-01, 15 |
| FR-TEN-005 | Hạn chế và tạm ngưng: chế độ "chặn tạo mới", "chỉ đọc và tải dữ liệu", "chặn hoàn toàn (an ninh)"; phiên đang mở bị thu hồi theo cấu hình; thông báo cho CH tenant; tác vụ nền đồng bộ hóa đơn vẫn chạy | Must | Chỉ đọc: không tạo/sửa chứng từ nhưng tải được hóa đơn và xuất dữ liệu; chặn tạo mới: lệnh đang mở vẫn thu tiền và giao xe; dữ liệu giữ nguyên | BR-TEN-02, 05; RULE-020, 021, 023, 026 | MT-1; UAT-TEN-03 |
| FR-TEN-006 | Chấm dứt và gói xuất dữ liệu: dữ liệu nghiệp vụ, XML/PDF hóa đơn, tệp đính kèm, nhật ký, kèm danh mục và mã kiểm tra toàn vẹn; ghi nhận tenant đã nhận | Must | Gói mở được độc lập; số bản ghi và mã kiểm tra khớp nguồn; không chứa dữ liệu tenant khác; ghi ai nhận, khi nào | BR-TEN-02, 05; RULE-020, 021 | MT-1 (công cụ dòng lệnh chỉ xuất, không xóa, làm trước go-live pilot vì hồ sơ Q38 cam kết quyền thoát kèm trả dữ liệu); UAT-TEN-04 |
| FR-TEN-007 | Xóa hoặc ẩn danh sau chấm dứt theo chính sách lưu trữ: chặn khi còn thời hạn giữ hoặc giữ pháp lý; chỉ chạy khi có người duyệt; ra chứng nhận xóa; nêu thời điểm dữ liệu hết khỏi sao lưu | Must | Chưa có chính sách thì không xóa gì; giữ pháp lý thì chặn; xóa xong không tra cứu được, chứng nhận xóa không chứa dữ liệu cá nhân | BR-TEN-05; RULE-020 | MT-1; UAT-TEN-04 |
| FR-TEN-008 | Mở lại tenant `terminating` hoặc `terminated` trong thời hạn cho phép theo hợp đồng | Should | Trước hạn mở lại được, dữ liệu nguyên vẹn; sau hạn không mở được | BR-TEN-02; RULE-020 | MT-2; UAT-TEN-02 |

### Nhóm B. Cô lập và bảo mật

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-009 | Cô lập tuyệt đối dữ liệu giữa tenant ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp và URL ký, thông báo, tác vụ nền, nhật ký | Must | Tài khoản tenant A không thấy, không tìm thấy, không tải, không xuất được dữ liệu tenant B ở mọi kênh; bản ghi ngoài tenant trả "không tìm thấy" | BR-TEN-01, 11; RULE-016, 017, 034 | MT-0; UAT-TEN-05 |
| FR-TEN-010 | Mỗi yêu cầu và phiên thuộc đúng một tenant do hệ thống xác định, không do dữ liệu người dùng gửi lên; thiếu hoặc không hợp lệ thì từ chối | Must | Sửa tham số, tiêu đề hay đường dẫn để trỏ sang tenant khác không đọc/ghi được dữ liệu tenant khác | BR-TEN-01; RULE-016, 026, 034 | MT-0; UAT-TEN-05 |
| FR-TEN-011 | Vai trò nền tảng tách khỏi vai trò tenant, ma trận quyền riêng (mục 2); không vai trò nền tảng nào mặc định xem dữ liệu nghiệp vụ; không tài khoản nào vừa nhân sự nền tảng vừa người dùng tenant | Must | Quản trị nền tảng mở danh sách lệnh sửa chữa của tenant bị từ chối; vai trò tenant không vào được màn nền tảng | BR-TEN-04; RULE-022 | MT-0; UAT-TEN-06 |
| FR-TEN-012 | Phiên hỗ trợ có kiểm soát: tenant cho phép (hoặc khẩn cấp có người duyệt), có lý do, phạm vi, thời hạn tự hết, mọi thao tác ghi nhật ký, dữ liệu cá nhân vẫn che, CH tenant xem được lịch sử | Must | Không có phiên hợp lệ thì hỗ trợ không xem được dữ liệu; hết hạn tự đóng; mỗi phiên có dòng nhật ký hiển thị cho tenant | BR-TEN-04; RULE-022 | MT-1; UAT-TEN-06 |
| FR-TEN-013 | Nhật ký nền tảng bất biến, tách khỏi nhật ký tenant: người, thời điểm, hành động, tenant liên quan, lý do, giá trị trước và sau (không chứa dữ liệu cá nhân của khách tenant) | Must | Không sửa/xóa được; ngưng, chấm dứt, đổi gói, phiên hỗ trợ đều có dòng; nhật ký tenant không chứa thao tác nền tảng nhạy cảm của tenant khác | BR-TEN-02, 04; RULE-027 | MT-0; UAT-TEN-02 |
| FR-TEN-014 | Bộ kiểm thử cách ly có trục tenant, chạy tự động; kết quả là điều kiện bắt buộc trước khi kích hoạt tenant mới hoặc phát hành bản mới | Must | Có báo cáo kiểm thử tenant × vai trò × kênh; lỗi rò rỉ chặn phát hành | BR-TEN-01, 11; RULE-017 | MT-0; UAT-TEN-05 |
| FR-TEN-015 | Hạn mức công bằng giữa tenant: giới hạn tần suất yêu cầu, nhập/xuất, tác vụ nền theo tenant; mức thấp hơn cho tenant chưa xác minh hoặc chưa trả tiền để chống lạm dụng chi phí | Must | Một tenant nhập tệp lớn và gọi API dồn dập; tenant khác vẫn đạt NFR-PERF-01 | BR-TEN-01, 11 | MT-1; UAT-TEN-12 |

### Nhóm C. Người dùng và định danh

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-016 | Xác định tenant khi đăng nhập không mơ hồ. **Đã quyết 06/11/2026 (C-S14):** một email là một danh tính duy nhất toàn nền tảng (một thông tin đăng nhập), mỗi tenant là một tư cách thành viên riêng (FR-TEN-017); mã nhân viên và mã khách chỉ duy nhất trong tenant (RULE-018), không giả định duy nhất toàn nền tảng. Đăng nhập chỉ bằng email + mật khẩu (mã nhân viên không dùng để đăng nhập, chốt 06/11/2026; nhân viên không có email: chưa chốt, câu hỏi cho khách); bước "Chọn công ty" chỉ hiện sau mật khẩu đúng khi email có từ hai tư cách thành viên đang hoạt động (một tư cách thì vào thẳng); lỗi trung lập, cùng mã trạng thái và thời gian phản hồi, không lộ tài khoản có tồn tại ở tenant nào; thu hồi ở một tenant không ảnh hưởng tenant khác | Must | Cùng email thuộc hai tenant: sau mật khẩu đúng chọn được đúng công ty, vào đúng tenant; mã nhân viên trùng giữa tenant không gây nhầm; sai email, sai mật khẩu, tenant đã chấm dứt cho cùng một câu; danh sách "Chọn công ty" chỉ gồm tư cách của chính người đăng nhập | BR-TEN-01; RULE-026, 034 | MT-0 (nền: danh tính, phiên), MT-1 (UI chọn công ty hoàn chỉnh); UAT-TEN-07, 21 |
| FR-TEN-017 | Một danh tính, nhiều tư cách thành viên (**nâng từ Could/MT-3 lên Must/MT-0 ngày 06/11/2026**, quyết định C-S14): (a) email duy nhất toàn nền tảng, một mật khẩu cho mọi tư cách; (b) tư cách thành viên theo tenant mang vai trò, chi nhánh, trạng thái và thu hồi riêng; (c) phiên gắn đúng một tenant, Scope tính lại từ tư cách thành viên của tenant đích mỗi khi chọn hoặc đổi tenant, không mang quyền, chi nhánh đang chọn hay dữ liệu đệm từ tenant cũ; quyền không cộng gộp giữa tenant; (d) mời một email đã có danh tính thì thêm tư cách thành viên sau khi người đó chấp nhận, không ghi đè mật khẩu; (e) tài khoản hiện có chuyển thành danh tính và tư cách thành viên của tenant số 1 (FR-TEN-031); (f) email nhân sự nền tảng không trùng email thành viên tenant (FR-TEN-011). (g) chấp nhận lời mời vào tư cách thêm ghi đồng ý quy định sử dụng và bảo mật dữ liệu của tenant mời (người, tenant, phiên bản, thời điểm); chưa đồng ý thì chưa vào dữ liệu; (h) quản trị tenant không đặt hộ mật khẩu, không đổi email của danh tính. Quy tắc vận hành chi tiết: BA đã trả lời mức nghiệp vụ 06/11/2026 `[Cần xác nhận: Q41, chủ dự án; luật sư cho phần dữ liệu danh tính]` | Must | Đổi tenant tạo ngữ cảnh mới; quyền tenant A không có ở B; thu hồi tư cách ở A không đăng xuất B và không đổi dữ liệu B; gửi yêu cầu mang định danh tenant B trong phiên của A bị từ chối; tenant A không thấy email còn thuộc tenant nào khác; tài khoản của tenant số 1 vẫn đăng nhập được sau chuyển đổi | BR-TEN-01; RULE-026, 034 | MT-0 (mô hình, phiên, chọn và đổi tenant; giao diện hoàn chỉnh ở MT-1 cùng FR-TEN-016); UAT-TEN-07 |

### Nhóm D. Cấu hình

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-018 | Cấu hình phân tầng nền tảng, tenant, Company, Branch có ngày hiệu lực; hiển thị nguồn của giá trị đang áp dụng; gồm chính sách lưu trữ, mật khẩu, hạn mức giảm giá mặc định | Must | Đổi cấu hình tenant không ảnh hưởng tenant khác; tầng dưới ghi đè tầng trên theo quy tắc; chứng từ đã phát hành giữ giá trị cũ | BR-TEN-03; RULE-019 | MT-0; UAT-TEN-08 |
| FR-TEN-019 | Danh mục pháp lý do nền tảng quản lý (thuế suất, chu kỳ đăng kiểm, khung mẫu theo luật) phát hành cho tenant có ngày hiệu lực; tenant có ghi đè hay không theo Q16; nền tảng chịu trách nhiệm cập nhật | Must | Đổi thuế suất ở nền tảng áp cho lệnh sau ngày hiệu lực của mọi tenant trong phạm vi, không sửa mã; ghi ai phát hành | BR-TEN-03; RULE-019 | MT-1; UAT-TEN-08 |
| FR-TEN-020 | Đánh số, mã chi nhánh, mã nhân viên, mã khách duy nhất trong tenant; khóa dãy số chứa tenant; hai tenant được trùng số | Must | Hai tenant cùng phát hành số đầu tiên của cùng loại chứng từ không xung đột, không ảnh hưởng nhau | BR-TEN-03; RULE-018 | MT-0; UAT-TEN-08 |
| FR-TEN-021 | Cấu hình tích hợp theo tenant và Company, do chính tenant khai: nhà cung cấp hóa đơn, SMS/Zalo, khóa/bí mật, chứng thư, môi trường thử/thật; không dùng chung; chưa cấu hình thì "Chưa kích hoạt"; phát hành thật chỉ sau khi đạt xác minh | Must | Hóa đơn của tenant A mang đơn vị phát hành của A; không hóa đơn nào dùng bí mật tenant khác; `fake` bị từ chối ở `live` | BR-TEN-03; RULE-024, 025 | MT-0; UAT-TEN-09 |
| FR-TEN-022 | Mẫu in và thương hiệu theo tenant (tên, logo, chân trang); phần bắt buộc theo luật hóa đơn không gỡ được | Should | Phiếu in tenant A không có thương hiệu của B; mẫu hóa đơn thiếu trường bắt buộc bị chặn | BR-TEN-03 | MT-2; UAT-TEN-09 |
| FR-TEN-023 | Tên miền con hoặc tên miền riêng cho tenant. `[Cần xác nhận: Q6]` | Could | Truy cập theo tên miền dẫn đúng ngữ cảnh tenant; tên miền không lộ danh sách tenant | BR-TEN-03; RULE-026 | MT-3 |

### Nhóm E. Gói, quota, billing

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-024 | Danh mục gói dịch vụ và hạn mức (chiều theo Q13) có ngày hiệu lực; gán gói cho tenant có lịch sử | Should | Đổi gói áp từ ngày hiệu lực; lịch sử gói xem được | BR-TEN-06 | MT-2; UAT-TEN-10 |
| FR-TEN-025 | Thực thi hạn mức: cảnh báo theo ngưỡng; vượt thì chặn tạo mới hoặc ghi nhận vượt; không chặn hoàn tất chứng từ đang mở | Should | Vượt số chi nhánh thì không tạo thêm nhưng lệnh đang mở vẫn thu tiền và giao xe | BR-TEN-06; RULE-023 | MT-2; UAT-TEN-10 |
| FR-TEN-026 | Bật/tắt module theo gói; module tắt không hiện, không gọi được qua API, dữ liệu giữ nguyên | Should | Tắt PUR ở tenant A không còn menu và API; bật lại thấy dữ liệu cũ | BR-TEN-06 | MT-2; UAT-TEN-10 |
| FR-TEN-027 | Ghi nhận mức sử dụng theo tenant theo các chiều đã chọn, có kỳ, đối chiếu được | Should | Số liệu sử dụng khớp số đếm từ nguồn cho cùng kỳ | BR-TEN-06 | MT-2; UAT-TEN-10 |
| FR-TEN-028 | Billing: kỳ thanh toán, bảng kê, công nợ tenant, liên kết trạng thái thanh toán với `restricted` sau ân hạn; phương án B0 đến B3 (B0 thuộc MT-0: chỗ lưu gói và trạng thái thuê bao; B1 thuộc MT-2) | Should | Quá hạn sau ân hạn chuyển `restricted` có nhật ký; trả nợ chuyển lại `active` | BR-TEN-06, 10; RULE-023, 025 | MT-0 (B0), MT-2 (B1); UAT-TEN-10 |

### Nhóm F. Onboarding và di chuyển

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-029 | Nhập Excel theo tenant (mở rộng FR-SYS-007): lô, lỗi, xem trước, hoàn tác theo lô thuộc tenant; mẫu chuẩn nền tảng, ánh xạ cột theo tenant | Must | Lô tenant A không thấy và không hoàn tác được từ tenant B; tệp lỗi không ghi một phần | BR-TEN-07; RULE-016 | MT-0; UAT-TEN-11 |
| FR-TEN-030 | Môi trường thử cho tenant đang triển khai (kênh bán hàng có nhân sự): dữ liệu thử tách khỏi dữ liệu thật, hóa đơn `fake`, xóa được dữ liệu thử trước kích hoạt. **Đường tự đăng ký không dùng:** dữ liệu là dữ liệu thật, hóa đơn `fake` tới khi qua cổng RULE-028, dữ liệu mẫu gắn cờ `sample` `[Cần xác nhận: C-S04]` | Should | Dữ liệu thử xóa được không ảnh hưởng cấu hình; không phát hành hóa đơn thật khi chưa đủ điều kiện | BR-TEN-07; RULE-024, 028 | MT-1; UAT-TEN-01 |
| FR-TEN-031 | Đưa dữ liệu hiện có thành tenant số 1 (hiện chỉ trên Emulator, chưa dữ liệu thật: làm ngay): giữ nguyên số chứng từ đã cấp, hóa đơn và khóa chống trùng, nhật ký; có kế hoạch quay lui; đối chiếu số lượng trước và sau | Must | Số bản ghi và tổng tiền từng loại trước và sau khớp; không số chứng từ nào đổi; không phát hành hóa đơn trùng sau di chuyển | BR-TEN-02; RULE-016, 018 | MT-0; UAT-TEN-11 |
| FR-TEN-032 | Bộ câu hỏi khảo sát chuẩn cho tenant mới lưu cùng hồ sơ (nay là mục tùy chọn của checklist FR-TEN-052) | Could | Hồ sơ tenant có phiên bản bộ câu hỏi và câu trả lời | BR-TEN-07 | MT-2 |

### Nhóm G. Báo cáo nền tảng, vận hành, tuân thủ

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-033 | Báo cáo nền tảng: danh mục tenant, trạng thái, gói, mức sử dụng, sức khỏe tích hợp; không chứa bản ghi nghiệp vụ | Should | Số liệu tổng hợp theo tenant; không đường dẫn đào sâu tới lệnh hay khách | BR-TEN-08; RULE-017 | MT-2; UAT-TEN-06 |
| FR-TEN-034 | Sao lưu và khôi phục theo tenant: khôi phục riêng một tenant tới thời điểm chọn không ảnh hưởng tenant khác; RPO/RTO theo SLA (mở rộng FR-SYS-010, NFR-AVA-02) | Must | Thử khôi phục một tenant thành công, dữ liệu tenant khác không đổi; có biên bản thử theo lịch | BR-TEN-01, 02; RULE-016 | MT-1 (mô hình cô lập quyết ở MT-0); UAT-TEN-12 |
| FR-TEN-035 | Thông báo vận hành từ nền tảng tới tenant (bảo trì, sự cố, thay đổi luật, phiên bản mới) theo vai trò nhận | Should | CH và AD tenant nhận; không tenant nào nhận thông báo dành riêng tenant khác | BR-TEN-02 | MT-2 |
| FR-TEN-036 | Quy trình xử lý sự cố dữ liệu cá nhân: xác định tenant bị ảnh hưởng, báo cho tenant theo hạn thỏa thuận, lưu hồ sơ sự cố (thời hạn pháp lý chờ luật sư, Q8) | Must | Có mẫu và đầu mối; hồ sơ sự cố liên kết nhật ký; chỉ tenant bị ảnh hưởng nhận thông báo | BR-TEN-05; RULE-017, 027 | MT-1; UAT-TEN-12 |
| FR-TEN-037 | Ghi nhận chấp thuận điều khoản dịch vụ và thỏa thuận xử lý dữ liệu theo phiên bản, theo tenant; chấp nhận điện tử khi tự đăng ký (hiệu lực chờ luật sư, Q8, Q30); phiên bản mới cần chấp thuận lại. Tenant số 1 (pilot, trước MT-1): **đã chốt theo ủy quyền 06/11/2026 (Q38)**: ghi nhận thủ công thỏa thuận đã ký (tệp tham chiếu, người ký, ngày, phiên bản Điều khoản/DPA) vào hồ sơ tenant; chưa có bản ghi thì chặn nhập Excel dữ liệu thật và hóa đơn `live`, và không qua được bước kích hoạt `onboarding -> active`; phần này làm trước go-live pilot `[Cần xác nhận: luật sư về nội dung pháp lý]` | Must | Tenant chưa chấp thuận phiên bản hiện hành không nhập được dữ liệu thật và không kích hoạt được; có lịch sử người chấp thuận và thời điểm | BR-TEN-05; RULE-029 | MT-1; UAT-TEN-01, 13 |
| FR-TEN-038 | Số liệu tổng hợp ẩn danh và benchmark giữa tenant, chỉ gồm tenant đã đồng ý, có ngưỡng số tenant tối thiểu. `[Cần xác nhận: Q10]` | Could | Tenant không đồng ý không có mặt; không xem được số liệu riêng tenant khác | BR-TEN-08; RULE-017 | MT-3; UAT-TEN-06 |

### Nhóm H. Đăng ký tự phục vụ, xác minh, chống lạm dụng, triển khai và hỗ trợ (theo D2)

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-039 | Đăng ký tự phục vụ một trang: tên garage, MST, họ tên người đại diện, email, mật khẩu, hai ô chấp nhận (Điều khoản; thỏa thuận xử lý dữ liệu, tách riêng, không tích sẵn); loại hình suy ra từ MST (C-S05); SĐT thu ở bước kích hoạt; kiểm tra người thật ẩn mặc định; không chọn gói, không giá; tạo yêu cầu `signup_pending`, chưa có dữ liệu nghiệp vụ; email đã có tài khoản không ghi đè mật khẩu | Must | Gửi lại không tạo hai yêu cầu; chưa xác thực email không sang bước sau; phản hồi khi email hoặc MST đã tồn tại trung lập, cùng chữ và mã trạng thái; liên kết xác thực hết hạn theo tham số (72 giờ, `[Cần xác nhận]`) và cấp lại được | BR-TEN-09, 11; RULE-028, 029, 032 | MT-1; UAT-TEN-13, 21 |
| FR-TEN-040 | Xác minh tenant mới: đối chiếu MST và pháp nhân (tự động hay duyệt tay theo cấu hình, Q28); tiêu chí tự duyệt cấu hình hiệu lực theo ngày; kết quả đạt, cần bổ sung, từ chối kèm lý do; xác minh **không chặn dùng ứng dụng**, chỉ chặn phát hành hóa đơn thật | Must | MST sai định dạng hoặc không tồn tại không qua; MST đã gắn tenant đang hoạt động vào hàng chờ (RULE-032); chưa đạt thì không phát hành hóa đơn thật; từ chối có lý do và đường khiếu nại qua hỗ trợ; hồ sơ xác minh bảo vệ như dữ liệu cá nhân | BR-TEN-09, 11; RULE-028, 032 | MT-1; UAT-TEN-13 |
| FR-TEN-041 | Chống lạm dụng đăng ký: giới hạn tần suất theo nguồn, điểm rủi ro, kiểm tra người thật khi nghi ngờ (cờ `bot_check.always`), honeypot, chặn email dùng một lần, danh sách chặn/cho phép, cờ vào hàng chờ duyệt tay, trần số tenant mới mỗi giờ/ngày, tenant bị cờ chỉ ở chế độ thử | Must | Đăng ký dồn dập từ một nguồn bị chặn sau ngưỡng; email dùng một lần bị từ chối; ca bị cờ không phát hành hóa đơn thật, không gửi tin hàng loạt; vượt trần ngày thì xếp hàng và cảnh báo nền tảng; mọi quyết định có nhật ký nền tảng | BR-TEN-11; RULE-028, 032 | MT-1; UAT-TEN-14 |
| FR-TEN-042 | Cấp phát tự động tự phục vụ: sau xác minh đạt chạy checklist FR-TEN-002 không cần nhân sự, **gồm tạo 1 chi nhánh và 1 kho mặc định**, cờ hiển thị đơn chi nhánh (FR-TEN-051), gán chủ garage vào chi nhánh; email xác thực và chào mừng đúng nội dung; email đã có tài khoản thì thêm tư cách thành viên; lỗi tự thử lại, quá số lần báo nhân sự nền tảng | Must | Hai lần kích hoạt cùng yêu cầu không tạo tenant thứ hai; lỗi giữa chừng thử lại không trùng; thời gian đạt NFR-TEN-05; tenant mới có đúng 1 Company, 1 chi nhánh, 1 kho | BR-TEN-09; RULE-018, 028 | MT-1; UAT-TEN-15, 20 |
| FR-TEN-043 | Onboarding **tối đa hai màn**: xác nhận garage và kích hoạt (tên và MST điền sẵn, bổ sung tỉnh, địa chỉ, SĐT); thiết lập nhanh tùy chọn (câu hỏi "đang quản lý garage bằng gì", lối vào nhập Excel, dịch vụ và phụ tùng mẫu, mời nhân viên); phần còn lại là checklist FR-TEN-052; lưu tiến độ, bỏ qua có kiểm soát | Should | Thoát giữa chừng rồi vào lại tiếp tục đúng; bước bắt buộc chưa xong thì không `active`; dữ liệu mẫu ngừng dùng được; không bước nào cần nhân sự nền tảng; chọn Excel thì mục Nhập Excel ghim đầu checklist | BR-TEN-07, 09; RULE-024, 028 | MT-1; UAT-TEN-15 |
| FR-TEN-050 | Hỗ trợ tự phục vụ và SLA: tenant gửi và tra yêu cầu hỗ trợ, thấy trạng thái, kênh và SLA (Q9, Q23, Q33); kèm đồng ý cấp phiên hỗ trợ; nền tảng thấy hàng chờ nhưng không thấy dữ liệu nghiệp vụ | Should | Yêu cầu của tenant A không hiện ở B; hàng chờ nền tảng không có bản ghi nghiệp vụ | BR-TEN-09; RULE-022 | MT-2; UAT-TEN-19 |

### Nhóm I. Thuê bao, thanh toán, hóa đơn nền tảng, nợ phí (theo D3; làm sau, nền không được chặn)

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-044 | **Gói mặc định miễn phí (viết lại 06/11/2026, thay "Dùng thử hoặc early access"; quyết định Q21/Q34):** tenant không gán gói ở gói mặc định miễn phí hoàn toàn (RULE-035): không đồng hồ, không ngày hết hạn, không trạng thái hết hạn do dùng thử, không hóa đơn nền tảng; giao diện không nêu "dùng thử", số ngày, tên gói hay giá; gói trả phí là tùy chọn về sau, chỉ áp khi tenant chủ động chọn (FR-TEN-045); giới hạn của tenant miễn phí là tham số cấu hình có ngày hiệu lực, BA đã đề xuất giá trị mặc định (06/11/2026, `docs/dev/open-questions-for-ba.md`; không bao giờ xóa dữ liệu, không chặn tenant số 1) `[Cần xác nhận: Q40, chủ dự án]`. Giá trị mặc định có từ MT-0 qua FR-TEN-001 và FR-TEN-028 (B0) | Should | Tenant mới không gán gói: không màn, thư hay API nào có ngày hết hạn hay đếm ngược; không bị hạn chế vì lý do thời gian; không phát sinh hóa đơn nền tảng; chuyển sang gói trả phí chỉ khi tenant chủ động xác nhận; nợ phí về sau đi theo thang RULE-030, không xóa dữ liệu | BR-TEN-06, 10; RULE-021, 023, 030, 035 | MT-0 (giá trị mặc định), MT-2 (gói tùy chọn); UAT-TEN-16 |
| FR-TEN-045 | Nâng và hạ gói tùy chọn (gồm hạ về gói mặc định miễn phí): nâng hiệu lực ngay, hạ kỳ kế tiếp; hạ gói bị chặn hoặc cảnh báo khi mức dùng vượt hạn mức gói mới (không xóa dữ liệu); lịch sử gói và nhật ký. Giao diện hoãn tới khi có billing B1 | Should | Hạ gói khi đang vượt số chi nhánh: bị chặn hoặc cảnh báo theo cấu hình, dữ liệu giữ nguyên | BR-TEN-06, 10; RULE-023, 030 | MT-2; UAT-TEN-17 |
| FR-TEN-046 | Feature flag theo tenant, gói hoặc nhóm thử; mặc định tắt cho tính năng mới; không dùng flag đổi quy tắc luật định | Should | Bật cho tenant A không ảnh hưởng B; thay đổi có nhật ký nền tảng; tắt flag không mất dữ liệu | BR-TEN-06; RULE-019 | MT-2; UAT-TEN-17 |
| FR-TEN-047 | Thanh toán gói: tenant tự thanh toán qua kênh đã chọn (Q27); trạng thái thanh toán độc lập với trạng thái tenant; idempotent; đối soát; hoàn tiền bằng điều chỉnh. Không lưu thông tin thẻ | Should | Bấm hai lần hoặc hết thời gian chờ không thu hai lần; đối soát khớp; hoàn tiền là bút toán điều chỉnh, không xóa giao dịch | BR-TEN-10; RULE-031 | MT-3; UAT-TEN-18 |
| FR-TEN-048 | Hóa đơn của nền tảng cho tenant: pháp nhân nền tảng (Q12) phát hành theo cơ chế riêng, tách khỏi hóa đơn tenant; thuế theo cấu hình có hiệu lực theo ngày; người mua lấy từ hồ sơ đã xác minh; idempotent | Should | Hóa đơn nền tảng không lẫn hóa đơn tenant; không phát hành trùng; đổi thuế suất theo ngày hiệu lực không sửa hóa đơn cũ; gói mặc định miễn phí không phát sinh hóa đơn | BR-TEN-10; RULE-025, 031 | MT-3; UAT-TEN-18 |
| FR-TEN-049 | Dunning và tạm ngưng khi nợ phí: thang cấu hình nhắc, ân hạn, `restricted`, `suspended` (chỉ đọc); không chặn hoàn tất chứng từ đang mở và không chặn tải hóa đơn, xuất dữ liệu; thanh toán xong tự mở lại; có nhật ký | Should | Quá hạn sau ân hạn chuyển `restricted` đúng ngày và có thông báo; lệnh đang mở vẫn thu tiền và giao xe; thanh toán xong về `active`; không bước nào xóa dữ liệu | BR-TEN-10; RULE-021, 023, 030 | MT-3; UAT-TEN-18 |

### Nhóm J. Bản tối giản đăng ký và feedback 06/11/2026

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR, RULE | Đợt, UAT |
| --- | --- | --- | --- | --- | --- |
| FR-TEN-051 | Tổ chức mặc định một chi nhánh một kho và hiển thị theo số lượng: tenant tự đăng ký có đúng 1 chi nhánh và 1 kho; UI nhiều chi nhánh/kho (bộ chọn chi nhánh, nhóm chi nhánh, QV, chuyển kho liên chi nhánh, báo cáo hợp nhất) chỉ hiện khi có từ 2 chi nhánh (hoặc 2 kho) hoạt động; thêm ở Cài đặt | Must | Tenant mới không thấy bộ chọn chi nhánh; mọi bản ghi vẫn có `branch_id`, `resolveScope` vẫn chạy; thêm chi nhánh thứ hai thì UI nhiều chi nhánh hiện, dữ liệu cũ gán đúng chi nhánh đầu; kiểm thử NFR-ISO-01 vẫn đạt | BR-TEN-07, 09; RULE-033 | MT-1; UAT-TEN-20 |
| FR-TEN-052 | Thiết lập dần: checklist với trạng thái Chưa làm/Xong/Bỏ qua; mục chặn chỉ gồm phát hành hóa đơn thật (xác minh, nhà cung cấp); mặc định lấy từ cấu hình hiệu lực theo ngày | Should | Không mục nào khác chặn thao tác; bỏ qua mục không chặn không mất dữ liệu; phát hành thật bị khóa tới khi mục xác minh và nhà cung cấp đạt | BR-TEN-07; RULE-024, 028 | MT-1; UAT-TEN-15 |
| FR-TEN-053 | Liên kết xác thực email dùng một lần, 72 giờ (tham số), tự đăng nhập bất kể trình duyệt, chỉ lần xác thực đầu; mở bằng GET chỉ hiện trang, tiêu thụ bằng POST; nhật ký và email thông báo; phiên chỉ tạo khi tài khoản sẵn sàng; thao tác nhạy cảm yêu cầu nhập lại mật khẩu (nếu C-S17 được chấp nhận) | Should | Mở ở trình duyệt khác vẫn nhận phiên; liên kết đã dùng, hết hạn không tạo phiên; quét thư không làm hỏng liên kết; có nhật ký và email thông báo | BR-TEN-09, 11; RULE-026, 028 | MT-1; UAT-TEN-21 |
| FR-TEN-054 | Kênh hỗ trợ cấu hình (`support.phone`, `support.zalo`, `support.hours`, `support.email` dự phòng) hiển thị ở các màn đăng ký, chờ duyệt, từ chối, tạo chậm, checklist, hạn chế, khóa; không viết cứng | Should | Cấu hình rỗng vẫn hiện kênh dự phòng và cảnh báo quản trị; đổi giá trị có hiệu lực không phát hành lại | BR-TEN-09; RULE-019 | MT-1; UAT-TEN-22 |
| FR-TEN-055 | Tên thương hiệu hiển thị là một hằng cấu hình (`brand.name`) cho tiêu đề, email, mẫu in, hóa đơn thử; giá trị mặc định "GMEP" (đã quyết 06/11/2026, C-S24; bỏ "GARAGE OS") | Could | Đổi một nơi đổi toàn bộ chuỗi hiển thị; mặc định hiển thị "GMEP" | BR-TEN-09 | MT-1; UAT-TEN-22 |

**Đếm theo đợt (cập nhật 06/11/2026: 017 chuyển từ MT-3 sang MT-0):** MT-0: 001, 002, 003, 009, 010, 011, 013, 014, 016, 017, 018, 020, 021, 029, 031 (15, cộng phần B0 của 028). MT-1: 004, 005, 006, 007, 012, 015, 019, 030, 034, 036, 037, 039, 040, 041, 042, 043, 051, 052, 053, 054, 055 (21). MT-2: 008, 022, 024, 025, 026, 027, 028 (B1), 032, 033, 035, 044, 045, 046, 050 (14). MT-3: 023, 038, 047, 048, 049 (5). Tổng 55. Ưu tiên: 30 Must, 21 Should, 4 Could.

## 11. Yêu cầu phi chức năng

Các mức dưới đây là đề xuất khởi điểm, chưa đo với dữ liệu thật của khách; cần đo lại trong giai đoạn pilot trước khi chốt.

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-PERF-01 | Hiệu năng | Thao tác thường ngày (tiếp nhận, báo giá, tìm phụ tùng) phản hồi nhanh với dữ liệu thật | Dưới 2 giây ở mạng 4G |
| NFR-PERF-02 | Hiệu năng | Dashboard hợp nhất toàn chuỗi tải được khi có đủ dữ liệu một năm | Dưới 5 giây |
| NFR-AVA-01 | Khả dụng | Hoạt động ổn định trong giờ làm việc của chi nhánh | 99,5% trong giờ làm việc |
| NFR-AVA-02 | Khả dụng | Mục tiêu mất dữ liệu tối đa và thời gian khôi phục sau sự cố | Tối đa 1 giờ dữ liệu, khôi phục trong 4 giờ \[Cần xác nhận\] |
| NFR-SEC-01 | Bảo mật | Mã hóa khi truyền (TLS), mã hóa dữ liệu nhạy cảm khi lưu, băm mật khẩu | Bắt buộc |
| NFR-SEC-02 | Bảo mật | Kiểm thử bảo mật theo danh mục lỗ hổng web phổ biến trước khi chạy thật | Không còn lỗi mức nghiêm trọng khi nghiệm thu |
| NFR-SEC-03 | Bảo mật | Che bớt số điện thoại và địa chỉ với vai trò không cần xem đầy đủ | Theo ma trận quyền |
| NFR-PRI-01 | Dữ liệu cá nhân | Tuân thủ Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025; luật sư xác nhận doanh nghiệp thuộc nhóm nào được miễn hay ân hạn | Hoàn tất trước khi chạy thật \[Cần xác nhận\] |
| NFR-USA-01 | Dễ dùng | Giao diện tablet cho thợ: nút lớn, bắt đầu hoặc kết thúc hạng mục bằng thao tác ngắn | Tối đa 2 lần chạm |
| NFR-USA-02 | Dễ dùng | Cố vấn lập báo giá hạng mục thường gặp nhanh | Đạt chỉ số dưới 15 phút ở BRD |
| NFR-SCA-01 | Mở rộng | Thêm chi nhánh mới chỉ bằng cấu hình, không sửa cấu trúc dữ liệu | Số chi nhánh theo câu hỏi 2 của BRD |
| NFR-COM-01 | Tương thích | Trình duyệt Chrome, Edge, Safari bản mới; máy tính bảng Android và iPad; in A4, A5 và khổ nhiệt | Chốt thiết bị thật tại chi nhánh \[Cần xác nhận\] |
| NFR-OFF-01 | Chịu mất mạng | Lệnh đang thao tác không mất dữ liệu khi mất mạng ngắn; nhập bù có dấu hiệu | Giai đoạn 2 trở đi |
| NFR-DAT-01 | Lưu trữ | Chứng từ kế toán lưu đủ thời hạn luật; dữ liệu nghiệp vụ lưu trữ thay vì xóa cứng | Thời hạn do kế toán xác nhận \[Cần xác nhận\] |
| NFR-OPS-01 | Vận hành | Ghi nhật ký lỗi, cảnh báo khi gửi hóa đơn thất bại, theo dõi hiệu năng | Có cảnh báo cho đội vận hành |
| NFR-MNT-01 | Bảo trì | Quy tắc luật và chính sách tách khỏi mã; công thức thuế, giá, công, giá vốn có kiểm thử tự động | Mỗi công thức có bộ ví dụ kiểm thử do kế toán xác nhận |

### Bổ sung ở bản 0.2

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-INT-01 | Tích hợp | API cho hệ thống bên ngoài (hóa đơn, tin nhắn, kế toán) có xác thực và nhật ký gọi | Theo FR-SYS-017 |
| NFR-EXP-01 | Xuất dữ liệu | Xuất dữ liệu theo quyền; người không có quyền xuất không tải được danh sách khách hay báo cáo | Theo FR-SYS-013 và FR-CRM-017 |
| NFR-ISO-01 | Phân tách dữ liệu | Dữ liệu chi nhánh tách theo phạm vi quyền ở cả danh sách, tìm kiếm, báo cáo, xuất dữ liệu và API; **từ bản 0.4, tách theo tenant trước, rồi theo chi nhánh** (FR-TEN-009) | Kiểm tra bằng UAT-06 (có trục tenant, NFR-TEN-01) và UAT-TEN-05 |

### Bổ sung ở bản 0.3 (từ câu trả lời Discovery)

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-SCL-01 | Quy mô thiết kế | Thiết kế cho 20 chi nhánh, 500 đến 800 xe mỗi ngày và 250 đến 300 người dùng sau 2 năm | Khách ước tính, cần xác nhận số thực tế |
| NFR-SCL-02 | Đo tải | Ngoài người dùng đồng thời, đo số lệnh mỗi ngày, dòng phụ tùng mỗi lệnh, giao dịch kho mỗi ngày và số năm lưu trữ | Chốt sau Discovery |
| NFR-OFF-01 | Mất mạng | Cảnh báo mất mạng và lưu nháp; offline đầy đủ là phạm vi riêng | Chốt sau |
| NFR-PRT-01 | In ấn | In báo giá, lệnh sửa chữa, hóa đơn hoặc phiếu giao nhận theo mẫu | Mẫu và máy in chốt sau |

### Bổ sung ở bản 0.4 (multi-tenant)

Các mức đề xuất dưới đây chưa được khách xác nhận; con số thật là `[Cần xác nhận: Chủ dự án]`. NFR-SCL-01 và NFR-AVA-02 ở trên chỉ mô tả **tenant số 1** (khách đầu tiên), chưa phải cam kết cho mọi tenant.

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-TEN-01 | Cách ly | Mọi kiểm thử cách ly, dữ liệu seed và UAT có trục tenant; không giả định một tenant | Điều kiện phát hành, mở rộng UAT-06 |
| NFR-TEN-02 | Hiệu năng | Hiệu năng của tenant không giảm quá ngưỡng NFR-PERF-01, 02 do tenant khác dùng nặng | Đo ở kiểm thử tải đa tenant `[Cần xác nhận: số tenant và tải]` |
| NFR-TEN-03 | Khả dụng | SLA theo gói hoặc chung: khả dụng, RPO, RTO, giờ hỗ trợ; ngoại lệ bảo trì báo trước | `[Cần xác nhận: Chủ dự án, Q9]`; hiện đề xuất 99,5% giờ làm việc, RPO 1 giờ, RTO 4 giờ (NFR-AVA-01, 02) chỉ cho tenant số 1 |
| NFR-TEN-04 | Khôi phục | Khôi phục, xuất và xóa theo từng tenant | Có biên bản thử theo lịch (FR-TEN-034) |
| NFR-TEN-05 | Cấp phát | Thời gian cấp phát một tenant mới và số bước thủ công | Từ xác minh đạt đến đăng nhập được: vài phút, 0 bước thủ công của nhân sự nền tảng cho ca không bị cờ; chỉ tiêu cụ thể `[Cần xác nhận]`, đo ở tenant thứ hai |
| NFR-TEN-06 | Quy mô | Số tenant và quy mô mỗi tenant thiết kế | `[Cần xác nhận: Chủ dự án, Q2]`; hiện chưa có số, chặn ADR 0002 |
| NFR-TEN-07 | Chống lạm dụng | Trần đăng ký mới mỗi giờ/ngày, tỷ lệ đăng ký bị cờ, thời gian duyệt tay tối đa, chi phí tối đa cho tenant chưa trả tiền | Con số `[Cần xác nhận: Chủ dự án, Q29]`; đo bằng kiểm thử tải đăng ký |
| NFR-TEN-08 | An ninh giữa tenant lạ | Kiểm thử xâm nhập có kịch bản "tenant độc hại tự đăng ký rồi thử đọc, ghi, đoán định danh tenant khác"; không rò rỉ chéo | Điều kiện mở đăng ký công khai (MT-1); bổ sung vào thử xâm nhập slice 1.12 |
| NFR-TEN-09 | Chính xác thương mại | Mức dùng và phí đối chiếu được với nguồn; không thu trùng, không thu sai kỳ; công thức giá và thuế có ví dụ kiểm thử do kế toán nền tảng xác nhận (như NFR-MNT-01) | Áp dụng từ B1 (MT-2) |

## 12. Tích hợp và chuyển đổi dữ liệu từ Excel

**Theo tenant (bản 0.4):** mọi nội dung nhập và chuyển đổi dưới đây thực hiện **riêng cho từng tenant**: lô nhập, lỗi, hoàn tác thuộc đúng tenant (FR-TEN-029); mẫu Excel chuẩn do nền tảng cung cấp, ánh xạ cột theo tenant; người phụ trách dữ liệu, quy tắc chuẩn hóa mã và số năm lịch sử cần chuyển do từng tenant quyết. Dữ liệu hiện có của khách đầu tiên trở thành tenant số 1 mà không đổi số chứng từ đã cấp (FR-TEN-031).

Phần khó nhất của chuyển đổi là chuẩn hóa mã phụ tùng và tồn đầu kỳ, vì khó khăn lớn nhất khi triển khai thường nằm ở dữ liệu kho chứ không ở khâu bán hàng ([Sapo](https://www.sapo.vn/blog/phan-mem-quan-ly-ban-hang-phu-tung-o-to)). Các mẫu Excel của khách chưa được xem, nên bảng dưới là khung chung cần đối chiếu với file thật.

### Tích hợp bên ngoài

| Hệ thống | Mục đích | Cách tích hợp | Giai đoạn |
| --- | --- | --- | --- |
| Nhà cung cấp hóa đơn điện tử | Phát hành, tra trạng thái hóa đơn | API qua lớp tích hợp thay được nhà cung cấp \[Cần xác nhận nhà cung cấp\]; **cấu hình theo tenant và Company** (nhà cung cấp, tài khoản, chứng thư số, mẫu số, ký hiệu riêng; không dùng chung, FR-TEN-021, RULE-024) | 1 |
| SMS hoặc Zalo | Gửi báo giá, tiến độ, nhắc bảo dưỡng | API của nhà cung cấp tin nhắn \[Cần xác nhận\]; cấu hình theo tenant (FR-TEN-021) | 1 |
| Email | Gửi báo giá, hóa đơn | Dịch vụ gửi thư | 1 |
| Máy in và mã vạch | In phiếu, quét mã phụ tùng | Trình duyệt, camera điện thoại | 1 |
| Phần mềm kế toán đang dùng | Kết xuất dữ liệu kế toán | Tệp theo định dạng chốt sau \[Cần xác nhận\] | 3 |
| Thanh toán QR hoặc ngân hàng | Đối chiếu chuyển khoản | Chưa chốt \[Cần xác nhận\] | 4 |

### Dữ liệu cần chuyển đổi

| Dữ liệu | Quy tắc làm sạch | Đối chiếu sau khi nhập |
| --- | --- | --- |
| Danh mục phụ tùng | Gộp mã trùng, chuẩn hóa tên và đơn vị, gắn nhóm và dòng xe | Số mã trước và sau nhập, mã bị gộp có danh sách |
| Tồn đầu kỳ theo chi nhánh và giá vốn | Kiểm kê thực tế cùng thời điểm chuyển đổi, không lấy số Excel làm số cuối | Giá trị tồn từng chi nhánh khớp biên bản kiểm kê |
| Khách và xe | Chuẩn hóa điện thoại và biển số, gộp khách trùng | Số khách, số xe trước và sau; mẫu ngẫu nhiên đối chiếu tay |
| Lịch sử sửa chữa | Chỉ nhập phần cần cho nhắc bảo dưỡng và tra cứu \[Cần xác nhận số năm\] | Mẫu lệnh gần đây khớp bản gốc |
| Công nợ phải thu, phải trả đầu kỳ | Theo đối tượng và chứng từ còn nợ | Tổng nợ từng đối tượng khớp sổ của kế toán |
| Nhân sự | Chỉ nhập dữ liệu cần thiết, không nhập dữ liệu thừa | Số người và chức danh theo từng chi nhánh |
| Danh mục dịch vụ, giờ chuẩn, bảng giá | Thống nhất tên hạng mục giữa các chi nhánh | Báo giá mẫu cho cùng một xe ra cùng kết quả như hiện nay |

### Các bước chuyển đổi

1. Thu thập file Excel thật của từng chi nhánh và các mẫu phiếu đang dùng.
2. Chốt mẫu nhập chuẩn (FR-SYS-007), lập bảng ánh xạ cột.
3. Làm sạch dữ liệu cùng người phụ trách từng chi nhánh.
4. Nhập thử trên môi trường thử, xem báo lỗi theo dòng, sửa và nhập lại.
5. Chạy song song với Excel ở chi nhánh pilot, đối chiếu số liệu hằng ngày.
6. Kiểm kê khởi tạo ngay trước ngày chuyển, nhập tồn đầu kỳ theo kết quả kiểm kê.
7. Chốt ngày chuyển; Excel cũ chuyển sang chế độ chỉ đọc và lưu trữ.

## 13. Tiêu chí nghiệm thu và độ ưu tiên

Một giai đoạn được nghiệm thu khi mọi FR Must của giai đoạn đó đạt kịch bản UAT tương ứng và pilot đạt các chỉ số ở mục 3 của BRD.

### Tổng hợp theo phân hệ

| Phân hệ | Must | Should | Could | Tổng | Giai đoạn theo BRD |
| --- | --- | --- | --- | --- | --- |
| REC Tiếp nhận và lệnh sửa chữa | 19 | 20 | 1 | 40 | 1 |
| INS Kiểm tra xe số | 0 | 8 | 1 | 9 | 1 |
| CRM Khách hàng và xe | 8 | 9 | 1 | 18 | 1 |
| INV Kho và phụ tùng | 19 | 13 | 1 | 33 | 1 và 2 |
| PUR Mua hàng | 0 | 11 | 1 | 12 | 2 |
| HRM Nhân sự và nhân công | 10 | 10 | 1 | 21 | 2 |
| ACC Doanh thu và kế toán | 16 | 7 | 1 | 24 | 2 và 3 |
| EIN Hóa đơn điện tử | 11 | 2 | 0 | 13 | 1 (cơ bản) và 3 |
| RPT Báo cáo và dashboard | 9 | 6 | 1 | 16 | 1 đến 4 |
| SYS Quản trị hệ thống | 13 | 7 | 0 | 20 | 1 (FR-SYS-033, 034 ở giai đoạn 2) |
| TEN Multi-tenant (bản 0.4) | 30 | 21 | 4 | 55 | 1 (MT-0, 15 FR); MT-1 đến MT-3 sau giai đoạn 1 |
| Tổng | 135 | 114 | 12 | 261 |  |

Ngày 07/11/2026 thêm 4 FR-REC Should (044 đến 047, cải tiến màn Lịch hẹn): REC từ 36 lên 40, tổng 257 lên 261, 10 phân hệ nghiệp vụ 202 lên 206 (Should 89 lên 93, TEN không đổi). Bản 0.5 (06/11/2026) thêm 20 FR giai đoạn 2: INV-030 đến 034, PUR-009 đến 012, HRM-017 đến 021, ACC-022, 026, 027, 028, SYS-033, 034 (9 Must, 11 Should); các hàng INV, PUR, HRM, ACC, SYS ở bảng trên đã cộng các FR này. Trong đó 202 FR của 10 phân hệ nghiệp vụ (105 Must, 89 Should, 8 Could) và 55 FR-TEN (đề xuất, chờ khách xác nhận; 06/11/2026 FR-TEN-017 nâng từ Could lên Must theo quyết định C-S14 của chủ dự án nên TEN còn 30 Must, 21 Should, 4 Could; tổng TEN 55 không đổi, và tổng toàn tài liệu 237 trước bản 0.5, 257 sau bản 0.5). Với TEN, Must nghĩa là cần trước khi mở đăng ký tự phục vụ cho người ngoài, không phải Must của pilot; chỉ 15 FR MT-0 là điều kiện của giai đoạn 1.

### Phạm vi giai đoạn 1 (pilot một chi nhánh)

- REC: toàn bộ FR Must.
- CRM: FR-CRM-001, 002, 004, 010, 011, 013.
- INV cơ bản: FR-INV-001, 002, 003, 005, 006, 007, 008, 019.
- EIN cơ bản: FR-EIN-001 đến 006 và 011.
- SYS: toàn bộ FR Must.
- RPT: FR-RPT-001, 003, 004, 011 ở mức một chi nhánh.

Điều chỉnh phạm vi giai đoạn 1 ở bản 0.2:

- Thêm FR Must bổ sung: FR-REC-023, 028, 030; FR-CRM-014, 017; FR-INV-020, 021; FR-SYS-011 đến 013; FR-RPT-012 đến 014 ở mức một chi nhánh.
- INS: đưa vào giai đoạn 1 nếu khách xác nhận cần kiểm tra xe số; các FR đều mức Should.
- PUR và FR-ACC-015, 018, 019 thuộc giai đoạn 2.

Bản 0.3 thêm vào giai đoạn 1: FR-REC-031, 032; FR-INV-025, 027; FR-SYS-018; FR-EIN-013 (phần phát hành cơ bản). FR-HRM-015 thuộc giai đoạn 2 cùng phần tính công. Các FR mức Should của bản 0.3 chưa xếp giai đoạn cho đến khi khách xác nhận nhu cầu.

### Phạm vi giai đoạn 1 bổ sung ở bản 0.4 (multi-tenant, đề xuất)

Quyết định 05/11/2026 (D1) đưa phần nền multi-tenant vào giai đoạn 1: **15 FR MT-0** gồm FR-TEN-001, 002, 003, 009, 010, 011, 013, 014, 016, 017 (thêm 06/11/2026), 018, 020, 021, 029, 031, cộng phần B0 của FR-TEN-028 (chỗ lưu gói và trạng thái thuê bao; gói mặc định là miễn phí, RULE-035). Khách đầu tiên là tenant số 1. Điều kiện nghiệm thu: UAT-TEN-01, 02, 05, 06, 07, 08, 09, 11 và UAT-TEN-21 phần (a) đạt và NFR-TEN-01 (kiểm thử và seed có từ hai tenant); riêng pilot có thêm: hồ sơ chấp thuận Điều khoản/DPA của tenant số 1 đã ghi nhận (Q38, FR-TEN-037 phần tối thiểu), công cụ xuất dữ liệu một tenant chạy được (FR-TEN-006 phần tối thiểu, chỉ xuất). Ở MT-0, FR-TEN-018 chạy hai tầng (tenant, chi nhánh); tầng nền tảng cùng FR-TEN-019 sang MT-1; UAT-TEN-08 kiểm ở mức tenant. Thứ tự giữa MT-1 (21 FR, mở đăng ký cho người ngoài) và pilot **đã chốt theo ủy quyền 06/11/2026 (Q37)**: MT-0 xong trước go-live, pilot đóng, MT-1 sau khi pilot ổn định, mở đăng ký hai nấc; MT-2 (14 FR) và MT-3 (5 FR) sau giai đoạn 1 nhưng thiết kế giai đoạn 1 không được chặn đường.

### Phạm vi giai đoạn 2 (bản 0.5, đề xuất BA theo ủy quyền của chủ dự án 06/11/2026, chờ khách xác nhận)

Giai đoạn 2 chạy sau khi pilot đạt cổng, **theo kiểu multi-tenant ngay từ đầu** (mọi "toàn chuỗi" hiểu là trong tenant). Thứ tự slice, phụ thuộc, màn hình, định nghĩa hoàn thành và brief giao dev nằm ở `docs/dev/phase-2-plan.md`; bảng dưới là phạm vi FR.

| Slice | FR trong phạm vi | Ghi chú |
| --- | --- | --- |
| 2.5 Phê duyệt đầy đủ (làm trước) | FR-SYS-004, 015, 033, 034 | Là điều kiện của INV-010, 012, PUR-002, ACC-018, HRM-010 |
| 2.1 Hợp nhất đa chi nhánh, dashboard chi nhánh và vùng | FR-RPT-002 (xếp hạng), 008, 010, 015 (phần không có công nợ), 016 (phần không cần kiểm kê); FR-SYS-014, 016 | Dashboard quản lý vùng cần quyết định vai trò QV (BRD §5, Q84) |
| 2.2 Chuyển kho liên chi nhánh, kho tổng | FR-INV-010, 013, 026, 030, 031, 032 | UAT-04 |
| 2.3a Kiểm kê | FR-INV-011, 012, 033; FR-RPT-005 (chênh lệch kiểm kê), RPT-016 (độ chính xác tồn) | UAT-05 |
| 2.3b Nghiệp vụ kho đặc biệt | FR-INV-016, 017, 022, 023, 018 và 028 (một lần xây); INV-024 (Could) nếu còn chỗ | |
| 2.4 Mua hàng và công nợ phải trả | FR-PUR-001 đến 012; FR-INV-004, 014, 015, 034; FR-ACC-007, 027; FR-RPT-007 (phải trả) | UAT-16; ACC-007 chuyển về đây vì cần phiếu nhập và đối chiếu ba bên |
| 2.6a Nhân công, lõi tính công | FR-HRM-001, 004, 005, 006, 007, 008, 015, 020 | UAT-11 cần ví dụ khách ký |
| 2.6b Kỳ công, hoa hồng, năng suất | FR-HRM-010, 017, 019, 003, 009, 021, 011, 018, 014, 016, 002, 012; FR-HRM-013 (Could) | FR-RPT-006 chỉ kiểm được "khớp bảng công" từ đây |
| 2.7 Công nợ phải thu, phân bổ thanh toán, chi tiền có duyệt, hoàn tiền | FR-ACC-006, 015, 016 (phần còn lại), 018, 019, 022, 026, 028; FR-RPT-007 (phải thu), RPT-015 (phần công nợ) | **Theo ủy quyền: ACC-006, 007, 016 vào giai đoạn 2** (BRD xếp ACC "2 và 3"); ACC-016 đã dựng sớm ở giai đoạn 1, liên kết hóa đơn điều chỉnh ở EIN-007 (giai đoạn 3); UAT-14 |
| 2.8 Thông báo, nhắc, lịch hẹn, bảo hành (chỉ cổng và nhà cung cấp giả) | FR-SYS-008; FR-CRM-003, 005, 006, 007, 008, 009, 012, 015, 016, 018; FR-REC-011, 018, 019, 020, 024, 027, 029, 034, 035, 036, 044, 045, 046, 047 | UAT-24, UAT-P2-12; gửi thật khi khách chọn nhà cung cấp (Q78) |
| 2.9 Đồng sơn và quy trình theo loại dịch vụ | FR-REC-033 | Bị chặn đến khi khảo sát xưởng (Q86) |
| Chưa xếp | FR-SYS-017 (API ngoài) | FRD §13 liệt kê ở giai đoạn 2 nhưng kế hoạch triển khai ghi giai đoạn 4; đề xuất sang giai đoạn 4 cho đến khi có hệ thống bên ngoài cần gọi (Q88) |

Quyết định theo ủy quyền 06/11/2026: đưa ACC-006, 007, 016 vào giai đoạn 2; thay đổi so với kế hoạch sơ bộ của điều phối (có lý do, chờ chủ dự án xác nhận): ACC-015 và ACC-019 chuyển từ 2.5 sang 2.7 (không phải điều kiện của slice khác, 2.5 giữ nhỏ để làm sớm); INV-004 sang 2.4 (đơn mua); INV-011, 012 là kiểm kê (mã INV-015 đến 018 không phải kiểm kê: là nhà cung cấp, hàng khách mang, vật tư tiêu hao, bán lẻ); RPT-005, 006, 007, 015, 016 theo slice nguồn dữ liệu; SYS-008 sang 2.8 (kênh gửi cần cổng).

### Kịch bản nghiệm thu giai đoạn 2 (UAT-P2, bản 0.5, đề xuất)

Mã `UAT-P2-xx` dùng tiền tố riêng để không đụng UAT-01 đến 26, UAT-27 đến 32 tạm của dev và UAT-TEN. Mọi kịch bản chạy trên **hai tenant trở lên** (NFR-TEN-01).

| Mã | Kịch bản | Điều kiện đạt | FR liên quan |
| --- | --- | --- | --- |
| UAT-P2-01 | Phê duyệt theo ma trận, chuyển cấp, ủy quyền | Vượt hạn mức chờ đúng cấp; quá T2 chuyển cấp trên và nhắc; ủy quyền hết hạn mất quyền; không ai tự duyệt yêu cầu của mình; hạn mức chưa cấu hình không cho qua | FR-SYS-004, 015, 033, 034 |
| UAT-P2-02 | Chuyển kho đủ vòng, có chênh lệch | Gửi: thực tế bên gửi giảm, đang vận chuyển tăng, khả dụng cả hai không tăng; nhận thiếu: phần lệch treo; xử lý được duyệt thì đóng; tổng thực tế cộng đang vận chuyển bảo toàn; gửi hai lần cùng khóa trừ một lần | FR-INV-010, 030, 032 (mở rộng UAT-04) |
| UAT-P2-03 | Kiểm kê có phát sinh trong lúc đếm | Chênh lệch tính trên tồn sổ sách tại thời điểm đếm; không chốt khi còn dòng chưa đếm; người đếm không tự duyệt; mã lệch lặp lại gắn cờ | FR-INV-011, 012, 033 (mở rộng UAT-05) |
| UAT-P2-04 | Mua gấp, đơn mua nhiều phiên bản, nhận nhiều lần | Mua gấp quá giá trị tự quyết bị chặn; hậu duyệt quá hạn thì chuyển cấp; phiên bản đã gửi không bị ghi đè; đơn còn mở đến khi nhận đủ | FR-PUR-003, 004, 005, 009, 010 |
| UAT-P2-05 | Đối chiếu ba bên và công nợ phải trả | Hai phiếu nhập một hóa đơn khớp theo tổng; lệch ngoài dung sai chặn ghi nợ; chi cho hai phiếu nhập phân bổ đúng; số dư nhà cung cấp khớp (mở rộng UAT-16) | FR-PUR-006, 011, FR-ACC-007, 027 |
| UAT-P2-06 | Công nợ phải thu, tuổi nợ, nhắc | Số dư các nhóm tuổi bằng tổng; lệnh thu đủ ra khỏi tuổi nợ; không nhắc khách chưa đồng ý nhận tin; báo cáo khớp công nợ từng khách | FR-ACC-006, 026, FR-RPT-007 |
| UAT-P2-07 | Khoản nhận trước và chi có hạn mức cộng dồn | Phần dư thành khoản nhận trước, bù đúng khách; hai khoản chi nhỏ cộng dồn vượt hạn mức thì khoản sau cần duyệt cấp trên (mở rộng UAT-14) | FR-ACC-015, 022, 028 |
| UAT-P2-08 | Hoa hồng theo thu tiền | Thu một phần chưa ghi; thu đủ ghi một dòng dù bấm hai lần; hoàn tiền sau đó tạo dòng đảo | FR-HRM-009, 021 |
| UAT-P2-09 | Kỳ công khóa, mở lại, nhập bù | Khóa trước ngày kết thúc kỳ bị chặn; kỳ khóa không sửa trực tiếp; mở lại cần chủ duyệt; nhập bù có nhãn và ngưỡng duyệt | FR-HRM-010, 017, 019 |
| UAT-P2-10 | Hợp nhất đa chi nhánh và quản lý vùng | Quản lý vùng chỉ thấy các chi nhánh thuộc phân công của mình (nhóm chi nhánh là bộ lọc trong phạm vi đó, nhóm chỉ giao một phần thì chỉ hiện phần giao nhau kèm nhãn; bản 0.6); xếp hạng tính trên cùng kỳ; tổng các chi nhánh bằng số toàn tenant; tenant khác không lẫn | FR-RPT-002, 010, FR-SYS-016 |
| UAT-P2-11 | Cô lập tenant cho phân hệ giai đoạn 2 | Tenant A không chọn được kho nhận, nhà cung cấp, người duyệt, nhân sự của tenant B; mã nhân viên, số phiếu trùng giữa hai tenant không xung đột; khóa chống trùng chứa tenant | FR-TEN-009, 010, 018, 020 (mở rộng UAT-TEN-05, 08) |
| UAT-P2-12 | Lịch hẹn: tab, hủy có lý do, dời lịch | Lịch chờ qua phút hẹn vào Trễ hẹn (châm chước mặc định 0) và rời khi Đã đến, Vắng, Hủy, Dời; bộ đếm khớp; hủy bắt buộc lý do từ danh mục, "Khác" cần ghi chú từ 3 ký tự; dời giữ mã lịch, có lịch sử và nhật ký, kiểm công suất ngày mới, một lần dù bấm đôi, xung đột phiên bản bị chặn; ngày ở mọi thông báo dạng dd/MM/yyyy; tenant khác không thấy danh mục hay lịch sử | FR-REC-019, 027, 044, 045, 046, 047 |

### Kịch bản nghiệm thu (UAT)

| Mã | Kịch bản | Điều kiện đạt | FR liên quan |
| --- | --- | --- | --- |
| UAT-01 | Một xe đi từ nhận xe đến giao xe có hóa đơn | Số liệu công, phụ tùng, tiền, hóa đơn khớp nhau trên báo cáo đối chiếu | REC, INV, ACC, EIN |
| UAT-02 | Chặn xuất kho không chứng từ | Không tạo được phiếu xuất ngoài lệnh, phiếu bán lẻ hoặc phiếu điều chuyển | FR-INV-006 |
| UAT-03 | Hạng mục phát sinh | Thợ không bắt đầu được khi khách chưa duyệt; có bằng chứng duyệt | FR-REC-014 |
| UAT-04 | Chuyển kho có chênh lệch | Có hàng đang đi đường, biên bản và duyệt xử lý | FR-INV-010 |
| UAT-05 | Kiểm kê và điều chỉnh | Chênh lệch tính đúng; tồn đổi sau khi duyệt | FR-INV-011, 012 |
| UAT-06 | Phân quyền theo chi nhánh | Tài khoản chi nhánh A không thấy dữ liệu chi nhánh B ở danh sách, tìm kiếm, báo cáo; **chạy trên hai tenant trở lên (NFR-TEN-01)** | FR-SYS-002, FR-TEN-009 |
| UAT-07 | Chốt ngày | Không chốt khi còn chênh lệch chưa giải trình; sửa trực tiếp ngày đã khóa bị chặn | FR-ACC-004 |
| UAT-08 | Hóa đơn điều chỉnh | Cần kế toán trưởng duyệt, liên kết hóa đơn gốc | FR-EIN-007 |
| UAT-09 | Đổi thuế suất theo ngày hiệu lực | Lệnh sau ngày hiệu lực áp mức mới, không sửa mã nguồn | FR-ACC-009 |
| UAT-10 | Quyền của chủ dữ liệu | Ghi đồng ý, rút đồng ý, xử lý yêu cầu xóa có nhật ký | FR-CRM-010, 011 |
| UAT-11 | Tính công theo quy tắc khách chốt | Kết quả khớp các ví dụ do khách cung cấp | FR-HRM-006 |
| UAT-12 | Nhập dữ liệu từ Excel | Báo lỗi theo dòng, không ghi một phần, hoàn tác theo lô | FR-SYS-007 |

### Kịch bản nghiệm thu bổ sung ở bản 0.2

| Mã | Kịch bản | Điều kiện đạt | FR liên quan |
| --- | --- | --- | --- |
| UAT-13 | Giữ chỗ và tồn khả dụng | Tồn thực tế 20, giữ chỗ 5 thì lệnh khác thấy 15; hủy lệnh thì nhả giữ chỗ | FR-INV-020 |
| UAT-14 | Phân bổ thanh toán | Một khoản trả cho ba hóa đơn và một hóa đơn trả hai lần đều khớp tổng | FR-ACC-015 |
| UAT-15 | Từ kiểm tra xe số đến báo giá | Hạng mục vàng và đỏ thành dòng báo giá bằng một thao tác; hạng mục xanh không | FR-INS-003, 005 |
| UAT-16 | Đơn mua nhận nhiều lần | Đơn còn mở đến khi nhận đủ; công nợ phải trả tăng theo từng phiếu nhập | FR-PUR-005, 006 |
| UAT-17 | Báo giá duyệt một phần | Ví dụ báo giá 4.550.000 đồng: duyệt 2.050.000, má phanh vào danh sách hạng mục bị từ chối, phiên bản ghi đủ | FR-REC-023, 024 |
| UAT-18 | Đổi chủ xe | Lịch sử giữ nguyên; chủ hiện tại là bản ghi sở hữu còn hiệu lực | FR-CRM-014 |
| UAT-19 | Một người nhiều vai trò | Người kiêm thủ kho và thu ngân có đủ quyền hai vai trò, không hơn | FR-SYS-012 |
| UAT-20 | Quyền xuất dữ liệu | Không có quyền thì không tải được danh sách khách | FR-CRM-017 |

| Mã | Kịch bản (bản 0.3) | Điều kiện đạt | FR liên quan |
| --- | --- | --- | --- |
| UAT-21 | Đồng sơn theo công đoạn | Mỗi xe đồng sơn hiện công đoạn, người phụ trách, ngày dự kiến; dịch vụ khác dùng bộ bước khác | FR-REC-032, 033 |
| UAT-22 | Giá niêm yết và hạn mức giảm | Giảm vượt hạn mức bị chặn đến khi được duyệt; đổi bảng giá không đổi báo giá đã gửi | FR-INV-025, FR-REC-031 |
| UAT-23 | Chống phát hành trùng hóa đơn | Bấm hai lần hoặc timeout rồi thử lại chỉ cho một hóa đơn | FR-EIN-013 |
| UAT-24 | Bảo hành chéo chi nhánh | Chi nhánh khác mở lệnh bảo hành gắn lệnh gốc và thấy điều kiện bảo hành | FR-REC-036 |
| UAT-25 | Giá vốn bình quân | Nhập 10 cái giá 100.000 và 20 cái giá 120.000 cho khoảng 113.333 đồng | FR-INV-027 |
| UAT-26 | Hạn mức công nợ doanh nghiệp | Vượt hạn mức hiện cảnh báo; khách doanh nghiệp liệt kê đúng xe | FR-ACC-020, FR-CRM-018 |

### Kịch bản nghiệm thu multi-tenant (UAT-TEN, bản 0.4, đề xuất)

22 kịch bản. Mã `UAT-TEN-xx` dùng tiền tố riêng để không đụng UAT-01 đến 26 và mã tạm UAT-27 đến 31 của dev. Chi tiết từng bước nằm ở `docs/multi-tenant-analysis.md` mục 16 và AC-S01 đến S41 ở `docs/ui-ux/tenant-signup-simplified.md`.

| Mã | Kịch bản | Điều kiện đạt | FR liên quan | Đợt |
| --- | --- | --- | --- | --- |
| UAT-TEN-01 | Cấp phát và kích hoạt tenant mới | Cấp phát lặp không tạo trùng; lỗi giữa chừng thử lại được; thiếu mục kích hoạt thì chặn; hóa đơn thật bị chặn khi chưa đủ điều kiện | FR-TEN-001, 002, 004, 030, 037 | MT-0, MT-1 |
| UAT-TEN-02 | Đổi trạng thái vòng đời | Chuyển trái quy tắc bị chặn; thiếu lý do hoặc người duyệt bị từ chối; có nhật ký nền tảng; mở lại trong hạn | FR-TEN-003, 008, 013 | MT-0 |
| UAT-TEN-03 | Hạn chế và tạm ngưng | Lệnh đang mở vẫn thu tiền, giao xe; chỉ đọc vẫn tải được hóa đơn; dữ liệu không đổi | FR-TEN-005, 025 | MT-1 |
| UAT-TEN-04 | Chấm dứt, gói xuất, xóa | Gói khớp số bản ghi và mã toàn vẹn; chưa có chính sách thì không xóa; giữ pháp lý chặn xóa; có chứng nhận xóa | FR-TEN-006, 007 | MT-1 |
| UAT-TEN-05 | Cô lập giữa tenant | Tenant A không thấy dữ liệu tenant B ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp, thông báo; sửa tham số không vượt được | FR-TEN-009, 010, 014 | MT-0 |
| UAT-TEN-06 | Quyền nền tảng và hỗ trợ | Nhân sự nền tảng không xem dữ liệu nghiệp vụ ngoài phiên hỗ trợ; phiên hết hạn tự đóng; báo cáo nền tảng không có bản ghi nghiệp vụ | FR-TEN-011, 012, 033, 038 | MT-0 |
| UAT-TEN-07 | Người dùng và đăng nhập đa tenant | Cùng email ở hai tenant: một danh tính, chọn đúng tenant sau mật khẩu; mã nhân viên trùng giữa hai tenant không gây nhầm (mã không dùng để đăng nhập); lỗi trung lập; thu hồi ở A không ảnh hưởng B; đổi mật khẩu áp cho cả danh tính và thu hồi mọi phiên; chấp nhận lời mời vào tư cách thêm ghi đồng ý quy định của tenant mời, chưa đồng ý thì tư cách chưa vào được dữ liệu; tenant A không thấy email còn thuộc tenant khác | FR-TEN-016, 017 | MT-0 |
| UAT-TEN-08 | Cấu hình và đánh số theo tenant | Hai tenant phát hành cùng số đầu tiên không xung đột; đổi thuế suất áp theo hiệu lực, chứng từ cũ không đổi | FR-TEN-018, 019, 020 | MT-0 |
| UAT-TEN-09 | Tích hợp, mẫu in, thương hiệu theo tenant | Hóa đơn mang đúng đơn vị phát hành; không dùng bí mật tenant khác; mẫu thiếu trường bắt buộc bị chặn | FR-TEN-021, 022 | MT-0 |
| UAT-TEN-10 | Gói, hạn mức, module | Cảnh báo theo ngưỡng; vượt thì chặn tạo mới nhưng không chặn hoàn tất; tắt module thì ẩn và chặn API | FR-TEN-024 đến 028 | MT-2 |
| UAT-TEN-11 | Nhập Excel và chuyển tenant số 1 | Lô tách theo tenant; số bản ghi và tổng tiền trước sau khớp; không đổi số chứng từ; không hóa đơn trùng | FR-TEN-029, 031 | MT-0 |
| UAT-TEN-12 | Khôi phục, tải đa tenant, sự cố dữ liệu | Khôi phục một tenant không ảnh hưởng tenant khác; một tenant tải nặng không làm tenant khác vượt NFR; hồ sơ sự cố đúng tenant | FR-TEN-015, 034, 036 | MT-1 |
| UAT-TEN-13 | Tự đăng ký và xác minh | Gửi lại không tạo trùng; chưa xác thực email không đi tiếp; MST sai không qua; MST trùng vào hàng chờ; chưa chấp nhận điều khoản thì không nhập dữ liệu thật; từ chối có lý do | FR-TEN-037, 039, 040 | MT-1 |
| UAT-TEN-14 | Chống lạm dụng và tenant độc hại | Đăng ký dồn dập bị chặn; email dùng một lần bị từ chối; tenant bị cờ không phát hành hóa đơn thật; tenant mới thử đọc, ghi, tìm, tải dữ liệu tenant khác đều thất bại | FR-TEN-041, 015, 009, 010 | MT-1 |
| UAT-TEN-15 | Cấp phát tự động và onboarding | Không cần nhân sự nền tảng cho ca không bị cờ; cấp phát lặp không tạo trùng; thoát và vào lại đúng bước; thiếu bước bắt buộc không `active`; đạt NFR-TEN-05 | FR-TEN-004, 042, 043, 052 | MT-1 |
| UAT-TEN-16 | Gói mặc định miễn phí, không đồng hồ (viết lại 06/11/2026, thay "Hết hạn dùng thử") | Tenant mới không gán gói: không có ngày hết hạn, đếm ngược hay chữ "dùng thử" ở màn, email, API; không bị hạn chế vì thời gian; không phát sinh hóa đơn nền tảng; chọn gói trả phí chỉ khi chủ động; về sau nợ phí không xóa dữ liệu, lệnh đang mở vẫn hoàn tất, tải được hóa đơn | FR-TEN-044 | MT-0 (mặc định), MT-2 |
| UAT-TEN-17 | Nâng/hạ gói và feature flag | Nâng hiệu lực ngay; hạ hiệu lực kỳ sau và bị chặn hoặc cảnh báo khi vượt hạn mức; flag bật cho A không ảnh hưởng B | FR-TEN-045, 046, 025, 026 | MT-2 |
| UAT-TEN-18 | Thanh toán, hóa đơn nền tảng, nợ phí | Không thu hai lần; đối soát khớp; hóa đơn nền tảng tách khỏi hóa đơn tenant, không trùng; quá hạn đi theo thang, không chặn hoàn tất chứng từ đang mở; trả nợ tự mở lại | FR-TEN-047, 048, 049 | MT-3 |
| UAT-TEN-19 | Hỗ trợ tự phục vụ và SLA | Yêu cầu của tenant A không hiện ở B; hàng chờ nền tảng không có bản ghi nghiệp vụ; SLA đúng | FR-TEN-050 | MT-2 |
| UAT-TEN-20 | Một chi nhánh một kho, ẩn UI theo số lượng | Tenant mới có đúng 1 Company, 1 chi nhánh, 1 kho; không thấy bộ chọn chi nhánh; mọi bản ghi có `branch_id`; thêm chi nhánh thứ hai thì UI nhiều chi nhánh hiện; kiểm thử cô lập vẫn đạt | FR-TEN-051, 042 | MT-1 |
| UAT-TEN-21 | Đăng nhập email + mật khẩu, liên kết xác thực một lần | Không ô Mã công ty; sai email, sai mật khẩu, tenant đã chấm dứt cùng một câu; email thuộc hai công ty thì chỉ sau mật khẩu đúng mới "Chọn công ty"; liên kết mở ở trình duyệt khác vẫn đăng nhập, dùng lại hoặc hết hạn thì không tạo phiên; email đã có tài khoản không đổi mật khẩu cũ | FR-TEN-016, 039, 053 | MT-0 phần (a): email + mật khẩu, lỗi và thời gian phản hồi trung lập, chọn công ty sau mật khẩu, email có sẵn không đổi mật khẩu cũ; MT-1 phần (b): liên kết xác thực một lần |
| UAT-TEN-22 | Kênh hỗ trợ và tên thương hiệu cấu hình | Khối hỗ trợ có mặt ở các màn nêu, lấy từ cấu hình; cấu hình rỗng vẫn hiện kênh dự phòng và cảnh báo; chuỗi tên sản phẩm lấy từ một cấu hình | FR-TEN-054, 055 | MT-1 |

### Ma trận truy vết yêu cầu

Ma trận nối yêu cầu nghiệp vụ trong BRD với yêu cầu chức năng và kịch bản nghiệm thu, làm cơ sở viết test case; từng FR còn ghi BR cụ thể ở cột cuối của bảng module.

| Nhóm | BR (BRD) | FR | UAT |
| --- | --- | --- | --- |
| REC | BR-REC-01 đến 14 | FR-REC-001 đến 036, 044 đến 047 (037 đến 043 giữ chỗ) | UAT-01, 03, 17, UAT-P2-12 |
| INS | BR-INS-01 | FR-INS-001 đến 009 | UAT-15 |
| CRM | BR-CRM-01 đến 07 | FR-CRM-001 đến 018 | UAT-10, 18, 20 |
| INV | BR-INV-01 đến 16 | FR-INV-001 đến 028, 030 đến 034 | UAT-02, 04, 05, 13, 25; UAT-P2-02, 03, 11 |
| PUR | BR-PUR-01 | FR-PUR-001 đến 012 | UAT-16; UAT-P2-04, 05 |
| HRM | BR-HRM-01 đến 06 | FR-HRM-001 đến 021 | UAT-11; UAT-P2-08, 09 |
| ACC | BR-ACC-01 đến 13 | FR-ACC-001 đến 020, 022, 026, 027, 028 | UAT-07, 09, 14, 26; UAT-P2-05, 06, 07 |
| EIN | BR-EIN-01 đến 05 | FR-EIN-001 đến 013 | UAT-01, 08 |
| RPT | BR-RPT-01 đến 04 | FR-RPT-001 đến 016 | UAT-01 |
| SYS | BR-SYS-01 đến 07 | FR-SYS-001 đến 018, 033, 034 | UAT-06, 12, 19; UAT-P2-01, 10 |
| TEN (nền) | BR-TEN-01 đến 04, 05, 07 | FR-TEN-001 đến 003, 009, 010, 011, 013, 014, 016, 017, 018, 020, 021, 029, 031 (và giá trị mặc định miễn phí của 044) | UAT-TEN-01, 02, 05, 06, 07, 08, 09, 11 |
| TEN (đăng ký tự phục vụ, MT-1) | BR-TEN-05, 07, 09, 11 | FR-TEN-004 đến 007, 012, 015, 019, 030, 034, 036, 037, 039 đến 043, 051 đến 055 | UAT-TEN-03, 04, 12 đến 15, 20 đến 22 |
| TEN (gói và thu tiền, MT-2 và MT-3) | BR-TEN-06, 08, 10 | FR-TEN-008, 022 đến 028, 032, 033, 035, 038, 044 đến 050 | UAT-TEN-10, 16 đến 19 |

## 14. Nguồn tham khảo

Tra cứu ngày 30/10/2026; nội dung dựa trên kết quả tìm kiếm, cần đối chiếu nguồn gốc trước khi dùng làm căn cứ pháp lý. Danh sách đầy đủ nằm trong tài liệu BRD, mục 11; dưới đây là các nguồn dùng trực tiếp cho tài liệu này.

- [Thuế MAN, Nghị định 254/2026/NĐ-CP](https://thue.man.net.vn/nghi-dinh-254-2026/)
- [Kế toán Bách Khoa, điểm mới Nghị định 254/2026](https://ketoanbachkhoa.vn/diem-moi-nghi-dinh-254-2026-nd-cp/)
- [MISA meInvoice, tài liệu tích hợp](https://doc.meinvoice.vn/about)
- [MISA meInvoice, các phần mềm tích hợp và phí tích hợp](https://www.meinvoice.vn/?p=9621)
- [Sapo, phần mềm quản lý bán hàng phụ tùng ô tô](https://www.sapo.vn/blog/phan-mem-quan-ly-ban-hang-phu-tung-o-to)
- [Kế toán Anpha, quy định đăng kiểm 2026 theo Thông tư 30/2026/TT-BXD](https://ketoananpha.vn/quy-dinh-dang-kiem-xe-o-to.html)
- [PwC, Nghị định 356/2025 về bảo vệ dữ liệu cá nhân](https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html)
- [KPMG, điểm nổi bật Thông tư 99/2025](https://kpmg.com/vn/vi/home/phan-tich-chuyen-sau/2025/11/key-changes-in-vietnamese-accounting-system-for-enterprises.html)

Nguồn bổ sung ở bản 0.2:

- [Tekmetric, 7 tính năng của kiểm tra xe số](https://tours.tekmetric.com/answers/digital-vehicle-inspection-software-7-features-to-look-for)
- [Tekmetric, thực hiện kiểm tra xe số](https://tours.tekmetric.com/answers/performing-an-inspection-tekmetric)
- [Tekmetric Multi-Shop, quản lý tập trung](https://tours.tekmetric.com/answers/how-to-manage-multiple-auto-repair-shops-with-tekmetric-multi-shop)
- [Shopmonkey HQ, chuyển kho](https://support.shopmonkey.io/hc/en-us/articles/42720891279508-Shopmonkey-HQ-Inventory-Transfers)
- [Mitchell 1, Time Manager](https://mitchell1.com/press/mitchell-1-manager-se-adds-new-time-management-features/)
- [MISA eShop, Thông tư 91/2026/TT-BTC](https://www.misaeshop.vn/44493/thong-tu-91-2026-tt-btc-huong-dan-nghi-dinh-254-2026-nd-cp/)
- [LSVN, trường hợp xử lý dữ liệu không cần đồng ý](https://lsvn.vn/cac-truong-hop-xu-ly-du-lieu-ca-nhan-khong-can-su-dong-y-cua-chu-the-tu-01-01-2026-a167690.html)
