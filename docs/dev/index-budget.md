# Ngân sách chỉ mục composite Firestore (R68, việc 4a)

Trạng thái: 193 trên 200 (cảnh báo từ 190, FAIL trên 195 theo `src/platform/store/indexBudget.ts`). Còn 2 chỗ trước ngưỡng fail. `docs/dev/status.md` ghi 192, lệch 1: số đúng là 193 (đếm bằng `pnpm check:indexes`).

Bảng dưới sinh bằng `pnpm exec tsx --tsconfig tsconfig.json scripts/check-indexes.ts --budget` (chỉ in, không ghi tệp). Mỗi chỉ mục được ánh xạ sang các hình truy vấn trong `src/infrastructure/repos/queries.ts` mà nó phục vụ; không chỉ mục nào mồ côi và không chỉ mục nào là tiền tố của chỉ mục khác (kiểm tự động, xem cuối bảng).

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
- Kiểm tự động hiện không phát hiện chỉ mục mồ côi hay tiền tố: 0 mồ côi, 0 tiền tố.

## Danh sách chỉ mục


| Module | Indexes |
| --- | ---: |
| SYS | 71 |
| REC | 45 |
| INV | 39 |
| CRM | 32 |
| ACC | 5 |
| EIN | 1 |

| Module | Collection | Fields | Queries |
| --- | --- | --- | --- |
| ACC | cashEntries | branchId, businessDate, companyId, seqKey | cashEntries.byDay |
| ACC | cashShifts | branchId, companyId, openedAt desc | cashShifts.byBranch |
| ACC | debts | branchId, companyId, status, dueDate | debts.byBranchStatus |
| ACC | payments | branchId, companyId, createdAt desc | payments.byBranch |
| ACC | payments | companyId, orderId, createdAt | payments.byOrder |
| CRM | consents | companyId, customerId, grantedAt desc | consents.byCustomer |
| CRM | customerLinks | branchId, companyId, nameNorm desc | customerLinks.list.name.desc@scope |
| CRM | customerLinks | branchId, companyId, nameNorm | customerLinks.list.name.asc@scope |
| CRM | customerLinks | branchId, companyId, type, nameNorm desc | customerLinks.list.name.desc[type]@scope |
| CRM | customerLinks | branchId, companyId, type, nameNorm | customerLinks.list.name.asc[type]@scope |
| CRM | customerLinks | companyId, nameNorm desc | customerLinks.list.name.desc |
| CRM | customerLinks | companyId, nameNorm | customerLinks.list.name.asc |
| CRM | customerLinks | companyId, type, nameNorm desc | customerLinks.list.name.desc[type] |
| CRM | customerLinks | companyId, type, nameNorm | customerLinks.list.name.asc[type] |
| CRM | customerPii | companyId, phoneNorm | customerPii.byPhone |
| CRM | customers | companyId, nameNorm desc | customers.list.name.desc |
| CRM | customers | companyId, nameNorm | customers.list.name.asc |
| CRM | customers | companyId, type, nameNorm desc | customers.list.name.desc[type] |
| CRM | customers | companyId, type, nameNorm | customers.list.name.asc[type] |
| CRM | dataSubjectRequests | branchId, companyId, customerId, receivedAt desc | dataSubjectRequests.list[customerId]@scope |
| CRM | dataSubjectRequests | branchId, companyId, customerId, status, receivedAt desc | dataSubjectRequests.list[customerId,status]@scope |
| CRM | dataSubjectRequests | branchId, companyId, receivedAt desc | dataSubjectRequests.list@scope |
| CRM | dataSubjectRequests | branchId, companyId, status, receivedAt desc | dataSubjectRequests.list[status]@scope |
| CRM | dataSubjectRequests | companyId, customerId, receivedAt desc | dataSubjectRequests.list[customerId] |
| CRM | dataSubjectRequests | companyId, customerId, status, receivedAt desc | dataSubjectRequests.list[customerId,status] |
| CRM | dataSubjectRequests | companyId, receivedAt desc | dataSubjectRequests.list |
| CRM | dataSubjectRequests | companyId, status, receivedAt desc | dataSubjectRequests.list[status] |
| CRM | vehicleHistory | companyId, vehicleId, date desc | vehicleHistory.byVehicle |
| CRM | vehicleLinks | branchId, companyId, plateNorm desc | vehicleLinks.list.plate.desc@scope |
| CRM | vehicleLinks | branchId, companyId, plateNorm | vehicleLinks.list.plate.asc@scope |
| CRM | vehicleLinks | companyId, plateNorm desc | vehicleLinks.list.plate.desc |
| CRM | vehicleLinks | companyId, plateNorm | vehicleLinks.list.plate.asc |
| CRM | vehicleOwnerships | companyId, customerId, from desc | vehicleOwnerships.byCustomer |
| CRM | vehicleOwnerships | companyId, vehicleId, from desc | vehicleOwnerships.byVehicle |
| CRM | vehicles | companyId, currentOwnerId, plateNorm | vehicles.byOwner |
| CRM | vehicles | companyId, plateNorm desc | vehicles.list.plate.desc |
| CRM | vehicles | companyId, plateNorm | vehicles.list.plate.asc |
| EIN | invoices | branchId, companyId, createdAt desc | invoices.byBranch |
| INV | partCompat | companyId, compatKey, code | partCompat.byModel |
| INV | parts | companyId, code | parts.list.code |
| INV | parts | companyId, group, code | parts.list.code[group] |
| INV | parts | companyId, group, nameNorm | parts.list.name[group] |
| INV | parts | companyId, group, status, code | parts.list.code[group,status] |
| INV | parts | companyId, group, status, nameNorm | parts.list.name[group,status] |
| INV | parts | companyId, nameNorm | parts.list.name |
| INV | parts | companyId, status, code | parts.list.code[status] |
| INV | parts | companyId, status, nameNorm | parts.list.name[status] |
| INV | stockBalances | branchId, companyId, lowStock, partCodeNorm | stockBalances.list.code[lowStock]@scope |
| INV | stockBalances | branchId, companyId, lowStock, warehouseId, partCodeNorm | stockBalances.list.code[lowStock,warehouseId]@scope |
| INV | stockBalances | branchId, companyId, partCodeNorm | stockBalances.list.code@scope |
| INV | stockBalances | branchId, companyId, partId, warehouseId | stockBalances.byPart@scope |
| INV | stockBalances | branchId, companyId, warehouseId, partCodeNorm | stockBalances.list.code[warehouseId]@scope |
| INV | stockBalances | companyId, lowStock, partCodeNorm | stockBalances.list.code[lowStock] |
| INV | stockBalances | companyId, lowStock, warehouseId, partCodeNorm | stockBalances.list.code[lowStock,warehouseId] |
| INV | stockBalances | companyId, nonZero, warehouseId, partCodeNorm | stockBalances.nonZero |
| INV | stockBalances | companyId, partCodeNorm | stockBalances.list.code |
| INV | stockBalances | companyId, partId, warehouseId | stockBalances.byPart |
| INV | stockBalances | companyId, warehouseId, partCodeNorm | stockBalances.list.code[warehouseId] |
| INV | stockDocuments | branchId, companyId, createdAt desc | stockDocuments.list@scope |
| INV | stockDocuments | branchId, companyId, status, createdAt desc | stockDocuments.list[status]@scope |
| INV | stockDocuments | branchId, companyId, status, type, createdAt desc | stockDocuments.list[status,type]@scope |
| INV | stockDocuments | branchId, companyId, type, createdAt desc | stockDocuments.list[type]@scope |
| INV | stockDocuments | companyId, createdAt desc | stockDocuments.list |
| INV | stockDocuments | companyId, status, createdAt desc | stockDocuments.list[status] |
| INV | stockDocuments | companyId, status, type, createdAt desc | stockDocuments.list[status,type] |
| INV | stockDocuments | companyId, status, warehouseId, createdAt | stockDocuments.openByWarehouse |
| INV | stockDocuments | companyId, type, createdAt desc | stockDocuments.list[type] |
| INV | stockMovements | branchId, companyId, partId, warehouseId, seqKey desc | stockMovements.byBalance@scope |
| INV | stockMovements | companyId, partId, warehouseId, seqKey desc | stockMovements.byBalance |
| INV | stockReservations | branchId, companyId, partId, status, updatedAt desc | stockReservations.byPart[status]@scope |
| INV | stockReservations | branchId, companyId, partId, updatedAt desc | stockReservations.byPart@scope |
| INV | stockReservations | branchId, companyId, sourceId, sourceType, createdAt | stockReservations.bySource@scope |
| INV | stockReservations | branchId, companyId, status, createdAt | stockReservations.open@scope |
| INV | stockReservations | companyId, partId, status, updatedAt desc | stockReservations.byPart[status] |
| INV | stockReservations | companyId, partId, updatedAt desc | stockReservations.byPart |
| INV | stockReservations | companyId, sourceId, sourceType, createdAt | stockReservations.bySource |
| INV | stockReservations | companyId, status, createdAt | stockReservations.open |
| REC | intakes | branchId, companyId, createdAt desc | intakes.list@scope |
| REC | intakes | branchId, companyId, number | intakes.byNumber@scope |
| REC | intakes | branchId, companyId, plateNorm | intakes.byPlate@scope |
| REC | intakes | branchId, companyId, status, createdAt desc | intakes.list[status]@scope |
| REC | intakes | branchId, companyId, status, number | intakes.byNumber[status]@scope |
| REC | intakes | branchId, companyId, status, plateNorm | intakes.byPlate[status]@scope |
| REC | intakes | companyId, createdAt desc | intakes.list |
| REC | intakes | companyId, customerId, status, createdAt desc | intakes.byCustomer |
| REC | intakes | companyId, number | intakes.byNumber |
| REC | intakes | companyId, plateNorm | intakes.byPlate |
| REC | intakes | companyId, status, createdAt desc | intakes.list[status] |
| REC | intakes | companyId, status, number | intakes.byNumber[status] |
| REC | intakes | companyId, status, plateNorm | intakes.byPlate[status] |
| REC | partRequests | branchId, companyId, orderId, createdAt | partRequests.byOrder@scope |
| REC | partRequests | branchId, companyId, status, createdAt | partRequests.byStatus@scope |
| REC | partRequests | companyId, orderId, createdAt | partRequests.byOrder |
| REC | partRequests | companyId, status, createdAt | partRequests.byStatus |
| REC | quotes | branchId, companyId, createdAt desc | quotes.list@scope |
| REC | quotes | branchId, companyId, number | quotes.byNumber@scope |
| REC | quotes | branchId, companyId, plateNorm | quotes.byPlate@scope |
| REC | quotes | branchId, companyId, status, createdAt desc | quotes.list[status]@scope |
| REC | quotes | branchId, companyId, status, number | quotes.byNumber[status]@scope |
| REC | quotes | branchId, companyId, status, plateNorm | quotes.byPlate[status]@scope |
| REC | quotes | companyId, createdAt desc | quotes.list |
| REC | quotes | companyId, customerId, status, createdAt desc | quotes.byCustomer |
| REC | quotes | companyId, number | quotes.byNumber |
| REC | quotes | companyId, plateNorm | quotes.byPlate |
| REC | quotes | companyId, status, createdAt desc | quotes.list[status] |
| REC | quotes | companyId, status, number | quotes.byNumber[status] |
| REC | quotes | companyId, status, plateNorm | quotes.byPlate[status] |
| REC | repairItems | active, branchId, companyId, technicianId, createdAt | repairItems.byTechnician@scope |
| REC | repairItems | active, companyId, technicianId, createdAt | repairItems.byTechnician |
| REC | repairItems | branchId, companyId, orderId, seqKey | repairItems.byOrder@scope |
| REC | repairItems | companyId, orderId, seqKey | repairItems.byOrder |
| REC | repairOrders | branchId, companyId, createdAt desc | repairOrders.list@scope |
| REC | repairOrders | branchId, companyId, number | repairOrders.byNumber@scope |
| REC | repairOrders | branchId, companyId, open, createdAt | repairOrders.open@scope |
| REC | repairOrders | branchId, companyId, plateNorm | repairOrders.byPlate@scope |
| REC | repairOrders | branchId, companyId, status, createdAt desc | repairOrders.list[status]@scope |
| REC | repairOrders | companyId, createdAt desc | repairOrders.list |
| REC | repairOrders | companyId, customerId, open, createdAt desc | repairOrders.byCustomer |
| REC | repairOrders | companyId, number | repairOrders.byNumber |
| REC | repairOrders | companyId, open, createdAt | repairOrders.open |
| REC | repairOrders | companyId, plateNorm | repairOrders.byPlate |
| REC | repairOrders | companyId, status, createdAt desc | repairOrders.list[status] |
| SYS | approvals | branchId, companyId, status, createdAt desc | approvals.byBranchStatus |
| SYS | approvals | companyId, requestedBy, createdAt desc | approvals.byRequester |
| SYS | auditLogs | action, actorId, branchId, companyId, at desc | auditLogs.list[action,actorId]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityId, at desc | auditLogs.list[action,actorId,entityId]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityId, entityType, at desc | auditLogs.list[action,actorId,entityId,entityType]@scope |
| SYS | auditLogs | action, actorId, branchId, companyId, entityType, at desc | auditLogs.list[action,actorId,entityType]@scope |
| SYS | auditLogs | action, actorId, companyId, at desc | auditLogs.list[action,actorId] |
| SYS | auditLogs | action, actorId, companyId, entityId, at desc | auditLogs.list[action,actorId,entityId] |
| SYS | auditLogs | action, actorId, companyId, entityId, entityType, at desc | auditLogs.list[action,actorId,entityId,entityType] |
| SYS | auditLogs | action, actorId, companyId, entityType, at desc | auditLogs.list[action,actorId,entityType] |
| SYS | auditLogs | action, branchId, companyId, at desc | auditLogs.list[action]@scope |
| SYS | auditLogs | action, branchId, companyId, entityId, at desc | auditLogs.list[action,entityId]@scope |
| SYS | auditLogs | action, branchId, companyId, entityId, entityType, at desc | auditLogs.list[action,entityId,entityType]@scope |
| SYS | auditLogs | action, branchId, companyId, entityType, at desc | auditLogs.list[action,entityType]@scope |
| SYS | auditLogs | action, companyId, at desc | auditLogs.list[action] |
| SYS | auditLogs | action, companyId, entityId, at desc | auditLogs.list[action,entityId] |
| SYS | auditLogs | action, companyId, entityId, entityType, at desc | auditLogs.list[action,entityId,entityType] |
| SYS | auditLogs | action, companyId, entityType, at desc | auditLogs.list[action,entityType] |
| SYS | auditLogs | actorId, branchId, companyId, at desc | auditLogs.list[actorId]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityId, at desc | auditLogs.list[actorId,entityId]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityId, entityType, at desc | auditLogs.list[actorId,entityId,entityType]@scope |
| SYS | auditLogs | actorId, branchId, companyId, entityType, at desc | auditLogs.list[actorId,entityType]@scope |
| SYS | auditLogs | actorId, companyId, at desc | auditLogs.list[actorId] |
| SYS | auditLogs | actorId, companyId, entityId, at desc | auditLogs.list[actorId,entityId] |
| SYS | auditLogs | actorId, companyId, entityId, entityType, at desc | auditLogs.list[actorId,entityId,entityType] |
| SYS | auditLogs | actorId, companyId, entityType, at desc | auditLogs.list[actorId,entityType] |
| SYS | auditLogs | branchId, companyId, at desc | auditLogs.list@scope |
| SYS | auditLogs | branchId, companyId, entityId, at desc | auditLogs.list[entityId]@scope |
| SYS | auditLogs | branchId, companyId, entityId, entityType, at desc | auditLogs.list[entityId,entityType]@scope |
| SYS | auditLogs | branchId, companyId, entityType, at desc | auditLogs.list[entityType]@scope |
| SYS | auditLogs | companyId, at desc | auditLogs.list |
| SYS | auditLogs | companyId, entityId, at desc | auditLogs.list[entityId] |
| SYS | auditLogs | companyId, entityId, entityType, at desc | auditLogs.list[entityId,entityType] |
| SYS | auditLogs | companyId, entityType, at desc | auditLogs.list[entityType] |
| SYS | authTokens | kind, userId, createdAt desc | authTokens.byUserKind |
| SYS | branches | companyId, code | branches.byCompany |
| SYS | configVersions | companyId, scopeKey, type, effectiveFrom desc | configVersions.byScope |
| SYS | configVersions | companyId, status, type, effectiveFrom desc | configVersions.byType[status] |
| SYS | configVersions | companyId, type, effectiveFrom desc | configVersions.byType |
| SYS | counters | branchId, companyId, updatedAt desc | counters.byBranch |
| SYS | importBatches | branchId, companyId, createdAt desc | importBatches.byBranch |
| SYS | importBatches | branchId, companyId, status, createdAt desc | importBatches.byBranchStatus |
| SYS | notifications | userId, createdAt desc | notifications.byUser |
| SYS | priceLists | companyId, code desc | priceLists.list.code.desc |
| SYS | priceLists | companyId, code | priceLists.list.code.asc |
| SYS | priceLists | companyId, nameNorm desc | priceLists.list.nameNorm.desc |
| SYS | priceLists | companyId, nameNorm | priceLists.list.nameNorm.asc |
| SYS | roleAssignments | branchId, companyId, employeeCode | roleAssignments.byBranch@scope |
| SYS | roleAssignments | companyId, employeeCode | roleAssignments.byBranch |
| SYS | roleAssignments | companyId, roleCode, createdAt | roleAssignments.byRole |
| SYS | roleAssignments | userId, createdAt | roleAssignments.byUser |
| SYS | services | companyId, code desc | services.list.code.desc |
| SYS | services | companyId, code | services.list.code.asc |
| SYS | services | companyId, group, code desc | services.list.code.desc[group] |
| SYS | services | companyId, group, code | services.list.code.asc[group] |
| SYS | services | companyId, group, nameNorm desc | services.list.nameNorm.desc[group] |
| SYS | services | companyId, group, nameNorm | services.list.nameNorm.asc[group] |
| SYS | services | companyId, nameNorm desc | services.list.nameNorm.desc |
| SYS | services | companyId, nameNorm | services.list.nameNorm.asc |
| SYS | sessions | userId, createdAt desc | sessions.byUser |
| SYS | users | companyId, employeeCode | users.byCompany |
| SYS | users | email, createdAt | users.byEmail |
| SYS | users | employeeCode, createdAt | users.byEmployeeCode |
| SYS | warehouses | branchId, companyId, code desc | warehouses.list.code.desc@scope |
| SYS | warehouses | branchId, companyId, code | warehouses.list.code.asc@scope |
| SYS | warehouses | branchId, companyId, nameNorm desc | warehouses.list.nameNorm.desc@scope |
