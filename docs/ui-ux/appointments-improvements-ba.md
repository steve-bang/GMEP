# Cải tiến màn Lịch hẹn: tab theo nhóm, lý do hủy, dời lịch, phần chọn ngày

Phiên bản 0.1 · 07/11/2026 · Người lập: BA · Trạng thái: **BA đề xuất theo yêu cầu của chủ dự án, chờ khách xác nhận** (mục `[Cần xác nhận]` là việc của Khách hoặc Chủ dự án; dev làm theo mặc định trong tài liệu này, mọi mặc định là cấu hình có ngày hiệu lực, không viết cứng).

Căn cứ: FRD FR-REC-019, 027, 035 (và FR-REC-044 đến 047 mới); BRD BR-REC-09; RULE-010 (không xóa), RULE-019 (đổi cấu hình không sửa chứng từ cũ), RULE-024/028 (đồng ý nhận tin); `docs/ui-ux/phase-2-gaps.md` mục 2.8; `design/g2-workshop/g2-apt-01..04.html`; `docs/dev/phase-2-plan.md` (slice 2.8b, Q64 đến Q90); hiện trạng dựng ở nhánh `feat/p2-8b-appointments` (`docs/dev/status.md` mục Slice 2.8b, `src/modules/rec/application/appointments.ts`, `src/modules/rec/domain/appointment.ts`).

Ghi chú nguồn: lệnh `git show origin/feat/appointment-ui:...` không chạy được trong phiên này (BA không có công cụ shell). BA đọc cùng mã slice 2.8b từ các worktree trong `.claude/worktrees/` (cùng nội dung `appointments.ts`, `appointment.ts`, `status.md`). **Dev đối chiếu lại với nhánh `feat/appointment-ui`** nếu nhánh đó đã đổi máy trạng thái hoặc API.

## 0. Hiện trạng và khoảng trống phát hiện

Đã có (theo mã): bốn trạng thái lưu `pending`, `arrived`, `cancelled`, `no_show`; `pending` đi tới `arrived` (mở hồ sơ tiếp nhận cùng giao dịch), `cancelled` (bắt buộc lý do, tối thiểu 3 ký tự, văn bản tự do), `no_show` (chỉ từ ngày hẹn); ba kết quả là cuối. Công suất theo ngày, vượt thì `409 capacity_exceeded` và đặt tiếp khi `acknowledgeOverCapacity`. `PATCH` cho đổi ngày, giờ, cố vấn, dịch vụ, ghi chú. Danh sách đọc một chi nhánh tối đa 7 ngày, lọc trạng thái trong bộ nhớ (`listMax` 500). Ghi đều có `Idempotency-Key`, `version`, nhật ký.

| # | Khoảng trống hoặc mâu thuẫn | Xử lý |
| --- | --- | --- |
| G1 | `PATCH` đổi ngày hoặc giờ **không cần lý do và không lưu lịch sử** (chỉ có dòng nhật ký `appointment.update`) | Chuyển đổi ngày giờ sang hành động Dời lịch (mục 3); `PATCH` chỉ còn sửa cố vấn, dịch vụ, ghi chú |
| G2 | Thông báo `capacity_exceeded` trong `appointments.ts` ghép **ngày dạng yyyy-MM-dd** ("Ngày 2026-11-03 đã có..."), trái yêu cầu dd/MM/yyyy | Sửa theo mục 4.4; đã có sẵn `isoToVi` ở `src/platform/format/date.ts` |
| G3 | Lý do hủy là văn bản tự do tối thiểu 3 ký tự; prototype G2-APT-01 ghi "tối thiểu 5 ký tự" | Thay bằng danh mục (mục 2); chốt **3 ký tự cho lý do Khác** theo chủ dự án; designer sửa gợi ý trên màn |
| G4 | Prototype có nhãn "Chờ tiếp nhận (khách bấm đã đến)", "Đã hẹn", "Chờ xác nhận", "Không đến"; máy trạng thái chỉ có bốn trạng thái | Quy ước nhãn ở mục 1.7; "Chờ xác nhận" thuộc FR-REC-035 (đặt trực tuyến, chưa dựng); "Chờ tiếp nhận" **chưa có trong FRD**, xem câu hỏi 91 |
| G5 | Prototype G2-APT-02 có "mức đặt tối đa 120%, vượt thì Quản lý duyệt"; mã và FR-REC-019 chỉ **cảnh báo, không chặn** | Dời lịch theo FR-REC-019 (cảnh báo và xác nhận). Mức 120% là đề xuất thiết kế chưa có FR; không dựng cho đến khi khách xác nhận |
| G6 | Câu hỏi của dev (status.md câu 6): "vắng" có tự đánh cuối ngày không; có khung giờ và công suất theo giờ không | BA trả lời ở mục 1.2 (không tự đánh) và mục 3.6 (công suất vẫn theo ngày) |
| G7 | Tổng số chỉ mục: branch 2.8b ghi 171/200, `CLAUDE.md` ghi 192/200 trên nhánh chính (D1 ở phase-2-plan) | Dev đo bằng `pnpm check:indexes` sau khi gộp nhánh; ngưỡng thất bại 195 |

## 1. Tab của danh sách lịch hẹn (FR-REC-044)

### 1.0 Chủ dự án đã chốt (07/11/2026) và tên gọi BA đề xuất

**Định nghĩa đã chốt:** lịch ở trạng thái chờ mà **không có khách đến đúng giờ hẹn**. Ví dụ hẹn 08:00, từ 08:01 vẫn chưa bấm "Đã đến" thì lịch thuộc nhóm này. Nghĩa là **thời gian châm chước mặc định = 0 phút** (tham số cấu hình `overdueGraceMinutes` theo chi nhánh, có hiệu lực theo ngày, để chi nhánh nới nếu muốn), tính theo giờ Việt Nam, **không chờ hết ngày**. Các mặc định "30 phút" và chế độ `end_of_day` ở bản nháp đầu của tài liệu này bị thay thế.

**Tên gọi: tab và nhãn "Trễ hẹn"** (thay cho "Quá hạn" ở bản nháp đầu).

| Ứng viên | Đánh giá |
| --- | --- |
| **Trễ hẹn** (chọn) | Mô tả đúng việc đang xảy ra (khách chưa đến sau giờ hẹn) và **chưa kết luận**; người dùng không hiểu nhầm là khách đã bỏ. Ngắn, vừa tab điện thoại. Khớp cách nói ở xưởng ("khách trễ hẹn") |
| Quá giờ hẹn | Đúng nghĩa nhưng dài hơn, dễ đọc như một kết luận; dùng làm phần giải thích dưới tab ("Quá giờ hẹn, chưa đến") |
| Quá hạn | Nghe như hết hiệu lực hay đã hỏng, và giống "quá hạn thanh toán" của công nợ (ACC); bỏ |

**Phân biệt "Trễ hẹn" và "Vắng":**

| | Trễ hẹn | Vắng |
| --- | --- | --- |
| Bản chất | Trạng thái **tính khi đọc**, chưa kết thúc | Trạng thái lưu `no_show`, **đã kết thúc** |
| Ai tạo ra | Thời gian trôi qua | Nhân viên xác nhận "khách không đến" |
| Làm tiếp được | Đã đến, Dời lịch, Hủy, Đánh dấu vắng | Không (chỉ xem; khách quay lại thì tạo lịch mới) |
| Màu và chữ nhãn | Cảnh báo (vàng), chữ "Trễ hẹn" | Trung tính, chữ "Vắng" |
| Thống kê | Hàng đợi việc, mục tiêu về 0 | Tỷ lệ khách vắng |

Nhãn trên dòng: "Trễ hẹn" kèm số phút trễ ("Trễ 25 phút", "Trễ 1 giờ 10 phút", sang ngày khác thì "Trễ 2 ngày"), tính theo giờ máy chủ. **Hành động nhanh** trên dòng trễ hẹn: **Gọi khách** (mở liên kết gọi điện trên điện thoại; số điện thoại hiện theo quy tắc che theo vai trò, FR-SYS PII), **Dời lịch**, **Đánh dấu vắng**; hành động phụ: Đã đến, Hủy. Chủ dự án chưa chốt thuật ngữ chính xác nên đây là đề xuất, xem câu 93.

### 1.1 Quyết định: "Trễ hẹn" là nhãn tính khi đọc, không phải trạng thái thứ năm

| Phương án | Ưu | Nhược | Chọn |
| --- | --- | --- | --- |
| A. Tính khi đọc: `pending` và giờ hiện tại > giờ hẹn + ngưỡng | Không cần công việc nền; không lệch giờ; đổi ngưỡng có hiệu lực ngay; giữ bốn trạng thái, FR-REC-027 không đổi | Truy vấn phải tính theo thời gian; cần chỉ mục theo trạng thái (mục 5.1) | **Có** |
| B. Lưu trạng thái `overdue` do công việc nền đặt | Lọc dễ | Cần scheduler theo tenant; sai lệch khi công việc nền chậm; thêm trạng thái và đường chuyển (đổi FRD, Journey, UAT); đổi ngưỡng phải quét lại | Không |

Lý do chọn A: trễ hẹn là **hệ quả của thời gian**, không phải hành động của người; nhân viên chỉ làm bốn việc từ lịch trễ hẹn (Đã đến, Vắng, Hủy, Dời). Máy trạng thái tách rời năm đối tượng của GMEP không bị thêm trạng thái.

Công thức (múi giờ `Asia/Ho_Chi_Minh`, giờ máy chủ, không dùng đồng hồ trình duyệt): `trễ hẹn` khi `status = pending` và `now > (date + time) + overdueGraceMinutes`, mặc định `overdueGraceMinutes = 0` (hẹn 08:00 thì 08:00:59 chưa trễ vì còn trong phút 08:00; từ 08:01 là trễ hẹn). Giờ hẹn là HH:mm nên so sánh theo phút: trễ khi phút hiện tại sau phút hẹn cộng châm chước.

### 1.2 Định nghĩa năm tab

| Tab | Điều kiện | Sắp xếp | Ghi chú |
| --- | --- | --- | --- |
| **Sắp tới** (mặc định) | `pending`, giờ hẹn chưa tới (hoặc còn trong thời gian châm chước) | Ngày rồi giờ, tăng dần | Với châm chước 0, lịch rời tab này ngay khi qua phút hẹn. Nếu chi nhánh đặt châm chước lớn hơn 0 thì lịch còn trong khoảng đó ở lại đây kèm nhãn "Trễ N phút" bằng chữ |
| **Trễ hẹn** | `pending` và `now` sau giờ hẹn cộng châm chước (1.0, 1.1), cả hôm nay lẫn các ngày trước | Trễ lâu nhất lên đầu | Danh sách việc cần xử lý, mục tiêu về 0; có hành động nhanh Gọi khách, Dời lịch, Đánh dấu vắng; lịch tồn quá `staleDays` (mặc định 30, `[Cần xác nhận]`, câu 92) gắn nhãn "Tồn đọng" |
| **Đã đến** (nhãn do chủ dự án gọi "Đã xong") | `arrived` | Giờ đến giảm dần | Mỗi dòng có liên kết hồ sơ tiếp nhận. Xem câu hỏi 93 về tên nhãn: "Đã xong" dễ bị hiểu là sửa xong xe, trong khi trạng thái này chỉ là khách đã đến và có hồ sơ tiếp nhận; BA khuyến nghị nhãn **"Đã đến"** |
| **Đã hủy** | `cancelled` | Thời điểm hủy giảm dần | Hiện lý do (tên theo danh mục), người hủy, thời điểm |
| **Vắng** | `no_show` | Ngày hẹn giảm dần | Hiện người đánh dấu và thời điểm |

**Vắng: tab riêng hay gộp với Trễ hẹn.** Khuyến nghị tab riêng. Lý do: Trễ hẹn là việc **còn phải làm** (chưa có kết luận), Vắng là **kết quả đã chốt** (cuối, không sửa); gộp thì danh sách việc không bao giờ về 0 và nhân viên khó biết còn việc gì. Chi phí: năm tab, trên điện thoại tab cuộn ngang. Ngoài ra lịch `no_show` vẫn giữ chỗ trong công suất của ngày đã qua nhưng không ảnh hưởng ngày mới (công suất tính theo ngày).

**Vắng có tự động không.** Khuyến nghị **không tự động** (trả lời câu 6 của dev): hệ thống không đủ thông tin để biết khách không đến hay chỉ đến muộn hoặc quên bấm; tự đánh sẽ bóp méo tỷ lệ vắng. Trễ hẹn đóng vai trò nhắc. Có thể thêm tham số tự đánh vắng sau N ngày (mặc định tắt, `[Cần xác nhận]`, câu 92). Quy tắc hiện có (đánh vắng được từ ngày hẹn) giữ nguyên; BA lưu ý có thể đánh vắng lúc 08:00 cho lịch 15:00 (có thể siết thành "chỉ khi đã trễ hẹn", câu 92).

### 1.3 Bộ đếm và ngày đang xem

- Mỗi tab có bộ đếm số dòng đúng bằng số dòng của danh sách khi mở tab (cùng một điều kiện lọc phía máy chủ, không đếm riêng bằng cách khác). Khi bị cắt ở giới hạn đọc thì hiện "500+" (theo `truncated` hiện có), không hiện số sai.
- **Bốn tab Sắp tới, Đã đến, Đã hủy, Vắng** theo khoảng ngày đang chọn (Ngày hoặc Tuần, ngày hẹn nằm trong khoảng). **Tab Trễ hẹn không theo ngày đang xem**: luôn hiện mọi lịch trễ hẹn của chi nhánh. Lý do: nếu theo ngày xem thì lịch trễ hẹn của hôm qua biến mất khi nhân viên đang xem hôm nay, đúng chỗ dễ bỏ sót. Tab này ghi rõ "Không phụ thuộc ngày đang xem" bằng chữ.
- Khi có lịch trễ hẹn, màn hiển thị một thông báo (alert warning) "Có N lịch trễ hẹn chưa xử lý" dẫn tới tab Trễ hẹn, hiện ở mọi tab. Tab mặc định vẫn là Sắp tới (dễ đoán, không tự nhảy tab); chủ dự án có thể đổi thành "mở tab Trễ hẹn khi có lịch trễ hẹn" (câu 91).
- Tab đang chọn và khoảng ngày nằm trong địa chỉ trang (tải lại hoặc gửi liên kết vẫn đúng tab).
- Thanh công suất ngày (FR-REC-019) giữ nguyên, hiện ở tab Sắp tới và theo ngày đang xem; ở chế độ Tuần là một hàng nhãn theo từng ngày. Lưới giờ của prototype (ngày/tuần) giữ như cách xem thay thế của tab Sắp tới; thiết kế cụ thể do designer đề xuất.

### 1.4 Trạng thái rỗng (nội dung gợi ý, designer hoàn thiện)

| Tab | Tiêu đề | Hành động |
| --- | --- | --- |
| Sắp tới | "Chưa có lịch hẹn trong khoảng này" | Tạo lịch hẹn; Tiếp nhận xe vãng lai |
| Trễ hẹn | "Không có lịch trễ hẹn" (kèm "Tất cả lịch đã được xử lý") | Không |
| Đã đến | "Chưa có lịch nào được tiếp nhận trong khoảng này" | Không |
| Đã hủy | "Không có lịch bị hủy trong khoảng này" | Không |
| Vắng | "Không có khách vắng trong khoảng này" | Không |

Cộng thêm các trạng thái chuẩn của hệ thống thiết kế: đang tải, lỗi (mã `ERR-APT-...` như prototype), không có quyền, mất mạng (chỉ cảnh báo).

### 1.5 Quyền xem

Theo quyền hiện có `appointment:view`: CV, QL, CH xem và thao tác; QV, QĐ, TN chỉ xem (alert "Bạn chỉ xem lịch" như prototype). Tab Trễ hẹn, Đã hủy, Vắng cùng quyền xem, không tách thêm. Phạm vi chi nhánh theo Scope (NFR-ISO-01): mọi tab, bộ đếm và xuất đều trong chi nhánh và tenant của người dùng. Ghi chú lý do "Khác" là văn bản tự do có thể chứa dữ liệu cá nhân: màn hiện gợi ý "Không ghi số điện thoại hay địa chỉ vào ghi chú".

### 1.6 Thao tác theo tab

| Tab | Thao tác trên dòng |
| --- | --- |
| Sắp tới | Đã đến, Dời lịch, Hủy, Sửa (cố vấn, dịch vụ, ghi chú) |
| Trễ hẹn | Nhanh: Gọi khách, Dời lịch, Đánh dấu vắng. Phụ: Đã đến, Hủy |
| Đã đến, Đã hủy, Vắng | Chỉ xem (mở hồ sơ tiếp nhận ở Đã đến). Muốn khách quay lại thì tạo lịch mới |

### 1.7 Nhãn hiển thị (không đổi trạng thái lưu)

`pending` chưa trễ hẹn: "Đã hẹn"; `pending` trễ hẹn: "Trễ hẹn"; `arrived`: "Đã đến"; `cancelled`: "Đã hủy"; `no_show`: "Vắng". Nhãn "Chờ xác nhận" thuộc FR-REC-035 (khi dựng). "Chờ tiếp nhận (khách bấm đã đến)" trong prototype chưa có FR và chưa có trạng thái: designer gắn nhãn "chờ nghiệp vụ xác nhận" cho đến khi có câu trả lời (câu 91).

## 2. Danh mục lý do hủy (FR-REC-045)

### 2.1 Quyết định

Lý do hủy là **danh mục cấu hình theo tenant**, có hiệu lực theo ngày (cùng cơ chế cấu hình hiện có, như `decline-reason` của R32), không viết cứng trong mã. Người chọn một lý do; lịch lưu **mã ổn định** và **tên lý do tại lúc hủy** (đổi tên hay ngừng dùng lý do sau này không làm đổi lịch sử, RULE-019). Chọn danh mục thay vì văn bản tự do vì chỉ danh mục mới thống kê được; vẫn giữ ô ghi chú cho chi tiết.

Mỗi dòng danh mục: `code` (ổn định, không đổi, không dùng lại), tên hiển thị tiếng Việt, `active`, thứ tự, `requiresNote`, `party` (bên: `customer` khách, `garage` xưởng, `other`; phục vụ thống kê), ngày hiệu lực. Mã `other` là mã hệ thống: luôn có, không ngừng dùng được, luôn `requiresNote`.

### 2.2 Danh sách mặc định (mẫu, `[Cần xác nhận]` câu 94)

| Mã | Tên hiển thị | Bên | Ghi chú bắt buộc |
| --- | --- | --- | --- |
| `customer_request` | Khách yêu cầu hủy | khách | Không |
| `customer_busy` | Khách bận hoặc đổi kế hoạch | khách | Không |
| `fixed_elsewhere` | Xe đã sửa ở nơi khác | khách | Không |
| `not_needed` | Xe không còn cần dịch vụ | khách | Không |
| `unreachable` | Không liên lạc được với khách | khách | Không |
| `duplicate_or_mistake` | Trùng lịch hoặc đặt nhầm | xưởng | Không |
| `garage_unable` | Xưởng không nhận được (hết công suất, thiếu thợ) | xưởng | Không |
| `other` | Khác | khác | **Có, tối thiểu 3 ký tự** |

Ở hộp thoại hủy, dòng gợi ý khi chọn "Khách bận hoặc đổi kế hoạch": "Khách chỉ muốn đổi ngày giờ? Dùng Dời lịch để giữ mã lịch và lịch sử." (tránh hủy rồi tạo lại).

### 2.3 Quy tắc

1. Hủy bắt buộc chọn một lý do. Lý do `requiresNote` bắt buộc ghi chú đã cắt khoảng trắng đầu cuối, độ dài tối thiểu **3 ký tự** (tham số cấu hình `noteMinLength`, mặc định 3), tối đa 300. Các lý do khác cho phép ghi chú tùy chọn.
2. Lý do đã ngừng dùng không xuất hiện ở danh sách chọn nhưng vẫn hiện đúng tên ở lịch đã hủy trước đó.
3. Lịch lưu khối `cancellation`: `reasonCode`, tên lý do tại lúc hủy, ghi chú, người hủy, thời điểm hủy. Nhật ký `appointment.cancel` ghi cùng nội dung (người, thời điểm, mã, ghi chú, tenant, chi nhánh).
4. Hủy theo hiện trạng vẫn cần `Idempotency-Key` và `version`; hủy hai lần cùng khóa chỉ hủy một lần.
5. Lịch hủy trước khi có danh mục (dữ liệu hiện có, chỉ văn bản) hiển thị văn bản cũ với nhãn "Lý do nhập tự do" và mã `legacy`; không được báo cáo như một lý do thật (dev quyết cách chuyển, dữ liệu hiện chỉ là mẫu).
6. Ai sửa danh mục: đề xuất ở mức tenant do QL, CH duyệt (cùng quyền như `appointment-policy`). Thay đổi danh mục có nhật ký.
7. Cô lập tenant: danh mục thuộc tenant; tenant khác không thấy mã hay tên của tenant này; hai tenant được phép có cùng mã.

### 2.4 Yêu cầu dữ liệu cho thống kê lý do hủy (chưa bắt buộc làm báo cáo)

Mỗi lịch hủy phải đủ trường để sau này đếm theo: mã lý do, bên, chi nhánh, cố vấn, loại dịch vụ, ngày hẹn, ngày hủy, **khoảng cách giữa lúc hủy và giờ hẹn** (suy ra từ hai mốc), người hủy. Chỉ tiêu gợi ý (RPT sau, mức Could, chưa gán mã FR): số lịch hủy và tỷ lệ hủy theo lý do, theo bên, theo chi nhánh, theo kỳ; tỷ lệ hủy sát giờ. Báo cáo chỉ nằm trong phạm vi tenant và chi nhánh được xem.

## 3. Dời lịch (FR-REC-046)

### 3.1 Quyết định: không thêm trạng thái; dời là sự kiện của cùng một lịch, có lịch sử

| Phương án | Hệ quả | Chọn |
| --- | --- | --- |
| A. Giữ một lịch, đổi ngày giờ qua hành động Dời lịch, ghi **lịch sử dời** nối thêm (không sửa) | Mã `LH-` giữ nguyên; trạng thái vẫn `pending`; công suất ngày cũ nhả, ngày mới tính; thống kê số lần dời đọc trực tiếp từ lịch sử | **Có** |
| B. Trạng thái mới "Đã dời" và tạo lịch mới | Hai mã cho một cam kết với khách; dễ đếm trùng công suất; hai lịch cùng chờ; gán lại cố vấn, ghi chú, liên kết; thêm trạng thái vào máy trạng thái, FRD, Journey, UAT | Không |

Lý do: khách chỉ có **một cuộc hẹn** được dời; trạng thái mô tả kết quả của cuộc hẹn (đến, hủy, vắng), còn "dời" là thay đổi thời gian của cuộc hẹn đang chờ. Máy trạng thái giữ `pending -> arrived | cancelled | no_show`; thêm sự kiện `reschedule` từ `pending` về `pending` (tương tự `edit` hiện có). **Mã lịch giữ nguyên.**

Chỉ dời được lịch ở `pending` (kể cả trễ hẹn). `arrived`, `cancelled`, `no_show` không dời; khách quay lại thì tạo lịch mới.

### 3.2 Dữ liệu một lần dời

Mỗi lần dời nối thêm một dòng (bất biến) vào lịch sử dời của lịch: ngày giờ cũ, ngày giờ mới, mã lý do và tên lý do tại lúc dời, ghi chú, **bên đề nghị** (`customer` khách đề nghị, `garage` xưởng đề nghị), người dời, thời điểm dời, cờ "dời sát giờ", cờ "vượt công suất đã xác nhận", cách báo khách (xem 3.7). Lịch giữ thêm số lần đã dời và ngày giờ hẹn ban đầu. Mỗi dòng mang `tenantId`, `branchId` của lịch.

### 3.3 Danh mục lý do dời (cấu hình theo tenant, có hiệu lực, mã ổn định; mặc định mẫu, câu 95)

| Mã | Tên hiển thị | Bên gợi ý | Ghi chú bắt buộc |
| --- | --- | --- | --- |
| `customer_busy` | Khách bận | khách | Không |
| `customer_late` | Khách báo đến trễ | khách | Không |
| `vehicle_not_ready` | Xe chưa sẵn sàng | khách | Không |
| `garage_reschedule` | Xưởng đổi lịch | xưởng | Không |
| `weather_incident` | Thời tiết hoặc sự cố | xưởng | Không |
| `other` | Khác | không | **Có, tối thiểu 3 ký tự** |

"Bên đề nghị" là trường riêng, bắt buộc chọn (không suy từ lý do), vì cùng một lý do có thể do bên nào đề nghị cũng được; lý do chỉ gợi ý giá trị chọn sẵn. Đây là danh mục **riêng** với danh mục lý do hủy, cùng cơ chế cấu hình và cùng quy tắc ở 2.3 (mã ổn định, lưu tên tại lúc dời, ngừng dùng không đổi lịch sử, `other` bắt buộc ghi chú).

### 3.4 Giới hạn và cảnh báo (tham số trong `appointment-policy`, có hiệu lực theo ngày, ghi đè theo chi nhánh)

| Tham số | Mặc định đề xuất | Hành vi |
| --- | --- | --- |
| `maxReschedules` | 3 lần mỗi lịch `[Cần xác nhận]` | Lần thứ 4 trở đi CV bị chặn (`reschedule_limit_reached`); QL hoặc CH vượt giới hạn được kèm ghi chú, nhật ký đánh dấu "vượt giới hạn". Chọn chặn mềm vì khách thật sự có lúc cần dời nhiều lần; chặn cứng đẩy nhân viên sang hủy và tạo lại, mất lịch sử |
| `lateRescheduleMinutes` | 120 phút trước giờ hẹn `[Cần xác nhận]` | Dời trong khoảng này **không bị chặn**, chỉ gắn cờ "dời sát giờ" để thống kê. Không chặn vì khách thực tế gọi sát giờ, chặn thì lịch sẽ thành "Vắng" |
| Tối thiểu lùi | Giờ mới phải sau thời điểm hiện tại | Không dời về quá khứ |

### 3.5 Quy tắc dời

1. Quyền: `appointment:update` (CV, QL, CH); QV, QĐ, TN chỉ xem. Khách tự dời (cổng khách) thuộc FR-REC-035, ngoài phạm vi này.
2. Bắt buộc: ngày mới hoặc giờ mới (ít nhất một thay đổi so với hiện tại), mã lý do, bên đề nghị; ghi chú bắt buộc khi lý do `other` (tối thiểu 3 ký tự).
3. Ngày mới phải hợp lệ như đặt mới: không ở quá khứ, trong `horizonDays` (hiện có), và chi nhánh còn bật lịch hẹn ở ngày đó. Nếu chi nhánh có cấu hình giờ làm việc và ngày nghỉ (P2-G), khung giờ mới phải nằm trong giờ làm việc; chưa có cấu hình thì không kiểm.
4. **Công suất.** Công suất tính theo ngày (FR-REC-019, không có khung giờ). Ngày cũ nhả một chỗ ngay khi dời. Ngày mới kiểm công suất **như đặt mới**: nếu đã đủ chỗ thì cảnh báo kèm số xe (dd/MM/yyyy) và cho dời tiếp khi người dùng xác nhận (`acknowledgeOverCapacity`), cờ vượt công suất ghi vào dòng lịch sử dời và cập nhật theo ngày mới. Cờ của các lịch khác đã đặt trước ở ngày cũ không đổi (cờ là ghi nhận lúc đặt).
5. **Dời trong cùng ngày, khác giờ**: hợp lệ, không kiểm lại công suất (số xe của ngày không đổi); vẫn cần lý do, tính một lần dời, giờ mới phải sau hiện tại.
6. **Dời lịch trễ hẹn**: hợp lệ, tính một lần dời. Sau khi dời sang thời điểm tương lai lịch rời tab Trễ hẹn và vào Sắp tới; nếu thời điểm mới vẫn trong diện trễ hẹn thì bị từ chối. Cách này giải quyết trường hợp "khách báo bận hôm qua nay xin hẹn lại" mà không phải hủy.
7. Cố vấn, dịch vụ, ghi chú **giữ nguyên** khi dời; người dời có thể sửa riêng bằng thao tác sửa (không bắt buộc lý do). Không có xung đột giờ theo cố vấn vì chưa có khung giờ (câu 6 của dev: công suất vẫn theo ngày).
8. **Không dời sang chi nhánh khác.** Mã `LH-<MÃCN>`, công suất, cố vấn và Scope gắn với chi nhánh; muốn đổi chi nhánh thì hủy (lý do "Khác" hoặc "Khách yêu cầu hủy") và tạo lịch mới ở chi nhánh kia `[Cần xác nhận]` (câu 96).
9. **Idempotency.** `Idempotency-Key` bắt buộc; cùng khóa với cùng nội dung phát lại đúng kết quả cũ, không tạo dòng lịch sử thứ hai; khóa chứa tenant. Cùng khóa nhưng nội dung khác thì lỗi xung đột khóa.
10. **Chống ghi đè.** Yêu cầu mang `version`; sai phiên bản thì `409 version_conflict` kèm gợi ý tải lại, dữ liệu người dùng đã nhập được giữ trên màn.
11. **Nhật ký** `appointment.reschedule`: trước và sau (ngày giờ), lý do (mã, tên, ghi chú), bên đề nghị, người, thời điểm, cờ sát giờ, cờ vượt công suất, cờ vượt giới hạn, tenant, chi nhánh. Không xóa, không sửa dòng lịch sử dời (RULE-010 tinh thần: chỉ nối thêm).
12. `appointments.byDate` hiện có vẫn phục vụ lưới ngày và tuần; dời lịch làm đổi ngày của lịch (không tạo bản ghi mới) nên lưới và đếm tự cập nhật.

### 3.6 Hiển thị lịch sử dời trên thẻ lịch

- Dòng lịch ở danh sách có chip "Đã dời N lần" (nếu N lớn hơn 0) và dòng nhỏ "Hẹn ban đầu 02/11/2026 09:00".
- Ngăn chi tiết có mục "Lịch sử dời", mỗi dòng: `02/11/2026 09:00 → 05/11/2026 14:00 · Khách bận · Khách đề nghị · Nguyễn Hoàng Yến · 01/11/2026 16:20`; ghi chú nếu có; nhãn "Dời sát giờ" hoặc "Vượt công suất" khi có cờ. Mới nhất ở trên.
- Người có `appointment:view` xem được lịch sử; không hiện số điện thoại hay địa chỉ trong lịch sử.

### 3.7 Thông báo khách khi dời hoặc hủy

Chỉ qua **cổng thông báo trung lập với nhà cung cấp giả**; **không gửi thật**; phụ thuộc slice 2.8a (cổng, mẫu tin; Q78). Quy tắc:

1. Hộp thoại có tùy chọn "Báo cho khách" (như checkbox ở G2-APT-02). Chỉ gửi qua kênh khách đã đồng ý nhận tin (RULE-024, RULE-028); khách chưa đồng ý hoặc kênh chưa kích hoạt thì tùy chọn bị khóa kèm lý do bằng chữ, và hiện ô "Đã gọi điện báo khách" để ghi nhận thủ công.
2. Kết quả lưu vào dòng lịch sử dời (và vào khối hủy): `none` (không báo), `phoned` (đã gọi), `queued` (đã đưa vào cổng), `sent_fake` (nhà cung cấp giả báo đã gửi). Trong lúc 2.8a chưa xong, chỉ có `none` và `phoned`.
3. Nội dung tin là mẫu cấu hình (ngày giờ định dạng dd/MM/yyyy và HH:mm, tên chi nhánh); không chứa lý do nội bộ của xưởng.
4. Lỗi gửi không làm hỏng việc dời hoặc hủy (đã lưu); hiện trạng thái "Chưa báo được khách" để nhân viên gọi điện.

## 4. Phần chọn ngày ở đầu màn (FR-REC-047)

### 4.1 Yêu cầu

1. **Điều hướng**: nút Trước, Hôm nay, Sau và ô chọn ngày; ở chế độ Ngày bước một ngày, ở chế độ Tuần bước một tuần. Nút Hôm nay hiện trạng thái nhấn mạnh hoặc bị khóa khi đang xem hôm nay. Dùng được bằng bàn phím; nút có nhãn đọc màn hình đầy đủ ("Ngày trước, 29/10/2026").
2. **Tiêu đề ngày** (chế độ Ngày): "Thứ Sáu, 30/10/2026", kèm chip **Hôm nay**, **Ngày mai** hoặc **Hôm qua** khi đúng; ngày khác không có chip. Tên thứ đầy đủ ở tiêu đề (Thứ Hai đến Thứ Bảy, Chủ nhật), dạng ngắn (T2 đến T7, CN) ở cột lưới và điện thoại.
3. **Tiêu đề tuần** (chế độ Tuần): "Tuần 45 (02/11 – 08/11/2026)". Tuần bắt đầu **Thứ Hai**, đánh số tuần theo ISO 8601 `[Cần xác nhận]` (câu 98), hiện đủ Thứ Hai đến Chủ nhật trong tiêu đề dù Chủ nhật không làm việc (cột Chủ nhật ẩn hoặc xám theo giờ làm việc). Tuần qua năm hiện đủ năm hai đầu: "Tuần 1 (29/12/2025 – 04/01/2026)". Nhãn "Tuần này" khi đang xem tuần chứa hôm nay.
4. **Múi giờ**: `Asia/Ho_Chi_Minh` (UTC+7, không giờ mùa hè). "Hôm nay", "Ngày mai", ngày mặc định, trễ hẹn đều tính theo **giờ máy chủ theo múi giờ chi nhánh**, không theo đồng hồ trình duyệt (máy lệch giờ không làm lệch nhãn). Dòng "Cập nhật lúc HH:mm" giữ như prototype.
5. **Định dạng thống nhất**: ngày hiển thị luôn `dd/MM/yyyy`, giờ 24 giờ `HH:mm`. Ô nhập chấp nhận gõ `dd/MM/yyyy`, báo lỗi bằng chữ khi ngày không có thật (31/02/2026). Giá trị trao đổi giữa trình duyệt và API vẫn là `yyyy-MM-dd` (dạng máy), **nhưng không bao giờ hiện cho người dùng**.
6. Nhãn công suất theo ngày đang xem: "Công suất hôm nay" khi xem hôm nay, ngược lại "Công suất Thứ Ba, 03/11/2026".
7. Tab đang chọn, kiểu xem, ngày nằm trong địa chỉ trang. Chọn lại ngày không làm mất tab.
8. Điện thoại: tiêu đề gọn ("T6, 30/10/2026" và chip) không tràn ngang, nút điều hướng đủ vùng chạm; thông báo thay đổi ngày cho trình đọc màn hình (`aria-live`).

### 4.2 Quy định định dạng ngày cho mọi thông báo và cảnh báo

Mọi chuỗi người dùng nhìn thấy (thông báo lỗi từ API, cảnh báo công suất, toast, hộp thoại, nhật ký hiển thị, tin báo khách) dùng `dd/MM/yyyy`. Lỗi API trả về trường dữ liệu (ngày dạng máy) cộng thông điệp đã định dạng; không ghép ISO vào thông điệp. Hiện có một lỗi cụ thể (G2): `capacity_exceeded` ghép ngày ISO; sửa bằng `isoToVi`, thêm test kiểm không có chuỗi `\d{4}-\d{2}-\d{2}` trong thông điệp hướng người dùng của phân hệ lịch hẹn.

## 5. Việc cho dev, việc cho designer, tiêu chí chấp nhận, câu hỏi

### 5.1 Việc dev (không chọn thiết kế bên trong; BA nêu hành vi)

| # | Việc | FR |
| --- | --- | --- |
| D1 | Thêm bộ lọc `tab` (`upcoming`, `overdue`, `arrived`, `cancelled`, `no_show`) và **bộ đếm theo tab** trong cùng phản hồi danh sách; bộ đếm và danh sách dùng một điều kiện lọc; có cờ cắt giới hạn. `overdue` là trường **tính khi đọc** (theo giờ máy chủ, ngưỡng tại ngày hiện tại), không lưu | 044 |
| D2 | Tab `overdue` không giới hạn theo ngày đang xem và không bị `maxRangeDays` 7 chặn; có phân trang hoặc giới hạn có cờ cắt. **Truy vấn theo trạng thái và ngày cần chỉ mục mới** `appointments (tenantId, branchId, status, date)`; khuyến nghị thêm **1 chỉ mục**, tính **171 lên 172/200** theo branch 2.8b; dev đo lại bằng `pnpm check:indexes` sau khi gộp nhánh chính (ghi nhận lệch 171 và 192, D1 ở phase-2-plan; ngưỡng thất bại 195). Phương án không thêm chỉ mục (đọc `byDate` rồi lọc bộ nhớ) không đáp ứng tab Trễ hẹn không giới hạn ngày; dev có thể đề xuất cách khác (ví dụ truy vấn đếm) nếu giữ được tính đúng và không vượt ngân sách | 044 |
| D3 | Mở rộng `appointment-policy` có hiệu lực theo ngày: `overdueGraceMinutes` (mặc định **0**, theo chi nhánh; chủ dự án đã chốt 07/11/2026), `staleDays` (30), `maxReschedules`, `lateRescheduleMinutes`, `noteMinLength`; không phiên bản cho tham số mới thì dùng mặc định tài liệu này (riêng chi nhánh không bật lịch hẹn vẫn tắt như hiện tại) | 044, 045, 046 |
| D4 | Danh mục `appointment-cancel-reason` và `appointment-reschedule-reason` (cấu hình tenant, có hiệu lực, mã ổn định, `other` hệ thống); API đọc danh mục đang hiệu lực cho hộp thoại; quyền sửa QL đề xuất, CH duyệt; seed mặc định mục 2.2 và 3.3 chỉ ở tenant demo, gắn nhãn "minh họa" | 045, 046 |
| D5 | Hủy: nhận `reasonCode` và `note`; kiểm `requiresNote` và độ dài tối thiểu 3 của lý do `other`; lưu khối `cancellation` (mã, tên lúc hủy, ghi chú, người, thời điểm); tương thích ngược với dữ liệu hủy bằng văn bản (`legacy`) | 045 |
| D6 | Hành động Dời lịch `POST /api/v1/rec/appointments/{id}/reschedule` (tên đường dẫn do dev đặt): `version`, ngày, giờ, `reasonCode`, `note`, `requestedBy`, `acknowledgeOverCapacity`, `overrideLimit`, cách báo khách; `Idempotency-Key` bắt buộc; kiểm phiên bản; kiểm quy tắc 3.5 (ngày hợp lệ, công suất ngày mới, cùng ngày, trễ hẹn, giới hạn số lần, sát giờ gắn cờ); nối thêm lịch sử dời; cập nhật cờ vượt công suất theo ngày mới; nhật ký `appointment.reschedule`; trong **một giao dịch** | 046 |
| D7 | `PATCH` bỏ khả năng đổi `date` và `time` (chỉ cố vấn, dịch vụ, ghi chú); `allowed` của lịch `pending` thêm `reschedule`; `arrived`, `cancelled`, `no_show` không có | 046 |
| D8 | DTO lịch thêm: `overdue`, `overdueSince`, `rescheduleCount`, `originalDate`, `originalTime`, `reschedules[]`, `cancellation`; người dùng không đủ quyền xem không nhận trường nội bộ ngoài quyền hiện có | 044 đến 046 |
| D9 | Thông báo khách khi dời hoặc hủy qua cổng thông báo (nhà cung cấp giả); chỉ khi khách đã đồng ý; chưa có cổng 2.8a thì chỉ ghi nhận `phoned` hoặc `none`; lỗi gửi không làm hỏng giao dịch dời hoặc hủy | 046, 035 |
| D10 | Sửa thông điệp lỗi có ngày ISO (`capacity_exceeded` và mọi thông điệp tương tự); test không còn ISO trong thông điệp hướng người dùng; tiêu đề tuần ISO 8601 và nhãn Hôm nay, Ngày mai tính theo giờ máy chủ `Asia/Ho_Chi_Minh` | 047 |
| D11 | Cô lập: ma trận cô lập thêm trục tenant cho danh mục lý do, lịch sử dời, bộ đếm tab; khóa idempotency chứa tenant; hai tenant dùng cùng mã lý do không xung đột | 044 đến 046 |
| D12 | Xuất tenant (`appointments`) chứa lịch sử dời và khối hủy; chuẩn bị dữ liệu thống kê lý do hủy theo 2.4, **không bắt buộc dựng báo cáo** | 045 |
| D13 | Test: đơn vị cho `overdue` (biên phút 08:00 và 08:01 với châm chước 0, châm chước lớn hơn 0, múi giờ, lịch ngày trước), máy trạng thái (`reschedule` chỉ từ `pending`), lỗi 409 phiên bản, replay idempotency; tích hợp có trục tenant | 044 đến 046 |

### 5.2 Việc designer (prototype `design/g2-workshop/g2-apt-01..04.html`; không sửa token trong `docs/design-system.md`)

0. Dòng lịch Trễ hẹn: nhãn cảnh báo "Trễ hẹn" kèm "Trễ N phút"; ba hành động nhanh nhìn thấy ngay (Gọi khách là liên kết gọi điện, số che theo vai trò; Dời lịch; Đánh dấu vắng có hộp xác nhận); nhãn "Vắng" trung tính khác hẳn nhãn "Trễ hẹn" (mục 1.0). Ô cấu hình "thời gian châm chước (phút)" theo chi nhánh, mặc định 0.
1. G2-APT-01: tab Sắp tới, Trễ hẹn, Đã đến, Đã hủy, Vắng với bộ đếm (số, "500+" khi bị cắt); trạng thái đang chọn không chỉ dựa màu; trên điện thoại tab cuộn ngang; tab Trễ hẹn có dòng chữ "Không phụ thuộc ngày đang xem"; thông báo "Có N lịch trễ hẹn" ở mọi tab.
2. Trạng thái rỗng, đang tải, lỗi, không quyền, mất mạng cho từng tab (nội dung gợi ý mục 1.4).
3. Phần chọn ngày: thiết kế lại theo mục 4 (điều hướng Trước, Hôm nay, Sau; tiêu đề "Thứ Sáu, 30/10/2026" với chip Hôm nay hoặc Ngày mai; tiêu đề tuần "Tuần 45 (02/11 – 08/11/2026)"; bản gọn cho điện thoại). Sửa các ví dụ ngày trong prototype cho cùng một định dạng (prototype ghi "Thứ Sáu 30/10/2026" không dấu phẩy và tuần "26/10 – 31/10/2026" thiếu Chủ nhật).
4. Dòng lịch: chip "Trễ hẹn", "Trễ N phút", "Đã dời N lần", "Hẹn ban đầu ...".
5. Hộp thoại **Hủy lịch** (thay `dlg-cancel`): chọn lý do bằng danh sách (nhóm theo bên nếu hợp lý), ô ghi chú xuất hiện bắt buộc khi chọn "Khác" (hint "Tối thiểu 3 ký tự", sửa chữ "5 ký tự" cũ), gợi ý dùng Dời lịch, tùy chọn báo khách; trạng thái lỗi và đang lưu.
6. Hộp thoại **Dời lịch** (mới): ngày mới, giờ mới, cảnh báo công suất ngày mới (cảnh báo vàng và xác nhận), lý do dời, bên đề nghị (lựa chọn một trong hai, chọn sẵn theo gợi ý), ghi chú, cảnh báo "Dời sát giờ", cảnh báo vượt giới hạn số lần (chỉ QL, CH ghi đè), báo khách; trạng thái xung đột phiên bản ("Lịch vừa được người khác sửa, tải lại").
7. Ngăn chi tiết: mục "Lịch sử dời" theo mục 3.6; nút Dời lịch cạnh Hủy lịch; khóa theo vai trò kèm lý do bằng chữ.
8. G2-APT-02 (tạo, sửa): bỏ khả năng đổi ngày giờ ở chế độ sửa (chuyển sang Dời lịch); ghi chú "Chờ tiếp nhận" và "mức tối đa 120%" là **chờ nghiệp vụ** (G4, G5).
9. Màn cấu hình danh mục lý do hủy và dời (thuộc nhóm G4-SYS, danh mục của tenant): bảng mã, tên, bên, bắt buộc ghi chú, thứ tự, hiệu lực, trạng thái; mã `other` khóa.
10. Kiểm cuộn ngang bằng Playwright ở 360, 768, 1280 như các màn khác.

### 5.3 Tiêu chí chấp nhận kiểm thử được

Quy ước giờ: thời điểm hiện tại là 05/11/2026 10:00 (Asia/Ho_Chi_Minh); châm chước trễ hẹn mặc định 0 phút (trừ khi tiêu chí nêu khác); công suất ngày 20.

| # | Given / When / Then | FR |
| --- | --- | --- |
| AC-01 | Given lịch `pending` hẹn 05/11/2026 09:00. When mở màn lúc 10:00. Then lịch ở tab **Trễ hẹn**, không ở Sắp tới | 044 |
| AC-02 | Given lịch `pending` hẹn 05/11/2026 10:00 và châm chước 0. When xem lúc 10:00 thì lịch ở Sắp tới; xem lúc 10:01 thì lịch ở Trễ hẹn kèm "Trễ 1 phút" và có ba hành động nhanh Gọi khách, Dời lịch, Đánh dấu vắng. Với châm chước 15 phút, lúc 10:10 lịch còn ở Sắp tới kèm "Trễ 10 phút" | 044 |
| AC-03 | Given tab Trễ hẹn có 3 lịch. When bấm Đã đến, Vắng, Hủy lần lượt trên 3 lịch. Then mỗi lịch rời tab Trễ hẹn, xuất hiện ở Đã đến, Vắng, Đã hủy; bộ đếm các tab cập nhật và tab Trễ hẹn về 0 | 044 |
| AC-04 | Given đang xem ngày 06/11/2026 và có lịch trễ hẹn của 04/11/2026. When mở tab Trễ hẹn. Then lịch của 04/11/2026 vẫn hiện; bốn tab còn lại chỉ hiện lịch trong ngày đang xem | 044 |
| AC-05 | Given bộ đếm một tab. When so với số dòng danh sách của tab đó. Then bằng nhau; khi bị cắt ở giới hạn, hiện "500+" thay vì số sai | 044 |
| AC-06 | Given châm chước mặc định 0 và lịch hẹn 09:00 đang ở Trễ hẹn lúc 10:00. When chi nhánh đặt `overdueGraceMinutes` = 90 rồi tải lại. Then lịch chuyển về Sắp tới kèm "Trễ 60 phút" (hiệu lực ngay, không cần công việc nền); cấu hình của chi nhánh khác không bị ảnh hưởng | 044 |
| AC-06b | Given lịch ở Trễ hẹn. When bấm Đánh dấu vắng. Then lịch sang trạng thái lưu `no_show`, nằm ở tab Vắng, mất hành động Dời, Hủy, Đã đến; trong khi còn ở Trễ hẹn thì vẫn Đã đến, Dời, Hủy được | 044 |
| AC-07 | Given người dùng QV hoặc QĐ hoặc TN. When mở màn. Then thấy mọi tab nhưng không có nút Đã đến, Dời, Hủy, Vắng; tenant hoặc chi nhánh khác không bao giờ xuất hiện trong danh sách hay bộ đếm | 044 |
| AC-08 | Given mở hộp thoại hủy. When chưa chọn lý do. Then nút Hủy lịch bị khóa kèm lý do bằng chữ | 045 |
| AC-09 | Given chọn lý do "Khác". When ghi chú ít hơn 3 ký tự (sau khi cắt khoảng trắng). Then bị chặn kèm thông báo lỗi theo trường; từ 3 ký tự thì hủy được | 045 |
| AC-10 | Given hủy với lý do `customer_busy` bởi cố vấn A lúc 10:05. When xem nhật ký và thẻ lịch. Then có mã `customer_busy`, tên "Khách bận hoặc đổi kế hoạch", người A, thời điểm 05/11/2026 10:05 | 045 |
| AC-11 | Given lý do `fixed_elsewhere` bị ngừng dùng sau khi một lịch đã hủy với lý do này. When mở lịch cũ. Then vẫn hiện đúng tên lý do cũ; hộp thoại hủy mới không còn lý do đó | 045 |
| AC-12 | Given hai tenant có cùng mã lý do với tên khác nhau. When tenant A đọc danh mục. Then chỉ thấy của A; lịch sử hủy của B không lộ | 045 |
| AC-13 | Given lịch `pending` ngày 06/11/2026 09:00 mã LH-Q7-2611-00040. When dời sang 09/11/2026 14:00, lý do `customer_busy`, bên đề nghị khách. Then mã lịch không đổi, trạng thái vẫn `pending`, ngày giờ mới được lưu, lịch sử có dòng `06/11/2026 09:00 → 09/11/2026 14:00` kèm lý do, bên đề nghị, người dời, thời điểm; có dòng nhật ký `appointment.reschedule` | 046 |
| AC-14 | Given dời lịch không có lý do hoặc không chọn bên đề nghị. When gửi. Then bị từ chối; `PATCH` đổi ngày hoặc giờ cũng bị từ chối | 046 |
| AC-15 | Given ngày mới 09/11/2026 đã có 20/20 xe. When dời. Then cảnh báo "Ngày 09/11/2026 đã có 20/20 xe" (định dạng dd/MM/yyyy); dời chỉ thực hiện khi xác nhận, và lịch ghi cờ vượt công suất; ngày cũ giảm 1 xe | 046, 019 |
| AC-16 | Given dời trong cùng ngày từ 09:00 sang 15:00. When lý do hợp lệ. Then dời được, công suất ngày không đổi, tính một lần dời; giờ mới trước 10:00 hiện tại thì bị từ chối | 046 |
| AC-17 | Given lịch trễ hẹn hôm qua. When dời sang 06/11/2026 09:00. Then lịch rời tab Trễ hẹn, vào Sắp tới; dời sang thời điểm vẫn trễ hẹn thì bị từ chối | 046, 044 |
| AC-18 | Given lịch đã dời 3 lần (giới hạn 3). When CV dời lần 4. Then bị chặn; khi QL ghi chú rồi vượt giới hạn thì dời được và nhật ký đánh dấu vượt giới hạn | 046 |
| AC-19 | Given dời lúc 10:00 cho lịch hẹn 11:30 (trong 120 phút). When dời. Then không bị chặn, dòng lịch sử có cờ "Dời sát giờ" | 046 |
| AC-20 | Given lịch `arrived`, `cancelled` hoặc `no_show`. When mở chi tiết. Then không có nút Dời lịch; gọi API dời trả lỗi trạng thái | 046 |
| AC-21 | Given hai nhân viên mở cùng lịch ở phiên bản 3. When người thứ nhất dời, người thứ hai dời với phiên bản 3. Then người thứ hai nhận `409 version_conflict` và dữ liệu đã nhập vẫn giữ trên màn | 046 |
| AC-22 | Given cùng `Idempotency-Key` gửi hai lần (bấm đôi hoặc mất mạng gửi lại). When xử lý. Then chỉ một dòng lịch sử dời, một dòng nhật ký, phản hồi lần hai giống lần một | 046 |
| AC-23 | Given khách đã đồng ý nhận tin và 2.8a có cổng. When chọn "Báo cho khách" lúc dời. Then một tin vào cổng (nhà cung cấp giả), kết quả lưu ở dòng lịch sử; khách chưa đồng ý thì tùy chọn bị khóa kèm lý do, chỉ ghi nhận "Đã gọi điện" được; lỗi gửi không làm hỏng việc dời | 046 |
| AC-24 | Given xem hôm nay 05/11/2026. When mở màn. Then tiêu đề "Thứ Năm, 05/11/2026" kèm chip Hôm nay; bấm Sau thì "Thứ Sáu, 06/11/2026" kèm chip Ngày mai; chuyển Tuần thì "Tuần 45 (02/11 – 08/11/2026)" | 047 |
| AC-25 | Given tuần chứa ngày 01/01/2026. When xem tuần. Then tiêu đề "Tuần 1 (29/12/2025 – 04/01/2026)" | 047 |
| AC-26 | Given máy tính của người dùng đặt sai ngày. When mở màn. Then "Hôm nay" và tab Trễ hẹn vẫn theo giờ máy chủ `Asia/Ho_Chi_Minh` | 047 |
| AC-27 | Given mọi thông báo lỗi, cảnh báo, toast, tin báo khách của phân hệ lịch hẹn. When kiểm bằng test. Then không chuỗi nào chứa ngày dạng `yyyy-MM-dd`; nhập `31/02/2026` vào ô ngày bị báo ngày không có thật | 047 |
| AC-28 | Given màn rộng 360px. When mở màn. Then tiêu đề ngày, nút điều hướng và tab không gây cuộn ngang trang (tab được cuộn trong khung của nó) | 047 |

### 5.4 Câu hỏi cho khách (số 91 trở đi, nối tiếp Q64 đến Q90 ở `docs/dev/phase-2-plan.md` §6; đã chép vào bảng đó)

| # | Gửi | Câu hỏi | Lựa chọn | Khuyến nghị BA | Tác động nếu chọn khác |
| --- | --- | --- | --- | --- | --- |
| 91 | Khách | Định nghĩa Trễ hẹn **đã chốt**: chờ mà khách không đến đúng giờ hẹn, châm chước mặc định 0 phút, không chờ hết ngày. Còn mở: tab mặc định; có trạng thái "khách bấm đã đến, chờ tiếp nhận" như prototype không | Mặc định Sắp tới hoặc Trễ hẹn khi có | Sắp tới kèm thông báo; không thêm trạng thái "chờ tiếp nhận" | Đổi cấu hình; thêm trạng thái thì phải đổi FR-REC-027, máy trạng thái, Journey |
| 92 | Khách | Lịch vắng: nhân viên đánh tay hay tự động sau N ngày; được đánh vắng từ đầu ngày hẹn hay chỉ khi đã trễ hẹn | Tay; tự động sau N ngày; ràng buộc "chỉ khi trễ hẹn" | Tay; không tự động; giữ quy tắc "từ ngày hẹn" | Tự động làm sai tỷ lệ vắng; siết "chỉ khi trễ hẹn" cần đổi quy tắc đã dựng |
| 93 | Chủ dự án | Chốt tên gọi: nhóm chờ-mà-khách-chưa-đến là "Trễ hẹn" (hay "Quá giờ hẹn"); tab `arrived` là "Đã xong" hay "Đã đến" | "Trễ hẹn" / "Quá giờ hẹn"; "Đã xong" / "Đã đến" | "Trễ hẹn" và "Đã đến" vì "xong" dễ hiểu là sửa xong | Chỉ đổi nhãn |
| 94 | Khách | Danh sách lý do **hủy** mặc định (8 mục mục 2.2) có đủ không; thêm, bớt; ai được sửa danh mục; ai xem thống kê lý do hủy | Giữ 8; chỉnh | Giữ 8, QL đề xuất CH duyệt, CH và QL xem thống kê | Chỉ đổi cấu hình |
| 95 | Khách | **Dời lịch**: danh sách lý do (6 mục mục 3.3), có thêm "nhập sai ngày giờ" không; giới hạn số lần (đề xuất 3); dời sát giờ trong bao lâu (đề xuất 120 phút); vượt giới hạn: chặn cứng, hay QL ghi đè | Chặn cứng; QL ghi đè; không giới hạn | 3 lần, 120 phút chỉ để gắn cờ, QL ghi đè kèm ghi chú | Chặn cứng làm nhân viên hủy rồi tạo lại, mất lịch sử |
| 96 | Khách | Ai được dời (CV, QL, CH); có cần duyệt khi dời nhiều lần; có cần dời lịch **sang chi nhánh khác** | Chỉ CV, QL, CH; có duyệt; có dời chi nhánh | Chỉ CV, QL, CH, không cần luồng duyệt riêng, không dời chi nhánh (hủy và tạo mới) | Dời chi nhánh: cần quy tắc mã lịch, công suất hai chi nhánh, chuyển quyền xem |
| 97 | Khách, Chủ dự án | Khi hủy hoặc dời có bắt buộc báo khách không; kênh nào (SMS, Zalo, gọi điện); mẫu tin và khung giờ gửi | Bắt buộc; tùy chọn | Tùy chọn, chỉ gửi cho khách đã đồng ý, ghi nhận "đã gọi" khi chưa có kênh (gắn Q78) | Bắt buộc: chặn thao tác khi khách không có kênh |
| 98 | Khách | Tuần bắt đầu Thứ Hai và đánh số tuần theo ISO 8601 (tuần 45 là 02/11 đến 08/11/2026) được không; Chủ nhật có làm việc không (giờ làm việc từng chi nhánh, trùng P2-G) | Thứ Hai, ISO; hoặc Chủ nhật đầu tuần | Thứ Hai, ISO 8601 | Chỉ đổi cấu hình hiển thị |

### 5.5 Ảnh hưởng tới tài liệu khác (đã sửa và còn lại)

Đã sửa (bản này):

- `docs/functional-requirements.md`: FR-REC-019 và FR-REC-027 thêm tiêu chí; FR-REC-044 đến 047 mới ở cuối nhóm REC (037 đến 043 giữ chỗ cho đề xuất cũ chưa áp dụng, QĐ2-11, nên không dùng lại); cập nhật đếm REC 36 lên 40, tổng 257 lên 261, 10 phân hệ 202 lên 206, Should tăng 4; traceability và §13 slice 2.8; UAT-P2-12.
- `docs/dev/phase-2-plan.md`: slice 2.8b (thêm FR, nhu cầu truy vấn), Q91 đến Q98, cấu hình có hiệu lực số 23 và 24, ghi chú mã FR.

Còn lại, BA chưa sửa (không được yêu cầu hoặc cần chủ dự án quyết):

- `docs/user-journey-business-workflow.md` §8 (Khách tự đặt lịch) và luồng Hẹn lịch (dòng 40, 52): thêm bước hủy có lý do, dời lịch, lịch trễ hẹn; chưa có sơ đồ trạng thái lịch hẹn trong Journey (khoảng trống đã có).
- `docs/business-requirements.md`: BR-REC-09 không cần đổi nội dung; không thêm RULE mới (chỉ là cấu hình). Có thể thêm một dòng ở Discovery khi khách trả lời Q91 đến Q98.
- `docs/ui-ux/screen-inventory.md` (G2-APT-01, 02: thêm tab, hộp thoại Dời lịch, danh mục lý do) và `docs/ui-ux/STATUS.md`: designer cập nhật.
- `docs/dev/status.md` mục Slice 2.8b, `docs/dev/open-questions-for-ba.md`: dev cập nhật (BA không sửa); câu 6 và 7 của dev ở status.md được trả lời ở mục 1.2 và 3.5.
- `CLAUDE.md` còn ghi "237 yêu cầu (182 + 55 FR-TEN)" trong khi FRD đã ghi 257 từ bản 0.5; sau bản này là 261 (206 + 55). Dev hoặc chủ dự án đồng bộ.
- `docs/dev/uat-coverage.md`: thêm UAT-P2-12 khi dựng.
