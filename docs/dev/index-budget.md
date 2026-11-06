# Ngân sách chỉ mục composite Firestore (R68, việc 4a)

Trạng thái: **193 trên 200** (slice 2.6a, 07/11/2026: +1 chỉ mục `laborSheets.byBranch` (tenantId, branchId, recordedAt desc); danh sách nhân sự đọc theo `tenantId` và công theo lệnh đọc theo khóa nên không thêm gì khác; còn 2 chỗ trước ngưỡng fail 195, các slice 2.1 và 2.5 chạy song song cũng dùng ngân sách này nên cần gỡ chỉ mục tương ứng nếu muốn thêm) — trước slice 2.6a: 192 trên 200 (đợt hai MT-0 06/11/2026 không thêm hình truy vấn nào: hạn mức, điều khoản, đồng ý và xuất tenant đọc theo khóa hoặc theo một trường `tenantId`) (cảnh báo từ 190, FAIL trên 195 theo `src/platform/store/indexBudget.ts`). Còn 3 chỗ trước ngưỡng fail. **Đợt MT-0 (07/11/2026, ADR 0002): đo trước 193 và 194 hình truy vấn; sau khi `companyId` thành `tenantId` trong mọi hình truy vấn số chỉ mục không đổi (193, chỉ đổi tên trường); bỏ hình `users.byEmployeeCode` (đăng nhập bằng mã nhân viên không còn, vì mã chỉ duy nhất trong tenant) làm tụt còn 192; các hình mới của MT-0 (`tenants.list`, `platformAuditLogs.list`) chỉ sắp theo một trường nên không tốn chỉ mục tổng hợp.** Mọi hình truy vấn nghiệp vụ phải có `tenantId` (test `tests/unit/tenant-invariants.test.ts`, danh sách ngoại lệ có lý do). `docs/dev/status.md` ghi 192, lệch 1: số đúng là 193 (đếm bằng `pnpm check:indexes`). Đếm chuỗi `collectionGroup` trong `firestore.indexes.json` ra 197 vì có thêm 4 chính sách TTL trong `fieldOverrides` (idempotencyKeys, rateLimits, notifications, emailOutbox); TTL không tính vào hạn mức 200 composite.

Bảng dưới sinh bằng `pnpm exec tsx --tsconfig tsconfig.json scripts/check-indexes.ts --report` (chỉ in, không ghi tệp; `--budget` là bí danh cũ). Cùng lệnh in số ứng viên trùng tiền tố và số chỉ mục không truy vấn nào dùng. Mỗi chỉ mục được ánh xạ sang các hình truy vấn trong `src/infrastructure/repos/queries.ts` mà nó phục vụ; không chỉ mục nào mồ côi và không chỉ mục nào là tiền tố của chỉ mục khác (`--report`, xem cuối bảng).

## Chính sách

1. Giai đoạn 1 còn lại: không phân hệ nào thêm chỉ mục. Cần truy vấn mới thì: (a) dùng lại hình truy vấn có sẵn, (b) đọc theo khóa, (c) lọc trong bộ nhớ trên tập có giới hạn, hoặc (d) phi chuẩn hóa một trường khóa (cách RPT đã làm với `rollups/<branchId>_<yyyyMMdd>`).
2. Giai đoạn 2 (INS, PUR, HRM): muốn thêm chỉ mục phải gỡ một số tương ứng trong cùng PR, theo danh sách ứng viên bên dưới. Không xin nâng trần với chủ dự án (BA trả lời câu 40: không xin).
3. Chỉ mục đơn trường do Firestore tự lo; không khai báo.
4. Test hiệu năng và e2e không được thêm hình truy vấn ngoài `queries.ts`.

## Phân bổ theo phân hệ

SYS chiếm 71 (37%), trong đó `auditLogs` 32 (bộ lọc nhật ký). REC 45, INV 39, CRM 32, ACC 5, EIN 1.

## Ứng viên gộp/bỏ (chỉ đề xuất, chưa làm; gỡ chỉ mục đòi đổi truy vấn)

- Cặp "toàn công ty" và "@scope": 66 chỉ mục `@scope` đứng cạnh bản không có `branchId` (chủ, đọc mọi chi nhánh). Phase 2 có thể bắt người dùng toàn công ty luôn đi qua truy vấn `@scope` với danh sách chi nhánh đầy đủ (`in` chia nhóm), bỏ nhiều bản không-scope: ước tính tiết kiệm hàng chục chỉ mục, đổi lại truy vấn chủ chậm hơn khi có nhiều chi nhánh (20 chi nhánh = 2 nhóm `in` 10). Cần đo trước.
- `auditLogs` (32): các bộ lọc theo mục tiêu/hành động/người dùng có thể thu về 3 đến 4 hình nếu bộ lọc phụ làm trong bộ nhớ trên trang đã đọc. Ứng viên lớn nhất.
- Biến thể `asc`/`desc` của cùng một danh sách (khách, xe, phụ tùng): giữ một hướng, hướng ngược lại đọc cuối tập (Firestore không đọc ngược miễn phí với phân trang con trỏ hiện tại); đổi cách phân trang mới được.
- `parts.list.*[group,status]` (8 chỉ mục `parts`): lọc `status` trong bộ nhớ vì danh mục phụ tùng nhỏ và có trần.
- `--report` phát hiện chỉ mục mồ côi và tiền tố (chỉ báo cáo, không làm hỏng build): hiện 0 mồ côi, 0 tiền tố.

## Kết quả rà soát (05/11/2026, task A7)

- Thực đo (07/11/2026, sau MT-0): 192 composite, 195 hình truy vấn đăng ký (một số là đơn trường, Firestore tự lo). Tất cả phạm vi `COLLECTION`.
- 0 chỉ mục mồ côi (mỗi chỉ mục được ít nhất một hình truy vấn trong `queries.ts` dùng), 0 cặp trùng tiền tố (`--report`).
- Vì vậy không gỡ chỉ mục nào: gỡ bất kỳ chỉ mục nào ở trên đều làm một hình truy vấn đã đăng ký mất chỉ mục, tức là phải đổi truy vấn (xem "Ứng viên gộp/bỏ"), không thuộc phạm vi task này (không đổi hành vi). Còn 2 chỗ trước ngưỡng fail 195.
- Cột "FR, slice" ánh xạ theo bộ sưu tập (mức họ FR và slice theo `implementation-plan.md` §7), chưa đối chiếu từng FR chi tiết.
- `--report` chỉ liệt kê ứng viên tiền tố, không khẳng định an toàn: Firestore chỉ phục vụ truy vấn ngắn bằng chỉ mục dài khi mọi tài liệu đều có các trường đuôi và cách chia bằng/sắp xếp khớp.

## Danh sách chỉ mục

| Module | Indexes |
| --- | ---: |
| SYS | 71 |
| REC | 45 |
| INV | 39 |
| CRM | 32 |
| ACC | 5 |
| EIN | 1 |

| Module | Collection | Fields | Scope | FR, slice | Queries |
| --- | --- | --- | --- | --- | --- |
| ACC | cashEntries | branchId, businessDate, companyId, seqKey | COLLECTION | FR-ACC-001..004, 1.7 | cashEntries.byDay |
| ACC | cashShifts | branchId, companyId, openedAt desc | COLLECTION | FR-ACC-001..004, 1.7 | cashShifts.byBranch |
| ACC | debts | branchId, companyId, status, dueDate | COLLECTION | FR-ACC, 1.7 | debts.byBranchStatus |
| ACC | payments | branchId, companyId, createdAt desc | COLLECTION | FR-ACC-001..004, 1.7 | payments.byBranch |
| ACC | payments | companyId, orderId, createdAt | COLLECTION | FR-ACC-001..004, 1.7 | payments.byOrder |
| CRM | consents | companyId, customerId, grantedAt desc | COLLECTION | FR-CRM, 1.3 | consents.byCustomer |
| CRM | customerLinks | branchId, companyId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc@scope |
| CRM | customerLinks | branchId, companyId, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc@scope |
| CRM | customerLinks | branchId, companyId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc[type]@scope |
| CRM | customerLinks | branchId, companyId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc[type]@scope |
| CRM | customerLinks | companyId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc |
| CRM | customerLinks | companyId, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc |
| CRM | customerLinks | companyId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc[type] |
| CRM | customerLinks | companyId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc[type] |
| CRM | customerPii | companyId, phoneNorm | COLLECTION | FR-CRM, 1.3 | customerPii.byPhone |
| CRM | customers | companyId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customers.list.name.desc |
| CRM | customers | companyId, nameNorm | COLLECTION | FR-CRM, 1.3 | customers.list.name.asc |
| CRM | customers | companyId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customers.list.name.desc[type] |
| CRM | customers | companyId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customers.list.name.asc[type] |
| CRM | dataSubjectRequests | branchId, companyId, customerId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId]@scope |
| CRM | dataSubjectRequests | branchId, companyId, customerId, status, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId,status]@scope |
| CRM | dataSubjectRequests | branchId, companyId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list@scope |
| CRM | dataSubjectRequests | branchId, companyId, status, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[status]@scope |
| CRM | dataSubjectRequests | companyId, customerId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId] |
| CRM | dataSubjectRequests | companyId, customerId, status, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId,status] |
| CRM | dataSubjectRequests | companyId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list |
| CRM | dataSubjectRequests | companyId, status, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[status] |
| CRM | vehicleHistory | companyId, vehicleId, date desc | COLLECTION | FR-CRM, 1.3 | vehicleHistory.byVehicle |
| CRM | vehicleLinks | branchId, companyId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.desc@scope |
| CRM | vehicleLinks | branchId, companyId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.asc@scope |
| CRM | vehicleLinks | companyId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.desc |
| CRM | vehicleLinks | companyId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.asc |
| CRM | vehicleOwnerships | companyId, customerId, from desc | COLLECTION | FR-CRM, 1.3 | vehicleOwnerships.byCustomer |
| CRM | vehicleOwnerships | companyId, vehicleId, from desc | COLLECTION | FR-CRM, 1.3 | vehicleOwnerships.byVehicle |
| CRM | vehicles | companyId, currentOwnerId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicles.byOwner |
| CRM | vehicles | companyId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicles.list.plate.desc |
| CRM | vehicles | companyId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicles.list.plate.asc |
| EIN | invoices | branchId, companyId, createdAt desc | COLLECTION | FR-EIN, 1.8 | invoices.byBranch |
| INV | partCompat | companyId, compatKey, code | COLLECTION | FR-INV, 1.4 | partCompat.byModel |
| INV | parts | companyId, code | COLLECTION | FR-INV, 1.4 | parts.list.code |
| INV | parts | companyId, group, code | COLLECTION | FR-INV, 1.4 | parts.list.code[group] |
| INV | parts | companyId, group, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[group] |
| INV | parts | companyId, group, status, code | COLLECTION | FR-INV, 1.4 | parts.list.code[group,status] |
| INV | parts | companyId, group, status, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[group,status] |
| INV | parts | companyId, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name |
| INV | parts | companyId, status, code | COLLECTION | FR-INV, 1.4 | parts.list.code[status] |
| INV | parts | companyId, status, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[status] |
| INV | stockBalances | branchId, companyId, lowStock, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock]@scope |
| INV | stockBalances | branchId, companyId, lowStock, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock,warehouseId]@scope |
| INV | stockBalances | branchId, companyId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code@scope |
| INV | stockBalances | branchId, companyId, partId, warehouseId | COLLECTION | FR-INV, 1.4 | stockBalances.byPart@scope |
| INV | stockBalances | branchId, companyId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[warehouseId]@scope |
| INV | stockBalances | companyId, lowStock, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock] |
| INV | stockBalances | companyId, lowStock, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock,warehouseId] |
| INV | stockBalances | companyId, nonZero, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.nonZero |
| INV | stockBalances | companyId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code |
| INV | stockBalances | companyId, partId, warehouseId | COLLECTION | FR-INV, 1.4 | stockBalances.byPart |
| INV | stockBalances | companyId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[warehouseId] |
| INV | stockDocuments | branchId, companyId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list@scope |
| INV | stockDocuments | branchId, companyId, status, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status]@scope |
| INV | stockDocuments | branchId, companyId, status, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status,type]@scope |
| INV | stockDocuments | branchId, companyId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[type]@scope |
| INV | stockDocuments | companyId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list |
| INV | stockDocuments | companyId, status, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status] |
| INV | stockDocuments | companyId, status, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status,type] |
| INV | stockDocuments | companyId, status, warehouseId, createdAt | COLLECTION | FR-INV, 1.4 | stockDocuments.openByWarehouse |
| INV | stockDocuments | companyId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[type] |
| INV | stockMovements | branchId, companyId, partId, warehouseId, seqKey desc | COLLECTION | FR-INV, 1.4 | stockMovements.byBalance@scope |
| INV | stockMovements | companyId, partId, warehouseId, seqKey desc | COLLECTION | FR-INV, 1.4 | stockMovements.byBalance |
| INV | stockReservations | branchId, companyId, partId, status, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart[status]@scope |
| INV | stockReservations | branchId, companyId, partId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart@scope |
| INV | stockReservations | branchId, companyId, sourceId, sourceType, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.bySource@scope |
| INV | stockReservations | branchId, companyId, status, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.open@scope |
| INV | stockReservations | companyId, partId, status, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart[status] |
| INV | stockReservations | companyId, partId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart |
| INV | stockReservations | companyId, sourceId, sourceType, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.bySource |
| INV | stockReservations | companyId, status, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.open |
| REC | intakes | branchId, companyId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list@scope |
| REC | intakes | branchId, companyId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber@scope |
| REC | intakes | branchId, companyId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate@scope |
| REC | intakes | branchId, companyId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list[status]@scope |
| REC | intakes | branchId, companyId, status, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber[status]@scope |
| REC | intakes | branchId, companyId, status, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate[status]@scope |
| REC | intakes | companyId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list |
| REC | intakes | companyId, customerId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.byCustomer |
| REC | intakes | companyId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber |
| REC | intakes | companyId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate |
| REC | intakes | companyId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list[status] |
| REC | intakes | companyId, status, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber[status] |
| REC | intakes | companyId, status, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate[status] |
| REC | partRequests | branchId, companyId, orderId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byOrder@scope |
| REC | partRequests | branchId, companyId, status, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byStatus@scope |
| REC | partRequests | companyId, orderId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byOrder |
| REC | partRequests | companyId, status, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byStatus |
| REC | quotes | branchId, companyId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list@scope |
| REC | quotes | branchId, companyId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber@scope |
| REC | quotes | branchId, companyId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate@scope |
| REC | quotes | branchId, companyId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list[status]@scope |
| REC | quotes | branchId, companyId, status, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber[status]@scope |
| REC | quotes | branchId, companyId, status, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate[status]@scope |
| REC | quotes | companyId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list |
| REC | quotes | companyId, customerId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.byCustomer |
| REC | quotes | companyId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber |
| REC | quotes | companyId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate |
| REC | quotes | companyId, status, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list[status] |
| REC | quotes | companyId, status, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber[status] |
| REC | quotes | companyId, status, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate[status] |
| REC | repairItems | active, branchId, companyId, technicianId, createdAt | COLLECTION | FR-REC, 1.6 | repairItems.byTechnician@scope |
| REC | repairItems | active, companyId, technicianId, createdAt | COLLECTION | FR-REC, 1.6 | repairItems.byTechnician |
| REC | repairItems | branchId, companyId, orderId, seqKey | COLLECTION | FR-REC, 1.6 | repairItems.byOrder@scope |
| REC | repairItems | companyId, orderId, seqKey | COLLECTION | FR-REC, 1.6 | repairItems.byOrder |
| REC | repairOrders | branchId, companyId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list@scope |
| REC | repairOrders | branchId, companyId, number | COLLECTION | FR-REC, 1.6 | repairOrders.byNumber@scope |
| REC | repairOrders | branchId, companyId, open, createdAt | COLLECTION | FR-REC, 1.6 | repairOrders.open@scope |
| REC | repairOrders | branchId, companyId, plateNorm | COLLECTION | FR-REC, 1.6 | repairOrders.byPlate@scope |
| REC | repairOrders | branchId, companyId, status, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list[status]@scope |
| REC | repairOrders | companyId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list |
| REC | repairOrders | companyId, customerId, open, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.byCustomer |
| REC | repairOrders | companyId, number | COLLECTION | FR-REC, 1.6 | repairOrders.byNumber |
| REC | repairOrders | companyId, open, createdAt | COLLECTION | FR-REC, 1.6 | repairOrders.open |
| REC | repairOrders | companyId, plateNorm | COLLECTION | FR-REC, 1.6 | repairOrders.byPlate |
| REC | repairOrders | companyId, status, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list[status] |
| SYS | approvals | branchId, companyId, status, createdAt desc | COLLECTION | FR-SYS-004, 1.1/1.7 | approvals.byBranchStatus |
| SYS | approvals | companyId, requestedBy, createdAt desc | COLLECTION | FR-SYS-004, 1.1/1.7 | approvals.byRequester |
| SYS | auditLogs | action, actorId, branchId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityId]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityId,entityType]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityType]@scope |
| SYS | auditLogs | action, actorId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId] |
| SYS | auditLogs | action, actorId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityId] |
| SYS | auditLogs | action, actorId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityId,entityType] |
| SYS | auditLogs | action, actorId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,actorId,entityType] |
| SYS | auditLogs | action, branchId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action]@scope |
| SYS | auditLogs | action, branchId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityId]@scope |
| SYS | auditLogs | action, branchId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityId,entityType]@scope |
| SYS | auditLogs | action, branchId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityType]@scope |
| SYS | auditLogs | action, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action] |
| SYS | auditLogs | action, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityId] |
| SYS | auditLogs | action, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityId,entityType] |
| SYS | auditLogs | action, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[action,entityType] |
| SYS | auditLogs | actorId, branchId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityId]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityId,entityType]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityType]@scope |
| SYS | auditLogs | actorId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId] |
| SYS | auditLogs | actorId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityId] |
| SYS | auditLogs | actorId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityId,entityType] |
| SYS | auditLogs | actorId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[actorId,entityType] |
| SYS | auditLogs | branchId, companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list@scope |
| SYS | auditLogs | branchId, companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId]@scope |
| SYS | auditLogs | branchId, companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId,entityType]@scope |
| SYS | auditLogs | branchId, companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityType]@scope |
| SYS | auditLogs | companyId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list |
| SYS | auditLogs | companyId, entityId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId] |
| SYS | auditLogs | companyId, entityId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId,entityType] |
| SYS | auditLogs | companyId, entityType, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityType] |
| SYS | authTokens | kind, userId, createdAt desc | COLLECTION | FR-SYS-001, 1.1 | authTokens.byUserKind |
| SYS | branches | companyId, code | COLLECTION | FR-SYS-005, 1.2 | branches.byCompany |
| SYS | configVersions | companyId, scopeKey, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byScope |
| SYS | configVersions | companyId, status, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byType[status] |
| SYS | configVersions | companyId, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byType |
| SYS | counters | branchId, companyId, updatedAt desc | COLLECTION | FR-SYS-001, 1.1 | counters.byBranch |
| SYS | importBatches | branchId, companyId, createdAt desc | COLLECTION | FR-SYS-007, 1.11 | importBatches.byBranch |
| SYS | importBatches | branchId, companyId, status, createdAt desc | COLLECTION | FR-SYS-007, 1.11 | importBatches.byBranchStatus |
| SYS | notifications | userId, createdAt desc | COLLECTION | FR-SYS, 1.1 | notifications.byUser |
| SYS | priceLists | companyId, code desc | COLLECTION | FR-SYS, 1.2 | priceLists.list.code.desc |
| SYS | priceLists | companyId, code | COLLECTION | FR-SYS, 1.2 | priceLists.list.code.asc |
| SYS | priceLists | companyId, nameNorm desc | COLLECTION | FR-SYS, 1.2 | priceLists.list.nameNorm.desc |
| SYS | priceLists | companyId, nameNorm | COLLECTION | FR-SYS, 1.2 | priceLists.list.nameNorm.asc |
| SYS | roleAssignments | branchId, companyId, employeeCode | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byBranch@scope |
| SYS | roleAssignments | companyId, employeeCode | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byBranch |
| SYS | roleAssignments | companyId, roleCode, createdAt | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byRole |
| SYS | roleAssignments | userId, createdAt | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byUser |
| SYS | services | companyId, code desc | COLLECTION | FR-SYS, 1.2 | services.list.code.desc |
| SYS | services | companyId, code | COLLECTION | FR-SYS, 1.2 | services.list.code.asc |
| SYS | services | companyId, group, code desc | COLLECTION | FR-SYS, 1.2 | services.list.code.desc[group] |
| SYS | services | companyId, group, code | COLLECTION | FR-SYS, 1.2 | services.list.code.asc[group] |
| SYS | services | companyId, group, nameNorm desc | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.desc[group] |
| SYS | services | companyId, group, nameNorm | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.asc[group] |
| SYS | services | companyId, nameNorm desc | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.desc |
| SYS | services | companyId, nameNorm | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.asc |
| SYS | sessions | userId, createdAt desc | COLLECTION | FR-SYS-001, 1.1 | sessions.byUser |
| SYS | users | companyId, employeeCode | COLLECTION | FR-SYS-001, 1.1 | users.byCompany |
| SYS | users | email, createdAt | COLLECTION | FR-SYS-001, 1.1 | users.byEmail |
| SYS | users | employeeCode, createdAt | COLLECTION | FR-SYS-001, 1.1 | users.byEmployeeCode |
| SYS | warehouses | branchId, companyId, code desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.desc@scope |
| SYS | warehouses | branchId, companyId, code | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.asc@scope |
| SYS | warehouses | branchId, companyId, nameNorm desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.desc@scope |
| SYS | warehouses | branchId, companyId, nameNorm | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.asc@scope |
| SYS | warehouses | companyId, code desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.desc |
| SYS | warehouses | companyId, code | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.asc |
| SYS | warehouses | companyId, nameNorm desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.desc |
| SYS | warehouses | companyId, nameNorm | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.asc |

0 prefix candidate(s)
0 index(es) used by no registered query
