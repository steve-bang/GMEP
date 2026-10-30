# BA – Trả lời 16 câu hỏi của gói G2 phần 1 (`02-workshop-intake.md` mục 8)

Phiên bản 0.1 · 30/10/2026 · Trạng thái: **BA đề xuất — chờ xác nhận** (chủ dự án đã ủy quyền; designer dùng ngay để đi tiếp).

Nguyên tắc: nghiệp vụ trong BRD/FRD/Journey thắng; điều BRD/FRD còn `[Cần xác nhận]` thì thiết kế theo hướng **cấu hình có ngày hiệu lực**, không viết cứng. Mọi con số dưới đây là giá trị mặc định đề xuất, không phải số của khách. Chưa sửa FRD/Journey/BRD (chỉ liệt kê ở mục C).

---

## A. Ba bảng quy tắc dùng chung (designer áp dụng ngay)

### A.1 Điều kiện chuyển trạng thái Lệnh sửa chữa (FR-REC-015, FR-REC-028, WF-01..04, WF-09)

Mọi lần chuyển ghi người, thời điểm, lý do (WF-09). "Cờ" không phải trạng thái.

| Từ → Đến | Ai / cách | Điều kiện bắt buộc (chặn kèm lý do nếu thiếu) |
| --- | --- | --- |
| (Khách duyệt báo giá) → **Đã duyệt** | Hệ thống khi báo giá ở Duyệt toàn phần hoặc Duyệt một phần có bằng chứng duyệt (FR-REC-009/026) | Chỉ dòng được duyệt vào lệnh (FR-REC-010, WF-01) |
| Đã duyệt → **Đang sửa** | **Tự động** khi hạng mục đầu tiên chuyển Đang làm (thợ bấm trên tablet, FR-REC-013). Không có nút/kéo thả thủ công. Ngoại lệ: CV/QL "Ghi nhận bắt đầu thay thợ" kèm lý do (thợ không có tablet) | Hạng mục có thợ chính (FR-REC-012); hạng mục không ở thuộc tính "Chờ khách duyệt" (RULE-005); không có cờ "Chờ duyệt hủy" |
| Đang sửa → **Tạm dừng** | Thợ (tablet), hoặc CV/QĐ/QL bấm "Tạm dừng…", hoặc hệ thống khi thiếu phụ tùng | **Bắt buộc chọn lý do** từ danh sách cấu hình (Chờ phụ tùng, Chờ khách duyệt phát sinh, Nghỉ, Khác + ghi chú). Không kéo thả được |
| Tạm dừng → **Đang sửa** | CV/QL/QĐ "Tiếp tục sửa chữa", hoặc tự động khi hết lý do (phụ tùng đã xuất, khách đã duyệt) | Lý do tạm dừng đã được gỡ; nếu lý do là Chờ phụ tùng thì khả dụng ≥ số cần hoặc đã xuất (RULE-008) |
| Đang sửa → **Chờ QC** | CV, QĐ hoặc QL bấm "Chuyển sang Chờ QC". Hệ thống **nhắc** (thông báo) khi đủ điều kiện, **không tự chuyển** (vì có thể còn thêm việc) | (1) Mọi hạng mục đã duyệt ở **Hoàn thành**; không còn Chưa làm/Đang làm/Tạm dừng/Trả lại. (2) Mọi dòng phụ tùng của hạng mục đã **xuất** (RULE-007), hoặc bị bỏ dòng có lý do. (3) Lệnh không ở Tạm dừng, không có cờ "Chờ duyệt hủy". (4) **Hạng mục phát sinh đang Chờ khách duyệt không chặn** bước này (đúng với bản của designer), nhưng được liệt kê trong cảnh báo và **chặn ở bước Sẵn sàng bàn giao** |
| Chờ QC → **Sẵn sàng bàn giao** | QĐ hoặc nhân viên QC chấm checklist đạt (G2-DLV-01/02). Không kéo thả, không nút ở REC-04/REC-03 ngoài đường dẫn tới màn QC | Checklist QC theo loại dịch vụ hoàn tất và đạt (FR-REC-016, BR-REC-07, WF-04); mọi phát sinh đã có quyết định cuối (Đã duyệt và Hoàn thành, Từ chối, hoặc Hết hạn) |
| Chờ QC → **Đang sửa** (trả lại) | QĐ/QC khi không đạt | Chọn hạng mục trả lại (hạng mục sang **Trả lại**), ghi lỗi gắn thợ (FR-REC-016) |
| Sẵn sàng bàn giao → **Hoàn tất** | CV tại màn giao xe (G2-DLV-03/04), không kéo thả | (1) Biên bản giao xe có xác nhận của khách (FR-REC-017; nếu chi nhánh tắt tính năng này bằng cấu hình thì CV xác nhận kèm lý do). (2) **Thanh toán**: đã thanh toán đủ, **hoặc** khoản còn lại được phép ghi công nợ (khách doanh nghiệp theo hợp đồng/kỳ thanh toán trong hạn mức, hoặc QL duyệt có lý do; vượt hạn mức nợ cần duyệt, BR-ACC-13). (3) **Hóa đơn**: đã xuất, hoặc "khách không lấy hóa đơn" theo cấu hình G4-EIN-02 (WF-05 còn `[Cần xác nhận]` với kế toán) |
| Đã duyệt / Đang sửa / Tạm dừng → **Đã hủy** | CV hoặc QL đề xuất, người có thẩm quyền khác duyệt (xem A.2) | Xem A.2. **Không hủy được từ Chờ QC trở đi** (Journey §7: chỉ hủy từ Đã duyệt hoặc Đang sửa; Tạm dừng được coi là nhánh của Đang sửa). Từ Chờ QC: trả lại thợ, hoặc xử lý bằng chứng từ điều chỉnh |

Quyền: ma trận FRD §2 ghi QĐ là **X** với "Báo giá và lệnh" nhưng **S** với "Phân thợ, kiểm tra chất lượng". Vì vậy QĐ được "Gửi QC" và chấm QC, **không** được tạo/sửa lệnh, hủy lệnh, thu tiền, xuất hóa đơn. QL là **D** (duyệt) nên không mặc định tạo lệnh, nhưng được làm thay CV khi vắng (xem câu 11).

### A.2 Quy tắc hủy lệnh sau khi đã xuất kho (FR-REC-021, RULE-010, BR-SYS-03, Journey §7 và §8)

1. **Chặn cứng** (nút Gửi duyệt khóa, lý do hiện dưới nút): thiếu nhóm lý do + giải thích ≥ 5 ký tự; thiếu phiếu hoàn kho cho từng dòng phụ tùng đã xuất (hoặc dòng đó được đánh dấu "đã lắp/đã dùng, không hoàn" có xử lý ở mục 4); **lệnh đã có hóa đơn hiệu lực** (phải điều chỉnh/thay thế/hủy hóa đơn trước qua G4-EIN-04, Kế toán trưởng duyệt, rồi mới hủy lệnh); lệnh đang ở Chờ QC trở đi.
2. **Cờ "Chờ duyệt hủy"** từ lúc gửi: khóa bắt đầu hạng mục mới, khóa chuyển trạng thái, khóa thu tiền thêm; có thể "Rút yêu cầu". Lệnh vẫn giữ trạng thái cũ.
3. **Người duyệt**: QL chi nhánh. **Người đề xuất không được tự duyệt.** Nếu QL là người đề xuất thì người duyệt là cấp trên theo cấu hình G4-APR-03 (mặc định: Quản lý vùng; chi nhánh không thuộc nhóm nào hoặc pilot một chi nhánh: Chủ garage). Quá hạn duyệt thì nhắc và leo thang (FR-SYS-015). Không có số tiền cứng trong giao diện (ba-decisions câu 14).
4. **Phần đã thực hiện / phụ tùng không hoàn kho nguyên trạng được** (dầu đã đổ, phụ tùng đã lắp): REC-06 phải cho QL chọn cho từng dòng/hạng mục: (a) **Miễn phí** (ghi chi phí xưởng, đảo công), (b) **Tính phí khách** (tạo khoản phải thu/phiếu bán và hóa đơn cho phần này, theo giá của báo giá đã duyệt). Lựa chọn (b) là chức năng chưa có trong FRD (xem mục C, gap G2-A). Mặc định đề xuất: (a) nếu lệnh chưa có hạng mục Hoàn thành; bắt buộc quyết định khi đã có.
5. **Xử lý tiền đã thu** (chọn một cho từng phiếu thu; không bao giờ sửa/xóa phiếu thu gốc, RULE-010): (i) **Hoàn tiền** bằng phiếu chi hoàn liên kết phiếu thu gốc, cùng hình thức đã thu hoặc chuyển khoản; (ii) **Giữ làm khoản đặt trước** cho lịch hẹn/lệnh khác của cùng khách (hạn giữ cấu hình, khách đồng ý bằng văn bản/ghi nhận); (iii) **Trừ phí** theo mục 4(b) rồi hoàn phần còn lại; (iv) **Khác** (QL quyết định, ghi rõ). Cách ghi nhận tiền đặt cọc về hóa đơn/thuế theo Nghị định 254/2026/NĐ-CP do kế toán của khách xác nhận (Journey §8 cuối bảng) nên (ii) và (iii) để cấu hình, mặc định tắt cho tới khi kế toán chốt.
6. **Hạn mức duyệt hoàn tiền**: cấu hình G4-APR-03; dưới hạn mức: QL duyệt cùng lúc với duyệt hủy; trên hạn mức: thêm bước duyệt cấp cao hơn (QV/CH). Ví dụ trong Journey ("2 triệu/10 triệu") chỉ minh họa, không dùng trong mock.
7. **Sau khi duyệt**: lệnh Đã hủy; công đã ghi bị **đảo** (không xóa, G3-HRM-07); phiếu hoàn kho do **Thủ kho xác nhận nhận** (kho chỉ tăng khi Thủ kho xác nhận, RULE-009); phiếu chưa được xác nhận hiện trong danh sách "treo" của chốt ngày (Journey §6 chốt ngày, bước 1); hạng mục phát sinh chờ duyệt tự sang Hết hạn "do hủy lệnh"; báo giá giữ nguyên phiên bản làm lịch sử. **Bị từ chối**: bỏ cờ, lệnh tiếp tục, phiếu hoàn kho chưa ghi sổ bị hủy theo, người đề xuất nhận lý do.
8. Mọi bước ghi nhật ký (người, thời điểm, lý do, chứng từ liên quan). Không có nút Xóa lệnh.

### A.3 Điều kiện xuất hóa đơn (Journey §3 bước 12, §6 "Luồng xuất hóa đơn điện tử", WF-05; FR-EIN; FR-REC-028)

Điều kiện là **bảng cấu hình G4-EIN-02 có ngày hiệu lực**, theo chi nhánh/đơn vị phát hành; giao diện hiển thị **danh sách kiểm (đạt/thiếu từng điều kiện)** chứ không chỉ một câu. Mặc định đề xuất:

| # | Điều kiện | Ghi chú |
| --- | --- | --- |
| 1 | Lệnh ở **Sẵn sàng bàn giao** hoặc **Hoàn tất** (đã qua QC), không ở Đã hủy | Khớp Journey §6 bước 1 |
| 2 | Không còn hạng mục phát sinh chờ duyệt; không còn cờ "Chờ duyệt hủy" | Hóa đơn chỉ gồm dòng đã duyệt và đã thực hiện |
| 3 | Thông tin người mua đủ: cá nhân (tên; MST nếu khách yêu cầu); doanh nghiệp (tên pháp nhân, MST, địa chỉ xuất hóa đơn) | Journey §6 bước 1 |
| 4 | Thuế suất có hiệu lực theo **ngày lập**; đơn vị phát hành của chi nhánh đã cấu hình | Effective-dated; mốc 1/1/2027 còn chờ kế toán (Journey §8) |
| 5 | Chưa có hóa đơn hiệu lực cho lệnh/phiên bản này; yêu cầu mang khóa chống trùng (idempotency) lấy từ mã lệnh + lần phát hành | BR-EIN-01; bấm nhiều lần hoặc timeout chỉ ra một hóa đơn, truy vấn lại trước khi phát hành lại |
| 6 | Người xuất: Thu ngân hoặc Kế toán (ma trận: EIN **S** chỉ TN, KT) | CV không có quyền EIN; CH/QV/QL chỉ xem |

**Thanh toán một phần có được xuất không: CÓ.** Hóa đơn là chứng từ của giao dịch dịch vụ/hàng hóa đã hoàn thành, độc lập với việc đã thu bao nhiêu (năm đối tượng tách riêng, Journey §6; một hóa đơn nhiều lần thu). Cấu hình bổ sung "Yêu cầu thu đủ trước khi xuất" theo chi nhánh/loại khách, **mặc định tắt** (khách doanh nghiệp theo kỳ cần xuất khi chưa thu). Thời điểm lập hóa đơn chính thức, tiền đặt cọc và trường hợp khách không lấy hóa đơn là `[Cần xác nhận]` với kế toán của khách; thiết kế không viết cứng.

Hóa đơn đã xuất không sửa/xóa: điều chỉnh, thay thế, hủy cần Kế toán trưởng duyệt (FRD §2 ghi chú, G4-EIN-04). Trạng thái hóa đơn lấy từ nhà cung cấp; "đang gửi/lỗi/chờ truy vấn" là chỉ báo đồng bộ, không phải trạng thái thứ sáu (ba-decisions A.2).

---

## B. Trả lời từng câu

### Câu 1 – Chuyển trạng thái lệnh
- **Quyết định**: "Đã duyệt → Đang sửa" **tự động** khi thợ bắt đầu hạng mục đầu tiên (xác nhận giả định 3 của designer). "Đang sửa → Chờ QC" **do người bấm** (CV, QĐ, QL), hệ thống chỉ nhắc khi đủ điều kiện. Điều kiện chi tiết ở A.1. Bản designer "mọi hạng mục Hoàn thành, phát sinh chưa duyệt không chặn" **đúng một phần**: bổ sung điều kiện phụ tùng đã xuất, không ở Tạm dừng, không có cờ hủy; và phát sinh chưa quyết định phải được giải quyết trước **Sẵn sàng bàn giao** (không chặn QC).
- **Lý do**: lệnh "bắt đầu từ khi khách duyệt" nhưng trạng thái "Đang sửa" phản ánh thực tế thi công, nên nguồn sự thật là thao tác của thợ; tự động tránh lệch với hạng mục (FR-REC-028). Chuyển QC cần người vì QĐ có thể còn thêm việc.
- **Căn cứ**: FR-REC-013, 015, 016, 028; WF-01, 03, 04, 09; RULE-005, 006, 007; Journey §3 bước 5–10 và §7.
- **Tác động**: REC-03 (bỏ kéo thả approved → working), REC-04 (nút chính theo vai trò), TEC; UAT-03.

### Câu 2 – Hủy lệnh sau khi xuất kho
- **Quyết định**: xem A.2 (lựa chọn xử lý tiền: hoàn tiền, giữ làm đặt trước, trừ phí phần đã làm, khác; hạn mức hoàn tiền là cấu hình; **người đề xuất không tự duyệt**, QL đề xuất thì QV/CH duyệt).
- **Lý do**: RULE-010 cấm xóa; Journey §7 chỉ có cặp CV đề xuất / QL duyệt, chưa nói trường hợp QL đề xuất nên cần tách nhiệm vụ.
- **Căn cứ**: FR-REC-021, FR-INV-008, FR-HRM-008, RULE-010, RULE-011, BR-SYS-03, BR-ACC-09/11, FR-SYS-015, G4-APR-03.
- **Gap**: "Tính phí phần đã làm" chưa có FR (G2-A ở mục C). Đây là `[Cần xác nhận]` nghiệp vụ, thiết kế để cấu hình.

### Câu 3 – Điều kiện xuất hóa đơn
- **Quyết định**: A.3. **Cho xuất khi Thanh toán một phần** (mặc định), có cấu hình "thu đủ trước khi xuất".
- **Căn cứ**: Journey §3 bước 11–12, §6, WF-05; FR-REC-028; BR-EIN-01; Nghị định 254/2026/NĐ-CP (kế toán xác nhận).

### Câu 4 – Hợp nhất hồ sơ khách (CRM-08)
- **Đồng ý dữ liệu**: không xóa bản ghi nào; giữ lịch sử đủ của cả hai. **Hiệu lực hiện tại** tính theo từng (mục đích, kênh/định danh liên hệ): nếu **bất kỳ** hồ sơ nào đã rút hoặc chưa đồng ý thì kết quả là **chưa đồng ý** cho tới khi khách đồng ý lại (nguyên tắc thận trọng, FR-CRM-010/013, Luật BVDLCN 2025). Không "nâng" đồng ý của hồ sơ này sang số điện thoại/email của hồ sơ kia. Màn hình phải có bước **xem trước đồng ý sau hợp nhất** (bảng mục đích × kênh).
- **Công nợ**: không cộng gộp thành một con số mới; mỗi khoản phải thu giữ nguyên liên kết lệnh gốc (Journey §6 Luồng công nợ). Hạn mức nợ và kỳ thanh toán của khách doanh nghiệp lấy từ hồ sơ được giữ, người hợp nhất phải chọn và xác nhận. Hóa đơn đã xuất giữ nguyên thông tin người mua tại thời điểm phát hành.
- **Chặn**: không hợp nhất cá nhân với doanh nghiệp; không hợp nhất khi một bên có yêu cầu chủ dữ liệu đang xử lý (CRM-11).
- **Khác chi nhánh**: QL chỉ hợp nhất khi **cả hai hồ sơ nằm trong phạm vi chi nhánh của mình** (RULE-012). Cặp liên chi nhánh do **QV (nhóm được giao) hoặc CH** hợp nhất; QL chi nhánh chỉ có thể "đề nghị hợp nhất" gửi lên. Màn hình hiện hồ sơ ngoài phạm vi chỉ ở mức tối thiểu để so khớp.
- **Căn cứ**: FR-CRM-003, 010, 013, 014; RULE-012; NFR-ISO-01.

### Câu 5 – Nhắc bảo dưỡng
- **Bộ trạng thái "nhắc" không phải đối tượng thứ sáu.** Là thuộc tính của **bản ghi nhắc** (thuộc CRM) với tập: Chưa nhắc, Đã nhắc (lần n), Đã đặt hẹn, Bỏ qua (có lý do), và tự động Đã xử lý (xe đã vào lệnh) / Hết hạn nhắc. Hiển thị bằng `tag` (giữ như giả định 11 của designer).
- **Ngưỡng "sắp đến hạn"**: cấu hình theo loại nhắc, có ngày hiệu lực, theo công ty và ghi đè theo chi nhánh. Mặc định đề xuất: bảo dưỡng ≤ 1.000 km **hoặc** ≤ 30 ngày (điều kiện nào đến trước); đăng kiểm 30 ngày; bảo hiểm 30 ngày. Đổi ngưỡng/chu kỳ chỉ áp cho nhắc tạo sau ngày hiệu lực (khớp thông báo đã có ở CRM-09). Chu kỳ đăng kiểm theo bảng loại xe × năm sản xuất (BRD: Thông tư 30/2026/TT-BXD, chu kỳ đã đổi nhiều lần nên không viết cứng).
- **Nhắc lặp**: tối đa 3 lần cho mỗi kỳ hạn, cách nhau tối thiểu 7 ngày (cấu hình); sau lần 3 chuyển "Cần gọi điện" cho cố vấn, không gửi thêm tin tự động. Chỉ kênh khách đã đồng ý; kênh chưa kích hoạt thì ghi nhận "đã nhắc bằng điện thoại" (không giả vờ đã gửi tin).
- **Căn cứ**: FR-CRM-006, 007, 008, 009, 010; BR-CRM-03; D-13.

### Câu 6 – Công suất lịch hẹn
- **Quyết định**: giai đoạn đầu **chỉ theo số xe mỗi ngày của chi nhánh** (đúng FR-REC-019) và hiển thị theo ngày; khung giờ chỉ là gợi ý, không tính công suất. Tùy chọn cấu hình sau: trọng số theo loại dịch vụ (đồng sơn chiếm nhiều chỗ). Chưa làm công suất theo khoang hoặc cố vấn (chưa có yêu cầu trong FRD/BRD).
- **Vượt công suất**: đến mức "đặt vượt tối đa" (cấu hình, mặc định đề xuất 120% công suất ngày) CV được đặt, bắt buộc cảnh báo + lý do; vượt mức đó cần QL duyệt. **Đặt trực tuyến (APT-04)** không bao giờ vượt: hết chỗ là "Hết chỗ"; có thể cấu hình tỷ lệ chỗ dành cho đặt trực tuyến.
- **Căn cứ**: FR-REC-019, 027, 035; BR-REC-09; Journey §8 bản 0.3.

### Câu 7 – Tiền tố mã chứng từ
- **Quyết định** (theo quy tắc `LOẠI-MÃCN-YYMM-STT`, ba-decisions câu 11): lịch hẹn **`LH`** cho mọi lịch (nhân viên tạo hoặc khách đặt trực tuyến; một dãy số, không tách dãy khi nhân viên xác nhận); yêu cầu của chủ dữ liệu **`CD`**; hồ sơ tiếp nhận **`TX`** (có mã ngay khi tạo nháp, vì "chưa có số lệnh" nhưng cần mã để tra cứu, in phiếu tiếp nhận). Phiếu hoàn kho từ lệnh dùng **`PN`** với loại "Hoàn kho từ lệnh", mỗi lần hoàn một số riêng (không dùng chung một số cho nhiều dòng). Báo giá bổ sung dùng **`BG`** và ghi liên kết báo giá gốc.
- **Lý do**: tránh `DL`/`DS` dễ nhầm với "dữ liệu"; tránh trùng ký hiệu vai trò (TN, QĐ). Designer thay chuỗi trong mock: `DS-` → `CD-`, `DL-` → `LH-`.
- **Căn cứ**: FR-REC-030, FR-SYS-006.

### Câu 8 – Phát sinh khách không duyệt
- **Hạn duyệt**: cấu hình, mặc định đề xuất 3 ngày kể từ lúc gửi hoặc tới lúc bàn giao, điều kiện nào đến trước (mock đang dùng 3 ngày, giữ).
- **Trạng thái cuối** của **báo giá bổ sung**: Từ chối (khách chủ động từ chối hoặc nhân viên ghi nhận từ chối bằng lời) hoặc Hết hạn (quá hạn không phản hồi). Hạng mục phát sinh vẫn là Chưa làm, thuộc tính duyệt đổi sang Từ chối/Hết hạn (bổ sung giá trị "Hết hạn" cho thuộc tính duyệt ở ba-decisions A.3), không vào tổng lệnh, thợ không bắt đầu được.
- **Tự đưa vào "hạng mục từng bị từ chối": CÓ** cho cả hai kết cục, kèm nguồn "phát sinh trong lệnh RO-…" (FR-REC-024, BR-REC-11).
- **Chốt trước bàn giao**: còn Chờ khách duyệt lúc Sẵn sàng bàn giao thì CV phải chọn ghi nhận Từ chối hoặc để Hết hạn (có lý do); không để treo.
- **Căn cứ**: FR-REC-014, 024, 026; BR-REC-04, 11; RULE-005, 006; WF-03; UAT-03, 17.

### Câu 9 – Phụ tùng khách mang đến
- **Quyết định**: **không nhập kho** (không ký gửi ở giai đoạn 1); ghi thành **dòng "Phụ tùng khách cung cấp"** trong lệnh: tên, số lượng, tình trạng, ảnh, khách xác nhận trên phiếu tiếp nhận; không giữ chỗ, không xuất kho, không giá vốn, không doanh thu phụ tùng; chỉ tính công. Phiếu tiếp nhận và lệnh in rõ điều kiện bảo hành.
- **Bảo hành**: mặc định bảo hành **công**, **không bảo hành phụ tùng** do khách cung cấp (nhà cung cấp phụ tùng chịu trách nhiệm); nội dung là mẫu điều khoản cấu hình (FR-SYS-006), khách chốt chính sách. Quản lý ký gửi là P2+ `[Cần xác nhận]`.
- **Căn cứ**: Journey §8 ("Khách tự mang phụ tùng đến"), BR-INV-09, BR-REC-08.
- **Tác động**: REC-01 bước 4 đổi ô văn bản tự do thành bảng dòng có cấu trúc (xem review F2-14).

### Câu 10 – Quyền xem của Thợ
- **Quyết định**: Thợ xem **phần đầu lệnh** (mã lệnh, biển số, xe, tên khách, yêu cầu theo lời khách, hiện trạng, ảnh, ghi chú dành cho thợ) và **chỉ hạng mục của mình** cùng phụ tùng/giờ chuẩn của hạng mục đó. Không thấy: giá, thành tiền, tổng lệnh, báo giá, thanh toán, hóa đơn, công nợ, SĐT, địa chỉ, hạng mục của thợ khác, công/hoa hồng của người khác. Thấy **tên** khách và biển số: **đúng ý**.
- **Căn cứ**: WF-08; FRD §2 ("Xn"); ba-decisions câu 8 (TH: không hiển thị SĐT/địa chỉ); FR-REC-013; NFR-SEC-03.
- **Lưu ý triển khai**: ẩn phải thực hiện ở **máy chủ** (không gửi dữ liệu tiền xuống thiết bị thợ), không chỉ ẩn bằng giao diện.

### Câu 11 – Ma trận quyền
- **CV có xem công nợ khách không**: **CV xem trạng thái và số tiền còn phải thu của chính lệnh/khách đang phục vụ**, cùng cảnh báo vượt hạn mức nợ khi lập lệnh (FR-ACC-020, UAT-26, Journey §8 bản 0.3); **không** xem sổ công nợ tổng hợp/tuổi nợ (ma trận: "Công nợ và giá vốn" CV **-**). Hóa đơn: CV chỉ thấy trạng thái và số hóa đơn (ma trận EIN CV **-**), không có nút thao tác.
- **CH, QV tạo/sửa khách và xe**: **giữ X (chỉ xem)** theo FRD; sửa sai thông tin thì nhờ QL/CV của chi nhánh; CH/QV chỉ **hợp nhất liên chi nhánh** (câu 4) và duyệt xóa dữ liệu (CRM-11, CH).
- **REC-01 chỉ CV, QL**: **đúng**, với giải thích: ma trận ghi CV **S**, QL **D** (duyệt + xem); QL tạo hồ sơ tiếp nhận được vì là quyền hành động "tạo" gán mặc định cho QL để làm thay CV khi vắng (FR-SYS-013), cấu hình được. QĐ, TN, KT, TK, TH không tạo.
- **QĐ trên màn Lệnh**: xem lệnh, **không** thấy tab Thanh toán/Hóa đơn/công nợ (ma trận "Thu tiền", "Hóa đơn điện tử" QĐ **-**).
- **Căn cứ**: FRD §2 và bổ sung 0.2 (FR-SYS-012, 013), RULE-012.

### Câu 12 – Nhãn mức kiểm tra xe số
- **Quyết định**: **chấp nhận** nhãn **Tốt / Theo dõi / Hỏng** kèm biểu tượng và màu xanh/vàng/đỏ; chữ luôn hiển thị, màu chỉ bổ trợ. Trong FRD/Journey "xanh/vàng/đỏ" được hiểu là **mã màu của ba mức**, không đổi hành vi (xanh không sinh dòng báo giá, vàng và đỏ vào danh sách lỗi, FR-INS-003/005). Chữ "Hỏng" áp cho cả "cần xử lý ngay"; nếu khách muốn nhãn khác thì là chuỗi cấu hình mẫu.
- **Căn cứ**: FR-INS-003, 005; Journey §3 "Kiểm tra xe số"; design-system (badge không chỉ dựa vào màu).
- **Cần cập nhật tài liệu**: FRD FR-INS-003 và Journey bảng ba mức (mục C).

### Câu 13 – Km thấp hơn lần trước
- **Quyết định**: lý do bắt buộc (FR-REC-003, đã đúng). **Không chặn bằng duyệt** (khách đang chờ ở quầy). Nếu chênh lệch vượt ngưỡng cấu hình (đề xuất: giảm hơn 1.000 km, hoặc cấu hình theo %) thì hồ sơ gắn **cờ "Số km bất thường"**, QL nhận thông báo "Cần xem" trong ngày, hiện trong báo cáo ngoại lệ; QL có thể ghi nhận đã kiểm tra. Mọi lần cảnh báo ghi nhật ký người, giá trị cũ, giá trị mới, lý do (chống gian lận đồng hồ, BR-REC-01).
- **Căn cứ**: FR-REC-003; BR-REC-01; Journey §8 bản 0.2 ("Số km nhập thấp hơn lần trước").

### Câu 14 – Đồng sơn (REC-07)
- **Danh sách công đoạn**: giữ 9 bước giả định của Journey §3 làm **mẫu cấu hình mặc định**, đánh dấu "chưa khảo sát xưởng" `[Cần xác nhận]`; công đoạn là trạng thái của hạng mục theo loại dịch vụ, lệnh vẫn 7 trạng thái (FR-REC-032/033). Chốt danh sách thật sau buổi khảo sát xưởng đồng sơn (đưa vào chương trình workshop Discovery).
- **Ảnh trước/sau từng công đoạn**: **có, cấu hình theo công đoạn** (cờ "yêu cầu ảnh"). Mặc định bắt buộc ảnh ở tiếp nhận (đã có) và trước bàn giao; các công đoạn giữa là tùy chọn. Ảnh gắn hạng mục, xem được từ hồ sơ xe.
- **Căn cứ**: FR-REC-032, 033; BR-REC-13, 14; UAT-21.

### Câu 15 – Thời hạn lưu và mốc quá hạn xử lý yêu cầu của chủ dữ liệu
- **Mốc quá hạn** (cấu hình theo loại yêu cầu, tính theo ngày làm việc, đếm từ lúc tiếp nhận): **rút lại đồng ý: 2 ngày làm việc**; **xem/sửa/xóa: 15 ngày làm việc** nội bộ (thấp hơn mốc 30 ngày mà một số nguồn nêu cho yêu cầu cần bên xử lý khác phối hợp). Cảnh báo sớm khi còn 1/3 thời gian. **Số ngày pháp định phải để pháp chế/luật sư của khách xác nhận** theo Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025/NĐ-CP (chưa đối chiếu được văn bản gốc trong lượt này; nguồn tham khảo: bảng so sánh của EY/lsvn.vn).
- **Lưu sau khi xử lý xóa**: dữ liệu liên hệ cá nhân không còn mục đích hợp pháp thì **xóa hoặc ẩn danh**; chứng từ kế toán, hóa đơn, lệnh có giá trị tài chính **giữ theo thời hạn pháp luật kế toán/thuế** (số năm do kế toán của khách xác nhận, `[Cần xác nhận]`), chỉ che trường nhận dạng không cần thiết. Nhật ký xử lý yêu cầu (ai, khi nào, phạm vi đã xóa) lưu tối thiểu bằng thời hạn giữ chứng từ. Phạm vi "bắt buộc giữ" là bảng cấu hình theo loại dữ liệu (đã có ở CRM-11).
- **Căn cứ**: FR-CRM-010, 011; BR-CRM-05; UAT-10; BRD mục pháp lý.

### Câu 16 – Tạm dừng và đồng hồ giờ thực
- **Quyết định**: **mọi lý do tạm dừng đều dừng đồng hồ giờ thực** của hạng mục (giờ thực = thời gian ở trạng thái Đang làm, FR-REC-013, BR-HRM-03). Mỗi lý do có hai cờ cấu hình: "Tính vào giờ thực" (mặc định **không** cho cả bốn lý do) và "Tính vào thời gian chờ của lệnh" (mặc định **có**). Hiệu suất thợ = giờ chuẩn / giờ thực, **không bị trừ oan** do chờ phụ tùng hay chờ khách duyệt (không do thợ); lead time của lệnh vẫn tính toàn bộ.
- **Nghỉ**: dừng đồng hồ, không tính. **Khác**: dừng đồng hồ nhưng **bắt buộc ghi chú** và, nếu kéo dài quá ngưỡng cấu hình (đề xuất 30 phút), thông báo QĐ xem lại để tránh lạm dụng "Khác".
- **Căn cứ**: ba-decisions câu 13; FR-REC-013; BR-HRM-03; Journey §5. Công thức tính công là `[Cần xác nhận]` với khách, nên các cờ trên nằm trong cấu hình G3-HRM-06, không viết cứng.

---

## C. Việc cần cập nhật ở tài liệu khác (chưa thực hiện trong lượt này)

| Tài liệu | Nội dung | Gắn với |
| --- | --- | --- |
| FRD §3 REC | **Gap G2-A**: thêm FR "Hủy lệnh có tính phí phần đã thực hiện / phụ tùng không hoàn kho" (id mới ở cuối mục REC, hiện FR-REC-037); thêm FR "tạm dừng lệnh kèm lý do cấu hình" (FR-REC-038, bổ sung cho FR-REC-015); thêm FR "điều kiện chuyển trạng thái cấu hình" (hoặc mở rộng acceptance của FR-REC-015); thêm FR cờ "số km bất thường" (mở rộng FR-REC-003); thêm FR "phụ tùng khách cung cấp" dạng dòng lệnh (FR-REC-039, BR-INV-09) | BR-REC-05, BR-INV-09; UAT mới: hủy lệnh sau xuất kho, hợp nhất đồng ý |
| FRD FR-REC-030 | Mở rộng định dạng mã chứng từ, thêm tiền tố LH, CD, TX | ba-decisions câu 11 |
| FRD FR-INS-003 | Ghi nhãn Tốt / Theo dõi / Hỏng kèm màu | Journey §3 bảng ba mức |
| FRD FR-CRM-003 | Quy tắc gộp đồng ý, công nợ; hợp nhất liên chi nhánh do QV/CH | RULE-012; UAT mới |
| FRD §2 ghi chú | QĐ không có quyền Thu tiền/Hóa đơn; CV xem trạng thái thu của lệnh mình xử lý | Câu 11 |
| Journey §7 | Tập trạng thái bản ghi nhắc; lý do tạm dừng; thuộc tính duyệt có thêm "Hết hạn"; cờ "Chờ duyệt hủy" | ba-decisions mục D |
| Journey §8 | Dòng "Hủy lệnh sau khi xuất" thêm: không tự duyệt, chặn khi đã có hóa đơn, tính phí | A.2 |
| BRD | Đưa vào danh sách `[Cần xác nhận]`: tính phí khi hủy, thu đủ trước khi xuất hóa đơn, ngưỡng nhắc, công suất vượt, mốc xử lý yêu cầu chủ dữ liệu, thời hạn giữ chứng từ | Workshop Discovery |
| UAT | Thêm kịch bản: chuyển Chờ QC bị chặn khi phụ tùng chưa xuất; hủy lệnh sau xuất kho (có/không hóa đơn); hợp nhất khách khác đồng ý | FRD §UAT |

## D. Câu hỏi cần chuyển cho khách (đã có đề xuất mặc định ở trên, chờ xác nhận)

1. Hủy lệnh khi đã làm một phần: miễn phí hay tính phí phần đã làm? (đề xuất: QL chọn từng trường hợp, có cấu hình mặc định). Tác động: REC-06, ACC, EIN.
2. Có yêu cầu thu đủ trước khi xuất hóa đơn không, theo loại khách? (đề xuất: không bắt buộc). Tác động: REC-04, EIN-02.
3. Thời hạn giữ chứng từ và dữ liệu cá nhân sau xử lý yêu cầu xóa; hạn pháp định xử lý yêu cầu. (đề xuất: ngày làm việc như câu 15; chờ pháp chế/kế toán).
4. Hạn mức duyệt hoàn tiền và hủy lệnh; người duyệt cấp trên khi QL đề xuất. (đề xuất: QV rồi CH, số tiền để cấu hình).
5. Công suất vượt tối đa và tỷ lệ chỗ cho đặt trực tuyến. (đề xuất: 120% và để cấu hình).
6. Danh sách công đoạn đồng sơn thực tế và công đoạn nào cần ảnh. (khảo sát xưởng).
