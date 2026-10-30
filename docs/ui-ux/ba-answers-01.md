# BA – Trả lời 15 câu hỏi của gói G1 (Xác thực và Dashboard theo vai trò)

Phiên bản 0.1 · 30/10/2026 · Người lập: BA · Trạng thái: **BA đề xuất — chờ xác nhận** (theo ủy quyền của chủ dự án; designer dùng ngay để đi tiếp).

Nguồn: `docs/ui-ux/01-auth-dashboard.md` §8, `docs/ui-ux/ba-decisions.md`, `docs/ui-ux/screen-inventory.md` (§5 D-01..D-14, §6 G-01..G-10), `docs/functional-requirements.md` (§2 ma trận quyền, SYS, RPT, ACC-004, NFR-SEC/PRI/OFF), `docs/business-requirements.md` (§3, RULE-005..015), `docs/design-system.md` §8, §9.

Nguyên tắc: nghiệp vụ trong BRD/FRD thắng hình thức giao diện. Mọi con số (số lần sai, phút, ngày) là **tham số cấu hình** ở G4-SYS-24 / G4-SYS-23, không là ý nghĩa nghiệp vụ cố định. Mục `[Cần xác nhận]` của BRD/FRD vẫn giữ nguyên, chỉ thiết kế theo hướng cấu hình. Các quyết định dưới đây **không sửa** BRD/FRD/Journey; danh sách việc cần cập nhật tài liệu ở §C.

## A. Bảng tóm tắt

| Câu | Chủ đề | Quyết định chính |
| --- | --- | --- |
| 1 | Khóa tạm, mở khóa | Giữ thông báo trung lập cho mọi trường hợp. Bộ đếm kép: theo (thiết bị + tên nhập) khóa 15 phút; theo tên nhập trên mọi thiết bị chỉ làm chậm và báo AD, không khóa cứng. Mở khóa sớm: QL/CH/AD, hoặc đặt lại mật khẩu |
| 2 | MFA | Bắt buộc CH, QV, QL, KT, AD; QĐ không bắt buộc. Bỏ mã dự phòng qua email với nhóm bắt buộc. KT, AD không có “tin cậy thiết bị”; CH, QV, QL được 14 ngày |
| 3 | PIN xưởng | 5 lần sai khóa tên đến khi QĐ/QL mở; PIN tạm do QĐ/QL cấp; thiết bị đăng ký bằng mã ghép, thu hồi được |
| 4 | Thợ mất mạng | Phase 1: chặn ghi giờ, dùng phiếu giấy và QĐ nhập bù; Phase 2+: hàng đợi 3 thao tác có dấu giờ máy chủ |
| 5 | Số tạm/chính thức | Theo ngày chốt (FR-ACC-004); KPI tại thời điểm dùng nhãn “Tại hh:mm” |
| 6 | Lợi nhuận gộp, giá trị tồn | Công thức FR-RPT-013; xem được: CH, QV, QL (chi nhánh mình); KT chỉ ở báo cáo; có “Cách tính” |
| 7 | Định nghĩa | Một định nghĩa duy nhất “xe trễ hẹn”; “xe của tôi” theo cố vấn phụ trách; ca thu ngân có tiền đầu ca |
| 8 | Kỳ so sánh, bộ lọc | Cùng khoảng ngày kỳ trước; hôm nay so cùng thứ tuần trước; tùy chọn tối đa 366 ngày |
| 9 | DSH-10 (AD) | 8 chỉ số chính thức; thử khôi phục hằng tháng; thấy tên, vai trò, chi nhánh, email che |
| 10 | Thông báo | Ma trận sự kiện × vai trò §B10; 07:30; lưu 30 ngày ở chuông, 12 tháng ở trang |
| 11 | Số khi liên kết khách lỗi | Luôn hiện số tổng đài công ty (cấu hình); hiện thêm số chi nhánh nếu nhận ra |
| 12 | Tìm kiếm toàn cục | Ma trận kết quả theo vai trò §B12; tìm SĐT chỉ khớp đúng số đầy đủ với vai trò bị che |
| 13 | Hồ sơ cá nhân | Tự sửa SĐT và ảnh; đổi email bằng quy trình xác minh riêng |
| 14 | Nhiều vai trò | Thứ tự CH > QV > QL > KT > QĐ > CV > TK > TN > TH > AD, nhớ góc nhìn gần nhất theo chi nhánh |
| 15 | Quy định bảo mật | Văn bản có phiên bản, ghi nhận phiên bản và thời điểm đồng ý; nội dung do luật sư của khách ban hành |

## B. Trả lời chi tiết

### Câu 1 – Khóa tài khoản, tài khoản vô hiệu, mở khóa

**Quyết định**
1. **Chấp nhận** hệ quả: người bị vô hiệu thấy cùng thông báo “Không đăng nhập được” như sai mật khẩu. Bù đắp bằng ba việc ngoài màn hình đăng nhập:
   - Gửi email tới địa chỉ đã đăng ký khi tài khoản bị vô hiệu hoặc bị khóa tạm (chỉ gửi nếu tài khoản có thật, nên không lộ gì ra ngoài).
   - G4-SYS-03 hiện cho QL/AD **lý do không đăng nhập được** (vô hiệu, khóa tạm, mật khẩu tạm hết hạn, chưa kích hoạt, chi nhánh khóa).
   - Dòng hướng dẫn “liên hệ quản lý chi nhánh” có sẵn ở AUT-01.
2. **Ba bộ đếm**, mọi bộ đếm áp cả cho tên không tồn tại để hành vi giống nhau:

| Bộ đếm | Ngưỡng mặc định | Hậu quả | Người dùng thấy |
| --- | --- | --- | --- |
| A. (thiết bị + tên nhập chuẩn hóa) | 5 lần sai liên tiếp | Khóa 15 phút; lần khóa thứ hai trong 60 phút thì 60 phút | “Tạm dừng đăng nhập trên thiết bị này”, đếm lùi |
| B. Tên nhập chuẩn hóa, mọi thiết bị | 10 lần sai trong 15 phút | **Không khóa cứng** (tránh bị kẻ khác cố ý khóa nhân viên). Làm chậm lũy tiến mỗi lần thử; tài khoản có thật thì đánh dấu “đăng nhập bất thường” cho AD (DSH-10) và email cho chủ tài khoản | Cùng thông báo trung lập |
| C. Địa chỉ mạng | Ngưỡng chung, cao hơn A (nhiều chi nhánh có thể dùng chung một địa chỉ) | Làm chậm | Cùng thông báo |

3. **Mở khóa sớm**: (a) hết thời gian; (b) hoàn tất “Quên mật khẩu” (xóa bộ đếm A và B của tài khoản đó); (c) QL mở khóa nhân viên **vận hành** trong chi nhánh mình (CV, QĐ, TH, TK, TN); KT, QL, QV, AD do CH hoặc AD mở; (d) mọi lần mở khóa phải nhập lại mật khẩu của người mở, ghi nhật ký (FR-SYS-003) và gửi email cho chủ tài khoản. Không có câu hỏi bí mật hay mở khóa tự phục vụ ngoài (b).

**Lý do**: khóa chỉ theo (thiết bị + tên) không chặn được dò mật khẩu phân tán nhiều thiết bị; khóa cứng theo tài khoản lại cho phép làm tê liệt một nhân viên. Làm chậm + báo AD cân bằng hai rủi ro.
**Căn cứ**: FR-SYS-001, FR-SYS-014, NFR-SEC-01, NFR-SEC-02, D-03, D-13 mục 7.
**Tác động**: AUT-01 (không đổi thông báo), DSH-10 (định nghĩa lại KPI “đăng nhập bất thường”), G4-SYS-03, G4-SYS-24. Phát hiện liên quan: F1-05, F1-26.

### Câu 2 – MFA cho KT/QĐ, mã dự phòng email, tin cậy thiết bị

**Quyết định**
- **Bắt buộc**: CH, QV, QL, KT, AD. Đây là cách hiểu “quản lý trở lên” của FR-SYS-001, đã nêu ở D-02 và G-02; vẫn là `[Cần xác nhận]` với khách ở chỗ KT.
- **QĐ không bắt buộc** theo mặc định (không có quyền tiền, duyệt hạn mức; làm việc chủ yếu bằng PIN thiết bị xưởng). “Bắt buộc MFA” là thuộc tính cấu hình của vai trò (G4-SYS-24). Người có nhiều vai trò (FR-SYS-012) chịu yêu cầu **mạnh nhất** trong các vai trò được gán.
- **Mã dự phòng qua email**: làm yếu MFA vì cùng một hộp thư vừa nhận liên kết đặt lại mật khẩu vừa nhận mã, nên hai lớp thành một. Do đó **bỏ** lựa chọn “Gửi mã qua email” khỏi AUT-02 với CH, QV, QL, KT, AD; thay bằng mã khôi phục (10 mã, dùng một lần, hiện một lần) hoặc đặt lại MFA do người có thẩm quyền thực hiện (QL cho nhân viên chi nhánh, CH hoặc AD cho các vai trò còn lại; AD cần CH xác nhận) kèm xác minh danh tính, ghi nhật ký, email thông báo, buộc thiết lập lại ở lần đăng nhập kế. Lựa chọn email vẫn dành cho vai trò **tự bật** MFA (CV, QĐ, TK, TN).
- **Tin cậy thiết bị**: CH, QV, QL được tối đa 14 ngày trên thiết bị cá nhân; **KT và AD không có** tùy chọn này (MFA mỗi lần đăng nhập đầy đủ; vì phiên tối đa 12 giờ nên khoảng một lần mỗi ca). Số ngày là tham số theo vai trò (0 là tắt). Thao tác nguy hiểm (D-02) luôn hỏi lại mật khẩu dù thiết bị đã tin cậy. Danh sách thiết bị tin cậy hiện ở PRF-02 để thu hồi.
- Dùng một mã khôi phục thì gửi email cho chủ tài khoản và nhắc tạo lại khi còn 3 mã.
- “Ghi nhớ thiết bị này” ở AUT-01 **bỏ**, vì trùng khái niệm với “tin cậy thiết bị” ở AUT-02 và dễ bị hiểu là giữ phiên đăng nhập (xem F1-06).

**Phương án khác đã cân nhắc**: giữ email dự phòng cho QL (tiện hơn, rủi ro cao hơn). Đề xuất không chọn vì QL có quyền duyệt và quản lý người dùng; nếu khách muốn, chỉ cần mở lại lựa chọn cho QL kèm thông báo tức thời tới CH.
**Căn cứ**: FR-SYS-001, FR-SYS-012, NFR-SEC-01, D-02, D-05, G-02.
**Tác động**: AUT-02 (ẩn nút email theo vai trò, ẩn ô “tin cậy” với KT/AD), AUT-01, PRF-02, G4-SYS-03/24.

### Câu 3 – PIN thiết bị xưởng

**Quyết định**
- PIN 6 số, chặn PIN dễ đoán (dãy lặp, dãy liên tiếp như 000000, 123456), không trùng 3 PIN gần nhất. Chỉ hiệu lực trên thiết bị xưởng đã đăng ký, chỉ cho TH và QĐ (D-04).
- **Khóa**: 5 lần sai liên tiếp trên một tên thợ (tính trên mọi thiết bị xưởng) thì khóa tên đó **cho đến khi QĐ hoặc QL mở khóa** (không tự mở, vì PIN chỉ có một triệu tổ hợp); thiết bị giới hạn thêm số lần sai tổng cộng để chặn dò nhiều tên. Báo QĐ bằng thông báo “Cần xử lý”. Trong lúc chờ, thợ vẫn đăng nhập đầy đủ được nếu có mật khẩu.
- **Ai mở khóa và đặt lại**: QĐ hoặc QL của chi nhánh, tại G4-SYS-03 (đăng nhập đầy đủ). Hệ thống cấp **PIN tạm** hiện một lần; thợ bị buộc đặt PIN mới ở lần chọn tên kế tiếp (cần trạng thái mới ở AUT-10).
- **Đặt, đổi PIN**: thợ đổi ở PRF-02 (sau đăng nhập đầy đủ và nhập lại mật khẩu), hoặc nhận PIN tạm như trên. Thợ không có email vẫn có mã tạm (D-03).
- **Tablet mất hoặc nghỉ dùng**: đăng ký thiết bị bằng **mã ghép** 8 ký tự do QL hoặc AD tạo, hiệu lực 10 phút, nhập trên tablet. Thu hồi trong G4-SYS-03: vô hiệu tức thì mọi phiên PIN của thiết bị, xóa nháp lưu trên máy ở lần kết nối kế, ghi nhật ký. Thiết bị bị thu hồi quay về trạng thái “chưa đăng ký” của AUT-10. Hạn đăng ký lại định kỳ là tham số (đề xuất 90 ngày).

**Căn cứ**: FR-SYS-001 (không dùng chung tài khoản), BR-HRM-03 (giờ công gắn đúng người), NFR-USA-01, D-04.
**Tác động**: AUT-10 (thêm trạng thái “Đặt PIN mới”), PRF-02, G4-SYS-03/24. Phát hiện: F1-09.

### Câu 4 – Thợ mất mạng: xếp hàng hay chặn

**Quyết định**: **Phase 1 chặn** ghi Bắt đầu, Tạm dừng, Hoàn thành khi mất mạng, nói rõ lý do và việc cần làm; **Phase 2 trở đi** cho phép hàng đợi.

| Phương án | Ưu | Nhược | Chọn |
| --- | --- | --- | --- |
| Chặn + phiếu giấy dự phòng A5 (ERR-04) + QĐ nhập bù có nhãn “Nhập bù”, ghi lý do | Giờ công chính xác theo giờ máy chủ; đúng phạm vi NFR-OFF-01 (chỉ cảnh báo và lưu nháp; offline đầy đủ là phạm vi riêng) | Thợ phải ghi giấy lúc mất mạng | Phase 1 |
| Hàng đợi 3 thao tác có dấu giờ thiết bị; đồng bộ sau; chênh lệch lớn hơn ngưỡng (đề xuất 15 phút) chờ QĐ xác nhận; nhãn “Chờ đồng bộ” | Thợ không bị gián đoạn | Giờ công và hoa hồng phụ thuộc đồng hồ thiết bị; cần thiết kế xung đột đồng bộ | Phase 2+ |

“Chờ đồng bộ” là chỉ báo xử lý, **không** là trạng thái thứ sáu của hạng mục. Giờ công luôn lấy theo giờ máy chủ ngay khi có mạng. Với Phase 1, màn DSH-07 cần: đồng hồ ghi rõ “đồng hồ của hệ thống vẫn chạy” và nút “Báo quản đốc ghi hộ” (F1-08).
**Căn cứ**: FR-REC-013, BR-HRM-03, NFR-OFF-01, ba-decisions câu 13.
**Tác động**: DSH-07, ERR-04, G2-TEC-*, UAT thợ mất mạng.

### Câu 5 – Số tạm và số chính thức (FR-RPT-010)

**Quyết định**
- **Số liệu theo kỳ** (doanh thu, lợi nhuận gộp, lượt xe, thu/chi): “Số chính thức” **chỉ khi mọi ngày × mọi chi nhánh trong phạm vi và kỳ đang xem đã chốt** (FR-ACC-004). Ngược lại là “Số tạm”. Doanh thu tháng này có ngày hôm nay nên luôn là số tạm.
- **Số tại một thời điểm** (xe đang sửa, công nợ, giá trị tồn, hàng chờ duyệt): không dùng tạm/chính thức, hiển thị **“Tại hh:mm”**.
- Nhãn chuẩn (luôn có chữ): thanh phạm vi của shell có badge “Số tạm” hoặc “Số chính thức”; dòng phạm vi của từng KPI kết thúc bằng “số tạm” hoặc “số chính thức”. Tooltip của badge nêu cụ thể: “Đã chốt đến 28/10/2026; 2 trên 5 chi nhánh chưa chốt 29/10: Quận 7, Thủ Đức”.
- **Cấm** nhãn gộp kiểu “đã chốt đến 29/10” khi còn chi nhánh chưa chốt; nhãn lấy theo trường hợp **xấu nhất**.
- Nhớ rằng không chốt được ngày khi còn chênh lệch quỹ chưa giải trình (FR-ACC-004): chênh lệch Thủ Đức 29/10 chưa giải trình nghĩa là Thủ Đức chưa chốt 29/10.

**Căn cứ**: FR-RPT-010 (Should, còn `[Cần xác nhận]` → đề xuất nâng thành Must vì RULE-015 là Must), RULE-015, FR-ACC-004, UAT-07. Phát hiện: F1-02.

### Câu 6 – Lợi nhuận gộp, giá trị tồn: công thức, quyền xem, tooltip

**Công thức hiển thị** (cấu hình tại báo cáo, effective-dated, NFR-MNT-01):
- Doanh thu: tổng giá trị **chưa VAT, sau chiết khấu, đã trừ hoàn tiền** của lệnh hoàn tất và phiếu bán lẻ trong kỳ (khớp FR-RPT-003: doanh thu ngày khớp phiếu thu cộng công nợ phát sinh). Mốc ghi nhận theo ngày hoàn tất/giao xe: `[Cần xác nhận]` với kế toán của khách.
- Lợi nhuận gộp quản trị = doanh thu − giá vốn phụ tùng xuất cho lệnh (theo phương pháp giá vốn đang cấu hình, nghiêng bình quân gia quyền, `[Cần xác nhận]`) − chi phí nhân công trực tiếp (theo công thức công thợ cấu hình, `[Cần xác nhận]`). **Không** đồng nghĩa lợi nhuận sau thuế (FR-RPT-013).
- **Phase 1 chưa có HRM** (Phase 2), nên chi phí nhân công trực tiếp chưa tính được: KPI phải ghi **“Lợi nhuận gộp (chưa gồm nhân công)”** và tự đổi khi thành phần nhân công được bật.
- Giá trị tồn = Σ(tồn thực tế × giá vốn theo phương pháp cấu hình) trong phạm vi kho; hàng đang đi đường **không** cộng, hàng giữ chỗ vẫn nằm trong tồn thực tế (RULE-008, ba-decisions câu 4).

**Quyền xem** (cấu hình ở G4-SYS-04):

| Vai trò | Lợi nhuận gộp | Giá trị tồn | Ghi chú |
| --- | --- | --- | --- |
| CH, QV | Có (toàn chuỗi, nhóm được giao) | Có | Khớp FR-RPT-001 |
| QL | **Có, chỉ chi nhánh mình** (FRD §2: QL xem báo cáo và dashboard) | Có | Khác bản designer (không cho QL) |
| KT | Có ở báo cáo lợi nhuận; **không** đặt KPI trên DSH-06 | Có ở báo cáo | KT có quyền giá vốn (S) nhưng dashboard KT tập trung tiền, nợ, hóa đơn |
| CV, QĐ, TH, TN | Không (Xn) | Không | |
| TK | Không | Không xem giá trị, chỉ số lượng | Khớp DSH-05 hiện không có số tiền |
| AD | Không | Không | FRD §2 |

**Tooltip công thức**: mỗi KPI này có nút “Cách tính” (biểu tượng thông tin có nhãn, mở được bằng bàn phím) hiện công thức, phạm vi, phương pháp giá vốn đang dùng và thành phần chưa gồm. Chi tiết đầy đủ đi sâu tới chứng từ (FR-RPT-011).
**Căn cứ**: FR-RPT-001, 003, 011, 013, 016; FRD §2; FR-SYS-013; NFR-MNT-01. Phát hiện: F1-03, F1-04.

### Câu 7 – Các định nghĩa

| Thuật ngữ | Định nghĩa đề xuất |
| --- | --- |
| **Xe trễ hẹn** | Lệnh chưa Hoàn tất và chưa Đã hủy, có **hẹn giao hiện hành** trên lệnh sớm hơn thời điểm hiện tại. Gồm mọi trạng thái từ Đã duyệt đến Sẵn sàng bàn giao (xe chưa trao cho khách). Hẹn giao thay đổi có lịch sử; dashboard dùng hẹn hiện hành, còn tỷ lệ đúng hạn (FR-RPT-012) tính theo hẹn gốc |
| **Công việc quá hạn** (DSH-03) | **Bỏ tên này**; dùng “Xe trễ hẹn giao” cho DSH-01, 02, 03, 09 với cùng định nghĩa và cùng con số. Hạng mục vượt giờ chuẩn là chỉ số khác (hiệu suất thợ, FR-RPT-006), không đưa lên dashboard Phase 1 |
| **Lệnh chậm tiến độ** (câu 3 của chủ garage) | Chính là xe trễ hẹn; cảnh báo sớm “sắp trễ” (còn dưới 60 phút mà chưa Sẵn sàng bàn giao) là Could |
| **Xe của tôi** (CV) | Lệnh mở (Đã duyệt, Đang sửa chữa, Tạm dừng, Chờ QC, Sẵn sàng bàn giao) có trường **Cố vấn phụ trách** là tôi. Mặc định là người tiếp nhận; QL gán lại được; thay đổi ghi nhật ký. FRD hiện **chưa có trường này** (đề xuất FR-REC-037). Đổi nhãn KPI thành “Xe của tôi trong xưởng”, mỗi dòng có badge trạng thái |
| **Ca của thu ngân** | Một thu ngân có tối đa một ca mở tại một thời điểm, một quầy thu tiền một ca mở. **Mở ca bắt buộc nhập tiền đầu ca** (có thể bằng 0). Chốt ca nhập tiền đếm thực tế; chênh lệch phải giải trình mới chốt ngày được (FR-ACC-004). Tên “sáng/chiều” chỉ là nhãn |

**Căn cứ**: FR-REC-022, FR-RPT-008, 012, FR-ACC-003, 004, RULE-014. Phát hiện: F1-10, F1-15. Đề xuất FR mới ở §D.

### Câu 8 – Kỳ so sánh và bộ lọc mặc định

**Quyết định**
- **Tháng này** so với **cùng khoảng ngày của tháng trước** (01–30/10 so với 01–30/09); tháng trước chưa đủ ngày thì so tới ngày cuối.
- **7 ngày** so với 7 ngày liền trước.
- **Hôm nay** so với **cùng thứ của tuần trước, cùng khung giờ** (garage có chu kỳ theo thứ trong tuần, như dữ liệu mẫu). Chưa đủ dữ liệu thì ghi “Chưa so sánh được”. Không so với “hôm qua cả ngày” (khác độ dài).
- **Tùy chọn**: tối đa **366 ngày**; không chọn ngày tương lai; trên 92 ngày thì biểu đồ gộp theo tuần. Kỳ so sánh là khoảng liền trước cùng độ dài.
- Mặc định theo vai trò: CH tháng; QV tháng; QL hôm nay; CV hôm nay; TK hôm nay; KT tháng; TN hôm nay; QĐ hôm nay; AD 7 ngày; TH hôm nay (không chọn). Lựa chọn được nhớ trong phiên; “Đặt lại mặc định” trả về bảng này.
- KPI tại một thời điểm không đổi theo kỳ và nói rõ “Tại hh:mm”.

**Căn cứ**: FR-RPT-014, NFR-PERF-02 (toàn chuỗi dưới 5 giây, nên giới hạn khoảng ngày). Phát hiện: F1-28.

### Câu 9 – DSH-10 (Quản trị hệ thống)

**Chỉ số vận hành chính thức (8)**: (1) sao lưu gần nhất, kết quả và dung lượng; (2) thử khôi phục gần nhất, kết quả; (3) trạng thái từng tích hợp (hóa đơn, email, Zalo/SMS, API) và lỗi 24 giờ; (4) hàng đợi tích hợp bị lỗi (số bản ghi, không nội dung); (5) lượt đăng nhập thất bại và số **lượt khóa tạm** trong kỳ; (6) lời mời chờ kích hoạt, lời mời sắp hết hạn; (7) lô nhập Excel gần đây và dòng lỗi; (8) thiết bị xưởng đã đăng ký và lần kết nối cuối.

- **Chu kỳ thử khôi phục** mặc định hằng tháng (FR-SYS-010 giao cho quản trị định lịch); vàng khi quá 35 ngày, đỏ khi quá 45 ngày; cảnh báo sao lưu khi bản gần nhất quá 26 giờ hoặc thất bại. Tham số cấu hình.
- “Lời mời chờ”: AD **thấy** họ tên, vai trò, chi nhánh, hạn; **email che** (`ha•••@`). Đó là dữ liệu nhân viên chứ không phải dữ liệu khách, và AD cần để gửi lại lời mời.
- Không có doanh thu, khách, hóa đơn (FRD §2). DSH-10 là dashboard **sức khỏe hệ thống**, đề nghị ghi chú ở FRD §2 rằng nó không thuộc “báo cáo và dashboard” kinh doanh (ô AD hiện là “-”).

**Căn cứ**: FR-SYS-010, 014, 017, NFR-OPS-01, FRD §2 ghi chú. Phát hiện: F1-26.

### Câu 10 – Thông báo: sự kiện × vai trò, kênh, giờ tóm tắt, thời hạn lưu

Ký hiệu: **C** Cần xử lý (trong hệ thống luôn bật, không tắt được); **T** Thông tin (mặc định bật, tắt được); **d** chỉ trong tóm tắt hằng ngày; **-** không nhận. Chỉ nhận thông báo thuộc quyền và chi nhánh của mình (FR-SYS-008, NFR-ISO-01).

| Sự kiện | CH | QV | QL | CV | QĐ | TH | TK | TN | KT | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Có yêu cầu chờ tôi phê duyệt (FR-SYS-004) | C | C | C | - | - | - | - | - | C | - |
| Phê duyệt quá hạn, chuyển cấp (FR-SYS-015) | C | C | C | T | - | - | T | T | C | - |
| Báo giá được duyệt, duyệt một phần, từ chối | - | - | T | C | T | - | - | - | - | - |
| Phát sinh chờ khách duyệt | - | - | T | C | T | T | - | - | - | - |
| Khách đã duyệt phát sinh (mở khóa nút Bắt đầu) | - | - | - | T | T | C | - | - | - | - |
| Thiếu phụ tùng, yêu cầu cấp phụ tùng mới | - | - | T | T | T | T | C | - | - | - |
| QC trả lại hạng mục | - | - | T | T | C | C | - | - | - | - |
| Xe sẵn sàng bàn giao | - | - | - | C | - | - | - | T | - | - |
| Hóa đơn lỗi hoặc chờ truy vấn | - | - | T | - | - | - | - | C | C | T |
| Lệch quỹ cần giải trình | T | T | C | - | - | - | - | C | C | - |
| Nhắc chốt ca, chốt ngày | T | - | C | - | - | - | - | C | T | - |
| Xe trễ hẹn | d | d | C | T | C | - | - | - | - | - |
| Tồn khả dụng dưới định mức | d | d | T | - | - | - | T | - | - | - |
| Khách tự đặt lịch chờ xác nhận | - | - | T | C | - | - | - | - | - | - |
| Sao lưu hỏng, thử khôi phục quá hạn, tích hợp lỗi | T | - | - | - | - | - | - | - | - | C |
| Nhân viên bị khóa tạm, lời mời sắp hết hạn | - | - | T | - | - | - | - | - | - | T |
| Bảo mật của chính tôi (khóa tạm, thiết bị mới, đổi mật khẩu hoặc MFA) | C | C | C | C | C | C | C | C | C | C |

- **Kênh mặc định**: trong hệ thống (Phase 1) bật cho mọi sự kiện được nhận. Email (Phase 2): bật mặc định cho mục **C** của CH, QV, QL, CV, TK, TN, KT, AD; tắt cho TH và QĐ (làm việc trên tablet xưởng). Email **bảo mật** luôn bật và không tắt được. Zalo/SMS: “Chưa kích hoạt” (D-13 mục 2).
- **Nội dung email/Zalo** không chứa SĐT, địa chỉ hay tên khách; chỉ mã chứng từ và đường dẫn (NFR-SEC-03).
- **Tóm tắt hằng ngày** cho CH, QV, QL; mặc định **07:30**, chọn được trong khoảng 06:00 đến 10:00 (NTF-02 hiện 07:00/07:30/08:00 là hợp lệ); số liệu hôm qua ghi rõ “số chính thức” hay “số tạm”.
- **Thời hạn lưu** (cấu hình G4-SYS-23, chờ khách chốt chính sách lưu trữ): thông báo đã xử lý ẩn khỏi chuông sau **30 ngày**, lưu ở trang **12 tháng**; mục “Cần xử lý” chưa xử lý **không hết hạn**. Việc xóa thông báo không ảnh hưởng nhật ký phê duyệt (FR-SYS-003).
- **Khoảng trống**: chưa có FR riêng cho trung tâm thông báo (G-04); đề xuất FR-SYS-021.

**Căn cứ**: FR-SYS-008, 015, BR-SYS-03, 07, D-07, ba-decisions câu 15.

### Câu 11 – Số điện thoại ở ERR-05 khi liên kết khách không hợp lệ

**Quyết định**: liên kết không hợp lệ hoặc giả thì hệ thống **không biết chi nhánh**, nên **luôn hiện số tổng đài của công ty** và giờ làm việc lấy từ cấu hình. Nếu token từng tồn tại (đã hết hạn hoặc đã dùng) thì hiện thêm nút “Gọi chi nhánh” với số công khai của chi nhánh đó; số điện thoại của garage là thông tin công khai nên rò rỉ không đáng kể, và thông điệp chính vẫn trung lập.
- Nguồn dữ liệu: bổ sung vào cấu hình công ty/chi nhánh của FR-SYS-005 (địa chỉ, giờ làm việc đã có) hai trường **Số tổng đài hỗ trợ khách** và **Giờ làm việc hiển thị cho khách**.
- **Cần khách cung cấp số tổng đài** (`[Cần xác nhận]`). Trong lúc chưa có: ẩn nút “Gọi” và hiện “Hãy liên hệ garage nơi bạn gửi xe”. Prototype phải ghi rõ “số mẫu”, không dùng số trông như thật (F1-29).

**Căn cứ**: FR-SYS-005, FR-REC-008, D-08, ERR-05. 

### Câu 12 – Tìm kiếm toàn cục

**Kết quả hiện theo vai trò** (luôn lọc theo chi nhánh trong quyền; không bao giờ có dữ liệu chi nhánh khác, UAT-06):

| Nhóm kết quả | CH, QV | QL | CV | QĐ | TH | TK | TN | KT | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Xe | Có | Có | Có | Có | Chỉ xe của việc được giao | Không | Có | Có | Không |
| Khách | Có, che | Có | Có | Có | Chỉ tên + biển số của việc mình | Không | Có | Có, che | Không |
| Lệnh | Có | Có | Có | Có | Chỉ lệnh được giao | Có (để xuất kho) | Có | Có | Không |
| Báo giá | Có | Có | Có | Có | Không | Có | Có | Có | Không |
| Phụ tùng | Có | Có | Có (tồn khả dụng, không giá vốn) | Không | Không | Có | Không | Có | Không |
| Chứng từ | Phiếu thu, kho, hóa đơn | Tất cả trong chi nhánh | **Phiếu thu có, kho và hóa đơn không** | Không | Không | Phiếu kho | Phiếu thu, hóa đơn | Tất cả | Không |

- **Tìm theo SĐT**: vai trò thấy đầy đủ (QL, CV, TN, QĐ) tìm theo SĐT bình thường. CH, QV, KT chỉ tìm được khi nhập **đúng số đầy đủ** (không khớp một phần); kết quả vẫn che, và mỗi lần tìm theo SĐT ghi nhật ký truy cập. TK, TH, AD không tìm theo SĐT.
- AD: ô tìm kiếm chuyển thành “Tìm người dùng, thiết bị, cấu hình”, không có dữ liệu nghiệp vụ. TH: ô tìm kiếm giới hạn việc của mình.
- Tối thiểu 3 ký tự, tối đa 50 kết quả đầu, không ký tự đại diện.

**Căn cứ**: FRD §2, FR-SYS-002, NFR-ISO-01, NFR-SEC-03, D-10, ba-decisions câu 8. Phát hiện: F1-14.

### Câu 13 – Hồ sơ cá nhân

- **Tự sửa**: số điện thoại liên hệ (kiểm tra định dạng, ghi nhật ký), ảnh đại diện (JPG hoặc PNG, tối đa 2 MB, kiểm tra ở máy chủ).
- **Chỉ đọc** (do quản trị gán): họ tên, mã nhân viên, chức danh, chi nhánh, vai trò (FR-HRM-001).
- **Email**: không sửa trực tiếp trong PRF-01. Nút “Đổi email” dẫn tới quy trình ở PRF-02: nhập lại mật khẩu → gửi liên kết xác nhận (30 phút, dùng một lần) tới **email mới** → gửi thông báo tới **email cũ** → email mới chỉ có hiệu lực sau khi xác nhận; ghi nhật ký. Lý do: email vừa là định danh đăng nhập vừa là kênh khôi phục mật khẩu, nên đổi tùy tiện là đường chiếm tài khoản. Nhân viên không có email (thợ): QL hoặc AD cập nhật.
- Mọi thay đổi hồ sơ ghi nhật ký (FR-SYS-003).

**Căn cứ**: FR-SYS-001, 003, FR-HRM-001, NFR-SEC-01. Phát hiện: F1-07, F1-18.

### Câu 14 – Người nhiều vai trò

- Thứ tự mặc định cho lần đầu: **CH > QV > QL > KT > QĐ > CV > TK > TN > TH > AD**. Thứ tự này theo phạm vi quyền và độ nhạy của dữ liệu; AD đứng cuối vì là vai trò kỹ thuật (người vừa là AD vừa có vai trò nghiệp vụ vào dashboard nghiệp vụ, đổi sang DSH-10 khi cần). MH và NS không có dashboard nên không tham gia thứ tự.
- Sau đó hệ thống **nhớ góc nhìn gần nhất theo từng chi nhánh** (vai trò có thể khác nhau giữa các chi nhánh, như PRF-01 minh họa).
- **Có** đổi góc nhìn trong cùng chi nhánh (ví dụ QL làm việc của CV). Góc nhìn chỉ đổi trang đầu và nhấn mạnh menu; **quyền vẫn là phần hợp** của các vai trò (FR-SYS-012), không bị thu hẹp khi đổi góc nhìn và không cộng dồn thẻ làm loãng dashboard (D-09).
- Người kiêm TK và TN: vào TK (đứng trước TN), đổi sang TN bằng góc nhìn.

**Căn cứ**: FR-SYS-012, UAT-19, D-09. 

### Câu 15 – Nội dung quy định sử dụng và bảo mật dữ liệu (AUT-06 bước 4)

- **Văn bản chính thức do khách và luật sư của khách ban hành** (NFR-PRI-01 còn `[Cần xác nhận]`, BA không soạn nội dung pháp lý). Prototype phải gắn nhãn “Nội dung mẫu” cho đến khi có bản chính thức.
- **Khung nội dung đề nghị**: (1) tài khoản cá nhân, không chia sẻ mật khẩu hoặc PIN; (2) chỉ truy cập dữ liệu theo nhu cầu công việc, dữ liệu khách chỉ dùng cho dịch vụ; (3) không sao chép, xuất, chụp hoặc gửi dữ liệu khách ra kênh cá nhân; (4) thông báo rõ hoạt động được ghi nhật ký và lịch sử đăng nhập (FR-SYS-003, 014); (5) báo cáo sự cố mất thiết bị hoặc lộ mật khẩu; (6) hậu quả khi vi phạm; (7) quyền của chính nhân viên đối với dữ liệu cá nhân của họ và đầu mối liên hệ.
- **Ghi nhận đồng ý**: lưu mã phiên bản văn bản, ngày hiệu lực, người dùng, thời điểm, thiết bị. Khi có phiên bản mới có thay đổi quan trọng, yêu cầu đồng ý lại ở lần đăng nhập kế. Có liên kết xem lại văn bản ở PRF-01.
- Thời hạn lưu bằng chứng đồng ý theo chính sách lưu trữ (`[Cần xác nhận]`).

**Căn cứ**: NFR-PRI-01, NFR-SEC-03, FR-SYS-003, 014, D-01, Luật Bảo vệ dữ liệu cá nhân 2025 (BRD phần pháp lý).

## C. Tài liệu cần cập nhật khi chốt (không thực hiện trong lượt này)

| Tài liệu | Nội dung |
| --- | --- |
| `docs/functional-requirements.md` | Thêm FR §D; ghi chú FRD §2 về DSH-10 và quyền xem lợi nhuận của QL; nâng FR-RPT-010 lên Must; FRD §13 phạm vi Phase 1 (khoảng trống G-01); UAT mới ở §D |
| `docs/business-requirements.md` | RULE-007 chỉ nói về xuất phụ tùng, còn CLAUDE.md và designer hiểu cả thu tiền và hóa đơn: cần thống nhất chữ; thêm định nghĩa “xe trễ hẹn”, “số tạm/chính thức” vào phần thuật ngữ |
| `docs/user-journey-business-workflow.md` | Workflow đăng nhập, khóa tạm, mở khóa, thu hồi thiết bị; ghi chú ngoại lệ thợ mất mạng (WF-08); trạng thái “Chờ đồng bộ” là chỉ báo |
| `docs/ui-ux/screen-inventory.md` | AUT-02 (ẩn email theo vai trò), AUT-10 (trạng thái “Đặt PIN mới”), PRF-02 (Đổi email, Thiết bị tin cậy), D-02 đổi theo câu 2 |
| `docs/ui-ux/01-auth-dashboard.md` | §4.4 quy tắc lợi nhuận theo câu 6; §7 giả định 4, 5, 8; §8 xóa các câu đã trả lời |

## D. Đề xuất FR/UAT mới (chưa thêm vào FRD; id nối tiếp cuối module)

| Id đề xuất | Nội dung | Ưu tiên | BR | UAT đề xuất |
| --- | --- | --- | --- | --- |
| FR-SYS-019 | Lời mời kích hoạt, quên và đặt lại mật khẩu, mật khẩu tạm (liên kết 72 giờ và 30 phút, một lần, thông báo trung lập) | Must | BR-SYS-01 | UAT: liên kết hết hạn không lộ trạng thái |
| FR-SYS-020 | Phiên làm việc, khóa màn hình, giới hạn đăng nhập sai (bộ đếm A, B, C), mở khóa | Must | BR-SYS-01 | UAT: dò mật khẩu nhiều thiết bị bị làm chậm |
| FR-SYS-021 | Trung tâm thông báo, ma trận sự kiện × vai trò, thời hạn lưu | Should | BR-SYS-03 | UAT: không nhận ngoài phạm vi quyền |
| FR-SYS-022 | Thiết bị xưởng: đăng ký bằng mã ghép, PIN, khóa, thu hồi | Must (nếu Phase 1 có tablet xưởng) | BR-SYS-01, BR-HRM-03 | UAT: tablet mất bị thu hồi |
| FR-SYS-023 | Ghi nhận đồng ý quy định theo phiên bản | Should | BR-SYS-02 | UAT: phiên bản mới yêu cầu đồng ý lại |
| FR-RPT-017 | Định nghĩa nhãn số tạm/chính thức và “Cách tính” trên KPI | Must | BR-RPT-01 | UAT-07 mở rộng |
| FR-REC-037 | Trường Cố vấn phụ trách trên lệnh | Should | BR-REC-06 | UAT: “xe của tôi” khớp |
| FR-ACC-021 | Mở ca với tiền đầu ca; một ca mở mỗi thu ngân | Must | BR-ACC-05 | UAT-07 mở rộng |

## E. Câu hỏi vẫn cần khách xác nhận (không quyết thay)

1. KT có thuộc “quản lý trở lên” để bắt buộc MFA không; QĐ có cần bắt buộc không.
2. Mốc ghi nhận doanh thu (ngày giao xe hay ngày thu tiền) và thành phần nhân công trong lợi nhuận gộp, theo kế toán của khách.
3. Số tổng đài và giờ làm việc hiển thị cho khách.
4. Văn bản quy định sử dụng, bảo mật dữ liệu, thời hạn lưu bằng chứng đồng ý và nhật ký (luật sư của khách).
5. Khách có chấp nhận chặn ghi giờ khi mất mạng ở Phase 1 (câu 4) và dùng phiếu giấy dự phòng không.
6. Quản đốc có nhập bù giờ công hộ thợ được không (và ngưỡng chênh lệch cần xác nhận).
