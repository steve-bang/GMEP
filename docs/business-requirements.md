# Garage ERP – BRD (Business Requirements Document)

Oct 30, 2026 · @Sang PHAM

## 1. Tóm tắt điều hành

Garage ERP thay toàn bộ Excel của chuỗi garage bằng một nền tảng web duy nhất, đi từ tiếp nhận xe đến xuất hóa đơn điện tử, xem được theo từng chi nhánh và hợp nhất cho chủ garage.

Excel không lưu lịch sử chỉnh sửa, không biết ai sửa gì, và chỉ cần nhập sai một dòng là tồn kho lệch ([MISA AMIS](https://amis.misa.vn/254461/bieu-mau-quan-ly-kho-phu-tung-o-to-xe-may/)). Với chuỗi nhiều cửa hàng, rủi ro nhân lên theo số chi nhánh. Từ 2026, khung pháp lý về hóa đơn, kế toán và dữ liệu cá nhân cùng thay đổi, nên việc tiếp tục dùng bảng tính càng rủi ro.

| Hạng mục | Nội dung |
| --- | --- |
| Khách hàng | Chủ chuỗi garage ô tô, nhiều cửa hàng trên toàn quốc |
| Mục tiêu cốt lõi | Một hệ thống duy nhất cho quy trình, công việc, nhân công, kho, phụ tùng, khách hàng, doanh thu, kế toán, hóa đơn |
| Người dùng chính | Chủ garage, quản lý chi nhánh, cố vấn dịch vụ, thợ, thủ kho, kế toán, thu ngân |
| Nền tảng | Web responsive: máy tính tại quầy, tablet tại xưởng, điện thoại cho quản lý |
| Khung pháp lý áp dụng | Nghị định 254/2026/NĐ-CP (hóa đơn), Thông tư 99/2025/TT-BTC hoặc 152/2025/TT-BTC (kế toán), Luật Bảo vệ dữ liệu cá nhân 2025 |
| Multi-tenant (bản 0.4, 06/11/2026) | Khách quyết ngày 05/11/2026: hệ thống thiết kế **multi-tenant từ đầu** (nền tảng SaaS dùng chung), chủ garage khác **tự đăng ký và tự triển khai**, có **gói dịch vụ thu tiền, làm sau theo phase**. Chủ dự án quyết thêm ngày 06/11/2026: một email thuộc nhiều tenant (RULE-034), tenant không gán gói là miễn phí hoàn toàn không trial (RULE-035), bỏ MFA cho vai trò nền tảng (R-TEN-13), tên sản phẩm GMEP. Các BR-TEN, RULE-016 đến 035 bên dưới là cách BA cụ thể hóa các quyết định này, **chờ khách xác nhận** (trừ các điểm vừa nêu); chi tiết ở `docs/multi-tenant-analysis.md` |
| Trạng thái tài liệu | Bản nháp 0.3 (cộng bổ sung multi-tenant bản 0.4), chưa phải BRD đã được khách xác nhận (có thêm câu trả lời Discovery của khách, mục 10); dựa trên nghiên cứu thị trường, benchmark quốc tế, tài liệu BA tham khảo và pháp lý đến 30/10/2026. Chưa có file Excel thực tế của khách, nên các mục đánh dấu \[Cần xác nhận\] phải chốt với chủ garage |

## 2. Bối cảnh và vấn đề hiện tại

Mỗi chi nhánh chạy Excel riêng là một hòn đảo dữ liệu, nên chủ garage không có con số hợp nhất đủ tin cậy để ra quyết định.

| Vấn đề khi quản lý bằng Excel | Hậu quả với chuỗi garage | Yêu cầu liên quan |
| --- | --- | --- |
| Hồ sơ xe và lịch sử bảo dưỡng ghi rời rạc, khó tra cứu ([MISA AMIS](https://amis.misa.vn/245705/phan-mem-quan-ly-gara-o-to/)) | Mất thời gian tra cứu, không nhắc được lịch bảo dưỡng, bảo hiểm | BR-CRM |
| Tồn kho phụ tùng phụ thuộc thao tác tay; quên phiếu xuất hoặc trùng mã là báo cáo lệch ([MISA AMIS](https://amis.misa.vn/254461/bieu-mau-quan-ly-kho-phu-tung-o-to-xe-may/)) | Lệch tồn, thất thoát, khó truy vết | BR-INV |
| Không lưu lịch sử chỉnh sửa, nhiều người mở một file dễ xung đột ([MISA AMIS](https://amis.misa.vn/254461/bieu-mau-quan-ly-kho-phu-tung-o-to-xe-may/)) | Không biết ai sửa số liệu, không có trách nhiệm giải trình | BR-SYS |
| Thông tin khách nằm ở Excel kế toán, điện thoại, nhóm Zalo, sổ tay ([MISA AMIS](https://amis.misa.vn/262249/phan-mem-quan-sale-phu-tung/)) | Không có hồ sơ khách thống nhất, khó chăm sóc lại | BR-CRM |
| Khách lấy hàng không trả ngay nên phải ghi công nợ tay ([MISA eShop](https://www.misaeshop.vn/?p=5415)) | Nhầm công nợ phải thu, phải trả | BR-ACC |
| Mỗi chi nhánh một file, không hợp nhất \[Cần xác nhận với khách\] | Không biết chi nhánh nào lãi, lỗ; không điều chuyển được phụ tùng | BR-RPT, BR-INV |

### Giải pháp có sẵn trên thị trường

Có nhiều sản phẩm gần với bài toán này, nên quyết định xây mới hay mua cần được chốt rõ với khách (xem mục Câu hỏi cần xác nhận).

| Sản phẩm | Phạm vi được mô tả | Nguồn |
| --- | --- | --- |
| SGARA | Xe, khách, bảo hiểm, báo giá, lệnh sửa chữa, kho phụ tùng, thu chi, nhân sự, nhắc lịch bảo dưỡng | [App Store](https://apps.apple.com/bb/app/sgara/id1602944979) |
| Carsoft | Vòng đời khách, xe, hợp đồng, kho, tài chính; phân quyền chi tiết, báo cáo đa chiều | [FPT Shop](https://fptshop.com.vn/tin-tuc/danh-gia/phan-mem-quan-ly-gara-o-to-189081) |
| MISA AMIS (giải pháp ô tô) | Nhiều chi nhánh, kế toán theo thông tư, liên thông nhắc bảo dưỡng và bảo hiểm | [MISA AMIS](https://amis.misa.vn/245705/phan-mem-quan-ly-gara-o-to/) |
| AutoCare Pro (Ấn Độ) | Chuyển phụ tùng giữa chi nhánh, báo cáo hợp nhất, lãi lỗ theo địa điểm | [MDM Solutions](https://mdmsolutions.biz/products/autocarpro) |

Tiêu chí chọn phần mềm gara cần cân nhắc tổng chi phí sở hữu, gồm triển khai, đào tạo và nhập liệu ban đầu, không chỉ phí bản quyền ([FPT Shop](https://fptshop.com.vn/tin-tuc/danh-gia/phan-mem-quan-ly-gara-o-to-189081)).

### Benchmark quốc tế

Ba sản phẩm nước ngoài dưới đây là chuẩn tham chiếu thiết kế cho chuỗi garage, không phải đối thủ trực tiếp tại Việt Nam. Các số liệu tăng trưởng trong tài liệu giới thiệu của nhà cung cấp không được dùng làm KPI cam kết.

| Sản phẩm | Điều đáng học | Áp dụng vào Garage ERP |
| --- | --- | --- |
| Tekmetric | Kiểm tra xe số có ảnh, video và mức xanh, vàng, đỏ; hạng mục vàng và đỏ tự vào danh sách lỗi và báo giá ([Tekmetric](https://tours.tekmetric.com/answers/performing-an-inspection-tekmetric)); duyệt báo giá bằng chữ ký số, bản giấy hoặc xác nhận bằng lời tại quầy ([Tekmetric](https://tours.tekmetric.com/answers/digital-signature-authorization-process-tekmetric)); lưu hạng mục khách từ chối để tiếp tục ở lần sau ([Tekmetric](https://tours.tekmetric.com/answers/digital-vehicle-inspection-software-7-features-to-look-for)) | Phân hệ kiểm tra xe số (INS), nhiều cách duyệt báo giá, lưu hạng mục bị từ chối |
| Tekmetric Multi-Shop | Quản lý tập trung mẫu kiểm tra, công việc mẫu, giảm giá, hình thức thanh toán rồi phát hành cho cửa hàng được chọn; so sánh cửa hàng theo hơn 50 chỉ số; lịch sử khách dùng chung; tìm tồn kho giữa các cửa hàng; người dùng báo cáo giới hạn chỉ thấy cửa hàng của mình ([Tekmetric](https://tours.tekmetric.com/answers/how-to-manage-multiple-auto-repair-shops-with-tekmetric-multi-shop), [Tekmetric](https://support.tekmetric.com/hc/en-us/articles/8592880372119-Tekmetric-Multi-Shop-Intro)) | Danh mục dùng chung do trụ sở phát hành, so sánh chi nhánh, lịch sử xe xuyên chi nhánh, phân quyền theo chi nhánh |
| Shopmonkey HQ | Xem tồn kho ở địa điểm khác, tạo yêu cầu chuyển ngay từ lệnh công việc, theo dõi trạng thái từ yêu cầu đến hoàn tất, có thông báo ([Shopmonkey](https://support.shopmonkey.io/hc/en-us/articles/42720891279508-Shopmonkey-HQ-Inventory-Transfers)) | Chuyển kho liên chi nhánh khởi tạo từ lệnh sửa chữa |
| Mitchell 1 Manager SE | Thợ bấm giờ theo từng công đoạn, tạm dừng khi nghỉ, giờ kết thúc tự điền vào giờ thực của lệnh; đồng hồ ca làm tách khỏi đồng hồ công việc ([Mitchell 1](https://mitchell1.com/press/mitchell-1-manager-se-adds-new-time-management-features/)) | Ghi giờ công theo hạng mục, tách chấm công ca khỏi giờ công việc |

## 3. Mục tiêu kinh doanh và chỉ số thành công

Ba mục tiêu chính: dừng dùng Excel, kiểm soát thất thoát phụ tùng và công thợ, và cho chủ garage số liệu hợp nhất theo ngày. Các mức mục tiêu dưới đây là đề xuất, cần đo baseline hiện tại của khách trước khi chốt.

| Mục tiêu | Chỉ số đo | Mức đề xuất | Cách đo |
| --- | --- | --- | --- |
| Thay hoàn toàn Excel | Tỷ lệ nghiệp vụ phát sinh nhập trên hệ thống | 100% sau giai đoạn chạy song song | Đối chiếu với file Excel cũ trong 1 tháng |
| Kiểm soát phụ tùng | Chênh lệch kiểm kê so với tồn trên hệ thống | Dưới 2% giá trị tồn mỗi kỳ kiểm kê | Báo cáo kiểm kê hàng tháng |
| Truy vết xuất kho | Tỷ lệ phụ tùng xuất kho gắn với một lệnh sửa chữa hoặc phiếu bán lẻ | 100% | Báo cáo xuất kho không có chứng từ gốc phải bằng 0 |
| Tốc độ phục vụ | Thời gian từ nhận xe đến gửi báo giá cho khách | Dưới 15 phút với hạng mục thường gặp | Mốc thời gian trong lệnh sửa chữa |
| Số liệu theo ngày | Thời gian chốt doanh thu cuối ngày của chi nhánh | Dưới 30 phút | Khảo sát quản lý chi nhánh |
| Hợp nhất toàn chuỗi | Độ trễ để chủ xem lãi lỗ từng chi nhánh | Cuối mỗi ngày, không cần chờ cuối tháng | Dashboard chủ garage |
| Tuân thủ hóa đơn | Tỷ lệ lệnh sửa chữa hoàn tất có hóa đơn điện tử đúng hạn | 100% | Báo cáo đối chiếu lệnh và hóa đơn |
| Giữ chân khách | Tỷ lệ xe quay lại bảo dưỡng theo lịch nhắc | Đo baseline rồi đặt mục tiêu | Báo cáo CRM |

Các chỉ số này cũng là căn cứ nghiệm thu giai đoạn pilot ở một chi nhánh trước khi mở rộng.

### Chỉ số vận hành bổ sung

Các nhóm KPI sau bổ sung cho bảng trên; mọi mục tiêu định lượng chỉ đặt sau khi có số liệu nền của khách.

| Nhóm | Chỉ số |
| --- | --- |
| Vận hành | Số xe tiếp nhận mỗi ngày; thời gian trung bình hoàn thành một lệnh; tỷ lệ lệnh hoàn thành đúng hạn |
| Bán hàng | Giá trị trung bình mỗi lệnh sửa chữa; tỷ lệ báo giá được khách chấp nhận |
| Nhân công | Hiệu suất (Efficiency) và mức sử dụng (Utilization) của thợ, định nghĩa ở tài liệu Workflow mục 5 |
| Kho | Vòng quay tồn kho; độ chính xác tồn kho; hao hụt |
| Tài chính | Doanh thu và lợi nhuận gộp theo chi nhánh; công nợ phải thu còn lại |
| Khách hàng | Tỷ lệ khách quay lại; mức hài lòng |

### Mười câu hỏi chủ garage cần trả lời được mỗi sáng

Hệ thống đạt mục tiêu khi chủ garage trả lời được các câu sau từ dashboard mà không cần gọi từng chi nhánh:

- Hôm nay toàn hệ thống có bao nhiêu xe đang sửa?
- Chi nhánh nào đang hoạt động tốt nhất?
- Lệnh sửa chữa nào đang chậm tiến độ?
- Thợ nào đang quá tải?
- Phụ tùng nào đang thiếu hoặc tồn lâu?
- Chi nhánh nào doanh thu cao nhưng lợi nhuận thấp?
- Khách còn nợ tổng cộng bao nhiêu?
- Tiền mặt tại mỗi chi nhánh có khớp với hệ thống không?
- Khoản chi nào chưa được phê duyệt?
- Chi nhánh nào đang có vấn đề cần chủ can thiệp?

## 4. Phạm vi

Hệ thống bao gồm 10 phân hệ vận hành chuỗi garage; kế toán ở mức vận hành và hạch toán tự động, còn lập báo cáo tài chính và khai thuế chính thức do bộ phận kế toán thực hiện \[Cần xác nhận\].

### Trong phạm vi

| Mã | Phân hệ | Nội dung chính | Giai đoạn |
| --- | --- | --- | --- |
| REC | Tiếp nhận và lệnh sửa chữa | Nhận xe, kiểm tra sơ bộ, báo giá, khách duyệt, lệnh sửa chữa, phân thợ, kiểm tra cuối, giao xe | 1 |
| CRM | Khách hàng và xe | Hồ sơ khách, hồ sơ xe theo biển số, lịch sử sửa chữa, lịch hẹn, nhắc bảo dưỡng và đăng kiểm | 1 |
| INV | Kho và phụ tùng | Danh mục, tồn theo chi nhánh, nhập, xuất, kiểm kê, chuyển kho liên chi nhánh, nhà cung cấp, định mức tồn | 1 và 2 |
| HRM | Nhân sự và nhân công | Ca làm, giờ công, công thợ theo việc, hoa hồng, năng suất | 2 |
| ACC | Doanh thu và kế toán | Thu chi, công nợ khách và nhà cung cấp, giá vốn, lãi lỗ theo chi nhánh, chốt ca và chốt ngày | 2 và 3 |
| EIN | Hóa đơn điện tử | Xuất hóa đơn qua nhà cung cấp, đồng bộ trạng thái, điều chỉnh và thay thế | 1 (cơ bản), 3 (đầy đủ) |
| SYS | Phân quyền và đa chi nhánh | Vai trò, quyền theo chi nhánh, nhật ký thao tác, cấu hình | 1 |
| RPT | Báo cáo và dashboard | Dashboard chủ garage, báo cáo chi nhánh, đối chiếu | 1 đến 4 |

### Phân hệ bổ sung ở bản 0.2

Hai phân hệ dưới đây tách ra từ REC và INV của bản 0.1 để dễ đặc tả và nghiệm thu.

| Mã | Phân hệ | Nội dung chính | Giai đoạn |
| --- | --- | --- | --- |
| INS | Kiểm tra xe số | Mẫu kiểm tra, ảnh và video, mức xanh vàng đỏ, chuyển lỗi thành dòng báo giá | 1 |
| PUR | Mua hàng | Yêu cầu mua, phê duyệt, đơn mua, nhận hàng nhiều lần, hóa đơn và trả hàng nhà cung cấp | 2 |

### Multi-tenant (bản 0.4, quyết định của khách 05/11/2026)

Multi-tenant **thuộc phạm vi**, không còn nằm ngoài phạm vi. Nền tảng là một hệ thống dùng chung; mỗi khách hàng độc lập là một **tenant** với dữ liệu, cấu hình, người dùng tách hẳn. Phân cấp: Nền tảng → Tenant → Công ty (pháp nhân) → Chi nhánh → Kho. Khác với "nhiều pháp nhân" (FR-SYS-018, chuyện trong một tenant).

| Mã | Nội dung | Đợt | Giai đoạn |
| --- | --- | --- | --- |
| TEN, MT-0 Nền | Mã tenant là lớp phạm vi ngoài cùng; hồ sơ và vòng đời tenant; vai trò nền tảng tách riêng; cấu hình tích hợp theo tenant; kiểm thử cô lập có trục tenant; đưa dữ liệu hiện có thành tenant số 1; một danh tính, nhiều tư cách thành viên (FR-TEN-017, nâng từ MT-3 ngày 06/11/2026) (15 FR) | MT-0 | **Giai đoạn 1 (cùng pilot), bắt buộc** |
| TEN, MT-1 Tự phục vụ có kiểm soát | Tự đăng ký, xác minh doanh nghiệp, chống lạm dụng, cấp phát tự động, onboarding gọn, điều khoản và thỏa thuận xử lý dữ liệu, hạn chế/tạm ngưng/chấm dứt/xuất/xóa, hỗ trợ (21 FR) | MT-1 | Sau pilot ổn định (**đã chốt theo ủy quyền 06/11/2026**, Q37; mở đăng ký hai nấc); là điều kiện mở đăng ký cho người ngoài |
| TEN, MT-2 Gói tùy chọn và hạn mức | Gói mặc định miễn phí (không trial, không đếm ngược; quyết định 06/11/2026), danh mục gói tùy chọn, hạn mức, bật/tắt module, đo mức dùng (14 FR) | MT-2 | Sau; nền không được chặn |
| TEN, MT-3 Thu tiền | Thanh toán gói, hóa đơn của nền tảng, xử lý nợ phí (5 FR) | MT-3 | Sau; nền không được chặn |

Ngoài phạm vi của multi-tenant ở đợt đầu: tenant ngoài Việt Nam (ngôn ngữ, tiền tệ khác), tùy biến giao diện sâu (đổi màu; design tokens bắt buộc giữ nguyên), mã riêng theo từng tenant (chỉ cấu hình), chia sẻ dữ liệu giữa tenant, chuyển bản ghi trực tiếp giữa tenant. Các điểm này là đề xuất của BA, chờ chủ dự án xác nhận (Q6, Q15, Q17, Q19, Q22).

### Ngoài phạm vi giai đoạn đầu

- Quản lý hồ sơ giám định bảo hiểm và bồi thường phức tạp (tách thành giai đoạn 4 nếu khách có nhu cầu).
- Tính lương, đóng bảo hiểm xã hội và khai thuế thu nhập cá nhân chính thức; hệ thống chỉ cung cấp dữ liệu công và hoa hồng.
- Lập báo cáo tài chính và tờ khai thuế; hệ thống kết xuất dữ liệu sang phần mềm kế toán đang dùng.
- Bán xe, cho thuê xe, thương mại điện tử phụ tùng.
- Ứng dụng di động riêng cho khách hàng (giai đoạn 1 chỉ có thông báo qua SMS hoặc Zalo).

Các hạng mục sau cũng ngoài phạm vi và cần đánh giá riêng khi khách có nhu cầu; ngoài phạm vi không có nghĩa là không bao giờ làm:

- Tích hợp trực tiếp với hệ thống của hãng xe.
- AI dự đoán lỗi và tự động chẩn đoán xe.
- CRM marketing nâng cao với chiến dịch nhiều bước và phân khúc phức tạp.
- Tự động tính và khai báo thuế; hệ thống chỉ cung cấp dữ liệu để kế toán thực hiện.
- Ứng dụng di động bản địa (native) cho iOS và Android; giai đoạn đầu dùng web responsive trên tablet và điện thoại.

## 5. Các bên liên quan và vai trò người dùng

Có 10 nhóm người dùng nội bộ **trong mỗi tenant**, 4 vai trò **nền tảng** (bản 0.4) và 4 bên ngoài; chủ garage là người ra quyết định, còn cố vấn dịch vụ và thợ quyết định hệ thống có được dùng thật hay không.

| Vai trò | Mô tả | Quan tâm chính | Phạm vi dữ liệu |
| --- | --- | --- | --- |
| Chủ garage | Người ra quyết định, nhà tài trợ dự án; với tenant khác là người đăng ký và ký điều khoản với nền tảng | Lãi lỗ từng chi nhánh, thất thoát, dòng tiền | Toàn chuỗi (trong tenant của mình) |
| Quản lý vùng / giám đốc vận hành | Giám sát nhiều chi nhánh \[Cần xác nhận có hay không\] | So sánh hiệu quả chi nhánh | Nhóm chi nhánh được giao |
| Quản lý chi nhánh | Điều hành một cửa hàng | Doanh thu ngày, tiến độ xe, tồn kho, nhân sự | Một chi nhánh |
| Cố vấn dịch vụ | Tiếp khách, báo giá, theo dõi tiến độ | Báo giá nhanh, chính xác, giữ chân khách | Chi nhánh của mình |
| Quản đốc / tổ trưởng xưởng | Phân việc, kiểm tra chất lượng | Phân công hợp lý, giao xe đúng hẹn | Chi nhánh của mình |
| Thợ / kỹ thuật viên | Thực hiện sửa chữa | Biết việc được giao, công được tính đúng | Việc của bản thân |
| Thủ kho | Nhập, xuất, kiểm kê phụ tùng | Tồn chính xác, phiếu rõ ràng | Kho chi nhánh |
| Thu ngân | Thu tiền, in phiếu | Thu đúng, đối chiếu quỹ | Chi nhánh của mình |
| Kế toán | Công nợ, giá vốn, hóa đơn, chốt sổ | Chứng từ đủ, hóa đơn đúng luật | Theo phân công, có thể toàn chuỗi |
| Quản trị hệ thống (quản trị tenant) | Cấu hình, phân quyền, hỗ trợ trong tenant | Vận hành ổn định, bảo mật | **Toàn tenant** (không phải toàn nền tảng), không xem số liệu nhạy cảm |
| Chủ nền tảng (CNT) | Chịu trách nhiệm kinh doanh nền tảng; duyệt ca đăng ký bị cờ, ngưỡng, chấm dứt tenant | Tăng số tenant, rủi ro lạm dụng, tuân thủ | Chỉ hồ sơ, trạng thái, số liệu tổng hợp; **không xem dữ liệu nghiệp vụ tenant** |
| Quản trị nền tảng (QTN) | Vận hành kỹ thuật, cấp phát, cấu hình mặc định và danh mục pháp lý dùng chung | Cấp phát đúng, nền tảng ổn định | Như trên; không đăng nhập thay người dùng tenant |
| Hỗ trợ nền tảng (HTN) | Hỗ trợ tenant | Giải quyết nhanh, đúng quyền | Hồ sơ và trạng thái; xem dữ liệu chỉ trong **phiên hỗ trợ** có lý do, thời hạn, đồng ý của tenant |
| Vận hành billing nền tảng (VHB) | Lập kỳ thanh toán, theo dõi công nợ phí (MT-2, MT-3) | Thu đúng, không thu trùng | Gói, mức dùng, công nợ; không xem dữ liệu nghiệp vụ |
| Khách hàng | Chủ xe | Báo giá minh bạch, biết tiến độ, nhận hóa đơn | Chỉ xem thông tin xe của mình qua liên kết |
| Nhà cung cấp phụ tùng | Giao hàng, đối chiếu công nợ | Đơn đặt rõ ràng, thanh toán đúng hạn | Không truy cập hệ thống |
| Nhà cung cấp hóa đơn điện tử | Cổng phát hành hóa đơn | Tích hợp đúng chuẩn | Qua API |
| Cơ quan thuế | Tiếp nhận hóa đơn, dữ liệu thuế | Dữ liệu đúng chuẩn, đúng hạn | Qua nhà cung cấp hóa đơn |

Bản 0.2 bổ sung bốn vai trò: quản trị trụ sở, nhân viên kiểm tra chất lượng, nhân viên mua hàng và nhân sự. Tại garage nhỏ một người thường kiêm nhiều vai trò, nên một tài khoản phải được gán nhiều vai trò với quyền cộng gộp theo từng chi nhánh (FR-SYS-012) thay vì mỗi người một chức danh duy nhất.

## 6. Yêu cầu nghiệp vụ (BR)

Có 85 yêu cầu nghiệp vụ: 53 mức Must, 29 mức Should, 3 mức Could, gồm 52 yêu cầu ban đầu, 14 yêu cầu bổ sung ở bản 0.2, 8 yêu cầu ở bản 0.3 và 11 yêu cầu multi-tenant ở bản 0.4 (BR-TEN-01 đến 11: 8 Must, 3 Should); mỗi BR được chi tiết hóa thành yêu cầu chức năng (FR) trong tài liệu Functional Requirements. Mức ưu tiên theo MoSCoW và cần khách xác nhận.

| Mã | Yêu cầu nghiệp vụ | Ưu tiên |
| --- | --- | --- |
| BR-REC-01 | Ghi nhận xe vào xưởng nhanh: biển số, số km, yêu cầu theo lời khách, tình trạng xe, ảnh | Must |
| BR-REC-02 | Lập báo giá gồm công và phụ tùng, tách hạng mục bắt buộc và tùy chọn để khách dễ quyết định | Must |
| BR-REC-03 | Khách duyệt báo giá có bằng chứng lưu lại trước khi bắt đầu sửa | Must |
| BR-REC-04 | Hạng mục phát sinh trong lúc sửa phải được khách duyệt lại và ghi vết | Must |
| BR-REC-05 | Lệnh sửa chữa là chứng từ gốc, gắn công, phụ tùng, thợ, mốc thời gian | Must |
| BR-REC-06 | Phân thợ và theo dõi trạng thái công việc theo thời gian thực | Must |
| BR-REC-07 | Kiểm tra chất lượng cuối bằng checklist trước khi giao xe | Should |
| BR-REC-08 | Quản lý bảo hành công và phụ tùng, xe quay lại sửa lỗi cũ gắn với lệnh gốc | Should |
| BR-REC-09 | Đặt lịch hẹn và theo dõi công suất xưởng | Should |
| BR-REC-10 | Gói dịch vụ bảo dưỡng định kỳ có giá và định mức cố định | Should |
| BR-CRM-01 | Hồ sơ khách (cá nhân, doanh nghiệp) và hồ sơ xe theo biển số, số khung; một khách nhiều xe | Must |
| BR-CRM-02 | Lịch sử sửa chữa của xe xem được ở mọi chi nhánh | Must |
| BR-CRM-03 | Nhắc bảo dưỡng theo số km hoặc thời gian, nhắc đăng kiểm và bảo hiểm | Should |
| BR-CRM-04 | Thông báo tiến độ cho khách qua SMS hoặc Zalo | Should |
| BR-CRM-05 | Ghi nhận sự đồng ý xử lý dữ liệu cá nhân, hỗ trợ yêu cầu xóa hoặc chỉnh sửa | Must |
| BR-CRM-06 | Khách doanh nghiệp theo hợp đồng, bảng giá riêng, công nợ theo kỳ | Could |
| BR-INV-01 | Danh mục phụ tùng chuẩn, mã duy nhất, gắn dòng xe tương thích | Must |
| BR-INV-02 | Tồn kho theo từng chi nhánh, theo lô và giá nhập | Must |
| BR-INV-03 | Nhập kho theo đơn mua, đối chiếu với nhà cung cấp | Must |
| BR-INV-04 | Mọi lần xuất kho phải gắn với lệnh sửa chữa, phiếu bán lẻ hoặc phiếu điều chuyển | Must |
| BR-INV-05 | Chuyển kho liên chi nhánh có bước gửi và nhận, theo dõi hàng đang đi đường | Must |
| BR-INV-06 | Kiểm kê định kỳ, xử lý chênh lệch có phê duyệt | Must |
| BR-INV-07 | Định mức tồn tối thiểu, cảnh báo và gợi ý đặt hàng | Should |
| BR-INV-08 | Quản lý nhà cung cấp, bảng giá, công nợ phải trả | Should |
| BR-INV-09 | Phụ tùng khách mang đến và vật tư tiêu hao của xưởng được theo dõi riêng | Should |
| BR-HRM-01 | Hồ sơ nhân sự, gán chi nhánh và chức danh | Must |
| BR-HRM-02 | Chấm công theo ca | Should |
| BR-HRM-03 | Công thợ theo việc: giờ chuẩn của hạng mục và giờ thực tế | Must |
| BR-HRM-04 | Hoa hồng và thưởng cho thợ, cố vấn theo quy tắc cấu hình | Should |
| BR-HRM-05 | Báo cáo năng suất: giờ chuẩn bán ra, giờ thực làm, giờ có mặt | Should |
| BR-ACC-01 | Thu tiền nhiều hình thức: tiền mặt, chuyển khoản, thẻ, đặt cọc | Must |
| BR-ACC-02 | Công nợ phải thu khách, phải trả nhà cung cấp, phân tích tuổi nợ | Must |
| BR-ACC-03 | Giá vốn phụ tùng theo phương pháp kế toán đã chọn | Must |
| BR-ACC-04 | Chi phí chi nhánh, thu chi nội bộ, sổ quỹ tiền mặt | Must |
| BR-ACC-05 | Chốt ca, chốt ngày, khóa kỳ; chứng từ đã khóa không được sửa | Must |
| BR-ACC-06 | Lãi lỗ theo chi nhánh và theo nguồn doanh thu (công, phụ tùng) | Must |
| BR-ACC-07 | Kết xuất dữ liệu sang phần mềm kế toán đang dùng | Should |
| BR-ACC-08 | Thuế suất cấu hình theo giai đoạn hiệu lực, không sửa mã nguồn khi luật đổi | Must |
| BR-EIN-01 | Xuất hóa đơn trực tiếp từ lệnh sửa chữa hoặc phiếu bán, không nhập lại | Must |
| BR-EIN-02 | Hóa đơn điều chỉnh, thay thế, hủy theo quy định | Must |
| BR-EIN-03 | Đồng bộ trạng thái, mã của cơ quan thuế, lưu bản XML và PDF | Must |
| BR-EIN-04 | Cấu hình đơn vị phát hành theo pháp nhân và chi nhánh | Must |
| BR-EIN-05 | Gửi hóa đơn cho khách qua email, SMS hoặc Zalo | Should |
| BR-SYS-01 | Phân quyền theo vai trò và theo chi nhánh | Must |
| BR-SYS-02 | Nhật ký thao tác cho toàn bộ dữ liệu nghiệp vụ | Must |
| BR-SYS-03 | Phê duyệt theo hạn mức: giảm giá, hủy lệnh, điều chỉnh kho | Should |
| BR-SYS-04 | Sao lưu, khôi phục dữ liệu, môi trường chạy thật ổn định | Must |
| BR-SYS-05 | Nhập dữ liệu ban đầu từ file Excel hiện có | Must |
| BR-RPT-01 | Dashboard cho chủ: doanh thu, lợi nhuận gộp, xe trong xưởng, tồn kho, công nợ | Must |
| BR-RPT-02 | Báo cáo chi nhánh theo ngày và tháng | Must |
| BR-RPT-03 | Báo cáo đối chiếu giữa lệnh sửa chữa, kho, hóa đơn và thu tiền | Must |
| BR-RPT-04 | Xuất báo cáo ra Excel và PDF | Could |

### Yêu cầu nghiệp vụ bổ sung ở bản 0.2

14 yêu cầu bổ sung sau khi đối chiếu với tài liệu BA tham khảo và các sản phẩm benchmark: 6 mức Must, 7 mức Should, 1 mức Could.

| Mã | Yêu cầu nghiệp vụ | Ưu tiên |
| --- | --- | --- |
| BR-INS-01 | Kiểm tra xe số: mẫu kiểm tra theo loại dịch vụ, ảnh và video, mức xanh vàng đỏ, chuyển lỗi thành dòng báo giá | Should |
| BR-REC-11 | Lưu hạng mục khách từ chối hoặc chưa làm để nhắc lại ở lần sau | Should |
| BR-REC-12 | Phiên bản báo giá và duyệt một phần, ghi người duyệt và thời điểm duyệt | Must |
| BR-CRM-07 | Quan hệ sở hữu xe có lịch sử: một xe có thể đổi chủ, một khách có nhiều xe | Must |
| BR-INV-10 | Phân biệt tồn thực tế, tồn giữ chỗ và tồn khả dụng; giữ chỗ phụ tùng cho lệnh | Must |
| BR-INV-11 | Theo dõi số lô hoặc serial với mặt hàng yêu cầu | Could |
| BR-INV-12 | Phụ tùng khách trả và xuất dùng nội bộ có lý do và chứng từ riêng | Should |
| BR-PUR-01 | Mua hàng: yêu cầu mua, phê duyệt, đơn mua, nhận hàng nhiều lần, hóa đơn và trả hàng nhà cung cấp \[Cần xác nhận quy trình hiện tại\] | Should |
| BR-ACC-09 | Phân bổ thanh toán nhiều-nhiều: một hóa đơn trả nhiều lần, một lần thanh toán cho nhiều hóa đơn | Must |
| BR-ACC-10 | Quy trình chi: đề xuất chi, duyệt theo hạn mức, chi tiền, ghi nhận, đối soát | Must |
| BR-ACC-11 | Hoàn tiền cho khách có phê duyệt | Should |
| BR-ACC-12 | Giao dịch ngân hàng và đối soát chuyển khoản | Should |
| BR-SYS-06 | Một tài khoản nhiều vai trò; quyền theo hành động và chi nhánh; xuất dữ liệu cần quyền riêng | Must |
| BR-SYS-07 | Chuyển cấp và nhắc việc khi phê duyệt quá hạn | Should |

### Yêu cầu nghiệp vụ bổ sung ở bản 0.3

8 yêu cầu từ câu trả lời Discovery của khách: 4 mức Must, 4 mức Should. Chi tiết vẫn cần chốt tại Discovery Workshop.

| Mã | Yêu cầu nghiệp vụ | Ưu tiên |
| --- | --- | --- |
| BR-REC-13 | Quy trình sửa chữa cấu hình được theo loại dịch vụ, không ép mọi dịch vụ đi qua một luồng | Must |
| BR-REC-14 | Luồng đồng sơn nhiều công đoạn: xem xe đang ở công đoạn nào, ai phụ trách, ngày dự kiến hoàn thành \[Cần khảo sát xưởng\] | Should |
| BR-INV-13 | Bảng giá chuẩn toàn hệ thống; chi nhánh giảm giá trong hạn mức; vượt hạn mức phải duyệt; báo giá đã gửi giữ nguyên giá khi bảng giá đổi | Must |
| BR-INV-14 | Kho tổng cấp hàng cho kho chi nhánh, bên cạnh mua trực tiếp từ nhà cung cấp và điều chuyển giữa chi nhánh | Should |
| BR-INV-15 | Bán phụ tùng lẻ tại quầy bằng phiếu bán hàng riêng, không bắt buộc có lệnh sửa chữa | Should |
| BR-INV-16 | Phương pháp giá vốn cấu hình được, mặc định bình quân gia quyền \[Kế toán xác nhận\] | Must |
| BR-ACC-13 | Khách doanh nghiệp: hạn mức công nợ, kỳ thanh toán, người liên hệ, nhiều xe thuộc một doanh nghiệp | Should |
| BR-HRM-06 | Phương pháp tính công cấu hình được (giờ chuẩn, khoán, giờ thực, tỷ lệ) với bảng định mức, hiệu lực áp dụng và lịch sử thay đổi | Must |

### Yêu cầu nghiệp vụ bổ sung ở bản 0.4 (multi-tenant)

11 yêu cầu: 8 Must, 3 Should. Nền từ quyết định của khách ngày 05/11/2026 (D1 thiết kế từ đầu, D2 tự đăng ký và tự triển khai, D3 gói thu tiền làm sau); cách cụ thể hóa là đề xuất của BA, **chờ khách xác nhận**. MoSCoW tính tương đối với chương trình multi-tenant: Must là cần trước khi mở đăng ký cho người ngoài, trong đó phần nền MT-0 thuộc giai đoạn 1.

| Mã | Yêu cầu nghiệp vụ | Ưu tiên | Căn cứ |
| --- | --- | --- | --- |
| BR-TEN-01 | Phục vụ nhiều khách hàng độc lập trên một nền tảng mà dữ liệu của khách này không bao giờ lộ cho khách khác | Must | D1 |
| BR-TEN-02 | Có quy trình cấp phát, kích hoạt, tạm ngưng, chấm dứt và xóa dữ liệu tenant có kiểm soát và có nhật ký | Must | D1 |
| BR-TEN-03 | Mỗi tenant cấu hình riêng đánh số, thuế, mẫu in, hóa đơn điện tử, kênh thông báo mà không sửa mã nguồn | Must | D1 |
| BR-TEN-04 | Nhân sự nền tảng không truy cập dữ liệu nghiệp vụ của tenant trừ khi có lý do, thời hạn, sự đồng ý và nhật ký | Must | BA (luật dữ liệu cá nhân) |
| BR-TEN-05 | Tuân thủ luật bảo vệ dữ liệu cá nhân và nghĩa vụ lưu trữ hóa đơn, chứng từ của từng tenant, kể cả khi chấm dứt dịch vụ | Must | BA (luật) |
| BR-TEN-06 | Có gói dịch vụ, hạn mức và theo dõi sử dụng để vận hành thương mại (nền có chỗ cho gói từ đầu; thu tiền làm sau) | Should | D3 |
| BR-TEN-07 | Chủ garage mới tự triển khai nhanh nhờ onboarding gọn, checklist, nhập Excel mà không cần nhân sự nền tảng | Must | D2 |
| BR-TEN-08 | Chủ nền tảng thấy sức khỏe và mức sử dụng của các tenant mà không thấy dữ liệu nghiệp vụ | Should | BA |
| BR-TEN-09 | Chủ garage bên ngoài tự đăng ký, được xác minh và tự triển khai mà không cần nhân sự nền tảng cho ca bình thường | Must | D2 |
| BR-TEN-10 | Thương mại hóa theo phase: gói dịch vụ, thu tiền, hóa đơn của nền tảng cho tenant, xử lý nợ phí; làm sau nhưng nền không bị chặn | Should | D3 |
| BR-TEN-11 | Tin cậy giữa các tenant lạ nhau và bảo vệ nền tảng: chống lạm dụng đăng ký, chống mạo danh doanh nghiệp, cô lập, kiểm soát chi phí của tenant chưa trả tiền | Must | D2 (hệ quả) |

### Quy tắc nghiệp vụ (RULE)

RULE là quy tắc cấp doanh nghiệp mà hệ thống phải tuân thủ, không chỉ là chức năng; các quy tắc WF trong tài liệu Workflow là quy tắc ở mức luồng. Cột cuối chỉ FR thực thi chính.

| Mã | Quy tắc | FR thực thi |
| --- | --- | --- |
| RULE-001 | Mỗi chi nhánh có mã định danh riêng | FR-SYS-005 |
| RULE-002 | Mỗi lệnh sửa chữa có mã duy nhất | FR-REC-030 |
| RULE-003 | Một khách có thể sở hữu nhiều xe; một xe có thể đổi chủ và vẫn giữ lịch sử, nên quan hệ sở hữu có thời hạn | FR-CRM-014 |
| RULE-004 | Một xe có nhiều lịch sử sửa chữa | FR-CRM-004 |
| RULE-005 | Không sửa chữa hạng mục cần duyệt khi chưa có xác nhận hợp lệ | FR-REC-010 |
| RULE-006 | Việc phát sinh ngoài báo giá phải ghi nhận và xin duyệt bổ sung | FR-REC-014 |
| RULE-007 | Phụ tùng xuất phải gắn với lệnh sửa chữa hoặc một lý do xuất kho hợp lệ | FR-INV-006 |
| RULE-008 | Không xuất vượt tồn khả dụng, trừ khi chính sách cho phép và có phê duyệt | FR-INV-019, FR-INV-020 |
| RULE-009 | Mọi giao dịch nhập, xuất kho đều có lịch sử | FR-INV-021 |
| RULE-010 | Giao dịch tài chính đã ghi sổ không bị xóa; xử lý bằng bút toán đảo hoặc điều chỉnh | FR-ACC-005 |
| RULE-011 | Khoản chi vượt hạn mức phải được phê duyệt | FR-ACC-018 |
| RULE-012 | Nhân viên chỉ truy cập dữ liệu trong phạm vi quyền | FR-SYS-002 |
| RULE-013 | Mọi thay đổi giá bán, chiết khấu, tồn kho và thanh toán đều được ghi nhận | FR-SYS-003 |
| RULE-014 | Lệnh đã hoàn tất vẫn tra cứu được lịch sử | FR-REC-015 |
| RULE-015 | Báo cáo nêu rõ thời điểm và phạm vi chi nhánh | FR-RPT-010 |
| RULE-016 | Mỗi bản ghi thuộc đúng một tenant, bất biến sau khi tạo; không chuyển bản ghi giữa tenant, chỉ xuất rồi nhập có duyệt (mở rộng RULE-012) | FR-TEN-009, 010 |
| RULE-017 | Không có truy cập, tìm kiếm, tổng hợp chéo tenant; nền tảng chỉ cộng gộp dữ liệu nghiệp vụ của tenant khi có đồng ý và đã ẩn danh | FR-TEN-009, 033, 038 |
| RULE-018 | Số chứng từ, mã và khóa chống trùng duy nhất **trong tenant**; không có bộ đếm toàn nền tảng; hai tenant được phép trùng số (làm rõ RULE-002, RULE-001) | FR-TEN-020 |
| RULE-019 | Cấu hình kế thừa nền tảng, tenant, Company, Branch và có hiệu lực theo ngày; đổi cấu hình tầng trên không sửa chứng từ đã phát hành | FR-TEN-018, 019 |
| RULE-020 | Tạm ngưng không xóa dữ liệu; chấm dứt không xóa ngay; chỉ xóa hoặc ẩn danh sau khi trả dữ liệu, hết thời hạn giữ theo luật và hợp đồng, không có giữ pháp lý, và có người duyệt | FR-TEN-005, 006, 007 |
| RULE-021 | Khi hạn chế, tạm ngưng hoặc chấm dứt (trừ sự cố an ninh) tenant vẫn truy xuất và tải được hóa đơn, chứng từ thuộc thời hạn lưu | FR-TEN-005, 006 |
| RULE-022 | Truy cập hỗ trợ của nhân sự nền tảng cần lý do, thời hạn, phạm vi tối thiểu, sự đồng ý của tenant (trừ khẩn cấp có duyệt và báo lại), và hiển thị cho tenant | FR-TEN-012 |
| RULE-023 | Vượt hạn mức hoặc hạn chế thương mại không được chặn hoàn tất chứng từ đang mở (thu tiền, giao xe, phát hành hóa đơn); chỉ chặn tạo mới theo chính sách | FR-TEN-005, 025 |
| RULE-024 | Tích hợp bên ngoài, bí mật, chứng thư số và khóa API là của từng tenant (và Company); không dùng chung giữa tenant | FR-TEN-021 |
| RULE-025 | Hóa đơn của tenant phát hành dưới đơn vị phát hành của tenant; nền tảng không phát hành thay; hóa đơn nền tảng thu phí tenant nằm ngoài hệ thống hóa đơn của tenant | FR-TEN-021, 048 |
| RULE-026 | Mỗi phiên làm việc thuộc đúng một tenant; đổi tenant là ngữ cảnh mới; tạm ngưng hoặc thu hồi tư cách thu hồi phiên theo cấu hình | FR-TEN-010, 016, 017 |
| RULE-027 | Mọi thao tác cấp nền tảng ghi nhật ký nền tảng bất biến kèm lý do; thao tác nhạy cảm (ngưng, chấm dứt, xóa, truy cập khẩn cấp) cần hai người: người đề xuất và người duyệt. Duyệt hoặc từ chối đăng ký tự phục vụ nằm ngoài danh sách này | FR-TEN-003, 013 |
| RULE-028 | Tenant tự đăng ký chưa đạt mức xác minh (cấu hình được) chỉ chạy ở chế độ thử: không phát hành hóa đơn thật, không gửi SMS/Zalo hàng loạt, không dùng API ngoài có ghi dữ liệu; mức xác minh không chặn dùng ứng dụng nói chung | FR-TEN-004, 040, 041 |
| RULE-029 | Không nhập dữ liệu thật trước khi người đại diện tenant chấp nhận phiên bản hiện hành của điều khoản dịch vụ và thỏa thuận xử lý dữ liệu; lưu ai, khi nào, phiên bản nào, bằng chứng phiên | FR-TEN-037, 039 |
| RULE-030 | Gói, thuê bao và công nợ phí **không bao giờ xóa dữ liệu**; nợ phí, hạ gói hoặc tenant không hoạt động chỉ đưa tenant qua thang cảnh báo, ân hạn, hạn chế, chỉ đọc (thời hạn cấu hình); xóa chỉ theo RULE-020 (06/11/2026: bỏ "hết dùng thử", không còn trial) | FR-TEN-044, 049 |
| RULE-031 | Mọi thao tác tiền giữa nền tảng và tenant idempotent, không xóa bản ghi đã ghi nhận, sửa bằng điều chỉnh; tách khỏi sổ và hóa đơn của tenant (song song RULE-010, 025) | FR-TEN-047, 048 |
| RULE-032 | Một mã số thuế chỉ gắn một tenant đang hoạt động; trùng thì vào hàng chờ duyệt (ngoại lệ hợp pháp `[Cần xác nhận]`) | FR-TEN-040, 041 |
| RULE-033 | Ẩn giao diện chi nhánh/kho (tenant một chi nhánh một kho) không làm thay đổi mô hình dữ liệu, Scope hay cô lập; cờ hiển thị chỉ điều khiển UI | FR-TEN-051 |
| RULE-034 | Một thông tin đăng nhập (email, duy nhất toàn nền tảng) có thể có nhiều tư cách thành viên ở nhiều tenant; vai trò, chi nhánh, trạng thái, thu hồi tách riêng theo từng tư cách; quyền không cộng gộp; mọi truy cập dữ liệu vẫn gắn đúng một tenant theo phiên. **Đã quyết 06/11/2026 (chủ dự án, C-S14)** | FR-TEN-009, 010, 016, 017 |
| RULE-035 | Tenant không gán gói là **gói mặc định miễn phí hoàn toàn**: không đồng hồ dùng thử, không hết hạn, không hóa đơn nền tảng; thu phí chỉ áp khi tenant chủ động chọn gói trả phí (làm sau) và gói trả phí không bao giờ tự gán. Giới hạn chống lạm dụng của tenant miễn phí vẫn áp (FR-TEN-015, 041) dưới dạng tham số cấu hình có ngày hiệu lực; BA đã đề xuất giá trị mặc định (06/11/2026, `docs/dev/open-questions-for-ba.md`), không bao giờ xóa dữ liệu và không chặn tenant số 1 `[Cần xác nhận: Q40, chủ dự án]`. **Quyết định 06/11/2026 (chủ dự án, Q21/Q34)** | FR-TEN-001, 028 (B0), 044 |
| RULE-036 | Người đề xuất không tự duyệt yêu cầu của mình, kể cả khi giữ quyền duyệt hoặc nhận ủy quyền; ủy quyền chỉ có hiệu lực ở cấp mà người ủy quyền đang giữ đối với yêu cầu tại thời điểm duyệt (bản 0.6); các khoản chi cùng loại, cùng nhà cung cấp, cùng chi nhánh trong cửa sổ cấu hình được cộng dồn khi so với hạn mức; hạn mức chưa được ban hành thì chuyển lên cấp cao nhất, không cho qua (làm rõ RULE-011; bản 0.5, đề xuất BA 06/11/2026) `[Cần xác nhận: Chủ dự án, Q67]` | FR-SYS-033, 034, FR-ACC-028 |
| RULE-037 | Hàng đang chuyển giữa hai kho thuộc chứng từ chuyển, chưa thuộc tồn bán được của kho nào; chỉ tăng tồn kho nhận theo số bên nhận xác nhận; phần lệch treo trên hàng đang vận chuyển đến khi có kết quả xử lý được duyệt; chuyển kho không bao giờ vượt ranh giới tenant (bản 0.5, đề xuất BA) | FR-INV-010, 026, 030, 032 |
| RULE-038 | Công thợ và hoa hồng là dữ liệu tính từ quy tắc và định mức có hiệu lực tại thời điểm phát sinh; mỗi dòng giữ phiên bản quy tắc đã áp; kỳ công đã khóa không sửa trực tiếp, điều chỉnh bằng dòng điều chỉnh có duyệt; công và hoa hồng không phải lương (BRD §4) (bản 0.5, đề xuất BA) `[Cần xác nhận: công thức, Khách, Q73, Q74]` | FR-HRM-006, 015, 017, 020, 021 |

RULE-016 đến 035 là đề xuất multi-tenant (bản 0.4), chờ khách xác nhận; riêng RULE-034 và ý chính của RULE-035 (gói mặc định miễn phí) là quyết định của chủ dự án ngày 06/11/2026. Quy tắc "tenant là bên kiểm soát, nền tảng là bên xử lý dữ liệu cá nhân" **chưa** thành RULE vì chờ luật sư (Q8). RULE-036 đến 038 là đề xuất giai đoạn 2 (bản 0.5, 06/11/2026), chờ khách xác nhận.

Quy tắc về tồn kho cần đặc biệt chú ý: tồn thực tế, tồn giữ chỗ và tồn khả dụng là ba con số khác nhau, nếu chỉ hiển thị tồn thực tế thì nhân viên có thể dùng số hàng đã dành cho lệnh khác.

| Chỉ tiêu | Ví dụ dầu động cơ | Ví dụ khác |
| --- | --- | --- |
| Tồn thực tế | 20 | 100 |
| Đã giữ cho lệnh sửa chữa | 5 | 20 |
| Tồn khả dụng (thực tế trừ giữ chỗ) | 15 | 80 |
| Tồn tối thiểu | không áp dụng | 30 |

Cảnh báo đặt hàng so tồn khả dụng với ngưỡng cấu hình, không so với tồn thực tế.

## 7. Yêu cầu pháp lý và tuân thủ tại Việt Nam

Hóa đơn, kế toán và dữ liệu cá nhân đều đổi khung pháp lý trong 2026, nên các quy tắc phải cấu hình được thay vì viết cứng vào mã. Phần này tổng hợp từ nguồn công khai đến 30/10/2026, không phải tư vấn pháp lý; kế toán trưởng hoặc luật sư của khách cần xác nhận trước khi chốt thiết kế.

| Lĩnh vực | Văn bản và hiệu lực | Ảnh hưởng đến hệ thống |
| --- | --- | --- |
| Hóa đơn điện tử | [Nghị định 254/2026/NĐ-CP](https://thue.man.net.vn/nghi-dinh-254-2026/) ban hành 30/6/2026, hiệu lực 1/7/2026, thay Nghị định 123/2020 và 70/2025; hướng dẫn bởi [Thông tư 91/2026/TT-BTC](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu) cùng hiệu lực | Không viết cứng theo Nghị định 123. Thời điểm lập hóa đơn, hóa đơn điều chỉnh, thay thế phải cấu hình được; kiểm tra nội dung mới về tiền đặt cọc |
| Hóa đơn của chi nhánh | Theo quy định trước đây, chi nhánh phụ thuộc có quyền phát hành hóa đơn ([LuatVietnam](https://luatvietnam.vn/doanh-nghiep/chi-nhanh-phu-thuoc-co-duoc-xuat-hoa-don-khong-561-93938-article.html)); cần đối chiếu lại với Nghị định 254 | Cấu hình đơn vị phát hành theo pháp nhân và chi nhánh; điều chuyển hàng nội bộ phải chọn đúng loại chứng từ |
| Kế toán doanh nghiệp | [Thông tư 99/2025/TT-BTC](https://kpmg.com/vn/vi/home/phan-tich-chuyen-sau/2025/11/key-changes-in-vietnamese-accounting-system-for-enterprises.html) ban hành 27/10/2025, hiệu lực 1/1/2026, thay Thông tư 200/2014 | Doanh nghiệp được chủ động thiết kế chứng từ và sổ phù hợp quản trị nếu thông tin trung thực ([Luật Minh Khuê](https://luatminhkhue.vn/van-ban/thong-tu-so-99-2025-tt-btc.aspx)); phiếu nhập, xuất kho dùng mẫu tham khảo của Thông tư 99 |
| Kế toán hộ kinh doanh (nếu có) | [Thông tư 152/2025/TT-BTC](https://ketoanthuanthien.vn/kien-thuc/che-do-ke-toan-cho-ho-kinh-doanh-theo-thong-tu-152-2025-tt-btc/) hiệu lực 1/1/2026; bỏ thuế khoán từ 1/1/2026, theo [Nghị định 68/2026](https://www.meinvoice.vn/?p=35439) | Chỉ áp dụng nếu một số cửa hàng vận hành dưới dạng hộ kinh doanh; cần hỗ trợ sổ theo mẫu của Thông tư 152 \[Cần xác nhận\] |
| Thuế GTGT | [Nghị quyết 204/2025/QH15](https://einvoice.vn/tin-tuc/chinh-thuc-giam-2-thue-vat-keo-dai-den-het-2026) giảm 2% thuế GTGT (10% còn 8%) từ 1/7/2025 đến 31/12/2026 | Thuế suất theo ngày hiệu lực; từ 1/1/2027 trở lại mức cũ nếu không gia hạn. Kế toán xác nhận nhóm công và phụ tùng nào được giảm |
| Dữ liệu cá nhân | [Luật Bảo vệ dữ liệu cá nhân 2025](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/legal-alert-july-2025-personal-data-protection-law-vn.pdf) thông qua 26/6/2025, hiệu lực 1/1/2026; [Nghị định 356/2025](https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html) thay Nghị định 13/2023 | Ghi nhận đồng ý, quyền xóa và chỉnh sửa, phân quyền chặt, nhật ký truy cập. Mức phạt có thể tới 5% doanh thu ([VCCI](https://vcci.com.vn/tin-tuc/luat-bao-ve-du-lieu-ca-nhan-luu-y-ve-hanh-lang-phap-ly-moi-cho-doanh-nghiep)) |
| Dữ liệu nhân viên | Doanh nghiệp phải xóa dữ liệu cá nhân của người lao động khi nghỉ việc từ 1/1/2026 ([LSVN](https://lsvn.vn/tu-nam-2026-doanh-nghiep-phai-xoa-du-lieu-ca-nhan-cua-nguoi-lao-dong-khi-nghi-viec-a167358.html)) | Chính sách lưu trữ và ẩn danh hóa hồ sơ nhân sự đã nghỉ, giữ lại dữ liệu bắt buộc theo luật kế toán |
| Kiểm định xe | [Thông tư 30/2026/TT-BXD](https://ketoananpha.vn/quy-dinh-dang-kiem-xe-o-to.html) quy định chu kỳ kiểm định theo loại xe và năm sản xuất | Nhắc đăng kiểm cần bảng chu kỳ cấu hình được, vì chu kỳ đã đổi nhiều lần |

### Chu kỳ kiểm định dùng cho tính năng nhắc hạn

| Loại xe | Chu kỳ đầu | Chu kỳ định kỳ |
| --- | --- | --- |
| Ô tô đến 8 chỗ, không kinh doanh vận tải, sản xuất đến 7 năm | 36 tháng | 24 tháng |
| Cùng loại, sản xuất từ 7 đến 20 năm | không có | 12 tháng |
| Cùng loại, sản xuất trên 20 năm | không có | 6 tháng |
| Ô tô đến 8 chỗ, có kinh doanh vận tải, đến 5 năm | 24 tháng | 12 tháng |
| Cùng loại, trên 5 năm | không có | 6 tháng |

Nguồn: [Kế toán Anpha, theo Thông tư 30/2026/TT-BXD](https://ketoananpha.vn/quy-dinh-dang-kiem-xe-o-to.html). Nên đối chiếu văn bản gốc trước khi đưa vào cấu hình mặc định.

### Điểm cần kế toán của khách xác nhận

- Garage có thuộc diện bắt buộc dùng hóa đơn khởi tạo từ máy tính tiền theo Nghị định 254/2026 hay không.
- Từng chi nhánh là hạch toán phụ thuộc hay pháp nhân riêng, và ai là đơn vị phát hành hóa đơn.
- Cách lập chứng từ khi điều chuyển phụ tùng giữa chi nhánh khác tỉnh.
- Nhóm công và phụ tùng được áp mức thuế 8% đến hết 2026.

### Cập nhật ở bản 0.2

- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ 1/1/2026; mức phạt hành chính từ 1% đến 5% doanh thu năm liền trước của tổ chức vi phạm ([LSVN](https://lsvn.vn/tag/luat-bao-ve-du-lieu-ca-nhan.html)). Nghị định 330/2026/NĐ-CP quy định xử phạt trong lĩnh vực an ninh mạng và bảo vệ dữ liệu cá nhân, có hiệu lực từ 19/8/2026 ([LuatVietnam](https://luatvietnam.vn/bai-viet-lien-quan/luat-91-2025-qh15-405135.html)); nội dung chi tiết của nghị định này chưa được nghiên cứu.
- Luật có các trường hợp xử lý dữ liệu không cần sự đồng ý của chủ thể ([LSVN](https://lsvn.vn/cac-truong-hop-xu-ly-du-lieu-ca-nhan-khong-can-su-dong-y-cua-chu-the-tu-01-01-2026-a167690.html)). Vì vậy hệ thống ghi nhận căn cứ xử lý cho từng loại dữ liệu chứ không chỉ ghi đồng ý, và luật sư của khách xác nhận căn cứ cho dữ liệu khách hàng, nhân viên và hình ảnh xe.
- Thông tư 91/2026/TT-BTC ban hành 30/6/2026, hiệu lực 1/7/2026, thay Thông tư 32/2025/TT-BTC, hướng dẫn Luật Quản lý thuế 108/2025/QH15 và Nghị định 254/2026 ([MISA eShop](https://www.misaeshop.vn/44493/thong-tu-91-2026-tt-btc-huong-dan-nghi-dinh-254-2026-nd-cp/)). Thông tư có quy định xử lý hóa đơn điện tử lập sai, được tổng hợp thành 13 trường hợp ([Thuế MAN](https://thue.man.net.vn/zh/?p=6985)), và ký hiệu mẫu số hóa đơn ở Phụ lục I, trong đó 1 là hóa đơn giá trị gia tăng, 2 là hóa đơn bán hàng ([Luật Việt An](https://luatvietan.vn/thong-tu-91-2026-tt-btc.html)).
- Hóa đơn đã lập theo quy định cũ vẫn được điều chỉnh hoặc thay thế theo Nghị định 254 và Thông tư 91 ([MISA eShop](https://www.misaeshop.vn/44493/thong-tu-91-2026-tt-btc-huong-dan-nghi-dinh-254-2026-nd-cp/)).
- Báo giá và lệnh sửa chữa không phải hóa đơn điện tử: hệ thống lưu thành đối tượng riêng, chỉ coi là hóa đơn khi nhà cung cấp hóa đơn trả trạng thái hợp lệ.

### Bổ sung ở bản 0.4 (multi-tenant): điểm pháp lý cần luật sư và kế toán của chủ nền tảng

Khi phục vụ nhiều khách hàng độc lập, nền tảng không chỉ là công cụ của một doanh nghiệp. Các điểm dưới đây **chưa có câu trả lời**, không được hard-code; mọi mốc, thời hạn, thuế suất là cấu hình có hiệu lực theo ngày.

| Chủ đề | Câu hỏi cho luật sư hoặc kế toán | Mã |
| --- | --- | --- |
| Vai trò dữ liệu cá nhân | Tenant là bên kiểm soát, nền tảng là bên xử lý? Thỏa thuận xử lý dữ liệu theo phiên bản; thông báo sự cố; chuyển dữ liệu ra nước ngoài (dữ liệu đặt tại Singapore mới được chấp nhận cho khách đầu tiên, ADR 0001 A3) | Q8 |
| Điều khoản và thỏa thuận chấp nhận điện tử | Hiệu lực của chấp nhận điện tử (click-wrap), người có thẩm quyền chấp nhận cho tenant, bằng chứng lưu, đổi điều khoản một phía, luật áp dụng, giới hạn trách nhiệm | Q30 |
| Lưu hóa đơn, chứng từ khi chấm dứt | Nghĩa vụ lưu thuộc tenant hay nền tảng; thời hạn lưu; xóa/ẩn danh sau khi trả dữ liệu; giữ pháp lý | Q7, Q20 |
| Hóa đơn của nền tảng thu phí tenant | Pháp nhân phát hành, thuế GTGT cho dịch vụ phần mềm trực tuyến, thời điểm lập, hộ kinh doanh (gói mặc định miễn phí không phát sinh hóa đơn, RULE-035) | Q12, Q32 |
| Xác minh tenant | Nguồn tra mã số thuế, đối tượng nhận (doanh nghiệp, hộ kinh doanh, cá nhân), ngoại lệ một mã số thuế nhiều tenant | Q28, C-S05 |
| Dữ liệu của người đại diện tenant | Hồ sơ xác minh (MST, người đại diện) là dữ liệu cá nhân: mục đích, thời hạn giữ, ai xem | FR-TEN-040 |

Chi tiết và người trả lời: `docs/multi-tenant-open-questions.md`.

## 8. Giả định, ràng buộc, rủi ro

Rủi ro lớn nhất không nằm ở công nghệ mà ở dữ liệu Excel cũ và việc thợ, thủ kho chịu dùng hệ thống hằng ngày.

### Giả định và ràng buộc

- Khách đã có file Excel mô tả danh mục phụ tùng, khách, công nợ; chưa được kiểm tra \[Cần xác nhận\].
- Mỗi chi nhánh có kết nối Internet ổn định; nếu không, cần thêm chế độ chịu mất mạng ngắn hạn.
- Dùng chung một hệ thống cho toàn chuỗi, dữ liệu tách theo chi nhánh bằng phân quyền. Từ bản 0.4: một nền tảng dùng chung cho nhiều tenant, dữ liệu tách theo tenant trước, rồi theo chi nhánh (RULE-016, 017); cách cô lập vật lý (dùng chung hay tách) **chưa quyết**, dev đề xuất trong ADR 0002.
- Hệ thống chạy trên web; thợ dùng tablet hoặc máy dùng chung tại xưởng.
- Phí và tích hợp nhà cung cấp hóa đơn điện tử do khách chọn và chịu \[Cần xác nhận\].

### Rủi ro

| Rủi ro | Tác động | Cách giảm thiểu |
| --- | --- | --- |
| Dữ liệu Excel cũ sai, trùng mã phụ tùng, thiếu giá vốn | Tồn kho và công nợ khởi tạo sai ngay từ đầu | Làm sạch dữ liệu trước, chạy thử nhập mẫu, kiểm kê đồng thời lúc chuyển đổi |
| Thợ và thủ kho không quen thao tác | Phụ tùng vẫn lấy ngoài hệ thống, số liệu mất tin cậy | Giao diện tối giản cho tablet, đào tạo tại chỗ, chạy pilot một chi nhánh, quy định nội bộ rằng không có lệnh thì không xuất kho |
| Khung pháp lý về hóa đơn, thuế, kế toán thay đổi | Phải sửa mã nguồn mỗi lần luật đổi | Cấu hình thuế suất, loại chứng từ, mẫu in theo ngày hiệu lực; cập nhật mục 7 mỗi quý |
| Phụ thuộc vào một nhà cung cấp hóa đơn điện tử | Gián đoạn khi nhà cung cấp lỗi hoặc đổi API | Thiết kế lớp tích hợp có thể thay nhà cung cấp; lưu bản XML và PDF cục bộ |
| Phạm vi phình to vì là ERP đủ mọi thứ | Trễ tiến độ, khó nghiệm thu | Chia giai đoạn theo mục 9, khóa phạm vi từng giai đoạn bằng tiêu chí nghiệm thu |
| Rò rỉ dữ liệu khách hàng | Phạt theo luật bảo vệ dữ liệu cá nhân, mất uy tín | Phân quyền theo chi nhánh, nhật ký truy cập, mã hóa, sao lưu, kiểm tra truy cập định kỳ |
| Khách chưa thống nhất cách tính công thợ và hoa hồng giữa các chi nhánh | Phải làm lại phân hệ nhân công | Chốt quy tắc trong giai đoạn khám phá; cho phép cấu hình quy tắc theo chi nhánh |
| Nghẽn mạng hoặc hệ thống ngừng tại chi nhánh | Xưởng đứng, không giao xe được | Phương án dự phòng giấy cho lệnh sửa chữa; nhập bổ sung khi có mạng; theo dõi uptime |

### Rủi ro multi-tenant (bản 0.4)

| Mã | Rủi ro | Mức | Giảm thiểu (FR/RULE/NFR) |
| --- | --- | --- | --- |
| R-TEN-01 | Lạm dụng đăng ký: bot, đăng ký hàng loạt tốn chi phí hạ tầng, dùng nền tảng gửi tin hoặc lập hóa đơn giả | Cao | FR-TEN-040, 041, 015; RULE-028, 032; NFR-TEN-07 |
| R-TEN-02 | Cô lập giữa tenant lạ nhau: mọi lỗi lọc là sự cố dữ liệu cá nhân của người ngoài | Cao | FR-TEN-009, 010, 014; RULE-016, 017; NFR-TEN-08 |
| R-TEN-03 | Pháp lý bên xử lý dữ liệu cho tenant tự đăng ký; hiệu lực click-wrap; dữ liệu đặt ở Singapore | Cao | FR-TEN-036, 037; RULE-029; Q8, Q30 |
| R-TEN-04 | Hóa đơn điện tử theo từng tenant: nhiều nhà cung cấp, chứng thư số của tenant do nền tảng giữ, sai đơn vị phát hành, bị hiểu nhầm là phát hành thay | Cao | FR-TEN-021, 040; RULE-024, 025; Q31 |
| R-TEN-05 | Hỗ trợ và SLA: kỳ vọng hỗ trợ khi chưa có hợp đồng, khối lượng tăng theo số tenant | Trung bình đến cao | FR-TEN-050, 012, 035; Q9, Q33 |
| R-TEN-06 | Khách đầu tiên không đồng ý dùng chung nền tảng hoặc quyền sở hữu hạ tầng chưa rõ | Cao | Q14 trước ADR 0002 và trước mở đăng ký |
| R-TEN-07 | Chi phí hạ tầng không có doanh thu: **mọi tenant miễn phí và không đồng hồ** (06/11/2026), nên chi phí tăng theo số tenant mà không có doanh thu hay hạn chót tự nhiên | Trung bình đến cao | FR-TEN-015, 041, 044; NFR-TEN-07; RULE-035; Q29, Q40 |
| R-TEN-08 | Thuế và hóa đơn nền tảng chưa rõ khi bắt đầu thu tiền | Trung bình | FR-TEN-048; RULE-031; Q12 |
| R-TEN-09 | Làm nền muộn: retrofit mã tenant vào dữ liệu, chỉ mục, đánh số sau khi có dữ liệu thật rất đắt; ngân sách chỉ mục 193/200 | Cao nếu trễ | MT-0 cùng giai đoạn 1; FR-TEN-031 |
| R-TEN-10 | Phạm vi phình, trễ pilot của khách đầu tiên khi làm cùng lúc nền multi-tenant | Trung bình | Phân đợt; chỉ MT-0 vào giai đoạn 1; thứ tự đã chốt theo ủy quyền 06/11/2026 (Q37); chủ dự án còn phải đặt mức trễ chấp nhận sau ước lượng của dev |
| R-TEN-11 | Tranh chấp khi áp phí về sau, nợ phí, chấm dứt: giữ dữ liệu làm con tin hoặc xóa quá sớm so với nghĩa vụ lưu trữ hóa đơn | Trung bình | RULE-020, 021, 030, 035; Q7 |
| R-TEN-12 | Mạo danh doanh nghiệp (dùng mã số thuế của người khác) | Cao | FR-TEN-040; RULE-028, 032; Q28 |
| R-TEN-13 | **Rủi ro chấp nhận có thời hạn xem lại (06/11/2026):** vai trò nền tảng có quyền rất cao nhưng không có MFA (nhất quán quyết định MFA ngoài phạm vi). Một tài khoản nền tảng bị chiếm có thể cấp phát, ngưng, truy cập khẩn cấp | Cao nếu không xem lại | Biện pháp bù: hai người duyệt thao tác nhạy cảm (RULE-027), nhật ký nền tảng bất biến (FR-TEN-013), phiên hỗ trợ cần đồng ý (RULE-022), không vai trò nền tảng nào xem dữ liệu nghiệp vụ mặc định (FR-TEN-011); **xem lại trước khi mở đăng ký cho người ngoài (MT-1)**; mốc là điều kiện cổng "trước MT-1", không đặt ngày (chốt 06/11/2026 theo ủy quyền) |
| R-TEN-14 | Tenant miễn phí bỏ hoang hoặc lạm dụng tài nguyên (SMS/Zalo, ảnh, nhập xuất) vì không có hạn mức hay hạn chót | Trung bình | FR-TEN-015, 025, 041; RULE-023, 030, 035; Q40 |
| R-TEN-15 | Một danh tính nhiều tư cách thành viên: lộ quan hệ giữa các tenant, đặt lại mật khẩu hay thu hồi ảnh hưởng nhầm tenant, tài khoản nền tảng trùng email tenant | Trung bình | FR-TEN-011, 016, 017; RULE-026, 034; Q41; UAT-TEN-07, 21 |

## 9. Lộ trình triển khai theo giai đoạn

Triển khai theo bốn giai đoạn sau một giai đoạn khám phá, mỗi giai đoạn chỉ mở khi qua cổng kiểm soát; mốc thời gian sẽ chốt sau khi khách trả lời các câu hỏi ở mục 10.

&#91;embedded content: lộ trình · 5 giai đoạn, 4 cổng kiểm soát\]

Giai đoạn 1 chạy ở một chi nhánh để kiểm chứng các chỉ số ở mục 3 trước khi nhân ra toàn chuỗi.

**Giai đoạn 2 (quyết định theo ủy quyền của chủ dự án, 06/11/2026, chờ khách xác nhận):** khởi động theo kiểu multi-tenant ngay từ đầu; đưa công nợ phải thu (FR-ACC-006), công nợ phải trả (FR-ACC-007) và hoàn tiền (FR-ACC-016, đã dựng sớm ở giai đoạn 1) vào giai đoạn 2 thay vì để đến giai đoạn 3; làm phê duyệt đầy đủ (FR-SYS-033, 034) trước các slice cần nó. Phạm vi FR theo slice nằm ở FRD mục 13 và `docs/dev/phase-2-plan.md`; các quyết định còn mở (giá vốn, công thức công và hoa hồng, hạn mức duyệt, quy trình mua hàng, bảo hành chéo, ngưỡng kiểm kê) và câu hỏi cho khách số 64 trở đi nằm ở `docs/dev/phase-2-plan.md`; mọi giá trị mặc định là cấu hình có ngày hiệu lực, không viết cứng.

**Multi-tenant (bản 0.4, đề xuất chờ xác nhận):** chạy song song với các giai đoạn trên theo bốn đợt riêng. **MT-0 "nền"** (15 FR, gồm danh tính một-nhiều FR-TEN-017 từ 06/11/2026) thuộc giai đoạn 1 và bắt buộc, vì sửa sau khi có dữ liệu thật đắt hơn nhiều; khách đầu tiên là tenant số 1. **MT-1** (tự đăng ký có kiểm soát, 21 FR) là điều kiện mở đăng ký cho người ngoài; thứ tự so với pilot **đã chốt theo ủy quyền 06/11/2026 (Q37)**: MT-0 xong trước go-live pilot, pilot đóng như đối tác thiết kế, MT-1 build sau khi pilot ổn định, mở đăng ký hai nấc; tenant số 1 ký thỏa thuận đối tác thiết kế ngắn và chấp nhận Điều khoản/DPA bản chuẩn trước dữ liệu thật (Q38; **phần pháp lý vẫn cần luật sư xác nhận**). **MT-2** (gói tùy chọn và hạn mức, 14 FR; gói mặc định là miễn phí, không trial) và **MT-3** (thu tiền, hóa đơn nền tảng, 5 FR) làm sau, nhưng thiết kế giai đoạn 1 không được chặn đường. Chi tiết: FRD mục 10A và mục 13, `docs/multi-tenant-analysis.md` mục 17.

Tài liệu BA tham khảo đề xuất phân kỳ khác: giai đoạn 1 chỉ gồm vận hành xưởng và chưa có kho; giai đoạn 2 gồm kho, mua hàng, hóa đơn và tài chính; giai đoạn 3 gồm nhân sự nâng cao, lương và hoa hồng, tích hợp kế toán nâng cao, CRM, tự động phê duyệt và báo cáo nhiều chi nhánh nâng cao. Bản này đưa kho cơ bản và hóa đơn cơ bản vào giai đoạn 1 vì pilot không kiểm soát được thất thoát nếu phụ tùng xuất ngoài lệnh, và hóa đơn là nghĩa vụ ngay khi chi nhánh pilot vận hành thật. Nếu khách muốn pilot nhẹ hơn thì hoãn kho sang giai đoạn 2, đổi lại phụ tùng trong lệnh chỉ được ghi nhận mà chưa trừ kho; đây là quyết định cần chốt ở Discovery Workshop. Cả hai phương án chỉ là thứ tự ưu tiên, chưa phải lịch đã ước tính.

## 10. Câu hỏi cần khách hàng xác nhận

Mười lăm câu hỏi dưới đây và phiếu khảo sát Discovery ở cuối mục quyết định phạm vi và thiết kế; câu 1 đến 4 cần trả lời trước khi bắt đầu thiết kế chi tiết. Bộ tài liệu này chưa phải BRD đã được khách xác nhận (baseline): cần một buổi Discovery Workshop với chủ garage và đại diện vận hành, kho, kế toán, nhân sự trước khi đưa khách ký.

- [ ] 1\. Mô hình pháp lý: một công ty có nhiều chi nhánh hạch toán phụ thuộc, nhiều pháp nhân riêng, hay có cả hộ kinh doanh?
- [ ] 2\. Số chi nhánh hiện tại và dự kiến trong 2 năm; số xe nhận mỗi ngày mỗi chi nhánh; số người dùng đồng thời.
- [ ] 3\. Khách đang dùng phần mềm kế toán nào, và muốn hệ thống mới thay thế hay chỉ kết xuất dữ liệu sang đó?
- [ ] 4\. Khách đã chọn nhà cung cấp hóa đơn điện tử nào (VNPT, Viettel, MISA, khác)?
- [ ] 5\. Vì sao chọn xây mới thay vì mua phần mềm có sẵn (SGARA, Carsoft, MISA AMIS)? Điểm nào phần mềm có sẵn không đáp ứng?
- [ ] 6\. Cách tính công thợ: theo giờ chuẩn của hạng mục, theo khoán từng việc, theo phần trăm doanh thu, hay kết hợp? Có giống nhau giữa các chi nhánh không?
- [ ] 7\. Giá dịch vụ và bảng giá phụ tùng thống nhất toàn quốc hay mỗi chi nhánh tự quyết?
- [ ] 8\. Mua phụ tùng tập trung từ tổng kho hay từng chi nhánh tự mua? Có kho tổng không?
- [ ] 9\. Phương pháp tính giá vốn phụ tùng khách muốn dùng (bình quân gia quyền, nhập trước xuất trước)?
- [ ] 10\. Có bán phụ tùng lẻ tại quầy, nhận xe sửa theo bảo hiểm, hoặc nhận xe công ty theo hợp đồng không?
- [ ] 11\. Hạ tầng tại chi nhánh: máy tính, tablet, máy in, mạng; có nơi nào hay mất mạng?
- [ ] 12\. Yêu cầu về nơi lưu dữ liệu (máy chủ trong nước hay đám mây), thời gian lưu hồ sơ, và ai chịu trách nhiệm về dữ liệu cá nhân của khách?

* [ ] 13\. Có đặt lịch hẹn trước không, hay chủ yếu khách vãng lai?
* [ ] 14\. Khách có thể mang xe đến chi nhánh khác để bảo hành không, và chi phí bảo hành ghi cho chi nhánh nào?
* [ ] 15\. Có khách doanh nghiệp cần công nợ theo kỳ hoặc thanh toán gộp nhiều hóa đơn không?

Nếu có file Excel đang dùng (danh mục phụ tùng, danh sách khách, phiếu sửa chữa mẫu), gửi sớm giúp thiết kế bám thực tế hơn.

### Multi-tenant: đã quyết và còn mở (bản 0.4)

**Đã quyết (khách, 05/11/2026):** D1 multi-tenant thiết kế từ đầu; D2 chủ garage khác tự đăng ký và tự triển khai; D3 có gói dịch vụ thu tiền, làm sau. Hệ quả: mô hình kinh doanh là SaaS dùng chung (Q1), tự đăng ký (Q11), Q5 quyết một phần.

**Đã quyết (chủ dự án, 06/11/2026):** (1) một email có thể thuộc nhiều tenant, một danh tính nhiều tư cách thành viên (C-S14; RULE-034, FR-TEN-016, 017); (2) tenant không gán gói là miễn phí hoàn toàn, không trial đếm ngược, thu tiền làm sau (Q21, Q34; RULE-035, FR-TEN-044); (3) bỏ MFA cho vai trò nền tảng, rủi ro chấp nhận có thời hạn xem lại (Q36; R-TEN-13); (4) tên sản phẩm là GMEP (C-S24). **Đã chốt theo ủy quyền của chủ dự án cho người điều phối (06/11/2026), vẫn cần luật sư xác nhận phần pháp lý:** (5) thứ tự MT-0, pilot, MT-1 (Q37): MT-0 xong trước go-live pilot, MT-1 sau khi pilot ổn định, mở đăng ký hai nấc; (6) tenant số 1 ký thỏa thuận đối tác thiết kế ngắn và chấp nhận Điều khoản/DPA bản chuẩn có phiên bản trước dữ liệu thật (Q38); (7) mốc xem lại MFA nền tảng là "trước khi mở MT-1".

**Còn mở, chặn thiết kế (ADR 0002):** mô hình cô lập dữ liệu (Q3), quy mô số tenant (Q2), khách đầu tiên có đồng ý dùng chung nền tảng và ai sở hữu hạ tầng (Q14), cấp phát tự động (Q26), quy tắc vận hành danh tính một-nhiều (Q41; BA đã trả lời mức nghiệp vụ, còn [LS] và chờ chủ dự án xác nhận). **Đã chốt theo ủy quyền, còn phần việc của chủ dự án và luật sư:** mức trễ pilot chấp nhận (Q37), nội dung pháp lý của thỏa thuận và DPA tenant số 1 (Q38). **Còn mở, chặn mở đăng ký:** luật sư về dữ liệu cá nhân và điều khoản (Q8, Q30), mức xác minh (Q28), chống lạm dụng (Q29), hỗ trợ và SLA (Q9, Q33), giới hạn tenant miễn phí và tenant bỏ hoang (Q40). **Còn mở, chặn thu tiền:** giá và hạn mức gói tùy chọn (Q13), VAT và pháp nhân hóa đơn nền tảng (Q12, Q32), cổng thanh toán (Q27). Danh sách gom đầy đủ, người trả lời và khuyến nghị: `docs/multi-tenant-open-questions.md`.

### Phiếu khảo sát Discovery

Tám câu hỏi đóng dưới đây có thể gửi trước buổi workshop để rút ngắn thời gian; mỗi câu chỉ ra nó ảnh hưởng đến phần nào của thiết kế.

| Câu hỏi | Các lựa chọn | Ảnh hưởng đến thiết kế |
| --- | --- | --- |
| 1. Số chi nhánh | Dưới 5; 5 đến 10; 10 đến 30; 30 đến 100; trên 100 | Quy mô dữ liệu, hạ tầng, cách đào tạo và triển khai theo đợt |
| 2. Mô hình pháp lý | Một công ty nhiều chi nhánh; nhiều công ty thành viên; có nhượng quyền; chưa rõ | Đơn vị phát hành hóa đơn, kế toán hợp nhất, phân quyền dữ liệu |
| 3. Công cụ đang dùng | Excel là chính; phần mềm garage hiện có; nhiều phần mềm riêng lẻ; giấy tờ và Zalo; kết hợp | Độ khó chuyển đổi và tích hợp |
| 4. Dịch vụ chính | Sửa chữa tổng hợp; bảo dưỡng định kỳ; đồng sơn, thân vỏ; lốp, mâm; nhiều loại | Mẫu kiểm tra, danh mục dịch vụ; đồng sơn thân vỏ có luồng riêng |
| 5. Kho | Mỗi chi nhánh một kho độc lập; kho riêng cộng kho trung tâm; dùng chung kho; chưa rõ | Mô hình tồn kho, chuyển kho, mua hàng tập trung |
| 6. Phạm vi kế toán | Quản lý thu chi, doanh thu, công nợ; kế toán quản trị và lãi lỗ; kế toán đầy đủ thay phần mềm hiện tại; tích hợp phần mềm kế toán | Mức độ của phân hệ ACC |
| 7. Khách tương tác với hệ thống | Duyệt báo giá và theo dõi xe; chỉ nhận thông báo; không, nhân viên thao tác nội bộ | Cổng cho khách, kênh gửi tin |
| 8. Thiết bị nhân viên | Máy tính tại quầy; điện thoại và tablet; cả ba | Giao diện, thiết bị tại xưởng |

Về phạm vi kế toán, hai phương án cần chọn: A là quản lý thu chi, doanh thu, chi phí, công nợ và lãi lỗ trên hệ thống, kết hợp tích hợp với phần mềm kế toán hiện tại; B là toàn bộ kế toán gồm sổ cái, tài khoản, định khoản, báo cáo tài chính và quy trình thuế. Khuyến nghị phương án A cho giai đoạn đầu vì B có phạm vi và yêu cầu tuân thủ lớn hơn đáng kể.

### Câu trả lời Discovery của khách (bản 0.3)

Bảng dưới tổng hợp câu trả lời Discovery do khách cung cấp. Chính nội dung gốc ghi một số mục là chưa xác nhận (bảng ngay sau ví dụ giá vốn), nên các dòng dưới đây là nguyện vọng của chủ garage, cần chi tiết hóa và chốt tại Discovery Workshop trước khi ký baseline.

| Câu hỏi | Trả lời của khách | Tác động thiết kế |
| --- | --- | --- |
| Mô hình pháp lý | Một công ty TNHH nhiều chi nhánh; có thể liên kết garage khác sau; chưa nhượng quyền | Cấu trúc Company, Branch, Warehouse; mở rộng được sang nhiều pháp nhân |
| Quy mô | 8 chi nhánh hiện tại, 20 sau 2 năm; 120 đến 200 xe mỗi ngày, sau 2 năm 500 đến 800; 80 đến 100 người dùng, sau 2 năm 250 đến 300 | Số liệu thiết kế tải; cần hỏi thêm số lệnh mỗi ngày, dòng phụ tùng mỗi lệnh, giao dịch kho mỗi ngày, số năm lưu trữ |
| Kế toán | Giữ phần mềm kế toán hiện tại; hệ thống làm tài chính quản trị và xuất dữ liệu cuối kỳ | Khớp phương án A, không nhập lại giao dịch lần hai |
| Hóa đơn điện tử | Đã có nhà cung cấp nhưng không muốn phụ thuộc cứng; không phát hành trùng khi bấm nhiều lần hoặc timeout | Lớp tích hợp nhà cung cấp hóa đơn, cơ chế idempotency |
| Công thợ | Kết hợp giờ chuẩn, khoán, giờ thực, tỷ lệ theo loại việc; chính sách chuẩn của công ty, chi nhánh điều chỉnh có kiểm soát | Cấu hình phương pháp, không hard-code công thức |
| Giá | Bảng giá chuẩn; chi nhánh giảm trong hạn mức (ví dụ thay dầu niêm yết 250.000 đồng, giảm tối đa 5% hoặc 10% theo chương trình) | Tách giá vốn, giá niêm yết, giá thực tế; báo giá giữ phiên bản giá |
| Kho và giá vốn | Kho tổng cộng kho chi nhánh, điều chuyển, mua trực tiếp khi gấp; nghiêng về bình quân gia quyền | Bốn con số tồn: thực tế, giữ chỗ, đang vận chuyển, khả dụng |
| Dịch vụ | Sửa chung, bảo dưỡng, lốp và bánh xe, đồng sơn; đồng sơn cần luồng riêng | Quy trình cấu hình theo loại dịch vụ |
| Duyệt báo giá | Qua liên kết, Zalo hoặc SMS, hoặc nhân viên ghi nhận tại quầy; duyệt một phần | Nhà cung cấp Zalo, SMS chưa chọn |
| Mở rộng | Có đặt lịch, bảo hành chéo chi nhánh, công nợ doanh nghiệp theo kỳ, bán phụ tùng lẻ | Chính sách bảo hành chéo chưa rõ |

Ví dụ giá vốn bình quân gia quyền: nhập lần 1 là 10 cái giá 100.000 đồng, nhập lần 2 là 20 cái giá 120.000 đồng; giá vốn bình quân là (10 × 100.000 + 20 × 120.000) / 30, tức khoảng 113.333 đồng. Phương pháp cuối cùng do kế toán của khách xác nhận.

Các mục khách coi là chốt trong quá trình triển khai: thiết bị (máy tính ở quầy, điện thoại cho quản lý, tablet cho thợ), mẫu in và máy in, mất mạng ngắn hạn (cảnh báo và lưu nháp, offline đầy đủ là phạm vi riêng), nơi lưu dữ liệu và sao lưu, vai trò pháp lý về dữ liệu cá nhân, hạn mức duyệt, và phạm vi chuyển đổi lịch sử sửa chữa.

Các mục chính khách tự đánh dấu chưa xác nhận (TBD), vẫn là câu hỏi mở:

| Nội dung | Trạng thái theo khách |
| --- | --- |
| Một hay nhiều pháp nhân | Đang giả định một pháp nhân |
| Số chi nhánh và nhân sự thực tế | Chưa xác nhận; số 8, 20, 120, 300 chỉ là ước tính |
| Nhà cung cấp hóa đơn điện tử | Chưa xác nhận |
| Công thợ và hoa hồng | Cần khảo sát bảng lương |
| Phương pháp giá vốn | Cần kế toán xác nhận |
| Quy trình đồng sơn | Cần khảo sát xưởng |
| Chính sách bảo hành chéo | Cần xác nhận |
| Tích hợp Zalo, SMS | Cần chọn nhà cung cấp |
| Hạn mức phê duyệt | Cần chủ doanh nghiệp ban hành |

### Vòng Fit-Gap trước khi quyết định xây mới

Câu hỏi quan trọng nhất của Discovery là vì sao xây mới thay vì mua. Khách nêu các lý do: quản trị nhiều chi nhánh và pháp nhân, quy trình sửa chữa đặc thù, điều phối thợ, kho tập trung, chính sách giá và công riêng, tích hợp, quyền kiểm soát dữ liệu; đồng thời cho biết sẵn sàng mua nếu phần mềm có sẵn đáp ứng 80 đến 90% nhu cầu và chỉ xây mới khi nghiệp vụ cốt lõi không đáp ứng được. Đề xuất một vòng Fit-Gap:

- Demo SGARA, CarSoft và MISA AMIS bằng chính các tình huống của chuỗi (một lệnh nhiều thợ, duyệt một phần, chuyển kho, đồng sơn), không xem slide giới thiệu.
- Chấm điểm theo bảy tiêu chí: quản trị nhiều chi nhánh và pháp nhân, quy trình sửa chữa, điều phối thợ, kho tập trung, chính sách giá và công, tích hợp, quyền sở hữu dữ liệu.
- Tính tổng chi phí sở hữu 3 đến 5 năm, gồm triển khai, đào tạo, nhập liệu ban đầu và bảo trì.

Hai điểm đã kiểm chứng ở bản 0.3: SGARA do QBIS phát hành, mô tả quản lý xe, khách, bảo hiểm, báo giá, lệnh sửa chữa, kho phụ tùng, thu chi, nhân sự ([App Store](https://apps.apple.com/bb/app/sgara/id1602944979)); CarSoft được một bài đánh giá mô tả mạnh ở vòng đời khách, xe, hợp đồng, kho, tài chính và báo cáo chi tiết ([FPT Shop](https://fptshop.com.vn/tin-tuc/danh-gia/phan-mem-quan-ly-gara-o-to-189081)). Nguồn công khai chưa đủ để kết luận về quản trị nhiều pháp nhân, luồng đồng sơn hay API của từng sản phẩm; đó là các mục phải hỏi trong demo, và chưa nên kết luận sản phẩm nào thiếu.

### Bộ file Excel cần nhận

| File | Dữ liệu chính | Dùng để |
| --- | --- | --- |
| Danh mục phụ tùng | Mã, tên, hãng, đơn vị, giá nhập, giá bán | Danh mục sản phẩm; gộp tên trùng như Lọc dầu Toyota và Oil Filter Toyota |
| Danh sách khách hàng | Mã, tên, số điện thoại, địa chỉ, loại khách | Nhập khách |
| Danh sách xe | Biển số, hãng, dòng, đời, số khung, chủ xe | Nhập xe |
| Phiếu sửa chữa mẫu | Xe, hạng mục, phụ tùng, tiền công, trạng thái | Thiết kế lệnh sửa chữa |
| Tồn kho theo chi nhánh | Mã phụ tùng, chi nhánh, tồn thực tế, tồn sổ sách | Chuyển đổi kho |
| Công nợ khách hàng và nhà cung cấp | Hóa đơn, số tiền, đã thu hoặc đã trả, còn nợ | Chuyển đổi công nợ |
| Bảng lương thợ | Nhân viên, giờ công, hệ số, thưởng | Thiết kế cách tính công |

Tồn kho và công nợ phải có số liệu đối soát tại ngày chuyển đổi, nếu không hệ thống mới đúng nhưng số dư đầu kỳ đã sai.

## 11. Nguồn tham khảo

Tra cứu ngày 30/10/2026. Trang kiểm định xe được mở đọc đầy đủ; các nguồn còn lại dựa trên nội dung hiển thị trong kết quả tìm kiếm, nên cần đối chiếu văn bản gốc trước khi dùng làm căn cứ pháp lý.

**Pháp lý và thuế**

- [Nghị định 254/2026/NĐ-CP, tổng quan](https://thue.man.net.vn/nghi-dinh-254-2026/)
- [EY, bản tin thuế tháng 7/2026 về Nghị định 254 và Thông tư 91](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- [LuatVietnam, chi nhánh phụ thuộc xuất hóa đơn](https://luatvietnam.vn/doanh-nghiep/chi-nhanh-phu-thuoc-co-duoc-xuat-hoa-don-khong-561-93938-article.html)
- [KPMG, điểm nổi bật Thông tư 99/2025](https://kpmg.com/vn/vi/home/phan-tich-chuyen-sau/2025/11/key-changes-in-vietnamese-accounting-system-for-enterprises.html)
- [Luật Minh Khuê, Thông tư 99/2025](https://luatminhkhue.vn/van-ban/thong-tu-so-99-2025-tt-btc.aspx)
- [Kế toán Thuận Thiên, Thông tư 152/2025 cho hộ kinh doanh](https://ketoanthuanthien.vn/kien-thuc/che-do-ke-toan-cho-ho-kinh-doanh-theo-thong-tu-152-2025-tt-btc/)
- [MISA meInvoice, chính sách hộ kinh doanh 2026](https://www.meinvoice.vn/?p=35439)
- [Einvoice, Nghị quyết 204/2025/QH15 giảm thuế GTGT](https://einvoice.vn/tin-tuc/chinh-thuc-giam-2-thue-vat-keo-dai-den-het-2026)
- [EY, Luật Bảo vệ dữ liệu cá nhân 2025](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/legal-alert-july-2025-personal-data-protection-law-vn.pdf)
- [PwC, Nghị định 356/2025](https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html)
- [VCCI, hành lang pháp lý mới về dữ liệu cá nhân](https://vcci.com.vn/tin-tuc/luat-bao-ve-du-lieu-ca-nhan-luu-y-ve-hanh-lang-phap-ly-moi-cho-doanh-nghiep)
- [LSVN, xóa dữ liệu người lao động khi nghỉ việc](https://lsvn.vn/tu-nam-2026-doanh-nghiep-phai-xoa-du-lieu-ca-nhan-cua-nguoi-lao-dong-khi-nghi-viec-a167358.html)
- [Kế toán Anpha, quy định đăng kiểm 2026](https://ketoananpha.vn/quy-dinh-dang-kiem-xe-o-to.html)

**Thị trường và thực tiễn vận hành**

- [MISA AMIS, top phần mềm quản lý gara](https://amis.misa.vn/245705/phan-mem-quan-ly-gara-o-to/)
- [MISA AMIS, biểu mẫu kho phụ tùng Excel](https://amis.misa.vn/254461/bieu-mau-quan-ly-kho-phu-tung-o-to-xe-may/)
- [MISA AMIS, quản lý sale phụ tùng](https://amis.misa.vn/262249/phan-mem-quan-sale-phu-tung/)
- [MISA eShop, phần mềm bán hàng phụ tùng](https://www.misaeshop.vn/?p=5415)
- [FPT Shop, phần mềm quản lý gara ô tô](https://fptshop.com.vn/tin-tuc/danh-gia/phan-mem-quan-ly-gara-o-to-189081)
- [App Store, SGARA](https://apps.apple.com/bb/app/sgara/id1602944979)
- [MDM Solutions, AutoCare Pro](https://mdmsolutions.biz/products/autocarpro)

### Bổ sung ở bản 0.2

Tài liệu BA tham khảo do người dùng cung cấp đã được đối chiếu và hợp nhất; các nguồn dưới đây dùng để kiểm chứng và bổ sung.

**Benchmark sản phẩm**

- [Tekmetric, thực hiện kiểm tra xe số](https://tours.tekmetric.com/answers/performing-an-inspection-tekmetric)
- [Tekmetric, 7 tính năng của kiểm tra xe số](https://tours.tekmetric.com/answers/digital-vehicle-inspection-software-7-features-to-look-for)
- [Tekmetric, chữ ký số và duyệt báo giá](https://tours.tekmetric.com/answers/digital-signature-authorization-process-tekmetric)
- [Tekmetric Multi-Shop, quản lý nhiều cửa hàng](https://tours.tekmetric.com/answers/how-to-manage-multiple-auto-repair-shops-with-tekmetric-multi-shop)
- [Tekmetric Multi-Shop, giới thiệu](https://support.tekmetric.com/hc/en-us/articles/8592880372119-Tekmetric-Multi-Shop-Intro)
- [Shopmonkey HQ, chuyển kho giữa các địa điểm](https://support.shopmonkey.io/hc/en-us/articles/42720891279508-Shopmonkey-HQ-Inventory-Transfers)
- [Mitchell 1, Time Manager của Manager SE](https://mitchell1.com/press/mitchell-1-manager-se-adds-new-time-management-features/)

**Chỉ số năng suất kỹ thuật viên**

- [AutoVitals, hiệu suất và năng suất kỹ thuật viên](https://blog.autovitals.com/technician-efficiency)
- [ShopView, giờ tính tiền, giờ khả dụng và giờ làm việc](https://shopview.com/blog/billable-hours-per-diesel-technician)
- [Tire Review, cách định nghĩa khác](https://www.tirereview.com/what-is-your-roadmap-to-profitability/)

**Pháp lý bổ sung**

- [LuatVietnam, Luật 91/2025/QH15 và tin liên quan](https://luatvietnam.vn/bai-viet-lien-quan/luat-91-2025-qh15-405135.html)
- [LSVN, trường hợp xử lý dữ liệu không cần đồng ý](https://lsvn.vn/cac-truong-hop-xu-ly-du-lieu-ca-nhan-khong-can-su-dong-y-cua-chu-the-tu-01-01-2026-a167690.html)
- [MISA eShop, Thông tư 91/2026/TT-BTC](https://www.misaeshop.vn/44493/thong-tu-91-2026-tt-btc-huong-dan-nghi-dinh-254-2026-nd-cp/)
- [Thuế MAN, xử lý hóa đơn lập sai theo Thông tư 91](https://thue.man.net.vn/zh/?p=6985)
- [Luật Việt An, ký hiệu mẫu hóa đơn theo Thông tư 91](https://luatvietan.vn/thong-tu-91-2026-tt-btc.html)
