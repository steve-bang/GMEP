# Spike report (phần chạy được trên emulator)

Ngày 31/10/2026 · Người làm: dev · Phạm vi: S1, S5 (phần khung), S8 theo ADR 0001 §9.

**Mọi số liệu dưới đây là của Firebase Emulator Suite (firebase-tools 15.x, Firestore emulator 1.22.0, Auth emulator, Storage emulator) chạy trong một sandbox, KHÔNG phải Firestore thật.** Emulator không có độ trễ mạng, không tái hiện đúng cơ chế khóa và thử lại của dịch vụ thật, không buộc chỉ mục tổ hợp. Kết quả "đạt" ở đây chỉ chứng minh logic đúng; không chứng minh hiệu năng hay độ bền. Quyết định đạt/không đạt của spike (ADR §9) **chưa thể chốt** cho đến khi lặp lại trên dự án thật.

## Môi trường đã kiểm

| Thành phần | Kết quả |
| --- | --- |
| Java 21 + tải jar emulator qua proxy | Được (jar Firestore 1.22.0 và Storage rules runtime 1.1.3 tải thành công, TLS bình thường) |
| Firestore emulator | Chạy; dùng cho test tích hợp, e2e, S1, S8 |
| Auth emulator | Chạy; dùng cho đăng nhập mật khẩu, session cookie, revoke |
| Storage emulator | Chạy; chỉ kiểm Storage Rules (deny all). Không kiểm URL ký (xem "Chưa kiểm") |
| Cảnh báo lặp lại | `Picked up JAVA_TOOL_OPTIONS` (từ proxy của sandbox) và `MetadataLookupWarning ... 403` (Admin SDK dò metadata GCE, bị chặn). Vô hại, không gọi dịch vụ Google thật |

## S1 - Kho dưới tranh chấp (`pnpm spike:s1`, mã ở `spikes/s1-stock-concurrency.ts`)

Thiết lập: 21 phụ tùng ở một kho (mỗi mã tồn 10), 5 mã "nóng" nhận 70% nhu cầu, 50 luồng song song x 12 thao tác = 600 lần giữ chỗ (SL 1 đến 3), khoảng một nửa số giữ chỗ được xuất kho. Mỗi thao tác là một giao dịch Firestore: đọc số dư và tài liệu khóa chống trùng, rồi ghi số dư, chứng từ, và một dòng sổ biến động chỉ ghi thêm. So sánh với "khả dụng = tồn - giữ chỗ" (RULE-008).

Kết quả lần chạy 50 luồng (emulator):

| Chỉ tiêu | Kết quả |
| --- | --- |
| Giữ chỗ được chấp nhận / bị từ chối vì thiếu hàng | 109 / 491 |
| Xuất kho thành công | 60 |
| Lỗi (hết lượt thử lại) | 0 |
| Bán vượt (giữ chỗ > tồn), tồn âm | 0 |
| Lệch số dư so với tính lại từ sổ biến động (tồn và giữ chỗ, cả 21 mã) | 0 |
| Phát lại toàn bộ khóa sau đó | tất cả trả về "đã xử lý", số dư không đổi |
| 50 yêu cầu song song cùng một khóa | đúng 1 lần áp dụng |
| Số lần chạy lại thân giao dịch do xung đột | 549 (1428 lần chạy cho 879 giao dịch) |
| **Độ trễ thao tác p50 / p95 / max** | **11 ms / 34.498 ms / 92.217 ms** |

Tiêu chí ADR: p95 dưới 800 ms. **KHÔNG ĐẠT trên emulator.** Các lần chạy ít luồng hơn cho thấy đuôi trễ xuất hiện sớm: 10 luồng p95 3,4 s; 25 luồng p95 6,4 s (max 53 s).

Diễn giải trung thực:

- Tính đúng đắn đạt hoàn toàn (không bán vượt, sổ khớp số dư, idempotent). Điều này không phụ thuộc emulator.
- Đuôi trễ do giao dịch xung đột trên vài tài liệu nóng: emulator hủy giao dịch (ABORTED) và Admin SDK thử lại có lùi theo hàm mũ. Firestore thật dùng khóa bi quan có chờ và độ trễ cam kết vài chục ms, nên con số thật có thể tốt hơn nhiều hoặc không; **không suy ra được từ emulator**. Tải trong spike (35 luồng cùng đập vào 5 tài liệu) cực đoan hơn tải thật nhiều lần (khoảng 40 xe mỗi chi nhánh mỗi ngày).
- Cần `maxAttempts` cao hơn mặc định 5 của Admin SDK (spike dùng 30; sản phẩm dùng 10 ở `FirestoreUnitOfWork`, cần chỉnh theo số đo thật).
- Nếu trên dự án thật vẫn không đạt: các phương án đã nghĩ tới (chưa làm) là xếp hàng theo mã phụ tùng nóng bằng Cloud Tasks, hoặc chia số dư nóng thành nhiều mảnh đếm, trước khi cân nhắc đường lui PostgreSQL.

## S5 - Xác thực và phiên (mức khung, không có TOTP/PIN theo A2)

Kiểm bằng test tự động (`tests/integration/auth.test.ts`, chạy trên bộ chuyển trong bộ nhớ và trên Auth + Firestore emulator; `e2e/`):

| Nội dung | Kết quả |
| --- | --- |
| Đăng nhập mật khẩu qua máy chủ (Identity Toolkit REST trỏ vào Auth emulator), bằng email hoặc mã nhân viên | Đạt |
| Cookie `__Host-gmep_session`: HttpOnly, Secure, SameSite=Lax, Path=/, không Domain; trình duyệt thật nhận cookie trên http://localhost và `document.cookie` không thấy | Đạt (e2e) |
| Sai mật khẩu, người dùng không tồn tại, tài khoản bị khóa: cùng một phản hồi, không phát cookie | Đạt |
| Đăng xuất thu hồi session phía máy chủ; phát lại cookie cũ bị từ chối | Đạt |
| Thu hồi toàn bộ phiên của một người dùng (`revokeAllSessions`) | Đạt; người khác không ảnh hưởng |
| Hết hạn do rảnh (đồng hồ giả lập) | Đạt |
| Cookie giả hoặc rác | Bị từ chối |
| CSRF: sai hoặc thiếu Origin, nội dung không phải JSON | Bị từ chối |
| Điểm móc `StrongAuthPort`: nếu yêu cầu bước hai thì không phát cookie | Đạt (kiểm bằng bộ giả) |
| Bundle trình duyệt không chứa Firebase | Đạt: 17 tệp quét, 0 tham chiếu; script có test chứng minh nó thất bại khi có `firebase/firestore`. Ngoài ra e2e ghi mọi request của trang: chỉ tới origin của ứng dụng |
| Security Rules: client không xác thực và client đã đăng nhập đều bị từ chối đọc, liệt kê, truy vấn, ghi, xóa (Firestore và Storage) | Đạt; đã làm kiểm đột biến (đổi rules thành `allow read: if true` thì 3 test đỏ) |

Phát hiện khi làm S5: cookie phiên Firebase của cùng một người dùng đăng nhập hai lần trong cùng một giây **giống hệt nhau** (JWT có `iat` theo giây), nên không thể dùng băm cookie làm mã phiên. Đã đổi: giá trị cookie = `<sid ngẫu nhiên>.<cookie Firebase>`, bản ghi `sessions/{sid}` ở máy chủ.

Chưa kiểm (cần dự án thật): `createSessionCookie` và `verifySessionCookie(checkRevoked)` với dịch vụ Auth thật (emulator có thể khác về thời hạn và kiểm thu hồi); giới hạn của Identity Toolkit REST ở sản xuất (khóa API, hạn mức, chống lạm dụng); TOTP/PIN (theo A2 do chủ dự án cung cấp).

## S8 - Chỉ mục và emulator

- `src/infrastructure/firestore/queries.ts` là danh mục mọi biến thể truy vấn của bộ chuyển (8 biến thể danh sách kho, 8 biến thể đọc nhật ký). `pnpm check:indexes` suy ra chỉ mục tổ hợp cần có và so với `firestore.indexes.json` (16 chỉ mục, sinh bằng `pnpm indexes:generate`). Chạy trên tệp rỗng, script báo thiếu 10 chỉ mục và thoát mã 1 (đã quan sát); test đơn vị kiểm thêm: bỏ một chỉ mục thì bị phát hiện, sai hướng sắp xếp thì bị phát hiện.
- Kết quả xác nhận trên emulator (`tests/integration/spike-s8.test.ts`): emulator **chạy bình thường** một truy vấn cần chỉ mục tổ hợp chưa khai báo (hai điều kiện bằng và một `orderBy` khác trường). Vậy emulator không thể phát hiện thiếu chỉ mục; script tĩnh và lượt chạy hằng đêm trên staging thật là bắt buộc.
- Giới hạn của script: danh mục là tệp viết tay đặt cạnh bộ chuyển, nên có thể lệch khỏi truy vấn thật nếu quên cập nhật. Quy tắc suy luận chỉ mục là xấp xỉ theo tài liệu hiện nhớ (hai hướng ASC/DESC khai báo riêng, `in` coi như bằng). **Chưa kiểm trên dự án thật** (S8 phần staging).

## Chưa kiểm, cần dự án thật

| Kịch bản | Lý do chưa làm được |
| --- | --- |
| S2 rollup và hợp nhất 20 chi nhánh x 365 ngày, dashboard dưới 3 s trên 4G | cần độ trễ và giá đọc thật |
| S3 tìm kiếm 100.000 phụ tùng và 500.000 khách | chưa có slice tìm kiếm; cần dữ liệu và đo thật |
| S4 40.000 dòng nhật ký mỗi ngày, đo chi phí | cần đo ghi và giá thật |
| S6 media: tải ảnh 2 MB và video 50 MB qua API, URL ký V4 | cần bucket thật và tài khoản dịch vụ có quyền ký; emulator không ký URL |
| S7 khôi phục PITR vào database mới, đo RTO | emulator không có PITR |
| S1 và S8 lặp lại trên Firestore thật | xem trên; độ trễ emulator không đại diện |

## Giả định giới hạn vẫn chưa kiểm chứng (ADR §13)

Giới hạn `in` bằng 30 (mã chặn ở 30 và báo `scope_too_wide` nếu một người có hơn 30 chi nhánh; chưa chia truy vấn); thời gian giao dịch, số thao tác ghi tối đa mỗi commit, ngưỡng ghi liên tục mỗi tài liệu; số chỉ mục tổ hợp tối đa; hành vi thứ tự `__name__` khi `orderBy` giảm dần với truy vấn `in` (đã chạy đúng trên emulator, chưa trên dịch vụ thật); TTL policy cho `idempotencyKeys.expiresAt` (chỉ là trường, chưa cấu hình chính sách).

## Việc còn lại để chốt spike

1. Chủ dự án cấp dự án Firebase/GCP (quyết định #2 của ADR) ở `asia-southeast1`.
2. Lặp lại S1 và S8 trên dự án thật, rồi S2, S3, S4, S6, S7.
3. Quyết định đạt hoặc không đạt theo §9. Cho đến lúc đó Phase 1 vẫn chạy trên giả định Firestore có thể đạt; nếu S1 không đạt, đường lui là PostgreSQL, giữ nguyên ranh giới `ports/` đã dựng.
