# Kế hoạch lượt việc tiếp theo (dev, 04/11/2026)

Chỉ là kế hoạch, chưa sửa mã. Nguồn: `docs/dev/status.md`, `implementation-plan.md` §5, §7 (1.12), §8, mã thực tế ở nhánh `feat/phase1-import-reports-hardening`.

Ước lượng: N = nhỏ (dưới nửa ngày), V = vừa (1 đến 2 ngày), L = lớn (trên 2 ngày).

## Phát hiện khi khảo sát (ảnh hưởng kế hoạch)

- `status.md` đã cũ ở hai chỗ: (1) tải mẫu nhập `.xlsx` đã có (nút `template-xlsx` ở `ImportWorkbench.tsx`, `?format=xlsx`); (2) cột "đã xuất hóa đơn" khi lọc loại dịch vụ đã sửa ở rollup v3 (mục "Cập nhật (5)"). Hai việc này chỉ cần ghi lại, không làm.
- Đã có sẵn: test đồng thời tồn kho (`inv.test.ts` 24 song song, cùng Idempotency-Key), phát lại tiền (`acc.test.ts` Idempotency-Key, mọi route tiền đòi key, trần ca song song), phát lại hóa đơn (`ein.test.ts` bấm hai lần, song song, timeout trước/sau), ma trận cách ly cho kho (`isolation.test.ts`, chỉ phân hệ INV/kho), axe trên mọi spec e2e (`slice-1-x`, `ui-alignment`), mở lại ngày qua API trong `slice-1-7.spec.ts`.
- Chưa có: test hiệu năng (không có k6, không có thư mục perf), ma trận cách ly cho các phân hệ khác (CRM, REC, ACC, EIN, RPT, SYS, tệp, xuất), e2e có nhãn UAT-02, 03, 06, 07 (ngày), 08, 09, 10, 12, 13, kiểm tra §8 theo bảng.
- Chỉ mục: `firestore.indexes.json` có 193 composite (status ghi 192, lệch 1); cảnh báo từ 190, FAIL trên 195, nghĩa là còn 2 chỗ. Không mục nào dưới đây được thêm chỉ mục.

## Mục 1. Slice 1.12 phần củng cố/kiểm thử (L; chia 1a đến 1e)

FR/RULE: NFR-PERF-01/02, NFR-ISO-01, NFR-SEC, RULE-007/008/009/010, FR-INV-020, FR-EIN-013, UAT-01..03, 06..10, 12, 13.

- 1a. Hiệu năng (V). Tệp mới `tests/integration/perf-nfr.test.ts` (project integration, chạy cả memory và emulator): seed khối lượng 1 chi nhánh x ~5.000 khách/xe, 2.000 lệnh, 30 ngày rollup; đo p95 cho thao tác thường (danh sách, tìm kiếm, mở lệnh, thu tiền, báo giá) so ngưỡng 2 s và dashboard hợp nhất 8 chi nhánh so 5 s. Ngưỡng nới 2x khi chạy trên emulator (đây là bài kiểm hồi quy về số lần đọc/độ phức tạp, không phải đo 4G; đo thật = k6 trên staging, hoãn, cần GCP). Thêm đo thời gian ghi lô nhập 2.000 dòng (căn cứ quyết định R94 ở mục 5). Helper sinh khối lượng `tests/helpers/volume.ts` (tệp mới). Rủi ro: emulator chậm và không ổn định, nên đo theo số lần đọc/ghi tài liệu (đếm qua `DocStore`) là tiêu chí chính, thời gian là phụ.
- 1b. Đồng thời và phát lại (N). Phần lớn đã có. Bổ sung: thu tiền song song cùng đơn khác key (tổng thu không vượt, chỉ một lần xử lý theo `getOrderBalance`), đảo phiếu thu song song (một lần), giữ chỗ và xuất song song trên cùng lệnh (RULE-008), `import commit` song song (nhận lô bằng chuyển trạng thái). Thêm vào `acc.test.ts`, `inv.test.ts`, `import.test.ts` (tệp hiện có; xung đột với mục 5, xem bản đồ).
- 1c. Ma trận cách ly sinh tự động (V). Tệp mới `tests/integration/isolation-matrix.test.ts`: dựng bảng (route GET danh sách/chi tiết/xuất/tệp/báo cáo) x (người dùng chi nhánh A, B, nhiều chi nhánh, chủ) cho CRM, REC (lệnh, ảnh, báo giá), ACC (phiếu thu, sổ quỹ, ngày), EIN (hóa đơn, XML/PDF), RPT (ngày, tháng, đối chiếu, kho, kỹ thuật viên, xuất), SYS (import, audit). Khẳng định: danh sách đúng phạm vi, chi tiết ngoài phạm vi là 404 giống id không tồn tại, xuất chỉ phạm vi của mình. Tự động sinh từ danh sách route trong `src/app/api/v1` để test fail khi có route mới không có dòng trong ma trận (danh sách ngoại lệ có chú thích). Tái dùng `harness.ts`.
- 1d. Truy cập a11y (N đến V). Đã có axe ở nhiều spec; thiếu: màn mới của đợt vừa rồi (`/sys/imports`, `/rpt/*` tháng/đối chiếu/kho/kỹ thuật viên, hoàn tiền, mở lại ngày, ảnh), kiểm bàn phím cho hộp thoại (Esc, trả focus). Tệp mới `e2e/a11y-phase1.spec.ts` (không sửa spec cũ). Lỗi tìm ra ở `src/ui` hoặc màn hình sẽ phải sửa mã: sửa ở luồng B (xem bản đồ).
- 1e. Rà checklist bảo mật §8 (V). Tệp mới `tests/integration/security-checklist.test.ts` ánh xạ từng dòng được kiểm bằng test: #1 Rules từ chối (đã có spike/bundle), #2 khóa 5 lần và hết phiên (đã có, chỉ trỏ), #3 Origin/CSRF cho mọi route ghi (duyệt danh sách route: mọi POST/PUT/PATCH/DELETE phải đi qua `api`/`authed`/`cron`), #5 tách nhiệm vụ, #6 che dữ liệu và nhật ký "Hiện", #9 gitleaks (kiểm CI có bước hay chưa), #11 token liên kết, #12 tải tệp, #13 giới hạn tốc độ, #14 nhật ký không chứa SĐT đầy đủ (quét audit sau một kịch bản đầy đủ), #19 mật khẩu bước hai. Đầu ra: bảng "có test / thiếu / ngoài phạm vi (cần hạ tầng GCP)" ghi vào `docs/dev/security-checklist-status.md` (tệp mới). Mục #10 (TOTP/KMS) ngoài phạm vi theo quyết định chủ (MFA làm sau), #16, #17, #20 cần hạ tầng/pentest: loại.
- 1f. E2E UAT (V đến L). Tệp mới theo UAT, mỗi tệp một hành trình, chạy trên emulator: UAT-01 (đã bao phủ nhiều đoạn, thêm một hành trình liền mạch nhận xe đến hóa đơn kèm kiểm số trên báo cáo đối chiếu), UAT-02 (xuất kho không chứng từ bị chặn), UAT-03 (hạng mục phát sinh: thợ không bắt đầu khi chưa duyệt), UAT-06 (cách ly danh sách, tìm kiếm, báo cáo trên UI), UAT-07 (chốt ngày, chặn sửa ngày đã khóa; có sẵn một phần ở slice-1-7), UAT-08 (hóa đơn điều chỉnh cần KT trưởng), UAT-09 (đổi thuế theo ngày hiệu lực; cần ngày hiệu lực trong cấu hình seed, không đổi đồng hồ hệ thống), UAT-10 (đồng ý/rút/yêu cầu xóa; có ở slice-1-3), UAT-12 (UI nhập Excel, xem mục 3), UAT-13 (giữ chỗ 20, giữ 5, thấy 15; hủy nhả). Nhiều ý đã có e2e dưới tên khác: bước đầu là bảng ánh xạ UAT -> spec/test hiện có (`docs/dev/uat-coverage.md`, tệp mới), chỉ viết thêm chỗ hở. Để chạy: `workers: 1` nên thời gian CI tăng; giữ mỗi UAT dưới 60 s.
- Loại khỏi lượt (cần thiết bị/hạ tầng thật): UAT-17..20, 22, 23, 25 (in thử máy thật, pentest, diễn tập khôi phục, k6 trên staging, tải 20 chi nhánh).

## Mục 2. Hoàn thiện RPT giai đoạn 1 (V)

FR: FR-RPT-002 (nửa sau), 014. RULE-007.

- 2a. So sánh với kỳ trước (RPT-002): `computeMonthly` nhận thêm kỳ trước (tháng liền trước, cùng số ngày hoặc cả tháng, chọn theo mức tối thiểu "cùng khoảng ngày"), trả `previous` + `deltaPct` (điểm cơ bản, số nguyên, chia an toàn khi mẫu bằng 0, "n/a" nếu kỳ trước thiếu rollup). Chạm: `src/modules/rpt/domain/reports.ts`, `application/*` đọc monthly, `src/composition/rptWiring.ts` (không cần), API `monthly`, màn `src/app/(shell)/rpt/monthly/*`, xuất CSV/xlsx, `vi.json`. Dùng lại đọc rollup theo khóa, không chỉ mục mới (đọc thêm tối đa ~31 tài liệu). Test: `tests/unit/rpt-reports.test.ts` (ví dụ tay: tăng, giảm, kỳ trước thiếu ngày, chia cho 0), `tests/integration/rpt.test.ts`. Mở câu hỏi nhỏ cho BA: so với "tháng trước" hay "cùng kỳ năm trước"; mặc định dev: tháng liền trước, cùng khoảng ngày [Cần xác nhận]. So sánh giữa chi nhánh (nửa đầu RPT-002) thuộc báo cáo hợp nhất, không làm.
- 2b. Cột "đã xuất hóa đơn" khi lọc loại dịch vụ: đã xong ở rollup v3 (xem phát hiện). Việc còn lại: một test hồi quy khẳng định giá trị khác 0 khi lọc (kiểm `rpt.test.ts` đã có hay chưa trước khi viết), và sửa `status.md`.
- 2c. Chia thu theo phương thức: đã có trong v3 theo loại dịch vụ. Quỹ, nợ tồn, chi theo loại dịch vụ: không khả thi sạch vì sổ quỹ/chi không gắn lệnh (status đã nêu); đề xuất không làm, chỉ giữ dòng "Không gắn lệnh". Đối chiếu kho khi lọc loại dịch vụ: giữ ẩn. Cần BA xác nhận rằng đây là chấp nhận được (câu hỏi Q-A).

## Mục 3. Màn hình còn thiếu (V)

- 3a. Danh sách ảnh theo đề xuất (FR-REC-014): trên lệnh, thêm nhóm ảnh theo `proposalId` ở `PhotoPanel.tsx` và mở rộng `GET .../photos` (đã trả `proposalId`, kiểm trước) hoặc trang con `rec/orders/[id]/proposals/[pid]`. Chạm `src/app/(shell)/rec/PhotoPanel.tsx`, `RecPage`/`orders/[id]/page.tsx`, `vi.json`; phía API chỉ đọc. Test: e2e thêm vào tệp mới `e2e/rec-photos-by-proposal.spec.ts`; integration thêm ca lọc theo đề xuất cho `rec-orders.test.ts`. Xóa ảnh/làm mờ: loại (R104 chỉ chấp nhận ẩn, làm mờ chờ Luật sư).
- 3b. E2E mở lại ngày qua giao diện: `ApprovedActionPanel` trên `/acc/day-close` cần ngày đã chốt. Cách: spec mới đứng sau UAT-07 trong cùng tệp (đã chốt ngày ở `slice-1-7.spec.ts` rồi mở lại bằng API ở cuối nên ngày không còn chốt). Giải pháp: spec riêng `e2e/acc-day-reopen-ui.spec.ts` tự mở ca, chốt ngày, rồi đi bằng UI (QL gửi yêu cầu, CH nhập mật khẩu duyệt, QL thực hiện), cuối cùng đã mở lại để spec sau còn thu tiền được; thứ tự tệp phải đảm bảo (đặt tên sau `slice-1-7`, `workers: 1`). Rủi ro: dùng chung cơ sở dữ liệu e2e và ngày làm việc; mọi spec thu tiền phải chạy sau khi ngày được mở lại.
- 3c. E2E giao diện nhập Excel (UAT-12): `e2e/sys-import-ui.spec.ts` dùng `tests/fixtures/import/customers.xlsx` (đã có): tải mẫu (csv và xlsx), tải tệp lỗi thấy lỗi theo dòng, sửa ánh xạ, chạy thử, ghi, hoàn tác, quyền (nhân viên không có menu), 375 px không tràn, axe. Chạm: chỉ e2e (có thể thêm `data-testid`).

## Mục 4. Nợ kỹ thuật

- 4a. Kế hoạch ngân sách chỉ mục (N, chủ yếu tài liệu + một công cụ): 193/200, ngưỡng fail 195. Việc: (1) `docs/dev/index-budget.md` liệt kê từng chỉ mục, owner, query trong `queries.ts`, và ứng viên gộp/bỏ (chỉ mục đơn trường Firestore tự lo; chỉ mục trùng tiền tố có thể gộp); (2) mở rộng `scripts/check-indexes.ts` để in bảng theo phân hệ; (3) chính sách: không phân hệ nào thêm chỉ mục ở giai đoạn 1 còn lại, phase 2 (INS, PUR, HRM) cần gỡ trước khi thêm hoặc xin nâng trần với chủ dự án (BA trả lời câu 40: không xin). Chạm `scripts/check-indexes.ts`, `docs/dev/`. Không đổi `queries.ts`. Rủi ro: gỡ chỉ mục đòi đổi truy vấn, chỉ đề xuất không làm.
- 4b. Cron OIDC (V): thêm xác thực `Authorization: Bearer <OIDC token>` của Cloud Scheduler bên cạnh `x-cron-secret` (giữ tương thích, hoặc cả hai tắt thì 404 như nay). Cần xác minh JWT Google (chữ ký qua JWKS, `aud`, `email` = tài khoản dịch vụ đã cấu hình) bằng `firebase-admin`/`google-auth-library` (kiểm `google-auth-library` có sẵn như phụ thuộc gián tiếp; không thêm gói nếu không cần, thêm gói phải xin ADR nhỏ). Env mới: `CRON_OIDC_AUDIENCE`, `CRON_OIDC_SERVICE_ACCOUNT`; verifier là một port (`CronAuthVerifier`) để test dùng bản giả (không gọi mạng). Chạm: `src/composition/api.ts` (wrapper `cron()`), `src/platform/config/env.ts`, `src/platform/auth/cronAuth.ts` (tệp mới), `README.md` mục Scheduler, `tests/integration/platform.test.ts` (các ca: OIDC đúng, aud sai, email sai, hết hạn, đồng thời với secret, cả hai không đặt thì 404), `.env.example`. Rủi ro: không kiểm thử với token Google thật được trên emulator; dùng khóa RSA tạo trong test.
- 4c. `CRON_COMPANY_ID` một pháp nhân: vẫn [Cần xác nhận], không đổi.
- 4d. Khóa kỳ tháng: BỊ CHẶN. FR-ACC-005 chỉ có một dòng ("Khóa kỳ kế toán; mở lại cần chủ garage duyệt kèm lý do"); BA §24 R106(e) và câu 57 ghi rõ "khóa kỳ tháng chưa làm... cần xuất kỳ và ràng buộc với phần mềm kế toán của khách". Thiếu: kỳ là tháng lịch hay kỳ cấu hình, ai khóa (KT hay CH), điều kiện khóa (mọi ngày đã chốt? mọi chứng từ nháp?), chứng từ nào bị khóa (chỉ ACC hay cả INV, EIN), sửa sau khóa bằng đảo vào kỳ mở, quan hệ với xuất kỳ cho phần mềm kế toán (Phase 3). Không đoán; xem câu hỏi BA ở cuối.

## Mục 5. Slice 1.11 phần còn lại

- 5a. Tải mẫu `.xlsx`: đã xong (phát hiện trên). Chỉ sửa `status.md` (N).
- 5b. Phân trang lỗi trên màn nhập (N đến V): hiện `SCREEN_ISSUES = 200`, `MAX_ISSUES = 500` lưu trên lô. Thêm `GET /imports/{id}/issues?cursor&limit` đọc từ lô (không chỉ mục mới, vì issues nằm trong tài liệu lô; cắt trang trong bộ nhớ trên tối đa 500), bảng ở `ImportWorkbench.tsx` có "Trước/Sau" và tổng, giữ nhãn "mức tối thiểu" khi `issueCount > 500`; tệp xuất CSV lỗi (tuỳ chọn). Chạm: `sys/application/dataImport.ts`, route mới dưới `src/app/api/v1/sys/imports/[id]/issues`, `ImportWorkbench.tsx`, `vi.json`. Test: `tests/integration/import.test.ts` (300 dòng lỗi, trang thứ hai, quyền/cách ly chi nhánh khác 404), `tests/unit/sys-import.test.ts`. Nâng trần lưu 500 lên cao hơn: không (giới hạn kích thước tài liệu 1 MiB).
- 5c. R94 xử lý nền lô lớn: ĐỀ XUẤT HOÃN. Hiện trần 2.000 dòng, ghi theo bước 20 đến 100, tiến độ lưu và ghi tiếp được (`failed -> committing`), nên một request chịu được; lô lớn hơn cần Cloud Tasks/Run Jobs (hạ tầng chưa có, ADR §tác vụ nền). Việc cần làm lượt này: đo thời gian ghi lô 2.000 dòng ở 1a; nếu dưới ~60 s trên emulator thì hoãn đến khi có GCP và có mẫu thật (R93) cho biết kích thước lô thật.
- 5d. R97 gộp khách trùng: ĐỀ XUẤT HOÃN và đang bị chặn bởi BA. Là thao tác hủy dữ liệu (xe, quan hệ sở hữu có hiệu lực, đồng ý, yêu cầu chủ dữ liệu, lịch sử xuyên chi nhánh, RetentionPort); cần BA chốt khóa nhận diện (SĐT, MST, biển số), bản ghi nào còn lại, cách xử lý đồng ý/PII, hoàn tác được không. Chi phí ước tính L (CRM domain + migrate liên kết sang REC/ACC/EIN). Hiện đã có cảnh báo trùng SĐT trong phạm vi (R97) là đủ cho pilot.

## (b) Mục bị chặn, loại khỏi lượt này

| Mục | Lý do |
| --- | --- |
| Khóa kỳ tháng (4d) | Yêu cầu mơ hồ, BA/khách chưa chốt (R106(e), câu 57) |
| R97 gộp khách trùng (5d) | Cần quy tắc BA, thao tác hủy dữ liệu |
| R94 nền (5c) | Cần hạ tầng GCP; chờ số đo, hoãn |
| 2c quỹ/nợ/chi theo loại dịch vụ, đối chiếu kho khi lọc | Dữ liệu không gắn lệnh; cần BA chấp nhận |
| k6 trên staging, pentest, diễn tập khôi phục, UAT-17..20, 22, 23, 25 | Cần hạ tầng/thiết bị thật |
| Xóa/làm mờ ảnh, hạn lưu | R104 chờ Luật sư |

## (c) Bản đồ xung đột file và chia luồng

Điểm nóng dùng chung: `src/platform/i18n/vi.json`, `e2e/helpers.ts`, `e2e/acc-helpers.ts`, `tests/integration/harness.ts`, `tests/integration/{import,rpt,acc,rec-orders}.test.ts`, `docs/dev/status.md`.

| Mục | Tệp chính | Va chạm |
| --- | --- | --- |
| 1a, 1c, 1e, 1f | tệp mới trong `tests/integration`, `e2e`, `docs/dev` | `harness.ts`/helpers (dùng chung, chỉ đọc) |
| 1b | thêm ca vào `acc|inv|import.test.ts` | trùng với 5b (import.test.ts), 2a (rpt.test.ts) |
| 1d | `e2e/a11y-phase1.spec.ts`; sửa lỗi ở `src/ui`, màn | trùng 3a, 5b (màn) nếu có sửa |
| 2a | `rpt/*`, màn `rpt/monthly`, `vi.json` | `vi.json`, `rpt.test.ts` |
| 3a | `rec/PhotoPanel`, `rec-orders.test.ts`, `vi.json` | `vi.json` |
| 3b, 3c | tệp e2e mới | `acc-helpers.ts` (chỉ đọc) |
| 4a | `scripts/check-indexes.ts`, docs | không |
| 4b | `api.ts`, `env.ts`, `platform/auth`, README, `platform.test.ts` | `api.ts` chung, không ai khác sửa |
| 5b | `sys/*dataImport*`, route issues, `ImportWorkbench`, `import.test.ts`, `vi.json` | `vi.json`, `import.test.ts` |

Chia 2 luồng không đụng file:

- Luồng A (kiểm thử, chỉ tạo tệp mới, không sửa `src/`): 1a, 1c, 1e, 1f, 1d (chỉ viết test), 3b, 3c, 4a (tài liệu và script). Sở hữu độc quyền `tests/`, `e2e/`, `scripts/`, `docs/dev/{uat-coverage,security-checklist-status,index-budget}.md`. Được phép thêm `data-testid` nhỏ nếu cần? KHÔNG: ghi vào danh sách "cần B sửa" để tránh đụng. Ngoại lệ 1b: A thêm ca vào `acc.test.ts` và `inv.test.ts` (B không sửa hai tệp này).
- Luồng B (mã sản phẩm): 2a, 2b, 3a, 4b, 5b, cộng sửa lỗi a11y/bảo mật do A phát hiện. Sở hữu `src/`, `vi.json`, `rpt.test.ts`, `import.test.ts`, `rec-orders.test.ts`, `platform.test.ts`, README, `status.md`. A không đụng `vi.json`/`status.md`; ca 1b cho `import.test.ts` giao cho B.
- Thứ tự đề xuất: B1 = 5b + 4b (nhỏ, độc lập) và A1 = 1c, 1e (phát hiện lỗi sớm) song song; B2 = 2a + 3a; A2 = 1a, 1b, 1f, 3b, 3c, 1d, 4a; cuối cùng B3 = sửa lỗi A báo, cập nhật `status.md`, rồi một lượt `pnpm run ci` trên PR. Nếu chỉ có một người: 5b, 4b, 2a, 3a rồi A.

## (d) Ảnh hưởng chỉ mục composite

Không mục nào thêm chỉ mục: 2a đọc rollup theo khóa, 3a đọc theo ảnh của lệnh, 5b đọc từ tài liệu lô, 4b không đọc dữ liệu. Giữ 193/200 (fail trên 195). Test hiệu năng 1a không được thêm query mới ngoài `queries.ts`. Nếu 1c hay 1f phát hiện truy vấn thiếu chỉ mục, báo lại, không tự thêm.

## (e) Lệnh kiểm tra từng luồng

- Luồng A (test): `pnpm check:fast origin/master` (typecheck, eslint/prettier, test liên quan); từng tệp: `pnpm exec firebase emulators:exec --only firestore,auth,storage --project demo-gmep "vitest run --project integration tests/integration/isolation-matrix.test.ts"` (và `perf-nfr`, `security-checklist`); riêng memory: `pnpm exec vitest run --project integration tests/integration/<tệp>`; e2e một spec: `pnpm build` rồi `pnpm exec firebase emulators:exec --only firestore,auth,storage --project demo-gmep "tsx --tsconfig tsconfig.json scripts/seed-emulator.ts && playwright test e2e/<tệp>.spec.ts"`; `pnpm check:indexes`.
- Luồng B (mã): `pnpm check:fast origin/master`; `pnpm exec vitest run --project unit tests/unit/rpt-reports.test.ts tests/unit/sys-import.test.ts`; integration một tệp như trên (`rpt`, `import`, `platform`, `rec-orders`); `pnpm check:boundaries`; `pnpm check:indexes` (phải vẫn 193); e2e một spec cho màn đã đổi (monthly, ảnh, nhập).
- Trước push: `pnpm check:fast origin/master`; còn `pnpm run ci` và `pnpm audit:prod` để PR chạy.

## Câu hỏi cho BA/chủ dự án (ghi để hỏi, chưa đoán)

- Q-A (RPT-002): so sánh với tháng liền trước hay cùng kỳ năm trước; trên cùng khoảng ngày hay cả tháng; chấp nhận quỹ/nợ tồn/chi không chia theo loại dịch vụ.
- Q-B (FR-ACC-005): định nghĩa khóa kỳ (tháng lịch hay cấu hình), ai khóa, điều kiện khóa, phạm vi chứng từ bị khóa, sửa sau khóa, quan hệ với xuất kỳ cho phần mềm kế toán; mở lại cần chủ garage + mật khẩu + lý do + hạn dùng (đã có mẫu ở mở lại ngày).
- Q-C (R97): khóa nhận diện khách trùng, bản ghi giữ lại, xử lý đồng ý/yêu cầu chủ dữ liệu/chủ xe, có hoàn tác được không.
- Q-D (R94): kích thước lô thật khi di chuyển (cần mẫu Excel R93); nếu quá 2.000 dòng thì cần xử lý nền.
- Q-E (NFR-PERF): xác nhận đo bằng số lần đọc trên emulator + k6 trên staging khi có GCP (không có số đo 4G trong CI).
