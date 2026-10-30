# BA review lần 2 – Gói G2 phần 1 (CRM, APT, REC, INS)

Phiên bản 0.1 · 30/10/2026 · BA. Đối tượng: `design/g2-workshop/*` (26 màn, `pack.css`, `pack.js`, `index.html`) và `docs/ui-ux/02-workshop-intake.md` bản 0.2. Chuẩn: `design-system.md`, `00-foundation.md`, `ba-decisions.md`, `ba-answers-02.md`, `review-02-workshop-intake-ba.md`.
Phương pháp: đọc code thực tế, không dựa vào bảng tự khai §9.2. Đã đọc toàn bộ REC-01, 03, 04, 06, CRM-08, `pack.js`, và đọc từng màn còn lại (CRM-01..07, 09..12, APT-01..04, REC-02, 05, 07, INS-01..03). Chưa kiểm: `design/assets/app.js` vừa được vá thêm vai trò MH/NS (nằm ngoài gói; cần kiểm lại 2 vai trò mới trên các màn có `data-g2w-deny`, vì danh sách deny của gói chưa liệt kê MH, NS). Chưa chạy trình duyệt thật.

## 1. Kết luận

**CHƯA ĐẠT — còn 17 finding mở: 0 Blocker, 4 Major, 13 Minor.**

Tiến bộ rõ: 22/27 finding vòng 1 đã đạt. 4 Major còn lại đều sửa nhanh (vài dòng). Sau khi sửa 4 Major thì đủ điều kiện chốt gói (Minor ghi handoff).

## 2. Kiểm từng finding vòng 1

| ID | Kết quả | Bằng chứng trong code |
| --- | --- | --- |
| F2-01 Thợ thấy tiền | **Chưa đạt** (Major) | Đã ẩn: khối Báo giá/Thanh toán/Hóa đơn (`g2-rec-04.html:62,65,66`), banner nợ (`:126`), timeline cọc (`:254`), tổng lệnh (`:195`). Còn sót: `:146` "Công 150.000 ₫" và `:160` "Công 450.000 ₫" nằm trong `g2w-item__sub`, không bọc `data-g2w-money` nên Thợ vẫn thấy tiền công. Thêm: tab Công thợ `:214` tổng giờ 3,0/1,2 gồm cả hạng mục của thợ khác trong khi dòng 3 bị ẩn (rò nhẹ, xem F2R2-11) |
| F2-02 | Đạt | Tab Thanh toán ẩn TH QD (`:136`), tab Hóa đơn ẩn TH QD CV (`:137`), Điều chỉnh/Hủy hóa đơn `data-g2w-lock="KT"` (`:239`), Xuất hóa đơn lock TN KT |
| F2-03 | Đạt | Biến thể `qc`, `ready` (`:31-32`, `:414-417`); `ready` bật Xuất hóa đơn, danh sách kiểm 5 mục Đạt/Thiếu, menu biên bản giao xe mở |
| F2-04 | Đạt | `data-v-edit` trên Phân thợ, Yêu cầu phụ tùng, Báo phát sinh, đổi thợ, Thu tiền; `apply()` `:450` khóa kèm lý do ở done/locked/cancelled |
| F2-05 | Đạt | Một bảng quyền: REC-03 `data-g2w-drag="CV QL QD"` + `ROLES_MOVE` kiểm trong `tryMove` (`pack.js:264-269`); REC-04 nút chính CV QD QL, QĐ cho QC |
| F2-06 | Đạt | `ALLOWED` chỉ 3 bước (`pack.js:257`); bước khác hiện lý do và liên kết (`:258-263`, hộp `dlg-move`) |
| F2-07 | **Chưa đạt** (Major) | Có nút "Tạm dừng…" (`:85`) và hộp thoại, nhưng nút "Tạm dừng" của `dlg-pause` (REC-04 `:386`, REC-03 `:145`) không bị khóa tới khi chọn lý do, "Khác" không bắt buộc ghi chú; trái A.1 và WF-09. Thẻ REC-03 không chuyển cột sau khi tạm dừng (mục 11.4 của designer) |
| F2-08 | Đạt (còn Minor) | REC-06: từng dòng Hoàn kho / Đã dùng + Miễn/Tính phí (`:50-52,134`), 4 cách xử lý tiền (2 tắt), chặn khi có hóa đơn và từ Chờ QC (`:121-122`), mỗi phiếu số riêng. Minor: số phiếu demo bắt đầu 00099 trong khi trạng thái chờ duyệt ghi 00098, 00099 (`:117` seq=98 rồi ++); phương án "Tính phí" chưa gắn nhãn chờ FR mới (xem F2R2-07) |
| F2-09 | Đạt | Trạng thái `self`, QL bị khóa, QV/CH duyệt; CH/QV không bị `deny` ở REC-06 |
| F2-10 | **Chưa đạt** (Major) | Đạt: nút theo tình huống (`g2-crm-08.html:90-96`), chặn khác loại, bảng đồng ý xem trước (`:52-60`), công nợ giữ theo lệnh gốc (`:49`), đã bỏ chữ "câu hỏi cho BA". Chưa đạt: biến thể `cross` vẫn hiện đủ hồ sơ B của Thủ Đức cho QL Quận 7 (họ tên, SĐT đầy đủ do `g2w-pii` cho QL, địa chỉ, cột đồng ý của B) tại `:35-42,54-58`; trái RULE-012, NFR-ISO-01 và câu 4 |
| F2-11 | Đạt | `renderCheck` 5 điều kiện Đạt/Thiếu (`:397-400`) |
| F2-12 | Đạt (ở REC-04) | `:126` sửa câu, bọc tiền, ẩn TH QD. Chưa đồng bộ sang CRM-03 (F2R2-04) |
| F2-13 | Đạt | Trạng thái cuối hạng mục giữ, tag "Công đã đảo", "Đã hoàn kho PN…" (`:444,443`) |
| F2-14 | Đạt | `#warranty-btn` lock CV QL, hiện ở done/locked (`:87,457`) |
| F2-15 | Đạt | `cancelOk` loại qc/ready, `cancelWhy` hiển thị (`:451-453`) |
| F2-16 | **Chưa đạt** (Minor) | Đã thống nhất 09:25 và "Cập nhật 09:30", nhưng "còn 6 giờ 45 phút" (`:55`) tính từ 09:15 và giờ thực "0,7" (`:163`) không khớp 09:25 → 09:30; biến thể `paused` ghi tạm dừng 09:40 sau mốc cập nhật 09:30 |
| F2-17 | Đạt | Giá chi nhánh khác chỉ hiện CH QV KT (`g2-rec-01.html:67`, `g2-crm-03.html:83`, `g2-crm-06.html:64`); CRM-06 `partial` chỉ hạng mục và km. Ghi handoff: điều kiện thật là phạm vi dữ liệu, không phải danh sách vai trò (KT chỉ thấy chi nhánh được gán) |
| F2-18 | Đạt | Ngày hẹn giao `data-g2w-req` + lỗi theo trường; bảng "Phụ tùng khách cung cấp" (`g2-rec-01.html:144-148`) |
| F2-19 | **Chưa đạt** (Minor, chấp nhận hoãn có điều kiện) | Chỉ có câu cảnh báo (`g2-rec-01.html:96`); chưa có tag "Số km bất thường" ở REC-02/REC-04. Quyết định ở mục 4 |
| F2-20 | Đạt | `pack.css:150` chỉ nâng 72px dưới 640px, có safe-area |
| F2-21 | Đạt (còn Minor) | CRM-09 `:28-29` ngưỡng hiện hành + nút "Ghi nhận đã gọi". Còn sót ở thẻ mobile và thanh hàng loạt (F2R2-08) |
| F2-22 | Đạt | `data-g2w-hide-for="TH"` trên dải Trước lệnh (`g2-rec-03.html:44`) |
| F2-23 | Đạt | Không còn `var(--x, fallback)` hay mã màu trong css/js |
| F2-24 | Đạt | `CD-`, `LH-`, `TX-` (10 chỗ), không còn `DS-`, `DL-`; phiếu hoàn `PN-` |
| F2-25 | Đạt | `<noscript>` 26/26 trang; ghi handoff ở `pack.js` đầu file và tài liệu §10 |
| F2-26 | Đạt | Chú thích `pack.js:1-3`, tài liệu §10 |
| F2-27 | **Chưa đạt** (Minor) | Tài liệu §2, §5, §7, §9 đã cập nhật; còn lệch: §4.2 `02-workshop-intake.md:131` vẫn ghi 6 biến thể, `index.html:25` ghi 6 biến thể (thực tế 8), §4.2 `:133` "QĐ chỉ xem" chưa nêu QĐ được Gửi QC/chấm QC, §2 dòng CRM-08 chỉ ghi QL trong khi code cho QV, CH hợp nhất liên chi nhánh |

## 3. Finding mới (F2R2)

### Major

| ID | Vị trí | Vấn đề | Cách sửa |
| --- | --- | --- | --- |
| F2R2-01 | `g2-crm-02.html:64` (và nên kiểm `g2-rec-01`, `g2-apt-02:42`) | Ô đồng ý "Nhắc bảo dưỡng, đăng kiểm, bảo hiểm" **được đánh dấu sẵn** (`checked`). Đồng ý dữ liệu cá nhân phải là hành động chủ động, im lặng/đánh sẵn không phải đồng ý (FR-CRM-010, Luật BVDLCN 2025; pháp chế khách xác nhận lại). Ghi nhận "Khách xác nhận tại quầy" mà ô đã tick sẵn thì nhật ký đồng ý không đáng tin | Bỏ `checked` ở mọi ô đồng ý ngoài mục bắt buộc cho dịch vụ; người nhập tick theo lời khách; lưu kèm cách ghi nhận, người ghi, thời điểm; nếu để trống thì nhắc vẫn không gửi (khớp FR-CRM-013) |
| F2R2-02 | (đây là F2-01 còn dở, tính một lần) | xem F2-01 | Bọc `Công 150.000 ₫`, `Công 450.000 ₫` bằng `data-g2w-money` hoặc ẩn dòng phụ với TH |

Ghi chú tính số: Major mở = F2-01, F2-07, F2-10, F2R2-01 (F2R2-02 chỉ là nhắc lại F2-01, không tính thêm) = **4**.

### Minor

| ID | Vị trí | Vấn đề | Cách sửa |
| --- | --- | --- | --- |
| F2R2-03 | `g2-rec-02.html:83,87-96` (cột, bộ lọc Thanh toán `:50`) | QĐ vẫn thấy cột Thanh toán, Hóa đơn, bộ lọc Thanh toán; REC-04 đã ẩn với QĐ (câu 11: QĐ không thấy tài chính). Không lộ số tiền thanh toán nhưng lộ "Quá hạn", "Chưa thanh toán" | `data-g2w-hide-for="TH QD"` cho 2 cột và bộ lọc; giữ Tổng tiền cho QĐ (ma trận cho xem lệnh) hoặc ghi rõ quyết định |
| F2R2-04 | `g2-crm-01.html:58,75` | Dòng khách DN không ẩn với Thợ ở bảng (nhưng ẩn ở thẻ mobile), kèm tag "Vượt hạn mức nợ"/"Nợ quá hạn" lộ công nợ cho TH, QĐ | Tag công nợ ẩn với TH QD; thống nhất hiển thị bảng và thẻ |
| F2R2-05 | `g2-crm-03.html:56`, tab `:63,98` | (a) Cảnh báo vẫn ghi "Thu tiền, giao xe cần duyệt vượt hạn mức", sai như F2-12 đã sửa ở REC-04 (thu tiền làm giảm nợ). (b) CV thấy tab "Thanh toán và công nợ" với tổng đã thanh toán 12 tháng, trong khi CRM-01 ẩn cột nợ với CV; theo câu 11 CV chỉ xem số còn phải thu của khách đang phục vụ và cảnh báo vượt hạn mức | (a) sửa câu theo REC-04. (b) ẩn tab với CV, giữ ô "Công nợ hiện tại" và cảnh báo |
| F2R2-06 | `g2-apt-02.html:26,44` | Biến thể vượt công suất nói "cần lý do; vượt mức tối đa cần Quản lý duyệt" nhưng không có ô lý do, nút Lưu luôn bật, không có bước duyệt (BA câu 6) | Thêm ô "Lý do đặt vượt công suất" bắt buộc ở biến thể `over`, khóa Lưu kèm lý do; thêm biến thể "vượt mức tối đa: gửi Quản lý duyệt" |
| F2R2-07 | REC-04 biến thể, REC-06 | (a) Không biến thể nào cho nút "Chuyển sang Chờ QC" ở trạng thái bật (luôn `primary[1]=true`), chưa thấy "nhắc khi đủ điều kiện"; (b) ở `ready`, "Báo phát sinh" và "Yêu cầu phụ tùng" vẫn bật (phát sinh phải chốt trước bàn giao); (c) REC-06 phương án "Tính phí khách" chọn được dù chưa có FR (gap G2-A) | (a) thêm biến thể "Đủ điều kiện gửi QC" có banner nhắc và nút bật; (b) khóa 2 nút từ `qc`/`ready` kèm lý do (phát sinh sau QC mở lệnh bảo hành/lệnh mới); (c) gắn nhãn "Chờ xác nhận nghiệp vụ" và để cấu hình |
| F2R2-08 | `g2-rec-02/03/05/07`, `g2-ins-02`, `g2-crm-06`, `g2-rec-01:67`, `g2-rec-04:413` | Dữ liệu mẫu mâu thuẫn: RO-…00124 là Ford Ranger 51A-246.80 (REC-02, REC-07) nhưng Fortuner 51B-808.09 (REC-03, REC-05); RO-…00127 Chờ QC (REC-02/03) mà REC-05 còn hạng mục "Đang làm", RO-…00125 Sẵn sàng bàn giao còn "Cân bằng động đang làm" (trái A.1); INS-02 "lần trước Má phanh Tốt" trong khi CRM-06 ghi lần 12/07 đã 1 Hỏng/2 Theo dõi; REC-01 ghi "bảo hành còn hạn đến 03/09/2026 (đã hết)"; REC-04 hủy ghi PN 00098…00100 trong khi REC-06 tạo 2 phiếu hoàn | Chuẩn hóa một bộ dữ liệu mẫu cho cả gói (bảng mã lệnh, biển, khách, thợ, trạng thái); sửa chữ bảo hành |
| F2R2-09 | `g2-crm-09.html:54-55,38`; `g2-crm-04.html:57`; `:46` | Thẻ mobile vẫn có nút "Nhắc/Nhắc lại" và thanh hàng loạt "Gửi nhắc" dù kênh chưa kích hoạt; xe "còn 1.800 km" nằm trong danh sách trong khi ngưỡng hiện hành ≤ 1.000 km hoặc ≤ 30 ngày; CRM-04 gắn cảnh báo vàng cho "còn 33 ngày" | Đổi nhãn thành "Ghi nhận đã gọi"; sửa dữ liệu mẫu theo ngưỡng; khi kênh bật mới đổi lại thành "Gửi nhắc" |
| F2R2-10 | `g2-crm-11` (thiếu), `g2-crm-01.html:25` | Chủ garage "duyệt xóa/ẩn danh" nhưng chưa có màn/trạng thái duyệt (chỉ nút Gửi duyệt); liên kết "Hợp nhất trùng" ở CRM-01 chỉ mở cho QL, QV/CH (được hợp nhất liên chi nhánh) không có lối vào | Thêm trạng thái "Chờ Chủ garage duyệt" ở CRM-11 (hoặc ghi rõ thuộc G4-APR); mở liên kết cho QL QV CH |
| F2R2-11 | `g2-rec-04.html:214`; `g2-crm-06.html:32,56,86`; `g2-rec-05.html:43,75` | (a) Tab Công thợ: dòng tổng giờ gồm hạng mục thợ khác khi Thợ xem. (b) CRM-06: Thợ bị ẩn tên chủ xe (BA câu 10 cho xem tên) và tab Sở hữu hiện cho CV dù ghi "chỉ hiện cho quản lý". (c) REC-05: đổi thợ khi đang làm ghi "QL duyệt" nhưng hộp thoại không có bước duyệt | (a) ẩn tổng với TH; (b) thống nhất quyền; (c) thêm dòng "gửi QL duyệt" khi hạng mục Đang làm |
| F2R2-12 | `g2-rec-07.html:34-48,60-66` | 10 cột công đoạn (có "Báo giá chi tiết", "Bàn giao") trong khi chốt giữ 9 bước mẫu của Journey; chưa có cờ "yêu cầu ảnh" theo công đoạn (câu 14); quay lại công đoạn trước chưa có ô lý do | Đối chiếu danh sách 9 bước với Journey §3, ghi "mẫu cấu hình"; thêm ô ảnh (bắt buộc nếu công đoạn có cờ) và lý do khi quay lại |

(Số Minor mở tổng cộng: F2-16, F2-19, F2-27 từ vòng 1 và F2R2-03..F2R2-12 mới = 13. Cộng 1 Minor do F2R2-02 tách riêng bị gộp vào F2-01 nên không đếm. Để rõ: **Major 4, Minor 13**; tổng 17.)

> Đính chính số liệu ở mục 1: số đúng là **4 Major, 13 Minor (tổng 17)**.

## 4. Trả lời 7 câu hỏi còn lại (mục 12 của `02-workshop-intake.md`) — BA đề xuất, chờ xác nhận

1. **Nhắc khi đủ điều kiện chuyển Chờ QC**: không tự chuyển (đã chốt A.1). Cần 3 chỗ: (a) thông báo trong ứng dụng cho CV, QĐ và QL của chi nhánh "RO-… đủ điều kiện gửi QC" (không SMS); (b) banner xanh trên REC-04 kèm nút chính bật; (c) tag "Đủ điều kiện gửi QC" trên thẻ REC-03 cột Đang sửa. Hạng mục phát sinh chờ duyệt liệt kê trong banner nhưng không chặn. Thợ không nhận thông báo này. Hậu quả nếu không làm: lệnh ngồi ở Đang sửa, trễ giao xe.
2. **Tính phí khách phần đã dùng khi hủy lệnh**: khi chọn "Tính phí", hệ thống tạo **dòng phải thu thuộc chính lệnh gốc** (không lập phiếu bán/lệnh mới) lấy giá từ báo giá đã duyệt; hóa đơn xuất theo luồng EIN bình thường với chỉ các dòng này. Lệnh vẫn Đã hủy, thanh toán tính lại. Gap G2-A thành FR mới ở cuối mục REC (FR-REC-037); cấu hình mặc định **tắt** cho tới khi khách và kế toán xác nhận. UI REC-06 gắn nhãn "Chờ xác nhận nghiệp vụ". Phương án thay thế (phiếu bán riêng) làm hồ sơ phân mảnh, không khuyến nghị.
3. **Hai cách xử lý tiền khi bật** ("giữ làm đặt trước", "trừ phí"): cần màn con: (a) giữ đặt trước: hạn giữ (cấu hình, đề xuất 30 ngày), liên kết khách/xe, ghi nhận đồng ý của khách (chọn cách: ký giấy, Zalo), hiển thị số dư đặt trước ở CRM-03 và khi thu tiền; hết hạn thì QL quyết định hoàn hoặc chuyển doanh thu theo hướng dẫn kế toán; (b) trừ phí: chỉ khả dụng khi đã chọn "Tính phí" ở bước 4(b), tự tính số hoàn = tiền đã thu − phí. Cả hai chờ kế toán chốt cách ghi nhận cọc (Journey §8); làm ở vòng thiết kế sau, chưa chặn gói này.
4. **"Thu đủ trước khi xuất hóa đơn"**: **có**, là điều kiện thứ 6 trong danh sách kiểm **chỉ khi cấu hình bật** (mặc định tắt, theo chi nhánh/loại khách). Khi bật mà thiếu: nhãn Thiếu "Còn phải thu x ₫" và liên kết Thu tiền. Khi tắt: không hiển thị dòng này. Cần ngày hiệu lực cấu hình.
5. **Quản lý vùng ở CRM-08 liên chi nhánh**: QV xem **đủ** hai hồ sơ nếu cả hai chi nhánh nằm trong nhóm được giao (đúng phạm vi quyền, RULE-012); nếu một hồ sơ ngoài nhóm thì chỉ mức tối thiểu như QL; CH xem đủ. QL chi nhánh luôn ở mức tối thiểu cho hồ sơ ngoài phạm vi: loại khách, tên viết tắt, SĐT che theo quy tắc, quận/huyện, ngày tạo, số lệnh; không email, địa chỉ chi tiết, bảng đồng ý, lịch sử. Đây là nội dung sửa F2-10.
6. **Cờ "Số km bất thường"**: ngưỡng mặc định **giảm hơn 1.000 km** (cấu hình theo chi nhánh, có ngày hiệu lực; có thể thêm ngưỡng %). Người nhận: Quản lý chi nhánh (thông báo "Cần xem" trong ngày); chưa xử lý sau 2 ngày làm việc thì nhắc QV; không gửi CH. QL ghi nhận "đã kiểm tra" kèm ghi chú, cờ giữ trong lịch sử. Hiển thị: tag trên REC-04 header và chip/cột ở REC-02 chỉ với QL, QV, CH.
7. **QĐ và cảnh báo vượt hạn mức nợ**: tab Thanh toán/Hóa đơn ẩn hoàn toàn với QĐ (giữ). QĐ **không** thấy số nợ. Nhưng việc giao xe do CV/QL thực hiện và hệ thống chặn ở màn giao xe (DLV), nên QĐ không cần biết lý do tài chính. Chỉ hiển thị cho QĐ một cờ trung tính "Giữ xe: chưa đủ điều kiện giao, liên hệ Cố vấn" (không số tiền) trên thẻ REC-03/REC-04, để QĐ không tự cho xe ra. Phương án thay thế "QĐ thấy số nợ" bị loại vì trái ma trận.

### Quyết định các phần "chưa xử lý trọn vẹn" (mục 11)

| Mục | Quyết định |
| --- | --- |
| 11.1 F2-19 cờ km bất thường | Chấp nhận hoãn ở Minor (không chặn bàn giao) với điều kiện: thêm 1 tag mẫu vào REC-04 header và REC-02 theo câu 6 trong vòng sửa tới, hoặc ghi vào handoff; thêm FR mở rộng FR-REC-003 |
| 11.2 F2-10 cột B tối thiểu | **Không chấp nhận hoãn**: phải sửa (Major vì cách ly chi nhánh) theo câu 5 |
| 11.3 Hộp Tạm dừng | **Phải sửa** (Major F2-07): khóa nút tới khi chọn lý do, "Khác" bắt buộc ghi chú, lý do hiện dưới nút |
| 11.4 Thẻ REC-03 sau tạm dừng | Prototype nên cho thẻ chuyển sang cột Tạm dừng kèm tag lý do ngay sau xác nhận (khách duyệt thiết kế cần thấy kết quả); bản thật chờ máy chủ. Minor, làm cùng 11.3 |

## 5. Việc cần làm tiếp

1. Designer sửa 4 Major: F2-01 (2 dòng tiền công), F2-07 (+11.4), F2-10 (cột B tối thiểu), F2R2-01 (bỏ tick sẵn).
2. Minor F2-16, F2-19, F2-27, F2R2-03..12: sửa trong vòng tới hoặc ghi handoff (F2R2-08 nên làm cùng một lượt để dữ liệu mẫu nhất quán).
3. BA cập nhật FRD/Journey/UAT theo `ba-answers-02.md` mục C cộng quyết định mục 4 (FR-REC-037 tính phí, FR-REC-038 tạm dừng, cờ km, điều kiện hóa đơn thứ 6, quyền QĐ) khi được yêu cầu riêng. Câu hỏi chuyển khách (đề xuất mặc định đã có): tính phí khi hủy, thu đủ trước xuất hóa đơn, hạn giữ đặt trước, ngưỡng km, thời hạn lưu dữ liệu.
4. Kiểm lại vai trò MH/NS vừa vá trong `design/assets/app.js` trên các màn gói G2 (chưa có trong `data-g2w-deny` hay khóa vai trò).

## 6. Kết luận cuối

**CHƯA ĐẠT — còn 17 finding: 4 Major (F2-01, F2-07, F2-10, F2R2-01), 13 Minor, 0 Blocker.**
