# 06. Hiện trạng thiết kế và định hướng

Tài liệu mô tả thiết kế nội bộ hiện có, điểm mạnh nên giữ, điểm yếu muốn bạn cải thiện, phần bạn được tự do đổi, phần **không được đổi** (ràng buộc cứng) và tiêu chí chủ dự án dùng để chấm. Người đọc: designer chuẩn bị chốt hướng thị giác.

**Thiết kế hiện có chỉ là hiện trạng để tham khảo, không bắt buộc theo.** Bạn được đề xuất lại bố cục, phong cách và hệ thống thị giác. Mục 4 là ranh giới duy nhất bạn không được vượt.

## 1. Hiện trạng

| Hạng mục | Nội dung |
| --- | --- |
| Hình thức | Prototype HTML/CSS thuần, khoảng 190 trang, đã qua nhiều vòng rà soát nghiệp vụ nội bộ |
| Hướng thị giác | "Calm Enterprise · Purple Accent": nền trung tính sáng, tím thương hiệu chỉ dùng cho hành động chính và trạng thái tương tác, màu trạng thái có nghĩa; border tinh tế thay shadow, bo góc nhẹ ("soft enterprise") |
| Khung | Sidebar trái + topbar + breadcrumb + page header + thanh phạm vi; 5 mẫu trang A–E (tài liệu 03 mục 5) |
| Tham chiếu phong cách (không sao chép) | Stripe (màu thương hiệu có tiết chế), Material Design 3 (vai trò màu ngữ nghĩa, trợ năng), IBM Carbon (nền trung tính, phân lớp bề mặt), Atlassian (token đặt tên theo ý nghĩa) |
| Mô hình token | 3 lớp: giá trị gốc → ngữ nghĩa (`color.text.primary`, `color.status.success`, `color.surface.page`) → thành phần (nút, input, bảng, sidebar, hộp thoại) |
| Component | Nút, form, huy hiệu/tag, thẻ KPI, bảng, thẻ danh sách trên mobile, bộ lọc, điều hướng, stepper/timeline/kanban, hộp thoại/drawer/toast/banner, trạng thái rỗng/tải/lỗi, thành phần riêng cho garage (thẻ xe, thẻ lệnh, thẻ thợ, dòng phụ tùng bốn số, checklist kiểm tra, bảng duyệt) |
| Trợ năng | Mục tiêu WCAG 2.2 AA; bàn phím, focus, `aria` đã thiết kế nhưng **chưa kiểm tra tự động bằng công cụ trên toàn bộ** |
| Dữ liệu | Dữ liệu mẫu tiếng Việt thực tế theo chi nhánh Quận 7 (xem tài liệu 11) |

Hiện trạng kỹ thuật cần biết: prototype chỉ để minh họa (phân quyền, che dữ liệu, lọc đều là mô phỏng); sản phẩm thật dựng bằng component React và máy chủ quyết định quyền. Phông Be Vietnam Pro và bộ icon chuẩn chưa được nhúng đầy đủ vào prototype.

## 2. Token hiện tại (tham khảo)

Bạn có thể giữ, điều chỉnh hoặc thay hoàn toàn. Nếu thay, hãy giao bảng ánh xạ token cũ → mới (tài liệu 07 mục 3).

### 2.1 Màu

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| brand.primary | #635BFF | Nút chính, liên kết, mục đang chọn |
| brand.hover / active / subtle | #5148E5 / #4038C7 / #F1F0FF | Hover, nhấn, nền mục chọn |
| text.primary / secondary / tertiary / disabled | #111827 / #4B5563 / #6B7280 / #9CA3AF | Nội dung chính, mô tả, metadata, vô hiệu |
| surface.page / card / subtle | #F8F9FC / #FFFFFF / #F1F2F6 | Nền trang, thẻ, khu phụ |
| border.default / strong | #E5E7EB / #D1D5DB | Viền mặc định, viền nổi |
| Success | #16A34A (nền #DCFCE7) | Hoàn thành, đã thanh toán, đủ hàng |
| Warning | #D97706 (nền #FEF3C7) | Chờ duyệt, sắp trễ, tồn thấp |
| Danger | #DC2626 (nền #FEE2E2) | Quá hạn, lỗi, hết hàng, thất bại |
| Info | #2563EB (nền #DBEAFE) | Đang xử lý, đang vận chuyển |
| Neutral | #64748B | Nháp, chưa bắt đầu, không hoạt động |
| Purple (trạng thái) | họ tím riêng | Chỉ cho "Chờ QC" |

Bốn hiệu chỉnh đã áp dụng để đạt WCAG: chữ trên huy hiệu dùng bản đậm của màu thay vì màu gốc; liên kết/chữ tím trên nền sáng dùng sắc đậm hơn (brand-600); viền ô nhập liệu `#868D9A` (tương phản 3,34:1 với trắng); focus dùng viền 2px tím cộng vòng sáng, không đổi bo góc khi focus.

Quy tắc màu hiện tại (nên giữ tinh thần): không dùng tím cho mọi trạng thái; xanh lá chỉ cho thành công; vàng/cam là cảnh báo cần chú ý, không trang trí; đỏ cho lỗi hoặc rủi ro; huy hiệu luôn có chữ, nền nhạt chữ đậm.

### 2.2 Chữ

Phông **Be Vietnam Pro**.

| Token | Cỡ / dòng | Đậm | Dùng cho |
| --- | --- | --- | --- |
| display.lg | 32/40 | 700 | KPI nổi bật |
| heading.xl | 24/32 | 600 | Tiêu đề trang |
| heading.lg | 20/28 | 600 | Tiêu đề mục |
| heading.md | 18/26 | 600 | Tiêu đề thẻ |
| heading.sm | 16/24 | 600 | Mục con |
| body.lg | 16/24 | 400 | Nội dung dài |
| body.md | 14/20 | 400 | Nội dung mặc định, bảng |
| body.sm | 13/18 | 400 | Mô tả phụ |
| label.md | 14/20 | 500 | Nhãn form |
| caption | 12/16 | 400 | Metadata |

### 2.3 Khoảng cách, bo góc, độ cao, bố cục

| Hạng mục | Giá trị hiện tại |
| --- | --- |
| Đơn vị cơ sở | 4px; bậc dùng 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Bo góc | 4 (huy hiệu), 6 (input nhỏ), 8 (nút, input, dropdown), 12 (thẻ, panel), 16 (hộp thoại), 20 (khối lớn), tròn (avatar, pill) |
| Độ cao (shadow) | Thẻ: nhẹ; dropdown: vừa; hộp thoại: sâu; vòng focus: 3px tím nhạt. Ưu tiên viền để phân tách, shadow chỉ cho lớp nổi |
| Sidebar | 248px mở / 72px thu gọn |
| Topbar | 64px |
| Lề trang | 32px ngang / 24px dọc; nội dung tối đa 1600px |
| Hàng bảng | 52–56px (gọn 44px) |
| Lưới | 12 cột, gutter 24px ở 1440 |
| Điểm gãy | mobile 0–639; tablet 640–1023; desktop 1024–1279; rộng 1280–1535; cực rộng ≥ 1536 |
| Cỡ nút | nhỏ 32, vừa 40, lớn 44, rất lớn 52 (tablet xưởng) |
| Biểu đồ | Đường (doanh thu theo thời gian), thanh ngang (theo chi nhánh), thanh chồng/donut (cơ cấu), thanh chồng (trạng thái lệnh); luôn có tên, đơn vị, tooltip chính xác, **bảng số liệu thay thế**; không dùng biểu đồ tròn để so sánh nhiều chi nhánh |

## 3. Chữ, icon, chuyển động: bắt buộc hay được đổi

| Hạng mục | Hiện tại | Quy định cho bạn |
| --- | --- | --- |
| Phông chữ | Be Vietnam Pro (tự lưu, 4 độ đậm 400/500/600/700) | Được đề xuất phông khác nếu: hỗ trợ **đầy đủ dấu tiếng Việt** (kể cả chồng dấu), có **số đều chiều rộng (tabular)** và dễ phân biệt 0/O, 1/l/I, giấy phép cho phép tự lưu. Không dùng nhiều hơn 1–2 họ phông |
| Icon | Lucide (nét 1,75–2px; 16/20/24px; không trộn outline và filled) | Được chọn bộ khác nếu nhất quán và có giấy phép; tên icon theo nghĩa nghiệp vụ (xe, lệnh, khách, kho, tiền, báo cáo, cài đặt) |
| Chuyển động | 100–220ms; nhanh, nhẹ | Tôn trọng tùy chọn "giảm chuyển động" của hệ điều hành; không hiệu ứng gây phân tâm ở màn thợ |
| Dark mode | Cấu trúc token sẵn sàng, **chưa phát hành** | Không bắt buộc đợt 1; nếu bạn đề xuất, phải kiểm tương phản đầy đủ |
| Tên sản phẩm | GMEP | Xem tài liệu 09 mục 2 |

## 4. Ràng buộc cứng (không được phá)

Đây là ranh giới nghiệp vụ và an toàn dữ liệu. Vi phạm mục nào cũng làm thiết kế **không đạt** nghiệm thu, dù đẹp đến đâu (tài liệu 07 mục 10). Lý do chi tiết ở tài liệu 05 (số mục ghi cuối dòng).

| # | Ràng buộc cứng | Mục ở tài liệu 05 |
| --- | --- | --- |
| H1 | **Năm đối tượng có bộ trạng thái riêng** (báo giá, lệnh, hạng mục, thanh toán, hóa đơn); không thiết kế một cột/huy hiệu "trạng thái chung"; chi tiết lệnh hiện ba huy hiệu song song | 1 |
| H2 | Lệnh chỉ bắt đầu khi khách duyệt; báo giá duyệt một phần hiện tổng báo giá/tổng được duyệt; nội dung đã duyệt bị khóa, thay đổi qua báo giá bổ sung; phát sinh chưa duyệt không cho thợ làm | 2 |
| H3 | **Không có màn/nút** xuất kho không chứng từ, sửa tồn trực tiếp, xóa chứng từ tài chính hoặc kho đã ghi sổ; chỉ có đảo/điều chỉnh/thay thế/hủy yêu cầu/bỏ ghép | 3, 6 |
| H4 | **Tồn kho bốn số** (Tồn thực tế, Đã giữ, Đang vận chuyển, Có thể bán) luôn rõ ràng, khả dụng được nhấn mạnh; cảnh báo/chặn xuất so với khả dụng | 4 |
| H5 | **Phê duyệt**: người lập không tự duyệt; hạn mức và người duyệt là cấu hình (không viết cứng số tiền); từ chối cần lý do; quá hạn tự chuyển cấp vẫn "Chờ duyệt" | 8 |
| H6 | **Cấu hình có ngày hiệu lực**: thấy giá trị hiện hành, lịch sử, xem trước ảnh hưởng; phiên bản đã dùng không sửa được | 9 |
| H7 | **Che dữ liệu cá nhân theo vai trò**; "Hiện" có ghi nhật ký; giá trị đầy đủ không có sẵn trong trang; không hiển thị cho thợ/quản trị | 10 |
| H8 | **Cách ly dữ liệu**: bản ghi ngoài phạm vi hiện "Không tìm thấy" đồng nhất; không lộ sự tồn tại (kể cả ở đăng nhập, quên mật khẩu, tìm kiếm, danh sách chi nhánh/công ty); mọi KPI/bảng/tệp xuất ghi chi nhánh + kỳ + thời điểm | 11 |
| H9 | **Nút bị chặn nêu lý do bằng chữ hiện sẵn**, vẫn focus được; không ẩn nút trong mục người dùng có quyền xem | 12 |
| H10 | **Xác nhận ba mức** cho thao tác quan trọng; thao tác tiền có khóa chống bấm đúp; thao tác nguy hiểm có hậu quả + lý do + gõ cụm xác nhận | 13 |
| H11 | **Hóa đơn điện tử chống trùng**: không phát hành lại khi timeout (truy vấn trước); chỉ báo đồng bộ tách khỏi huy hiệu trạng thái; không gắn một nhà cung cấp cụ thể; phân biệt môi trường thử/thật | 14 |
| H12 | **Mất mạng chỉ cảnh báo và lưu nháp** (không giả làm offline đầy đủ); thợ: ba nút ghi giờ khóa kèm lý do, có "Nhập bù" | 15 |
| H13 | Trạng thái nghiệp vụ **không chỉ dùng màu**: huy hiệu luôn có chữ; delta KPI có mũi tên + chữ; mọi biểu đồ có bảng thay thế | 1, 19 |
| H14 | **Chỉ tiếng Việt**, VND không số lẻ `1.250.000 ₫`, ngày `dd/MM/yyyy`, số đều chiều rộng cho tiền/số lượng/biển số/mã; mã chứng từ không ngắt dòng | 19 |
| H15 | **Tablet xưởng**: vùng chạm ≥ 44px (nút chính của thợ khoảng 52px); bắt đầu/kết thúc hạng mục **tối đa 2 chạm**; thợ chỉ thấy việc của mình, không thấy giá/SĐT/địa chỉ | Tài liệu 02 mục 1.5 |
| H16 | **Một chi nhánh/một công ty**: giao diện ẩn bộ chọn chi nhánh/pháp nhân khi chỉ có một; một email nhiều công ty cần màn "Chọn công ty" và lối đổi công ty | 17, 18 |
| H17 | **Không hiển thị giá, gói, dùng thử, bộ đếm ngày** trong giao diện | 18 |
| H18 | Máy chủ quyết định quyền, phạm vi, che dữ liệu; thiết kế không giả định client tự lọc/che (ví dụ không đặt giá trị nhạy cảm sẵn trong ẩn/hiện bằng giao diện) | 10, 11, 12 |
| H19 | Không dùng chữ nhỏ hơn 12px cho thông tin nghiệp vụ; bảng 14px; tương phản WCAG 2.2 AA | 19 |
| H20 | Không có xác thực hai lớp (MFA) trong thiết kế (ngoài phạm vi); không cổng khách có tài khoản; không giả định offline đầy đủ | 15 |

## 5. Điểm yếu đã biết và điều muốn bạn cải thiện

Danh sách trung thực từ các vòng rà soát nội bộ và từ phản hồi của chủ dự án. Bạn không bắt buộc giải quyết tất cả theo cách cũ; hãy đề xuất cách tốt hơn.

| # | Điểm yếu | Mô tả | Mong muốn |
| --- | --- | --- | --- |
| W1 | **Mật độ thông tin** | Nhiều màn (bảng dày, chi tiết lệnh, dashboard) còn nhiều khối; nguy cơ giống bảng Excel lớn trái nguyên tắc "không biến thành bảng Excel khổng lồ" | Phân cấp thị giác rõ hơn, tiết lộ dần, ưu tiên "việc cần làm tiếp" |
| W2 | **Màn cấu hình dài** | Các màn cấu hình (thuế, hạn mức, công, mẫu in…) dài, nhiều trường, nhiều phiên bản; khó thấy "đang hiệu lực" so với "đã lên lịch" | Mẫu màn cấu hình rõ ràng: hiện hành / lịch sử / bản nháp, xem trước ảnh hưởng |
| W3 | **Nhiều loại cấu hình dùng một form chung** | Hiện có khoảng 40 loại cấu hình có ngày hiệu lực (thuế, giá, hạn mức, chính sách, danh mục, mẫu chứng từ...) và phần lớn nhập qua cùng một biểu mẫu chung, nên nhập liệu thiếu ngữ cảnh và dễ sai | Đề xuất một hệ mẫu cấu hình theo nhóm (bảng giá trị theo thời gian, ma trận, danh sách mã, tham số đơn) thay vì một form chung, có đủ gợi ý đơn vị/ví dụ |
| W4 | **Chưa kiểm trên thiết bị thật** | Prototype chưa thử trên tablet xưởng, điện thoại, máy in; chưa đo tương phản, bàn phím, trình đọc màn hình ở quy mô toàn bộ | Thiết kế có kiểm tương phản từng cặp màu; ghi chú trợ năng; nếu có thể, thử nhanh với người dùng thật |
| W5 | **In ấn chưa hoàn chỉnh** | Mẫu in nhiều trang (số trang thật, lặp tiêu đề), in nhiệt thật chưa thử | Mẫu in phiếu nhiệt 80mm, A4 hoàn chỉnh (tài liệu 07 mục 5) |
| W6 | **Bộ icon, phông** | Icon vẽ lại kiểu Lucide, phông chưa nhúng đủ | Bộ chuẩn đầy đủ |
| W7 | **Bố cục lịch hẹn và bảng điều phối** | Lưới giờ của lịch hẹn đã bỏ khỏi màn chính, thay bằng danh sách theo ngày/tuần; bảng điều phối (kanban) cần chạy được cả desktop và tablet | Đề xuất bố cục điều phối và lịch tốt hơn |
| W8 | **Vài chi tiết thị giác** | Một số huy hiệu dư thừa (ví dụ nhãn phạm vi), nhãn "Thu gọn" lệch trục ở sidebar, trang showcase tràn ngang ở 390px | Tinh chỉnh |
| W9 | **Nhất quán giữa các nhóm màn** | Prototype do nhiều đợt thiết kế; còn lớp CSS riêng theo nhóm | Một hệ thống thống nhất, không có phiên bản component riêng cho từng nhóm màn |
| W10 | **Dark mode, màn hình lớn/nhỏ** | Chưa có dark mode; 320px mới sửa một phần | Kiểm 320/390/768/1024/1440 |
| W11 | **Hành vi thợ khi mất mạng** | Chính sách Phase 1 là chặn ghi giờ + "Nhập bù" sau; đây là tình huống khó tại xưởng | Thiết kế hướng dẫn rõ ràng, ít gây bực tại xưởng |

## 6. Điểm mạnh nên giữ (tinh thần, không nhất thiết hình thức)

| Mẫu | Vì sao đáng giữ |
| --- | --- |
| **Danh sách có tab và bộ đếm** (ví dụ lệnh theo trạng thái, lịch hẹn) | Người dùng thấy ngay khối lượng việc từng nhóm |
| **Một hành động chính mỗi trang / mỗi dòng** | Giảm nhầm; người không rành công nghệ biết làm gì tiếp |
| **Nút bị chặn nêu lý do** | Giải quyết đúng điểm đau "nút biến mất" |
| **Dải hành trình / ba huy hiệu song song** ở chi tiết lệnh | Trả lời "xe đang ở đâu, tiền thu chưa, hóa đơn xuất chưa" trong một cái nhìn |
| **Bộ chọn phạm vi + thanh phạm vi luôn hiện** | Chống nhầm chi nhánh, đáp ứng yêu cầu thời điểm dữ liệu |
| **Bốn số tồn kho** cạnh nhau, khả dụng nổi bật | Chống dùng nhầm hàng đã giữ |
| **Xác nhận ba mức** tỷ lệ với rủi ro | Phòng ngừa lỗi tiền bạc |
| **Che dữ liệu + nút Hiện** | Tuân thủ luật bảo vệ dữ liệu cá nhân |
| **Trạng thái rỗng có hướng dẫn, skeleton đúng hình, lỗi theo từng khối** | Không sập cả trang khi một khối lỗi |
| **Màn thợ rút gọn, nút lớn, hoàn tác 10 giây** | Hợp bối cảnh xưởng |
| **Toàn bộ câu chữ trạng thái hệ thống** (có hướng khắc phục, không đổ lỗi) | Giọng văn bình tĩnh, câu ngắn |
| **Nguyên tắc màu có tiết chế** | Màu trạng thái giữ nghĩa, không trang trí |

## 7. Được tự do đổi và không được đổi

| Hạng mục | Được tự do đổi | Không được đổi |
| --- | --- | --- |
| Bố cục tổng thể | Kiểu điều hướng (sidebar, thanh trên, kết hợp), vị trí bộ chọn phạm vi, kiểu trang chủ | Phải có bộ chọn phạm vi, thanh phạm vi/thời điểm dữ liệu, tìm toàn cục, thông báo, đổi vai trò/công ty |
| Phong cách thị giác | Bảng màu thương hiệu, phông, icon, bo góc, độ cao, mật độ, minh họa, chuyển động | Ngữ nghĩa màu trạng thái; nghĩa của 5 bộ trạng thái; không chỉ dùng màu; tương phản WCAG 2.2 AA |
| Mẫu trang | Tên và số lượng mẫu, cách chia khối của dashboard/chi tiết/form | Mỗi màn trả lời "Tôi đang ở đâu? Tình trạng gì? Cần làm gì tiếp?" |
| Component | Hình thức, tên, biến thể mới | Có đủ trạng thái (tài liệu 07 mục 4); các thành phần bắt buộc của ràng buộc cứng H1–H20 |
| Luồng thao tác | Thứ tự bước trong một màn, cách chia wizard, gợi ý thông minh (tự điền, mặc định hợp lý) | Các điểm quyết định và điều kiện chặn ở tài liệu 04 |
| Nội dung | Đề xuất lại microcopy tiếng Việt | Thuật ngữ nghiệp vụ trong tài liệu 10; chỉ tiếng Việt; định dạng VND, ngày |
| Dashboard | Chọn biểu đồ, bố cục, KPI hiển thị | Dashboard riêng từng vai trò; phải trả lời 10 câu hỏi buổi sáng của chủ; bảng thay thế cho biểu đồ |
| Responsive | Cách thích ứng từng độ rộng | Dùng được ở 320/390/768/1024/1440; không cuộn ngang toàn trang; bảng dày thành thẻ trên điện thoại |
| In ấn | Bố cục mẫu in | Khổ A4/A5/nhiệt 80mm (58mm cấu hình); thông tin bắt buộc theo luật hóa đơn do chủ dự án cung cấp |

## 8. Tiêu chí "đẹp và best practice" mà chủ dự án sẽ dùng để chấm

Chi tiết trọng số và thang điểm ở tài liệu 07 mục 10. Tóm tắt các câu hỏi chủ dự án sẽ tự hỏi khi xem thiết kế:

1. **Nhìn thoáng 5 giây**: có biết đang ở đâu, tình trạng gì, làm gì tiếp không? Thông tin quan trọng nhất có nổi nhất không?
2. **Cố vấn ở quầy với khách đang chờ** có lập báo giá nhanh, ít bước, ít click không? Tìm xe theo biển số có tức thì không?
3. **Thợ với tay dính dầu mỡ trên tablet** có thao tác đúng với 1–2 chạm, nút đủ lớn, chữ đủ to không?
4. **Chủ garage trên điện thoại lúc 8 giờ sáng** có thấy ngay chi nhánh nào cần can thiệp và duyệt được việc chờ không?
5. **Có sai nghiệp vụ không?** (gộp trạng thái, nút xóa chứng từ, hiện tồn thực tế thay vì khả dụng, lộ dữ liệu cá nhân…): bất kỳ lỗi nào thuộc ràng buộc cứng làm thiết kế không đạt.
6. **Nhất quán**: cùng một việc có cùng một cách làm ở mọi màn không? Có hệ thống token/component rõ ràng không?
7. **Trợ năng**: tương phản, bàn phím, focus, vùng chạm, đọc được không chỉ bằng màu.
8. **Responsive thật** ở 320 đến 1440, không chỉ co giãn cho có.
9. **Khả thi để lập trình**: bám lưới và component lặp lại được; không phụ thuộc hiệu ứng không thể dựng bằng web chuẩn; có đủ trạng thái và dữ liệu thật để dev dựng.
10. **Cảm giác sản phẩm**: chuyên nghiệp, bình tĩnh, đáng tin cho phần mềm quản lý tiền và kho; không phô trương; không giống đồ chơi.
