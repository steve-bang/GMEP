# 09. Quyết định chưa chốt và đã chốt

Tài liệu liệt kê điều còn mở (đánh dấu **[Chưa chốt]**) để bạn không giả định, điều đã chốt, và cách xử lý khi gặp điểm chưa chốt trong lúc thiết kế. Người đọc: designer; tra cứu khi gặp điểm mơ hồ.

Toàn bộ yêu cầu của dự án là bản nháp chưa được khách xác nhận chính thức. Mục 2 gồm các quyết định do **chủ dự án hoặc khách hàng đã đưa ra** và các quy tắc nghiệp vụ nền tảng mà dự án đang dùng để xây (những quy tắc này ổn định, nhưng vẫn nằm trong bản nháp). Mục 3 là điều **chưa quyết**: không hard-code, không đặt tên hay con số cụ thể vào giao diện.

## 1. Cách đọc

| Nhãn | Ý nghĩa |
| --- | --- |
| Đã chốt | Chủ dự án hoặc khách đã quyết; bạn có thể xem là cố định |
| Quyết định tạm | Đội dự án đã chọn để đi tiếp, đang chờ khách xác nhận; thiết kế theo nhưng dễ đổi |
| **[Chưa chốt]** | Chưa có quyết định; thiết kế linh hoạt theo mục 4 |
| Minh họa | Con số ví dụ chỉ để dựng mockup |

## 2. Đã chốt

| # | Quyết định | Ý nghĩa với thiết kế |
| --- | --- | --- |
| 1 | **Tên sản phẩm là GMEP** (tên cũ "GARAGE OS" bỏ hẳn) | Dùng "GMEP" trong khung ứng dụng và đăng nhập. Tên hiển thị nên đọc từ một biến cấu hình duy nhất, không nhúng vào nhiều chỗ. Chứng từ in dùng tên garage của khách |
| 2 | **Chỉ tiếng Việt**, tiền VND, ngày `dd/MM/yyyy` | Không thiết kế đa ngôn ngữ; không cần chỗ trống cho đổi ngôn ngữ |
| 3 | **Không có xác thực hai lớp (MFA)**, kể cả cho vai trò nền tảng | Không thiết kế màn nhập mã/thiết lập MFA; đăng nhập bằng mật khẩu; thao tác nhạy cảm yêu cầu nhập lại mật khẩu |
| 4 | **Một email có thể thuộc nhiều công ty (tenant)**; một danh tính, nhiều tư cách thành viên; phiên làm việc thuộc đúng một công ty | Cần màn "Chọn công ty" (hiện sau khi mật khẩu đúng và chỉ khi có từ 2 công ty), lối "Đổi công ty" trong phiên; danh sách chỉ gồm công ty của chính người đó; email đặt lại mật khẩu nêu áp dụng cho mọi công ty của email |
| 5 | **Hệ thống nhiều công ty ngay từ đầu** (một nền tảng dùng chung; chủ garage khác sẽ tự đăng ký; nhân viên chỉ vào bằng lời mời) | Thiết kế nhận biết công ty ở khung ứng dụng và đăng nhập; mọi dữ liệu tách theo công ty rồi chi nhánh |
| 6 | **Không hiển thị giá, gói dịch vụ, dùng thử** trong giao diện | Không thiết kế màn hay banner liên quan; không đặt bộ đếm ngày |
| 7 | **Web responsive** (desktop quầy, tablet xưởng, điện thoại quản lý); không ứng dụng native | Thiết kế theo breakpoints, không theo kiểu app riêng |
| 8 | **Kế toán là kế toán vận hành**; khách giữ phần mềm kế toán riêng, hệ thống kết xuất dữ liệu cuối kỳ | Không thiết kế báo cáo tài chính chính thức, tờ khai thuế, tính lương |
| 9 | **Hóa đơn điện tử đi qua lớp tích hợp không phụ thuộc cứng một nhà cung cấp**; phát hành không trùng khi bấm nhiều lần/timeout | Không logo/tên nhà cung cấp; thiết kế theo trạng thái và chỉ báo chung; khóa chống trùng |
| 10 | **Lệnh sửa chữa là chứng từ gốc**; năm đối tượng có bộ trạng thái riêng | Tài liệu 05 mục 1 |
| 11 | **Tồn kho có bốn số**; cảnh báo/chặn theo khả dụng | Tài liệu 05 mục 4 |
| 12 | **Giao dịch tài chính đã ghi sổ không xóa** | Tài liệu 05 mục 6 |
| 13 | **Quy tắc đổi theo luật/chính sách là cấu hình có ngày hiệu lực** | Tài liệu 05 mục 9 |
| 14 | **Che dữ liệu cá nhân theo vai trò**, nhật ký truy cập | Tài liệu 05 mục 10 |
| 15 | **Mất mạng chỉ cảnh báo và lưu nháp**; không offline đầy đủ | Tài liệu 05 mục 15 |
| 16 | **Công thợ**: kết hợp giờ chuẩn, khoán, giờ thực, tỷ lệ theo loại việc; chính sách chuẩn của công ty, chi nhánh điều chỉnh có kiểm soát (công thức cụ thể chưa chốt, xem mục 3) | Màn công/hoa hồng là cấu hình, không cố định công thức |
| 17 | **Quy mô thiết kế** (ước tính của khách): 8 chi nhánh hiện tại, 20 sau 2 năm; 120–200 xe/ngày, sau 2 năm 500–800; 80–100 người dùng, sau 2 năm 250–300 | Dùng cho mật độ và hiệu năng; chưa phải số xác nhận |
| 18 | **Duyệt báo giá**: qua liên kết, Zalo/SMS hoặc nhân viên ghi nhận tại quầy; duyệt một phần | Thiết kế cả ba cách; kênh cụ thể chưa chốt (mục 3) |
| 19 | **Dịch vụ**: sửa chung, bảo dưỡng, lốp và bánh xe, đồng sơn (đồng sơn cần luồng riêng) | Quy trình theo loại dịch vụ là cấu hình |

### 2.1 Quyết định tạm (chờ khách xác nhận, thiết kế đã theo)

| # | Quyết định tạm | Ghi chú |
| --- | --- | --- |
| T1 | Thu tiền theo lệnh, chốt ca/ngày và phát hành hóa đơn **thuộc giai đoạn 1** | FRD gốc xếp kế toán vào giai đoạn 2; dự án đã kéo vào giai đoạn 1 ở mức tối thiểu |
| T2 | Báo giá có thêm trạng thái thứ 7 **"Đã hủy"** | Nếu không chấp nhận: dùng cờ hủy kèm lý do trên Nháp/Hết hạn |
| T3 | Thợ mất mạng ở giai đoạn 1: **chặn** ghi giờ + phiếu giấy + "Nhập bù" | Chính sách gần nhất, thay các cách tiếp cận khác |
| T4 | Lệnh tự chuyển Đã duyệt → Đang sửa khi hạng mục đầu tiên "Đang làm"; chuyển **Chờ QC do người dùng bấm** (hệ thống chỉ nhắc) | |
| T5 | Chính sách mật khẩu: tối thiểu 10 ký tự, chặn mật khẩu thông dụng, không dùng 5 mật khẩu gần nhất, khóa tạm sau nhiều lần sai | Tham số cấu hình; các số chỉ minh họa |
| T6 | Phiên: khóa màn hình sau không hoạt động (30 phút; quản trị/kế toán/chủ 15 phút; tablet xưởng 3 phút); phiên tối đa 12 giờ | Tham số cấu hình |
| T7 | Che dữ liệu cá nhân theo bảng ở tài liệu 02 mục 5 | Cấu hình được |
| T8 | Trang khách qua liên kết, không tài khoản; hiệu lực mặc định 7 ngày (cấu hình) | |
| T9 | Phê duyệt nhiều cấp: quy tắc ở tài liệu 04 mục 3.1 | Ngưỡng và thời hạn nhắc/chuyển cấp là minh họa |
| T10 | Làm mới tự động khoảng 15–30 giây cho bảng điều phối và hàng chờ; màn khác làm mới thủ công | |
| T11 | Garage một chi nhánh, một kho: giao diện ẩn bộ chọn chi nhánh/kho; mô hình dữ liệu không đổi (tài liệu 05 mục 17) | Đề xuất của đội dự án, chờ khách xác nhận |

## 3. Chưa chốt

| # | Mục | Tình trạng | Ảnh hưởng đến thiết kế | Cách thiết kế linh hoạt |
| --- | --- | --- | --- | --- |
| 1 | **Nhà cung cấp hóa đơn điện tử** | **[Chưa chốt]** (khách đã có một nhà cung cấp nhưng chưa xác nhận) | Màn hóa đơn, cấu hình tích hợp, trạng thái đồng bộ | Không logo/tên; trạng thái và chỉ báo chung; môi trường thử/thật tách biệt |
| 2 | **Kênh gửi tin cho khách: Zalo/SMS/email** | **[Chưa chốt]** nhà cung cấp | Gửi báo giá, nhắc bảo dưỡng, gửi hóa đơn | Kênh chưa cấu hình: trạng thái "Chưa kích hoạt", nút gửi khóa kèm giải thích; luôn có đường in/sao chép liên kết |
| 3 | **Công thức công thợ và hoa hồng** | **[Chưa chốt]**; cần khảo sát bảng lương | Màn công, hoa hồng, năng suất, "Công của tôi" | Chỉ hiển thị giờ chuẩn, giờ thực, dòng công; công thức là cấu hình có ngày hiệu lực; không cố định phép tính |
| 4 | **Hạn mức/ngưỡng phê duyệt** (giảm giá, chi, hoàn tiền, chuyển kho, điều chỉnh kho, chênh lệch quỹ, mua hàng) | **[Chưa chốt]** (chủ garage ban hành) | Hàng chờ duyệt, mọi nút "cần duyệt" | Không viết cứng số; lấy từ cấu hình; hạn mức chưa ban hành thì lên cấp cao nhất và hiện cảnh báo |
| 5 | **Thời hạn lưu dữ liệu, nhật ký, ẩn danh** | **[Chưa chốt]** (kế toán và luật sư xác nhận) | Màn chính sách lưu trữ, yêu cầu của chủ dữ liệu | Tham số cấu hình |
| 6 | **Mô hình giá/gói dịch vụ của nền tảng** | **[Chưa chốt]** | Không có | **Không nêu giá, gói, dùng thử trong UI** |
| 7 | **Quy trình đồng sơn/thân vỏ** | **[Chưa chốt]**; cần khảo sát xưởng | Bảng đồng sơn, quy trình theo loại dịch vụ | Công đoạn lấy từ cấu hình; khối hạng mục mở rộng được |
| 8 | **Thiết bị: model tablet, điện thoại, máy in, khổ in cuối cùng** | **[Chưa chốt]** | Mẫu in, kích cỡ chạm | Thiết kế theo khổ (A4, A5, nhiệt 80mm, 58mm cấu hình), không theo hãng; kiểm tra trên nhiều kích thước |
| 9 | **Một hay nhiều pháp nhân** | Giả định một pháp nhân, **[Chưa chốt]** | Bộ lọc pháp nhân, báo cáo, đơn vị phát hành hóa đơn | Bộ lọc pháp nhân **ẩn khi chỉ có một**; báo cáo chính thức không cộng gộp qua pháp nhân |
| 10 | **Phương pháp giá vốn** (xu hướng bình quân gia quyền, kế toán xác nhận) | **[Chưa chốt]** | Màn giá vốn, lãi gộp | Hiển thị "phương pháp đang dùng" lấy từ cấu hình |
| 11 | **Chính sách bảo hành chéo chi nhánh** (chi nhánh nào chịu chi phí) | **[Chưa chốt]** | Màn bảo hành | Trường "chi nhánh chịu chi phí" cấu hình được |
| 12 | **Vai trò Quản lý vùng có tồn tại không; có "nhóm chi nhánh" không** | **[Chưa chốt]** | Dashboard vùng, bộ chọn phạm vi | Thiết kế bộ chọn có/không nhóm; dashboard vùng P2 |
| 13 | **Vai trò quản trị trụ sở, nhân viên QC, trưởng kho, quản lý vận hành** (chưa có mã vai trò chính thức) | **[Chưa chốt]** | Ma trận quyền, hàng chờ duyệt | Vai trò và cấp duyệt lấy từ cấu hình; thêm vai trò không đổi cấu trúc |
| 14 | **Số năm lịch sử sửa chữa cần chuyển từ Excel** | **[Chưa chốt]** | Màn nhập Excel | Tham số của màn nhập |
| 15 | **Thời điểm lập hóa đơn; ghi nhận tiền đặt cọc; thuế suất khi lệnh mở qua 01/01/2027; nhóm hàng áp 8%** | **[Chưa chốt]**; kế toán của khách xác nhận | Phát hành hóa đơn, báo giá, thu tiền | Cấu hình có ngày hiệu lực; không hard-code |
| 16 | **Kiểm tra xe số (INS) vào giai đoạn 1 hay không** | Chờ khách xác nhận | 3 màn P1 | Thiết kế bình thường; luồng tiếp nhận có nhánh có/không INS |
| 17 | **Cách đăng nhập của thợ/nhân viên không có email** (mã công ty + mã nhân viên; PIN thiết bị xưởng; mã tạm do quản lý cấp) | **[Chưa chốt]** chi tiết | Màn đăng nhập, thiết bị xưởng | Thiết kế biến thể email và biến thể thiết bị xưởng; ô định danh chấp nhận email hoặc mã nhân viên |
| 18 | **Mã OTP cho khách duyệt báo giá** | **[Chưa chốt]**; cần nhà cung cấp SMS | Trang khách | Bước tùy chọn bật/tắt theo cấu hình |
| 19 | **Chính sách lưu xe khi khách không nhận; công nợ doanh nghiệp (chặn bàn giao hay cần duyệt)** | **[Chưa chốt]** | Giao xe, công nợ | Hai biến thể hiển thị |
| 20 | **Số lượng thập phân theo đơn vị (lít) hay chỉ nguyên; quy ước mã phụ tùng** | **[Chưa chốt]** | Ô số lượng, danh mục | Ô số lượng hỗ trợ thập phân theo cấu hình đơn vị |
| 21 | **Làm tròn thuế theo dòng hay theo hóa đơn** | **[Chưa chốt]** (kế toán chốt) | Tổng báo giá/hóa đơn | Chỉ hiển thị số do máy chủ tính |
| 22 | **Chiến dịch tin nhắn marketing** (phạm vi, kênh) | **[Chưa chốt]** | Màn gửi tin | P2; khóa khi chưa có kênh |
| 23 | **Chế độ tối (dark mode)** | Không phát hành đợt 1 | Token | Cấu trúc token sẵn sàng |
| 24 | **Giới hạn kỹ thuật của chuyển đổi dữ liệu: ngày, số dòng mỗi lô** | **[Chưa chốt]** | Màn nhập Excel | Hiển thị giới hạn lấy từ cấu hình |

## 4. Cách xử lý khi gặp điều chưa chốt

1. **Thiết kế linh hoạt**: coi giá trị chưa chốt là **dữ liệu cấu hình**, không phải nhãn cố định hay con số cố định trong giao diện (ví dụ không vẽ "Hạn mức: 5%" như sự thật; vẽ "Hạn mức giảm giá: {giá trị cấu hình}").
2. **Ghi giả định**: ở trang Handoff của file thiết kế, thêm mục "Giả định" cho mỗi điểm chưa chốt bạn đã gặp: giả định là gì, màn nào bị ảnh hưởng, nếu khách chọn khác thì sửa gì.
3. **Không chờ**: không dừng công việc để chờ quyết định; chỉ hỏi chủ dự án nếu điểm đó chặn việc chọn bố cục.
4. **Hỏi theo lô**: gom câu hỏi, kèm mã màn hình và mục tài liệu; mỗi câu nêu **phương án, khuyến nghị của bạn và tác động của từng phương án**.
5. **Không tự quyết nghiệp vụ**: nếu thấy cần thêm trạng thái, thêm vai trò, thêm loại chứng từ, thay đổi một quy tắc ở tài liệu 05: hỏi trước.
6. **Minh họa**: mọi con số mẫu (hạn mức, thuế, đơn giá giờ công) trong mockup là minh họa; nếu có thể, ghi chú "ví dụ" cạnh số.

## 5. Điểm tài liệu có thể mâu thuẫn nhau (để bạn biết)

| Điểm | Chi tiết | Cách bạn nên xử lý |
| --- | --- | --- |
| Màu và nhãn trạng thái | Hướng dẫn thiết kế gốc gọi "Chờ tiếp nhận", "Chờ duyệt báo giá", "Sẵn sàng bàn giao" như trạng thái của lệnh, nhưng nghiệp vụ tách báo giá và lệnh thành hai đối tượng | **Nghiệp vụ thắng**: theo tài liệu 05 mục 1.1 |
| Xác thực hai lớp | Một số tài liệu cũ vẫn nhắc MFA cho vai trò quản lý trở lên | **Đã chốt không MFA** (mục 2, #3) |
| Cách đăng nhập | Tài liệu cũ yêu cầu ô "mã công ty"; bản mới: email + mật khẩu, mã công ty chỉ dùng nội bộ/hỗ trợ | Theo bản mới (email + mật khẩu, sau đó chọn công ty); biến thể mã nhân viên là [Chưa chốt] |
| Số vai trò | Có "10 vai trò" trong ma trận gốc, và "12 vai trò" khi tính thêm mua hàng, nhân sự | Dùng 10 vai trò + MH + NS (tài liệu 02) |
| Thợ mất mạng | Hai tài liệu cũ trái nhau (chặn so với ghi giờ cục bộ) | Theo chính sách gần nhất: chặn + Nhập bù |
| Tên sản phẩm | Prototype nội bộ còn chỗ ghi tên cũ | Dùng GMEP |
