# GMEP – Bộ tài liệu brief thiết kế giao diện web

Bộ tài liệu này giúp một designer hoặc team UI/UX bên ngoài tự thiết kế lại giao diện web của GMEP mà không cần hỏi lại phần lớn câu cơ bản. Người đọc là designer senior chưa biết gì về dự án. Mọi tài liệu đều tự đủ: không cần truy cập mã nguồn hay tài liệu nội bộ.

Phiên bản brief: 1.0 · Ngày lập: 12/11/2026 · Ngôn ngữ: tiếng Việt

## 1. Mục đích

GMEP là nền tảng web quản lý chuỗi garage ô tô tại Việt Nam, thay hoàn toàn cách quản lý bằng Excel: từ tiếp nhận xe, báo giá, lệnh sửa chữa, kho phụ tùng, thu tiền đến hóa đơn điện tử, xem được theo từng chi nhánh và hợp nhất cho chủ garage.

Dự án đã có một thiết kế nội bộ dạng prototype HTML. Chủ dự án muốn nhờ bên ngoài **thiết kế lại giao diện** với bố cục và phong cách thị giác mới nếu đẹp hơn và đúng best practice hơn. Nếu thiết kế của bạn đạt tiêu chí nghiệm thu (tài liệu 07), chủ dự án sẽ áp dụng vào sản phẩm.

Thiết kế nội bộ hiện có chỉ là **hiện trạng để tham khảo, không bắt buộc theo**. Bạn được tự do đề xuất lại bố cục, phong cách, hệ màu, kiểu điều hướng. Bạn **không được phá các ràng buộc nghiệp vụ và an toàn dữ liệu** liệt kê ở mục "Ràng buộc cứng" (tài liệu 06 mục 4, chi tiết lý do ở tài liệu 05).

## 2. Mục lục và thứ tự đọc

| # | Tài liệu | Nội dung | Đọc khi nào |
| --- | --- | --- | --- |
| 00 | 00-README.md | Bìa, hướng dẫn, câu hỏi kickoff | Đầu tiên |
| 01 | 01-boi-canh-san-pham.md | Sản phẩm, khách hàng, mục tiêu, quy mô, thiết bị, pháp lý | Đọc ngay sau README |
| 02 | 02-nguoi-dung-va-vai-tro.md | Persona, 10 vai trò, quyền, phạm vi dữ liệu, ảnh hưởng đến UI | Trước khi vẽ bất kỳ màn nào |
| 03 | 03-kien-truc-thong-tin-va-danh-muc-man-hinh.md | Sơ đồ điều hướng, danh mục khoảng 190 màn, ưu tiên | Khi lập kế hoạch |
| 04 | 04-luong-nghiep-vu-chinh.md | Các luồng đầu-cuối, điểm quyết định, ngoại lệ | Trước khi thiết kế luồng |
| 05 | 05-quy-tac-nghiep-vu-anh-huong-giao-dien.md | Quy tắc bắt buộc thể hiện trên UI, kèm "vì sao" | Đọc kỹ, đây là phần dễ sai nhất |
| 06 | 06-hien-trang-thiet-ke-va-dinh-huong.md | Thiết kế hiện tại, điểm yếu, được đổi gì, không được đổi gì, tiêu chí chấm | Trước khi chốt hướng thị giác |
| 07 | 07-san-pham-ban-giao-va-tieu-chi-nghiem-thu.md | Phải giao gì, mốc review, bảng chấm điểm | Khi lập báo giá và kế hoạch làm |
| 08 | 08-brief-tung-man-hinh-uu-tien.md | Brief chi tiết 25 màn quan trọng nhất | Khi thiết kế từng màn |
| 09 | 09-quyet-dinh-chua-chot.md | Điều chưa chốt, điều đã chốt, cách xử lý | Khi gặp điểm mơ hồ |
| 10 | 10-tu-dien-thuat-ngu.md | Thuật ngữ gara Việt – Anh | Tra cứu |
| 11 | 11-du-lieu-mau.md | Bộ dữ liệu mẫu giả nhất quán để đổ vào mockup | Khi dựng mockup |

Thứ tự đọc đề nghị: 00, 01, 02, 05, 04, 03, 06, 07, rồi 08 và 11 khi vào việc; 09 và 10 tra cứu khi cần. Thời gian đọc khoảng 2 đến 3 giờ cho phần cốt lõi (00 đến 07).

## 3. Quy ước dùng trong bộ tài liệu

| Ký hiệu | Ý nghĩa |
| --- | --- |
| **[Chưa chốt]** | Quyết định còn mở của khách hoặc chủ dự án. Không được giả định; thiết kế linh hoạt và ghi giả định (tài liệu 09 mục 4) |
| **[điền]** | Thông tin chủ dự án sẽ điền trước khi gửi (liên hệ, mốc thời gian, kênh) |
| **Minh họa** | Con số hoặc ví dụ chỉ để dựng mockup, không phải quy tắc kinh doanh |
| Mã như `RULE-010`, `FR-REC-001`, `BR-REC-04` | Mã tham chiếu trong tài liệu yêu cầu nội bộ của dự án (bạn không cần có tài liệu đó). Có thể trích mã khi hỏi lại chủ dự án để họ tra nhanh |
| Mã màn hình như `G2-REC-04` | Mã nhận diện màn hình trong danh mục ở tài liệu 03; dùng làm tên frame hoặc trang trong file thiết kế |
| D / T / M | Thiết bị: Desktop (quầy, văn phòng), Tablet (xưởng), Mobile (quản lý, khách). Chữ in đậm là thiết bị chính |
| P0 / P1 / P2 | Thứ tự thiết kế: P0 làm trước (đợt 1), P1 đợt 2, P2 đợt sau. Định nghĩa ở tài liệu 03 mục 4 |

Toàn bộ yêu cầu nghiệp vụ của dự án là **bản nháp, chưa được khách hàng xác nhận chính thức**. Chỗ nào chưa chốt đều đã đánh dấu; các chỗ còn lại là điều dự án đang dùng để xây và bạn có thể coi là nền tảng ổn định.

## 4. Những gì bạn cần giao (tóm tắt, chi tiết ở tài liệu 07)

1. Hệ thống thiết kế: design tokens (sáng; tối nếu bạn đề xuất), thư viện component đủ biến thể và trạng thái.
2. Khung ứng dụng (shell), mẫu trang (dashboard, danh sách, chi tiết, form, cấu hình, in ấn).
3. Toàn bộ màn hình đợt 1 (P0) ở đủ trạng thái và đủ 5 độ rộng (320, 390, 768, 1024, 1440); các đợt sau theo lộ trình thỏa thuận.
4. Prototype tương tác cho các luồng P0.
5. Mẫu in: phiếu nhiệt 80mm và A4.
6. Ghi chú trợ năng (WCAG 2.2 AA), tài liệu bàn giao cho lập trình viên (khoảng cách, hành vi, microcopy tiếng Việt).
7. Bản ánh xạ token cũ sang token mới (nếu bạn đổi token) để đội phát triển chuyển đổi.

## 5. Thông tin liên hệ và mốc thời gian

| Hạng mục | Nội dung |
| --- | --- |
| Người đầu mối phía dự án | [điền] |
| Email/kênh liên hệ chính | [điền] |
| Kênh hỏi đáp hằng ngày (chat/nhóm) | [điền] |
| Buổi kickoff | [điền: ngày, giờ, hình thức] |
| Mốc 1: hướng thị giác và khung ứng dụng (moodboard, 3 màn mẫu) | [điền] |
| Mốc 2: thư viện component và token | [điền] |
| Mốc 3: màn hình P0 và prototype | [điền] |
| Mốc 4: nghiệm thu đợt 1 và bàn giao | [điền] |
| Các đợt sau (P1, P2) | [điền] |
| Hình thức và đầu mối nhận phản hồi | [điền] |
| Ngân sách/hợp đồng | [điền] |

## 6. Bảo mật và dữ liệu

- Toàn bộ dữ liệu trong bộ tài liệu này (tên khách, biển số, số điện thoại, số tiền, hóa đơn, mã số thuế) là **dữ liệu giả** dùng cho mockup. Không dùng dữ liệu thật của khách hàng ở bất kỳ đâu trong quá trình thiết kế. Nếu có số trùng với người hoặc xe thật thì chỉ là ngẫu nhiên.
- Tài liệu có thông tin chưa công bố về sản phẩm và mô hình kinh doanh. Không chia sẻ ngoài team được giao việc.
- Đề xuất ký thỏa thuận bảo mật (NDA) trước khi nhận tài liệu: [điền: mẫu NDA, người ký, hạn].
- Khi dùng công cụ AI hoặc dịch vụ bên thứ ba để hỗ trợ thiết kế, không đưa nguyên văn tài liệu này lên dịch vụ công khai nếu chưa được chủ dự án đồng ý bằng văn bản [điền: chính sách].
- Quyền sở hữu trí tuệ của sản phẩm bàn giao, quyền dùng lại thư viện icon/font của bên thứ ba: [điền].

## 7. Tài liệu kèm theo do chủ dự án cung cấp (nếu có)

| Tài liệu | Ghi chú |
| --- | --- |
| Ảnh chụp màn hình thiết kế nội bộ hiện có | [điền: đường dẫn hoặc tệp đính kèm]. Chỉ để tham khảo |
| Bản demo tương tác prototype nội bộ | [điền: có hay không, truy cập thế nào] |
| Logo GMEP và quy định thương hiệu | [điền]. Nếu chưa có, bạn được đề xuất wordmark tạm cho "GMEP" |
| Mẫu chứng từ giấy thực tế của khách (nếu khách cung cấp) | [điền] |

## 8. Câu hỏi nên làm rõ ở buổi kickoff

Các câu dưới đây giúp hai bên thống nhất kỳ vọng. Một số đã có câu trả lời trong bộ tài liệu, ghi chú bên cạnh.

| # | Câu hỏi | Gợi ý/nơi có thông tin |
| --- | --- | --- |
| 1 | Mức độ tự do: bạn có được đổi sidebar thành kiểu điều hướng khác, đổi hệ màu thương hiệu hoàn toàn không? | Được đổi, trừ ràng buộc cứng (06 mục 4) |
| 2 | Thương hiệu: đã có logo, màu thương hiệu, tone giọng chưa? | [điền]; tên sản phẩm là "GMEP" (09 mục 2) |
| 3 | Lập trình viên dùng công nghệ nào và thư viện component nào, để thiết kế khả thi? | Ứng dụng web React; chi tiết xem 07 mục 8 |
| 4 | Có được đề xuất dùng thư viện UI có sẵn (ví dụ bộ component mã nguồn mở) làm nền? Giấy phép? | [điền] |
| 5 | Thiết bị thật: tablet xưởng, điện thoại, máy in nhiệt cụ thể là model nào? | Chưa chốt (09). Thiết kế theo khổ giấy, không theo hãng |
| 6 | Có dark mode không? | Không phát hành ở đợt 1; cấu trúc token nên sẵn sàng (07 mục 3) |
| 7 | Phông chữ: bắt buộc Be Vietnam Pro hay được đề xuất phông khác (miễn hỗ trợ đầy đủ dấu tiếng Việt, có số tabular)? | 06 mục 3 |
| 8 | Bộ icon: bắt buộc Lucide hay được chọn bộ khác? | 06 mục 3 |
| 9 | Ai quyết định cuối ở phía dự án, và có bao nhiêu vòng phản hồi? | [điền] |
| 10 | Thứ tự ưu tiên có thể đổi không? Có thể thiết kế vừa P0 vừa mẫu một màn cấu hình dài ngay từ đầu để kiểm chứng hệ thống? | 03 mục 4 |
| 11 | Dữ liệu mẫu có đủ không, hay cần thêm kịch bản (ví dụ xe đồng sơn, doanh nghiệp công nợ)? | 11 |
| 12 | Có được test nhanh với người dùng thật (cố vấn, thợ, thủ kho) không? Có thể tổ chức ở đâu, khi nào? | [điền] |
| 13 | Các điểm "Chưa chốt" (hóa đơn điện tử, Zalo/SMS, công thức công, hạn mức duyệt, đồng sơn): xử lý bằng thiết kế linh hoạt, bạn có đồng ý không? | 09 mục 4 |
| 14 | Ngôn ngữ UI chỉ tiếng Việt; bạn có cần hỗ trợ viết microcopy hay chủ dự án cung cấp? | 07 mục 6 |
| 15 | Phạm vi trang công khai cho khách (duyệt báo giá, theo dõi tiến độ, đặt lịch): thiết kế trong đợt nào? | 03, 08 |
| 16 | Có yêu cầu về hiệu năng thị giác (ví dụ không dùng ảnh nặng, hiệu ứng) vì thợ dùng tablet đời cũ không? | Mục tiêu thao tác thường dưới 2 giây trên 4G (01 mục 5) |
| 17 | Cách làm việc: dùng công cụ nào (Figma hoặc tương đương), chia sẻ thế nào, ai có quyền chỉnh sửa? | 07 mục 1 |
| 18 | Cơ chế thay đổi phạm vi (change request) nếu chủ dự án đổi yêu cầu giữa chừng? | [điền] |
