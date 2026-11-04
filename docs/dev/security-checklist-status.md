# Trạng thái danh sách kiểm tra bảo mật (kế hoạch triển khai mục 8, việc 1e)

Cập nhật 04/11/2026, luồng A. Mỗi dòng của `implementation-plan.md` §8 ánh xạ tới test hiện có hoặc test mới (`tests/integration/security-checklist.test.ts`, `tests/integration/isolation-matrix.test.ts`), hoặc ghi rõ thiếu / cần hạ tầng. Test chạy trên bộ nhớ và trên Firestore Emulator.

Chú giải: CÓ = có test tự động; MỘT PHẦN = có test nhưng thiếu ca; THIẾU = chưa có, làm được trong repo; NGOÀI = cần hạ tầng GCP, người rà soát độc lập, hoặc ngoài phạm vi theo quyết định chủ dự án.

| # | Mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- | --- |
| 1 | Không SDK Firebase trong bundle; Rules từ chối client | CÓ | `pnpm check:bundle` (CI); `tests/integration/rules.test.ts` (emulator); `security-checklist.test.ts` "#1" quét `firestore.rules`, `storage.rules` chỉ có `allow ...: if false` |
| 2 | Mật khẩu từ 10 ký tự, lịch sử 5, khóa 5 lần, hết phiên 12 giờ và do rảnh | CÓ (trừ MFA) | `recovery.test.ts` (độ dài, lịch sử, khóa thiết bị+tên), `auth.test.ts` (idle), `platform.test.ts:532` (idle + tuyệt đối 12 giờ theo vai trò). MFA/PIN: NGOÀI (chủ dự án quyết định làm sau, `StrongAuthPort` là hook rỗng) |
| 3 | Cookie `__Host-`, kiểm Origin, CSRF | CÓ | `auth.test.ts` (cờ cookie), `platform.test.ts` "CSRF Origin check on EVERY write route" (duyệt mọi route ghi), `security-checklist.test.ts` "#3" (mọi handler ghi đi qua `api`/`authed`/`cron`, không có hàm thô) |
| 4 | Cách ly chi nhánh ở danh sách, tìm kiếm, báo cáo, xuất, tệp, liên kết khách, API; 404 ngoài phạm vi | CÓ | `isolation.test.ts` (kho, phân trang), `isolation-matrix.test.ts` (mọi route GET phải có dòng trong ma trận hoặc ngoại lệ có lý do; 2 chi nhánh x CRM, REC, ACC, EIN, INV, SYS, RPT, xuất CSV). Xem `stream-a-findings.md` F-1, F-2 |
| 5 | RBAC theo hành động; tách nhiệm vụ lập/duyệt; không leo thang | CÓ | `acc.test.ts` (người yêu cầu không tự duyệt, đảo phiếu), `config-admin.test.ts` (chủ tự duyệt cần mật khẩu), `admin.test.ts` (quản lý chỉ mời vai trò vận hành), `ein.test.ts` (hóa đơn điều chỉnh cần KT trưởng) |
| 6 | Che dữ liệu cá nhân theo vai trò; "Hiện" có nhật ký; xuất cần quyền và lý do | CÓ | `platform.test.ts` (mask, reveal, nhật ký không chứa giá trị), `crm.test.ts` (mask, xuất cột đầy đủ cần quyền + lý do + mật khẩu), `security-checklist.test.ts` "#6" (quét 16 route của CRM/REC/ACC/EIN/INV bằng 3 vai trò không có quyền: không có SĐT, email, địa chỉ đầy đủ) |
| 7 | Kiểm dữ liệu vào (zod), mã hóa đầu ra, CSP chặt, không script nội tuyến | MỘT PHẦN | zod ở biên (lớp application dùng `parseInput`, chưa có test quét); CSP: `e2e/slice-1-1.spec.ts:226`; không có `dangerouslySetInnerHTML` trong `src` (kiểm 04/11/2026 bằng grep, chưa có lint rule). THIẾU: luật ESLint cấm `dangerouslySetInnerHTML`; ZAP: NGOÀI |
| 8 | Chống NoSQL injection, bộ lọc danh sách trắng | CÓ | `isolation.test.ts` (`sort=password` bị từ chối), `security-checklist.test.ts` "#8" (chuỗi thù địch vào `q`, giá trị lọc rác ở 5 danh sách: 200 rỗng hoặc 400/422, không bao giờ 500). Truy vấn chỉ qua `queries.ts` (kiểm bằng `pnpm check:indexes`, `tests/unit/indexes.test.ts`) |
| 9 | Bí mật ở Secret Manager; không bí mật trong mã/log/bundle; gitleaks | MỘT PHẦN | log không chứa mật khẩu: `platform.test.ts:301`; bundle: `pnpm check:bundle`. THIẾU: `.github/workflows/ci.yml` không có bước gitleaks (đề xuất thêm bước `gitleaks/gitleaks-action` vào PR; không sửa trong lượt này vì ngoài phạm vi tệp của luồng A). Secret Manager: NGOÀI (cần GCP) |
| 10 | TOTP mã hóa KMS, mã khôi phục băm | NGOÀI | MFA làm sau theo quyết định chủ dự án |
| 11 | Token liên kết khách >= 128 bit, lưu băm, hạn, thu hồi, giới hạn tốc độ | CÓ | `rec-approval.test.ts:158` (băm, độ dài), `:192` (404 đồng nhất), `:211` (giới hạn tốc độ); `security-checklist.test.ts` "#11" duyệt MỌI collection sau kịch bản: token thô không nằm ở đâu |
| 12 | Tải tệp: loại, kích thước, xóa GPS, không thực thi, quyền khi tải | CÓ | `rec-orders.test.ts` (ảnh: giới hạn, GPS bị xóa, tệp đổi tên bị từ chối, ẩn không xóa, phạm vi), `ein.test.ts` (XML/PDF theo phạm vi, ghi nhật ký tải), `isolation-matrix.test.ts` (tệp hóa đơn) |
| 13 | Giới hạn tốc độ: đăng nhập, tìm kiếm, liên kết khách, API ngoài | CÓ | `recovery.test.ts:119,188` (đăng nhập, quên mật khẩu), `rec-approval.test.ts:211` (liên kết), `platform.test.ts:259` (reveal), `crm.test.ts` (tra cứu liên chi nhánh có giới hạn) |
| 14 | Nhật ký ghi cùng giao dịch, không sửa/xóa, không chứa bí mật hoặc dữ liệu cá nhân đầy đủ | CÓ (trừ bucket khóa) | `audit-idempotency.test.ts` (cùng giao dịch, bất biến), `security-checklist.test.ts` "#14" (sau kịch bản đầy đủ: nhận xe -> hóa đơn, reveal, xuất: `auditLogs` và `accessLogs` không chứa SĐT, email, địa chỉ, mật khẩu). Xuất sang bucket khóa lưu giữ: NGOÀI (cần GCP) |
| 15 | `pnpm audit`, Renovate, CodeQL | MỘT PHẦN | bước `pnpm audit:prod` ở CI. THIẾU: Renovate và CodeQL chưa có trong `.github` |
| 16 | IAM tối thiểu, tài khoản dịch vụ riêng | NGOÀI | cần GCP |
| 17 | TLS, mã hóa khi lưu | NGOÀI | mặc định của Google; cần GCP |
| 18 | PDPL: căn cứ xử lý, yêu cầu chủ dữ liệu, ẩn danh, nhật ký truy cập | MỘT PHẦN | `crm.test.ts` (đồng ý, rút, yêu cầu xóa, ẩn danh sau cổng lưu giữ); thời hạn lưu giữ và xử lý ảnh chờ luật sư (R104) |
| 19 | Thao tác nhạy cảm yêu cầu nhập lại mật khẩu | CÓ | `ein.test.ts:746` (hủy hóa đơn), `crm.test.ts:1098` (xuất cột đầy đủ), `acc.test.ts` (mở lại ngày: chủ nhập mật khẩu), `config-admin.test.ts:188` (tự duyệt cấu hình). Đổi vai trò: `admin.test.ts` (chỉ chủ gán vai trò quản lý); chưa có ca "nhập lại mật khẩu khi đổi vai trò" riêng |
| 20 | Pentest độc lập trước pilot | NGOÀI | cần bên thứ ba |

## Việc còn lại làm được trong repo (đề xuất, không thuộc phạm vi luồng A)

1. Thêm bước gitleaks và CodeQL vào `.github/workflows` (dòng 9, 15).
2. Luật ESLint `react/no-danger` (dòng 7).
3. Ca test "đổi vai trò cần mật khẩu" (dòng 19) nếu BA xác nhận đổi vai trò thuộc nhóm nhạy cảm.
