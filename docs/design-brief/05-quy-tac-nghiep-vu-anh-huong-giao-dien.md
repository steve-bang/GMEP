# 05. Quy tắc nghiệp vụ ảnh hưởng đến giao diện

Tài liệu liệt kê các quy tắc **bắt buộc thể hiện trên giao diện**. Mỗi quy tắc có "vì sao" (để bạn hiểu và bảo vệ được quyết định thiết kế) và "UI phải làm gì". Người đọc: designer; đây là phần dễ làm sai nhất và là cơ sở của "ràng buộc cứng" ở tài liệu 06.

Mã tham chiếu như `RULE-010` là mã trong tài liệu yêu cầu nội bộ của dự án, để bạn hỏi lại chủ dự án khi cần.

## 1. Năm đối tượng, năm bộ trạng thái riêng

**Quy tắc.** Báo giá, lệnh sửa chữa, hạng mục sửa chữa, thanh toán và hóa đơn là **năm đối tượng riêng**, mỗi đối tượng có bộ trạng thái riêng. **Không dùng một trạng thái chung** cho tất cả.

**Vì sao.** Một lệnh có thể "Hoàn tất" nhưng thanh toán vẫn "Chưa thanh toán" (công nợ) và hóa đơn "Chưa xuất"; một hạng mục có thể "Hoàn thành" trong khi lệnh vẫn "Đang sửa"; báo giá có thể duyệt một phần. Gộp lại sẽ làm sai báo cáo và gây nhầm lẫn khi thu tiền, giao xe.

**UI phải làm gì.**

- Màn chi tiết lệnh hiện **song song ba huy hiệu tách nhau**: Lệnh · Thanh toán · Hóa đơn. Danh sách lệnh cũng hiện các huy hiệu tách, không một cột "trạng thái" duy nhất.
- Mỗi huy hiệu gắn đúng đối tượng; chữ trên huy hiệu luôn là chữ, không chỉ màu.
- Công nợ quá hạn là **cờ "Quá hạn"** cạnh Thanh toán, không phải trạng thái mới.

### 1.1 Bộ trạng thái chính thức và màu ngữ nghĩa

Màu dưới đây là **ý nghĩa** (Success = xanh lá, Warning = vàng/cam, Danger = đỏ, Info = xanh dương, Neutral = xám, Purple = tím). Bạn được chọn sắc độ cụ thể, nhưng phải giữ **ngữ nghĩa** và đảm bảo các màu phân biệt được với nhau và đạt tương phản (tài liệu 07 mục 7). Quy tắc chung: huy hiệu nền nhạt + chữ đậm cùng họ màu.

| Đối tượng | Trạng thái → màu → chữ trên huy hiệu |
| --- | --- |
| **Lịch hẹn / Tiếp nhận** (trước lệnh) | Chờ xác nhận (Warning) · Đã hẹn (Info) · Chờ tiếp nhận (Neutral) · Đã tiếp nhận (Success) · Không đến (Neutral) · Đã hủy (Danger) |
| **Báo giá** (6 trạng thái, +1 chờ xác nhận) | Nháp (Neutral) · **Chờ khách duyệt** = trạng thái "Đã gửi" (Warning) · Duyệt toàn phần (Success) · Duyệt một phần (Warning) · Từ chối (Danger) · Hết hạn (Neutral) · Đã hủy (Neutral, kèm lý do) `[Chưa chốt: trạng thái thứ 7]` |
| **Lệnh sửa chữa** (7) | Đã duyệt (Neutral) · Đang sửa chữa (Info) · Tạm dừng (Warning, kèm tag lý do, ví dụ "Chờ phụ tùng") · Chờ QC (Purple) · Sẵn sàng bàn giao (Success) · Hoàn tất (Success) · Đã hủy (Danger) |
| **Hạng mục sửa chữa** (5) | Chưa làm (Neutral) · Đang làm (Info) · Tạm dừng (Warning) · Hoàn thành (Success) · Trả lại (Danger, QC không đạt) |
| Thuộc tính duyệt của hạng mục phát sinh (không phải trạng thái thứ 6) | Chờ khách duyệt (Warning) · Đã duyệt (Success) · Khách từ chối (Danger) · Hết hạn (Neutral) · Đã hủy (Neutral) |
| **Thanh toán** | Chưa thanh toán (Warning) · Thanh toán một phần (Info) · Đã thanh toán (Success) · Hoàn tiền (Neutral; hoàn một phần là tag "Đã hoàn một phần N ₫") |
| **Hóa đơn** | Chưa xuất (Neutral) · Đã xuất (Success) · Điều chỉnh (Info) · Thay thế (Info) · Hủy (Danger) |
| Kho (suy ra từ tồn khả dụng) | Đủ hàng (Success) · Sắp hết (Warning) · Hết hàng (Danger) · Chưa đặt định mức (Neutral) |

Bộ huy hiệu của các đối tượng phụ:

| Đối tượng | Trạng thái → màu |
| --- | --- |
| Chứng từ kho (nhập, xuất, hoàn, điều chỉnh) | Nháp (Neutral) · Chờ duyệt (Warning) · Đã ghi sổ (Success) · Từ chối (Danger) · Đã hủy, chỉ nháp (Neutral) |
| Yêu cầu cấp phụ tùng (6) | Đã gửi (Info) · Thủ kho đã nhận (Info) · Đã xuất một phần (Warning) · Đã xuất đủ (Success) · Thiếu hàng, chờ hàng về (Warning) · Đã hủy (Neutral) |
| Yêu cầu mua | Nháp (Neutral) · Chờ duyệt (Warning) · Chờ hậu duyệt (Warning) · Đã duyệt (Success) · Từ chối (Danger) · Đã lập đơn (Info) · Đã hủy (Neutral); tag "Mua gấp" (Warning) |
| Đơn mua | Nháp · Đã gửi (Info) · NCC xác nhận (Info) · Nhận một phần (Warning) · Nhận đủ (Success) · Đã đóng (Neutral) · Đã hủy (Neutral); tag "Trễ N ngày" (Danger) |
| Phiếu chuyển kho | Nháp (Neutral) · Chờ duyệt (Warning) · Chờ gửi (Info) · Đang vận chuyển (Info) · Có chênh lệch (Danger) · Đã nhận (Success) · Đã đóng (Neutral) · Từ chối (Danger) |
| Đợt kiểm kê | Đang đếm (Info) · Chờ duyệt (Warning) · Đã ghi sổ (Success) · Từ chối, cần đếm lại (Danger) · Đã hủy (Neutral) |
| Đối chiếu ba bên | Chờ hóa đơn (Warning) · Khớp (Success) · Lệch giá (Danger) · Lệch số lượng (Danger) · Chênh lệch chờ duyệt (Warning) · Đã ghi công nợ (Success) |
| Dòng công thợ | Chờ QC (Purple) · Đã ghi (Success) · QC trả lại (Danger) · Đã đảo (Neutral) |
| Kỳ công | Đang mở (Info) · Đã duyệt (Success) · Đã khóa (Neutral, biểu tượng khóa); tag "Số tạm" (Warning) |
| Nhân sự, chấm công, nhà cung cấp | Đang làm/Đang trong ca/Đang hợp tác (Success) · Nghỉ phép/Đi muộn N phút (Warning) · Đã nghỉ/Chưa vào ca/Đã ra ca/Tạm ngừng/Ngừng hợp tác (Neutral) |

Quy tắc chung: "Chờ duyệt" luôn Warning; "Từ chối" luôn Danger; "Đã ghi sổ/Đã duyệt/Nhận đủ" Success; "Nháp/Đã hủy/Đã đóng" Neutral; Purple chỉ cho "Chờ QC" và hành động chính. "Đã hủy" có hai màu có chủ đích: lệnh sửa chữa và lịch hẹn là Danger, các đối tượng còn lại Neutral. Không dùng huy hiệu cho loại chứng từ hay loại biến động.

Tham chiếu: `FR-REC-028`, `FR-REC-015`.

## 2. Lệnh chỉ bắt đầu từ khi khách duyệt; báo giá có phiên bản; phát sinh cần duyệt

**Quy tắc.** Không mở lệnh khi báo giá chưa được khách duyệt (WF-01). Báo giá có phiên bản và có thể duyệt một phần; **chỉ dòng được duyệt** sang lệnh. Việc phát sinh ngoài báo giá cần báo giá bổ sung và duyệt trước khi làm (`RULE-005`, `RULE-006`, WF-03). Báo giá đã giữ phiên bản giá lúc gửi.

**Vì sao.** Bảo vệ khách khỏi bị tính thêm; có bằng chứng duyệt; tranh chấp giá rất phổ biến trong ngành.

**UI phải làm gì.**

- Duyệt một phần: hiện rõ **tổng báo giá / tổng được duyệt**; dòng nào được duyệt, dòng nào không.
- Bỏ chọn hạng mục "Bắt buộc" (an toàn) mở cảnh báo kèm lý do.
- Báo giá đã duyệt: nội dung đã duyệt **bị khóa** (không có nút sửa); mọi thay đổi đi qua "Báo giá bổ sung".
- Hạng mục phát sinh chờ duyệt: hiện tag "Chờ khách duyệt (phát sinh)"; nút **Bắt đầu của thợ bị khóa kèm lý do**.
- Phiên bản cũ hiện "Phiên bản cũ (chỉ đọc)"; liên kết cũ của khách hiện "Có bản mới".

## 3. Không có thao tác nào nằm ngoài chứng từ gốc

**Quy tắc.** Phụ tùng chỉ xuất khi có lệnh, phiếu bán lẻ hoặc phiếu điều chuyển/lý do hợp lệ (`RULE-007`, WF-02). Thu tiền và hóa đơn luôn gắn một chứng từ gốc. Mỗi lệnh có mã duy nhất.

**Vì sao.** Thất thoát phụ tùng là một trong ba mục tiêu chính của dự án; mục tiêu "xuất kho không chứng từ = 0".

**UI phải làm gì.**

- **Không thiết kế** màn "xuất kho không chứng từ", "sửa tồn trực tiếp". Nếu bạn thấy cần, hãy hỏi chủ dự án.
- Thợ chỉ chọn được phụ tùng **có trong lệnh**.
- Mọi chứng từ hiện liên kết tới chứng từ gốc/liên quan.

## 4. Tồn kho có bốn con số

**Quy tắc.** Mỗi phụ tùng có bốn số, luôn hiển thị theo thứ tự này: **Tồn thực tế · Đã giữ · Đang vận chuyển · Có thể bán (khả dụng)**. Khả dụng = Thực tế − Giữ chỗ; **hàng đang vận chuyển không cộng vào**. Cảnh báo đặt hàng và chặn xuất so với **khả dụng**, không so với tồn thực tế (`RULE-008`). Mọi biến động tồn đều có lịch sử (`RULE-009`).

**Vì sao.** Nếu chỉ hiển thị tồn thực tế, nhân viên dùng nhầm số hàng đã dành cho lệnh khác.

Ví dụ: Dầu động cơ 5W-30 tồn thực tế 20, giữ cho lệnh 5, khả dụng 15; hàng đang chuyển từ chi nhánh khác không tính vào 15.

**UI phải làm gì.**

- Bốn số hiện cạnh nhau, **khả dụng được nhấn mạnh**; nhãn luôn bằng chữ ("Khả dụng 3").
- Huy hiệu Đủ hàng/Sắp hết/Hết hàng suy ra từ khả dụng so với định mức tối thiểu **của từng mặt hàng, từng chi nhánh**: Hết hàng khi khả dụng ≤ 0; Sắp hết khi 0 < khả dụng ≤ định mức tối thiểu; Chưa đặt định mức thì hiện huy hiệu trung tính kèm liên kết cấu hình.
- Đang vận chuyển > 0: hiện tag phụ "Đang vận chuyển N", không đổi huy hiệu chính. "Đã đặt N" (đặt nhà cung cấp, chưa giao) là tag phụ, **không phải số tồn thứ năm**.
- Khả dụng < 0 (dữ liệu lệch): hiện Hết hàng kèm cảnh báo "Dữ liệu tồn lệch, báo quản lý".
- Số lượng nhập vượt khả dụng: cảnh báo ngay tại ô (chặn nếu không có chính sách cho phép), nêu số khả dụng và lối ra (giảm số lượng hoặc xin chuyển kho).
- Ngưỡng cụ thể không cố định trong thiết kế (lấy từ cấu hình).
- Khi hiển thị tồn của chi nhánh khác: chỉ "số có thể cho", không lộ chi tiết.
- Thủ kho/CV/MH không thấy **giá vốn** (hiện `•••••` có lý do).

## 5. Giá: giá vốn, giá niêm yết, giá thực tế

**Quy tắc.** Tách **ba loại giá**: giá vốn, giá niêm yết, giá thực tế. Chi nhánh được giảm giá **trong hạn mức** cấu hình. Báo giá giữ phiên bản giá lúc gửi. **Giá bán thấp hơn giá vốn phải có người có quyền duyệt** (WF-07). Phương pháp giá vốn (bình quân gia quyền hay khác) chưa chốt `[Chưa chốt]`.

**UI phải làm gì.**

- Hiển thị giá vốn chỉ cho vai trò được xem (CH, QV, QL, KT); còn lại `•••••`.
- Khi giảm giá vượt hạn mức hoặc bán dưới giá vốn: nút "Gửi" bị khóa kèm lý do, chuyển sang luồng duyệt.
- Hiển thị "phương pháp giá vốn đang dùng" lấy từ cấu hình, không viết cứng tên phương pháp.
- Báo giá cho khách cá nhân hiện giá **đã gồm thuế** và dòng "Trong đó thuế".

## 6. Giao dịch đã ghi sổ không bao giờ bị xóa

**Quy tắc.** Giao dịch tài chính và chứng từ kho đã ghi sổ **không xóa**; chỉ sửa bằng bút toán đảo, điều chỉnh, thay thế, hủy yêu cầu hoặc bỏ ghép (`RULE-010`). Nhật ký thao tác bất biến.

**Vì sao.** Luật kế toán và kiểm toán; tránh gian lận; Excel đang bị chê vì sửa mà không dấu vết.

**UI phải làm gì.**

- **Không có nút "Xóa"** cho thanh toán, phiếu thu/chi, phiếu kho đã ghi sổ, hóa đơn, nhật ký. Thay bằng nhãn hành động đúng bản chất: "Đảo bút toán", "Điều chỉnh", "Thay thế", "Hủy yêu cầu", "Bỏ ghép".
- Bản đảo hiển thị **liên kết hai chiều** với bản gốc ("Đã đảo bằng …", "Đảo của …").
- Tổng cuối bảng là **tổng ròng đã trừ bút toán đảo**.
- Chỉ **bản nháp** mới có "Hủy/Xóa nháp".

## 7. Khóa ngày, khóa kỳ

**Quy tắc.** Sau khi quản lý chốt ngày, chứng từ của ngày đó **không sửa trực tiếp**; chỉ điều chỉnh bằng chứng từ mới có lý do (WF-06). Mở lại ngày hoặc kỳ chỉ chủ garage duyệt, có lý do, có nhật ký. Kỳ công đã khóa cũng không sửa trực tiếp.

**UI phải làm gì.**

- Ngày/kỳ đã khóa: biểu mẫu chuyển **chỉ đọc kèm lý do** ("Ngày 30/10/2026 đã khóa sổ. Cần kế toán trưởng mở lại ngày, có lý do"); bộ chọn ngày không chọn được ngày đã khóa.
- Nút "Khóa ngày" **bị khóa kèm lý do** khi còn mục chặn (lệnh mở, chưa thu, chưa hóa đơn, chênh lệch quỹ chưa giải trình).
- Hành động nguy hiểm (khóa/mở lại) dùng xác nhận mức 3 (mục 13).
- Dashboard phân biệt rõ số **Tạm** và **Chính thức**.

## 8. Vượt hạn mức cần phê duyệt; người lập không tự duyệt

**Quy tắc.** Khoản chi vượt hạn mức, giảm giá vượt hạn mức, hủy lệnh sau xuất phụ tùng, điều chỉnh kho, chênh lệch quỹ, chuyển kho giá trị lớn, hóa đơn điều chỉnh/thay thế/hủy, mở lại kỳ… cần phê duyệt (`RULE-011`). Người đề xuất không tự duyệt yêu cầu của mình (`RULE-036`). Hạn mức cụ thể do chủ garage ban hành `[Chưa chốt]`; mọi con số trong tài liệu chỉ là minh họa. Chi tiết luồng nhiều cấp ở tài liệu 04 mục 3.1.

**UI phải làm gì.**

- Hạn mức và người duyệt là **dữ liệu cấu hình**; không viết cứng số tiền vào giao diện.
- Hàng chờ phê duyệt: theo loại và cấp; hiện "Chờ cấp: …"; quá hạn thì nhắc và **tự chuyển cấp** (vẫn "Chờ duyệt", cấp trước bị khóa kèm lý do).
- Người lập: nút Duyệt bị khóa với lý do "Người lập yêu cầu không tự duyệt. Nhờ {vai trò duyệt}".
- Từ chối: **lý do bắt buộc**.
- Hạn mức chưa ban hành: hiện cảnh báo trên màn cấu hình ("yêu cầu sẽ lên cấp cao nhất").
- Duyệt hàng loạt chỉ cho cùng loại; thao tác nhạy cảm yêu cầu nhập lại mật khẩu.
- Thủ kho khi xem yêu cầu duyệt kho không thấy giá trị tiền.
- Mobile là thiết bị chính của người duyệt (chủ, quản lý): hàng chờ + chi tiết phải dùng được trên điện thoại với nút lớn.

## 9. Cấu hình có ngày hiệu lực

**Quy tắc.** Những thứ thay đổi theo luật hoặc chính sách (thuế suất, chu kỳ đăng kiểm, mẫu chứng từ, công thức công, giờ chuẩn, bảng giá, hạn mức giảm giá, hạn mức duyệt) là **cấu hình có ngày hiệu lực**, không phải mã cố định (NFR-MNT-01, `RULE-019`). Chứng từ đã tạo/phát hành giữ phiên bản đã áp.

**Vì sao.** Luật thay đổi nhiều lần (ví dụ thuế GTGT giảm đến 31/12/2026); sửa mã mỗi lần luật đổi là rủi ro lớn.

**UI phải làm gì.**

- Mỗi màn cấu hình hiển thị: **giá trị đang có hiệu lực**, **lịch sử các phiên bản** (từ ngày – đến ngày, ai tạo, khi nào), phiên bản đã lên lịch cho tương lai.
- Tạo phiên bản mới: nhập giá trị + **ngày hiệu lực**; **xem trước ảnh hưởng** ("từ ngày … áp dụng cho …"); lưu hoặc gửi duyệt.
- Phiên bản **đã được dùng trong chứng từ** không sửa được: chỉ đọc kèm lý do, có nút "Tạo phiên bản mới".
- Không xóa phiên bản trong lịch sử.
- Kế thừa nhiều tầng (nền tảng → công ty → chi nhánh): cho thấy giá trị đến từ tầng nào khi cấu hình chi nhánh khác cấu hình chung.
- Có nhiều loại cấu hình (hiện khoảng vài chục loại) với cấu trúc dữ liệu khác nhau: thiết kế một **mẫu màn cấu hình** có thể tái sử dụng nhưng không biến thành một form chung vô nghĩa (xem tài liệu 06 mục 5).

## 10. Che dữ liệu cá nhân theo vai trò

**Quy tắc.** Số điện thoại và địa chỉ che theo vai trò; mỗi lần "Hiện" ghi nhật ký truy cập; xuất danh sách cần quyền riêng (Luật Bảo vệ dữ liệu cá nhân 2025; NFR-SEC-03). Bảng cụ thể ở tài liệu 02 mục 5.

**UI phải làm gì.**

- Một component "trường dữ liệu cá nhân": che, nút "Hiện" (nếu được phép), tự che lại sau 30 giây, KT bắt buộc chọn lý do trước khi hiện.
- Trong danh sách chỉ che; không có nút Hiện.
- Giá trị đầy đủ không có trong trang trước khi Hiện (thiết kế giả định tải khi bấm).
- Trang khách (liên kết) che một phần.
- Màn hình/tệp xuất cũng che theo quyền; hộp thoại xuất nêu cột nào bị che.
- Ghi nhận **đồng ý** xử lý dữ liệu, mục đích, kênh; rút đồng ý dừng các hoạt động cần đồng ý; yêu cầu của chủ dữ liệu (xem/sửa/xóa) có màn xử lý.

## 11. Phạm vi và cách ly dữ liệu: không lộ sự tồn tại

**Quy tắc.** Nhân viên chỉ truy cập dữ liệu trong phạm vi quyền (`RULE-012`). Dữ liệu tách theo công ty (tenant) rồi theo chi nhánh ở mọi nơi: danh sách, tìm kiếm, báo cáo, xuất, API. Báo cáo nêu rõ **thời điểm và phạm vi chi nhánh** (`RULE-015`). Không có truy cập chéo công ty.

**UI phải làm gì.**

- Bản ghi ngoài phạm vi trả "Không tìm thấy" **giống hệt** bản ghi không tồn tại (không phân biệt "không có" với "không được xem").
- Tìm không ra: nói "trong các chi nhánh bạn được gán"; không liệt kê chi nhánh khác.
- Danh sách chi nhánh chỉ gồm chi nhánh được gán (hoặc chỉ "Bạn được gán N chi nhánh").
- Đăng nhập sai, quên mật khẩu, khóa tạm dùng **cùng câu chữ trung lập** cho mọi tài khoản (không tiết lộ tài khoản có tồn tại hay không).
- Mọi KPI, bảng, báo cáo, tệp xuất ghi **chi nhánh + khoảng thời gian + "Cập nhật lúc …"** (ví dụ `Quận 7 · 01–30/10/2026 · 09:15`). Thẻ KPI có dòng phạm vi riêng.
- Chuyển một chi nhánh ↔ hợp nhất là hành động chủ động, có dấu hiệu thị giác khác biệt (ví dụ nền khác khi hợp nhất) và thông báo bằng chữ.
- Khi đang xem hợp nhất, nút tạo chứng từ khóa kèm lý do "Chọn một chi nhánh để tạo… Mỗi chứng từ gắn với đúng một chi nhánh".
- Một số chỉ số hợp nhất cần nêu: chi nhánh nào vào số hợp nhất, số ngày chưa chốt (số tạm).
- Một công ty có nhiều pháp nhân: báo cáo chính thức không cộng gộp qua pháp nhân.

## 12. Nút bị chặn nêu lý do (không ẩn)

**Quy tắc.** Nút không đủ quyền hoặc chưa đủ điều kiện nghiệp vụ **không bị ẩn** trong mục người dùng có quyền xem: hiển thị ở trạng thái khóa kèm lý do bằng chữ.

**Vì sao.** Người dùng không rành công nghệ: nếu nút biến mất họ nghĩ hệ thống hỏng hoặc không biết phải làm gì để mở khóa.

**UI phải làm gì.**

- Nút khóa vẫn **nhận focus bàn phím** (dùng trạng thái "disabled mềm"), có đoạn lý do **hiện sẵn cạnh nút** (không chỉ tooltip), bấm vào chỉ đưa tới lý do hoặc hiện thông báo lý do.
- Máy chủ trả "được phép hay không" và mã lý do cùng bản ghi; giao diện tra câu chữ. Bộ mã lý do chuẩn (câu chữ có thể điều chỉnh giọng văn):

| Mã lý do | Câu chữ mẫu |
| --- | --- |
| Không có quyền | Bạn chưa có quyền {hành động}. Liên hệ {người cấp quyền}. |
| Chi nhánh khóa | Chi nhánh đã khóa: chỉ xem lịch sử, không tạo hay sửa chứng từ. |
| Chi nhánh ngừng nhận lệnh mới | Chi nhánh đang ngừng nhận lệnh mới: không tạo được {đối tượng} mới; vẫn xử lý được các lệnh đang mở. |
| Đang ở phạm vi hợp nhất | Chọn một chi nhánh để {hành động}. Mỗi chứng từ gắn với đúng một chi nhánh. |
| Ngày đã khóa | Ngày {dd/MM/yyyy} đã khóa sổ. Cần kế toán trưởng mở lại ngày (có lý do). |
| Sai trạng thái | Trạng thái hiện tại ({trạng thái}) không cho phép {hành động}. |
| Tự duyệt | Người lập yêu cầu không tự duyệt. Nhờ {vai trò duyệt}. |
| Không đủ tồn | Chỉ còn {khả dụng} khả dụng. Giảm số lượng hoặc xin chuyển kho. |
| Mất kết nối | Đang mất kết nối: thao tác này cần mạng. |
| Cần duyệt trước | Cần được duyệt trước ({người duyệt}). |
| Đang chờ duyệt | Đang chờ duyệt, chưa sửa được. |
| Đã xong | Việc này đã hoàn tất lúc {HH:mm dd/MM/yyyy}. |
| Công ty bị hạn chế tạo mới | Công ty đang bị hạn chế tạo mới: {lý do}. Bạn vẫn thu tiền, giao xe và hoàn tất lệnh đang mở. |
| Công ty tạm ngưng | Tài khoản đang tạm ngưng: bạn chỉ xem và tải dữ liệu được. |
| Chưa chấp nhận điều khoản | Cần đồng ý {tài liệu} phiên bản {v} trước khi {hành động}. |
| Chưa xác minh doanh nghiệp | Doanh nghiệp chưa hoàn tất xác minh nên chưa {hành động}, ví dụ phát hành hóa đơn thật. |

- Ví dụ khóa nút thường gặp: Thu tiền khi lệnh còn Chờ QC; Bắt đầu khi hạng mục chờ khách duyệt; Gửi báo giá khi giảm giá vượt hạn mức; Khóa ngày khi còn mục chặn; Thử lại khi lỗi dữ liệu chưa sửa.
- Với nút "tạo mới" bị khóa vì tình trạng công ty: bấm vào mở hộp thoại giải thích, **không mất bản nháp đang nhập**.

## 13. Xác nhận ba mức và hoàn tác

**Quy tắc.** Thao tác quan trọng cần xác nhận hoặc quyền đặc biệt; mức xác nhận tỷ lệ với rủi ro.

| Mức | Dùng cho | Thành phần bắt buộc |
| --- | --- | --- |
| 1. Thường | Gửi duyệt, chuyển cấp, gửi nhắc nợ | Hộp thoại nêu việc sắp làm |
| 2. Tiền | Ghi nhận thanh toán, thu nợ, chi tiền, chốt ca, duyệt, ghép giao dịch ngân hàng, phát hành hóa đơn, duyệt hàng loạt | Tóm tắt đối tượng và **số tiền**; ô "đã đối chiếu"; nút ghi rõ số tiền; **khóa chống bấm đúp**; trạng thái đang xử lý/đã xử lý |
| 3. Nguy hiểm | Đảo bút toán, hoàn tiền, khóa/mở lại ngày hoặc kỳ, đổi giá vốn, đổi sơ đồ tài khoản, hủy yêu cầu phát hành, điều chỉnh/thay thế/hủy hóa đơn, đổi môi trường hóa đơn thật, hủy lệnh, chuyển chủ xe, hợp nhất hồ sơ, xuất danh sách khách, đổi thợ khi đang làm, ghi lô Excel | Danh sách **hậu quả** bằng tiếng dễ hiểu; **lý do bắt buộc**; **gõ mã/cụm từ** (mã lệnh, biển số, số hóa đơn…) để mở nút; nút kiểu nguy hiểm (danger) chỉ khi thực sự cần; ghi nhật ký |

- Hành động ít rủi ro, lặp lại nhiều lần (bắt đầu việc của thợ): dùng **Hoàn tác trong 10 giây** (toast có nút Hoàn tác) thay vì hộp thoại.
- Thao tác nhạy cảm (mở lại kỳ, hủy hóa đơn, đổi vai trò, xuất danh sách khách): yêu cầu nhập lại mật khẩu.
- Thông báo kết quả bằng toast có chữ; không chỉ đổi màu.

## 14. Hóa đơn điện tử chống trùng; chống gửi trùng mọi thao tác tiền

**Quy tắc.** Phát hành hóa đơn **idempotent**: bấm nhiều lần hoặc timeout không tạo hóa đơn thứ hai; khi lỗi mạng thì **truy vấn trạng thái trước, không phát hành lại**. Trạng thái hóa đơn lấy từ nhà cung cấp. Kiến trúc tích hợp không phụ thuộc cứng một nhà cung cấp. Lưu XML/PDF.

**UI phải làm gì.**

- Sau khi xác nhận phát hành: nút chuyển **Đang xử lý và khóa**; không cho bấm lần hai.
- Hiển thị chỉ báo đồng bộ ("Đang gửi", "Lỗi phát hành, chờ thử lại", "Chờ truy vấn lại") **tách khỏi** huy hiệu trạng thái hóa đơn.
- Hộp thoại phát hành kiểm điều kiện trước (thông tin người mua nếu hóa đơn đứng tên công ty, thuế suất theo ngày hiệu lực, đơn vị phát hành) và nêu điều kiện nào chưa đạt.
- Không nêu tên/logo một nhà cung cấp cụ thể trong thiết kế; có phân biệt **môi trường thử và môi trường thật** (đổi sang thật là thao tác nguy hiểm).
- Cũng áp dụng khóa chống gửi trùng cho thu tiền, chi tiền, duyệt: mất mạng thì khóa nút và giữ nháp.

## 15. Mất mạng: chỉ cảnh báo và lưu nháp

**Quy tắc.** Sản phẩm **không phải offline đầy đủ** (là phạm vi riêng). Khi mất mạng: cảnh báo rõ, lưu nháp trên thiết bị, chặn các thao tác cần mạng.

**UI phải làm gì.**

- Banner đầu trang (cảnh báo khẩn) nêu rõ **việc gì không làm được** (xuất kho, thu tiền, chốt, phát hành hóa đơn, gửi yêu cầu phụ tùng) và **nháp lưu lúc mấy giờ**; xem dữ liệu cũ vẫn được, ghi "Cập nhật lúc …".
- Khi có lại mạng: thông báo "Đã kết nối lại"; nếu đồng bộ xung đột: hộp thoại xung đột phiên bản.
- Rời trang khi chưa lưu: cảnh báo; đổi phạm vi chi nhánh khi đang soạn: hỏi lưu nháp.
- **Chính sách riêng cho thợ ở Phase 1 (quyết định gần nhất):** ba nút Bắt đầu/Tạm dừng/Hoàn thành **bị khóa kèm lý do**; thợ ghi giờ thật lên **phiếu giấy dự phòng** và báo quản đốc; khi có mạng thợ "Khai giờ thực", quản đốc xác nhận, bản ghi mang nhãn **"Nhập bù"** kèm giờ thật; **không ghi mốc giờ theo giờ thiết bị**. Không có hàng đợi tự đồng bộ ở Phase 1.
- Lỗi nghiệp vụ (tồn không đủ, vượt hạn mức) khác lỗi kỹ thuật: nêu số liệu và lối ra.
- Dữ liệu người dùng đã nhập **không bị xóa** khi lỗi (trừ mật khẩu).
- Các trạng thái hệ thống chuẩn cần thiết kế: phiên hết hạn (401), không quyền (403), không tìm thấy (404), xung đột phiên bản (409), dữ liệu không hợp lệ (422), quá nhiều yêu cầu có đếm lùi (429), lỗi hệ thống (500) có **mã tham chiếu và nút sao chép**, bảo trì (503), mất kết nối. Công thức câu chữ: **điều gì xảy ra + vì sao (nếu biết) + cách khắc phục**; xưng "bạn"; không chấm than; không đổ lỗi cho người dùng; nút dùng động từ cụ thể ("Đăng nhập lại", "Xem bản mới nhất"), không dùng "OK" trơ trọi.

## 16. Nhật ký thao tác và nhãn thời điểm

**Quy tắc.** Mọi dữ liệu nghiệp vụ có người tạo, thời điểm, chi nhánh; mọi thay đổi ghi nhật ký (FR-SYS-003, `RULE-013`). Mọi thay đổi trạng thái ghi người làm, thời điểm, lý do (WF-09). Lệnh đã hoàn tất vẫn tra cứu được lịch sử (`RULE-014`).

**UI phải làm gì.**

- Mỗi chi tiết có **timeline/lịch sử** (ai, khi nào, đổi gì, lý do).
- Nhãn "Cập nhật lúc …"; nhãn "Tạm" so với "Chính thức" ở số liệu có thể chưa chốt; nhãn "Nhập bù" khi bản ghi nhập sau từ phiếu giấy.
- Hiển thị người làm bằng tên + vai trò; không hiện mã kỹ thuật.
- Màn nhật ký chỉ đọc, không xóa, không sửa.

## 17. Garage một chi nhánh, một kho: ẩn giao diện, không đổi mô hình

**Quy tắc.** Chủ garage nhỏ không cần thấy khái niệm chi nhánh/kho. Giao diện **ẩn** bộ chọn chi nhánh, so sánh chi nhánh, nhóm chi nhánh, chọn kho; mô hình dữ liệu và cách ly vẫn giữ nguyên (`RULE-033`).

**UI phải làm gì.** Thiết kế mỗi màn có hai cấu hình hiển thị: nhiều chi nhánh và một chi nhánh. Không để chỗ trống khó hiểu khi ẩn (bố cục vẫn đẹp khi không có bộ chọn, thẻ so sánh). Khi chỉ có một pháp nhân thì ẩn bộ lọc pháp nhân.

## 18. Một email, nhiều công ty; tình trạng công ty

**Quy tắc.** Một email có thể là thành viên của nhiều công ty (tenant); vai trò, chi nhánh, trạng thái tách riêng theo từng tư cách; phiên làm việc thuộc đúng một công ty (`RULE-034`, `RULE-026`). Một công ty có thể ở trạng thái bị hạn chế, tạm ngưng hoặc chấm dứt (vẫn tải được hóa đơn/chứng từ thuộc thời hạn lưu: `RULE-021`). Hạn chế thương mại **không chặn hoàn tất chứng từ đang mở** (thu tiền, giao xe, phát hành hóa đơn), chỉ chặn tạo mới (`RULE-023`). Gói/giá không hiển thị trong UI.

**UI phải làm gì.**

- Sau mật khẩu đúng: nếu có từ hai công ty thì màn "Chọn công ty" (chỉ gồm các công ty của chính người đó); một công ty thì vào thẳng. Trong phiên có lối "Đổi công ty" (cấp phiên mới).
- Email đặt lại mật khẩu nêu rõ áp dụng cho mọi công ty của email.
- Banner tình trạng công ty chỉ có 3 loại: hạn chế tạo mới, tạm ngưng (chỉ xem và tải), khóa; có biến thể theo vai trò (chủ/quản trị thấy lý do và nút khắc phục; nhân viên thấy câu chung và "Liên hệ chủ garage").
- Không hiển thị giá, gói, bộ đếm ngày, "dùng thử".

## 19. Định dạng và ngôn ngữ (bắt buộc)

- Chỉ tiếng Việt, có dấu đầy đủ (chuẩn hóa NFC).
- Tiền VND không số lẻ, `1.250.000 ₫`, căn phải, số đều chiều rộng; tiền rút gọn chỉ ở KPI kèm đơn vị.
- Ngày `dd/MM/yyyy`, giờ 24h, tuần bắt đầu Thứ Hai; nhập tay luôn được trong ô ngày.
- Biển số, mã chứng từ, số lượng, số tiền dùng **số đều chiều rộng** (tabular).
- Mã chứng từ không ngắt dòng; tìm kiếm không phân biệt dấu.
- Không dùng chữ in hoa toàn bộ cho câu; nhãn nút có động từ cụ thể.
- Chữ tối thiểu 12px (bảng 14px), nhãn form tối thiểu 13–14px; không dùng cỡ 11px cho thông tin nghiệp vụ.
