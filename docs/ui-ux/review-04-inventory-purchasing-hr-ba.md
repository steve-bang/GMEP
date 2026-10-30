# BA Review – Gói G3 (Kho, Mua hàng, Nhân sự), bản designer 0.1

Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g3-inventory-hr/` (39 màn hình + `pack.css`, `pack.js`, `index.html`) và `docs/ui-ux/04-inventory-purchasing-hr.md`. Chuẩn đối chiếu: `docs/design-system.md` (không đổi), `00-foundation.md`, `ba-decisions.md` (A.2 và công thức Khả dụng), `screen-inventory.md` §4–§6, FRD (INV, PUR, HRM, §2, NFR), Journey §4, §5, §7, §8. Trả lời 20 câu hỏi nằm ở `docs/ui-ux/ba-answers-04.md` (BA đề xuất — chờ xác nhận); các finding dưới đây dùng các quyết định đó.

Phương pháp: đọc mã và đối chiếu (không chạy trình duyệt). Đã đọc đầy đủ INV-03, 04, 05, 06, 07, 09, 10, 13, 14, 16, 17, 18; PUR-02, 03, 05, 06, 07, 08; HRM-04, 06, 07, 08, 09, 10; `pack.js`, `pack.css`; các màn hình còn lại kiểm bằng tìm kiếm mẫu (class, badge, trạng thái, vai trò, giá vốn, dữ liệu cá nhân). Chưa đọc từng dòng: INV-01, 02, 08, 11, 12, 15, 19, PUR-01, 04, 09, 10, HRM-01, 02, 03, 05.

Mức: **Blocker** = vi phạm quy tắc cứng (NFR, RULE, nguyên tắc bốn số) hoặc làm luồng không hoàn tất, phải sửa trước khi bàn giao; **Major** = sai nghiệp vụ hoặc thiếu trạng thái/vai trò ảnh hưởng dev và UAT; **Minor** = trình bày, dữ liệu mẫu, rủi ro prototype.

## 1. Kết quả tổng

| Mức | Số finding | Mã |
| --- | --- | --- |
| Blocker | 2 | F4-01, F4-02 |
| Major | 13 | F4-03 … F4-15 |
| Minor | 16 | F4-16 … F4-31 |
| Tổng | 31 | |

## 2. Các hạng mục đã đạt

| Hạng mục | Kết quả |
| --- | --- |
| Đủ màn hình | 39/39 file tồn tại (INV 19, PUR 10, HRM 10); `index.html` có đủ 39 liên kết `g3-*.html` |
| Token/class | Không có hex/`rgba` hay màu inline trong HTML; `pack.css` chỉ dùng `var(--...)` và mọi token đã kiểm đều có trong `tokens.css`; các class đã kiểm có thật trong `components.css`/`base.css` (`stack-6`, `row--between`, `tag--reason`, `stock4*`, `scope-banner`, `impact-list`, `approval__*`, `timeline__item--*`, `kpi--*`, `dialog__icon--*`, `badge--lg`…); `.cell-sub` chỉ định nghĩa trong `.table` (xem F4-26) |
| Badge luôn có chữ | Mọi `badge`/`tag` đã quét đều có nhãn chữ; thanh `g3-bar` luôn kèm số; heat-map có chữ ("113% · Quá tải") |
| Bốn số và ngưỡng | `pack.js:244-249`: Khả dụng = Thực tế − Giữ chỗ, Đang vận chuyển không cộng vào; Hết hàng khi Khả dụng ≤ 0, Sắp hết khi ≤ Tối thiểu, Chưa đặt định mức khi không có Tối thiểu, tag "Đang về N" khi N > 0; đúng ba-decisions câu 4. Tổng chân bảng INV-04 (76/11/16/65, 31.052.000 ₫) cộng đúng |
| Phép tính kiểm tay | INV-03 thẻ kho (20→19→29→27→26) và giá vốn bình quân 118.000 ₫ (3.068.000 ÷ 26); INV-09 (6.940.000 ₫, +7,7%); INV-13 (8.160.000 ₫); INV-18 (381.000 − 15.000, 8,1%); PUR-03 (21.360.000, vượt 1.360.000); PUR-06 (12.360.000, còn 18); HRM-07 (5,10 / 4,95 / 2,80); HRM-10 (cả ba chỉ số và tổng 328,0 / 234,5 / 230,7) đều đúng |
| RULE-007 | INV-07 chặn khi thiếu lệnh/phiếu bán lẻ/phiếu chuyển; INV-18 dùng BL làm chứng từ gốc; INV-11 có lý do và duyệt; INV-09 "nhập không có đơn mua" cần lý do + QL duyệt |
| RULE-008 | INV-06/07/13 chặn xuất/chuyển vượt Khả dụng, nêu lối ra (chuyển kho, mua) |
| RULE-009 | Thẻ kho INV-03 chỉ đọc, mọi dòng có chứng từ và chứng từ gốc; danh mục không có ô số lượng |
| RULE-010 | Không có nút "Xóa" cho chứng từ đã ghi sổ (các lần "xóa" tìm thấy đều là câu giải thích "không xóa" hoặc "Xóa bộ lọc"); sửa bằng HK, TR, DC, phiên bản đơn, dòng đảo công |
| Chuyển kho hai bên | Gửi/Nhận tách phiếu, hàng đang vận chuyển không vào Khả dụng cả hai bên, biên bản chênh lệch + ảnh, chặn "Xác nhận nhận đủ" khi lệch (INV-13, 14) |
| PUR nhiều lần nhận | PUR-06 hiện lần nhận, "Còn lại", đơn mở khi thiếu; sửa đơn đã gửi tạo phiên bản, không ghi đè (PUR-05) |
| HRM cấu hình | HRM-06 có phương pháp theo loại việc, ghi đè trong quyền, phiên bản, ngày hiệu lực, thử tính; kỳ khóa cần gõ "KHOA"; mở lại kỳ cần CH |
| Che dữ liệu | Giá vốn che theo vai trò (`data-g3-cost`); PII nhân sự/NCC không nằm trong HTML (chỉ trong hàm mô phỏng, xem F4-17) |
| Trạng thái | Danh sách có loading/empty/filtered/error/denied; chi tiết có notfound (INV-03, 14, 17, PUR-03, 06, HRM-02); denied tự hiện khi vai trò không được mở; banner mất mạng ở mọi màn hình |

## 3. Blocker

**F4-01 · Blocker · `g3-inv-03.html:69-76` (tab "Chi nhánh khác"; liên quan `g3-inv-05.html:41-43`)**
Tab hiện Thực tế, Giữ chỗ và Khả dụng của Kho tổng Thủ Đức, Chi nhánh Thủ Đức, Chi nhánh Quận 1 cho Thủ kho/QL chi nhánh Quận 7, không có kiểm soát vai trò, kèm dòng "Biên Hòa – ngoài phạm vi". Vi phạm NFR-ISO-01 (cách ly dữ liệu chi nhánh trong danh sách, báo cáo, API) vì `screen-inventory` ghi "tồn các chi nhánh khác (trong quyền)", mà phạm vi của TK/QL chỉ là chi nhánh mình.
Cách sửa: theo BS-1 (`ba-answers-04.md` Phụ lục F): chỉ hiện **Khả dụng** và "số có thể cho" (câu 7), tùy cấu hình `xem_khả_dụng_liên_chi_nhánh`, bỏ Thực tế/Giữ chỗ/giá; chi nhánh ngoài nhóm được phép không xuất hiện (kể cả dòng "ngoài phạm vi", vì lộ sự tồn tại). INV-05 chỉ giữ câu "có X khả dụng". Ghi trạng thái "tính đến HH:mm" vì số của chi nhánh khác có độ trễ.

**F4-02 · Blocker · `g3-inv-04.html:51-52`; `pack.js:260-285` (`cards()`)**
Trên mobile (INV-04 khai báo thiết bị D, M), bảng chuyển thành thẻ chỉ lấy các cột có `data-card`. Ba cột Thực tế, Giữ chỗ, Đang vận chuyển không có `data-card` nên thẻ chỉ còn "Khả dụng" (`meta`), Kho và Giá trị tồn. Màn hình trung tâm của nguyên tắc "bốn con số luôn đi cùng nhau, cùng thứ tự" (screen-inventory §4.1, ba-decisions câu 4) mất ba số trên điện thoại của quản lý.
Cách sửa: thêm giá trị `data-card="stock4"` vào `cards()` để vẽ lưới 2×2 `stock4` (Thực tế · Giữ chỗ · Đang vận chuyển · Khả dụng, Khả dụng nhấn mạnh), dùng chung hàm với `expandStock`. Kiểm ở 375 px. INV-01 chỉ cần Khả dụng (CV chỉ thấy Khả dụng theo câu 6) thì chấp nhận.

## 4. Major

**F4-03 · Major · `g3-inv-04.html:56`, `g3-inv-05.html:42`, `g3-pur-06.html:67`, `pack.js` giả định A-03, tài liệu 04 §10**
Mâu thuẫn định nghĩa "Đang vận chuyển". A-03 nói hàng ở đơn mua đã NCC xác nhận **chưa tính**, nhưng PT-0002 hiện "Đang về 10" (đúng bằng số còn lại của DM-Q7-2610-00014, PUR-06:43), INV-05 viết "chờ 10 đang về", và hộp thoại đóng đơn PUR-06:67 viết "Đang vận chuyển liên quan được nhả". Nghĩa là dữ liệu mẫu đang tính hàng đặt NCC là Đang vận chuyển. Ảnh hưởng gợi ý đặt hàng và Khả dụng cảnh báo.
Cách sửa: theo câu 1: Đang vận chuyển chỉ cho phiếu CK/kho tổng; thêm cột/chip "Đã đặt – chờ giao" tách riêng; sửa dữ liệu PT-0002 (Đang vận chuyển 0, Đã đặt 10), nội dung hộp thoại PUR-06 ("phần còn lại 18 không còn được chờ giao"), cột "Đang về" của PUR-02 thành hai cột; công thức đề xuất ở INV-05 theo câu 7; footer INV-05:45 bỏ chữ "chờ BA xác nhận".

**F4-04 · Major · `pack.js:9-10, 16-57`; `design/assets/app.js` (`ROLE_MENU`, `SCOPE_TYPE`); tài liệu 04 A-02**
Designer gộp MH → TK và NS → QL, nhưng FRD §2 (bản 0.2) và `screen-inventory` §0.4 coi MH, NS là vai trò riêng. `ROLE_NAME`, `ROLE_MENU` không có MH/NS (`applyRole` thoát sớm, menu trống). Câu 5: thêm hai vai trò. Chưa có chỗ nào cho NS (HRM-01, 02, 03, 04, 08), MH (PUR-01…10, INV-04/05 xem).
Cách sửa: thêm MH, NS vào `ROLE_NAME`, `ROLE_MENU`, `SCOPE_TYPE` (`pick`), `00-foundation.md` §7; cập nhật `R` trong `pack.js`: MH vào PUR-01…10 và INV-04, 05 (X); NS vào HRM-01, 02, 03, 04, 08 (S) và HRM-05/06/07/09/10 (X); sửa nhãn nút lỗi thời ("Thủ kho / người mua hàng và Quản lý chi nhánh", PUR-02:28, PUR-05:28). Đưa A-02 khỏi tài liệu 04. Vì `design/assets/*` do chủ Phase 0 giữ, ghi yêu cầu cho chủ Phase 0 thay vì sửa trong gói.

**F4-05 · Major · `pack.js:10, 228-231`; `g3-inv-08.html`, `g3-inv-13.html:46`, `g3-pur-09.html`**
Chỉ có một cờ `data-g3-cost` (CH QV QL KT). Giá mua/giá đơn mua lúc nhận hàng (TK, MH cần thấy) và giá vốn bị gộp: INV-09 cho TK thấy giá nhập, nhưng INV-03 (cột Giá nhập theo lô, tab "Giá và nhà cung cấp"), INV-08 (giá trị PN 6.940.000 ₫) và INV-13 (giá trị 8.160.000 ₫ để so với hạn mức) che cùng loại giá, nên TK lập chứng từ mà không biết vì sao cần duyệt. Dư nợ NCC ở PUR-09 dùng cờ giá vốn; theo câu 19 phải là ẩn cột cho TK/MH.
Cách sửa: tách `data-g3-cost` (giá vốn, giá trị tồn, lãi gộp) và `data-g3-buy` (giá đơn, giá nhập của phiếu đang xử lý, bảng giá NCC) theo bảng câu 2; ở INV-13 hiện cho TK "Giá trị vượt hạn mức cấp bạn" (kết quả so sánh), không hiện số giá vốn.

**F4-06 · Major · `pack.js:19, 37` (INV-01, INV-19 dùng `A` = CH QV QL TK KT); tài liệu 04 §3**
FRD §2 dòng "Danh mục phụ tùng và bảng giá": CV = X; `screen-inventory` INV-19 ghi "QV, QL, CV, KT (X)". Gói bỏ CV khỏi INV-01 và INV-19, và không có lối vào cho CV/TN (INV-18 liệt kê CV, TN nhưng `ROLE_MENU` của CV, TN không có `inv`, nên chỉ mở được bằng URL).
Cách sửa: thêm CV vào INV-01 và INV-19 (chỉ đọc, cột tồn chỉ có Khả dụng, giá niêm yết, không giá vốn); lối vào bán lẻ và tra tồn theo câu 6 (mục "Bán lẻ phụ tùng" ở nhóm Tài chính; bộ chọn phụ tùng trong báo giá). INV-04 không mở cho CV (FRD M5 = "-").

**F4-07 · Major · `g3-inv-06.html:36-40, 43-45`; `g3-inv-07.html:49-50`**
Kiểm tra xuất không tính **giữ chỗ của chính lệnh**. Thẻ RO-Q7-2610-00126 bị chặn vì "Khả dụng 0" trong khi thẻ RO-00131 thì ghi "Đã giữ chỗ 1 cho lệnh này"; thẻ RO-00127 không nói có giữ chỗ không, và dòng "sau khi xuất Khả dụng còn 1" chỉ đúng nếu không có giữ chỗ. Theo Journey §4 bước 3 giữ chỗ của lệnh chuyển thành xuất, nên mức xuất tối đa là `giữ chỗ còn lại của lệnh + Khả dụng` (câu 9).
Cách sửa: mọi thẻ INV-06 và dòng INV-07 hiện "Giữ chỗ cho lệnh này"; nếu lệnh chưa giữ chỗ cho dòng đó thì nói rõ lý do (dòng phát sinh, giữ chỗ lỗi) và chặn theo Khả dụng; tính "sau xuất" đúng cả hai trường hợp; đồng bộ nhãn lệnh ở thẻ 2 ("Tạm dừng" nhưng văn bản vẫn viết "nên tạm dừng", xem F4-23).

**F4-08 · Major · `g3-inv-16.html` (không có cột thời điểm đếm); `g3-inv-17.html:30, 36, 43`; `g3-inv-03.html:57`**
Không có cơ chế cho nhập/xuất phát sinh trong lúc đang đếm (câu hỏi BA 12). Dữ liệu cho thấy lỗ hổng: INV-17 ghi PT-0001 sổ sách 29, đếm 29, khớp, trong khi thẻ kho INV-03 có PX xuất 2 lúc 29/10 16:05 sau thời điểm chụp 08:30 mà không có cột "phát sinh trong lúc đếm" để kiểm chứng.
Cách sửa: theo câu 12: mỗi dòng đếm lưu thời điểm đếm; chênh lệch = số đếm − (tồn T0 ± chứng từ ghi sổ đến thời điểm đếm); thêm cột "Phát sinh trong lúc đếm" ở INV-17, cảnh báo ở PN/PX cho mã đang trong đợt đếm; thêm tùy chọn đóng băng nhóm hàng.

**F4-09 · Major · `g3-inv-16.html:37-41, 48, 64`**
Dòng "Chưa đếm" có ô số đếm mặc định `0` không phân biệt được với "đã đếm bằng 0", và text cho phép "Chốt sớm, mã chưa đếm bị bỏ khỏi đợt" (tài liệu 04 chưa nêu rủi ro). Dễ sinh phiếu điều chỉnh sai giá trị hoặc bỏ sót mã lệch.
Cách sửa: ô trống (placeholder "–") cho dòng chưa đếm; nút Chốt khóa kèm lý do khi còn dòng chưa đếm; muốn bỏ dòng phải được QL cho phép kèm lý do (câu 12); thêm bước "đếm lại" cho dòng lệch vượt ngưỡng.

**F4-10 · Major · `g3-pur-03.html:52-54, 62-64`**
Luồng duyệt không hoàn tất: chỉ có nút "Duyệt và chuyển cấp trên…" (chỉ QL) và "Từ chối…". Không có nút **Duyệt** cho trường hợp trong hạn mức, và ở trạng thái "Đã chuyển cấp trên" (`over`, dòng 62-64) cấp trên (CH/QV) không có nút Duyệt hay Từ chối, dù `data-g3-need` cho phép "QL CH QV" từ chối.
Cách sửa: thêm trạng thái "Chờ duyệt – trong hạn mức" (nút Duyệt chính), "Chờ duyệt – cấp CH/QV" (Duyệt, Từ chối), hàng chờ lấy từ G4-APR; thanh duyệt trên mobile (PUR-03 khai báo M) với nút ≥ 44 px; không duyệt yêu cầu do chính mình lập (BS-3).

**F4-11 · Major · `g3-pur-07.html:34-46`; `g3-pur-06.html:46-48`**
Đối chiếu ba bên 1:1 (một hóa đơn – "Phiếu nhập lần 1"), không biểu diễn hóa đơn NCC bao nhiều lần nhận, trong khi PUR đã có nhiều lần nhận (FR-PUR-005): PUR-06 cho thấy lần 2 đang Chờ duyệt (lệch giá) nên chưa thể đối chiếu. Cũng thiếu dung sai (Khớp/Lệch) và tùy chọn "Trả hàng NCC" chưa dẫn sang TR.
Cách sửa: BS-5: chọn tập PN thuộc DM cho một hóa đơn, đối chiếu từng dòng và tổng; hiện dung sai cấu hình (Phụ lục E #3) và PN chưa ghi sổ làm chặn đối chiếu; radio "Trả hàng NCC" mở PUR-08 với dòng điền sẵn; sau TR nhắc điều chỉnh/credit note của NCC.

**F4-12 · Major · `g3-inv-05.html:37-38`**
INV-05 khai báo thiết bị D, M nhưng ba cột có nghĩa nghiệp vụ không có `data-card`: ô chọn dòng, "Gợi ý nguồn", "Số lượng đề xuất" (và Tối thiểu). Trên mobile quản lý không thấy chi nhánh dư/NCC thay thế, không sửa được số lượng, không chọn dòng để "Tạo phiếu chuyển/yêu cầu mua" (thanh bulk phụ thuộc ô chọn).
Cách sửa: thẻ riêng cho INV-05 (tiêu đề + badge + Khả dụng/Tối thiểu/Đang về + dòng "Gợi ý" + ô số lượng + nút "Tạo phiếu chuyển"/"Tạo yêu cầu mua" ngay trên thẻ); quy tắc chung ở F4-18.

**F4-13 · Major · `g3-hrm-09.html:42-43`; `g3-hrm-06.html:37-38`; tài liệu 04 A-09**
HRM-09 trộn **công khoán** với **hoa hồng**: dòng "Lê Minh Tuấn – 4 lốp × 45.000 ₫" là phương pháp khoán của HRM-06 (công ghi khi QC, FR-HRM-007) nhưng được hiển thị là hoa hồng và chịu điều kiện "thu đủ" (FR-HRM-009). Chỉ phương pháp "tỷ lệ % trên công đã thu" (dòng Phạm Quốc Bảo 18%) mới là hoa hồng thợ (Journey §5 bảng mô hình).
Cách sửa: theo câu 14: HRM-09 chỉ liệt kê hoa hồng (cố vấn; thợ theo phương pháp %), công khoán/giờ chuẩn ở HRM-07/08; mỗi phương pháp ở HRM-06 có cột "điều kiện ghi nhận" (QC đạt / thu đủ); ví dụ khách ký cho từng cặp.

**F4-14 · Major · `g3-hrm-08.html:36-44` so với `g3-hrm-09.html:30-32, 39-43`**
Số liệu kỳ 16–31/10 Quận 7 không khớp giữa màn hình: HRM-08 cột "Hoa hồng ghi nhận" cố vấn Nguyễn Hoàng Yến 2.640.000 ₫, thợ Lê Minh Tuấn 1.180.000 ₫, tổng 5.630.000 ₫; HRM-09 cho cùng kỳ tổng "Đã ghi nhận" 451.500 ₫ (cố vấn 271.500 ₫, thợ 180.000 ₫). Đơn vị "Công (giờ công)" ở HRM-07/08 và "tiền" ở HRM-09 chưa có cầu nối; cột HRM-08 gộp công tiền và hoa hồng thành "Hoa hồng ghi nhận".
Cách sửa: HRM-08 hai cột "Tiền công (₫)" và "Hoa hồng đã ghi nhận (₫)" lấy đúng từ HRM-07/09; sửa dữ liệu mẫu cho khớp; thêm một ca kiểm thử đối chiếu chéo trong UAT-11.

**F4-15 · Major · `g3-hrm-08.html:24-27, 57-61`**
Nút "Duyệt kỳ" và "Khóa kỳ…" cho phép khóa kỳ 16–31/10 khi "còn 1 ngày" (scope banner dòng 27) và hộp thoại còn nhắc 1 hạng mục chờ QC, 1 điều chỉnh chờ duyệt. Khóa sớm làm công ghi sau ngày khóa rơi ra ngoài, và buộc mở lại kỳ (CH duyệt).
Cách sửa: theo câu 15: khóa chỉ từ ngày kết thúc kỳ; nút khóa bị khóa kèm lý do cho đến lúc đó; chặn khóa khi còn điều chỉnh chờ duyệt/ca thiếu giờ ra, nhưng không chặn vì hạng mục chờ QC (công sang kỳ sau). Trạng thái kỳ đã khóa phải **hiện bảng chỉ đọc** (hiện chỉ có alert, `g3-hrm-08.html:48-50`).

## 5. Minor

**F4-16 · Minor · `g3-hrm-06.html:35-38, 46-47, 75`**
Các ô của phiên bản đang hiệu lực (v1) sửa trực tiếp tại chỗ; không có chế độ "nháp phiên bản mới" tách khỏi bản hiệu lực. "Ghi đè Quận 7" (dòng 36) không có phiên bản/ngày hiệu lực riêng (FR-HRM-015 yêu cầu lịch sử cho bảng định mức của chi nhánh). Phiên bản nhảy: timeline có v2 chờ duyệt hiệu lực 01/12/2026, nhưng toast dòng 75 tạo "v3" cùng ngày hiệu lực, không cảnh báo xung đột ngày hiệu lực. Mục "Hoa hồng cố vấn" không có phiên bản.
Cách sửa: bảng hiệu lực chỉ đọc + nút "Soạn phiên bản mới" (nháp, so sánh với bản hiện hành); ghi đè theo chi nhánh có hiệu lực riêng; báo xung đột ngày hiệu lực; thử tính chọn được phiên bản.

**F4-17 · Minor · `pack.js:323-338`; `pack.js:49` (HRM-02 vai trò `CH QL`); tài liệu 04 A-13**
(a) Dữ liệu đầy đủ (SĐT, CCCD, địa chỉ) nằm trong `pack.js` chuyển xuống trình duyệt: chấp nhận cho prototype nhưng phải ghi trong handoff "production không gửi giá trị đầy đủ trước khi Hiện". (b) Chính sách `piiPolicy` khác Phụ lục D: QL xem đầy CCCD, KT thấy SĐT che không Hiện nhưng CCCD "Ẩn" (đúng), CH/QV Hiện không phân biệt trường. (c) TH có `data-own` nhưng không vào được HRM-02 (vai trò `CH QL`), nên không có nơi xem hồ sơ của mình; NS chưa có.
Cách sửa: thay `piiPolicy` theo Phụ lục D; TH xem hồ sơ qua G1-PRF; thêm NS.

**F4-18 · Minor (rủi ro, đã nêu ở mục 6) · `pack.js:260-285`**
Rủi ro bảng → thẻ do JS sinh. Xem mục 6.

**F4-19 · Minor (rủi ro, đã nêu ở mục 7) · `pack.js:111, 124, 127`**
Rủi ro `document.write` dựng shell. Xem mục 7.

**F4-20 · Minor · thiếu trạng thái · `data-g3-states` của INV-07, 09, 10, 11, 13, 16, 18, PUR-02, 05, 08; `pack.js:118`**
Các màn hình chứng từ đã tồn tại (INV-07 trạng thái "Đã ghi sổ", INV-09, INV-16…) không có trạng thái `notfound` (mở theo mã). Banner mất mạng là một chuỗi chung ("Chưa thể ghi sổ kho, gửi duyệt hay gửi đơn mua") hiện cả ở HRM, nơi không áp dụng; HRM-04 chưa nói "Vào ca/Ra ca khi mất mạng" xử lý thế nào (NFR-OFF-01 chỉ cho cảnh báo + nháp).
Cách sửa: thêm `notfound` cho màn hình mở theo mã; banner theo module (kho/mua/nhân sự); với Vào/Ra ca offline: nút khóa kèm lý do "Cần mạng để ghi giờ", không ghi giờ giả.

**F4-21 · Minor · `pack.js:213-221`**
Nút thiếu quyền dùng thuộc tính `disabled` thật (`x.disabled = !ok`) nên không nhận focus bàn phím; lý do chỉ có `title` (không hiện trên cảm ứng) và một `span.sr-only` đứng cạnh. `00-foundation.md` §10 yêu cầu nút bị khóa có lý do truy cập được bằng `aria-describedby`. Tài liệu 04 §8 nói "nút khóa là aria-disabled" chưa đúng với nút `<button>`.
Cách sửa: dùng `aria-disabled="true"` + chặn click cho cả `<button>` (như nhánh `<a>`), giữ focus; hiện lý do ngay dưới nút hoặc bằng tooltip mở được bằng focus/chạm.

**F4-22 · Minor · badge sai mục đích/không nhất quán**
(a) `g3-inv-03.html:56-60`: loại biến động thẻ kho dùng `badge--info`/`badge--success`/`badge--neutral` ("Nhập kho" xanh lá không phải thành công): dùng tag Neutral + icon. (b) `g3-inv-09.html:50`: "Nhận một phần" là `tag--info`, trong khi cùng trạng thái ở đơn mua là `badge--warning` (PUR-06:22): thống nhất theo Phụ lục A. (c) `g3-inv-19.html:40-41`: badge chứa giá và ngày ("640.000 ₫ từ 01/11/2026"), không phải trạng thái: dùng badge "Sắp hiệu lực"/"Chờ duyệt" kèm text giá ngoài badge. (d) `g3-inv-12.html:39` và `g3-inv-14.html:55`: "Đã nhận" Success đi kèm tag "Đã đóng" thừa. (e) `g3-inv-16.html:37-39`: "Đã đếm" Success; chấp nhận nhưng nên Neutral hoặc Info để không trùng "thành công". (f) Bộ badge của chứng từ kho, yêu cầu mua, đơn mua, phiếu chuyển, kiểm kê, công, hoa hồng, kỳ công cần thay theo Phụ lục A.
Cách sửa: áp Phụ lục A; thêm vào `00-foundation.md` §6.

**F4-23 · Minor · dữ liệu mẫu mâu thuẫn**
- `g3-pur-03.html:34`: "Chờ duyệt 1 giờ 25 phút" nhưng gửi lúc 08:50 và cập nhật 09:15 (25 phút).
- `g3-pur-05.html:66`: "Phần đã nhận qua PN-Q7-2610-00033" thuộc DM-Q7-2610-00012 (INV-03:58); đơn DM-…00014 có PN-…00031 và PN-…00034.
- `g3-inv-17.html:30, 36`: "12 mã đã đếm" nhưng 1 mã lệch + "8 mã còn lại khớp" = 9.
- `g3-pur-02.html:38` và `g3-pur-03.html:41`: "không có chi nhánh nào dư" cho PT-0003, trong khi `g3-inv-05.html:41` cho Thủ Đức dư 20 khả dụng cùng mã: luồng bỏ qua chính sách ưu tiên chuyển kho (câu 7) mà không cảnh báo.
- `g3-inv-06.html:35-38`: lệnh RO-00126 đã là "Tạm dừng" nhưng alert viết "nên tạm dừng".
- `g3-hrm-04.html:52` nói kỳ 16–31/10 "đang khóa"; HRM-08 nói kỳ này Đang mở; `g3-hrm-10.html:24` kỳ 16–30/10 khác HRM-08 16–31/10.
- `g3-pur-06.html:67`: xem F4-03.
Cách sửa: chỉnh dữ liệu; ở PUR-02 khi có chi nhánh dư, hiện alert "Chi nhánh X còn dư N; vẫn mua cần ghi lý do".

**F4-24 · Minor · in ấn · `pack.css:107-112`; `g3-inv-18.html`**
`@media print` ẩn khung nhưng `#g3-body` (cả trang) vẫn in cùng khổ giấy trong hộp thoại, nên "In" ở INV-07/09 in cả form lẫn phiếu. INV-18 chưa có mẫu nhiệt 80 mm (câu 20), chưa có mẫu CK/biên bản, KK, DC, TR, DM.
Cách sửa: ẩn mọi thứ ngoài `.g3-paper` khi `.overlay.is-open`; thêm mẫu nhiệt cho BL; lập danh sách mẫu theo bảng câu 20 (G2-PRT).

**F4-25 · Minor · mã mẫu**
Mã phụ tùng mẫu `PT-0001` trùng chữ với tiền tố phiếu thu `PT-…` (khác định dạng, nhưng tìm kiếm toàn cục `PT` lẫn lộn). Mã phụ tùng thật do khách quy ước: đổi mẫu (ví dụ `LD-0001`) hoặc ghi "mã phụ tùng khác định dạng LOẠI-MÃCN-YYMM-STT".

**F4-26 · Minor · CSS/hiển thị**
(a) `pack.css:68` `.g3-cell--off` dùng `--color-text-disabled` cho chữ "Nghỉ" mang nghĩa nghiệp vụ: tương phản thấp, dùng `--color-text-secondary`. (b) `pack.css:7` ghi đè `.tab[aria-current="page"]` cho mọi tab, kể cả tab nội dung: nên giới hạn `.g3-subnav .tab`. (c) `g3-hrm-04.html:35-38` và HRM-05 dùng `.cell-sub` trong `th` của `.g3-matrix` (không nằm trong `.table`) nên không áp dụng kiểu `.table .cell-sub`. (d) `pack.js:237`: Khả dụng < 0 chỉ hiện "Hết hàng", chưa có cảnh báo "dữ liệu tồn lệch" như ba-decisions câu 4. (e) Bottom nav mobile (`pack.js:127`) không có mục Nhân sự.

**F4-27 · Minor · `g3-hrm-10.html:21, 50`**
Câu "Số này khớp bảng công của cùng kỳ" chỉ đúng khi mọi phương pháp là giờ chuẩn: "Giờ chuẩn bán ra" ≠ "Công" khi dùng khoán, giờ thực được duyệt (câu 13). Công thức cần định nghĩa đầu vào (giờ có mặt, giờ thực làm, giờ chuẩn bán ra) ngay dưới KPI; mẫu số 0 hiện "–". Thanh màu cảnh báo (cam ở học việc) chưa có chú giải ngưỡng.
Cách sửa: thay câu bằng "Giờ chuẩn bán ra lấy từ hạng mục đã QC trong kỳ"; thêm tooltip định nghĩa; chú giải ngưỡng cấu hình.

**F4-28 · Minor · `g3-inv-10.html:51` so với `:62-64`; `g3-inv-09.html:48`**
INV-10: nút chính "Xác nhận hoàn kho" nhưng hậu quả là "chờ QL duyệt": đổi nhãn "Gửi duyệt hoàn kho" khi cần duyệt (BS-4) và "Ghi sổ hoàn kho" khi không. INV-09: thiếu cột/ô **chất lượng** (hàng lỗi, giao sai) trên dòng nhận, Journey §4 bước 2 "đối chiếu số lượng và chất lượng"; không có cột này nên PUR-08 không có dữ liệu nguồn để gợi ý trả hàng.

**F4-29 · Minor · `g3-inv-06.html:56-63`; `g3-hrm-07.html:28, 38-44`**
(a) "Báo thiếu và tạm dừng lệnh" do TK thực hiện thay đổi trạng thái lệnh trong khi TK chỉ có quyền X trên lệnh (FRD §2): ghi rõ là sự kiện hệ thống (BS-2). (b) HRM-07 mọi dòng `data-g3-hide` cho CV nên CV mở thấy bảng rỗng (không có trạng thái rỗng) dù vai trò CV nằm trong danh sách mở được: gỡ CV khỏi HRM-07 (CV xem hoa hồng ở HRM-09) hoặc hiện empty "Cố vấn xem phần của mình ở Hoa hồng".

**F4-30 · Minor · `docs/ui-ux/04-inventory-purchasing-hr.md`**
Cập nhật theo ba-answers-04: §3 cột Vai trò (thêm CV ở INV-01, 19; MH/NS), §4 bộ badge (thay bằng Phụ lục A), §10 (A-01, A-02, A-03, A-04, A-07, A-08, A-09, A-10, A-13 đổi theo câu 2, 5, 1, 7, 13, 14, 15, 16), §11 chuyển thành "đã trả lời". Tài liệu §8 nói tương phản/aria-disabled đã đạt: sửa theo F4-21, F4-26. §9 điểm 6 (mã tạm YM, DC, TR) đã chốt.

**F4-31 · Minor · phân tách nhiệm vụ · `g3-inv-16.html:46`; `g3-inv-17.html:49`; `g3-hrm-04.html:45-47`**
QL được đếm kiểm kê (INV-16) và duyệt điều chỉnh (INV-17); QL sửa giờ chấm công cả của chính mình (HRM-04). Cách sửa theo BS-3: chặn tự duyệt/tự sửa, chuyển cấp trên.

## 6. Rủi ro bảng → thẻ trên mobile (card sinh bằng JS) · F4-18

`cards()` (`pack.js:260-285`) đọc DOM của bảng một lần lúc `G3.init()` rồi chèn danh sách `record` cạnh bảng; CSS ẩn bảng ở mobile (`table-wrap--responsive`). Rủi ro cụ thể:
1. **Mất cột lặng lẽ**: cột không có `data-card` bị bỏ, không có cảnh báo (F4-02, F4-12; HRM-07 cột "Ghi chú", HRM-08 giờ ca không vào thẻ).
2. **Không cập nhật khi dữ liệu đổi**: lọc, sắp xếp, phân trang, làm mới tại chỗ chỉ đổi bảng; thẻ giữ dữ liệu cũ. Nút sắp xếp và thanh công cụ trong khung bảng bị ẩn ở mobile, nên không có cách sắp xếp.
3. **Thao tác bị mất**: ô chọn dòng, ô nhập (số lượng đề xuất), nút trong ô chỉ còn được nhân bản dưới dạng HTML tĩnh; thanh bulk không dùng được.
4. **Liên kết lồng nhau**: thẻ là `<a class="record" href=…>` chứa nguyên `innerHTML` của ô, mà ô thường đã có `<a>` (INV-04:54-62, PUR-07:30-32): HTML không hợp lệ, hai điểm dừng Tab, trình đọc màn hình đọc đôi.
5. **Trùng nội dung/ARIA**: bảng ẩn và thẻ cùng chứa `aria-label`, `data-*`, `id` (nếu có); chạy `applyRoleBits` trên cả hai.
6. **Thứ tự và nhãn**: nhãn trường lấy từ `th.textContent` kèm phụ đề `cell-sub` (HRM-10) nên chuỗi nhãn dài ("Hiệu suấtchuẩn ÷ thực").
7. **Chớp nội dung**: thẻ xuất hiện sau khi script chạy, có thể nháy.
Khuyến nghị cho bàn giao: dev dựng thẻ từ cùng mô hình dữ liệu với bảng (một component, hai bố cục), mỗi cột khai báo vị trí thẻ hoặc `none` rõ ràng (kiểm lint cột thiếu khai báo), không lồng `<a>`, kiểm tay ở 375 px trên các màn D/M: INV-01, 04, 05, PUR-03. Trong prototype: bổ sung `stock4` (F4-02), thẻ riêng INV-05 (F4-12), bỏ `<a>` bên trong thẻ khi `data-href` có mặt.

## 7. Rủi ro dựng shell bằng `document.write` · F4-19

`G3.shell/top/tail` ghi sidebar, topbar, breadcrumb, subnav và bottom nav bằng `document.write` (`pack.js:111, 124, 127`), gọi từ script nội tuyến trong thân trang. Chạy được bằng `file://` nhưng:
1. **Phụ thuộc thứ tự phân tích**: hỏng nếu `pack.js` được đặt `defer`, `async` hoặc `type="module"`, hoặc gọi sau khi tải xong (ghi đè cả trang). Chrome còn có thể chặn `document.write` của script chéo miền khi mạng chậm.
2. **Không có JS thì trang trống** (không `<noscript>`): chấp nhận trong prototype.
3. **Lệch với shell chuẩn**: markup được chép lại từ `foundation/shell.html` bằng chuỗi; mọi thay đổi shell (menu, branch selector, thông báo) phải sửa hai nơi. Một số nội dung bị hard-code cho gói này (đếm "5", "8", ba thông báo mẫu, tên "Trần Thị Mai Anh").
4. **CSP và công cụ**: không dùng được với chính sách chặn script nội tuyến; công cụ kiểm tra tĩnh (axe, HTML validator) chỉ thấy trang sau khi script chạy.
5. **Điều hướng**: landmark (`aside`, `header`, `nav`, `main`) do JS sinh nên liên kết "Bỏ qua điều hướng" phụ thuộc thứ tự ghi.
Khuyến nghị: giữ chỉ cho prototype, thêm `<noscript>` thông báo, ghi rõ trong `04-...md` rằng dev **không** sao chép markup từ `pack.js` mà lấy từ `foundation/shell.html`; kiểm tra tự động mỗi trang có đúng một `aside.sidebar` và `main#main` sau khi tải. Bổ sung Nhân sự vào bottom nav mobile (F4-26e).

## 8. Thứ tự sửa đề xuất

1. Blocker: F4-01, F4-02 (và F4-12 cùng cơ chế `cards()`).
2. Quyết định vừa chốt cần thể hiện: F4-03, F4-04, F4-05, F4-06, F4-07.
3. Luồng nghiệp vụ: F4-08, F4-09, F4-10, F4-11; HRM: F4-13, F4-14, F4-15, F4-16.
4. Phần còn lại Minor trong một lượt dọn, cùng cập nhật `04-inventory-purchasing-hr.md` (F4-30) và các tài liệu nêu ở `ba-answers-04.md` Phụ lục G.

## 9. Việc BA chưa làm (theo ranh giới)

Chưa sửa `design-system.md`, `00-foundation.md`, `ba-decisions.md`, `screen-inventory.md`, `user-journey-business-workflow.md`, `functional-requirements.md`; chưa thêm FR/UAT mới. Danh sách cần cập nhật khi chủ dự án xác nhận ở `ba-answers-04.md` Phụ lục G. Các quyết định chờ khách xác nhận (không đổi thiết kế cấu hình): phương pháp giá vốn, công thức công/hoa hồng và đơn vị công, chính sách chi nhánh dư, chu kỳ kỳ công, hạn mức, người chịu giá trị khi hàng chuyển thất lạc, chính sách khách trả phụ tùng.
