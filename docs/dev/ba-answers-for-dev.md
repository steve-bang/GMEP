# BA trả lời dev: Q1–Q12 và hai mục BA-12, BA-13 (cho slice 1.1 và 1.2)

Phiên bản 0.1 · 31/10/2026 · Người lập: BA · Trạng thái: **BA đề xuất, chờ xác nhận**. Tài liệu này không sửa `functional-requirements.md`, `business-requirements.md`, `user-journey-business-workflow.md` (FRD v0.4 làm sau); phần "Thay đổi khuyến nghị" ở cuối liệt kê việc cần sửa.

Trả lời cho: [open-questions-for-ba.md](open-questions-for-ba.md) (Q1–Q12) và [review-docs-and-design.md](review-docs-and-design.md) (BA-12, BA-13; có đối chiếu BA-05, BA-10). Ràng buộc kiến trúc: [ADR 0001](../adr/0001-tech-stack.md) §2.1 (TOTP và PIN do chủ dự án cung cấp phần máy chủ sau; trình duyệt không gọi Firebase) và §6.3. Với TOTP và PIN, tài liệu này **chỉ đặt yêu cầu**, không đặt cách cài.

## 0. Cách đọc

**Thẻ trạng thái** (mỗi câu trả lời có một thẻ):

| Thẻ | Nghĩa |
| --- | --- |
| `[Đã có trong tài liệu]` | Có trong BRD, FRD, Journey hoặc ADR §2.1; ghi nguồn. Lưu ý các tài liệu này vẫn là bản nháp chưa khách ký |
| `[Đề xuất BA – chờ xác nhận: ai]` | Chưa có trong BRD/FRD/Journey (hoặc chỉ có trong `docs/ui-ux/ba-*.md`, cũng là đề xuất). Dev **được** cài làm giá trị mặc định cấu hình; người nêu tên quyết định sau |
| `[Cần xác nhận: ai]` | Quyết định thuộc bên nêu tên; BA chỉ đưa giá trị khởi điểm an toàn để dev cấu hình, **không** coi là đã chốt |

**Bên quyết định**: *Chủ dự án* (người ký ADR, quyết tài liệu và phạm vi), *Khách* (chủ garage và vận hành), *Kế toán khách*, *Luật sư khách*.

**Quy ước chung cho dev**: mọi con số trong tài liệu này là **tham số cấu hình** có ngày hiệu lực (FRD "Nguyên tắc xuyên suốt", NFR-MNT-01), không viết cứng trong mã. Mã vai trò dùng mã FRD §2.

### 0.1 Tóm tắt: đã chốt, đang chờ ai, mâu thuẫn

| Nhóm | Nội dung |
| --- | --- |
| Dev làm ngay được (mặc định cấu hình) | Ma trận quyền 1.1–1.2 (§2); mã vai trò (§2.1); vòng đời kho (§3); phạm vi chi nhánh làm việc (§4); trạng thái chi nhánh khóa (§5); bộ đếm khóa đăng nhập, chính sách mật khẩu, hết phiên (§1); bảng đánh số chứng từ (§6); bảng che dữ liệu cá nhân (§7); khung lưu trữ (§8); giới hạn xuất (§9); bảng chiếu xuyên chi nhánh (§10); kích thước trang (§11) |
| Chờ **chủ dự án** | Vai trò bắt buộc MFA (KT có thuộc "quản lý trở lên" không); chấp nhận rủi ro dư của mô hình tablet dùng chung + PIN; ai lập bảng giá bán chuẩn; vai trò quản trị trụ sở và mã vai trò MH, NS, QC; kho tổng tồn tại hay không; phạm vi chiếu xuyên chi nhánh (§10); có cho MFA tạm tắt trong pilot hay không |
| Chờ **kế toán khách** | Liền số cho từng loại chứng từ; dãy số theo chi nhánh hay pháp nhân; kỳ đặt lại số; đánh số phiếu đảo; có hiện giá vốn trên phiếu chuyển kho; công nợ toàn chuỗi khi tiếp nhận |
| Chờ **luật sư khách** | Thời hạn lưu nhật ký thao tác, nhật ký truy cập, lịch sử đăng nhập; mức che dữ liệu có đủ theo Luật BVDLCN 2025; căn cứ cho chiếu khách/xe xuyên chi nhánh; địa chỉ IP trong nhật ký có phải dữ liệu cá nhân cần lưu thận trọng; ngoại lệ giữ dữ liệu khi xóa/ẩn danh |
| Mâu thuẫn tài liệu tìm thấy | Xem §13 (16 mục). Nghiêm trọng nhất: NFR-ISO-01/UAT-06/`ba-answers-01` Câu 12 ("không bao giờ có dữ liệu chi nhánh khác") **xung đột** FR-CRM-004, FR-CRM-002, FR-REC-006, FR-REC-036, FR-INV-014, FR-INV-031; FR-SYS-003 (giá trị trước và sau) xung đột ẩn danh dữ liệu cá nhân |

---

## 1. BA-12 và Q5, Q6, Q7: yêu cầu xác thực

### 1.1 Vai trò bắt buộc MFA (đối chiếu FR-SYS-001, D-02, AUT-10)

Ba nguồn đang nói ba cách: FR-SYS-001 "quản lý trở lên" (không nêu vai trò); D-02/G-02 và `ba-answers-01` Câu 2 liệt kê CH, QV, QL, KT, AD; AUT-10 chỉ nói PIN cho thợ. Chốt đề xuất:

| Vai trò | MFA bắt buộc (mặc định) | Tin cậy thiết bị | Ghi chú | Thẻ |
| --- | --- | --- | --- | --- |
| CH | Có | tối đa 14 ngày | Thao tác nguy hiểm luôn hỏi lại mật khẩu | `[Đề xuất BA – chờ xác nhận: Khách]` (D-02, `ba-answers-01` Câu 2) |
| QV | Có | 14 ngày | | như trên |
| QL | Có | 14 ngày | QL có quyền duyệt và quản lý người dùng | như trên |
| KT | Có | **0 ngày** (mỗi lần đăng nhập đầy đủ) | Tiền và hóa đơn nằm ở KT. Điểm "KT có thuộc quản lý trở lên" **chưa được khách xác nhận** (G-02) | `[Cần xác nhận: Chủ dự án, Khách]` |
| AD | Có | 0 ngày | Quản trị cấu hình và phân quyền | `[Đề xuất BA – chờ xác nhận: Khách]` |
| QĐ | Không (có thể tự bật) | | Dùng PIN trên tablet xưởng; không có quyền tiền, không duyệt hạn mức | `[Đề xuất BA – chờ xác nhận: Khách]` |
| CV, TN, TK, TH, MH, NS | Không (có thể tự bật) | | TN giữ tiền mặt, TK giữ kho: nếu Khách muốn nâng thì chỉ đổi cờ vai trò | `[Cần xác nhận: Khách]` |

Quy tắc đi kèm:

1. "Bắt buộc MFA" là **thuộc tính cấu hình của vai trò** (G4-SYS-24), không phải danh sách trong mã. Người có nhiều vai trò (FR-SYS-012) chịu yêu cầu **mạnh nhất** của các vai trò được gán. `[Đề xuất BA – chờ xác nhận: Khách]`
2. Hạ yêu cầu bảo mật (bỏ MFA của một vai trò, rút ngắn mật khẩu, nới hết phiên) là thay đổi nhóm A, cần CH duyệt (`ba-answers-06` Câu 2). Nâng yêu cầu thì không cần duyệt.
3. Phương thức, mã khôi phục, đặt lại MFA: ứng dụng xác thực (TOTP) là chính; **không** có mã dự phòng qua email cho nhóm bắt buộc; 10 mã khôi phục dùng một lần; đặt lại MFA do QL (nhân viên chi nhánh không thuộc nhóm bắt buộc), còn CH hoặc AD (các vai trò nhóm bắt buộc; AD cần CH xác nhận), có nhật ký và email thông báo (`ba-answers-01` Câu 2). `[Đề xuất BA – chờ xác nhận: Khách]`
4. Hỏi lại mật khẩu (step-up) cho: mở lại ngày hoặc kỳ, hủy hóa đơn, đổi vai trò, xuất danh sách khách, xuất cột cá nhân đầy đủ, CH tự duyệt thay đổi của chính mình (D-02, `ba-answers-06` Câu 2 và Câu 3). `[Đề xuất BA – chờ xác nhận: Khách]`
5. **Phần dev (theo ADR §2.1 A2)**: chỉ có cờ `mfaRequired` theo vai trò, `StrongAuthPort`, và điểm móc trong luồng đăng nhập; không tự viết TOTP. Yêu cầu BA: hệ thống có cờ môi trường `cưỡng chế MFA` (tắt/cảnh báo/bắt buộc). **Pilot thật với tiền và dữ liệu cá nhân thật chỉ chạy khi cờ ở "bắt buộc" cho nhóm bắt buộc**, trừ khi Chủ dự án ký chấp nhận rủi ro bằng văn bản. `[Cần xác nhận: Chủ dự án]`

### 1.2 Mô hình "tablet xưởng dùng chung + PIN cá nhân"

**Kết luận BA: chấp nhận có điều kiện** (không chấp nhận nếu thiếu bất kỳ điều kiện C1–C8). Lý do: Journey §1 nêu thợ dùng "tablet dùng chung tại xưởng"; NFR-USA-01 đòi bắt đầu hoặc kết thúc hạng mục tối đa 2 chạm; BR-HRM-03 cần mốc giờ gắn đúng người. Điều FR-SYS-001 cấm là **dùng chung tài khoản**; mô hình này giữ tài khoản cá nhân cho từng người, chỉ **thiết bị** dùng chung. Cần sửa câu chữ FR-SYS-001 để không còn mơ hồ (xem §14).

| Rủi ro | Mức | Biện pháp bắt buộc |
| --- | --- | --- |
| PIN 6 số chỉ có một triệu tổ hợp; dò PIN | Cao | **C1** Đếm sai theo tên thợ trên mọi thiết bị: 5 lần sai khóa tên cho đến khi QĐ hoặc QL mở (không tự mở); **C2** Đếm theo thiết bị: 20 lần sai trong 15 phút (mọi tên) khóa thiết bị 15 phút; QĐ/QL mở sớm; **C3** PIN do máy chủ kiểm, không kiểm ở trình duyệt |
| Dùng PIN của người khác để gán giờ công sai người (gian lận công, hoa hồng) | Cao | **C4** PIN không hiện trên màn hình, chặn PIN dễ đoán (dãy lặp, dãy liên tiếp), không trùng 3 PIN gần nhất; **C5** mọi mốc giờ ghi `deviceId` + `userId` + giờ máy chủ; báo cáo bất thường cho QĐ/QL (số lần nhập bù theo thợ, nhiều thợ đăng nhập liên tiếp trong vài giây); thợ xác nhận lại bằng PIN khi nhập bù được xác nhận (`ba-decisions` E.1) |
| Tablet bị mất, bị cầm lên tay người ngoài | Cao | **C6** Thiết bị phải **đăng ký** bằng mã ghép 8 ký tự do QL hoặc AD tạo (hiệu lực 10 phút), gắn một chi nhánh; thu hồi có hiệu lực tức thì (vô hiệu mọi phiên PIN của thiết bị); đăng ký lại định kỳ 90 ngày; chỉ nhận PIN từ thiết bị đã đăng ký |
| Phiên PIN bị bỏ quên, người khác thao tác | Trung | **C7** Tự khóa sau **3 phút** không dùng (quay về lưới chọn thợ, giữ nháp); phiên tuyệt đối 12 giờ |
| Phiên PIN leo thang quyền | Cao | **C8** Phiên PIN là **loại phiên riêng**, chỉ có bộ quyền hẹp (xem dưới); không bao giờ mang quyền tiền, dữ liệu cá nhân khách, phê duyệt, xuất, cấu hình |

**Bộ quyền tối đa của phiên PIN** (`allowedWithPinSession`): TH xem việc của mình; bắt đầu, tạm dừng, hoàn thành hạng mục (2 chạm); yêu cầu phụ tùng; báo hạng mục phát sinh; xem công của mình. QĐ thêm: phân việc, chấm checklist QC. **Không** nằm trong phiên PIN: SĐT hoặc địa chỉ khách ("Hiện"), thu tiền, hóa đơn, xuất dữ liệu, mọi thao tác duyệt, xác nhận nhập bù giờ công của thợ khác, mở khóa hoặc đặt lại PIN, cấu hình. Những việc này đòi **đăng nhập đầy đủ** (mật khẩu, và MFA nếu vai trò bắt buộc). `[Đề xuất BA – chờ xác nhận: Chủ dự án]`

Rủi ro còn lại sau biện pháp (đứng cạnh mô phỏng, chia sẻ PIN giữa thợ quen biết, chụp lén màn hình nhập PIN) **không loại bỏ được bằng phần mềm**. Chỉ **Chủ dự án và Khách** được chấp nhận rủi ro này; cần ghi vào biên bản. Phương án mạnh hơn mà Khách có thể muốn (quét thẻ, nhận diện) đang để mở (D-04 "TBD"). Thợ không có email vẫn đăng nhập đầy đủ bằng mã nhân viên + mật khẩu tạm do QL cấp (D-03).

Trạng thái: mô hình `[Đã có trong tài liệu]` dưới dạng đề xuất BA (D-04, AUT-10, `ba-answers-01` Câu 3); chấp nhận rủi ro dư `[Cần xác nhận: Chủ dự án, Khách]`. Phần máy chủ do chủ dự án cung cấp (ADR §2.1 A2); các số C1–C7 là tham số.

### 1.3 Chính sách mật khẩu (Q6)

| Tham số | Mặc định | Nguồn | Cấu hình bởi | Thẻ |
| --- | --- | --- | --- | --- |
| Độ dài tối thiểu | 10 ký tự | D-03, ADR §6.3 | AD, hạ cần CH duyệt | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Chặn mật khẩu thông dụng và trùng tên/email/mã nhân viên | Có | D-03 | AD | như trên |
| Đổi định kỳ | Không bắt buộc | D-03 (hướng dẫn hiện hành ưu tiên độ dài hơn đổi định kỳ) | AD | như trên |
| Không dùng lại | 5 mật khẩu gần nhất (lưu băm lịch sử) | D-03 | AD | như trên |
| Mật khẩu tạm (QL cấp cho nhân viên không email) | Buộc đổi ở lần đăng nhập đầu; hết hạn theo tham số | D-03, G1-AUT-07 | | như trên |
| Lời mời kích hoạt | 72 giờ, dùng một lần; không tự đăng ký | D-01 | | như trên |
| Liên kết đặt lại | 30 phút, dùng một lần; thông báo luôn trung lập (không lộ tài khoản có tồn tại) | D-03 | | như trên |
| Băm mật khẩu khi lưu | Bắt buộc | NFR-SEC-01 | | `[Đã có trong tài liệu]` |

### 1.4 Khóa đăng nhập sai (Q6)

Ba bộ đếm, áp dụng **cả cho tên đăng nhập không tồn tại** để hành vi giống nhau (`ba-answers-01` Câu 1). Ngưỡng là tham số.

| Bộ đếm | Ngưỡng mặc định | Hậu quả | Người dùng thấy | Thẻ |
| --- | --- | --- | --- | --- |
| A. (thiết bị + tên nhập chuẩn hóa) | 5 lần sai liên tiếp | Khóa 15 phút; lần khóa thứ hai trong 60 phút thì khóa 60 phút | "Tạm dừng đăng nhập trên thiết bị này", đếm lùi | `[Đề xuất BA – chờ xác nhận: Khách]` (D-03, ADR §6.3) |
| B. Tên nhập chuẩn hóa, mọi thiết bị | 10 lần sai trong 15 phút | **Không khóa cứng** (tránh bị kẻ khác cố ý khóa nhân viên); làm chậm lũy tiến; tài khoản có thật thì đánh dấu "đăng nhập bất thường" cho AD và gửi email cho chủ tài khoản | Cùng thông báo trung lập | như trên |
| C. Địa chỉ mạng | Ngưỡng chung cao hơn A (nhiều chi nhánh có thể dùng chung một địa chỉ). Giá trị khởi điểm kỹ thuật: dev đề xuất, đo lại ở staging | Làm chậm | Cùng thông báo | `[Cần xác nhận: Chủ dự án]` (số cụ thể) |

Mở khóa sớm: hết thời gian; hoàn tất "Quên mật khẩu"; QL mở khóa nhân viên **vận hành** trong chi nhánh mình (CV, QĐ, TH, TK, TN); KT, QL, QV, AD do CH hoặc AD mở; người mở phải nhập lại mật khẩu của mình; ghi nhật ký (FR-SYS-003) và gửi email cho chủ tài khoản. Không có câu hỏi bí mật. Thông báo lỗi đăng nhập chung chung cho mọi trường hợp (vô hiệu, khóa, sai mật khẩu); lý do thật chỉ hiện cho QL/AD ở G4-SYS-03. Lịch sử đăng nhập (thời điểm, thiết bị, kết quả): FR-SYS-014.

### 1.5 Hết phiên theo vai trò (Q5)

Giá trị là **tham số theo vai trò và theo loại phiên**, thay cho biến môi trường chung `SESSION_IDLE_MINUTES`/`SESSION_TTL_HOURS`.

| Loại phiên hoặc vai trò | Rảnh (khóa màn hình) | Tuyệt đối | Sau khi khóa | Nguồn | Thẻ |
| --- | --- | --- | --- | --- | --- |
| Mặc định (CV, QL, QV, QĐ, TN, TK, MH, NS khi đăng nhập đầy đủ) | 30 phút | 12 giờ | Nhập lại mật khẩu (không MFA nếu chưa quá 12 giờ) | D-05 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| CH, KT, AD | 15 phút | 12 giờ | như trên | D-05 | như trên |
| Phiên PIN trên tablet xưởng (TH, QĐ) | 3 phút | 12 giờ | Về lưới chọn thợ, nhập PIN; giữ nháp | D-04, D-05 | như trên |
| Người nhiều vai trò | Lấy **giá trị nhỏ nhất** trong các vai trò được gán | 12 giờ | | BA suy ra từ nguyên tắc "mạnh nhất" của `ba-answers-01` Câu 2 | `[Đề xuất BA – chờ xác nhận: Khách]` |

Yêu cầu khác: cảnh báo 60 giây trước khi khóa; nháp luôn được giữ (NFR-OFF-01); **máy chủ** quyết định hết phiên (đồng hồ trình duyệt chỉ để hiển thị); độ mịn ghi `lastSeenAt` phải nhỏ hơn một phần ba thời gian rảnh ngắn nhất (với 3 phút thì không quá 60 giây, khớp ADR §6.3). Vai trò chạm tiền hoặc dữ liệu cá nhân nặng (TN, NS, QV) có nên 15 phút hay không: `[Cần xác nhận: Khách]` (D-05 mới đặt 15 phút cho KT, AD, CH).

### 1.6 Định danh đăng nhập (Q7)

| Nội dung | Quyết định | Thẻ |
| --- | --- | --- |
| Đăng nhập bằng gì | **Email hoặc mã nhân viên** (giữ giá trị tạm). Nhân viên không có email (thợ) chỉ dùng mã nhân viên; email là kênh khôi phục mật khẩu | `[Đề xuất BA – chờ xác nhận: Khách]` (G1-AUT-01, 04; D-03) |
| Mã nhân viên duy nhất theo | **Công ty** (`companyId`), không theo pháp nhân: nhân viên có thể chuyển chi nhánh hoặc pháp nhân (FR-SYS-018) mà không đổi mã. Chuẩn hóa: bỏ khoảng trắng, không phân biệt hoa thường khi so khớp | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Mã nhân viên bất biến | Có; không tái sử dụng mã của người đã nghỉ (nhật ký, lệnh còn tham chiếu; `ba-answers-06` Câu 13) | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Đổi email | Không sửa trực tiếp: nhập lại mật khẩu, liên kết 30 phút tới email mới, thông báo email cũ (`ba-answers-01` Câu 13) | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Quy ước mã nhân viên (định dạng, nguồn mã hiện có) | Khách dùng quy ước nào chưa biết; `NV0001` trong seed là mẫu giả | `[Cần xác nhận: Khách]` |

### 1.7 Việc chỉ Chủ dự án hoặc Khách quyết (BA-12)

1. KT (và TN, TK) có thuộc nhóm bắt buộc MFA không (G-02).
2. Chấp nhận rủi ro còn lại của tablet dùng chung + PIN, và danh sách quyền của phiên PIN.
3. Có cho chạy pilot thật khi MFA chưa có (ADR §2.1 A2 giao phần này cho chủ dự án).
4. Số cụ thể của ngưỡng bộ đếm C, thời hạn đăng ký lại thiết bị (90 ngày), hết phiên 15 hay 30 phút cho QV, TN, NS.
5. Xem xét bảo mật độc lập cho phần TOTP, PIN trước go-live (ADR §6.3 điểm 1).

---

## 2. Q1: ma trận quyền (vai trò × tài nguyên × hành động)

### 2.1 Mã vai trò chính thức

| Mã | Vai trò | Nguồn | Ghi chú cho seed |
| --- | --- | --- | --- |
| CH | Chủ garage | FRD §2 | Seed `CH` đúng; gán chi nhánh `*` |
| QV | Quản lý vùng | FRD §2 | Phạm vi = **danh sách chi nhánh được gán** (một phép gán mỗi chi nhánh); chưa cần thực thể "nhóm chi nhánh" ở slice 1.1–1.2. BRD §5 còn ghi "[Cần xác nhận có hay không]" |
| QL | Quản lý chi nhánh | FRD §2 | Seed `QL` đúng |
| CV | Cố vấn dịch vụ | FRD §2 | |
| QĐ | Quản đốc (gồm kiểm tra chất lượng) | FRD §2; `review-03-quote-technician-delivery-ba.md` F3-28 bỏ vai trò QC riêng | Mã hiển thị có dấu "QĐ"; **khóa kỹ thuật ASCII (ví dụ `QD`) do dev chọn**, đây không phải quyết định nghiệp vụ |
| TH | Thợ | FRD §2 | |
| TK | Thủ kho | FRD §2 | Seed `TK` đúng |
| TN | Thu ngân | FRD §2 | |
| KT | Kế toán | FRD §2 | "Kế toán trưởng" **không phải vai trò riêng**: là cấu hình quyền của KT (FRD §2 ghi chú, FR-EIN-007), ví dụ quyền `invoice:approve` |
| AD | Quản trị hệ thống | FRD §2 | Không xem dữ liệu nghiệp vụ nhạy cảm của khách (FRD §2 ghi chú) |
| MH | Nhân viên mua hàng | BRD §5 (bản 0.2), `ba-answers-04` Phụ lục C | Chưa có hàng trong ma trận FRD §2 |
| NS | Nhân sự | như trên | như trên |
| (chưa có mã) | Quản trị trụ sở | BRD §5, G4-SYS-15 | `[Cần xác nhận: Chủ dự án]` có tách khỏi AD không. **Chưa seed** |
| (bỏ) | Nhân viên kiểm tra chất lượng (QC) | BRD §5 bản 0.2; F3-28 gộp vào QĐ | `[Cần xác nhận: Chủ dự án]` |

Kết luận về seed: ba mã `CH`, `QL`, `TK` là **đúng**; nội dung quyền trong seed (`warehouse:view/create/export`) chỉ là chỗ giữ, **không khớp tài liệu**: theo G4-SYS-05, 06 kho do AD tạo và sửa, CH duyệt, TK chỉ dùng kho (nhập, xuất, kiểm kê), QL không tạo kho. Cần thay theo bảng §2.3.

### 2.2 Quy ước

1. Quyền là `tài nguyên:hành động`; tám hành động của FR-SYS-013: `view`, `create`, `update`, `archive`, `approve`, `reject`, `export`, `manage` (khớp `rbac.ts`).
2. **Quy đổi ký hiệu FRD §2 sang hành động** (dùng khi mở rộng ma trận ở các slice sau): **S** = `view` + `create` + `update`; **D** = `view` + `approve` + `reject` (không kèm `create`); **X** = `view`; **Xn** = `view` có điều kiện "chỉ bản ghi của mình" (đề xuất đặt hậu tố `.own` cho khóa tài nguyên để không thêm hành động thứ chín). `archive`, `manage`, `export` cấp riêng theo bảng. `approve` và `reject` luôn cùng một tập vai trò (`ba-answers-06` Câu 2). `[Đề xuất BA – chờ xác nhận: Chủ dự án]`
3. "Hiện" dữ liệu cá nhân **không** là hành động thứ chín: nó do `PiiPolicy` cấu hình (G4-SYS-04, §7), tách khỏi bảng quyền này.
4. Phạm vi: `(cn)` = chỉ chi nhánh được gán cho quyền đó; `*` = toàn công ty. Quyền là hợp (FR-SYS-012) theo từng chi nhánh.
5. **Tách nhiệm vụ**: người đề xuất không tự duyệt. Ngoại lệ duy nhất: CH tự đề xuất thì duyệt luôn, nhưng phải nhập lại mật khẩu và có nhật ký (`ba-answers-06` Câu 2 mục 5). Không ai tự gán thêm vai trò cho chính mình (kể cả AD). `[Đề xuất BA – chờ xác nhận: Chủ dự án]`
6. Với CH, FRD §2 chỉ ghi D (duyệt) cho cấu hình; bảng dưới cho CH thêm `create`/`update` vì `ba-answers-06` Câu 2 mục 5. Nếu Chủ dự án muốn CH chỉ duyệt thì bỏ hai hành động đó của CH.

### 2.3 Ma trận cho slice 1.1 và 1.2

| Tài nguyên | Hành động | Vai trò được phép (phạm vi) | Nguồn | Thẻ |
| --- | --- | --- | --- | --- |
| `user` (người dùng, lời mời, phép gán vai trò) | view | CH `*`, AD `*`, QL (cn) | FRD §2 hàng cuối; G4-SYS-01 | `[Đã có trong tài liệu]` |
| | create, update | CH `*`, AD `*` (mọi vai trò, nhưng gán CH/QV/QL/KT/AD cần CH duyệt); QL (cn) chỉ gán **CV, QĐ, TH, TK, TN** (và MH nếu Khách xác nhận) | FRD §2 ghi chú; G4-SYS-02; `ba-answers-01` Câu 1 | `[Đã có trong tài liệu]` cho QL; `[Đề xuất BA – chờ xác nhận: Chủ dự án]` cho tập vai trò |
| | archive (khóa, vô hiệu hóa) | CH, AD; QL (cn) với CV, QĐ, TH, TK, TN | G4-SYS-03 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| | approve, reject (gán vai trò quản lý, kế toán, quản trị) | CH | G4-SYS-02 "NH"; `ba-answers-06` nhóm A | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| | manage (mở khóa, cấp mật khẩu tạm, đặt lại MFA/PIN, đăng xuất mọi phiên) | QL (cn) với vai trò vận hành; CH, AD với vai trò còn lại; AD đặt lại MFA cần CH xác nhận | `ba-answers-01` Câu 1, 2 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| | export | CH | `ba-answers-06` Câu 3 (AD chỉ xuất nhật ký) | `[Đề xuất BA – chờ xác nhận: Khách]` |
| `role` (định nghĩa vai trò và quyền) | view | CH, AD | G4-SYS-04 | `[Đã có trong tài liệu]` |
| | create, update | AD, CH | G4-SYS-04 | như trên |
| | approve, reject | CH | G4-SYS-04; `ba-answers-06` nhóm A | như trên |
| `security-policy` (mật khẩu, MFA, phiên, khóa) | view, update | AD, CH | G4-SYS-24 | `[Đã có trong tài liệu]` (đề xuất UI) |
| | approve, reject (khi hạ mức) | CH | G4-SYS-24 "NH" | như trên |
| `device` (tablet xưởng) | view | QL (cn), QĐ (cn), CH, AD | G4-SYS-03 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| | create (mã ghép), archive (thu hồi) | QL (cn), AD; archive thêm CH | `ba-answers-01` Câu 3 | như trên |
| `worker-pin` | manage (mở khóa tên, cấp PIN tạm) | QĐ (cn), QL (cn) | `ba-answers-01` Câu 3 | như trên |
| `org` (công ty, pháp nhân, chi nhánh, trụ sở) | view | CH `*`, AD `*`, QV (nhóm được gán), QL (cn) | G4-SYS-05 | `[Đã có trong tài liệu]` |
| | create, update | AD, CH | G4-SYS-05, FR-SYS-011, 018 | như trên |
| | approve, reject | CH | `ba-answers-06` nhóm A | như trên |
| | archive (khóa chi nhánh, hai bước) | AD đề xuất, CH duyệt | `ba-answers-06` Phụ lục A.1 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| `branch-config` (địa chỉ, giờ làm, đơn vị phát hành, bảng giá áp dụng) | view | CH, QV (nhóm), QL (cn), AD | G4-SYS-06 | `[Đã có trong tài liệu]` |
| | update | AD toàn bộ; QL (cn) chỉ **trường nhóm C** (giờ làm, địa chỉ, liên hệ); trường tài chính (đơn vị phát hành, bảng giá, kho gán) cần CH duyệt | G4-SYS-06 "QL (S giới hạn)"; `ba-answers-06` nhóm A và C | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` cho ranh giới "giới hạn" |
| `warehouse` | view | CH, QV (nhóm), QL (cn), TK (cn), MH, KT, AD | G4-SYS-05; FRD §2 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| | create, update | AD, CH; QL (cn) chỉ sửa **tên, ghi chú** | G4-SYS-05 (AD S, CH D) | như trên. Sửa seed: QL **không** có `warehouse:create` |
| | approve, reject, archive (ngừng dùng) | CH duyệt; AD đề xuất | `ba-answers-06` nhóm A | như trên |
| | export | CH, QL (cn) | BA suy ra (danh sách cấu hình, không PII) | `[Đề xuất BA – chờ xác nhận: Khách]` |
| `service-catalog` (dịch vụ, nhóm, giờ chuẩn, đơn giá giờ) | view | CH, QV, QL, CV, QĐ, KT, AD | G4-SYS-07 | `[Đã có trong tài liệu]` (CV, KT, AD, QL, CH); QV, QĐ `[Đề xuất BA]` |
| | create, update | AD (danh mục công ty); QL (cn) cho ghi đè theo chi nhánh; CH | G4-SYS-07 | `[Cần xác nhận: Chủ dự án]` ai sở hữu danh mục cấp công ty (xem §12) |
| | approve, reject | CH (giờ chuẩn và đơn giá giờ là nhóm A) | `ba-answers-06` nhóm A | `[Đề xuất BA]` |
| `price-list` (bảng giá bán chuẩn) | view | CH, QV, QL, CV, KT; MH, TK xem giá bán, không giá vốn | FRD §2 hàng "Danh mục phụ tùng và bảng giá"; `ba-answers-04` Phụ lục C | `[Đã có trong tài liệu]` |
| | create, update | **Chưa chốt.** Khởi điểm: AD và KT; CH; **TK không** có quyền sửa giá bán | FRD §2 ghi TK = S nhưng gộp danh mục phụ tùng với bảng giá (xem §13 mục 7) | `[Cần xác nhận: Chủ dự án]` |
| | approve, reject | CH | `ba-answers-06` nhóm A | `[Đề xuất BA]` |
| `discount-limit` (hạn mức giảm giá) | view | CH, QV, QL, CV, KT | `ba-answers-06` Câu 1 | `[Đề xuất BA]` |
| | update (đề xuất thay đổi) | QV (nhóm), CH. **QL không sửa hạn mức chi nhánh mình** | `ba-answers-06` Phụ lục A.2 (mới hơn G4-SYS-09) | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| | approve, reject | CH (pilot một chi nhánh: CH đề xuất và tự duyệt có nhập lại mật khẩu) | FR-INV-025; `ba-answers-06` | như trên |
| `discount-program` (chương trình giảm trong hạn mức) | view, create, update | QL (cn), QV, CH | G4-SYS-09 | `[Đề xuất BA]` |
| `tax-rate` (thuế suất theo ngày hiệu lực) | view | KT, CH, QV, QL, CV, AD | G4-SYS-10 | `[Đề xuất BA]` |
| | create, update | KT; CH | FR-ACC-009; G4-SYS-10 | `[Đã có trong tài liệu]` |
| | approve, reject | CH | G4-SYS-10 | như trên. **Mốc áp thuế qua 1/1/2027 chưa chốt (BA-03): `[Cần xác nhận: Kế toán khách]`** |
| `doc-template` (mẫu chứng từ, mẫu in, mẫu tin) | view | CH, QV, QL, CV, TN, KT, AD | G4-SYS-12 | `[Đề xuất BA]` |
| | create, update | AD; CH | G4-SYS-12 | `[Đã có trong tài liệu]` (đề xuất UI) |
| | approve, reject | KT (mẫu kế toán); CH (mẫu khác) | `ba-answers-06` nhóm B | `[Đề xuất BA – chờ xác nhận: Kế toán khách]` |
| `numbering-series` (cấu hình đánh số, §6) | view | AD, CH, KT | BA | `[Đề xuất BA]` |
| | update | AD, CH | BA | như trên |
| | approve, reject | CH, sau khi Kế toán khách xác nhận | BA-13 | `[Cần xác nhận: Kế toán khách]` |
| `pii-policy` (bảng che dữ liệu cá nhân, §7) | view, update | AD, CH | G4-SYS-04, `ba-decisions` câu 8 | `[Đã có trong tài liệu]` (đề xuất UI) |
| | approve, reject | CH | `ba-answers-06` nhóm A | như trên |
| `retention-policy` (thời hạn lưu, §8) | view | CH, AD, KT | G4-SYS-23 | `[Đề xuất BA]` |
| | update | AD đề xuất | G4-SYS-23 | như trên |
| | approve, reject | CH, sau khi Kế toán và Luật sư khách xác nhận giá trị | `ba-answers-06` Câu 13 | `[Cần xác nhận: Kế toán khách, Luật sư khách]` |
| `audit-log` | view | CH `*`, AD `*` (giá trị khách đã che), QL (cn), KT (phần liên quan tiền và hóa đơn) | G4-SYS-19; FR-SYS-003 | `[Đã có trong tài liệu]` |
| | export | CH, AD (AD chỉ xuất nhật ký) | `ba-answers-06` Câu 3 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| | create/update/archive | **Không ai** (không sửa, không xóa; bản ghi do hệ thống ghi) | FR-SYS-003 | `[Đã có trong tài liệu]` |
| `access-log` (truy cập dữ liệu cá nhân) | view | CH, AD (chỉ mã bản ghi, không có giá trị cá nhân) | NFR-SEC-03; DM-8 | `[Đề xuất BA – chờ xác nhận: Luật sư khách]` |
| | export | CH | | như trên |
| `login-history` | view | Mọi người xem của mình; CH, AD, QL (cn) xem người khác | FR-SYS-014; PRF-02 | `[Đã có trong tài liệu]` |
| | export | CH, AD | | `[Đề xuất BA]` |
| `notification` | view, cấu hình | Mọi người, chỉ của mình; chỉ nhận thông báo trong phạm vi quyền | FR-SYS-008 | `[Đã có trong tài liệu]` |

Tài nguyên cho slice sau, **TBD** (mở rộng bằng quy tắc quy đổi §2.2 khi tới slice): `import-batch` (AD, QL (cn), KT/TK theo loại dữ liệu; hoàn tác lô CH; G4-SYS-20, 21), `backup` (CH xem và duyệt, AD thao tác, QL không xem; G4-SYS-22), `approval-rule` (hạn mức duyệt, CH ban hành; G4-APR-03), `integration-*` (G4-SYS-16 đến 18), và mọi tài nguyên nghiệp vụ lấy từ FRD §2:

| Hàng FRD §2 | Khóa tài nguyên dự kiến | Ghi chú cho slice sau |
| --- | --- | --- |
| Hồ sơ khách và xe | `customer`, `vehicle` | TH = Xn (`.own`); AD = `-`; CH, QV, KT, TN, QĐ = X; QL, CV = S. Khớp §7, §10 |
| Báo giá và lệnh sửa chữa | `quote`, `repair-order` | QL = D; CV = S; TH = Xn; AD = `-` |
| Phân thợ, kiểm tra chất lượng | `assignment`, `qc` | QĐ = S; QL = D |
| Danh mục phụ tùng | `parts-catalog` | TK = S; tách khỏi `price-list` (§13 mục 7). MH = X, không thấy giá vốn |
| Nhập, xuất, kiểm kê kho; chuyển kho | `stock-doc`, `transfer` | Thủ kho tạo, không tự duyệt phiếu bất thường (FR-SYS-013). CV = `-` (xem `ui-ux-flow` C-7) |
| Công thợ và hoa hồng | `labor`, `commission` | TH, CV = Xn |
| Thu tiền và sổ quỹ; công nợ và giá vốn; hóa đơn điện tử | `payment`, `ledger`, `cost`, `invoice` | TN = S thu tiền; KT = S; hóa đơn điều chỉnh, thay thế, hủy cần "kế toán trưởng" (quyền của KT) |
| Báo cáo và dashboard | `report` | `export` theo `ba-answers-06` Câu 3 |

### 2.4 Quyền theo vai trò (để seed slice 1.1–1.2)

| Vai trò | Quyền |
| --- | --- |
| CH `*` | Mọi hành động trong bảng §2.3 (tự duyệt đề xuất của mình có nhập lại mật khẩu), trừ sửa/xóa `audit-log` |
| QV (nhóm) | `org:view`, `branch-config:view`, `warehouse:view`, `service-catalog:view`, `price-list:view`, `discount-limit:view/update`, `discount-program:view/create/update`, `tax-rate:view`, `doc-template:view` |
| QL (cn) | `user:view/create/update/archive/manage` (vai trò vận hành), `device:view/create/archive`, `worker-pin:manage`, `org:view`, `branch-config:view/update` (nhóm C), `warehouse:view/update` (tên, ghi chú) `/export`, `service-catalog:view/create/update` (ghi đè chi nhánh), `price-list:view`, `discount-limit:view`, `discount-program:view/create/update`, `tax-rate:view`, `doc-template:view`, `audit-log:view`, `login-history:view` |
| CV | `service-catalog:view`, `price-list:view`, `discount-limit:view`, `tax-rate:view`, `doc-template:view` |
| QĐ (cn) | `device:view`, `worker-pin:manage`, `service-catalog:view` |
| TH | Không có quyền cấu hình |
| TK (cn) | `warehouse:view`, `price-list:view` |
| TN | `doc-template:view` |
| KT | `warehouse:view`, `service-catalog:view`, `price-list:view` (và create/update nếu Chủ dự án chốt), `discount-limit:view`, `tax-rate:view/create/update`, `doc-template:view/approve/reject` (mẫu kế toán), `numbering-series:view`, `retention-policy:view`, `audit-log:view` (phần liên quan) |
| AD | `user:view/create/update/archive/manage`, `role:view/create/update`, `security-policy:view/update`, `device:view/create/archive`, `org:view/create/update`, `branch-config:view/update`, `warehouse:view/create/update`, `service-catalog:view/create/update`, `price-list:view/create/update` (nếu chốt), `tax-rate:view`, `doc-template:view/create/update`, `numbering-series:view/update`, `pii-policy:view/update`, `retention-policy:view/update`, `audit-log:view/export`, `access-log:view`, `login-history:view/export`. **Không có `approve`/`reject`/dữ liệu khách** |
| MH | `warehouse:view` |
| NS | Không có quyền cấu hình ở slice này |

Mọi người dùng có quyền tự phục vụ không cần cấp: hồ sơ cá nhân, bảo mật của mình, lịch sử đăng nhập của mình, thông báo của mình.

---

## 3. Q2: kho (warehouse) trong FR-SYS-005

| Câu hỏi | Trả lời | Căn cứ | Thẻ |
| --- | --- | --- | --- |
| Mã kho duy nhất theo chi nhánh hay công ty | **Theo chi nhánh** (giữ giá trị tạm). Chi nhánh mới dùng được mã mẫu như `WH-CHINH` mà không phải phối hợp (NFR-SCA-01). Chứng từ và báo cáo luôn hiện `MÃCN / mã kho` để không nhầm. Định danh nội bộ là `id` | NFR-SCA-01; FR-SYS-018 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Sửa tên | Được (tên, ghi chú, loại hiển thị); ghi nhật ký. Chứng từ lưu `warehouseId` | FR-SYS-003 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Sửa mã | **Không** sau khi có bất kỳ phát sinh (sổ kho, giữ chỗ, chứng từ). Trước đó AD sửa được, có nhật ký. Sai mã thì ngừng dùng và tạo kho mới | RULE-009 | như trên |
| Ngừng dùng | Có, thành trạng thái `inactive`: không nhận phát sinh mới, vẫn tra cứu. **Chỉ khi** tồn thực tế, giữ chỗ, đang vận chuyển đều bằng 0 và không còn chứng từ mở (nháp, chờ duyệt, phiếu chuyển dở). Mở lại: AD đề xuất, CH duyệt. **Không xóa cứng** kho đã dùng | RULE-009, RULE-010 (tinh thần); `ba-answers-06` Phụ lục A.1 (khóa chi nhánh kiểm "mục treo") | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Chuyển kho sang chi nhánh khác | **Không cho phép.** Sổ biến động, giữ chỗ, giá vốn, số chứng từ và cách ly chi nhánh đều gắn chi nhánh; đổi sẽ viết lại lịch sử. Nhu cầu thật (cửa hàng dời) xử lý bằng tạo kho mới ở chi nhánh đích và chứng từ chuyển kho (FR-INV-010) | NFR-ISO-01; FR-INV-021 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Có kho cấp công ty (kho tổng) | **Có**, theo FRD và Discovery. Mô hình: kho tổng là kho của đơn vị **trụ sở** (một chi nhánh loại `trụ sở`, FR-SYS-011), nên mọi kho vẫn thuộc đúng một chi nhánh và mọi truy vấn vẫn mang `Scope`. Chi nhánh khác nhận hàng qua chứng từ chuyển; chỉ thấy "khả dụng" của kho tổng qua phép chiếu (§10, mục P4) | FR-INV-026, BR-INV-14; BRD §10 "Kho và giá vốn"; G4-SYS-05 | Tồn tại kho tổng `[Đã có trong tài liệu]` (nguyện vọng chờ chốt tại Discovery); mô hình `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Mỗi chi nhánh tối thiểu mấy kho | Tối thiểu một kho `active` trước khi chi nhánh nhận phiếu kho hoặc lệnh có phụ tùng; đúng một kho "mặc định" mỗi chi nhánh | FR-SYS-005 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Chi nhánh bị khóa | Không tạo kho mới (FR-SYS-011); xem §5 cho các hành động còn lại | FR-SYS-011 | `[Đã có trong tài liệu]` |
| Chuyển kho giữa hai pháp nhân khác nhau | Chưa có quy tắc chứng từ | BRD §7 "Điểm cần kế toán xác nhận" | `[Cần xác nhận: Kế toán khách]` |

Thuộc tính tối thiểu: `id`, `companyId`, `branchId`, `code`, `name`, `kind` (kho tổng hoặc kho chi nhánh, tùy chọn loại như kho lốp, kho sơn), `isDefault`, `status` (`active`, `inactive`), người tạo, thời điểm, `version`. Kho **không** cần ngày hiệu lực (không phải quy tắc theo luật); lịch sử trạng thái nằm trong nhật ký.

---

## 4. Q3: người dùng nhiều chi nhánh

Giá trị tạm của dev ("gộp tất cả chi nhánh được giao") **không khớp** `ba-decisions` câu 9 và D-06. Chốt:

| Trường hợp | Hành vi | Căn cứ | Thẻ |
| --- | --- | --- | --- |
| Một chi nhánh | Vào thẳng, không có bộ chọn, chỉ hiện tên chi nhánh | D-06; `ba-decisions` câu 9 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Nhiều chi nhánh, **không** phải CH hoặc QV | **Phải chọn từng chi nhánh** (nhớ lựa chọn gần nhất); **không** có chế độ "tất cả" hợp nhất | `ba-decisions` câu 9; D-06 | như trên |
| CH, QV | Mặc định "Tất cả chi nhánh được phép" cho **xem** danh sách và báo cáo; muốn **tạo** chứng từ phải chọn đúng một chi nhánh | `ba-decisions` câu 9 | như trên |
| Phạm vi cho từng danh sách | Mỗi danh sách dùng `resolveScope(actor, permission)`: chỉ các chi nhánh mà người đó **giữ quyền đó**. Ví dụ `u_multi` (QL tại Q7, TK tại Thủ Đức) thấy danh sách người dùng chỉ ở Q7 | FR-SYS-012 | `[Đã có trong tài liệu]` |
| Chi nhánh làm việc | Hiện liên tục ở thanh trên; gắn vào mọi chứng từ tạo ra; **máy chủ** kiểm quyền hành động tại chi nhánh đó, không tin giá trị từ giao diện | D-06; NFR-ISO-01 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Ai đổi phạm vi | Chính người dùng, trong các chi nhánh mình được gán, bất kỳ lúc nào, không cần đăng nhập lại; chứng từ đang soạn phải lưu nháp trước. **Tập chi nhánh được gán** do CH, AD, và QL (cn, vai trò vận hành) đổi | D-06; FR-SYS-002 | như trên |
| Nhãn phạm vi | Luôn hiện trên banner và báo cáo (RULE-015) | RULE-015 | `[Đã có trong tài liệu]` |

Hệ quả cho dev: `assignedScope` chỉ để hiển thị chỉ báo; lọc dữ liệu luôn qua `resolveScope(actor, permission)`. Mã `Scope` hiện có phù hợp; cần thêm khái niệm "chi nhánh làm việc" (một giá trị trong `Scope` đã được kiểm) cho thao tác ghi. FR mới: FR-SYS-032.

---

## 5. Q4: chi nhánh bị khóa

FR-SYS-011 chỉ nói: "không tạo được chứng từ mới nhưng tra cứu được lịch sử". Giá trị tạm của dev (chỉ chặn tạo kho mới) **hẹp hơn FRD**. Đề xuất bám `ba-answers-06` Phụ lục A.1: **ba trạng thái**.

| Hành động | `active` | `closing` ("Ngừng nhận lệnh mới") | `locked` (khóa hoàn toàn) |
| --- | --- | --- | --- |
| Tạo lịch hẹn, báo giá, lệnh mới | Có | **Chặn** | Chặn |
| Sửa lệnh, báo giá đang mở; hoàn tất lệnh đang mở | Có | Có | Chặn (không còn lệnh mở nên đây là điều kiện vào trạng thái) |
| Thu tiền, ghi sổ quỹ, chốt ca và ngày | Có | Có (gắn lệnh đang mở) | Chặn |
| Xuất kho gắn lệnh đang mở; nhận hàng đang vận chuyển | Có | Có | Chặn |
| Phát hành hóa đơn của lệnh đang mở | Có | Có | Chặn |
| Tạo chứng từ kho mới không gắn lệnh (nhập, điều chỉnh, kiểm kê) | Có | Chặn | Chặn |
| Tạo kho mới, người dùng mới, gán vai trò cho chi nhánh | Có | Chặn | Chặn |
| Sửa dữ liệu chủ của chi nhánh (cấu hình, tên kho) | Có | Chỉ AD, CH | Chặn, trừ mở khóa |
| Đọc, tra cứu lịch sử, báo cáo, tính vào báo cáo hợp nhất | Có | Có | **Có** (FR-SYS-011) |
| Đăng nhập của người chỉ thuộc chi nhánh này | Có | Có | Có, chỉ đọc |
| Mở lại (`locked` hoặc `closing` về `active`) | | CH duyệt, AD đề xuất | CH duyệt |

Chuyển sang `locked` chỉ khi không còn lệnh mở, phiếu thu chưa chốt ca, hàng đang đi đường, hóa đơn lỗi; hệ thống liệt kê các mục chặn (`ba-answers-06` Phụ lục A.1). Cần một chốt chặn chung `assertBranchWritable(branch, kind)` ở tầng giao dịch, không rải rác từng use case.

Thẻ: bám FR-SYS-011 `[Đã có trong tài liệu]`; ba trạng thái và bảng hành vi `[Đề xuất BA – chờ xác nhận: Chủ dự án]`. **Mâu thuẫn cần xử lý**: `ba-answers-01` Câu 1 liệt kê "chi nhánh khóa" như một lý do **không đăng nhập được**, trái FR-SYS-011 (tra cứu được lịch sử). BA đề xuất FR-SYS-011 thắng: người dùng đăng nhập được và chỉ đọc; G4-SYS-03 hiện lý do "chi nhánh khóa: chỉ được xem".

---

## 6. BA-13: quy tắc số chứng từ

### 6.1 Điều đã biết và điều chưa biết

| Biết (nguồn) | Chưa biết |
| --- | --- |
| Định dạng `LOẠI-MÃCN-YYMM-STT`, STT 5 chữ số, đánh lại mỗi tháng theo chi nhánh và loại; tiền tố và độ dài là cấu hình (`ba-decisions` câu 11) | Có bắt buộc **liền số** không đứt, cho loại nào (cần Kế toán khách; BRD §7 chỉ nói Thông tư 99/2025 cho doanh nghiệp tự thiết kế chứng từ và sổ nếu thông tin trung thực) |
| Mã duy nhất trên toàn hệ thống (FR-REC-030 tiêu chí) | Dãy số theo chi nhánh hay theo pháp nhân |
| Số hóa đơn điện tử **do nhà cung cấp hoặc cơ quan thuế cấp**, không dùng mã nội bộ; hóa đơn nhà cung cấp dùng số của nhà cung cấp (`ba-decisions` câu 11, `ba-answers-04` Phụ lục B) | Kỳ đặt lại (tháng, năm, liên tục) mà Kế toán chấp nhận |
| Chứng từ ghi sổ không xóa; sửa bằng đảo hoặc điều chỉnh (RULE-010) | Phiếu đảo dùng số của dãy nào |
| Chuyển kho đánh số theo chi nhánh **gửi** (`ba-answers-04` Phụ lục B) | Có hiện giá vốn trên phiếu chuyển kho cho bên nhận không |
| Hồ sơ tiếp nhận `TX` có mã ngay khi tạo nháp (`ba-answers-02` Câu 7) | |

BA không đưa ra kết luận pháp lý về liền số.

### 6.2 Cơ chế chung (một cơ chế, cấu hình khác nhau theo loại)

1. **Bộ đếm cập nhật trong cùng giao dịch với việc tạo hoặc ghi sổ chứng từ**: nếu giao dịch hỏng, số không bị tiêu. Số đã cấp **không bao giờ cấp lại, không xóa**. Nhờ đó dãy không có "lỗ ma".
2. Khóa dãy: `(companyId, phạm vi, loại, kỳ)`; `phạm vi` mặc định là chi nhánh, cấu hình được là pháp nhân; `kỳ` mặc định `YYMM` tính từ **`businessDate` của chứng từ** (múi giờ Asia/Ho_Chi_Minh, DM-10), không từ thời điểm hệ thống.
3. Cùng `Idempotency-Key` gửi lại thì trả **cùng một số**, không cấp số thứ hai.
4. `MÃCN` (2–4 ký tự) **bất biến** sau khi chi nhánh phát hành chứng từ đầu tiên. Chuyển chi nhánh sang pháp nhân khác (FR-SYS-018) không đổi số đã cấp.
5. Độ rộng STT là cấu hình; vượt 99.999 thì tự dài thêm, không cắt.
6. Thay đổi cấu hình (tiền tố, thời điểm cấp, phạm vi, kỳ) chỉ áp dụng cho chứng từ tạo **sau ngày hiệu lực**, và chỉ bắt đầu từ ngày đầu một kỳ.
7. Có công việc kiểm tra liền số hằng đêm cho nhóm B (liệt kê lỗ nếu có) và test đồng thời: nhiều giao dịch song song trên một dãy không trùng số, không lỗ số.

### 6.3 Bảng cấu hình theo loại chứng từ

Hai nhóm:

- **Nhóm A, chứng từ vận hành**: cấp số **ngay khi tạo**; chấp nhận lỗ số khi bản nháp bị bỏ (`gapPolicy = relaxed`); chứng từ đã hủy **giữ số** và trạng thái "Đã hủy", không tái sử dụng. Bản nháp đã có số không xóa cứng mà chuyển "Đã hủy".
- **Nhóm B, chứng từ kế toán, quỹ, kho**: cấp số **khi ghi sổ** (`assignAt = post`), `gapPolicy = strict` (không lỗ số; đây là mặc định an toàn chờ Kế toán xác nhận). Bản nháp và chứng từ chờ duyệt có **mã tạm** (`draftRef`) không phải số chính thức, in ra phải ghi "Nháp"; nháp bị hủy hoặc từ chối **không để lại lỗ số** vì chưa có số. Chứng từ đã ghi sổ không xóa; hủy hoặc sửa bằng phiếu đảo có số riêng (RULE-010).

| Loại | Tiền tố | Nhóm | Cấp số khi | Lỗ số | Nháp bị hủy | Dãy theo | Nguồn | Kế toán xác nhận |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lệnh sửa chữa | RO | A | Tạo (= lúc khách duyệt, lệnh không có nháp, WF-01) | Không phát sinh do thiết kế | Không có nháp; lệnh hủy giữ số, "Đã hủy" | CN × tháng | `ba-decisions` 11; FR-REC-030 | Không |
| Báo giá (phiên bản `-vN`) | BG | A | Tạo bản nháp đầu tiên; `-vN` là hậu tố phiên bản, không tiêu số mới | Chấp nhận | Giữ số, "Đã hủy" hoặc "Hết hạn" | CN × tháng | `ba-decisions` 11 | Không |
| Báo giá bổ sung | BG (+ liên kết gốc) | A | Tạo | Chấp nhận | như trên | CN × tháng | `ba-answers-02` Câu 7 | Không |
| Hồ sơ tiếp nhận | TX | A | Tạo nháp | Chấp nhận | Giữ số | CN × tháng | `ba-answers-02` Câu 7 | Không |
| Lịch hẹn | LH | A | Tạo | Chấp nhận | Giữ số ("Không đến", "Đã hủy") | CN × tháng | như trên | Không |
| Yêu cầu chủ dữ liệu | CD | A | Tạo | Chấp nhận (nhưng không xóa, có thời hạn xử lý) | Giữ số | CN × tháng | như trên; FR-CRM-011 | Luật sư khách (hồ sơ) |
| Biên bản giao xe | BB | A | Tạo | Chấp nhận | Giữ số; sửa bằng biên bản điều chỉnh (BB mới) | CN × tháng | `ba-answers-03` Câu 9 | Không |
| Yêu cầu mua, đơn mua (`-vN`) | YM, DM | A | Tạo | Chấp nhận | Giữ số | CN × tháng | `ba-decisions` 11; `ba-answers-04` PB | Không |
| Yêu cầu chuyển kho, yêu cầu cấp phụ tùng | YK, CP | A | Tạo | Chấp nhận | Giữ số | CN × tháng (YK theo chi nhánh nhận lập) | `ba-answers-04` PB | Không |
| Đợt kiểm kê | KK | A | Tạo | Chấp nhận | Giữ số | CN × tháng | `ba-decisions` 11 | Không |
| Đề xuất chi, yêu cầu phê duyệt, yêu cầu phát hành hóa đơn | DX, YC, YH | A | Tạo | Chấp nhận; khóa chống trùng hóa đơn (FR-EIN-013) là khóa kỹ thuật riêng, **không** là số chứng từ | Giữ số | CN × tháng | `ba-answers-05` Câu 16 | Không |
| Phiếu thu | PT | B | Ghi sổ (thu tiền xong) | **Không lỗ** (đề xuất) | Không có số | CN × tháng (hoặc pháp nhân) | `ba-decisions` 11; RULE-010 | **Có** |
| Phiếu chi, phiếu nạp/chuyển quỹ | PC, CQ | B | Ghi sổ | Không lỗ | Không có số | như trên | `ba-decisions` 11; `ba-answers-05` | **Có** |
| Phiếu nhập kho (kể cả nhập từ đơn mua) | PN | B | Ghi sổ | Không lỗ | Không có số | CN × tháng | `ba-answers-04` PB | **Có** |
| Phiếu xuất kho, xuất dùng nội bộ | PX, XN | B | Ghi sổ | Không lỗ | Không có số | CN × tháng | như trên | **Có** |
| Phiếu chuyển kho | CK | B | **Khi gửi hàng** (ghi sổ xuất của bên gửi); mã tạm khi nháp và chờ duyệt | Không lỗ | Không có số | CN **gửi** × tháng | `ba-answers-04` PB | **Có** (và hiện giá vốn cho bên nhận không) |
| Phiếu điều chỉnh tồn | DC | B | Ghi sổ sau duyệt | Không lỗ | Bị từ chối: không có số | CN × tháng | như trên | **Có** |
| Phiếu hoàn kho (khách trả, hoàn theo lệnh) | HK | B | Ghi sổ; mỗi lần hoàn một số riêng | Không lỗ | Không có số | CN × tháng | `ba-answers-04` PB | **Có** |
| Phiếu trả hàng nhà cung cấp | TR | B | Ghi sổ | Không lỗ | Không có số | CN × tháng | như trên | **Có** |
| Phiếu bán lẻ | BL | B | Ghi sổ (thanh toán xong) | Không lỗ | Không có số | CN × tháng | `ba-decisions` 11 | **Có** |
| Phiếu đảo của PT, PC, PN, PX, ... | Cùng tiền tố, có liên kết `reversalOf` và nhãn "Phiếu đảo" | B | Ghi sổ | Không lỗ | | Cùng dãy với loại gốc | RULE-010 | **Có** (đảo dùng dãy gốc hay dãy riêng) |
| Hóa đơn điện tử | Không dùng mã nội bộ | n/a | Do nhà cung cấp hoặc cơ quan thuế cấp | n/a | n/a | n/a | `ba-decisions` 11; BRD §7 | Kế toán / nhà cung cấp |
| Hóa đơn nhà cung cấp phụ tùng | Số của nhà cung cấp | n/a | Nhập tay | n/a | | n/a | `ba-answers-04` PB | Không |
| Mã phụ tùng, kỳ công | Không thuộc dãy này | n/a | | | | | `ba-answers-04` PB (mã phụ tùng do Khách quy ước; `PT-0001` chỉ là mẫu) | Không |

**Thẻ chung cho bảng**: định dạng `LOẠI-MÃCN-YYMM-STT` và các tiền tố chỉ mới nằm ở `docs/ui-ux/ba-*.md` (đề xuất BA, chưa vào FRD, xem §14); FR-REC-030 `[Đã có trong tài liệu]` chỉ nói "duy nhất theo chi nhánh và thời gian". Phân nhóm A/B, thời điểm cấp số, `strict` cho nhóm B: `[Đề xuất BA – chờ xác nhận: Kế toán khách]`. Mặc định nhóm B là **không lỗ số** vì rẻ để làm đúng; nếu Kế toán nói không cần thì đổi sang `relaxed` bằng cấu hình.

**Tác động giao diện (gửi designer qua orchestrator)**: nhóm B hiện "Nháp" kèm mã tạm, không hiện số chính thức trước khi ghi sổ; prototype hiện mã đầy đủ ở nháp (ví dụ phiếu kho "Nháp" và "Chờ duyệt") cần đổi. Xem §14.

### 6.4 Câu hỏi gửi Kế toán khách (BA-13)

| # | Câu hỏi | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- |
| K1 | Loại chứng từ nào phải **liền số** (không đứt)? | (a) Nhóm B như bảng; (b) chỉ PT, PC; (c) tất cả kể cả nhóm A; (d) không cần loại nào | (a), cấu hình `strict` | (c) buộc cấp số lúc ghi sổ cho cả nhóm A, đổi giao diện nhiều màn; (d) chỉ đổi cờ `gapPolicy` |
| K2 | Dãy số theo **chi nhánh** (hiện tại) hay theo **pháp nhân**? | chi nhánh; pháp nhân | Chi nhánh khi một pháp nhân, mỗi chi nhánh một dãy; hỏi lại khi có pháp nhân thứ hai | Đổi sang pháp nhân: nhiều chi nhánh tranh một bộ đếm (cần thiết kế chống tranh chấp) |
| K3 | **Kỳ đặt lại**: theo tháng (hiện tại), năm, hay liên tục? | tháng; năm; liên tục | Tháng (đã dùng trong mã mẫu) | Chỉ đổi cấu hình khóa dãy |
| K4 | Phiếu đảo dùng **dãy của loại gốc** hay dãy riêng? | cùng dãy; dãy riêng | Cùng dãy, nhãn "Phiếu đảo" | Dãy riêng thêm tiền tố |
| K5 | Bản nháp chưa ghi sổ có được mang **số** không? | không (mã tạm); có | Không | Có: lỗ số khi hủy nháp, phải giữ chứng từ "Đã hủy" |
| K6 | Phiếu chuyển kho có hiện **giá vốn** cho chi nhánh nhận? | có; không | Không hiện (bên nhận thấy số lượng, giá trị chỉ dùng cho duyệt) | Ảnh hưởng chiếu xuyên chi nhánh §10 |
| K7 | Chứng từ ghi sổ ngày cuối tháng nhưng nhập sau nửa đêm: số lấy kỳ **theo ngày chứng từ** hay ngày ghi? | theo `businessDate`; theo ngày ghi | Theo `businessDate` | Thứ tự số có thể không theo thời gian liên tục qua ranh giới tháng |
| K8 | Phiếu thu tiền mặt và chuyển khoản có chung dãy PT không? | chung; tách | Chung | Tách: thêm tiền tố |

---

## 7. Q8: che số điện thoại và địa chỉ, "Hiện", nhật ký truy cập

### 7.1 Chính sách che theo vai trò (khách hàng)

Mức: **Đầy** = hiện đủ; **Hiện** = che, có nút Hiện; **Hiện+LD** = Hiện và bắt buộc chọn lý do; **Che** = chỉ bản che, không nút Hiện; **Ẩn** = không hiển thị. Định dạng che: SĐT `09•• ••• 123` (2 số đầu, 3 số cuối); email `a•••@gmail.com`; địa chỉ chỉ giữ quận/huyện, tỉnh/thành (`ba-decisions` câu 8).

| Vai trò | SĐT | Email | Địa chỉ cá nhân | Tên, MST, địa chỉ xuất hóa đơn của khách doanh nghiệp |
| --- | --- | --- | --- | --- |
| CV, QL, TN, QĐ (khách **có quan hệ với chi nhánh mình**, xem §10) | Đầy | Đầy | Đầy | Đầy |
| CH, QV | Hiện (không lý do) | Hiện | Hiện (không lý do) | Đầy |
| KT | Hiện+LD | Hiện+LD | Hiện+LD | Đầy (cần cho hóa đơn, `ba-decisions` câu 10) |
| TK | Che | Che | Ẩn | Tên khách trên chứng từ kho |
| TH | Ẩn | Ẩn | Ẩn | Chỉ tên rút gọn và biển số của việc mình |
| AD, MH, NS | Ẩn (không truy cập dữ liệu khách) | Ẩn | Ẩn | Ẩn |

Dữ liệu nhân sự: bảng riêng, đã có ở `ba-answers-04` Phụ lục D; dùng cùng cơ chế `PiiPolicy`.

Áp dụng ở **mọi nơi dữ liệu thoát ra**: danh sách, chi tiết, tìm kiếm, báo cáo, xuất, mẫu in (SĐT đầy đủ chỉ in khi người in có quyền, `ba-decisions` câu 12), thông báo (nội dung email/Zalo nội bộ không chứa SĐT, địa chỉ, tên khách; `ba-answers-01`), thông báo lỗi, tệp nhật ký (chỉ mã). Giá trị đầy đủ **không có trong phản hồi** trước khi Hiện (FR-SYS-025 đề xuất).

Bảng này là **cấu hình** (`pii-policy`, G4-SYS-04), không viết cứng. Thẻ: `[Đề xuất BA – chờ xác nhận: Khách, Luật sư khách]` (nguồn `ba-decisions` câu 8, Câu 10; NFR-SEC-03 chỉ nói "theo ma trận quyền"). Câu hỏi đặc biệt cho Luật sư khách: QĐ và TN có cần SĐT/địa chỉ đầy đủ hay che là đủ (nguyên tắc tối thiểu theo Luật BVDLCN 2025)? Mức che 2 số đầu + 3 số cuối có đủ không?

### 7.2 Hành động "Hiện"

| Yêu cầu | Quy tắc | Thẻ |
| --- | --- | --- |
| Ai được bấm | CH, QV (không lý do); KT (bắt buộc lý do). Người khác không có nút | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Lý do (KT) | Chọn một: đối chiếu hóa đơn, thu nợ, khác (bắt buộc ghi chú tối thiểu 5 ký tự) | như trên |
| Phản hồi | Chỉ trả giá trị cho người yêu cầu; không lưu cache (`Cache-Control: no-store`) | `[Đề xuất BA]` |
| Tự che lại | Sau 30 giây hoặc khi rời trang. Đây là hành vi giao diện, **không phải biện pháp bảo mật** (giá trị đã đến trình duyệt) | `ba-decisions` câu 8 |
| Cảnh báo bất thường | Số lần Hiện vượt ngưỡng theo người và giờ thì báo CH; ngưỡng là tham số | `[Cần xác nhận: Khách]` (số) |
| Từ chối | Hiện thiếu lý do hoặc không có quyền: trả lỗi RFC 9457, **vẫn ghi** sự kiện bị từ chối | `[Đề xuất BA]` |

### 7.3 Nhật ký truy cập dữ liệu cá nhân (`accessLogs`)

Nhật ký riêng, chỉ ghi thêm, **không chứa giá trị cá nhân** (DM-8, `pii.ts`). Trường tối thiểu, và phần cần bổ sung vào `PiiAccessEntry` hiện có:

| Trường | Ghi chú | Có trong `PiiAccessEntry`? |
| --- | --- | --- |
| `at` (giờ máy chủ), `requestId` | | Có |
| `actorId`, `companyId`, `branchId` của bản ghi | | Có |
| `roleCode` và chi nhánh mà **quyền được cấp** | Để biết vai trò nào đã dùng | **Chưa** |
| `entityType`, `entityId` | Khách, xe, nhân sự | Có |
| `field` (hoặc danh sách trường) | phone, address, email, ... | Có (một trường) |
| `purpose` / `action` | `open_record`, `reveal`, `export`, `search_by_phone`, `denied` | Có (`reveal`, `export`); **thiếu** các giá trị còn lại |
| `reasonCode`, `reasonText` | Bắt buộc với KT | **Chưa** |
| `result` | `allowed` hoặc `denied` | **Chưa** |
| `sessionId` hoặc `deviceId` | | **Chưa** |
| `rowCount`, `columns`, `filters` (khi xuất) | Số dòng, có cột cá nhân không | **Chưa** |
| Địa chỉ IP | Có thể là dữ liệu cá nhân; ghi nhật ký đăng nhập theo FR-SYS-014, còn nhật ký truy cập: `[Cần xác nhận: Luật sư khách]` | **Chưa** |

Sự kiện phải ghi: (1) mở hồ sơ khách đầy đủ bởi vai trò mức Đầy (một lần mỗi lần mở hồ sơ, **không ghi từng dòng danh sách**, `ba-decisions` câu 8); (2) mỗi lần Hiện; (3) mỗi lần xuất có cột cá nhân; (4) mỗi lần tìm theo SĐT bởi CH, QV, KT (`ba-answers-01` Câu 12); (5) sự kiện bị từ chối. Thẻ: `[Đề xuất BA – chờ xác nhận: Luật sư khách]`.

---

## 8. Q9: thời hạn lưu và ai xem nhật ký

### 8.1 Khung thời hạn lưu

Theo `ba-answers-06` Câu 13: **không đặt số năm mặc định cho dữ liệu chịu ràng buộc luật**; ô để trống tới khi Kế toán hoặc Luật sư nhập và CH duyệt. Mỗi dòng cấu hình: loại dữ liệu, `retainFor` (rỗng = giữ vô thời hạn, không tự xóa), hành động sau hạn, căn cứ, người xác nhận, ngày hiệu lực. Khi chưa có giá trị: **không có tác vụ nào xóa hay ẩn danh**.

| Loại dữ liệu | Giá trị khởi điểm để dev cấu hình | Hành động sau hạn | Ai xác nhận | Thẻ |
| --- | --- | --- | --- | --- |
| Chứng từ kế toán, hóa đơn (XML/PDF) | Chưa đặt; **không xóa, không ẩn danh trong thời hạn luật** | Khóa, theo Kế toán | Kế toán khách | `[Cần xác nhận: Kế toán khách]` (NFR-DAT-01) |
| Nhật ký thao tác (`auditLogs`) | Chưa đặt; đề xuất không thấp hơn thời hạn chứng từ liên quan | Lưu trữ lạnh | Kế toán khách, Luật sư khách | `[Cần xác nhận: Kế toán khách, Luật sư khách]` |
| Nhật ký truy cập dữ liệu cá nhân (`accessLogs`) | Chưa đặt | Lưu trữ lạnh | Luật sư khách | `[Cần xác nhận: Luật sư khách]` |
| Lịch sử đăng nhập (FR-SYS-014) | Chưa đặt | | Luật sư khách | `[Cần xác nhận: Luật sư khách]` |
| Hồ sơ khách, xe | Chưa đặt | Ẩn danh dữ liệu cá nhân; **loại trừ** khách còn công nợ, bảo hành, lệnh mở | Luật sư khách | `[Cần xác nhận: Luật sư khách]` (FR-CRM-011) |
| Dữ liệu nhân viên đã nghỉ | Chưa đặt | Ẩn danh CCCD, SĐT, địa chỉ, tài khoản ngân hàng; giữ mã nhân viên để nhật ký truy vết (BRD §7 nêu nghĩa vụ xóa từ 1/1/2026, cần luật sư xác nhận phạm vi và thời hạn) | Luật sư khách | `[Cần xác nhận: Luật sư khách]` (FR-HRM-012) |
| Ảnh, tệp đính kèm lệnh | Chưa đặt | Lưu trữ lạnh hoặc xóa | Luật sư, Khách | `[Cần xác nhận: Khách]` |
| Thông báo trong hệ thống | Ẩn khỏi chuông sau 30 ngày; lưu trong trang 12 tháng rồi xóa | Xóa | Khách | `[Đề xuất BA – chờ xác nhận: Khách]` (`ba-decisions` câu 15) |
| Khóa chống trùng HTTP (`Idempotency-Key`) | **24 giờ** (giữ giá trị tạm; `IDEMPOTENCY_TTL_HOURS`) | Xóa | Dev | `[Đề xuất BA]`, tham số kỹ thuật |
| Khóa chống trùng **nghiệp vụ** của yêu cầu phát hành hóa đơn (FR-EIN-013, DM-9) | **Không hết hạn** trong thời gian bản ghi `invoiceRequests` còn tồn tại | | Kế toán khách | `[Đã có trong tài liệu]` (FR-EIN-013) |

**Lưu ý quan trọng**: khóa chống trùng HTTP 24 giờ (bộ nhớ đệm phản hồi) **khác** ràng buộc duy nhất nghiệp vụ của hóa đơn. Hết 24 giờ mà một yêu cầu cũ gửi lại vẫn không được tạo hóa đơn thứ hai. Dev cần tách hai cơ chế.

### 8.2 Ai xem nhật ký

Màn chỉ đọc (G4-SYS-19): AD, CH, QL (cn), KT (phần liên quan tiền và hóa đơn). AD thấy giá trị khách đã che. Nhật ký truy cập dữ liệu cá nhân: CH và AD, chỉ mã bản ghi. Không ai sửa hay xóa. `[Đã có trong tài liệu]` cho màn và vai trò (G4-SYS-19, FR-SYS-003); `[Cần xác nhận: Luật sư khách]` cho việc AD có được xem nhật ký truy cập.

### 8.3 Xung đột nhật ký bất biến và ẩn danh (BA-10)

FR-SYS-003 đòi ghi "giá trị trước và sau" và không xóa được, nhưng giá trị có thể là họ tên, SĐT. Đề xuất để dev cài ngay theo DM-8: **với trường dữ liệu cá nhân, nhật ký chỉ ghi tên trường và dấu "đã đổi", không ghi giá trị**; bản ghi cá nhân nằm ở nơi riêng có thể ẩn danh. `[Đề xuất BA – chờ xác nhận: Luật sư khách]`.

---

## 9. Q10: xuất danh sách

| Câu hỏi | Quy tắc | Nguồn | Thẻ |
| --- | --- | --- | --- |
| Giới hạn số dòng | **5.000 dòng** mỗi lần xuất đồng bộ (giữ giá trị tạm, tham số theo loại xuất). Vượt: từ chối kèm hướng dẫn thu hẹp bộ lọc. Xuất bất đồng bộ cho lượng lớn để slice sau | Giá trị tạm; `ba-answers-06` Câu 11 (giới hạn 20 MB và 50.000 dòng/lô là của **nhập**, không áp cho xuất) | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| Giới hạn riêng khi có cột cá nhân đầy đủ | Thấp hơn; giá trị khởi điểm đề xuất 1.000 dòng, tham số | BA | `[Cần xác nhận: Khách]` (số) |
| Cần lý do | Xuất không có cột cá nhân: **không**. Xuất cột cá nhân đầy đủ: **bắt buộc lý do** | `ba-answers-06` Câu 3 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Cần nhập lại mật khẩu | Có khi chọn cột cá nhân đầy đủ, và khi xuất danh sách khách | D-02; `ba-answers-06` Câu 3 | như trên |
| Cần duyệt | **Không** ở slice 1.x (lý do + mật khẩu + nhật ký thay cho duyệt). Nếu Khách muốn hai người, chỉ cần thêm bước `approve` | FR-SYS-013 | `[Cần xác nhận: Khách]` |
| Ai được xuất | Báo cáo (cột cá nhân đã che): CH, QV, QL, KT. Cột cá nhân đầy đủ: CH, KT (có lý do và mật khẩu). QV, QL: không mặc định. CV, QĐ, TK, TN, TH: không. AD: **chỉ nhật ký thao tác và nhật ký tích hợp** | `ba-answers-06` Câu 3; NFR-EXP-01; FR-CRM-017 | `[Đề xuất BA – chờ xác nhận: Khách]` |
| Cột được phép | Chỉ cột mà vai trò được **xem** ở màn nguồn; cột cá nhân mặc định đã che; **không bao giờ**: băm mật khẩu, mã khôi phục MFA, bí mật tích hợp, giá vốn với vai trò không thấy giá vốn (`ba-answers-04`: xuất theo cùng quyền) | NFR-SEC-03 | `[Đề xuất BA]` |
| Phạm vi | Luôn trong `Scope` của người xuất (NFR-ISO-01); không có đường vòng bằng API | NFR-ISO-01 | `[Đã có trong tài liệu]` |
| Nhật ký mỗi lần xuất | Ai, vai trò dùng, phạm vi chi nhánh, bộ lọc, kỳ, số dòng, có/không cột cá nhân, cột nào, lý do, định dạng, mã yêu cầu. Giá trị không vào nhật ký | FR-CRM-017; `ba-answers-06` Câu 3 | `[Đã có trong tài liệu]` (FR-CRM-017) |
| An toàn tệp | Ô bắt đầu bằng `=`, `+`, `-`, `@` phải được vô hiệu hóa trong tệp bảng tính (chống chèn công thức) | NFR-SEC-02 | `[Đề xuất BA]` |

---

## 10. Q11: ranh giới xuyên chi nhánh (BA-05)

### 10.1 Nguyên tắc để giải mâu thuẫn với NFR-ISO-01

NFR-ISO-01 nói dữ liệu chi nhánh tách theo phạm vi quyền ở danh sách, tìm kiếm, báo cáo, xuất và API; UAT-06 chỉ kiểm danh sách, tìm kiếm, báo cáo; `ba-answers-01` Câu 12 viết "không bao giờ có dữ liệu chi nhánh khác". Nhưng FR-CRM-004, FR-CRM-002 (biển số duy nhất trong hệ thống), FR-REC-006, FR-REC-036, FR-INV-014, FR-INV-031 cần nhìn xuyên chi nhánh. Đề xuất giải rõ như sau:

1. **Bản ghi nguồn cấp chi nhánh** (lệnh, báo giá, thanh toán, phiếu kho, tồn, ca, quỹ) **không bao giờ** truy xuất được từ chi nhánh khác (trả 404 theo ADR §6.3), dù biết mã.
2. **Thực thể cấp công ty** (khách, xe, quan hệ sở hữu, danh mục phụ tùng, bảng giá, danh mục dịch vụ, đồng ý của khách) là một bản ghi dùng chung; ngoài "quan hệ" với chi nhánh, người dùng chỉ thấy **phép chiếu** (danh sách trường được phép, bảng dưới).
3. **Phép chiếu là bản đọc riêng** có danh sách trường trắng, cấu hình trong `crossBranchProjection`, do máy chủ dựng; không phải bản ghi nguồn đã bị lược cột bằng giao diện.
4. Tra cứu xuyên chi nhánh chỉ bằng **khớp chính xác** (biển số hoặc SĐT đầy đủ), tối đa vài kết quả, **không duyệt danh sách** và không xuất. Điều này sửa câu "không bao giờ" của `ba-answers-01` Câu 12 thành "không bao giờ có **bản ghi nguồn** của chi nhánh khác".
5. **"Quan hệ với chi nhánh"**: khách có quan hệ với chi nhánh X khi có (hoặc từng có) lịch hẹn, báo giá, lệnh, hoặc được tạo tại X. Chỉ khi có quan hệ thì vai trò mức Đầy (CV, QL, TN, QĐ) thấy SĐT/địa chỉ đầy đủ; chưa có quan hệ chỉ thấy bản che, đến khi tiếp nhận tạo quan hệ. `[Đề xuất BA – chờ xác nhận: Chủ dự án, Luật sư khách]`.

### 10.2 Bảng chiếu: thực thể × cấp sở hữu × trường thấy ngoài phạm vi

| # | Thực thể | Cấp sở hữu | Ai thấy ngoài chi nhánh sở hữu | Trường **được** thấy | Trường **không** thấy | Căn cứ | Thẻ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Khách** (tra khi tiếp nhận) | Công ty | CV, QL, TN (chi nhánh khác khớp chính xác biển số hoặc SĐT đầy đủ) | Mã khách, tên (khách doanh nghiệp: tên pháp nhân), loại khách, danh sách xe (biển số, hãng, dòng, năm), trạng thái đồng ý liên hệ (có/không theo kênh), chi nhánh quen | SĐT/email/địa chỉ đầy đủ (che theo §7), ghi chú, nhãn, công nợ, tên người liên hệ | FR-CRM-001, 002, 004; `ba-decisions` câu 8 | `[Cần xác nhận: Chủ dự án]` |
| P2 | **Xe** (hồ sơ) | Công ty | Như P1; QĐ khi chẩn đoán | Biển số chuẩn hóa, số khung (che một phần), số máy (che một phần), hãng, dòng, năm sản xuất, loại hình kinh doanh vận tải, km gần nhất, chủ hiện tại (như P1) | Ảnh gắn lệnh, ghi chú nội bộ | FR-CRM-002, 005, 014 | như trên |
| P3 | **Lịch sử sửa chữa của xe** | Chi nhánh (từng lệnh); **phép chiếu cấp xe** | CV, QL, QĐ khi tiếp nhận hoặc tra xe; không TH | Ngày, **tên chi nhánh**, tên hạng mục, tên phụ tùng và số lượng, số km, **giá** (theo FR-CRM-004), mã lệnh gốc (chỉ hiển thị) | Thanh toán và công nợ, giảm giá cụ thể, giá vốn, tên thợ và công, ghi chú nội bộ, ảnh và video lệnh, SĐT khách tại thời điểm đó, nội dung lệnh chi tiết (không mở được lệnh) | FR-CRM-004 tiêu chí nghiệm thu; NFR-ISO-01 | `[Cần xác nhận: Chủ dự án]` (giá có hiện không) |
| P4 | **Bảo hành** | Chi nhánh (hạng mục lệnh); chính sách bảo hành cấp công ty | CV, QL (chi nhánh tiếp nhận); QL chi nhánh gốc nhận thông báo | Mô tả hạng mục bảo hành, ngày bắt đầu, hạn (thời gian, km, "đến trước"), trạng thái (Còn hạn, Sắp hết, Hết hạn, Vô hiệu), chi nhánh gốc, mã lệnh gốc, điều kiện bảo hành, chi nhánh chịu chi phí (cấu hình) | Thanh toán, giá vốn, lợi nhuận | FR-REC-036, UAT-24, `proposed-doc-changes` FR-REC-038 | `[Cần xác nhận: Chủ dự án, Khách]` (chính sách bảo hành chéo chưa chốt, BRD §10 câu 14) |
| P5 | **Khả dụng phụ tùng** | Chi nhánh/kho | TK, QL, MH, CV (qua bộ chọn trong báo giá); cùng công ty hoặc nhóm, cờ `xem_khả_dụng_liên_chi_nhánh` mặc định bật | Phụ tùng, tên chi nhánh/kho, **tồn khả dụng** và "số có thể cho" | Tồn thực tế, giữ chỗ, đang vận chuyển, giá vốn, giá trị tồn | FR-REC-006, FR-INV-014, FR-INV-031 (đề xuất), `ba-answers-04` BS-1 | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` |
| P6 | **Chứng từ hai bên** (phiếu chuyển kho CK, yêu cầu chuyển YK) | Chi nhánh gửi sở hữu; chi nhánh nhận là **bên liên quan** | QL, TK của cả hai chi nhánh | Danh mục hàng, số lượng, trạng thái, người lập và duyệt của chính chi nhánh mình; biên bản chênh lệch | Giá vốn của bên gửi (nếu chưa chốt K6), tồn của bên kia | FR-INV-010; `ba-answers-04` PB | `[Cần xác nhận: Kế toán khách]` |
| P7 | **Danh mục phụ tùng, bảng giá, danh mục dịch vụ** | Công ty | Mọi vai trò có `view` | Toàn bộ trường giá bán; giá vốn theo nhóm CH, QV, QL, KT | Giá mua chỉ nhóm CH, QV, QL, KT, TK, MH | FR-INV-001, 002; `ba-answers-04` | `[Đã có trong tài liệu]` |
| P8 | **Hợp nhất khách trùng ngoài phạm vi** | Công ty | QL (đề nghị), QV, CH (hợp nhất) | Tên, SĐT che, biển số, chi nhánh gốc: **tối thiểu để so khớp** | Mọi trường khác | FR-CRM-003; `ba-answers-02` Câu 4 | `[Đề xuất BA]` |
| P9 | **Công nợ khách doanh nghiệp** | Công ty (hạn mức) / chi nhánh (phát sinh) | Khi tiếp nhận ở chi nhánh khác | Chỉ cờ "vượt hạn mức nợ toàn chuỗi" (đúng/sai); **không** số dư | Số dư, chi tiết hóa đơn | FR-ACC-020, FR-CRM-018 | `[Cần xác nhận: Kế toán khách]` |
| P10 | **Báo cáo hợp nhất** | CH, QV | Theo `Scope` của người xem; QL chỉ chi nhánh mình | Theo FR-RPT | | RULE-015 | `[Đã có trong tài liệu]` |
| P11 | **Nhân sự** (cấp công ty, gán chi nhánh) | Công ty | NS, QL (chi nhánh được gán) | Theo `ba-answers-04` Phụ lục D | | FR-HRM | TBD slice sau |

### 10.3 Mâu thuẫn giải quyết rõ

| Mâu thuẫn | Giải quyết |
| --- | --- |
| NFR-ISO-01 (tách hoàn toàn) và FR-CRM-004 (lịch sử xe mọi chi nhánh) | FR-CRM-004 là ngoại lệ **duy nhất, có giới hạn** bởi phép chiếu P3; sửa NFR-ISO-01 thành "dữ liệu **nguồn** cấp chi nhánh tách hoàn toàn; chiếu xuyên chi nhánh chỉ qua danh sách trường ở FR-SYS-030" |
| `ba-answers-01` Câu 12 "không bao giờ có dữ liệu chi nhánh khác" và tiếp nhận xe lạ | Thêm tra cứu khớp chính xác P1 và P2; sửa câu thành "không có bản ghi nguồn của chi nhánh khác" |
| FR-CRM-002 "biển số duy nhất trong hệ thống" và cách ly | Kiểm trùng chạy trên toàn công ty; khi trùng thì dẫn tới P2 (xe dùng chung), không báo lỗi lộ chi nhánh nào đang giữ |
| FR-REC-006/FR-INV-014/FR-INV-031 | Chỉ P5, không lộ tồn thực tế và giữ chỗ |
| FR-REC-036 (bảo hành chéo) | Chỉ P4; lệnh bảo hành ở chi nhánh B mang liên kết tới lệnh gốc, không mở được lệnh gốc |
| UAT-06 chỉ kiểm danh sách, tìm kiếm, báo cáo | Mở rộng sang xuất, API, tải tệp (liên kết ký), tìm kiếm toàn cục, liên kết khách; thêm kiểm tra **danh sách trường trắng** của từng phép chiếu |
| Ảnh, video lệnh ở chi nhánh khác (liên kết đọc có chữ ký, ADR §2.1 A1) | Chỉ cấp liên kết khi tệp thuộc phạm vi hoặc thuộc phép chiếu cho phép (ảnh hồ sơ xe cấp công ty); ảnh gắn lệnh chi nhánh khác **không** cấp |

Slice 1.1–1.2 chưa có khách, xe, lệnh nên chưa cài phép chiếu; nhưng **quyết định cấp sở hữu khách, xe ở cấp công ty phải chốt trước slice 1.3** (`review-docs-and-design` DM-2).

---

## 11. Q12: kích thước trang

| Hạng mục | Mặc định | Tối đa | Ghi chú | Thẻ |
| --- | --- | --- | --- | --- |
| Danh sách chuẩn (con trỏ) | **25** | **100** | Giữ giá trị `implementation-plan` §2.3; phù hợp NFR-PERF-01 (dưới 2 giây ở 4G). Mobile dùng cùng số nhưng kiểu "tải thêm" | `[Đề xuất BA – chờ xác nhận: Chủ dự án]` (NFR-PERF-01 không nêu số) |
| Tìm kiếm toàn cục | 50 kết quả đầu | 50 | Tối thiểu 3 ký tự, không ký tự đại diện | `[Đề xuất BA]` (`ba-answers-01` Câu 12) |
| Nhật ký thao tác, nhật ký truy cập | 25 | 100 | Cùng cơ chế con trỏ | `[Đề xuất BA]` |
| Bảng đi sâu từ báo cáo (FR-RPT-011) | 25 | 100 | Tổng hợp chạy theo khoảng ngày giới hạn (NFR-PERF-02) | `[Đề xuất BA]` |
| Bảng điều phối, bảng thợ (không phân trang) | Tải mọi lệnh đang mở của chi nhánh | Giới hạn 200 thẻ, vượt thì buộc lọc | Số 200 là khởi điểm, đo lại; 25 đến 40 xe vào mỗi chi nhánh mỗi ngày theo NFR-SCL-01 | `[Cần xác nhận: Chủ dự án]` (số) |
| Tổng số bản ghi | Không đếm mặc định; đếm khi có yêu cầu | | Giao diện hiện "25+" hoặc nút "Đếm"; cần báo designer (đang giả định "1–25 trên N") | `[Đề xuất BA]` |
| Xuất | Xem §9 | | | |

---

## 12. Câu hỏi gửi Chủ dự án, Khách, Kế toán, Luật sư

| # | Gửi | Câu hỏi | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- | --- |
| 1 | Chủ dự án, Khách | Vai trò bắt buộc MFA | CH, QV, QL, KT, AD (đề xuất); thêm TN, TK; bỏ KT | Như đề xuất, chỉ KT cần Khách nói rõ | Đổi cờ vai trò; không đổi mã |
| 2 | Chủ dự án | Có chạy pilot thật khi MFA do chủ dự án chưa cung cấp | Không; có kèm ký chấp nhận rủi ro | Không với CH, KT, AD | Trì hoãn go-live hoặc rủi ro chiếm tài khoản quản lý |
| 3 | Chủ dự án, Khách | Chấp nhận rủi ro dư của tablet dùng chung + PIN, và bộ quyền phiên PIN (§1.2) | Chấp nhận; không (mỗi thợ đăng nhập đầy đủ); quét thẻ | Chấp nhận có điều kiện C1–C8 | Không chấp nhận: vi phạm NFR-USA-01 (2 chạm) hoặc phải mua thiết bị |
| 4 | Chủ dự án | Ai lập **bảng giá bán chuẩn** (FRD §2 ghi TK = S) | KT; AD/quản trị trụ sở; TK; QV | KT và AD lập, CH duyệt; TK không sửa giá bán | Nếu TK: thủ kho kiêm quyết giá, tách nhiệm vụ yếu |
| 5 | Chủ dự án | Có tách vai trò "Quản trị trụ sở" khỏi AD; mã MH, NS; bỏ QC | Có; không | Chưa tách ở pilot, dùng AD | Thêm vai trò, sửa ma trận |
| 6 | Chủ dự án | Phạm vi chiếu xuyên chi nhánh (§10), gồm giá trong lịch sử xe | P1 đến P5 như bảng; thu hẹp | Như bảng | Thu hẹp: khó chẩn đoán xe đã sửa ở chi nhánh khác; mở rộng: lộ doanh thu chi nhánh |
| 7 | Luật sư khách | Mức che SĐT/địa chỉ có đủ; QĐ, TN thấy đầy đủ có chấp nhận; "quan hệ với chi nhánh" làm điều kiện thấy đầy đủ | Như §7.1; che thêm QĐ, TN | Như §7.1, kèm quan hệ chi nhánh | Che thêm: thêm thao tác Hiện cho quầy đông xe |
| 8 | Luật sư khách | Thời hạn lưu: nhật ký thao tác, nhật ký truy cập, lịch sử đăng nhập; địa chỉ IP trong nhật ký truy cập; ngoại lệ giữ dữ liệu khi khách rút đồng ý nhưng còn bảo hành, công nợ | Khung §8.1 | Không đặt số tới khi có trả lời | Đặt số sai: mất dữ liệu bắt buộc hoặc giữ quá hạn |
| 9 | Luật sư khách | Nhật ký FR-SYS-003 ghi tên trường, không ghi giá trị cho trường cá nhân | Có; không | Có (§8.3) | Không: không ẩn danh được mà không sửa nhật ký bất biến |
| 10 | Kế toán khách | K1 đến K8 của §6.4 (liền số, dãy theo chi nhánh hay pháp nhân, kỳ đặt lại, phiếu đảo, số của nháp) | Xem §6.4 | Nhóm B liền số, theo chi nhánh, tháng | Đổi cấu hình `gapPolicy`, `phạm vi`, `kỳ` |
| 11 | Kế toán khách | Chuyển kho có hiện giá vốn cho bên nhận; chuyển giữa hai pháp nhân dùng chứng từ nào; cờ công nợ toàn chuỗi khi tiếp nhận | Xem P6, P9, §3 | Không hiện giá vốn; không hiện số dư | Ảnh hưởng chiếu §10 |
| 12 | Khách | Quy ước mã nhân viên hiện có; hết phiên 15 hay 30 phút cho QV, TN, NS; ngưỡng cảnh báo "Hiện" bất thường; có kho tổng riêng | | Giữ mặc định | Chỉ đổi tham số |

---

## 13. Mâu thuẫn tìm thấy trong tài liệu

| # | Mâu thuẫn | Nơi | Xử lý đề xuất |
| --- | --- | --- | --- |
| 1 | "Quản lý trở lên" bắt buộc MFA nhưng không nêu vai trò (FR-SYS-001), D-02 liệt kê CH, QV, QL, KT, AD, QĐ không | FR-SYS-001, D-02, G-02 | §1.1: ghi vai trò vào FR-SYS-001 |
| 2 | FR-SYS-001 "không dùng chung tài khoản" và thợ dùng tablet dùng chung (Journey §1) | FRD, Journey | §1.2: sửa tiêu chí thành "không dùng chung **thông tin đăng nhập**; thiết bị xưởng đã đăng ký được dùng chung" |
| 3 | Khóa PIN: review nói "20 lần sai thì khóa thiết bị 15 phút"; `ba-answers-01` Câu 3 cộng "5 lần sai trên một tên khóa tên đến khi QĐ/QL mở"; ADR §6.3 chỉ nhắc giới hạn theo thiết bị | review, `ba-answers-01`, `review-01-round2-ba` mục 9, ADR | Dev cài **cả hai** bộ đếm (C1, C2) |
| 4 | Đa chi nhánh: dev gộp tất cả; `ba-decisions` câu 9 buộc chọn một chi nhánh với người không phải CH, QV | open-questions Q3, ba-decisions | §4 |
| 5 | Chi nhánh khóa: FR-SYS-011 (tra cứu được) và `ba-answers-01` Câu 1 (chi nhánh khóa là lý do không đăng nhập) | FRD, `ba-answers-01` | §5: FR-SYS-011 thắng |
| 6 | Cách ly: NFR-ISO-01, UAT-06, `ba-answers-01` Câu 12 và FR-CRM-004, FR-CRM-002, FR-REC-006, FR-REC-036, FR-INV-014, FR-INV-031 | FRD, `ba-answers-01` | §10 |
| 7 | FRD §2 hàng "Danh mục phụ tùng và bảng giá": TK = S, CH = D; nhưng bảng giá là cấu hình nhóm A (CH duyệt) và `ba-answers-04` cho MH xem danh mục không giá vốn | FRD §2, `ba-answers-06` | Tách hàng thành `parts-catalog` (TK S) và `price-list` (chủ dự án chốt người lập) |
| 8 | Hạn mức giảm giá: G4-SYS-09 ghi QL (S), `ba-answers-06` Phụ lục A.2 cấm QL sửa hạn mức chi nhánh mình | screen-inventory, `ba-answers-06` | Phụ lục A.2 (mới hơn) thắng |
| 9 | Nhật ký FR-SYS-003 (giá trị trước và sau) và quyền xóa, ẩn danh (FR-CRM-011, FR-HRM-012) | FRD | §8.3 |
| 10 | Che dữ liệu: D-10 nói TK, KT, NS, AD "che một phần"; `ba-decisions` câu 8 nói AD không truy cập, TK ẩn địa chỉ, NS không có hồ sơ khách | screen-inventory D-10, ba-decisions | `ba-decisions` câu 8 (mới hơn) thắng; AD, NS, MH không thấy dữ liệu khách |
| 11 | Hoàn kho: `ba-answers-02` Câu 7 dùng tiền tố PN; `ba-answers-04` Phụ lục B (mới hơn) dùng HK | `ba-answers-02`, `ba-answers-04` | HK thắng; `proposed-doc-changes` C-12 đã liệt kê HK |
| 12 | Seed `warehouse:create` cho QL và CH, `warehouse:export` cho CH và QL không có trong tài liệu | `demo.ts` | Thay theo §2.3 |
| 13 | Khóa chống trùng 24 giờ và ràng buộc duy nhất hóa đơn (FR-EIN-013) | open-questions Q9, FRD | §8.1: hai cơ chế khác nhau |
| 14 | Hết phiên "30 phút, KT, AD, CH 15 phút" (ADR §6.3) thiếu phiên PIN 3 phút (D-04, D-05) | ADR, screen-inventory | §1.5 |
| 15 | Mã vai trò: FRD §2 có 10 cột; BRD §5 và `ba-answers-04` thêm MH, NS, QC, quản trị trụ sở nhưng không có mã chính thức hay hàng ma trận | FRD, BRD | §2.1; `proposed-doc-changes` C-06 |
| 16 | `PiiAccessEntry` trong `pii.ts` thiếu lý do, kết quả, vai trò dùng, phiên | code | §7.3 |

---

## 14. Thay đổi khuyến nghị cho FRD v0.4 (chưa áp dụng) và mã đề xuất

**Kiểm mã**: `proposed-doc-changes.md` đã dùng FR-SYS-019 đến 026, FR-REC-037 đến 043, FR-ACC-021 đến 025, FR-INV-029 đến 031, FR-PUR-009, FR-HRM-017 đến 019, FR-RPT-017; chưa dùng mã NFR mới nào và chưa gán mã UAT. FRD hiện có FR-SYS đến 018, FR-CRM đến 018, NFR-SEC đến 03, NFR-ISO-01, NFR-EXP-01, NFR-PERF đến 02, NFR-DAT-01, UAT đến 26. Các mã dưới đây **không trùng**; mã UAT là tạm, chốt khi áp dụng.

### 14.1 FR và NFR mới

| Mã đề xuất | Nội dung | MoSCoW | BR | Ảnh hưởng (RULE, workflow, UAT) |
| --- | --- | --- | --- | --- |
| FR-SYS-027 | Chính sách bảo mật tài khoản cấu hình được: mật khẩu, MFA bắt buộc theo vai trò, hết phiên theo vai trò và loại phiên, bộ đếm khóa; hạ mức cần CH duyệt | Must | BR-SYS-01 | RULE-012; UAT-27 (tạm) |
| FR-SYS-028 | Đánh số chứng từ cấu hình: nhóm A/B, thời điểm cấp, liền số, dãy, kỳ; cấp số trong cùng giao dịch, không tái sử dụng, idempotent | Must | BR-REC-05 (FR-REC-030), BR-ACC-01 | RULE-009, RULE-010; UAT-28 (tạm) |
| FR-SYS-029 | Vòng đời kho: mã bất biến, ngừng dùng có điều kiện, không chuyển chi nhánh, kho tổng thuộc đơn vị trụ sở, một kho mặc định | Must | BR-SYS-01 | RULE-009; UAT-31 (tạm) |
| FR-SYS-030 | Phép chiếu xuyên chi nhánh cấu hình (danh sách trường trắng) và khái niệm "quan hệ với chi nhánh" | Must | BR-SYS-01 | RULE-012; NFR-ISO-01; UAT-29 (tạm) |
| FR-SYS-031 | Khung chính sách lưu trữ: loại dữ liệu, thời hạn, hành động, căn cứ, người xác nhận; mặc định không xóa | Should | BR-SYS-02, BR-CRM-05 | NFR-DAT-01, NFR-PRI-01; liên quan FR-HRM-012, FR-CRM-011 |
| FR-SYS-032 | Chi nhánh làm việc: chọn, ghi vào chứng từ, kiểm quyền hành động tại chi nhánh đó ở máy chủ | Must | BR-SYS-01 | D-06; NFR-ISO-01 |
| FR-CRM-019 | Tra cứu khách, xe xuyên chi nhánh bằng khớp chính xác biển số hoặc SĐT đầy đủ; chỉ hiện trường chiếu P1, P2; có nhật ký truy cập | Must | BR-CRM-02 | FR-CRM-002, 004; UAT-29 (tạm) |
| NFR-ISO-02 | Mọi phép chiếu xuyên chi nhánh phải có test danh sách trường trắng; mở rộng UAT-06 sang xuất, API, tải tệp, tìm kiếm toàn cục | Must (đề xuất) | BR-SYS-01 | UAT-06, UAT-29 (tạm) |
| NFR-EXP-02 | Giới hạn xuất: số dòng, lý do và nhập lại mật khẩu cho cột cá nhân, nhật ký mỗi lần xuất, chống chèn công thức | Must (đề xuất) | BR-SYS-06 | FR-CRM-017; UAT-30 (tạm) |
| NFR-PERF-03 | Kích thước trang mặc định 25, tối đa 100; không đếm tổng mặc định | Should | | NFR-PERF-01 |
| NFR-DAT-02 | Khóa chống trùng HTTP có thời hạn kỹ thuật tách khỏi ràng buộc duy nhất nghiệp vụ | Should | BR-EIN-01 | FR-EIN-013 |

### 14.2 Sửa FR hiện có (chỉ ghi, chưa sửa tệp)

| Vị trí | Sửa |
| --- | --- |
| FR-SYS-001 | Ghi vai trò bắt buộc MFA (CH, QV, QL, KT, AD) thay "quản lý trở lên"; tiêu chí "không dùng chung thông tin đăng nhập; thiết bị xưởng đã đăng ký được dùng chung với PIN cá nhân" |
| FR-SYS-003 | Với trường dữ liệu cá nhân chỉ ghi tên trường và dấu đã đổi |
| FR-SYS-005 | Tham chiếu FR-SYS-029 cho kho; AD tạo, CH duyệt |
| FR-SYS-011 | Thêm trạng thái `closing`, bảng hành vi §5; người dùng chi nhánh khóa vẫn đăng nhập chỉ đọc |
| FR-SYS-012 | Thêm: yêu cầu bảo mật mạnh nhất, hết phiên nhỏ nhất của các vai trò |
| FR-SYS-013 | Thêm quy tắc quy đổi S/D/X/Xn; "Hiện" thuộc `PiiPolicy`; không tự gán quyền cho mình |
| FR-SYS-014 | Thời hạn lưu theo FR-SYS-031 |
| FR-REC-030 | Mở rộng theo FR-SYS-028 và bảng §6.3 (đã có C-12 trong `proposed-doc-changes`) |
| FR-CRM-002, 004 | Nêu phép chiếu P2, P3 |
| FR-CRM-017 | Dẫn NFR-EXP-02 |
| NFR-ISO-01 | "Dữ liệu nguồn cấp chi nhánh tách hoàn toàn; chiếu xuyên chi nhánh chỉ theo FR-SYS-030" |
| NFR-EXP-01, NFR-PERF-01, NFR-DAT-01 | Dẫn NFR mới tương ứng |
| FRD §2 | Tách hàng "Người dùng, phân quyền, cấu hình" và hàng "Danh mục phụ tùng và bảng giá" (đã có C-04); thêm cột MH, NS (C-06); ghi quy đổi hành động |
| Giải thích FR-SYS-019, 020, 022, 023, 025, 026 | Áp dụng bản đề xuất đã có; thêm nội dung §1 vào FR-SYS-020 (hết phiên theo vai trò), FR-SYS-022 (điều kiện C1–C8, bộ quyền phiên PIN) |

### 14.3 Tài liệu khác

| Tài liệu | Cần cập nhật |
| --- | --- |
| BRD | §5 (mã vai trò, quản trị trụ sở); §10 câu 12 (nơi lưu dữ liệu) vẫn mở; thêm BR cho đánh số chứng từ nếu Kế toán yêu cầu liền số |
| Journey | §7 ma trận phê duyệt: thêm duyệt cấu hình nhóm A, B, C; trạng thái chi nhánh `closing`; WF mới cho đánh số chứng từ |
| `docs/ui-ux` (designer) | Nhóm B hiện mã tạm khi nháp; tablet 3 phút; "25+" thay cho tổng số; bảng che cho QĐ, TN nếu Luật sư đổi; G4-SYS-03 lý do "chi nhánh khóa: chỉ được xem" |
| Dev | Thay seed vai trò và quyền theo §2.4; mở rộng `PiiAccessEntry`; chốt chặn `assertBranchWritable`; tách khóa chống trùng HTTP và ràng buộc hóa đơn; hai bộ đếm PIN; hết phiên theo vai trò và loại phiên |

### 14.4 UAT tạm

| Mã tạm | Kịch bản |
| --- | --- |
| UAT-27 | Vai trò bắt buộc MFA bị chặn nếu chưa thiết lập (khi cờ cưỡng chế bật); phiên PIN không có quyền ngoài bộ quyền hẹp; tablet bị thu hồi không đăng nhập được; PIN sai 5 lần khóa tên đến khi QĐ/QL mở |
| UAT-28 | 100 giao dịch song song trên một dãy PT không trùng số, không lỗ số; gửi lại cùng `Idempotency-Key` trả cùng số; nháp nhóm B hủy không để lỗ số |
| UAT-29 | CV chi nhánh B tra biển số xe đã sửa ở A: thấy đúng các trường P2, P3, không mở được lệnh gốc, không duyệt danh sách; phép chiếu không chứa trường ngoài danh sách trắng |
| UAT-30 | Xuất vượt 5.000 dòng bị từ chối; cột cá nhân đầy đủ không lý do bị từ chối; mỗi lần xuất có nhật ký; AD không xuất được báo cáo nghiệp vụ |
| UAT-31 | Ngừng dùng kho còn tồn bị chặn; không chuyển kho sang chi nhánh khác; mã kho bất biến sau khi có phát sinh |
| UAT-32 | Chi nhánh `closing` chặn lệnh mới nhưng cho thu tiền lệnh đang mở; chi nhánh `locked` chỉ đọc |
