# BA – Trả lời 14 câu hỏi của Gói 3 "Báo giá, Thợ tablet, Giao xe, In ấn" (`03-quote-technician-delivery.md` §9)

Phiên bản 0.1 · Ngày 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để đi tiếp).

Nguyên tắc áp dụng: nghiệp vụ trong BRD/FRD/Journey thắng; hình thức giao diện theo `design-system.md`. Mục `[Cần xác nhận]` lớn (nhà cung cấp Zalo/SMS, hạn mức, công thức công, chính sách bảo hành chéo, quy tắc hóa đơn, máy in, thời hạn lưu) **không bị chốt thay khách**: thiết kế theo hướng cấu hình có ngày hiệu lực. Mọi con số (ngưỡng, số ngày, số ký tự) là tham số khởi tạo, không phải quy tắc nghiệp vụ, và không được đóng cứng trong giao diện. Nhất quán với `ba-decisions.md` (A.2, A.3, câu 11–14), `ba-answers-02.md` (A.1 bảng chuyển trạng thái lệnh) và `ba-answers-05.md` (câu 3, 9, 12).

Cách đọc: mỗi câu có Quyết định, Lý do, Căn cứ, Tác động (màn hình và tài liệu cần đổi).

---

## Câu 1 – Phiên bản báo giá bị thay thế: trạng thái hay thuộc tính

**Quyết định.** **Thuộc tính của phiên bản, không thêm trạng thái.** Bộ 6 trạng thái Báo giá giữ nguyên (ba-decisions A.2): Nháp, Đã gửi (nhãn "Chờ khách duyệt"), Duyệt toàn phần, Duyệt một phần, Từ chối, Hết hạn.

- Mỗi phiên bản có các thuộc tính: `là phiên bản hiện tại` (có/không), `bị thay lúc`, `bị thay bởi vN`. Giao diện hiển thị bằng tag Neutral **"Phiên bản cũ (chỉ đọc)"** cạnh badge, đúng như designer đang làm (giả định 3).
- Trạng thái của "báo giá" (mã `BG-…-00231`) là trạng thái của **phiên bản hiện tại**. Phiên bản cũ giữ nguyên trạng thái nó có lúc bị thay (v1 vẫn là "Đã gửi") để lịch sử không bị viết lại.
- Danh sách QUO-01 hiện **một dòng cho mỗi báo giá** (phiên bản hiện tại, kèm "(có v1, v2)"); không liệt kê phiên bản cũ thành dòng riêng.
- Quy tắc tạo phiên bản mới (làm rõ FR-REC-023): chỉ tạo được khi **chưa có hạng mục nào được duyệt**, tức báo giá đang ở Nháp, Đã gửi, Từ chối hoặc Hết hạn. Khi vN+1 được gửi, vN hết hiệu lực và liên kết vN hiện "Có bản mới". Khi báo giá đã Duyệt toàn phần hoặc Duyệt một phần (lệnh đã mở), **nội dung đã duyệt bị khóa**: thay đổi đi qua **báo giá bổ sung** (G2-QUO-07, RULE-006), không tạo phiên bản thay thế.
- Mỗi phiên bản giữ nguyên giá và thuế lúc gửi (FR-REC-031).

**Lý do.** Journey §7 và A.2 đã chốt 6 trạng thái; thêm "Đã thay thế" làm trạng thái thứ 7 gây bùng nổ tổ hợp (phiên bản cũ × trạng thái) và lẫn với "Hết hạn". Thay một phiên bản đã được duyệt sẽ làm lệnh đang chạy mất cơ sở (RULE-005).

**Căn cứ.** FR-REC-023, FR-REC-031, FR-REC-009, FR-REC-028, BR-REC-12, RULE-005, RULE-006, Journey §7 (dòng Báo giá), ba-decisions A.2.

**Tác động.** QUO-01/03/05/06; QUO-03 phải ẩn "Tạo phiên bản mới" khi đã duyệt (review F3-02); Journey §7 ghi chú "phiên bản cũ là thuộc tính"; UAT-17 thêm bước "sau khi duyệt, không tạo được phiên bản thay thế".

---

## Câu 2 – Duyệt theo hạng mục hay theo dòng; hạng mục "Bắt buộc"

**Quyết định.**

1. **Đơn vị duyệt là hạng mục.** Một hạng mục gồm một hoặc nhiều dòng (công và phụ tùng đi kèm) và được duyệt hoặc từ chối **cùng nhau**; không duyệt phụ tùng mà bỏ công của chính nó (sẽ vi phạm RULE-007 và làm sai giữ chỗ tồn). "Dòng" trong FR-REC-007/026 được đọc là dòng cấp hạng mục: hệ thống lưu quyết định ở hạng mục và suy ra cho từng dòng. Muốn khách quyết riêng một khoản (ví dụ "Công sửa chữa" ở ví dụ Journey), cố vấn tách nó thành một hạng mục riêng. UAT-17 viết lại theo 4 hạng mục, giữ tổng 4.550.000 / 2.050.000.
2. **"Bắt buộc" là nhãn tư vấn an toàn/kỹ thuật, không phải rào cản cứng.** Hạng mục Bắt buộc được tick sẵn và có cảnh báo, nhưng **khách luôn có quyền không đồng ý** (RULE-005 xoay quanh sự xác nhận của khách; ví dụ Journey và UAT-17 chính là khách từ chối má phanh). Cách thực hiện:
   - Bỏ tick hạng mục Bắt buộc (trên trang khách và ở QUO-05) mở một bước xác nhận riêng: cảnh báo an toàn bằng ngôn ngữ đơn giản, chọn lý do (danh sách cấu hình: để lần sau, giá cao, đã sửa nơi khác, khác), ghi vào bằng chứng duyệt dòng "Từ chối hạng mục bắt buộc", và đưa vào lưu nhắc (BR-REC-11) với cờ "An toàn".
   - Cấu hình **"Cho phép khách bỏ hạng mục bắt buộc"** theo chi nhánh/loại hạng mục, mặc định **Có**. Nếu tắt (ví dụ công đi kèm phụ tùng không tách được), ô tick bị khóa như designer đang làm và có chữ giải thích; khách muốn từ chối thì gọi chi nhánh hoặc cố vấn xử lý tại QUO-05.
   - Nút **"Từ chối" ở trang khách luôn nghĩa là từ chối toàn bộ báo giá** và phải ghi đúng như vậy trên nhãn và hộp thoại (trạng thái báo giá → Từ chối).
3. **Hạng mục Tùy chọn mặc định không tick**, trừ hạng mục có cờ **"Khách đã yêu cầu"** do cố vấn đặt (ví dụ "Cân chỉnh góc đặt bánh xe" thêm ở v2 theo cuộc gọi của khách). Nhãn "Gợi ý từ kiểm tra xe" không đủ để tick sẵn.

**Lý do.** Hạng mục bắt buộc khóa cứng mâu thuẫn với ví dụ duyệt một phần của Journey (má phanh bị từ chối) và để khách không có đường từ chối riêng một hạng mục; quyền quyết định thuộc về khách, trách nhiệm tư vấn thuộc về garage và phải có bằng chứng đã tư vấn. Tick sẵn tùy chọn là "mặc định có lợi cho garage", dễ gây tranh chấp.

**Căn cứ.** FR-REC-007, FR-REC-009, FR-REC-024, FR-REC-026, BR-REC-03, BR-REC-11, BR-REC-12, RULE-005, Journey (Ví dụ báo giá được duyệt một phần), UAT-17.

**Tác động.** QUO-02 (điều khiển Bắt buộc/Tùy chọn và cờ "Khách đã yêu cầu"), QUO-05 bước 1, QUO-06 (ô tick, bước xác nhận bỏ hạng mục bắt buộc, nhãn "Từ chối toàn bộ báo giá"), QUO-08 (cờ "An toàn"); FRD FR-REC-007 làm rõ tiêu chí; UAT-17 viết lại.

---

## Câu 3 – Phát sinh bị từ chối và hạn duyệt

**Quyết định.**

- Hạng mục phát sinh **tồn tại trong lệnh** ngay khi cố vấn lập báo giá bổ sung, theo A.3: thực hiện "Chưa làm" + thuộc tính duyệt, **không tính vào tổng lệnh**, nút Bắt đầu của thợ bị khóa kèm lý do bằng chữ.
- Thuộc tính duyệt có bốn giá trị: **Chờ khách duyệt, Đã duyệt, Từ chối, Hết hạn** (thêm "Hết hạn" cho khớp `ba-answers-02` A.2 mục 7). Không phải trạng thái thứ 6 của hạng mục.
  - **Đã duyệt**: vào tổng lệnh, giữ chỗ phụ tùng, thợ nhận thông báo, nút Bắt đầu mở.
  - **Từ chối** hoặc **Hết hạn**: dòng **giữ lại trong lệnh** với tag "Khách từ chối" / "Hết hạn", không tính tiền, **ẩn khỏi danh sách việc của thợ** (TEC-01), hiện ở lệnh trong nhóm "Không thực hiện"; đồng thời tạo bản ghi lưu nhắc (BR-REC-11, FR-REC-024). Báo giá bổ sung tương ứng ở trạng thái Từ chối hoặc Hết hạn (cùng bộ 6 trạng thái). Không xóa (RULE-010), ghi người và lý do (WF-09).
- **Hạn duyệt phát sinh mặc định (BA đề xuất): 24 giờ kể từ lúc gửi và không muộn hơn giờ hẹn giao**, cấu hình theo chi nhánh và loại dịch vụ. Trước hạn một khoảng cấu hình (mặc định 30 phút), cố vấn nhận thông báo "Cần xử lý" để gọi khách. Cố vấn **gia hạn** được với lý do (mặc định tối đa 1 lần); hết hạn hệ thống tự chuyển Hết hạn.
- Ràng buộc đã có ở `ba-answers-02` A.1: phát sinh đang Chờ không chặn chuyển sang Chờ QC nhưng **chặn Sẵn sàng bàn giao** (cố vấn phải chốt cuối: Đã duyệt và Hoàn thành, Từ chối hoặc Hết hạn).

**Lý do.** Xe chiếm khoang và có giờ hẹn nên phát sinh không thể chờ như báo giá thường (hiệu lực 7 ngày); mẫu 02/11/2026 của designer sau giờ hẹn giao 30/10 là không hợp lý. Giữ dòng trong lệnh giúp truy vết RULE-006 và tránh mất bằng chứng "thợ đã báo, khách đã từ chối".

**Căn cứ.** BR-REC-04, BR-REC-11, FR-REC-014, FR-REC-024, RULE-005, RULE-006, RULE-010, WF-03, WF-09, ba-decisions A.3, ba-answers-02 A.1 và A.2 mục 7.

**Tác động.** QUO-07 (thêm trạng thái Hết hạn, nút Gia hạn, hạn mặc định), TEC-01/02 (hạng mục Từ chối/Hết hạn biến mất khỏi danh sách), G2-REC-04 (nhóm "Không thực hiện"), DLV-02/03 (xem review F3-07); FRD đề xuất FR-REC-037; Journey §7 ghi thuộc tính duyệt gồm "Hết hạn"; UAT-03 bổ sung ca khách từ chối và hết hạn.

---

## Câu 4 – Bộ trạng thái bảo hành, ngưỡng, cách tính

**Quyết định.**

1. **Trạng thái bảo hành là thuộc tính tính toán** (không nhập tay) của từng hạng mục đã giao, gồm bốn nhãn luôn có chữ: **Còn hạn** (Success), **Sắp hết hạn** (Warning), **Hết hạn** (Neutral), **Vô hiệu** (Neutral kèm biểu tượng khóa và lý do). "Vô hiệu" do Quản lý chi nhánh đặt có lý do (ví dụ xe va chạm sau khi giao, sửa nơi khác), ghi nhật ký; không phải trạng thái tự tính.
2. **Chính sách bảo hành theo hạng mục (cấu hình, có ngày hiệu lực, FR-SYS-006):** thời hạn theo thời gian, theo km, và **cách tính**: "thời gian HOẶC km, cái nào đến trước" (mặc định), "chỉ thời gian", "chỉ km". Bảo hành **bắt đầu từ ngày và km khi giao xe** (biên bản giao xe).
3. **Ngưỡng "Sắp hết hạn" (cấu hình):** còn ≤ 14 ngày. Phần km chỉ đánh giá được khi biết km hiện tại, tức lúc xe quay lại hoặc khi nhập ở DLV-06; danh sách DLV-05 chỉ tính theo thời gian. Khi hạng mục có hạn km, hiển thị hạn km bên cạnh nhưng không gán "Sắp hết hạn" theo km ở danh sách.
4. **Ngoài hạn:** không tự tạo được lệnh bảo hành; gửi đề nghị ngoại lệ cho Quản lý chi nhánh (G4-APR-02) kèm lý do, như designer đã làm.
5. **Bảo hành chéo chi nhánh:** giữ `[Cần xác nhận]`; chi nhánh chịu chi phí là cấu hình, **mặc định khởi tạo "Chi nhánh gốc"**. Chi nhánh khác chỉ thấy hạng mục, hạn, điều kiện, chi nhánh gốc và mã lệnh gốc; **không thấy tên khách, tên thợ, giá** (liên kết thợ gốc vẫn lưu bằng mã để FR-REC-018 và FR-HRM-016 hoạt động).

**Lý do.** Trạng thái tính toán tránh dữ liệu lệch; "hoặc km, cái nào đến trước" là cách ghi bảo hành phổ biến ở garage (BA đề xuất, cần khách xác nhận); tách cấu hình cho phép mỗi hạng mục có chính sách riêng.

**Căn cứ.** FR-REC-018, FR-REC-036, FR-CRM-016, FR-SYS-006, FR-HRM-016, BR-REC-08, NFR-ISO-01, Journey §8 (bảo hành tại chi nhánh khác).

**Tác động.** DLV-05/06 (nhãn thứ 4 "Vô hiệu", che dữ liệu liên chi nhánh, review F3-12), DLV-03/04 (in hạn theo cách tính), G4-SYS cấu hình chính sách bảo hành; đề xuất FR-REC-038; BRD/Journey giữ `[Cần xác nhận]` cho bảo hành chéo; UAT-24 bổ sung ca ngoài hạn và vô hiệu.

---

## Câu 5 – Yêu cầu phụ tùng của thợ

**Quyết định.**

- **Có bộ trạng thái riêng** cho đối tượng "yêu cầu phụ tùng" (không phải trạng thái hạng mục hay lệnh): **Đã gửi** (Info) → **Thủ kho đã nhận** (Info) → **Đã xuất một phần** (Warning) → **Đã xuất đủ** (Success); nhánh **Thiếu hàng – chờ hàng về** (Warning, kèm ngày dự kiến nếu có) và **Đã hủy** (Neutral, có lý do). Chỉ thủ kho xuất (FR-INV-007); thợ chỉ chọn phụ tùng có trong lệnh (RULE-007); số lượng tối đa = cần − đã xuất; vượt tồn khả dụng không xuất được (RULE-008).
- **Khi thiếu hàng, hệ thống tự chuyển, không chờ thủ kho:**
  - Hạng mục **đang làm** → **Tạm dừng** với lý do "Chờ phụ tùng"; hạng mục **chưa bắt đầu** → giữ "Chưa làm" và bị khóa kèm tag "Thiếu phụ tùng" (nút Bắt đầu khóa, lý do bằng chữ).
  - Kích hoạt khi (a) thợ tạm dừng chọn "Chờ phụ tùng" (ba-decisions câu 13: tự tạo yêu cầu cho thủ kho), hoặc (b) thủ kho đánh dấu dòng "Thiếu hàng", hoặc (c) tồn khả dụng không đủ lúc khách duyệt.
  - **Lệnh** chuyển **Tạm dừng** (lý do Chờ phụ tùng) **chỉ khi không còn hạng mục nào có thể làm tiếp**; nếu còn việc khác, lệnh giữ Đang sửa chữa. Bộ lọc "Xe chờ phụ tùng" lọc theo hạng mục có lý do này.
  - Khi phụ tùng xuất đủ, lý do tự gỡ và lệnh/hạng mục trở lại (`ba-answers-02` A.1: Tạm dừng → Đang sửa tự động).
- Phụ tùng **ngoài lệnh**: thợ không chọn được; luồng "Báo hư hỏng phát sinh" cho cố vấn (RULE-006).

**Lý do.** Thợ không nên phải biết nội bộ kho; chờ thủ kho chuyển trạng thái sẽ làm lệch giờ công (giờ làm không tính lúc tạm dừng, FR-HRM-005). Chỉ Tạm dừng cả lệnh khi hết việc để tránh dừng cả xe vì một phụ tùng nhỏ.

**Căn cứ.** FR-INV-007, FR-INV-020, FR-REC-013, FR-HRM-005, RULE-007, RULE-008, WF-02, ba-decisions A.1 (Chờ phụ tùng), câu 13, ba-answers-02 A.1.

**Tác động.** TEC-03 (hiện trạng thái từng yêu cầu), TEC-01/02 (phân biệt Tạm dừng và Chưa làm bị khóa, review F3-24), QUO-05 (câu hậu quả về Tạm dừng phải động, review F3-18), G3-INV-06; đề xuất FR-INV-029.

---

## Câu 6 – Chữ ký trên màn hình và xác nhận bằng lời

**Quyết định.**

- **Chữ ký trên màn hình** lưu: (1) ảnh nét ký gắn với chứng từ; (2) **gói bằng chứng** gồm mã và phiên bản báo giá (hoặc mã biên bản), danh sách hạng mục được duyệt/từ chối và tổng tại thời điểm ký, cách xác nhận, thời điểm theo giờ máy chủ, người ghi nhận, thiết bị, chi nhánh; (3) **mã băm** (SHA-256) của gói để phát hiện sửa đổi; (4) không sửa, không xóa; mọi lần xem ghi nhật ký (FR-SYS-003). Chữ ký là dữ liệu cá nhân nên che/phân quyền xem theo NFR-SEC-03.
- Mức bằng chứng này là **bằng chứng nghiệp vụ nội bộ**, không phải chữ ký số có giá trị pháp lý thay thế hợp đồng; giao diện không được mô tả sai. Nếu khách cần giá trị pháp lý cao hơn (hợp đồng doanh nghiệp lớn), đây là câu hỏi mở cho pháp chế `[Cần xác nhận]`.
- Duyệt qua liên kết lưu thêm thời điểm mở, thời điểm duyệt, thiết bị/địa chỉ mạng, phiên bản, và OTP (nếu bật).
- **Xác nhận bằng lời không cần quản lý đồng ý trước** (đúng FR-REC-026: chỉ bắt buộc ghi chú). Điều kiện: ghi chú **≥ 10 ký tự** nêu khách đã nghe nội dung gì; tick "Đã đọc lại hạng mục và tổng tiền cho khách"; gắn nhãn "Ngoại lệ"; tự vào danh sách **"Ngoại lệ cần rà soát"** của Quản lý chi nhánh cuối ngày và báo cáo tỷ lệ bằng lời theo cố vấn. Có cấu hình **ngưỡng giá trị**: vượt ngưỡng thì không dùng được xác nhận bằng lời trừ khi Quản lý duyệt (G4-APR-02). Ngưỡng khởi tạo "chưa đặt" (không chặn) nhưng hệ thống nhắc thiết lập; không ghi số cứng trong giao diện.
- Thời hạn lưu chữ ký và bằng chứng theo thời hạn lưu cấu hình (quyết định retention của khách còn mở).

**Lý do.** Tốc độ ở quầy quan trọng, rủi ro kiểm soát bằng rà soát sau và ngưỡng; băm và dấu thời gian đủ để phát hiện sửa đổi mà không giả vờ là chữ ký số.

**Căn cứ.** FR-REC-009, FR-REC-026, BR-REC-03, BR-REC-12, FR-SYS-003, NFR-SEC-03, Journey (cách duyệt: liên kết, chữ ký, xác nhận bằng lời).

**Tác động.** QUO-05 (ghi chú ≥ 10 ký tự, tick đọc lại, nhãn rà soát), QUO-03 (khối bằng chứng), DLV-04 (cùng cách lưu chữ ký), G4-APR-03/danh sách rà soát; BRD ghi thêm câu mở "giá trị pháp lý của chữ ký trên màn hình"; FRD FR-REC-026 bổ sung tiêu chí.

---

## Câu 7 – "Khách không lấy hóa đơn"

**Quyết định.** **Không chốt thay khách** (nhất quán `ba-answers-05` câu 3). Thiết kế: ở DLV-03, dòng điều kiện hóa đơn hiển thị nút **"Khách không lấy hóa đơn" nhưng khóa** (`aria-disabled`) kèm lý do bằng chữ "Quy tắc chưa được kế toán xác nhận (cấu hình ở G4-EIN-08)", thay vì chỉ một dòng ghi chú. Khi kế toán bật cấu hình: bắt buộc lý do, **kế toán duyệt** (không phải cố vấn), ghi nhật ký, điều kiện hóa đơn tính là "Đạt (ngoại lệ)", lệnh vẫn được đếm riêng ở báo cáo đối chiếu (FR-RPT-004). Trong lúc chưa bật: lệnh vẫn cần hóa đơn hợp lệ; cách phát hành khi người mua không cung cấp thông tin do kế toán của khách xác nhận.

**Lý do.** Sai quy tắc có rủi ro thuế; Nghị định 254/2026 mới có hiệu lực.

**Căn cứ.** WF-05, FR-EIN-009, FR-EIN-012, ba-answers-05 câu 3, ba-answers-02 A.1 (dòng Sẵn sàng bàn giao → Hoàn tất).

**Tác động.** DLV-03; câu hỏi workshop kế toán trong Discovery (đã có ở ba-answers-05).

---

## Câu 8 – Ngưỡng "quên kết thúc" và điều chỉnh giờ thực

**Quyết định.**

- **Ngưỡng cảnh báo (cấu hình, giá trị khởi tạo):** nhắc thợ khi giờ thực > **2 × giờ chuẩn và tối thiểu 1 giờ**; báo Quản đốc khi > **3 × giờ chuẩn** hoặc khi qua giờ đóng cửa của chi nhánh. Hệ thống **không tự dừng đồng hồ** (tránh mất giờ làm thật); mặc định "tự tạm dừng" tắt.
- **Điều chỉnh giờ thực:** thợ không tự sửa (đúng thiết kế). **Quản đốc điều chỉnh** với lý do bắt buộc (danh sách + ghi chú), ghi giá trị trước và sau (FR-SYS-003), thợ nhận thông báo. Chênh lệch lớn hơn ngưỡng cấu hình (khởi tạo 1 giờ) hoặc kỳ công đã khóa thì cần **Quản lý chi nhánh duyệt** (kỳ đã khóa dùng bút toán điều chỉnh, FR-HRM-010). Không xóa mốc giờ; mốc "nhập bù" giữ nhãn.
- **Mốc giờ khi mất mạng:** ghi theo giờ máy kèm giờ nhận ở máy chủ; lệch hơn ngưỡng (khởi tạo 5 phút) thì gắn cờ cho Quản đốc để chống chỉnh giờ máy.

**Lý do.** Giờ thực quyết định công thợ; chặn sửa tùy tiện nhưng không để quên bấm làm sai công.

**Căn cứ.** FR-HRM-005, FR-HRM-008, FR-HRM-010, FR-REC-013, FR-SYS-003, NFR-OFF-01, BR-HRM-03.

**Tác động.** TEC-02 (biến thể "quên kết thúc", log giờ — review F3-25), TEC-01 (cảnh báo), G3-HRM bảng công; cấu hình ngưỡng ở G4-SYS.

---

## Câu 9 – Tiền tố BB và quan hệ "phiếu giao nhận" với "biên bản"

**Quyết định.** **Thêm tiền tố `BB` = Biên bản giao xe** vào bảng mã của ba-decisions câu 11, dạng `BB-MÃCN-YYMM-STT`, STT **riêng** theo chi nhánh, tháng, loại (không dùng lại STT của lệnh; mẫu `BB-Q7-2610-00123` của designer chỉ trùng STT với lệnh do ngẫu nhiên, nên đổi ví dụ). Chỉ có **một chứng từ**: Biên bản giao xe. "Phiếu giao nhận" là **tên mẫu in rút gọn (A5/nhiệt)** của cùng biên bản; bản đầy đủ A4 gọi là "Biên bản giao xe" (khớp ba-decisions câu 12: A4 biên bản bàn giao, A5 phiếu giao xe). Một lệnh có tối đa **một biên bản hiệu lực**; sửa sai bằng **biên bản điều chỉnh** (mã BB mới, liên kết biên bản gốc, có lý do, Quản lý chi nhánh duyệt), không sửa bản gốc (RULE-010).

**Lý do.** Hai chứng từ riêng sẽ nhân đôi bằng chứng và dễ lệch nhau; mẫu in khác khổ là đủ.

**Căn cứ.** FR-REC-017, FR-REC-030, RULE-010, ba-decisions câu 11 và 12.

**Tác động.** DLV-04, PRT-01, UI copy đồng nhất tên; ba-decisions câu 11 (thêm dòng BB, BA cập nhật khi chủ dự án xác nhận); đề xuất mở rộng FR-REC-030 liệt kê tiền tố.

---

## Câu 10 – Nội dung bắt buộc từng mẫu in, QR, khổ nhiệt, nhật ký in lại

**Quyết định.**

Nội dung chung mọi mẫu: tên và địa chỉ chi nhánh, tên pháp nhân và mã số thuế của bên phát hành (theo cấu hình pháp nhân, FR-SYS-018), tên chứng từ, mã (kèm phiên bản nếu có), ngày dd/MM/yyyy, người lập, người in, lần in, khổ giấy. Thiếu **thông tin bên phát hành** thì chặn in bản chính, cho in nháp có chữ "NHÁP – THIẾU THÔNG TIN". Thông tin khách (MST, địa chỉ xuất hóa đơn) chỉ bắt buộc khi khách yêu cầu hóa đơn đứng tên công ty, không bắt buộc cho mọi báo giá.

| Mẫu | Khổ mặc định | Bắt buộc | Không được có |
| --- | --- | --- | --- |
| Báo giá | A4 | Khách, xe (biển số, km), hiệu lực, hạng mục (công, phụ tùng: SL, đơn giá, thành tiền), giảm giá, thuế suất và tiền thuế, tổng, bằng chữ, điều khoản (hiệu lực giá, phát sinh chỉ làm khi khách đồng ý, tóm tắt bảo hành), **ô "Đồng ý" cho từng hạng mục** khi duyệt trên giấy, chữ ký khách và cố vấn; chữ ký Quản lý chỉ khi có duyệt giảm giá vượt hạn mức | Giá vốn, biên lợi nhuận, SĐT đầy đủ (mặc định che) |
| Lệnh sửa chữa (bản xưởng) | A5 | Biển số, xe, hẹn giao, yêu cầu của khách, hạng mục được duyệt với giờ chuẩn và thợ, phụ tùng đã cấp (số phiếu xuất), phát sinh chưa duyệt in rõ "KHÔNG làm", đồ để lại, ô "Xong", chữ ký cố vấn/quản đốc/thợ | Đơn giá, thành tiền, tổng, SĐT, địa chỉ khách |
| Biên bản giao xe (A4) / Phiếu giao nhận (A5, nhiệt 80 mm) | A4 / A5 / nhiệt | Khách, xe, km khi giao, hạng mục và bảo hành (thời hạn, km, cách tính), đồ đạc và phụ tùng cũ trả, người nhận (chủ xe hoặc người được ủy quyền), thanh toán (tổng, đã thu, còn nợ nếu có), số hóa đơn nếu đã xuất (số của nhà cung cấp), chữ ký khách | SĐT đầy đủ khi người in không có quyền |

- **Khổ nhiệt cho báo giá và lệnh:** không mặc định; chỉ cho "in nhanh" theo cấu hình chi nhánh, giữ gợi ý hiện có. Nhiệt dùng cho phiếu giao nhận (rút gọn), phiếu thu, phiếu bán lẻ (ba-decisions câu 12).
- **QR:** in QR liên kết duyệt **phiên bản hiện tại** trên báo giá A4/A5 (có hạn; bản in phiên bản cũ hoặc hết hạn không in QR); lệnh xưởng in QR chỉ chứa mã không đoán được, mở cần đăng nhập; **bỏ QR "tra cứu bảo hành" trên phiếu giao nhận ở giai đoạn đầu** vì chưa có màn hình hay FR cho trang tra cứu của khách (xem review F3-33).
- **Nhật ký in:** ghi **mỗi lần in** ở cấp chứng từ: ai, khi nào, khổ, máy hoặc PDF, số bản, lần thứ mấy; từ lần 2 bản in có chữ "BẢN IN LẠI (lần n)". Lý do in lại: tùy chọn với báo giá, lệnh; **bắt buộc** với biên bản giao xe và chứng từ tài chính. Đưa vào nhật ký FR-SYS-003. FR-ACC-014 chỉ nói về mẫu chứng từ kế toán, không nói nhật ký in nên cần yêu cầu mới (đề xuất FR-SYS-019).
- Mẫu có ngày hiệu lực, lấy từ cấu hình (FR-SYS-006); model máy in vẫn `[Cần xác nhận]` nên mẫu thiết kế theo khổ, kiểm thử trên máy thật trước pilot.

**Căn cứ.** NFR-PRT-01, NFR-COM-01, FR-ACC-014, FR-SYS-003, FR-SYS-006, FR-SYS-018, FR-REC-017, FR-REC-025, NFR-SEC-03, ba-decisions câu 12.

**Tác động.** PRT-01 (điều chỉnh mẫu, cột Đồng ý, bỏ QR phiếu giao nhận, trạng thái khóa quyền in SĐT, lỗi tạo bản in); FRD đề xuất FR-SYS-019; UAT in lại.

---

## Câu 11 – Cách hiển thị giá và thuế cho khách

**Quyết định (BA đề xuất — kế toán và pháp chế xác nhận).**

- Với **khách cá nhân (người tiêu dùng)**: giá từng hạng mục hiển thị **đã gồm thuế GTGT**; "Tổng phải trả" bằng đúng tổng các hạng mục đã chọn; ở phần tổng có dòng "Trong đó thuế GTGT x% = y" (thuế suất lấy từ cấu hình có ngày hiệu lực).
- Với **khách doanh nghiệp** (có MST, cần hóa đơn công ty): hiển thị giá chưa thuế, tiền thuế, tổng, phù hợp hóa đơn.
- Đây là **cấu hình "Chế độ hiển thị giá cho khách"** theo loại khách, có ngày hiệu lực. Dữ liệu lưu luôn tách chưa thuế, thuế, tổng (FR-REC-004); chỉ khác cách hiển thị. Cách làm tròn thuế (theo từng hạng mục hay theo tổng) do kế toán chốt và có ví dụ kiểm thử (NFR-MNT-01).

**Lý do.** Khách bỏ hoặc chọn từng hạng mục sẽ thấy tổng đổi khớp với giá hạng mục đang thấy; tránh cảm giác "giá thêm thuế phút chót". Nguồn thứ cấp cho biết Luật Giá 2023 coi giá niêm yết là giá đã gồm thuế, nhưng báo giá từng việc không hẳn là "niêm yết" nên BA **không khẳng định bắt buộc**; chưa đối chiếu văn bản gốc, giữ `[Cần xác nhận]`.

**Ví dụ số (thuế số mẫu 8%):** hạng mục 1: 1.711.800 ₫; hạng mục 2: 1.155.600 ₫; hạng mục 3: 324.000 ₫; hạng mục 4: 702.000 ₫; tổng 4 hạng mục 3.893.400 ₫; được duyệt 3/4 = 3.191.400 ₫ (khớp G2-REC-04).

**Căn cứ.** FR-REC-004, FR-ACC-009, NFR-MNT-01, Luật Giá 2023 (cần xác minh), BR-REC-02.

**Tác động.** QUO-06, QUO-09, PRT-01 báo giá, QUO-05 bước 1 (hiển thị theo cùng chế độ), cấu hình G4-SYS; Discovery: câu hỏi kế toán về làm tròn và chế độ hiển thị.

---

## Câu 12 – OTP khi khách duyệt

**Quyết định.** Cấu hình ba mức theo chi nhánh: **Tắt / Bật khi giá trị vượt ngưỡng / Luôn bật**. **Mặc định pilot: Tắt.** Ngưỡng do chủ đặt (không ghi số cứng; mock dùng giá trị giả). OTP chỉ **bật được khi nhà cung cấp SMS đã kích hoạt** (D-13): nếu chưa, lựa chọn bị khóa kèm lý do và QUO-05 khóa phương án OTP (đúng thiết kế hiện tại). Mã 6 số, hết hạn 5 phút, giới hạn số lần nhập sai (khởi tạo 5, rồi khóa liên kết 15 phút); tất cả là tham số. Áp dụng cho cả duyệt phát sinh qua liên kết.

**Lý do.** Pilot chưa có nhà cung cấp SMS; liên kết gửi đến đúng số của khách đã là một lớp xác thực; OTP thêm ma sát ở quầy đông. Giá trị lớn và kênh sao chép liên kết/email (không xác thực số điện thoại) là nơi cần OTP nhất nên có mức "vượt ngưỡng".

**Căn cứ.** FR-REC-009, FR-REC-034, D-08, D-13 mục 2 (screen-inventory §5), NFR-SEC-03.

**Tác động.** QUO-04 (dòng thông tin OTP), QUO-05 (phương án OTP), QUO-06 (bảng nhập mã, `autocomplete="one-time-code"`), G4-SYS-17; Discovery.

---

## Câu 13 – Công thợ hiện giờ hay tiền; hoa hồng

**Quyết định.** Pilot: **giờ** như thiết kế (giờ chuẩn, giờ thực, giờ công đã ghi). FRD §2 cho Thợ quyền **Xn** với "Công thợ và hoa hồng", nên thêm cấu hình **"Cho thợ xem tiền công và hoa hồng của mình"**, mặc định **Tắt** cho đến khi công thức công được khách chốt (D-13 mục 4, FR-HRM-015). Khi bật: chỉ hiện **sau khi kỳ công được duyệt hoặc khóa** (FR-HRM-010), không hiện tạm tính trước QC, chỉ phần của chính thợ, và **chỉ hiện số tiền, không hiện cơ sở tính** (giá bán, thanh toán, tổng lệnh) để thợ không suy ra giá.

**Lý do.** Giữ đúng ma trận quyền, không tự hứa số tiền khi công thức chưa chốt, và không lộ giá bán qua hoa hồng.

**Căn cứ.** FRD §2 (dòng Công thợ và hoa hồng), FR-HRM-005, FR-HRM-007, FR-HRM-010, FR-HRM-015, BR-HRM-03, WF-08.

**Tác động.** TEC-05 (thêm khối tiền ẩn theo cấu hình), G3-HRM-06/09; câu hỏi workshop về công thức công.

---

## Câu 14 – Giao xe còn nợ: cá nhân hay doanh nghiệp

**Quyết định.** Giao xe còn nợ là **ngoại lệ có kiểm soát** theo một cơ chế dùng chung: so **dư nợ sau lệnh** với **hạn mức công nợ của khách**.

- **Khách doanh nghiệp:** dùng hạn mức và kỳ thanh toán trong hồ sơ DN (FR-CRM-018, BR-ACC-13). Trong hạn mức: không cần duyệt. Vượt hạn mức: cần **Quản lý chi nhánh duyệt** (G4-APR-02).
- **Khách cá nhân:** hạn mức mặc định **0** (phải thu đủ trước khi giao). Muốn giao còn nợ thì (a) được cấp hạn mức trong hồ sơ khách bởi Quản lý chi nhánh, hoặc (b) "Đề nghị duyệt giao xe còn nợ" kèm lý do; mọi trường hợp đều vào hàng chờ duyệt.
- Người đề xuất không tự duyệt; vượt cấp thì lên Quản lý vùng/Chủ garage theo G4-APR-03 (FR-SYS-015); **không có số tiền cứng** trong giao diện (ba-decisions câu 14).
- Giao diện hiển thị tag "Khách doanh nghiệp" chỉ khi hồ sơ là DN. Dữ liệu mẫu DLV-03 nên dùng khách DN thật (ví dụ Cty TNHH Xây dựng Phú Gia, RO-Q7-2610-00118) thay vì gắn nhãn lên khách cá nhân.

**Lý do.** Chính sách công nợ trong Journey hướng vào DN; cá nhân ghi nợ làm tăng rủi ro thu hồi, nên mặc định chặt nhưng vẫn có lối thoát có kiểm soát.

**Căn cứ.** FR-ACC-020, FR-CRM-018, BR-ACC-13, UAT-26, Journey §8 (dòng Khách doanh nghiệp vượt hạn mức công nợ), ba-answers-05 câu 9 và 12, ba-answers-02 A.1.

**Tác động.** DLV-03 (dữ liệu mẫu, nhãn), G2-CRM-02 (hạn mức cá nhân), G4-APR-02/03.

---

## Quyết định D-13: kênh Zalo/SMS theo cấu hình

**Quyết định.** Không chọn nhà cung cấp Zalo/SMS. Thiết kế:

- Mỗi kênh có trạng thái **Chưa kích hoạt / Đã kích hoạt / Lỗi kết nối**, cấu hình ở G4-SYS-17 (nhà cung cấp mặc định cấp công ty, chi nhánh bật/tắt). Giao diện **không hiện tên hay logo nhà cung cấp**; chỉ hiện "Zalo", "SMS" như kênh.
- Kênh chưa kích hoạt: thẻ chọn bị khóa kèm tag "Chưa kích hoạt" và lý do bằng chữ; **nút Gửi và lựa chọn mặc định phải không trỏ vào kênh bị khóa** (xem review F3-05). Nếu không kênh nhắn tin nào kích hoạt, vẫn gửi được bằng liên kết, email, in.
- Thứ tự gợi ý khi nhiều kênh: Zalo, SMS, email; **dự phòng thủ công** khi nhà cung cấp lỗi: sao chép liên kết hoặc in. Gửi lại không gửi trùng (khóa theo báo giá, phiên bản, kênh).
- Mẫu tin theo kênh có ngày hiệu lực (FR-SYS-006). Chi phí và hạn mức gửi là cấu hình (hiển thị cảnh báo khi gần hết).
- Căn cứ xử lý dữ liệu: tin gắn với dịch vụ khách đang dùng (báo giá, tiến độ) khác tin tiếp thị; tin tiếp thị cần đồng ý riêng (FR-CRM-010). `[Cần xác nhận]` với pháp chế về căn cứ cho tin giao dịch.
- Giai đoạn: liên kết, email, in ở P1; Zalo/SMS ở P2 (FR-REC-034 là Should, `[Cần chọn nhà cung cấp]`).

**Căn cứ.** FR-REC-008, FR-REC-034, FR-CRM-010, FR-SYS-006, D-13 mục 2 (screen-inventory §5).

**Tác động.** QUO-04, G2-CRM-10, G4-SYS-17, QUO-06 (OTP SMS).

---

## Đề xuất cập nhật tài liệu (không thực hiện trong lượt này)

Các id mới đặt cuối nhóm; **không đổi số id hiện có**. Mọi mục là đề xuất, chờ chủ dự án xác nhận.

### FR mới đề xuất

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu (rút gọn) | BR |
| --- | --- | --- | --- | --- |
| FR-REC-037 | Thuộc tính duyệt của hạng mục phát sinh (Chờ khách duyệt, Đã duyệt, Từ chối, Hết hạn); hạn duyệt cấu hình; hết hạn tự chuyển và vào lưu nhắc; còn phát sinh Chờ thì không Sẵn sàng bàn giao | Must | Phát sinh quá hạn tự chuyển Hết hạn và biến khỏi việc của thợ; lệnh còn phát sinh Chờ không chuyển Sẵn sàng bàn giao | BR-REC-04 |
| FR-REC-038 | Chính sách bảo hành theo hạng mục (thời gian, km, cách tính) có ngày hiệu lực; trạng thái bảo hành tính tự động (Còn hạn, Sắp hết hạn, Hết hạn, Vô hiệu) | Should | Đổi chính sách không đổi bảo hành đã giao; hạng mục tính "tháng hoặc km đến trước" hết hạn đúng khi km vượt | BR-REC-08 |
| FR-REC-039 | Biên bản giao xe: mã BB, một biên bản hiệu lực mỗi lệnh, người nhận (chủ hoặc người ủy quyền kèm thông tin xác minh), biên bản điều chỉnh | Should | Giao cho người ủy quyền bắt buộc họ tên, SĐT, quan hệ, ảnh giấy ủy quyền (cấu hình); sửa biên bản chỉ qua điều chỉnh có lý do | BR-REC-07 |
| FR-INV-029 | Trạng thái yêu cầu phụ tùng của thợ (Đã gửi, Thủ kho đã nhận, Đã xuất một phần, Đã xuất đủ, Thiếu hàng, Đã hủy) và quy tắc tự Tạm dừng khi thiếu hàng | Should | Thiếu hàng tự đặt hạng mục Tạm dừng lý do Chờ phụ tùng; lệnh chỉ Tạm dừng khi không còn việc làm tiếp | BR-INV-04 |
| FR-SYS-019 | Nhật ký in: mỗi lần in ghi ai, khi nào, khổ, máy; bản in lại ghi rõ lần thứ mấy; lý do bắt buộc với biên bản và chứng từ tài chính | Should | Chứng từ in lần 2 mang chữ "BẢN IN LẠI (lần 2)" và có dòng nhật ký | BR-SYS-02 |

### Làm rõ FR hiện có (không đổi id)

- **FR-REC-007 / FR-REC-026:** đơn vị duyệt là hạng mục; "Bắt buộc" là nhãn tư vấn, khách vẫn từ chối được với ghi nhận lý do (có cấu hình khóa); xác nhận bằng lời yêu cầu ghi chú ≥ 10 ký tự.
- **FR-REC-023:** chỉ tạo phiên bản thay thế khi chưa có hạng mục được duyệt; sau đó dùng báo giá bổ sung.
- **FR-REC-034:** OTP ba mức, điều kiện SMS kích hoạt.
- **FR-REC-017:** tên mẫu in A4 "Biên bản giao xe" và mẫu rút gọn "Phiếu giao nhận" là một chứng từ.

### Đồng bộ các tài liệu khác

- `user-journey-business-workflow.md` §7: phiên bản cũ là thuộc tính; thuộc tính duyệt của hạng mục gồm "Hết hạn"; bộ trạng thái bảo hành tính toán; ghi chú lệnh chỉ Tạm dừng khi không còn việc làm tiếp. §8: thêm tình huống khách từ chối hạng mục bắt buộc, giao xe cho người ủy quyền, phát sinh hết hạn.
- `business-requirements.md`: câu mở mới "giá trị pháp lý của chữ ký trên màn hình", "chế độ hiển thị giá/thuế cho khách cá nhân", OTP; không đổi số RULE.
- `functional-requirements.md`: ma trận truy vết (FR mới), UAT-03, UAT-17, UAT-24 bổ sung; UAT mới cho phát sinh hết hạn, giao xe cho người ủy quyền, in lại.
- `ba-decisions.md`: câu 11 thêm tiền tố BB; A.2 không đổi.
- `screen-inventory.md`: cập nhật dòng G2-QUO-05 ("tích duyệt từng dòng" thành "từng hạng mục"), G2-DLV-03 (điều kiện phát sinh), G2-DLV-05 (nhãn Vô hiệu).
- `design-system.md`: không đổi.

## Các điểm giữ `[Cần xác nhận]` (không chốt thay khách)

Nhà cung cấp Zalo/SMS; ngưỡng OTP và ngưỡng xác nhận bằng lời; giá trị pháp lý của chữ ký trên màn hình; chế độ hiển thị giá/thuế và làm tròn thuế; chính sách bảo hành chéo chi nhánh và chi nhánh chịu chi phí; quy tắc "khách không lấy hóa đơn"; công thức công và hoa hồng; hạn mức công nợ và hạn mức duyệt cụ thể; model máy in; thời hạn lưu bằng chứng.
