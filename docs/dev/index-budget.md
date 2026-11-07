# Ngân sách chỉ mục composite Firestore (R68, việc 4a)

Trạng thái: **172 trên 200 sau màn Lịch hẹn v2** (FR-REC-044 thêm `appointments.byStatus` (tenantId, branchId, status, date) cho tab Trễ hẹn, +1; còn 23 chỗ trước ngưỡng fail 195). Trước đó 171 sau slice 2.8b (169 sau khi gộp các slice 2.1, 2.5, 2.6a; 2.8b thêm `appointments.byDate` và `warranties.byVehicle`; cảnh báo từ 190, FAIL trên 195 theo `src/platform/store/indexBudget.ts`; còn 24 chỗ trước ngưỡng fail). Slice 2.1 giảm 192 xuống 168 (`auditLogs` 32 xuống 8), 2.6a thêm `laborSheets.byBranch` (+1), 2.5 không thêm. Số đúng đo bằng `pnpm check:indexes`: **trước slice 2.1 là 192** (các tài liệu từng ghi 191, 192, 193 do lệch từng đợt: 193 là số trước khi bỏ `users.byEmployeeCode` ở MT-0; CLAUDE.md, tài liệu này và `multi-tenant-requirements-for-dev.md` §5 nay cùng ghi số đo thật). Đếm chuỗi `collectionGroup` trong `firestore.indexes.json` ra nhiều hơn vì có thêm 7 chính sách TTL trong `fieldOverrides`; TTL không tính vào hạn mức 200 composite. Mọi hình truy vấn nghiệp vụ phải có `tenantId` (test `tests/unit/tenant-invariants.test.ts`).

## Đề xuất giải ngân sách của slice 2.1 (đã làm)

| | Trước | Sau |
| --- | ---: | ---: |
| Composite | 192 | **168** (169 sau khi gộp 2.6a) |
| Hình truy vấn đăng ký | 195 | 171 |
| `auditLogs` | 32 | 8 |

**Việc đã làm: một thay đổi duy nhất, `auditLogs`.** Bộ lọc nhật ký có bốn trường tùy chọn (`entityType`, `entityId`, `actorId`, `action`), mỗi tổ hợp x (toàn tenant | `@scope`) = 32 chỉ mục. Giữ hai trường dùng để xem lịch sử của MỘT bản ghi (`entityType`, `entityId`: 4 tổ hợp x 2 = 8 chỉ mục); `actorId` và `action` lọc trong bộ nhớ trên dòng chảy mới nhất trước, đọc từng lô 100 tài liệu, tối đa 1000 tài liệu mỗi yêu cầu (`DocAuditLog.list`). Trang chưa đầy mà còn con trỏ nghĩa là "chạm trần quét, bấm tiếp"; hết dữ liệu thì con trỏ rỗng. Kết quả của mỗi bộ lọc không đổi (cùng thứ tự `at` giảm dần, cùng phạm vi chi nhánh, mọi hình vẫn có `tenantId`); khác biệt duy nhất là chi phí: lọc theo người hoặc hành động đọc tối đa 1000 tài liệu thay vì đúng số trả về, và lọc chỉ theo người hoặc hành động trên ngày rất cũ có thể cần bấm "Tải thêm" nhiều lần. Test: `tests/integration/consolidation.test.ts` (lọc theo người và hành động có phân trang, cô lập chi nhánh).

**Việc cố ý KHÔNG làm** (để dành cho slice sau, đo trước khi gỡ): cặp "toàn công ty" và "@scope" của REC, INV, CRM (66 chỉ mục `@scope`): chủ đọc nhiều chi nhánh qua `in` chia nhóm 30 sẽ chậm hơn và đổi hành vi con trỏ; chưa có số đo nào chứng minh cần. Biến thể asc/desc của danh sách và `parts.list.*[group,status]` giữ nguyên vì danh sách phải trả đúng thứ tự khi phân trang. Không nâng trần 200.

**Báo cáo hợp nhất không tốn chỉ mục.** Xếp hạng, báo cáo khách và chỉ số đọc `rollups/<branchId>_<yyyyMMdd>` theo khóa (chi nhánh x ngày); nhóm chi nhánh là cấu hình `branch-groups`; phát hành danh mục là cấu hình `catalog-release`; lịch sử đăng nhập dùng `sessions.byUser` có sẵn.

**Đo tải đọc hợp nhất** (bộ nhớ, `tests/integration/consolidation.test.ts`, đếm `stats.reads`): xem `docs/dev/status.md` mục slice 2.1 (8 và 20 chi nhánh, một ngày và 31 ngày). Đã thêm chunk 200 id cho `DocRollupRepository.getMany`. Đo độ trễ thật trên Firestore chờ staging (Q63).

> Slice 2.5 (phê duyệt, 06/11/2026): **0 chỉ mục mới.** `approvalDelegations.byTenant` chỉ lọc theo `tenantId` (đơn trường, tự động); hàng chờ và việc chuyển cấp dùng lại `approvals.byBranchStatus`. 

## Chính sách

1. Giai đoạn 1 còn lại: không phân hệ nào thêm chỉ mục. Cần truy vấn mới thì: (a) dùng lại hình truy vấn có sẵn, (b) đọc theo khóa, (c) lọc trong bộ nhớ trên tập có giới hạn, hoặc (d) phi chuẩn hóa một trường khóa (cách RPT đã làm với `rollups/<branchId>_<yyyyMMdd>`).
2. Giai đoạn 2 (INS, PUR, HRM): muốn thêm chỉ mục phải gỡ một số tương ứng trong cùng PR, theo danh sách ứng viên bên dưới. Không xin nâng trần với chủ dự án (BA trả lời câu 40: không xin).
3. Chỉ mục đơn trường do Firestore tự lo; không khai báo.
4. Test hiệu năng và e2e không được thêm hình truy vấn ngoài `queries.ts`.

## Phân bổ theo phân hệ

SYS 46 (`auditLogs` còn 8), REC 48, INV 39, CRM 32, ACC 5, EIN 1, HRM 1 (tổng 172 sau màn Lịch hẹn v2; 171 sau slice 2.8b).

## Ứng viên gộp/bỏ (chỉ đề xuất, chưa làm; gỡ chỉ mục đòi đổi truy vấn)

- Cặp "toàn công ty" và "@scope": 66 chỉ mục `@scope` đứng cạnh bản không có `branchId` (chủ, đọc mọi chi nhánh). Phase 2 có thể bắt người dùng toàn công ty luôn đi qua truy vấn `@scope` với danh sách chi nhánh đầy đủ (`in` chia nhóm), bỏ nhiều bản không-scope: ước tính tiết kiệm hàng chục chỉ mục, đổi lại truy vấn chủ chậm hơn khi có nhiều chi nhánh (20 chi nhánh = 2 nhóm `in` 10). Cần đo trước.
- `auditLogs`: ĐÃ LÀM ở slice 2.1 (32 xuống 8).
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
| SYS | 46 |
| REC | 47 |
| INV | 39 |
| CRM | 32 |
| ACC | 5 |
| EIN | 1 |
| HRM | 1 |

| Module | Collection | Fields | Scope | FR, slice | Queries |
| --- | --- | --- | --- | --- | --- |
| ACC | cashEntries | branchId, businessDate, tenantId, seqKey | COLLECTION | FR-ACC-001..004, 1.7 | cashEntries.byDay |
| ACC | cashShifts | branchId, tenantId, openedAt desc | COLLECTION | FR-ACC-001..004, 1.7 | cashShifts.byBranch |
| ACC | debts | branchId, status, tenantId, dueDate | COLLECTION | FR-ACC, 1.7 | debts.byBranchStatus |
| ACC | payments | branchId, tenantId, createdAt desc | COLLECTION | FR-ACC-001..004, 1.7 | payments.byBranch |
| ACC | payments | orderId, tenantId, createdAt | COLLECTION | FR-ACC-001..004, 1.7 | payments.byOrder |
| CRM | consents | customerId, tenantId, grantedAt desc | COLLECTION | FR-CRM, 1.3 | consents.byCustomer |
| CRM | customerLinks | branchId, tenantId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc@scope |
| CRM | customerLinks | branchId, tenantId, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc@scope |
| CRM | customerLinks | branchId, tenantId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc[type]@scope |
| CRM | customerLinks | branchId, tenantId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc[type]@scope |
| CRM | customerLinks | tenantId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc |
| CRM | customerLinks | tenantId, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc |
| CRM | customerLinks | tenantId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.desc[type] |
| CRM | customerLinks | tenantId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customerLinks.list.name.asc[type] |
| CRM | customerPii | tenantId, phoneNorm | COLLECTION | FR-CRM, 1.3 | customerPii.byPhone |
| CRM | customers | tenantId, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customers.list.name.desc |
| CRM | customers | tenantId, nameNorm | COLLECTION | FR-CRM, 1.3 | customers.list.name.asc |
| CRM | customers | tenantId, type, nameNorm desc | COLLECTION | FR-CRM, 1.3 | customers.list.name.desc[type] |
| CRM | customers | tenantId, type, nameNorm | COLLECTION | FR-CRM, 1.3 | customers.list.name.asc[type] |
| CRM | dataSubjectRequests | branchId, customerId, status, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId,status]@scope |
| CRM | dataSubjectRequests | branchId, customerId, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId]@scope |
| CRM | dataSubjectRequests | branchId, status, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[status]@scope |
| CRM | dataSubjectRequests | branchId, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list@scope |
| CRM | dataSubjectRequests | customerId, status, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId,status] |
| CRM | dataSubjectRequests | customerId, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[customerId] |
| CRM | dataSubjectRequests | status, tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list[status] |
| CRM | dataSubjectRequests | tenantId, receivedAt desc | COLLECTION | FR-CRM, 1.3 | dataSubjectRequests.list |
| CRM | vehicleHistory | tenantId, vehicleId, date desc | COLLECTION | FR-CRM, 1.3 | vehicleHistory.byVehicle |
| CRM | vehicleLinks | branchId, tenantId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.desc@scope |
| CRM | vehicleLinks | branchId, tenantId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.asc@scope |
| CRM | vehicleLinks | tenantId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.desc |
| CRM | vehicleLinks | tenantId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicleLinks.list.plate.asc |
| CRM | vehicleOwnerships | customerId, tenantId, from desc | COLLECTION | FR-CRM, 1.3 | vehicleOwnerships.byCustomer |
| CRM | vehicleOwnerships | tenantId, vehicleId, from desc | COLLECTION | FR-CRM, 1.3 | vehicleOwnerships.byVehicle |
| CRM | vehicles | currentOwnerId, tenantId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicles.byOwner |
| CRM | vehicles | tenantId, plateNorm desc | COLLECTION | FR-CRM, 1.3 | vehicles.list.plate.desc |
| CRM | vehicles | tenantId, plateNorm | COLLECTION | FR-CRM, 1.3 | vehicles.list.plate.asc |
| EIN | invoices | branchId, tenantId, createdAt desc | COLLECTION | FR-EIN, 1.8 | invoices.byBranch |
| HRM | laborSheets | branchId, tenantId, recordedAt desc | COLLECTION | FR-HRM-007, 020, 2.6a | laborSheets.byBranch |
| INV | partCompat | compatKey, tenantId, code | COLLECTION | FR-INV, 1.4 | partCompat.byModel |
| INV | parts | group, status, tenantId, code | COLLECTION | FR-INV, 1.4 | parts.list.code[group,status] |
| INV | parts | group, status, tenantId, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[group,status] |
| INV | parts | group, tenantId, code | COLLECTION | FR-INV, 1.4 | parts.list.code[group] |
| INV | parts | group, tenantId, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[group] |
| INV | parts | status, tenantId, code | COLLECTION | FR-INV, 1.4 | parts.list.code[status] |
| INV | parts | status, tenantId, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name[status] |
| INV | parts | tenantId, code | COLLECTION | FR-INV, 1.4 | parts.list.code |
| INV | parts | tenantId, nameNorm | COLLECTION | FR-INV, 1.4 | parts.list.name |
| INV | stockBalances | branchId, lowStock, tenantId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock]@scope |
| INV | stockBalances | branchId, lowStock, tenantId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock,warehouseId]@scope |
| INV | stockBalances | branchId, partId, tenantId, warehouseId | COLLECTION | FR-INV, 1.4 | stockBalances.byPart@scope |
| INV | stockBalances | branchId, tenantId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code@scope |
| INV | stockBalances | branchId, tenantId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[warehouseId]@scope |
| INV | stockBalances | lowStock, tenantId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock] |
| INV | stockBalances | lowStock, tenantId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[lowStock,warehouseId] |
| INV | stockBalances | nonZero, tenantId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.nonZero |
| INV | stockBalances | partId, tenantId, warehouseId | COLLECTION | FR-INV, 1.4 | stockBalances.byPart |
| INV | stockBalances | tenantId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code |
| INV | stockBalances | tenantId, warehouseId, partCodeNorm | COLLECTION | FR-INV, 1.4 | stockBalances.list.code[warehouseId] |
| INV | stockDocuments | branchId, status, tenantId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status]@scope |
| INV | stockDocuments | branchId, status, tenantId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status,type]@scope |
| INV | stockDocuments | branchId, tenantId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list@scope |
| INV | stockDocuments | branchId, tenantId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[type]@scope |
| INV | stockDocuments | status, tenantId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status] |
| INV | stockDocuments | status, tenantId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[status,type] |
| INV | stockDocuments | status, tenantId, warehouseId, createdAt | COLLECTION | FR-INV, 1.4 | stockDocuments.openByWarehouse |
| INV | stockDocuments | tenantId, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list |
| INV | stockDocuments | tenantId, type, createdAt desc | COLLECTION | FR-INV, 1.4 | stockDocuments.list[type] |
| INV | stockMovements | branchId, partId, tenantId, warehouseId, seqKey desc | COLLECTION | FR-INV, 1.4 | stockMovements.byBalance@scope |
| INV | stockMovements | partId, tenantId, warehouseId, seqKey desc | COLLECTION | FR-INV, 1.4 | stockMovements.byBalance |
| INV | stockReservations | branchId, partId, status, tenantId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart[status]@scope |
| INV | stockReservations | branchId, partId, tenantId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart@scope |
| INV | stockReservations | branchId, sourceId, sourceType, tenantId, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.bySource@scope |
| INV | stockReservations | branchId, status, tenantId, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.open@scope |
| INV | stockReservations | partId, status, tenantId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart[status] |
| INV | stockReservations | partId, tenantId, updatedAt desc | COLLECTION | FR-INV, 1.4 | stockReservations.byPart |
| INV | stockReservations | sourceId, sourceType, tenantId, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.bySource |
| INV | stockReservations | status, tenantId, createdAt | COLLECTION | FR-INV, 1.4 | stockReservations.open |
| REC | appointments | branchId, tenantId, date | COLLECTION | FR-REC-019, 027, 2.8b | appointments.byDate |
| REC | intakes | branchId, status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list[status]@scope |
| REC | intakes | branchId, status, tenantId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber[status]@scope |
| REC | intakes | branchId, status, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate[status]@scope |
| REC | intakes | branchId, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list@scope |
| REC | intakes | branchId, tenantId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber@scope |
| REC | intakes | branchId, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate@scope |
| REC | intakes | customerId, status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.byCustomer |
| REC | intakes | status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list[status] |
| REC | intakes | status, tenantId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber[status] |
| REC | intakes | status, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate[status] |
| REC | intakes | tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | intakes.list |
| REC | intakes | tenantId, number | COLLECTION | FR-REC, 1.5 | intakes.byNumber |
| REC | intakes | tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | intakes.byPlate |
| REC | partRequests | branchId, orderId, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byOrder@scope |
| REC | partRequests | branchId, status, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byStatus@scope |
| REC | partRequests | orderId, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byOrder |
| REC | partRequests | status, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | partRequests.byStatus |
| REC | quotes | branchId, status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list[status]@scope |
| REC | quotes | branchId, status, tenantId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber[status]@scope |
| REC | quotes | branchId, status, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate[status]@scope |
| REC | quotes | branchId, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list@scope |
| REC | quotes | branchId, tenantId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber@scope |
| REC | quotes | branchId, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate@scope |
| REC | quotes | customerId, status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.byCustomer |
| REC | quotes | status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list[status] |
| REC | quotes | status, tenantId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber[status] |
| REC | quotes | status, tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate[status] |
| REC | quotes | tenantId, createdAt desc | COLLECTION | FR-REC, 1.5 | quotes.list |
| REC | quotes | tenantId, number | COLLECTION | FR-REC, 1.5 | quotes.byNumber |
| REC | quotes | tenantId, plateNorm | COLLECTION | FR-REC, 1.5 | quotes.byPlate |
| REC | repairItems | active, branchId, technicianId, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | repairItems.byTechnician@scope |
| REC | repairItems | active, technicianId, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | repairItems.byTechnician |
| REC | repairItems | branchId, orderId, tenantId, seqKey | COLLECTION | FR-REC, 1.6 | repairItems.byOrder@scope |
| REC | repairItems | orderId, tenantId, seqKey | COLLECTION | FR-REC, 1.6 | repairItems.byOrder |
| REC | repairOrders | branchId, open, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | repairOrders.open@scope |
| REC | repairOrders | branchId, status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list[status]@scope |
| REC | repairOrders | branchId, tenantId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list@scope |
| REC | repairOrders | branchId, tenantId, number | COLLECTION | FR-REC, 1.6 | repairOrders.byNumber@scope |
| REC | repairOrders | branchId, tenantId, plateNorm | COLLECTION | FR-REC, 1.6 | repairOrders.byPlate@scope |
| REC | repairOrders | customerId, open, tenantId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.byCustomer |
| REC | repairOrders | open, tenantId, createdAt | COLLECTION | FR-REC, 1.6 | repairOrders.open |
| REC | repairOrders | status, tenantId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list[status] |
| REC | repairOrders | tenantId, createdAt desc | COLLECTION | FR-REC, 1.6 | repairOrders.list |
| REC | repairOrders | tenantId, number | COLLECTION | FR-REC, 1.6 | repairOrders.byNumber |
| REC | repairOrders | tenantId, plateNorm | COLLECTION | FR-REC, 1.6 | repairOrders.byPlate |
| REC | warranties | tenantId, vehicleId, startDate desc | COLLECTION | FR-REC-018, 036, 2.8b | warranties.byVehicle |
| SYS | approvals | branchId, status, tenantId, createdAt desc | COLLECTION | FR-SYS-004, 1.1/1.7 | approvals.byBranchStatus |
| SYS | approvals | requestedBy, tenantId, createdAt desc | COLLECTION | FR-SYS-004, 1.1/1.7 | approvals.byRequester |
| SYS | auditLogs | branchId, entityId, entityType, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId,entityType]@scope |
| SYS | auditLogs | branchId, entityId, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId]@scope |
| SYS | auditLogs | branchId, entityType, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityType]@scope |
| SYS | auditLogs | branchId, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list@scope |
| SYS | auditLogs | entityId, entityType, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId,entityType] |
| SYS | auditLogs | entityId, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityId] |
| SYS | auditLogs | entityType, tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list[entityType] |
| SYS | auditLogs | tenantId, at desc | COLLECTION | FR-SYS-003, 1.1 | auditLogs.list |
| SYS | authTokens | kind, userId, createdAt desc | COLLECTION | FR-SYS-001, 1.1 | authTokens.byUserKind |
| SYS | branches | tenantId, code | COLLECTION | FR-SYS-005, 1.2 | branches.byTenant |
| SYS | configVersions | scopeKey, tenantId, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byScope |
| SYS | configVersions | status, tenantId, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byType[status] |
| SYS | configVersions | tenantId, type, effectiveFrom desc | COLLECTION | FR-SYS-006, 1.1 | configVersions.byType |
| SYS | counters | branchId, tenantId, updatedAt desc | COLLECTION | FR-SYS-001, 1.1 | counters.byBranch |
| SYS | importBatches | branchId, status, tenantId, createdAt desc | COLLECTION | FR-SYS-007, 1.11 | importBatches.byBranchStatus |
| SYS | importBatches | branchId, tenantId, createdAt desc | COLLECTION | FR-SYS-007, 1.11 | importBatches.byBranch |
| SYS | notifications | userId, createdAt desc | COLLECTION | FR-SYS, 1.1 | notifications.byUser |
| SYS | priceLists | tenantId, code desc | COLLECTION | FR-SYS, 1.2 | priceLists.list.code.desc |
| SYS | priceLists | tenantId, code | COLLECTION | FR-SYS, 1.2 | priceLists.list.code.asc |
| SYS | priceLists | tenantId, nameNorm desc | COLLECTION | FR-SYS, 1.2 | priceLists.list.nameNorm.desc |
| SYS | priceLists | tenantId, nameNorm | COLLECTION | FR-SYS, 1.2 | priceLists.list.nameNorm.asc |
| SYS | roleAssignments | branchId, tenantId, employeeCode | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byBranch@scope |
| SYS | roleAssignments | roleCode, tenantId, createdAt | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byRole |
| SYS | roleAssignments | tenantId, employeeCode | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byBranch |
| SYS | roleAssignments | userId, createdAt | COLLECTION | FR-SYS-001/002, 1.1 | roleAssignments.byUser |
| SYS | services | group, tenantId, code desc | COLLECTION | FR-SYS, 1.2 | services.list.code.desc[group] |
| SYS | services | group, tenantId, code | COLLECTION | FR-SYS, 1.2 | services.list.code.asc[group] |
| SYS | services | group, tenantId, nameNorm desc | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.desc[group] |
| SYS | services | group, tenantId, nameNorm | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.asc[group] |
| SYS | services | tenantId, code desc | COLLECTION | FR-SYS, 1.2 | services.list.code.desc |
| SYS | services | tenantId, code | COLLECTION | FR-SYS, 1.2 | services.list.code.asc |
| SYS | services | tenantId, nameNorm desc | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.desc |
| SYS | services | tenantId, nameNorm | COLLECTION | FR-SYS, 1.2 | services.list.nameNorm.asc |
| SYS | sessions | userId, createdAt desc | COLLECTION | FR-SYS-001, 1.1 | sessions.byUser |
| SYS | users | email, createdAt | COLLECTION | FR-SYS-001, 1.1 | users.byEmail |
| SYS | users | tenantId, employeeCode | COLLECTION | FR-SYS-001, 1.1 | users.byTenant |
| SYS | warehouses | branchId, tenantId, code desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.desc@scope |
| SYS | warehouses | branchId, tenantId, code | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.asc@scope |
| SYS | warehouses | branchId, tenantId, nameNorm desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.desc@scope |
| SYS | warehouses | branchId, tenantId, nameNorm | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.asc@scope |
| SYS | warehouses | tenantId, code desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.desc |
| SYS | warehouses | tenantId, code | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.code.asc |
| SYS | warehouses | tenantId, nameNorm desc | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.desc |
| SYS | warehouses | tenantId, nameNorm | COLLECTION | FR-SYS-005, 1.2 | warehouses.list.nameNorm.asc |

0 prefix candidate(s)
0 index(es) used by no registered query
