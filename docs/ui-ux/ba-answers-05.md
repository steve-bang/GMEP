# BA – Trả lời 17 câu hỏi của Gói 5 "Tài chính và hóa đơn" (`05-finance-invoice.md` §8)

Phiên bản 0.1 · Ngày 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để đi tiếp).

Nguyên tắc áp dụng: nghiệp vụ trong BRD/FRD/Journey thắng; hình thức giao diện theo `design-system.md`. Mục `[Cần xác nhận]` lớn (nhà cung cấp hóa đơn, phương pháp giá vốn, hạn mức, thời điểm lập hóa đơn và xử lý cọc theo Nghị định 254/2026) **không bị chốt**: thiết kế theo hướng cấu hình có ngày hiệu lực, giá trị mặc định ghi rõ bên dưới chỉ là mặc định khởi tạo. Các con số (ngưỡng, số giờ, số ký tự) là tham số minh họa, không phải quy tắc nghiệp vụ. Mọi chỗ nêu luật cụ thể (Nghị định 254/2026, Thông tư 91/2026, 99/2025) đều cần kế toán của khách xác nhận trước khi hiện thực.

Cách đọc: mỗi câu có Quyết định, Lý do, Căn cứ, Tác động (màn hình/tài liệu cần đổi).

---

## Câu 1 – Điều kiện chặn khóa ngày và khóa kỳ

**Quyết định.** Phân hai nhóm, cả hai là cấu hình theo chi nhánh (ghi trong G4-ACC-09 và cấu hình hệ thống), có ngày hiệu lực:

| Nhóm | Điều kiện | Mặc định |
| --- | --- | --- |
| **Chặn khóa ngày** | (a) Còn chênh lệch quỹ chưa giải trình; (b) còn chênh lệch vượt ngưỡng đã giải trình nhưng chưa được Quản lý chi nhánh duyệt; (c) còn ca chưa chốt trong ngày (tiền chưa đếm, chưa bàn giao); (d) còn thanh toán/phiếu chi ở trạng thái đang xử lý dở (nháp ghi tiền, "Đang ghi nhận") | Chặn |
| **Cảnh báo (không chặn)** | Lệnh còn mở; lệnh hoàn tất chưa thu tiền (hiện số tiền công nợ); lệnh hoàn tất chưa có hóa đơn; phiếu chi thiếu chứng từ gốc; yêu cầu phê duyệt đang chờ | Cảnh báo, chuyển thành "Chặn" được bằng cấu hình |

Chênh lệch quỹ **trong ngưỡng cho phép** (ngưỡng cấu hình): chỉ cần giải trình, không cần duyệt, không chặn.

**Khóa kỳ (G4-ACC-17), mặc định chặn:** còn ngày chưa khóa trong kỳ; còn yêu cầu phê duyệt tài chính đang chờ trong kỳ; kỳ trước chưa khóa (khóa theo thứ tự). **Cảnh báo:** giao dịch ngân hàng chưa đối soát; phiếu thiếu chứng từ gốc; hóa đơn lỗi chưa xử lý trong kỳ.

**Lý do.** FR-ACC-004 và UAT-07 chỉ bắt buộc chênh lệch quỹ; Journey bước chốt ngày (mục "Luồng chốt ngày tại chi nhánh", bước 3) yêu cầu chênh lệch vượt hạn mức phải có duyệt của quản lý chi nhánh nên (b) là hệ quả. Lệnh còn mở là chuyện bình thường của garage (xe nằm xưởng qua đêm) nên không chặn. Chưa thu tiền hoặc chưa hóa đơn là rủi ro cần nhìn thấy nhưng có thể do chính sách công nợ hoặc hóa đơn phát hành bù; chặn cứng sẽ buộc chi nhánh khai khống hoặc mở lại ngày liên tục.

**Căn cứ.** FR-ACC-004, FR-ACC-005, UAT-07, BR-ACC-05, RULE-010; Journey §7 (chênh lệch quỹ: Thu ngân đề xuất, Quản lý duyệt), luồng chốt ngày; FR-EIN-009.

**Tác động.** G4-ACC-09, G4-ACC-17 (đổi nhãn "Chặn/Cảnh báo" theo cấu hình, thêm mục (c)); FRD: FR-ACC-004 bổ sung, đề xuất FR-ACC-023 (§ cuối file); BRD: ghi vào phần câu hỏi mở "điều kiện khóa ngày" là đã có đề xuất.

---

## Câu 2 – Trạng thái "Điều chỉnh", "Thay thế" gán cho hóa đơn gốc hay mới

**Quyết định.** Giữ nguyên bộ 5 trạng thái của đối tượng Hóa đơn (Chưa xuất, Đã xuất, Điều chỉnh, Thay thế, Hủy; ba-decisions A.2). Gán theo **loại chứng từ**:

- **Hóa đơn mới** mang badge theo loại: "Điều chỉnh" hoặc "Thay thế" (Info), có liên kết "thay/điều chỉnh cho hóa đơn gốc số …".
- **Hóa đơn gốc** không đổi badge thành "Điều chỉnh/Thay thế". Hiển thị bằng **tag** cạnh badge: khi đang chờ duyệt "Chờ duyệt điều chỉnh/thay thế"; sau khi nhà cung cấp/cơ quan thuế xác nhận: "Đã được điều chỉnh bởi số …" (gốc vẫn "Đã xuất") hoặc "Bị thay thế bởi số …" (gốc hết hiệu lực, hiển thị gạch ngang, không mở lại để sửa).
- Badge **"Hủy"** chỉ dùng khi hóa đơn bị hủy theo thao tác Hủy; hóa đơn gốc bị thay thế **không** tự chuyển sang "Hủy".
- Trên lệnh, mục Hóa đơn hiển thị trạng thái của **hóa đơn đang có hiệu lực mới nhất**; xem được đủ các phiên bản theo thứ tự (FR-EIN-007).
- Cách ánh xạ từ trạng thái của nhà cung cấp sang bộ 5 trạng thái là **bảng cấu hình trong lớp tích hợp** (không viết cứng theo một nhà cung cấp); trạng thái đồng bộ (đang gửi, lỗi phát hành, chờ truy vấn) vẫn là chỉ báo `sync`, không là badge thứ 6.

**Lý do.** Journey §7 ghi trạng thái hóa đơn lấy từ nhà cung cấp; nếu đổi badge của hóa đơn gốc thì mất thông tin "gốc đã xuất hợp lệ" trong lúc chờ duyệt, và lệnh sẽ hiện sai khi phiên bản mới bị cơ quan thuế từ chối. Cách xử lý hiệu lực của hóa đơn gốc sau điều chỉnh/thay thế (và mọi trường hợp lập sai) theo Thông tư 91/2026 cần kế toán của khách xác nhận từng trường hợp (FR-EIN-007) nên đặt trong bảng cấu hình ánh xạ.

**Căn cứ.** FR-EIN-005, FR-EIN-007, FR-EIN-004, Journey §7 dòng Hóa đơn, ba-decisions A.2, UAT-08.

**Tác động.** G4-EIN-01/03/04 (thêm tag "Đã được điều chỉnh bởi…", "Bị thay thế bởi…"); Journey §7 ghi chú rõ; FRD FR-EIN-007 bổ sung tiêu chí; thêm UAT hóa đơn gốc/mới.

---

## Câu 3 – Quy tắc "khách không lấy hóa đơn", thời điểm lập hóa đơn, xử lý tiền cọc

**Quyết định.** **Không chốt thay khách.** Giữ `[Cần xác nhận]` FR-EIN-009 và FR-EIN-012; thiết kế là cấu hình trong G4-EIN-08, có ngày hiệu lực, theo pháp nhân hoặc chi nhánh:

- Thời điểm lập hóa đơn: danh sách lựa chọn (khi bàn giao xe, khi thu đủ tiền, khi lệnh hoàn tất, theo kỳ). Giá trị khởi tạo "Chưa chốt"; khi "Chưa chốt" thì hệ thống chỉ phát hành thủ công từ G4-EIN-02 và không tự gợi ý.
- Tiền cọc: lựa chọn (chỉ ghi phiếu thu cọc, không lập hóa đơn; hoặc lập theo cấu hình kế toán). Giá trị khởi tạo "Chưa chốt"; cọc luôn hiện trên lệnh và trừ vào thanh toán cuối (FR-ACC-002).
- "Khách không lấy hóa đơn": nút "Đánh dấu khách không lấy hóa đơn" ở G4-EIN-05 **khóa kèm lý do "Quy tắc chưa được kế toán xác nhận"** cho tới khi bật cấu hình. Khi bật: bắt buộc lý do, kế toán duyệt, ghi nhật ký, lệnh ra khỏi danh sách cảnh báo nhưng vẫn đếm riêng trên báo cáo đối chiếu (FR-RPT-004) để không bị che mất.

**Lý do.** Nghị định 254/2026 mới có hiệu lực 1/7/2026; BRD/Journey đã nêu hai tình huống cần kế toán quyết (cọc, thuế suất qua 1/1/2027). Sai quy tắc có rủi ro thuế nên không đoán.

**Căn cứ.** FR-EIN-009, FR-EIN-012, FR-ACC-002, FR-ACC-009, BRD §7 pháp lý, Journey §8 (đoạn "Hai tình huống cần kế toán của khách quyết định trước…").

**Tác động.** G4-EIN-02/05/08: giữ hiện tại, thêm nhãn "[Cần xác nhận]" kèm người xác nhận; thêm câu hỏi workshop kế toán vào Discovery.

---

## Câu 4 – Hoàn tiền một phần hiển thị trạng thái Thanh toán nào

**Quyết định.** **Không thêm trạng thái.** Trạng thái Thanh toán tính từ hai số: tổng phải thu hiện hành của lệnh và số **thu ròng** (tổng thu trừ tổng hoàn):

| Điều kiện | Badge Thanh toán |
| --- | --- |
| Thu ròng = 0 và đã từng có hoàn tiền toàn bộ | **Hoàn tiền** (Neutral) |
| 0 < thu ròng < tổng phải thu | **Thanh toán một phần** (Info) |
| Thu ròng ≥ tổng phải thu (sau khi giảm tổng do hủy hạng mục, nếu có) | **Đã thanh toán** (Success) |
| Thu ròng = 0, chưa từng thu | **Chưa thanh toán** (Warning) |

Hoàn **một phần** luôn kèm **tag** "Đã hoàn một phần 1.250.000 ₫" (Neutral) cạnh badge, bấm vào xem phiếu chi hoàn. Hoàn tiền không bao giờ sửa phiếu thu gốc.

**Lý do.** Giữ đúng bộ trạng thái đã chốt (ba-decisions A.2) và tránh thêm nhãn mới làm bùng nổ tổ hợp; tag đủ để phân biệt "đã trả đủ rồi hoàn một phần vì hủy hạng mục" với "chưa trả đủ". Journey §8: "trạng thái thanh toán đổi từ chưa thu sang thu một phần rồi đã thu đủ".

**Căn cứ.** FR-ACC-016, BR-ACC-11, RULE-010, Journey §7 (Thanh toán: chưa thu, thu một phần, đã thu đủ, hoàn tiền) và §8.

**Tác động.** G4-ACC-07 (cập nhật khối "Sau khi hoàn": hiển thị badge dự kiến và tag), G4-ACC-01/03; UAT hoàn tiền một phần mới.

---

## Câu 5 – Thu vượt: khoản nhận trước trả lại khách hay bù vào lệnh sau, hiển thị ở đâu

**Quyết định.**

1. **Tiền mặt khách đưa dư** không phải thu vượt: hệ thống thêm trường "Khách đưa" và "Tiền thối" cho dòng tiền mặt; chỉ số "Ghi nhận" (đã thu thật) vào phiếu thu. Đây là yêu cầu mới (đề xuất FR-ACC-024, Could).
2. **Thu vượt thật** (chuyển khoản/thẻ dư, hoặc khách để lại): phần dư ghi thành **khoản nhận trước** gắn khách (và pháp nhân), không gắn lệnh nào (FR-ACC-015). Cần xác nhận bằng ô tích như đang thiết kế.
3. Xử lý khoản nhận trước: **bù vào lệnh sau của cùng khách** (Thu ngân/Kế toán chọn khi thu tiền, không tự động) hoặc **hoàn lại** qua G4-ACC-07 (cần duyệt như hoàn tiền). Không chuyển giữa khách khác nhau.
4. Hiển thị: chip "Khách có khoản nhận trước X ₫" ở G4-ACC-01 (Phase 1), dòng ở G4-ACC-11 và G4-ACC-03; thêm màn quản lý **G4-ACC-21 "Khoản nhận trước"** (id mới đặt cuối nhóm ACC), Phase 2.

**Lý do.** Khoản nhận trước là nợ phải trả khách trên sổ quản trị; để không có chỗ xem sẽ lệch số dư công nợ và khó đối soát cuối kỳ. Không tự bù để tránh trừ nhầm lệnh.

**Căn cứ.** FR-ACC-015, FR-ACC-002, FR-ACC-016, BR-ACC-09, Journey §8 ("Khách doanh nghiệp thanh toán gộp nhiều hóa đơn": phần dư ghi thành khoản nhận trước).

**Tác động.** G4-ACC-01/03/11 + màn mới G4-ACC-21 (designer đặt vào `screen-inventory.md` §8.1 sau khi BA cập nhật); FRD FR-ACC-022, FR-ACC-024 đề xuất.

---

## Câu 6 – Đối chiếu 3 bên chênh lệch có chặn chi nhà cung cấp không

**Quyết định.** **Có chặn** chi cho phần chứng từ chênh lệch vượt **dung sai** (dung sai cấu hình, mặc định 0). Hai đường xử lý: (a) sửa/xác nhận ở Mua hàng rồi quay lại chi; (b) "Chi kèm ngoại lệ": bắt buộc lý do, đi vào đề xuất chi (G4-ACC-05) và cần duyệt bất kể số tiền. Phiếu nhập khớp trong cùng nhà cung cấp vẫn chi bình thường.

**Lý do.** FR-PUR-006 yêu cầu chênh lệch phải xử lý **trước khi ghi công nợ**, nên chi tiền trước khi xử lý là mâu thuẫn; cho ngoại lệ có duyệt để không kẹt giao dịch khi nhà cung cấp hối thúc.

**Căn cứ.** FR-PUR-006, FR-ACC-007, FR-ACC-018, RULE-011.

**Tác động.** G4-ACC-13 (nút "Chi kèm ngoại lệ" thay cho nút chỉ khóa), cấu hình dung sai; Phase 2 (cùng PUR).

---

## Câu 7 – Ghép giao dịch ngân hàng khi lệch số tiền

**Quyết định.** Cho ghép **một-một kèm loại lý do** (Phí chuyển khoản, Làm tròn, Khác) và ghi chú ≥ 5 ký tự; phần chênh lệch lưu thành "chênh lệch đối soát" gắn cặp ghép và hiện trong báo cáo đối soát. Chênh lệch vượt ngưỡng cấu hình thì cần Kế toán trưởng (cờ quyền) duyệt. **Không** tạo phiếu phí riêng ở Phase 4 (có thể thêm sau nếu kế toán muốn hạch toán phí).

**Lý do.** FR-ACC-017 chỉ yêu cầu đối soát và danh sách giao dịch chưa khớp; phiếu phí tự động chạm sang hạch toán chi phí ngân hàng, chưa có quy tắc từ kế toán khách; ghi nhận chênh lệch có lý do vẫn truy vết được (RULE-010).

**Căn cứ.** FR-ACC-017 (`[Cần xác nhận định dạng sao kê]`), BR-ACC-12.

**Tác động.** G4-ACC-16 (thêm chọn loại lý do); Phase 4.

---

## Câu 8 – Duyệt hàng loạt

**Quyết định.**

- **Cho duyệt hàng loạt:** giảm giá vượt hạn mức và chênh lệch quỹ ca (Phase 1–2); đề xuất chi nhỏ (Should, Phase 2).
- **Điều kiện "đủ":** (1) **cùng loại** trong một lần chọn; (2) giá trị trong hạn mức của cấp người duyệt; (3) không có cờ rủi ro: người đề xuất khác người duyệt, chưa quá hạn chuyển cấp, không thiếu chứng từ gốc, không phải yêu cầu lặp trong 24 giờ cho cùng đối tượng (tham số).
- **Luôn duyệt riêng:** hoàn tiền, hóa đơn điều chỉnh/thay thế/hủy, chi vượt hạn mức, hủy lệnh sau xuất kho, mở lại ngày/kỳ, đổi cấu hình (hạn mức, sơ đồ tài khoản, phương pháp giá vốn, môi trường hóa đơn).
- Duyệt hàng loạt là **xác nhận mức 2**, ghi nhật ký **từng mục** (tên người duyệt, giá trị, thời điểm).

**Lý do.** Giảm thao tác cho quản lý nhưng không cho che mắt các khoản tiền lớn hoặc khó hoàn tác; người đề xuất không duyệt chính mình (kiểm soát tách nhiệm).

**Căn cứ.** FR-SYS-004, FR-SYS-015, RULE-011, Journey §7 ma trận phê duyệt.

**Tác động.** G4-APR-01 (dialog duyệt hàng loạt phải chặn khi chọn khác loại; xem F5-20 trong review), G4-APR-03 (cấu hình loại được duyệt hàng loạt).

---

## Câu 9 – Vượt hạn mức công nợ khách doanh nghiệp

**Quyết định.** Chính sách cấu hình theo khách/nhóm khách, mặc định khởi tạo:

- Khi **lập báo giá/lệnh**: cảnh báo hiển thị cho Cố vấn (không chặn) – đúng tiêu chí FR-ACC-020.
- Khi **bàn giao xe/hoàn tất lệnh** mà tổng dư nợ sau lệnh vượt hạn mức: **cần Quản lý chi nhánh duyệt** (đề xuất nới tạm thời có thời hạn và lý do, đi G4-APR-02). Có thể đổi thành "chỉ cảnh báo" hoặc "chặn cứng" theo từng khách.
- Có nợ quá hạn vượt số ngày cấu hình: hiển thị cờ "Quá hạn" và gợi ý nhắc nợ; không tự chặn.
- Cố vấn thấy **số dư/hạn mức/trạng thái** của khách ngay trên lệnh và hồ sơ khách (FR-CRM-018) nhưng **không** xem sổ công nợ chi tiết (xem câu "quyền" ở bảng cuối).

**Lý do.** Journey nêu "chặn bàn giao hoặc cần duyệt theo chính sách `[Cần xác nhận]`". Khách doanh nghiệp quan trọng thường không muốn chặn giao xe; duyệt có lý do cân bằng rủi ro và doanh thu.

**Căn cứ.** FR-ACC-020, FR-CRM-018, BR-ACC-13, UAT-26, Journey §8 (bản 0.3).

**Tác động.** G4-ACC-11 (chuyển "Đề xuất nới hạn mức" thành cơ chế duyệt khi bàn giao), G2-DLV (kiểm điều kiện bàn giao); Phase 2 (Should).

---

## Câu 10 – Mở lại ngày/kỳ

**Quyết định.**

- **Ngày và kỳ** cùng quy tắc: Kế toán hoặc Quản lý chi nhánh **đề nghị**, **Chủ garage duyệt** (FR-ACC-005; Journey §7 "Kế toán → Chủ garage"). Quản lý vùng chỉ duyệt khi Chủ garage **ủy quyền bằng cấu hình** theo nhóm chi nhánh (mặc định tắt), mọi lần ủy quyền ghi nhật ký.
- **Xác thực lại:** nhập lại mật khẩu **và mã MFA** (hành động nhạy cảm; D-02 đã bắt buộc MFA cho CH, KT, QL, QV, AD).
- **Thời hạn mở:** có hạn (mặc định 48 giờ, cấu hình). Hết hạn hoặc khi người đề nghị bấm "Hoàn tất điều chỉnh": hệ thống kiểm lại điều kiện khóa và **tự khóa lại**; nếu còn điều kiện chặn thì thông báo cho người đề nghị, không để ngày mở vô thời hạn.
- Mở lại **kỳ** đã kết xuất sang phần mềm kế toán: cảnh báo "cần kết xuất lại" và đánh dấu kỳ.
- Không mở lại kỳ cũ khi kỳ sau đã khóa mà không mở kỳ sau trước (giữ thứ tự).

**Lý do.** Tránh ngày mở vô thời hạn làm vô hiệu số "chính thức"; MFA bảo vệ hành động có thể đổi số đã báo cho chủ garage.

**Căn cứ.** FR-ACC-005, RULE-010, Journey §7, D-02 (screen-inventory §5), FR-SYS-003 (nhật ký).

**Tác động.** G4-ACC-09 (nay do CH bấm trực tiếp, cần thêm đường "Đề nghị mở lại" cho QL/KT, xem F5-09), G4-ACC-17, G4-APR-01/02 (loại "Mở lại ngày hoặc kỳ"); thêm cấu hình thời hạn.

---

## Câu 11 – Thu ngân có lập yêu cầu điều chỉnh/hủy hóa đơn không

**Quyết định.** **Không.** Thu ngân (M10 = S) được **phát hành** hóa đơn và xem hóa đơn; **chỉ Kế toán lập** yêu cầu điều chỉnh/thay thế/hủy (G4-EIN-04). Để không bắt Thu ngân đi vòng, ở G4-EIN-03 thêm nút "Báo kế toán hóa đơn này có sai" tạo thông báo "Cần xử lý" kèm ghi chú cho Kế toán; không tạo yêu cầu trong hàng chờ duyệt.

**Lý do.** Journey §7 ghi người đề xuất là Kế toán, người duyệt là Kế toán trưởng; chia nhỏ quyền bắt đầu thao tác nhạy cảm giảm rủi ro sai thuế.

**Căn cứ.** FRD §2 (ma trận: Hóa đơn điện tử TN = S, ghi chú điều chỉnh/thay thế/hủy cần kế toán trưởng duyệt), FR-EIN-007, Journey §7.

**Tác động.** G4-EIN-03 (thêm nút báo), G4-EIN-04 giữ allow hiện tại.

---

## Câu 12 – Vai trò "Kế toán trưởng", "Trưởng kho/Quản lý vận hành"

**Quyết định.** **Chỉ cờ quyền, không thêm vai trò mới ở Phase 1–3.**

- "Kế toán trưởng" là cờ quyền "Duyệt hóa đơn điều chỉnh/thay thế/hủy" trên vai trò Kế toán (FRD §2, ghi chú). Một người lập yêu cầu **không tự duyệt** yêu cầu của mình dù có cờ; nếu chỉ có một người có cờ thì chuyển cho Chủ garage hoặc người được ủy quyền theo cấu hình G4-APR-03.
- "Trưởng kho/Quản lý vận hành" là **cấp duyệt** trong ma trận hạn mức (G4-APR-03), gắn vào cờ quyền hoặc vai trò hiện có (Quản lý chi nhánh, Thủ kho); chưa tạo vai trò riêng. Nếu khách xác nhận cần vai trò riêng, FR-SYS-013 đã cho phép vai trò cấu hình được.

**Lý do.** Giữ ma trận quyền FRD §2 ổn định; tách nhiệm vẫn đạt được qua quy tắc "người lập ≠ người duyệt".

**Căn cứ.** FRD §2 ghi chú, FR-SYS-012, FR-SYS-013, FR-EIN-007; screen-inventory G-06.

**Tác động.** G4-APR-02/03, G4-EIN-04; ghi chú ở bản FRD §2 nếu khách chọn vai trò riêng.

---

## Câu 13 – Quản lý chi nhánh xem lãi lỗ

**Quyết định.** **Chỉ chi nhánh mình** (FRD §2 cho QL xem "Công nợ và giá vốn" trong phạm vi chi nhánh, NFR-ISO-01). Có thể hiển thị chỉ số so với **trung bình chuỗi (đã ẩn danh)** ở mức Could; không hiện số của chi nhánh cụ thể khác. Chủ garage thấy toàn chuỗi; Quản lý vùng thấy nhóm được giao; Kế toán thấy các chi nhánh được gán.

**Lý do.** Cách ly dữ liệu giữa chi nhánh; so sánh có tên chi nhánh là quyết định chính sách của chủ garage, không tự mở.

**Căn cứ.** FRD §2, NFR-ISO-01, FR-ACC-011, FR-RPT-013.

**Tác động.** G4-ACC-14/15: giữ; thêm tùy chọn cấu hình "hiện so sánh ẩn danh".

---

## Câu 14 – Chi tiền mặt vượt số dư quỹ

**Quyết định.** **Chặn cứng**, không cấu hình cho phép số dư âm. Lối thoát hợp lệ: chi bằng chuyển khoản, hoặc ghi phiếu **nạp quỹ/chuyển quỹ** có chứng từ rồi chi tiếp. Thông báo lỗi nêu cả hai cách.

**Lý do.** Sổ quỹ tiền mặt không thể âm (FR-ACC-003: số dư bằng tổng thu trừ tổng chi); quỹ âm thường che sai sót hoặc chi khống.

**Căn cứ.** FR-ACC-003, RULE-010, RULE-011.

**Tác động.** G4-ACC-04 (giữ), bổ sung nút "Nạp quỹ" (chứng từ chuyển quỹ) cho Phase 2.

---

## Câu 15 – Ca làm việc

**Quyết định.** Cấu hình theo chi nhánh; mặc định: **ca mở khi Thu ngân nhận quỹ** (đếm quỹ đầu ca; lệch với số dư cuối ca trước phải giải trình) và **đóng khi đếm quỹ cuối ca** (bàn giao). Một **quỹ/quầy chỉ có một ca mở** tại một thời điểm; một Thu ngân có thể mở nhiều ca trong ngày nhưng không mở hai ca cùng lúc. Có hai ca mẫu (Ca sáng/Ca chiều) chỉ là nhãn gợi ý; số ca và giờ không cứng. Ngày chỉ khóa được khi mọi ca đã chốt (liên quan câu 1c).

**Lý do.** Chốt ca là hành vi kiểm soát tiền mặt, gắn với người nhận quỹ chứ không gắn với giờ cố định; garage nhỏ có thể một người, garage lớn nhiều quầy.

**Căn cứ.** FR-ACC-004, FR-ACC-003, BR-ACC-05; Journey bước chốt ngày; WF-06.

**Tác động.** G4-ACC-08, G4-ACC-04; thêm cấu hình ca ở G4-SYS.

---

## Câu 16 – Quy ước mã phiếu và yêu cầu mới

**Quyết định.** Dùng cùng dạng `LOẠI-MÃCN-YYMM-STT` (ba-decisions, câu 11). Tiền tố bổ sung:

| Loại | Tiền tố |
| --- | --- |
| Đề xuất chi | DX |
| Yêu cầu phê duyệt | YC |
| Yêu cầu phát hành hóa đơn | **YH** (thay `YC-EIN-` đang dùng trong mock, để mã luôn có mã chi nhánh) |
| Phiếu nạp/chuyển quỹ (nếu có) | CQ |

**Mã chống trùng (idempotency key)** là khóa kỹ thuật, **không phải mã chứng từ**: hiển thị trong phần chi tiết kỹ thuật cho Kế toán/Quản trị, không in, không hiện cho Thu ngân. **Số hóa đơn** là số của nhà cung cấp/cơ quan thuế, không dùng mã nội bộ.

**Lý do.** Nhất quán tìm kiếm (nhập thiếu gạch, chỉ STT); duy nhất theo chi nhánh và thời gian (FR-REC-030).

**Căn cứ.** FR-REC-030, FR-EIN-013, ba-decisions câu 11.

**Tác động.** G4-EIN-06/07 (`YC-EIN-00230` → `YH-Q7-2610-00230`), G4-EIN-02 (ẩn khóa chống trùng sau "Chi tiết kỹ thuật"); đề nghị mở rộng FR-REC-030 liệt kê tiền tố.

---

## Câu 17 – Phase 1 và việc tách G4-ACC-03

**Quyết định.**

1. Đưa vào Phase 1 (xem đề xuất FRD §13 bên dưới): thu tiền, cọc, sổ quỹ, chốt ca/ngày, bút toán đảo, hiển thị liên kết năm đối tượng, thuế suất cấu hình, hóa đơn cơ bản kèm cảnh báo và hàng chờ lỗi.
2. **G4-ACC-03 một màn hình, hai chế độ:** Phase 1 xem chi tiết, in, đảo bút toán; nút "Phân bổ lại nhiều-nhiều" **hiển thị nhưng khóa** kèm lý do "Có từ giai đoạn 2" (FR-ACC-015 xếp giai đoạn 2). Một thanh toán – một lệnh ở Phase 1; phần dư là khoản nhận trước (câu 5).
3. Chủ dự án xác nhận Phase 1 cần tiền và hóa đơn tối thiểu (D-14, G-01 trong `screen-inventory.md`).

**Lý do.** UAT-01 và UAT-07 chạy từ nhận xe đến giao xe có hóa đơn và chốt ngày; chia hai màn hình làm dev duy trì hai bản.

**Căn cứ.** FRD §13, UAT-01, UAT-07, UAT-14, FR-ACC-001/003/004/015, `screen-inventory.md` D-14 và G-01.

---

## Đề xuất cập nhật FRD §13 và các FR (không thực hiện trong lượt này; BA đề nghị, chờ chủ dự án xác nhận)

### Phase 1 (pilot một chi nhánh) – đề xuất thêm

| FR | Nội dung | Ghi chú |
| --- | --- | --- |
| FR-ACC-001 | Phiếu thu nhiều hình thức | Must, hiện đang ở giai đoạn 2 theo bảng ACC |
| FR-ACC-002 | Tiền cọc | Must |
| FR-ACC-003 | Sổ quỹ, phiếu chi | Must |
| FR-ACC-004 | Chốt ca và chốt ngày | Must; kèm điều kiện chặn/cảnh báo (câu 1) |
| FR-ACC-005 | Chỉ phần **khóa ngày** và mở lại ngày; **khóa kỳ** để Phase 3 | Must |
| FR-ACC-009 | Thuế suất theo ngày hiệu lực | Must; FR-EIN-011 phụ thuộc |
| FR-ACC-019 | Chỉ phần **hiển thị liên kết năm đối tượng** | Must; hiện đang xếp giai đoạn 2 |
| FR-ACC-021 (mới) | Đảo bút toán phiếu thu/phiếu chi | Must (nay chưa có FR riêng, chỉ có RULE-010) |
| FR-EIN-007 | Điều chỉnh/thay thế/hủy | Must; khuyến nghị Phase 1 mức tối thiểu vì hóa đơn thật có thể sai ngay trong pilot; phương án dự phòng: xử lý trên cổng nhà cung cấp, ghi rõ rủi ro |
| FR-EIN-009 | Cảnh báo lệnh hoàn tất chưa hóa đơn | Must; chốt ngày và FR-RPT-004 cần |
| FR-EIN-010 | Hàng chờ lỗi và thử lại | Must; đi cùng FR-EIN-013 |
| FR-SYS-004 | Mở rộng phạm vi sang hoàn tiền, chi, hóa đơn, mở lại ngày/kỳ | Hiện chỉ liệt kê giảm giá, hủy lệnh, điều chỉnh kho, chênh lệch quỹ, chuyển kho |

FR-EIN-001 đến 006, 011, 013 đã ở Phase 1 theo FRD §13 (giữ).

### Phase 2

FR-ACC-006, 007, 015, 016, 018, 020; FR-ACC-022 (khoản nhận trước); FR-SYS-015 (chuyển cấp khi quá hạn); G4-ACC-12/13 cùng PUR.

### Phase 3

FR-ACC-005 phần khóa kỳ, 008, 009 (phần cấu hình đầy đủ), 010 đến 014, 019 đầy đủ, FR-EIN-008 (nếu khách bật kênh).

### Phase 4

FR-ACC-017 (đối soát ngân hàng), FR-ACC-012 (xem lại), phân bổ chi phí chung nâng cao.

### FR mới đề xuất (đặt cuối nhóm ACC)

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu (rút gọn) | BR |
| --- | --- | --- | --- | --- |
| FR-ACC-021 | Đảo bút toán phiếu thu/phiếu chi: phiếu gốc giữ nguyên, tạo bút toán đảo liên kết có lý do, người duyệt theo ma trận | Must | Phiếu đã ghi sổ không xóa được; đảo tạo đúng một bút toán đảo dù bấm nhiều lần; số dư quỹ và công nợ đúng sau đảo | BR-ACC-01 |
| FR-ACC-022 | Quản lý khoản nhận trước của khách: bù vào lệnh sau hoặc hoàn lại có duyệt | Should | Phần dư thu vượt hiện đúng số trên hồ sơ khách; bù trừ không vượt số dư | BR-ACC-09 |
| FR-ACC-023 | Điều kiện chặn/cảnh báo khi khóa ngày, kỳ là cấu hình có ngày hiệu lực; mở lại có thời hạn và tự khóa lại | Must | Đổi điều kiện từ cảnh báo sang chặn không cần sửa mã; mở lại quá hạn tự khóa lại | BR-ACC-05 |
| FR-ACC-024 | Dòng tiền mặt có "khách đưa" và "tiền thối", chỉ phần thu thật vào phiếu thu | Could | Tiền thối không làm sai số quỹ | BR-ACC-01 |

### UAT mới (số tiếp sau UAT hiện có cuối cùng)

Đảo phiếu thu bấm hai lần chỉ một bút toán; hoàn tiền một phần giữ đúng trạng thái và tag; khóa ngày bị chặn/được phép theo từng điều kiện cấu hình; mở lại ngày tự khóa lại; hóa đơn điều chỉnh/thay thế giữ hiển thị gốc/mới đúng; chi nhà cung cấp bị chặn khi chênh lệch 3 bên.

### Đồng bộ các tài liệu khác

- `business-requirements.md`: câu hỏi mở về điều kiện khóa ngày, thời hạn mở lại, chính sách hạn mức công nợ ghi là "đã có đề xuất, chờ xác nhận"; không đổi số RULE.
- `user-journey-business-workflow.md`: §7 ghi nhãn trạng thái hóa đơn gốc/mới và chỉ báo đồng bộ; §7 ma trận phê duyệt bổ sung hoàn tiền, chi vượt hạn mức, hủy lệnh, hóa đơn, mở lại; §8 thêm tình huống thu vượt (tiền thối vs khoản nhận trước) và hoàn tiền một phần.
- `functional-requirements.md`: FRD §13, ma trận truy vết (bổ sung FR mới), UAT.
- `screen-inventory.md`: §8.1 thêm G4-ACC-21, ghi lại D-14/G-01 đã được trả lời.

---

## Bảng quyền Thu ngân (TN) và Kế toán (KT) trên hóa đơn (kết luận gộp theo FRD §2)

| Hành động | TN | KT | Ghi chú |
| --- | --- | --- | --- |
| Xem hóa đơn | S/xem | S/xem | M10 TN = S, KT = S |
| Phát hành từ lệnh | Có | Có | FR-EIN-001 |
| Truy vấn trạng thái, gửi lại cho khách | Có (gửi lại) | Có | Không phát hành lại khi timeout (FR-EIN-013) |
| Lập điều chỉnh/thay thế/hủy | **Không** (chỉ báo kế toán) | **Có** | Câu 11 |
| Duyệt điều chỉnh/thay thế/hủy | Không | Chỉ khi có cờ Kế toán trưởng và không phải người lập | Câu 12 |
| Cấu hình đơn vị phát hành, kết nối (EIN-07/08) | Không | Xem; sửa EIN-08 theo ma trận | AD cấu hình kỹ thuật, không xem dữ liệu khách |
| Xuất danh sách | Theo quyền xuất (FR-SYS-013) | Theo quyền xuất | Xuất mặc định che SĐT/địa chỉ |

## Các điểm giữ `[Cần xác nhận]` (không chốt thay khách)

Nhà cung cấp hóa đơn và kênh Zalo/SMS; thời điểm lập hóa đơn, tiền cọc, "khách không lấy hóa đơn" (câu 3); phương pháp giá vốn và cách phân bổ chi phí chung; hạn mức duyệt cụ thể; thuế suất qua mốc 1/1/2027; định dạng kết xuất và sao kê ngân hàng; pháp nhân đơn hay nhiều; cách xử lý chi tiết từng trường hợp hóa đơn lập sai theo Thông tư 91/2026.
