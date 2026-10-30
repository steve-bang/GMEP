# Garage ERP – Functional Requirements (FRD)

Oct 30, 2026 · @Sang PHAM

## 1. Giới thiệu, phạm vi và quy ước

Tài liệu này đặc tả 182 yêu cầu chức năng (FR) cho 10 phân hệ của Garage ERP, trong đó 96 mức Must, 78 mức Should và 8 mức Could; gồm 113 yêu cầu ban đầu, 53 yêu cầu bổ sung ở bản 0.2 và 16 yêu cầu ở bản 0.3 từ câu trả lời Discovery của khách. Mỗi FR trỏ về một yêu cầu nghiệp vụ (BR) trong tài liệu BRD và có tiêu chí nghiệm thu kiểm tra được; luồng nghiệp vụ và trạng thái nằm trong tài liệu User Journey và Business Workflow.

### Quy ước

| Quy ước | Ý nghĩa |
| --- | --- |
| FR-REC-001 | Mã yêu cầu: FR, mã phân hệ (REC, INS, CRM, INV, PUR, HRM, ACC, EIN, RPT, SYS), số thứ tự |
| Must, Should, Could | Mức ưu tiên MoSCoW; Must là điều kiện để nghiệm thu giai đoạn chứa nó |
| BR | Mã yêu cầu nghiệp vụ trong BRD mà FR thực hiện |
| \[Cần xác nhận\] | Nội dung phụ thuộc quyết định của khách hoặc xác nhận của kế toán, luật sư |
| Chi nhánh | Một cửa hàng; dữ liệu nghiệp vụ luôn gắn với một chi nhánh |
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
- Quản trị hệ thống cấu hình được nhưng không xem được dữ liệu nghiệp vụ nhạy cảm của khách, vì luật bảo vệ dữ liệu cá nhân yêu cầu hạn chế truy cập theo nhu cầu.
- Quản lý chi nhánh chỉ tạo và sửa người dùng trong chi nhánh của mình; người dùng thuộc vai trò cao hơn do chủ garage hoặc quản trị hệ thống tạo.

### Bổ sung ở bản 0.2

- Một tài khoản có thể gán nhiều vai trò; quyền là phần hợp của các vai trò theo từng chi nhánh (FR-SYS-012). Người kiêm thủ kho và thu ngân có đủ quyền hai vai trò và không hơn.
- Quyền chia theo hành động: xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất dữ liệu, quản lý (FR-SYS-013). Ví dụ thủ kho được tạo phiếu xuất nhưng không tự duyệt phiếu xuất bất thường; không có quyền xuất thì không tải được danh sách khách.
- Hai chức năng mới theo cùng quy ước ký hiệu: kiểm tra xe số do quản đốc và thợ thực hiện (S), quản lý chi nhánh, cố vấn, chủ garage và quản lý vùng xem (X); mua hàng do nhân viên mua hàng và thủ kho tạo (S), quản lý chi nhánh duyệt (D), kế toán xem (X).
- Nhân viên mua hàng, nhân sự và nhân viên kiểm tra chất lượng là vai trò bổ sung của bản 0.2, cấu hình như các vai trò khác.

## 3. FR: Tiếp nhận và lệnh sửa chữa (REC)

36 yêu cầu: 19 Must, 16 Should, 1 Could, gồm 22 yêu cầu ban đầu, 8 yêu cầu ở bản 0.2 (FR-REC-023 đến 030) và 6 yêu cầu ở bản 0.3 (FR-REC-031 đến 036); phân hệ kiểm tra xe số INS nằm ở cuối mục này.

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
| FR-REC-019 | Lịch hẹn theo ngày giờ, hiện công suất xưởng theo số xe mỗi ngày | Should | Đặt hẹn vượt công suất cấu hình thì cảnh báo | BR-REC-09 |
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
| FR-REC-027 | Lịch hẹn: xem theo ngày hoặc tuần, trạng thái lịch (chờ, đã đến, hủy, vắng), phân cố vấn tiếp nhận; tiếp nhận xe không hẹn trước | Should | Lịch hẹn đã đến chuyển thành hồ sơ tiếp nhận; xe vãng lai tạo hồ sơ không cần lịch | BR-REC-09 |
| FR-REC-028 | Trạng thái riêng cho báo giá, lệnh, hạng mục, thanh toán, hóa đơn; đổi trạng thái hạng mục không làm lệnh chuyển trái quy tắc | Must | Có lệnh đang sửa với một hạng mục hoàn thành, một hạng mục chưa làm và thanh toán chưa thu | BR-REC-05 |
| FR-REC-029 | Hạng mục có độ ưu tiên, checklist con, bình luận nội bộ, chuyển người phụ trách | Should | Thợ và quản đốc trao đổi trong hạng mục; chuyển người được ghi nhận | BR-REC-06 |
| FR-REC-030 | Sinh mã lệnh duy nhất theo chi nhánh và thời gian | Must | Không có hai lệnh trùng mã trên toàn hệ thống | BR-REC-05 |

### FR-REC bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-REC-031 | Báo giá lưu phiên bản giá tại thời điểm gửi; đổi bảng giá không làm đổi báo giá đã gửi | Must | Cập nhật bảng giá sau khi gửi thì báo giá cũ giữ giá cũ, báo giá mới dùng giá mới | BR-REC-12 |
| FR-REC-032 | Quy trình theo loại dịch vụ cấu hình được: bộ bước, trạng thái hạng mục, người phụ trách | Must | Hai loại dịch vụ có hai bộ bước khác nhau trên cùng một lệnh | BR-REC-13 |
| FR-REC-033 | Luồng đồng sơn theo công đoạn: xem xe ở công đoạn nào, người phụ trách, ngày dự kiến hoàn thành \[Cần khảo sát xưởng\] | Should | Bảng đồng sơn hiện công đoạn, người phụ trách và ngày dự kiến của từng xe | BR-REC-14 |
| FR-REC-034 | Gửi liên kết duyệt báo giá qua Zalo hoặc SMS; hiển thị hạng mục, phụ tùng, công, thuế, tổng tiền, ảnh và video \[Cần chọn nhà cung cấp\] | Should | Khách mở liên kết trên điện thoại và duyệt từng hạng mục; kênh duyệt được lưu | BR-REC-03 |
| FR-REC-035 | Đặt lịch trực tuyến: khách chọn chi nhánh, dịch vụ, khung giờ; nhân viên xác nhận | Should | Lịch chờ xác nhận hiện ở lịch chi nhánh; xác nhận gửi thông báo cho khách | BR-REC-09 |
| FR-REC-036 | Bảo hành chéo chi nhánh: chi nhánh tiếp nhận tra lịch sử sửa chữa và điều kiện bảo hành của chi nhánh gốc | Should | Mở được lệnh bảo hành gắn với lệnh gốc ở chi nhánh khác | BR-REC-08 |

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

28 yêu cầu: 16 Must, 11 Should, 1 Could, gồm 19 yêu cầu ban đầu, 5 yêu cầu ở bản 0.2 (FR-INV-020 đến 024) và 4 yêu cầu ở bản 0.3 (FR-INV-025 đến 028); phân hệ mua hàng PUR nằm ở cuối mục này.

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

### FR-PUR: Mua hàng

8 yêu cầu: 7 Should, 1 Could. Mức Should vì quy trình mua hàng của khách chưa được xác nhận \[Cần xác nhận\]; FR-INV-004 và FR-INV-015 vẫn là phần đơn mua và nhà cung cấp ở mức cơ bản.

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

## 6. FR: Nhân sự và nhân công (HRM)

16 yêu cầu: 8 Must, 7 Should, 1 Could, gồm 12 yêu cầu ban đầu, 2 yêu cầu ở bản 0.2 (FR-HRM-013, 014) và 2 yêu cầu ở bản 0.3 (FR-HRM-015, 016). Hệ thống cung cấp dữ liệu công và hoa hồng, không thay phần mềm tính lương và bảo hiểm.

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

## 7. FR: Doanh thu, kế toán và công nợ (ACC)

20 yêu cầu: 13 Must, 6 Should, 1 Could, gồm 14 yêu cầu ban đầu, 5 yêu cầu ở bản 0.2 (FR-ACC-015 đến 019) và 1 yêu cầu ở bản 0.3 (FR-ACC-020). Hệ thống làm kế toán vận hành và hạch toán tự động; báo cáo tài chính và khai thuế do kế toán thực hiện trên phần mềm kế toán của khách \[Cần xác nhận\].

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
| FR-RPT-002 | So sánh chi nhánh theo chỉ số được chọn | Must | Bảng xếp hạng đúng thứ tự, tính trên cùng kỳ | BR-RPT-01 |
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

## 10. FR: Quản trị hệ thống, đa chi nhánh, nhật ký (SYS)

18 yêu cầu: 12 Must, 6 Should, gồm 10 yêu cầu ban đầu, 7 yêu cầu ở bản 0.2 (FR-SYS-011 đến 017) và 1 yêu cầu ở bản 0.3 (FR-SYS-018).

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
| FR-SYS-014 | Lịch sử đăng nhập của người dùng | Should | Xem được thời điểm, thiết bị, kết quả mỗi lần đăng nhập | BR-SYS-02 |
| FR-SYS-015 | Chuyển cấp và nhắc việc khi phê duyệt quá hạn | Should | Quá hạn cấu hình thì yêu cầu chuyển cấp trên và người duyệt nhận nhắc | BR-SYS-07 |
| FR-SYS-016 | Danh mục dùng chung tạo ở trụ sở và phát hành cho chi nhánh được chọn: mẫu kiểm tra, dịch vụ mẫu, giảm giá, hình thức thanh toán | Should | Thay đổi ở trụ sở áp dụng cho chi nhánh được chọn mà không sửa từng nơi | BR-SYS-01 |
| FR-SYS-017 | API cho hệ thống bên ngoài, có xác thực và giới hạn theo quyền | Should | Có tài liệu API, khóa riêng cho từng hệ thống, nhật ký gọi | BR-SYS-06 |

### FR-SYS bổ sung ở bản 0.3

| Mã | Yêu cầu chức năng | Ưu tiên | Tiêu chí nghiệm thu | BR |
| --- | --- | --- | --- | --- |
| FR-SYS-018 | Cấu trúc Company, Branch, Warehouse; mở rộng sang nhiều pháp nhân, mỗi pháp nhân có đơn vị phát hành hóa đơn riêng | Must | Thêm pháp nhân thứ hai không phải đổi cấu trúc dữ liệu; mỗi chi nhánh thuộc đúng một pháp nhân tại một thời điểm | BR-SYS-01 |

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
| NFR-ISO-01 | Phân tách dữ liệu | Dữ liệu chi nhánh tách theo phạm vi quyền ở cả danh sách, tìm kiếm, báo cáo, xuất dữ liệu và API | Kiểm tra bằng UAT-06 |

### Bổ sung ở bản 0.3 (từ câu trả lời Discovery)

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-SCL-01 | Quy mô thiết kế | Thiết kế cho 20 chi nhánh, 500 đến 800 xe mỗi ngày và 250 đến 300 người dùng sau 2 năm | Khách ước tính, cần xác nhận số thực tế |
| NFR-SCL-02 | Đo tải | Ngoài người dùng đồng thời, đo số lệnh mỗi ngày, dòng phụ tùng mỗi lệnh, giao dịch kho mỗi ngày và số năm lưu trữ | Chốt sau Discovery |
| NFR-OFF-01 | Mất mạng | Cảnh báo mất mạng và lưu nháp; offline đầy đủ là phạm vi riêng | Chốt sau |
| NFR-PRT-01 | In ấn | In báo giá, lệnh sửa chữa, hóa đơn hoặc phiếu giao nhận theo mẫu | Mẫu và máy in chốt sau |

## 12. Tích hợp và chuyển đổi dữ liệu từ Excel

Phần khó nhất của chuyển đổi là chuẩn hóa mã phụ tùng và tồn đầu kỳ, vì khó khăn lớn nhất khi triển khai thường nằm ở dữ liệu kho chứ không ở khâu bán hàng ([Sapo](https://www.sapo.vn/blog/phan-mem-quan-ly-ban-hang-phu-tung-o-to)). Các mẫu Excel của khách chưa được xem, nên bảng dưới là khung chung cần đối chiếu với file thật.

### Tích hợp bên ngoài

| Hệ thống | Mục đích | Cách tích hợp | Giai đoạn |
| --- | --- | --- | --- |
| Nhà cung cấp hóa đơn điện tử | Phát hành, tra trạng thái hóa đơn | API qua lớp tích hợp thay được nhà cung cấp \[Cần xác nhận nhà cung cấp\] | 1 |
| SMS hoặc Zalo | Gửi báo giá, tiến độ, nhắc bảo dưỡng | API của nhà cung cấp tin nhắn \[Cần xác nhận\] | 1 |
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
| REC Tiếp nhận và lệnh sửa chữa | 19 | 16 | 1 | 36 | 1 |
| INS Kiểm tra xe số | 0 | 8 | 1 | 9 | 1 |
| CRM Khách hàng và xe | 8 | 9 | 1 | 18 | 1 |
| INV Kho và phụ tùng | 16 | 11 | 1 | 28 | 1 và 2 |
| PUR Mua hàng | 0 | 7 | 1 | 8 | 2 |
| HRM Nhân sự và nhân công | 8 | 7 | 1 | 16 | 2 |
| ACC Doanh thu và kế toán | 13 | 6 | 1 | 20 | 2 và 3 |
| EIN Hóa đơn điện tử | 11 | 2 | 0 | 13 | 1 (cơ bản) và 3 |
| RPT Báo cáo và dashboard | 9 | 6 | 1 | 16 | 1 đến 4 |
| SYS Quản trị hệ thống | 12 | 6 | 0 | 18 | 1 |
| Tổng | 96 | 78 | 8 | 182 |  |

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

### Kịch bản nghiệm thu (UAT)

| Mã | Kịch bản | Điều kiện đạt | FR liên quan |
| --- | --- | --- | --- |
| UAT-01 | Một xe đi từ nhận xe đến giao xe có hóa đơn | Số liệu công, phụ tùng, tiền, hóa đơn khớp nhau trên báo cáo đối chiếu | REC, INV, ACC, EIN |
| UAT-02 | Chặn xuất kho không chứng từ | Không tạo được phiếu xuất ngoài lệnh, phiếu bán lẻ hoặc phiếu điều chuyển | FR-INV-006 |
| UAT-03 | Hạng mục phát sinh | Thợ không bắt đầu được khi khách chưa duyệt; có bằng chứng duyệt | FR-REC-014 |
| UAT-04 | Chuyển kho có chênh lệch | Có hàng đang đi đường, biên bản và duyệt xử lý | FR-INV-010 |
| UAT-05 | Kiểm kê và điều chỉnh | Chênh lệch tính đúng; tồn đổi sau khi duyệt | FR-INV-011, 012 |
| UAT-06 | Phân quyền theo chi nhánh | Tài khoản chi nhánh A không thấy dữ liệu chi nhánh B ở danh sách, tìm kiếm, báo cáo | FR-SYS-002 |
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

### Ma trận truy vết yêu cầu

Ma trận nối yêu cầu nghiệp vụ trong BRD với yêu cầu chức năng và kịch bản nghiệm thu, làm cơ sở viết test case; từng FR còn ghi BR cụ thể ở cột cuối của bảng module.

| Nhóm | BR (BRD) | FR | UAT |
| --- | --- | --- | --- |
| REC | BR-REC-01 đến 14 | FR-REC-001 đến 036 | UAT-01, 03, 17 |
| INS | BR-INS-01 | FR-INS-001 đến 009 | UAT-15 |
| CRM | BR-CRM-01 đến 07 | FR-CRM-001 đến 018 | UAT-10, 18, 20 |
| INV | BR-INV-01 đến 16 | FR-INV-001 đến 028 | UAT-02, 04, 05, 13 |
| PUR | BR-PUR-01 | FR-PUR-001 đến 008 | UAT-16 |
| HRM | BR-HRM-01 đến 06 | FR-HRM-001 đến 016 | UAT-11 |
| ACC | BR-ACC-01 đến 13 | FR-ACC-001 đến 020 | UAT-07, 09, 14 |
| EIN | BR-EIN-01 đến 05 | FR-EIN-001 đến 013 | UAT-01, 08 |
| RPT | BR-RPT-01 đến 04 | FR-RPT-001 đến 016 | UAT-01 |
| SYS | BR-SYS-01 đến 07 | FR-SYS-001 đến 018 | UAT-06, 12, 19 |

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
