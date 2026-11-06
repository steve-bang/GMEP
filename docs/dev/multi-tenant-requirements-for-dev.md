# Multi-tenant: yêu cầu bàn giao cho dev

- **Người lập:** BA · **Ngày:** 06/11/2026 · **Trạng thái:** bàn giao, chờ chủ dự án xác nhận các mã FR/RULE (bản mã đã nhập vào BRD/FRD ngày 06/11/2026).
- **Đọc cái gì:** tài liệu này là bản ngắn. Nguồn đầy đủ: `docs/multi-tenant-analysis.md` (mục "Quyết định hiện hành" ở đầu), FRD mục 10A, BRD mục 6, `docs/multi-tenant-open-questions.md`. Không cần đọc 1.000 dòng analysis để bắt đầu MT-0.
- **Ranh giới:** BA chỉ nêu ràng buộc nghiệp vụ. **Không chọn công nghệ**: mô hình cô lập (A/B/C của ADR 0002 §3), cách định danh, cách cấp phát trên Firebase/GCP do dev đề xuất trong ADR 0002 chính thức. Nơi nào dưới đây có tên hàm hay thành phần hiện có (`resolveScope`, `DocStore`, `queries.ts`) là để chỉ chỗ ràng buộc áp vào, không phải chỉ định cách làm.

## 1. Quyết định hiện hành

| Mã | Quyết định | Nguồn |
| --- | --- | --- |
| D1 | Multi-tenant là yêu cầu thiết kế **từ đầu**, không còn "tương lai, không build" | Khách/chủ dự án, 05/11/2026 |
| D2 | Chủ garage khác **tự đăng ký, tự triển khai** (nhân viên trong tenant vẫn chỉ vào bằng lời mời) | như trên |
| D3 | Có **gói dịch vụ thu tiền**, làm sau theo phase | như trên |

Mô hình thương mại: SaaS dùng chung (S1). Mọi thứ khác (cách cô lập, định danh, đợt, FR cụ thể) là **đề xuất BA chờ xác nhận**, đặc biệt: bản tối giản đăng ký (QĐT-S, FR-TEN-051 đến 055, RULE-033, 034) và feedback 06/11 (QĐT-S01 đến S09). Không hard-code đáp án cho câu `[Cần xác nhận]`; đưa vào cấu hình hoặc cổng/port.

Phân cấp: **Platform → Tenant → Company (pháp nhân) → Branch → Warehouse**. `Company` giữ nghĩa pháp nhân trong tenant (FR-SYS-018), không còn là "ranh giới ngoài cùng". CLAUDE.md đã sửa theo.

## 2. Phạm vi MT-0: làm ngay (thuộc Phase 1, nền không được chặn)

MT-0 gồm 14 FR; chưa có giao diện tự phục vụ. Tenant số 1 là một tenant thật.

| FR | Nội dung rút gọn | Ghi chú cho dev |
| --- | --- | --- |
| FR-TEN-001 | Hồ sơ tenant: mã bất biến, trạng thái, gói, tham chiếu hợp đồng; không xóa | Có chỗ lưu gói và trạng thái thuê bao ngay (B0), chưa tính tiền |
| FR-TEN-002 | Cấp phát theo checklist, **chạy lại không tạo bản trùng**, lỗi giữa chừng thử lại từng bước | Lõi dùng chung cho cấp phát thủ công (MT-0) và tự động (MT-1, FR-TEN-042) |
| FR-TEN-003 | Vòng đời tenant (13 trạng thái, mục 5 analysis): người làm, người duyệt, lý do, thời điểm | Đủ trạng thái trong mô hình dù chưa có UI; chuyển trái quy tắc bị chặn |
| FR-TEN-009 | Cô lập tuyệt đối: danh sách, tìm kiếm, báo cáo, xuất, API, tệp, URL ký, thông báo, tác vụ nền, nhật ký | Bản ghi ngoài tenant trả "không tìm thấy" (cùng mã với bản ghi không tồn tại) |
| FR-TEN-010 | Tenant của yêu cầu/phiên do **hệ thống xác định**, không do dữ liệu người dùng gửi lên | Sửa header, tham số, đường dẫn không đọc/ghi được tenant khác |
| FR-TEN-011 | Vai trò nền tảng tách khỏi 10 vai trò tenant; không vai trò nền tảng nào mặc định xem dữ liệu nghiệp vụ; không tài khoản nào vừa nền tảng vừa tenant | Ma trận ở FRD §2 |
| FR-TEN-013 | Nhật ký nền tảng bất biến, tách khỏi nhật ký tenant | Không chứa dữ liệu cá nhân của khách tenant |
| FR-TEN-014 | Bộ kiểm thử cách ly **có trục tenant**, tự động; lỗi rò rỉ chặn phát hành | Mở rộng `isolation-matrix.test.ts` |
| FR-TEN-016 | Xác định tenant khi đăng nhập không mơ hồ; **không giả định email hay mã nhân viên duy nhất toàn nền tảng**; lỗi trung lập | Phụ thuộc Q4/Q25/C-S14; chưa quyết thì cứ không giả định |
| FR-TEN-018 | Cấu hình phân tầng nền tảng, tenant, Company, Branch, hiệu lực theo ngày, hiển thị nguồn giá trị | Chứng từ đã phát hành giữ giá trị cũ (RULE-019) |
| FR-TEN-020 | Đánh số, mã chi nhánh, mã nhân viên, mã khách **duy nhất trong tenant**; khóa dãy số chứa tenant; hai tenant được trùng số | Làm rõ FR-REC-030 |
| FR-TEN-021 | Cấu hình tích hợp (hóa đơn, SMS/Zalo), bí mật, chứng thư **theo tenant và Company**; không dùng chung | Chưa cấu hình thì "Chưa kích hoạt"; `fake` bị từ chối ở `live` |
| FR-TEN-029 | Nhập Excel theo tenant (lô, lỗi, hoàn tác thuộc tenant) | Mở rộng slice 1.11 |
| FR-TEN-031 | Đưa dữ liệu hiện có thành **tenant số 1**: giữ số chứng từ, hóa đơn, khóa chống trùng, nhật ký; có kế hoạch quay lui; đối chiếu trước/sau | Hiện chỉ trên Emulator, chưa dữ liệu thật: **chi phí thấp nhất là bây giờ** (R-TEN-09) |

Cộng phần B0 của FR-TEN-028 (chỗ lưu gói và trạng thái thuê bao). Đăng nhập tạm theo "một tài khoản một tenant" nếu Q4 chưa quyết, nhưng không được buộc email duy nhất toàn nền tảng.

**Quy tắc làm việc ngay từ bây giờ (chưa chờ ADR):** không viết slice mới theo kiểu một tenant. Không hard-code một công ty; mã định danh, đường dẫn, khóa idempotency, khóa đánh số có chỗ cho tenant.

## 3. Chưa làm, nhưng thiết kế không được chặn

| Đợt | Nội dung | Hook cần có từ MT-0 |
| --- | --- | --- |
| MT-1 Tự phục vụ có kiểm soát (21 FR: 004 đến 007, 012, 015, 019, 030, 034, 036, 037, 039 đến 043, 051 đến 055) | Tự đăng ký, xác minh MST, chống lạm dụng, cấp phát tự động, onboarding hai màn + checklist, điều khoản/DPA, hạn chế/tạm ngưng/chấm dứt/xuất/xóa, hỗ trợ, khôi phục theo tenant | Trạng thái `signup_pending`/`rejected`; cấp phát gọi được không cần người; tenant chưa xác minh bị hạn chế ở lớp phát hành hóa đơn và gửi tin hàng loạt (RULE-028) |
| MT-2 Gói và dùng thử (14 FR) | Danh mục gói, trial, quota, bật/tắt module, feature flag, đo mức dùng, bảng kê | Chỗ lưu gói/thuê bao; **một điểm kiểm tra hạn mức và tính năng, mặc định cho phép**; sự kiện sử dụng đếm được theo tenant |
| MT-3 Thu tiền (6 FR) | Thanh toán gói, hóa đơn của nền tảng, dunning, người dùng nhiều tenant, tên miền, benchmark | `restricted`/`suspended` thực thi ở lớp truy cập; thông tin người mua của tenant đã xác minh; số liệu tiền nền tảng tách khỏi sổ tenant; không buộc email duy nhất |

Điều kiện mở đăng ký cho người ngoài và điều kiện thu tiền: xem `multi-tenant-open-questions.md` mục 4 và 5. Thứ tự MT-1 so với pilot là Q37 (chủ dự án chưa quyết).

## 4. Ràng buộc nghiệp vụ lên các lớp nền

Mỗi dòng: ràng buộc (RULE/FR) và điều kiện kiểm thử. Cách làm do dev quyết.

| Lớp | Ràng buộc | Kiểm thử |
| --- | --- | --- |
| **Scope / `resolveScope`** | `tenantId` là lớp **ngoài cùng**, do hệ thống suy ra từ phiên, không từ dữ liệu client (FR-TEN-010). Scope chi nhánh (NFR-ISO-01) giữ nguyên bên trong tenant. Mọi quyết định cô lập vẫn tập trung ở đây | Ma trận cô lập chéo tenant (mục 7) |
| **Repository, `DocStore`, `queries.ts`** | Mọi đọc/ghi mang tenant; không có truy vấn "toàn nền tảng" trên dữ liệu nghiệp vụ (RULE-017); mọi hình truy vấn đăng ký trong `queries.ts` kể cả khi đổi mô hình. Danh sách/tìm kiếm/xuất không trả bản ghi tenant khác | Kiểm thử từng route sinh từ danh sách route, thêm trục tenant |
| **Đánh số** | Số chứng từ, mã, khóa chống trùng duy nhất **trong tenant**, không có bộ đếm toàn nền tảng; hai tenant trùng số được phép (RULE-018). Dãy số theo (tenant, phạm vi cấu hình, loại, kỳ); phạm vi chi nhánh hay pháp nhân chờ K2 | Hai tenant phát hành số đầu tiên cùng lúc không xung đột |
| **Cấu hình có hiệu lực theo ngày** | Bốn tầng nền tảng, tenant, Company, Branch; tầng dưới ghi đè tầng trên; ghi nguồn giá trị; đổi cấu hình **không sửa chứng từ đã phát hành** (RULE-019). Danh mục pháp lý (thuế suất, chu kỳ đăng kiểm) do nền tảng phát hành (FR-TEN-019, chờ Q16) | UAT-TEN-08 (mở rộng UAT-09) |
| **Lưu trữ tệp, URL ký** | Đường dẫn và URL ký kiểm tenant **trước khi cấp** (ADR 0001 §7.3); không dùng tên tệp đoán được, ID tuần tự dùng chung | Tenant A không tải được tệp tenant B kể cả khi biết đường dẫn |
| **Audit** | Hai luồng bất biến: nhật ký tenant (FR-SYS-003) và **nhật ký nền tảng** (FR-TEN-013); nhật ký truy cập dữ liệu cá nhân tách theo tenant; khi nhân sự nền tảng "Hiện" dữ liệu che trong phiên hỗ trợ, ghi danh tính nhân sự nền tảng | Nhật ký tenant A không chứa thao tác nền tảng nhạy cảm của tenant B |
| **Idempotency, đặc biệt hóa đơn** | Khóa `Idempotency-Key` và khóa chống phát hành trùng hóa đơn (FR-EIN-013, UAT-23) **chứa tenant** và **không hết hạn**, bền qua mọi trạng thái vòng đời (kể cả `suspended`, kể cả khi chuyển dữ liệu thành tenant số 1: M7). Tác vụ đồng bộ trạng thái hóa đơn vẫn chạy khi tenant bị ngưng, không phát hành mới. Cấp phát tenant cũng idempotent (FR-TEN-002, 042). Mọi thao tác tiền nền tảng–tenant idempotent (RULE-031, MT-3) | Gửi hai lần cùng khóa trên hai tenant khác nhau: hai kết quả độc lập; cấp phát lặp không tạo tenant thứ hai |
| **Phiên, đăng nhập** | Mỗi phiên thuộc **đúng một tenant** (RULE-026); thu hồi tư cách ở A không ảnh hưởng B; lỗi đăng nhập trung lập, cùng mã trạng thái và thời gian phản hồi trong dung sai (không lộ tài khoản, công ty). Cookie `__Host-` giữ nguyên | UAT-TEN-07, 21 |
| **Tích hợp ngoài** | Nhà cung cấp hóa đơn, SMS/Zalo, khóa, chứng thư số, khóa API **của từng tenant (và Company)** (RULE-024); hóa đơn của tenant mang đơn vị phát hành của tenant, nền tảng không phát hành thay (RULE-025) | UAT-TEN-09 |
| **Tác vụ nền, hàng đợi, thông báo** | Chạy **theo tenant**; lỗi hoặc tải nặng của tenant này không chặn tenant khác (FR-TEN-015); thông báo không gửi nhầm tenant. `CRON_COMPANY_ID` phải được xử lý (M1) | UAT-TEN-12 |
| **Seed, dữ liệu kiểm thử** | Không giả định một tenant; có từ **hai tenant trở lên** (NFR-TEN-01) | Điều kiện phát hành |
| **Ẩn giao diện chi nhánh/kho** (bản tối giản) | Chỉ ẩn UI; mọi bản ghi vẫn có `branch_id`, `resolveScope` vẫn chạy (RULE-033). UI nhiều chi nhánh hiện khi có từ 2 chi nhánh hoạt động | UAT-TEN-20 |

## 5. Tác động chỉ mục (193/200, ngưỡng fail 195)

- **Số liệu thực đo** (`docs/dev/index-budget.md`): 193 composite, 194 hình truy vấn, 0 mồ côi, 0 trùng tiền tố; còn 2 chỗ trước ngưỡng fail. Chính sách hiện hành: Phase 1 không thêm chỉ mục; Phase 2 muốn thêm phải gỡ; **không xin nâng trần** (BA trả lời câu 40).
- **Quan sát của BA, dev kiểm chứng:** nhiều chỉ mục đã chứa `companyId` (ví dụ `cashEntries`: branchId, businessDate, companyId, seqKey) và `companyId` xuất hiện 929 lần trong 127 tệp của `src/`. Nếu tenant tương ứng với `companyId` hiện có thì số chỉ mục có thể không đổi; nếu `tenantId` là trường mới, mỗi chỉ mục cần thêm trường (việc xây lại, chưa chắc tăng số lượng). Với mô hình tách theo cơ sở dữ liệu hoặc dự án thì ngân sách tính riêng từng nơi. **Đây là giả thuyết, không phải kết luận; dev đo.**
- **Ràng buộc nghiệp vụ:** không phương án nào được làm `pnpm check:indexes` fail; mọi hình truy vấn mới (MT-0: hồ sơ tenant, nhật ký nền tảng, hàng chờ xác minh ở MT-1) phải dùng lại hình sẵn có, đọc theo khóa, lọc trong bộ nhớ trên tập có giới hạn hoặc phi chuẩn hóa (chính sách mục 1 của `index-budget.md`).
- Việc cần làm: cập nhật `index-budget.md` với phương án đã chọn; thêm slice MT-0 vào `implementation-plan.md` §7 và `status.md` (M13).

## 6. Yêu cầu theo module

| Module | Tác động |
| --- | --- |
| SYS | Chịu tác động chính: phạm vi, vai trò nền tảng, cấu hình phân tầng, đánh số, audit tách, sao lưu/khôi phục theo tenant (FR-TEN-034, MT-1), khóa API theo tenant (FR-SYS-017), nhập Excel theo tenant (FR-SYS-007), lời mời và phiên theo tenant. FR-SYS-002, 005, 006, 007, 010, 011, 012, 017, 018 nay hiểu "trong phạm vi một tenant" (FRD 10A) |
| REC | Mã lệnh (RULE-002, FR-REC-030) duy nhất **trong tenant**; mẫu in và thông báo theo tenant; workflow không đổi |
| INS | Ảnh/video là dữ liệu cá nhân: đường dẫn và URL ký theo tenant; quota dung lượng (MT-2). Chưa build |
| CRM | Khách và xe **không chia sẻ** giữa tenant kể cả cùng biển số; phép chiếu xuyên chi nhánh (FR-CRM-004) chỉ trong tenant; đồng ý liên hệ theo tenant |
| INV | Danh mục, bảng giá, kho theo tenant; chuyển kho chỉ trong tenant |
| PUR | Danh bạ nhà cung cấp là dữ liệu của tenant, không dùng chung |
| HRM | Hồ sơ nhân viên theo tenant; mã nhân viên duy nhất trong tenant; chính sách xóa khi nghỉ việc theo tenant |
| ACC | Kỳ kế toán, đóng sổ, hạn mức chi, phê duyệt theo tenant/Company; xuất dữ liệu kế toán theo tenant. Tiền nền tảng–tenant (MT-3) tách khỏi sổ tenant |
| EIN | Nhà cung cấp, bí mật, chứng thư, mẫu số, ký hiệu theo tenant và Company; khóa chống trùng không hết hạn; tenant chưa xác minh chỉ chạy `fake`; bản in/PDF `fake` mang dấu "BẢN THỬ" (đề xuất C-S22) |
| RPT | Báo cáo hợp nhất vẫn trong tenant; báo cáo nền tảng (FR-TEN-033, MT-2) chỉ số tổng hợp, không đào sâu tới bản ghi (RULE-017) |
| Tất cả module đã build (slice 0.3, 1.1 đến 1.9, 1.11) | Retrofit phạm vi theo FR-TEN-009, 010, 018, 020, 029, 031. Slice 1.10 (INS) và Phase 2+ viết theo kiểu có tenant ngay từ đầu |

## 7. Tiêu chí đánh giá phương án cô lập (BA nêu, dev đánh giá, không chọn thay)

ADR 0002 chính thức nên cho thấy phương án đề xuất đạt bảy tiêu chí nghiệp vụ dưới đây (kèm bằng chứng đo hoặc spike):

1. Không rò rỉ chéo tenant và **chứng minh được** bằng ma trận kiểm thử (RULE-016, 017; FR-TEN-009, 014).
2. Xuất, xóa, khôi phục **riêng một tenant** (FR-TEN-006, 007, 034; RULE-020).
3. Chi phí cố định mỗi tenant nhỏ, kể cả chưa trả tiền, gần 0 (R-TEN-07).
4. Cấp phát tự động, idempotent, không bước thủ công, vài phút (FR-TEN-002, 042; NFR-TEN-05).
5. Hiệu năng công bằng: tenant nặng không kéo tenant khác quá ngưỡng NFR-PERF-01, 02 (FR-TEN-015; NFR-TEN-02).
6. Trong ngân sách chỉ mục, không nâng trần (mục 5).
7. Có thể chuyển một tenant ra riêng sau này nếu hợp đồng đòi tách vật lý (Q3, hạng "khách lớn").

Tin cậy giữa tenant là tin cậy giữa **người lạ** (khác với một chuỗi nội bộ): mọi lỗi lọc là sự cố dữ liệu cá nhân của người ngoài (R-TEN-02).

## 8. Acceptance criteria kiểm thử được

### 8.1 UAT-TEN (chi tiết ở FRD mục 13; tóm tắt cho MT-0)

| Mã | Điều kiện đạt, rút gọn | FR |
| --- | --- | --- |
| UAT-TEN-01 | Cấp phát lặp không tạo trùng; lỗi giữa chừng thử lại hoàn tất; thiếu mục kích hoạt thì chặn; hóa đơn thật bị chặn khi tenant chưa đủ điều kiện | FR-TEN-001, 002, 004, 030, 037 |
| UAT-TEN-02 | Chuyển trạng thái trái quy tắc bị chặn; thiếu lý do hoặc người duyệt bị từ chối; có nhật ký nền tảng | FR-TEN-003, 008, 013 |
| UAT-TEN-05 | Tài khoản tenant A không thấy, không tìm thấy, không tải, không xuất được dữ liệu tenant B ở **mọi kênh**; sửa tham số không vượt được | FR-TEN-009, 010, 014 |
| UAT-TEN-06 | Nhân sự nền tảng không xem dữ liệu nghiệp vụ ngoài phiên hỗ trợ | FR-TEN-011, 012 |
| UAT-TEN-07 | Cùng email hoặc mã nhân viên ở hai tenant vào đúng tenant; lỗi trung lập; thu hồi ở A không ảnh hưởng B | FR-TEN-016 |
| UAT-TEN-08 | Hai tenant phát hành cùng số đầu tiên không xung đột; đổi thuế suất áp theo hiệu lực, chứng từ cũ không đổi | FR-TEN-018, 019, 020 |
| UAT-TEN-09 | Hóa đơn mang đúng đơn vị phát hành; không dùng bí mật tenant khác | FR-TEN-021 |
| UAT-TEN-11 | Lô nhập Excel tách theo tenant; số bản ghi và tổng tiền trước/sau di chuyển tenant số 1 khớp; không đổi số chứng từ; không hóa đơn trùng | FR-TEN-029, 031 |
| UAT-TEN-20, 21, 22 | Mới (06/11/2026): một chi nhánh một kho và ẩn UI theo số lượng; đăng nhập email + mật khẩu, chọn công ty, liên kết một lần; kênh hỗ trợ và tên thương hiệu cấu hình | FR-TEN-016, 051, 053, 054, 055 |

Còn lại (UAT-TEN-03, 04, 10, 12 đến 19) thuộc MT-1 đến MT-3, xem FRD.

### 8.2 Ma trận cô lập chéo tenant

Mở rộng `isolation-matrix.test.ts` (hiện: sinh từ danh sách route, 2 chi nhánh, CRM/REC/ACC/EIN/INV/SYS/RPT, xuất) thêm trục tenant. Tối thiểu:

| Trục | Giá trị |
| --- | --- |
| Tenant | A, B (ít nhất hai; seed cả hai); có ca "tenant mới đăng ký" khi MT-1 |
| Vai trò | 10 vai trò tenant (kể cả CH, AD) + từng vai trò nền tảng |
| Kênh | danh sách, tìm kiếm (cả tìm toàn cục), chi tiết theo ID, báo cáo, dashboard, **xuất** (CSV/xlsx, tên tệp), API ngoài (khóa API), tệp và URL ký, thông báo, tác vụ nền/hàng đợi, nhật ký, nhập Excel (lô, hoàn tác) |
| Thao tác | đọc, ghi, sửa tham số/tiêu đề/đường dẫn để trỏ sang tenant khác, đoán ID, dùng khóa idempotency của tenant khác |
| Kết quả mong đợi | "Không tìm thấy" cùng mã và cùng dạng phản hồi như bản ghi không tồn tại; không lộ tên/số lượng tenant khác; lỗi đăng nhập trung lập |

Lỗi rò rỉ chặn phát hành và chặn kích hoạt tenant mới (FR-TEN-014). Tenant độc hại tự đăng ký rồi thử đọc, ghi, đoán định danh: điều kiện mở đăng ký (NFR-TEN-08, UAT-TEN-14), bổ sung vào thử xâm nhập slice 1.12 (chưa làm).

## 9. Câu hỏi chặn ADR 0002

BA không chọn thay. Chi tiết, người trả lời và khuyến nghị: `docs/multi-tenant-open-questions.md` mục 2 và mục 6.

**Chờ owner/khách/luật sư/kế toán** (không dev nào tự quyết được): Q2 (số tenant), Q3 (có đòi tách vật lý), Q4/Q25/C-S14 (định danh, email), Q14 (khách đầu tiên đồng ý, sở hữu hạ tầng), Q12/Q32 và Q27 (ở mức hook), Q37 (thứ tự MT-1 so với pilot), Q38 (tenant số 1 chấp nhận điều khoản), Q24 và Q36 (vai trò nền tảng, xác thực mạnh).

**Dev trả lời trong ADR (DEV-1 đến DEV-10):** phương án cô lập và bằng chứng theo bảy tiêu chí; ảnh hưởng chỉ mục; ánh xạ `companyId` sang tenant/Company (M1); mô hình định danh và thu hồi phiên; cấp phát tự động idempotent (spike, Q26); giữ số chứng từ và khóa hóa đơn khi chuyển tenant số 1 (M7); URL ký và tác vụ nền theo tenant (M8, M9); phân biệt dữ liệu thử/thật (C-15); chống bot, nguồn tra MST, liên kết một lần (C-17, C-S16); kế hoạch retrofit (M13).

Chưa có câu trả lời thì tiếp tục theo kỷ luật MT-0 và **không viết thêm slice một tenant**.

## 10. Việc cho designer (BA không sửa `design/`)

Dựng lại TSX-01, 02, 03, 10, 11, 20, 30; chỉnh TSU-14 (email + mật khẩu, biến thể chọn công ty), TSU-15, 41, 50, 53, 56, 66; thêm `SupportCard`, `CompanyPicker`, `BotCheckSlot` ẩn mặc định, `TenantStateBanner` ba biến thể, `OnboardingChecklist` ba trạng thái (`component-catalog.md` §2.24). Danh sách màn giữ, gộp, hoãn: analysis mục 0A.4.
