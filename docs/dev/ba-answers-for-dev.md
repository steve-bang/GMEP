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

---

## 15. Slice 1.3 CRM (C1–C15)

Phiên bản 0.1 · 04/11/2026 · Người lập: BA · Trạng thái: **BA đề xuất, chờ xác nhận**. Trả lời mục "Slice 1.3 CRM" của [open-questions-for-ba.md](open-questions-for-ba.md). Thẻ trạng thái và bên quyết định theo §0. Không sửa FRD/BRD/Journey; việc cần sửa ở §15.3. Mọi con số là tham số cấu hình có ngày hiệu lực (NFR-MNT-01).

### 15.1 Tóm tắt

Cột "Khác giá trị tạm của dev" ghi **Có** khi dev phải đổi mã; **Giữ** khi giá trị tạm đã đúng; **Bổ sung** khi giữ giá trị tạm nhưng thêm điều kiện.

| # | Khuyến nghị mặc định (một dòng) | Khác giá trị tạm của dev | Ai xác nhận cuối |
| --- | --- | --- | --- |
| C1 | `KH-<MÃCN>-<STT 5 số>`, đếm theo chi nhánh tạo, liên tục, không đặt lại theo kỳ; không thuộc dãy chứng từ | Giữ | Khách (định dạng); Kế toán không cần |
| C2 | Quan hệ không hết hạn; hai nguồn hiện có hợp lệ; thêm ghi nguồn quan hệ và nhật ký truy cập | Bổ sung | Chủ dự án, Luật sư khách |
| C3 | Tách "hạn nội bộ" (72 giờ, cấu hình theo loại yêu cầu) khỏi "hạn pháp lý" (để trống tới khi luật sư nhập) | Có (một giá trị thành hai tham số theo loại) | Luật sư khách |
| C4 | Giữ danh sách ẩn danh của dev; giữ biển số; **đóng cửa an toàn** (chặn hoàn tất xóa) khi cổng giữ dữ liệu chưa có thật | Có (stub không chặn thành chặn) | Luật sư khách, Kế toán khách |
| C5 | Cho giảm số km khi có lý do bắt buộc, có nhật ký; không chặn cứng | Có (dev: cấm giảm) | Khách |
| C6 | Hiện giá, tắt được; "giá" là tổng hạng mục trước giảm giá toàn lệnh | Bổ sung | Chủ dự án |
| C7 | Ma trận dev khớp FRD §2; bổ sung quy tắc cột xuất: chỉ CH, KT xuất cột cá nhân đầy đủ | Kiểm tra (xem C7, C14) | Khách |
| C8 | Giữ phân quyền; chưa tạo vai trò DPO riêng, dùng quyền `data-request:*` gán được | Giữ | Luật sư khách, Chủ dự án |
| C9 | Giữ, nhưng QĐ chỉ tra theo biển số và chỉ thấy trường xe (P2, P3); TN không thấy lịch sử; thêm giới hạn tần suất tra | Có (thu hẹp QĐ, TN) | Chủ dự án, Luật sư khách |
| C10 | Giữ danh sách; "lợi ích hợp pháp" chưa dùng được cho tới khi luật sư xác nhận | Bổ sung | Luật sư khách |
| C11 | Giữ định dạng rộng, chỉ cảnh báo mềm; thêm chuẩn hóa và số khung duy nhất khi có | Bổ sung | Khách |
| C12 | Giữ; SĐT tìm từ 4 chữ số; hiện "50+" khi bị cắt; một SĐT nhiều khách là hợp lệ | Bổ sung | Khách |
| C13 | Phần chưa dựng chấp nhận được, **trừ** ô tìm khách khi chuyển chủ/tạo xe (Must, FR-CRM-014) | Có (danh sách 100 khách đầu không đạt) | Khách (qua designer) |
| C14 | Giữ POST, CSV UTF-8 BOM, 5.000/1.000 dòng; thêm chống chèn công thức, quy tắc cột cá nhân theo vai trò, phạm vi | Bổ sung | Khách |
| C15 | Giữ: CH, QV, KT không sửa trường cá nhân | Giữ | Khách |

### 15.2 Trả lời từng câu

#### C1. Mã khách

**Khuyến nghị**: giữ `KH-<MÃCN>-<STT 5 số>`. `[Đề xuất BA – chờ xác nhận: Khách]`

- Khách là danh mục cấp công ty (§10.1.2), không phải chứng từ nên **không** theo dãy `LOẠI-MÃCN-YYMM-STT` của §6.3 và không đặt lại theo kỳ. Lý do: mã khách phải không đổi trong suốt vòng đời và dùng để tìm kiếm, nói qua điện thoại; đặt lại theo tháng không có ích.
- `MÃCN` là chi nhánh **tạo** hồ sơ, bất biến (§6.2 điều 4); khi khách được chi nhánh khác "dùng hồ sơ" (C2) mã không đổi. Mã duy nhất toàn công ty. STT dài thêm khi vượt 99.999, không cắt.
- Bộ đếm cập nhật trong cùng giao dịch với việc tạo khách, cùng `Idempotency-Key` trả cùng mã; mã đã cấp không tái sử dụng kể cả khi khách bị ẩn danh (C4).
- Mã khách hiện trong tra cứu xuyên chi nhánh (P1 cho phép "mã khách" và "chi nhánh quen") nên lộ chi nhánh tạo; chấp nhận được vì P1 đã cho thấy chi nhánh quen.
- Xe không có mã riêng; nhận diện bằng biển số (FR-CRM-002).
- Căn cứ: FR-CRM-001; BR-CRM-01; §6.2. Thêm một dòng "Khách, KH, dãy riêng cấp công ty, không kỳ" vào bảng §6.3 khi áp dụng FRD v0.4. Mã `CD` (yêu cầu chủ dữ liệu) đã có ở §6.3, dùng nguyên.
- Khách cần xác nhận nếu muốn bỏ `MÃCN` khỏi mã khách (mã ngắn hơn, không lộ chi nhánh); chỉ đổi cấu hình.

#### C2. "Quan hệ với chi nhánh"

**Khuyến nghị**: giữ như dev mô tả, thêm ba điều kiện. `[Đề xuất BA – chờ xác nhận: Chủ dự án, Luật sư khách]` (đúng thẻ §10.1 điều 5)

- Khớp §10.1 điều 5: "có (hoặc từng có) lịch hẹn, báo giá, lệnh, hoặc được tạo tại X". Quan hệ **không hết hạn** (không có "từng" thì không bao giờ mất). Xe đang sở hữu gắn cùng lúc là hợp lý vì FR-CRM-014 xem chủ hiện tại là bản ghi sở hữu còn hiệu lực.
- Thêm (1): ghi **nguồn quan hệ** (`created`, `lookup_adopt`, `appointment`, `quote`, `repair_order`) và người, thời điểm tạo quan hệ. Mục đích: kiểm tra sau này ai mở hồ sơ đầy đủ mà không có nghiệp vụ.
- Thêm (2): thao tác "Dùng hồ sơ này tại chi nhánh" ghi nhật ký truy cập (`open_record`, §7.3) và chỉ CV, QL (quyền tạo/sửa khách) thực hiện; TN, QĐ không.
- Thêm (3): đây là lối mở đầy đủ SĐT/địa chỉ cho bất kỳ CV nào chỉ cần biết SĐT hoặc biển số. Rủi ro đã được §10.1 chấp nhận nhưng cần luật sư xác nhận. Phương án an toàn hơn, bật bằng cấu hình `adoptRequiresBusinessEvent`: chỉ cho tạo quan hệ khi đã có lịch hẹn hoặc báo giá (REC). Khuyến nghị pilot một chi nhánh: tắt cờ (tức là cho phép như dev), bật lại khi mở nhiều chi nhánh. Tác động nếu bật: tiếp nhận xe lạ phải lập lịch hẹn hoặc báo giá nháp trước khi thấy SĐT đầy đủ.
- REC (slice 1.5) gọi cùng `relateToWorkingBranch` khi tạo lịch hẹn, báo giá, lệnh: đúng (FR-REC-001..).
- Căn cứ: FR-CRM-004, NFR-ISO-01, §7.1, §10.1, P1.

#### C3. Thời hạn trả lời yêu cầu chủ dữ liệu

**Khuyến nghị**: không coi 72 giờ là hạn pháp lý. Hai tham số. `[Cần xác nhận: Luật sư khách]`

- FRD không có con số: FR-CRM-011 chỉ yêu cầu "mỗi yêu cầu có người xử lý, thời hạn, kết quả" và NFR-PRI-01 để luật sư xác nhận nhóm miễn/ân hạn theo Luật BVDLCN 2025 và NĐ 356/2025. BA **không khẳng định** con số pháp lý ở đây vì chưa có văn bản trong repo; con số 72 giờ của dev cần luật sư đối chiếu với điều khoản thật.
- `internalTargetHours` = **72** (mục tiêu nội bộ, giá trị khởi điểm), cấu hình **theo loại yêu cầu** {xem, chỉnh sửa, rút đồng ý, xóa}. Mốc tính: lúc tiếp nhận (thời điểm CV/QL ghi nhận, giờ máy chủ). Dùng để nhắc và tô đỏ quá hạn.
- `legalDeadline` theo loại yêu cầu: **để trống** tới khi luật sư nhập; trống thì không hiện "hạn pháp lý" và không kết luận trễ luật.
- Nhắc: tới 50% thời gian thông báo người xử lý; quá hạn thông báo QL và CH (kênh thông báo trong hệ thống, nội dung không chứa dữ liệu cá nhân, §7.1). Gia hạn được, bắt buộc lý do, lưu lịch sử.
- Rút đồng ý (C10) có hiệu lực ngay trong hệ thống, không chờ hạn xử lý yêu cầu.
- Căn cứ: FR-CRM-010, 011; BR-CRM-05; NFR-PRI-01. UAT-10 thêm kiểm tra quá hạn và gia hạn.

#### C4. Xóa dữ liệu khách (ẩn danh)

**Khuyến nghị**: giữ danh sách ẩn danh của dev, đổi hành vi khi cổng chặn chưa có thật, giữ biển số. `[Cần xác nhận: Luật sư khách, Kế toán khách]`

- Danh sách xóa/giữ của dev khớp §8.1 (hồ sơ khách "ẩn danh dữ liệu cá nhân; loại trừ khách còn công nợ, bảo hành, lệnh mở") và §8.3 (nhật ký không chứa giá trị cá nhân). Giữ mã khách (C1), quan hệ sở hữu, lịch sử sửa chữa, bản ghi đồng ý, biển số.
- Điều kiện dev phải đảm bảo: **bản ghi đồng ý không chứa giá trị SĐT/email/tên** (chỉ mã khách, mục đích, kênh, căn cứ, phiên bản chính sách, thời điểm, người ghi), nếu không thì "giữ làm bằng chứng" mâu thuẫn với ẩn danh. Nhật ký thao tác cũ chỉ có tên trường (§8.3).
- **Khác dev**: `stubCustomerRetention` hiện không chặn. Với thao tác không đảo ngược, mặc định phải **đóng cửa an toàn**: khi cổng giữ dữ liệu là bản tạm (REC/ACC chưa nối), `closeDataRequest` loại "xóa" trả lỗi RFC 9457 "chưa kiểm tra được điều kiện chặn" và **không ẩn danh**; chỉ cho chạy ở môi trường thử qua cờ cấu hình. Tới khi REC/ACC có thật, yêu cầu xóa được ghi nhận và theo dõi hạn nhưng chưa hoàn tất tự động.
- Điều kiện chặn tối thiểu (RULE-010 và §8.1): lệnh đang mở, công nợ chưa thanh toán, bảo hành còn hạn, hóa đơn/chứng từ kế toán còn thời hạn lưu. Khi chặn: trả lý do và đưa vào kết quả yêu cầu (FR-CRM-011), không tự từ chối ngầm.
- Khách doanh nghiệp có chứng từ phải giữ: giữ tên pháp nhân và MST (đúng dev). Khách **cá nhân** có hóa đơn đã phát hành: dữ liệu người mua nằm trong hóa đơn/XML tại EIN và có thể buộc phải giữ; chỉ ẩn danh hồ sơ CRM, không sửa hóa đơn. Câu hỏi luật sư: có buộc giữ họ tên/địa chỉ người mua trên chứng từ không, thời hạn bao lâu.
- Biển số: BA đề xuất **giữ** (cần cho bảo hành, lịch sử xe khi xe đổi chủ, FR-CRM-014 giữ lịch sử khi đổi chủ). Sau ẩn danh chủ, biển số không còn liên kết tới người xác định được trong hệ thống. Rủi ro còn lại: biển số kèm lịch sử có thể suy ra chủ xe với người đã biết xe. `[Cần xác nhận: Luật sư khách]`; nếu luật sư nói biển số là dữ liệu cá nhân thì chỉ cần thêm cờ ẩn biển số trong hồ sơ ẩn danh và giữ khóa nội bộ, không đổi mô hình. Ảnh/video lệnh chứa biển số và người: theo §8.1 hàng "Ảnh, tệp đính kèm" và ADR 0001 (URL cấp theo từng lần xem).
- Ai hoàn tất: chỉ CH (`data-request:approve`) như dev; QV là phương án thay thế cần Khách quyết. Ẩn danh ghi nhật ký (ai, yêu cầu nào, trường nào), không ghi giá trị.
- Không có tác vụ tự động xóa theo thời hạn (§8.1: chưa đặt số năm).
- Căn cứ: FR-CRM-011; BR-CRM-05; NFR-PRI-01; RULE-010; §8.1, §8.3.

#### C5. Số km gần nhất

**Khuyến nghị**: cho phép giảm, **không chặn cứng**, bắt buộc lý do. `[Đề xuất BA – chờ xác nhận: Khách]`

- **Khác dev** (dev cấm giảm). FRD đã chọn hướng "cảnh báo và cho tiếp tục khi nhập lý do" ở FR-REC-003 (số km thấp hơn lần sửa trước). Cấm cứng ở CRM sẽ mâu thuẫn và làm kẹt khi nhập nhầm hoặc thay đồng hồ.
- Quy tắc: nhập số km thấp hơn số km đang lưu thì hiện cảnh báo; CV hoặc QL được lưu khi chọn lý do {nhập nhầm, thay đồng hồ, khác (ghi chú tối thiểu 5 ký tự)}. Ghi nhật ký (giá trị cũ và mới của km không phải dữ liệu cá nhân nên ghi được). Không sửa số km trong các lệnh đã ghi.
- Với "thay đồng hồ" lưu cờ để báo cáo không coi là bất thường. Số km giảm quá một ngưỡng (đề xuất 10.000 km, tham số, `[Cần xác nhận: Khách]`) báo QL.
- Chỗ nối với REC: slice 1.5 dùng cùng quy tắc; số km nhập khi tiếp nhận mới cập nhật `lastKm` theo quy tắc này.
- Căn cứ: FR-CRM-002, FR-REC-003.

#### C6. Lịch sử xe xuyên chi nhánh có hiện giá không

**Khuyến nghị**: hiện, tắt được bằng `historyShowPrice`. `[Cần xác nhận: Chủ dự án]`

- FR-CRM-004 (Must) liệt kê "giá" trong lịch sử xe, nên FRD đã thiên về hiện; thẻ [Cần xác nhận] ở P3 chỉ còn là mức chi tiết. Giữ mặc định bật.
- **Bổ sung định nghĩa**: "tổng tiền" là tổng giá hạng mục của lệnh, **trước giảm giá toàn lệnh và trước thuế**, VND nguyên; không hiện giảm giá, thanh toán, công nợ, giá vốn (P3 cột "không thấy"). Dev cần kiểm tra tổng không phải số khách phải trả, vì số sau giảm giá làm lộ chính sách giảm giá chi nhánh khác.
- Vai trò thấy: CV, QL, QĐ (P3); TH không; TN không (khác thấy khách ở P1).
- Với pilot một chi nhánh, cờ không ảnh hưởng. Tác động nếu tắt: khó báo giá tham chiếu cho xe đã sửa ở chi nhánh khác; nếu mở rộng: lộ doanh thu chi nhánh (đã nêu ở §12 câu 6).
- REC ghi bản chiếu khi **lệnh hoàn thành**: lệnh bị đảo/điều chỉnh sau đó phải cập nhật bản chiếu (RULE-010: bản chiếu không phải nguồn sự thật).

#### C7. Ma trận quyền CRM

**Khuyến nghị**: chấp nhận ma trận dev vì khớp FRD §2 hàng "Hồ sơ khách và xe" (CH X, QV X, QL S, CV S, QĐ X, TH Xn, TK -, TN X, KT X, AD -). `[Đề xuất BA – chờ xác nhận: Khách]`

- Quyền xuất: theo §9, **cột cá nhân đầy đủ chỉ CH, KT** (lý do + nhập lại mật khẩu); CH, QV, QL, KT xuất được danh sách với cột cá nhân đã che; CV, QĐ, TK, TN, TH, AD không xuất. Dev ghi "QL còn xuất" và "QV xuất": cần kiểm tra rằng QL, QV **không** được chọn cột đầy đủ dù xem đầy đủ trên màn hình.
- KT: xem cá nhân qua Hiện + lý do (§7.1), không sửa.
- TN: xem khách và xe để thu tiền; không tạo khách. Bán lẻ không qua lệnh (BL) cần tên khách có thể nhập trên phiếu, không tạo hồ sơ CRM. `[Cần xác nhận: Khách]` nếu TN cần tạo nhanh khách.
- TH: chỉ tên rút gọn và biển số của việc mình (Xn; làm ở slice REC). TK: tên khách trên chứng từ kho, chờ INV. Đúng theo C7 của dev.
- AD không có quyền khách (khớp §7.1, §13 mục 10). MH, NS không có.
- Nhắc: ma trận là dữ liệu cấu hình (G4-SYS-04), không viết cứng.

#### C8. Quyền xử lý yêu cầu chủ dữ liệu

**Khuyến nghị**: giữ như dev; chưa tạo vai trò DPO. `[Cần xác nhận: Luật sư khách, Chủ dự án]`

- CV, QL ghi nhận; QL giao người xử lý và đóng (trừ yêu cầu xóa); chỉ CH hoàn tất yêu cầu xóa. Hợp với nguyên tắc người ghi nhận không tự duyệt xóa (RULE-011 tinh thần tách nhiệm vụ).
- Vai trò DPO/pháp chế: FRD và BRD §5 chưa có; thêm vai trò là quyết định của Chủ dự án (§12 câu 5). Với pilot dùng quyền `data-request:*` có thể gán cho vai trò khác sau, không đổi mã. Câu hỏi luật sư: doanh nghiệp có phải chỉ định bộ phận/người phụ trách bảo vệ dữ liệu cá nhân không (liên quan NFR-PRI-01).
- Bổ sung: QV xem yêu cầu theo phạm vi và giao việc; KT, TN, TH, TK, QĐ không thấy yêu cầu. Người xử lý yêu cầu "xem" cũng phải qua `PiiPolicy` (chỉ cung cấp dữ liệu cho chủ dữ liệu sau khi xác minh danh tính; ghi cách xác minh vào hồ sơ).
- Yêu cầu thuộc chi nhánh nhận (mã `CD` theo chi nhánh), khách là cấp công ty nên yêu cầu "xóa/xem" phải quét mọi chi nhánh: CH hoàn tất ở cấp công ty.

#### C9. Tra cứu khớp chính xác xuyên chi nhánh

**Khuyến nghị**: giữ cơ chế; thu hẹp theo vai trò và thêm giới hạn tần suất. `[Đề xuất BA – chờ xác nhận: Chủ dự án, Luật sư khách]`

- P1 cho CV, QL, TN thấy khách xuyên chi nhánh; P2 cho QĐ chỉ thấy **xe** khi chẩn đoán; P3 (lịch sử sửa chữa) cho CV, QL, QĐ, không TN. **Khác dev**: (a) QĐ chỉ tra theo **biển số** và chỉ thấy trường xe (P2) và lịch sử (P3), không thấy tên khách/danh sách xe của khách (P1) và không tra theo SĐT; (b) TN tra được khách và xe (P1, P2), không thấy lịch sử/giá (P3). CH được xem (quyền xem tất cả).
- Ghi nhật ký truy cập **mọi** lần tra theo SĐT cho mọi vai trò: chặt hơn §7.3 (chỉ CH, QV, KT); BA đồng ý giữ chặt hơn. Một bản ghi mỗi lần tra, không ghi từng phím; ghi cả tra không có kết quả và bị từ chối; không ghi SĐT, chỉ ghi dạng tra (`search_by_phone`), kết quả có/không và số kết quả.
- Khớp chính xác SĐT đầy đủ (đã chuẩn hóa) hoặc biển số đầy đủ (đã chuẩn hóa, C11); không tiền tố, không ký tự đại diện, không xuất, không duyệt (§10.1 điều 4).
- Tối đa 5 khách mỗi lần tra: đồng ý. Thêm giới hạn tần suất theo người, đề xuất 30 lần/giờ (tham số, `[Cần xác nhận: Khách]`), vượt thì từ chối và báo CH. Mục đích: chống dò hàng loạt SĐT.
- Đối chiếu UAT-29 (tạm): thêm kiểm tra danh sách trường trắng cho từng vai trò.

#### C10. Mục đích, kênh, căn cứ của đồng ý

**Khuyến nghị**: giữ ba danh sách của dev làm giá trị cấu hình; chốt cách dùng. `[Cần xác nhận: Luật sư khách]`

- Mục đích {dịch vụ, nhắc, quảng cáo, chia sẻ bên thứ ba}: giữ. Gợi ý thêm mục đích thứ năm "ảnh/video phương tiện và hiện trạng xe" vì ảnh chứa biển số, người (ADR 0001) và FR-CRM-016; thêm hay không là việc của luật sư. Mỗi mục đích tách riêng, không gộp một ô "đồng ý tất cả".
- Kênh {tại quầy, Zalo, SMS, email, điện thoại, web}: giữ. Nhắc bảo dưỡng (FR-CRM-006) gửi theo kênh khách đồng ý nên đồng ý tính theo **mục đích × kênh**.
- Căn cứ {đồng ý, hợp đồng, nghĩa vụ pháp luật, lợi ích hợp pháp}: giữ bốn giá trị làm danh mục cấu hình, nhưng **"lợi ích hợp pháp" chưa dùng được** tới khi luật sư xác nhận có là căn cứ hợp lệ theo Luật BVDLCN 2025. "Hợp đồng" dùng cho mục đích "dịch vụ" (thực hiện lệnh sửa chữa).
- Chỉ căn cứ "đồng ý" mới cho quảng cáo (FR-CRM-013); chiến dịch phải báo số khách bị loại.
- Mỗi bản ghi đồng ý chỉ ghi thêm (không sửa), có: mục đích, kênh, căn cứ, kết quả (đồng ý/rút), thời điểm, người ghi, cách thu nhận (tại quầy, web, tin nhắn trả lời) và phiên bản thông báo quyền riêng tư. "Cách thu nhận tại quầy" cần hình thức bằng chứng do luật sư và khách chọn `[Cần xác nhận: Khách, Luật sư khách]`. Rút đồng ý có hiệu lực ngay (FR-CRM-010), lịch sử xem được (UAT-10).
- Nội dung thông báo quyền riêng tư do doanh nghiệp cung cấp: ghi thành câu hỏi gửi Khách.

#### C11. Biển số

**Khuyến nghị**: giữ định dạng rộng, thêm chuẩn hóa và cảnh báo mềm. `[Đề xuất BA – chờ xác nhận: Khách]`

- Chuẩn hóa trước khi kiểm trùng: chữ hoa, bỏ khoảng trắng, dấu chấm, gạch ngang (FRD kế hoạch di chuyển dữ liệu cũng yêu cầu chuẩn hóa biển số). Duy nhất theo chuỗi đã chuẩn hóa, trên toàn công ty (FR-CRM-002), khi trùng thì dẫn tới xe dùng chung (§10.3), không báo chi nhánh nào giữ.
- Định dạng sai dạng thường gặp chỉ **cảnh báo mềm** ("kiểm tra lại biển số"), chỉ chặn ký tự không hợp lệ và độ dài ngoài 5-12; không siết theo loại xe ở pilot (xe máy, quân đội, biển tạm khác nhau).
- Đổi biển số (G2-CRM-07): giữ biển cũ trong hồ sơ xe, ghi nhật ký, cần lý do. Tra theo biển cũ vẫn tìm ra xe và nhắc "biển đã đổi".
- Biển đã bỏ đăng ký lại cho xe khác: cho phép nhưng phải cảnh báo "biển này từng gắn với xe khác" và lịch sử cũ không chuyển sang xe mới. Để phân biệt, **số khung** (nếu nhập) nên duy nhất toàn công ty; trùng số khung với xe khác thì chặn và dẫn tới xe cũ (số khung không cố định 17 ký tự với xe cũ, nên không ép độ dài). `[Đề xuất BA]`
- Căn cứ: FR-CRM-002, FR-CRM-014 (lịch sử không đổi khi đổi chủ).

#### C12. Trùng khách, tìm kiếm

**Khuyến nghị**: giữ; thêm ba chi tiết. `[Đề xuất BA – chờ xác nhận: Khách]`

- FR-CRM-003 là Should và không nằm trong danh sách CRM của pha 1 (FRD §13: FR-CRM-001, 002, 004, 010, 011, 013), nên chưa làm là hợp lệ.
- Một SĐT thuộc nhiều khách (gia đình, doanh nghiệp): hợp lệ, không chặn. Cảnh báo trùng sau này chỉ khi cùng SĐT **và** cùng tên (chuẩn hóa).
- Tìm SĐT theo tiền tố: yêu cầu tối thiểu **4 chữ số** (tránh duyệt cả danh sách). Quầy thường tìm theo bốn số cuối: cho phép tìm theo đuôi nếu designer và Khách xác nhận; kỹ thuật chỉ lập chỉ mục khi đã chốt.
- Danh sách tối đa 50 khớp SĐT/biển số (không phân trang) khớp §11 (tìm kiếm 50 kết quả đầu): khi bị cắt, giao diện phải hiện "50+ kết quả, hãy nhập thêm" (không im lặng cắt). Danh sách theo tên dùng cỡ trang 25, tối đa 100 (§11).
- Phạm vi: trong `Scope` (khách có quan hệ với chi nhánh làm việc); không dùng tiền tố cho tra xuyên chi nhánh (C9).

#### C13. Phần giao diện chưa dựng

**Khuyến nghị**: chấp nhận trì hoãn phần phụ thuộc mô-đun khác; **không chấp nhận** chọn khách trong 100 khách đầu. `[Đề xuất BA]`, chuyển designer.

- Chấp nhận chưa dựng ở 1.3: cột "Lần sửa gần nhất", tab Báo giá, Thanh toán và công nợ (chờ REC/ACC); Ghi chú và tin nhắn; hợp nhất trùng (FR-CRM-003 Should); nhắc (FR-CRM-006 Should); chiến dịch; cột hiển thị; nhãn sửa tại chỗ (FR-CRM-015 Should). Nhớ: "CRM-08, 09, 10" là mã màn hình prototype, không phải mã FR.
- **Phải sửa**: chuyển chủ (FR-CRM-014 Must, UAT-18) và tạo xe cho khách cần ô tìm khách (tên/SĐT/mã khách). Chủ mới có thể là khách của chi nhánh khác nên cần cả tìm theo khớp chính xác SĐT (C9) rồi `relateToWorkingBranch`; danh sách 100 khách đầu theo tên sẽ sai khi dữ liệu thật vài nghìn khách. Dev nên gửi designer (D) để dựng bộ chọn khách dùng chung.
- Hồ sơ doanh nghiệp: người liên hệ, hạn mức nợ (FR-CRM-018 Should), hợp đồng (FR-CRM-012 Could) để pha sau, ghi vào nhật ký phạm vi để không bị coi thiếu.
- Đồng ý nằm trong tab hồ sơ khách: chấp nhận (FR-CRM-010 Must đã có).
- Xe dùng trang riêng `/crm/vehicles/new?customerId=…`: chấp nhận miễn có đường vào từ hồ sơ khách và từ tiếp nhận (REC).

#### C14. Xuất danh sách khách

**Khuyến nghị**: giữ, với các điều kiện sau. `[Đề xuất BA – chờ xác nhận: Khách]`

- POST (mật khẩu không nằm trên URL), CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), 5.000 dòng, 1.000 dòng khi có cột cá nhân đầy đủ, xuất bất đồng bộ để sau: khớp §9 và NFR-EXP-02 (đề xuất). Vượt giới hạn: từ chối kèm hướng dẫn thu hẹp bộ lọc, không tự cắt.
- Bổ sung (1): chống chèn công thức (ô bắt đầu `=`, `+`, `-`, `@` được vô hiệu hóa), áp cho tên, nhãn, mọi cột văn bản (NFR-SEC-02, §9).
- Bổ sung (2): quy tắc cột: xuất không cột cá nhân thì không cần lý do; chọn SĐT/email/địa chỉ **đầy đủ** thì chỉ CH, KT, bắt buộc lý do + nhập lại mật khẩu (D-02). QL, QV xuất với cột cá nhân đã che.
- Bổ sung (3): phạm vi chỉ gồm khách trong `Scope` (có quan hệ với chi nhánh người xuất); **không** xuất kết quả tra cứu xuyên chi nhánh (§10.1 điều 4).
- Bổ sung (4): nhật ký mỗi lần xuất theo §9: ai, vai trò, phạm vi, bộ lọc, số dòng, có/không cột cá nhân, cột nào, lý do, định dạng, mã yêu cầu; không ghi giá trị. Khách đã ẩn danh (C4) vẫn xuất với tên "Khách đã ẩn danh" và cột cá nhân trống.
- Cột "số xe" là số xe đang sở hữu. Mã chi nhánh là chi nhánh tạo (C1).
- Căn cứ: FR-CRM-017, UAT-20, UAT-30 (tạm).

#### C15. Sửa hồ sơ khách theo quyền che

**Khuyến nghị**: giữ: CH, QV, KT không sửa SĐT/email/địa chỉ; không cần cho CH sửa sau khi Hiện. `[Đề xuất BA – chờ xác nhận: Khách]`

- FRD §2: CH, QV, KT chỉ có quyền xem hồ sơ khách (X). Hiện là hành động xem, không phải quyền sửa; không tạo quyền sửa gián tiếp.
- Yêu cầu chỉnh sửa của chủ dữ liệu do CV hoặc QL xử lý (FR-CRM-011, C8) vì họ có mức xem đầy đủ.
- Hệ quả cần ghi: CV/QL của chi nhánh **chưa có quan hệ** với khách chỉ thấy bản che nên chưa sửa được trường cá nhân tới khi có quan hệ (C2). Điều này đúng ý §10.1.
- Mọi sửa trường cá nhân ghi nhật ký chỉ tên trường và dấu "đã đổi" (§8.3). Hồ sơ khách là cấp công ty: sửa ở chi nhánh A hiện ở mọi chi nhánh có quan hệ; chấp nhận.

### 15.3 Việc cần sửa ở tài liệu (chưa áp dụng) và UAT

| Vị trí | Thay đổi khuyến nghị | Liên quan |
| --- | --- | --- |
| §6.3 của tài liệu này / FRD v0.4 | Thêm dòng "Khách, KH, cấp công ty, không kỳ" | C1; FR-REC-030 |
| FR-CRM-011 | Thêm tiêu chí: hạn nội bộ và hạn pháp lý theo loại yêu cầu, nhắc, gia hạn; xóa đóng cửa an toàn khi chưa kiểm được điều kiện chặn | C3, C4; UAT-10 |
| FR-CRM-002 | Chuẩn hóa biển số; số khung duy nhất; biển đã đổi/bỏ | C11 |
| FR-CRM-004, P3 (§10.2) | Định nghĩa "giá" = tổng hạng mục trước giảm giá toàn lệnh, trước thuế | C6 |
| P1, P2 (§10.2) | QĐ chỉ P2 theo biển số; TN không P3; giới hạn tần suất tra | C9; UAT-29 (tạm) |
| FR-CRM-014 | Bộ chọn khách có tìm kiếm khi chuyển chủ | C13; UAT-18 |
| FR-REC-003 | Dẫn cùng quy tắc giảm số km có lý do cho hồ sơ xe | C5 |
| FR-CRM-010 | Danh mục mục đích × kênh × căn cứ; "lợi ích hợp pháp" chưa dùng | C10; UAT-10 |
| UAT-30 (tạm) | Thêm: QL, QV không chọn được cột cá nhân đầy đủ; chống chèn công thức | C7, C14 |
| BRD §5, §10 | Quyết định vai trò DPO/pháp chế (§12 câu 5) | C8 |

### 15.4 Câu hỏi chuyển bên quyết định (bổ sung cho §12)

| # | Gửi | Câu hỏi | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- |
| 13 | Luật sư khách | Hạn pháp lý trả lời từng loại yêu cầu chủ dữ liệu; ẩn danh có giữ biển số, tên/địa chỉ người mua trên hóa đơn không; "lợi ích hợp pháp" có dùng được; bằng chứng đồng ý tại quầy; cần chỉ định người/bộ phận phụ trách dữ liệu không | Như C3, C4, C8, C10 | Đổi tham số và danh mục cấu hình; ẩn biển số cần thêm cờ |
| 14 | Chủ dự án | Có cho tạo quan hệ chi nhánh bằng "Dùng hồ sơ này" mà chưa có lịch hẹn/báo giá; giá trong lịch sử xe | Cho phép ở pilot một chi nhánh; hiện giá | Bật `adoptRequiresBusinessEvent` hoặc tắt `historyShowPrice`: chỉ đổi cấu hình, tiếp nhận xe lạ chậm hơn |
| 15 | Khách | Giảm số km có lý do; ngưỡng báo QL; giới hạn tra 30 lần/giờ; TN tạo khách nhanh; CH hay QV hoàn tất xóa | Như C5, C7, C8, C9 | Chỉ đổi tham số/quyền |
| 16 | Kế toán khách | Điều kiện chặn xóa khách: công nợ, chứng từ nào còn thời hạn lưu | Như C4 | Cổng giữ dữ liệu của ACC phải trả đủ điều kiện |

---

## 16. Slice 1.4 INV (I1–I14)

Phiên bản 0.1 · 04/11/2026 · Người lập: BA · Trạng thái: **BA đề xuất, chờ xác nhận**. Trả lời mục "Slice 1.4 INV" của [open-questions-for-ba.md](open-questions-for-ba.md); đồng thời là bảng quy tắc giữ chỗ BA-07 ([review-docs-and-design.md](review-docs-and-design.md)). Thẻ trạng thái và bên quyết định theo §0. Không sửa FRD/BRD/Journey; việc cần sửa ở §16.3. Mọi con số là tham số cấu hình có ngày hiệu lực (NFR-MNT-01). Ghi chú: không tìm thấy "FRD mục 2.6" mà I4 viện dẫn trong `functional-requirements.md`; BA coi I4 là câu hỏi mở, không dựa vào mục đó.

### 16.1 Tóm tắt

Cột "Khác giá trị tạm của dev" ghi **Có** khi dev phải đổi mã hoặc dữ liệu mặc định; **Giữ** khi giá trị tạm đã đúng; **Bổ sung** khi giữ nhưng thêm điều kiện.

| # | Khuyến nghị mặc định (một dòng) | Khác giá trị tạm của dev | Ai xác nhận cuối |
| --- | --- | --- | --- |
| I1 | Bảng 16.2.1: giữ chỗ chỉ phát sinh khi **khách duyệt** hạng mục, neo vào dòng lệnh; đường duyệt của REC luôn gọi `allowPartial`, phần thiếu **được lưu** thành danh sách thiếu hàng (không tạo backorder); nhả phần dư khi hạng mục hoàn thành | **Có** (3 điểm: `allowPartial` ở đường duyệt, lưu phần thiếu, nhả phần dư) | Chủ dự án (quy tắc), Khách (thiếu hàng, hoàn kho) |
| I2 | Không hạn tự động vì chưa duyệt thì chưa giữ; thêm báo cáo "giữ chỗ lâu" và đối soát "giữ chỗ mồ côi" | Bổ sung (không đổi mã giữ chỗ) | Khách |
| I3 | Chặn tuyệt đối, không làm ngoại lệ ở 1.4; công thức tối đa thêm cận "nhu cầu còn lại" | Giữ (công thức: Bổ sung) | Chủ dự án |
| I4 | Thêm `quantityScale` cho phụ tùng ngay bây giờ (mặc định 1); hỏi Khách có bán dầu theo lít lẻ không | Có (thêm trường, ít tốn) | Khách |
| I5 | Giữ bình quân di động theo kho x phụ tùng; **lưu giá trị tồn nguyên đồng**, giá xuất = giá trị tồn x SL / tồn; chuyển kho mang theo giá vốn bên gửi; kiểm kê thừa mặc định giá bình quân | Có (làm tròn theo giá trị; điều chỉnh dương mặc định) | Kế toán khách |
| I6 | Chưa làm lớp lô; "lô" hiểu là dòng nhập (lớp nhập) lưu ở sổ; ghi rõ lệch chữ của FR-INV-003 | Giữ (kèm sửa FRD) | Kế toán khách, Chủ dự án |
| I7 | Ngưỡng lệch giá 5% hai chiều; ngưỡng số lượng chỉ cho **nhận vượt** đơn; nhận thiếu là nhận một phần, không cần duyệt | Có (nhận thiếu không còn bị duyệt) | Kế toán khách, Khách |
| I8 | PX cho lệnh phải có dòng nhu cầu của lệnh (giữ chỗ hoặc phần thiếu), nếu không thì chặn; HK như dev | Có (thu hẹp PX cho lệnh) | Chủ dự án |
| I9 | Giữ ma trận và quy tắc "người ghi sổ khác người lập"; thêm duyệt cấp trên khi vượt hạn mức | Giữ (Bổ sung hạn mức) | Chủ dự án |
| I10 | Giữ; thêm biên bản kiểm kê đính kèm, cửa sổ thời gian cho tồn đầu kỳ, Excel chỉ tạo nháp | Bổ sung | Kế toán khách, Chủ dự án |
| I11 | Giữ lưu theo kho x phụ tùng; cảnh báo khi Khả dụng **nhỏ hơn hoặc bằng** tối thiểu; công thức gợi ý đặt có thêm "Đã đặt chờ giao" khi có PUR | Giữ (so sánh `<=`: kiểm tra) | Khách |
| I12 | Giữ `price-item` có hiệu lực; mở rộng ký tự mã phụ tùng; hạn mức giảm giá (FR-INV-025) phải xong trước khi REC lập báo giá | Bổ sung | Chủ dự án, Khách |
| I13 | Chấp nhận bố cục chung nếu mỗi loại phiếu hiện đủ trường riêng; ba mục bắt buộc trước pilot (in phiếu, xuất Excel, bộ chọn có Khả dụng cho báo giá) | Giữ (kèm điều kiện) | Khách (qua designer) |
| I14 | Nhóm hàng và đơn vị tính là **danh mục cấu hình cấp công ty**, danh sách dev làm dữ liệu khởi tạo | Có (bỏ danh sách cứng trong mã) | Khách |

### 16.2 Trả lời từng câu

#### 16.2.1 I1. Quy tắc giữ chỗ theo sự kiện (BA-07)

**Khuyến nghị**: dùng bảng dưới làm quy tắc mặc định. `[Đề xuất BA – chờ xác nhận: Chủ dự án, Khách]`

Nguyên tắc nền (căn cứ FR-INV-020, RULE-007, RULE-008, Journey "Tồn thực tế, giữ chỗ và tồn khả dụng", `ba-answers-03` Câu 2 và 3):

1. **Giữ chỗ chỉ phát sinh khi khách duyệt** (Journey bước 1). Báo giá đang soạn, đã gửi, phát sinh chờ duyệt: **không giữ**, chỉ hiện Khả dụng. Vì vậy báo giá hết hạn (7 ngày) hoặc phát sinh hết hạn (24 giờ) **không có gì để nhả**.
2. **Chủ giữ chỗ là dòng của lệnh sửa chữa** (đơn vị duyệt là hạng mục, `ba-answers-03` Câu 2), không phải báo giá: lệnh bắt đầu từ lúc khách duyệt nên duyệt báo giá và mở lệnh là **một sự kiện**, không giữ hai lần. Hàm của dev nhận chủ là báo giá vẫn dùng được, nhưng REC không gọi theo hướng đó.
3. **Mô hình "tổng nhu cầu" của dev giữ nguyên** (gọi lại cùng tổng thì không đổi; tăng thì giữ thêm; giảm thì nhả), vì idempotent và an toàn khi gọi lặp (hợp NFR về idempotency). Bổ sung khái niệm: `nhu cầu còn lại = tổng duyệt - đã xuất ròng (xuất trừ hoàn)`, và `đã giữ + chưa đáp ứng = nhu cầu còn lại`.
4. **Duyệt không bao giờ bị chặn vì thiếu hàng**: khách duyệt là sự kiện nghiệp vụ, kho không có quyền từ chối. Đường duyệt của REC gọi giữ với `allowPartial`; phần thiếu được **lưu** (`unmetQty`) và hiện trong danh sách thiếu hàng; lệnh/hạng mục sang "Tạm dừng, chờ phụ tùng" theo Journey bước 5 và `ba-answers-02`/BS-2.
5. **Tranh chấp**: hai lệnh cùng giành một hàng thì **giao dịch ghi trước thắng**; không ưu tiên theo xe nằm xưởng, không cướp giữ chỗ của lệnh khác. Bên thua nhận phần thiếu (nguyên tắc 4). Test đồng thời: hai giao dịch song song không làm Khả dụng âm.

| # | Sự kiện (nguồn) | Giữ / nhả / tiêu thụ | Tác động bốn số (Thực tế, Giữ chỗ, Đang VC, Khả dụng) | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Lập, gửi, khách xem báo giá (REC) | **Không giữ** | Không đổi | Hiện Khả dụng + ngày hàng về (`ba-answers-04` Câu 6) |
| 2 | Khách duyệt toàn bộ báo giá, lệnh mở (REC) | **Giữ** mọi dòng phụ tùng của mọi hạng mục, chủ = dòng lệnh, `allowPartial` | Giữ chỗ tăng phần có sẵn; Khả dụng giảm cùng lượng; phần thiếu ghi `unmetQty` | Cùng giao dịch với mở lệnh; cùng `Idempotency-Key` thì không giữ hai lần |
| 3 | Duyệt một phần (REC) | **Giữ** chỉ hạng mục được duyệt (cả công lẫn phụ tùng của hạng mục) | Như dòng 2 | Hạng mục khách bỏ (kể cả "Bắt buộc" bị bỏ) không giữ |
| 4 | Khách từ chối cả báo giá; báo giá hết hạn; bản mới thay bản cũ | Không có gì để nhả (chưa giữ) | Không đổi | Báo giá đã duyệt không có bản thay thế (`ba-answers-03` Câu 1) |
| 5 | Lập báo giá bổ sung (phát sinh) chờ duyệt | **Không giữ** | Không đổi | Cảnh báo thiếu hàng ngay lúc lập để cố vấn báo khách (RULE-005, RULE-006) |
| 6 | Phát sinh được duyệt | **Giữ thêm** (gọi lại với tổng mới), `allowPartial` | Như dòng 2 | Nút Bắt đầu của hạng mục mới mở (REC), không phải INV |
| 7 | Phát sinh bị từ chối hoặc hết hạn | Không làm gì | Không đổi | Dòng ở nhóm "Không thực hiện", không xóa (RULE-010) |
| 8 | Hạng mục bị hủy hoặc bị loại khi lệnh còn mở | **Nhả** phần chưa xuất của hạng mục | Giữ chỗ giảm; Khả dụng tăng | Phần đã xuất giữ nguyên, hoàn bằng HK (dòng 12) |
| 9 | Đổi số lượng sau duyệt | Giảm: **nhả phần chênh**. Tăng: xử lý như phát sinh (dòng 5, 6) | Theo hướng | Không tăng im lặng |
| 10 | Xuất một phần (PX ghi sổ) | **Tiêu thụ** đúng số xuất; phần còn lại vẫn giữ | Thực tế giảm q; Giữ chỗ giảm q; Khả dụng không đổi (nếu xuất trong phần đã giữ) | Hợp Journey bước 3 |
| 11 | Xuất đủ nhu cầu | Giữ chỗ của dòng về 0 | Như dòng 10 | |
| 12 | Hoàn kho HK (hoàn theo lệnh) | **Không tự giữ lại.** Lý do hoàn "thừa/không dùng": kết thúc. Lý do "cấp nhầm/đổi hàng": REC gọi giữ lại bằng tổng nhu cầu mới | Thực tế tăng q; Khả dụng tăng q; Giữ chỗ không đổi | `[Cần xác nhận: Khách]`: có cần tự giữ lại không (FR-INV-008) |
| 13 | Phiếu đảo của PX (sửa sai nhập liệu) | **Khôi phục** phần giữ đã tiêu thụ nếu dòng lệnh vẫn mở và đủ hàng; thiếu thì thành `unmetQty` | Thực tế tăng; Giữ chỗ tăng lại | Khác HK ở chỗ đây là sửa sổ, không phải nghiệp vụ hoàn hàng (RULE-010) |
| 14 | Hạng mục Hoàn thành hoặc lệnh Sẵn sàng bàn giao | **Nhả phần giữ dư** còn lại của hạng mục/lệnh | Giữ chỗ về 0; Khả dụng tăng | Chặn giữ chỗ treo; số dư giữa SL duyệt và SL xuất ảnh hưởng tính tiền là việc của REC `[Cần xác nhận: Khách]` |
| 15 | Hạng mục/lệnh Tạm dừng chờ phụ tùng | Giữ nguyên phần đã giữ; phần thiếu nằm ở danh sách thiếu | Không đổi | Journey bước 5 |
| 16 | Hàng về (PN ghi sổ, nhận chuyển kho) | **Không tự giữ** cho phần thiếu; thông báo TK, CV | Thực tế tăng | Giữ lại thủ công bằng nút "Giữ chỗ phần thiếu". Tự giữ theo thứ tự duyệt cũ trước là cấu hình `autoFulfilShortage`, mặc định **tắt** |
| 17 | Lệnh có cờ "Chờ duyệt hủy" | Giữ nguyên | Không đổi | `ba-answers-02` A.2 mục 2; REC khóa bắt đầu hạng mục mới |
| 18 | Duyệt hủy lệnh (lệnh Đã hủy) | **Nhả hết** phần chưa xuất | Giữ chỗ về 0 | Phần đã xuất: HK hoặc "đã lắp, không hoàn" (A.2 mục 4). Từ chối hủy: không đổi |
| 19 | Lệnh Hoàn tất / đóng | Nhả mọi phần dư (an toàn) | Giữ chỗ về 0 | |
| 20 | Phụ tùng khách mang đến | **Không giữ** | Không đổi | FR-INV-016, `ba-answers-02` Câu 9 |
| 21 | Bán lẻ (BL) | Không giữ, xuất ngay | Thực tế giảm | Phải vượt kiểm tra Khả dụng |
| 22 | Gửi chuyển kho (CK) | Không giữ chỗ; **hàng đã giữ cho lệnh không được chuyển đi** | Thực tế giảm, Đang VC tăng; không bên nào tăng Khả dụng | FR-INV-010; `ba-answers-04` Câu 1 |
| 23 | Điều chỉnh/kiểm kê làm Thực tế nhỏ hơn Giữ chỗ | Không từ chối sự thật đếm được: ghi sổ, rồi giảm giữ chỗ của các dòng **giữ sau cùng trước**, phần mất thành `unmetQty`, thông báo QL và CV | Thực tế giảm; Giữ chỗ giảm | `[Đề xuất BA]`; cần duyệt như điều chỉnh bình thường (I10) |

**Khác giá trị tạm của dev**:

- Dev: thiếu hàng thì từ chối cả dòng (409) hoặc `allowPartial`. Mặc định cho **đường duyệt của REC** phải là `allowPartial` (dòng 2, 3, 6). Giữ nguyên 409 cho lời gọi kiểm tra chặt khác.
- Dev: phần thiếu "được báo về". Phải **lưu** (`unmetQty` trên dòng giữ chỗ hoặc bản ghi nhu cầu) để có danh sách thiếu hàng và để I8 dùng.
- Dev: không nói nhả phần dư. Thêm dòng 14 và 19.
- Dev: phiếu đảo PX và HK. Thêm dòng 12 và 13 (khôi phục chỉ với phiếu đảo).
- Giữ nguyên: mô hình tổng nhu cầu, nhả hết khi hủy hoặc từ chối, phần đã xuất không nhả, phát sinh chờ duyệt không giữ, không tạo backorder.

**Backorder**: không tạo chứng từ đơn chờ trong 1.4. Danh sách thiếu hàng là nguồn cho yêu cầu chuyển kho (YK) và yêu cầu mua (YM) khi có PUR (FR-PUR-001); BA-07 đã nêu câu "giữ một phần hay backorder", đây là lựa chọn "giữ một phần, không backorder". Phương án thay thế (chờ đủ mới giữ): làm lệnh dừng cả khi chỉ thiếu một ít, không khuyến nghị.

**Câu hỏi cho Khách** (gộp §16.4): thiếu hàng thì hạng mục có bắt buộc dừng không hay thợ làm trước phần khác; hoàn kho "cấp nhầm" có tự giữ lại không; giữ chỗ phần thiếu khi hàng về có tự động theo thứ tự duyệt không.

Căn cứ: FR-INV-016, 019, 020, 008, 010; RULE-007, 008, 009, 010; BR-INV-10; UAT-13 (thêm: duyệt một phần, phát sinh, hủy, xuất một phần, thiếu hàng).

#### 16.2.2 I2. Giữ chỗ có hạn không

**Khuyến nghị**: không có hạn tự động. `[Đề xuất BA – chờ xác nhận: Khách]`

- Con số 24 giờ là hạn duyệt của **báo giá bổ sung** (`ba-answers-03` Câu 3), còn báo giá thường hiệu lực 7 ngày; cả hai xảy ra **trước** khi giữ chỗ nên không cần `expiresAt`. Giữ chỗ sống đúng bằng đời hạng mục trong lệnh (bảng I1 dòng 14, 18, 19).
- Rủi ro thật: REC quên gọi nhả, hoặc lệnh treo ở Tạm dừng. Thay hạn tự động (làm mất hàng đang chờ khách) bằng hai biện pháp: (1) báo cáo **"giữ chỗ lâu"**: giữ quá N ngày (mặc định 14, tham số theo loại dịch vụ, `[Cần xác nhận: Khách]`) hiện cho QL và nhắc, không tự nhả; (2) việc đối soát **"giữ chỗ mồ côi"**: dòng giữ chỗ mà lệnh chủ đã Hủy/Hoàn tất thì nhả và ghi nhật ký (làm khi có REC).
- Lịch hẹn chưa giữ chỗ phụ tùng (FR-INV-020 chỉ giữ khi duyệt hoặc mở lệnh); đề nghị "đặt phụ tùng trước cho lịch hẹn" là yêu cầu mới, thuộc YM/YK.
- Dev không đổi mã giữ chỗ; chỉ thêm báo cáo ở phần REC/RPT. Có thể thêm `expiresAt` rỗng sẵn nếu rẻ.

#### 16.2.3 I3. Xuất vượt Khả dụng

**Khuyến nghị**: giữ chặn tuyệt đối. `[Đã có trong tài liệu]` (`ba-answers-04` Câu 9: mặc định tắt) cho phần chặn; ngoại lệ `[Cần xác nhận: Chủ dự án]`.

- FR-INV-019 (Must) chỉ yêu cầu "ngoại lệ phải cấu hình và có duyệt"; chưa cấu hình ngoại lệ thì thỏa. RULE-008 "trừ khi chính sách cho phép và có phê duyệt". Dev để ngoại lệ sang sau là hợp lệ.
- Công thức của dev đúng với `ba-answers-04` Câu 9. **Bổ sung** cận thứ ba (xem I8): `tối đa = min(nhu cầu còn lại của chính dòng lệnh, phần giữ của dòng + Khả dụng, Thực tế)`. Không có cận nhu cầu thì ai có quyền xuất cũng lấy được phần Khả dụng cho một lệnh không cần.
- Khi sau này bật ngoại lệ (CH bật theo chi nhánh, QL duyệt kèm lý do): chỉ mượn phần giữ của lệnh khác; lệnh bị mượn phải được đánh dấu thiếu (`unmetQty`) và nhận thông báo; Thực tế không bao giờ âm. Cờ cấu hình tên `cho_phép_xuất_vượt_khả_dụng`, mặc định tắt.

#### 16.2.4 I4. Số lượng thập phân

**Khuyến nghị**: thêm trường `quantityScale` (mặc định 1) vào `Part` ngay, sổ vẫn lưu số nguyên. `[Cần xác nhận: Khách]`

- Chưa có tài liệu nói garage bán dầu theo lít lẻ. Thực tế dầu nhớt, hóa chất, sơn thường tính lít, kg (và FRD §13 mục di chuyển dữ liệu yêu cầu chuẩn hóa đơn vị). Hỏi Khách: dầu bán theo lít lẻ hay theo can; sơn theo gam hay lít.
- Lý do làm ngay: đổi tỉ lệ sau khi đã có phát sinh buộc đổi mọi số nguyên trong sổ; thêm trường từ đầu rẻ hơn. Quy tắc: `quantityScale` chỉ sửa được khi phụ tùng chưa có biến động; mọi phép cộng trừ vẫn số nguyên; hiển thị theo tỉ lệ (1000 hiện 3 chữ số thập phân); giá đơn vị tính trên đơn vị hiển thị, làm tròn nguyên đồng khi thành tiền.
- Nếu Khách xác nhận không cần, trường vẫn vô hại.

#### 16.2.5 I5. Giá vốn

**Khuyến nghị**: giữ loại và đơn vị tính của dev; đổi cách làm tròn; chốt quy tắc từng sự kiện. `[Cần xác nhận: Kế toán khách]` (FR-INV-009 và 027 để `[Cần xác nhận]`; BA-06)

- **Loại**: bình quân gia quyền **di động** (tính lại mỗi lần nhập), vì ví dụ 113.333 của FR-INV-027/UAT-25 chỉ đúng cách này ở thời điểm nhập lần hai. **Đơn vị tính**: theo kho x phụ tùng, vì mỗi chi nhánh một kho (FR-INV-003) và kho tổng là kho của chi nhánh trụ sở (§3). Tổng hợp cấp chi nhánh/công ty là phép cộng giá trị, không tính lại bình quân.
- **Làm tròn (khác dev)**: dev làm tròn đơn giá nửa lên 1 đồng rồi nhân số lượng. Cách này để lại **dư số đồng** trong giá trị tồn khi xuất hết. Khuyến nghị lưu **giá trị tồn nguyên đồng** làm số gốc; giá vốn xuất = `làm tròn(giá trị tồn x SL xuất / tồn thực tế)`; đơn giá bình quân chỉ để hiển thị. Ví dụ để Kế toán ký: nhập 10 x 100.000 và 20 x 120.000 cho giá trị 3.400.000, tồn 30, bình quân 113.333,33 (hiển thị 113.333). Xuất 5: cách của dev 5 x 113.333 = 566.665; cách giá trị `làm tròn(3.400.000 x 5 / 30)` = 566.667, còn lại 2.833.333. Sau đó xuất nốt 25: cách đơn giá để dư 10 đồng, cách giá trị về đúng 0. Xuất hết số lượng thì giá trị tồn **bằng 0**.
- **Xuất**: tại giá bình quân thời điểm xuất; ghi giá vốn vào dòng xuất (không tính lại lịch sử, BA-06 hậu quả).
- **Hoàn kho (HK)**: nhập lại **đúng giá lúc xuất** của dòng PX gốc, giá trị = `làm tròn(giá trị dòng xuất x SL hoàn / SL xuất)` (đồng ý dev, hợp FR-INV-008 "giảm giá vốn của lệnh"); tổng các lần hoàn một dòng không vượt giá trị dòng xuất.
- **Phiếu đảo**: hoàn đúng giá trị dòng gốc (đồng ý dev, RULE-010).
- **Điều chỉnh/kiểm kê**: thiếu tính theo bình quân (đồng ý dev). **Thừa: mặc định giá bình quân hiện tại** (khác dev "bắt buộc nhập giá"), cho sửa giá có lý do, cần duyệt; chỉ khi tồn đang 0 hoặc **tồn đầu kỳ** mới bắt buộc nhập giá. Lý do: ép nhập giá cho mỗi mã thừa khi kiểm kê hàng trăm mã là không thực tế và dễ nhập sai.
- **Chuyển kho**: kho gửi xuất theo bình quân của mình; kho nhận nhập **đúng giá vốn bên gửi** (không phát sinh lãi lỗ nội bộ). Bên nhận có thấy giá vốn không: `[Cần xác nhận: Kế toán khách]` (K6, mặc định không). Hàng nhận thiếu/hỏng: phần chênh lệch treo giữ giá vốn đến khi xử lý.
- **Trả hàng nhà cung cấp, hàng lỗi**: xuất theo bình quân (không tách lô, xem I6); phần chênh với giá nhập đã trả NCC do KT xử lý ngoài 1.4 `[Cần xác nhận: Kế toán khách]`.
- **Đổi phương pháp** (FIFO sau này): hiệu lực chỉ từ đầu kỳ, không tính lại lịch sử, cần lớp lô (I6); `cost-method` chỉ nhận `weighted-average` là đúng ở 1.4.
- Kế toán ký bộ ví dụ (NFR-MNT-01): nhập hai lần, xuất một phần, xuất hết, hoàn một phần hai lần, đảo, kiểm kê thừa thiếu, chuyển kho, làm tròn biên. Cho tới khi ký, test hiện tại là "chưa được ký" như dev ghi.
- Quyền: KT có quyền sửa "Công nợ và giá vốn" (FRD §2) nghĩa là điều chỉnh định giá lại (revaluation); chưa có trong 1.4, ghi vào phạm vi để không bị coi thiếu.

#### 16.2.6 I6. Lô

**Khuyến nghị**: chưa làm lớp lô; sửa chữ của FR-INV-003. `[Cần xác nhận: Kế toán khách, Chủ dự án]`

- FR-INV-003 (Must) "theo lô kèm giá nhập; tổng tồn bằng tổng các lô" mâu thuẫn với phương pháp bình quân, nơi số lượng còn lại theo từng lô không có ý nghĩa tính tiền (BA-06). Với bình quân, "lô" nên hiểu là **dòng nhập** (lớp nhập: ngày, NCC, số lượng, giá nhập, số chứng từ) lưu ở sổ và xem lại được (RULE-009); không cần số lượng còn lại theo lô.
- Tiêu chí kiểm thử của FRD nên đổi thành "tổng tồn của phụ tùng bằng tổng tồn các kho; mỗi dòng nhập truy được về chứng từ" (§16.3). Tới lúc chọn FIFO hoặc cần số lô/serial (FR-INV-024, Could; bảo hành, thu hồi) thì thêm tầng lô; sổ biến động của dev đã có đủ giá nhập từng lần nên dữ liệu cũ dùng được.
- Hỏi Khách: có mặt hàng nào phải truy theo số lô hoặc serial (ắc quy, lốp có DOT) để bảo hành không.

#### 16.2.7 I7. Nhập kho khi chưa có PUR

**Khuyến nghị**: giữ ba nguồn của dev, chỉnh ngưỡng. `[Đề xuất BA – chờ xác nhận: Kế toán khách, Khách]`

- Ba nguồn khớp `ba-answers-04` Câu 8: đơn mua; **yêu cầu mua gấp** (YM có cờ "Mua gấp", đính kèm ảnh hóa đơn/biên lai, hậu duyệt trong hạn mức); "không có đơn mua" dành cho hàng tặng, hàng bù, nhập tồn và **luôn** cần QL duyệt. Dev chỉ kiểm tra có mã tham chiếu vì PUR chưa có: chấp nhận, kèm nhắc rằng kiểm tra tồn tại và đối chiếu số lượng với dòng đơn là việc khi PUR có.
- Lý do cho "không có đơn mua": danh sách cấu hình {hàng NCC tặng, hàng bù/đổi, tồn đầu kỳ (dùng ADJ), khác (ghi chú)}. Tồn đầu kỳ **không** đi qua nhập "không có đơn mua" mà qua ADJ (I10).
- **Ngưỡng lệch (khác dev ở số lượng)**: giá lệch so với dòng đơn > **5%** (hai chiều, tham số theo nhóm hàng, giá trị khởi điểm của dev giữ, `[Cần xác nhận: Kế toán khách]`) cần QL duyệt. Số lượng: **nhận vượt đơn** cần duyệt (ngưỡng 0%); **nhận thiếu là nhận một phần** (Journey: "một đơn có thể nhận nhiều lần"), không cần duyệt, đơn còn mở. Nếu dev đang xếp "lệch số lượng 0%" cả hai chiều vào chờ duyệt thì phải sửa.
- Nhận một phần nhiều lần chưa theo dõi được (cần PUR): chấp nhận. Số hóa đơn nhà cung cấp là trường nhập tay (số của NCC, §6.3), không bắt buộc ở PN; bắt buộc trước khi KT đối chiếu ba bên (FR-ACC, Phase 2).
- Số lượng nhận không âm; PN không sửa sau khi ghi sổ (RULE-010).

#### 16.2.8 I8. Chứng từ gốc của PX và HK

**Khuyến nghị**: giữ ba nguồn của dev; thu hẹp PX cho lệnh. `[Đề xuất BA – chờ xác nhận: Chủ dự án]`

- Ba nguồn (lệnh, bán lẻ, chuyển kho) khớp FR-INV-006 và UAT-02 (không có xuất thủ công). Xuất dùng nội bộ là chứng từ riêng **XN** (FR-INV-023, Should; `ba-answers-04` Câu 4), không dùng PX; chưa làm ở 1.4 là hợp lệ.
- **Khác dev**: FR-INV-007 yêu cầu "thợ chỉ yêu cầu được phụ tùng có trong lệnh" và RULE-007. REC chưa có nên mã lệnh chưa kiểm tra được; để mã tham chiếu tùy ý thì ai cũng xuất được hàng Khả dụng cho một "lệnh" tự đặt. Quy tắc: PX nguồn `repair-order` chỉ ghi sổ khi có **dòng nhu cầu của đúng lệnh và phụ tùng đó** (dòng giữ chỗ hoặc `unmetQty`, bảng I1) và số xuất không vượt nhu cầu còn lại. Không có dòng thì lỗi RFC 9457 "Phụ tùng chưa có trong lệnh". Trước khi có REC, môi trường thử tạo dòng nhu cầu qua lời gọi giữ chỗ.
- Bắt buộc ghi **người nhận (thợ)** cho xuất theo lệnh (FR-INV-007); nên chọn từ danh sách nhân viên của chi nhánh, không gõ tự do.
- **HK** như dev: chỉ từ PX đã ghi sổ, cùng kho, cùng lệnh, tổng hoàn không vượt tổng xuất từng dòng. Thêm: lý do hoàn {thừa/không dùng, cấp nhầm/đổi hàng, hàng lỗi, khác}; hàng lỗi không tăng Khả dụng (chuyển vào xử lý lỗi, FR-INV-027 "hàng lỗi", chưa làm ở 1.4, ghi vào phạm vi); lệnh đã có hóa đơn thì cần điều chỉnh hóa đơn (FR-INV-022, `ba-answers-02` A.2 mục 1). Kho chỉ tăng khi Thủ kho xác nhận nhận (`ba-answers-02` A.2 mục 7), nên HK ghi sổ bởi TK.
- Hoàn tiền khách trả phụ tùng chưa lắp (FR-INV-022, Should): chưa làm.

#### 16.2.9 I9. Phân quyền kho

**Khuyến nghị**: giữ như dev. `[Đã có trong tài liệu]` (FRD §2 các hàng "Nhập, xuất, kiểm kê kho", "Danh mục phụ tùng và bảng giá"; `ba-answers-04` Câu 2, 6) với hai bổ sung `[Đề xuất BA – chờ xác nhận: Chủ dự án]`.

- Đối chiếu FRD §2: hàng "Nhập, xuất, kiểm kê kho" là CH X, QV X, QL D, TK S, KT X, các vai trò khác không có quyền: **khớp** dev (TK lập, QL duyệt, CH/QV/KT xem). Hàng "Danh mục phụ tùng và bảng giá": TK S, CH D, QL X, CV X, KT X, QV X: danh mục do TK lập/sửa, CH duyệt thay đổi quan trọng (giá); dev cần kiểm tra việc QL không sửa danh mục.
- Giá vốn xem: CH, QV, QL, KT; TK không (trừ giá nhập của phiếu PN đang nhận); CV/TN/QĐ/TH che (`ba-answers-04` Câu 2): **khớp** dev. CV chỉ thấy Khả dụng (Câu 6): khớp. Phiếu in không có giá vốn; xuất Excel theo cùng quyền.
- Tách nhiệm vụ: ghi sổ phiếu bất thường (điều chỉnh, nhập không đơn mua, lệch ngưỡng, xuất bất thường, vượt hạn mức) phải do người **khác người lập**, xét theo người kể cả khi một người đủ hai vai trò (FR-SYS-012 cộng quyền, FR-SYS-013): **khớp** nguyên tắc "người đề xuất không tự duyệt" (`ba-answers-02` A.2 mục 3). Phiếu thường (nhập từ đơn đúng giá, xuất theo lệnh trong nhu cầu): TK tự ghi sổ.
- **Bổ sung 1**: giá trị phiếu bất thường vượt hạn mức thì cần cấp trên của QL (QV/CH) theo G4-APR-03 (RULE-011 tinh thần; `ba-answers-04` Phụ lục E); QL là người lập thì người duyệt là cấp trên (`ba-answers-02` A.2 mục 3). Hạn mức là cấu hình, chưa có số.
- **Bổ sung 2**: chuyển kho (FRD hàng "Chuyển kho liên chi nhánh": CH D, QV D, QL S, TK S) khác phiếu thường: QL tạo được. Thuộc slice sau, ghi để khỏi lệch ma trận.
- MH, NS thêm vai trò (Phase 2), không ảnh hưởng 1.4.

#### 16.2.10 I10. Tồn đầu kỳ và điều chỉnh

**Khuyến nghị**: giữ, thêm bốn điều kiện. `[Đề xuất BA – chờ xác nhận: Kế toán khách, Chủ dự án]`

- FRD §Di chuyển dữ liệu: tồn đầu kỳ lấy từ **kiểm kê thực tế cùng thời điểm chuyển đổi, không lấy số Excel làm số cuối**; giá trị tồn từng chi nhánh phải khớp biên bản kiểm kê. Vì thế: (1) phiếu ADJ nguồn `opening-balance` đính kèm **mã biên bản kiểm kê**; (2) tổng giá trị của phiếu phải khớp con số biên bản (hiển thị chênh lệch, không chặn, ghi sổ cần xác nhận); (3) chỉ dùng được trong **cửa sổ chuyển đổi** (mặc định từ ngày khởi tạo kho đến ngày go-live cộng 30 ngày, tham số); sau đó tồn đầu kỳ cần CH duyệt, tránh dùng làm lối tăng tồn; (4) chỉ cho phụ tùng x kho **chưa có biến động**, sai thì dùng ADJ thường hoặc phiếu đảo.
- Lập: TK (hoặc người có quyền lập phiếu kho); ghi sổ: QL, khác người lập (đồng ý dev); dòng âm bị cấm với tồn đầu kỳ; giá nhập bắt buộc.
- Điều chỉnh sai lệch kiểm kê (FR-INV-012): lý do bắt buộc, QL duyệt, chênh lệch vượt ngưỡng cần giải trình (Journey "Kiểm kê"), giá trị lớn lên cấp trên (I9). Điều chỉnh không gắn đợt kiểm kê (KK chưa làm ở 1.4): vẫn cần lý do từ danh sách cấu hình.
- Excel (SYS-007, slice 1.11): công cụ chỉ **tạo phiếu nháp** đúng loại này; duyệt và ghi sổ vẫn qua QL; mỗi lần nhập có mã lô nhập và nhật ký (BA §9 kế hoạch di chuyển).

#### 16.2.11 I11. Định mức tối thiểu, tối đa

**Khuyến nghị**: giữ lưu theo kho x phụ tùng. `[Đề xuất BA – chờ xác nhận: Khách]`

- FR-INV-013 và G3-INV-02 viết "theo chi nhánh", mà FR-INV-003 cho mỗi chi nhánh một kho; kho tổng cũng cần định mức riêng (Journey: kho tổng và kho chi nhánh xem bốn số). Lưu theo kho khớp cả hai; khi một chi nhánh có hơn một kho (kho lốp, kho sơn, §3) thì định mức vẫn theo từng kho, và "chi nhánh dư" (`ba-answers-04` Câu 7) tính trên kho mặc định/kho bán được; ghi lại thành điều cần hỏi khi có chi nhánh nhiều kho.
- Điều kiện cảnh báo: **Khả dụng nhỏ hơn hoặc bằng Tối thiểu** (Câu 7, RULE-008); chưa đặt định mức (rỗng) thì không cảnh báo, định mức 0 cảnh báo khi hết hàng. Dev viết "dưới định mức": kiểm tra là `<=` hay `<`.
- Gợi ý đặt = `max(0, Tối đa - (Khả dụng + Đang vận chuyển + Đã đặt chờ giao))`, làm tròn lên theo quy cách NCC; chưa có Tối đa để trống. "Đã đặt chờ giao" thêm khi có PUR; trước đó dev bỏ phần này là đúng. Gợi ý lấy từ chi nhánh dư: Phase 2; chi nhánh khác chỉ thấy Khả dụng và số có thể cho (P5).
- Tối đa phải lớn hơn hoặc bằng Tối thiểu (kiểm tra khi lưu).

#### 16.2.12 I12. Bảng giá chuẩn và mã phụ tùng

**Khuyến nghị**: giữ `price-item` có hiệu lực; chỉnh bộ ký tự mã; đặt mốc cho hạn mức giảm giá. `[Cần xác nhận: Chủ dự án, Khách]`

- Ai lập bảng giá: §12 câu 4 đề xuất KT và AD lập, CH duyệt, TK không sửa giá bán. Lưu ý FRD §2 hiện ghi TK = S cho hàng "Danh mục phụ tùng và bảng giá" và AD "-"; hai nguồn lệch nhau, ghi vào mâu thuẫn FRD v0.4 (§16.3). Quyết định thuộc Chủ dự án; do ma trận là dữ liệu cấu hình nên không phải sửa mã.
- Dùng cấu hình hiệu lực theo ngày có duyệt cho giá niêm yết: **đúng** nguyên tắc "giá thay đổi là cấu hình có ngày hiệu lực". Giá vốn, giá niêm yết, giá bán thực tế là ba số tách riêng; báo giá giữ phiên bản giá (REC, `ba-answers` giá). Không để màn chi tiết phụ tùng sửa giá trực tiếp là đúng.
- **Bộ ký tự mã phụ tùng**: mã phụ tùng do Khách quy ước (`ba-answers-04` Phụ lục B; `PT-0001` chỉ là mẫu) và Excel di chuyển sẽ mang mã thật của hãng, thường có dấu `/`. Đề xuất cho phép `A-Z 0-9 . _ - /`, tự chuyển chữ hoa, bỏ khoảng trắng đầu cuối, không cho khoảng trắng giữa (khó quét mã vạch); độ dài 2-40 giữ. Mã bất biến sau khi có phát sinh (RULE-009). Công cụ nhập Excel phải có bước báo cáo mã bị chuẩn hóa hoặc trùng (FRD kế hoạch di chuyển: gộp mã trùng).
- **Hạn mức giảm giá theo chi nhánh/chương trình** (FR-INV-025, Must, G3-INV-19): chưa dựng ở 1.4 chấp nhận được **với điều kiện** hoàn tất trước khi REC cho lập báo giá thật (chặn giảm quá hạn mức là điều kiện của UAT liên quan). Hạn mức là cấu hình có hiệu lực, vượt thì QV/CH duyệt.

#### 16.2.13 I13. Màn hình chưa dựng

**Khuyến nghị**: chấp nhận danh sách trì hoãn; đặt ba điều kiện. `[Đề xuất BA]`, chuyển designer, `[Cần xác nhận: Khách]` cho thứ tự ưu tiên.

- Chấp nhận trì hoãn: INV-06 (thuộc REC), INV-11 (XN, Should), quét camera và đợt kiểm kê (FR-INV-011 là Must nhưng là slice KK riêng), lô, đối chiếu ba bên (ACC/PUR), KPI "đang vận chuyển" (khi có CK).
- **Điều kiện 1**: một bố cục chung cho PN, PX, HK, ADJ chấp nhận được **nếu** mỗi loại hiện trường riêng: PN (chứng từ gốc, so sánh với đơn, lệch ngưỡng); PX (lệnh, người nhận, "Giữ chỗ cho lệnh này" trên thẻ, `ba-answers-04` Câu 9 / F4-07); HK (phiếu xuất gốc, lý do hoàn, số có thể hoàn); ADJ (lý do, tồn trước/sau, người duyệt). Nhãn trạng thái dùng bộ của chứng từ kho (Phụ lục A): Nháp, Chờ duyệt, Đã ghi sổ, Từ chối, Đã hủy.
- **Điều kiện 2** (trước pilot): in phiếu A4/A5 không có giá vốn (`ba-answers-04` Câu 2); xuất Excel tồn kho theo quy tắc §9 (giới hạn dòng, nhật ký, chống chèn công thức, theo quyền giá vốn); thay Excel là mục tiêu của dự án nên hai mục này không nên để sau.
- **Điều kiện 3**: bộ chọn phụ tùng cho báo giá (CV) hiện Khả dụng và ngày hàng về, không hiện Thực tế, Giữ chỗ, giá vốn (`ba-answers-04` Câu 6); thuộc REC nhưng dùng dữ liệu INV, cần chuẩn bị API chỉ trả Khả dụng. Ô gõ mã có gợi ý ở 1.4 chấp nhận.
- KPI giá trị tồn: hàng giữ chỗ vẫn nằm trong tồn thực tế; hàng đang đi đường không cộng (`ba-answers-01`); chỉ hiện cho vai trò xem giá vốn.

#### 16.2.14 I14. Nhóm hàng và đơn vị tính

**Khuyến nghị**: biến thành danh mục cấu hình cấp công ty. `[Đề xuất BA – chờ xác nhận: Khách]`

- Danh sách trong mã sẽ sai ngay khi nhập Excel thật: FR-INV-001 cần "nhóm", kế hoạch di chuyển yêu cầu "chuẩn hóa tên và đơn vị, gắn nhóm và dòng xe", và nhóm còn dùng cho thuế suất theo nhóm hàng (FR-ACC-009), đợt kiểm kê theo nhóm (FR-INV-011), ngưỡng hàng chậm luân chuyển (`ba-answers-06`, N ngày theo nhóm hàng), gói "hàng kèm dịch vụ".
- Quy tắc: nhóm hàng và đơn vị tính là danh mục cấp công ty {mã, tên, hoạt động/ngừng}; không xóa khi đã dùng, chỉ ngừng; TK đề xuất, CH duyệt (hàng "Danh mục phụ tùng và bảng giá": TK S, CH D); đổi tên ghi nhật ký. Danh sách hiện có của dev (dầu, lọc, phanh, lốp, điện, treo, động cơ, thân vỏ, vật tư, khác; cái, bộ, cặp, lít, kg, mét, hộp) làm **dữ liệu khởi tạo** (seed), không phải danh sách cứng.
- Nhóm một cấp ở pilot; cây nhóm và quy đổi đơn vị (thùng sang lọ) là yêu cầu sau, hỏi Khách. Nhóm dịch vụ khác nhóm phụ tùng.

### 16.3 Việc cần sửa ở tài liệu (chưa áp dụng) và UAT

| Vị trí | Thay đổi khuyến nghị | Liên quan |
| --- | --- | --- |
| FR-INV-020 | Thêm tiêu chí: giữ chỉ khi khách duyệt hạng mục; duyệt một phần; phát sinh chỉ giữ khi được duyệt; thiếu hàng giữ một phần và lưu phần thiếu; nhả khi hạng mục hủy, hoàn thành, lệnh hủy; không có hạn tự động | I1, I2; UAT-13 |
| UAT-13 | Thêm ca: duyệt một phần, phát sinh được/không được duyệt, xuất một phần, thiếu hàng, hai giao dịch song song, hủy lệnh sau xuất | I1 |
| Journey "Tồn thực tế, giữ chỗ..." | Bước 5 nêu rõ "giữ phần có, phần thiếu vào danh sách thiếu hàng"; thêm bước nhả phần dư | I1 |
| FR-INV-019 | Ghi rõ mặc định chặn tuyệt đối, cờ `cho_phép_xuất_vượt_khả_dụng` | I3 |
| FR-INV-003 | Đổi tiêu chí kiểm thử "tổng các lô" thành "tổng các kho; mỗi dòng nhập truy được về chứng từ" nếu dùng bình quân | I6 |
| FR-INV-027 | Thêm quy tắc từng sự kiện (xuất, hoàn, đảo, điều chỉnh, chuyển kho), làm tròn theo giá trị tồn, bộ ví dụ Kế toán ký | I5; UAT-25 |
| FR-INV-005 | Làm rõ ngưỡng lệch: giá hai chiều, số lượng chỉ nhận vượt; nhận thiếu là nhận một phần | I7 |
| FR-INV-006/007 | Xuất cho lệnh phải có dòng nhu cầu; ghi người nhận | I8; UAT-02 |
| FRD §2 | Ghi lệch giữa hàng "Danh mục phụ tùng và bảng giá" (TK S, AD -) với đề xuất KT/AD lập giá, CH duyệt; thêm hạn mức duyệt phiếu bất thường | I9, I12 |
| FRD §5 mục tiêu tên chứng từ | Mã FRD (GRN, GIN, STO, ADJ, RTN) lệch bảng số chứng từ (PN, PX, CK, DC, HK, TR, XN); RTN của FRD gộp trả NCC và khách trả, bảng §6.3 tách TR và HK: thống nhất một bộ | I8; FR-INV-021 |
| FRD kế hoạch di chuyển (tồn đầu kỳ) | Thêm cửa sổ chuyển đổi, mã biên bản kiểm kê | I10 |
| FR-INV-013 | Làm rõ "theo chi nhánh" = theo kho x phụ tùng; điều kiện `<=` | I11 |
| FR-INV-001 | Nhóm hàng/đơn vị là danh mục cấu hình; ký tự mã phụ tùng; `quantityScale` | I4, I12, I14 |

### 16.4 Câu hỏi chuyển bên quyết định (bổ sung cho §12 và §15.4)

| # | Gửi | Câu hỏi | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- |
| 17 | Chủ dự án | Chốt bảng giữ chỗ 16.2.1; thiếu hàng giữ một phần không backorder; chặn tuyệt đối xuất vượt; ai lập bảng giá; hạn mức giảm giá xong trước khi lập báo giá | Như I1, I3, I12 | Chờ đủ mới giữ làm lệnh dừng; bật ngoại lệ xuất vượt phải có UI và mượn giữ chỗ |
| 18 | Khách | Thiếu hàng có dừng cả hạng mục không; hoàn kho "cấp nhầm" có tự giữ lại; hàng về có tự giữ phần thiếu theo thứ tự duyệt; số ngày cảnh báo giữ chỗ lâu | Dừng hạng mục thiếu, không tự giữ lại, tự giữ **tắt**, 14 ngày | Chỉ đổi cấu hình và quy tắc REC |
| 19 | Khách | Dầu, sơn, hóa chất bán theo lít/gam lẻ không; nhóm hàng và đơn vị tính thật của chuỗi; mã phụ tùng thật có ký tự gì; mặt hàng nào cần số lô/serial | Như I4, I6, I12, I14 | Đổi `quantityScale` hoặc thêm tầng lô |
| 20 | Kế toán khách | Bình quân di động theo kho; làm tròn theo giá trị tồn; chuyển kho mang giá vốn bên gửi; kiểm kê thừa giá bình quân; ngưỡng lệch giá 5%; hoàn kho theo giá lúc xuất; bộ ví dụ ký | Như I5, I7 | FIFO cần tầng lô; làm tròn khác đổi test |
| 21 | Kế toán khách, Chủ dự án | Cửa sổ tồn đầu kỳ và biên bản kiểm kê; hạn mức duyệt phiếu bất thường | Như I9, I10 | Chỉ đổi cấu hình |
