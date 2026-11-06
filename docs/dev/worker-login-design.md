# Thiết kế: đăng nhập cho thợ không có email (P2-C, phương án A của BA)

Trạng thái: **ghi chú thiết kế, chưa code. Chờ chủ dự án xác nhận** vì chạm RULE-034 và FR-TEN-016, 017 (định danh duy nhất là email). Nguồn: `docs/dev/phase-2-plan.md` mục 14.4; `ba-answers-for-dev.md` §1.6, D-03. Mã hiện tại: `src/modules/sys/application/auth.ts` (`login`), `src/modules/sys/domain/entities.ts` (`identityOf`), `src/infrastructure` (cổng `identity`, `throttle`, `strongAuth`).

## 1. Hiện trạng và vấn đề

`login()` chỉ nhận email: nó tra `findMembershipsByEmail`, gọi `identity.signInWithPassword(email, password)` cho mọi lần thử (kể cả email lạ, dùng địa chỉ mồi `DECOY_EMAIL`) để thời gian trả lời đồng đều, rồi tạo phiên gắn đúng một tư cách thành viên (một tenant). Mã nhân viên chỉ duy nhất trong tenant (RULE-018) nên không thể là tên đăng nhập. Hệ quả: thợ không có email không đăng nhập được.

## 2. Phương án A (BA)

Người dùng nhập **mã công ty + mã nhân viên + mật khẩu**. Hệ thống ánh xạ cặp (mã công ty, mã NV) sang một **định danh nội bộ không nhận thư**, rồi đi tiếp đúng đường đăng nhập hiện có. Tài khoản loại này: một tư cách thành viên duy nhất, không có kênh khôi phục, quản lý đặt lại mật khẩu tạm (buộc đổi lần đầu), lỗi trung lập như thường (UAT-TEN-21). Thợ dùng hằng ngày tablet xưởng với PIN (AUT-10, `StrongAuthPort`, do chủ dự án cung cấp sau); mật khẩu chỉ khi cần.

## 3. Cách lưu định danh nội bộ (đề xuất)

- Thêm `User.loginKind: 'email' | 'employee_code'` (mặc định `email`, tài khoản cũ không đổi) và `User.loginAlias` (chỉ với `employee_code`).
- Định danh cho nhà cung cấp danh tính (Firebase Auth) là một địa chỉ giả sinh ra: `w-<tenantSlug>-<maNV chuẩn hóa>@workers.gmep.invalid`. Tên miền `.invalid` (RFC 2606) không bao giờ nhận thư, không gửi được thư khôi phục, và không va chạm email thật. `identityId` của `User` vẫn là uid của nhà cung cấp, nên `identityOf`, `Session.identityId` và phần còn lại của phiên **không đổi**.
- Địa chỉ giả chỉ có trong máy chủ: không hiển thị, không ghi vào nhật ký đầy đủ, không đưa lên DTO (chỉ mã NV hiện như bình thường).
- Ràng buộc duy nhất: mã công ty (slug tenant, đã duy nhất toàn nền tảng) cộng mã NV chuẩn hóa. Vì mã NV bất biến (BA §1.6) nên địa chỉ giả bất biến; đổi mã công ty (nếu cho phép) phải đi qua một lệnh quản trị đồng bộ lại địa chỉ giả, hoặc **cấm đổi slug** khi còn tài khoản loại này (đề xuất, đơn giản hơn).
- `usable.length` luôn là 1 với loại này: không bao giờ vào bước "Chọn công ty"; RULE-034 vẫn giữ cho tài khoản email (một email nhiều tenant).

## 4. Ảnh hưởng theo thành phần

- **Màn đăng nhập (AUT-01):** thêm lối "Đăng nhập bằng mã nhân viên" (ô mã công ty, mã NV, mật khẩu). Không đoán loại từ nội dung ô để tránh lộ thông tin; hai tab hoặc một công tắc rõ ràng. Việc của designer.
- **`login()`:** tách bước giải định danh: `resolveLoginIdentity(input)` trả `{ identityEmail, membership | null }`. Nhánh email như cũ; nhánh mã NV tìm tenant theo slug rồi user theo mã NV trong tenant, và **luôn** gọi `signInWithPassword` với địa chỉ giả tìm được hoặc địa chỉ mồi, đúng tinh thần UAT-TEN-21(a). Phần còn lại (throttle, `strongAuth.requirementFor`, tạo phiên, audit) dùng chung.
- **Phiên và `resolveScope`:** không đổi. Phiên vẫn gắn một membership và một tenant; `resolveScope` vẫn lấy `tenantId` từ phiên. Chỉ cần bảo đảm `usableMemberships` loại tài khoản đã khóa hoặc tenant không dùng được như hiện nay.
- **Tạo người dùng (FR-SYS-001):** quản lý (có `user:create`) tạo thợ không email: nhập tên, mã NV (hoặc cấp tự động theo `numbering`), vai trò TH, chi nhánh; hệ thống sinh **mật khẩu tạm** ngẫu nhiên đủ mạnh, hiển thị đúng một lần, cờ `mustChangePassword`. Không gửi thư. Hồ sơ nhân sự (HRM `employeeUserLinks`) liên kết như hiện nay.
- **Đặt lại mật khẩu:** chỉ quản lý có quyền (`user:reset-password` mới, theo hành động, không theo tên vai trò), cùng chi nhánh trong phạm vi; sinh mật khẩu tạm mới, thu hồi mọi phiên và token của định danh, buộc đổi lần đầu. Không có "quên mật khẩu" tự phục vụ cho loại này.
- **Đổi mật khẩu lần đầu:** màn buộc đổi trước khi vào hệ thống; phiên ở trạng thái "chỉ được đổi mật khẩu" cho đến khi xong (tương tự phiên chờ chọn tenant).
- **PIN tablet xưởng (AUT-10):** cắm vào `StrongAuthPort.requirementFor` sau khi chủ dự án cung cấp phương án; thiết kế này không phụ thuộc vào nó. PIN chỉ là yếu tố bổ sung trên thiết bị đã đăng ký, không thay mật khẩu.

## 5. Chống dò mã công ty và mã nhân viên

1. **Lỗi trung lập duy nhất** cho: mã công ty không tồn tại, mã NV không tồn tại, mật khẩu sai, tài khoản khóa, tenant không dùng được. Cùng thông điệp, cùng mã HTTP, cùng thân phản hồi.
2. **Thời gian đồng đều:** luôn thực hiện đúng một lần `signInWithPassword` (địa chỉ thật hoặc mồi) và đúng chuỗi thao tác đọc cố định; không thoát sớm. Test đo phân bố thời gian của bốn trường hợp (như UAT-TEN-21(a)) với ngưỡng tương đối.
3. **Giới hạn tần suất:** mở rộng `throttle` với ba bộ đếm hiện có (thiết bị, tên, địa chỉ IP) theo khóa chuẩn hóa `slug|maNV`, đếm cả lần thử với cặp không tồn tại như cặp có thật (đã đúng tinh thần "unknown names feed the same counters"); thêm bộ đếm theo **mã công ty** riêng (chống quét mã NV trong một công ty) và theo IP.
4. **Không có điểm cuối kiểm tra tồn tại** (không có "mã công ty hợp lệ?" trước khi nhập mật khẩu); ô mã công ty không tự gợi ý hay tự hoàn thành.
5. **Khóa tài khoản:** vượt ngưỡng thì khóa tạm theo bộ đếm của ba-answers §1.4 (không ghi theo tài khoản ở giai đoạn 2, FRD-SYS-014 đã sửa), thời gian khóa tăng dần; quản lý mở khóa bằng đặt lại mật khẩu tạm. Khóa không lộ ra ngoài lỗi trung lập.
6. **Mật khẩu tạm:** ngẫu nhiên từ CSPRNG, hết hạn nếu không dùng trong N giờ (cấu hình, `[Cần xác nhận]`), dùng được một lần (buộc đổi); không ghi vào nhật ký hay log.

## 6. Nhật ký (FR-SYS-003) và dữ liệu cá nhân

Ghi: tạo tài khoản (ai tạo, ai là chủ), đặt lại mật khẩu (ai đặt lại cho ai, lý do), đăng nhập thành công (như hiện nay), đổi mật khẩu lần đầu, mở khóa. **Không** ghi: mật khẩu tạm, địa chỉ giả, mã công ty và mã NV của lần thử thất bại (chống biến nhật ký thành bảng dò).

## 7. Test cần có

- Cô lập: cùng mã NV0001 ở hai tenant không lẫn (đăng nhập tenant A không vào được tenant B, địa chỉ giả khác nhau).
- Thời gian đồng đều: mã công ty lạ, mã NV lạ, mật khẩu sai, tài khoản khóa cùng một phân bố.
- Không lộ tồn tại: thân và mã phản hồi giống hệt nhau trong bốn trường hợp; không có dấu hiệu khác ở tiêu đề hay cookie.
- Giới hạn tần suất và khóa: vượt ngưỡng khóa cả cặp có thật lẫn cặp không có thật như nhau; mở khóa bằng đặt lại.
- Mật khẩu tạm: buộc đổi lần đầu, chỉ dùng một lần, hết hạn; đặt lại thu hồi phiên cũ; quyền đặt lại theo hành động và phạm vi chi nhánh (quản lý chi nhánh khác bị từ chối).
- Hồi quy: đăng nhập email, đa tenant ("Chọn công ty"), phiên một tenant (RULE-026, 034), `resolveScope` không đổi.
- Tài khoản loại này không thể được thêm vào tenant khác và không có quy trình khôi phục (test).

## 8. Ước lượng công

Khoảng 6 đến 8 ngày dev: mô hình và migration nhẹ (1), `login` và giải định danh (1,5), tạo/đặt lại/đổi mật khẩu lần đầu cùng quyền (2), throttle và chống dò (1,5), màn hình AUT-01 và màn quản lý (1 cộng thời gian designer), test và tài liệu (1 đến 2). PIN tablet (AUT-10) ngoài ước lượng, phụ thuộc phương án của chủ dự án.

## 9. Rủi ro

- **RULE-034 và FR-TEN-016, 017:** thêm một kiểu định danh thứ hai; cần chủ dự án xác nhận và BA ghi vào FRD trước khi code.
- **Không có kênh khôi phục:** thợ quên mật khẩu phụ thuộc vào quản lý; cần quy trình ở xưởng và checklist go-live.
- **Địa chỉ giả phụ thuộc slug tenant:** cấm đổi slug hoặc có lệnh đồng bộ; nếu sau này nhà cung cấp danh tính đổi cách xử lý địa chỉ `.invalid`, cần kiểm lại (xác minh trên Firebase Auth thật, hiện chỉ chạy trên emulator).
- **Dò mã:** mã NV có thể đoán được (tuần tự); phòng thủ dựa vào giới hạn tần suất và lỗi trung lập, không dựa vào việc mã bí mật. Mật khẩu tạm mạnh và buộc đổi giảm rủi ro.
- **PIN chưa có:** thợ ở tablet dùng chung vẫn phải gõ mật khẩu cho đến khi AUT-10 xong; mật khẩu dài khó gõ trên tablet là rủi ro vận hành.
- **Nếu pilot chưa có thợ đăng nhập** (chỉ QĐ, QL, CV có email) thì việc này không chặn pilot (phase-2-plan 14.4); ghi trạng thái ở `docs/dev/status.md`.
