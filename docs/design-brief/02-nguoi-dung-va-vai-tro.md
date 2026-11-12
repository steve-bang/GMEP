# 02. Người dùng và vai trò

Tài liệu mô tả ai dùng GMEP, họ làm gì, dùng thiết bị nào, vai trò nào được xem và làm gì, và vai trò ảnh hưởng thế nào đến giao diện. Người đọc: designer bên ngoài; đọc trước khi vẽ bất kỳ màn hình nào.

Lưu ý nguồn: các persona dựng từ mô tả công việc công khai và thực tiễn ngành, **cần kiểm chứng bằng phỏng vấn nhân sự thật của khách**. Phần "nỗi đau khi dùng Excel" là giả định chưa xác nhận.

## 1. Persona chính

### 1.1 Chủ garage (CH)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu trong ngày | Biết chi nhánh nào lãi, lỗ, có thất thoát không; duyệt khoản lớn; phát hiện chi nhánh bất thường |
| Bối cảnh | Buổi sáng mở điện thoại xem doanh thu hôm qua theo chi nhánh; cuối tháng xem lãi lỗ; thường không ngồi ở quầy |
| Thiết bị | **Điện thoại**, laptop |
| Nỗi đau | Phải chờ cuối tháng mới có số; số liệu mỗi chi nhánh một kiểu |
| Màn dùng nhiều | Dashboard chủ garage (hợp nhất), hàng chờ phê duyệt, so sánh chi nhánh, báo cáo lãi lỗ |
| Ví dụ kịch bản | 8 giờ sáng thấy chi nhánh A có 18 xe đang sửa, 4 xe quá hạn dự kiến; chi nhánh B thiếu phụ tùng; chi nhánh C chi phí phát sinh cao bất thường. Từ mỗi cảnh báo, đi sâu xuống lệnh, xem người chịu trách nhiệm |

### 1.2 Quản lý chi nhánh (QL)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Xe ra vào đúng hẹn, tồn kho đủ, chốt ngày nhanh (dưới 30 phút), duyệt kịp thời |
| Bối cảnh | Sáng xem xe, nhân sự, hàng sắp hết; trong ngày duyệt giảm giá, hủy lệnh, điều chỉnh kho; cuối ngày chốt ngày; cuối tháng kiểm kê, xem năng suất thợ |
| Thiết bị | Máy tính văn phòng, tablet, điện thoại |
| Nỗi đau | Gom số từ nhiều file, không thấy tiến độ từng xe |
| Màn dùng nhiều | Dashboard chi nhánh, bảng điều phối, hàng chờ phê duyệt, chốt ngày |

### 1.3 Cố vấn dịch vụ (CV): đầu mối của cả quy trình

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tiếp khách, báo giá nhanh, cập nhật tiến độ, giao xe |
| Bối cảnh | Đứng ở quầy, khách đang chờ; vừa nói chuyện với khách vừa nhập; gọi điện cho khách báo giá |
| Thiết bị | **Máy tính tại quầy**, tablet |
| Nỗi đau (giả định) | Không tìm thấy lịch sử xe; không biết xe đang ở giai đoạn nào; khách không xác nhận rõ từng hạng mục; thay đổi báo giá không lưu lịch sử; không biết phụ tùng đã sẵn sàng chưa; khách gọi hỏi tiến độ mà nhân viên không có thông tin |
| Màn dùng nhiều | Tiếp nhận xe, lập báo giá, chi tiết lệnh sửa chữa, bảng điều phối, giao xe |
| Hệ quả thiết kế | Giao diện của vai trò này quyết định tốc độ cả quy trình: ít bước, tự điền, tìm theo biển số tức thì |

### 1.4 Quản đốc và nhân viên kiểm tra chất lượng (QĐ)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Phân việc hợp lý cho thợ, kiểm tra chất lượng (QC) cuối đúng checklist, trả xe đúng hẹn |
| Thiết bị | **Tablet**, desktop |
| Màn dùng nhiều | Phân thợ và tải việc, hàng chờ QC, thực hiện QC |
| Ghi chú | Chấm QC và gửi QC nhưng không tạo/sửa lệnh, không thu tiền |

### 1.5 Thợ / kỹ thuật viên (TH)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết xe nào làm trước, lấy đúng phụ tùng, công được ghi đúng |
| Bối cảnh | Xưởng ồn, tay dính dầu mỡ, đứng; tablet **dùng chung** giữa nhiều thợ; thời gian cho thao tác rất ít |
| Thiết bị | **Tablet tại xưởng** (nút lớn) |
| Nỗi đau (giả định) | Việc giao miệng; công tính sau nên dễ tranh cãi |
| Màn dùng nhiều | Chọn tên + PIN, "Việc của tôi", bắt đầu/tạm dừng/kết thúc hạng mục, yêu cầu phụ tùng, báo hư hỏng phát sinh, "Công của tôi" |
| Yêu cầu cứng | Bắt đầu hoặc kết thúc hạng mục **tối đa 2 chạm**; chỉ thấy việc của mình; không thấy giá, số điện thoại, địa chỉ khách (chỉ tên rút gọn + biển số) |

### 1.6 Thủ kho (TK)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Nhập, xuất đúng phiếu, kiểm kê khớp |
| Thiết bị | Máy tính tại kho; điện thoại quét mã vạch |
| Nỗi đau (giả định) | Xuất theo lời nói, không có chứng từ gốc |
| Màn dùng nhiều | Yêu cầu cấp phụ tùng, phiếu xuất, phiếu nhập, tồn kho bốn số, chuyển kho, kiểm kê |
| Ghi chú | Không thấy giá vốn và giá trị tiền (hiện che) |

### 1.7 Thu ngân (TN)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Thu đúng, đối chiếu quỹ, in phiếu, chốt ca |
| Thiết bị | Máy tính tại quầy (có thể có máy in nhiệt) |
| Màn dùng nhiều | Thu tiền theo lệnh, danh sách phiếu thu, sổ quỹ, chốt ca, phát hành hóa đơn |
| Ghi chú | Không thấy công nợ, giá vốn, lãi lỗ |

### 1.8 Kế toán (KT)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Đối chiếu thu chi, công nợ, xuất hóa đơn đúng hạn, khóa kỳ, kết xuất dữ liệu |
| Thiết bị | Máy tính (bảng dày) |
| Nỗi đau (giả định) | Nhập lại số liệu từ Excel của từng chi nhánh |
| Màn dùng nhiều | Dashboard kế toán, hóa đơn (kể cả hóa đơn lỗi), công nợ phải thu/phải trả, đối soát, khóa kỳ |
| Ghi chú | "Kế toán trưởng" không phải vai trò riêng mà là một cờ quyền của kế toán (duyệt hóa đơn điều chỉnh/thay thế/hủy) |

### 1.9 Các vai trò còn lại

| Vai trò | Mục tiêu | Thiết bị | Màn dùng nhiều |
| --- | --- | --- | --- |
| Quản lý vùng (QV) `[Chưa chốt có hay không]` | So sánh hiệu quả chi nhánh trong nhóm được giao; duyệt cấp vùng | Điện thoại, desktop | Dashboard vùng, hàng chờ phê duyệt |
| Nhân viên mua hàng (MH) | Tạo đơn mua từ yêu cầu đã duyệt, theo dõi nhà cung cấp giao hàng | Desktop | Yêu cầu mua, đơn mua, nhà cung cấp |
| Nhân sự (NS) | Hồ sơ nhân viên, chấm công, bảng công | Desktop | Danh sách nhân sự, ca và chấm công, bảng công |
| Quản trị hệ thống (AD) | Cấu hình, phân quyền, hỗ trợ trong một tenant; **không xem dữ liệu nghiệp vụ nhạy cảm của khách** | Desktop | Người dùng, vai trò, tích hợp, nhật ký, nhập Excel |
| Quản trị trụ sở | Tạo danh mục, mẫu kiểm tra, chính sách giá dùng chung cho các chi nhánh | Desktop | Danh mục dùng chung (chưa có mã vai trò chính thức) |

Tại garage nhỏ, **một người thường kiêm nhiều vai trò**: một tài khoản được gán nhiều vai trò, quyền cộng gộp theo từng chi nhánh; có "góc nhìn vai trò" để đổi trang chủ (xem mục 4).

### 1.10 Khách hàng (không có tài khoản)

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết giá trước khi làm, biết xe làm tới đâu, duyệt hạng mục, nhận hóa đơn |
| Nỗi đau (giả định) | Lo bị tính thêm, không hiểu hạng mục |
| Thiết bị | **Điện thoại**, mở liên kết gửi qua Zalo/SMS (kênh gửi chưa chốt) |
| Màn dùng | Trang duyệt báo giá (toàn phần hoặc một phần), trang theo dõi tiến độ xe, trang đặt lịch hẹn; không đăng nhập; liên kết có thời hạn |
| Yêu cầu | Chữ tối thiểu 16px; ngôn ngữ đơn giản; số điện thoại/địa chỉ hiển thị che một phần; nút ≥ 44px |

### 1.11 Nhân sự nền tảng (nội bộ, quy mô nhỏ)

Bốn vai trò vận hành nền tảng (chủ nền tảng, quản trị nền tảng, hỗ trợ, vận hành thanh toán) dùng một khung quản trị riêng, không có bộ chọn chi nhánh. Họ **mặc định không xem dữ liệu nghiệp vụ của tenant**. Không phải trọng tâm đợt 1.

## 2. Mười vai trò trong tenant và quyền ở mức tóm tắt

Quyền xác định bởi **hai thứ cùng lúc: vai trò và phạm vi chi nhánh**. Ký hiệu: **S** tạo và sửa, **D** duyệt (kèm xem), **X** chỉ xem, **Xn** chỉ xem phần của mình, **-** không có quyền.

Cột: CH chủ garage · QV quản lý vùng · QL quản lý chi nhánh · CV cố vấn dịch vụ · QĐ quản đốc (gồm nhân viên QC) · TH thợ · TK thủ kho · TN thu ngân · KT kế toán · AD quản trị hệ thống.

| Nhóm chức năng | CH | QV | QL | CV | QĐ | TH | TK | TN | KT | AD |
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

Ghi chú quan trọng:

- Hóa đơn điều chỉnh, thay thế, hủy cần **kế toán trưởng** duyệt (cờ quyền của KT).
- AD cấu hình được nhưng **không xem dữ liệu nghiệp vụ nhạy cảm của khách**, vì luật bảo vệ dữ liệu cá nhân yêu cầu hạn chế truy cập theo nhu cầu.
- QL chỉ tạo/sửa người dùng trong chi nhánh của mình; người dùng vai trò cao hơn do CH hoặc AD tạo.
- Quyền chia theo hành động: xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất dữ liệu, quản lý. Ví dụ thủ kho được tạo phiếu xuất nhưng không tự duyệt phiếu xuất bất thường; không có quyền xuất thì không tải được danh sách khách.

Hai vai trò bổ sung (chưa có cột trong ma trận gốc, mặc định các chức năng khác là **không có quyền**):

| Vai trò | Có quyền |
| --- | --- |
| MH nhân viên mua hàng | Tạo yêu cầu mua, đơn mua, nhận hàng cùng thủ kho (S); xem tồn và danh mục (X, không thấy giá vốn) |
| NS nhân sự | Tạo/sửa hồ sơ nhân sự, ca và giờ công (S); xem công thợ và hoa hồng (X); dữ liệu nhạy cảm của nhân viên có ma trận che riêng |

Quyền **chi tiết hơn ở từng màn hình**, ví dụ:

| Dữ liệu | Ai thấy |
| --- | --- |
| Giá vốn | Chỉ CH, QV, QL, KT; vai trò khác thấy `•••••` kèm tooltip lý do |
| Công nợ khách | Chủ yếu KT; CV không vào màn công nợ |
| Công nợ, giá vốn, lãi lỗ | TN không thấy |
| Giá và giá trị tiền trong yêu cầu phê duyệt kho | TK không thấy |
| Giá, số điện thoại, địa chỉ khách | TH không thấy (tên rút gọn + biển số) |
| Danh sách khách xuất ra tệp | Chỉ người có quyền "xuất dữ liệu", có lý do, ghi nhật ký |

## 3. Phạm vi dữ liệu

| Vai trò | Thấy dữ liệu của |
| --- | --- |
| CH | Toàn chuỗi (trong tenant của mình): từng chi nhánh, nhóm chi nhánh hoặc hợp nhất |
| QV | Nhóm chi nhánh được giao (nhóm có tồn tại hay không: [Chưa chốt]) |
| QL, KT, MH, NS | Các chi nhánh được gán; chọn từng chi nhánh; không hợp nhất |
| CV, QĐ, TH, TK, TN | Chi nhánh của mình (một chi nhánh) |
| TH | Chỉ việc của bản thân |
| AD | Toàn tenant về cấu hình; không gắn chi nhánh nghiệp vụ |
| Khách | Chỉ thông tin xe của mình qua liên kết |

Một người nhiều chi nhánh/nhiều vai trò: quyền cộng gộp theo từng chi nhánh, có thể khác nhau ở từng chi nhánh (ví dụ quản lý ở Quận 7, thủ kho ở Thủ Đức).

## 4. Cách vai trò ảnh hưởng đến giao diện (nguyên tắc bắt buộc)

| # | Nguyên tắc | Mô tả |
| --- | --- | --- |
| 1 | Menu theo vai trò | Mục sidebar chỉ hiện nếu có quyền. Mỗi mục kèm chế độ quyền dạng chữ nhỏ ("Chỉ xem", "Của tôi", "Danh mục", "Hệ thống") |
| 2 | Mỗi vai trò một trang chủ | 10 dashboard riêng (tài liệu 03 mục 3.1). Người nhiều vai trò vào vai trò cao nhất và đổi "góc nhìn vai trò" ở menu tài khoản, **không cộng dồn thẻ** |
| 3 | Nút bị chặn nêu lý do | Nút không đủ quyền hoặc chưa đủ điều kiện nghiệp vụ **không bị ẩn** (nếu người dùng có quyền xem mục đó): hiện trạng thái khóa kèm lý do bằng chữ (không chỉ tooltip). Ví dụ "Chưa thể gửi: thiếu phiếu hoàn kho cho 2 dòng phụ tùng". Chi tiết ở tài liệu 05 mục 12 |
| 4 | Che dữ liệu nhạy cảm | Số điện thoại, địa chỉ che theo vai trò, nút "Hiện" ghi nhật ký (bảng ở mục 5) |
| 5 | Ẩn giá trị tiền | Giá vốn, giá trị tiền với vai trò không được xem (thủ kho, thu ngân…) hiện `•••••` hoặc bỏ cột, tùy mức nhạy cảm |
| 6 | Phạm vi luôn hiện | Mọi KPI, bảng, báo cáo, tệp xuất ghi chi nhánh, khoảng thời gian, thời điểm cập nhật |
| 7 | Bản ghi ngoài phạm vi | Trả "không tìm thấy" giống hệt bản ghi không tồn tại; không lộ sự tồn tại |
| 8 | Shell rút gọn cho thợ | Menu chỉ "Việc của tôi", "Công của tôi"; nút lớn |
| 9 | Hành động nguy hiểm | Cần xác nhận, lý do bắt buộc hoặc quyền đặc biệt/phê duyệt |
| 10 | Máy chủ quyết, UI hiển thị | Thiết kế giả định mỗi bản ghi mang cờ "được phép làm" và "lý do không được" từ máy chủ; UI không tự suy ra quyền |

### Bộ chọn phạm vi chi nhánh

| Tình huống | Hiển thị |
| --- | --- |
| Đúng 1 chi nhánh | Không có bộ chọn; chip tĩnh "Chi nhánh của bạn: …" |
| Từ 2 chi nhánh | Nút mở bảng chọn; người nhiều chi nhánh không phải CH/QV chọn từng chi nhánh (nhớ lựa chọn gần nhất), không có chế độ hợp nhất |
| CH, QV | Mặc định "Tất cả chi nhánh được phép" để xem; muốn **tạo** chứng từ phải chọn đúng một chi nhánh (mỗi chứng từ gắn một chi nhánh) |
| Hợp nhất không được phép | Tab "Hợp nhất" vẫn hiện nhưng khóa, kèm đoạn lý do thường trực |
| Chi nhánh "ngừng nhận lệnh mới" / "khóa chỉ xem" | Vẫn chọn được để tra cứu; tag cảnh báo; nút tạo mới khóa kèm lý do |
| Chi nhánh không được gán | **Không liệt kê**; chỉ ghi "Bạn được gán N chi nhánh" |
| Đổi phạm vi khi đang soạn chứng từ | Hỏi lưu nháp trước |
| Pháp nhân | Bộ lọc phụ, **ẩn khi chỉ có một pháp nhân** |

## 5. Che dữ liệu cá nhân theo vai trò

Đề xuất mặc định (bảng quyền che cấu hình được, không hard-code):

| Vai trò | Số điện thoại | Địa chỉ | Nút "Hiện" |
| --- | --- | --- | --- |
| CV, QL, TN, QĐ (chi nhánh mình) | Đầy đủ | Đầy đủ | Không cần (ghi nhật ký khi mở hồ sơ) |
| CH, QV | Che | Che số nhà/đường | Có, ghi nhật ký, không cần lý do |
| KT | Che | Che | Có, **bắt buộc chọn lý do** (Đối chiếu hóa đơn / Thu hồi công nợ / Lý do khác) |
| TK | Che | Không hiển thị | Không |
| TH, AD | Không hiển thị | Không hiển thị | Không |

Định dạng che: số điện thoại `09•• ••• 123`; email `a•••@gmail.com`; địa chỉ chỉ quận/huyện, tỉnh/thành. Trong **danh sách** chỉ che (không có nút Hiện). Khi bấm "Hiện": tải giá trị đầy đủ từ máy chủ (giá trị đầy đủ không có sẵn trong trang), tự che lại sau 30 giây, mỗi lần Hiện ghi nhật ký truy cập.

## 6. Ma trận menu theo vai trò (tóm tắt)

Xem bảng đầy đủ ở tài liệu 03 mục 2.
