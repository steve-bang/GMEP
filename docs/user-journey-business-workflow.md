# Garage ERP – User Journey & Business Workflow

Oct 30, 2026 · @Sang PHAM

## 1. Personas và vai trò người dùng

Bảy persona dưới đây đại diện cho những người chạm vào hệ thống mỗi ngày. Chúng được dựng từ mô tả công việc cố vấn dịch vụ trên các trang tuyển dụng ([TopCV](https://www.topcv.vn/viec-lam/co-van-dich-vu-xe-o-to-di-lam-ngay/2260805.html), [Joboko](https://vn.joboko.com/blog/mo-ta-cong-viec-cua-co-van-dich-vu-nwi1453)) và từ thực tiễn ngành; cần kiểm chứng bằng phỏng vấn nhân sự thật của khách trước khi chốt thiết kế.

| Persona | Mục tiêu trong ngày | Nỗi đau khi dùng Excel \[giả định cần xác nhận\] | Thiết bị |
| --- | --- | --- | --- |
| Chủ garage | Biết chi nhánh nào lãi, lỗ, có thất thoát không | Phải chờ cuối tháng, số liệu mỗi chi nhánh một kiểu | Điện thoại, laptop |
| Quản lý chi nhánh | Xe ra vào đúng hẹn, tồn kho đủ, chốt ngày nhanh | Gom số từ nhiều file, không thấy tiến độ từng xe | Máy tính tại văn phòng, tablet |
| Cố vấn dịch vụ | Tiếp khách, báo giá nhanh, cập nhật tiến độ, bàn giao xe | Tra giá và tồn kho thủ công, báo giá chậm, khách gọi hỏi liên tục | Máy tính tại quầy, tablet |
| Thợ | Biết xe nào làm trước, lấy đúng phụ tùng, công được ghi đúng | Việc giao miệng, công tính sau nên dễ tranh cãi | Tablet dùng chung tại xưởng |
| Thủ kho | Nhập, xuất đúng phiếu, kiểm kê khớp | Xuất theo lời nói, không có chứng từ gốc | Máy tính tại kho, điện thoại quét mã |
| Kế toán | Đối chiếu thu chi, công nợ, xuất hóa đơn đúng hạn | Nhập lại số liệu từ Excel của từng chi nhánh | Máy tính |
| Khách hàng | Biết giá trước khi làm, biết xe làm tới đâu, nhận hóa đơn | Lo bị tính thêm, không hiểu hạng mục ([ACSA](https://acsaorg.ca/what-to-expect-throughout-your-first-visit-to-an-auto-repair-garage/)) | Điện thoại |

Cố vấn dịch vụ là đầu mối: nhận xe, tư vấn hạng mục sửa chữa và báo giá, điều phối với kỹ thuật viên, cập nhật tiến độ, bàn giao xe và chăm sóc sau dịch vụ ([Hướng nghiệp 360](https://huongnghiep360.com/vi/nghe-nghiep/service-advisor-779)). Vì vậy giao diện cho vai trò này quyết định tốc độ của cả quy trình.

### Persona bổ sung ở bản 0.2

| Persona | Mục tiêu trong ngày | Thiết bị |
| --- | --- | --- |
| Quản đốc, nhân viên kiểm tra chất lượng | Phân việc hợp lý, kiểm tra cuối đúng checklist, trả xe đúng hẹn | Tablet |
| Nhân viên mua hàng | Tạo đơn mua từ yêu cầu đã duyệt, theo dõi nhà cung cấp giao hàng | Máy tính |
| Quản trị trụ sở | Tạo danh mục, mẫu kiểm tra và chính sách giá dùng chung cho các chi nhánh | Máy tính |
| Nhân sự | Hồ sơ nhân viên, chấm công, bảng công | Máy tính |

Tại garage nhỏ một người thường kiêm nhiều vai trò, nên một tài khoản được gán nhiều vai trò thay vì mỗi người một chức danh duy nhất.

## 2. User Journey theo vai trò

Mỗi hành trình dưới đây chỉ ra người dùng làm gì ở từng bước và hệ thống phải hỗ trợ điều gì; cột cuối trỏ về yêu cầu nghiệp vụ (BR) trong BRD.

### Khách hàng

| Bước | Khách làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Hẹn lịch | Nhận nhắc bảo dưỡng, đặt hẹn hoặc đến thẳng | Gửi nhắc theo km hoặc thời gian, giữ lịch hẹn | BR-CRM-03, BR-REC-09 |
| 2. Giao xe | Mô tả vấn đề, cho biết số km | Ghi yêu cầu theo lời khách, nhận diện xe qua biển số, hiện lịch sử | BR-REC-01, BR-CRM-02 |
| 3. Nhận báo giá | Đọc hạng mục bắt buộc và tùy chọn, hỏi thêm | Gửi liên kết báo giá chi tiết công và phụ tùng | BR-REC-02 |
| 4. Duyệt | Đồng ý toàn bộ hoặc một phần | Lưu bằng chứng duyệt, chỉ mở lệnh theo phần được duyệt | BR-REC-03 |
| 5. Chờ xe | Theo dõi tiến độ, duyệt hạng mục phát sinh | Thông báo khi đổi trạng thái, xin duyệt trước khi làm thêm | BR-CRM-04, BR-REC-04 |
| 6. Nhận xe | Kiểm xe, thanh toán, nhận hóa đơn | Thu tiền, xuất hóa đơn điện tử và gửi qua email hoặc Zalo | BR-ACC-01, BR-EIN-05 |
| 7. Sau dịch vụ | Nhận nhắc bảo dưỡng và đăng kiểm | Nhắc đúng hạn theo chu kỳ cấu hình | BR-CRM-03 |

### Cố vấn dịch vụ

| Bước | Cố vấn làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Đầu ngày | Xem lịch hẹn và xe đang trong xưởng | Bảng điều phối theo chi nhánh | BR-REC-09, BR-RPT-02 |
| 2. Tiếp nhận | Tìm xe theo biển số, ghi yêu cầu, chụp ảnh hiện trạng | Tự điền thông tin xe và khách, hiện lần sửa gần nhất | BR-REC-01, BR-CRM-02 |
| 3. Báo giá | Chọn gói hoặc từng hạng mục | Tra bảng giá, giờ công chuẩn, tồn kho tại chi nhánh; tính tổng và thuế | BR-REC-02, BR-INV-02 |
| 4. Chờ duyệt | Gửi báo giá, trả lời khách | Theo dõi trạng thái duyệt, nhắc báo giá chưa phản hồi | BR-REC-03 |
| 5. Theo dõi | Cập nhật tiến độ, xử lý phát sinh | Cảnh báo xe trễ hẹn, quy trình duyệt phát sinh | BR-REC-04, BR-REC-06 |
| 6. Bàn giao | Giải thích hạng mục, thu tiền, giao xe | Checklist kiểm tra cuối, in phiếu, xuất hóa đơn | BR-REC-07, BR-EIN-01 |

Các điểm đau cố vấn dịch vụ thường gặp và hệ thống phải giải quyết (giả định, cần kiểm chứng bằng phỏng vấn):

- Không tìm thấy lịch sử sửa chữa của xe.
- Không biết xe đang ở giai đoạn nào.
- Khách không xác nhận rõ từng hạng mục.
- Thay đổi báo giá không được lưu lịch sử.
- Không biết phụ tùng đã sẵn sàng chưa.
- Khách gọi hỏi tiến độ nhưng nhân viên không có thông tin.

### Thợ và kỹ thuật viên

| Bước | Thợ làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Nhận việc | Mở tablet, thấy xe và hạng mục được giao | Danh sách việc theo thứ tự ưu tiên | BR-REC-06 |
| 2. Lấy phụ tùng | Yêu cầu phụ tùng theo lệnh | Tạo yêu cầu xuất cho thủ kho, chỉ cho phép phụ tùng có trong lệnh | BR-INV-04 |
| 3. Làm việc | Bấm bắt đầu và kết thúc từng hạng mục | Ghi giờ thực tế, so với giờ chuẩn | BR-HRM-03 |
| 4. Phát sinh | Phát hiện hư hỏng thêm, chụp ảnh, báo cố vấn | Tạo đề xuất phát sinh gắn ảnh, chờ khách duyệt | BR-REC-04 |
| 5. Hoàn tất | Đánh dấu xong, chuyển kiểm tra chất lượng | Khóa hạng mục, chuyển người kiểm tra | BR-REC-07 |
| 6. Cuối ngày | Xem công của mình | Bảng công theo việc, minh bạch | BR-HRM-03, BR-HRM-04 |

Thợ chỉ làm việc đã được giao và nằm trong phạm vi khách đã duyệt. Ở bước kiểm tra xe số, thợ đánh dấu từng hạng mục xanh, vàng hoặc đỏ kèm ảnh hoặc video; hạng mục vàng và đỏ tự vào danh sách lỗi để cố vấn đưa vào báo giá (xem mục 3). Bấm bắt đầu một hạng mục là đồng hồ công việc, khác với chấm công đầu ca.

### Thủ kho

| Bước | Thủ kho làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Nhập hàng | Đối chiếu hàng giao với đơn mua | Phiếu nhập từ đơn mua, cảnh báo lệch số lượng hoặc giá | BR-INV-03 |
| 2. Xuất hàng | Xuất theo yêu cầu của thợ hoặc phiếu bán | Chỉ xuất khi có lệnh hoặc phiếu hợp lệ | BR-INV-04 |
| 3. Chuyển kho | Gửi hoặc nhận hàng giữa chi nhánh | Phiếu chuyển hai bước, hàng đang đi đường | BR-INV-05 |
| 4. Kiểm kê | Đếm thực tế, nhập kết quả | Tính chênh lệch, chuyển quản lý duyệt | BR-INV-06 |
| 5. Đặt hàng | Xem hàng dưới định mức | Gợi ý đặt hàng theo nhà cung cấp | BR-INV-07 |

### Kế toán

| Bước | Kế toán làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Hằng ngày | Đối chiếu thu tiền với sổ quỹ từng chi nhánh | Bảng đối chiếu theo ca và ngày | BR-ACC-04, BR-ACC-05 |
| 2. Hóa đơn | Kiểm hóa đơn chưa xuất, hóa đơn lỗi | Danh sách lệnh hoàn tất chưa có hóa đơn, trạng thái từ nhà cung cấp | BR-EIN-03, BR-RPT-03 |
| 3. Công nợ | Theo dõi nợ khách, nợ nhà cung cấp | Tuổi nợ, nhắc đến hạn | BR-ACC-02 |
| 4. Giá vốn | Rà soát giá vốn phụ tùng | Giá vốn theo phương pháp đã chọn | BR-ACC-03 |
| 5. Cuối kỳ | Khóa kỳ, kết xuất sang phần mềm kế toán | Khóa chứng từ, xuất dữ liệu | BR-ACC-05, BR-ACC-07 |

### Quản lý chi nhánh

| Bước | Quản lý làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Sáng | Xem xe, nhân sự, hàng sắp hết | Dashboard chi nhánh | BR-RPT-02 |
| 2. Trong ngày | Duyệt giảm giá, hủy lệnh, điều chỉnh kho | Hàng chờ phê duyệt theo hạn mức | BR-SYS-03 |
| 3. Cuối ngày | Chốt ngày | Kiểm tra lệnh mở, tiền chưa thu, chênh lệch quỹ rồi khóa ngày | BR-ACC-05 |
| 4. Cuối tháng | Kiểm kê, xem năng suất thợ | Báo cáo kiểm kê và năng suất | BR-INV-06, BR-HRM-05 |

### Chủ garage

| Bước | Chủ làm gì | Hệ thống làm gì | BR |
| --- | --- | --- | --- |
| 1. Sáng | Mở điện thoại xem doanh thu hôm qua theo chi nhánh | Dashboard hợp nhất toàn chuỗi | BR-RPT-01 |
| 2. Phát hiện bất thường | Thấy chi nhánh lệch tồn hoặc giảm doanh thu | Cảnh báo ngoại lệ, đi sâu xuống từng lệnh | BR-RPT-03 |
| 3. Quyết định | Duyệt khoản lớn, điều phụ tùng giữa chi nhánh | Phê duyệt và lệnh chuyển kho | BR-SYS-03, BR-INV-05 |
| 4. Cuối tháng | Xem lãi lỗ từng chi nhánh | Báo cáo lãi lỗ theo chi nhánh và nguồn doanh thu | BR-ACC-06 |

Ví dụ minh họa (số liệu giả định): lúc 8 giờ sáng chủ mở dashboard và thấy chi nhánh A có 18 xe đang sửa trong đó 4 xe quá hạn dự kiến, chi nhánh B thiếu phụ tùng quan trọng, chi nhánh C có chi phí phát sinh cao bất thường. Từ mỗi cảnh báo, chủ đi sâu xuống lệnh, xem người chịu trách nhiệm và yêu cầu xử lý.

## 3. Business Workflow: từ tiếp nhận đến giao xe

Lệnh sửa chữa là chứng từ gốc duy nhất: công, phụ tùng, giờ làm, hóa đơn và nhắc bảo dưỡng đều phát sinh từ nó, nên không ai xuất kho hay xuất hóa đơn ngoài lệnh.

&#91;embedded content: quy trình sửa chữa · 3 điểm quyết định\]

Khách chưa duyệt thì báo giá quay lại chỉnh; hư hỏng phát sinh khi đang sửa quay về báo giá bổ sung; xe không đạt kiểm tra chất lượng được trả lại thợ.

### Chi tiết từng bước

| Bước | Vai trò | Đầu vào | Đầu ra | Quy tắc |
| --- | --- | --- | --- | --- |
| 1. Nhận xe | Cố vấn | Biển số, yêu cầu của khách | Hồ sơ tiếp nhận | Xe mới phải tạo hồ sơ xe; số km và hiện trạng là bắt buộc |
| 2. Kiểm tra sơ bộ | Cố vấn, thợ | Hồ sơ tiếp nhận | Hạng mục đề xuất, ảnh | Ảnh hiện trạng lưu vào hồ sơ |
| 3. Lập báo giá | Cố vấn | Hạng mục, bảng giá, tồn kho | Báo giá có công, phụ tùng, thuế | Tách hạng mục bắt buộc và tùy chọn; giảm giá quá hạn mức cần quản lý duyệt |
| 4. Khách duyệt | Khách, cố vấn | Báo giá | Bằng chứng duyệt | Chưa duyệt thì không mở lệnh |
| 5. Mở lệnh sửa chữa | Cố vấn | Báo giá đã duyệt | Lệnh sửa chữa | Chỉ chứa hạng mục được duyệt |
| 6. Phân thợ | Quản đốc | Lệnh | Việc giao cho thợ | Mỗi hạng mục có một thợ chịu trách nhiệm |
| 7. Xuất phụ tùng | Thủ kho | Yêu cầu từ lệnh | Phiếu xuất kho | Chỉ xuất phụ tùng có trong lệnh |
| 8. Sửa chữa | Thợ | Việc được giao | Giờ thực tế, ảnh | Bấm bắt đầu và kết thúc từng hạng mục |
| 9. Phát sinh | Thợ, cố vấn, khách | Hư hỏng thêm | Báo giá bổ sung đã duyệt | Không làm khi chưa có duyệt |
| 10. Kiểm tra chất lượng | Quản đốc hoặc người kiểm tra | Checklist | Kết quả đạt hoặc trả lại | Không đạt thì trả thợ và ghi nhận lỗi |
| 11. Thu tiền | Thu ngân | Lệnh đã qua kiểm tra | Phiếu thu | Hỗ trợ nhiều hình thức; tiền đặt cọc đã thu được trừ vào |
| 12. Xuất hóa đơn điện tử | Thu ngân hoặc kế toán | Lệnh và phiếu thu | Hóa đơn hợp lệ | Xuất trực tiếp từ lệnh, không nhập lại |
| 13. Giao xe | Cố vấn | Hóa đơn, phiếu thu | Biên bản giao xe | Khách xác nhận nhận xe |
| 14. Nhắc bảo dưỡng | Hệ thống | Số km, ngày giao xe | Lịch nhắc | Theo chu kỳ cấu hình, gồm cả đăng kiểm |

### Kiểm tra xe số và chuyển lỗi thành báo giá

Kiểm tra xe số thay cho bước kiểm tra sơ bộ bằng lời: thợ làm theo mẫu kiểm tra, đánh dấu từng hạng mục theo ba mức và đính kèm ảnh, video. Hệ thống đưa các hạng mục vàng và đỏ vào danh sách lỗi và vào báo giá ([Tekmetric](https://tours.tekmetric.com/answers/performing-an-inspection-tekmetric)); kết quả có thể gửi cho khách xem kèm báo giá.

| Mức | Ý nghĩa | Hệ thống làm gì |
| --- | --- | --- |
| Xanh | Bình thường | Ghi nhận, không tạo dòng báo giá |
| Vàng | Cần theo dõi | Vào danh sách lỗi; cố vấn chọn đưa vào báo giá hoặc nhắc ở lần sau |
| Đỏ | Cần xử lý | Vào danh sách lỗi và đề xuất dòng báo giá bằng một thao tác |

Ví dụ một mẫu kiểm tra (minh họa): lốp xe cần thay (đỏ), hệ thống phanh bình thường (xanh), dầu động cơ cần thay (đỏ), ắc quy cần kiểm tra thêm (vàng), hệ thống đèn bình thường (xanh).

### Ví dụ báo giá được duyệt một phần

Khách đồng ý thay dầu, lọc dầu và công sửa chữa nhưng từ chối thay má phanh. Hệ thống ghi tổng báo giá ban đầu, hạng mục được duyệt, hạng mục bị từ chối, người xác nhận, thời điểm xác nhận và phiên bản báo giá.

| Hạng mục | Thành tiền (đồng) | Kết quả |
| --- | --- | --- |
| Thay dầu động cơ | 1.200.000 | Duyệt |
| Thay lọc dầu | 350.000 | Duyệt |
| Thay má phanh | 2.500.000 | Từ chối |
| Công sửa chữa | 500.000 | Duyệt |
| Tổng báo giá | 4.550.000 |  |
| Tổng được duyệt | 2.050.000 |  |

Chỉ ba hạng mục được duyệt chuyển sang sẵn sàng thực hiện và vào lệnh; má phanh được lưu ở danh sách hạng mục bị từ chối để cố vấn nhắc ở lần sau. Các cách duyệt cần hỗ trợ: liên kết gửi cho khách, chữ ký tại quầy và xác nhận bằng lời tại quầy do nhân viên ghi nhận ([Tekmetric](https://tours.tekmetric.com/answers/digital-signature-authorization-process-tekmetric)).

### Quy trình theo loại dịch vụ và luồng đồng sơn

Khách yêu cầu không ép mọi dịch vụ đi qua một luồng: mỗi loại dịch vụ (sửa chung, bảo dưỡng, lốp, đồng sơn) có bộ bước và trạng thái hạng mục riêng, cấu hình được. Luồng đồng sơn cần nhiều công đoạn và thời gian chờ, nên là ví dụ đầu tiên; các bước dưới đây là giả định cần khảo sát xưởng thực tế \[Cần xác nhận\]:

1. Tiếp nhận xe, chụp ảnh hiện trạng.
2. Đánh giá hư hỏng.
3. Báo giá từng chi tiết và khách duyệt.
4. Tháo chi tiết.
5. Gò, sửa thân vỏ.
6. Sơn lót, sơn màu, sơn bóng.
7. Lắp ráp.
8. Kiểm tra chất lượng.
9. Bàn giao.

Ở mỗi công đoạn hệ thống cho biết xe đang ở đâu, ai phụ trách và ngày dự kiến hoàn thành. Lệnh sửa chữa vẫn là một đối tượng với các trạng thái ở sơ đồ mục 7; công đoạn là trạng thái của hạng mục.

## 4. Workflow kho và phụ tùng

Mọi biến động tồn kho đều đi qua một phiếu có người lập và chứng từ gốc; riêng chuyển kho giữa chi nhánh cần hai bước gửi và nhận để không có hàng biến mất trên đường. Khó khăn lớn nhất khi triển khai thường là chuẩn hóa dữ liệu kho, không phải khâu bán hàng ([Sapo](https://www.sapo.vn/blog/phan-mem-quan-ly-ban-hang-phu-tung-o-to)).

&#91;embedded content: chuyển kho liên chi nhánh · 2 bên, 1 điểm quyết định\]

Phiếu chuyển chỉ đóng khi bên nhận xác nhận đủ và đúng; chênh lệch đi qua biên bản và quản lý duyệt. Chứng từ điều chuyển nội bộ giữa chi nhánh khác tỉnh phụ thuộc quy định thuế, kế toán của khách cần xác nhận.

### Nhập hàng từ nhà cung cấp

1. Thủ kho hoặc quản lý tạo đơn mua theo gợi ý từ định mức tồn hoặc theo nhu cầu.
2. Nhà cung cấp giao hàng; thủ kho đối chiếu số lượng, mã và giá với đơn mua.
3. Hệ thống tạo phiếu nhập, ghi lô và giá nhập; lệch quá hạn mức cần quản lý duyệt.
4. Công nợ phải trả tăng theo phiếu nhập, hóa đơn mua vào được đính kèm.

### Xuất hàng

1. Thợ yêu cầu phụ tùng trong lệnh; thủ kho thấy yêu cầu cùng số tồn hiện có.
2. Thủ kho xuất; hệ thống ghi giá vốn theo phương pháp kế toán đã chọn.
3. Phụ tùng không dùng được trả lại kho bằng phiếu hoàn kho gắn với lệnh.
4. Bán lẻ tại quầy dùng phiếu bán lẻ thay cho lệnh.

### Kiểm kê

1. Quản lý tạo đợt kiểm kê theo nhóm hàng hoặc toàn kho; hệ thống chụp số tồn tại thời điểm bắt đầu.
2. Thủ kho nhập số đếm thực tế, có thể quét mã vạch bằng điện thoại thay cho máy quét riêng ([Sapo](https://www.sapo.vn/blog/phan-mem-quan-ly-ban-hang-phu-tung-o-to)).
3. Hệ thống tính chênh lệch; chênh lệch vượt ngưỡng phải có giải trình.
4. Quản lý duyệt điều chỉnh; phiếu điều chỉnh ghi lý do và người duyệt.

### Đặt hàng bổ sung

1. Hệ thống so tồn với định mức tối thiểu của từng chi nhánh và liệt kê hàng thiếu.
2. Với hàng thiếu, hệ thống gợi ý lấy từ chi nhánh đang dư trước khi đặt nhà cung cấp \[Cần xác nhận chính sách\].
3. Quản lý duyệt đơn mua rồi gửi nhà cung cấp.

### Tồn thực tế, giữ chỗ và tồn khả dụng

Tồn khả dụng bằng tồn thực tế trừ phần đã giữ cho các lệnh; mọi cảnh báo và mọi lần xuất đều so với tồn khả dụng.

1. Khi khách duyệt báo giá hoặc lệnh mở, hệ thống giữ chỗ phụ tùng của các hạng mục được duyệt.
2. Báo giá và lệnh khác chỉ thấy phần tồn khả dụng sau khi trừ giữ chỗ.
3. Thợ lấy phụ tùng theo phần đã giữ; khi thủ kho xuất, giữ chỗ chuyển thành xuất kho.
4. Hạng mục bị hủy hoặc bị từ chối thì giữ chỗ tự nhả.
5. Thiếu hàng thì lệnh sang trạng thái tạm dừng chờ phụ tùng và hệ thống gợi ý lấy từ chi nhánh khác hoặc đặt nhà cung cấp.

Kho tổng và kho chi nhánh cần xem được bốn con số cho từng phụ tùng: tồn thực tế, hàng đang giữ cho lệnh, hàng đang vận chuyển giữa các kho và hàng có thể sử dụng. Hàng đang vận chuyển chưa cộng vào tồn của kho nhận cho đến khi nhận và xác nhận số lượng.

Giá vốn mặc định theo bình quân gia quyền, cấu hình được và do kế toán của khách xác nhận. Ví dụ nhập 10 cái giá 100.000 đồng rồi 20 cái giá 120.000 đồng cho giá vốn bình quân khoảng 113.333 đồng. Giá vốn, giá niêm yết và giá bán thực tế là ba con số khác nhau; báo giá đã gửi giữ nguyên giá khi bảng giá được cập nhật, và giảm giá vượt hạn mức của chi nhánh phải được duyệt.

### Chứng từ kho

Mọi biến động tồn kho là một chứng từ có lịch sử; không cập nhật trực tiếp số lượng trên danh mục phụ tùng.

| Mã | Chứng từ | Khi nào |
| --- | --- | --- |
| GRN | Phiếu nhập kho | Nhận hàng từ nhà cung cấp |
| GIN | Phiếu xuất kho | Xuất cho lệnh, phiếu bán lẻ hoặc dùng nội bộ |
| STO | Phiếu chuyển kho | Chuyển giữa hai chi nhánh |
| ADJ | Phiếu điều chỉnh | Sau kiểm kê hoặc xử lý chênh lệch |
| RTN | Phiếu trả hàng | Trả nhà cung cấp hoặc khách trả phụ tùng |

### Mua hàng: từ yêu cầu đến thanh toán nhà cung cấp

1. Chi nhánh tạo yêu cầu mua hàng, thường từ danh sách hàng dưới định mức.
2. Quản lý duyệt theo hạn mức.
3. Nhân viên mua hàng lập đơn mua và gửi nhà cung cấp; nhà cung cấp xác nhận.
4. Thủ kho nhận hàng, đối chiếu số lượng và chất lượng, nhập kho; một đơn có thể nhận nhiều lần.
5. Kế toán đối chiếu ba bên giữa đơn mua, phiếu nhập và hóa đơn nhà cung cấp, ghi công nợ phải trả.
6. Thanh toán nhà cung cấp theo lịch và đối chiếu về phiếu nhập.

Quy trình mua hàng của khách chưa được xác nhận; có thể không có bước yêu cầu và duyệt ở chi nhánh nhỏ \[Cần xác nhận\].

### Nghiệp vụ kho đặc biệt

- Chuyển kho giữa hai chi nhánh, có thể khởi tạo ngay từ lệnh sửa chữa đang thiếu hàng ([Shopmonkey](https://support.shopmonkey.io/hc/en-us/articles/42720891279508-Shopmonkey-HQ-Inventory-Transfers)).
- Trả hàng lỗi cho nhà cung cấp.
- Khách trả lại phụ tùng chưa lắp.
- Xuất dùng nội bộ có lý do.
- Kiểm kê và điều chỉnh tồn kho.
- Theo dõi số lô hoặc serial với mặt hàng yêu cầu.

## 5. Workflow nhân công, công thợ và hoa hồng

Hệ thống tách ba con số: giờ chuẩn bán cho khách, giờ thực tế thợ làm, và giờ thợ có mặt tại xưởng. Ba số này cho biết xưởng kiếm tiền hay hao hụt ở khâu nào ([Beancount](https://beancount.io/nl/blog/2026/05/19/auto-repair-shop-bookkeeping-flat-rate-vs-clock-hours-parts-matrix-markup-comeback-warranty-receivables-sublet-epa-hazmat-shop-supplies-effective-labor-rate-guide)).

### Luồng tính công

1. Mỗi hạng mục dịch vụ trong danh mục có giờ chuẩn; báo giá lấy giờ chuẩn nhân đơn giá giờ công của chi nhánh, đúng cách tính thông dụng của ngành ([AAA](https://ww2.aaa.com/autorepair/articles/car-repair-labor-rates-explained)).
2. Thợ bấm bắt đầu và kết thúc từng hạng mục trên tablet; hệ thống ghi giờ thực tế.
3. Khi hạng mục qua kiểm tra chất lượng, hệ thống ghi nhận công cho thợ theo quy tắc cấu hình của chi nhánh và chức danh.
4. Xe quay lại sửa lỗi cũ (comeback) được gắn với lệnh gốc và thợ gốc; quy tắc trừ hoặc không tính công do khách chốt.
5. Cuối kỳ, bảng công và hoa hồng đi qua quản lý chi nhánh duyệt rồi chuyển cho kế toán lấy dữ liệu tính lương.

### Các mô hình tính công cần hỗ trợ

| Mô hình | Cách tính | Hệ thống cần |
| --- | --- | --- |
| Giờ chuẩn (flat-rate) | Công = giờ chuẩn của hạng mục nhân đơn giá giờ, không phụ thuộc thợ làm nhanh hay chậm ([AutoLeap](https://autoleap.com/glossary/flat-rate-pay)) | Danh mục giờ chuẩn, đơn giá theo thợ hoặc cấp bậc |
| Khoán theo việc | Mỗi hạng mục một mức cố định | Bảng giá khoán theo hạng mục |
| Phần trăm giá trị công | Hoa hồng bằng một tỷ lệ trên doanh thu công đã thu | Tỷ lệ theo chức danh, điều kiện đã thanh toán |
| Lương cố định cộng thưởng | Lương theo ca, thưởng khi vượt chỉ tiêu năng suất | Chấm công theo ca, chỉ tiêu theo kỳ |

Khách có thể dùng một hoặc kết hợp nhiều mô hình; câu hỏi 6 ở mục 10 của BRD cần được trả lời trước khi thiết kế phân hệ này.

### Ba chỉ số năng suất theo thông lệ ngành

| Chỉ số | Công thức | Ý nghĩa |
| --- | --- | --- |
| Hiệu suất làm việc | Giờ chuẩn bán ra chia giờ thực làm | Thợ làm nhanh hay chậm so với chuẩn |
| Mức sử dụng | Giờ thực làm chia giờ có mặt | Thợ có đủ việc không, hay ngồi chờ |
| Năng suất tổng | Giờ chuẩn bán ra chia giờ có mặt | Mỗi giờ thợ có mặt tạo ra bao nhiêu giờ doanh thu |

Các nguồn ngành dùng tên khác nhau cho những chỉ số này. Nhiều nguồn gọi giờ tính tiền chia giờ thực làm là hiệu suất (Efficiency) và giờ thực làm chia giờ khả dụng là năng suất (Productivity) hoặc mức sử dụng (Utilization) ([AutoVitals](https://blog.autovitals.com/technician-efficiency), [ShopView](https://shopview.com/blog/billable-hours-per-diesel-technician)); một số nguồn lại gọi giờ tính tiền chia giờ có mặt là Productivity ([Tire Review](https://www.tirereview.com/what-is-your-roadmap-to-profitability/)). Tài liệu này giữ ba tên ở bảng trên và mọi báo cáo phải ghi công thức cạnh tên chỉ số. Ba chỉ số liên hệ với nhau: giờ có mặt nhân mức sử dụng nhân hiệu suất bằng giờ tính tiền ([ShopView](https://shopview.com/blog/billable-hours-per-diesel-technician)).

Chấm công đầu ca và bấm giờ từng hạng mục là hai nghiệp vụ khác nhau; Mitchell 1 cũng tách đồng hồ ca khỏi đồng hồ công việc, và giờ kết thúc công việc tự điền vào giờ thực của lệnh ([Mitchell 1](https://mitchell1.com/press/mitchell-1-manager-se-adds-new-time-management-features/)).

Ví dụ minh họa: hạng mục có giờ chuẩn 2 giờ, thợ làm trong 1,5 giờ thì công tính theo 2 giờ chuẩn, còn hiệu suất của lần làm này là 2 chia 1,5.

Quy tắc về lương tối thiểu, tăng ca và bảo hiểm khi trả lương theo sản phẩm phải theo Bộ luật Lao động Việt Nam; phần này chưa được nghiên cứu và cần nhân sự hoặc luật sư của khách xác nhận. Hệ thống chỉ cung cấp dữ liệu công, không thay phần mềm tính lương.

## 6. Workflow kế toán: thu chi, công nợ, hóa đơn, đóng sổ

Mọi con số kế toán đều sinh ra từ một sự kiện nghiệp vụ đã có chứng từ gốc; kế toán duyệt và đối chiếu, không nhập lại. Việc kế toán dịch vụ garage gồm tổng hợp chi phí vật liệu và nhân công để tính giá vốn dịch vụ, theo dõi công nợ phải thu và phải trả, và đối chiếu doanh thu sửa chữa hằng ngày ([AZTAX](https://aztax.com.vn/ke-toan-dich-vu-sua-chua-o-to/)).

### Sự kiện nghiệp vụ và ảnh hưởng kế toán

Bảng dưới mô tả ý nghĩa; tài khoản cụ thể do kế toán trưởng chọn theo Thông tư 99/2025 và cấu hình trong hệ thống.

| Sự kiện | Chứng từ gốc | Ảnh hưởng |
| --- | --- | --- |
| Nhập phụ tùng | Phiếu nhập từ đơn mua | Tăng tồn kho, tăng công nợ phải trả hoặc giảm tiền |
| Xuất phụ tùng cho lệnh sửa chữa | Phiếu xuất kho theo lệnh | Giảm tồn kho, ghi giá vốn phụ tùng |
| Hoàn tất lệnh sửa chữa | Lệnh đã qua kiểm tra chất lượng | Ghi doanh thu công và doanh thu phụ tùng, thuế đầu ra, công nợ phải thu |
| Khách thanh toán hoặc đặt cọc | Phiếu thu | Giảm công nợ phải thu hoặc ghi tiền nhận trước |
| Trả tiền nhà cung cấp | Phiếu chi | Giảm công nợ phải trả, giảm tiền |
| Chuyển kho giữa chi nhánh | Phiếu điều chuyển | Chuyển giá trị tồn giữa hai chi nhánh, không ghi doanh thu |
| Chi phí chi nhánh | Phiếu chi hoặc hóa đơn mua vào | Ghi chi phí theo chi nhánh |

### Luồng chốt ngày tại chi nhánh

1. Hệ thống liệt kê lệnh còn mở, lệnh hoàn tất chưa thu tiền, phiếu chưa có chứng từ gốc.
2. Thu ngân đếm quỹ tiền mặt, hệ thống tính chênh lệch với sổ quỹ ([AZTAX](https://aztax.com.vn/ke-toan-dich-vu-sua-chua-o-to/)).
3. Chênh lệch vượt hạn mức phải có giải trình và quản lý chi nhánh duyệt.
4. Quản lý chi nhánh khóa ngày; chứng từ của ngày đó không sửa trực tiếp, chỉ điều chỉnh bằng chứng từ mới có lý do.
5. Dữ liệu ngày đã khóa xuất hiện trên dashboard chủ garage.

### Luồng xuất hóa đơn điện tử

1. Lệnh sửa chữa qua kiểm tra chất lượng, hệ thống kiểm tra điều kiện: thông tin người mua nếu cần hóa đơn đứng tên công ty, thuế suất theo ngày hiệu lực, đơn vị phát hành của chi nhánh.
2. Hệ thống gửi dữ liệu sang nhà cung cấp hóa đơn điện tử và nhận trạng thái, mã của cơ quan thuế.
3. Hóa đơn đạt trạng thái hợp lệ được lưu bản XML và PDF, gửi cho khách qua email, SMS hoặc Zalo.
4. Nếu hóa đơn sai hoặc khách yêu cầu đổi thông tin, kế toán tạo hóa đơn điều chỉnh hoặc thay thế theo quy định; lệnh gốc vẫn liên kết với mọi phiên bản hóa đơn.
5. Cuối ngày, báo cáo đối chiếu cho biết lệnh nào đã hoàn tất mà chưa có hóa đơn.

Quy định hóa đơn thay đổi từ 1/7/2026 theo Nghị định 254/2026/NĐ-CP, gồm thời điểm lập hóa đơn và các nội dung mới như tiền đặt cọc ([Kế toán Bách Khoa](https://ketoanbachkhoa.vn/diem-moi-nghi-dinh-254-2026-nd-cp/)); các điều kiện ở bước 1 phải cấu hình được và kế toán của khách cần xác nhận.

### Luồng công nợ

1. Công nợ phải thu phát sinh khi khách chưa trả hết hoặc là khách doanh nghiệp theo kỳ; mỗi khoản gắn lệnh sửa chữa gốc.
2. Hệ thống phân tích tuổi nợ và nhắc theo hạn.
3. Phải trả nhà cung cấp phát sinh từ phiếu nhập; kế toán lên lịch thanh toán, mỗi lần chi đối chiếu về phiếu nhập.
4. Cuối kỳ, đối chiếu số dư công nợ với từng khách và nhà cung cấp trước khi khóa kỳ.

### Bốn nhóm giao dịch tài chính

| Nhóm | Ví dụ |
| --- | --- |
| Doanh thu | Doanh thu sửa chữa, bán phụ tùng |
| Chi phí | Điện, nước, thuê mặt bằng, lương |
| Phải thu | Khách chưa thanh toán |
| Phải trả | Chưa trả nhà cung cấp |

### Thu tiền, chi tiền và phân bổ thanh toán

- Thu tiền: hóa đơn, yêu cầu thanh toán, nhận tiền, phân bổ thanh toán, đối soát.
- Chi tiền: đề xuất chi, phê duyệt, chi tiền, ghi nhận chi phí, đối soát.
- Một hóa đơn có thể được trả nhiều lần và một lần thanh toán có thể phân bổ cho nhiều hóa đơn (khách doanh nghiệp), nên quan hệ giữa hóa đơn và thanh toán là nhiều-nhiều, không phải một-một.

### Năm đối tượng khác nhau

| Đối tượng | Vai trò |
| --- | --- |
| Báo giá | Đề nghị giá để khách duyệt |
| Lệnh sửa chữa | Chứng từ gốc của công việc và vật tư |
| Hóa đơn | Chứng từ bán hàng theo quy định thuế, phát hành qua nhà cung cấp hóa đơn |
| Thanh toán | Giao dịch tiền của khách |
| Phiếu thu | Chứng từ ghi nhận đã thu tiền |

Năm đối tượng này liên quan với nhau nhưng là các đối tượng dữ liệu riêng, không gộp vào một bảng.

## 7. Trạng thái, quy tắc nghiệp vụ và phê duyệt

Mỗi lệnh sửa chữa có đúng một trạng thái tại một thời điểm và chỉ chuyển khi đủ điều kiện, còn báo giá, hạng mục, thanh toán và hóa đơn có bộ trạng thái riêng, không dồn vào trạng thái của lệnh; đây là cơ sở cho bảng điều phối của cố vấn và báo cáo của chủ garage.

&#91;embedded content: vòng đời lệnh sửa chữa · 7 trạng thái, 3 bộ trạng thái song song\]

Lệnh có thể chuyển sang đã hủy từ đã duyệt hoặc đang sửa; hủy sau khi đã xuất phụ tùng cần quản lý duyệt và phiếu hoàn kho, còn báo giá bị từ chối hoặc hết hạn thì không tạo lệnh. Thu tiền và xuất hóa đơn là trạng thái riêng chạy song song với lệnh; thời điểm lập hóa đơn chính thức do kế toán của khách xác nhận theo Nghị định 254/2026/NĐ-CP.

### Năm đối tượng, năm bộ trạng thái

| Đối tượng | Trạng thái | Ghi chú |
| --- | --- | --- |
| Báo giá | Nháp, đã gửi, duyệt toàn phần, duyệt một phần, từ chối, hết hạn | Có nhiều phiên bản; chỉ phần được duyệt sang lệnh |
| Lệnh sửa chữa | Đã duyệt, đang sửa, tạm dừng, chờ kiểm tra, sẵn sàng giao, hoàn tất, đã hủy | Bắt đầu từ khi khách duyệt |
| Hạng mục sửa chữa | Chưa làm, đang làm, tạm dừng, hoàn thành, trả lại | Độc lập với trạng thái lệnh |
| Thanh toán | Chưa thu, thu một phần, đã thu đủ, hoàn tiền | Một hóa đơn nhiều lần thu; một lần thu nhiều hóa đơn |
| Hóa đơn | Chưa xuất, đã xuất, điều chỉnh, thay thế, hủy | Trạng thái lấy từ nhà cung cấp hóa đơn |

Tài liệu BA tham khảo đặt trạng thái chờ khách duyệt vào lệnh; bản này tách báo giá thành đối tượng riêng nên lệnh chỉ bắt đầu từ khi khách duyệt, và không dùng một trạng thái chung cho cả lệnh lẫn từng công việc.

### Quy tắc nghiệp vụ

| Mã | Quy tắc |
| --- | --- |
| WF-01 | Không mở lệnh khi báo giá chưa được khách duyệt |
| WF-02 | Không xuất kho khi không có lệnh, phiếu bán lẻ hoặc phiếu điều chuyển |
| WF-03 | Hạng mục phát sinh không được làm khi chưa có duyệt của khách; bằng chứng duyệt được lưu |
| WF-04 | Không giao xe khi lệnh chưa qua kiểm tra chất lượng |
| WF-05 | Mỗi lệnh hoàn tất có hóa đơn hợp lệ theo quy định; trường hợp khách không lấy hóa đơn do kế toán xác nhận \[Cần xác nhận\] |
| WF-06 | Chứng từ đã khóa ngày không sửa trực tiếp; điều chỉnh bằng chứng từ mới có lý do |
| WF-07 | Giá bán thấp hơn giá vốn phải có người có quyền duyệt |
| WF-08 | Thợ chỉ thấy việc của mình; cố vấn, thủ kho, thu ngân chỉ thấy chi nhánh của mình |
| WF-09 | Mọi thay đổi trạng thái ghi người làm, thời điểm và lý do |

### Ma trận phê duyệt

Hạn mức cụ thể do khách chốt trong giai đoạn khám phá.

Ví dụ minh họa, chưa được khách xác nhận: chi phí dưới 2 triệu đồng do quản lý chi nhánh duyệt, từ 2 đến 10 triệu do quản lý vận hành duyệt, trên 10 triệu do chủ garage duyệt; điều chỉnh tồn kho bất thường cần cả trưởng kho và quản lý duyệt. Phê duyệt quá hạn thì chuyển lên cấp trên và nhắc việc (FR-SYS-015).

| Hành động | Người đề xuất | Người duyệt | Điều kiện |
| --- | --- | --- | --- |
| Giảm giá | Cố vấn | Quản lý chi nhánh | Vượt hạn mức \[Cần chốt\] |
| Hủy lệnh sau khi đã xuất phụ tùng | Cố vấn | Quản lý chi nhánh | Có phiếu hoàn kho |
| Điều chỉnh kho sau kiểm kê | Thủ kho | Quản lý chi nhánh; vượt ngưỡng thì chủ garage hoặc quản lý vùng | Ngưỡng giá trị \[Cần chốt\] |
| Chênh lệch quỹ cuối ngày | Thu ngân | Quản lý chi nhánh | Phải có giải trình |
| Chuyển kho giá trị lớn | Quản lý chi nhánh gửi | Chủ garage hoặc quản lý vùng | Ngưỡng giá trị \[Cần chốt\] |
| Hóa đơn điều chỉnh, thay thế, hủy | Kế toán | Kế toán trưởng | Ghi lý do và liên kết hóa đơn gốc |
| Mở lại ngày hoặc kỳ đã khóa | Kế toán | Chủ garage | Ghi lý do, có nhật ký |

## 8. Ngoại lệ và tình huống đặc biệt

Hệ thống phải xử lý được 12 tình huống dưới đây mà không bắt người dùng quay về Excel hay giấy; mỗi tình huống đều để lại dấu vết trong nhật ký thao tác.

| Tình huống | Xử lý trong hệ thống | BR |
| --- | --- | --- |
| Khách chỉ duyệt một phần báo giá | Lệnh chỉ chứa hạng mục được duyệt; phần còn lại lưu thành đề xuất để nhắc lại ở lần sau | BR-REC-03 |
| Phát hiện hư hỏng thêm khi đang sửa | Hạng mục phát sinh ở trạng thái chờ duyệt, thợ không làm khi chưa có duyệt; cùng nguyên tắc với thực hành ở nhiều nước là không sửa thêm khi chưa có đồng ý của khách ([OMIC Barcelona](https://ajuntament.barcelona.cat/omic/en/vehicle-repairs)) | BR-REC-04 |
| Phụ tùng không đủ tồn tại chi nhánh | Gợi ý lấy từ chi nhánh khác hoặc đặt nhà cung cấp; lệnh chuyển sang chờ phụ tùng và báo khách thời gian dự kiến | BR-INV-05, BR-INV-07 |
| Khách tự mang phụ tùng đến | Ghi phụ tùng của khách vào lệnh nhưng không vào tồn kho; chỉ tính công; ghi rõ điều kiện bảo hành | BR-INV-09 |
| Xe quay lại vì lỗi cũ hoặc bảo hành | Mở lệnh bảo hành gắn với lệnh gốc; chi phí ghi vào chi phí bảo hành theo chính sách của khách | BR-REC-08 |
| Đổi thợ giữa chừng | Chuyển hạng mục sang thợ khác; công chia theo giờ thực tế đã ghi | BR-REC-06, BR-HRM-03 |
| Hủy lệnh sau khi đã xuất phụ tùng | Quản lý duyệt hủy; hệ thống tạo phiếu hoàn kho và đảo công đã ghi | BR-SYS-03 |
| Khách đổi thông tin hóa đơn sau khi xuất | Tạo hóa đơn điều chỉnh hoặc thay thế theo quy định; giữ liên kết với hóa đơn cũ | BR-EIN-02 |
| Khách không nhận xe hoặc chưa trả tiền | Ghi công nợ phải thu, nhắc theo hạn; chính sách lưu xe do khách chốt \[Cần xác nhận\] | BR-ACC-02 |
| Mất mạng tại chi nhánh | Dùng phiếu giấy dự phòng, nhập bù khi có mạng với dấu hiệu nhập bù để kế toán đối chiếu | BR-SYS-04 |
| Lệch tồn khi kiểm kê | Phiếu kiểm kê chuyển quản lý duyệt, tạo phiếu điều chỉnh có lý do; lệch lặp lại được gắn cờ | BR-INV-06 |
| Hàng chuyển kho thiếu hoặc hỏng khi nhận | Bên nhận ghi biên bản kèm ảnh; phần chênh lệch treo trên hàng đang đi đường cho đến khi xử lý | BR-INV-05 |

Hai tình huống cần kế toán của khách quyết định trước khi thiết kế: thuế suất áp dụng khi lệnh mở qua mốc 1/1/2027, và cách ghi nhận tiền đặt cọc theo Nghị định 254/2026/NĐ-CP.

### Tình huống bổ sung ở bản 0.2

| Tình huống | Xử lý trong hệ thống | BR |
| --- | --- | --- |
| Khách mang xe đến chi nhánh khác để bảo hành | Chi nhánh nhận mở lệnh bảo hành gắn với lệnh gốc ở chi nhánh khác; chi phí ghi theo chính sách khách chốt \[Cần xác nhận\] | BR-REC-08 |
| Khách doanh nghiệp thanh toán gộp nhiều hóa đơn | Một khoản thanh toán được phân bổ cho nhiều hóa đơn; phần dư ghi thành khoản nhận trước | BR-ACC-09 |
| Hóa đơn được trả nhiều lần | Mỗi lần thu là một phiếu thu; trạng thái thanh toán đổi từ chưa thu sang thu một phần rồi đã thu đủ | BR-ACC-09 |
| Hoàn tiền cho khách | Phiếu hoàn có phê duyệt, trừ vào quỹ hoặc chuyển khoản, liên kết hóa đơn điều chỉnh nếu cần | BR-ACC-11 |
| Nhà cung cấp giao thiếu so với đơn mua | Phiếu nhập ghi phần đã nhận; đơn mua còn mở cho lần giao tiếp theo | BR-PUR-01 |
| Trả hàng lỗi cho nhà cung cấp | Phiếu trả hàng trừ tồn và giảm công nợ phải trả | BR-PUR-01 |
| Khách trả lại phụ tùng chưa lắp | Phiếu nhập trả từ khách, hoàn kho, điều chỉnh hóa đơn nếu đã xuất | BR-INV-12 |
| Báo giá bị từ chối một phần | Hạng mục bị từ chối được lưu để nhắc ở lần sau | BR-REC-11 |
| Xe đổi chủ | Quan hệ sở hữu mới có ngày hiệu lực, lịch sử cũ giữ nguyên | BR-CRM-07 |
| Số km nhập thấp hơn lần trước | Cảnh báo và yêu cầu lý do trước khi lưu | BR-REC-01 |

### Tình huống bổ sung ở bản 0.3

| Tình huống | Xử lý trong hệ thống | BR |
| --- | --- | --- |
| Khách tự đặt lịch trên điện thoại | Chọn chi nhánh, dịch vụ, khung giờ; lịch ở trạng thái chờ đến khi nhân viên xác nhận | BR-REC-09 |
| Bảo hành tại chi nhánh khác | Chi nhánh tiếp nhận tra được lịch sử sửa chữa và điều kiện bảo hành từ chi nhánh gốc | BR-REC-08 |
| Khách doanh nghiệp vượt hạn mức công nợ | Cảnh báo khi lập lệnh và chặn bàn giao hoặc cần duyệt theo chính sách \[Cần xác nhận\] | BR-ACC-13 |
| Bán phụ tùng lẻ tại quầy | Phiếu bán hàng riêng, trừ kho và ghi nhận thanh toán, không cần lệnh sửa chữa | BR-INV-15 |
| Chi nhánh giảm giá vượt hạn mức | Yêu cầu quản lý khu vực hoặc chủ công ty duyệt trước khi chốt | BR-INV-13 |
| Bảng giá đổi sau khi đã gửi báo giá | Báo giá giữ phiên bản giá lúc gửi; phiên bản mới dùng giá mới | BR-INV-13 |
| Bấm phát hành hóa đơn nhiều lần hoặc timeout | Mỗi yêu cầu có khóa chống trùng; truy vấn lại trạng thái trước khi phát hành lại | BR-EIN-01 |
| Chi nhánh dùng cách tính công khác chính sách chuẩn | Chỉ điều chỉnh trong quyền được cấp, có lịch sử thay đổi | BR-HRM-06 |

## 9. Nguồn tham khảo

Tra cứu ngày 30/10/2026; nội dung dựa trên kết quả tìm kiếm, cần đối chiếu nguồn gốc trước khi dùng làm căn cứ pháp lý. Nguồn pháp lý và thị trường xem thêm trong tài liệu BRD.

- [Hướng nghiệp 360, nghề cố vấn dịch vụ](https://huongnghiep360.com/vi/nghe-nghiep/service-advisor-779)
- [TopCV, mô tả việc cố vấn dịch vụ ô tô](https://www.topcv.vn/viec-lam/co-van-dich-vu-xe-o-to-di-lam-ngay/2260805.html)
- [Joboko, mô tả công việc cố vấn dịch vụ](https://vn.joboko.com/blog/mo-ta-cong-viec-cua-co-van-dich-vu-nwi1453)
- [AppMaster, luồng báo giá cho xưởng sửa chữa](https://appmaster.io/vi/blog/luong-bao-gia-xuong-sua-chua-tap-trung-tiep-nhan)
- [ACSA, lần đầu đến garage](https://acsaorg.ca/what-to-expect-throughout-your-first-visit-to-an-auto-repair-garage/)
- [OMIC Barcelona, sửa chữa xe và sự đồng ý của khách](https://ajuntament.barcelona.cat/omic/en/vehicle-repairs)
- [AAA, cách tính giá công sửa xe](https://ww2.aaa.com/autorepair/articles/car-repair-labor-rates-explained)
- [AutoLeap, lương theo giờ chuẩn](https://autoleap.com/glossary/flat-rate-pay)
- [Beancount, giờ chuẩn và giờ thực](https://beancount.io/nl/blog/2026/05/19/auto-repair-shop-bookkeeping-flat-rate-vs-clock-hours-parts-matrix-markup-comeback-warranty-receivables-sublet-epa-hazmat-shop-supplies-effective-labor-rate-guide)
- [AZTAX, kế toán gara ô tô](https://aztax.com.vn/ke-toan-dich-vu-sua-chua-o-to/)
- [Kế toán Bách Khoa, điểm mới Nghị định 254/2026](https://ketoanbachkhoa.vn/diem-moi-nghi-dinh-254-2026-nd-cp/)

**Bổ sung ở bản 0.2**

- [Tekmetric, thực hiện kiểm tra xe số](https://tours.tekmetric.com/answers/performing-an-inspection-tekmetric)
- [Tekmetric, chữ ký số và duyệt báo giá](https://tours.tekmetric.com/answers/digital-signature-authorization-process-tekmetric)
- [Shopmonkey HQ, chuyển kho giữa các địa điểm](https://support.shopmonkey.io/hc/en-us/articles/42720891279508-Shopmonkey-HQ-Inventory-Transfers)
- [Mitchell 1, Time Manager](https://mitchell1.com/press/mitchell-1-manager-se-adds-new-time-management-features/)
- [AutoVitals, hiệu suất và năng suất kỹ thuật viên](https://blog.autovitals.com/technician-efficiency)
- [ShopView, giờ tính tiền, giờ khả dụng và giờ làm việc](https://shopview.com/blog/billable-hours-per-diesel-technician)
- [Tire Review, định nghĩa năng suất khác](https://www.tirereview.com/what-is-your-roadmap-to-profitability/)
