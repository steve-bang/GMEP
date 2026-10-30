# BA – Trả lời 14 câu hỏi của Gói 6 "Báo cáo và Hệ thống" (`06-reports-system.md` §10)

Phiên bản 0.1 · Ngày 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để đi tiếp).

Nguyên tắc áp dụng (như `ba-decisions.md`): nghiệp vụ trong BRD/FRD/Journey thắng; điểm `[Cần xác nhận]` lớn (nhà cung cấp hóa đơn/Zalo/SMS, giá vốn, công thợ, hạn mức duyệt, thời hạn lưu, số pháp nhân, RPO/RTO) **không bị khóa cứng**: thiết kế theo hướng cấu hình có ngày hiệu lực, giá trị mẫu chỉ để minh họa. Công thức dưới đây là **định nghĩa chỉ số mặc định** (cấu hình được tham số); kế toán/chủ garage ký xác nhận trước khi nghiệm thu (NFR-MNT-01).

## Tóm tắt

| Câu | Quyết định ngắn |
| --- | --- |
| 1 | Giữ **một** mục menu "Cài đặt"; hiện cho mọi vai trò có ít nhất một màn SYS được mở; thanh điều hướng cài đặt **chỉ liệt kê màn trong quyền** của vai trò. Không rải sang menu nghiệp vụ (chỉ thêm đường tắt ngữ cảnh) |
| 2 | Có 3 nhóm: cần Chủ garage (CH) duyệt / cần người duyệt cấp chi nhánh / không cần duyệt. Có **Nháp**. **Không** cho ngày hiệu lực trong quá khứ. Người đề xuất không tự duyệt |
| 3 | Xuất báo cáo (đã che): CH, QV, QL, KT. Xuất dữ liệu cá nhân đầy đủ: CH, KT (có lý do). AD chỉ xuất nhật ký, không xuất báo cáo nghiệp vụ |
| 4 | Công thức chính thức ở bảng 4.1–4.3 |
| 5 | Chính thức = ngày đã **Chốt ngày** (FR-ACC-004). Mở lại ngày: về "Số tạm – đã mở lại", giữ nhãn bản đã chốt trước đó |
| 6 | Ngưỡng mặc định 3 ngày kể từ Hoàn tất (cấu hình theo chi nhánh/nhóm khách). Công nợ có hạn thanh toán được duyệt và chưa quá hạn = "Công nợ hợp lệ" |
| 7 | Hợp nhất: mỗi chi nhánh một dòng **kèm dòng tổng**; không cộng gộp chi tiết; nhiều pháp nhân thì tổng theo pháp nhân |
| 8 | Giữ thẻ liên kết sang gói Tài chính/Nhân sự, ẩn thẻ nếu module chưa bật hoặc ngoài quyền |
| 9 | Xác nhận: KT bắt buộc MFA (cấu hình được) |
| 10 | Quyền che chỉnh theo **từng vai trò** (5 mức) có "trần" theo luật; **không** cấu hình theo từng người; vai trò tự tạo không vượt ma trận chuẩn của vai trò nền |
| 11 | `.xlsx` duy nhất; 20 MB / 50.000 dòng mỗi lô; quy tắc trùng mã theo loại dữ liệu; AD không xem PII thô khi nhập |
| 12 | RPO ≤ 1 giờ, RTO ≤ 4 giờ (theo NFR-AVA-02); QL không xem sao lưu |
| 13 | Không đặt số năm mặc định; khung lưu trữ + câu hỏi cho kế toán/luật sư |
| 14 | Không ánh xạ màu biểu đồ theo màu trạng thái; thứ tự màu cố định theo quy trình, luôn kèm chữ và số |

---

## Câu 1 – Menu "Cài đặt" cho KT, CV, QĐ, TK, QV

- **Quyết định.** Giữ **một** mục "Cài đặt" ở chân sidebar. Mục này hiện cho vai trò có ít nhất một màn SYS trong quyền: CH, QV (SYS-09), QL, KT (SYS-07 X, 10, 12, 16 X, 19, 23), CV (SYS-07 X), QĐ (SYS-14), TK (SYS-20), AD. Thanh điều hướng cài đặt (cột trái 248 px / ô chọn "Mục cài đặt") **chỉ liệt kê màn vai trò được mở**; nhóm không còn màn nào thì ẩn. TH, TN không có mục "Cài đặt". Trên menu nghiệp vụ chỉ thêm **đường tắt ngữ cảnh** (ví dụ ở màn Báo giá: "Xem hạn mức giảm", ở Thuế: không cần).
- **Lý do.** Đặt cấu hình rải rác ở Tài chính/Kho/Nhân sự làm người quản trị khó tìm và nhân bản điều hướng; trong khi KT/CV/QĐ/TK chỉ có 1–2 màn nên một mục có lọc theo quyền là đủ. Màn ngoài quyền không nên liệt kê rồi mới báo "Không có quyền" (nguyên tắc quyền hiển thị rõ nhưng không dẫn người dùng vào ngõ cụt).
- **Căn cứ.** FRD §2 (hàng "Người dùng, phân quyền, cấu hình" chỉ nói về quản trị người dùng; các danh mục nghiệp vụ như thuế, giờ chuẩn, mẫu in không có hàng riêng, xem Phụ lục B), FR-SYS-002, FR-SYS-006, `screen-inventory.md` §8.5.
- **Tác động.** `00-foundation.md` §7 và `ROLE_MENU` trong `app.js` cần thêm `set: 'limited'` cho QV, KT, CV, QĐ, TK (nhãn chế độ "Danh mục"); `pack.js` bỏ cách mở menu bằng `gate()`; thanh điều hướng cài đặt lọc theo `data-allow` của từng trang.

## Câu 2 – Quy trình duyệt cấu hình, bản nháp, ngày hiệu lực quá khứ

- **Quyết định.**
  1. **Ba nhóm**:
     - **Nhóm A – CH duyệt** (rủi ro tài chính/pháp lý/bảo mật): thuế (SYS-10), nâng hạn mức giảm giá (SYS-09), giờ chuẩn và đơn giá giờ công (SYS-07), bảng giá/đơn vị phát hành/kho gán cho chi nhánh (SYS-06 phần tài chính), vai trò và quyền (SYS-04), hạ mức bảo mật (SYS-24), chuyển hóa đơn sang môi trường thật (SYS-16), gói bảo dưỡng và chu kỳ nhắc (SYS-08, 11), thu hồi/phát hành danh mục (SYS-15), hoàn tác lô, khôi phục thật, chạy ẩn danh/xóa, đổi thời hạn lưu (SYS-21, 22, 23).
     - **Nhóm B – cấp chi nhánh duyệt**: bộ bước quy trình (SYS-13) và checklist QC (SYS-14) do **QL duyệt**; mẫu kế toán (SYS-12) do **KT duyệt**.
     - **Nhóm C – không cần duyệt, chỉ ghi nhật ký**: thông tin chung chi nhánh (giờ mở cửa, địa chỉ), nội dung mẫu tin nhắn (khi kênh chưa gửi cho khách), chương trình giảm giá nằm trong hạn mức.
  2. **Trạng thái phiên bản chung** (dùng cho mọi màn SYS có ngày hiệu lực): Nháp → Chờ duyệt → Sắp hiệu lực → Hiện hành → Hết hiệu lực; nhánh Từ chối (kèm lý do). Cần thêm tag **Nháp** và **Từ chối** vào bộ "Hiện hành / Sắp hiệu lực / Chờ duyệt" hiện có.
  3. **Bản nháp**: có; chỉ người tạo thấy và sửa, không ảnh hưởng chứng từ, không hết hạn; gửi duyệt mới thành "Chờ duyệt".
  4. **Ngày hiệu lực**: tối thiểu là **ngày hiện tại**, không cho quá khứ; hiệu lực từ 00:00 của ngày đó. Nếu duyệt muộn hơn ngày đã chọn thì người duyệt phải xác nhận một ngày hiệu lực mới (hệ thống không tự lùi). Hai phiên bản cùng một đối tượng **không trùng, không chồng ngày** (lỗi hiện có ở drawer là đúng). Sai sót của giá trị cũ xử lý bằng chứng từ điều chỉnh (RULE-010), không bằng hiệu lực hồi tố. Ngoại lệ duy nhất: dữ liệu khởi tạo lúc go-live (nhập từ Excel) có thể mang ngày hiệu lực lịch sử.
  5. **Phân tách nhiệm vụ**: người đề xuất không tự duyệt. Riêng CH tự đề xuất thì duyệt luôn nhưng phải xác nhận lại bằng mật khẩu và có nhật ký.
  6. **Người duyệt có đủ hai hành động Duyệt và Từ chối** (FR-SYS-013), Từ chối bắt buộc lý do.
- **Lý do.** Cấu hình tài chính/pháp lý đổi sai gây sai tiền và sai hóa đơn; nhóm B/C cần nhanh để vận hành chi nhánh. Cho hiệu lực quá khứ làm lệch chứng từ đã tạo, trái nguyên tắc "không đổi chứng từ đã tạo".
- **Căn cứ.** FR-SYS-006, FR-SYS-004, FR-SYS-013, BR-SYS-03, NFR-MNT-01, RULE-010, RULE-013; cột "D" trong `screen-inventory.md` §8.5.
- **Tác động.** SYS-04, 06, 07–16, 21–24 (xem F6-08, F6-10 trong review). Hạn mức duyệt cụ thể vẫn cấu hình ở G4-APR-03 (D-11).

## Câu 3 – Quyền xuất và xuất dữ liệu cá nhân

- **Quyết định mặc định** (sửa được ở SYS-04, đổi quyền cần CH duyệt):

| Vai trò | Xuất báo cáo (cột cá nhân đã che) | Xuất cột cá nhân đầy đủ |
| --- | --- | --- |
| CH | Có (toàn chuỗi) | Có, **bắt buộc lý do**, nhập lại mật khẩu, ghi nhật ký |
| QV | Có (nhóm được giao) | Không (xin quyền riêng) |
| QL | Có (chi nhánh mình) | Không mặc định (xem được trên màn hình nhưng xuất hàng loạt cần quyền riêng) |
| KT | Có (báo cáo tiền/hóa đơn/công nợ trong phạm vi) | Có, bắt buộc lý do và nhập lại mật khẩu |
| CV, QĐ, TK, TN, TH | Không | Không |
| AD | **Chỉ xuất nhật ký thao tác/nhật ký tích hợp** (giá trị khách đã che); không xuất báo cáo nghiệp vụ | Không |

- **Lý do.** FRD §2 cho AD "–" ở "Báo cáo và dashboard" và cấm xem dữ liệu nhạy cảm của khách; xuất hàng loạt là rủi ro lớn hơn xem từng bản ghi nên tách riêng (FR-CRM-017). Mọi lần xuất ghi nhật ký: người xuất, phạm vi, kỳ, số dòng, có/không dữ liệu cá nhân, lý do.
- **Căn cứ.** FR-SYS-013, FR-CRM-017, NFR-EXP-01, NFR-ISO-01, FRD §2 ghi chú AD, `ba-decisions.md` câu 8 và D-02 (xuất danh sách khách yêu cầu nhập lại mật khẩu).
- **Tác động.** `pack.js` `canExport` bỏ AD ở màn báo cáo; hộp thoại xuất có bước nhập lại mật khẩu khi chọn cột cá nhân (xem F6-30).

## Câu 4 – Công thức chỉ số RPT

**Quy ước chung** (áp dụng mọi chỉ số, hiển thị ngay dưới tên chỉ số):
- Thời điểm và phạm vi luôn hiển thị (RULE-015). Chỉ số theo kỳ dùng **ngày chốt** để gắn nhãn Chính thức/Số tạm (câu 5).
- **Lệnh Đã hủy** loại khỏi mọi chỉ số vận hành và doanh thu; đếm riêng thành "Lệnh hủy".
- **Lệnh bảo hành** (cờ Bảo hành, giá trị 0 hoặc chi phí chịu bởi chi nhánh chịu bảo hành) **loại khỏi** doanh thu, giá trị trung bình, tỷ lệ báo giá được duyệt; **vẫn tính** vào thời gian hoàn thành, đúng hạn và tỷ lệ quay lại. Có bộ lọc "Gồm/không gồm lệnh bảo hành". Chính sách bảo hành chéo chi nhánh vẫn là `[Cần xác nhận]` (D-13 mục 6).
- **Doanh thu** (đề xuất, KT xác nhận): tổng thành tiền các lệnh chuyển sang **Hoàn tất** trong kỳ, **sau giảm giá**, hiển thị **chưa thuế GTGT**; các số dùng để đối chiếu thu tiền ("Tổng giá trị lệnh gồm thuế") ghi nhãn "gồm thuế". Mọi số tiền phải ghi rõ "chưa thuế" hay "gồm thuế".
- Tên chỉ số có thể đi sâu tới chứng từ (FR-RPT-011); tổng danh sách = số đã bấm.

### 4.1 Doanh thu, thu tiền (RPT-02, 03)

| Chỉ số | Công thức mặc định | Ghi chú |
| --- | --- | --- |
| Số lệnh (khối lượng) | Số lệnh **mở** trong kỳ (theo ngày duyệt lệnh), không tính Đã hủy | Dùng nhãn "Số lệnh mở"; khác "Số lệnh hoàn tất" |
| Số lệnh hoàn tất | Số lệnh chuyển sang Hoàn tất trong kỳ | Mẫu số của giá trị trung bình |
| Doanh thu ngày D | Σ thành tiền (chưa thuế) lệnh Hoàn tất trong ngày D | Số tạm đến khi chốt ngày |
| Tổng giá trị lệnh gồm thuế (ngày D) | Σ thành tiền gồm thuế các lệnh Hoàn tất trong ngày D | Cơ sở khớp số liệu |
| Đã thu của lệnh trong ngày | Σ phiếu thu **gắn các lệnh Hoàn tất trong ngày D**, thu đến cuối ngày D | Khác "tổng tiền thu trong ngày" |
| Công nợ phát sinh ngày D | Tổng giá trị lệnh gồm thuế − Đã thu của lệnh trong ngày | |
| **Khớp số liệu** (FR-RPT-003) | Đã thu của lệnh trong ngày + Công nợ phát sinh = Tổng giá trị lệnh gồm thuế (ngày D) | Hiển thị thêm "Thu nợ cũ", "Thu trước/cọc" để tổng tiền vào quỹ khớp sổ quỹ |
| Giá trị trung bình mỗi lệnh | Doanh thu (chưa thuế) ÷ Số lệnh hoàn tất | Cùng công thức ở RPT-02 và RPT-08 |
| So sánh tháng | Cùng **số ngày**: 01→ngày D của tháng này so với 01→ngày D của tháng trước | Ghi "cùng N ngày" |

### 4.2 Vận hành (RPT-04) và chỉ số bổ sung (RPT-08)

| Chỉ số | Công thức mặc định | Ghi chú |
| --- | --- | --- |
| Xe đang sửa | Số lệnh ở Đã duyệt, Đang sửa, Tạm dừng, Chờ QC, Sẵn sàng bàn giao tại thời điểm xem | Ảnh chụp tại giờ báo cáo, không có kỳ |
| Xe trễ hẹn | Lệnh mở có **giờ hẹn giao hiện hành** < giờ hiện tại | Cùng truy vấn với bảng điều phối G2-REC-03 |
| Thời gian hoàn thành TB | TB và trung vị của (giờ **Sẵn sàng bàn giao** − giờ **Đã duyệt**), tính theo **giờ làm việc** của chi nhánh, **trừ** các khoảng Tạm dừng có lý do thuộc danh sách "không tính vào thời gian xưởng" (mặc định: *Chờ khách duyệt phát sinh*; *Chờ phụ tùng* **không** trừ vì thuộc trách nhiệm xưởng/kho) | Đổi mốc cuối từ Hoàn tất sang Sẵn sàng bàn giao vì Hoàn tất phụ thuộc khách nhận xe và thanh toán |
| Tỷ lệ giao đúng hạn | Số lệnh **Sẵn sàng bàn giao** lúc ≤ giờ hẹn giao hiện hành ÷ số lệnh có giờ hẹn rơi trong kỳ và đã đến hạn (đã sẵn sàng giao hoặc đã quá hẹn mà còn mở) | Hẹn đổi có khách xác nhận thì dùng hẹn mới; hẹn gốc lưu nhật ký và có chỉ số phụ "đúng hẹn gốc". Mục tiêu 90% là cấu hình theo chi nhánh |
| Tỷ lệ báo giá được duyệt | Số **báo giá** (tính phiên bản cuối) có kết quả *Duyệt toàn phần* hoặc *Duyệt một phần* ÷ số báo giá đã gửi **có kết quả** (Duyệt toàn phần + Duyệt một phần + Từ chối) trong kỳ gửi | Loại Nháp, Chờ khách duyệt, Hết hạn (hiển thị riêng). Thêm chỉ số bổ sung **Tỷ lệ giá trị được duyệt** = Σ giá trị dòng được duyệt ÷ Σ giá trị báo giá có kết quả, vì có duyệt một phần |
| Tỷ lệ QC trả lại (thay "làm lại") | Số hạng mục có trạng thái *Trả lại* ít nhất một lần ÷ số hạng mục *Hoàn thành* trong kỳ | Đơn vị là **hạng mục**, đổi nhãn "Tỷ lệ lệnh làm lại" thành "Tỷ lệ hạng mục QC trả lại" |
| Tỷ lệ quay lại sửa lỗi | Số lệnh bảo hành/làm lại cùng xe, cùng hạng mục mở trong **N ngày** (mặc định 30) sau Hoàn tất ÷ số lệnh Hoàn tất | Chỉ số riêng với dòng trên |
| Tỷ trọng doanh thu nhân công | Doanh thu dòng công ÷ tổng doanh thu (cùng cơ sở chưa thuế) | |
| DSO | Công nợ phải thu cuối kỳ ÷ doanh thu **gồm thuế** trong kỳ × **số ngày thực của kỳ** (không cố định 30) | Chỉ hiển thị cho kỳ ≥ 1 tháng hoặc cửa sổ 90 ngày; không dùng cho kỳ ngắn. Ngưỡng đổi màu cảnh báo là cấu hình |
| Lệnh có hóa đơn đúng ngày | Lệnh Hoàn tất có hóa đơn trạng thái **Đã xuất/Thay thế/Điều chỉnh** (không tính Hủy) với ngày lập ≤ ngày Hoàn tất ÷ số lệnh Hoàn tất | Lệnh khách không lấy hóa đơn: chờ kế toán xác nhận chính sách `[Cần xác nhận]` |

### 4.3 Khách hàng (RPT-07) và kho (RPT-06)

| Chỉ số | Công thức mặc định | Ghi chú |
| --- | --- | --- |
| Khách mới | Khách có lệnh **đầu tiên** (toàn công ty) trong kỳ | Đơn vị: khách (người/doanh nghiệp), không phải xe |
| Khách quay lại | Khách có lệnh trong kỳ và có ≥ 1 lệnh Hoàn tất trước kỳ trong **12 tháng** | |
| Tỷ lệ quay lại | Khách quay lại ÷ (khách mới + khách quay lại) trong kỳ | Khớp dữ liệu mẫu 312 ÷ 460 = 67,8% |
| Công nợ khách còn phải thu | Σ dư nợ lệnh của khách (FR-ACC-006) tại thời điểm xem | |
| Tồn khả dụng | Tồn thực tế − Tồn giữ chỗ; hàng đang về **không** cộng | Đã chốt ở `ba-decisions.md` câu 4 |
| Hàng chậm luân chuyển | Tồn thực tế > 0 và **không có xuất nào** trong N ngày (mặc định 90, theo nhóm hàng) | |
| Độ chính xác tồn | Số mặt hàng kiểm kê có Thực đếm = Sổ ÷ số mặt hàng kiểm kê (chỉ số phụ theo giá trị: 1 − Σ\|lệch × giá vốn\| ÷ Σ giá trị sổ) | |
| Vòng quay tồn | Giá vốn hàng xuất trong kỳ ÷ giá trị tồn bình quân kỳ; kèm "số ngày tồn" = số ngày kỳ ÷ vòng quay | Phụ thuộc phương pháp giá vốn `[Cần xác nhận]` nên luôn hiển thị phương pháp đang dùng |
| Hao hụt | Σ (số lượng lệch âm × giá vốn) từ phiếu điều chỉnh kiểm kê/hủy hàng trong kỳ | Điều chỉnh dương không bù trừ |

**Căn cứ:** FR-RPT-003, 004, 005, 010, 012, 015, 016; RULE-007, 008, 009, 015; FR-INV-020; FR-ACC-004, 006; FR-EIN-009; `ba-decisions.md` A.2 (bộ trạng thái). **Việc phải làm:** kế toán ký ví dụ kiểm thử cho các công thức tiền (doanh thu, thu, công nợ, giá vốn, DSO) theo NFR-MNT-01; thêm ví dụ vào bộ UAT-01.

## Câu 5 – Số tạm/chính thức và mở lại ngày

- **Quyết định.**
  1. **Chính thức** = ngày của chi nhánh đã **Chốt ngày** (FR-ACC-004). Chưa chốt = **Số tạm** (nhãn Warning kèm chữ).
  2. Chỉ số theo kỳ (tháng/tuần): nhãn "Chính thức" khi **mọi ngày** trong kỳ đã chốt; ngược lại "Gồm N ngày chưa chốt".
  3. **Báo cáo kho** là ảnh chụp "tại thời điểm" nên không dùng nhãn số tạm; chênh lệch kiểm kê chính thức khi phiếu kiểm kê được duyệt.
  4. **Báo cáo vận hành** (RPT-04) là số tại thời điểm; riêng chỉ số theo kỳ (đúng hạn, thời gian hoàn thành) áp quy tắc 2.
  5. **Mở lại ngày** (CH duyệt, FR-ACC-005): ngày chuyển về "Số tạm – đã mở lại lúc …, lý do …"; hệ thống **giữ và hiển thị** "Bản đã chốt lần 1: <số>" để so sánh; sau chốt lại phát hành "Bản chốt lần 2". Tệp xuất ghi phiên bản chốt vào dòng đầu.
- **Lý do.** Người xem cần biết con số có còn đổi hay không; giữ bản đã công bố tránh tranh cãi giữa chi nhánh và chủ.
- **Căn cứ.** FR-RPT-010 (đang `[Cần xác nhận]`), FR-ACC-004/005, RULE-015, UAT-07.

## Câu 6 – RPT-05: ngưỡng "chưa thu" và công nợ hợp lệ

- **Quyết định.**
  - Ngưỡng mặc định **3 ngày** kể từ ngày Hoàn tất cho khách lẻ; cấu hình theo chi nhánh và theo nhóm khách (doanh nghiệp theo hạn thanh toán thỏa thuận).
  - Lệnh còn nợ **có hạn thanh toán được duyệt** (ghi trên lệnh/hợp đồng, người duyệt theo G4-APR-03) và **chưa quá hạn** = **Công nợ hợp lệ** (không phải "thiếu"). Quá hạn: hiện cờ "Công nợ quá hạn" và chuyển sang báo cáo tuổi nợ (G4-ACC-10); không đếm vào "Thiếu thành phần".
  - Lệnh **chỉ có nhân công** (không có dòng phụ tùng) hiển thị "Không áp dụng" ở cột Phiếu xuất kho, không tính là thiếu.
  - Cột Hóa đơn chỉ coi là "có" khi trạng thái nhà cung cấp trả về là Đã xuất/Thay thế/Điều chỉnh; Hủy hoặc đang lỗi = thiếu (hiển thị trạng thái, FR-EIN-009).
- **Lý do.** Phân biệt công nợ có kiểm soát với thất thoát; tránh báo động giả làm KT mất niềm tin báo cáo.
- **Căn cứ.** FR-RPT-004, FR-RPT-008, FR-EIN-009, FR-ACC-006, RULE-007; `ba-decisions.md` A.2 (công nợ quá hạn là cờ, không là trạng thái).

## Câu 7 – RPT-03 khi phạm vi hợp nhất

- **Quyết định.** Hiển thị **mỗi chi nhánh một dòng + dòng tổng** (đúng như prototype) cho phạm vi CH/QV; không cộng gộp chi tiết (hình thức thanh toán, so sánh tháng) khi phạm vi nhiều chi nhánh. Khi hệ thống có nhiều pháp nhân: nhóm theo pháp nhân, tổng theo từng pháp nhân là số chính thức; "Tổng toàn chuỗi" chỉ để quản trị, ghi nhãn "không phải số chính thức theo pháp nhân". Vai trò chỉ có một chi nhánh không có chế độ hợp nhất.
- **Căn cứ.** FRD §2, FR-RPT-001, FR-SYS-018, `ba-decisions.md` câu 9, RULE-015, NFR-ISO-01.

## Câu 8 – Thẻ "phải thu/phải trả/lãi lỗ" trong Trung tâm báo cáo

- **Quyết định.** Giữ thẻ liên kết (không tách trùng, đúng ghi chú đầu `screen-inventory.md` §8.4) nhưng: (a) chỉ hiện với vai trò có quyền xem báo cáo đích; (b) **ẩn** thẻ của module chưa bật (feature flag theo giai đoạn) thay vì để liên kết "#" cụt; (c) thẻ ghi rõ gói nguồn ("Tài chính", "Nhân sự").
- **Căn cứ.** FR-RPT-006, 007, 013; `screen-inventory.md` §8.4; FRD §13 (ACC giai đoạn 2–3).

## Câu 9 – MFA cho Kế toán (G-02)

- **Quyết định.** **Xác nhận**: MFA bắt buộc cho CH, QV, QL, **KT**, AD (D-02); các vai trò khác tùy chọn. Là tham số cấu hình ở SYS-24, nhưng mặc định bật cho KT vì KT giữ tiền, công nợ và hóa đơn. Phương thức chính TOTP, dự phòng mã khôi phục và email.
- **Căn cứ.** FR-SYS-001, `screen-inventory.md` D-02 và G-02, NFR-SEC-01. Vẫn ghi `[G-02]` chờ khách xác nhận.

## Câu 10 – SYS-04: quyền che dữ liệu cá nhân và vai trò tự tạo

- **Quyết định.**
  1. Quyền che sửa được **theo từng vai trò** (5 mức hiện có) và **không** theo từng người. Bỏ lựa chọn "Đầy đủ (cần Chủ garage duyệt)" theo người ở SYS-02; nhu cầu ngoại lệ dùng "quyền tạm thời có thời hạn" (ngoài phạm vi Phase 1).
  2. Mỗi vai trò có **trần theo luật** không nâng được: AD luôn "Không hiển thị"; TH chỉ thấy tên + biển số việc mình; KT không được đặt "Đầy đủ"; TK địa chỉ không hiển thị. Hạ mức che (nới) cần CH duyệt, có lý do, ghi nhật ký.
  3. **Vai trò tự tạo** (ví dụ Kế toán trưởng) phải chọn **vai trò nền** để sao chép; quyền tối đa = ma trận chuẩn của vai trò nền + các ngoại lệ đã ghi trong FRD §2 (hóa đơn điện tử: duyệt điều chỉnh/thay thế/hủy). Không thêm quyền vượt ma trận qua giao diện; muốn vượt phải đổi FRD §2.
  4. Quyền "Xuất dữ liệu" và "Quản lý" chỉ chọn được ở chức năng vai trò đã có quyền **Xem**.
- **Căn cứ.** FR-SYS-012/013, FRD §2 ghi chú, NFR-SEC-03, `ba-decisions.md` câu 8 và D-10, BR-SYS-06, UAT-19.

## Câu 11 – SYS-20: giới hạn, định dạng, trùng mã, ai nhập

- **Quyết định.**
  - **Định dạng**: `.xlsx` theo mẫu chuẩn (Phase 1). CSV UTF-8 là Could. Tệp có mật khẩu/macro bị từ chối (đã có).
  - **Giới hạn mặc định** (cấu hình): 20 MB và 50.000 dòng/lô; trên 5.000 dòng kiểm tra ở nền; lớn hơn thì chia lô.
  - **Trùng mã với dữ liệu đã có**:
    - Danh mục (phụ tùng, dịch vụ/giờ chuẩn/bảng giá): *cập nhật* được, xem trước hiển thị **trước → sau**; các trường có hiệu lực theo ngày (giá, giờ chuẩn) phải kèm **ngày hiệu lực** nhập ở bước 1/3.
    - Khách và xe: **không ghi đè**; trùng (biển số chuẩn hóa/MST/SĐT) vào danh sách "nghi trùng", người nhập chọn Bỏ qua hoặc hợp nhất thủ công; trường trống được bổ sung.
    - Tồn đầu kỳ, công nợ đầu kỳ: **từ chối** nếu kho/kỳ đó đã có lô đầu kỳ; sửa bằng phiếu điều chỉnh (RULE-010).
    - Lịch sử sửa chữa: chỉ tạo mới, gắn cờ "Dữ liệu chuyển đổi" để không lẫn vào doanh thu kỳ hiện hành.
    - Trùng mã **ngay trong tệp**: lỗi theo dòng (đã có).
  - **Ai nhập**:
    - Khách và xe: QL (chi nhánh mình) và CH. AD được chạy kiểm tra kỹ thuật nhưng **cột dữ liệu cá nhân bị che** trong bảng ánh xạ, bảng lỗi và xem trước.
    - Danh mục phụ tùng: TK, QL, AD. Tồn đầu kỳ: **TK nhập, QL duyệt**, KT chỉ xem (FRD §2: KT = X ở kho). Công nợ đầu kỳ: KT nhập, KTT/CH duyệt. Nhân sự, dịch vụ/giờ chuẩn, lịch sử sửa chữa: AD, QL.
    - Ghi lô **môi trường thật** cho loại tài chính (tồn, công nợ đầu kỳ) cần người duyệt trước khi ghi.
  - **Số năm lịch sử** cần chuyển: tham số của SYS-20, `[Cần xác nhận]` (D-13 mục 9); đề xuất khởi đầu 3 năm gần nhất.
- **Căn cứ.** FR-SYS-007, BR-SYS-05, UAT-12, FRD §12, FRD §2, RULE-010, NFR-SEC-03, FR-CRM-002/003.

## Câu 12 – SYS-22: RPO/RTO, số bản, QL xem sao lưu

- **Quyết định.** **RPO ≤ 1 giờ, RTO ≤ 4 giờ** (đúng NFR-AVA-02, vẫn `[Cần xác nhận]`); khôi phục **theo thời điểm** (FR-SYS-010) nên màn khôi phục phải cho chọn ngày + giờ, không chỉ bản 02:00 hằng ngày. Giữ **30 bản hằng ngày + 12 bản hằng tuần + 12 bản hằng tháng** (cấu hình). Thử khôi phục hằng tháng ở môi trường thử. **QL không xem** màn sao lưu (thông tin toàn hệ thống, khôi phục ảnh hưởng mọi chi nhánh); QL nhận thông báo bảo trì/khôi phục. CH xem và duyệt; AD thao tác.
- **Lý do.** Sao lưu hằng ngày một mình cho RPO ~24 giờ, không đủ so với NFR; khôi phục thật ảnh hưởng mọi chi nhánh nên cần CH duyệt và thông báo trước.
- **Căn cứ.** FR-SYS-010, BR-SYS-04, NFR-AVA-02, NFR-AVA-01.

## Câu 13 – SYS-23: thời hạn lưu và người đã nghỉ

- **Quyết định.** **Không đặt số năm mặc định trong hệ thống** (NFR-DAT-01, NFR-PRI-01, D-13 mục 7 đều `[Cần xác nhận]`); ô để trống cho tới khi KT/luật sư nhập và CH duyệt. Khung cấu hình (mỗi dòng: thời hạn, hành động sau hạn, căn cứ, người xác nhận, ngày hiệu lực):

| Loại dữ liệu | Hành động sau hạn | Ghi chú |
| --- | --- | --- |
| Chứng từ kế toán, hóa đơn (kể cả XML/PDF) | Không xóa, không ẩn danh trong thời hạn luật | Khóa, theo kế toán |
| Hồ sơ khách và xe | Ẩn danh dữ liệu cá nhân | **Loại trừ** khách còn công nợ, còn bảo hành, còn lệnh mở |
| Nhật ký thao tác (audit) | Lưu trữ lạnh | Đề xuất giữ không thấp hơn thời hạn chứng từ liên quan; thêm dòng này |
| Nhật ký truy cập dữ liệu cá nhân | Lưu trữ lạnh | |
| Dữ liệu nhân viên đã nghỉ | Ẩn danh PII (CCCD, SĐT, địa chỉ, tài khoản ngân hàng) | Giữ **mã nhân viên** để nhật ký vẫn truy vết được; bảng mã → tên giữ theo thời hạn |
| Ảnh/tệp đính kèm lệnh | Lưu trữ lạnh hoặc xóa theo thời hạn | Thêm dòng này |
| Thông báo trong hệ thống | Xóa sau 12 tháng | Bỏ chú thích "Đề xuất BA…" khỏi giao diện |

  Người dùng đã nghỉ: quy trình **Khóa tài khoản ngay** (SYS-03) → bản ghi người dùng được giữ vì nhật ký/lệnh tham chiếu (RULE-013) → PII chỉ ẩn danh khi hết thời hạn dòng "Dữ liệu nhân viên đã nghỉ". Khối "3 tài khoản đã khóa trên 12 tháng" phải lấy từ dữ liệu thật của SYS-01.
- **Câu hỏi gửi kế toán/luật sư**: thời hạn lưu từng loại chứng từ; khách rút đồng ý nhưng còn nghĩa vụ bảo hành/công nợ thì xử lý thế nào; thời hạn lưu nhật ký truy cập PII.
- **Căn cứ.** FR-HRM-012, FR-CRM-011, NFR-DAT-01, NFR-PRI-01, RULE-010, RULE-013.

## Câu 14 – Palette biểu đồ 5 màu và bộ trạng thái

- **Quyết định.** **Không** ánh xạ màu biểu đồ theo màu badge trạng thái. Giữ 5 màu `--chart-series-1..5`, **thứ tự cố định theo quy trình** (ví dụ lệnh: Đã duyệt → Đang sửa → Tạm dừng → Chờ QC → Sẵn sàng bàn giao) và **cùng một trạng thái luôn cùng một màu** ở mọi biểu đồ (bảng ánh xạ đặt trong cấu hình biểu đồ, không phụ thuộc thứ tự dữ liệu). Mỗi đoạn có số, chú giải có chữ, bảng thay thế dùng badge nghiệp vụ. Nhiều hơn 5 nhóm thì gộp "Khác" hoặc chuyển sang bảng.
- **Lý do.** Design-system §9: không dùng đỏ/xanh lá làm màu trang trí; màu Danger/Success trong biểu đồ ngầm đánh giá tốt/xấu cho những nhóm chỉ mang tính phân loại (ví dụ "Từ chối" không phải lỗi). Màu nghiệp vụ của badge giữ cho chữ trạng thái.
- **Căn cứ.** `design-system.md` §2, §9; `ba-decisions.md` A.2.
- **Còn lại cho designer.** Đo tương phản chữ trắng trên 5 màu bằng công cụ (hiện chỉ ước tính).

---

## Phụ lục A – Quyết định bổ sung phát sinh khi review (BA đề xuất — chờ xác nhận)

1. **Khóa chi nhánh hai bước (SYS-05).** (1) "Ngừng nhận lệnh mới": chặn lịch hẹn/báo giá/lệnh mới nhưng vẫn cho hoàn tất lệnh đang mở, thu tiền, xuất hóa đơn, xuất kho gắn lệnh đang mở; (2) "Khóa hoàn toàn" chỉ khi không còn lệnh mở, phiếu thu chưa chốt ca, hàng đang đi đường, hóa đơn lỗi; hệ thống liệt kê các mục chặn và dẫn tới xử lý. Căn cứ FR-SYS-011, RULE-007.
2. **Hạn mức giảm giá (SYS-09).** QV (nhóm được giao) **đề xuất**, CH **duyệt** mọi thay đổi hạn mức; **QL không sửa hạn mức chi nhánh mình**, chỉ tạo chương trình giảm trong hạn mức; giảm vượt hạn mức trên từng báo giá do **QV hoặc CH** duyệt (FR-INV-025). Con số hạn mức vẫn là cấu hình (D-11).
3. **Thủ kho và giá vốn.** FRD §2: TK = "–" ở "Công nợ và giá vốn". RPT-06 cho TK chỉ xem **số lượng** (bốn số tồn, định mức, chênh lệch kiểm kê theo số lượng); giá trị tồn, giá vốn, hao hụt bằng tiền chỉ cho CH, QV, QL, KT.
4. **Bước quy trình khóa bởi quy tắc.** Ở SYS-13, các bước gắn với RULE-005/006 (báo giá và khách duyệt), FR-REC-016 (QC trước thu tiền) và thu tiền/hóa đơn **không tắt được cờ Bắt buộc**; chỉ đổi tên, người phụ trách, thứ tự và yêu cầu ảnh.
5. **Báo cáo "của tôi" (Xn).** CV, QĐ, TH, TK, TN chỉ thấy bản ghi mình phụ trách ở mọi báo cáo và ở RPT-10; Trung tâm báo cáo chỉ liệt kê báo cáo thực sự mở được (TH, TN không có báo cáo RPT riêng ở Phase 1; "Của tôi" nằm ở dashboard G1-DSH).

## Phụ lục B – Mâu thuẫn tài liệu cần cập nhật (chưa sửa trong lượt này)

| Tài liệu | Nội dung |
| --- | --- |
| FRD §2 | Hàng "Người dùng, phân quyền, cấu hình" gộp quản trị người dùng với danh mục nghiệp vụ. Đề xuất tách hàng "Danh mục và cấu hình nghiệp vụ (thuế, giờ chuẩn, giá, hạn mức, mẫu)": KT S (thuế, mẫu kế toán), QV S/đề xuất (hạn mức), QL S trong chi nhánh, CV/QĐ/TK X tùy màn. Hiện KT, QV bị "–" nhưng `screen-inventory.md` §8.5 giao quyền cho họ |
| FRD FR-ACC-009 | Ghi "mặc định theo chính sách hiện hành" trong khi SYS-10 không có mặc định. Đề xuất: có thể có **giá trị gợi ý ở trạng thái Nháp** nhưng chỉ hiệu lực khi KT nhập/ký và CH duyệt |
| FRD FR-RPT-010 | Còn `[Cần xác nhận]`; cập nhật theo câu 5 sau khi khách đồng ý |
| FRD FR-RPT-012/016 | Bổ sung định nghĩa chỉ số theo Câu 4; thêm UAT cho khớp số liệu (đã thu + công nợ = doanh thu) và cho "Không áp dụng" ở RPT-05 |
| FRD FR-SYS-010 | Làm rõ khôi phục "theo thời điểm" (ngày + giờ) và RPO/RTO sau khi khách xác nhận |
| `00-foundation.md` §7 | Bảng vai trò → menu: thêm chế độ cài đặt giới hạn (Câu 1) |
| `screen-inventory.md` §8.5 | SYS-09: bỏ "QL (S)" cho hạn mức (Phụ lục A.2); SYS-20: KT không nhập tồn đầu kỳ (Câu 11); SYS-21: thêm QL xem lô chi nhánh mình |
| Journey §8 | Bổ sung quy tắc khóa chi nhánh hai bước (Phụ lục A.1) |

## Điểm vẫn `[Cần xác nhận]` với khách (không quyết thay)

Nhà cung cấp hóa đơn điện tử; nhà cung cấp Zalo/SMS; phương pháp giá vốn; công thức công thợ/hoa hồng; quy trình đồng sơn; chính sách bảo hành chéo chi nhánh; mức hạn mức giảm giá/duyệt; thời hạn lưu từng loại dữ liệu; RPO/RTO; số pháp nhân; số năm lịch sử cần chuyển; chính sách lệnh khách không lấy hóa đơn; doanh thu quản trị chưa thuế hay gồm thuế (kế toán).
