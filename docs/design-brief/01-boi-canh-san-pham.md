# 01. Bối cảnh sản phẩm

Tài liệu này giải thích GMEP là gì, phục vụ ai, vì sao cần, quy mô và thiết bị sử dụng, và bối cảnh pháp lý ở mức designer cần biết. Người đọc: designer bên ngoài, chưa biết gì về dự án.

## 1. Sản phẩm là gì

GMEP (Garage Management ERP) là một **ứng dụng web** thay cách quản lý bằng Excel của một chuỗi garage ô tô. Một hệ thống duy nhất đi từ **tiếp nhận xe** đến **xuất hóa đơn điện tử**, gồm:

| Phân hệ (mã) | Nội dung chính |
| --- | --- |
| Tiếp nhận và lệnh sửa chữa (REC) | Nhận xe, báo giá, khách duyệt, lệnh sửa chữa, phân thợ, kiểm tra chất lượng, giao xe |
| Kiểm tra xe số (INS) | Mẫu kiểm tra, ảnh/video, mức xanh–vàng–đỏ, chuyển lỗi thành dòng báo giá |
| Khách hàng và xe (CRM) | Hồ sơ khách, hồ sơ xe theo biển số, lịch sử sửa chữa, lịch hẹn, nhắc bảo dưỡng và đăng kiểm |
| Kho và phụ tùng (INV) | Danh mục, tồn theo chi nhánh, nhập, xuất, kiểm kê, chuyển kho giữa chi nhánh |
| Mua hàng (PUR) | Yêu cầu mua, duyệt, đơn mua, nhận hàng nhiều lần, đối chiếu hóa đơn nhà cung cấp |
| Nhân sự và nhân công (HRM) | Ca làm, giờ công, công thợ theo việc, hoa hồng, năng suất |
| Doanh thu và kế toán vận hành (ACC) | Thu tiền, sổ quỹ, chốt ca và chốt ngày, công nợ, giá vốn, lãi lỗ theo chi nhánh |
| Hóa đơn điện tử (EIN) | Phát hành qua nhà cung cấp hóa đơn, đồng bộ trạng thái, điều chỉnh, thay thế, hủy |
| Báo cáo và dashboard (RPT) | Dashboard riêng cho từng vai trò, báo cáo chi nhánh, so sánh, đối chiếu |
| Hệ thống (SYS) | Đăng nhập, vai trò và quyền, phạm vi chi nhánh, cấu hình, phê duyệt, nhật ký thao tác, nhập Excel |

Chủ đạo xuyên suốt: **lệnh sửa chữa là chứng từ gốc** của một lần xe vào xưởng. Công, phụ tùng, giờ làm, thanh toán và hóa đơn đều phát sinh từ lệnh; không có phụ tùng xuất, tiền thu hay hóa đơn nằm ngoài một chứng từ gốc.

Kế toán trong sản phẩm là **kế toán vận hành/quản trị**. Khách giữ phần mềm kế toán riêng; GMEP kết xuất dữ liệu cuối kỳ. Lập báo cáo tài chính, tờ khai thuế, tính lương và đóng bảo hiểm xã hội **nằm ngoài phạm vi**.

## 2. Khách hàng và vấn đề

Khách hàng đầu tiên là chủ một chuỗi garage ô tô nhiều chi nhánh trên toàn quốc (một công ty TNHH nhiều chi nhánh; có thể liên kết thêm garage khác sau). Họ đang dùng Excel, mỗi chi nhánh một file.

| Vấn đề khi dùng Excel | Hậu quả |
| --- | --- |
| Hồ sơ xe, lịch sử bảo dưỡng ghi rời rạc | Tra cứu chậm, không nhắc được bảo dưỡng, bảo hiểm |
| Tồn kho phụ tùng phụ thuộc thao tác tay, quên phiếu xuất | Lệch tồn, thất thoát, khó truy vết |
| Không lưu lịch sử chỉnh sửa | Không biết ai sửa gì, không có trách nhiệm giải trình |
| Thông tin khách nằm ở Excel, điện thoại, Zalo, sổ tay | Không có hồ sơ khách thống nhất |
| Công nợ ghi tay | Nhầm công nợ phải thu, phải trả |
| Mỗi chi nhánh một file | Chủ không biết chi nhánh nào lãi lỗ, không điều chuyển phụ tùng được |

Người dùng cuối **không phải dân công nghệ**: chủ garage, quản lý chi nhánh, cố vấn dịch vụ, thợ, thủ kho, thu ngân, kế toán. Họ cần nhìn là hiểu, biết làm gì tiếp theo, hạn chế thao tác sai.

Ngoài chuỗi đầu tiên, GMEP được thiết kế để các chủ garage khác cũng đăng ký và dùng chung nền tảng (mục 7).

## 3. Mục tiêu kinh doanh

Ba mục tiêu chính: **dừng dùng Excel**, **kiểm soát thất thoát phụ tùng và công thợ**, **cho chủ garage số liệu hợp nhất theo ngày**. Các mức dưới đây là đề xuất, cần đo baseline của khách trước khi chốt.

| Mục tiêu | Chỉ số | Mức đề xuất |
| --- | --- | --- |
| Thay hoàn toàn Excel | Tỷ lệ nghiệp vụ nhập trên hệ thống | 100% sau giai đoạn chạy song song |
| Kiểm soát phụ tùng | Chênh lệch kiểm kê so với tồn hệ thống | Dưới 2% giá trị tồn mỗi kỳ |
| Truy vết xuất kho | Phụ tùng xuất gắn với lệnh hoặc phiếu bán lẻ | 100% |
| Tốc độ phục vụ | Từ nhận xe đến gửi báo giá cho khách | Dưới 15 phút với hạng mục thường gặp |
| Số liệu theo ngày | Thời gian chốt doanh thu cuối ngày của chi nhánh | Dưới 30 phút |
| Hợp nhất toàn chuỗi | Độ trễ để chủ xem lãi lỗ từng chi nhánh | Cuối mỗi ngày |
| Tuân thủ hóa đơn | Lệnh hoàn tất có hóa đơn điện tử đúng hạn | 100% |

**Ý nghĩa với thiết kế:** thao tác lập báo giá phải nhanh (dưới 15 phút); chốt ngày dưới 30 phút; chủ phải trả lời được các câu hỏi buổi sáng chỉ từ dashboard.

### Mười câu hỏi chủ garage cần trả lời được mỗi sáng

Dashboard của chủ phải giúp trả lời mà không cần gọi từng chi nhánh:

1. Hôm nay toàn hệ thống có bao nhiêu xe đang sửa?
2. Chi nhánh nào đang hoạt động tốt nhất?
3. Lệnh sửa chữa nào đang chậm tiến độ?
4. Thợ nào đang quá tải?
5. Phụ tùng nào đang thiếu hoặc tồn lâu?
6. Chi nhánh nào doanh thu cao nhưng lợi nhuận thấp?
7. Khách còn nợ tổng cộng bao nhiêu?
8. Tiền mặt tại mỗi chi nhánh có khớp với hệ thống không?
9. Khoản chi nào chưa được phê duyệt?
10. Chi nhánh nào đang có vấn đề cần chủ can thiệp?

## 4. Quy mô thiết kế

Số liệu do khách ước tính, **chưa xác nhận**; dùng để quyết định mật độ thông tin và hiệu năng cảm nhận.

| Chỉ số | Hiện tại | Sau 2 năm |
| --- | --- | --- |
| Chi nhánh | 8 | 20 |
| Xe tiếp nhận mỗi ngày (toàn chuỗi) | 120 đến 200 | 500 đến 800 |
| Người dùng | 80 đến 100 | 250 đến 300 |

Hàm ý: danh sách phải lọc/tìm/phân trang tốt (hàng nghìn bản ghi); dashboard chuỗi 20 chi nhánh phải đọc được trên một màn hình (so sánh, xếp hạng, không biến thành bảng Excel khổng lồ); thêm chi nhánh chỉ là cấu hình nên danh sách chi nhánh có thể dài.

### Mục tiêu hiệu năng và tin cậy (đề xuất, ảnh hưởng đến thiết kế)

| Mục tiêu | Mức đề xuất |
| --- | --- |
| Thao tác thường ngày (tiếp nhận, báo giá, tìm phụ tùng) | Dưới 2 giây trên mạng 4G |
| Dashboard hợp nhất toàn chuỗi | Dưới 5 giây |
| Hoạt động giờ làm việc | 99,5% |
| Thợ bắt đầu/kết thúc một hạng mục trên tablet | Tối đa 2 lần chạm |

Vì vậy: dùng skeleton thay spinner toàn trang, tải theo từng khối, không để một khối lỗi làm sập cả trang.

## 5. Thiết bị

| Thiết bị | Ai dùng | Đặc điểm thiết kế |
| --- | --- | --- |
| **Desktop tại quầy/văn phòng** | Cố vấn, thu ngân, thủ kho, kế toán, mua hàng, nhân sự, quản trị | Thao tác nhanh bằng bàn phím, bảng dày, chốt ngày/ca, tìm kiếm toàn cục, in A4/A5/phiếu nhiệt |
| **Tablet tại xưởng** | Thợ, quản đốc/kiểm tra chất lượng, thủ kho khi kiểm kê | Nút lớn, vùng chạm tối thiểu 44px, bắt đầu/kết thúc hạng mục không quá 2 chạm; thợ dùng chung thiết bị, đăng nhập bằng chọn tên + PIN; tay có thể dính dầu mỡ |
| **Điện thoại** | Chủ garage, quản lý (xem KPI, duyệt) | Dashboard, hàng chờ phê duyệt, danh sách dạng card, nút lớn; quét mã vạch bằng camera ở kiểm kê |
| **Điện thoại của khách** | Khách hàng (không tài khoản, mở liên kết) | Trang công khai, chữ tối thiểu 16px, ngôn ngữ đơn giản, mobile-first |

Trình duyệt mục tiêu: Chrome, Edge, Safari bản mới; tablet Android và iPad. Model máy cụ thể và máy in **chưa chốt**.

Mất mạng: sản phẩm chỉ **cảnh báo và lưu nháp**; không phải offline đầy đủ (xem tài liệu 05 mục 15).

## 6. Mô hình tổ chức và phạm vi dữ liệu

Phân cấp (thứ tự từ ngoài vào trong):

```
Nền tảng GMEP
  └─ Tenant (một khách hàng/garage độc lập, dữ liệu tách hẳn nhau)
       └─ Công ty (pháp nhân; có thể là một hoặc nhiều)
            └─ Chi nhánh (một cửa hàng)
                 └─ Kho
```

| Khái niệm | Điều designer cần biết |
| --- | --- |
| Chi nhánh | Mọi dữ liệu nghiệp vụ gắn với đúng một chi nhánh. Hầu hết vai trò chỉ thấy chi nhánh được gán. Chủ garage thấy toàn chuỗi (xem từng chi nhánh hoặc hợp nhất). Thêm chi nhánh chỉ là cấu hình |
| Công ty (pháp nhân) | Hiện giả định một pháp nhân (chưa chốt). Bộ lọc/nhãn "Pháp nhân" **chỉ hiện khi có nhiều hơn một**; báo cáo chính thức không cộng gộp qua pháp nhân |
| Tenant | Mỗi garage độc lập là một tenant; người dùng không bao giờ thấy dữ liệu của tenant khác. Nhân viên chỉ vào bằng lời mời; chủ garage tự đăng ký tenant mới (làm sau, giai đoạn riêng) |
| Một email, nhiều công ty | **Đã chốt:** một email có thể thuộc nhiều tenant (mỗi tư cách thành viên có vai trò riêng). Phiên làm việc luôn thuộc đúng một tenant. Cần màn "Chọn công ty" sau khi đăng nhập và lối "Đổi công ty" trong phiên |
| Garage một chi nhánh | Chủ garage nhỏ không cần thấy khái niệm chi nhánh/kho: giao diện **ẩn** bộ chọn chi nhánh, so sánh chi nhánh; mô hình dữ liệu vẫn giữ nguyên |

Chọn phạm vi dữ liệu và các nhãn phạm vi được mô tả ở tài liệu 02 mục 4 và tài liệu 05 mục 11.

## 7. Phân kỳ phát triển

| Giai đoạn | Nội dung | Ghi chú cho thiết kế |
| --- | --- | --- |
| Khám phá (Discovery) | Chốt quyết định còn mở với khách | Nhiều mục còn [Chưa chốt] (tài liệu 09) |
| Giai đoạn 1: pilot một chi nhánh | Tiếp nhận, báo giá, lệnh sửa chữa, khách và xe cơ bản, kho cơ bản, thu tiền và chốt ca/ngày tối thiểu, hóa đơn điện tử cơ bản, hệ thống (đăng nhập, phân quyền, phê duyệt, nhật ký), báo cáo một chi nhánh; kiểm tra xe số nếu khách xác nhận | **Đợt thiết kế P0 và P1 bám giai đoạn này** |
| Giai đoạn 2 | Nhiều chi nhánh hợp nhất, chuyển kho liên chi nhánh, kiểm kê, mua hàng, công nợ phải thu/phải trả, nhân sự và công thợ, hoa hồng, phê duyệt nhiều cấp, lịch hẹn nâng cao, bảo hành | P2 |
| Giai đoạn 3 | Kế toán và hóa đơn điện tử đầy đủ, kết xuất dữ liệu sang phần mềm kế toán | P2 trở đi |
| Giai đoạn 4 | Đối soát QR/ngân hàng, báo cáo nâng cao | Sau |
| Nền tảng nhiều garage (multi-tenant) | Phần nền (tách dữ liệu, một email nhiều công ty) thuộc giai đoạn 1; tự đăng ký garage mới làm sau pilot ổn định | Màn đăng ký công ty: tài liệu 03 nhóm TEN |

Hiện trạng triển khai: các luồng lõi đã chạy được ở môi trường thử, giao diện đang theo prototype nội bộ. Thiết kế mới của bạn sẽ được áp dụng dần vào ứng dụng đang xây. Vì vậy thiết kế cần **khả thi để chuyển thành component web có cấu trúc**, không phải tranh minh họa.

## 8. Bối cảnh pháp lý Việt Nam (ở mức designer cần biết)

Pháp lý không phải việc của designer, nhưng nó tạo ra một số **hành vi bắt buộc trên giao diện**. Nội dung dưới đây tổng hợp từ nguồn công khai, không phải tư vấn pháp lý, và có điểm đang chờ kế toán hoặc luật sư của khách xác nhận.

| Lĩnh vực | Nội dung | Ảnh hưởng đến UI |
| --- | --- | --- |
| Hóa đơn điện tử | Nghị định 254/2026/NĐ-CP (hiệu lực từ 01/07/2026) và Thông tư 91/2026/TT-BTC hướng dẫn. Báo giá và lệnh sửa chữa **không phải** hóa đơn; chỉ coi là hóa đơn khi nhà cung cấp hóa đơn trả trạng thái hợp lệ | Phát hành hóa đơn phải chống trùng khi bấm nhiều lần hoặc timeout; hiển thị trạng thái do nhà cung cấp trả; điều chỉnh/thay thế/hủy qua chứng từ mới, không "sửa" hóa đơn; không gắn một nhà cung cấp cụ thể vào giao diện |
| Kế toán | Thông tư 99/2025/TT-BTC (hoặc 152/2025/TT-BTC cho hộ kinh doanh) | Giao dịch tiền đã ghi sổ **không xóa**, chỉ đảo hoặc điều chỉnh; khóa ngày/kỳ |
| Thuế giá trị gia tăng | Mức 8% đến hết 31/12/2026, từ 01/01/2027 dự kiến trở lại mức cũ nếu không gia hạn (kế toán khách xác nhận nhóm áp dụng) | Thuế suất là cấu hình có ngày hiệu lực, không hard-code; báo giá hiển thị giá đã gồm thuế và "trong đó thuế" cho khách cá nhân |
| Bảo vệ dữ liệu cá nhân | Luật Bảo vệ dữ liệu cá nhân 2025 (hiệu lực 01/01/2026) và Nghị định 356/2025 | **Che số điện thoại và địa chỉ theo vai trò**, nút "Hiện" có ghi nhật ký truy cập, ghi nhận đồng ý và căn cứ xử lý, quyền yêu cầu xem/sửa/xóa của chủ dữ liệu, xuất danh sách khách cần quyền riêng |
| Dữ liệu nhân viên | Phải xóa/ẩn danh dữ liệu cá nhân nhân viên khi nghỉ việc, trừ dữ liệu bắt buộc lưu theo luật kế toán | Màn chính sách lưu trữ và ẩn danh |
| Kiểm định xe | Thông tư 30/2026/TT-BXD: chu kỳ kiểm định theo loại xe và năm sản xuất | Nhắc đăng kiểm dùng bảng chu kỳ cấu hình có ngày hiệu lực |

Điểm cần kế toán/luật sư của khách xác nhận (không giả định): thời điểm lập hóa đơn, cách ghi tiền đặt cọc, thuế suất khi lệnh mở qua mốc 01/01/2027, đơn vị phát hành hóa đơn của từng chi nhánh.

## 9. Tiền tệ, ngày giờ, ngôn ngữ

| Hạng mục | Quy ước |
| --- | --- |
| Ngôn ngữ giao diện | **Chỉ tiếng Việt**, có dấu đầy đủ; không đa ngôn ngữ ở giai đoạn này. Dữ liệu mẫu không dùng Lorem ipsum |
| Tiền tệ | VND, không số thập phân; dấu chấm ngăn hàng nghìn; ký hiệu ` ₫` sau số; ví dụ `1.250.000 ₫`; căn phải, dùng số đều chiều rộng (tabular) |
| Tiền rút gọn | Chỉ ở thẻ KPI và kèm đơn vị, ví dụ `128,5 tr ₫` |
| Ngày | `dd/MM/yyyy`; giờ 24h; tuần bắt đầu Thứ Hai; ví dụ `30/10/2026 09:15`, "Thứ Sáu, 30/10/2026" |
| Biển số xe | Lưu chuẩn hóa; hiển thị ô tô `51H-123.45`, kiểu cũ `51H-1234`; tìm kiếm không phân biệt dấu, bỏ dấu chấm/gạch |
| Mã chứng từ | Dạng `LOẠI-MÃ CHI NHÁNH-YYMM-STT`, ví dụ `RO-Q7-2610-00128`; đều chiều rộng, không ngắt dòng; chấp nhận tìm bằng STT |
| Tìm kiếm | Không phân biệt dấu ("da nang" ra "Đà Nẵng") |
| Chuỗi dài | Tiếng Việt dài hơn tiếng Anh: nhãn nút co giãn, không cố định chiều rộng |

## 10. Ngoài phạm vi (không cần thiết kế)

- Tính lương, bảo hiểm xã hội, khai thuế thu nhập cá nhân; lập báo cáo tài chính, tờ khai thuế.
- Ứng dụng di động riêng (native) cho khách hay nhân viên; cổng khách đầy đủ có tài khoản (khách chỉ dùng liên kết).
- Xác thực hai lớp (MFA): **chủ dự án quyết ngoài phạm vi**. Đăng nhập bằng mật khẩu; chỉ giữ một "khe" cho xác thực mạnh về sau, hiện không hiển thị.
- Bán/cho thuê xe, thương mại điện tử phụ tùng, tích hợp hãng xe, AI chẩn đoán.
- Giá, gói dịch vụ, dùng thử: **không xuất hiện trong giao diện**.
- Dark mode: không phát hành ở đợt đầu (xem tài liệu 07 mục 3).
