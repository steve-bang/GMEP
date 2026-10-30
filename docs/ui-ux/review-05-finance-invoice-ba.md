# BA Review – Gói 5 "Tài chính và hóa đơn" (G4-ACC, G4-APR, G4-EIN)

Phiên bản 0.1 · Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g4-finance/` (31 màn hình, `pack.css`, `pack.js`, `index.html`) và `docs/ui-ux/05-finance-invoice.md`. Trả lời 17 câu hỏi: `docs/ui-ux/ba-answers-05.md`.

Phạm vi và giới hạn: đọc mã HTML/CSS/JS và đối chiếu tài liệu; **không mở trình duyệt**, nên chưa kiểm được hiển thị thật ở 1440/768/375 px. Đã đọc kỹ ACC-01, 04, 07, 09, 13; EIN-02, 04, 07; APR-01; toàn bộ `pack.js`, `pack.css`; đã quét toàn gói bằng tìm kiếm cho hex màu, class, token, trạng thái, quyền. Các màn hình còn lại (ACC-02, 03, 05, 06, 08, 10 đến 12, 14 đến 20, APR-02, 03, EIN-01, 03, 05, 06, 08) được rà theo mẫu (trạng thái, nút, quyền) chứ chưa đọc từng dòng.

## 1. Tóm tắt

| Mức | Số lượng |
| --- | --- |
| Blocker | 0 |
| Major | 10 |
| Minor | 12 |
| Tổng | 22 |

Kết luận: gói **đạt về cấu trúc** (đủ 31 màn hình, không hex, không nút xóa chứng từ ghi sổ, ba mức xác nhận hầu hết nhất quán, hóa đơn có khóa chống trùng và quy trình timeout, EIN "Chưa kích hoạt" làm tốt). Các lỗi Major tập trung ở **kiểm soát tiền**: (1) vài xác nhận tiền chưa đủ mức 2 hoặc chưa khóa chống bấm đúp; (2) phân quyền duyệt rộng hơn FRD §2; (3) khóa mất kết nối bị script ghi đè; (4) hành động thực thi trực tiếp (bỏ ghép, hủy yêu cầu) không có khóa. Không có Blocker vì không vi phạm RULE-010/011 ở đường chính. Có thể cho designer đi tiếp sau khi sửa Major.

## 2. Kết quả đối chiếu theo hạng mục yêu cầu

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Đủ màn hình | Đạt | 31 tệp `g4-*.html` đúng mã (ACC 01 đến 20, APR 01 đến 03, EIN 01 đến 08); `index.html` có 31 liên kết |
| Token và class | Đạt (một phần) | Không có hex hay `background/color` hex trong HTML/CSS; các `style=` còn lại là `color:inherit` và kích thước. Mọi `var(--…)` trong `pack.css` có trong `design/assets/tokens.css` (đã đối chiếu các token ít gặp: `--color-warning-bg`, `--chart-series-1`, `--color-surface-selected`, `--radius-xs`, `--card-radius`, `--topbar-height`, `--color-brand-900`…). Mọi class `g4f-*` dùng trong HTML đều có định nghĩa trong `pack.css`. Chưa đối chiếu từng class của `components.css`; xem F5-21 |
| Badge luôn có chữ | Đạt | Mọi `badge`/`tag` đã thấy có chữ; điều kiện chốt có biểu tượng cộng chữ "Đạt/Chặn/Cảnh báo" |
| Bộ trạng thái Thanh toán/Hóa đơn (ba-decisions A.2) | Đạt, có ghi chú | Thanh toán: Thanh toán một phần (Info), Đã thanh toán (Success), Hoàn tiền (Neutral); Hóa đơn: Chưa xuất, Đã xuất, Điều chỉnh, Hủy (Thay thế có trong bộ lọc). Chỉ báo `sync` không là badge thứ 6 (đúng A.2). Còn ba điểm cần chỉnh theo câu 2 và 4: F5-12, F5-13, F5-18 |
| RULE-010 | Đạt | Không có nút "Xóa" cho chứng từ ghi sổ (các "Xóa" tìm thấy là "Xóa bộ lọc"/câu mô tả); ACC-02/04 có dòng bút toán đảo, phiếu bị đảo gạch ngang; hoàn tiền tạo phiếu chi hoàn |
| RULE-011 | Đạt | ACC-04 vượt hạn mức chuyển nút thành "Gửi duyệt" và ghi rõ chưa trừ quỹ; ACC-13 đẩy chi tiền vào đề xuất chi; ACC-05 khóa nút chi cho tới khi duyệt. Lỗi: F5-04 (dialog ACC-13 vẫn cho gửi số tiền sai) |
| Ba mức xác nhận | Đạt một phần | Mức 3 nhất quán (gõ mã, lý do, danger). Mức 2 thiếu ở F5-01, F5-05, F5-06 |
| Hóa đơn idempotent | Đạt | EIN-02: mã chống trùng, khóa nút khi gửi, timeout chỉ "Truy vấn trạng thái", không gửi lại; EIN-06 "Thử lại" = truy vấn trước. Tiểu lỗi mã hiển thị: F5-17 |
| Lớp tích hợp không phụ thuộc nhà cung cấp | Đạt | EIN-07/08 không có tên hay logo nhà cung cấp, nhật ký gọi không lộ khóa; ánh xạ trạng thái nên là cấu hình (ba-answers-05 câu 2) |
| EIN "Chưa kích hoạt" | Đạt | EIN-07 mặc định "Chưa kích hoạt" nêu rõ làm được/không, 5 bước kích hoạt; EIN-02 và EIN-01 có biến thể; Zalo/SMS "Chưa kích hoạt" |
| Lưu XML/PDF | Đạt | EIN-03 có PDF, XML, mở lại từ lệnh gốc; in A4 là mẫu tham khảo (G2-PRT) |
| Quyền theo vai trò (FRD §2) | Chưa đạt toàn bộ | F5-02, F5-03, F5-11 |
| Che dữ liệu cá nhân | Đạt, có ghi chú | SĐT/email dùng `.pii` có hộp thoại lý do cho KT (ACC-11, EIN-03). Prototype dùng chung hộp thoại lý do cho mọi vai trò, không áp bảng quyền của ba-decisions câu 8 (CV, QL, TN thấy đầy đủ); chỉ là mô phỏng nhưng cần ghi rõ ở handoff (F5-14) |
| Loading/empty/error/no-permission/mất kết nối | Đạt, có thiếu sót nhỏ | Mọi màn hình có data/loading/error/denied và nút "Thử: mất kết nối"; list có empty/filtered. Thiếu ở F5-19 |
| Phạm vi kế toán vận hành | Đạt | Không có báo cáo tài chính hay khai thuế. ACC-14/15 gắn "lãi gộp quản trị, không phải lợi nhuận sau thuế"; ACC-18 kết xuất sang phần mềm kế toán. ACC-20 (sơ đồ tài khoản, kiểm tra Nợ = Có) và ACC-17/18 nằm ở ranh giới nhưng là cấu hình định khoản tự động theo FR-ACC-010; cần giữ ghi chú "không thay phần mềm kế toán" |
| Responsive bảng rộng | Đạt về mã, chưa kiểm thị giác | Bảng nằm trong `table-scroll`; card list dưới 640 px (ACC-02, 06, 10, 12, APR-01); `g4f-two` về một cột dưới 1280 px; `g4f-flow` thu về 2 rồi 1 cột. Chưa xem trực quan (cần thử 1440/768/375) |

## 3. Finding

Quy ước mức: **Blocker** = chặn bàn giao cho dev hoặc vi phạm RULE; **Major** = sai nghiệp vụ/quyền/kiểm soát tiền, phải sửa trước handoff; **Minor** = nhất quán, rõ ràng, tài liệu.

### Major

**F5-01 (Major) – Duyệt trong drawer APR-01 và duyệt hàng loạt thiếu xác nhận mức 2, khóa chống bấm đúp; "Từ chối" không bắt lý do.**
Vị trí: `g4-apr-01.html:85` (ô lý do ghi "bắt buộc khi từ chối" nhưng không kiểm tra), `:87` (nút Từ chối/Chuyển cấp/Duyệt chỉ `data-close data-toast`), `:92` (nút "Duyệt" hàng loạt không có `data-g4f-submit`). `05-finance-invoice.md` §4.8 xếp "duyệt" ở mức 2.
Tác động: duyệt khoản tiền (hoàn tiền, chi vượt hạn mức) chỉ bằng một cú bấm, bấm đúp có thể tạo hai lần ghi nhật ký/thực thi.
Cách sửa: dùng cùng mẫu xác nhận tiền của APR-02 (tóm tắt đối tượng và số tiền, ô tích đã đọc, `data-g4f-submit` + trạng thái đang xử lý/đã xử lý); "Từ chối" bắt lý do ≥ 5 ký tự (nút disabled cho tới khi nhập); chặn bấm lại sau khi đã xử lý.

**F5-02 (Major) – Phân quyền duyệt rộng hơn FRD §2 và không có kiểm soát "người lập ≠ người duyệt".**
Vị trí: `g4-apr-01.html:36`, `:87` (`data-g4f-need="QL CH QV KT"` cho mọi loại); `g4-apr-02.html` (cùng mẫu); dòng 48 (yêu cầu của Đặng Thu Hà, KT) trong khi người dùng mô phỏng cũng là Đặng Thu Hà (`pack.js:81`).
Đối chiếu: FRD §2 "Thu tiền và sổ quỹ": KT = X (chỉ xem), QL = D; Journey §7: chênh lệch quỹ, giảm giá, hủy lệnh do QL duyệt; hóa đơn điều chỉnh do Kế toán trưởng (cờ quyền); mở lại ngày/kỳ do Chủ garage. KT hiện duyệt được hoàn tiền, chi vượt hạn mức, chênh lệch quỹ.
Cách sửa: nút Duyệt/Từ chối theo **cặp (loại yêu cầu, vai trò/cờ)** lấy từ cấu hình G4-APR-03: KT chỉ duyệt hóa đơn khi có cờ Kế toán trưởng; CH/QV/QL theo cấp hạn mức. Người lập yêu cầu bị khóa nút duyệt kèm lý do "Bạn là người đề xuất". Áp dụng cả bulk (ba-answers-05 câu 8, 12).

**F5-03 (Major) – G4-ACC-11 cho Cố vấn dịch vụ xem sổ công nợ khách, trái FRD §2.**
Vị trí: `g4-acc-11.html:83` (`allow` có `CV`); `05-finance-invoice.md` §2 (ACC-11 "CV … (X)") và §4.9 ("CV: xem … công nợ khách"); subnav `pack.js:23` cho CV vào "Công nợ".
Đối chiếu: FRD §2 dòng "Công nợ và giá vốn": CV = "-".
Cách sửa: bỏ CV khỏi `allow` của ACC-10/11 và subnav; CV chỉ thấy **số dư, hạn mức, cảnh báo** trên hồ sơ khách và trên lệnh (FR-ACC-020, FR-CRM-018; ba-answers-05 câu 9). Sửa §2 và §4.9 của tài liệu gói 5.

**F5-04 (Major) – Hộp thoại chi tiền nhà cung cấp cho gửi số tiền sai và nhãn nút không đổi theo số tiền.**
Vị trí: `g4-acc-13.html:46` (nút "Gửi đề xuất chi" luôn như vậy), `:61` (script chỉ gán `data-bad`, không có nơi nào đọc; `py-ok` vẫn bật khi ô tích đã chọn dù `v > MAX` hoặc `v = 0`).
Tác động: có thể gửi đề xuất chi vượt số còn nợ của phiếu nhập; trong khi tiêu đề hộp thoại là "Chi tiền cho phiếu nhập".
Cách sửa: nút phải disabled khi số tiền không hợp lệ (lỗi nêu cách sửa, `aria-invalid`); nhãn theo hạn mức: dưới hạn mức "Chi tiền X ₫" (xác nhận mức 2), vượt hạn mức "Gửi đề xuất chi". Hạn mức lấy từ cấu hình, không viết cứng `5000000` trong script (đã có nhãn "minh họa", giữ). Thêm "Chi kèm ngoại lệ" khi đối chiếu 3 bên chênh lệch (câu 6).

**F5-05 (Major) – Phiếu chi tiền mặt ở sổ quỹ (ACC-04) không có xác nhận mức 2.**
Vị trí: `g4-acc-04.html:63` (`role="dialog"`, không phải `alertdialog`), `:75` (nút "Chi tiền" ghi thẳng, không ô tích đã đối chiếu, số tiền không nằm trên nút; khóa dùng nút ẩn `ex-ok-lock` nên nút gốc không bị khóa).
Đối chiếu: §4.8 của tài liệu gói 5 xếp chi tiền ở mức 2; FR-ACC-003, RULE-007 (chứng từ gốc).
Cách sửa: dùng `data-g4f-gate` giống ACC-13 (tóm tắt người nhận, loại chi phí, số tiền, ô tích), nút ghi "Chi tiền 180.000 ₫", khóa chính nút bằng `data-lock` trỏ tới nút thật, đặt lại form sau khi ghi để không tạo phiếu thứ hai từ cùng dữ liệu.

**F5-06 (Major) – "Ghi nhận tiền cọc" ghi thẳng, không xác nhận, không khóa, không kiểm tra.**
Vị trí: `g4-acc-01.html:163` đến `:170` (dialog cọc: `role="dialog"`, nút `data-close data-toast`, không kiểm tra số tiền > 0, không ô tích đối chiếu).
Đối chiếu: FR-ACC-002 (cọc là tiền thật, hoàn cọc phải có phiếu chi), §4.8 mức 2.
Cách sửa: dùng cùng mẫu xác nhận tiền với "Ghi nhận thanh toán" (tóm tắt, ô tích, khóa chống bấm đúp, trạng thái "Đang ghi nhận…"), kiểm tra số tiền > 0, số phiếu cọc (PT-…) hiện sau khi ghi.

**F5-07 (Major) – Khóa "mất kết nối" bị script màn hình ghi đè, nút ghi tiền có thể bật lại khi đang offline.**
Vị trí: `g4-acc-01.html:197` (`btn.disabled = bad || btn.hasAttribute('data-g4f-keep')`), `g4-acc-07.html:76`, `g4-acc-04.html:96–97` (`ok.disabled = v === 0`). Các script này chạy mỗi lần nhập và không xét `data-g4f-net` do `pack.js:205` đặt.
Đối chiếu: yêu cầu của gói và NFR-OFF-01: khi mất kết nối, khóa ghi tiền/hóa đơn, giữ nháp.
Cách sửa: thêm một hàm dùng chung trong `pack.js` (ví dụ `G4F.setEnabled(btn, ok)`) tôn trọng ba cờ khóa (vai trò, mạng, chống bấm đúp), mọi màn hình dùng hàm này thay cho gán `disabled`. Khi dev hiện thực, ghi vào handoff rằng ba cờ khóa là điều kiện AND.

**F5-08 (Major) – Hai thao tác thực thi trực tiếp (không phải gửi duyệt) không có khóa chống bấm đúp.**
Vị trí: `g4-acc-16.html:60` ("Bỏ ghép" – `data-confirm-btn data-close data-toast`), `g4-ein-06.html:48` ("Hủy yêu cầu" phát hành – cùng mẫu).
Tác động: bấm nhiều lần/timeout có thể ghi hai lần nhật ký hoặc hai lần hủy; "Hủy yêu cầu phát hành" còn liên quan truy vấn lần cuối để không hủy hóa đơn đã được tạo bên nhà cung cấp.
Cách sửa: thêm `data-g4f-submit` + trạng thái đang xử lý; EIN-06 hiển thị rõ bước "Truy vấn trạng thái lần cuối trước khi hủy" và chỉ cho hủy khi nhà cung cấp trả "chưa có hóa đơn".

**F5-09 (Major) – ACC-09 cho Chủ garage mở lại ngày trực tiếp, không có đường "Đề nghị mở lại" cho Kế toán/Quản lý, không có thời hạn.**
Vị trí: `g4-acc-09.html:15` (`data-g4f-need="CH"`), `:81` (nút "Mở lại ngày" thực thi và toast "Đã mở lại"); trong khi `g4-acc-17.html:52` và `g4-apr-01.html:51` đúng quy trình "Gửi đề nghị → Chủ garage duyệt".
Đối chiếu: Journey §7 (Kế toán đề xuất, Chủ garage duyệt), FR-ACC-005; ba-answers-05 câu 10.
Cách sửa: ACC-09 theo cùng mẫu ACC-17: QL/KT thấy nút "Đề nghị mở lại" (lý do + xác thực lại) → yêu cầu `YC-…` vào APR-01; CH duyệt ở APR-02. Hiển thị thời hạn mở và đếm lùi tự khóa lại.

**F5-10 (Major) – Chưa có nơi xem và xử lý "khoản nhận trước" của khách.**
Vị trí: `05-finance-invoice.md` §9 (tự nhận chưa làm); `g4-acc-01.html` thu vượt chỉ ghi "để trừ vào lệnh sau".
Tác động: khoản phải trả khách nằm trong sổ nhưng không thấy ở đâu để bù trừ hay hoàn; số dư công nợ khách (ACC-11) không giải thích được.
Cách sửa: theo ba-answers-05 câu 5: chip "Khách có khoản nhận trước" ở ACC-01, dòng ở ACC-03/11, thêm màn **G4-ACC-21 Khoản nhận trước** (Phase 2) và FR-ACC-022. Trong Phase 1 chỉ cần hiển thị chip và hoàn lại qua ACC-07.

### Minor

**F5-11 (Minor) – G4-EIN-06 cho Quản trị hệ thống xem hàng chờ hóa đơn lỗi (có dữ liệu người mua).**
Vị trí: `g4-ein-06.html:53` (`allow` có `AD`). Đối chiếu FRD §2 ghi chú AD (không xem dữ liệu nghiệp vụ nhạy cảm của khách), NFR-SEC-03; ghi chú trong bảng gói "AD (X)".
Cách sửa: AD chỉ thấy mã yêu cầu, mã lỗi, thời điểm; tên người mua, MST, địa chỉ bị che; hoặc bỏ AD khỏi `allow` và để EIN-07 làm nơi chẩn đoán (nhật ký gọi đã không lộ dữ liệu). Cần kiểm lại nội dung dòng trong bảng EIN-06 khi sửa.

**F5-12 (Minor) – Badge Thanh toán ở ACC-01 đổi trước khi ghi nhận.**
Vị trí: `g4-acc-01.html:190–193` (`pay-badge` đổi sang "Đã thanh toán" theo số đang nhập). Badge nên phản ánh trạng thái **hiện tại** của đối tượng; trạng thái dự kiến nên là dòng chữ ở khối tóm tắt (đã có `after-note`).
Cách sửa: giữ badge nguyên cho tới sau xác nhận; hiển thị "Sau khi ghi: Đã thanh toán (dự kiến)" ở khối tóm tắt dưới dạng chữ/tag, không dùng badge.

**F5-13 (Minor) – Hoàn tiền một phần chưa hiển thị trạng thái và tag.**
Vị trí: `g4-acc-07.html:43` (chỉ nói "Hoàn tiền" khi hoàn toàn bộ), khối "Sau khi hoàn" không hiện badge dự kiến.
Cách sửa: theo ba-answers-05 câu 4: bảng điều kiện thu ròng/tổng phải thu và tag "Đã hoàn một phần X ₫"; thêm biến thể "hoàn một phần" vào thanh xem thử ACC-07, ACC-01, ACC-03.

**F5-14 (Minor) – Che dữ liệu cá nhân: mô phỏng chưa theo bảng quyền; chưa nêu rõ ở handoff.**
Vị trí: `pack.js:160` (hộp thoại lý do dùng cho mọi vai trò), `g4-ein-03.html:73`, `g4-acc-11.html:27`. ba-decisions câu 8: CV, QL, TN thấy đầy đủ (không cần Hiện), CH/QV không cần lý do, KT cần lý do, TH/TK không thấy.
Cách sửa: ghi vào §9 của tài liệu gói 5 rằng prototype chỉ minh họa hành vi KT; hoặc làm nút Hiện đổi theo vai trò. Giá trị đầy đủ phải được tải về chỉ sau khi Hiện (không có trong HTML).

**F5-15 (Minor) – Dữ liệu mẫu mâu thuẫn: PC-Q7-2610-00041.**
Vị trí: `g4-acc-04.html:44` ("chứng từ HĐ bán lẻ" – đã có chứng từ) và `g4-acc-09.html:36` ("chưa đính kèm ảnh hóa đơn", cảnh báo thiếu chứng từ gốc).
Cách sửa: thống nhất một trạng thái (đề xuất: ACC-04 ghi "Thiếu chứng từ gốc" kèm tag cảnh báo, để mạch ACC-04 → ACC-09 nhất quán).

**F5-16 (Minor) – Điều kiện chặn khóa ngày cần khớp quyết định BA.**
Vị trí: `g4-acc-09.html:22`, `:31`, `:38` (chỉ chênh lệch quỹ chặn; ghi "cho tới khi BA/khách xác nhận"). Đã có trả lời: ba-answers-05 câu 1.
Cách sửa: thêm điều kiện chặn "còn ca chưa chốt"; nhãn "Chặn/Cảnh báo" đọc từ cấu hình; bỏ câu "cho tới khi BA/khách xác nhận" khỏi giao diện; đổi thông báo thành "Chênh lệch vượt ngưỡng chưa được Quản lý duyệt".

**F5-17 (Minor) – Mã yêu cầu và mã chống trùng chưa theo quy ước.**
Vị trí: `g4-ein-07.html:66–68` (`YC-EIN-00230`), `g4-ein-02.html:74` (mã chống trùng `IDEM-…` hiện cho Thu ngân).
Cách sửa: `YH-Q7-2610-00230` theo ba-answers-05 câu 16; đưa mã chống trùng vào phần "Chi tiết kỹ thuật" thu gọn, chỉ Kế toán/Quản trị thấy.

**F5-18 (Minor) – Hóa đơn gốc sau điều chỉnh/thay thế: cần tag "Đã được điều chỉnh bởi…/Bị thay thế bởi…".**
Vị trí: `g4-ein-01.html:48–50`, `g4-ein-03.html:32` (chỉ có tag "Chờ duyệt thay thế").
Cách sửa: theo câu 2: bổ sung tag cho trạng thái sau xác nhận; hóa đơn bị thay thế gạch ngang (`g4f-invoice.is-void` đã có) nhưng không dùng badge "Hủy". Ghi `[Cần kế toán xác nhận]` cho cách hiển thị từng trường hợp.

**F5-19 (Minor) – Thiếu trạng thái empty/filtered cho báo cáo và danh sách một số màn hình.**
Vị trí: `g4-acc-15.html:53`, `g4-acc-14.html` đã có; thiếu empty ở `g4-acc-17`, `g4-acc-18` là hợp lý (màn đơn), nhưng ACC-15 (báo cáo) cần "chưa có dữ liệu trong khoảng thời gian" và "Số tạm/chưa có ngày nào khóa"; ACC-13 (danh sách phiếu nhập còn nợ) cần empty "Nhà cung cấp không còn nợ".
Cách sửa: thêm `empty`/`filtered` vào `states` cho các màn hình dạng danh sách/báo cáo này.

**F5-20 (Minor) – Duyệt hàng loạt cho chọn khác loại, trong khi hộp thoại nói "cùng loại".**
Vị trí: `g4-apr-01.html:45–46` (giảm giá và chênh lệch quỹ cùng có ô chọn) và `:91` ("Chỉ gồm mục cùng loại").
Cách sửa: theo câu 8: khi đã chọn một loại thì ô chọn của loại khác bị khóa kèm chữ lý do, hoặc cho khác loại nhưng sửa câu mô tả; khuyến nghị cách đầu.

**F5-21 (Minor) – Liên kết dẫn tới màn hình bị từ chối quyền; một số class component chưa đối chiếu.**
Vị trí: `g4-acc-09.html:32` ("Xem" → ACC-08 chỉ cho TN, QL: `g4-acc-08.html:99`); KT/CH/QV bấm vào thấy "Không có quyền". Chưa đối chiếu với `components.css` các class chuẩn (`kpi`, `record`, `table--compact`, `impact-list`, `datepicker`…) vì file nằm ngoài phạm vi review này.
Cách sửa: cho KT, CH, QV xem ACC-08 ở chế độ chỉ đọc (FRD §2: KT, CH, QV = X trên Thu tiền và sổ quỹ), hoặc ẩn liên kết theo vai trò. Designer tự grep class dùng trong gói so với `components.css` trước handoff.

**F5-22 (Minor) – Tài liệu `05-finance-invoice.md` cần cập nhật theo quyết định BA.**
Vị trí: §4.9 (quyền CV), §7 mục 6 (mã `YC-EIN-`), §7 mục 8 (đã có câu trả lời), §8 (17 câu đã trả lời trong `ba-answers-05.md`), §2 ACC-11 (CV), §5 (thiếu ánh xạ RULE-007 cho ACC-04 phiếu chi, FR-SYS-013 xuất cho ACC-10/12/EIN-01, FR-REC-028 cho trạng thái riêng). Số liệu tự đánh giá "31/31" đúng.
Cách sửa: designer cập nhật các mục này, đổi tiêu đề §8 thành "Câu hỏi đã được BA trả lời (xem ba-answers-05.md)".

## 4. Điểm tích cực cần giữ

- Mạch phòng ngừa lỗi tiền rõ: thanh ghi nhận có số tiền ngay trên nút (ACC-01), trạng thái đang ghi/đã ghi, lý do khóa hiện sẵn (không chỉ tooltip), xác nhận mức 3 có danh sách hậu quả.
- EIN-02 xử lý đúng idempotent: kiểm điều kiện trước (FR-EIN-011), nút khóa, timeout không gửi lại, trạng thái "đã có hóa đơn" khóa nút.
- Chỉ báo `sync` tách khỏi badge trạng thái hóa đơn (đúng ba-decisions A.2).
- EIN-07 "Chưa kích hoạt" mô tả rõ phạm vi ảnh hưởng và không phụ thuộc nhà cung cấp.
- Số hạn mức, thuế suất, mốc tuổi nợ đều gắn nhãn "minh họa/cấu hình" (khớp D-11, câu 14 của ba-decisions); BA đề nghị giữ nhãn này tới khi khách chốt.
- Biểu đồ tuổi nợ có bảng thay thế và nhãn chữ (không chỉ dựa vào màu).

## 5. Việc BA/tài liệu cần làm tiếp (không phải lỗi của designer)

1. Cập nhật FRD §13 theo `ba-answers-05.md` (Phase 1 thêm ACC-001/002/003/004, phần khóa ngày của ACC-005, ACC-009, phần hiển thị liên kết của ACC-019, EIN-007/009/010; mở rộng FR-SYS-004; thêm FR-ACC-021 đến 024, FR-EIN bổ sung hiển thị hóa đơn gốc/mới); cập nhật ma trận truy vết và UAT.
2. Cập nhật Journey §7 (bộ nhãn hóa đơn gốc/mới, ma trận phê duyệt gồm hoàn tiền/chi/hủy/hóa đơn/mở lại) và §8 (thu vượt, hoàn tiền một phần).
3. Cập nhật `screen-inventory.md` §8.1 (G4-ACC-21), D-14 và G-01 đã có câu trả lời.
4. Đưa các câu `[Cần xác nhận]` còn mở (nhà cung cấp, thời điểm lập hóa đơn, cọc, "khách không lấy hóa đơn", giá vốn, hạn mức) vào workshop với kế toán của khách.
5. Review lại khi designer sửa Major (đặc biệt F5-01, F5-02, F5-07).
