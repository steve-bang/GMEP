# 08. Brief từng màn hình ưu tiên

Tài liệu gồm brief chi tiết cho 25 nhóm màn hình quan trọng nhất (P0 và một số P1) để bạn thiết kế sâu. Mỗi brief: mục đích, người dùng và thiết bị, dữ liệu hiển thị (kèm ví dụ giả lấy từ tài liệu 11), hành động, trạng thái phải thiết kế, quy tắc liên quan (dẫn mục ở tài liệu 05), tiêu chí đạt và câu hỏi mở. Người đọc: designer đang thiết kế màn hình.

Cách đọc: "Quy tắc" ghi số mục ở tài liệu 05 (ví dụ **05§4** = tồn kho bốn số) và ràng buộc cứng H1–H20 ở tài liệu 06 mục 4. Brief nêu **điều bắt buộc** và **kết quả cần đạt**, không áp đặt bố cục: bạn quyết định cách thể hiện.

Trạng thái chuẩn cho mọi màn danh sách (gọi tắt **TT-L**): đang tải (skeleton) · rỗng lần đầu (hướng dẫn + nút) · rỗng sau lọc (nút xóa lọc) · lỗi + thử lại · không quyền · dữ liệu bị che · mất mạng. Màn form (**TT-F**): mặc định · lỗi theo trường · đang lưu · đã lưu nháp · mất mạng (giữ nháp) · xung đột phiên bản · chỉ đọc kèm lý do · cảnh báo rời trang chưa lưu. Màn chi tiết (**TT-D**): đang tải · không tìm thấy (404 đồng nhất) · không quyền · chỉ đọc theo trạng thái · cảnh báo nghiệp vụ · lịch sử rỗng. Dashboard (**TT-B**): tải và lỗi **từng thẻ** (không sập cả trang) · rỗng từng thẻ · thẻ ẩn do không quyền · số tạm so với chính thức · phạm vi và thời điểm luôn hiện.

Mục lục: 1 Đăng nhập · 2 Khung ứng dụng · 3 Dashboard chi nhánh · 4 Dashboard chủ · 5 Danh sách khách/xe · 6 Chi tiết khách/xe · 7 Tiếp nhận xe · 8 Lập báo giá · 9 Duyệt báo giá · 10 Chi tiết lệnh sửa chữa · 11 Bảng điều phối · 12 Màn thợ tablet · 13 Kiểm tra chất lượng · 14 Giao xe · 15 Thu tiền · 16 Chốt ca/ngày · 17 Hóa đơn điện tử · 18 Tồn kho bốn số · 19 Cấp và xuất phụ tùng · 20 Nhập và chuyển kho · 21 Hàng chờ phê duyệt · 22 Người dùng và phân quyền · 23 Cấu hình có ngày hiệu lực · 24 Nhật ký thao tác · 25 Nhập Excel.

---

## 1. Đăng nhập và chọn công ty/chi nhánh (`G1-AUT-01`, `G1-AUT-04/05/06`, `G1-AUT-08`, `TSU-14`, `G1-AUT-09`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Vào hệ thống an toàn; chọn đúng công ty và chi nhánh làm việc; mọi lỗi dùng câu trung lập |
| Ai dùng, thiết bị | Mọi nhân viên; **desktop, tablet, điện thoại**. Thợ ở xưởng dùng biến thể chọn tên + PIN (brief 12) |
| Dữ liệu hiển thị | Ô email (hoặc mã nhân viên) và mật khẩu (hiện/ẩn); "Quên mật khẩu"; logo GMEP, phiên bản. **Không có nút đăng ký nhân viên** (nhân viên chỉ vào bằng lời mời). Sau mật khẩu đúng: nếu email có từ 2 công ty → danh sách chọn công ty (tên garage, vai trò của mình ở đó); nếu từ 2 chi nhánh → danh sách chi nhánh kèm vai trò từng nơi, chi nhánh "Chỉ xem" có nhãn; một công ty một chi nhánh → vào thẳng. Ví dụ: Trần Văn Bình thấy "Garage Minh Phát (Quản lý chi nhánh)" và "Garage Bình An (Chủ garage)" |
| Hành động | Chính: Đăng nhập. Phụ: Quên mật khẩu, Vào công ty/chi nhánh, Nhớ lựa chọn. Quên mật khẩu → gửi liên kết (thông báo trung lập) → đặt mật khẩu mới (thanh kiểm tra chính sách mật khẩu: tối thiểu 10 ký tự, chặn mật khẩu thông dụng, không dùng 5 mật khẩu gần nhất). Kích hoạt tài khoản qua lời mời (4 bước: xem thông tin được gán chỉ đọc → đặt mật khẩu → đồng ý quy định bảo mật dữ liệu) |
| Trạng thái | Sai thông tin (câu trung lập, nhắc kiểm Caps Lock) · khóa tạm sau nhiều lần sai (đếm lùi lấy từ máy chủ; **cùng câu chữ cho mọi tài khoản**, kể cả không tồn tại) · tài khoản bị vô hiệu (cùng câu trung lập) · mất mạng (thông tin đã nhập được giữ) · đang xử lý · liên kết đặt lại/lời mời hết hạn, đã dùng, bị thu hồi · chưa được gán chi nhánh nào ("Tài khoản chưa được gán chi nhánh nào" + hướng dẫn liên hệ quản lý) · mật khẩu tạm bắt buộc đổi · **hết phiên**: cảnh báo 60 giây trước khi khóa (đếm lùi), khóa màn hình nhập lại mật khẩu và nháp được giữ; phiên tuyệt đối 12 giờ thì đăng nhập lại |
| Quy tắc | **05§11** không lộ sự tồn tại; **05§18** một email nhiều công ty; **05§15** giữ nháp; H8, H16, H20 |
| Tiêu chí đạt | Người dùng không rành công nghệ đăng nhập được ở lần đầu; lỗi nêu cách khắc phục mà không tiết lộ tài khoản có tồn tại; chọn công ty/chi nhánh rõ ràng, không liệt kê nơi không được gán; dùng tốt ở 320px; không có khe MFA hiển thị |
| Câu hỏi mở | Thợ không có email đăng nhập thế nào: bằng "mã công ty + mã nhân viên" hay chỉ PIN trên thiết bị xưởng? `[Chưa chốt cách thể hiện]` (tài liệu 09 mục 3) |

## 2. Khung ứng dụng và bộ chọn phạm vi (`G1-SHL-01`, `G1-SHL-02`, `G1-NTF-01`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Khung chung cho mọi màn: điều hướng theo vai trò, phạm vi dữ liệu luôn hiện, tìm toàn cục, thông báo |
| Ai dùng, thiết bị | Mọi vai trò; desktop, tablet, điện thoại |
| Dữ liệu hiển thị | Menu cấp 1 (ma trận ở tài liệu 03 mục 2), mỗi mục có chế độ quyền dạng chữ nhỏ ("Chỉ xem", "Của tôi"…); bộ chọn phạm vi; **thanh phạm vi** dưới tiêu đề: `Quận 7 · 30/10/2026 · Cập nhật lúc 09:15` + nút làm mới; tìm toàn cục (xe theo biển số, khách, lệnh, báo giá, phụ tùng, chứng từ; chỉ trong phạm vi quyền); chuông thông báo với nhóm "Cần xử lý" và "Thông tin"; menu tài khoản (đổi góc nhìn vai trò, đổi công ty, hồ sơ, đăng xuất) |
| Hành động | Điều hướng; đổi chi nhánh; đổi vai trò; thu gọn menu. Nguy hiểm: đăng xuất khi còn nháp chưa lưu (hỏi) |
| Trạng thái | Banner mất mạng · chi nhánh khóa "Chỉ xem" · phiên sắp hết · tình trạng công ty (hạn chế/tạm ngưng) · **bộ chọn phạm vi**: 1 chi nhánh (chip tĩnh, không bộ chọn), ≥2 chi nhánh, hợp nhất (CH, QV), hợp nhất bị khóa kèm lý do, chi nhánh "ngừng nhận lệnh mới", mất kết nối, có nháp (hỏi lưu), đang tải sau đổi phạm vi · kết quả tìm kiếm: rỗng có gợi ý, quá nhiều kết quả, kết quả bị che, không thấy dữ liệu chi nhánh khác · mobile: thanh điều hướng dưới + "Thêm" |
| Quy tắc | **05§11, 05§12, 05§15, 05§17, 05§18**; H8, H9, H16 |
| Tiêu chí đạt | Chủ và quản lý **không bao giờ nhầm chi nhánh**; đổi giữa một chi nhánh và hợp nhất là hành động chủ động và nhìn thấy; mọi KPI/bảng/tệp xuất ghi phạm vi + kỳ + thời điểm; garage một chi nhánh không thấy bộ chọn mà bố cục vẫn đẹp |
| Câu hỏi mở | Nhóm chi nhánh (ví dụ "Miền Nam") có tồn tại không và ai định nghĩa `[Chưa chốt]`; có hiện số chi nhánh làm ngưỡng bật ô tìm trong bộ chọn không (đề xuất từ 6 chi nhánh) |

## 3. Dashboard quản lý chi nhánh (`G1-DSH-03`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Điều hành ngày: xe, việc quá hạn, kho, duyệt, chốt ngày |
| Ai dùng, thiết bị | Quản lý chi nhánh; **tablet, desktop, điện thoại** |
| Dữ liệu hiển thị | KPI hôm nay (Q7): doanh thu 62.400.000 ₫ (`62,4 tr ₫`), xe đang sửa 18, báo giá chờ khách duyệt 4, trễ hẹn 1; kỹ thuật viên đang làm; biểu đồ thanh chồng trạng thái lệnh; "Việc cần xử lý": Chờ duyệt báo giá 4, Xe chờ phụ tùng 2, Chờ QC 3; kho sắp hết (theo khả dụng); hàng chờ phê duyệt (3 mục); trạng thái chốt ngày; cảnh báo lệch quỹ/lệnh chưa hóa đơn |
| Hành động | Chính: xử lý/duyệt hàng chờ. Phụ: mở bảng điều phối, chốt ngày, đi sâu từ KPI xuống danh sách chứng từ gốc |
| Trạng thái | **TT-B**; chưa chốt ngày hôm qua (cảnh báo); thẻ ẩn nếu thiếu quyền |
| Quy tắc | 05§1, 05§7, 05§8, 05§11; H1, H8, H13 |
| Tiêu chí đạt | Trong 5 giây nhìn ra việc cần làm đầu tiên; KPI nào cũng bấm đi sâu được; trên tablet dùng thoải mái; không quá khoảng 5–6 khối ở màn đầu |
| Câu hỏi mở | Chỉ số "kỹ thuật viên đang làm" hiển thị dạng danh sách hay con số; có cần phân biệt số "Tạm" khi ngày chưa chốt (đề xuất có) |

## 4. Dashboard chủ garage hợp nhất (`G1-DSH-01`, `G4-RPT-02`, `G4-RPT-12`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Chủ trả lời 10 câu hỏi buổi sáng (tài liệu 01 mục 3) trong một màn hình, trên điện thoại |
| Ai dùng, thiết bị | Chủ garage; **điện thoại**, desktop |
| Dữ liệu hiển thị | Bộ lọc kỳ + phạm vi (Tất cả chi nhánh / nhóm / từng chi nhánh); KPI: doanh thu 128,5 tr ₫, lợi nhuận gộp (kèm công thức), số xe, xe đang sửa 42, giá trị tồn 1,25 tỷ ₫, công nợ 86,4 tr ₫; đường doanh thu 7 ngày; thanh ngang doanh thu và lợi nhuận theo chi nhánh (Q7 62,4 · TD 41,3 · DN 24,8 tr ₫); chi nhánh tốt/kém; "Việc cần tôi phê duyệt" (5 mục theo loại); cảnh báo ngoại lệ (xuất kho không chứng từ, lệch quỹ, xe trễ hẹn, lệnh chưa có hóa đơn); chi nhánh nào đã vào số hợp nhất, số ngày chưa chốt |
| Hành động | Chính: mở hàng chờ phê duyệt. Phụ: đổi bộ lọc, đi sâu vào chi nhánh/lệnh, xuất (nếu có quyền). Không có nút sửa số |
| Trạng thái | **TT-B**; số tạm so với chính thức; chỉ một chi nhánh (ẩn thẻ so sánh); 20 chi nhánh (so sánh dạng xếp hạng, không biến thành bảng khổng lồ); tải trong dưới 5 giây (skeleton từng thẻ) |
| Quy tắc | 05§11, 05§7, 05§8; H8, H13; biểu đồ có bảng thay thế, không dùng biểu đồ tròn so sánh nhiều chi nhánh |
| Tiêu chí đạt | Mở điện thoại 8 giờ sáng: biết chi nhánh nào cần can thiệp và duyệt được ngay; số có nhãn phạm vi/thời điểm; hợp nhất khớp tổng chi nhánh |
| Câu hỏi mở | Cách thể hiện lợi nhuận gộp khi phương pháp giá vốn chưa chốt `[Chưa chốt]`; dashboard quản lý vùng dùng chung khung với chủ hay riêng |

## 5. Danh sách khách hàng và danh sách xe (`G2-CRM-01`, `G2-CRM-04`, `G1-SHL-02`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Tìm khách/xe tức thì (đặc biệt theo biển số) khi khách đang đứng ở quầy |
| Ai dùng, thiết bị | Cố vấn, quản lý; **desktop**, tablet |
| Dữ liệu hiển thị | Khách: tên, loại (cá nhân/doanh nghiệp), SĐT che theo vai trò, số xe, lần sửa gần nhất, nhãn, công nợ (nếu có quyền), chi nhánh. Xe: biển số (`51H-123.45`), hãng/dòng, năm, chủ hiện tại, số km gần nhất, hạn đăng kiểm/bảo hiểm, lần sửa gần nhất. Ví dụ: 51H-123.45 · Toyota Vios 2019 · Nguyễn Văn An · 48.200 km |
| Hành động | Chính: "+ Thêm khách" / "+ Thêm xe"; "+ Tiếp nhận xe" từ dòng. Phụ: tìm (không dấu, biển số bỏ dấu chấm/gạch), lọc (nhãn, loại, chi nhánh, xe sắp đến hạn), cột. **Nguy hiểm:** xuất danh sách (cần quyền riêng, lý do, ghi nhật ký), hợp nhất hồ sơ |
| Trạng thái | **TT-L**; nút xuất ẩn/khóa kèm lý do nếu thiếu quyền; SĐT che trong danh sách (không có nút Hiện ở đây); biển số chuẩn hóa khi tìm |
| Quy tắc | 05§10 che dữ liệu, 05§11, 05§19; H7, H14 |
| Tiêu chí đạt | Gõ biển số thấy kết quả ngay; hàng có một hành động chính; trên mobile là thẻ danh sách; không lộ SĐT đầy đủ |
| Câu hỏi mở | Có cần "tìm theo số điện thoại" cho vai trò chỉ thấy SĐT che (đề xuất tìm trên giá trị đầy đủ ở máy chủ nhưng không hiển thị) |

## 6. Chi tiết khách và hồ sơ xe (`G2-CRM-03`, `G2-CRM-06`, `G2-CRM-02/05/07`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Xem toàn cảnh khách và xe: lịch sử sửa chữa mọi chi nhánh (trong quyền), hạng mục từng bị từ chối, bảo hành, đồng ý xử lý dữ liệu |
| Ai dùng, thiết bị | Cố vấn, quản lý; desktop, tablet |
| Dữ liệu hiển thị | **Khách**: thông tin, tab xe (theo quan hệ sở hữu có hiệu lực), lịch sử sửa chữa, báo giá, thanh toán và công nợ (doanh nghiệp: hạn mức 20.000.000 ₫, đang nợ 6.480.000 ₫), đồng ý và căn cứ xử lý (lịch sử đồng ý, rút đồng ý), ghi chú/nhãn, tin nhắn đã gửi. SĐT/địa chỉ che với nút "Hiện" ghi nhật ký. **Xe**: chủ hiện tại và lịch sử sở hữu (từ ngày đến ngày), timeline sửa chữa **xuyên chi nhánh** (ngày, chi nhánh, hạng mục, phụ tùng, km, giá), hạng mục từng từ chối/chưa làm, kết quả kiểm tra xe số các lần, bảo hành còn hạn, lịch nhắc. Ví dụ Ranger 43A-555.12: lần sửa ở Hải Châu (RO-DN-2608-00019) |
| Hành động | Chính: "+ Tiếp nhận xe". Phụ: sửa, thêm ghi chú/nhãn, gửi tin, tạo bảo hành. **Nguy hiểm:** chuyển chủ/đổi biển số (xác nhận nêu hậu quả: lịch sử xe giữ nguyên, chủ cũ không thấy dữ liệu chủ mới), rút đồng ý, ghi nhận yêu cầu xóa/ẩn |
| Trạng thái | **TT-D**; cảnh báo vượt hạn mức công nợ; lịch sử chi nhánh khác chỉ hiện phần được phép; chưa có lịch sử; biển số trùng khi tạo xe (gợi ý mở xe có sẵn); số km thấp hơn lần trước (cảnh báo + lý do) |
| Quy tắc | 05§10, 05§11; H7, H8 |
| Tiêu chí đạt | Cố vấn thấy được "xe này từng làm gì, còn hạng mục nào khách chưa làm" trong một cái nhìn; công nợ chỉ hiện cho vai trò được xem |
| Câu hỏi mở | Chính sách bảo hành chéo chi nhánh (chi nhánh nào chịu chi phí) `[Chưa chốt]`: thiết kế trường cấu hình |

## 7. Tiếp nhận xe (`G2-REC-01`, kèm `G2-CRM-05` nhúng, `G2-PRT-01`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Nhận xe nhanh: nhập biển số → hệ thống tự điền khách/xe → ghi yêu cầu, hiện trạng → in phiếu tiếp nhận |
| Ai dùng, thiết bị | Cố vấn; **desktop quầy**, tablet |
| Dữ liệu hiển thị | Wizard 5 bước: (1) biển số (tìm tức thì; xe mới → form xe nhúng, khách mới → form khách); (2) số km, yêu cầu của khách (lời khách), hiện trạng, ảnh; (3) tài sản để lại, nhắc **hạng mục từng bị từ chối** ở lần trước; (4) dịch vụ, hẹn giao; (5) xem lại, in phiếu. Ví dụ: 51H-123.45 → Nguyễn Văn An, lần sửa gần nhất 12/04/2026 ở 40.100 km, nhập km 48.200 |
| Hành động | Chính: Tiếp tục/Hoàn tất tiếp nhận. Phụ: Lưu nháp, quay lại bước trước, chụp ảnh, in phiếu. Từ lịch hẹn "Đã đến" mở sẵn thông tin |
| Trạng thái | **TT-F + TT-W** (từng bước: chưa làm/đang/hoàn tất/lỗi); biển số trùng; số km thấp hơn lần trước (cảnh báo + lý do bắt buộc); khách thiếu MST khi cần hóa đơn công ty; cảnh báo trùng khách; mất mạng giữ nháp; xung đột |
| Quy tắc | 05§3, 05§10, 05§15, 05§19; H12, H14 |
| Tiêu chí đạt | Tiếp nhận xe quen trong dưới 2 phút; ít gõ (tự điền); từng bước chỉ hiện cái cần (không một form dài); in được phiếu |
| Câu hỏi mở | Có dùng kiểm tra xe số ngay sau tiếp nhận hay không `[Chưa chốt: khách xác nhận nhu cầu INS]` |

## 8. Lập và sửa báo giá (`G2-QUO-02`, `G2-QUO-01`, `G2-QUO-04`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Lập báo giá hạng mục thường gặp dưới 15 phút: chọn gói/hạng mục, giờ chuẩn, phụ tùng kèm tồn khả dụng, tự tính thuế |
| Ai dùng, thiết bị | Cố vấn; **desktop**, tablet |
| Dữ liệu hiển thị | Danh sách hạng mục; mỗi hạng mục có dòng công (giờ chuẩn × đơn giá giờ) và dòng phụ tùng (số lượng × giá niêm yết; **tồn khả dụng ngay cạnh**: ví dụ Má phanh Xpander khả dụng 0, "Đang vận chuyển 4"); giảm giá theo hạn mức; tổng chưa thuế, thuế (theo ngày hiệu lực), tổng gồm thuế; phiên bản (v1, v2); trạng thái (Nháp…); đề xuất hạng mục từ kiểm tra xe số hoặc từ "hạng mục từng bị từ chối". Ví dụ BG-Q7-2610-00233: 5 hạng mục, 6.800.000 ₫ chưa thuế |
| Hành động | Chính: Gửi cho khách. Phụ: Lưu nháp, thêm gói/hạng mục, thêm phụ tùng, xem trước/in. Nguy hiểm: hủy báo giá (ghi lý do) |
| Trạng thái | **TT-F**; giảm giá vượt hạn mức hoặc giá dưới giá vốn → nút Gửi **khóa kèm lý do** và gửi duyệt (05§12); phụ tùng vượt khả dụng (cảnh báo tại ô); bảng giá đổi sau khi gửi (báo giá giữ giá lúc gửi); kênh gửi chưa cấu hình (khóa kèm giải thích, có thể in); đã duyệt thì khóa chỉ đọc |
| Quy tắc | 05§2, 05§4, 05§5, 05§8, 05§12; H2, H4, H5, H9 |
| Tiêu chí đạt | Thêm một hạng mục thường gặp tối đa vài thao tác; thấy ngay tồn và giá; không thể gửi báo giá vi phạm hạn mức; thợ/người không có quyền không thấy giá vốn |
| Câu hỏi mở | Hạn mức giảm giá (ví dụ 5%, 10% theo chương trình): giá trị cấu hình `[Chưa chốt]`; làm tròn thuế theo dòng hay theo hóa đơn `[kế toán chốt]` |

## 9. Duyệt báo giá: chi tiết, tại quầy, trang khách (`G2-QUO-03`, `G2-QUO-05`, `G2-QUO-06`, `G2-QUO-07`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Khách duyệt toàn phần hoặc từng hạng mục, có bằng chứng; chỉ phần được duyệt sang lệnh; xử lý phát sinh |
| Ai dùng, thiết bị | Khách trên **điện thoại** (liên kết, không đăng nhập, chữ ≥ 16px); cố vấn ghi nhận tại quầy trên desktop/tablet; quản lý duyệt phát sinh |
| Dữ liệu hiển thị | Từng hạng mục: tên, công + phụ tùng, giá, nhãn "Bắt buộc an toàn"; tick Duyệt từng hạng mục; **tổng báo giá so với tổng được duyệt** cập nhật tức thì (ví dụ 7.344.000 ₫ → 4.968.000 ₫); phiên bản; bằng chứng duyệt (cách duyệt, thời điểm, mã băm); số điện thoại/địa chỉ che một phần. Phía cố vấn: tổng, phiên bản, dòng từ chối vào danh sách nhắc |
| Hành động | Khách: Duyệt phần đã chọn, Từ chối toàn bộ, Gọi chi nhánh. Cố vấn: ghi nhận duyệt tại quầy (toàn phần/một phần/bằng lời). Phát sinh: thợ đề xuất (ảnh + mô tả) → cố vấn lập báo giá bổ sung → khách duyệt → thợ mới được làm |
| Trạng thái | **TT-P** (trang khách): đang tải · liên kết hết hạn/đã dùng/có bản mới · đã xử lý rồi · lỗi mạng · mất kết nối giữa lúc gửi (thông tin được giữ) · bỏ tick hạng mục bắt buộc (cảnh báo an toàn + lý do) · duyệt xong (màn xác nhận) · hết hạn duyệt phát sinh (24 giờ, cấu hình) |
| Quy tắc | 05§2, 05§10, 05§15; H2, H7 |
| Tiêu chí đạt | Khách hiểu mình đang duyệt gì và tổng bao nhiêu mà không cần gọi; một tay bấm được trên điện thoại; tổng cập nhật rõ; cố vấn thấy rõ phần được duyệt và phần bị từ chối |
| Câu hỏi mở | Có dùng mã OTP gửi số điện thoại làm bước xác nhận tùy chọn không (cần nhà cung cấp SMS) `[Chưa chốt]`; kênh gửi liên kết Zalo hay SMS `[Chưa chốt]` |

## 10. Chi tiết lệnh sửa chữa: màn chuẩn số 1 (`G2-REC-04`, `G2-REC-06`, `G2-PRT-01`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Một nơi trả lời "xe đang ở đâu, ai làm, phụ tùng đã sẵn sàng chưa, tiền thu chưa, hóa đơn xuất chưa" và cho phép hành động tiếp theo |
| Ai dùng, thiết bị | Cố vấn, quản lý, quản đốc; **desktop, tablet**, điện thoại (xem) |
| Dữ liệu hiển thị | Header: mã lệnh `RO-Q7-2610-00128`, biển số `51H-123.45`, xe, khách, **ba huy hiệu song song (Lệnh · Thanh toán · Hóa đơn)**, cố vấn, giờ nhận/hẹn giao; dải hành trình (Đã duyệt → Đang sửa → Chờ QC → Sẵn sàng bàn giao → Hoàn tất); tab/khối: hạng mục (thợ, trạng thái, giờ chuẩn/thực), phụ tùng (đã xuất/đang giữ/thiếu, bốn số), phát sinh (thuộc tính duyệt), thanh toán, hóa đơn, tài liệu; cột bên: liên quan (báo giá nguồn BG-Q7-2610-00231, phiếu xuất), lịch sử/timeline, ghi chú. Ví dụ đầy đủ ở tài liệu 11 mục 5.1 |
| Hành động | Chính: một nút theo trạng thái (ví dụ "Chuyển Chờ QC" khi mọi hạng mục xong; "Thu tiền" khi sẵn sàng bàn giao). Phụ: In phiếu, tạo báo giá bổ sung, đổi thợ. Ba cấp: xem lịch sử; **nguy hiểm:** Hủy lệnh (hoàn kho từng dòng, duyệt) |
| Trạng thái | **TT-D**; 7 trạng thái lệnh và tag lý do tạm dừng ("Chờ phụ tùng", chờ khách duyệt phát sinh, chờ thợ, khác); phát sinh chờ duyệt (nút Bắt đầu của thợ khóa); nút chuyển Chờ QC khóa kèm lý do khi còn hạng mục chưa xong/phụ tùng chưa xuất; hủy sau xuất phụ tùng cần phiếu hoàn kho; lệnh có hóa đơn hiệu lực phải điều chỉnh hóa đơn trước khi hủy; đã hoàn tất (chỉ đọc, vẫn tra lịch sử); xung đột phiên bản; cập nhật khi trạng thái đổi |
| Quy tắc | 05§1, 05§2, 05§3, 05§4, 05§6, 05§12, 05§16; H1–H4, H9 |
| Tiêu chí đạt | Chính màn này kiểm chứng toàn bộ hệ thống thiết kế: ba huy hiệu không lẫn, hành động tiếp theo rõ, không quá tải thông tin; dùng được ở tablet đặt cạnh xe; cột phụ xuống dưới khi màn hẹp |
| Câu hỏi mở | Quy trình đồng sơn có thêm công đoạn riêng không `[Chưa chốt]` (thiết kế khối hạng mục có thể mở rộng theo cấu hình công đoạn) |

## 11. Danh sách lệnh và bảng điều phối (`G2-REC-02`, `G2-REC-03`, `G2-REC-05`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Cố vấn/quản lý/quản đốc thấy toàn xưởng: xe ở đâu, kẹt gì, ai nhiều việc |
| Ai dùng, thiết bị | Cố vấn, quản lý, quản đốc; **desktop, tablet** (điều phối và phân thợ ưu tiên tablet) |
| Dữ liệu hiển thị | Danh sách: tab theo trạng thái lệnh có bộ đếm; hàng hiện các huy hiệu tách (Lệnh/Thanh toán/Hóa đơn), biển số, khách, hẹn giao, thợ, trễ hẹn. Bảng điều phối: dải **"trước lệnh"** (lịch hẹn, chờ tiếp nhận, báo giá chờ duyệt) tách khỏi các cột trạng thái lệnh (Đã duyệt, Đang sửa, Tạm dừng, Chờ QC, Sẵn sàng bàn giao); thẻ lệnh (biển số, khách, hạng mục đang làm, thợ, giờ hẹn, cờ trễ). Phân thợ: hạng mục chưa phân + tải việc của từng thợ (giờ chuẩn đã giao so với giờ khả dụng, nhãn chữ "Quá tải") |
| Hành động | Mỗi thẻ một hành động chính (mở lệnh). **Không kéo-thả để đổi trạng thái** (chuyển trạng thái có điều kiện, qua nút trong chi tiết). Phân thợ: chọn thợ chính cho hạng mục. Tạm dừng bắt buộc lý do |
| Trạng thái | **TT-L / TT-B**; làm mới tự động (khoảng 15–30 giây) + chỉ báo "có thay đổi mới"; lọc "Xe chờ phụ tùng" = Tạm dừng có lý do Chờ phụ tùng; lệnh trễ hẹn |
| Quy tắc | 05§1, 05§11; H1, H15 |
| Tiêu chí đạt | Nhìn bảng biết nút thắt trong 5 giây; tablet kéo cuộn ngang trong khung, không cuộn ngang cả trang; "Chờ phụ tùng" nhìn là lý do, không phải cột trạng thái |
| Câu hỏi mở | Có cần chế độ xem theo thợ (swimlane) cho quản đốc |

## 12. Màn thợ trên tablet (`G1-AUT-10`, `G1-DSH-07`/`G2-TEC-01`, `G2-TEC-02`, `G2-TEC-03`, `G2-TEC-04`, `G2-TEC-05`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Thợ biết việc tiếp theo, bắt đầu/kết thúc hạng mục đúng người, xin phụ tùng, báo phát sinh, xem công mình |
| Ai dùng, thiết bị | Thợ, quản đốc; **tablet dùng chung tại xưởng**, tay dính dầu mỡ, đứng |
| Dữ liệu hiển thị | Chọn tên trong lưới thợ ca hôm nay (ảnh/tên) → PIN 6 số (bàn phím lớn). Việc của tôi: danh sách theo thứ tự ưu tiên (xe, biển số, hạng mục, giờ chuẩn, trạng thái); việc đang làm nổi bật; chờ phụ tùng; chờ khách duyệt phát sinh (**nút Bắt đầu khóa kèm lý do**); công hôm nay. **Không giá, không SĐT, không địa chỉ** (tên khách rút gọn + biển số). Ví dụ Đỗ Minh Khôi: "51H-123.45 Vios · Thay má phanh trước · giờ chuẩn 1,0 · Đang làm" |
| Hành động | Chính: **Bắt đầu / Tạm dừng / Kết thúc: tối đa 2 chạm**, **Hoàn tác 10 giây** thay vì hộp thoại. Phụ: Yêu cầu phụ tùng (chỉ phụ tùng có trong lệnh; thấy trạng thái yêu cầu 6 bước), báo hư hỏng phát sinh (chụp ảnh + mô tả), xem công |
| Trạng thái | Nút lớn khoảng 52px; tự khóa sau 3 phút không dùng (quay lưới thợ, giữ nháp); PIN sai (khóa tạm sau nhiều lần, báo quản đốc); thiết bị chưa đăng ký; **mất mạng**: ba nút ghi giờ **khóa kèm lý do**, hướng dẫn ghi giờ thật lên phiếu giấy và báo quản đốc; sau khi có mạng "Khai giờ thực" chờ quản đốc xác nhận, nhãn "Nhập bù"; yêu cầu phụ tùng/báo phát sinh khi mất mạng hiện "CHƯA gửi"; rỗng ("Chưa có việc được giao"); QC trả lại (việc bị trả + lỗi) |
| Quy tắc | 05§2, 05§3, 05§10, 05§13, 05§15; H2, H12, H15 |
| Tiêu chí đạt | Thợ bắt đầu một hạng mục chỉ bằng ≤ 2 chạm, không cần đọc hướng dẫn; chữ và nút đọc được từ khoảng cách tay; không lộ giá/SĐT; mất mạng không gây hiểu nhầm là đã ghi giờ |
| Câu hỏi mở | Thợ không có email đăng nhập thiết bị thế nào (lưới tên + PIN, thiết bị đã đăng ký) và có hỗ trợ quét thẻ không `[Chưa chốt]`; giờ làm có hiển thị cho thợ không và theo công thức nào `[Chưa chốt công thức công]` |

## 13. Kiểm tra chất lượng (`G2-DLV-01`, `G2-DLV-02`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Quản đốc/QC kiểm cuối theo checklist; đạt thì xe sẵn sàng giao; không đạt thì trả lại có lỗi gắn thợ |
| Ai dùng, thiết bị | Quản đốc/QC; **tablet**, desktop |
| Dữ liệu hiển thị | Hàng chờ QC (lệnh, biển số, thợ, thời gian chờ); checklist (đạt/không đạt từng mục, ghi chú, ảnh); danh sách hạng mục để chọn "Trả lại". Ví dụ RO-Q7-2610-00129 Kia Morning chờ QC |
| Hành động | Chính: Đạt → Sẵn sàng bàn giao. Không đạt: chọn hạng mục "Trả lại", ghi lỗi, gắn thợ → lệnh về Đang sửa. Phụ: thêm ảnh, ghi chú |
| Trạng thái | **TT-L / TT-F**; "Đạt" bị chặn khi còn phát sinh chưa có quyết định cuối (khóa kèm lý do); đã QC (chỉ đọc); mất mạng giữ nháp |
| Quy tắc | 05§1, 05§12, 05§16; H1, H9 |
| Tiêu chí đạt | Chấm một checklist nhanh trên tablet, một tay; lỗi trả lại gắn đúng thợ và hiện ở "Việc của tôi" của thợ |
| Câu hỏi mở | Mẫu checklist theo loại dịch vụ do ai thiết kế (cấu hình, màn `G4-SYS-14`) |

## 14. Giao xe (`G2-DLV-03`, `G2-DLV-04`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Kiểm đủ điều kiện giao xe; khách xác nhận nhận xe; lệnh Hoàn tất |
| Ai dùng, thiết bị | Cố vấn; **desktop**, tablet |
| Dữ liệu hiển thị | Danh sách điều kiện có/không đạt: QC đạt; thanh toán đủ hoặc công nợ hợp lệ; hóa đơn đã xuất hoặc "không lấy hóa đơn" theo cấu hình; phụ tùng đã xuất; giấy tờ. Biên bản giao xe: tóm tắt hạng mục đã làm, hạng mục khách từ chối (nhắc lần sau), chữ ký khách. Ví dụ RO-Q7-2610-00127: còn thiếu 1.510.000 ₫ |
| Hành động | Chính: Xác nhận giao xe. Phụ: In biên bản, mở thu tiền/phát hành hóa đơn từ điều kiện chưa đạt |
| Trạng thái | Nút Giao xe khóa kèm lý do cho từng điều kiện chưa đạt; khách doanh nghiệp vượt hạn mức công nợ (chặn hoặc cần duyệt); đã giao (chỉ đọc) |
| Quy tắc | 05§1, 05§12, 05§14; H1, H9 |
| Tiêu chí đạt | Cố vấn thấy ngay "còn thiếu gì để giao" và bấm đi xử lý; không thể giao khi chưa QC |
| Câu hỏi mở | Chính sách lưu xe khi khách không nhận `[Chưa chốt]` |

## 15. Thu tiền theo lệnh (`G4-ACC-01`, `G4-ACC-02`, `G4-ACC-03`, `G4-ACC-07`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Thu tiền nhanh, đúng, có thể thu nhiều lần, nhiều hình thức, trừ cọc; không bao giờ xóa |
| Ai dùng, thiết bị | Thu ngân; **desktop quầy** (có thể có máy in nhiệt) |
| Dữ liệu hiển thị | Lệnh cần thu (số phải thu, đã thu, còn lại: ví dụ RO-Q7-2610-00127 phải thu 3.510.000 ₫, đã thu 2.000.000 ₫ chuyển khoản, còn 1.510.000 ₫); hình thức thanh toán (tiền mặt, chuyển khoản…) nhiều dòng; trừ cọc/khoản nhận trước; phiếu thu đã tạo (PT-Q7-2610-00210…); phân bổ nhiều-nhiều (một lần thu nhiều hóa đơn cho khách doanh nghiệp, phần dư thành khoản nhận trước); huy hiệu Thanh toán |
| Hành động | Chính: Ghi nhận thanh toán (xác nhận mức Tiền: nêu số tiền, ô "đã đối chiếu", khóa chống bấm đúp). Phụ: in phiếu thu (A5/nhiệt). Sửa sai: **Đảo bút toán** (mức nguy hiểm); hoàn tiền (đề xuất, duyệt vượt hạn mức). **Không có nút Xóa** |
| Trạng thái | **TT-F**; thu khi lệnh chưa đủ điều kiện (khóa kèm lý do: lệnh còn Chờ QC); đang xử lý/đã ghi; mất mạng khóa nút giữ nháp; bản đảo hiển thị liên kết hai chiều; tổng ròng đã trừ bút toán đảo; ca chưa mở (nhắc mở ca) |
| Quy tắc | 05§6, 05§12, 05§13, 05§14; H3, H10 |
| Tiêu chí đạt | Thu một lệnh đơn giản trong vài thao tác; không thể ghi trùng khi bấm hai lần; số tiền luôn nổi bật ở bước xác nhận |
| Câu hỏi mở | Hạn mức hoàn tiền `[Chưa chốt]`; có đối soát QR/ngân hàng ngay không (giai đoạn 4) |

## 16. Chốt ca và chốt ngày (`G4-ACC-08`, `G4-ACC-09`, `G4-ACC-04`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Cuối ca thu ngân đếm quỹ; cuối ngày quản lý chi nhánh khóa ngày, dưới 30 phút |
| Ai dùng, thiết bị | Thu ngân (chốt ca), quản lý chi nhánh (chốt ngày); desktop, tablet |
| Dữ liệu hiển thị | Chốt ca (wizard): quỹ đầu ca 2.000.000 ₫ + thu tiền mặt 1.620.000 ₫ = sổ quỹ 3.620.000 ₫; ô nhập số thực đếm (3.600.000 ₫) → **chênh lệch −20.000 ₫** → giải trình. Chốt ngày: danh sách mục chặn (lệnh còn mở 4, hoàn tất chưa thu 1, chưa hóa đơn 2, chênh lệch quỹ chưa duyệt), mỗi mục có liên kết xử lý; tổng doanh thu ngày khớp tổng phiếu thu |
| Hành động | Chính: Chốt ca / Khóa ngày. Phụ: giải trình, đi xử lý từng mục chặn. Nguy hiểm: **Khóa ngày** (mức 3), mở lại ngày (chủ duyệt, lý do, nhập lại mật khẩu) |
| Trạng thái | Nút "Khóa ngày" **khóa kèm lý do** khi còn mục chặn; chênh lệch vượt hạn mức → giải trình + duyệt; ngày đã khóa (chỉ đọc, không chọn được ngày đã khóa); chưa chốt ngày hôm qua (cảnh báo ở dashboard) |
| Quy tắc | 05§7, 05§8, 05§12, 05§13; H5, H9, H10 |
| Tiêu chí đạt | Quản lý thấy ngay "còn gì chặn", xử lý từng mục không rời màn; khóa ngày là thao tác có ý thức, không bấm nhầm |
| Câu hỏi mở | Hạn mức chênh lệch quỹ chấp nhận được `[Chưa chốt]` |

## 17. Hóa đơn điện tử (`G4-EIN-01/02/03/05/06`, `G4-EIN-04`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Phát hành hóa đơn từ lệnh, chống trùng, theo dõi trạng thái từ nhà cung cấp, xử lý lỗi và điều chỉnh/thay thế/hủy |
| Ai dùng, thiết bị | Thu ngân, kế toán; **desktop** |
| Dữ liệu hiển thị | Danh sách: số, lệnh, khách, số tiền, tab trạng thái (Chưa xuất, Đã xuất, Điều chỉnh, Thay thế, Hủy) + **chỉ báo đồng bộ riêng** (Đang gửi, Lỗi phát hành chờ thử lại). Hộp thoại phát hành: kiểm điều kiện (thông tin người mua nếu đứng tên công ty, thuế suất, đơn vị phát hành), tóm tắt tiền. Chi tiết: bản thể hiện, XML/PDF, liên kết lệnh gốc và mọi phiên bản. "Lệnh hoàn tất chưa có hóa đơn". Hàng chờ lỗi: truy vấn trước, thử lại. Ví dụ: 1C26TMP / 00000087 Đã xuất 1.620.000 ₫; RO-TD-2610-00057 Chưa xuất, chỉ báo lỗi |
| Hành động | Chính: Phát hành (xác nhận mức Tiền, khóa chống trùng). Phụ: Gửi khách, truy vấn lại, thử lại. **Nguy hiểm:** điều chỉnh/thay thế/hủy (kế toán trưởng duyệt, nêu lý do, liên kết hóa đơn gốc), đổi sang môi trường thật |
| Trạng thái | Chặn phát hành khi thiếu điều kiện (nêu điều kiện nào); timeout (truy vấn trước, không phát hành lại); nhà cung cấp lỗi/ngắt kết nối; chưa xác minh doanh nghiệp (chỉ chạy hóa đơn thử); môi trường thử/thật; hóa đơn của lệnh đã hủy |
| Quy tắc | 05§1, 05§6, 05§13, 05§14; H11 |
| Tiêu chí đạt | Không có cách nào phát hành hai hóa đơn cho một lệnh bằng bấm lặp; trạng thái từ nhà cung cấp và tiến trình đồng bộ không lẫn; không thấy tên nhà cung cấp cứng trong thiết kế |
| Câu hỏi mở | Nhà cung cấp hóa đơn điện tử `[Chưa chốt]`; thời điểm lập hóa đơn, cách ghi tiền đặt cọc `[kế toán chốt]` |

## 18. Tồn kho bốn số (`G3-INV-04`, `G3-INV-01`, `G3-INV-03`, `G3-INV-05`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Thủ kho/quản lý thấy tồn đúng, tránh dùng nhầm hàng đã giữ; thấy hàng sắp hết để đặt |
| Ai dùng, thiết bị | Thủ kho, quản lý; **desktop**, điện thoại |
| Dữ liệu hiển thị | Bảng phụ tùng: mã, tên, nhóm, **Tồn thực tế · Đã giữ · Đang vận chuyển · Có thể bán**, định mức, huy hiệu (Đủ hàng/Sắp hết/Hết hàng/Chưa đặt định mức), tag "Đang vận chuyển N", "Đã đặt N"; giá vốn che với vai trò không được xem; thẻ kho (lịch sử biến động) ở chi tiết. Ví dụ MP-0305 Má phanh Xpander: 0 · 0 · 4 · 0, Hết hàng + "Đang vận chuyển 4"; LL-0010: 12 · 3 · 0 · 9, Sắp hết (định mức 10) |
| Hành động | Chính: mở chi tiết/tạo yêu cầu mua. Phụ: lọc, sắp xếp mặc định theo khả dụng tăng dần, xuất. **Không có "Sửa tồn"** |
| Trạng thái | **TT-L**; khả dụng < 0 (Hết hàng + cảnh báo dữ liệu lệch); chưa đặt định mức (liên kết cấu hình); giá vốn `•••••`; mobile: bốn số thành 2×2 |
| Quy tắc | 05§4, 05§5, 05§10; H3, H4 |
| Tiêu chí đạt | Bốn số cạnh nhau, khả dụng nổi bật, không nhầm với tồn thực tế; một mặt hàng "Hết hàng nhưng Đang vận chuyển 4" nhìn hiểu ngay |
| Câu hỏi mở | Số lượng thập phân theo đơn vị (lít) hay chỉ nguyên `[Chưa chốt]`; phương pháp giá vốn `[Chưa chốt]` |

## 19. Cấp phụ tùng cho lệnh và phiếu xuất kho (`G3-INV-06`, `G3-INV-07`, `G2-TEC-03`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Thợ yêu cầu → thủ kho xuất theo lệnh → giữ chỗ chuyển thành xuất, ghi giá vốn; thiếu hàng thì lệnh Tạm dừng |
| Ai dùng, thiết bị | Thủ kho (**desktop, tablet**); thợ gửi yêu cầu trên tablet |
| Dữ liệu hiển thị | Hàng chờ xuất theo lệnh: lệnh, biển số, thợ, dòng phụ tùng, số lượng yêu cầu, khả dụng; 6 trạng thái yêu cầu (Đã gửi, Thủ kho đã nhận, Đã xuất một phần, Đã xuất đủ, Thiếu hàng chờ hàng về, Đã hủy). Phiếu xuất (GIN): dòng, số lượng, lô; giá vốn che với thủ kho. Ví dụ YC-Q7-2610-00412: bugi × 4, dầu CVT × 5 xuất; má phanh × 1 thiếu hàng |
| Hành động | Chính: Xuất kho. Phụ: Nhận yêu cầu, báo thiếu hàng (tạo chuyển kho/yêu cầu mua), hủy. Xuất bất thường cần quản lý duyệt |
| Trạng thái | Chỉ phụ tùng có trong lệnh; vượt khả dụng (chặn, lý do + lối ra); mã trong đợt kiểm kê đang mở (cảnh báo); lệnh Tạm dừng khi thiếu hàng; mất mạng khóa nút |
| Quy tắc | 05§3, 05§4, 05§12; H3, H4 |
| Tiêu chí đạt | Thủ kho xuất đúng phiếu nhanh; không có đường xuất không chứng từ; thợ biết yêu cầu của mình đang ở bước nào |
| Câu hỏi mở | Có xuất theo lô/serial không `[Chưa chốt]` |

## 20. Nhập kho và chuyển kho giữa chi nhánh (`G3-INV-09`, `G3-INV-12/13/14`, `G3-INV-17`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Nhập đúng đơn mua; chuyển hàng giữa chi nhánh hai bước, hàng đang đi chưa thuộc kho nào; kiểm kê và điều chỉnh có duyệt |
| Ai dùng, thiết bị | Thủ kho, quản lý; **desktop**, tablet |
| Dữ liệu hiển thị | Nhập: dòng theo đơn mua (đặt/đã nhận/đang nhận), cảnh báo lệch số lượng/giá, nhận nhiều lần (ví dụ DM-Q7-2610-00018 nhận 60/100 lít). Chuyển kho: phiếu có trạng thái (Nháp → Chờ duyệt → Chờ gửi → Đang vận chuyển → Đã nhận hoặc Có chênh lệch → Đã đóng); bên gửi (kho, số lượng, giá trị), bên nhận xác nhận **số lượng thực**; biên bản chênh lệch + ảnh; phần lệch treo trên hàng đang vận chuyển. Ví dụ CK-TD-2610-00012 (4 bộ má phanh Xpander, đang vận chuyển), CK-Q7-2610-00014 (46.800.000 ₫, chờ duyệt) |
| Hành động | Chính: Gửi/Nhận hàng/Ghi sổ. Phụ: lưu nháp, đính ảnh, báo lệch. Nguy hiểm: ghi nhận kết quả xử lý chênh lệch, đóng đơn mua khi chưa nhận đủ (duyệt) |
| Trạng thái | Phiếu chờ duyệt vì giá trị lớn (hiện ai duyệt, hạn mức `[Chưa chốt]`); bên nhận xác nhận ít hơn bên gửi; không vượt ranh giới công ty; bên nhận bấm hai lần (chống trùng); mất mạng |
| Quy tắc | 05§3, 05§4, 05§8; H3, H4, H5 |
| Tiêu chí đạt | Người nhận thấy rõ "đã nhận bao nhiêu / còn bao nhiêu / lệch gì"; chênh lệch nhìn thấy và không biến mất; hàng đang đi có chỗ hiển thị riêng |
| Câu hỏi mở | Chứng từ khi điều chuyển giữa chi nhánh khác tỉnh `[kế toán chốt]`; ngưỡng chuyển kho giá trị lớn `[Chưa chốt]` |

## 21. Hàng chờ phê duyệt (`G4-APR-01`, `G4-APR-02`, `G4-APR-04`, `G4-APR-03`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Người có quyền duyệt xử lý yêu cầu nhanh, đúng cấp, có bằng chứng; người lập thấy yêu cầu của mình |
| Ai dùng, thiết bị | Quản lý chi nhánh, quản lý vùng, chủ, kế toán trưởng; **điện thoại là thiết bị chính**, tablet, desktop |
| Dữ liệu hiển thị | Danh sách theo loại và cấp ("Chờ cấp: Chủ garage"), số lượng theo loại, thời gian chờ, hạn tự chuyển cấp; chi tiết (drawer/trang): so với hạn mức, bản ghi gốc, lịch sử (nhắc, chuyển cấp), người đề xuất. 6 ví dụ ở tài liệu 11 mục 10 (giảm giá, hủy lệnh, chênh lệch quỹ, chuyển kho, hóa đơn thay thế, yêu cầu mua) |
| Hành động | Chính: Duyệt. **Nguy hiểm:** Từ chối (lý do bắt buộc), Chuyển cấp (ghi chú). Duyệt hàng loạt (cùng loại). Nhập lại mật khẩu theo loại |
| Trạng thái | **TT-L**; đang chờ tôi; **đã tự chuyển cấp** (vẫn "Chờ duyệt", cấp trước bị khóa kèm lý do); người lập không tự duyệt (khóa kèm lý do); cấp không đủ quyền; xung đột (đã có người duyệt); quá hạn; thủ kho không thấy giá trị tiền; hạn mức chưa ban hành (cảnh báo) |
| Quy tắc | 05§8, 05§12, 05§13; H5, H9, H10 |
| Tiêu chí đạt | Quản lý duyệt 10 yêu cầu trên điện thoại trong vài phút; luôn thấy vì sao yêu cầu cần duyệt và vượt bao nhiêu; không thể tự duyệt |
| Câu hỏi mở | Có vai trò "quản lý vận hành/trưởng kho" riêng không `[Chưa chốt]`; ủy quyền duyệt (mặc định tắt) có cần giao diện đợt 1 không |

## 22. Danh sách người dùng và phân quyền (`G4-SYS-01`, `G4-SYS-02`, `G4-SYS-03`, `G4-SYS-04`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Tạo người dùng, gán vai trò và chi nhánh, gửi lời mời; xem ma trận quyền và quyền che dữ liệu |
| Ai dùng, thiết bị | Quản trị hệ thống, quản lý chi nhánh (chỉ chi nhánh mình), chủ; **desktop** |
| Dữ liệu hiển thị | Danh sách: họ tên, mã nhân viên, vai trò, chi nhánh, trạng thái tài khoản (Đã liên kết/Chưa liên kết/Đã khóa), lần đăng nhập gần nhất. Form: gán vai trò + chi nhánh (nhiều vai trò, quyền cộng gộp theo chi nhánh), gửi lời mời (hiệu lực 72 giờ). Chi tiết: phiên đăng nhập, cấp mã tạm, mở khóa, **lý do khóa thật** (chỉ quản lý/quản trị thấy). Ma trận vai trò × hành động (xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất, quản lý) + bảng quyền che dữ liệu |
| Hành động | Chính: Tạo/Gửi lời mời. Phụ: sửa, khóa, cấp mã tạm. **Nguy hiểm:** đổi vai trò (nhập lại mật khẩu), thu hồi quyền; quản lý không gán vai trò cao hơn mình |
| Trạng thái | **TT-L / TT-F**; lời mời hết hạn (gửi lại); nhân viên không có email; người dùng nhiều công ty (một email nhiều tư cách: vai trò tách theo từng công ty); quản trị không xem dữ liệu nghiệp vụ nhạy cảm |
| Quy tắc | 05§10, 05§11, 05§12, 05§13, 05§18; H7, H8 |
| Tiêu chí đạt | Ma trận quyền dễ đọc và không làm quản trị gán nhầm quyền; thấy rõ ai có quyền gì ở chi nhánh nào |
| Câu hỏi mở | Vai trò quản trị trụ sở và nhân viên QC chưa có mã vai trò chính thức `[Chưa chốt]`; thiết kế để thêm vai trò không đổi cấu trúc |

## 23. Một màn cấu hình có ngày hiệu lực: thuế suất (`G4-SYS-10`, mẫu cho `G4-SYS-07/09/11/12`, `G3-HRM-06`, `G4-APR-03`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Mẫu cho mọi cấu hình thay đổi theo luật/chính sách: thấy hiện hành, lịch sử, tạo phiên bản mới có ngày hiệu lực, xem trước ảnh hưởng |
| Ai dùng, thiết bị | Kế toán (thuế), chủ (duyệt), quản trị; **desktop** |
| Dữ liệu hiển thị | Bảng phiên bản: giá trị · hiệu lực từ · đến · trạng thái (Đang hiệu lực / Đã lên lịch / Đã hết hiệu lực / Nháp) · đã dùng trong chứng từ chưa · người tạo. Ví dụ ở tài liệu 11 mục 13 (8% từ 01/07/2025 đến 31/12/2026; 10% từ 01/01/2027 đã lên lịch). Form tạo phiên bản: giá trị + ngày hiệu lực + nhóm áp dụng; **xem trước** "Từ ngày … áp dụng cho …; chứng từ đã tạo giữ nguyên"; hiển thị tầng kế thừa (nền tảng/công ty/chi nhánh) |
| Hành động | Chính: Tạo phiên bản mới. Phụ: gửi duyệt, lưu nháp, so sánh phiên bản. **Không có sửa/xóa phiên bản đã dùng** (chỉ "Tạo phiên bản mới từ bản này") |
| Trạng thái | **TT-F**; phiên bản đã dùng (chỉ đọc kèm lý do); ngày hiệu lực trùng/lệch lịch (lỗi nêu cách sửa); chờ duyệt; hạn mức chưa ban hành (cảnh báo); xung đột phiên bản |
| Quy tắc | 05§9, 05§6, 05§13; H6 |
| Tiêu chí đạt | Kế toán đổi thuế suất cho 2027 mà không sợ làm sai chứng từ cũ; "đang hiệu lực" và "đã lên lịch" không lẫn; mẫu này tái sử dụng được cho các loại cấu hình khác nhưng vẫn đủ ngữ cảnh từng loại |
| Câu hỏi mở | Nhóm công/phụ tùng nào được áp mức 8% `[kế toán chốt]`; thuế suất khi lệnh mở qua mốc 01/01/2027 `[kế toán chốt]` |

## 24. Nhật ký thao tác (`G4-SYS-19`, `G4-RPT-10`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Truy vết ai làm gì, khi nào, trên bản ghi nào; bất biến |
| Ai dùng, thiết bị | Quản trị hệ thống (xem), chủ, quản lý (trong chi nhánh), kế toán (liên quan); **desktop** |
| Dữ liệu hiển thị | Cột: thời điểm, người (tên + vai trò), hành động, đối tượng (liên kết), chi nhánh, lý do (nếu có), chi tiết trước/sau, loại (truy cập dữ liệu cá nhân, thay đổi giá, tồn kho, thanh toán, duyệt, đăng nhập). Ví dụ ở tài liệu 11 mục 12 |
| Hành động | Chính: lọc/tìm. Phụ: mở bản ghi liên quan, xuất (cần quyền, ghi nhật ký). **Không có sửa/xóa** |
| Trạng thái | **TT-L**; bản ghi ngoài phạm vi (không hiện); rất nhiều dòng (phân trang/cuộn ảo); lỗi tải |
| Quy tắc | 05§6, 05§10, 05§16; H7, H8 |
| Tiêu chí đạt | Quản trị tìm được "ai đã xem số điện thoại khách X" nhanh; bảng đọc dễ dù rất dày; nhật ký không có hành động sửa |
| Câu hỏi mở | Thời hạn lưu nhật ký `[Chưa chốt]` |

## 25. Nhập dữ liệu từ Excel (`G4-SYS-20`, `G4-SYS-21`)

| Mục | Nội dung |
| --- | --- |
| Mục đích | Khởi tạo dữ liệu từ file Excel của khách: danh mục phụ tùng, khách/xe, tồn đầu kỳ, công nợ, nhân sự, dịch vụ/giờ chuẩn/bảng giá |
| Ai dùng, thiết bị | Quản trị hệ thống, quản lý; **desktop** |
| Dữ liệu hiển thị | Wizard: chọn loại dữ liệu và tải mẫu chuẩn → tải tệp → ánh xạ cột → **xem trước và báo lỗi theo từng dòng** (ví dụ 1.248 dòng, 1.231 hợp lệ, 17 lỗi; dòng 45 mã trùng; dòng 112 thiếu giá nhập) → xác nhận ghi lô. Lịch sử lô: ai nhập, khi nào, số dòng, trạng thái, hoàn tác theo lô |
| Hành động | Chính: Tiếp tục/Ghi lô. Phụ: tải bản lỗi về, sửa tệp và tải lại. **Nguy hiểm:** ghi lô (gõ cụm xác nhận), hoàn tác lô (chủ duyệt) |
| Trạng thái | **TT-W**; tệp sai định dạng/quá lớn; ánh xạ thiếu cột bắt buộc; có lỗi (cho ghi phần hợp lệ hay chặn: nêu rõ); đang xử lý nền (tiến độ); thành công; hoàn tác; lô giới hạn số dòng/ngày |
| Quy tắc | 05§6, 05§13, 05§16; H3, H10 |
| Tiêu chí đạt | Người không rành công nghệ nhập được danh mục phụ tùng mà không cần hỗ trợ; lỗi nêu dòng nào, cột nào, sửa thế nào; không có đường ghi dữ liệu sai mà không xem trước |
| Câu hỏi mở | Số năm lịch sử sửa chữa cần chuyển `[Chưa chốt]`; chuẩn hóa mã phụ tùng khi gộp tên trùng ("Lọc dầu Toyota" và "Oil Filter Toyota") |
