# Đề xuất thay đổi cho FRD, BRD, Journey và design-system

Phiên bản 0.1 · Ngày 30/10/2026 · Người lập: BA · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án). **Chưa áp dụng vào bất kỳ tài liệu nào dưới đây**; BA sẽ áp dụng khi được yêu cầu.

Tài liệu đích: `docs/functional-requirements.md` (FRD), `docs/business-requirements.md` (BRD), `docs/user-journey-business-workflow.md` (Journey), `docs/design-system.md`.

Nguồn đề xuất: `ba-decisions.md` (v0.2, kể cả mục E), `ba-answers-01…06.md`, `screen-inventory.md` §5–§6, `ui-ux-flow.md` Phụ lục A và C, các `review-0N-roundM-ba.md`.

## 0. Cách đọc

- **Ưu tiên đề xuất**: **Cao** = đang có mâu thuẫn giữa các tài liệu hoặc chặn nghiệm thu/UAT của Phase 1; **Trung** = cần xong trước khi dev phân hệ đó; **Thấp** = làm sạch, không chặn.
- Mã `FR-…` ở mục B là mã đề xuất **đã gán lại** để không trùng (xem B.1). Không đổi số các id đang có; mã mới thêm ở cuối từng phân hệ.
- Mỗi đề xuất ghi căn cứ (file hoặc finding). Mọi mục `[Cần xác nhận]` giữ nguyên, không được BA quyết thay khách; mục nào là quyết định mới của BA thì ghi "chờ xác nhận".

## Tóm tắt

| Mục | Tài liệu đích | Số đề xuất |
| --- | --- | --- |
| B | FRD: FR mới (SYS, RPT, REC, ACC, INV, PUR, HRM) | 28 |
| C | FRD: sửa FR hiện có, §2, §13, NFR, UAT, truy vết | 18 |
| D | BRD | 4 |
| E | Journey | 9 |
| F | design-system | 6 |
| **Tổng** | | **65** |

## B. FR mới đề xuất (FRD)

### B.1 Trùng mã giữa các `ba-answers` và cách gán lại

Các `ba-answers-0N.md` được viết độc lập nên dùng cùng một mã cho nội dung khác nhau. Bảng gán lại dưới đây là bản duy nhất để dùng.

| Mã | Dùng cho (ở đâu) | Gán lại |
| --- | --- | --- |
| FR-SYS-019 | Lời mời/đặt lại mật khẩu (`ba-answers-01`) và Nhật ký in (`ba-answers-03`) | 019 = lời mời/mật khẩu; nhật ký in chuyển sang **FR-SYS-024** |
| FR-REC-037 | Cố vấn phụ trách (`ba-answers-01`), Thuộc tính duyệt phát sinh (`ba-answers-03`), Hủy lệnh tính phí (`ba-answers-02`) | 037 = thuộc tính duyệt phát sinh; cố vấn phụ trách **040**; hủy lệnh **041** |
| FR-REC-038 | Bảo hành theo hạng mục (`ba-answers-03`), Tạm dừng kèm lý do (`ba-answers-02`) | 038 = bảo hành; tạm dừng kèm lý do **042** |
| FR-REC-039 | Biên bản giao xe (`ba-answers-03`), Phụ tùng khách cung cấp (`ba-answers-02`) | 039 = biên bản giao xe; phụ tùng khách cung cấp **043** |
| FR-ACC-021 | Mở ca với tiền đầu ca (`ba-answers-01`), Đảo bút toán (`ba-answers-05`) | 021 = đảo bút toán; mở ca **025** |

### B.2 Danh sách FR mới (28)

Viết theo định dạng bảng FRD: Mã · Nội dung · MoSCoW · Tiêu chí nghiệm thu · BR. Cột cuối thêm giai đoạn đề xuất, ảnh hưởng (workflow/UAT/màn hình) và ưu tiên đề xuất.

| Mã | Nội dung | MoSCoW | Tiêu chí nghiệm thu | BR | Giai đoạn · Ảnh hưởng · Căn cứ | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- |
| FR-SYS-019 | Lời mời kích hoạt tài khoản (72 giờ, một lần), quên và đặt lại mật khẩu (30 phút, một lần), mật khẩu tạm; thông báo luôn trung lập | Must | Liên kết hết hạn/đã dùng không lộ việc tài khoản có tồn tại; không có tự đăng ký | BR-SYS-01 | P1 · UAT mới · G1-AUT-04/05/06/07 · `ba-answers-01` §D, D-01, D-03 | Cao |
| FR-SYS-020 | Phiên làm việc: khóa màn hình theo thời gian không hoạt động, hết phiên tuyệt đối, giới hạn đăng nhập sai, mở khóa; nháp được giữ | Must | Thử mật khẩu từ nhiều thiết bị bị làm chậm/khóa; sau khóa chỉ nhập lại mật khẩu khi chưa quá hạn tuyệt đối; các số là tham số cấu hình | BR-SYS-01 | P1 · G1-AUT-09 · `ba-answers-01`, D-05 | Cao |
| FR-SYS-021 | Trung tâm thông báo: ma trận sự kiện × vai trò, hai mức "Cần xử lý"/"Thông tin", thời hạn lưu (mở rộng FR-SYS-008) | Should | Người dùng không nhận thông báo ngoài phạm vi quyền; kênh chưa cấu hình hiện "Chưa kích hoạt" | BR-SYS-03 | P1 (trong hệ thống), P2 (email/Zalo) · G1-NTF-01/02 · `ba-answers-01`, D-07 | Trung |
| FR-SYS-022 | Thiết bị xưởng: đăng ký bằng mã ghép, PIN 6 số, tự khóa, thu hồi | Must (nếu Phase 1 có tablet xưởng) | Tablet mất bị thu hồi thì không đăng nhập được; mốc giờ gắn đúng người | BR-SYS-01, BR-HRM-03 | P1 · G1-AUT-10, G4-SYS-03/24 · `ba-answers-01`, D-04 | Cao |
| FR-SYS-023 | Ghi nhận đồng ý quy định sử dụng/bảo mật theo phiên bản | Should | Phiên bản quy định mới yêu cầu đồng ý lại | BR-SYS-02 | P1 · G1-AUT-06 · `ba-answers-01` | Trung |
| FR-SYS-024 | Nhật ký in: mỗi lần in ghi ai, khi nào, khổ, máy hoặc PDF, số bản, lần thứ mấy; bản in lại có chữ "BẢN IN LẠI (lần n)"; lý do bắt buộc với biên bản giao xe và chứng từ tài chính | Should | Chứng từ in lần 2 mang chữ BẢN IN LẠI và có dòng nhật ký | BR-SYS-02 | P1 · G2-PRT-01 · UAT in lại · `ba-answers-03` (đang trùng mã 019) | Trung |
| FR-SYS-025 | Nhật ký khi "Hiện" dữ liệu cá nhân bị che (SĐT, địa chỉ, dữ liệu nhân sự): ai, khi nào, bản ghi, lý do (bắt buộc với KT); tự che lại sau 30 giây; xuất mặc định đã che | Must | Hiện không có lý do (KT) bị từ chối; dòng nhật ký truy cập tồn tại; giá trị đầy đủ không có trong phản hồi trước khi Hiện (BA viết) | BR-SYS-02, NFR-SEC-03 | P1 · mọi màn có SĐT/địa chỉ, G4-SYS-04/19 · `ba-decisions` câu 8, `ba-answers-04` Phụ lục G | Cao |
| FR-SYS-026 | Quy trình duyệt cấu hình có ngày hiệu lực (ba nhóm duyệt, bản nháp, ngày hiệu lực quá khứ cần duyệt cao hơn và không đổi chứng từ đã tạo) và khóa chi nhánh hai bước (ngừng nhận lệnh mới, rồi khóa khi hết mục treo) | Should | Cấu hình ở nhóm cần duyệt không có hiệu lực khi chưa duyệt; khóa chi nhánh bị chặn khi còn mục treo (BA viết, chi tiết lấy từ `ba-answers-06` Câu 2 và Phụ lục A.1 khi áp dụng) | BR-SYS-01 | P1 (cơ bản) · G4-SYS-05/06/09/11/13, FR-SYS-011 · `ba-answers-06`, `review-06-round3-ba.md` | Trung |
| FR-RPT-017 | Định nghĩa nhãn "Số tạm"/"Số chính thức" (chính thức chỉ khi mọi ngày × chi nhánh trong phạm vi đã chốt; lấy theo trường hợp xấu nhất) và dòng "Cách tính" trên KPI | Must | KPI hiện nhãn đúng và tooltip nêu chi nhánh/ngày chưa chốt; không có nhãn gộp sai | BR-RPT-01 | P1 · mở rộng UAT-07 · G1-DSH-*, G4-RPT-* · `ba-answers-01` Câu 5; RULE-015 | Cao |
| FR-REC-037 | Thuộc tính duyệt của hạng mục phát sinh (Chờ khách duyệt, Đã duyệt, Từ chối, Hết hạn); hạn duyệt cấu hình (mẫu 24 giờ); hết hạn tự chuyển và vào lưu nhắc; còn phát sinh Chờ thì không Sẵn sàng bàn giao | Must | Phát sinh quá hạn tự chuyển Hết hạn và biến khỏi việc của thợ; lệnh còn phát sinh Chờ không chuyển Sẵn sàng bàn giao | BR-REC-04 | P1 · WF-03, UAT-03 · G2-QUO-07, TEC-01/02, REC-04 · `ba-answers-03` Câu 3 | Cao |
| FR-REC-038 | Chính sách bảo hành theo hạng mục (thời gian, km, cách tính "đến trước") có ngày hiệu lực; trạng thái bảo hành tự tính (Còn hạn, Sắp hết hạn, Hết hạn, Vô hiệu) | Should | Đổi chính sách không đổi bảo hành đã giao; "tháng hoặc km đến trước" hết hạn đúng khi km vượt | BR-REC-08 | P2 · UAT-24 · G2-DLV-05/06 · `ba-answers-03` Câu 4; bảo hành chéo chi nhánh vẫn `[Cần xác nhận]` | Trung |
| FR-REC-039 | Biên bản giao xe: mã BB, một biên bản hiệu lực mỗi lệnh, người nhận (chủ hoặc người ủy quyền kèm xác minh), biên bản điều chỉnh khi sai (không sửa bản gốc) | Should | Giao cho người ủy quyền bắt buộc họ tên, SĐT, quan hệ, ảnh giấy ủy quyền (cấu hình); sửa chỉ qua biên bản điều chỉnh có lý do | BR-REC-07 | P1 · WF-04, WF-05; RULE-010 · G2-DLV-04, PRT-01 · `ba-answers-03` Câu 9 | Trung |
| FR-REC-040 | Trường "Cố vấn phụ trách" trên lệnh (mặc định người tiếp nhận; QL gán lại; ghi nhật ký) | Should | KPI "Xe của tôi" khớp lệnh mở có cố vấn là mình | BR-REC-06 | P1 · G1-DSH-04 · `ba-answers-01` | Trung |
| FR-REC-041 | Hủy lệnh sau khi đã xuất phụ tùng: người đề xuất khác người duyệt; chặn khi lệnh có hóa đơn hiệu lực hoặc ở Chờ QC trở đi; mỗi phụ tùng đã xuất có phiếu hoàn kho hoặc đánh dấu đã dùng; tính phí phần đã thực hiện là cấu hình, mặc định tắt `[Cần xác nhận]` | Should | Gửi duyệt hủy bị khóa khi thiếu phiếu hoàn kho/còn hóa đơn; không tự duyệt | BR-REC-05 | P1 · Journey §8 · UAT mới · G2-REC-06 · `ba-answers-02` A.1–A.2, C | Cao |
| FR-REC-042 | Tạm dừng lệnh/hạng mục kèm lý do là danh sách cấu hình (Chờ phụ tùng, Chờ khách duyệt phát sinh, Chờ thợ, Khác); lọc và đếm theo lý do (bổ sung FR-REC-015) | Should | "Xe chờ phụ tùng" = lệnh Tạm dừng có lý do Chờ phụ tùng | BR-REC-06 | P1 · Journey §7 · G1-DSH-03/04, G2-REC-03 · `ba-decisions` A.1 | Cao |
| FR-REC-043 | Phụ tùng khách cung cấp là dòng lệnh riêng (không xuất kho, không giá vốn, có công lắp) | Could | Dòng không làm đổi tồn; vẫn hiện trên lệnh và biên bản | BR-INV-09 (theo `ba-answers-02`; BA kiểm lại số BR, BRD hiện có BR-INV-12) | P2+ · G2-REC-04 · `ba-answers-02` C | Thấp |
| FR-ACC-021 | Đảo bút toán phiếu thu/phiếu chi: phiếu gốc giữ nguyên, tạo bút toán đảo liên kết có lý do, người duyệt theo ma trận | Must | Phiếu đã ghi sổ không xóa được; đảo tạo đúng một bút toán đảo dù bấm nhiều lần; số dư quỹ và công nợ đúng sau đảo | BR-ACC-01 | P1 · RULE-010 · G4-ACC-03/04 · `ba-answers-05` | Cao |
| FR-ACC-022 | Khoản nhận trước của khách (thu vượt thật): bù vào lệnh sau của cùng khách hoặc hoàn lại có duyệt; không chuyển giữa khách | Should | Phần dư hiện đúng số trên hồ sơ khách; bù trừ không vượt số dư | BR-ACC-09 | P2 (chip ở ACC-01 là P1) · G4-ACC-01/03/11/21 · `ba-answers-05` Câu 5 | Trung |
| FR-ACC-023 | Điều kiện chặn/cảnh báo khi khóa ngày/kỳ là cấu hình có ngày hiệu lực; mở lại ngày/kỳ qua đề nghị + CH duyệt, có hạn (mẫu 48 giờ) và tự khóa lại | Must | Đổi điều kiện từ cảnh báo sang chặn không cần sửa mã; mở lại quá hạn tự khóa lại | BR-ACC-05 | P1 (ngày), P3 (kỳ) · UAT-07 · G4-ACC-09/17 · `ba-answers-05` Câu 1–2 | Cao |
| FR-ACC-024 | Dòng tiền mặt có "khách đưa" và "tiền thối"; chỉ phần thu thật vào phiếu thu | Could | Tiền thối không làm sai số quỹ | BR-ACC-01 | P2+ · G4-ACC-01 · `ba-answers-05` Câu 5 | Thấp |
| FR-ACC-025 | Mở ca với tiền đầu ca; mỗi thu ngân một ca mở tại một thời điểm | Must | Không thu tiền khi chưa mở ca; chốt ca đối chiếu với tiền đầu ca | BR-ACC-05 | P1 · UAT-07 mở rộng · G4-ACC-08, G1-DSH-08 · `ba-answers-01` (đang trùng mã 021) | Cao |
| FR-INV-029 | Trạng thái yêu cầu phụ tùng của thợ: Đã gửi, Thủ kho đã nhận, Đã xuất một phần, Đã xuất đủ, Thiếu hàng, Đã hủy; Thiếu hàng tự đặt hạng mục Tạm dừng lý do Chờ phụ tùng; lệnh chỉ Tạm dừng khi không còn việc làm tiếp | Should | Thiếu hàng làm hạng mục Tạm dừng · Chờ phụ tùng; vượt Khả dụng không xuất được (RULE-008) | BR-INV-04 (theo `ba-answers-03`) | P1 · WF-02 · G2-TEC-03, G3-INV-06 · `ba-answers-03`; màu Thiếu hàng = Warning (`ba-decisions` A.2b) | Trung |
| FR-INV-030 | Xử lý chênh lệch chuyển kho: biên bản nhận thiếu/hỏng, chênh lệch treo trên hàng đang vận chuyển; QL bên nhận đề xuất, QL bên gửi đồng thuận; khác vùng hoặc vượt ngưỡng QV/CH duyệt; kết quả Chờ bù/Ghi mất/Hàng hỏng/Điều chỉnh | Should | Phiếu chỉ đóng khi xử lý xong chênh lệch; tồn kho nhận chỉ tăng theo số xác nhận nhận | BR-INV-05 | P2 · UAT-04 · G3-INV-14 · `ba-answers-04` Phụ lục G (chuyển giữa hai pháp nhân `[Cần xác nhận]`) | Trung |
| FR-INV-031 | Hiển thị Khả dụng liên chi nhánh: chỉ số "có thể cho" và "tính đến", mặc định bật cùng công ty/nhóm; không lộ Tồn thực tế/Giữ chỗ của chi nhánh khác | Should | Người dùng chỉ thấy chi nhánh trong phạm vi quyền (NFR-ISO-01) | BR-INV-05, BR-INV-14 | P2 · G3-INV-03 tab "Chi nhánh khác" · `ba-answers-04`, `review-04-round3-ba.md` | Trung |
| FR-PUR-009 | Mua gấp: yêu cầu mua đánh dấu Mua gấp cho phép mua trước, hậu duyệt trong N giờ làm việc (mẫu 24, cấu hình); ảnh hóa đơn bắt buộc; người đề xuất không tự duyệt; không chấp nhận thì gắn cờ cho Kế toán | Should | Trạng thái "Chờ hậu duyệt" lọc/đếm được; quá hạn nhắc và chuyển cấp (FR-SYS-015) | BR-PUR-01 | P2 · Journey §4 · G3-PUR-01/03, G3-INV-09 · `ba-answers-04`, `review-04-round3-ba.md` F4R3-01 | Trung |
| FR-HRM-017 | Chu kỳ kỳ công, điều kiện khóa và mở lại kỳ công (kèm "Chờ mở lại"/"Đã mở lại"), điều chỉnh bằng bút toán sau khi khóa | Should | Kỳ đã khóa không sửa trực tiếp; mở lại có duyệt và nhật ký | BR-HRM-03 | P2 · FR-HRM-010 liên quan · G3-HRM-07/08 · `ba-answers-04` Phụ lục G | Trung |
| FR-HRM-018 | Định nghĩa ba chỉ số năng suất (giờ chuẩn bán ra, giờ thực làm, giờ có mặt) và công thức hiển thị | Should | Mỗi chỉ số hiện công thức và đi sâu được; có ví dụ ký xác nhận (NFR-MNT-01) | BR-HRM-05 | P2 · G3-HRM-10, G4-RPT-08 · `ba-answers-04` Phụ lục G | Thấp |
| FR-HRM-019 | Nhập bù giờ công: khi thợ mất mạng không ghi được giờ (Phase 1), thợ khai giờ thực, Quản đốc xác nhận (≤ 15 phút) hoặc QL duyệt (> 15 phút), thợ xác nhận lại bằng PIN; nhãn "Nhập bù", lý do bắt buộc, nhật ký trước/sau; báo cáo số lần nhập bù theo thợ | Must (nếu Phase 1 có tablet xưởng) | Không có mốc giờ nào ghi theo giờ thiết bị; mốc nhập bù không xóa được; ngưỡng là tham số | BR-HRM-03 | P1 · WF-08 · G1-DSH-07, G2-TEC-01/02 · `ba-decisions.md` E.1, `ba-answers-01` Câu 4 và 6 | Cao |

## C. Thay đổi khác cho FRD (18)

| # | Vị trí | Thay đổi đề xuất | Căn cứ | Ưu tiên |
| --- | --- | --- | --- | --- |
| C-01 | FRD §13 "Phạm vi giai đoạn 1" | Đưa **thu tiền, sổ quỹ, chốt ca/ngày** vào Phase 1: FR-ACC-001, 002 (cọc), 003, 004 ở mức một chi nhánh, cộng FR-ACC-021, 023 (phần ngày), 025; EIN giữ như hiện có (FR-EIN-001…006, 011, 013). Giữ FR-ACC-005 (khóa kỳ) ở Phase 3, ACC-006…019 ở Phase 2 | `screen-inventory.md` G-01 và D-14; `ui-ux-flow.md` C-11; UAT-01, UAT-07; Journey bước 11–13; RPT-003 cần tổng phiếu thu | Cao |
| C-02 | FRD §13 | Xếp giai đoạn cho FR mới ở mục B (cột "Giai đoạn"); cập nhật bảng "Tổng hợp theo phân hệ" (số FR theo MoSCoW) | Mục B | Cao |
| C-03 | FRD §2 ghi chú | Ghi quyền **lập** của KT: KT được lập đề xuất hoàn tiền chuyển khoản và bù khoản nhận trước nhưng **không ghi tiền mặt, không duyệt**; người lập ≠ người duyệt; chỉ có một kế toán thì chuyển Chủ garage duyệt. Thêm: QĐ không có Thu tiền/Hóa đơn; CV xem trạng thái thu của lệnh mình xử lý | `ba-answers-05` (tách nhiệm vụ); `ba-answers-02` C ("Câu 11"); `ui-ux-flow.md` A.1 | Trung |
| C-04 | FRD §2 | Tách hàng "Người dùng, phân quyền, cấu hình" thành (a) "Người dùng và phân quyền" (như cũ) và (b) **"Danh mục và cấu hình nghiệp vụ dùng chung"** (thuế, giờ chuẩn, giá, hạn mức, mẫu in…): KT S (thuế, mẫu kế toán), QV đề xuất (hạn mức), QL S trong chi nhánh, CV/QĐ/TK X tùy màn, AD S kỹ thuật; ghi chú: QL không sửa hạn mức giảm giá | `ba-answers-06` Câu 1 và Phụ lục B; `ui-ux-flow.md` C-13; hiện KT, QV "-" nhưng G4-SYS giao quyền cho họ | Cao |
| C-05 | FRD §2 ghi chú | Ghi **quyền duyệt của CH/QV/QL**: mức duyệt theo hạn mức cấu hình; người đề xuất không tự duyệt, nếu QL là người đề xuất thì chuyển QV (nhóm) hoặc CH (pilot một chi nhánh); QV đề xuất, CH duyệt thay đổi hạn mức giảm giá; ủy quyền QV mở lại ngày/kỳ theo nhóm chi nhánh, mặc định tắt; chuyển cấp khi quá hạn (FR-SYS-015) | `ba-answers-02` A.2 mục 3; `ba-answers-06` Phụ lục A; `screen-inventory.md` G-06, D-11 | Trung |
| C-06 | FRD §2 | Thêm cột/ghi chú cho MH, NS, QĐ (hiện ma trận 10 cột; bản 0.2 nói MH, NS, QC là vai trò bổ sung nhưng không có hàng): MH S mua hàng, X danh mục, không thấy giá vốn; NS hồ sơ nhân sự; TK không thấy giá vốn. Xác nhận CV "-" ở hàng "Nhập, xuất, kiểm kê kho" | `ba-answers-04` Câu 2, 5, 6 và Phụ lục C; `screen-inventory.md` §4.1 INV-04 | Trung |
| C-07 | FR-ACC-009 | Đổi "mặc định theo chính sách hiện hành" thành: có thể có **giá trị gợi ý ở trạng thái Nháp**, chỉ hiệu lực khi KT nhập/ký và CH duyệt | `ba-answers-06` Phụ lục B; `ui-ux-flow.md` C-13; mâu thuẫn với G4-SYS-10 | Trung |
| C-08 | FR-RPT-010 | Bỏ `[Cần xác nhận]`, nâng lên **Must** (RULE-015 là Must); tham chiếu FR-RPT-017 | `ba-answers-01` Câu 5; `ba-answers-06` Phụ lục B | Cao |
| C-09 | FR-RPT-012, FR-RPT-016 | Bổ sung định nghĩa chỉ số theo `ba-answers-06` Câu 4; thêm UAT: đã thu + công nợ = doanh thu; "Không áp dụng" ở RPT-05 | `ba-answers-06` Câu 4 và Phụ lục B | Trung |
| C-10 | FR-SYS-010 | Làm rõ khôi phục "theo thời điểm" (ngày + giờ); RPO/RTO sau khi khách xác nhận (giữ `[Cần xác nhận]`) | `ba-answers-06` Câu 12, Phụ lục B | Thấp |
| C-11 | NFR-OFF-01 (hai dòng: §11 "Giai đoạn 2 trở đi" và bản 0.3 "Chốt sau") | Thống nhất một dòng: **Phase 1** chỉ cảnh báo mất mạng và lưu nháp; thợ **không ghi được mốc giờ** khi mất mạng (phiếu giấy, nhập bù có xác nhận, FR-HRM-019); **Phase 2+** mới có hàng đợi/đồng bộ ("nhập bù có dấu hiệu" của dòng hiện hữu). Offline đầy đủ là phạm vi riêng | `ba-decisions.md` E.1; `ui-ux-flow.md` C-3; hai dòng NFR-OFF-01 hiện đang khác nhau | Cao |
| C-12 | FR-REC-030 | Mở rộng định dạng mã `LOẠI-MÃCN-YYMM-STT` và liệt kê tiền tố (RO, BG và hậu tố -vN, PT, PC, PN, PX, CK, YK, KK, DC, HK, TR, XN, YM, DM, BL, BB; LH, CD, TX theo `ba-answers-02`); số hóa đơn điện tử do nhà cung cấp cấp | `ba-decisions.md` câu 11; `ba-answers-02` C; `ba-answers-03` Câu 9; `ba-answers-04` Phụ lục B | Trung |
| C-13 | FR-REC-015, FR-REC-023 | Thêm tiêu chí: lệnh **tự** Đã duyệt → Đang sửa khi hạng mục đầu tiên Đang làm; Đang sửa → Chờ QC **do người bấm**, hệ thống chỉ nhắc khi đủ điều kiện (mọi hạng mục Hoàn thành, phụ tùng đã xuất, không Tạm dừng, không cờ hủy); không hủy từ Chờ QC; Sẵn sàng bàn giao chặn khi còn phát sinh chưa quyết định. FR-REC-023: phiên bản báo giá mới **chỉ khi chưa có hạng mục được duyệt**; đã duyệt thì thay đổi qua báo giá bổ sung (RULE-006) | `ba-answers-02` A.1; `ba-answers-03` Câu 1; `screen-inventory.md` §7.4 (đã sửa); `ui-ux-flow.md` C-4, C-5 | Cao |
| C-14 | FR-REC-007, FR-REC-026 | Làm rõ: **đơn vị duyệt là hạng mục** (nhiều dòng duyệt cùng nhau); "Bắt buộc" là nhãn tư vấn an toàn, khách luôn có quyền không đồng ý nhưng phải qua bước xác nhận và vào lưu nhắc cờ "An toàn"; cấu hình khóa tùy chọn | `ba-answers-03` Câu 2 | Trung |
| C-15 | FR-INS-003 | Ghi nhãn Tốt / Theo dõi / Hỏng kèm màu (xanh/vàng/đỏ) theo Journey §3 | `ba-answers-02` C | Thấp |
| C-16 | FR-CRM-003, FR-REC-003 | CRM-003: quy tắc gộp đồng ý, công nợ; hợp nhất liên chi nhánh do QV/CH (RULE-012). REC-003: cờ "số km bất thường" (mở rộng) | `ba-answers-02` C | Thấp |
| C-17 | FRD "Kịch bản nghiệm thu" | Thêm UAT: thợ mất mạng Phase 1 (nút khóa, khai giờ thực, xác nhận, không giờ thiết bị); chuyển Chờ QC bị chặn khi phụ tùng chưa xuất; hủy lệnh sau xuất kho (có/không hóa đơn); hợp nhất khách khác đồng ý; sau khi duyệt không tạo được phiên bản thay thế (UAT-17 viết lại theo 4 hạng mục, giữ tổng 4.550.000 / 2.050.000); phát sinh bị từ chối/hết hạn (UAT-03); bảo hành ngoài hạn/vô hiệu (UAT-24); in lại; đảo phiếu thu không tạo trùng; mở ca; không nhận thông báo ngoài quyền; liên kết hết hạn không lộ tài khoản | `ba-answers-01…05` (phần "tác động"); `ba-decisions.md` E.1 | Cao |
| C-18 | FRD "Ma trận truy vết yêu cầu" | Thêm hàng cho 28 FR ở mục B (BR, workflow, UAT); giữ nguyên các id hiện có | Mục B | Cao |

## D. BRD (4)

| # | Vị trí | Thay đổi đề xuất | Căn cứ | Ưu tiên |
| --- | --- | --- | --- | --- |
| D-01 | **RULE-007** (hiện: "Phụ tùng xuất phải gắn với lệnh sửa chữa hoặc một lý do xuất kho hợp lệ", tham chiếu FR-INV-006) | Mở rộng: "**Phụ tùng xuất, khoản thu tiền và hóa đơn** phải gắn với một chứng từ gốc hợp lệ (lệnh sửa chữa, phiếu bán lẻ, phiếu chuyển kho; riêng tiền cọc và khoản nhận trước gắn khách theo FR-ACC-002/022)". Tham chiếu thêm FR-ACC-001, FR-EIN-001, FR-ACC-004 (danh sách phiếu chưa chứng từ gốc khi chốt ngày) | `CLAUDE.md` (RULE-007: không có xuất kho, thanh toán, hóa đơn ngoài chứng từ gốc); WF-02; `screen-inventory.md` G4-ACC-09; `ba-answers-01` ("BRD RULE-007 chữ như câu 8") | Cao |
| D-02 | BRD phạm vi và lộ trình Phase 1 (§9) | Đồng bộ với FRD §13 sau C-01: Phase 1 gồm thu tiền cơ bản, sổ quỹ, chốt ca/ngày | `ui-ux-flow.md` C-11; D-14 | Cao |
| D-03 | BRD câu hỏi mở / Discovery | Thêm `[Cần xác nhận]` mới (BA đã có đề xuất mặc định): tính phí khi hủy lệnh, thu đủ trước khi xuất hóa đơn, ngưỡng nhắc, công suất vượt, mốc xử lý yêu cầu chủ dữ liệu, thời hạn giữ chứng từ, hạn mức nợ khách DN (cảnh báo/duyệt/chặn), chất lượng mạng Wi-Fi/4G trong xưởng và số lần mất mạng/ngày, "Đã hủy" là trạng thái thứ 7 của báo giá | `ba-answers-02` C và D; `ba-decisions.md` E.1; `ui-ux-flow.md` A.1–A.2 | Trung |
| D-04 | BRD §8 rủi ro | Thêm rủi ro **gian lận/sai giờ công** (giờ thiết bị, nhập bù lạm dụng) kèm biện pháp: chỉ giờ máy chủ, nhập bù cần Quản đốc/QL xác nhận, báo cáo số lần nhập bù | `ba-decisions.md` E.1; BR-HRM-03 | Trung |

## E. Journey (9)

| # | Vị trí | Thay đổi đề xuất | Căn cứ | Ưu tiên |
| --- | --- | --- | --- | --- |
| E-01 | §7 "Năm đối tượng, năm bộ trạng thái" | Thêm bộ trạng thái của **Lịch hẹn/Tiếp nhận** (giai đoạn trước báo giá, không phải đối tượng thứ sáu): Chờ xác nhận, Đã hẹn, Chờ tiếp nhận, Đã tiếp nhận, Không đến, Đã hủy | `ba-decisions.md` A.1, A.2 | Cao |
| E-02 | §7 dòng Báo giá | Ghi "phiên bản cũ" là thuộc tính (không phải trạng thái); thêm "Đã hủy" làm trạng thái thứ 7 **nếu chủ dự án xác nhận** | `ba-answers-03` Câu 1; `03` §9; `review-03-round3-ba.md` | Trung |
| E-03 | §7 dòng Lệnh | Ghi điều kiện chuyển: tự vào Đang sửa; nhắc Chờ QC (người bấm); không hủy từ Chờ QC; **lý do Tạm dừng** là danh sách cấu hình (Chờ phụ tùng, Chờ khách duyệt phát sinh, Chờ thợ, Khác); cờ "Chờ duyệt hủy" | `ba-answers-02` A.1–A.2; `ba-decisions.md` A.1 | Cao |
| E-04 | §7 dòng Hạng mục | Thêm **thuộc tính duyệt** (Chờ khách duyệt, Đã duyệt, Từ chối, Hết hạn; hạn mặc định 24 giờ) và "Trả lại" sau QC; giữ 5 trạng thái | `ba-answers-03` Câu 3; `ba-decisions.md` A.3 | Cao |
| E-05 | §7 dòng Thanh toán | Đổi nhãn "Chưa thu / thu một phần / đã thu đủ" thành "Chưa thanh toán / Thanh toán một phần / Đã thanh toán / Hoàn tiền"; ghi quy tắc tính theo **thu ròng**, hoàn một phần là tag | `ba-answers-05` Câu 4; `ba-decisions.md` A.2 | Trung |
| E-06 | §7 dòng Hóa đơn | Ghi chỉ báo xử lý đồng bộ nhà cung cấp (đang gửi, lỗi phát hành, chờ truy vấn lại) là **chỉ báo, không phải trạng thái thứ 6**; phát hành idempotent | `ba-decisions.md` A.2 ghi chú; FR-EIN | Trung |
| E-07 | §7 (đối tượng phụ) | Thêm bộ trạng thái của đối tượng phụ để UI và báo cáo dùng chung: yêu cầu cấp phụ tùng (6), yêu cầu mua (kể cả Chờ hậu duyệt), phiếu chuyển kho (kể cả Đang vận chuyển), đợt kiểm kê, kỳ công, bản ghi nhắc (Chưa nhắc, Đã nhắc lần n, Đã đặt hẹn, Bỏ qua, Đã xử lý, Hết hạn nhắc) | `ba-decisions.md` A.2b; `ba-answers-02` (bản ghi nhắc) | Trung |
| E-08 | §4 workflow kho/mua hàng, §5 | Mua gấp (YM + hậu duyệt N giờ làm việc); kiểm kê đếm mù; phân tách nhiệm vụ (người đếm ≠ người duyệt, lập ≠ duyệt); hoàn kho cần duyệt khi lệnh đã hủy/có hóa đơn/vượt ngưỡng; hoa hồng chỉ ghi nhận khi lệnh thu đủ; chu kỳ kỳ công; dùng nhãn "Đang vận chuyển" cho hàng đang đi đường | `ba-answers-04`; `ui-ux-flow.md` A.1 (Kho, mua hàng, nhân sự) | Trung |
| E-09 | §8 ngoại lệ (và WF-08) | Thêm: **thợ mất mạng Phase 1** (khóa ghi giờ, phiếu giấy, khai giờ thực, nhập bù có xác nhận); hủy lệnh sau xuất kho (không tự duyệt, chặn khi có hóa đơn, tính phí); khóa chi nhánh hai bước; mở lại ngày/kỳ qua đề nghị + CH duyệt + hạn 48 giờ; khách không lấy hóa đơn (khóa chờ kế toán xác nhận) | `ba-decisions.md` E.1; `ba-answers-01` Câu 4, 6; `ba-answers-02` A.2; `ba-answers-05` Câu 1–3; `ba-answers-06` Phụ lục A.1 | Cao |

## F. design-system (6)

| # | Vị trí | Thay đổi đề xuất | Căn cứ | Ưu tiên |
| --- | --- | --- | --- | --- |
| F-01 | §2 "Màu theo nghiệp vụ" (cột "Repair Order") | Giữ nguyên giá trị màu, **gán nhãn cho đúng đối tượng**: "Chờ tiếp nhận" = Lịch hẹn/Tiếp nhận (Neutral); "Chờ duyệt báo giá" = Báo giá Đã gửi, hiển thị "Chờ khách duyệt" (Warning); "Chờ QC" = Lệnh Chờ kiểm tra (Purple); "Sẵn sàng bàn giao" = Lệnh (Success); "Hoàn thành" = Hạng mục, "Hoàn tất" = Lệnh. Đổi tiêu đề cột thành "Đối tượng" | `ba-decisions.md` A.1, A.2; `ui-ux-flow.md` C-9; `screen-inventory.md` G-03 | Trung |
| F-02 | Mục có dòng "Touch target: tối thiểu 44 × 44px" (khoảng dòng 228, §11) | Ghi hiệu chỉnh: nút md 40px và sm 32px chỉ khi `pointer: fine` **và** màn ≥ 1024px; từ 1024px trở xuống hoặc `pointer: coarse` mọi control ≥ 44px; màn thợ tablet 52px; không dưới 24px ở mọi trường hợp (WCAG 2.2 SC 2.5.8) | `ba-decisions.md` mục C(v); `ui-ux-flow.md` C-12 | Trung |
| F-03 | §5 (radius input) | Sửa: sm 6px cho control nhỏ (checkbox, segmented, menu item, chip lọc, nút icon nhỏ); **Input, Select, Textarea, Date = md 8px** (bảng chốt §16 thắng mô tả §5) | `ba-decisions.md` mục C | Thấp |
| F-04 | Phụ lục token bổ sung | Thêm: màu chữ badge đậm (#166534, #92400E, #991B1B, #1E40AF), link brand-600 (hover brand-700), focus outline 2px brand-500 offset 2px, `--input-border` #868D9A (đo lại; nếu < 3:1 dùng #6B7280) và `--control-border`; không đổi token chuẩn hiện có; dark mode không phát hành | `ba-decisions.md` mục C (i)–(iv), câu 16 | Trung |
| F-05 | §8 dashboard theo vai trò | Thêm dashboard Quản đốc, Quản lý vùng, Quản trị hệ thống; MH, NS không có dashboard (trang đầu là danh sách) | `ba-decisions.md`/`screen-inventory.md` D-09, G-07; `ui-ux-flow.md` C-10 | Thấp |
| F-06 | §9 biểu đồ | Ghi palette 5 màu theo thứ tự cố định, không dùng đỏ/xanh lá cho nhóm chỉ mang tính phân loại; màu Danger/Success của badge giữ cho chữ trạng thái | `ba-answers-06` Câu 14 | Thấp |

## G. Việc BA cần làm khi được yêu cầu áp dụng

1. Áp dụng theo thứ tự ưu tiên Cao → Trung → Thấp, từng tài liệu một, và cập nhật ma trận truy vết FRD (C-18) cùng lúc.
2. Kiểm lại các số BR còn ghi "theo `ba-answers`" (FR-REC-043, FR-INV-029) trong BRD trước khi ghi vào FRD.
3. Với mục chờ chủ dự án (E-02 "Đã hủy" thứ 7, `[Cần xác nhận]` ở D-03): không ghi vào Journey/BRD như quyết định đã chốt.
4. Sau khi áp dụng, cập nhật `ui-ux-flow.md` Phụ lục A.3 và C, `STATUS.md`.
