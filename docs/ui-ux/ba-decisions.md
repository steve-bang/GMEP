# BA – Quyết định cho Phase 0 (trả lời 17 câu hỏi của `00-foundation.md` §11)

Phiên bản 0.2 · Ngày 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để đi tiếp).

Thay đổi v0.2 (đồng bộ sau khi cả 6 gói qua review vòng 3, xem `STATUS.md`): bảng A.2 cập nhật theo các `ba-answers-02…05` (thêm A.2b, "Đã hủy" của báo giá, "Chờ hậu duyệt", yêu cầu phụ tùng 6 trạng thái); câu 4 đổi "Đang về" thành "Đang vận chuyển"; thêm **mục E** (chốt chính sách thợ mất mạng ở Phase 1 và các mâu thuẫn tài liệu khác). Khi `ba-decisions.md` mâu thuẫn với `ba-answers-0N.md` về cùng một điểm, bản **mới nhất** thắng, và mục E là bản mới nhất.

Nguyên tắc áp dụng: nghiệp vụ trong BRD/FRD/Journey thắng; hình thức giao diện theo `docs/design-system.md`. Những điểm BRD/FRD đánh dấu `[Cần xác nhận]` mà khách chưa quyết (nhà cung cấp, hạn mức, cách tính công, giá vốn, máy in…) vẫn được thiết kế theo hướng **cấu hình**, không cố định. Quyết định nhất quán với `screen-inventory.md` §5 (D-06, D-07, D-08, D-10, D-11, D-12, D-13).

Mọi giá trị nêu là đề xuất; chỗ nào đổi sau này chỉ ảnh hưởng phần "Tác động" ghi kèm.

---

## A. Tập trạng thái chính thức của 5 đối tượng (câu 1, 2, 3, 5)

### A.1 Giải quyết mâu thuẫn `design-system §2` và `user-journey §7`

| Nhãn | Thuộc đối tượng | Quyết định |
| --- | --- | --- |
| Chờ duyệt báo giá | **Báo giá**, ứng với trạng thái "Đã gửi" | Không phải trạng thái của Lệnh. Journey §7: lệnh chỉ bắt đầu khi khách duyệt (WF-01). Trong UI, nhãn hiển thị của trạng thái Báo giá "Đã gửi" là **"Chờ khách duyệt"** (màu Warning, đúng màu design-system gán cho "Chờ duyệt báo giá"). Bộ đếm "Chờ duyệt 08" trên dashboard và pill ở menu "Phiếu sửa chữa" đếm **báo giá đang ở Đã gửi**, ghi rõ "báo giá chờ khách duyệt" |
| Chờ tiếp nhận | **Hồ sơ tiếp nhận / lịch hẹn** (giai đoạn trước báo giá và lệnh) | Không phải trạng thái Lệnh (Lệnh không có trạng thái này). Là trạng thái của lịch hẹn/hồ sơ tiếp nhận: xe đã đến hoặc đã đặt lịch, chưa lập báo giá. Dùng Neutral. Ở bảng điều phối (G2-REC-03) hiện như cột/dải "Trước lệnh" gồm Lịch hẹn → Chờ tiếp nhận → Có báo giá chờ duyệt, tách khỏi các cột trạng thái Lệnh (khớp G-03 trong screen-inventory) |
| Chờ QC | **Lệnh sửa chữa**, trạng thái "Chờ kiểm tra" | Cùng một trạng thái. Tên chính thức: **"Chờ kiểm tra chất lượng"**; nhãn ngắn trên badge: **"Chờ QC"**. Màu Purple (nguồn: design-system §2). Căn cứ WF-04, FR-REC-016 |
| Chờ phụ tùng | **Lý do của trạng thái Tạm dừng** (cờ/tag), không phải trạng thái riêng | Journey §7 có 7 trạng thái lệnh và §4 nêu "lệnh sang trạng thái tạm dừng chờ phụ tùng". Hiển thị: badge **Tạm dừng** (Warning) kèm tag lý do **"Chờ phụ tùng"**. Lý do tạm dừng là danh sách cấu hình (chờ phụ tùng, chờ khách duyệt phát sinh, chờ thợ, khác). Số "Xe chờ phụ tùng 04" = lệnh Tạm dừng có lý do Chờ phụ tùng; bộ lọc theo lý do |
| Hoàn thành / Hoàn tất | Hạng mục = "Hoàn thành"; Lệnh = "Hoàn tất" | Giữ hai nhãn khác nhau vì hai đối tượng khác nhau. Badge "Hoàn thành" ở design-system §6 hiểu là Hạng mục |

### A.2 Bảng cuối: trạng thái → màu → badge

Quy ước: màu theo design-system §2 (Success/Warning/Danger/Info/Neutral/Purple); chữ badge dùng bản đậm (quyết định B-1). Badge luôn có chữ, có thể thêm icon 14px nhưng không bắt buộc. Class đặt theo màu (`badge--warning`…).

| Đối tượng | Trạng thái chính thức | Màu | Chữ trên badge | Nguồn |
| --- | --- | --- | --- | --- |
| Lịch hẹn / Tiếp nhận (trước lệnh) | Chờ xác nhận (khách tự đặt, BR-REC-09) | Warning | Chờ xác nhận | BA đề xuất |
| | Đã hẹn | Info | Đã hẹn | BA đề xuất |
| | Chờ tiếp nhận | Neutral | Chờ tiếp nhận | design-system §2 |
| | Đã tiếp nhận | Success | Đã tiếp nhận | BA đề xuất |
| | Không đến / Đã hủy | Neutral / Danger | Không đến / Đã hủy | BA đề xuất |
| Báo giá | Nháp | Neutral | Nháp | Journey §7 |
| | Đã gửi | **Warning** | **Chờ khách duyệt** | Journey §7 + design-system "Chờ duyệt báo giá = Warning" |
| | Duyệt toàn phần | Success | Duyệt toàn phần | Journey §7 |
| | Duyệt một phần | Warning | Duyệt một phần | Journey §7 (phần còn lại lưu để nhắc, BR-REC-11) |
| | Từ chối | Danger | Từ chối | Journey §7 |
| | Hết hạn | Neutral | Hết hạn | Journey §7 |
| | **Đã hủy** (đề xuất trạng thái thứ 7, **chờ chủ dự án xác nhận**) | Neutral | Đã hủy (kèm lý do) | `03-quote-technician-delivery.md` §9 câu 2 và 4; `review-03-round2-ba.md` F3R2-02. Dùng khi cố vấn hủy báo giá hoặc báo giá bổ sung trước khi khách quyết định; khác "Từ chối" (khách từ chối) và không sinh lưu nhắc trừ khi cố vấn chọn. Nếu chủ dự án không chấp nhận: ghi nhận bằng cờ hủy trên "Hết hạn"/"Nháp" kèm lý do, bộ vẫn 6 trạng thái. `ba-answers-03` Câu 1 (giữ 6) nói về phiên bản bị thay, không phải về hủy, nên không mâu thuẫn |
| Lệnh sửa chữa (7) | Đã duyệt | Neutral | Đã duyệt | Journey §7; "chưa bắt đầu" = Neutral (§2), tránh trùng màu với Đang sửa |
| | Đang sửa | Info | Đang sửa chữa | design-system §2 |
| | Tạm dừng | Warning | Tạm dừng (+ tag lý do, vd. Chờ phụ tùng) | Journey §7 |
| | Chờ kiểm tra | Purple | Chờ QC | design-system §2 |
| | Sẵn sàng giao | Success | Sẵn sàng bàn giao | design-system §2 |
| | Hoàn tất | Success | Hoàn tất | Journey §7 |
| | Đã hủy | Danger | Đã hủy | design-system §2 |
| Hạng mục sửa chữa (5) | Chưa làm | Neutral | Chưa làm | Journey §7 |
| | Đang làm | Info | Đang làm | |
| | Tạm dừng | Warning | Tạm dừng | |
| | Hoàn thành | Success | Hoàn thành | |
| | Trả lại | Danger | Trả lại (QC không đạt, FR-REC-016) | |
| Hạng mục – thuộc tính duyệt (không phải trạng thái thứ 6) | Chờ khách duyệt (phát sinh) | Warning | Chờ khách duyệt | xem A.3 |
| | Đã duyệt | Success | Đã duyệt | `ba-answers-03` Câu 3 (vào tổng lệnh, mở nút Bắt đầu) |
| | Từ chối | Danger | Khách từ chối | `ba-answers-03` Câu 3; vào nhóm "Không thực hiện", có lưu nhắc |
| | Hết hạn | Neutral | Hết hạn | `ba-answers-03` Câu 3 (hạn mặc định 24 giờ, cấu hình) |
| | Đã hủy (cố vấn hủy) | Neutral | Đã hủy | `review-03-round2-ba.md` F3R2-02; tag, không phải trạng thái hạng mục |
| Thanh toán | Chưa thanh toán | Warning | Chưa thanh toán | design-system §2 (Journey gọi "chưa thu") |
| | Thanh toán một phần | Info | Thanh toán một phần | |
| | Đã thanh toán | Success | Đã thanh toán | |
| | Hoàn tiền | Neutral | Hoàn tiền | |
| Hóa đơn | Chưa xuất | Neutral | Chưa xuất | Journey §7 |
| | Đã xuất | Success | Đã xuất | |
| | Điều chỉnh | Info | Điều chỉnh | |
| | Thay thế | Info | Thay thế | |
| | Hủy | Danger | Hủy | |
| Kho (suy ra từ tồn khả dụng) | Đủ hàng | Success | Đủ hàng | design-system §2 |
| | Sắp hết | Warning | Sắp hết | |
| | Hết hàng | Danger | Hết hàng | |
| | Chưa đặt định mức | Neutral | Chưa đặt định mức | `ba-answers-04` Phụ lục A |

### A.2b Bộ badge của các đối tượng phụ (`ba-answers-04.md` Phụ lục A, 15 hàng / 16 bộ) và yêu cầu phụ tùng

Nguồn chuẩn cho gói 3 (kho, mua hàng, nhân sự) là Phụ lục A của `ba-answers-04.md`; bảng dưới tóm tắt để tra một chỗ. "Tag" là nhãn phụ, **không phải trạng thái**. Quy tắc chung: "Chờ duyệt" luôn Warning; "Từ chối" luôn Danger; "Đã ghi sổ/Đã duyệt/Nhận đủ" Success; "Nháp/Đã hủy/Đã đóng" Neutral; tím chỉ cho "Chờ QC". Không dùng badge cho loại chứng từ hoặc loại biến động. (Hàng thứ 16 là bộ "Tài khoản" nằm trong hàng "Nhân sự" của Phụ lục A.)

| # | Đối tượng | Trạng thái → màu | Tag phụ |
| --- | --- | --- | --- |
| 1 | Tồn kho | Đủ hàng Success · Sắp hết Warning · Hết hàng Danger · Chưa đặt định mức Neutral | "Đang vận chuyển N" Info · "Đã đặt N" Neutral · khả dụng < 0: Hết hàng + alert "Dữ liệu tồn lệch, báo QL" |
| 2 | Chứng từ kho (PN, PX, HK, XN, TR, DC) | Nháp Neutral · Chờ duyệt Warning · Đã ghi sổ Success · Từ chối Danger · Đã hủy (chỉ nháp) Neutral | Lý do chờ duyệt (Warning); "Đã hoàn/đảo bằng HK-…" Neutral |
| 3 | **Yêu cầu cấp phụ tùng** (một đối tượng, **6 trạng thái**, xem ghi chú dưới bảng) | Đã gửi Info · Thủ kho đã nhận Info · Đã xuất một phần Warning · Đã xuất đủ Success · Thiếu hàng, chờ hàng về Warning · Đã hủy Neutral | "Lý do: Chờ phụ tùng" trên lệnh/hạng mục Tạm dừng |
| 4 | Yêu cầu mua | Nháp Neutral · Chờ duyệt Warning · **Chờ hậu duyệt Warning** · Đã duyệt Success · Từ chối Danger · Đã lập đơn Info · Đã hủy Neutral | "Mua gấp" Warning · "Chờ cấp: Chủ garage" Neutral |
| 5 | Đơn mua | Nháp Neutral · Đã gửi Info · NCC xác nhận Info · Nhận một phần Warning · Nhận đủ Success · Đã đóng Neutral · Đã hủy (nháp) Neutral | "v2" Neutral · "Trễ N ngày" Danger · "Đóng khi chưa nhận đủ" Warning |
| 6 | Phiếu chuyển kho (CK) | Nháp Neutral · Chờ duyệt Warning · Chờ gửi Info · **Đang vận chuyển** Info · Có chênh lệch Danger · Đã nhận Success · Đã đóng Neutral · Từ chối Danger | "Giá trị lớn" Warning · kết quả xử lý lệch Neutral |
| 7 | Yêu cầu chuyển (YK) | Chờ bên gửi xác nhận Warning · Đã xác nhận Success · Bên gửi từ chối Danger | |
| 8 | Đợt kiểm kê (KK) | Đang đếm Info · Chờ duyệt Warning · Đã ghi sổ Success · Từ chối (cần đếm lại) Danger · Đã hủy Neutral | "Quá hạn duyệt" Danger · "Lệch lặp lại" Warning |
| 9 | Đối chiếu ba bên | Chờ hóa đơn Warning · Khớp Success · Lệch giá Danger · Lệch số lượng Danger · Chênh lệch chờ duyệt Warning · Đã ghi công nợ Success | |
| 10 | Dòng công thợ | Chờ QC Purple · Đã ghi Success · QC trả lại Danger · Đã đảo Neutral | "Điều chỉnh chờ duyệt" Warning |
| 11 | Hoa hồng | Chưa ghi nhận Neutral · Chờ duyệt Warning · Đã duyệt Success · Đã đảo Neutral | Thanh toán lệnh dùng badge Thanh toán ở A.2 |
| 12 | Kỳ công | Đang mở Info · Đã duyệt Success · Đã khóa Neutral (icon khóa) | "Số tạm" Warning · "Chờ mở lại" Warning · "Đã mở lại" Info |
| 13 | Nhân sự | Đang làm Success · Nghỉ phép Warning · Đã nghỉ Neutral | |
| 14 | Tài khoản (nhân sự) | Đã liên kết / Chưa liên kết / Đã khóa (Neutral) | |
| 15 | Chấm công | Đang trong ca Success · Chưa vào ca Neutral · Đã ra ca Neutral · Đi muộn N phút Warning | |
| 16 | Nhà cung cấp | Đang hợp tác Success · Tạm ngừng Neutral · Ngừng hợp tác Neutral | |

Ghi chú riêng:

- **Yêu cầu cấp phụ tùng (hàng 3)** là một đối tượng nhìn từ hai phía: thợ ở G2-TEC-03 (`ba-answers-03` / `review-03-round2-ba.md` mục 2) và thủ kho ở G3-INV-06 (`ba-answers-04` Phụ lục A chỉ có 4 giá trị Chờ xuất, Thiếu hàng, Đã xuất, Đã hủy). **Chốt 6 trạng thái** (là tập đủ hơn, khớp FR-INV-029 đề xuất). Ánh xạ cho INV-06: tab/nhóm lọc "Chờ xuất" = {Đã gửi, Thủ kho đã nhận, Đã xuất một phần}; "Đã xuất" = Đã xuất đủ. **Màu "Thiếu hàng" = Warning** (không phải Danger như bản ban đầu của INV-06): đây là tình trạng chờ hàng về, đi cùng lệnh/hạng mục "Tạm dừng · Chờ phụ tùng" (Warning); Danger dành cho lỗi hoặc từ chối. "Hết hàng" của **tồn kho** vẫn Danger (đối tượng khác). BA đề xuất — chờ xác nhận. Designer sửa `g3-inv-06.html` (badge Thiếu hàng, bộ lọc, chữ "Đã xuất một phần") và kiểm tra `g1-dsh-05.html`.
- **Chờ hậu duyệt (hàng 4)**: trạng thái của yêu cầu mua **Mua gấp** sau khi người mua đã nhập hàng, chờ cấp có thẩm quyền duyệt hậu kiểm trong hạn N giờ làm việc (mẫu 24 giờ, cấu hình). Người đề xuất không tự duyệt; "Không chấp nhận" bắt buộc lý do và gắn cờ cho Kế toán. Đã làm ở `g3-pur-01.html` (YM-Q7-2610-00006) và `g3-pur-03.html` (`04` §13c, review `review-04-round3-ba.md` F4R3-01). Ở bản `ba-answers-04` ban đầu đây chỉ là tag của "Đã duyệt tạm"; chốt là **trạng thái** (Warning) để lọc và đếm được.
- **"Đã hủy" có hai màu có chủ đích**: lệnh sửa chữa và lịch hẹn Danger (design-system §2 gán Danger cho "Đã hủy" của lệnh); mọi đối tượng chứng từ/yêu cầu/báo giá còn lại Neutral (hủy là thao tác bình thường, không phải lỗi).
- **Thanh toán** có hoàn tiền: không thêm trạng thái; "Hoàn tiền" Neutral khi thu ròng = 0 và đã hoàn toàn bộ; hoàn một phần là tag "Đã hoàn một phần N ₫" (`ba-answers-05` Câu 4).

Ghi chú thực hiện:
- Khác bản designer: (1) Báo giá "Đã gửi": Info thành Warning; (2) Lệnh "Đã duyệt": Info thành Neutral; (3) bỏ "Chờ tiếp nhận" và "Chờ duyệt báo giá" khỏi bộ Lệnh, thêm bộ Lịch hẹn/Tiếp nhận; (4) thêm tag lý do cho Tạm dừng. Các màu còn lại giữ nguyên.
- Trạng thái đồng bộ hóa đơn với nhà cung cấp ("đang gửi", "lỗi phát hành", "chờ truy vấn lại") **không** thêm thành trạng thái thứ 6 của Hóa đơn: hiển thị là chỉ báo xử lý riêng (spinner + chữ, hoặc Alert lỗi) cạnh badge, vì Journey §7 nói trạng thái hóa đơn lấy từ nhà cung cấp và FR-EIN yêu cầu phát hành idempotent. Cần BA cập nhật Journey §7 nếu muốn ghi chính thức.
- Màn chi tiết lệnh hiện song song hàng "Lệnh – Thanh toán – Hóa đơn" (không gộp). Lệnh Hoàn tất có thể còn Thanh toán = Chưa thanh toán (công nợ): đây là hai đối tượng.
- Công nợ quá hạn là cờ "Quá hạn" (Danger) cạnh Thanh toán, không là trạng thái.
- Tím chỉ dùng cho "Chờ QC" và hành động chính.
- Tác động tài liệu cần cập nhật khi chốt: Journey §7 (thêm bộ Lịch hẹn/Tiếp nhận, lý do tạm dừng, thuộc tính duyệt của hạng mục, nhãn thanh toán), design-system §2 (không đổi giá trị, chỉ ghi lại đối tượng của từng nhãn), FRD REC-015 (nếu có liệt kê trạng thái) và UAT liên quan (UAT báo giá một phần, UAT hạng mục phát sinh).

### A.3 Câu 5 – "Phát sinh chờ khách duyệt" có phải trạng thái hạng mục?

Quyết định: **không thêm trạng thái thứ 6**. Hạng mục phát sinh có hai thuộc tính độc lập: trạng thái thực hiện (5 trạng thái, nằm ở "Chưa làm" và bị khóa) và **thuộc tính duyệt** (Chờ khách duyệt / Đã duyệt / Từ chối, kèm bằng chứng). UI hiện thêm tag/badge Warning "Chờ khách duyệt (phát sinh)" cạnh badge "Chưa làm", và nút Bắt đầu của thợ bị khóa kèm lý do. Lý do: Journey §7 giữ đúng 5 trạng thái hạng mục; §8 và WF-03 yêu cầu không làm khi chưa duyệt. Căn cứ: BR-REC-04, WF-03, RULE-005/006. Tác động: G2-TEC (nút bắt đầu), G2-REC chi tiết, UAT hạng mục phát sinh.

---

## B. Trả lời từng câu

### Câu 1 – Tập trạng thái Lệnh/Báo giá; "Chờ tiếp nhận" thuộc đối tượng nào
- Quyết định: xem A.1 và A.2. Lệnh có 7 trạng thái theo Journey §7; "Chờ duyệt báo giá" = Báo giá Đã gửi; "Chờ tiếp nhận" = Lịch hẹn/Tiếp nhận.
- Lý do: bảo toàn nguyên tắc năm đối tượng, năm bộ trạng thái; không có một trạng thái chung.
- Căn cứ: Journey §7, WF-01, WF-04; BRD RULE-005/006; FR-REC-015; screen-inventory G-03.

### Câu 2 – "Chờ QC" và "chờ kiểm tra"
- Quyết định: cùng một trạng thái; tên đầy đủ "Chờ kiểm tra chất lượng", badge "Chờ QC". Người dùng Việt Nam ở garage quen "QC"; tooltip giải thích lần đầu.
- Căn cứ: WF-04, FR-REC-016, BR-REC-07.

### Câu 3 – "Chờ phụ tùng"
- Quyết định: lý do của Tạm dừng (tag), không phải trạng thái. Dashboard "Xe chờ phụ tùng" = lọc theo lý do.
- Lý do: Journey §7 chỉ có 7 trạng thái lệnh; thêm trạng thái làm bùng nổ tổ hợp (chờ phụ tùng + chờ duyệt phát sinh). Journey §4 bước 5 và §8 dòng "Phụ tùng không đủ tồn" mô tả tạm dừng chờ phụ tùng.
- Căn cứ: BR-INV-05, BR-INV-07, RULE-008.

### Câu 4 – Công thức tồn khả dụng và ngưỡng badge Kho
- **Công thức**: `Tồn khả dụng = Tồn thực tế − Tồn giữ chỗ`. **Hàng đang đi đường không cộng vào** (Journey §4: chưa cộng vào kho nhận cho đến khi nhận và xác nhận số lượng). Ví dụ FR-INV-020: thực tế 20, giữ chỗ 5, khả dụng 15.
- **Ngưỡng** (so với khả dụng, không so với tồn thực tế, RULE-008): theo từng mặt hàng và từng chi nhánh, lấy từ định mức tồn tối thiểu/tối đa cấu hình (FR-INV-013). Hết hàng: khả dụng ≤ 0. Sắp hết: 0 < khả dụng ≤ định mức tối thiểu. Đủ hàng: khả dụng > định mức tối thiểu. Chưa đặt định mức: không hiện Đủ/Sắp hết mà hiện badge Neutral "Chưa đặt định mức" kèm liên kết cấu hình. Đang vận chuyển > 0: chip phụ "Đang vận chuyển N" (Info) và không đổi badge chính; hàng đã đặt nhà cung cấp nhưng chưa giao là chip phụ "Đã đặt N" (Neutral, không phải số tồn thứ năm; `ba-answers-04` câu 1); khi khả dụng < 0 (dữ liệu sai lệch) hiện Hết hàng kèm cảnh báo dữ liệu.
- Ngưỡng tuyệt đối (ví dụ 5 cái) không cố định trong thiết kế.
- Bốn số hiển thị theo thứ tự designer đã dùng (Tồn thực tế / Giữ chỗ / Đang vận chuyển / Khả dụng), khả dụng nhấn mạnh. Nhãn thứ ba thống nhất là **"Đang vận chuyển"** (thay "Đang về" của bản 0.1; khớp "in-transit" của design-system/CLAUDE.md và trạng thái "Đang vận chuyển" của phiếu chuyển kho).
- Căn cứ: BR-INV-10, FR-INV-013, FR-INV-020, RULE-008, UAT-13.

### Câu 5 – xem A.3.

### Câu 6 – Viền input dưới 3:1 → xem mục C (iv).

### Câu 7 – Radius input 6px hay 8px → xem mục C.

### Câu 8 – Quyền "Hiện số" SĐT/địa chỉ (c)
Quyết định (khớp D-10, bổ sung CH/QV/KT/TK):

| Vai trò | SĐT | Địa chỉ | Nút "Hiện" |
| --- | --- | --- | --- |
| CV, QL, TN, QĐ (chi nhánh mình) | Đầy đủ | Đầy đủ | Không cần; vẫn ghi nhật ký truy cập khi mở hồ sơ khách (không ghi mỗi dòng danh sách) |
| CH, QV | Che trong danh sách, báo cáo, xuất file; đầy đủ ở chi tiết khách khi bấm Hiện | Che số nhà/đường (chỉ hiện quận/huyện, tỉnh/thành) | Có, ghi nhật ký, không cần lý do |
| KT | Che | Che như trên | Có, **bắt buộc chọn lý do** (đối chiếu hóa đơn, thu nợ, khác) và ghi nhật ký |
| TK | Che | Không hiển thị | Không |
| TH | Không hiển thị; chỉ tên và biển số của việc mình | Không hiển thị | Không |
| AD | Không truy cập dữ liệu nghiệp vụ | Như trên | Không (FRD §2 ghi chú) |

Định dạng che: SĐT `09•• ••• 123` (2 số đầu + 3 số cuối); email `a•••@gmail.com`; địa chỉ chỉ giữ quận/huyện và tỉnh/thành. Giá trị đầy đủ **không gửi xuống trình duyệt** cho đến khi Hiện (prototype hiện đang để sẵn trong `data-clear`, chỉ là minh họa). Mỗi lần Hiện: ghi ai, khi nào, bản ghi nào, lý do; tự che lại sau 30 giây hoặc khi rời trang. Xuất danh sách khách cần quyền xuất riêng (FR-SYS-013) và xuất mặc định đã che. Bảng quyền che sửa được ở G4-SYS-04 (cấu hình, không hard-code).
- Căn cứ: NFR-SEC-03, FR-SYS-003, FR-SYS-013, FRD §2 ghi chú AD, Luật BVDLCN 2025 (BRD §Pháp lý), D-10.

### Câu 9 – Cấp nhóm chi nhánh / pháp nhân trên branch selector (d)
Quyết định: selector có **ba cấp** hiển thị theo quyền:
1. "Tất cả chi nhánh được phép" (CH: toàn chuỗi; QV: toàn bộ nhóm được giao, nhãn ghi "Tất cả nhóm được giao").
2. "Nhóm chi nhánh" (vùng) – chỉ hiện khi có cấu hình nhóm; QV chọn được các nhóm được giao.
3. Từng chi nhánh.
Cấp **Pháp nhân** là bộ lọc/ tiêu đề bổ sung, **ẩn khi hệ thống chỉ có một pháp nhân** (D-13 mục 8; G4-SYS-05); khi có nhiều pháp nhân, báo cáo hợp nhất phải ghi pháp nhân và không cộng gộp số liệu giữa các pháp nhân trong báo cáo chính thức. Vai trò chỉ có một chi nhánh: ẩn selector, chỉ hiện tên chi nhánh tĩnh (Phase 1 pilot). Vai trò có nhiều chi nhánh nhưng không phải CH/QV: chọn từng chi nhánh, không có Tất cả hợp nhất (khớp shell hiện tại). Đổi phạm vi là hành động chủ động; chứng từ đang soạn phải lưu nháp trước (D-06). Nhãn phạm vi luôn hiện trên banner (RULE-015).
- Căn cứ: FRD §2 (QV thấy nhóm được giao), FR-SYS-002, NFR-ISO-01, FR-SYS-012, D-06, D-13.

### Câu 10 – KT có thấy thông tin khách trên phiếu không
- Quyết định: KT thấy tên khách/doanh nghiệp, MST, địa chỉ xuất hóa đơn (cần cho hóa đơn); **SĐT và địa chỉ cá nhân che**, Hiện có lý do theo câu 8. Truy vết từ hóa đơn về lệnh bằng mã lệnh, biển số, mã khách.
- Lý do: nhu cầu nghiệp vụ tài chính khác nhu cầu liên hệ khách; nguyên tắc tối thiểu quyền.
- Căn cứ: FRD §2 (KT X báo giá/lệnh), NFR-SEC-03, FR-EIN (thông tin người mua).

### Câu 11 – Định dạng mã chứng từ và biển số (e)
**Mã chứng từ** (FR-REC-030: duy nhất theo chi nhánh và thời gian): `LOẠI-MÃCN-YYMM-STT`, STT 5 chữ số, đánh lại từ 00001 mỗi tháng theo chi nhánh và loại. Ví dụ `RO-Q7-2610-00128`.

| Loại | Tiền tố |
| --- | --- |
| Lệnh sửa chữa | RO |
| Báo giá (phiên bản thêm hậu tố) | BG, ví dụ `BG-Q7-2610-00231-v2` |
| Phiếu thu / Phiếu chi | PT / PC |
| Phiếu nhập / xuất kho | PN / PX |
| Phiếu chuyển kho / Kiểm kê | CK / KK |
| Đơn mua | DM |
| Phiếu bán lẻ | BL |

Mã chi nhánh 2–4 ký tự do cấu hình; tiền tố và độ dài STT là cấu hình. Số hóa đơn điện tử **do nhà cung cấp/Cục Thuế cấp**, không dùng mã nội bộ này. Mã hiển thị tabular-nums, không ngắt dòng; tìm kiếm chấp nhận nhập thiếu dấu gạch hoặc chỉ STT. Prototype dùng `RO-2026-001284` chỉ là mẫu, thay bằng định dạng trên (thay đổi chỉ là chuỗi).

**Biển số**: lưu bản chuẩn hóa (in hoa, bỏ khoảng trắng, dấu chấm, gạch) để kiểm tra trùng và tìm kiếm (FR-CRM-002, FR-CRM-003), hiển thị theo mẫu:
- Ô tô, 5 số: `51H-123.45`; ô tô biển cũ 4 số: `51H-1234`.
- Xe máy: `59-X1 123.45` (hai ký tự sê-ri), biển cũ `59-S1 1234`.
- Biển ngoại giao, quân đội, tạm thời, nước ngoài: ô nhập tự do kèm "Loại biển" (danh mục cấu hình); chỉ cảnh báo nếu không khớp mẫu, **không chặn lưu**.
Biển số hiển thị tabular-nums, in hoa, không ngắt dòng. Gợi ý chuẩn hóa khi gõ. Màu nền biển (trắng/vàng/xanh/đỏ) không dùng làm tín hiệu giao diện; thông tin "xe kinh doanh vận tải" lấy từ thuộc tính xe (FR-CRM-002).
- Căn cứ: FR-REC-030, FR-CRM-002/003, FR-SYS-006 (mẫu chứng từ có hiệu lực theo ngày).

### Câu 12 – Khổ in (f)
Quyết định: hỗ trợ ba khổ theo NFR-COM-01, mẫu in là cấu hình theo chi nhánh; **model máy in chưa chốt** (D-13 mục 10) nên thiết kế mẫu theo khổ, không theo hãng.

| Khổ | Dùng cho |
| --- | --- |
| A4 | Báo giá, hóa đơn bản thể hiện, biên bản bàn giao, báo cáo, phiếu nhập/chuyển kho |
| A5 | Phiếu tiếp nhận xe, lệnh sửa chữa (bản xưởng), phiếu giao xe |
| Nhiệt 80 mm | Phiếu thu, phiếu bán lẻ, phiếu hẹn nhanh (58 mm nếu khách dùng, cấu hình) |

Tem/QR cho phụ tùng: **Could, P2+**, khổ tem cấu hình, không làm ở Phase 1. Phase 1 chỉ cần A4, A5 và nhiệt cho chứng từ lõi. Mọi mẫu in có ngày theo dd/MM/yyyy, tiền VND đầy đủ, mã và chi nhánh phát hành; SĐT in đầy đủ chỉ khi người in có quyền.
- Căn cứ: NFR-COM-01, FR-SYS-006, FR-SYS-009, G2-PRT.

### Câu 13 – Màn thợ trên tablet
- Danh sách mặc định: "Việc của tôi hôm nay", xếp theo ưu tiên và giờ hẹn; bộ lọc nhanh theo trạng thái (Đang làm/Chưa làm/Tạm dừng). **Không** bắt buộc lọc theo khoang/ca ở Phase 1; "khoang" (vị trí xe) là trường tùy chọn cấu hình nếu chi nhánh muốn (BA đề xuất; chưa có trong FRD).
- Bắt đầu/hoàn thành ≤ 2 chạm: chạm thẻ việc → chạm "Bắt đầu" (hoặc "Hoàn thành").
- Thợ **có** thể tạm dừng: 2 chạm: "Tạm dừng" → chọn lý do từ danh sách chip (Chờ phụ tùng, Chờ khách duyệt phát sinh, Nghỉ, Khác); giờ công chỉ tính thời gian đang làm (Journey §5, Mitchell 1 trong BRD). Khi chọn "Chờ phụ tùng" hệ thống tạo yêu cầu cho thủ kho và gắn lý do Tạm dừng cho hạng mục/lệnh (liên hệ câu 3).
- Căn cứ: NFR tablet ≤ 2 chạm (FRD), BR-HRM-03, BR-REC-06, WF-08.

### Câu 14 – Hạn mức duyệt
- Quyết định: UI **không chứa số**. Mọi cảnh báo "Vượt hạn mức" lấy từ cấu hình G4-APR-03, hiển thị so sánh giá trị với hạn mức và tên người/cấp duyệt. Ví dụ "2 triệu/10 triệu" trong Journey chỉ minh họa, không dùng trong mock (dùng giá trị giả rõ ràng).
- Căn cứ: Journey §7 ma trận phê duyệt, FR-SYS-004, RULE-011, D-11. Giữ `[Cần chốt]` với khách.

### Câu 15 – Thông báo
- Phase 1: thông báo trong hệ thống (chuông + trang); Phase 2: thêm email; Zalo/SMS khi khách chọn nhà cung cấp (D-13 mục 2, kênh chưa cấu hình hiện "Chưa kích hoạt").
- Hai mức: "Cần xử lý" (phê duyệt chờ, phát sinh chờ khách duyệt, QC trả lại, hóa đơn lỗi, chênh lệch quỹ, phụ tùng thiếu) và "Thông tin" (tồn thấp, xe sẵn sàng giao, lịch hẹn mới). Chỉ gửi trong phạm vi quyền (FR-SYS-008).
- Lưu: thông báo đã xử lý ẩn khỏi chuông sau 30 ngày, lưu trong trang 12 tháng (BA đề xuất; thời gian lưu là cấu hình, phụ thuộc quyết định retention của khách).
- Căn cứ: FR-SYS-008, FR-SYS-015, D-07.

### Câu 16 – Dark mode (g)
- Quyết định: **không thuộc phạm vi phát hành** (Phase 1–4). Chỉ giữ cấu trúc token (lớp semantic ghi đè được) theo checklist §15 "cấu trúc sẵn sàng mở rộng". Không chạy kiểm thử tương phản, không có nút chuyển theme trong sản phẩm; nút chuyển trong prototype chỉ để minh họa và phải đánh dấu "bản nháp".
- Lý do: D-12; thiết bị trong garage chủ yếu dùng ánh sáng ban ngày, ưu tiên nguồn lực cho nghiệp vụ; giá trị dark chưa kiểm thử.
- Điều kiện đưa vào sau: khách yêu cầu → thiết kế bảng giá trị dark, kiểm thử tương phản toàn bộ cặp, thêm tùy chọn theo người dùng.

### Câu 17 – Phông (h)
- Quyết định: **tự host** Be Vietnam Pro (WOFF2, subset latin + latin-ext + vietnamese, trọng lượng 400/500/600/700, `font-display: swap`), kèm fallback hệ thống; không tải từ Google Fonts khi chạy sản phẩm.
- Lý do: chi nhánh có thể mạng yếu hoặc chặn mạng ngoài; tránh gửi địa chỉ IP người dùng sang bên thứ ba (BA ghi nhận rủi ro dữ liệu cá nhân, cần xác nhận pháp lý nhẹ); bảo đảm hiển thị đủ dấu tiếng Việt; chạy `file://` và ngoại tuyến cảnh báo (NFR-OFF-01). Giấy phép Be Vietnam Pro là OFL, cho phép tự host.
- Việc cần làm: designer đặt file font vào `design/assets/fonts/` và khai báo `@font-face` trong `base.css`, bỏ thẻ Google Fonts khỏi 3 trang HTML.

---

## C. Bốn điểm lệch khỏi `design-system.md` và quyết định cuối

Nguyên tắc: không sửa giá trị token chuẩn §12. Các bổ sung là token **semantic/component mới** đặt tên không trùng, ghi chú "bổ sung của BA, chờ chủ dự án xác nhận" và đề nghị chủ dự án ghi vào `design-system.md` (phụ lục) sau khi duyệt.

| # | Điểm lệch | Quyết định | Lý do |
| --- | --- | --- | --- |
| (i) | Chữ badge dùng #166534, #92400E, #991B1B, #1E40AF thay màu gốc | **Chấp nhận.** Giữ `--color-*-text` trong lớp semantic; màu gốc dùng cho icon, viền, chấm, chart | Design-system §2 yêu cầu "nền nhạt + chữ đậm" và WCAG AA 4,5:1; #16A34A và #D97706 trên nền badge nhạt không đủ. Đây là bổ sung, không sửa token chuẩn |
| (ii) | Link dùng brand-600 (#5148E5) | **Chấp nhận** cho chữ link và chữ tím trên nền sáng; hover của link dùng brand-700. Nút giữ brand-500 | brand-500 trên nền trang #F8F9FC chỉ khoảng 4,4–4,5:1, sát ngưỡng, thiếu dự phòng; brand-600 cùng thang thương hiệu nên không lệch nhận diện |
| (iii) | Focus ring thêm viền đặc 2px | **Chấp nhận.** Focus = `outline: 2px solid` brand-500, offset 2px, giữ `--shadow-focus` làm vầng ngoài | Vầng alpha 18% theo `shadow.focus` gần như vô hình (khoảng 1,2:1) nên không đạt WCAG 2.2 SC 2.4.7/2.4.13 và 1.4.11. Phải **bỏ** khai báo `border-radius` trong `:focus-visible` (xem F-01) |
| (iv) | Viền input #D1D5DB chỉ khoảng 1,5:1 | **Thêm token component** cho control nhập liệu; **giữ nguyên** `border.default` #E5E7EB và `border.strong` #D1D5DB cho card, bảng, divider | WCAG 2.2 SC 1.4.11 yêu cầu 3:1 cho ranh giới thành phần giao diện cần để nhận biết |

Giá trị đề xuất cho (iv):

| Token component (mới) | Giá trị | Ghi chú |
| --- | --- | --- |
| `--input-border` | `#868D9A` (thêm primitive `--palette-gray-450`), tỉ lệ ước tính ≈ 3,3:1 trên trắng | Designer **phải đo lại** bằng công cụ; nếu < 3,0:1 thì dùng #6B7280 (= `text.tertiary`, ≈ 4,8:1) |
| `--input-border-hover` | `#6B7280` (`--color-text-tertiary`) | Đã đúng trong tokens.css |
| `--input-border-focus` | `--color-primary` (brand-500, ≈ 4,7:1) | Kèm focus ring (iii) |
| `--input-border-error` | `--color-danger` | Kèm icon + thông báo chữ |
| `--control-border` (checkbox, radio, switch off) | cùng giá trị `--input-border` | cùng yêu cầu 3:1 |
| Disabled | giữ border.default; không yêu cầu tương phản (SC 1.4.11 miễn control bị vô hiệu) | |

Đây là **bổ sung** (thêm token component), không phải sửa token chuẩn của chủ dự án. Cần chủ dự án duyệt vì thay đổi cảm nhận "calm": viền input đậm hơn nhẹ.

**(v) Kích thước mục tiêu cảm ứng (điểm lệch thứ năm designer chưa nêu).** Design-system §11 ghi tối thiểu 44×44; designer dùng nút md 40px, sm 32px, icon 40px trên chuột. Quyết định: **chấp nhận 40/32px chỉ khi `pointer: fine` và màn ≥ 1024px**; từ 1024 trở xuống hoặc `pointer: coarse` mọi control ≥ 44px; màn thợ trên tablet dùng 52px. Có ghi rõ trong handoff. Các control còn dưới 44px ở chế độ cảm ứng xem F-06.

**Mâu thuẫn radius input 6px (§5) và 8px (§16).** Quyết định: Input, Select, Textarea, Date field = **8px** (`--radius-md`, theo "Quyết định chốt" §16 và bảng chốt thắng bảng mô tả §5). `radius.sm` 6px dùng cho control nhỏ: checkbox, segmented item, menu item, chip lọc trong thanh công cụ, nút icon nhỏ. Button 8px. Đề nghị chủ dự án sửa §5: "sm 6px – control nhỏ; input form dùng md 8px".

---

## D. Danh sách việc cần cập nhật ở tài liệu khác (không thực hiện trong lượt này)

| Tài liệu | Nội dung |
| --- | --- |
| `docs/user-journey-business-workflow.md` §7 | Thêm bộ trạng thái Lịch hẹn/Tiếp nhận; lý do của Tạm dừng; thuộc tính duyệt của hạng mục; nhãn Thanh toán "Chưa thanh toán/Thanh toán một phần/Đã thanh toán"; ghi chỉ báo đồng bộ hóa đơn |
| `docs/design-system.md` | Phụ lục token bổ sung (badge text, link, focus outline, input border); sửa §5 radius; ghi đối tượng sở hữu của từng nhãn ở "Màu theo nghiệp vụ" |
| `docs/functional-requirements.md` | Có thể thêm FR cho nhật ký truy cập khi "Hiện" dữ liệu cá nhân (nay chỉ NFR-SEC-03, FR-SYS-003), format mã chứng từ (mở rộng FR-REC-030), lý do tạm dừng; thêm UAT tương ứng. Chưa sửa vì chưa được yêu cầu |
| `docs/ui-ux/00-foundation.md` §6, §11 | Cập nhật theo bảng A.2 sau khi designer sửa |
