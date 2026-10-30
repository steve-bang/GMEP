# BA Review lần 2 – Gói 5 "Tài chính và hóa đơn" (G4-ACC 01..21, G4-APR, G4-EIN)

Phiên bản 0.1 · 30/10/2026 · BA · Đối tượng: `design/g4-finance/*` (32 màn, `pack.js`, `pack.css`, `index.html`) và `docs/ui-ux/05-finance-invoice.md` v0.2. Đối chiếu `review-05-finance-invoice-ba.md` (F5-01..22), `ba-answers-05.md`, FRD §2 (ma trận quyền), `ba-decisions.md`.

Giới hạn: đọc mã, không mở trình duyệt. Đã đọc toàn bộ `pack.js`; đọc kỹ ACC-01, 03, 04, 05, 07, 08, 09, 11, 13, 15, 16, 17, 21; APR-01, 02, 03; EIN-01 đến 08; quét ACC-02, 06, 10, 12, 14, 18, 19, 20 theo nút, quyền và hộp thoại. Đã đọc phần liên quan của `design/assets/app.js` (khóa xác nhận nguy hiểm, PII, chuyển trạng thái).

**KẾT LUẬN: CHƯA ĐẠT — còn 17 finding (0 Blocker, 7 Major, 10 Minor).**

Cấu trúc tốt: `G4F.setEnabled/refreshBtn` (pack.js:210-217) gộp đúng các cờ khóa cho các nút chính; `canApprove` (pack.js:220-227) đúng ma trận; ACC-01/04/05/08/13/21 đã có xác nhận mức 2 với ô tích. Điểm còn hở tập trung ở: (1) các hộp thoại "gửi yêu cầu" mức 3 chưa khóa chống gửi trùng; (2) xác thực lại mật khẩu/MFA chưa ràng buộc nút; (3) màn mới ACC-21; (4) cấu hình tiền (APR-03) lưu không qua duyệt.

## 1. Kết quả kiểm tra F5-01..F5-22 trong mã

| Finding | Kết quả | Căn cứ trong mã |
| --- | --- | --- |
| F5-01 duyệt drawer/hàng loạt, từ chối bắt lý do | **Đạt một phần** | Đạt ở APR-01: `dlg-approve` gate + `data-g4f-submit` (apr-01:90-94), từ chối cần lý do ≥ 5 (app.js:163 + apr-01:96-99), bulk có submit (apr-01:109). Chưa đạt: APR-02 từ chối chỉ `data-close data-toast` (apr-02:95); hộp thoại duyệt không nêu số tiền, nút không ghi số tiền; sau khi duyệt các nút còn lại không khóa (F5R2-03) |
| F5-02 quyền duyệt, người lập ≠ người duyệt | **Đạt** | `canApprove` (pack.js:219-227); apr-01:129-133, 146; apr-02:115-119. Tồn đọng nhỏ ở F5R2-11 |
| F5-03 CV xem sổ công nợ | **Đạt mã, chưa đạt tài liệu index** | acc-11:83 và subnav pack.js:24 đã bỏ CV; nhưng `index.html:28` vẫn ghi "CV, QL, CH (X)" (F5R2-14) |
| F5-04 chi NCC số tiền sai | **Đạt** | acc-13:62-70: khóa khi 0, > còn nợ, thiếu lý do ngoại lệ; nhãn đổi theo hạn mức. Tồn đọng nhỏ F5R2-10 |
| F5-05 phiếu chi ACC-04 mức 2 | **Đạt một phần** | Có `alertdialog`, gate, `data-lock="#btn-exp"`, nhãn kèm số tiền (acc-04:64-77, 98). Chưa đạt: Người nhận, Diễn giải, Loại bắt buộc nhưng nút bật chỉ cần số tiền > 0 (acc-04:68-72, 98); khối cảnh báo vượt hạn mức in cứng "1.200.000 ₫" (acc-04:74); không đặt lại form sau ghi (F5R2-05) |
| F5-06 ghi cọc | **Đạt** | acc-01:166-175, 210, 232: gate, `setEnabled(v>0)`, lock, nhãn kèm số tiền |
| F5-07 khóa mất kết nối bị ghi đè | **Đạt một phần** | Nút chính đã qua `setEnabled`; acc-01:203 tôn trọng khóa. Còn lỗ hổng: nút xác nhận kiểu `data-confirm-btn` do app.js:164 gán `disabled` trực tiếp và không có cờ mạng; hộp thoại đang mở vẫn gửi được khi mất mạng; vài chỗ gán `disabled` thủ công (acc-09:101, acc-17:66, acc-18:62, acc-03:141) (F5R2-09) |
| F5-08 bỏ ghép, hủy yêu cầu có khóa | **Đạt** | acc-16:60 và ein-06:48 (`data-g4f-submit` + `data-lock`, nhãn "Truy vấn lần cuối rồi hủy") |
| F5-09 mở lại ngày/kỳ | **Chưa đạt** | Có đường "Đề nghị mở lại" + biến thể "đang được mở lại" (acc-09:15-17, 22, 76-85; acc-17:15, 51-54). Nhưng nút "Gửi đề nghị" chỉ phụ thuộc lý do + gõ từ khóa (app.js:163); ô mật khẩu và MFA bắt buộc nhưng không ràng buộc nút; không khóa chống gửi trùng; "Hoàn tất điều chỉnh, khóa lại" (acc-09:16) chỉ `data-toast`, không xác nhận (F5R2-02) |
| F5-10 khoản nhận trước | **Đạt về hiện diện** | Có `g4-acc-21.html`, chip ở ACC-01:59, dòng ở ACC-11:27 và ACC-03:61. Chất lượng màn mới: F5R2-07, 08 |
| F5-11 AD xem hàng chờ lỗi | **Đạt mã, chưa đạt index** | ein-06:53 và ein-01:15 đã bỏ AD; `index.html:55` còn "AD (X)" |
| F5-12 badge đổi trước khi ghi | **Đạt** | acc-01 không đụng `pay-badge`; trạng thái dự kiến là tag (acc-01:125, 196-199). Sau khi ghi badge cũng chưa cập nhật (Minor, F5R2-16) |
| F5-13 hoàn một phần | **Đạt** | acc-07:41-45, 81-87 |
| F5-14 che PII | **Đạt (đóng)** | Kiểm app.js:420-428 `piiPolicy`: CV, QL, TN, QĐ thấy đủ; CH, QV bấm Hiện không lý do; KT Hiện có lý do; TK che; TH, AD không thấy. Hành vi prototype đã theo ba-decisions câu 8; nhận định vòng 1 "chưa theo bảng quyền" sai về prototype. Xem quyết định mục 4 |
| F5-15 dữ liệu PC-…00041 | **Đạt** | acc-04:45 và acc-09:39 thống nhất "thiếu chứng từ gốc". Có mâu thuẫn dữ liệu mẫu khác (F5R2-15) |
| F5-16 điều kiện chặn khóa ngày | **Đạt một phần** | acc-09:33-35 có "chênh lệch chưa duyệt" và "ca chưa chốt". Thiếu điều kiện chặn (d) "thanh toán/phiếu chi đang xử lý dở" và cảnh báo "yêu cầu phê duyệt đang chờ" (F5R2-12) |
| F5-17 mã YH, mã chống trùng | **Đạt** | Không còn `YC-EIN`; mã chống trùng nằm trong `<details data-g4f-roles="KT AD">` (ein-02:75, ein-03:87) |
| F5-18 tag hóa đơn gốc | **Đạt** | ein-01:48-52, ein-03:26, 35 |
| F5-19 empty/filtered | **Đạt** | acc-15:53-55, acc-13:53-54, acc-21:61-63 |
| F5-20 bulk cùng loại | **Đạt** | apr-01:141-152 khóa ô loại khác kèm `title`; không còn "chọn tất cả" |
| F5-21 liên kết bị từ chối quyền, rà class | **Đạt một phần** | ACC-08 đã mở cho KT, CH, QV (acc-08:99); ein-05:35 ẩn theo vai trò. Còn liên kết trần: ein-01:46-47, 66 và ein-05:46 dẫn TN tới EIN-06 (bị từ chối) (F5R2-14). Rà class: BA đã đối chiếu ~60 class của `components.css`, `base.css`, `pack.css`, đều có; quyết định ở mục 4 |
| F5-22 cập nhật tài liệu | **Đạt một phần** | `05-finance-invoice.md` cập nhật tốt (§2, §4, §10, §11); nhưng `index.html` còn "31 màn hình" (index.html:63) và 2 dòng quyền cũ |

## 2. Finding mới (F5R2)

### Major

**F5R2-01 (Major) – Các hộp thoại "gửi yêu cầu" mức 3 chưa khóa chống gửi trùng.**
Vị trí: nút xác nhận chỉ có `data-confirm-btn data-close data-toast`: acc-03:87 (đảo bút toán phiếu thu), acc-05:87 (đảo phiếu chi), acc-09:85 và acc-17:54 (đề nghị mở lại), apr-02:95 (từ chối), acc-11:78 (nới hạn mức), acc-14:72, acc-20:51, apr-03:67, ein-07:76, ein-08:57; acc-16:55 ("Ghép", mức 2). F5-08 chỉ sửa 2 nơi.
Tác động: hộp thoại đóng, nút kích hoạt vẫn dùng được, gửi lần hai tạo yêu cầu thứ hai; trái UAT đề xuất "đảo phiếu thu bấm hai lần chỉ một bút toán" (FR-ACC-021) và RULE-010.
Cách sửa: thêm `data-g4f-submit` + `data-lock` tới nút kích hoạt, trạng thái "Đã gửi duyệt, chờ …" (khóa tới khi yêu cầu có kết quả); với đảo bút toán hiển thị tag "Đang chờ duyệt đảo" trên phiếu và khóa nút Đảo.

**F5R2-02 (Major) – Mở lại ngày/kỳ: xác thực lại mật khẩu, MFA không ràng buộc nút; "Hoàn tất điều chỉnh" không xác nhận.**
Vị trí: acc-09:81-85, acc-17:53-54 (app.js:163 chỉ xét lý do và từ khóa; ô `ro-p`, `ro-m` không được kiểm); acc-09:16 (`btn-finish` chỉ `data-toast`, thuộc mức 3 "khóa ngày/kỳ" theo `05-finance-invoice.md` §4.8).
Cách sửa: nút bật chỉ khi mật khẩu không rỗng và MFA đủ 6 chữ số; "Hoàn tất điều chỉnh" dùng hộp thoại mức 3 (gõ ngày), khóa chống bấm đúp, và có kết quả "còn điều kiện chặn" để người đề nghị thấy.

**F5R2-03 (Major) – Duyệt/từ chối trong APR-01: sau một quyết định vẫn quyết định ngược được; khóa rò sang yêu cầu khác.**
Vị trí: apr-01:94 và 99 (`data-lock` chỉ trỏ một nút: duyệt khóa `#btn-appr`, từ chối khóa `#btn-rej`); `data-g4f-keep-lock` không bao giờ được gỡ (pack.js:252) nên nút Duyệt tiếp tục bị khóa khi mở yêu cầu khác (và nhãn "Đã duyệt" giữ nguyên).
Tác động: một yêu cầu tiền có thể vừa Duyệt vừa Từ chối/Chuyển cấp; trái APR-02 "đã được người khác duyệt khóa mọi quyết định".
Cách sửa: trạng thái theo yêu cầu: sau quyết định khóa cả ba nút và hiện tag kết quả trong drawer; mở yêu cầu khác phải đặt lại trạng thái; dòng trong danh sách chuyển sang tab "Đã xử lý". Ghi rõ trong handoff: khóa là trạng thái của yêu cầu, không phải của nút.

**F5R2-04 (Major) – ACC-11 "Ghi nhận thu công nợ" không kiểm số tiền, không khóa chống bấm đúp.**
Vị trí: acc-11:59-68. Số tiền điền sẵn 4.600.000 nhưng nút chỉ chờ ô tích; không chặn 0 hoặc vượt dư nợ; "Mã giao dịch *" không kiểm; nút không ghi số tiền; không `data-lock`, sau khi ghi mở lại vẫn điền sẵn đúng khoản cũ (thu trùng).
Cách sửa: mẫu như acc-13 (`setEnabled` theo số tiền > 0 và ≤ dư nợ chọn, mã giao dịch bắt buộc với chuyển khoản, nhãn "Ghi nhận thu X ₫", lock, cập nhật dư nợ sau ghi).

**F5R2-05 (Major) – ACC-04 phiếu chi: nút chi bật khi thiếu người nhận, diễn giải; form không đặt lại.**
Vị trí: acc-04:68-72 (đánh dấu bắt buộc) so với acc-04:98 (chỉ xét số tiền); acc-04:74 (số tiền và hạn mức in cứng); không reset ô sau ghi.
Cách sửa: nút bật chỉ khi Loại, Người nhận, Diễn giải, Số tiền hợp lệ; cảnh báo hiển thị số thật đang nhập; xóa trắng form sau khi ghi và nhả khóa khi đóng hộp thoại (khóa theo phiếu, không theo nút "Phiếu chi", nếu không thì thu ngân không lập được phiếu thứ hai).

**F5R2-06 (Major) – Cấu hình tiền/thuế lưu không qua duyệt; AD sửa được ma trận hạn mức.**
Vị trí: apr-03:15 (`data-g4f-need="CH AD"`) và apr-03:67 ("Lưu phiên bản mới" tự có hiệu lực); ein-08:38 ("Lưu" quy tắc thời điểm lập hóa đơn và cọc, chỉ `data-toast`). `ba-answers-05` câu 8: đổi cấu hình luôn duyệt riêng; EIN-08 drawer đúng cách (gửi Chủ garage duyệt, ein-08:57) nhưng quy tắc lập hóa đơn thì không.
Tác động: người cấu hình kỹ thuật tự đổi hạn mức duyệt chi tiền hoặc quy tắc thuế: phá RULE-011 và tách nhiệm.
Cách sửa: AD chỉ soạn nháp "Gửi Chủ garage ban hành"; CH ban hành trực tiếp (mức 3, có ngày hiệu lực); EIN-08 quy tắc lập hóa đơn đi qua "Gửi duyệt" như đơn vị phát hành; hiển thị người ban hành và ngày ở lịch sử phiên bản.

**F5R2-07 (Major) – G4-ACC-21: thao tác tiền trên thẻ mobile không kiểm quyền; không khóa chống bù trùng; "Hoàn lại" không có đầu vào.**
Vị trí: acc-21:43-44 (thẻ mobile: "Bù vào lệnh" và "Hoàn lại" không có `data-g4f-need`, trong khi bảng desktop giới hạn KT, TN: acc-21:35-37) nên QL, CH, QV bù được trên điện thoại; acc-21:55 (nút "Bù" không `data-lock`; `MAXV` không giảm sau khi bù, mở lại vẫn bù tiếp cùng khoản; không `data-g4f-online`); acc-21:35-37 "Hoàn lại" chỉ là link `g4-acc-07.html`, ACC-07 lấy "phiếu thu gốc" làm đầu vào nên không biết hoàn khoản nào.
Cách sửa: gắn `data-g4f-need`, `data-g4f-online` cho thẻ mobile; sau khi bù cập nhật số dư dòng (và khóa khi hết); đặt biến thể "Hoàn khoản nhận trước" cho ACC-07 (xem câu 1 mục 3) và truyền khách và số tiền tối đa.

### Minor

**F5R2-08 (Minor) – Công nợ khách lộ cho vai trò "-" trong FRD §2.** acc-21 cho TN thấy cột "Lệnh còn nợ của khách" của nhiều khách (acc-21:33-37, `allow` có TN, acc-21:60); acc-03:65 cho TN, CV thấy "còn nợ 19.275.000 ₫" của lệnh khác và liên kết ACC-11 (bị từ chối quyền). FRD §2 "Công nợ và giá vốn": TN và CV = "-". Cách sửa: TN, CV chỉ thấy khoản nhận trước và lệnh còn nợ của khách đang đứng quầy (mở từ chip ở ACC-01); danh sách toàn bộ khách chỉ KT, QL, CH, QV; bỏ câu và liên kết công nợ khỏi ACC-03 với TN, CV.

**F5R2-09 (Minor) – Khóa mất kết nối chưa phủ hết.** (a) Hộp thoại đang mở không bị khóa khi mất mạng: các nút `data-g4f-gate-btn`, `data-confirm-btn` không mang `data-g4f-online`, và app.js:164 gán `disabled` đè khi gõ; (b) gán `disabled` thủ công: acc-09:101, acc-17:66, acc-18:62 (đã gọi `G4F.refresh()` nên tạm ổn nhưng dễ lỗi), acc-03:141 (`al-ok`, bỏ qua vai trò và mạng); (c) acc-03:99 "Lưu phân bổ" thiếu lý do bắt buộc, thiếu lock. Cách sửa: thêm `data-g4f-online` vào mọi nút ghi trong hộp thoại và cho `refreshBtn` được gọi sau `chk()`; xóa gán thủ công.

**F5R2-10 (Minor) – ACC-13.** "Chi kèm ngoại lệ" thiếu `data-g4f-online` (acc-13:28); cảnh báo `py-lim` nói "vượt hạn mức" cả khi chỉ là ngoại lệ dưới hạn mức (acc-13:44, 66); `py-ok` không `data-lock`, dòng phiếu nhập không cập nhật còn nợ sau gửi nên chi lại được cùng phiếu.

**F5R2-11 (Minor) – APR-01/02.** Hộp thoại duyệt và duyệt hàng loạt thiếu số tiền/tổng giá trị trên nội dung và nhãn nút (apr-01:92, 108-109; apr-02:87) trái định nghĩa mức 2; "Chuyển cấp" không kiểm quyền cặp (loại, vai trò) và không có ô ghi chú dù lời mô tả nói "kèm ghi chú" (apr-01:88, 101-104); cờ Kế toán trưởng (`G4F.ktt`) mất khi đổi trang (pack.js:325, không lưu sessionStorage); bulk kiểm người lập bằng một tên cố định (apr-01:146).

**F5R2-12 (Minor) – ACC-09.** Thiếu dòng điều kiện chặn (d) "thanh toán/phiếu chi đang xử lý dở" và cảnh báo "yêu cầu phê duyệt đang chờ" (ba-answers-05 câu 1; acc-09:32-40); thời điểm mô phỏng lệch (acc-09:22 "còn 47 giờ" trong khi kiểm tra lúc 21:30, duyệt 21:50 cùng ngày).

**F5R2-13 (Minor) – EIN.** ein-02: điều kiện "Thông tin người mua đầy đủ" cố định, chọn "Khách có MST" nhưng bỏ trống MST nút Phát hành vẫn bật (ein-02:64, 105-110) trái FR-EIN-011; ein-03:97 "Gửi báo" bật khi chưa nhập lý do; ein-03:78 email nhận hóa đơn đầy đủ nằm sẵn trong HTML, không qua chính sách PII (xem quyết định mục 4); ein-02:21 và ein-03:21 nút "Truy vấn" chỉ toast, không khóa.

**F5R2-14 (Minor) – Đồng bộ chỉ mục, liên kết, xuất file.** `index.html:28` (còn CV), `:55` (còn AD), `:63` ("31 màn hình"), `:26` (ACC-09 "CH mở lại" đã đổi quy trình); liên kết trần tới EIN-06 cho TN: ein-01:46-47, 66; ein-05:46; ACC-10:15 (`dlg-export`) và acc-12:15 không kiểm quyền xuất (khác ACC-02:15, ACC-15:15; FR-SYS-013).

**F5R2-15 (Minor) – Dữ liệu mẫu mâu thuẫn.** RO-…00121: acc-03:60 (đã có hóa đơn 0000410, 1.000.000 ₫) so với ein-05:36 (chưa có yêu cầu phát hành, 890.000 ₫, khách Phạm Thị Hoa; EIN-01:47 và EIN-06:28 lại dùng RO-…00114 cho khoản 890.000 ₫); RO-…00118: acc-09:37 "còn nợ 6.300.000 ₫" so với ein-05:35 "Đã thanh toán"; phiếu `PT-Q7-2610-00932` trùng giữa acc-01:175 (cọc) và acc-11:68 (thu nợ); hóa đơn 0000413 thuộc hai khách (ein-03:35 và acc-07:23); acc-08:108 điền sẵn số tờ trong khi mô tả yêu cầu "không điền sẵn" (doc §4.3).

**F5R2-16 (Minor) – ACC-01.** Sau khi ghi, badge Thanh toán không cập nhật (acc-01:58, 163); "Mã giao dịch" không kiểm với chuyển khoản (acc-01:94); ô nhập dòng thanh toán vẫn sửa được với vai trò chỉ xem (chỉ nút ghi bị khóa).

**F5R2-17 (Minor) – Quyền lập đề xuất so với FRD §2.** KT lập hoàn tiền (acc-07:48) và bù khoản nhận trước (acc-21:35) trong khi "Thu tiền và sổ quỹ" KT = X. Xem quyết định mục 4 (D-R2-3); cần ghi vào FRD §2 ghi chú.

## 3. Trả lời 8 câu hỏi còn lại (§11) — BA đề xuất, chờ xác nhận

| # | Quyết định | Lý do và tác động |
| --- | --- | --- |
| 1 | **Có biến thể "Hoàn khoản nhận trước" của ACC-07.** Đầu vào là dòng khoản nhận trước của ACC-21 (khách, số dư, phiếu thu nguồn); số hoàn ≤ số dư nhận trước; hình thức hoàn mặc định theo phiếu thu nguồn; duyệt như hoàn tiền (QL; CH/QV khi vượt hạn mức); không kích hoạt nhắc hóa đơn điều chỉnh (khoản này chưa gắn hóa đơn) | Giữ nguyên nguyên tắc "phiếu gốc không sửa" (RULE-010), tránh nhập tay. Sửa ACC-07, ACC-21; FR-ACC-022 |
| 2 | **Không thêm hình thức "Dùng khoản nhận trước" ở ACC-01 (Phase 1-2); chỉ bù ở ACC-21.** ACC-01 chỉ giữ chip và liên kết | Một đường bù duy nhất, dễ khóa chống trùng và dễ đối soát; xem lại sau pilot nếu thu ngân phản ánh vướng |
| 3 | **"Chi kèm ngoại lệ" luôn cần duyệt tối thiểu cấp Quản lý chi nhánh**, bất kể số tiền; số tiền vượt hạn mức QL thì theo ma trận (QV/CH); người đề xuất không tự duyệt | Chênh lệch 3 bên là rủi ro kiểm soát, không phải rủi ro số tiền; hạn mức vẫn được tôn trọng. Ghi vào APR-03 dòng "Chi kèm ngoại lệ" |
| 4 | **Hiển thị cột "Cờ rủi ro" ở APR-01** (tag chữ: "Lặp trong 24 giờ", "Thiếu chứng từ gốc", "Người lập = bạn"), người duyệt (CH, QV, QL) thấy; mục có cờ có ô chọn bị khóa kèm lý do và chỉ duyệt riêng; người đề xuất chỉ thấy dòng của mình không thấy cờ của người khác. Thêm 2 dòng mẫu có cờ | Cần để kiểm thử điều kiện câu 8 của ba-answers-05; tham số 24 giờ ở APR-03 |
| 5 | **Ủy quyền Quản lý vùng duyệt mở lại: cấu hình ở G4-APR-03** (mục "Ủy quyền duyệt", chỉ CH sửa, theo nhóm chi nhánh, mặc định tắt, có ngày hiệu lực và nhật ký). G4-SYS chỉ hiển thị lại | Mọi cấp duyệt nằm một chỗ, tránh hai nơi cấu hình mâu thuẫn |
| 6 | **Phase 1 một kế toán: yêu cầu hóa đơn điều chỉnh/thay thế/hủy do chính người có cờ KTT lập thì tự chuyển Chủ garage duyệt**, hiển thị lý do chuyển ("Người lập không tự duyệt"); danh sách người có cờ KTT cấu hình ở APR-03; không thêm vai trò mới | Đúng câu 12 của ba-answers-05; APR-01 (apr-01:49) đã mô phỏng đúng |
| 7 | **Lệnh và hóa đơn hiện hóa đơn gốc "Đã xuất" kèm tag "Đang chờ thay thế/điều chỉnh"** cho tới khi nhà cung cấp/cơ quan thuế xác nhận; khi xác nhận mới chuyển sang hóa đơn mới theo câu 2. Trạng thái Thanh toán không đổi theo hóa đơn (FR-REC-028). Cách hiển thị từng trường hợp theo Thông tư 91/2026 vẫn `[Cần kế toán xác nhận]` | Đồng bộ ein-03:25, 35 |
| 8 | **Đặt ở G4-APR-03** (không tạo màn mới): hàng "Chênh lệch quỹ ca/ngày" cột "Tự quyết đến" là ngưỡng chỉ cần giải trình; thêm hàng "Chênh lệch đối soát ngân hàng cần Kế toán trưởng". Giá trị khởi tạo minh họa: 50.000 ₫ (quỹ), 20.000 ₫ (ngân hàng), nhãn "minh họa"; khách chốt thật | Hiện apr-03:32 để 0 ₫; đổi 0 thành "chưa chốt" nếu khách chưa quyết, không đặt cứng. Có ngày hiệu lực |

## 4. Quyết định các phần "chưa xử lý trọn vẹn" — BA đề xuất, chờ xác nhận

**D-R2-1 (F5-14) – Đóng, tính Đạt.** Prototype đã theo bảng quyền PII qua `piiPolicy` (app.js:420-428); hộp thoại lý do của pack.js:160-163 chỉ dùng cho KT (`reveal-reason`). Việc cần làm: (1) sửa §9 của `05-finance-invoice.md` thành "prototype đã theo ba-decisions câu 8 qua app.js; dev theo bảng, giá trị đầy đủ chỉ tải sau khi Hiện, không nằm trong HTML"; (2) **dữ liệu người mua trên hóa đơn (tên, MST, địa chỉ, email nhận) ở EIN-02/EIN-03 là dữ liệu nội dung chứng từ hợp lệ**: hiện đầy đủ cho TN và KT là người phát hành, ghi nhật ký truy cập; CH, QV, QL xem danh sách thì che SĐT/email/địa chỉ theo chính sách (BA đề xuất; cần chủ dự án/pháp chế xác nhận theo Luật Bảo vệ dữ liệu cá nhân 2025); (3) email nhận hóa đơn là giá trị từ hồ sơ khách, không viết cứng trong HTML (F5R2-13).

**D-R2-2 (F5-21) – Đóng khi sửa nốt liên kết trần (F5R2-14).** Đã đối chiếu thủ công khoảng 60 class dùng trong gói với `components.css`, `base.css`, `pack.css`: đều tồn tại (ví dụ `tag--reason`, `sync--wait`, `bulk-bar`, `table-wrap--responsive`, `stack-2`, `g4f-diff`). Không cần chạy công cụ; khi có công cụ, designer chạy kiểm một lần trước handoff nhưng không chặn bàn giao. Chuẩn liên kết: mọi liên kết sang màn có `allow` hẹp phải có `data-g4f-roles` hoặc chuyển sang chế độ chỉ đọc.

**D-R2-3 (F5R2-17) – Quyền lập của Kế toán.** Chấp nhận: KT được **lập đề xuất** hoàn tiền (chuyển khoản) và bù khoản nhận trước vì thuộc xử lý công nợ (FRD §2 "Công nợ và giá vốn": KT = S); KT **không** ghi phiếu thu/phiếu chi tiền mặt và không duyệt (chênh lệch quỹ, hoàn tiền, chi). Hoàn tiền mặt chỉ do TN lập vì trừ sổ quỹ. Đề nghị thêm ghi chú này vào FRD §2.

**D-R2-4 – Thứ tự sửa đề nghị cho designer:** F5R2-01, 02, 03, 07 (cùng cơ chế khóa theo yêu cầu) rồi 04, 05, 06, rồi các Minor. Sau đó BA review lại chỉ các màn đã sửa.

## 5. Việc BA/tài liệu (không phải lỗi designer)

Giữ như `review-05-finance-invoice-ba.md` §5 (cập nhật FRD §13, FR-ACC-021..024, Journey §7/§8, `screen-inventory.md` §8.1 thêm G4-ACC-21), thêm: UAT "bấm hai lần chỉ một yêu cầu đảo", "mở lại ngày cần mật khẩu và MFA", "bù khoản nhận trước không vượt số dư"; ghi chú FRD §2 theo D-R2-3; câu hỏi workshop với kế toán của khách: ngưỡng chênh lệch quỹ, ngưỡng đối soát, cách xử lý hóa đơn gốc khi thay thế.

## 6. Tổng hợp

| Mức | Số lượng |
| --- | --- |
| Blocker | 0 |
| Major | 7 (F5R2-01 đến 07) |
| Minor | 10 (F5R2-08 đến 17) |
| Tổng còn mở | 17 |

**CHƯA ĐẠT — còn 17 finding (0 Blocker, 7 Major, 10 Minor).**
