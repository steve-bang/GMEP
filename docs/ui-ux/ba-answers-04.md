# BA – Trả lời 20 câu hỏi của Gói G3 (Kho, Mua hàng, Nhân sự)

Phiên bản 0.1 · Ngày 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để sửa gói G3 và đi tiếp). Trả lời mục 11 của `docs/ui-ux/04-inventory-purchasing-hr.md`. Review đối chiếu nằm ở `docs/ui-ux/review-04-inventory-purchasing-hr-ba.md`.

Nguyên tắc: nghiệp vụ trong BRD/FRD/Journey thắng; hình thức theo `docs/design-system.md` (không đổi token). Các điểm khách chưa chốt (`[Cần xác nhận]`: phương pháp giá vốn, công thức công thợ/hoa hồng, hạn mức, chính sách chi nhánh dư, quy trình mua hàng, bán lẻ) vẫn thiết kế theo hướng **cấu hình có ngày hiệu lực**, UI không chứa số thật. Mọi số dùng làm ví dụ là **giá trị mẫu**, gắn nhãn "giá trị mẫu" như prototype đang làm.

## 0. Tóm tắt quyết định chính

| # | Chủ đề | Quyết định |
| --- | --- | --- |
| 1 | Đang vận chuyển | Chỉ hàng đã **gửi theo phiếu chuyển kho** (CK) hoặc cấp từ kho tổng mà bên nhận chưa xác nhận. Hàng đã đặt NCC chưa giao **không** thuộc bốn số: gọi là "Đã đặt – chờ giao", cột/chip riêng |
| 2 | Giá vốn | Xem: CH, QV, QL, KT. Thủ kho không xem giá vốn bình quân/giá trị tồn/giá nhập lô, nhưng thấy giá đơn mua và giá nhập của phiếu nhập đang nhận |
| 3 | Badge | Bảng chốt ở Phụ lục A (13 bộ trạng thái, mỗi đối tượng một bộ) |
| 4 | Tiền tố mã | YM, DC, TR giữ; thêm HK, XN, YK, CP. Phiếu chuyển đánh số theo chi nhánh **gửi** (Phụ lục B) |
| 5 | MH, NS | **Thêm hai vai trò MH và NS** vào ma trận (không gộp vào TK/QL), cấu hình như vai trò khác (Phụ lục C) |
| 6 | CV/TN tra tồn | Không thêm menu Kho cho CV/TN; tra qua bộ chọn phụ tùng trong báo giá, danh mục chỉ đọc (CV), bán lẻ vào từ nhóm Tài chính |
| 7 | Gợi ý đặt hàng | Đề xuất = Tối đa − (Khả dụng + Đang vận chuyển + Đã đặt chờ giao), làm tròn theo quy cách NCC; "dư" = Khả dụng − Tối thiểu của chi nhánh kia |
| 13 | Năng suất | Giữ ba công thức A-07; định nghĩa giờ chuẩn bán ra / giờ thực / giờ có mặt ở mục 13 |
| 15 | Kỳ công | Mặc định theo **tháng**, cấu hình được; QL duyệt và khóa (chỉ từ ngày kết thúc kỳ); CH duyệt mở lại |
| 16 | Che dữ liệu nhân sự | Ma trận ở Phụ lục D |
| 10 | Hạn mức G4-APR-03 | Bộ 14 tham số mẫu ở Phụ lục E |

## 1. Câu 1 – "Đang vận chuyển"

- **Quyết định.** Nhãn thống nhất: cột bốn số = **"Đang vận chuyển"** (khớp `screen-inventory` §4.1 và Journey §4); chip phụ trên badge kho = **"Đang về N"** (Info, A.2), N = đang vận chuyển **đến kho này**. "Đang vận chuyển" gồm: (a) hàng bên gửi đã bấm Gửi trên phiếu CK mà bên nhận chưa xác nhận; (b) cấp từ kho tổng cho kho chi nhánh (FR-INV-026); (c) phần **chênh lệch treo** khi nhận thiếu/hỏng, cho đến khi QL xử lý (Journey §8). **Không gồm** hàng đã đặt NCC: hiển thị là **"Đã đặt N"** (tag Neutral) và cột phụ "Đã đặt – chờ giao" kèm ngày giao dự kiến ở INV-04/05, nằm ngoài bốn số, không vào Khả dụng.
- **Hạch toán số.** Khi Gửi: Thực tế kho gửi giảm N, Đang vận chuyển (gắn kho nhận) tăng N, không bên nào tăng Khả dụng (FR-INV-010). Khi Nhận: Thực tế kho nhận tăng số nhận, Đang vận chuyển giảm số gửi; phần lệch còn treo. Quy tắc kiểm tra: tổng Thực tế + Đang vận chuyển của toàn chuỗi không đổi khi chuyển kho.
- **Lý do.** Tách "đang đi giữa hai kho của mình" (có phiếu, có người chịu trách nhiệm) khỏi "NCC hứa giao" (chưa thuộc sở hữu), để cảnh báo tồn không bị lạc quan giả. Gợi ý đặt hàng vẫn trừ cả hai (câu 7).
- **Căn cứ.** FR-INV-010, FR-INV-020, FR-INV-026, Journey §4 ("hàng đang vận chuyển giữa các kho… chưa cộng vào tồn của kho nhận"), BR-INV-05, BR-INV-10, ba-decisions câu 4.
- **Tác động.** Sửa dữ liệu mẫu INV-04/05 (PT-0002 "Đang về 10" thực ra là phần còn lại của DM-Q7-2610-00014), nội dung hộp thoại đóng đơn ở PUR-06, giả định A-03; ba-decisions câu 4 đổi "Đang về" ở cột thành "Đang vận chuyển". Xem F4-03.

## 2. Câu 2 – Ai xem giá vốn; Thủ kho có xem giá nhập

- **Quyết định.** Phân ba loại giá với ba mức hiển thị:

| Loại giá | CH | QV | QL | KT | TK | MH | CV/TN/QĐ/TH |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Giá vốn bình quân, giá trị tồn, giá nhập theo lô tồn, lãi gộp | Xem | Xem | Xem | Xem | Che | Che | Che |
| Giá đơn mua, giá nhập **của phiếu đang nhận**, giá bảng giá NCC | Xem | Xem | Xem | Xem | Xem | Xem | Che |
| Giá niêm yết, giá bán thực tế | Xem | Xem | Xem | Xem | Xem | Xem | CV, TN xem; QĐ, TH che |

  Hệ thống vẫn cảnh báo "bán dưới giá vốn" (WF-07) cho CV/TN mà không lộ số. Phiếu in không có giá vốn. Xuất Excel theo cùng quyền. Người kiêm vai trò được cộng quyền (FR-SYS-012). Bảng quyền che nằm ở G4-SYS-04, sửa được, không hard-code.
- **Lý do.** FRD §2 dòng "Công nợ và giá vốn": KT sửa; CH, QV, QL xem. Thủ kho cần giá đơn/giá thực để đối chiếu lệch giá khi nhập (FR-INV-005) nhưng không cần biết giá vốn bình quân. MH cần giá NCC cho nghiệp vụ mua.
- **Căn cứ.** FRD §2 (Công nợ và giá vốn), FR-INV-005, FR-INV-027, WF-07, Journey §4.
- **Tác động.** `pack.js` cần **hai cờ**: `data-g3-cost` (giá vốn, nhóm CH QV QL KT) và `data-g3-buy` (giá mua, nhóm CH QV QL KT TK MH). Hiện INV-09 cho TK thấy giá nhập nhưng INV-03/INV-08/INV-13 che cùng loại giá: không nhất quán (F4-05).

## 3. Câu 3 – Bảng badge chốt

Xem **Phụ lục A**. Nguyên tắc: mỗi đối tượng một bộ riêng; xanh lá chỉ cho thành công; vàng cần chú ý; đỏ lỗi/rủi ro; xanh dương đang xử lý; tím chỉ "Chờ QC"; luôn có chữ; lý do phụ là tag, không phải trạng thái thứ n+1. Loại biến động trong thẻ kho (nhập, xuất theo lệnh, chuyển, điều chỉnh) **không phải trạng thái**: dùng tag Neutral kèm icon, không dùng màu Success/Info (F4-22).

## 4. Câu 4 – Tiền tố mã chứng từ

Xem **Phụ lục B**. Định dạng chung vẫn là `LOẠI-MÃCN-YYMM-STT` (ba-decisions câu 11). Phiếu chuyển kho **đánh số theo chi nhánh gửi** (chi nhánh phát hành chứng từ xuất hàng). Khi chi nhánh nhận cần hàng, họ lập **Yêu cầu chuyển (YK)**; bên gửi xác nhận thì sinh phiếu CK mang mã chi nhánh gửi và liên kết YK (xử lý A-06).
- **Căn cứ.** FR-INV-021 (chứng từ có số riêng theo loại), FR-REC-030, ba-decisions câu 11.

## 5. Câu 5 – Vai trò MH và NS

- **Quyết định.** **Thêm hai vai trò MH (nhân viên mua hàng) và NS (nhân sự)** vào ma trận quyền và menu; không quy về TK/QL. Quyền mặc định ở Phụ lục C; cấu hình như mọi vai trò (FR-SYS-013), thuộc Phase 2 nên không ảnh hưởng pilot.
- **Lý do.** FRD §2 (bổ sung 0.2) nêu rõ "Nhân viên mua hàng, nhân sự… là vai trò bổ sung của bản 0.2, cấu hình như các vai trò khác" và "mua hàng do nhân viên mua hàng và thủ kho tạo". Gộp NS vào QL làm lộ dữ liệu cá nhân nhân sự nhiều hơn cần thiết và trái nguyên tắc tối thiểu quyền (NFR-SEC-03); gộp MH vào TK trộn người nhận hàng với người đặt hàng (kiểm soát nội bộ). Người ở garage nhỏ kiêm nhiệm được gán nhiều vai trò (FR-SYS-012).
- **Tác động.** `ROLE_MENU`, `SCOPE_TYPE` ở `design/assets/app.js` và `ROLE_NAME` ở `pack.js` thiếu MH/NS (hiện `if (!cfg) return` làm menu trống). Cần chủ Phase 0 cập nhật `app.js` và `00-foundation.md` §7. Danh sách màn hình cần thêm vai trò: F4-04.

## 6. Câu 6 – Lối vào tra tồn cho CV/TN

- **Quyết định.**
  1. CV và TN **không có menu Kho phụ tùng** (đúng FRD §2: Nhập/xuất/kiểm kê, CV và TN không có quyền).
  2. **CV tra tồn** ở hai nơi: (a) bộ chọn phụ tùng khi lập báo giá (G2-QUO), hiện **Khả dụng + ngày dự kiến hàng về**, không hiện Thực tế/Giữ chỗ/giá vốn; (b) Danh mục phụ tùng và Bảng giá ở chế độ **chỉ đọc** (FRD §2 dòng "Danh mục phụ tùng và bảng giá": CV = X), cột tồn chỉ có Khả dụng. Do đó INV-01 và INV-19 phải mở được cho CV.
  3. **Bán lẻ (INV-18)**: vào từ nhóm **Tài chính › Bán lẻ phụ tùng** cho TN và CV (khi chi nhánh bật bán lẻ, quyền "tạo phiếu bán lẻ" cấp theo FR-SYS-013); TK, QL vào từ tab "Bán lẻ" trong Kho. Bộ chọn phụ tùng của INV-18 chỉ hiện Khả dụng và giá niêm yết.
  4. TN không có quyền xem danh mục độc lập; chỉ thấy phụ tùng qua bộ chọn trong phiếu bán lẻ.
- **Căn cứ.** FRD §2, FR-INV-018, FR-INV-028, BR-INV-15, screen-inventory G3-INV-01, 18.
- **Tác động.** `screen-inventory` ghi CV (X) ở INV-04 nhưng FRD M5 cho CV "-": **ưu tiên FRD**, INV-04 không mở cho CV (CV dùng bộ chọn trong báo giá). Mâu thuẫn này cần ghi vào khoảng trống G-xx của `screen-inventory` §6.

## 7. Câu 7 – Công thức gợi ý đặt hàng

- **Quyết định.**
  - **Hàng cần đặt:** Khả dụng ≤ Tối thiểu (RULE-008, FR-INV-013). Chưa đặt định mức thì không cảnh báo.
  - **Số lượng đề xuất** = `max(0, Tối đa − (Khả dụng + Đang vận chuyển + Đã đặt chờ giao))`, làm tròn lên theo quy cách đóng gói/số lượng tối thiểu của NCC (cấu hình, mặc định 1). **Chưa có Tối đa thì để trống** và bắt nhập tay (không tự suy ra). Người dùng sửa được; sửa lệch nhiều so với đề xuất không cần lý do ở bước yêu cầu.
  - **"Chi nhánh dư"** (chi nhánh B dư mặt hàng X) khi B có định mức Tối thiểu và `Khả dụng_B − Tối thiểu_B > 0`; **số có thể cho** = `Khả dụng_B − Tối thiểu_B` (có thể cấu hình thêm mức giữ lại). Kho tổng cho được toàn bộ Khả dụng. B chưa đặt định mức thì không được coi là dư.
  - **Chính sách ưu tiên** (cấu hình, mặc định bật theo Journey §4 nhưng còn `[Cần xác nhận]`): kho tổng → chi nhánh dư cùng nhóm/vùng → NCC. Có ngưỡng giá trị tối thiểu để chuyển kho đáng làm (cấu hình), dưới ngưỡng ưu tiên NCC.
  - **Dữ liệu chi nhánh khác được thấy:** chỉ "Khả dụng" và "số có thể cho", không Thực tế, Giữ chỗ, giá vốn (xem F4-01).
- **Lý do.** FR-INV-014 yêu cầu gợi ý nêu chi nhánh dư, số lượng và NCC thay thế; Journey §4 "gợi ý lấy từ chi nhánh đang dư trước khi đặt NCC [Cần xác nhận chính sách]". Trừ cả hàng đã đặt tránh đặt trùng.
- **Căn cứ.** FR-INV-013, 014, FR-PUR-001, BR-INV-07, NFR-ISO-01.

## 8. Câu 8 – Mua gấp tại cửa hàng

- **Phương án xét.** A: yêu cầu mua loại "Mua gấp" + phiếu nhập theo yêu cầu đó. B: phiếu nhập "không có đơn mua" kèm lý do (prototype đang giả định). C: luồng riêng ngoài PUR.
- **Quyết định (A).** Lập **Yêu cầu mua (YM) có cờ "Mua gấp"**: bắt buộc lý do, nhà cung cấp/cửa hàng, lệnh liên quan nếu có. Trong hạn mức người lập thì **ghi nhận ngay và hậu duyệt** trong N giờ (cấu hình, mẫu 24 giờ); vượt hạn mức thì xin **duyệt trước** (QL/QV duyệt được trên điện thoại). Hàng nhập bằng PN có **chứng từ gốc là YM mua gấp** (đính kèm ảnh hóa đơn/biên lai); chi tiền đi qua phiếu chi có phê duyệt (RULE-011). "Nhập không có đơn mua" giữ cho tình huống hiếm (hàng NCC tặng, hàng bù, nhập tồn) và luôn cần QL duyệt.
- **Lý do.** Giữ RULE-007 (mọi biến động tồn có chứng từ gốc) và RULE-011 (chi vượt hạn mức phải duyệt) mà vẫn cho phép mua nhanh khi xe đang nằm xưởng. Discovery nêu mua trực tiếp khi gấp; FR-PUR-001 cho phép yêu cầu từ chi nhánh.
- **Căn cứ.** FR-PUR-001, FR-INV-005, RULE-007, RULE-011, Journey §4 (mua hàng), screen-inventory G3-PUR-02.

## 9. Câu 9 – Xuất vượt Khả dụng

- **Quyết định.** Mặc định **chặn tuyệt đối** (`cho_phép_xuất_vượt_khả_dụng = tắt`). Cấu hình chỉ do CH bật theo chi nhánh. Khi bật: ngoại lệ chỉ là **mượn phần giữ chỗ của lệnh khác**, cần QL duyệt kèm lý do, nhật ký; **Thực tế không bao giờ âm** (FR-INV-019). Prototype giữ hành vi chặn + gợi ý chuyển kho/mua là đúng; thêm nút "Xin duyệt xuất vượt Khả dụng" chỉ hiện khi cấu hình bật.
- **Công thức kiểm tra khi xuất cho lệnh X:** `SL xuất tối đa = Giữ chỗ còn lại của chính lệnh X + Khả dụng` (và không vượt Thực tế). Lý do: giữ chỗ của chính lệnh X chuyển thành xuất kho (Journey §4 bước 3), nên không bị tính là "vượt Khả dụng". INV-06/07 phải hiện "Giữ chỗ cho lệnh này" trên mọi thẻ (F4-07).
- **Căn cứ.** RULE-008, FR-INV-019, FR-INV-020, WF-02.

## 10. Câu 10 – Bộ hạn mức cho G4-APR-03

Xem **Phụ lục E**. Toàn bộ là **cấu hình có ngày hiệu lực theo cấp (QL → QV → CH)**, UI chỉ hiển thị "giá trị so với hạn mức cùng cấp" kèm nhãn "giá trị mẫu" (ba-decisions câu 14). Số trong Phụ lục E chỉ để G4-APR-03 có dữ liệu mẫu và kiểm thử, **chờ khách chốt** (Journey §7 ma trận phê duyệt: "Hạn mức cụ thể do khách chốt").

## 11. Câu 11 – Chuyển kho: yêu cầu chuyển và xử lý chênh lệch

- **Yêu cầu chuyển.** Có. Chi nhánh nhận lập **YK**, bên gửi xác nhận mới sinh CK. Bên nhận không tự xuất hàng của bên gửi (A-06 chấp nhận).
- **Xử lý chênh lệch khi nhận thiếu/hỏng.** Danh mục kết quả (cấu hình): (1) **Chờ hàng bù** (phần lệch treo trên Đang vận chuyển, hạn N ngày); (2) **Ghi mất trong vận chuyển**; (3) **Hàng hỏng khi vận chuyển**, nhập vào kho hàng lỗi/chờ xử lý, không vào Khả dụng; (4) **Điều chỉnh với bên gửi** (bên gửi đếm/đóng thiếu, sửa bằng phiếu điều chỉnh DC bên gửi). Trường "**Bên chịu giá trị**" chọn: chi nhánh gửi / chi nhánh nhận / công ty (chi phí chung) / đơn vị vận chuyển, kèm lý do và ảnh. `[Cần xác nhận]` ai chịu mặc định; thiết kế không cố định.
- **Cấp duyệt xử lý chênh lệch:** QL bên nhận đề xuất; cần QL bên gửi đồng thuận; khác vùng hoặc vượt ngưỡng thì QV/CH duyệt. Chuyển giữa **hai pháp nhân** là điều chuyển nội bộ chịu quy định thuế: để `[Cần xác nhận]` với kế toán khách (Journey §4).
- **Căn cứ.** FR-INV-010, FR-INV-026, Journey §4, §7 (chuyển kho giá trị lớn), §8 (hàng chuyển thiếu/hỏng), BR-INV-05.

## 12. Câu 12 – Kiểm kê: đếm mù và phát sinh trong lúc đếm

- **Đếm mù:** chấp nhận (A-05), là mặc định, cấu hình theo đợt. Số sổ sách chụp tại T0 (FR-INV-011).
- **Phát sinh trong lúc đếm.** **Không đóng băng kho** (garage vẫn nhập/xuất). Mỗi dòng đếm ghi **thời điểm đếm**; chênh lệch tính trên `tồn sổ sách tại thời điểm đếm = tồn T0 ± chứng từ đã ghi sổ trong khoảng (T0, thời điểm đếm]`. Hiển thị cột "Phát sinh trong lúc đếm" để người duyệt thấy. PN/PX của mã đang trong đợt đếm hiện cảnh báo (không chặn). Cấu hình tùy chọn "đóng băng nhóm hàng đang đếm" cho kho nhỏ.
- **Quy tắc đếm.** Không cho chốt khi còn dòng "Chưa đếm": phải nhập 0 một cách có chủ đích, hoặc QL loại dòng khỏi đợt kèm lý do. Dòng lệch vượt ngưỡng cần **đếm lại một lần** trước khi nộp. **Người duyệt khác người đếm** (QL vừa đếm vừa duyệt thì chuyển cấp trên duyệt).
- **Căn cứ.** FR-INV-011, FR-INV-012, Journey §4 (kiểm kê), §8 (lệch tồn), §7 (điều chỉnh kho sau kiểm kê), BR-INV-06.

## 13. Câu 13 – Ba chỉ số năng suất và giờ có mặt

- **Công thức** (giữ ba tên và công thức của Journey §5, ghi cạnh tên chỉ số):
  - **Hiệu suất làm việc** = Giờ chuẩn bán ra ÷ Giờ thực làm.
  - **Mức sử dụng** = Giờ thực làm ÷ Giờ có mặt.
  - **Năng suất tổng** = Giờ chuẩn bán ra ÷ Giờ có mặt. Hằng đẳng thức kiểm thử: Giờ có mặt × Mức sử dụng × Hiệu suất = Giờ chuẩn bán ra.
- **Định nghĩa đầu vào:**
  - **Giờ có mặt** = tổng (giờ ra − giờ vào) của các ca đã chấm công trong kỳ, trừ giờ nghỉ giữa ca theo cấu hình ca; ngày nghỉ phép không tính; ca chưa có giờ ra tính đến hiện tại (số tạm). Nguồn FR-HRM-003, tách khỏi đồng hồ công việc.
  - **Giờ thực làm** = tổng các khoảng hạng mục ở "Đang làm" của thợ trong kỳ, trừ khoảng tạm dừng, **gồm cả giờ làm lại** (FR-HRM-005).
  - **Giờ chuẩn bán ra** = giờ chuẩn của các hạng mục **đã qua QC trong kỳ** của thợ; hạng mục làm lại không cộng lần hai; đổi thợ giữa chừng chia theo tỷ lệ giờ thực (FR-HRM-008).
  - Mẫu số bằng 0 thì hiện "–", không hiện 0% hay vô cực. Hiệu suất vượt 100% hợp lệ. Kỳ chưa khóa gắn "Số tạm". Ngưỡng tô màu (nếu có) là cấu hình, và màu luôn đi kèm số.
- **Lưu ý.** Giờ chuẩn bán ra **không đồng nghĩa với "Công"** khi phương pháp công không phải giờ chuẩn (khoán, giờ thực được duyệt…): dòng chữ "khớp bảng công" ở HRM-10 chỉ đúng khi mọi phương pháp là giờ chuẩn (F4-27).
- **Căn cứ.** FR-HRM-011, FR-HRM-003, 005, 007, 008, 016, Journey §5, BR-HRM-05.

## 14. Câu 14 – Công thợ và hoa hồng

- **Đơn vị "công".** Lưu **hai đại lượng**: (a) **giờ công quy đổi** (khi phương pháp theo giờ) và (b) **tiền công (₫)**. Đại lượng cộng dồn và xuất cho KT là **tiền công (₫)** = giờ công × đơn giá giờ theo cấp bậc (mô hình giờ chuẩn của Journey §5) hoặc số tiền trực tiếp (khoán, %, cố định). Bảng công HRM-08 có hai cột riêng, không gộp hoa hồng vào "công". `[Cần xác nhận]` với khách.
- **Ghép phương pháp.** Một phương pháp cho mỗi tổ hợp (loại dịch vụ × chức danh × chi nhánh), có ngày hiệu lực. Thứ tự áp dụng: chi nhánh + loại việc + chức danh → chi nhánh + loại việc → công ty + loại việc + chức danh → công ty + loại việc. Ghi đè của chi nhánh chỉ trong quyền được cấp (FR-HRM-015), **có phiên bản và ngày hiệu lực riêng**.
- **Hệ số chức danh:** bảng riêng cùng cơ chế hiệu lực (ví dụ học việc, bậc 3, bậc 4); chưa có số từ khách.
- **Điều kiện ghi nhận:** **công** (mọi phương pháp: giờ chuẩn, khoán, giờ thực được duyệt, cố định cộng thưởng) ghi khi hạng mục **qua QC** (FR-HRM-007). **Hoa hồng** (cố vấn, và thợ khi phương pháp là "tỷ lệ % trên giá trị công đã thu") ghi khi lệnh **thu đủ** (FR-HRM-009, Journey §5 bảng mô hình: điều kiện đã thanh toán). Thu một phần thì "Chưa ghi nhận" (không chia theo tỷ lệ, trừ khi khách yêu cầu khác). Hoàn tiền/hủy sau khi ghi nhận tạo dòng **đảo**.
- **Cơ sở hoa hồng cố vấn.** Mặc định **doanh thu dịch vụ (tiền công) của lệnh đã thu, chưa VAT**; tùy chọn cấu hình: bao gồm phụ tùng, hoặc lợi nhuận gộp. `[Cần xác nhận]`.
- **Hoa hồng thợ (A-09).** Chỉ thợ thuộc phương pháp "tỷ lệ %" mới là hoa hồng và theo điều kiện thu đủ; thợ khoán/giờ chuẩn **không** chờ thu tiền. HRM-09 hiện đang trộn hai loại (F4-13).
- **Ví dụ khách ký (UAT-11).** Tối thiểu 6 ví dụ do KT khách xác nhận bằng văn bản: thay dầu 0,3 giờ chuẩn (đã có), một hạng mục khoán, một hạng mục %, đổi thợ giữa chừng, làm lại sau QC, hủy lệnh sau khi đã ghi công. Mỗi ví dụ thành một ca kiểm thử tự động (NFR-MNT-01).
- **Căn cứ.** FR-HRM-004, 006, 007, 008, 009, 015, BR-HRM-03, 04, 06, Journey §5, §8.

## 15. Câu 15 – Chu kỳ kỳ công, ai khóa, ai mở lại

- **Chu kỳ.** Mặc định **theo tháng dương lịch** (từ ngày 1 đến cuối tháng); cấu hình theo chi nhánh: tháng / nửa tháng / tuần / ngày chốt tùy chỉnh (ví dụ 26 đến 25), có hiệu lực theo ngày. Thay A-10 (nửa tháng): lương ở Việt Nam thường tính theo tháng, nửa tháng nhân đôi số lần duyệt/khóa; vẫn hỗ trợ nửa tháng bằng cấu hình.
- **Duyệt và khóa:** **QL chi nhánh** duyệt kỳ rồi khóa kỳ (FR-HRM-010), **chỉ được thực hiện từ ngày kết thúc kỳ**. Điều kiện khóa: không còn điều chỉnh công chờ duyệt, không còn ca thiếu giờ ra chưa xử lý. Hạng mục chờ QC **không chặn** khóa: công của hạng mục đó ghi vào kỳ nơi QC đạt.
- **Mở lại.** QL gửi yêu cầu kèm lý do, **CH duyệt** (Journey §7 "Mở lại ngày hoặc kỳ đã khóa… Chủ garage"), có nhật ký; KT được thông báo. Sau mở lại, mọi sửa đổi ghi vết, rồi khóa lại.
- **Tệp xuất cho KT:** trước khi khóa gắn "Số tạm", sau khi khóa là bản chính thức; xuất ghi nhật ký (FR-SYS-013).
- **Căn cứ.** FR-HRM-010, BR-HRM-04, Journey §5 bước 5, §7, WF-06.

## 16. Câu 16 – Ma trận che dữ liệu nhân sự

Xem **Phụ lục D**. Nguyên tắc: giá trị đầy đủ **không có trong HTML/JS** cho đến khi được Hiện (production gọi API và ghi nhật ký; `pack.js` đang chứa dữ liệu mô phỏng); tự che sau 30 giây; xuất danh sách nhân sự cần quyền xuất và mặc định đã che; không thu thập lương, số tài khoản ngân hàng, bảo hiểm (ngoài phạm vi, FR-HRM nêu rõ không tính lương). Dữ liệu nhân viên đã nghỉ xử lý theo FR-HRM-012 (ẩn danh/xóa theo chính sách `[Cần xác nhận]`).
- **Căn cứ.** NFR-SEC-03, FR-SYS-003, FR-SYS-013, FR-HRM-012, Luật BVDLCN 2025, ba-decisions câu 8.

## 17. Câu 17 – Đánh giá nhà cung cấp (Could)

- **Quyết định.** Hiển thị **ba tỷ lệ riêng, kèm mẫu số, chưa có điểm tổng** (chưa có trọng số được khách chốt): (1) **Giao đúng hạn** = số đơn/dòng nhận đủ không muộn hơn ngày giao dự kiến ÷ số đơn đã đến hạn; (2) **Đúng số lượng** = Σ min(nhận, đặt) ÷ Σ đặt, trên các đơn đã nhận xong hoặc đã đóng; (3) **Chất lượng** = 1 − (SL trả NCC do lỗi/giao sai ÷ SL nhận). Nguồn: DM (kể cả phiên bản), PN, TR. Kỳ: 12 tháng gần nhất, chọn được. Điểm tổng (nếu khách muốn) là trọng số cấu hình, mặc định tắt. Phase P2+.
- **Căn cứ.** FR-PUR-008, FR-PUR-005, FR-PUR-007.

## 18. Câu 18 – Khách trả phụ tùng chưa lắp

- **Quyết định.** Chính sách **cấu hình** (chưa khách chốt): cửa sổ trả (mẫu 7 ngày kể từ ngày bán), điều kiện (chưa lắp, còn nguyên bao bì, có chứng từ), phí xử lý (mẫu 0), cờ "**không nhận trả**" trên danh mục cho hàng đặc thù (dầu nhớt đã mở, hàng điện, hàng đặt riêng). Ngoài cửa sổ hoặc đã mở bao bì thì cần QL duyệt. Tình trạng hàng quyết định nơi nhập: "Nhập lại Khả dụng" hoặc "Kho chờ kiểm/hàng lỗi". Phiếu HK liên kết phiếu bán lẻ hoặc lệnh gốc; **hoàn tiền** qua phiếu hoàn có phê duyệt ở G4-ACC-07; **hóa đơn** điều chỉnh/thay thế theo EIN nếu đã xuất. Phase P2+.
- **Căn cứ.** FR-INV-022, BR-INV-12, Journey §8 ("Khách trả lại phụ tùng chưa lắp", "Hoàn tiền cho khách"), BR-ACC-11.

## 19. Câu 19 – Dư nợ nhà cung cấp trong danh bạ

- **Quyết định.** Xem dư nợ NCC: **CH, QV, QL, KT** (nhóm "Công nợ và giá vốn", FRD §2). TK và MH **không thấy cột này** (ẩn cột, không hiện "•••••"); MH vẫn thấy điều khoản thanh toán và số đơn đang mở. SĐT liên hệ NCC: TK, MH, QL xem đầy đủ; CH, QV, KT bấm Hiện (có nhật ký); vai trò khác không thấy.
- **Căn cứ.** FRD §2, NFR-SEC-03, FR-INV-015.

## 20. Câu 20 – Mẫu in của gói

Theo ba-decisions câu 12 (mẫu in là cấu hình theo chi nhánh, thiết kế theo khổ không theo hãng máy):

| Chứng từ | Khổ | Ghi chú |
| --- | --- | --- |
| Phiếu xuất PX, phiếu hoàn kho HK, phiếu xuất nội bộ XN | A5 | Bản xưởng; ba chữ ký (Thủ kho, Người nhận, Quản đốc); **không in giá vốn** |
| Phiếu nhập PN, phiếu chuyển CK (kèm biên bản chênh lệch), phiếu trả NCC TR, phiếu điều chỉnh DC, biên bản kiểm kê KK, đơn mua DM | A4 | PN in giá đơn/giá thực khi in bởi người được xem giá mua |
| Phiếu bán lẻ BL | Nhiệt 80 mm (58 mm cấu hình) | Cần mẫu preview ở INV-18 (hiện thiếu, F4-24) |
| Tem/QR phụ tùng | Could, P2+ | Không làm ở Phase 1 |

Mọi mẫu có ngày dd/MM/yyyy, mã chứng từ, chi nhánh phát hành, người lập; mẫu có hiệu lực theo ngày (FR-SYS-006). Mẫu bảng công HRM-08 là tệp Excel/CSV, không in giấy.

---

## Phụ lục A – Bảng badge chốt (bổ sung vào A.2 của `ba-decisions.md`)

Màu theo `design-system.md` §2: Success, Warning, Danger, Info, Neutral, Purple. "Tag" = `tag--*`, không phải trạng thái. Mọi badge có chữ.

| Đối tượng | Trạng thái → màu | Tag phụ (không phải trạng thái) |
| --- | --- | --- |
| **Tồn kho** (đã chốt) | Đủ hàng Success · Sắp hết Warning · Hết hàng Danger · Chưa đặt định mức Neutral | "Đang về N" Info · "Đã đặt N" Neutral · khả dụng < 0: Hết hàng + alert "Dữ liệu tồn lệch, báo QL" |
| **Chứng từ kho** (PN, PX, HK, XN, TR, DC) | Nháp Neutral · Chờ duyệt Warning · Đã ghi sổ Success · Từ chối Danger · Đã hủy (chỉ nháp) Neutral | Lý do chờ duyệt (Warning): Lệch giá, Lệch số lượng, Nhập không có đơn mua, Xuất bất thường, Vượt hạn mức · "Đã hoàn/đảo bằng HK-…" Neutral trên chứng từ gốc |
| **Yêu cầu cấp phụ tùng** (theo lệnh) | Chờ xuất Warning · Thiếu hàng Danger · Đã xuất Success · Đã hủy Neutral | "Lý do: Chờ phụ tùng" trên lệnh Tạm dừng (đã có) |
| **Yêu cầu mua** | Nháp Neutral · Chờ duyệt Warning · Đã duyệt Success · Từ chối Danger · Đã lập đơn Info · Đã hủy Neutral | "Mua gấp" Warning · "Chờ cấp: Chủ garage" Neutral (khi đã chuyển cấp, vẫn là Chờ duyệt) |
| **Đơn mua** | Nháp Neutral · Đã gửi Info · NCC xác nhận Info · Nhận một phần Warning · Nhận đủ Success · Đã đóng Neutral · Đã hủy (nháp) Neutral | "v2" Neutral · "Trễ N ngày" Danger · "Đóng khi chưa nhận đủ" Warning |
| **Phiếu chuyển kho** (CK) | Nháp Neutral · Chờ duyệt Warning · Chờ gửi Info · Đang vận chuyển Info · Có chênh lệch Danger · Đã nhận Success (đã đóng tự động) · Đã đóng Neutral (sau xử lý chênh lệch) · Từ chối Danger | "Giá trị lớn" Warning · kết quả xử lý lệch (Chờ bù / Ghi mất / Hàng hỏng / Điều chỉnh) Neutral. Bỏ tag "Đã đóng" đi kèm "Đã nhận" |
| **Yêu cầu chuyển** (YK) | Chờ bên gửi xác nhận Warning · Đã xác nhận (đã tạo CK) Success · Bên gửi từ chối Danger | |
| **Đợt kiểm kê** (KK) | Đang đếm Info · Chờ duyệt Warning · Đã ghi sổ Success · Từ chối (cần đếm lại) Danger · Đã hủy Neutral | "Quá hạn duyệt" Danger · "Lệch lặp lại" Warning |
| **Đối chiếu ba bên** | Chờ hóa đơn Warning · Khớp Success · Lệch giá Danger · Lệch số lượng Danger · Chênh lệch chờ duyệt Warning · Đã ghi công nợ Success | |
| **Dòng công thợ** | Chờ QC **Purple** · Đã ghi Success · QC trả lại Danger · Đã đảo Neutral | "Điều chỉnh chờ duyệt" Warning |
| **Hoa hồng** | Chưa ghi nhận Neutral · Chờ duyệt Warning · Đã duyệt Success · Đã đảo Neutral | Thanh toán lệnh dùng đúng badge Thanh toán A.2 |
| **Kỳ công** | Đang mở Info · Đã duyệt Success · Đã khóa Neutral (icon khóa) | "Số tạm" Warning (kỳ chưa khóa) · "Chờ mở lại" Warning · "Đã mở lại" Info |
| **Nhân sự** | Đang làm Success · Nghỉ phép Warning · Đã nghỉ Neutral | Tài khoản: Đã liên kết / Chưa liên kết / Đã khóa (Neutral) |
| **Chấm công** | Đang trong ca Success · Chưa vào ca Neutral · Đã ra ca Neutral · Đi muộn N phút Warning | |
| **Nhà cung cấp** | Đang hợp tác Success · Tạm ngừng Neutral · Ngừng hợp tác Neutral | |

Quy tắc dùng chung: "Chờ duyệt" luôn Warning ở mọi đối tượng; "Từ chối" luôn Danger; "Đã ghi sổ/Đã duyệt/Nhận đủ" Success; "Nháp/Đã hủy/Đã đóng" Neutral; tím chỉ cho "Chờ QC". Không dùng badge cho **loại chứng từ** hay **loại biến động**.

## Phụ lục B – Tiền tố mã chứng từ

Định dạng: `LOẠI-MÃCN-YYMM-STT`, STT 5 chữ số, đánh lại mỗi tháng theo chi nhánh và loại; tiền tố là cấu hình. Nhóm mã FRD tương ứng ghi ở cột 3.

| Tiền tố | Chứng từ | Mã FRD/Journey | Ghi chú |
| --- | --- | --- | --- |
| PN | Phiếu nhập kho | GRN | Đã chốt (câu 11 cũ) |
| PX | Phiếu xuất kho (theo lệnh, bán lẻ, chuyển) | GIN | Đã chốt |
| CK | Phiếu chuyển kho | STO | Mã chi nhánh **gửi** |
| YK | Yêu cầu chuyển kho (bên nhận lập) | — | Mới; xác nhận thì sinh CK |
| KK | Đợt kiểm kê | — | Đã chốt |
| DC | Phiếu điều chỉnh tồn | ADJ | Giữ "DC"; luôn kèm nhãn "Phiếu điều chỉnh tồn" vì "điều chuyển nhân sự" cũng viết tắt DC |
| HK | Phiếu hoàn kho (hoàn theo lệnh, khách trả phụ tùng) | RTN (khách) | Mới |
| TR | Phiếu trả hàng cho NCC | RTN (NCC) | Giữ |
| XN | Phiếu xuất dùng nội bộ, vật tư tiêu hao | GIN (nội bộ) | Mới |
| YM | Yêu cầu mua hàng | — | Giữ |
| DM | Đơn mua (phiên bản hậu tố `-v2`) | — | Đã chốt |
| BL | Phiếu bán lẻ | — | Đã chốt |
| CP | Yêu cầu cấp phụ tùng theo lệnh | — | Tùy chọn; có thể chỉ truy qua lệnh + dòng |

Hóa đơn NCC dùng **số hóa đơn của NCC**, không đánh số nội bộ. Kỳ công định danh bằng chi nhánh + kỳ, không cần STT. **Lưu ý trùng tiền tố:** mã phụ tùng mẫu `PT-0001` trùng chữ với tiền tố phiếu thu `PT` (khác định dạng nhưng gây nhầm khi tìm): mã phụ tùng thật do khách quy ước, prototype nên đổi mẫu (F4-25).

## Phụ lục C – Vai trò MH, NS trong ma trận

Ký hiệu như FRD §2: S tạo/sửa, D duyệt, X xem, Xn của mình, `-` không có.

| Chức năng | MH | NS | Ghi chú |
| --- | --- | --- | --- |
| Mua hàng (yêu cầu, đơn, nhà cung cấp) | S | - | QL duyệt (D); TK cùng S; KT X |
| Danh mục phụ tùng và bảng giá | X | - | Không thấy giá vốn |
| Tồn kho và hàng dưới định mức (INV-04, 05) | X | - | Chỉ Khả dụng/Đang vận chuyển; không giá trị tồn |
| Nhập, xuất, kiểm kê kho | - | - | MH không nhận hàng (tách nhiệm vụ) |
| Hồ sơ nhân sự, điều chuyển, ca và chấm công | - | S | Chi nhánh/nhóm được gán (FR-SYS-012); xem đầy đủ dữ liệu cá nhân theo Phụ lục D |
| Bảng công theo kỳ (HRM-08) | - | S (chuẩn bị), QL duyệt/khóa | NS không khóa kỳ |
| Quy tắc công/hoa hồng (HRM-06) | - | X | CH D; QL S trong quyền; KT X |
| Công thợ, hoa hồng, năng suất | - | X | NS xem để chuẩn bị bảng công; không sửa |
| Thu tiền, công nợ, hóa đơn | - | - | |
| Báo cáo và dashboard | Xn | Xn | **Không có dashboard riêng** (D-09); trang đầu là Mua hàng (MH) hoặc Nhân sự (NS) |

Menu (bổ sung vào `00-foundation.md` §7 và `ROLE_MENU`): MH = Mua hàng (đầy đủ), Kho phụ tùng (chỉ xem), Báo cáo (của tôi); NS = Nhân sự & Công thợ (đầy đủ), Báo cáo (của tôi). Phạm vi chi nhánh: chọn trong các chi nhánh được gán (`pick`).

## Phụ lục D – Ma trận che dữ liệu nhân sự

Không áp dụng cho khách hàng (đã có ở ba-decisions câu 8). "Đầy" = đầy đủ khi mở hồ sơ (ghi nhật ký truy cập, không ghi từng dòng danh sách); "Hiện" = che, bấm Hiện, ghi nhật ký, tự che sau 30 giây; "Hiện+LD" = Hiện và bắt buộc chọn lý do; "Che" = chỉ thấy bản che, không có nút Hiện; "Ẩn" = không hiển thị.

| Vai trò | SĐT cá nhân | CCCD/CMND | Địa chỉ thường trú | Ngày sinh | Chứng chỉ nghề, chức danh, chi nhánh, ngày vào làm |
| --- | --- | --- | --- | --- | --- |
| NS | Đầy | Đầy | Đầy | Đầy | Đầy |
| QL (chi nhánh mình) | Đầy | Hiện | Đầy | Đầy | Đầy |
| CH, QV | Hiện | Hiện | Hiện (che số nhà/đường) | Che | Đầy |
| KT | Che | Ẩn | Ẩn | Ẩn | Đầy (cần cho bảng công) |
| QĐ | Ẩn | Ẩn | Ẩn | Ẩn | Tên, chức danh, kỹ năng/chứng chỉ của thợ trong xưởng |
| TH | Hồ sơ của **chính mình** đầy đủ (qua Hồ sơ cá nhân G1-PRF); người khác Ẩn | | | | Của mình |
| CV, TK, TN, MH | Ẩn | Ẩn | Ẩn | Ẩn | Tên, chức danh, chi nhánh |
| AD | Ẩn (không truy cập dữ liệu nghiệp vụ nhạy cảm, FRD §2) | Ẩn | Ẩn | Ẩn | Tài khoản/liên kết tài khoản |

Định dạng che: SĐT `09•• ••• 123`; CCCD `•••••••• 234` (3 số cuối); địa chỉ chỉ quận/huyện, tỉnh/thành. Khác prototype (A-13): CCCD của QL ở dạng Hiện (không đầy mặc định); KT không còn thấy CCCD/địa chỉ. Bảng quyền sửa được ở G4-SYS-04.

## Phụ lục E – Bộ hạn mức mẫu cho G4-APR-03

**Tất cả là giá trị mẫu, chờ khách chốt; cấu hình theo cấp (QL/QV/CH), theo chi nhánh, có ngày hiệu lực; mỗi hành động dưới đây phải có dòng cấu hình riêng.** UI không chứa số, chỉ hiện giá trị so với hạn mức cùng tên cấp duyệt (câu 14).

| # | Hành động | Màn hình | Tham số | Giá trị mẫu | Người duyệt khi vượt |
| --- | --- | --- | --- | --- | --- |
| 1 | Nhập kho lệch giá | INV-09 | % lệch đơn giá so với đơn mua; hoặc số tiền/đơn vị | > 3% hoặc > 50.000 ₫/đơn vị | QL |
| 2 | Nhập kho lệch số lượng | INV-09 | Nhận **thừa** so với đặt; thiếu thì không cần duyệt (đơn mở) | Thừa > 0 | QL |
| 3 | Dung sai đối chiếu ba bên | PUR-07 | Lệch giá/dòng được coi là Khớp (làm tròn) | ≤ 1.000 ₫/đơn vị, lệch số lượng 0 | KT ghi nhận → QL duyệt chấp nhận |
| 4 | Duyệt yêu cầu mua | PUR-03 | Giá trị tổng/yêu cầu theo cấp | QL ≤ 20.000.000 ₫; QV ≤ 100.000.000 ₫; trên đó CH | Cấp kế tiếp |
| 5 | Mua gấp (hậu duyệt) | PUR-02 | Giá trị tự quyết + thời hạn hậu duyệt | ≤ 2.000.000 ₫, hậu duyệt trong 24 giờ | QL |
| 6 | Chuyển kho giá trị lớn | INV-13 | Giá trị/phiếu (tính theo giá vốn) | > 5.000.000 ₫ | CH hoặc QV (khác vùng: QV hai bên) |
| 7 | Xuất dùng nội bộ | INV-11 | Giá trị/phiếu | TK ≤ 500.000 ₫; QL ≤ 2.000.000 ₫; trên đó CH/QV | QL → CH |
| 8 | Điều chỉnh tồn sau kiểm kê | INV-17 | Giá trị ròng/phiếu; % lệch số lượng/mã | QL ≤ 2.000.000 ₫; lệch > 5% số lượng một mã cần giải trình; mã lệch ≥ 2 lần/60 ngày bị gắn cờ | QV/CH |
| 9 | Điều chỉnh công thủ công | HRM-07 | Số giờ công hoặc ₫/dòng | > 1,0 giờ công hoặc > 300.000 ₫ | CH |
| 10 | Giảm giá bán lẻ/báo giá | INV-18 | % giảm theo vai trò; dưới giá vốn luôn cần duyệt (WF-07) | CV 5%; QL 10%; trên đó CH/QV | QL → CH/QV |
| 11 | Đóng đơn mua khi chưa nhận đủ | PUR-06 | Giá trị phần còn lại | ≤ 5.000.000 ₫ QL; trên đó CH | CH |
| 12 | Hoàn kho cần duyệt | INV-10 | Lệnh đã hủy hoặc đã có hóa đơn: luôn duyệt; còn lại theo giá trị | > 1.000.000 ₫ | QL |
| 13 | Nhắc và chuyển cấp khi quá hạn duyệt | tất cả | Hạn nhắc; hạn chuyển cấp (FR-SYS-015) | Nhắc sau 1 ngày làm việc; chuyển cấp sau thêm 2 ngày; mua gấp: 2 giờ | Cấp trên |
| 14 | Mở lại kỳ công đã khóa | HRM-08 | Luôn cần duyệt, kèm lý do | — | CH |

Mâu thuẫn với Journey §7: ví dụ "2 triệu/10 triệu" của Journey chỉ minh họa, không dùng trong mock (ba-decisions câu 14). Nhân sự giữ vai trò "trưởng kho", "quản lý vận hành", "kế toán trưởng" của ma trận phê duyệt: ánh xạ vào cấp duyệt cấu hình (G-06), không thêm vai trò mới.

## Phụ lục F – Quyết định bổ sung phát sinh khi review

| Mã | Nội dung | Căn cứ |
| --- | --- | --- |
| BS-1 | **Hiển thị tồn chi nhánh khác:** cấu hình `xem_khả_dụng_liên_chi_nhánh` (mặc định bật trong cùng công ty/nhóm). Người dùng chi nhánh A chỉ thấy Khả dụng và "số có thể cho" của chi nhánh B, không thấy Thực tế, Giữ chỗ, giá vốn, và không thấy chi nhánh ngoài nhóm được phép | NFR-ISO-01, FR-INV-014 |
| BS-2 | **Báo thiếu hàng của TK** là sự kiện hệ thống: TK không có quyền sửa lệnh (FRD §2: X) nhưng "Báo thiếu hàng" tự chuyển lệnh sang Tạm dừng, lý do Chờ phụ tùng, ghi nhật ký dưới tên TK; QL/QĐ có thể đảo | Journey §4 bước 5, §8, WF-09 |
| BS-3 | **Phân tách nhiệm vụ:** người đếm kiểm kê ≠ người duyệt; người lập yêu cầu mua ≠ người duyệt cùng cấp; người sửa giờ chấm công không tự sửa giờ của mình | RULE-011, FR-SYS-013 |
| BS-4 | **Hoàn kho cần duyệt khi** lệnh đã hủy hoặc đã có hóa đơn hoặc giá trị vượt ngưỡng; còn lại TK ghi sổ và QL xem báo cáo | Journey §7, §8 |
| BS-5 | **Chuyển nhiều PN cho một hóa đơn NCC:** đối chiếu ba bên theo "hóa đơn ↔ tập các PN của một DM", không 1:1 | FR-PUR-005, FR-PUR-006 |

## Phụ lục G – Tài liệu cần cập nhật khi chốt (chưa thực hiện)

| Tài liệu | Nội dung |
| --- | --- |
| `docs/ui-ux/ba-decisions.md` | A.2 thêm Phụ lục A; câu 4 đổi "Đang về" ở cột bốn số thành "Đang vận chuyển", thêm "Đã đặt"; câu 11 thêm tiền tố Phụ lục B |
| `docs/ui-ux/00-foundation.md` | §6 badge theo Phụ lục A; §7 thêm cột MH, NS; §4 mã chứng từ |
| `docs/ui-ux/screen-inventory.md` | §4.1 INV-04 vai trò (bỏ CV theo FRD M5) và INV-01/19 CV (X); §6 thêm khoảng trống: CV X ở INV-04 so với FRD |
| `docs/user-journey-business-workflow.md` | §4: định nghĩa Đang vận chuyển và Đã đặt; mua gấp; xử lý phát sinh khi kiểm kê; §5: điều kiện ghi nhận công và hoa hồng; chu kỳ kỳ công; §7: thêm bộ trạng thái chứng từ kho, yêu cầu mua, đơn mua, phiếu chuyển, kỳ công |
| `docs/functional-requirements.md` | Gợi ý FR mới cuối module: INV (xử lý chênh lệch chuyển kho, hiển thị Khả dụng liên chi nhánh), PUR (mua gấp), HRM (chu kỳ và điều kiện khóa kỳ, điều kiện ghi nhận công và hoa hồng, định nghĩa ba chỉ số), SYS (nhật ký Hiện dữ liệu nhân sự); UAT tương ứng. Không đổi số FR hiện có |
| `docs/ui-ux/04-inventory-purchasing-hr.md` | Cập nhật §4, §10 (A-01…A-14), §11 theo tài liệu này sau khi sửa gói |
