# Kế hoạch kiểm thử giai đoạn 1 (pilot một chi nhánh)

Bản nháp 05/11/2026. Căn cứ: `implementation-plan.md` §5 (chiến lược), §7 slice 1.12 (cổng pilot), `functional-requirements.md` §11 và §13 (NFR, phạm vi, UAT), `uat-coverage.md`, `security-checklist-status.md`, `stream-a-findings.md`, `plan-next-work.md`. Chưa chạy lại bộ test trong lượt này (cần Java cho emulator); số liệu "đã có" lấy từ các tài liệu trên, phải đối chiếu lại bằng `pnpm run ci` ở bước T0.

## 1. Mục tiêu và phạm vi

**Mục tiêu:** chứng minh cho khách rằng mọi FR Must của giai đoạn 1 chạy đúng trên dữ liệu thật của một chi nhánh, tiền và kho không sai lệch, dữ liệu chi nhánh và dữ liệu cá nhân được bảo vệ, và hệ thống đủ nhanh, đủ an toàn để chạy song song với Excel.

**Trong phạm vi:** REC (toàn bộ FR Must), CRM (001, 002, 004, 010, 011, 013, 014, 017), INV cơ bản (001, 002, 003, 005, 006, 007, 008, 019, 020, 021, 025, 027), EIN cơ bản (001 đến 006, 011, 013), SYS (toàn bộ Must, gồm 007 nhập Excel, 011 đến 013, 018), RPT một chi nhánh (001, 003, 004, 011 đến 014), ACC phần tiền thu, sổ quỹ, ca, chốt ngày (FR-ACC-004, 009).

**Ngoài phạm vi (không kiểm thử ở giai đoạn này):** HRM, PUR, chuyển kho và kiểm kê (UAT-04, 05, 11, 14, 16, 24, 26), báo cáo hợp nhất nhiều chi nhánh, MFA (chủ dự án hoãn), khóa kỳ tháng (chờ BA), gộp khách trùng (chờ BA). INS (UAT-15) chỉ thêm nếu khách xác nhận vào phạm vi.

## 2. Hiện trạng (tóm tắt)

- Đã có tự động trên emulator: đơn vị domain, use case, tích hợp (30 tệp `tests/integration`), e2e Playwright (21 tệp `e2e/`), ma trận cách ly sinh từ danh sách route, kiểm checklist bảo mật, hiệu năng hồi quy theo số lần đọc/ghi, axe, hành trình UAT-01, 03, 09.
- UAT trong phạm vi giai đoạn 1 có test: 01, 02, 03, 06, 07, 08, 09, 10, 12, 13, 17, 18, 19, 20, 23, 25 (ĐỦ); 21, 22 (MỘT PHẦN).
- Lỗi đang mở từ luồng kiểm thử: F-6 (hoàn tác lô nhập nhiều khách hỏng trên Firestore, **cao**), F-8 (hộp thoại xác nhận mất focus), F-7 (Sổ quỹ tràn 2 px ở 375 px), F-5 (khóa i18n sai), F-1 (đọc theo id chưa thu hẹp theo chi nhánh làm việc, cần BA), F-4 (thời gian chạy thử nhập tăng theo dữ liệu). F-3 đã sửa.
- Chưa làm và cần thiết bị hoặc hạ tầng thật: in thử máy thật, kiểm thử thâm nhập, diễn tập khôi phục, k6 trên staging, đào tạo, cutover, chạy song song.

## 3. Các tầng kiểm thử

| Tầng | Công cụ | Phủ | Ai | Khi nào | Tiêu chí đạt |
| --- | --- | --- | --- | --- | --- |
| T1 Đơn vị domain | Vitest, `fast-check` | Bảng chuyển trạng thái của 5 đối tượng (mọi cặp trạng thái × sự kiện), thuế, giá, giảm giá, công, giá vốn bình quân, giữ chỗ và khả dụng, làm tròn, chênh lệch quỹ | dev | mọi PR | 100% bảng chuyển; bộ ví dụ kế toán ký (§5) |
| T2 Use case | Vitest + bộ nhớ | Quy tắc, phê duyệt, tách nhiệm vụ lập và duyệt, RULE-005 đến 011 | dev | mọi PR | mỗi RULE có ít nhất một ca đạt và một ca bị chặn |
| T3 Tích hợp API và CSDL | Vitest + Firebase Emulator | Hợp đồng API (RFC 9457), giao dịch, nhật ký cùng giao dịch, `Idempotency-Key`, khóa lạc quan, đồng thời | dev | mọi PR | xanh trên cả bộ nhớ và emulator |
| T4 Cách ly và quyền | `isolation-matrix`, `security-checklist` | Mọi route đọc × (CN A, CN B, nhiều CN, chủ); 404 cho ngoài phạm vi; che SĐT/địa chỉ; "Hiện" có nhật ký; xuất cần quyền | dev | mọi PR | thêm route thiếu dòng ma trận thì CI đỏ |
| T5 E2E giao diện | Playwright (desktop 1440, tablet 768, điện thoại 375) | Hành trình theo vai trò (§6) | dev, QA | mọi PR hoặc hằng đêm | không lỗi JS, không tràn ngang, axe 0 lỗi nghiêm trọng |
| T6 Hợp đồng ngoài | `FakeProvider` chèn lỗi | Hóa đơn: bấm hai lần, timeout rồi tra cứu, lỗi dữ liệu, nhà cung cấp chậm; tin nhắn OTP và liên kết khách | dev | mọi PR | một hóa đơn duy nhất mỗi lệnh |
| T7 Firestore thật | Cùng bộ T3 trên staging | Chỉ mục (193/200, ngưỡng fail 195), tranh chấp thật, độ trễ | dev | hằng đêm từ khi có GCP | không thiếu chỉ mục, không 500 do khác biệt emulator (như F-6) |
| T8 Hiệu năng | `perf-nfr` (hồi quy), k6 trên staging | NFR-PERF-01 dưới 2 s p95 trên 4G, NFR-PERF-02 dashboard dưới 5 s | dev | hằng tuần, trước cổng | đạt ngưỡng ở §7 |
| T9 Truy cập và tương thích | `@axe-core/playwright`, bàn phím, tương phản theo token | WCAG 2.2 AA; Chrome, Edge, Safari mới; iPad, tablet Android | dev, QA | mọi PR; thiết bị thật ở T12 | F-8 và F-7 đã sửa |
| T10 Bảo mật | CodeQL, gitleaks, `pnpm audit:prod`, quét bundle, ZAP baseline, pentest độc lập | `security-checklist-status.md`, NFR-SEC-01 đến 03 | dev, đơn vị ngoài | SAST mọi PR; pentest trước pilot | không lỗi nghiêm trọng (NFR-SEC-02) |
| T11 Khôi phục | Diễn tập sao lưu | RPO ≤ 1 giờ, RTO ≤ 4 giờ (NFR-AVA-02, chờ xác nhận) | dev, vận hành | trước go-live | đạt RPO/RTO đã đo, có runbook |
| T12 Thiết bị thật | Thủ công tại chi nhánh | In A4, A5, khổ nhiệt (NFR-PRT-01), tablet thợ (tối đa 2 lần chạm, NFR-USA-01), mạng 4G | dev, chi nhánh | tuần trước pilot | mẫu in được khách ký, thao tác thợ đạt |
| T13 UAT | Kịch bản thủ công theo §6 | Nghiệm thu với khách | BA, khách | cổng pilot | mọi UAT Must đạt, khách ký |
| T14 Chạy song song | Excel + hệ thống ≥ 4 tuần | Đối chiếu hằng ngày | khách, dev | sau cutover | chỉ số ở §8 |

## 4. Ma trận phủ theo phân hệ (kiểm thử trọng tâm)

| Phân hệ | Rủi ro chính | Trọng tâm | Test hiện có | Việc còn thiếu |
| --- | --- | --- | --- | --- |
| REC | Sai trạng thái, hạng mục ngoài báo giá, mất bằng chứng duyệt | Năm bảng trạng thái riêng; duyệt một phần (UAT-17); phát sinh (UAT-03); giảm giá vượt hạn mức (UAT-22); tablet thợ bắt đầu/kết thúc; ảnh; QC; bàn giao | `rec*.test.ts`, `slice-1-5/6`, `uat-journeys` | Ca riêng "đổi bảng giá không đổi báo giá đã gửi" (UAT-22 vế 2); đồng sơn theo công đoạn (UAT-21) chờ khảo sát; kiểm tablet thật |
| CRM | Lộ dữ liệu cá nhân, đổi chủ xe làm mất lịch sử | Đồng ý, rút, yêu cầu xóa (UAT-10); đổi chủ (UAT-18); xuất cần quyền (UAT-20); cảnh báo trùng SĐT | `crm.test.ts`, `slice-1-3` | Quyết định F-1 với BA rồi thêm ca cho chủ |
| INV | Tồn âm, xuất không chứng từ, sai giá vốn | Bốn số tồn; UAT-02, 13, 25; chặn tồn âm; song song 24 yêu cầu; ADJ mở đầu kỳ; bảng giá | `inv.test.ts`, `inv-domain.test.ts`, `slice-1-4` | Ca giữ chỗ và xuất song song trên cùng lệnh; đối soát tồn sau kiểm kê khởi tạo (T14) |
| ACC | Sai số tiền, thu trùng, sửa ngày đã khóa | Phiếu thu, hoàn tiền, đảo phiếu (RULE-010), ca, chênh lệch quỹ, chốt ngày (UAT-07), mở lại ngày cần chủ nhập lại mật khẩu | `acc.test.ts`, `slice-1-7`, `acc-day-reopen-ui` | Thu song song khác key (tổng không vượt); đảo phiếu song song |
| EIN | Trùng hóa đơn, sai trạng thái nhà cung cấp | Phát hành idempotent (UAT-23), hóa đơn điều chỉnh cần KT trưởng (UAT-08), hủy cần mật khẩu, lưu XML/PDF | `ein.test.ts`, `slice-1-8` | Chạy lại toàn bộ với nhà cung cấp thật trên môi trường thử khi khách chọn (đang mở) |
| SYS | Lộ quyền, mất vết kiểm toán | 10 vai trò, nhiều vai trò (UAT-19), chọn phạm vi, đánh số, cấu hình hiệu lực (UAT-09), phê duyệt, nhật ký không sửa xóa, nhập Excel (UAT-12) | `auth`, `admin`, `config-admin`, `import*`, `audit-idempotency` | Sửa F-6 rồi chạy lại `import-undo-multirow` trên Firestore; ca "nhập lại mật khẩu khi đổi vai trò" |
| RPT | Số báo cáo lệch sổ | Đối chiếu đơn = tiền = hóa đơn = kho; drill-down; lọc loại dịch vụ; xuất theo phạm vi | `rpt.test.ts`, `uat-journeys` | So sánh kỳ trước (FR-RPT-002, R110 đến R114): `rpt-reports.test.ts` (tăng, giảm, kỳ trước thiếu ngày, chia 0 "mới", hai bên 0, tháng ngắn, làm tròn), `rpt.test.ts` (n/a có lý do, "mới", CSV hai khoảng ngày, kỳ tương lai, tham số lạ); hồi quy cột "đã xuất hóa đơn" khi lọc: `rpt.test.ts` |

## 5. Dữ liệu kiểm thử

1. **Seed ẩn danh** (`pnpm seed`): một chi nhánh, vài chục xe, lệnh đủ trạng thái, phụ tùng, 10 vai trò, `u_multi`. Không dùng dữ liệu khách thật trên dev.
2. **Khối lượng** (`tests/helpers/volume.ts`): 1 chi nhánh × ~5.000 khách/xe, 2.000 lệnh, 30 ngày rollup; mô phỏng thêm 8 chi nhánh cho dashboard hợp nhất.
3. **Bộ ví dụ kế toán ký** (`tests/fixtures/accounting/*.json`, có `signedOffBy`, `signedAt`): 12 nhóm ở `implementation-plan.md` §9.2 (thuế theo dòng và tổng, mốc 1/1/2027, giá gồm hoặc chưa gồm thuế, hạn mức giảm, công, giá vốn, giữ chỗ, duyệt một phần, tuổi nợ, chênh lệch quỹ, lợi nhuận gộp). **Hiện chỉ có số mẫu, chưa có chữ ký**; đây là việc chặn cổng (xem §9).
4. **Dữ liệu gần thật** từ Excel của khách, đã ẩn danh khi được phép, chỉ trên staging, cho diễn tập nhập (ít nhất hai lần) và tải.
5. **Tệp nhập mẫu** `tests/fixtures/import/` (csv, xlsx, tệp lỗi theo dòng, tệp trùng).

## 6. UAT giai đoạn 1 (cổng pilot)

Ưu tiên theo cổng: UAT-01 đến 03, 06 đến 10, 12, 13, 17 đến 20, 22, 23, 25 (theo §7 slice 1.12), thêm UAT-21 (một phần). Mỗi UAT chạy hai lần: bản tự động trên emulator (đã có) và bản thủ công với khách trên staging.

| UAT | Vai trò thực hiện | Dữ liệu và bước chính | Điều kiện đạt | Tự động | Thủ công với khách |
| --- | --- | --- | --- | --- | --- |
| 01 | CV, TK, thợ, TQ, KT | Nhận xe, báo giá, duyệt, làm, QC, thu, hóa đơn, giao | Công, phụ tùng, tiền, hóa đơn khớp trên báo cáo đối chiếu | ĐỦ | cần |
| 02 | Thủ kho | Thử xuất ngoài lệnh, bán lẻ, điều chuyển | Bị chặn | ĐỦ | cần |
| 03 | CV, thợ, khách (liên kết) | Thêm phát sinh khi chưa duyệt | Thợ không bắt đầu; có bằng chứng duyệt | ĐỦ | cần |
| 06 | Tài khoản CN A và B | Danh sách, tìm kiếm, báo cáo, xuất, tệp | A không thấy B | ĐỦ | cần (cần 2 chi nhánh trên staging) |
| 07 | TQ, QL, chủ | Ca, chênh lệch, chốt, sửa ngày khóa, mở lại | Không chốt khi còn chênh lệch chưa giải trình | ĐỦ | cần |
| 08 | KT, KT trưởng | Hóa đơn điều chỉnh | Cần KT trưởng, liên kết hóa đơn gốc | ĐỦ | cần (khi có nhà cung cấp) |
| 09 | Chủ, KT | Đổi thuế theo ngày hiệu lực | Áp mức mới sau ngày, không sửa mã | ĐỦ (số mẫu) | cần **số kế toán ký** |
| 10 | CV, chủ | Đồng ý, rút, yêu cầu xóa | Có nhật ký | ĐỦ | cần |
| 12 | Quản trị, chủ | Nhập Excel thật của khách | Lỗi theo dòng, không ghi một phần, hoàn tác theo lô | ĐỦ (API), F-6 mở | cần, sau khi sửa F-6 |
| 13 | Thủ kho, CV | 20, giữ 5, thấy 15; hủy nhả | Đúng số | ĐỦ | cần |
| 17 | CV, khách | 4.550.000 duyệt 2.050.000 | Má phanh vào bị từ chối, ghi đủ phiên bản | ĐỦ | cần |
| 18 | CV | Đổi chủ xe | Lịch sử giữ nguyên | ĐỦ | cần |
| 19 | `u_multi` | Thủ kho + thu ngân | Đủ hai vai, không hơn | ĐỦ theo tên test | cần rà từng ca (xem T4) |
| 20 | Vai trò không có quyền | Xuất danh sách khách | Không tải được | ĐỦ | cần |
| 21 | CV, thợ | Đồng sơn theo công đoạn | Hiện công đoạn, người, ngày dự kiến | MỘT PHẦN | chờ khảo sát |
| 22 | CV, QL | Giảm vượt hạn mức; đổi bảng giá | Chặn đến khi duyệt; báo giá đã gửi không đổi | MỘT PHẦN | cần, thêm ca đổi giá |
| 23 | TQ, KT | Bấm hai lần, timeout rồi thử lại | Một hóa đơn | ĐỦ | cần (nhà cung cấp thật) |
| 25 | KT, thủ kho | 10 × 100.000 + 20 × 120.000 | ≈ 113.333 | ĐỦ | cần số ký |

Quy trình UAT: BA soạn kịch bản từng bước kèm dữ liệu → dev dựng dữ liệu trên staging → khách thực hiện, BA ghi kết quả → lỗi theo mục §10 → chạy lại → khách ký biên bản từng UAT.

## 7. Phi chức năng

| Mã | Phép đo | Ngưỡng | Cách đo | Trạng thái |
| --- | --- | --- | --- | --- |
| NFR-PERF-01 | p95 tiếp nhận, báo giá, tìm phụ tùng, danh sách, thu tiền | dưới 2 s trên 4G | k6 trên staging với 5.000 khách/xe, 2.000 lệnh; kèm đếm số lần đọc/ghi tài liệu (tiêu chí chính trên emulator) | hồi quy có; k6 chưa |
| NFR-PERF-02 | Dashboard hợp nhất, dữ liệu một năm | dưới 5 s | k6, 8 chi nhánh mô phỏng | hồi quy có; k6 chưa |
| F-4 / R94 | Ghi lô nhập 2.000 dòng | dưới ~60 s | đo trên staging; nếu vượt thì xem xét xử lý nền | cần số đo thật |
| NFR-USA-01 | Thợ bắt đầu/kết thúc hạng mục | tối đa 2 lần chạm | e2e tablet 768 + thử tại chi nhánh | e2e có; thiết bị thật chưa |
| NFR-USA-02 | Báo giá hạng mục thường gặp | dưới 15 phút (BRD) | đo ở pilot | chưa |
| NFR-AVA-01/02 | Khả dụng giờ làm việc; RPO, RTO | 99,5%; 1 giờ, 4 giờ | giám sát + diễn tập khôi phục | chưa |
| NFR-SEC-01 đến 03 | TLS, băm mật khẩu, che dữ liệu cá nhân | theo checklist | T4, T10 | một phần |
| NFR-ISO-01 | Cách ly chi nhánh | không rò | T4 | có |
| NFR-COM-01 | Trình duyệt, thiết bị, in | Chrome, Edge, Safari; iPad, Android; A4, A5, nhiệt | T9, T12 | chưa |
| NFR-MNT-01 | Công thức có ví dụ kế toán ký | mọi công thức | §5 mục 3 | thiếu chữ ký |

## 8. Cổng vào, cổng ra, chỉ số pilot

**Cổng vào UAT** (tất cả đạt mới bắt đầu): `pnpm run ci` xanh (lint, kiểu, ranh giới, bundle, đơn vị, tích hợp, chỉ mục, e2e); T7 xanh trên Firestore thật; F-6 và F-8 đã sửa; bộ ví dụ kế toán đã ký; môi trường staging và dữ liệu UAT sẵn sàng; không có lỗi mức cao hoặc nghiêm trọng đang mở.

**Cổng ra giai đoạn 1** (theo `implementation-plan.md` §7 slice 1.12, FRD §13):

1. Mọi FR Must giai đoạn 1 đạt UAT tương ứng, khách ký biên bản.
2. Chạy song song với Excel ít nhất 4 tuần và đạt chỉ số BRD §3 cho một chi nhánh: đối chiếu số liệu với Excel, truy vết xuất kho 100%, thời gian nhận xe đến báo giá, thời gian chốt ngày, hóa đơn đúng hạn.
3. Báo cáo "xuất kho không chứng từ" bằng 0.
4. Pentest độc lập không còn lỗi nghiêm trọng (NFR-SEC-02).
5. Diễn tập khôi phục đạt RTO/RPO đã đo.
6. Không có sai lệch tồn kho chưa giải thích sau kiểm kê khởi tạo.
7. Mẫu in đã được khách ký trên máy in thật; tablet thợ đạt 2 lần chạm.

## 9. Việc phải làm, theo thứ tự (kế hoạch thực hiện)

| # | Việc | Phụ thuộc | Ước lượng | Người |
| --- | --- | --- | --- | --- |
| T0 | Chạy `pnpm run ci` và `pnpm e2e` đầu tuần để lấy đường cơ sở; cập nhật `uat-coverage.md` và `status.md` nếu lệch | Java, Chromium | N | dev |
| T1 | Sửa F-6 (hoàn tác lô nhập nhiều khách trên Firestore), F-8 (ConfirmDialog), F-7 (Sổ quỹ 375 px), F-5 (khóa i18n); chạy lại test đỏ | none | V | dev |
| T2 | Bổ sung ca còn hở: giữ chỗ và xuất song song trên cùng lệnh; thu và đảo phiếu song song; UAT-22 vế đổi bảng giá; UAT-19 rà từng ca; đổi vai trò cần nhập lại mật khẩu | none | V | dev |
| T3 | Chốt F-1 với BA (đọc theo id khi người toàn công ty đã chọn chi nhánh), rồi thêm ca ma trận cho chủ | BA | N | BA, dev |
| T4 | Kế toán ký bộ ví dụ §9.2, gồm mốc 1/1/2027; cập nhật fixtures có `signedOffBy` | khách | V (phía khách) | BA, khách |
| T5 | Dựng staging GCP (`gcp-setup-runbook.md`), chạy T7 hằng đêm, theo dõi ngân sách chỉ mục | GCP | L | dev |
| T6 | k6 trên staging: kịch bản tiếp nhận, báo giá, tìm phụ tùng, thu tiền, dashboard; đo lô nhập 2.000 dòng | T5 | V | dev |
| T7 | Diễn tập nhập Excel ≥ 2 lần với dữ liệu gần thật; báo cáo đối chiếu (số mã, khách, xe, mẫu ngẫu nhiên) | T5, mẫu Excel | V | dev, khách |
| T8 | Kiểm thử thâm nhập độc lập; sửa lỗi nghiêm trọng; chạy lại ZAP baseline | T5 | L | đơn vị ngoài |
| T9 | Diễn tập khôi phục sao lưu, đo RPO/RTO, viết runbook | T5 | V | dev, vận hành |
| T10 | In thử trên máy in thật (A4, A5, nhiệt), thử tablet thợ, thử mạng 4G tại chi nhánh | thiết bị | V | dev, chi nhánh |
| T11 | UAT thủ công với khách theo §6 trên staging, ký biên bản từng UAT | T1 đến T4 | L | BA, khách |
| T12 | Đào tạo, kiểm kê khởi tạo, nhập tồn đầu kỳ bằng ADJ mở đầu, cutover | T7, T11 | L | khách, dev |
| T13 | Hypercare và chạy song song ≥ 4 tuần, đối chiếu hằng ngày theo §8 | T12 | L | khách, dev |

T1 đến T3 làm được ngay trong repo; T4 và nhập dữ liệu thật phụ thuộc khách; T5 trở đi cần hạ tầng.

## 10. Quản lý lỗi

| Mức | Định nghĩa | Xử lý |
| --- | --- | --- |
| Nghiêm trọng | Sai tiền, tồn, hóa đơn; rò dữ liệu chi nhánh hoặc cá nhân; mất dữ liệu | Chặn cổng; sửa trong ngày; có test hồi quy trước khi đóng |
| Cao | Chức năng Must không dùng được, có cách làm tạm | Phải sửa trước UAT |
| Trung bình | Sai giao diện, truy cập, thông báo | Sửa trước pilot |
| Thấp | Thẩm mỹ, tối ưu | Theo dõi, không chặn |

Mọi lỗi sửa phải kèm test tái hiện (tên test chứa mã FR hoặc RULE); không bỏ qua hoặc làm yếu test để đạt cổng. Lỗi do khác biệt giữa emulator và Firestore thật (như F-6) bắt buộc có test chạy trên Firestore.

## 11. Rủi ro và quyết định đang mở ảnh hưởng kế hoạch

| Rủi ro | Ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Chưa có dự án GCP | T7, T8, T9 không làm được; k6 và pentest chậm | Dựng staging sớm nhất có thể; đây là đường găng |
| Kế toán chưa ký ví dụ | NFR-MNT-01 và cổng ra không đạt; UAT-09, 25 chỉ là số mẫu | Đưa vào lịch với khách ngay |
| Nhà cung cấp hóa đơn chưa chọn | UAT-08, 23 chỉ chứng minh với `FakeProvider` | Giữ lớp tích hợp trung lập; chạy lại hợp đồng khi có môi trường thử |
| Mốc thuế 1/1/2027 rơi vào thời gian pilot (P-05) | Tính sai thuế sau mốc | Test ví dụ ký cho lệnh vắt qua mốc, chạy lại trước 1/1/2027 |
| Mẫu và máy in chưa chốt (NFR-PRT-01, COM-01) | Không nghiệm thu in | Chốt thiết bị trước T10 |
| Lệch chỉ mục 193/200 | Khó thêm truy vấn mới khi sửa lỗi | Không thêm chỉ mục ở giai đoạn 1; xin gỡ trước khi thêm |
| Dữ liệu Excel bẩn | Nhập chậm, đối soát lệch | Diễn tập nhập ≥ 2 lần, quy tắc làm sạch |
| Đồng sơn chưa khảo sát | UAT-21 chỉ một phần | Khảo sát trước hoặc chấp nhận phạm vi một phần ở pilot |
| Các mục `[Cần xác nhận]` trong FRD | Dễ cứng hóa giả định | Không viết test chốt giá trị cho các mục mở; dùng cấu hình |

## 12. Báo cáo và theo dõi

- Bảng ánh xạ UAT → test: `uat-coverage.md` (cập nhật sau mỗi đợt).
- Checklist bảo mật: `security-checklist-status.md`.
- Phát hiện kiểm thử: `stream-a-findings.md`.
- Số đo hiệu năng: `PERF_REPORT=<tệp> pnpm test:integration` và kết quả k6.
- Báo cáo hằng tuần trong giai đoạn cổng: số test, UAT đạt/chưa, lỗi mở theo mức, rủi ro mới.
