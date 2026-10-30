# BA Review lần 3 (kiểm tra cuối) – Gói 5 "Tài chính và hóa đơn"

Phiên bản 0.1 · 30/10/2026 · BA · Đối tượng: `design/g4-finance/*` (32 màn, `pack.js` v0.3, `index.html`) và `docs/ui-ux/05-finance-invoice.md` v0.3 (§10b, §10c, §11). Đối chiếu `review-05-round2-ba.md`.

Cách làm: đọc mã thực (không tin bảng tự khai). Đã đọc `pack.js` phần ghép điều kiện nút (`refreshBtn`, `guardCheck`, `applyNet`, khóa gửi/`resetBtn`/`g4f:done`, `canApprove`, cờ KTT) và các màn: ACC-01, 03, 04, 05, 07, 09, 11, 13, 21; APR-01, 02, 03; EIN-01, 02, 03, 05, 06, 07, 08; kiểm bằng tìm kiếm toàn gói cho nút xác nhận (`data-confirm-btn`, `data-g4f-gate-btn`), khóa gửi (`data-lock` trỏ đúng id tồn tại), gán `disabled` thủ công, liên kết tới màn bị từ chối quyền. Không mở trình duyệt.

**KẾT LUẬN: ĐẠT — không còn Blocker/Major.** Còn 3 Minor (không chặn bàn giao, sửa trong lượt handoff) và một danh sách "Chuyển cho dev (không chặn)".

## 1. Cơ chế dùng chung (pack.js) – đã kiểm

- `refreshBtn` (pack.js:210-217) là AND của hợp lệ theo trang, biến thể, cổng xác nhận, NOT khóa vai trò, NOT mất mạng, NOT đã gửi.
- `applyNet` (pack.js:202-208) nay phủ cả `[data-g4f-online],[data-confirm-btn],[data-g4f-gate-btn]`: hộp thoại đang mở cũng bị khóa khi mất kết nối.
- `guardCheck` (pack.js:276-288) tính lại điều kiện của `app.js` (từ khóa, lý do ≥ 5) rồi ghép `data-g4f-req` và `data-g4f-pattern` (mật khẩu, MFA 6 số), chạy sau `app.js:164` bằng `setTimeout`, nên không bị ghi đè.
- Khóa gửi theo yêu cầu: `resetBtn` + sự kiện `g4f:done` (pack.js:258, 290); cờ KTT lưu `sessionStorage` (pack.js:343, 347).
- Mọi `data-lock` của các hộp thoại gửi yêu cầu đều trỏ tới id có thật (đã đối chiếu: btn-rev, btn-revpc, btn-reopen9, btn-reopen17, btn-finish, btn-lock, btn-mth, btn-map, btn-sv, btn-env, btn-iss, btn-rule, btn-match, btn-unm1, btn-lim, btn-cancel1).
- Không còn gán `disabled` thủ công cho nút ghi tiền/khóa; các chỗ còn lại là ô nhập hoặc checkbox (acc-01:230/238, apr-01:179, apr-03:92) và không ảnh hưởng kiểm soát tiền.

## 2. Kết quả theo finding còn mở

| Finding | Kết quả | Căn cứ trong mã |
| --- | --- | --- |
| F5-01 (APR-02 từ chối, giá trị trên nút) | **Đạt** | apr-02:90, 95 (submit + lock, "Duyệt X ₫"), apr-02:116-126 khóa cả ba nút sau quyết định, reset khi đổi loại |
| F5-03, F5-11, F5-22 (index) | **Đạt** | index.html:28 "CV không xem", :55 "AD không xem", :59/:63 "32 màn" |
| F5-05 | **Đạt** | acc-04:94-109: bật khi Loại, Số tiền ≤ quỹ, Người nhận ≥ 2, Diễn giải ≥ 5; cảnh báo in số thật (:100); xóa trắng và `resetBtn` khi mở phiếu mới |
| F5-07 | **Đạt** | `applyNet` phủ nút xác nhận; `guardCheck` không bị `app.js` đè |
| F5-09 | **Đạt** | acc-09:83, 89 và acc-17:51, 53: `data-g4f-req="#ro-p,#ro-m"` + mẫu `^\d{6}$`; acc-09:78-81 hộp thoại "Hoàn tất điều chỉnh" mức 3 |
| F5-16 | **Đạt** | acc-09:36-37 thêm chặn "đang xử lý dở" và cảnh báo "yêu cầu phê duyệt đang chờ" |
| F5-21 | **Đạt, còn 1 liên kết** | ein-01:15, 22, 46-47, 66 và ein-05:35, 46 đã gắn `data-g4f-roles`; còn EIN-07 (F5R3-03) |
| F5R2-01 chống gửi trùng mức 3 | **Đạt** | Tất cả nút xác nhận của acc-03/05/09/11/14/16/17/20, apr-02/03, ein-07/08 có `data-g4f-submit` + `data-lock`; acc-03:87 nhãn "Đang chờ duyệt đảo" khóa nút Đảo; acc-05 "Gửi duyệt" khóa `#btn-send5` |
| F5R2-02 | **Đạt** | như F5-09 |
| F5R2-03 APR-01 | **Đạt** | apr-01:142-148, 159-169: khóa theo yêu cầu (`DONE[curEl]`), cả ba nút, dòng chuyển sang "Đã xử lý", mở yêu cầu khác `resetBtn`; hộp thoại có giá trị/tổng; chuyển cấp bắt ghi chú (:104, 157) |
| F5R2-04 ACC-11 thu nợ | **Đạt** | acc-11:93-106: 0 < số ≤ dư nợ, mã giao dịch ≥ 3 ký tự với chuyển khoản, nhãn "Ghi nhận thu X ₫", reset khi mở, dư nợ giảm sau ghi |
| F5R2-05 | **Đạt** | như F5-05 |
| F5R2-06 | **Đạt** | apr-03:98-101 AD thấy "Gửi Chủ garage ban hành", CH "Ban hành" (mức 3); ein-08:62 quy tắc lập hóa đơn qua "Gửi duyệt" có cổng; ein-08:57 đơn vị phát hành qua duyệt |
| F5R2-07 ACC-21 | **Đạt** | acc-21:43-44 thẻ mobile có `data-g4f-need` + `data-g4f-online`; acc-21:72-76 giảm số dư, khóa khi hết, không bù lại; acc-21:35-37 "Hoàn lại" truyền khách/số tiền/phiếu nguồn sang ACC-07 biến thể `adv` (acc-07:92-101, số hoàn ≤ số dư, ẩn nhắc hóa đơn) |
| F5R2-08 | **Đạt** | acc-21:33-39 cột "Lệnh còn nợ" chỉ KT, QL, CH, QV; acc-03:65 chỉ KT, QL, CH, QV |
| F5R2-09 | **Đạt** | khóa mạng cho nút xác nhận; acc-03:99,135 "Lưu phân bổ" cần lý do ≥ 5, vai trò KT, mạng, khóa |
| F5R2-10 ACC-13 | **Đạt** | acc-13:28 có `data-g4f-online`; thông báo theo ngoại lệ hay vượt hạn mức (:75); sau gửi giảm còn nợ hoặc khóa dòng (:63-68) |
| F5R2-11 | **Đạt** | xem F5R2-03; bulk loại dòng "người lập = bạn" (apr-01:138, 179) |
| F5R2-12 | **Đạt** | acc-09:36-37, 97 (22:00) |
| F5R2-13 EIN | **Đạt** | ein-02:111-120 chặn phát hành khi MST thiếu/sai, thiếu tên/địa chỉ, checklist đổi theo; ein-03:78 email dùng `.pii`; ein-03:97, 109 "Gửi báo" cần ≥ 5 ký tự |
| F5R2-14 | **Đạt** | acc-10:15 và acc-12:15, 41 gắn quyền xuất |
| F5R2-15 dữ liệu mẫu | **Đạt một phần** | RO-…00118/00116, PT-…00934, 0000414 đã sửa; nhưng EIN-05 dùng RO-…00114 là lệnh đang có yêu cầu timeout (F5R3-01) |
| F5R2-16 ACC-01 | **Đạt** | acc-01:201-205 (mã giao dịch bắt buộc với hình thức không phải tiền mặt), 235-242 (badge cập nhật sau ghi, ô chỉ đọc theo vai trò) |
| F5R2-17 quyền lập của KT | **Đạt phía thiết kế** | acc-07:48 (TN KT), acc-21 (KT TN) đúng D-R2-3; việc còn lại là ghi chú FRD §2 do BA (xem mục 4) |

## 3. Finding mới (F5R3) – do chỉnh sửa gây ra hoặc bỏ sót

Không có Blocker, không có Major.

**F5R3-01 (Minor) – EIN-05 liệt kê lệnh đang có yêu cầu phát hành, trái quy tắc của chính màn.**
Vị trí: ein-05:36 (RO-Q7-2610-00114, "Chưa có yêu cầu phát hành", có nút "Phát hành") so với ein-01:47 và ein-06:28, 37 (cùng lệnh đang "Chờ truy vấn lại", timeout YH-…00233); ein-05:40 ghi lệnh có yêu cầu đang gửi/chờ truy vấn lại không nằm ở danh sách này (FR-EIN-009, FR-EIN-013). Do bản sửa F5R2-15 đổi RO-…00121 thành RO-…00114.
Tác động: mẫu dẫn tới phát hành lần hai cho lệnh đã có yêu cầu: đúng tình huống idempotent cần tránh; dễ làm UAT sai.
Cách sửa: đổi dòng ein-05:36 sang lệnh khác (ví dụ RO-…00121 như trước, kiểm lại ACC-03:60 không mâu thuẫn) hoặc bỏ dòng; giữ KPI "03" khớp.

**F5R3-02 (Minor) – Ủy quyền Quản lý vùng ở APR-03 chỉ là bảng tĩnh, chưa có điều khiển.**
Vị trí: apr-03:49-54 (bảng "Tắt (mặc định)", nút "Sửa ủy quyền" disabled; `edit()` ở apr-03:91-95 chỉ bật nút của "Ngoại lệ theo chi nhánh", không bật "Sửa ủy quyền", nên nút không bao giờ dùng được).
Tác động: quyết định §10c(5) và (6) chưa thể hiện bằng điều khiển; dev không có mẫu về ngày hiệu lực, ngày hết hạn, loại ủy quyền (ngày hay kỳ), nhật ký.
Cách sửa: trong chế độ chỉnh sửa (CH) bật công tắc theo nhóm chi nhánh và theo loại (mở lại ngày / mở lại kỳ), ngày hiệu lực, ngày hết hạn bắt buộc; lưu đi cùng hộp thoại "Ban hành" của APR-03; AD không thấy công tắc này. Chi tiết quy tắc ở câu 2 mục 4.

**F5R3-03 (Minor) – EIN-07 dẫn Quản trị hệ thống tới màn bị từ chối quyền.**
Vị trí: ein-07:47 (thẻ KPI "Hóa đơn lỗi" là liên kết) và ein-07:58 ("Mở hàng chờ"); EIN-06 không cho AD (F5-11). AD vào EIN-07 là vai trò chính của màn.
Cách sửa: với AD thay liên kết bằng số đếm không bấm được và dòng "Kế toán xử lý ở hàng chờ lỗi" (`data-g4f-roles` ẩn liên kết; thẻ không liên kết). Tương tự F5-21.

## 4. Trả lời hai câu hỏi mới của designer – BA đề xuất, chờ xác nhận

**Câu 1 – FRD §2: quyền lập của Kế toán.** **Có, ghi một dòng chú thích; không đổi ô nào của ma trận.** Ô "Thu tiền và sổ quỹ" của KT vẫn là X vì KT không ghi phiếu thu/chi tiền mặt tại quầy. Đề xuất lời ghi chú đặt dưới "Ghi chú" của FRD §2:

> "Kế toán lập được đề xuất hoàn tiền bằng chuyển khoản, bù khoản nhận trước vào lệnh của cùng khách, đề xuất chi và chi tiền cho nhà cung cấp (thuộc xử lý công nợ, hàng 'Công nợ và giá vốn' = S). Kế toán không ghi phiếu thu hay phiếu chi tiền mặt tại quầy, không duyệt hoàn tiền, chi hay chênh lệch quỹ. Hoàn tiền mặt chỉ do Thu ngân lập vì trừ sổ quỹ."

Lý do: khớp prototype hiện tại (acc-07:48, acc-21, acc-13, acc-05) mà không mở rộng quyền ghi sổ quỹ cho KT; tách nhiệm lập và duyệt giữ nguyên. Tôi không sửa FRD trong lượt này (chỉ ghi file review); khi chủ dự án xác nhận, BA cập nhật `functional-requirements.md` §2 và bảng truy vết FR-ACC-016, FR-ACC-022.

**Câu 2 – Ủy quyền Quản lý vùng duyệt mở lại ngày/kỳ: theo nhóm chi nhánh hay theo từng yêu cầu?** **Theo nhóm chi nhánh, mặc định tắt, là đủ cho Phase 1 đến 3; không làm ủy quyền theo từng yêu cầu.** Thêm bốn ràng buộc khi cấu hình ở APR-03:
1. Tách hai loại: "mở lại ngày" và "mở lại kỳ"; **mở lại kỳ mặc định không ủy quyền** (kỳ có thể đã kết xuất sang phần mềm kế toán).
2. Ngày hiệu lực và **ngày hết hạn bắt buộc** (tham số tối đa 90 ngày, minh họa); hết hạn ủy quyền tự tắt.
3. Mỗi lần Quản lý vùng duyệt theo ủy quyền: nhật ký ghi "duyệt theo ủy quyền của Chủ garage từ ngày …"; Chủ garage nhận thông báo; Quản lý vùng không duyệt yêu cầu do chính mình đề nghị.
4. Chỉ Chủ garage ban hành (mức 3); AD không sửa (F5R2-06).

Lý do: Chủ garage chọn duyệt thủ công từng lần chính là trạng thái "tắt"; ủy quyền từng yêu cầu chỉ là cách chuyển yêu cầu, đã có "Chuyển cấp" ở APR-02. Nếu sau pilot cần, thêm "Chủ garage chuyển yêu cầu này cho Quản lý vùng" (Could, ngoài Phase 1). Câu hỏi này còn `[Cần xác nhận]` với chủ garage: có muốn Quản lý vùng duyệt mở lại ngày hay không.

## 5. Chuyển cho dev (không chặn)

Điểm phụ thuộc trình duyệt, thiết bị hoặc stack; ghi vào handoff, không cần designer sửa prototype:
1. **Khóa theo yêu cầu, không theo nút.** Prototype dùng `data-g4f-keep-lock` nên một số nút ghi sau lần gửi đầu bị khóa vĩnh viễn trong phiên (ví dụ ACC-16 "Ghép" ở acc-16:55 không nhả cho cặp kế tiếp; ACC-04 `#ex-ok` khóa chính nó, acc-04:77). Dev khóa theo mã yêu cầu/mã phiếu và khóa phía máy chủ bằng khóa chống trùng (FR-EIN-013, RULE-010).
2. **Thời gian chờ giả lập 1300 ms** (pack.js:263): nếu mở lại hộp thoại giữa chừng, nhãn nút có thể bị ghi đè bởi lần hoàn tất cũ; ở bản thật dùng trạng thái từ máy chủ.
3. **Kiểm tra quyền và người lập ≠ người duyệt phải ở máy chủ**; `canApprove` và tên người dùng trong `pack.js` chỉ mô phỏng. Quyền theo cấp duyệt lấy từ APR-03, không viết cứng.
4. **Hạn mức, thuế suất, ngưỡng (LIM, BAL, 5.000.000, 500.000, 20.000, 50.000) trong script chỉ là minh họa**; bản thật đọc từ cấu hình có ngày hiệu lực (NFR-MNT-01).
5. **Cập nhật số tổng sau giao dịch** chưa đầy đủ ở prototype (ví dụ tổng "Tổng phải trả" ở acc-13:30, thẻ mobile ACC-21 sau khi bù, đếm "Chờ duyệt (7)" ở thanh trên). Bản thật tính lại từ dữ liệu.
6. **APR-03**: toast sau "Ban hành" của Chủ garage vẫn ghi "Đã gửi ban hành" (apr-03:77); đổi nhãn theo vai trò. Ngày hiệu lực của yêu cầu đang chờ giữ ngưỡng cũ cần quy tắc xử lý khi bản mới có hiệu lực giữa chừng.
7. **Lỗi cú pháp HTML nhỏ**: thiếu khoảng trắng giữa hai thuộc tính ở apr-02:63 (`data-open="dlg-escalate"data-vg`); trình duyệt vẫn đọc được nhưng nên sửa.
8. **Chưa kiểm trực quan** ở 1440/768/375 px, trình đọc màn hình, thiết bị cảm ứng và máy in (A5, nhiệt 80 mm, A4); popup Date Picker trong drawer có thể bị cắt cạnh (đã ghi ở `05-finance-invoice.md` §9).
9. **PII**: hành vi theo chính sách nằm ở `app.js` (`piiPolicy`); dev gọi API thật, giá trị đầy đủ chỉ tải sau khi Hiện và ghi nhật ký truy cập.
10. **Đa pháp nhân, ngân hàng và mẫu sao kê, nhà cung cấp hóa đơn, phương pháp giá vốn, hạn mức duyệt** vẫn `[Cần xác nhận]`; thiết kế để cấu hình, không hard-code.

## 6. Tổng hợp

| Mức | Số lượng |
| --- | --- |
| Blocker | 0 |
| Major | 0 |
| Minor | 3 (F5R3-01, 02, 03) |
| Tổng còn mở | 3 |

**ĐẠT — không còn Blocker/Major.** Điều kiện kèm theo: sửa 3 Minor ở lượt handoff và BA ghi chú FRD §2 theo mục 4 khi chủ dự án xác nhận.
