# Kế hoạch triển khai end-to-end của GMEP

Phiên bản 0.1 · 31/10/2026 · Người lập: dev (senior full-stack) · Trạng thái: **đề xuất, chờ chủ dự án duyệt**. Mọi con số về công sức và thời gian là **ước tính thô, không phải cam kết** (xem §10).

Đi kèm: [ADR 0001 tech stack](../adr/0001-tech-stack.md) · [Review tài liệu và thiết kế](review-docs-and-design.md). Kế hoạch này giả định ADR được chấp thuận; nếu spike Phase 0 không đạt, các mục dữ liệu ở §2.5 và §2.6 đổi theo đường lui PostgreSQL, phần còn lại giữ nguyên.

## 1. Tổng quan và nguyên tắc dẫn dắt

**Mục tiêu:** đưa chuỗi garage từ Excel sang một nền tảng web duy nhất, bắt đầu bằng pilot một chi nhánh, mở rộng theo đợt, giữ cách ly dữ liệu chi nhánh và số liệu hợp nhất cho chủ.

**Nguyên tắc:**

1. **Lát cắt dọc, đưa được vào dùng.** Mỗi slice đi từ giao diện đến cơ sở dữ liệu có test, không làm "toàn bộ cơ sở dữ liệu trước, giao diện sau".
2. **Chứng từ gốc và sổ chỉ ghi thêm trước, màn hình sau.** Kho và tiền là phần rủi ro nhất; xây sổ, giao dịch, test đồng thời trước khi dựng giao diện phụ.
3. **Không code khi quy tắc chưa chốt.** Điều chưa rõ gửi `ba` hoặc khách; không tự bịa quy tắc. Điều `[Cần xác nhận]` đi qua cấu hình hoặc giao diện, không cứng trong mã.
4. **Server là nơi quyết định.** Phân quyền, cách ly chi nhánh, che dữ liệu cá nhân, trạng thái cho phép, tính tiền đều ở server; giao diện chỉ hiển thị kết quả (`actions.allowed`, `reasonCode`).
5. **Giữ đường lui CSDL.** Domain không import `firebase-admin`; mọi truy cập qua repository và `UnitOfWork`.
6. **Đo trước khi tin.** Hiệu năng, chi phí đọc, khôi phục, tìm kiếm đều đo ở staging có dữ liệu mô phỏng.
7. **Pilot trước, nhân rộng sau**, mỗi giai đoạn qua cổng nghiệm thu (UAT cho mọi FR Must, FRD §13).

## 2. Kiến trúc đích

### 2.1 Phân lớp và bố cục mã

```text
src/
  app/                      # Next.js: trang (Server Components), layout, Route Handlers mỏng
    (auth)/ (shell)/ (public)/   # nhóm route: đăng nhập; ứng dụng có khung; trang khách bằng token
    api/v1/<module>/...      # transport: kiểm đầu vào (zod), xác thực, gọi use case, tuần tự hóa
  modules/
    sys/ crm/ rec/ ins/ inv/ pur/ hrm/ acc/ ein/ rpt/
      domain/               # thực thể, máy trạng thái, công thức (thuần, không I/O)
      application/          # use case, giao dịch, kiểm quyền, phát sự kiện
      ports/                # giao diện repository và cổng ngoài
      api/                  # schema zod và đăng ký route của module
      index.ts              # bề mặt công khai duy nhất của module
  platform/                 # dùng chung: auth/session, rbac+scope, audit, idempotency, config hiệu lực,
                            # numbering, outbox, jobs, files, print, i18n, logging, errors
  infrastructure/           # bộ chuyển: firestore, storage, identity, cloud-tasks, pdf, providers (einvoice, sms, zalo, email)
  ui/                       # component dùng chung (port từ design/), hooks, định dạng
  tests/                    # fixtures (ví dụ kế toán ký), helper, e2e
migrations/                 # NNNN-*.ts: lược đồ, chỉ mục, seed cấu hình, backfill (idempotent)
```

Quy tắc ép bằng CI: `domain` không import `application`, `infrastructure`, `next`, `firebase-admin`; module chỉ import module khác qua `index.ts`; `app/` không import `infrastructure` trực tiếp; không có gói `firebase` trong phần phụ thuộc của giao diện.

### 2.2 Ranh giới module

| Mã | Phân hệ | Sở hữu (thực thể chính) | Phụ thuộc vào | Phát ra sự kiện cho |
| --- | --- | --- | --- | --- |
| SYS | Quản trị hệ thống | Công ty, pháp nhân, chi nhánh, kho, người dùng, vai trò và phép gán, cấu hình có hiệu lực, phê duyệt, nhật ký, nhập Excel | (nền tảng) | Mọi module |
| CRM | Khách và xe | Khách, xe, quan hệ sở hữu, đồng ý và yêu cầu chủ dữ liệu, nhắc | SYS | REC, RPT |
| REC | Tiếp nhận và lệnh | Hồ sơ tiếp nhận, báo giá và phiên bản, lệnh, hạng mục, sự kiện giờ, QC, giao xe, bảo hành | CRM, INV (đọc tồn, giữ chỗ), SYS (cấu hình, giá, thuế) | INV (giữ chỗ, xuất), ACC (thu), EIN (hóa đơn), RPT |
| INS | Kiểm tra xe số | Mẫu, kết quả, tệp đính kèm | REC, CRM | REC |
| INV | Kho và phụ tùng | Danh mục, số dư, sổ biến động, chứng từ GRN, GIN, STO, ADJ, RTN, giữ chỗ, kiểm kê | SYS | REC, ACC, RPT |
| PUR | Mua hàng | Yêu cầu, đơn mua và phiên bản, nhận hàng, hóa đơn NCC, trả hàng | INV, ACC, SYS | INV, ACC |
| HRM | Nhân sự và công | Hồ sơ, ca, quy tắc tính công, dòng công, hoa hồng, kỳ công | REC (sự kiện giờ), SYS | ACC (xuất), RPT |
| ACC | Kế toán vận hành | Thanh toán, phân bổ, sổ quỹ, ca và ngày và kỳ, công nợ, giá vốn dịch vụ, bút toán đảo, xuất kế toán | REC, INV, SYS | RPT, EIN |
| EIN | Hóa đơn điện tử | Yêu cầu phát hành, hóa đơn, phiên bản, hàng chờ lỗi, cấu hình đơn vị phát hành | REC, ACC, SYS | REC (trạng thái), RPT |
| RPT | Báo cáo | Rollup, bảng tổng hợp, đối chiếu, cảnh báo ngoại lệ, xuất | Đọc từ sổ và rollup của các module | (không phát) |

Phụ thuộc là một chiều theo bảng (không vòng); thông tin ngược đi qua sự kiện hoặc outbox.

### 2.3 Quy ước API

| Mục | Quy ước |
| --- | --- |
| Đường dẫn | `/api/v1/<module>/<tài nguyên>`; hành động dùng động từ rõ nghĩa (`POST .../quotes/{id}:send`) |
| Định dạng | JSON, camelCase; thời điểm ISO 8601 UTC; ngày nghiệp vụ `businessDate: "yyyy-MM-dd"`; tiền là số nguyên VND; số lượng và giờ là chuỗi thập phân |
| Hợp đồng | `zod` ở biên; OpenAPI sinh từ `zod`; client sinh kiểu; thay đổi phá vỡ cần phiên bản `v2` |
| Lỗi | `application/problem+json`: `type`, `title` (tiếng Việt), `status`, `code` ổn định, `traceId`, `errors[]` theo trường |
| Danh sách | Con trỏ; `limit` ≤ 100; sắp xếp và lọc theo danh sách trắng; không tổng số mặc định, `?count=true` dùng `count()` |
| Ghi | `Idempotency-Key` bắt buộc cho thu tiền, hóa đơn, duyệt, chứng từ kho, hủy, đảo; `If-Match: <version>` cho cập nhật |
| Khả năng | Mỗi bản ghi chi tiết và dòng danh sách trả `actions: {tên: {allowed, reasonCode}}` |
| Bảo mật | Cookie phiên + kiểm `Origin`; giới hạn tốc độ; kích thước thân yêu cầu giới hạn; đầu ra mã hóa; trang khách dùng token ≥ 128 bit, lưu băm, có hạn và thu hồi khi phiên bản bị thay |
| API ngoài (FR-SYS-017, Should) | Khóa riêng theo hệ thống, quyền hẹp theo phạm vi, nhật ký gọi; cùng route, khác xác thực |

### 2.4 Xác thực, RBAC, cách ly chi nhánh

Chi tiết cơ chế ở ADR §6.3. Điểm triển khai:

- `roleAssignments`: người dùng × vai trò × chi nhánh (nhiều dòng); quyền là **hợp** các dòng theo từng chi nhánh (FR-SYS-012); quyền theo hành động `resource:action` (xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất, quản lý; FR-SYS-013), vai trò cấu hình được.
- `resolveScope(user, permission) → Scope` (`{kind: 'all'}` hoặc `{kind: 'branches', ids}`); `ids` có thể vượt 30 nên repository chia truy vấn hoặc bỏ điều kiện khi `all`.
- **Repository bắt buộc nhận `Scope`**; tìm kiếm, báo cáo, xuất, tệp, liên kết đều đi qua cùng cơ chế. Bản ghi ngoài phạm vi trả 404.
- Phần dữ liệu xuyên chi nhánh (khách, xe, lịch sử xe, tồn chi nhánh khác, bảo hành chéo) là **các phép chiếu được định nghĩa tường minh** (kết quả BA-05), không phải nới `Scope`.
- Quy tắc "người lập khác người duyệt" xét theo **người**, không theo vai trò, nên một người kiêm nhiều vai trò vẫn bị chặn tự duyệt.
- Bộ test ma trận (vai trò × chi nhánh × endpoint) sinh từ danh sách route; thêm route mới mà thiếu test thì CI đỏ.

### 2.5 Lớp truy cập dữ liệu

- Mỗi module khai báo `ports/*Repository.ts` (giao diện theo ngôn ngữ nghiệp vụ, không theo Firestore) và `ports/UnitOfWork.ts` (`run(fn)` mở giao dịch; các repository gắn với giao dịch).
- Bộ chuyển Firestore ở `infrastructure/firestore`: ánh xạ tài liệu ↔ thực thể, xây truy vấn từ bộ lọc danh sách trắng, quản lý chỉ mục trong `firestore.indexes.json`, bao `runTransaction` kèm thử lại có giới hạn.
- Giao dịch **không bao giờ** gọi dịch vụ ngoài (hóa đơn, tin nhắn, tệp); việc ngoài đi qua `outbox` ghi cùng giao dịch.
- Bộ chuyển trong bộ nhớ dùng cho test đơn vị use case (nhanh); test tích hợp dùng Firebase Emulator.
- Kiểm tra kiến trúc ở CI giữ cho đường lui PostgreSQL còn khả thi.

### 2.6 Nguyên tắc mô hình dữ liệu Firestore

**Collection cấp cao, không lồng sâu**, mỗi tài liệu có `companyId` (và `branchId` nếu cấp chi nhánh), `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `version`. Tài liệu giới hạn dưới 1 MiB; dòng chi tiết đủ lớn hoặc nhiều đi vào collection con.

| Nhóm | Collection chính | Ghi chú |
| --- | --- | --- |
| Tổ chức | `companies`, `legalEntities`, `branches` (kèm `legalEntityAssignments` có hiệu lực), `warehouses`, `branchGroups` | Thêm chi nhánh là thêm tài liệu (FR-SYS-005, NFR-SCA-01) |
| Danh tính, quyền | `users`, `roleAssignments`, `roles`, `devices` (thiết bị xưởng), `sessions`, `loginAttempts` | Vai trò không đặt trong custom claim |
| Cấu hình | `configs/{loại}/versions/{id}` (thuế, giờ chuẩn, bảng giá, hạn mức, chu kỳ nhắc, mẫu chứng từ, quy trình dịch vụ, checklist QC, ma trận phê duyệt, chính sách che) | `effectiveFrom`, trạng thái, người duyệt, lý do |
| CRM | `customers`, `customerPii` (SĐT, địa chỉ, giấy tờ), `consents`, `dataSubjectRequests`, `vehicles`, `vehicleOwnerships` | PII tách riêng để ẩn danh được (DM-8) |
| Danh mục | `parts`, `partCompat`, `services`, `servicePackages`, `priceLists` | Cấp công ty |
| REC | `appointments`, `intakes`, `quotes` + `quoteVersions` (+ dòng), `repairOrders` + `repairItems`, `timeEvents`, `qcRecords`, `deliveries`, `warranties` | Năm đối tượng, năm bộ trạng thái |
| INV | `stockBalances` (kho × phụ tùng), `stockMovements` (chỉ ghi thêm), `stockDocuments` (GRN, GIN, STO, ADJ, RTN) + dòng, `reservations`, `stocktakes` | Không có API sửa số lượng |
| ACC | `payments`, `paymentAllocations`, `cashLedger` (chỉ ghi thêm), `cashShifts`, `dayCloses`, `periods`, `receivables` (khi làm công nợ), `reversals` | Bút toán đảo liên kết chứng từ gốc |
| EIN | `invoiceRequests` (khóa chống trùng làm ID), `invoices` + `invoiceVersions`, `invoiceArtifacts` (con trỏ XML và PDF) | Trạng thái lấy từ nhà cung cấp |
| RPT | `rollups/{branchId}_{yyyyMMdd}`, `rollups/{branchId}_{yyyyMM}`, `branchState/{branchId}` (số phiên bản cho làm mới) | Số tạm và chính thức |
| Hệ thống | `auditLogs` (chỉ ghi thêm), `accessLogs`, `idempotencyKeys`, `outbox`, `counters`, `importBatches`, `files`, `notifications`, `approvals`, `schemaMigrations` | |

Quy ước: ID tài liệu sinh có chủ đích khi cần chống trùng (ví dụ biến động kho `GIN-…#dòng`, yêu cầu phát hành hóa đơn theo `lệnh:phiên bản`); trường chuẩn hóa tìm kiếm (`plateNorm`, `phoneNorm`, `nameNorm`, `codeSeq`); `businessDate` lưu tường minh; số lượng thập phân lưu số nguyên với tỉ lệ cố định ghi trong tài liệu schema.

### 2.7 Nhật ký thao tác

Dịch vụ `audit.record({entityType, entityId, action, before, after, reason})` chạy **trong giao dịch** của thay đổi nghiệp vụ. Nhật ký chứa người, vai trò, chi nhánh, thời điểm, `requestId`, thiết bị; giá trị đổi ở mức trường; dữ liệu cá nhân thay bằng tham chiếu id. Truy cập dữ liệu cá nhân (Hiện, xuất) ghi `accessLogs`. Không có API sửa hoặc xóa. Xuất hằng đêm sang bucket khóa lưu giữ. Màn G4-SYS-19 chỉ đọc.

### 2.8 Idempotency

`Idempotency-Key` → tài liệu `idempotencyKeys/{hash(người dùng, route, khóa)}` tạo bằng `create()` trong giao dịch ghi nghiệp vụ, kèm kết quả đã trả; yêu cầu lặp lại trả lại đúng kết quả. Chứng từ có khóa nghiệp vụ (hóa đơn theo lệnh và phiên bản, biến động kho theo chứng từ và dòng) dùng ID xác định nên an toàn kể cả khi mất khóa HTTP. Thu tiền: nút khóa ở giao diện chỉ là lớp ngoài, bảo đảm thật nằm ở server.

### 2.9 Tác vụ nền

Cloud Tasks (tên tác vụ xác định), Cloud Scheduler, Cloud Run Jobs; outbox ghi cùng giao dịch. Danh sách tác vụ: gửi hóa đơn và thử lại và đồng bộ trạng thái; gửi tin nhắn (cổng SMS, Zalo, email trừu tượng); nhắc bảo dưỡng, đăng kiểm, bảo hiểm; hết hạn báo giá; chuyển cấp phê duyệt quá hạn; đối soát rollup và số dư kho hằng đêm; xuất nhật ký; kiểm tra sao lưu; nhập và xuất Excel; dựng PDF.

### 2.10 Tệp

Qua API (ADR §7.3, phương án A); ảnh nén và xử lý `sharp`; siêu dữ liệu `files/{id}` mang `branchId` để kiểm quyền; bucket riêng cho tệp nghiệp vụ, XML và PDF hóa đơn, bản xuất khóa lưu giữ. Quyết định B (URL ký cho video) chỉ khi chủ dự án chấp thuận.

### 2.11 In và PDF

Mẫu in là HTML in-first dùng chung cho in trình duyệt và PDF máy chủ (ADR §7.5). Mẫu theo khổ (A4, A5, nhiệt 80 và 58 mm), không theo hãng máy; mẫu là cấu hình có hiệu lực (FR-SYS-006). Mỗi lần in ghi nhật ký; in lại biên bản và chứng từ tiền cần lý do.

### 2.12 Lớp hóa đơn điện tử

`EInvoiceProvider` (ADR §7.8) + máy trạng thái `InvoiceRequest` + outbox + `FakeProvider`. Điều kiện phát hành (FR-EIN-011) là danh sách kiểm đọc từ cấu hình; thuế suất theo `resolveAt(tax, nhóm, ngày áp)` với "ngày áp" theo kết quả BA-03; XML và PDF lưu cục bộ.

### 2.13 Cấu hình có hiệu lực

Một khuôn dùng chung: `ConfigVersion<T>` (`effectiveFrom`, `status`, `proposedBy`, `approvedBy`, `reason`); `resolveAt(type, scopeKey, date)`; phê duyệt theo nhóm (đã thiết kế ở SYS-07…14); không cho ngày hiệu lực quá khứ hoặc trùng; tài liệu nghiệp vụ lưu bản chụp giá trị đã dùng (báo giá, lệnh, hóa đơn). Dùng cho thuế, giờ chuẩn, bảng giá, hạn mức giảm giá, chu kỳ nhắc, mẫu in, quy trình theo loại dịch vụ, checklist QC, ma trận phê duyệt, chính sách che, phương pháp tính công, phương pháp giá vốn.

### 2.14 Máy trạng thái

Năm đối tượng (báo giá, lệnh, hạng mục, thanh toán, hóa đơn) mỗi đối tượng một bảng chuyển `{từ, sự kiện, điều kiện, hiệu ứng}` ở `domain/`, hàm thuần `transition(state, event, ctx) → {state, effects} | Rejection(reasonCode)`. Lý do tạm dừng, thuộc tính duyệt phát sinh, cờ chờ duyệt hủy là trường phụ, không phải trạng thái. Bảng chuyển được test theo bảng (mọi cặp trạng thái × sự kiện) và là nguồn của `actions.allowed`.

## 3. Quy trình làm việc giữa các agent

| Vai trò | Việc | Đầu ra |
| --- | --- | --- |
| `orchestrator` | Điều phối, kiểm đối chiếu `docs/`, đưa quyết định mở lên chủ dự án; **tối đa 2 agent chạy song song** | Bản tóm tắt phiên bản, danh sách chặn |
| `ba` | Chốt FR, tiêu chí nghiệm thu, bảng trạng thái và quy tắc cho slice; chuyển câu hỏi cho khách; duyệt kết quả theo tiêu chí | FRD v0.4 và các bảng quy tắc, UAT |
| `designer` | Bổ sung màn hình, trạng thái, nội dung chữ khi slice cần; đối chiếu bản dựng thật với prototype | Cập nhật `design/` và tài liệu gói; báo cáo lệch |
| `dev` | Kế hoạch slice, xây, test, đo, tài liệu | Mã, test, ADR phát sinh, runbook; báo cáo thay đổi hành vi cho `ba` |

**Vòng mỗi slice:**

1. `ba` xác nhận danh sách FR, tiêu chí nghiệm thu, bảng trạng thái, quy tắc và ví dụ số (ký bởi kế toán nếu có công thức). Chưa đủ thì **dừng slice**, không code.
2. `designer` xác nhận màn hình, trạng thái (tải, rỗng, lỗi, không quyền, chỉ đọc), nội dung chữ, hành vi responsive. Thiếu thì gửi lại.
3. `dev` viết kế hoạch slice ngắn (phạm vi, tệp, test) trước khi code, rồi xây theo thứ tự: domain và test, use case và test tích hợp, API, giao diện, e2e.
4. `dev` chạy lint, kiểm kiểu, test, ứng dụng thật; đo bằng Playwright.
5. `ba` đối chiếu tiêu chí nghiệm thu với bản chạy thật; `designer` so sánh trực quan với prototype; sửa theo kết quả.
6. `dev` cập nhật `CLAUDE.md` (Status, lệnh) và README khi cần; báo cáo thay đổi hành vi cho `ba` cập nhật tài liệu nghiệp vụ.

**Ghép song song điển hình (tối đa 2 agent cùng lúc):** `ba` (chuẩn bị slice N+1) + `dev` (xây slice N); `designer` (danh mục component hợp nhất) + `dev` (nền tảng); hoặc `ba` + `designer` khi cần đóng khoảng trống yêu cầu và thiết kế trước khi `dev` bắt đầu. `ba` luôn đi trước `designer` khi yêu cầu chưa rõ.

## 4. Định nghĩa "xong" (Definition of Done)

Một slice hoặc FR chỉ xong khi **tất cả** đúng:

1. Mỗi tiêu chí nghiệm thu của FR có test tự động đạt (đơn vị, tích hợp hoặc e2e); tên test chứa mã FR hoặc RULE; không bỏ qua hoặc làm yếu test để đạt.
2. Công thức tiền, thuế, giá, giờ công, giá vốn có bộ ví dụ kế toán ký (NFR-MNT-01).
3. Cách ly chi nhánh có test ma trận cho mọi danh sách, tìm kiếm, báo cáo, xuất, tệp của slice (NFR-ISO-01).
4. Mọi thay đổi có nhật ký trong cùng giao dịch (FR-SYS-003); mọi bản ghi nghiệp vụ có người tạo, thời điểm, chi nhánh.
5. Phân quyền theo hành động có test cho vai trò có quyền và không có quyền; dữ liệu cá nhân che theo chính sách; truy cập có nhật ký.
6. Ghi tiền, kho, hóa đơn có `Idempotency-Key` và test phát lại; có khóa lạc quan; có test đồng thời cho tồn.
7. Màn hình có đủ trạng thái tải, rỗng, lỗi, không quyền, chỉ đọc, mất kết nối (chỉ cảnh báo và nháp); dùng token không đổi; không có `style=` tại chỗ ngoài tham số hóa; axe không có lỗi nghiêm trọng; dùng được bằng bàn phím; chạm ≥ 44 px trên cảm ứng.
8. Chuỗi giao diện qua i18n; VND và `dd/MM/yyyy`; tìm kiếm không dấu.
9. Dữ liệu cấu hình theo ngày hiệu lực thay vì cứng trong mã; mục `[Cần xác nhận]` đi qua cấu hình hoặc cổng.
10. Migration chạy được trên cơ sở dữ liệu sạch và nâng từ bản trước; chỉ mục khai báo và kiểm bằng script.
11. Không log bí mật hoặc dữ liệu cá nhân đầy đủ; không commit khóa, tệp Excel thật; fixture là dữ liệu giả.
12. Ngân sách đọc của màn hình đo được và nằm trong giới hạn; p95 thao tác thường dưới 2 giây ở staging trên mạng 4G mô phỏng.
13. Tài liệu: README và runbook cập nhật; ADR cho quyết định mới; báo cáo thay đổi hành vi cho `ba`; sai lệch với `design/` báo cho `designer` kèm lý do.
14. Review diff theo hướng đối kháng: sai phạm vi chi nhánh, thiếu nhật ký, tranh chấp, tiền dạng số thực, thiếu kiểm quyền, lộ dữ liệu cá nhân, migration khóa hoặc mất dữ liệu.

## 5. Chiến lược kiểm thử

| Tầng | Công cụ | Phủ | Cổng CI |
| --- | --- | --- | --- |
| Đơn vị domain | Vitest, `fast-check` | Máy trạng thái (mọi cặp trạng thái × sự kiện), thuế, giá, giờ công, hoa hồng, giá vốn bình quân, tuổi nợ, giữ chỗ và khả dụng, làm tròn; **bảng ví dụ kế toán ký** (`tests/fixtures/accounting/*.json` có `signedOffBy`, `signedAt`) | Mọi PR |
| Use case | Vitest + bộ chuyển trong bộ nhớ | Quy tắc nghiệp vụ, phê duyệt, tách nhiệm vụ | Mọi PR |
| Tích hợp API và CSDL | Vitest + Firebase Emulator (Firestore, Auth, Storage) | Hợp đồng API, giao dịch, nhật ký cùng giao dịch, **ma trận cách ly chi nhánh**, quyền theo hành động, che dữ liệu cá nhân, chống trùng và phát lại, **đồng thời** (giữ chỗ, xuất, thu tiền), nhập Excel | Mọi PR |
| Tích hợp trên Firestore thật | Cùng bộ test, dự án staging | Chỉ mục, tranh chấp thực, độ trễ | Hằng đêm |
| Hợp đồng ngoài | `FakeProvider` chèn lỗi | Hóa đơn: nhấn hai lần, timeout rồi truy vấn, lỗi dữ liệu, nhà cung cấp chậm | Mọi PR |
| E2E | Playwright (desktop, tablet, điện thoại) | UAT-01 (nhận xe đến hóa đơn), 03, 06, 08, 09, 13, 17, 20, 23 và các hành trình theo vai trò | Trước khi gộp vào nhánh chính hoặc hằng đêm, tùy thời lượng |
| Truy cập | `@axe-core/playwright`, kiểm bàn phím, kiểm tương phản theo token | WCAG 2.2 AA | Mọi PR (màn đã làm) |
| Hiệu năng | k6 + dữ liệu mô phỏng | NFR-PERF-01, 02; ngân sách đọc | Hằng tuần và trước mỗi cổng |
| Bảo mật | CodeQL, `gitleaks`, `pnpm audit`, quét bundle (không có Firebase), OWASP ZAP baseline, kiểm thử thâm nhập độc lập | NFR-SEC-02 | Mọi PR (SAST), trước pilot (pentest) |
| Khôi phục | Diễn tập sao lưu | RTO và RPO | Hằng quý và trước go-live |
| UAT | Kịch bản UAT-01 đến 26 theo giai đoạn | Nghiệm thu với khách | Mỗi cổng |

**Dữ liệu kiểm thử:** bộ seed ẩn danh (một chi nhánh, vài chục xe, lệnh ở đủ trạng thái, phụ tùng), bộ mô phỏng khối lượng (20 chi nhánh × 1 năm) sinh bằng script; không dùng dữ liệu khách thật.

## 6. CI/CD và môi trường

| Môi trường | Dự án | Mục đích | Dữ liệu |
| --- | --- | --- | --- |
| local | Emulator | Dev và test | Seed giả |
| dev | GCP riêng | Tích hợp liên tục | Seed giả; hóa đơn dùng `FakeProvider` |
| staging | GCP riêng, cùng vùng prod | UAT, tải, khôi phục, diễn tập nhập dữ liệu; môi trường thử của nhà cung cấp hóa đơn | Mô phỏng và dữ liệu khách đã ẩn danh khi được phép |
| prod | GCP riêng, quyền tối thiểu | Chạy thật | Dữ liệu thật |

**Pipeline (GitHub Actions):** PR: cài đặt có khóa phụ thuộc → lint → kiểm kiểu → kiểm ranh giới module → kiểm bundle → test đơn vị → test tích hợp (emulator) → kiểm chỉ mục → build container → e2e → quét bảo mật. Nhánh chính: triển khai `dev`. Thẻ phát hành: `staging` rồi `prod` có duyệt tay. Triển khai bằng Workload Identity Federation, không khóa dài hạn; bí mật ở Secret Manager. Migration chạy như bước riêng trước khi chuyển lưu lượng, có thể tiếp tục và quay lại bằng tính năng cờ. Khi nhận thấy lỗi nặng: quay về bản trước (Cloud Run revision), dữ liệu tương thích ngược nhờ migration "mở rộng trước, thu hẹp sau".

**Ghi chú lệnh:** sau khi scaffold, lệnh build, lint, test, e2e được ghi vào `CLAUDE.md` (chủ dự án chấp thuận ADR rồi mới làm).

## 7. Các giai đoạn

Tổng quan:

| Giai đoạn | Mục tiêu | Ước tính (người-tuần, tuần lịch với 4 dev + 1 QA + 0,5 DevOps) |
| --- | --- | --- |
| 0 | Nền tảng, đóng khoảng trống yêu cầu, spike Firebase, khung dự án | 10 đến 14 pw; 4 đến 6 tuần |
| 1 | Pilot một chi nhánh: vận hành xưởng, kho cơ bản, thu tiền tối thiểu, hóa đơn cơ bản, báo cáo một chi nhánh | 120 đến 160 pw; 26 đến 34 tuần, kèm hypercare 4 tuần |
| R | Mở rộng theo đợt (chạy song song giai đoạn 2) | 15 đến 25 pw hỗ trợ và sửa lỗi; 8 đến 12 tuần |
| 2 | Nhân công, mua hàng, kho đầy đủ, phê duyệt, hợp nhất đa chi nhánh, thông báo | 85 đến 115 pw; 17 đến 23 tuần |
| 3 | Kế toán đầy đủ, hóa đơn đầy đủ, kết xuất kế toán | 42 đến 58 pw; 10 đến 14 tuần |
| 4 | Đối soát ngân hàng, báo cáo nâng cao, API ngoài, mở rộng quy mô | 30 đến 42 pw; 8 đến 12 tuần |
| Xuyên suốt | Củng cố (hardening): bảo mật, hiệu năng, truy cập, khôi phục | Đã nằm trong từng giai đoạn |

Phạm vi FR theo giai đoạn dưới đây lấy từ FRD §13 (chốt giai đoạn 1) và bảng "giai đoạn theo BRD"; phần ghi **[đề xuất]** là tôi đề xuất xếp, `ba` và chủ dự án xác nhận ở FRD v0.4.

### Giai đoạn 0: Nền tảng, đóng khoảng trống, spike

**Mục tiêu:** có quyết định kiến trúc đã kiểm chứng, phạm vi Phase 1 đóng băng, khung dự án chạy được từ đầu đến cuối (walking skeleton) trên staging.

**Phạm vi:** không có FR nghiệp vụ mới; dựng nền tảng cho SYS và hạ tầng chung.

**Sản phẩm chính:** ADR được chấp thuận (hoặc điều chỉnh); kết quả spike S1 đến S8 kèm quyết định đạt hoặc không đạt; FRD v0.4 baseline (BA-01, BA-02); bảng quyết định nghiệp vụ đã chốt (BA-03 đến 15); danh mục component hợp nhất (DS-02); repo, CI/CD, bốn môi trường; bộ bảng "ví dụ kế toán ký" bản nháp (§9.2); công cụ seed.

**Các slice theo thứ tự:**

1. **0.1 Quyết định và spike.** Chấp thuận ADR, cấp dự án GCP, chạy S1 đến S8, báo cáo. (`dev`; chủ dự án cấp quyền; không scaffold mã sản phẩm trước khi ADR được chấp thuận.)
2. **0.2 Đóng khoảng trống yêu cầu** (song song 0.1). `ba` áp dụng `proposed-doc-changes.md`, lập danh sách FR Phase 1, bảng ranh giới cách ly (BA-05), gửi câu hỏi cho kế toán và luật sư (BA-03, 04, 06, 09, 10, 11, 13). `designer` làm danh mục component hợp nhất, mẫu in in-first, quy ước làm mới và kiểu tìm kiếm.
3. **0.3 Khung dự án.** Scaffold Next.js, cấu trúc module, ESLint và ranh giới, Vitest, Playwright, emulator, CI, Terraform tối thiểu, môi trường `dev` và `staging`, `CLAUDE.md` cập nhật lệnh.
4. **0.4 Walking skeleton.** Port token, `base.css`, `components.css`, shell và vài component cốt lõi; đăng nhập mật khẩu + cookie phiên; `resolveScope`; một danh sách có phân trang cách ly theo chi nhánh; nhật ký; một e2e chạy trên CI; triển khai staging.

**Phụ thuộc:** chủ dự án (chấp thuận ADR, cấp GCP, quyết định ACC và INS trong Phase 1); `ba` (FRD v0.4); `designer` (danh mục component); khách (mẫu Excel ẩn danh, ba con số tải: BA-20; kế toán; luật sư).

**Tiêu chí thoát:** ADR Accepted; spike đạt hoặc đã chọn đường lui; FRD v0.4 phát hành và phạm vi Phase 1 đóng băng; skeleton chạy trên staging có CI xanh; hạn mốc pháp lý 1/1/2027 có quy tắc đã chốt (BA-03) hoặc có phương án tạm đã duyệt.

**Kiểm thử:** kết quả spike; test cách ly tối thiểu; e2e skeleton.

**Rủi ro chính:** chủ dự án hoặc khách trả lời chậm (kéo dài giai đoạn); spike không đạt (chuyển sang PostgreSQL thêm 6 đến 10 pw ở giai đoạn này); chưa có luật sư trả lời về vùng dữ liệu (chặn tạo database prod, không chặn staging).

### Giai đoạn 1: Pilot một chi nhánh

**Mục tiêu:** một chi nhánh chạy thật, thay Excel cho vận hành hằng ngày: nhận xe, báo giá, duyệt, sửa, kiểm tra, thu tiền, hóa đơn, giao xe, kho cơ bản, báo cáo ngày.

**Phạm vi (FRD §13 và bản 0.2, 0.3):**

- REC: toàn bộ 19 FR Must (REC-001, 002, 004, 005, 007, 008, 009, 010, 012, 013, 014, 015, 021, 022, 023, 028, 030, 031, 032). **[đề xuất]** kéo thêm các FR Should mà thiết kế Phase 1 cần để vận hành: REC-003 (cảnh báo km), 016 (checklist QC, WF-04), 017 (biên bản giao xe), 026 (cách duyệt tại quầy).
- CRM: FR-CRM-001, 002, 004, 010, 011, 013, 014, 017.
- INV cơ bản: FR-INV-001, 002, 003, 005, 006, 007, 008, 019, 020, 021, 025, 027; FR-INV-009 như cấu hình phương pháp giá vốn.
- EIN cơ bản: FR-EIN-001 đến 006, 011, 013. **[đề xuất]** FR-EIN-009, 010 (cảnh báo lệnh chưa hóa đơn, hàng chờ lỗi) và mức tối thiểu của FR-EIN-007 (điều chỉnh, thay thế, hủy có duyệt), vì các màn EIN-04…06 đã được thiết kế ở P1.
- SYS: toàn bộ FR Must (001, 002, 003, 005, 006, 007, 009, 010, 011, 012, 013, 018).
- RPT: FR-RPT-001, 003, 004, 011, 012, 013, 014 ở mức một chi nhánh.
- **[đề xuất, cần chủ dự án quyết định, BA-02]** ACC tối thiểu: FR-ACC-001, 002, 003, 004 (thu tiền, cọc, sổ quỹ, chốt ca và ngày), FR-ACC-009 (thuế suất có hiệu lực: cần cho tổng tiền báo giá và hóa đơn), phê duyệt mức tối thiểu của FR-SYS-004, đảo bút toán (FR-ACC-021 theo đề xuất).
- INS: chỉ nếu khách xác nhận (BA-19); mọi FR đều Should.

**Các slice theo thứ tự** (mỗi slice là một lát dọc có demo; cột phụ thuộc là điều phải có trước):

| Slice | Nội dung | FR chính | Phụ thuộc |
| --- | --- | --- | --- |
| 1.1 Nền tảng | Xác thực đầy đủ (mật khẩu, MFA TOTP, PIN thiết bị xưởng, quên và đặt lại mật khẩu, lời mời), phiên, `roleAssignments` và quyền theo hành động, che dữ liệu cá nhân, nhật ký, idempotency, đánh số chứng từ, khung cấu hình có hiệu lực, thông báo trong hệ thống, trang lỗi, shell theo vai trò | SYS-001, 002, 003, 009, 011, 012, 013 | Quyết định BA-12, 13 |
| 1.2 Dữ liệu chủ | Cơ cấu tổ chức (SYS-011, 018), chi nhánh và kho (SYS-005), người dùng và vai trò (SYS-01…04, 24), danh mục dịch vụ, giờ chuẩn, đơn giá giờ, bảng giá, thuế, hạn mức giảm giá, mẫu chứng từ (SYS-006 / SYS-07…14), phê duyệt cấu hình | SYS-005, 006, 018; ACC-009; INV-025 | BA-03, 04 |
| 1.3 CRM lõi | Khách, xe, quan hệ sở hữu có hiệu lực, lịch sử xe xuyên chi nhánh (phép chiếu), đồng ý và yêu cầu chủ dữ liệu, tìm kiếm không dấu, xuất có quyền | CRM-001, 002, 004, 010, 011, 013, 014, 017 | BA-05, 10 |
| 1.4 Sổ kho | Danh mục phụ tùng, số dư bốn số, chứng từ GRN, GIN, RTN, ADJ (mở đầu kỳ), giữ chỗ, chặn tồn âm, giá vốn bình quân, bảng giá chuẩn; test đồng thời | INV-001, 002, 003, 005, 006, 007, 008, 019, 020, 021, 027 | BA-02, 06, 07 |
| 1.5 Báo giá và duyệt | Tiếp nhận (wizard 5 bước, nháp), báo giá có dòng công và phụ tùng, phiên bản, chụp giá, duyệt một phần, trang khách qua liên kết, duyệt tại quầy, in A4, hạng mục bắt buộc và tùy chọn | REC-001, 002, 003, 004, 005, 007, 008, 009, 023, 026, 030, 031, 032 | 1.2, 1.3, 1.4 (đọc tồn); BA-18 |
| 1.6 Thực hiện lệnh | Mở lệnh từ báo giá được duyệt, máy trạng thái lệnh và hạng mục, phân thợ, tablet thợ (bắt đầu, tạm dừng, kết thúc và hoàn tác), yêu cầu phụ tùng và xuất kho, hạng mục phát sinh và báo giá bổ sung, bảng điều phối, QC, giao xe và biên bản, hủy và hoàn kho, in A5 và nhiệt | REC-010, 012, 013, 014, 015, 016, 017, 021, 022, 028 | 1.5, 1.4; BA-08, 15, 21 |
| 1.7 Tiền tối thiểu | Thu tiền nhiều hình thức, cọc, sổ quỹ, chốt ca, chốt ngày, bút toán đảo, phê duyệt tối thiểu | ACC-001, 002, 003, 004, (009), SYS-004 | 1.6; BA-02, 13, 14 |
| 1.8 Hóa đơn cơ bản | `EInvoiceProvider`, `FakeProvider`, phát hành từ lệnh với khóa chống trùng, đồng bộ trạng thái, lưu XML và PDF, điều kiện phát hành, hàng chờ lỗi, điều chỉnh, thay thế, hủy tối thiểu có duyệt; bộ chuyển nhà cung cấp thật khi đã chọn | EIN-001 đến 006, 009, 010, 011, 013, (007) | 1.7; BA-09; chọn nhà cung cấp |
| 1.9 Báo cáo một chi nhánh | Rollup ngày và tháng, dashboard theo vai trò, báo cáo ngày và tháng, đối chiếu bốn chiều, cảnh báo ngoại lệ, đi sâu chứng từ, xuất | RPT-001, 003, 004, 011, 012, 013, 014; RPT-008 (phần P1) | 1.6, 1.7, 1.8; BA-16 |
| 1.10 INS (có điều kiện) | Mẫu kiểm tra, thực hiện trên tablet, ảnh và video qua API, danh sách lỗi và chuyển thành dòng báo giá | INS-001 đến 008 | BA-19; ADR §7.3 |
| 1.11 Nhập dữ liệu và công cụ di chuyển | Nhập Excel theo mẫu, ánh xạ cột, kiểm tra theo dòng, chạy thử, ghi theo lô, hoàn tác; tồn đầu kỳ qua chứng từ; diễn tập (xem §9.1) | SYS-007 | Mẫu Excel của khách (BA-20); chạy sớm từ sau 1.4 |
| 1.12 Củng cố và vào pilot | Hiệu năng, truy cập, bảo mật (kể cả kiểm thử thâm nhập), diễn tập khôi phục, UAT, đào tạo, in thử trên máy thật, cutover, hypercare | UAT-01…03, 06…10, 12, 13, 17…20, 22, 23, 25 | Thiết bị thật tại chi nhánh pilot |

Thứ tự đề xuất: 1.1 → 1.2 → (1.3 và 1.4 song song, mỗi người một việc) → 1.5 → 1.6 → 1.7 → 1.8 → 1.9; 1.11 chạy song song từ sau 1.4; 1.10 chen vào nếu được xác nhận; 1.12 cuối. Lý do: vòng "nhận xe đến giao xe" cần chạy sớm nhất có thể để khách xem và phản hồi; kho đi trước lệnh vì lệnh giữ chỗ và xuất phụ tùng; tiền và hóa đơn đi sau lệnh nhưng trước báo cáo vì báo cáo đối chiếu cần cả bốn thành phần.

**Phụ thuộc vào khách và chủ dự án:** quyết định ACC và INS trong Phase 1; BA-03 (thuế 1/1/2027); kế toán chốt phương pháp giá vốn và ví dụ số; nhà cung cấp hóa đơn (môi trường thử, tài liệu API, phí tích hợp theo FRD §8); thiết bị thật (tablet xưởng, máy in, camera); mẫu Excel và người phụ trách làm sạch dữ liệu; luật sư về vùng dữ liệu và căn cứ xử lý dữ liệu cá nhân.

**Tiêu chí thoát (cổng pilot, FRD §13):** mọi FR Must của Phase 1 đạt kịch bản UAT tương ứng; pilot chạy song song với Excel ít nhất bốn tuần và đạt các chỉ số BRD §3 áp dụng cho một chi nhánh (đối chiếu Excel, truy vết xuất kho 100%, thời gian từ nhận xe đến báo giá, thời gian chốt ngày, hóa đơn đúng hạn); báo cáo đối chiếu "xuất kho không chứng từ" bằng 0; kiểm thử thâm nhập không còn lỗi mức nghiêm trọng (NFR-SEC-02); diễn tập khôi phục đạt RTO đã đo; không có sai lệch tồn kho chưa giải thích sau kiểm kê khởi tạo.

**Kiểm thử:** như §5; trọng tâm là test đồng thời cho tồn, test phát lại cho tiền và hóa đơn, ma trận cách ly, bảng ví dụ ký của kế toán, e2e UAT-01.

**Rủi ro chính:** (1) sổ kho và giữ chỗ trên Firestore (R-01, R-04); (2) phát hành hóa đơn trùng hoặc mất (R-05); (3) thợ và thủ kho không dùng hệ thống (rủi ro đã nêu ở BRD §8; giảm bằng tablet 2 chạm, đào tạo tại chỗ); (4) dữ liệu Excel sai (đối chiếu kiểm kê); (5) mốc thuế 1/1/2027 rơi vào giữa pilot; (6) nhà cung cấp hóa đơn chọn muộn làm chậm tích hợp thật (giảm bằng `FakeProvider` và cổng).

### Đợt mở rộng (R): các chi nhánh còn lại

Không phải một "phase" trong FRD nhưng là phần của kế hoạch end-to-end; chạy **song song giai đoạn 2** sau khi pilot đạt cổng.

| Đợt | Phạm vi | Điều kiện |
| --- | --- | --- |
| R1: chi nhánh 2 và 3 | Chỉ dùng tính năng Phase 1, mỗi chi nhánh độc lập; thêm chi nhánh bằng cấu hình (NFR-SCA-01), kiểm kê khởi tạo, nhập dữ liệu, đào tạo | Pilot ổn định 4 đến 6 tuần; dashboard hợp nhất tối thiểu (RPT-001 nhiều chi nhánh) **[đề xuất đưa vào cuối Phase 1 hoặc đầu Phase 2]** |
| R2: các chi nhánh còn lại đến 8 | Thêm chuyển kho liên chi nhánh (INV-010), hợp nhất đa chi nhánh, mua hàng cơ bản, quản lý vùng nếu có | Phần tương ứng của Phase 2 đã nghiệm thu |
| R3: 9 đến 20 | Đợt theo năng lực đào tạo; theo dõi chi phí đọc và độ trễ | Phase 3 hoặc có kết quả đo quy mô |

Mỗi đợt có checklist chuyển đổi (§9.1), thời gian chạy song song ngắn hơn pilot, và cổng "không có sai lệch tồn kho chưa giải thích".

### Giai đoạn 2: Nhân công, mua hàng, kho đầy đủ, phê duyệt, hợp nhất

**Mục tiêu:** mở rộng sang nhân công, mua hàng, chuyển kho, kiểm kê, hợp nhất đa chi nhánh, thông báo đến khách.

**Phạm vi (FRD §13; chi tiết [đề xuất]):**

- HRM: HRM-001, 004, 005, 006, 007, 008, 010, 015 (Must) và các FR Should như HRM-003, 009, 011, 014, 016; HRM-012 theo chính sách lưu trữ.
- PUR: PUR-001 đến 008 (Should; FRD xếp giai đoạn 2).
- INV còn lại: INV-004, 010, 011, 012, 013, 014, 015, 016, 017, 018, 022, 023, 026, 028; INV-024 (Could).
- ACC: FR-ACC-015, 018, 019 (FRD xếp giai đoạn 2), **[đề xuất]** ACC-006, 007 (công nợ phải thu, phải trả cơ bản), 016 (hoàn tiền).
- CRM: CRM-003, 005, 006, 007, 008, 009, 012, 015, 016, 018; thông báo đến khách (Zalo, SMS, email) qua cổng khi đã chọn nhà cung cấp.
- REC: REC-011, 018, 019, 020, 024, 027, 029, 034, 035, 036 (bảo hành chéo khi khách chốt chính sách); đồng sơn REC-033 khi đã khảo sát xưởng.
- SYS: SYS-004, 008, 014, 015, 016, 017 (API ngoài).
- RPT: dashboard hợp nhất chủ và quản lý vùng, RPT-002 (so sánh chi nhánh; thiết kế đánh dấu P3, có thể kéo sớm vì rollup đã sẵn), RPT-005 đến 008, 010, 015, 016.
- NFR-OFF-01: nhập bù theo chính sách đã chốt ở BA-08.

**Slice theo thứ tự:** 2.1 Hợp nhất đa chi nhánh và dashboard CH, QV; 2.2 Chuyển kho liên chi nhánh, kho tổng; 2.3 Kiểm kê (đếm mù, quét camera, duyệt chênh lệch); 2.4 Mua hàng (yêu cầu, duyệt, đơn mua phiên bản, nhận nhiều lần, đối chiếu ba bên, trả NCC); 2.5 Phê duyệt đầy đủ (APR-01…03, chuyển cấp, ủy quyền); 2.6 Nhân công (giờ chuẩn, tính công theo phương pháp cấu hình, kỳ công, hoa hồng, năng suất); 2.7 Công nợ cơ bản và phân bổ thanh toán nhiều-nhiều, chi tiền có duyệt; 2.8 Thông báo khách, nhắc bảo dưỡng và đăng kiểm, lịch hẹn, bảo hành; 2.9 Đồng sơn và quy trình theo loại dịch vụ (nếu đã khảo sát).

**Phụ thuộc:** khách chốt công thức công thợ, hoa hồng (BA-15; ví dụ số do khách cung cấp); quy trình mua hàng; chính sách bảo hành chéo; nhà cung cấp Zalo và SMS; hạn mức phê duyệt ban hành; khảo sát đồng sơn.

**Tiêu chí thoát:** mọi FR Must giai đoạn 2 qua UAT (UAT-04, 05, 11, 14, 16, 19, 24 và các kịch bản thuộc phạm vi); kết quả tính công khớp ví dụ khách ký (UAT-11); đối soát kho đạt sau kiểm kê nhiều chi nhánh; kiểm tra tải với số chi nhánh thực tế.

**Rủi ro chính:** quy tắc tính công chưa thống nhất giữa chi nhánh (rủi ro BRD §8); mua hàng của khách chưa xác nhận quy trình; chi phí đọc tăng khi có nhiều chi nhánh; rollup nhiều cấp (R-07, R-09).

### Giai đoạn 3: Kế toán đầy đủ và hóa đơn đầy đủ

**Mục tiêu:** kế toán vận hành đầy đủ (giá vốn dịch vụ, lãi lỗ theo chi nhánh và nguồn doanh thu, khóa kỳ, kết xuất cho phần mềm kế toán của khách) và đầy đủ các trường hợp hóa đơn.

**Phạm vi:** ACC-005 (khóa kỳ), 008 (giá vốn dịch vụ), 010 (định khoản tự động theo sơ đồ cấu hình, Should), 011 (lãi lỗ), 012 (kết xuất), 013 (phân bổ chi phí chung, Could), 014 (mẫu chứng từ Thông tư 99), 020 (hạn mức công nợ doanh nghiệp), 016 nếu chưa làm; EIN-007 đầy đủ (13 trường hợp hóa đơn sai theo Thông tư 91/2026, kế toán xác nhận từng trường hợp), EIN-008 (gửi hóa đơn cho khách), EIN-012 (thời điểm lập và tiền đặt cọc theo cấu hình); RPT-009, 013 đầy đủ; kết xuất định dạng phần mềm kế toán đang dùng (khách chốt).

**Slice:** 3.1 Giá vốn dịch vụ và lãi lỗ; 3.2 Khóa kỳ, mở lại có hạn; 3.3 Kết xuất kế toán (định dạng khách chốt, kiểm trùng); 3.4 Hóa đơn đầy đủ: điều chỉnh, thay thế, hủy theo từng trường hợp, gửi cho khách; 3.5 Công nợ doanh nghiệp (hạn mức, kỳ thanh toán); 3.6 Chuẩn mẫu chứng từ.

**Phụ thuộc:** phần mềm kế toán và định dạng kết xuất; kế toán trưởng xác nhận quy tắc hóa đơn; cách phân bổ chi phí chung; luật về thời hạn lưu.

**Tiêu chí thoát:** UAT-07, 08, 09, 25, 26 và các kịch bản thuộc phạm vi đạt; tệp kết xuất nhập được vào phần mềm đích với số liệu khớp mẫu thử (FR-ACC-012); báo cáo lợi nhuận hiển thị công thức và phạm vi (FR-RPT-013).

**Rủi ro chính:** quy tắc pháp lý thay đổi (R-14); nhà cung cấp hóa đơn đổi API; phạm vi kế toán phình thành "kế toán đầy đủ" ngoài phương án A (BRD §10).

### Giai đoạn 4: Đối soát, báo cáo nâng cao, mở rộng quy mô

**Mục tiêu:** đối soát chuyển khoản, báo cáo phân tích nâng cao, API ngoài, chắc chắn ở quy mô 20 chi nhánh và 500 đến 800 xe mỗi ngày.

**Phạm vi:** ACC-017 (giao dịch ngân hàng và đối soát; QR, ngân hàng: định dạng khách chốt), xuất sang BigQuery và báo cáo nâng cao (FR-RPT-016 đầy đủ, báo cáo tùy biến có kiểm soát), API ngoài (FR-SYS-017) nếu chưa làm, kiểm tra tải và tối ưu chi phí, xem xét tách module hoặc bộ tìm kiếm riêng, đánh giá lại CSDL ở quy mô thực; hồ sơ giám định bảo hiểm chỉ nếu khách có nhu cầu (BRD §4).

**Tiêu chí thoát:** dashboard hợp nhất dưới 5 giây với dữ liệu một năm ở quy mô thực (NFR-PERF-02); chi phí đọc nằm trong ngân sách; đối soát chuyển khoản khớp mẫu thử; kế hoạch tiếp theo dựa trên số liệu vận hành.

**Rủi ro chính:** định dạng sao kê ngân hàng đa dạng; báo cáo tùy biến vượt khả năng của rollup (R-09); chi phí tăng theo quy mô.

### Củng cố xuyên suốt (không phải giai đoạn riêng)

Mỗi giai đoạn kết thúc bằng cổng củng cố: diễn tập khôi phục; kiểm tra tải với dữ liệu mô phỏng quy mô giai đoạn; quét bảo mật và cập nhật phụ thuộc; kiểm thử truy cập; xem lại chi phí; cập nhật runbook; rà soát nhật ký lỗi và hiệu năng ở môi trường thật. Kiểm thử thâm nhập độc lập: trước pilot và trước mỗi đợt thay đổi lớn về xác thực hoặc tiền.

## 8. Danh sách kiểm tra bảo mật

| # | Mục | Cách kiểm |
| --- | --- | --- |
| 1 | Không có Firebase SDK hoặc khóa trong bundle; Security Rules từ chối mọi truy cập client | Quét bundle ở CI; test Rules với emulator |
| 2 | Xác thực: mật khẩu từ 10 ký tự, lịch sử 5, khóa 5 lần sai trong 15 phút, MFA cho vai trò bắt buộc, PIN giới hạn thử theo thiết bị, hết phiên tuyệt đối 12 giờ và do rảnh | Test tích hợp; pentest |
| 3 | Cookie phiên `__Host-`, `HttpOnly`, `Secure`, `SameSite`; kiểm `Origin`; chống CSRF | Test e2e và pentest |
| 4 | Cách ly chi nhánh ở danh sách, tìm kiếm, báo cáo, xuất, tệp, liên kết khách, API; 404 cho ngoài phạm vi | Ma trận test sinh tự động |
| 5 | RBAC theo hành động; tách nhiệm vụ lập và duyệt theo người; không leo thang qua nhiều vai trò | Test quyền |
| 6 | Che dữ liệu cá nhân theo vai trò; "Hiện" có nhật ký; xuất cần quyền riêng và lý do | Test; kiểm nhật ký |
| 7 | Kiểm dữ liệu vào ở biên (zod), mã hóa đầu ra, không `dangerouslySetInnerHTML` từ dữ liệu người dùng, CSP chặt, không script nội tuyến | Lint, ZAP, pentest |
| 8 | Chống SQL/NoSQL injection: không ghép chuỗi vào truy vấn; bộ lọc danh sách trắng | Review, test |
| 9 | Bí mật ở Secret Manager; không bí mật trong mã, log, bundle; `gitleaks` | CI |
| 10 | TOTP: bí mật mã hóa bằng KMS; mã khôi phục băm; so sánh hằng thời gian | Review bảo mật độc lập |
| 11 | Token liên kết khách ≥ 128 bit, lưu băm, hạn, thu hồi, giới hạn tốc độ | Test |
| 12 | Tải tệp: kiểm loại và kích thước, xóa dữ liệu vị trí khỏi ảnh, không thực thi, kiểm quyền khi tải xuống | Test |
| 13 | Giới hạn tốc độ cho đăng nhập, tìm kiếm, liên kết khách, API ngoài | Test |
| 14 | Nhật ký: ghi cùng giao dịch, không sửa xóa, xuất sang bucket khóa lưu giữ; không ghi bí mật hoặc dữ liệu cá nhân đầy đủ | Test; kiểm bản xuất |
| 15 | Phụ thuộc: `pnpm audit`, Renovate, CodeQL; cập nhật định kỳ | CI |
| 16 | IAM tối thiểu; tài khoản dịch vụ riêng theo thành phần; quyền xóa nhật ký không cấp cho người | Rà soát IAM |
| 17 | TLS bắt buộc; dữ liệu nhạy cảm mã hóa khi lưu (mặc định của Google) và trường nhạy cảm đặc biệt mã hóa ứng dụng nếu luật sư yêu cầu | NFR-SEC-01 |
| 18 | PDPL: ghi nhận căn cứ xử lý và đồng ý, quy trình yêu cầu chủ dữ liệu, ẩn danh, nhật ký truy cập, vùng dữ liệu | Kiểm theo luật sư |
| 19 | Thao tác nhạy cảm yêu cầu xác nhận lại mật khẩu (mở lại kỳ, hủy hóa đơn, đổi vai trò, xuất danh sách khách) | Test |
| 20 | Kiểm thử thâm nhập độc lập trước pilot; khắc phục mọi lỗi nghiêm trọng (NFR-SEC-02) | Báo cáo |

## 9. Dữ liệu: di chuyển từ Excel và ví dụ kế toán ký

### 9.1 Kế hoạch di chuyển từ Excel

Theo FRD §12 và FR-SYS-007; công cụ lặp lại được, idempotent, chạy thử trước, có báo cáo kiểm tra, **không phải tập lệnh một lần chạy trên dữ liệu thật**.

| Bước | Nội dung | Người |
| --- | --- | --- |
| 1 | Thu mẫu Excel thật (ẩn danh khi chưa cần) của từng chi nhánh: danh mục phụ tùng, khách, xe, phiếu sửa chữa mẫu, tồn kho, công nợ, bảng lương mẫu để thiết kế công thức | Khách, `ba` |
| 2 | Chốt mẫu nhập chuẩn và bảng ánh xạ cột cho từng loại dữ liệu; lưu hồ sơ ánh xạ | `ba`, dev |
| 3 | Làm sạch cùng người phụ trách chi nhánh: gộp mã phụ tùng trùng (có danh sách mã gộp), chuẩn hóa tên và đơn vị, chuẩn hóa điện thoại và biển số, gộp khách trùng | Khách, dev |
| 4 | Nhập thử ở `staging` bằng công cụ: tải tệp → ánh xạ → kiểm tra toàn bộ (lỗi theo dòng, tải tệp lỗi) → xem trước (mới, cập nhật, cảnh báo) → ghi theo lô có `batchId` → báo cáo đối chiếu (số mã trước và sau, số khách và xe, mẫu ngẫu nhiên) | Dev |
| 5 | Diễn tập ít nhất hai lần với dữ liệu gần thật; sửa quy tắc làm sạch | Dev, khách |
| 6 | Chạy song song với Excel ở chi nhánh pilot, đối chiếu hằng ngày | Khách |
| 7 | **Kiểm kê khởi tạo ngay trước ngày chuyển**, nhập tồn đầu kỳ qua chứng từ điều chỉnh mở đầu (không lấy số Excel làm số cuối); công nợ phải thu và phải trả đầu kỳ theo chứng từ còn nợ | Thủ kho, kế toán |
| 8 | Chốt ngày chuyển; Excel cũ chuyển chỉ đọc và lưu trữ | Chủ dự án |

**Thiết kế công cụ:** tệp xử lý bằng thư viện đọc Excel an toàn (không dùng bản có lỗ hổng đã biết) theo luồng; dữ liệu vào vùng tạm `importBatches`; mọi kiểm tra chạy trước khi ghi; ghi theo mảnh bằng `BulkWriter` kèm `batchId`; lô hoàn tất chỉ khi mảnh cuối thành công, lỗi giữa chừng thì bù trừ bằng `batchId`; hoàn tác theo lô bị chặn nếu đã phát sinh giao dịch tham chiếu (đã thiết kế ở SYS-21); đối soát giá trị tồn từng chi nhánh với biên bản kiểm kê; lịch sử sửa chữa chỉ nhập phần cần cho nhắc bảo dưỡng và tra cứu (số năm do khách chốt, BA-20); dữ liệu nhân sự chỉ nhập tối thiểu. Chứng từ lớn tách thành nhiều ADJ theo nhóm hàng để vừa giới hạn giao dịch.

### 9.2 Bộ ví dụ cần kế toán ký (đầu vào cho test, NFR-MNT-01)

| # | Công thức hoặc quy tắc | Ví dụ cần có |
| --- | --- | --- |
| 1 | Thuế GTGT theo dòng và theo hóa đơn, làm tròn | Báo giá nhiều dòng với thuế 8% và 10%; kết quả theo dòng và theo tổng |
| 2 | Mốc ngày áp thuế qua 1/1/2027 | Lệnh mở 28/12/2026 hoàn tất 2/1/2027; báo giá gửi trước mốc và duyệt sau mốc; cọc trước mốc |
| 3 | Giá gồm hay chưa gồm thuế (hiển thị cho khách) | Cùng một lệnh hiển thị cho khách cá nhân và doanh nghiệp |
| 4 | Giá bán, giá niêm yết, giảm giá trong hạn mức và vượt hạn mức | Thay dầu niêm yết 250.000 giảm tối đa 5% và 10% theo chương trình |
| 5 | Công = giờ chuẩn × đơn giá giờ | Hạng mục 0,3 giờ; đơn giá giờ theo chi nhánh |
| 6 | Giá vốn bình quân gia quyền | Nhập 10 × 100.000 và 20 × 120.000 ra khoảng 113.333; làm tròn; xuất, trả, điều chỉnh, chuyển kho, hàng lỗi, kiểm kê |
| 7 | Giữ chỗ và khả dụng | Thực tế 20, giữ 5, khả dụng 15; duyệt một phần; phát sinh; hủy |
| 8 | Báo giá duyệt một phần | 4.550.000 duyệt 2.050.000 (UAT-17) |
| 9 | Tuổi nợ | Các nhóm tuổi và tổng khớp số dư |
| 10 | Công thợ và hoa hồng (Phase 2) | Ví dụ khách cung cấp cho từng phương pháp và đổi thợ, làm lại, hủy |
| 11 | Chênh lệch quỹ và chốt ngày | Điều kiện chặn và cảnh báo |
| 12 | Lợi nhuận gộp quản trị | Công thức Phase 1 và Phase 2 (BA-16) |

## 10. Ước tính công sức và giả định

**Đây là ước tính thô, chưa có dữ liệu năng suất của đội; độ bất định khoảng ±40%; phải ước tính lại ở cuối Phase 0 sau spike và FRD v0.4.** Không phải cam kết.

**Giả định:** đội 4 dev full-stack (một người dẫn dắt) + 1 QA tự động + 0,5 DevOps dùng chung + `ba` và `designer` hỗ trợ khoảng một người; tuần làm việc 5 ngày; đã có prototype và tài liệu như hiện nay; chủ dự án và khách trả lời quyết định trong vòng một đến hai tuần; không tính thời gian chờ nhà cung cấp hóa đơn và luật sư; chưa tính nhân sự đào tạo, vận hành hỗ trợ người dùng.

| Slice giai đoạn 1 | Người-tuần (khoảng) | Ghi chú |
| --- | --- | --- |
| 1.1 Nền tảng | 14 đến 18 | Xác thực tự cài, phiên, RBAC, nhật ký, cấu hình hiệu lực, shell |
| 1.2 Dữ liệu chủ | 8 đến 10 | Màn hình cấu hình theo cùng một khuôn |
| 1.3 CRM lõi | 8 đến 10 | PII, tìm kiếm, đồng ý |
| 1.4 Sổ kho | 16 đến 22 | Phần rủi ro nhất: giữ chỗ, giá vốn, đồng thời |
| 1.5 Báo giá và duyệt | 14 đến 18 | Phiên bản, trang khách, in |
| 1.6 Thực hiện lệnh | 16 đến 22 | Máy trạng thái, tablet, QC, giao xe |
| 1.7 Tiền tối thiểu | 10 đến 14 | Chỉ nếu ACC vào Phase 1 |
| 1.8 Hóa đơn cơ bản | 12 đến 16 | Tùy nhà cung cấp |
| 1.9 Báo cáo một chi nhánh | 8 đến 10 | Rollup, đối chiếu |
| 1.10 INS | 6 đến 9 | Chỉ nếu được xác nhận |
| 1.11 Nhập dữ liệu | 8 đến 10 | Công cụ và diễn tập |
| 1.12 Củng cố và vào pilot | 12 đến 16 | Gồm UAT, pentest, đào tạo |
| **Tổng giai đoạn 1** | **120 đến 160** (không gồm INS) | |

Nếu spike không đạt và chuyển sang PostgreSQL, cộng thêm 6 đến 10 người-tuần ở Phase 0 và 1 (lớp dữ liệu và rollup khác); phần giao diện, domain, API không đổi nhiều.

**Quy mô tổng:** khoảng 290 đến 400 người-tuần, tương ứng khoảng 14 đến 20 tháng lịch ở giả định trên (có chồng lấn đợt mở rộng và giai đoạn 2). Chỉ tính kỹ thuật phần mềm; chưa tính chi phí hạ tầng (ADR §7.15), nhà cung cấp hóa đơn, SMS và Zalo.

## 11. Sổ đăng ký rủi ro

Rủi ro kỹ thuật chi tiết ở ADR §8 (R-01 đến R-15). Rủi ro dự án:

| ID | Rủi ro | L | I | Giảm thiểu | Giai đoạn |
| --- | --- | --- | --- | --- | --- |
| P-01 | Quyết định nghiệp vụ trả lời chậm (BA-03, 04, 06, 09…) làm kéo dài hoặc buộc làm lại | C | C | Hàng đợi quyết định có hạn chót; kế hoạch slice dừng khi thiếu quy tắc; cấu hình thay vì cứng | 0, 1 |
| P-02 | Phạm vi phình (ERP "đủ mọi thứ") | V | C | Khóa phạm vi giai đoạn bằng tiêu chí nghiệm thu; Should chưa xếp thì không làm | Tất cả |
| P-03 | Dữ liệu Excel sai hoặc thiếu giá vốn | C | C | Công cụ nhập chạy thử, kiểm kê khởi tạo, đối soát | 1, R |
| P-04 | Thợ, thủ kho không dùng hoặc dùng ngoài hệ thống | V | C | Tablet 2 chạm; đào tạo tại chỗ; quy định "không lệnh thì không xuất kho"; đo tỷ lệ | 1, R |
| P-05 | Mốc thuế 1/1/2027 trong khi pilot | C | V | BA-03; cấu hình hiệu lực; test ví dụ ký | 1 |
| P-06 | Nhà cung cấp hóa đơn chọn muộn | V | V | `FakeProvider`, cổng; chọn nhà cung cấp trước Slice 1.8 | 1 |
| P-07 | Thiết bị thật (tablet, máy in, camera) khác giả định | V | V | Thử trên thiết bị thật sớm; in theo khổ không theo hãng | 1 |
| P-08 | Prototype lệch bản dựng; vòng sửa lặp | V | V | Danh mục component hợp nhất; so sánh trực quan theo slice; báo lệch cho `designer` | 1 |
| P-09 | Đội mới với Firestore và thiết kế sổ | V | V | Spike làm mẫu, review kiến trúc theo module, tài liệu hướng dẫn | 0, 1 |
| P-10 | Pháp lý dữ liệu cá nhân và vùng dữ liệu | V | C | Luật sư sớm (BA-10, 11); thiết kế PII tách riêng và nhật ký bằng id | 0, 1 |
| P-11 | Chi phí vận hành cao hơn ngân sách | V | V | Ngân sách đọc theo màn hình; theo dõi chi phí hằng tuần | 1, 2 |
| P-12 | Một chi nhánh pilot không đại diện | V | V | Chọn chi nhánh có đủ dịch vụ chính; kiểm lại ở đợt R1 | 1, R |
| P-13 | Ước tính sai lệch lớn | C | V | Ước tính lại sau Phase 0 và sau slice 1.4; báo cáo tốc độ hằng tuần | 0, 1 |

## 12. Quyết định đang mở và giai đoạn bị chặn

Giữ nguyên `[Cần xác nhận]`; ở đây chỉ nêu cách xử lý kỹ thuật tạm thời (cấu hình hoặc giao diện) và chỗ bị chặn.

| Quyết định mở (CLAUDE.md) | Xử lý kỹ thuật | Chặn từ | Người chốt |
| --- | --- | --- | --- |
| Một hay nhiều pháp nhân | Mô hình sẵn sàng nhiều pháp nhân; cấu hình một pháp nhân | Slice 1.2 (cấu hình), EIN 1.8 | Chủ dự án, kế toán |
| Nhà cung cấp hóa đơn điện tử | `EInvoiceProvider` + `FakeProvider` | 1.8 (bộ chuyển thật), go-live pilot | Khách |
| Nhà cung cấp Zalo và SMS | Cổng `MessagePort`; kênh chưa kích hoạt hiển thị "Chưa kích hoạt" | Phase 2 (gửi thật); Phase 1 chỉ trong hệ thống và liên kết | Khách |
| Phương pháp giá vốn | Chiến lược `CostMethod` cấu hình; mặc định bình quân gia quyền chờ kế toán | 1.4 | Kế toán |
| Quy tắc công thợ và hoa hồng | Engine cấu hình theo phương pháp; chưa có quy tắc cứng | Phase 2 (2.6); Phase 1 chỉ lưu sự kiện giờ | Khách |
| Quy trình đồng sơn | Quy trình theo loại dịch vụ cấu hình; luồng đồng sơn là cấu hình | Phase 2 (2.9) | Khách (khảo sát xưởng) |
| Bảo hành chéo chi nhánh | Trường "chi nhánh chịu chi phí" cấu hình | Phase 2 | Khách |
| Hạn mức phê duyệt | Cấu hình ma trận phê duyệt (APR-03); số liệu trong prototype là minh họa | 1.2, 1.7 | Chủ dự án |
| Thời hạn lưu | Chính sách lưu cấu hình; không xóa cứng | Phase 1 (thiết kế nhật ký), 2 (HRM-012) | Luật sư, kế toán |
| Thiết bị và máy in | In theo khổ; thử trên máy thật | 1.12 | Khách |
| Số năm lịch sử cần chuyển | Công cụ nhập hỗ trợ giới hạn theo ngày | 1.11 | Khách |
| Mốc thuế qua 1/1/2027 | Cấu hình hiệu lực + quy tắc "ngày áp" | 1.2, 1.5, 1.8 | Kế toán |
| Vùng dữ liệu | Vùng chọn khi tạo database prod; đường lui | Tạo database prod | Luật sư, chủ dự án |
| Tệp media: API hay URL ký | Phương án A mặc định | 1.5 (ảnh), 1.10 (video) | Chủ dự án |
| ACC và INS có vào Phase 1 | Slice 1.7 và 1.10 có điều kiện | Phạm vi Phase 1 | Chủ dự án |

## 13. Việc cần làm ngay (đề xuất)

1. **Chủ dự án xem ADR 0001** và trả lời các quyết định ở ADR §12 (đặc biệt: chấp thuận spike hai tuần có đường lui; cấp dự án GCP thuộc tổ chức khách; media qua API; vùng dữ liệu).
2. **Chủ dự án quyết định phạm vi Phase 1:** ACC tối thiểu (thu tiền, sổ quỹ, chốt ngày) có vào pilot không; INS có vào không (BA-02, BA-19).
3. **`ba`:** áp dụng `proposed-doc-changes.md` sau khi chủ dự án duyệt, phát hành FRD v0.4 (BA-01); lập bảng ranh giới cách ly (BA-05); bảng quy tắc giữ chỗ (BA-07), lược đồ phê duyệt (BA-14).
4. **`ba` gửi khách:** kế toán (mốc thuế 1/1/2027, làm tròn, giá vốn, đơn vị phát hành hóa đơn, số liền; §9.2), luật sư (vùng dữ liệu, giữ và ẩn danh, căn cứ xử lý), chủ dự án (chính sách mất mạng, MFA và PIN).
5. **`designer`:** danh mục component hợp nhất; mẫu in in-first; giới hạn media; quy ước làm mới; kiểu tìm kiếm; sửa G4-SYS-22.
6. **Khách:** gửi mẫu Excel ẩn danh và ba con số tải (BA-20); chọn nhà cung cấp hóa đơn và cấp môi trường thử; cho biết thiết bị tại chi nhánh pilot.
7. **`dev`:** sau khi ADR được chấp thuận, chạy spike S1 đến S8 (hai tuần) rồi báo cáo; chỉ sau đó scaffold khung dự án và ghi lệnh vào `CLAUDE.md`.
8. **`dev`:** ước tính lại kế hoạch ở cuối Phase 0 với dữ liệu thật của spike.
