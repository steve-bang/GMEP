# Câu hỏi cho ba (từ lần dựng khung dự án, 31/10/2026)

> **Trạng thái 31/10/2026**: BA đã trả lời Q1 đến Q12 và hai mục BA-12, BA-13 trong [ba-answers-for-dev.md](ba-answers-for-dev.md) (mục Q1: §2, Q2: §3, Q3: §4, Q4: §5, Q5 và Q6 và Q7: §1, Q8: §7, Q9: §8, Q10: §9, Q11: §10, Q12: §11; BA-13: §6). Các câu trả lời là **đề xuất BA chờ xác nhận**, dùng được làm giá trị mặc định cấu hình; các điểm thuộc Chủ dự án, Khách, Kế toán khách, Luật sư khách nằm ở §12 của tệp đó.

Dev không tự quyết các quy tắc dưới đây; khung dự án dùng giá trị tạm đánh dấu rõ trong mã. Mỗi mục: câu hỏi, giá trị tạm đang dùng, nơi cần sửa.

| # | Câu hỏi | Giá trị tạm trong mã | Liên quan |
| --- | --- | --- | --- |
| Q1 | Ma trận quyền theo vai trò và hành động (xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất, quản lý) cho từng tài nguyên; mã vai trò chính thức | Dữ liệu seed `CH`, `QL`, `TK` với quyền `warehouse:view/create/export` (`src/infrastructure/seed/demo.ts`). Vai trò là dữ liệu trong collection `roles`, không phải mã | FR-SYS-012, 013; FRD mục 2 |
| Q2 | "Kho" (warehouse) thuộc FR-SYS-005: mã kho duy nhất theo chi nhánh hay theo công ty? Được sửa tên, ngừng dùng, chuyển chi nhánh không? Có kho cấp công ty (kho tổng) không? | Mã duy nhất theo chi nhánh, bất biến; chưa có sửa hoặc ngừng dùng; kho luôn thuộc đúng một chi nhánh | FR-SYS-005, INV |
| Q3 | Người dùng nhiều chi nhánh: màn danh sách mặc định gộp mọi chi nhánh được giao hay buộc chọn một chi nhánh? Ai được đổi phạm vi? | Gộp tất cả chi nhánh được giao; chưa có bộ chọn phạm vi (chỉ hiển thị chỉ báo) | Design shell, FR-SYS-002 |
| Q4 | Chi nhánh bị khóa: tạo mới bị chặn (FR-SYS-011). Việc sửa bản ghi hiện có, thu tiền, xuất kho thì sao? | Chỉ chặn tạo kho mới; đọc luôn được | FR-SYS-011 |
| Q5 | Hết hạn phiên do rảnh và thời hạn tuyệt đối theo vai trò (D-05: 30 phút, KT/AD/CH 15 phút; tuyệt đối 12 giờ) | Một giá trị chung cấu hình bằng biến môi trường `SESSION_IDLE_MINUTES=30`, `SESSION_TTL_HOURS=12` | FR-SYS-001, D-05 |
| Q6 | Chính sách khóa đăng nhập sai nhiều lần (ADR đề xuất 5 lần khóa 15 phút), chính sách mật khẩu, giới hạn tốc độ | Chưa làm (slice 1.1); thông báo lỗi đăng nhập chung chung | FR-SYS-001 |
| Q7 | Đăng nhập bằng email hay mã nhân viên hay cả hai; mã nhân viên duy nhất theo công ty hay theo pháp nhân | Cả hai; mã nhân viên duy nhất trong cơ sở dữ liệu | FR-SYS-001 |
| Q8 | Chính sách che số điện thoại và địa chỉ theo vai trò (PiiPolicy), ai được bấm "Hiện", nội dung nhật ký truy cập | Chỉ có cổng và bộ che giả định che tất cả (`src/platform/pii/pii.ts`), chưa nơi nào gọi | NFR-SEC-03, PDPL 2025, FR-SYS-004 |
| Q9 | Thời hạn lưu nhật ký thao tác, nhật ký truy cập dữ liệu cá nhân và bản ghi khóa chống trùng; ai được xem nhật ký (màn chỉ đọc) | Khóa chống trùng giữ 24 giờ (`IDEMPOTENCY_TTL_HOURS`); nhật ký chưa có thời hạn xóa | FR-SYS-003, retention |
| Q10 | Xuất dữ liệu danh sách: có giới hạn số dòng, cần lý do, cần duyệt không? Cột nào được phép | Tối đa 5.000 dòng, không cần lý do, ghi nhật ký mỗi lần xuất | NFR-EXP-01 |
| Q11 | Ranh giới xuyên chi nhánh (BA-05): phần nào của khách và xe được thấy ngoài phạm vi, bằng phép chiếu nào | Chưa có; mọi thứ hiện cách ly cứng theo chi nhánh | NFR-ISO-01, CRM |
| Q12 | Kích thước trang mặc định và tối đa của danh sách | 25 mặc định, tối đa 100 (theo kế hoạch §2.3) | NFR-PERF-01 |

## Câu hỏi mới từ lần dựng slice 1.1 và 1.2 (01/11/2026, dev)

Chủ dự án quyết định **MFA làm sau**: không dựng TOTP/PIN, không cờ `mfaRequired`; `StrongAuthPort` chỉ còn là điểm móc không làm gì. Các giá trị dưới đây là cấu hình mặc định trong mã, ghi rõ nơi sửa.

| # | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- |
| N1 | Người có phép gán toàn công ty (`*`) nhưng không phải CH/QV (AD, KT) có được xem hợp nhất khi cấu hình không? BA §4 chỉ nêu CH và QV là vai trò hợp nhất | Có: gán `*` được coi là phạm vi hợp nhất, không buộc chọn chi nhánh | `loadActor` (auth.ts), `resolveWorkingScope` |
| N2 | Danh sách người dùng/nhân sự: SĐT của nhân viên dùng đúng bảng che của khách (BA §7 nói "dùng cùng cơ chế"). AD hiện KHÔNG thấy SĐT nhân viên nếu không có bảng riêng cho nhân sự. Email nhân viên (định danh đăng nhập) không bị che với ai có `user:view` | Cùng bảng; email không che | `DEFAULT_PII_POLICY`, `toUserDto` |
| N3 | Gán vai trò quản lý (CH/QV/QL/KT/AD) cần CH duyệt: hiện chỉ CH tự thực hiện, AD nhận lỗi `approval_required` thay vì tạo yêu cầu chờ duyệt. Có cần luồng "AD đề xuất, CH duyệt" cho phép gán, khóa chi nhánh, ngừng kho, sửa vai trò? | Chưa có luồng duyệt riêng cho các thao tác này; chỉ cấu hình có ngày hiệu lực mới có đề xuất/duyệt | `users.ts`, `branches.ts`, `warehouses.ts`, `roles.ts` |
| N4 | Ai tạo bảng giá bán và giá từng mặt hàng (BA §2.3 để trống): hiện chỉ CH có `price-list:create/update` | CH | `domain/permissions.ts` |
| N5 | Mã MH, NS và "Quản trị trụ sở" chưa có trong ma trận vai trò (chờ Chủ dự án); chưa seed | 10 vai trò FRD | `ROLE_CODES` |
| N6 | Kho mặc định mỗi chi nhánh (đúng một): hiện `isDefault=false`, chưa có thao tác đặt mặc định | Chưa làm | `warehouses.ts` |
| N7 | Mã kho sửa được trước khi có phát sinh (BA §3): hiện mã kho không sửa được qua API (an toàn hơn); khi INV có sổ kho mới biết "đã phát sinh" | Không sửa mã | `updateWarehouse` |
| N8 | Mốc áp thuế 1/1/2027 (BA-03) vẫn mở: thuế suất là cấu hình `tax-rate` có `effectiveFrom`, dữ liệu trong test là MẪU, chưa kế toán ký | Không có số hay mốc nào trong mã | `domain/config.ts`, tests/integration/config-admin.test.ts |
| N9 | Hạn mức đăng nhập sai theo địa chỉ mạng (bộ đếm C): 60 lần/15 phút/địa chỉ làm chậm tới 30 giây | 60 / 15 phút | `DEFAULT_LOCKOUT` |
| N10 | Đăng nhập bằng mã nhân viên khi công ty có nhiều pháp nhân/công ty cùng mã: hiện coi là mơ hồ và yêu cầu dùng email | Mơ hồ thì từ chối | `DocUserRepository.findByLogin` |
| N11 | Nhật ký thao tác cho KT: chỉ xem một số loại bản ghi liên quan tiền và cấu hình (danh sách trong mã) | `AUDIT_RESTRICTED_TYPES` | `application/audit.ts` |
| N12 | Xuất nhật ký: AD và CH, tối đa 5.000 dòng, có lý do; không bắt nhập lại mật khẩu vì không xuất cột cá nhân | Không step-up | `exportAuditCsv` |
| N13 | Nội dung "quy định sử dụng và bảo mật dữ liệu" khi kích hoạt tài khoản do doanh nghiệp cung cấp; hiện chỉ lưu thời điểm đồng ý và chuỗi phiên bản giữ chỗ | `consentPolicyVersion` | `sysConfigFromEnv` |
| N14 | Đổi email, mật khẩu tạm cho nhân viên không email (thợ), đăng nhập bất thường (bộ đếm B báo AD và gửi email chủ tài khoản), lịch sử đăng nhập FR-SYS-014: chưa làm trong lần này | Chưa làm | slice sau |

## Câu hỏi từ đợt căn chỉnh UI theo design (01/11/2026, dev)

Gửi `ba` (B) hoặc `designer` (D). Các giá trị tạm đã chạy trong ứng dụng, chờ xác nhận.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| U1 | B | G4-SYS-01 có cột và đếm "bị khóa" (khóa do nhập sai mật khẩu). Hiện khóa đăng nhập chỉ là bộ đếm tạm (hết hạn tự động), không phải trạng thái tài khoản; trạng thái lưu chỉ có Đang hoạt động / Đã mời / Đã khóa (vô hiệu hóa). "Bị khóa" trên danh sách có nghĩa là vô hiệu hóa thủ công, hay cần hiển thị cả khóa tạm do nhập sai? | Đếm tài khoản vô hiệu hóa, nhãn "Đã khóa" | `searchUsers`, `users.status` |
| U2 | B/D | G4-SYS-01 có cột "Xác thực hai lớp". MFA làm sau theo chủ dự án nên cột bị bỏ. Cần giữ chỗ cột hay bỏ hẳn tới khi có MFA? | Bỏ cột | `users/page.tsx` |
| U3 | D | G4-SYS-10 có trạng thái "Nháp". Miền dữ liệu hiện chỉ có Chờ duyệt / Đã duyệt / Đã từ chối; "Hiện hành", "Sắp hiệu lực", "Hết hiệu lực" được suy ra từ ngày hiệu lực. Có cần lưu nháp (chưa gửi duyệt) không? | Không có Nháp | `config/configView.ts` |
| U4 | B | G4-SYS-10 có bảng "Ví dụ kiểm thử công thức thuế" kế toán ký xác nhận và quy tắc làm tròn (theo dòng hay theo hóa đơn). Chưa có mô-đun tính thuế để chạy ví dụ; cần kế toán cho ví dụ có số và quy tắc làm tròn trước khi làm. | Chưa làm | ACC/EIN |
| U5 | B/D | G4-SYS-07 gộp danh mục dịch vụ, giờ chuẩn và đơn giá giờ theo chi nhánh trong một màn có 3 tab; dữ liệu hiện tách thành danh mục dịch vụ (catalog) và hai loại cấu hình (giờ chuẩn, đơn giá giờ). Giờ chuẩn hiển thị theo từng dịch vụ ngay trên bảng dịch vụ có được không? | Hai màn riêng trong menu Cài đặt | `services/page.tsx`, `config/[type]` |
| U6 | D | G4-SYS-09 hạn mức giảm giá theo vai trò và chi nhánh: prototype có mẫu bảng vai trò x hạn mức. Cấu hình hiện là một dòng phiên bản mỗi (vai trò, phạm vi). Cần màn hình dạng ma trận gộp các vai trò của một phiên bản? | Một phiên bản = một vai trò | `discount-limit` payload |
| U7 | D | Danh sách người dùng trên điện thoại: prototype dùng `record-list` (thẻ), app đang cuộn ngang trong bảng. Cần cho `DataTable` một chế độ thẻ dưới 640px? | Bảng cuộn ngang | `DataTable.tsx` |
| U8 | D | Prototype G4-SYS-* cho hiện mã màn hình (G4-SYS-01) và độ ưu tiên (P1) ở đầu trang. Mã màn là thông tin nội bộ; trong ứng dụng đang hiện mã màn, bỏ P1. Giữ hay bỏ ở bản chạy thật? | Hiện mã, không P1 | `SettingsFrame.tsx` |
| U9 | B/D | G4-SYS-19 có tab "Truy cập dữ liệu cá nhân" (nhật ký bấm Hiện) và bộ lọc theo nhóm đối tượng (Khách và xe, Lệnh, Kho, Tiền, Hóa đơn, Phân quyền, Cấu hình). Nhật ký truy cập đã được ghi nhưng chưa có màn xem; nhóm đối tượng chờ các mô-đun nghiệp vụ. | Lọc theo từng loại bản ghi; chưa có tab | `audit/page.tsx` |
| U10 | D | Chưa có prototype cho form mời người dùng khi vào từ danh sách (G4-SYS-02 có form sửa/mời trong khung). App dùng form một cột trong khung cài đặt. Cần xác nhận bố cục hai cột, nhóm "Vai trò và chi nhánh" lặp được nhiều dòng. | Form một cột, một phép gán | `InviteUserForm.tsx` |
| U11 | D | G5-AUT-01 có gợi ý "nhân viên chưa có email (ví dụ thợ): nhờ quản lý chi nhánh cấp mã tạm". Hiện trang Quên mật khẩu chưa hiện gợi ý này (phụ thuộc quyết định N14 về đăng nhập thợ bằng PIN). | Chưa hiện | `ForgotForm.tsx` |
| U12 | B | Thanh tìm kiếm toàn cục (Ctrl K) trong prototype cần phạm vi tìm (phiếu, biển số, khách, phụ tùng). Các mô-đun đó chưa có, nên chưa dựng khung rỗng. | Chưa làm | `AppShell.tsx` |

## Slice 1.3 CRM (04/11/2026, dev)

Dev đã dựng khách, xe, sở hữu có hiệu lực, lịch sử xe xuyên chi nhánh (phép chiếu), đồng ý, yêu cầu chủ dữ liệu, tra cứu chính xác xuyên chi nhánh, xuất khách. Các điểm dưới đây là chỗ tài liệu chưa nói rõ; dev đã chọn giá trị tạm (cột 3) để chạy. Gửi `ba` (B), `designer` (D) hoặc khách qua BA (K).

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| C1 | B/K | Mã khách: định dạng và phạm vi đánh số. BA §6.3 chưa có loại chứng từ "khách". | `KH-<MÃCN>-<STT 5 số>`, đếm theo chi nhánh, không đặt lại theo kỳ | `DEFAULT_NUMBERING.customer` (numbering.ts) |
| C2 | B/K | "Quan hệ với chi nhánh" (BA §10.1.5): khách có quan hệ khi được tạo ở chi nhánh đó hoặc đã có lịch hẹn, báo giá, lệnh. Hiện mới có hai nguồn: tạo tại chi nhánh, và thao tác "Dùng hồ sơ này tại chi nhánh" sau khi tra chính xác. REC (slice 1.5) sẽ gọi cùng hàm `relateToWorkingBranch` khi tạo lịch hẹn/báo giá. Quan hệ không bao giờ hết hạn. Xe của khách (đang sở hữu) được gắn cùng lúc. | Có, như mô tả | `application/lookup.ts` |
| C3 | B/K (luật sư) | FR-CRM-011 thời hạn trả lời yêu cầu chủ dữ liệu theo Luật BVDLCN 2025 / NĐ 356/2025 chưa có trong tài liệu. | 72 giờ kể từ lúc tiếp nhận, là cấu hình | `DEFAULT_CRM_CONFIG.requestDeadlineHours` |
| C4 | B/K (luật sư) | Xóa dữ liệu khách: giữ lại gì theo luật? Hiện ẩn danh: xóa SĐT, email, địa chỉ, đổi tên thành "Khách đã ẩn danh", bỏ MST và người liên hệ, xóa nhãn và đồng ý quảng cáo; GIỮ mã khách, quan hệ sở hữu xe, lịch sử sửa chữa, các bản ghi đồng ý (bằng chứng), biển số xe. Khách doanh nghiệp có chứng từ phải giữ thì giữ tên pháp nhân và MST. Điều kiện chặn xóa (lệnh mở, công nợ, bảo hành) do REC/ACC trả về qua `CustomerRetentionPort`; hiện là stub không chặn. Biển số có phải dữ liệu cá nhân cần ẩn không? | Như mô tả; chỉ CH (`data-request:approve`) được hoàn tất yêu cầu xóa | `anonymize.ts`, `closeDataRequest`, `stubCustomerRetention` |
| C5 | B | Số km gần nhất: được giảm không (nhập nhầm, thay đồng hồ)? | Không được giảm; báo lỗi nhập; chưa có thao tác hiệu chỉnh | `updateVehicle` |
| C6 | B/K | Lịch sử xe xuyên chi nhánh có hiện giá không (BA P3 đã đánh dấu [Cần xác nhận: Chủ dự án])? Trường dự án có: ngày, chi nhánh, mã lệnh, hạng mục, phụ tùng, số km, tổng tiền. REC sẽ ghi bản chiếu mỗi lệnh khi lệnh xong. | Có hiện tổng tiền, tắt được bằng cấu hình | `DEFAULT_CRM_CONFIG.historyShowPrice` |
| C7 | B | Ma trận quyền CRM mặc định (mục `domain/permissions.ts`): CV, QL tạo/sửa khách và xe; QL còn xuất; QĐ, TN chỉ xem khách/xe; KT xem và xuất (cột cá nhân bị che; xuất đầy đủ cần lý do + mật khẩu); QV xem và xuất; TH, TK, AD không có quyền khách. Thợ chỉ thấy tên khách và biển số của việc mình (G2-CRM-01) sẽ làm khi có REC. Tủ kho (TK) "tên khách trên chứng từ kho" cũng chờ INV. Xác nhận hoặc sửa. | Như mô tả | `CRM_CH`, `matrix` |
| C8 | B | Quyền xử lý yêu cầu chủ dữ liệu: CV và QL ghi nhận; QL giao người xử lý và đóng (trừ yêu cầu xóa); chỉ CH hoàn tất yêu cầu xóa. Có cần vai trò pháp chế/DPO riêng không? | Như mô tả | `data-request:*` |
| C9 | B | Tra cứu khớp chính xác xuyên chi nhánh: CV, QL, QĐ, TN (và CH) có quyền `customer-lookup:view`; QĐ xem lịch sử xe qua tra cứu khi chẩn đoán. Mỗi lần tra theo SĐT ghi nhật ký truy cập cho mọi vai trò (BA §7.3 chỉ nêu CH, QV, KT). Tối đa 5 khách mỗi lần tra. | Như mô tả | `lookupExact`, `lookupMaxResults` |
| C10 | B | Mục đích, kênh, căn cứ đồng ý (FR-CRM-010): danh sách đề xuất dev dùng: mục đích {dịch vụ, nhắc, quảng cáo, chia sẻ bên thứ ba}; kênh {tại quầy, Zalo, SMS, email, điện thoại, web}; căn cứ {đồng ý, hợp đồng, nghĩa vụ pháp luật, lợi ích hợp pháp}. Chỉ căn cứ "đồng ý" mới cho phép quảng cáo (FR-CRM-013). Nội dung thông báo quyền riêng tư (phiên bản chính sách) do doanh nghiệp cung cấp. | Như mô tả | `domain/consent.ts` |
| C11 | B | Biển số: định dạng kiểm tra rất rộng (5-12 ký tự chữ và số, có ít nhất một chữ và một số) vì xe máy, xe quân đội, biển tạm khác nhau. Đổi biển số (G2-CRM-07) giữ biển cũ trong hồ sơ xe; biển đã bỏ có thể đăng ký lại cho xe khác. Có cần quy định chặt hơn theo loại xe? | Rộng | `isPlausiblePlate` |
| C12 | B/D | Trùng khách (FR-CRM-003, Should) chưa làm; hiện chỉ có cảnh báo gián tiếp qua tra cứu chính xác. Tìm kiếm SĐT theo tiền tố; một SĐT có thể thuộc nhiều khách (gia đình), tra chính xác trả tới 5. Tìm bằng tên/SĐT/biển số trong danh sách trả tối đa 50 kết quả khớp SĐT/biển số (không phân trang) để giữ đúng phạm vi; danh sách theo tên phân trang. | Như mô tả | `listCustomers` |
| C13 | D | G2-CRM-01/03 có nhiều thành phần chưa dựng vì phụ thuộc mô-đun khác hoặc ngoài phạm vi 1.3: cột "Lần sửa gần nhất", tab Báo giá, Thanh toán và công nợ, Ghi chú và tin nhắn, Hợp đồng và liên hệ (CRM-005..009), nhãn sửa tại chỗ, chuyển danh sách Khách/Xe dạng segmented, hợp nhất trùng (CRM-08), nhắc (CRM-09), chiến dịch (CRM-10), cột hiển thị. Xe dùng trang riêng /crm/vehicles/new?customerId=… thay vì chọn khách trong form. Chuyển chủ chọn khách trong danh sách 100 khách đầu theo tên (chưa có ô tìm trong form). Đồng ý hiện trong tab của trang khách. | Dựng phần cốt lõi, các phần trên chưa làm | `app/(shell)/crm` |
| C14 | B | Xuất danh sách khách (FR-CRM-017): POST thay vì GET để mật khẩu nhập lại không nằm trên URL; định dạng CSV UTF-8 có BOM. Cột: mã, loại, tên, MST, (SĐT, email, địa chỉ nếu vai trò được xem; bản che nếu chưa xuất đầy đủ), số xe, nhãn, mã chi nhánh, ngày tạo. Giới hạn 5.000 dòng (1.000 dòng khi xuất cột cá nhân đầy đủ) theo BA §9, xuất bất đồng ý để sau. | Như mô tả | `application/export.ts`, `DEFAULT_CRM_CONFIG` |
| C15 | B | Sửa khách: vai trò chỉ thấy SĐT/email/địa chỉ dạng che (CH, QV, KT) không sửa được các trường này (form không hiện); chỉ CV và QL (mức xem đầy đủ) sửa. Có cần cho CH sửa sau khi bấm Hiện? | Không | `customers/[id]/edit/page.tsx` |

## Slice 1.4 INV (04/11/2026, dev)

Dev đã dựng danh mục phụ tùng, số dư bốn số theo kho, chứng từ PN/PX/HK/DC (nháp, ghi sổ, đảo), sổ biến động chỉ ghi thêm, giữ chỗ, giá vốn bình quân gia quyền (chiến lược `CostMethod` theo cấu hình), cảnh báo dưới định mức theo Khả dụng. Bảng quy tắc giữ chỗ (BA-07) chưa có trong `ba-answers-for-dev.md`, nên dev dùng các giá trị tạm dưới đây (mọi giá trị là dữ liệu hoặc một chỗ duy nhất trong mã).

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| I1 | B/K | Quy tắc giữ chỗ theo sự kiện (BA-07): duyệt, duyệt một phần, phát sinh, hủy, hết hạn, xuất một phần, hoàn kho. | Giữ chỗ theo **tổng số lượng cần** của một dòng (lệnh hoặc báo giá): gọi lại cùng tổng thì không đổi, tổng cao hơn thì giữ thêm phần chênh, thấp hơn thì nhả phần chênh. Thiếu hàng: **từ chối cả dòng** (409), hoặc giữ phần có sẵn khi gọi với `allowPartial`, phần thiếu được báo về, **không tạo đơn chờ (backorder)**. Hủy hoặc từ chối: nhả hết phần đang giữ; phần đã xuất giữ nguyên (hoàn bằng phiếu HK). Phát sinh được duyệt: gọi lại với tổng mới. Báo giá phát sinh chờ duyệt **không** giữ chỗ. | `domain/ledger.ts` `planHold`, `application/reservations.ts` |
| I2 | B/K | Giữ chỗ có hạn không (báo giá hết hạn 24 giờ, BA-03)? | **Không có hạn trong 1.4**: giữ chỗ chỉ nhả khi REC gọi `releaseStock` (báo giá hết hạn, từ chối, hủy lệnh). Cần việc nền nhả giữ chỗ quá hạn khi có REC | `Reservation` (chưa có `expiresAt`) |
| I3 | B | Xuất vượt Khả dụng (FR-INV-019 "ngoại lệ cấu hình có duyệt"; BA-04 Câu 9: chặn tuyệt đối, CH bật theo chi nhánh, chỉ mượn phần giữ chỗ của lệnh khác, QL duyệt). | **Chặn tuyệt đối, chưa làm ngoại lệ**: một lệnh xuất được tối đa phần giữ chỗ của chính nó cộng Khả dụng, và không bao giờ quá Thực tế. Không có cờ cấu hình | `domain/ledger.ts` `issue` |
| I4 | B | Số lượng thập phân (lít, mét, kg): FRD mục 2.6 cho phép lưu số nguyên với tỉ lệ cố định. Dầu bán theo lít sẽ cần số lẻ. | **Chỉ số nguyên**; đơn vị "lít" hiện coi là 1 lít = 1 đơn vị, phụ tùng bán theo can/hộp. Khi cần số lẻ: thêm tỉ lệ (ví dụ 1000) vào `Part`, không đổi sổ | `domain/entities.ts` |
| I5 | K | Giá vốn (BA-06): bình quân di động từng lần nhập, đơn vị tính (kho hay chi nhánh hay công ty), giá vốn hàng trả/chuyển/điều chỉnh/kiểm kê. | **Bình quân gia quyền di động theo từng kho x phụ tùng**, làm tròn nửa lên đến 1 đồng; xuất tính theo giá bình quân tại thời điểm xuất; hoàn kho (HK) nhập lại **đúng giá lúc xuất** của phiếu gốc; điều chỉnh âm tính theo giá bình quân; điều chỉnh dương bắt buộc nhập giá; phiếu đảo hoàn **đúng giá trị** của dòng gốc. Ví dụ 113.333 (UAT-25) có trong `tests/unit/inv-domain.test.ts` nhưng **chưa được kế toán ký** (NFR-MNT-01). FIFO chưa làm: `cost-method` chỉ nhận `weighted-average` | `domain/cost.ts`, config `cost-method` |
| I6 | B/K | FR-INV-003 "tồn theo lô kèm giá nhập": làm lớp lô hay chỉ giá bình quân? | **Chưa có lô**: một số dư cho mỗi kho x phụ tùng, giá nhập từng lần nằm ở dòng phiếu nhập và sổ. "Tổng tồn bằng tổng các lô" tạm đúng theo kho. Số lô, serial (FR-INV-024, Could) chưa làm | `StockBalance` |
| I7 | B | Nhập kho (FR-INV-005) khi chưa có PUR: chứng từ gốc của PN. | Nguồn `purchase-order` và `urgent-purchase` chỉ cần **một mã tham chiếu** (chưa kiểm tra tồn tại vì PUR chưa có); `no-po` cần lý do và quản lý duyệt. Lệch giá hoặc số lượng so với dòng theo đơn: ngưỡng là cấu hình `inventory-policy` (mặc định giá 5%, số lượng 0%) cần quản lý duyệt. Nhận một phần nhiều lần chưa theo dõi (cần PUR) | `domain/document.ts`, config `inventory-policy` |
| I8 | B | Chứng từ gốc của phiếu xuất (FR-INV-006) và phiếu hoàn kho. | PX: `repair-order`, `retail-sale`, `transfer-order` kèm mã tham chiếu (chưa kiểm tra tồn tại vì REC, bán lẻ, chuyển kho chưa có); xuất cho lệnh bắt buộc ghi người nhận (thợ). HK: chỉ từ một PX **đã ghi sổ**, cùng kho và cùng lệnh, tổng hoàn không vượt tổng xuất theo từng dòng | `SOURCES_BY_TYPE` |
| I9 | B | Phân quyền kho (FRD §2): TK tạo và sửa, QL duyệt, CH/QV/KT xem. CH không được duyệt phiếu kho theo đúng bảng. CV xem **Khả dụng** (không xem tồn thực tế, giá vốn). Giá vốn xem được với CH, QV, QL, KT (như `COST_VISIBLE_ROLES`), TK không xem giá vốn trừ giá nhập của chính phiếu PN. | Như mô tả. `stock-doc:approve` = QL; người ghi sổ phiếu bất thường (điều chỉnh, nhập không có đơn mua, lệch ngưỡng) **khác người lập** (xét theo người, kể cả CH tự duyệt vẫn bị chặn) | `domain/permissions.ts` |
| I10 | B | Tồn đầu kỳ (ADJ, nguồn `opening-balance`) và điều chỉnh sai lệch: ai lập, ai duyệt; có cho nhập qua Excel (SYS-007, slice 1.11) không. | TK hoặc người có quyền lập phiếu lập, QL (khác người lập) ghi sổ; dòng âm bị cấm với tồn đầu kỳ; công cụ Excel sẽ tạo đúng phiếu này | `approvalReasons` |
| I11 | B | Định mức tối thiểu và tối đa (G3-INV-02 "theo chi nhánh"). | Lưu **theo kho x phụ tùng** trên số dư (1 chi nhánh thường có 1 kho chính). So sánh với Khả dụng. Gợi ý đặt = tối đa trừ (Khả dụng + đang vận chuyển); chưa có tối đa thì để trống. "Đã đặt chờ giao" chưa có (cần PUR). Gợi ý lấy từ chi nhánh dư: chưa làm (phép chiếu P5, phase 2) | `StockBalance.minQty` |
| I12 | B/D | Bảng giá chuẩn (INV-025 + BA "ai lập bảng giá"): TK có xem bảng giá, KT và AD lập, CH duyệt. G3-INV-19 (màn lập giá hàng loạt, xem trước, duyệt CH) chưa dựng. | Giá niêm yết của phụ tùng đọc từ cấu hình `price-item` (khóa `<mã bảng giá>:<mã phụ tùng>`, hiệu lực theo ngày, có duyệt) ở `/sys/config/price-item`; màn chi tiết phụ tùng chỉ hiển thị. Mã phụ tùng vì thế bị giới hạn 2-40 ký tự `A-Z 0-9 . _ -` | `getPartPrices` |
| I13 | D | Màn hình thiết kế chưa dựng ở 1.4: INV-06 (yêu cầu cấp phụ tùng, thuộc REC 1.6), INV-11 (xuất dùng nội bộ, P2+), quét mã vạch bằng camera, lô, đối chiếu ba bên với đơn mua, in A4/A5 phiếu kho, xuất Excel tồn kho, KPI "đang vận chuyển" và giá trị tồn toàn kho. Phiếu nhập/xuất/hoàn/điều chỉnh dùng **một bố cục chung** (không tách INV-07/09/10); chọn phụ tùng bằng ô gõ mã + gợi ý (chưa có bộ chọn có ảnh). | Như mô tả | `inv/documents/*` |
| I14 | B | Nhóm hàng và đơn vị tính là danh sách cố định trong mã (dầu, lọc, phanh, lốp, điện, treo, động cơ, thân vỏ, vật tư, khác; cái, bộ, cặp, lít, kg, mét, hộp). Khách có muốn tự quản danh mục nhóm không? | Cố định | `domain/normalize.ts` |

## Slice 1.3 follow-up (04/11/2026, dev)

Dev đã áp dụng các câu trả lời C1-C15 khác giá trị tạm (hạn nội bộ/hạn pháp lý, đóng cửa an toàn khi xóa, giảm số km có lý do, QĐ/TN trong tra cứu, ô tìm khách, nguồn quan hệ, căn cứ đồng ý, số khung duy nhất, tìm SĐT từ 4 số và "N+"). Các điểm dưới đây là phần còn thiếu hoặc mơ hồ sau khi áp dụng.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| C16 | B | C3 nêu nhắc ở 50% thời gian, thông báo QL và CH khi quá hạn, gia hạn có lý do và lịch sử. Cần việc nền (job) và màn hình gia hạn; chưa có. Có đưa vào 1.3 hay để slice thông báo/việc nền? | Chỉ tách hai hạn và tô đỏ quá hạn nội bộ; chưa nhắc, chưa gia hạn | `dataRequests.ts`, `DataRequest` |
| C17 | B | C4: cho tới khi REC/ACC/EIN nối cổng giữ dữ liệu, yêu cầu xóa không thể hoàn tất tự động (409 `retention_unverified`). Chấp nhận trong pilot? Nếu cần xóa trước đó, ai ký xử lý thủ công và ghi nhận thế nào? | Chặn; cờ `allowUnverifiedRetention` chỉ dùng cho môi trường thử | `stubCustomerRetention`, `CrmConfig` |
| C18 | B/K | C5: ngưỡng giảm km báo QL (đề xuất 10.000 km) chưa làm vì chưa có nơi nhận; cờ "thay đồng hồ" đã lưu (`odometerReplacedAt`). Chưa có màn hình sửa xe nên lý do giảm km mới nhập được qua API; REC (1.5) sẽ dùng cùng quy tắc. | Không báo QL | `updateVehicle` |
| C19 | B | C9: vượt 30 lượt/giờ bị từ chối và ghi nhật ký truy cập (bị từ chối); "báo CH" bằng thông báo trong hệ thống chưa làm (cần biết gửi cho ai khi nhiều CH). Tần suất là chính sách chung `customer-lookup`, chưa theo chi nhánh. | Chỉ ghi nhật ký | `DEFAULT_RATE_LIMITS` |
| C20 | B | C6 chỉ liệt kê CV, QL, QĐ (và CH) xem lịch sử xe; ma trận hiện cũng cho QV, KT quyền `vehicle-history:view`. Thu hẹp QV, KT? | Giữ nguyên QV, KT | `permissions.ts` |
| C21 | B | C9 tách quyền mới `customer-lookup-customer:view` (SĐT và thông tin khách trong tra cứu) cho CH, QV, QL, CV, TN; QĐ chỉ có `customer-lookup:view`. Vai trò đã tạo ở môi trường thật cần bổ sung quyền này (dữ liệu, không tự cập nhật). Xác nhận QV, TN thuộc nhóm được tra theo SĐT? | CH, QV, QL, CV, TN | `permissions.ts` |
| C22 | B/D | C11 chưa làm: cảnh báo mềm sai dạng biển số, tra theo biển cũ kèm "biển đã đổi", cảnh báo "biển từng gắn với xe khác". Số khung trùng trả 409 `vin_exists` không nêu chi nhánh và chưa dẫn tới xe cũ (tránh lộ xe ngoài phạm vi). Có cần dẫn tới xe cũ khi xe đó trong phạm vi? | Chỉ chặn | `vehicles.ts` |
| C23 | B | C4/C10: kiểm tra bằng chứng đồng ý chỉ bắt được số điện thoại và email, không bắt được tên. Có cần mẫu bằng chứng cố định (chọn từ danh sách: phiếu giấy, tick web, tin nhắn trả lời) thay ô nhập tự do? | Ô tự do có kiểm tra | `looksLikePersonalContact` |
| C24 | B | C2: khi bật `adoptRequiresBusinessEvent`, thao tác "Dùng hồ sơ này" bị chặn nhưng chưa có lịch hẹn/báo giá (REC 1.5) để mở lại bằng nguồn `appointment`/`quote`. Pilot một chi nhánh để cờ tắt như BA khuyến nghị. | Cờ tắt | `relateToWorkingBranch` |

## Slice 1.4 follow-up (04/11/2026, dev)

Dev đã áp dụng trả lời I1-I14 (`ba-answers-for-dev.md` §16) khác giá trị tạm: đường duyệt của REC giữ chỗ với `allowPartial` và lưu phần thiếu (`unmetQty`), nhả phần dư và đóng dòng khi hạng mục hoàn thành hoặc lệnh hủy/đóng, giữ chỗ neo vào dòng lệnh, bảng 23 sự kiện (dữ liệu `RESERVATION_EVENTS`), `quantityScale`, giá trị tồn nguyên đồng (hoàn kho theo tỉ lệ giá trị dòng xuất, kiểm kê thừa mặc định giá bình quân), ngưỡng số lượng chỉ cho nhận vượt, phiếu xuất cho lệnh cần dòng nhu cầu và không vượt nhu cầu còn lại, nhóm hàng và đơn vị là danh mục cấu hình, mã phụ tùng cho phép `/`. Các điểm dưới đây là phần còn thiếu hoặc mơ hồ sau khi áp dụng.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| I15 | B/K | Hàng 23 (kiểm kê thấp hơn Giữ chỗ): BA nêu thông báo QL và CV. Chưa có kênh thông báo từ INV. Ai nhận khi nhiều CV, và có cần xác nhận của QL trước khi giảm giữ chỗ? | Ghi sổ điều chỉnh (QL khác người lập duyệt như thường), giảm giữ chỗ dòng giữ sau cùng trước (theo giờ tạo, rồi theo mã), phần mất thành `unmetQty`, ghi nhật ký `stockReservation.shorten`; chưa thông báo | `documents.ts` `applyLines` |
| I16 | B | Hàng 22 (chuyển kho: hàng đã giữ cho lệnh không được chuyển đi) và I5 (kho nhận nhập đúng giá vốn bên gửi): chưa có chứng từ chuyển kho (CK) nên chưa có chỗ áp dụng. PX nguồn `transfer-order` vẫn chỉ cần mã tham chiếu. | Chưa làm, chờ slice chuyển kho | `GIN_SOURCES` |
| I17 | B | Hàng 13: phiếu đảo PX khôi phục phần giữ nếu dòng lệnh chưa "đóng". Dòng chỉ đóng khi REC gọi nhả (hoàn thành, hủy, đóng). Có coi dòng đã đủ xuất (`fulfilled`) mà chưa nhả là còn mở không? Phần khôi phục giữ tối đa bằng số lượng đảo, phần Khả dụng không đủ thành thiếu. | Còn mở nếu chưa đóng, kể cả đã xuất đủ | `reverseDocument` |
| I18 | B/K | Hàng 16 (hàng về): tự giữ phần thiếu theo thứ tự duyệt cũ là cấu hình `autoFulfilShortage`, mặc định tắt. Dev chưa dựng cờ; giữ lại thủ công bằng cách gọi lại đường duyệt với cùng tổng (nút "Giữ chỗ phần thiếu" chưa có màn hình). | Chỉ thủ công qua API | `holdForApproval` |
| I19 | D | Danh sách thiếu hàng và báo cáo "giữ chỗ lâu" (I2, mặc định 14 ngày) mới có API `GET /api/v1/inv/reservations/open?kind=short\|long-held&days=`, chưa có màn hình và chưa có tham số theo loại dịch vụ. Cần thiết kế màn hình và bộ lọc. | API và `InvConfig.longHeldDays` | `listOpenReservations` |
| I20 | B | I3: cận "nhu cầu còn lại" áp dụng cho PX nguồn `repair-order`. Dòng lệnh dùng `reservationKey` (mặc định mã phụ tùng) làm khóa; khi REC có nhiều dòng cùng phụ tùng cần thống nhất khóa dòng (`lineKey`) giữa báo giá duyệt và PX. Cờ ngoại lệ `cho_phép_xuất_vượt_khả_dụng` chưa làm. | Khóa dòng do REC đặt, PX mang cùng `reservationKey` | `holdForApprovalSchema` |
| I21 | B | I14: danh mục nhóm hàng/đơn vị là cấu hình có ngày hiệu lực, TK đề xuất và CH duyệt (cho phép đề xuất từ chi nhánh, vì khóa cấp công ty thường cần phạm vi toàn công ty). Đổi tên hiện là phiên bản mới của cùng mã. Chưa có màn hình riêng, dùng `/sys/config/part-group` và `/part-unit`; nhãn của phụ tùng cũ lấy theo phiên bản hiện hành. Cần quy tắc nào khi ngừng một nhóm đang có phụ tùng (hiện cho giữ nguyên, không cho chọn mới)? | Như mô tả | `catalog.ts`, `CONFIG_TYPES` |
| I22 | K | I5: HK theo tỉ lệ giá trị dòng xuất (cộng dồn, lần hoàn cuối nhận phần còn lại). PX hàng lỗi (HK lý do "hàng lỗi" không tăng Khả dụng), lệnh đã có hóa đơn cần điều chỉnh hóa đơn, hoàn tiền: chưa làm (cần EIN và xử lý lỗi). | HK luôn tăng tồn | `applyLines` |
| I23 | B | I10 và I9 bổ sung: cửa sổ chuyển đổi tồn đầu kỳ, biên bản kiểm kê đính kèm, hạn mức duyệt cấp trên, lý do hoàn kho, chọn người nhận từ danh sách nhân viên chi nhánh, in phiếu A4/A5, xuất Excel tồn kho, API bộ chọn chỉ trả Khả dụng cho báo giá: chưa làm trong lần này (không đổi mã giữ chỗ). Cần xếp thứ tự trước pilot. | Chưa làm | `documents.ts`, `app/(shell)/inv` |

## Slice 1.5 REC (tiếp nhận và báo giá, dev, 04/11/2026)

Dev đã dựng phần đầu của 1.5: FR-REC-001, 002, 003, 004, 005, 007. Chưa dựng (phần sau): duyệt toàn phần/một phần, trang khách qua liên kết, duyệt tại quầy, in A4, hạng mục bắt buộc/tùy chọn ở mức khách chọn (REC-008/009/023/026/030/031/032). Cột "Giá trị tạm" là giá trị mã đang dùng; mọi con số là cấu hình hoặc mặc định đánh dấu.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R1 | K | Làm tròn: thành tiền dòng làm tròn nửa lên về đồng; thuế tính một lần cho mỗi thuế suất trên tổng tiền chưa thuế của các dòng (không làm tròn từng dòng). Kế toán xác nhận cách làm tròn và ví dụ ký duyệt (NFR-MNT-01); khớp với cách hóa đơn điện tử làm tròn? | Như bên trái; ví dụ trong `tests/unit/rec-domain.test.ts` chưa được kế toán ký | `domain/pricing.ts` |
| R2 | K/B | Thuế suất theo nhóm hàng (FR-ACC-009): hiện mọi dòng dùng một khóa `tax-rate` (`RecConfig.taxRateKey = 'vat'`). Công và phụ tùng có cùng thuế suất không? Mốc áp thuế qua 1/1/2027 (BA-03) là dữ liệu trong phiên bản cấu hình, chưa có quy tắc "ngày nào tính" cho báo giá gửi trước mốc, duyệt sau mốc. | Một khóa `vat`; ngày tính giá = ngày lưu bản nháp; thiếu cấu hình thì chặn (409 `tax_rate_missing`) | `ports/deps.ts`, `quoteBuild.ts` |
| R3 | B | Giảm giá toàn báo giá (QUO-02 "Giảm thêm 8% trên tổng đơn") chưa dựng; chỉ có giá thực tế từng dòng trong hạn mức `discount-limit` theo vai trò (không có mục = không được giảm; lấy hạn mức cao nhất trong các vai trò của người dùng). Cần giảm toàn lệnh không, và phân bổ thuế khi có giảm toàn lệnh? Tổng "trước giảm giá toàn lệnh, trước thuế" (C6) đã là `subtotalVnd`. | Chỉ giảm theo dòng | `quoteBuild.ts` |
| R4 | B | Vượt hạn mức hiện bị chặn khi lưu (422, ghi rõ trường), chưa có luồng "gửi yêu cầu duyệt giảm giá" (G4-APR-02, chưa có phân hệ duyệt). QL có hạn mức cao hơn sửa lại giá. Chấp nhận trong pilot? | Chặn lưu; QL/CH có hạn mức cao hơn tự chỉnh | `quoteBuild.ts` |
| R5 | B/K | Bảng giá áp dụng cho phụ tùng: chưa có cấu hình "bảng giá theo chi nhánh" (branch-config), dùng bảng `STD` (`RecConfig.priceListCode`). Công thức giá công: giờ chuẩn x đơn giá giờ chi nhánh, cho phép sửa số phút trên dòng (chưa ghi cờ khác giờ chuẩn). Có cần cờ/duyệt khi khác giờ chuẩn? | Bảng `STD`; sửa phút được, lưu cả giờ chuẩn lẫn phút | `ports/deps.ts` |
| R6 | B | Quyền REC mặc định: `intake` và `quote` view/create/update cho CV, QL; QL thêm approve/reject (cho phần duyệt sau); CH, QV, QĐ, TN xem hồ sơ và báo giá; TK, KT chỉ xem báo giá; TH không có (Xn = chỉ việc của mình, chờ 1.6). Ma trận FRD ghi QL = D nhưng QUO-01 cho QL nút Lập báo giá, nên QL được cả S. | Như bên trái | `permissions.ts` |
| R7 | B | Cố vấn tiếp nhận (G2-REC-01 bước 4) hiện là người đang đăng nhập; chưa có danh sách cố vấn của chi nhánh để chọn người khác (CV không có quyền xem người dùng). Loại dịch vụ là 4 nhãn cố định (bảo dưỡng, sửa chữa chung, lốp và mâm, đồng sơn) chờ cấu hình quy trình theo loại (FR-REC-032). | Người tạo = cố vấn; 4 nhãn | `domain/entities.ts` |
| R8 | B/D | Chưa dựng: ảnh hiện trạng (chưa có lưu trữ tệp qua API), nhắc hạng mục khách từng từ chối (REC-024), "chọn từ lịch hẹn" (APT), dạng nhúng đầy đủ của G2-CRM-05 (đã có biểu mẫu xe mới gọn với bộ chọn chủ xe), xem trước phiếu tiếp nhận A5, bản nháp trên máy khi mất mạng (chỉ giữ trên màn hình đang mở, nút lưu bị khóa). | Như bên trái | `rec/intakes/*` |
| R9 | B | Số km: khi hoàn tất tiếp nhận hệ thống chưa cập nhật số km lần trước của xe (CRM `updateVehicle` cần phiên bản xe và làm cách ly giao dịch); dự kiến cập nhật khi mở lệnh (1.6). Cờ "Số km bất thường" (giảm hơn 1.000 km, trừ khi thay đồng hồ) đã lưu trên hồ sơ nhưng chưa có danh sách cho QL. Ngưỡng 1.000 km là đề xuất của designer (C18 nêu 10.000 km): chọn số nào? | `RecConfig.abnormalKmDrop = 1000`; so với km lần trước trong CRM | `ports/deps.ts` |
| R10 | B | Hết hạn báo giá (7 ngày) mới lưu `validUntil`; chưa có việc nền chuyển sang "Hết hạn" và nhắc (cần Cloud Tasks/Scheduler, chưa có). Máy trạng thái đã có sự kiện `expire`. Gửi cho khách mới ghi trạng thái "Chờ khách duyệt" và hạn; kênh (liên kết, email, in) thuộc phần sau, không gửi tin thật. | Chỉ ghi hạn | `application/quotes.ts` |
| R11 | B | Báo giá bắt buộc có hồ sơ tiếp nhận đã hoàn tất cùng chi nhánh (RULE-007) và mỗi hồ sơ một báo giá; báo giá nhanh không qua tiếp nhận và báo giá thứ hai cho cùng lần vào xưởng (ngoài báo giá bổ sung của 1.6) chưa có. Cần không? | 1 hồ sơ = 1 báo giá | `application/quotes.ts` |
| R12 | K | Bản nháp tính giá ở ngày lưu; để sang ngày khác phải lưu lại trước khi gửi (409 `prices_outdated`) để giá và thuế gửi cho khách đúng ngày gửi. Chấp nhận hay muốn hệ thống tự tính lại lúc gửi (giá có thể đổi trước mắt cố vấn)? | Chặn gửi, yêu cầu lưu lại | `application/quotes.ts` |

## Slice 1.5 follow-up (04/11/2026, dev)

Dev đã áp dụng các mục "Dev must change" của `ba-answers-for-dev.md` §17: R2 (ánh xạ thuế theo loại dòng, khóa và phiên bản thuế trên từng dòng, cảnh báo hạn vượt mốc đổi thuế), R5 (cờ khác giờ chuẩn), R7 (loại dịch vụ là danh mục), R9 (một ngưỡng 1.000 km của CRM, cập nhật số km khi hoàn tất tiếp nhận), R10 (hết hạn suy ra, `sentVia`), I15, I16, I20, C17 (REC nối vào cổng giữ dữ liệu), C18, C19, C20, C21, C22, C23, C24. Các điểm dưới đây là phần chưa làm được hoặc còn mơ hồ. Mã R13 trở đi.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R13 | B | R2 và R10: lệnh duyệt báo giá chưa có (phần sau của 1.5/1.6). Chặn duyệt báo giá quá hạn đã nằm trong máy trạng thái (`transitionQuote(..., {expired})` trả `quote_expired`) và trạng thái "Hết hạn" suy ra khi đọc; lệnh duyệt phải truyền `expired` từ `isQuoteExpired` khi viết. Thuế suất áp cho hóa đơn lập sau mốc đổi vẫn chờ kế toán: hệ thống chỉ cảnh báo. | Cảnh báo `tax_change_within_validity`, không chặn | `domain/quoteState.ts`, `quotes.ts` |
| R14 | B/K | R5: "đọc bảng giá của chi nhánh khi dữ liệu gán có" chưa làm vì chưa có cấu hình gán bảng giá cho chi nhánh (SYS-06); `laborMinutesTolerancePct` (vượt thì bắt nhập lý do) chưa dựng, khởi điểm không giới hạn như BA nêu. Cờ và độ lệch (phút, điểm phần vạn) đã lưu trên dòng công. | Bảng `STD`; chỉ lưu cờ | `quoteBuild.ts` |
| R15 | B | R7: danh mục loại dịch vụ đã là cấu hình (`service-type`, QL đề xuất, CH duyệt). Chưa có: quy trình theo loại (đồng sơn cần khảo sát), bộ lọc danh sách theo loại, chọn cố vấn qua API bộ chọn thu hẹp (BA cho làm sau). | Seed 4 mã cũ (`maintenance`, `general_repair`, `tire_wheel`, `body_paint`) | `recDemo.ts`, `intakes.ts` |
| R16 | B | R9 và C22: danh sách "Số km bất thường" cho QL (chờ báo cáo ngoại lệ) và tra theo biển cũ kèm "biển đã đổi" lúc tiếp nhận chưa làm. Số km bất thường chỉ gửi thông báo cho QL chi nhánh đang làm việc, không có màn hình. | Cờ lưu trên hồ sơ, thông báo `crm.odometer_abnormal` | `odometer.ts` |
| R17 | B | R10: lọc danh sách báo giá theo trạng thái dùng trạng thái lưu: lọc "Chờ khách duyệt" có thể còn dòng đã quá hạn (hiển thị là "Hết hạn"), lọc "Hết hạn" chỉ thấy báo giá đã lưu hết hạn. Cần việc nền (chung với C16, I2) để lưu trạng thái và nhắc cố vấn. Gửi qua liên kết/tin nhắn chưa có kênh nên `sentVia` chỉ nhận `print` hoặc `counter` (mặc định `none` = đã chốt, chưa phát). | Trạng thái hiển thị suy ra, không có việc nền | `quotes.ts` |
| R18 | B | I15: cố vấn của lệnh chưa có nguồn (lệnh sửa chữa ở 1.6), nên cổng `OrderAdvisorPort` trả rỗng và chỉ QL chi nhánh nhận thông báo; "mã lệnh" trong nội dung hiện là mã nguồn giữ chỗ. Khi REC có lệnh: cài `advisorsOf` và đổi sang số lệnh. | `noOrderAdvisors` | `infrastructure/stubs.ts`, `documents.ts` |
| R19 | B | C17: cổng giữ dữ liệu đã nối REC (hồ sơ tiếp nhận nháp, báo giá chờ khách duyệt) nhưng cổng tổng hợp vẫn `unverified` cho tới khi lệnh, thanh toán, hóa đơn, bảo hành nối xong; biên bản thủ công hai người (CH và KT ký) chưa dựng. Tiền cọc gắn báo giá chưa có vì chưa có thanh toán. | `combineRetention(REC, stub)` | `stubs.ts`, `retention.ts` |
| R20 | B | C19: thông báo vượt giới hạn tra cứu gửi mọi CH (không có thì QV), tối đa một lần cho mỗi người tra trong 24 giờ (cửa sổ cố định, không gộp "kèm số lần"). Số lần cần bộ đếm riêng; có cần không? | Một thông báo mỗi người tra mỗi ngày, không có số lần | `lookup.ts`, `customer-lookup-notice` |
| R21 | B | C21: cơ chế bổ sung quyền còn thiếu cho vai trò đã tạo (idempotent, có nhật ký) chưa làm; vai trò seed đã đổi (QV bỏ `customer-lookup-customer:view`). C20: thêm quyền `vehicle-history-cross:view` (CH, CV, QL, QĐ) cho việc đọc lịch sử xe ngoài phạm vi; vai trò đã tạo ở môi trường thật cần được bổ sung quyền này, nếu không CV, QL sẽ mất khả năng đó. | Chỉ seed | `permissions.ts` |
| R22 | B | C22: xe trùng số khung nằm ngoài phạm vi trả `outOfScope` kèm các trường P2 (hãng, dòng, năm, xe thương mại), không có mã xe và không có biển; người dùng đi tiếp bằng tra biển chính xác. Có cần trả thêm gì không? | Chỉ khi có `customer-lookup:view` | `vehicles.ts` |
| R23 | B | C23: danh mục `evidence-kind` bắt buộc chọn loại khi danh mục có mục đang dùng; bản ghi cũ không có loại giữ nguyên. Bắt buộc mã tham chiếu hoặc ghi chú theo từng loại là tham số của loại (`referenceRequired`, `noteRequired`), chưa có ô trên màn hình cấu hình (chỉ qua API). Danh sách mẫu là dữ liệu chờ luật sư. | Seed 5 loại | `crmDemo.ts`, `consents.ts` |
| R24 | B/D | R12: nút "Tính lại theo giá hôm nay" kèm bảng chênh (BA: nên làm, không chặn), R1: hàm chia phần dư cho trang khách, R8: ảnh hiện trạng, cờ `backfilled`: chưa làm. | Như bên trái | `quotes.ts` |

## Slice 1.5 second part: quote approval (dev, 04/11/2026)

Dev đã dựng duyệt báo giá: FR-REC-008, 009, 023, 026, 030, 031, 032 (xem README mục "Slice 1.5 second part"). Cột "Giá trị tạm" là giá trị mã đang dùng; mọi con số là cấu hình hoặc mặc định đánh dấu. Mã R25 trở đi.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R25 | K | R1: trang khách và bản in hiện giá từng hạng mục ĐÃ GỒM thuế, thuế tính một lần cho mỗi thuế suất trên tổng chưa thuế của các hạng mục được chọn rồi chia cho hạng mục theo phần dư lớn nhất (hạng mục thứ tự thấp thắng khi bằng nhau) để tổng khớp đúng. Kế toán xác nhận cách chia, và khi xuất hóa đơn có theo hạng mục hay theo thuế suất. Ví dụ UAT-17 trong `tests/unit/rec-approval.test.ts` (duyệt 2 trong 4 hạng mục: chưa thuế 1.885.000, thuế 150.800, tổng 2.035.800) chưa được kế toán ký; số 4.550.000 và 2.050.000 của UAT-17 trong FRD là mức gồm thuế hay chưa thuế? | Như bên trái | `platform/money/splitTax.ts` |
| R26 | B/D | FR-REC-009 "chữ ký tại quầy": chưa có lưu trữ tệp qua API nên chưa lưu ảnh nét ký. Hệ thống ghi họ tên người ký, mã phiếu giấy (tùy chọn), người ghi nhận, thời điểm và mã băm SHA-256. Có cần ảnh chữ ký/ảnh phiếu giấy (kèm mục đích đồng ý và thời hạn lưu) hay phiếu giấy ký tay lưu ngoài hệ thống là đủ? | Không có ảnh | `CounterApproval.tsx`, `approval.ts` |
| R27 | B/K | OTP khi duyệt (QUO-04/05): cấu hình `quote-approval.otpMode` chỉ nhận `off` vì chưa có nhà cung cấp SMS. Khi có: ba mức (tắt / vượt ngưỡng giá trị / luôn bật), ngưỡng giá trị bao nhiêu, ai được đổi? | `off`, nút OTP bị khóa kèm lý do | `config.ts` `quote-approval` |
| R28 | B | Kênh gửi: chỉ có sao chép liên kết và in giấy; Zalo/SMS/email bị khóa, không hiện tên nhà cung cấp. Liên kết hiệu lực đến hết hạn báo giá (7 ngày), tạo liên kết mới thì liên kết cũ chết ngay, mã liên kết chỉ hiện một lần khi tạo (chỉ lưu băm). Gửi bản in chưa ghi `sentVia = print` (xem trang in không ghi dữ liệu). Cố vấn có cần xem lại liên kết đã tạo (cần lưu mã hóa) không, và in có phải sự kiện "đã giao" cần ghi nhận (số lần in lại, "BẢN IN LẠI")? | Tạo lại khi cần; không ghi in | `approval.ts` `issueQuoteLink` |
| R29 | B | Xác nhận bằng lời (FR-REC-026): bắt buộc ghi chú tối thiểu 10 ký tự và tick đã đọc lại; lưu cờ `exception` và thông báo QL chi nhánh. Chưa có danh sách "Ngoại lệ cần rà soát" cuối ngày, chưa có ngưỡng giá trị (vượt thì cần QL duyệt), chưa phân biệt người ghi nhận là CV hay QL. Chốt ngưỡng và màn hình rà soát? Cho phép xác nhận bằng lời là cấu hình theo chi nhánh (mặc định bật). | Bật; chỉ cờ và thông báo | `quote-approval.verbalApproval` |
| R30 | B | Quyền `quote:approve` giờ gồm CV và QL (ghi nhận duyệt tại quầy, theo QUO-05); R6 dành quyền này cho QL. Vai trò đã tạo ở môi trường thật cần được bổ sung quyền (cùng cơ chế còn thiếu của R21). Khách tự duyệt qua liên kết không có tài khoản: nhật ký ghi người thực hiện là `customer-link:<mã liên kết rút gọn>`. | CV, QL | `permissions.ts` |
| R31 | B/D | Hạng mục khách không duyệt được lưu trong bằng chứng duyệt (kèm lý do, cờ An toàn nếu là hạng mục bắt buộc) để làm danh sách nhắc (BR-REC-11, FR-REC-024, G2-QUO-08). Chưa có màn hình nhắc lần sau và chưa gắn lý do vào CRM. Làm ở slice nào? | Chỉ lưu | `QuoteApproval.declined` |
| R32 | B | Danh mục lý do không duyệt (`decline-reason`): seed 4 mục (để lần sau, giá cao hơn dự kiến, đã sửa ở nơi khác, lý do khác có bắt buộc ghi chú) là mẫu, Khách chốt danh sách. Cấu hình "Cho phép khách bỏ hạng mục bắt buộc" (`quote-approval`, theo công ty hoặc chi nhánh, mặc định Có) chưa có ô trên màn hình cấu hình (chỉ qua API, như R23). Có cần theo loại hạng mục như Câu 2 nêu? | Theo chi nhánh, không theo loại hạng mục | `config.ts` |
| R33 | B | Trang khách chỉ hiện tên gọi (từ cuối của họ tên), biển số, đời xe, tên chi nhánh, hạng mục và giá; không hiện SĐT (kể cả dạng che), địa chỉ, giá vốn, tồn kho, tên nhân viên; không có số hotline vì chi nhánh chưa lưu số điện thoại. Có cần hiện số hỗ trợ chi nhánh (cần thêm trường vào SYS-05)? Có cần kết quả kiểm tra xe (INS) và ảnh trên trang khách như thiết kế QUO-06 (chưa có INS và ảnh)? | Không | `PublicQuoteDto` |
| R34 | B/K | Giới hạn tốc độ trang khách: 60 lượt/phút theo địa chỉ và theo liên kết, và 10 lần quyết định (duyệt/từ chối) trong 15 phút theo liên kết. Địa chỉ mạng dùng chung ở quầy nên giới hạn theo địa chỉ để rộng. Chủ dự án xác nhận con số sau khi đo ở staging. | Như bên trái | `ratelimit.ts` |
| R35 | B | FR-REC-030 mã lệnh: dùng dãy số `repair-order` (tiền tố RO, cấp phát lúc tạo, theo chi nhánh và kỳ) qua `allocateRepairOrderNumber`, idempotent theo khóa yêu cầu; slice 1.6 gọi khi tạo lệnh. Xác nhận định dạng `RO-<chi nhánh>-<yymm>-<số>` và rằng không cần mã lệnh theo cấu trúc khác (ví dụ ngày). | Dãy số hiện có | `orderSupport.ts` |
| R36 | B/D | FR-REC-032 quy trình theo loại dịch vụ: cấu hình `service-workflow` (khóa là mã loại dịch vụ) chứa danh sách bước (mã, tên, vai trò phụ trách). Seed 2 loại với 2 bộ bước KHÁC NHAU là dữ liệu mẫu (bảo dưỡng, lốp và mâm). Trạng thái hạng mục và phân người phụ trách thuộc hạng mục sửa chữa (1.6); quy trình đồng sơn chưa khảo sát. Khách cung cấp các bước thật cho từng loại; bước có tính vào công thợ không? Cấu hình chưa có ô nhập mảng trên màn hình (chỉ qua API). | Dữ liệu mẫu | `config.ts` `service-workflow` |
| R37 | B | Duyệt một phần: tiền của lệnh là tổng đã duyệt (thuế tính lại trên tập được duyệt), `approvedTotalVnd` nằm trên báo giá; hạng mục không duyệt không vào lệnh. Giữ chỗ phụ tùng làm khi tạo lệnh ở 1.6 từ `getApprovedQuote` (mỗi dòng mang `lineKey`); duyệt xong chưa có lệnh nên chưa giữ chỗ. Chấp nhận khoảng trống giữa "đã duyệt" và "đã có lệnh" (cố vấn phải bấm tạo lệnh, hay hệ thống tự tạo lệnh khi duyệt)? | Chưa tạo lệnh tự động | `approval.ts`, slice 1.6 |
| R38 | B | Liên kết của báo giá hết hạn vẫn cho khách TỪ CHỐI (tạm: được) nhưng không cho duyệt; khách không tự xin liên kết mới. Cố vấn tạo phiên bản mới rồi tạo liên kết mới. Chấp nhận? | Như bên trái | `approval.ts` |

Trạng thái trả lời của BA (04/11/2026, chi tiết ở `ba-answers-for-dev.md` §18; Chủ dự án đã duyệt trước nguyên tắc theo đề xuất BA):

| # | Trạng thái | Dev |
| --- | --- | --- |
| R25 | Đã trả lời, chờ Kế toán khách ký ví dụ | Dev default OK |
| R26 | Đã trả lời, chờ Luật sư khách | Dev default OK |
| R27 | Đã trả lời, ngưỡng chờ Chủ dự án | Dev default OK |
| R28 | Đã trả lời | Dev default OK (bổ sung ghi nhận in, sau) |
| R29 | Đã trả lời, ngưỡng chờ Khách | Dev must change (nhỏ) |
| R30 | Đã trả lời | Dev default OK (cơ chế bổ sung quyền trước pilot) |
| R31 | Đã trả lời | Dev default OK |
| R32 | Đã trả lời, danh sách lý do chờ Khách | Dev default OK |
| R33 | Đã trả lời | Dev default OK (thêm `supportPhone` sau) |
| R34 | Đã trả lời, chờ đo staging | Dev default OK (cấu hình hóa nếu đang cứng) |
| R35 | Đã trả lời: `RO-<MÃCN>-<YYMM>-<STT 5>` | Dev default OK |
| R36 | Đã trả lời, bước đồng sơn chờ khảo sát xưởng | Dev must change (seed + trường nhỏ) |
| R37 | Đã trả lời: duyệt tự tạo lệnh và giữ chỗ | Dev must change (nối ở 1.6) |
| R38 | Đã trả lời: liên kết hết hạn chỉ đọc | Dev must change |


## Slice 1.6: thực hiện lệnh (dev, 04/11/2026)

Dev đã dựng FR-REC-010, 012, 013, 014, 015, 016, 017, 021, 022, 028 và áp dụng các mục "Dev must change" của BA §18 (R29, R30/R21, R34, R36, R37, R38). Cột "Giá trị tạm" là giá trị mã đang dùng, đều là cấu hình hoặc mặc định đánh dấu. Mã R39 trở đi. Gửi: B = BA, D = designer, K = Khách, C = Chủ dự án.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R39 | B/K | Kho giữ chỗ khi duyệt báo giá: chi nhánh có thể có nhiều kho (N6: chưa có "kho mặc định"). Giữ chỗ lấy từ kho nào, và có cho chọn kho theo từng dòng không? | Kho đánh dấu mặc định, nếu không có thì kho hoạt động đầu tiên theo mã; chi nhánh không có kho hoạt động thì không mở được lệnh có phụ tùng (`warehouse_missing`, nút Tạo lệnh) | `holdWarehouse` (`orders.ts`) |
| R40 | B/K | FR-REC-013 "hoàn tác" của thợ: cho hoàn tác thao tác bấm nhầm trong bao lâu, và chỉ người bấm được hoàn tác hay quản đốc cũng được? | 120 giây, chỉ người bấm; quản đốc sửa bằng cách đổi trạng thái hạng mục chưa có màn hình riêng. `order-policy.undoWindowSeconds` đã có schema, mã đọc mặc định `RecConfig.undoWindowMs` | `RecConfig.undoWindowMs`, `order-policy` |
| R41 | B/K | Lý do tạm dừng hạng mục (G2-TEC-02): danh mục cố định hay cấu hình? Có cần lý do "chờ khách duyệt thêm" riêng không? | 4 mã cố định: chờ phụ tùng, chờ khách, nghỉ, khác (`PAUSE_REASONS`) | `domain/orderState.ts` |
| R42 | B | Ma trận quyền 1.6 là đề xuất dev: thợ (TH) chỉ thấy và thao tác hạng mục được giao cho mình; quản đốc (QĐ) phân thợ, thao tác thay thợ, chạy QC; cố vấn (CV) mở, tạm dừng, hủy lệnh chưa xuất kho, giao xe; quản lý (QL) làm tất cả và là người duy nhất hủy lệnh đã xuất phụ tùng; thủ kho (TK) xuất phụ tùng theo yêu cầu; thu ngân (TN) và kế toán (KT) chỉ xem. Đúng chưa? Ai được giao xe: CV, QL, hay cả TN? | Như bên trái; bổ sung vào vai trò đã tạo bằng `POST /api/v1/sys/roles/top-up` | `permissions.ts` (`PERMISSION_TOPUPS`) |
| R43 | B/K | Danh sách kiểm tra chất lượng (FR-REC-016): 4 mục MẪU dùng chung (khóa `default`). Khách cung cấp mục thật theo từng loại dịch vụ; có bắt buộc ảnh sau sửa không? | Cấu hình `qc-checklist` theo mã loại dịch vụ, mặc định `default`; không có danh sách thì màn QC báo chưa cấu hình và chặn | `qc-checklist` |
| R44 | B/K/L | Biên bản giao xe (FR-REC-017): xác nhận trên màn hình = ghi họ tên người nhận + thời điểm (không có chữ ký vẽ tay, không lưu ảnh); hoặc ký trên bản giấy kèm mã biên bản. Có cần chữ ký vẽ tay/ảnh? In lại cần lý do (đã làm). Giao xe có bắt buộc thu đủ tiền (chờ 1.7)? | Không ảnh; tên người nhận bắt buộc; `order-policy.handoverRequiresPayment` mặc định false, nếu bật thì giao xe bị chặn (`payment_check_unavailable`) cho tới khi có phân hệ thu tiền | `order-policy` |
| R45 | B/K | Hủy lệnh đã xuất phụ tùng (FR-REC-021): hiện chặn cho tới khi mọi phụ tùng đã xuất được hoàn kho bằng phiếu RTN đã ghi sổ rồi QL mới hủy được. Phiếu xuất tạo ngoài REC (trực tiếp ở màn kho) coi là "chưa giải trình" và cũng chặn. Quy trình thật của Khách có cho hủy khi phụ tùng đã lắp vào xe (không hoàn được) không? | Chặn; muốn khác phải có quyết định nghiệp vụ (ví dụ chuyển phụ tùng đã lắp thành chi phí) | `cancelOrder`, `orderIssueBalance` (INV) |
| R46 | B | Hủy lệnh khi đã chờ kiểm tra hoặc sẵn sàng giao: Journey chỉ cho hủy từ "đã duyệt" hoặc "đang sửa". Dev thêm "tạm dừng". Trường hợp khách bỏ xe sau khi sửa xong xử lý thế nào (hoàn tiền, phí lưu xe)? | Không cho hủy từ chờ kiểm tra, sẵn sàng giao, hoàn tất | `ORDER_TRANSITIONS` |
| R47 | B/K | Báo giá bổ sung được duyệt khi lệnh đã hoàn tất hoặc đã hủy: duyệt vẫn ghi, lệnh KHÔNG nhận hạng mục, QL được báo. Cần quy trình xử lý (mở lệnh mới? hủy duyệt?). Với lệnh đang chờ kiểm tra hoặc sẵn sàng giao, hạng mục bổ sung đưa lệnh quay lại "đang sửa" (sự kiện `reopen`): đúng chưa? | Như bên trái | `appendSupplement` |
| R48 | B | R29: ngưỡng `verbalApprovalMaxVnd`. Dev làm gần đúng: vượt ngưỡng thì người ghi nhận bằng lời phải là QL (người có quyền `quote:reject`), CV bị chặn (`verbal_needs_manager`). BA muốn "CV ghi, QL khác xác nhận trước khi sang Đã duyệt" (cần trạng thái chờ xác nhận). Chấp nhận cách gần đúng không? | Gần đúng; mặc định không đặt ngưỡng | `approveQuote` |
| R49 | D/B | Thợ đề xuất việc phát sinh (G2-TEC-04) cần ảnh: chưa có API tải tệp nên chỉ nhập chữ. Ảnh làm cùng đợt R8 (kèm mục đích đồng ý, thời hạn lưu)? | Chỉ chữ, màn có ghi chú rõ | `WorkCards.tsx` |
| R50 | B/K | Loại dịch vụ theo từng hạng mục (FR-REC-032: hai hạng mục khác loại dùng hai bộ bước khác nhau trên một lệnh): hồ sơ tiếp nhận chỉ có MỘT loại dịch vụ nên lệnh chép bộ bước của loại đó. Cần chọn loại cho từng hạng mục báo giá không? Bộ bước hiện chỉ được chép, chưa có màn theo dõi bước (ngày dự kiến `expectedDays` của đồng sơn chưa hiện). | Một loại cho cả lệnh; bước lưu sẵn trên lệnh | `RepairOrder.steps` |
| R51 | D | Màn dựng thật theo G2-REC-02..06, G2-TEC-01..04, G2-DLV-01..04 ở mức chức năng: chưa có màn "Hủy lệnh và hoàn kho" riêng (hủy là hộp thoại ngay trên lệnh, có cảnh báo về phiếu hoàn kho), chưa có G2-TEC-05 "Công của tôi", chưa có hàng chờ kiểm tra G2-DLV-01 riêng (lệnh chờ kiểm tra hiện ở cột bảng điều phối). Designer duyệt sai khác? | Như bên trái | `app/(shell)/rec/*` |
| R52 | B | FR-REC-022 "xe chờ phụ tùng": dựa trên phần thiếu khi giữ chỗ (`unmetQty`) và nút "Kiểm tra lại phụ tùng" chạy lại giữ chỗ idempotent. Hệ thống KHÔNG tự giữ khi hàng về (hàng về qua phiếu nhập không tự kích hoạt). Cần tự động theo sự kiện nhập kho không? | Thủ công bằng nút, và cố vấn được báo khi lệnh mở | `recheckParts` |
| R53 | B | Giờ thực của thợ (FR-REC-013) tính từ các mốc bắt đầu/tạm dừng/kết thúc đã ghi, hiển thị bên cạnh giờ khách duyệt; chưa có quy tắc công/hoa hồng (HRM, 2). Hạng mục đổi thợ giữa chừng: giờ gắn với hạng mục, người thao tác ghi ở từng mốc. Đủ cho 1.6? | Như bên trái | `workedMsOf` |

Trạng thái trả lời của BA (04/11/2026, chi tiết ở `ba-answers-for-dev.md` §19; Chủ dự án đã duyệt trước nguyên tắc theo đề xuất BA). Mọi giá trị tạm đều đổi được bằng cấu hình hoặc một dòng mã, không cần đổi dữ liệu.

| # | Trạng thái | Dev |
| --- | --- | --- |
| R39 | Đã trả lời: kho mặc định, không chọn kho theo dòng; thiếu kho thì báo QL | Dev default OK (thêm thông báo QL) |
| R40 | Đã trả lời: 120 giây, người bấm; quản đốc sửa bằng mốc bù có lý do | Dev default OK (mốc bù QĐ làm sau) |
| R41 | Đã trả lời, danh mục lý do chờ Khách | Dev must change (nhỏ: thêm mã thứ 5) |
| R42 | Đã trả lời: giao xe là CV và QL, không TN; CV hủy chỉ khi chưa làm, chưa xuất | Dev must change (nhỏ) |
| R43 | Đã trả lời, mục thật chờ Khách | Dev default OK |
| R44 | Đã trả lời: nội dung kiểm tra giao xe khi có thu tiền, ngoại lệ ghi nợ do QL duyệt; cờ bật mặc định khi 1.7 xong | Dev must change (hợp đồng với 1.7) |
| R45 | Đã trả lời, xử lý phụ tùng đã lắp chờ Khách và Kế toán | Dev default OK |
| R46 | Đã trả lời: không hủy sau khi chờ kiểm tra; khách bỏ xe đi theo công nợ, chính sách lưu xe chờ Khách | Dev default OK |
| R47 | Đã trả lời: chặn duyệt bổ sung khi lệnh đã đóng, tự đóng báo giá bổ sung còn mở | Dev must change |
| R48 | Đã trả lời: chấp nhận cách gần đúng ở pilot | Dev default OK (quyền riêng nên có) |
| R49 | Đã trả lời | Dev default OK |
| R50 | Đã trả lời: một loại cho cả lệnh ở pilot, ghi nhận lệch FR-REC-032 | Dev default OK |
| R51 | Đã trả lời phần chức năng, duyệt màn hình thuộc designer | Dev default OK |
| R52 | Đã trả lời: thủ công ở pilot | Dev default OK |
| R53 | Đã trả lời: đủ cho 1.6, kèm 3 điều kiện kiểm tra | Dev default OK (kiểm tra) |

## Slice 1.7: tiền tối thiểu (dev, 04/11/2026)

Dev đã dựng FR-ACC-001, 002, 003, 004, FR-ACC-006 (mức tối thiểu: ghi nợ được duyệt khi giao xe), FR-ACC-009 (dùng lại cấu hình `tax-rate`/`tax-mapping` có sẵn, không nhân đôi), FR-SYS-004 (phê duyệt tối thiểu), RULE-007, 010, 011 và các mục "Dev must change" của BA §19 (R39, R41, R42, R44, R47, R48). Cột "Giá trị tạm" là giá trị mã đang dùng, đều là cấu hình có ngày hiệu lực hoặc hằng đánh dấu. Mã tiếp theo R53 là R54.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R54 | K/KT | Hình thức thanh toán: tiền mặt, chuyển khoản, thẻ (POS), QR/ví điện tử **ghi tay** (chưa có cổng thanh toán). Mã giao dịch có bắt buộc với chuyển khoản, thẻ, QR không? Đối soát ngân hàng làm ở Phase 4. | Cả bốn hình thức bật; mã giao dịch bắt buộc với hình thức không phải tiền mặt | cấu hình `acc-policy` (`methods`, `nonCashReferenceRequired`) |
| R55 | K/KT | Khi nào được thu tiền: tiền cọc nhận được khi lệnh còn mở; thu tiền cuối chỉ sau khi lệnh qua kiểm tra chất lượng (thiết kế G4-ACC-01 "chặn thu"). Có cho thu từng phần giữa chừng không? Cọc tối đa bao nhiêu? | Thu cuối chỉ khi sẵn sàng giao hoặc hoàn tất; cọc không vượt phần giá trị lệnh chưa thu | `acc-policy.receiptRequiresQc`; `deposit_exceeds` |
| R56 | KT | Thu vượt số còn nợ: hiện bị từ chối (tiền thối chỉ là số liệu "khách đưa" trên phiếu, không phải thu). "Khoản nhận trước" của khách (G4-ACC-21), cọc gắn khách thay vì gắn lệnh, bù cọc sang lệnh khác: chưa làm. Cọc hiện gắn một lệnh. | Từ chối thu vượt (`overpayment`) | `payments.ts` |
| R57 | KT/K | Hoàn cọc: dùng phiếu chi loại `deposit_refund` gắn khoản cọc (API có, màn hình chưa có). Hoàn tiền cho khách ngoài cọc (G4-ACC-07) và hạn mức hoàn tiền của thu ngân: chưa làm, hiện sai thì đảo phiếu thu. | Chỉ hoàn phần cọc còn giữ | `expenses.ts` |
| R58 | Chủ/K | Hạn mức phê duyệt (G4-APR-03 ghi "giá trị minh họa", D-11): phiếu chi thu ngân tự quyết đến bao nhiêu, quản lý chi nhánh đến bao nhiêu, vượt thì Chủ garage; hạn xử lý trước khi nhắc. Chưa có chuyển cấp tự động (chỉ đánh dấu quá hạn), chưa duyệt hàng loạt, chưa có cờ "Kế toán trưởng" và "Quản lý vùng" làm cấp duyệt. | Mã dự phòng: mọi phiếu chi cần duyệt, cấp 1 đến 5.000.000, đảo 50.000.000, ghi nợ 10.000.000, chênh lệch quỹ 500.000; dữ liệu mẫu seed: thu ngân tự chi đến 500.000 | cấu hình `approval-limit` (theo loại) |
| R59 | Chủ/K | "Người lập khác người duyệt" xét theo người: quản lý chi nhánh đề nghị thì phải người khác duyệt. Chi nhánh chỉ có một quản lý thì mọi yêu cầu của quản lý đó chuyển Chủ garage. Chấp nhận? | Có, theo FRD và thiết kế | `checkDecision` |
| R60 | KT/K | Chênh lệch quỹ khi chốt ca: ngưỡng không cần duyệt (chỉ giải trình), danh mục nguyên nhân (4 mã theo thiết kế). Chênh lệch ghi ngay thành một dòng sổ quỹ riêng nên sổ bằng số đếm; bị từ chối thì chặn chốt ngày tới khi giải trình lại. | Ngưỡng 0 (mọi chênh lệch cần quản lý duyệt) | `acc-policy.varianceToleranceVnd` |
| R61 | K | Ca thu ngân: mỗi chi nhánh một ca mở tại một thời điểm (không tách theo quầy hay theo người). Số dư nhận đầu ca lấy theo sổ, chưa đếm theo mệnh giá. Ca mở trước nửa đêm thuộc ngày mở ca. Cần nhiều quầy cùng lúc? | Một ca mỗi chi nhánh | `shifts.ts` |
| R62 | Chủ/KT | Chốt ngày: chưa có "mở lại ngày" (cần Chủ garage, mật khẩu, lý do; FR-ACC-005 khóa kỳ chưa làm). Đảo phiếu của ngày đã khóa được ghi vào ngày đang mở (thiết kế G4-ACC-03 khóa nút đảo trong ngày đã khóa). Chặn chốt ngày chỉ do ca đang mở và chênh lệch chưa duyệt; lệnh còn mở, lệnh chưa thu, phiếu chi thiếu chứng từ là cảnh báo. | Như mô tả | `dayClose.ts` |
| R63 | K/KT | Ghi nợ khi giao xe: số ghi nợ phải bằng toàn bộ số còn nợ (không ghi nợ một phần), hạn trả tối đa 60 ngày, QL duyệt từng lệnh. Khách doanh nghiệp trả chậm theo hạn mức CRM không cần duyệt từng lệnh (BA §19 R44 mục 4): chưa làm. Nhắc nợ, tuổi nợ theo khách: chưa làm (danh sách theo lệnh có tuổi nợ). | Như mô tả | `acc-policy.debtMaxDays`; `debts.ts` |
| R64 | KT/L | Phiếu chi thiếu chứng từ gốc: thiết kế cho lưu và liệt kê ở bước chốt ngày; RULE-007 nói không chi khi không có chứng từ gốc. Chọn: cho lưu có cờ (hiện tại) hay chặn? | Lưu có cờ `sourceMissing`, cảnh báo khi chốt ngày | `expenses.ts` |
| R65 | KT | Danh mục loại chi phí là cấu hình `expense-category` (dữ liệu mẫu: văn phòng, điện nước, sửa thiết bị, tiếp khách, khác, hoàn cọc). Danh sách thật do kế toán cho. | Dữ liệu mẫu | cấu hình |
| R66 | K | Hủy lệnh đã có tiền thu hoặc cọc đang giữ bị chặn (`order_has_payments`) cho tới khi đảo phiếu hoặc hoàn cọc. Giao xe khi ACC lỗi: chỉ quản lý chi nhánh, bằng ngoại lệ có lý do (BA §19 R44 mục 8). Đúng ý khách? | Như mô tả | `orders.ts`, `quality.ts` |
| R67 | KT | Số phiếu: dãy `receipt-voucher` (PT) cho phiếu thu, cọc và đảo của chúng; dãy `payment-voucher` (PC) cho phiếu chi và đảo của nó; cấp khi ghi sổ, liền số (nhóm B). Phiếu chi vẫn dùng PC cho cả khoản chi qua chuyển khoản. | Bảng K1..K8 mặc định | `numbering-series` |
| R68 | D | Ngân sách chỉ mục Firestore (200 mỗi cơ sở dữ liệu): sau slice 1.7 dùng 191. Slice 1.8 và 1.9 phải gom truy vấn hoặc xin tăng hạn mức. | Bảy hình truy vấn mới, chọn chi nhánh bằng điều kiện bằng chứ không `in` | `repos/queries.ts` |

Các mục BA §19 đã áp dụng ở slice 1.7: R39 (thông báo quản lý khi thiếu kho: `notifications.orderWarehouseMissing`), R41 (mã tạm dừng thứ 5 `awaiting_supplement_approval`, lý do "khác" bắt buộc ghi chú), R42 (giao xe chỉ cố vấn và quản lý; cố vấn chỉ hủy lệnh còn "Đã duyệt" chưa bắt đầu), R44 (giao xe đọc ACC trong cùng giao dịch, cờ `handoverRequiresPayment` mặc định bật, ảnh chụp số liệu trên biên bản, ngoại lệ của quản lý khi ACC lỗi), R47 (chặn duyệt báo giá bổ sung khi lệnh đã đóng, tự đóng báo giá bổ sung còn mở khi lệnh hoàn tất hoặc hủy, `reopen` làm kết quả QC cũ hết hiệu lực), R48 (quyền riêng `quote-verbal-over-limit:approve`, bổ sung cho vai trò đã tạo qua top-up `2026-11-acc-1.7-money`).

Trạng thái trả lời của BA (04/11/2026, chi tiết ở `ba-answers-for-dev.md` §20; Chủ dự án đã duyệt trước nguyên tắc theo đề xuất BA). Mọi giá trị tạm đều đổi được bằng cấu hình hoặc một dòng mã, không cần đổi dữ liệu.

| # | Trạng thái | Dev |
| --- | --- | --- |
| R54 | Đã trả lời: 4 hình thức, mã bắt buộc với phi tiền mặt, chặn trùng mã, chỉ tiền mặt vào két; đối soát Phase 4, chờ Kế toán khách | Dev default OK (kiểm tra 3 điểm) |
| R55 | Đã trả lời: cọc là hình thức duy nhất trước QC, trần theo phần chưa thu; thu cuối sau QC; chờ Khách | Dev default OK (kiểm tra công thức) |
| R56 | Đã trả lời: từ chối thu vượt; khoản nhận trước thuộc FR-ACC-015 phase 2; chờ Kế toán khách | Dev default OK (cảnh báo cọc dư) |
| R57 | Đã trả lời: hoàn cọc luôn do quản lý duyệt; hoàn ngoài cọc không làm | Dev must change (nhỏ) |
| R58 | Đã trả lời: 500.000 (trần 2.000.000 mỗi ca) / 5.000.000 / Chủ garage; chờ Chủ dự án và Khách, lệch ví dụ Journey | Dev must change (nhỏ: trần theo ca) |
| R59 | Đã trả lời: chấp nhận; một quản lý thì tự chuyển Chủ; Chủ tự duyệt có cờ | Dev default OK (kiểm tra) |
| R60 | Đã trả lời: ngưỡng 0, dòng chênh lệch không xóa; ngưỡng thật chờ Kế toán khách | Dev default OK |
| R61 | Đã trả lời: một ca mỗi chi nhánh; ca đầu cần số dư đầu kỳ do Chủ duyệt; số quầy chờ Khách | Dev default OK |
| R62 | Đã trả lời: chưa mở lại ngày; đảo ngày đã khóa ghi vào ngày đang mở; designer đổi G4-ACC-03 | Dev default OK (kiểm tra chặn/cảnh báo) |
| R63 | Đã trả lời: giữ; hạn 60 ngày chờ Khách; doanh nghiệp theo hạn mức CRM phase 2 | Dev default OK |
| R64 | Đã trả lời: lưu có cờ cho chi thường, chặn cứng loại gắn chứng từ, cờ cần lý do và quản lý duyệt; RULE-007 trong BRD chỉ nói phụ tùng, cần làm rõ; chờ Kế toán khách, Luật sư khách | Dev must change |
| R65 | Đã trả lời: danh mục cấu hình thêm `sourceRequirement`; danh sách thật chờ Kế toán khách | Dev default OK (thêm thuộc tính) |
| R66 | Đã trả lời: đúng ý | Dev default OK |
| R67 | Đã trả lời: K1–K8 mặc định, đảo cùng dãy; chờ Kế toán khách | Dev default OK |
| R68 | Đã trả lời: 9 chỉ mục còn lại là ngân sách cứng của 1.8 và 1.9, sáu quy tắc (tái dùng hình, lọc bộ nhớ tập nhỏ, bản chiếu tổng hợp theo khóa, phi chuẩn hóa, chọn chi nhánh bằng điều kiện bằng, phương án hạ tầng chỉ khi thiếu) | Dev must change (quy tắc cho 1.8, 1.9) |

## Slice 1.8: hóa đơn cơ bản (dev, 04/11/2026)

Dev đã dựng FR-EIN-001..006, 009, 010, 011, 013 và mức tối thiểu của FR-EIN-007 (điều chỉnh, thay thế, hủy có duyệt), cùng các mục "Dev must change" của BA §20 (R57, R58, R64, R68: xem `ba-answers-for-dev.md` §20.5). Không có nhà cung cấp thật: chỉ `FakeProvider` ở môi trường thử. Cột "Giá trị tạm" là giá trị mã đang dùng, đều là cấu hình có ngày hiệu lực. Mã tiếp theo R68 là R69.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R69 | K/KT | Nhà cung cấp hóa đơn điện tử nào, môi trường thử/thật, mẫu số, ký hiệu và loại hóa đơn (giá trị gia tăng hay bán hàng) của từng chi nhánh, thông tin bên bán theo pháp nhân. Có tài liệu API và môi trường thử của nhà cung cấp chưa? | Chỉ `fake`, môi trường `test`; chưa khai đơn vị phát hành thì "chưa kích hoạt" và không phát hành được; `fake` bị từ chối ở môi trường `live` | cấu hình `einvoice-issuer`; bộ chuyển trong `infrastructure/einvoice` |
| R70 | Chủ/KT | "Kế toán trưởng" là cờ quyền của vai trò Kế toán (`invoice:approve`). Ai giữ cờ này ở pilot: chỉ Chủ garage hay một kế toán cụ thể? Người lập không bao giờ tự duyệt (theo người). | Chỉ Chủ garage có `invoice:approve`; Kế toán lập yêu cầu, Chủ duyệt; gán thêm quyền cho Kế toán bằng quản lý vai trò | `permissions.ts` (top-up `2026-11-ein-1.8-invoice`) |
| R71 | KT | Hóa đơn lập theo thuế suất (mỗi thuế suất một dòng tổng) hay theo từng dòng hạng mục; làm tròn thuế một lần cho mỗi thuế suất của MỖI lần duyệt (báo giá gốc và từng báo giá bổ sung) rồi cộng, để tổng hóa đơn bằng tổng lệnh đến từng đồng. Bảng ví dụ số trong `tests/unit/ein-domain.test.ts` chưa được kế toán ký. | `per-rate`; tổng hóa đơn khác tổng lệnh thì chặn phát hành (`invoice_total_mismatch`) | cấu hình `einvoice-policy.lineMode`; `domain/build.ts` |
| R72 | KT | Thuế suất đổi giữa lúc báo giá và lúc lập hóa đơn (mốc 1/1/2027): dùng thuế suất đã khóa trên báo giá hay thuế suất ngày lập. Mã không tự quyết. | Dùng thuế suất đã lưu trên dòng duyệt; nếu thuế suất đang hiệu lực khác thì chỉ cảnh báo trên màn phát hành (`taxChangePolicy: warn`), `block` sẽ chặn cho tới khi kế toán trả lời | cấu hình `einvoice-policy.taxChangePolicy` |
| R73 | KT | Thời điểm cho phép lập hóa đơn (sau kiểm tra chất lượng hay sau giao xe) và cách ghi tiền đặt cọc (FR-EIN-012, chưa làm). Hóa đơn không là điều kiện giao xe (BA R44). | `issueAfter: qc`; FR-EIN-012 chưa làm; hóa đơn lập bằng tổng lệnh, cọc không tách | cấu hình `einvoice-policy.issueAfter` |
| R74 | KT/L | Mười ba trường hợp hóa đơn lập sai theo Thông tư 91/2026. Bản này hỗ trợ ba: điều chỉnh số tiền (chênh có dấu theo từng thuế suất, không để hóa đơn âm), thay thế (sửa thông tin người mua, giữ nguyên dòng và tiền), hủy (cần nhập lại mật khẩu). Hóa đơn gốc bị thay thế giữ "Đã xuất" cho tới khi nhà cung cấp xác nhận, theo thiết kế EIN-01/03. | Như mô tả; hóa đơn điều chỉnh không điều chỉnh tiếp | `application/corrections.ts` |
| R75 | K/KT | Lệnh đã có hóa đơn hợp lệ thì hủy lệnh, hoàn kho (FR-INV-022, I22) và hoàn tiền có bị chặn tới khi hủy/điều chỉnh hóa đơn không? Hiện EIN có `hasValidInvoice(orderId)` nhưng REC và INV chưa gọi. | Chưa nối; hóa đơn và lệnh độc lập | `hasValidInvoice` trong `modules/ein/index.ts` |
| R76 | KT/D | Hàng chờ lỗi: số lần thử, khoảng chờ, thời gian chờ nhà cung cấp. Chưa có bộ lập lịch: việc "tự thử lại" chạy qua API `POST /api/v1/ein/jobs/run-due` (một chi nhánh mỗi lần gọi) và nút ở màn hàng chờ. Cần Cloud Scheduler và tài khoản dịch vụ khi lên môi trường thật. | 5 lần; 5, 15, 60, 240, 720 phút; 30 giây | cấu hình `einvoice-policy`; hạ tầng |
| R77 | L/KT | Dữ liệu người mua nằm trên hóa đơn (tên, MST, địa chỉ, email) và trong tệp XML/PDF: không ẩn danh khi khách yêu cầu xóa (đã nêu ở BA §15 mục C10). Thời hạn lưu hóa đơn và tệp, và ai được tải tệp. | Giữ nguyên, không xóa; địa chỉ/email tách ở `invoicePii`, che theo vai trò, truy cập có nhật ký; tải tệp cần quyền `invoice:view` trong phạm vi | `application/read.ts` |
| R78 | D/Chủ | Ngân sách chỉ mục: slice 1.8 thêm MỘT chỉ mục (`invoices.byBranch`: chi nhánh + công ty + ngày tạo giảm dần), còn lại đọc theo khóa; tổng 191/200, ngưỡng cảnh báo 190, lỗi trên 195. Chừa ít nhất bốn chỉ mục cho 1.9. | Như mô tả; hạ tầng bổ sung (mục 6 của BA R68) không cần | `repos/queries.ts`, `scripts/check-indexes.ts` |
| R79 | KT | "Khách không lấy hóa đơn" (FR-EIN-009 `[Cần xác nhận]`): chưa bật; lệnh vẫn nằm trong danh sách chưa có hóa đơn. | Khóa, có ghi chú trên màn | `ein/warnings` |
| R80 | K | Gửi hóa đơn cho khách qua email/Zalo/SMS (FR-EIN-008, Should) chưa làm; email người mua được lưu sẵn. Danh sách lệnh chưa hóa đơn chỉ quét các lệnh hoàn tất mới nhất (tối đa 500), nói rõ khi còn nữa. | Chưa làm | `application/read.ts` |

Trạng thái trả lời của BA (`ba-answers-for-dev.md` §21, 04/11/2026):

| # | Trạng thái | Dev |
| --- | --- | --- |
| R69 | Đã trả lời: chỉ `fake` ở thử, cấm ở `live`, mẫu số/ký hiệu là dữ liệu của Khách; chờ Khách, Kế toán khách | Dev default OK |
| R70 | Đã trả lời: pilot chỉ Chủ garage có `invoice:approve`, theo người; chờ Chủ dự án | Dev default OK (kiểm tra `selfApproved`) |
| R71 | Đã trả lời: giữ `per-rate`, chặn khi lệch tổng lệnh; chờ Kế toán ký bảng ví dụ | Dev default OK |
| R72 | Đã trả lời: đổi mặc định sang chặn khi thuế suất lệch; chờ Kế toán khách, Luật sư khách | Dev must change |
| R73 | Đã trả lời: `issueAfter: qc`, cọc không tách, FR-EIN-012 chưa làm; chờ Kế toán khách | Dev default OK |
| R74 | Đã trả lời: ba trường hợp đủ cho pilot, còn lại xử lý ngoài hệ thống; chờ Kế toán, Luật sư khách | Dev default OK |
| R75 | Đã trả lời: chặn hủy lệnh, hoàn kho, hoàn tiền khi có hóa đơn hợp lệ, nối `hasValidInvoice` qua cổng; chờ Khách, Kế toán khách | Dev must change |
| R76 | Đã trả lời: giữ 5 lần/5-15-60-240-720 phút/30 giây; lập lịch khi lên môi trường thật; chờ Chủ dự án | Dev default OK |
| R77 | Đã trả lời: không ẩn danh, lưu tối thiểu 10 năm (chờ xác nhận), tải tệp có nhật ký; chờ Luật sư, Kế toán khách | Dev default OK (kiểm tra nhật ký tải) |
| R78 | Đã trả lời: chấp nhận 191/200, chừa ít nhất 4 cho 1.9 | Dev default OK |
| R79 | Đã trả lời: giữ khóa, không có ngoại lệ ngầm; chờ Kế toán khách | Dev default OK |
| R80 | Đã trả lời: chưa gửi, chỉ tải/in; trần quét 500 kèm "còn nữa"; chờ Khách | Dev default OK |


## Slice 1.9 (RPT báo cáo một chi nhánh): câu hỏi mới

Dev đã dựng FR-RPT-001, 003, 004 (mức tối thiểu), 011, 012, 013, 014 ở mức một chi nhánh: bản tổng hợp theo ngày, dashboard theo vai trò, báo cáo ngày, đi sâu chứng từ, cảnh báo ngoại lệ, job tổng hợp chạy lại được, xuất CSV có nhật ký. Cột "Giá trị tạm" là giá trị mã đang dùng; các ngưỡng là cấu hình có ngày hiệu lực `report-policy`, các giới hạn kỹ thuật nằm trong `RptConfig`. Mã tiếp theo là R93.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R81 | KT/Chủ | Định nghĩa "doanh thu ngày": tổng dòng công và phụ tùng đã duyệt của lệnh hoàn tất trong ngày, chưa thuế, theo ngày hoàn tất lệnh (không theo ngày thu tiền hay ngày xuất hóa đơn). Chênh giữa tổng lệnh gồm thuế và doanh thu chưa thuế hiện là "thuế và chênh lệch làm tròn" (gồm cả giảm giá cấp lệnh nếu có). Kế toán ký công thức và ví dụ (NFR-MNT-01). | Như mô tả; lệnh đã hủy không tính; lệnh bảo hành chưa có | `rpt/domain/rollup.ts` `computeDaily` |
| R82 | KT | Đối chiếu ngày (FR-RPT-003): "đã thu của lệnh hoàn tất + công nợ đang mở = tổng lệnh gồm thuế". Tiền cọc đã áp dụng tính là đã thu; công nợ đã tất toán không tính là nợ (vì tiền tất toán đã vào "đã thu"). Thu một phần của lệnh hoàn tất ở ngày khác vẫn nằm trong "đã thu" của lệnh đó. Đây có đúng cách đối chiếu mong muốn không, hay phải đối chiếu theo phiếu thu của chính ngày đó? | Theo lệnh hoàn tất trong ngày; phần chưa thu chưa ghi nợ hiện là "chênh lệch" và thành cảnh báo | `computeDaily`, `rpt-policy` |
| R83 | Chủ/QL | Ngưỡng cảnh báo ngoại lệ (cấu hình `report-policy`, có thể đặt riêng từng chi nhánh): lệnh mở quá bao nhiêu ngày; lệnh hoàn tất chưa hóa đơn từ ngày thứ mấy; chờ bao nhiêu ngày sau giao xe mới cảnh báo chưa thu; chênh lệch quỹ bao nhiêu thì báo. "Chênh lệch bất thường" hiện chỉ là ca đóng có chênh lệch quỹ lớn hơn ngưỡng. | 5 ngày; 1 ngày; 0 ngày; 0 ₫ (mọi chênh lệch) | `report-policy`, `recDemo.ts` |
| R84 | Chủ | Ai thấy phần nào: `report-dashboard:view` mở trang; số liệu từng khối bị cắt ở server theo quyền xem của phân hệ nguồn (lệnh, phiếu thu, công nợ, hóa đơn, kho, sổ quỹ); `report-daily:view` (doanh thu, tách công và phụ tùng) cho CH, QV, QL, KT; xuất CSV cho CH, QL, KT; chạy job cho CH, QL. Thủ kho và quản đốc có `repair-order:view` nên thấy số lệnh; thợ và quản trị hệ thống không có báo cáo. Cần chủ xác nhận từng vai trò. | Như mô tả, là mục bổ sung quyền `2026-11-rpt-1.9-reports` | `permissions.ts` |
| R85 | Chủ/QV | Góc nhìn hợp nhất của chủ chỉ cộng các tài liệu tổng hợp của từng chi nhánh trong phạm vi; không có báo cáo ngày hợp nhất (báo cáo ngày luôn của MỘT chi nhánh) và không có so sánh chi nhánh (FR-RPT-002). Nhiều pháp nhân: tổng chưa tách theo pháp nhân. | Như mô tả | `rpt/application/read.ts` |
| R86 | D/Chủ | Chưa có bộ lập lịch. `POST /api/v1/rpt/jobs/run-due` làm mới hôm nay và hôm qua, tạo ngày thiếu trong 7 ngày; ngày đã chốt (số chính thức) không bị job tự động đụng tới, chỉ `rebuild` mới dựng lại và có nhật ký. Cần Cloud Scheduler + tài khoản dịch vụ (cùng R76). Tần suất mong muốn (mỗi 15 phút giờ làm việc?) và độ trễ chấp nhận được của số tạm. | Chỉ gọi tay hoặc nút trên màn hình; không phát sinh tài liệu khi số liệu không đổi | `rpt/application/job.ts`, hạ tầng |
| R87 | D/Chủ | Bản tổng hợp được dựng bằng cách quét chứng từ nguồn (không cập nhật tăng dần trong giao dịch ghi chứng từ): lệnh quét tối đa 1.500 lệnh tạo trong 7 ngày trước ngày dựng, mọi danh sách có trần và báo "mức tối thiểu" khi chạm trần. Với 500 đến 800 xe mỗi ngày cần chuyển sang cập nhật tăng dần trong giao dịch (R68 quy tắc 3) hoặc tăng trần và lịch chạy. Chủ dự án xác nhận quy mô pilot (120 đến 200 xe mỗi ngày) đủ cho cách hiện tại. | `ordersScanMax` 1.500, `orderLookbackDays` 7, `scanMax` 500 | `RptConfig`, `rptWiring.ts` |
| R88 | Chủ/KT | Số tạm và số chính thức (FR-RPT-010 còn `[Cần xác nhận]`): hiện ngày đã "Chốt ngày" ở ACC là chính thức, còn lại là "Số tạm". Khi một phiếu đảo ghi vào ngày đang mở của ngày đã khóa (R62), số của ngày đã chốt không đổi; chỉ dựng lại thủ công (có nhật ký) mới đổi. | Như mô tả | `computeDaily`, `refreshDays` |
| R89 | QL/Chủ | Xuất báo cáo: chỉ CSV một chi nhánh, một ngày, mỗi lần ghi nhật ký `rollup.export`, không chứa tên khách hay số điện thoại. Excel, PDF (FR-RPT-009) chưa làm. Cần Excel/PDF trước pilot không, và có giới hạn số lần xuất mỗi ngày không. | Chỉ CSV | `rpt/application/export.ts` |
| R90 | K/Chủ | Báo cáo tháng, so sánh cùng kỳ, biểu đồ nâng cao, báo cáo lệnh sửa chữa đầy đủ (FR-RPT-012: thời gian hoàn thành trung bình, tỷ lệ đúng hạn), lợi nhuận gộp trừ giá vốn (FR-RPT-013 mới có công thức doanh thu, chưa có lợi nhuận), bộ lọc theo loại dịch vụ, nhân viên, nhóm doanh thu (FR-RPT-014 mới có bộ lọc ngày và chi nhánh): chưa làm. Thứ tự ưu tiên sau pilot? | Chưa làm | slice sau |
| R91 | KT/Luật sư | Báo cáo đối chiếu bốn chiều (lệnh, xuất kho, hóa đơn, thu tiền; FR-RPT-004 đầy đủ) chưa làm. Mức tối thiểu có: hóa đơn đã phát hành so với lệnh chưa hóa đơn, tiền đã thu so với tổng lệnh, số phiếu xuất kho không có chứng từ gốc (kỳ vọng bằng 0). Lệnh có phụ tùng nhưng không có phiếu xuất, hoặc phiếu xuất lớn hơn số đã duyệt, chưa được so. | Như mô tả | slice sau |
| R92 | D | Ngân sách chỉ mục: slice 1.9 thêm 0 chỉ mục (bản tổng hợp đọc theo khóa `<chi nhánh>_<ngày>`, tái dùng các hình truy vấn của lệnh, phiếu thu, công nợ, ca quỹ, hóa đơn, phiếu kho); tổng vẫn 191/200 (R78). | Như mô tả | `repos/queries.ts` |

### Slice 1.9: trạng thái trả lời

Trạng thái trả lời của BA (04/11/2026, chi tiết ở `ba-answers-for-dev.md` §22; Chủ dự án đã duyệt trước nguyên tắc theo đề xuất BA). Mọi giá trị tạm đổi được bằng cấu hình `report-policy`/`RptConfig` hoặc một dòng mã.

| # | Trạng thái | Dev |
| --- | --- | --- |
| R81 | Đã trả lời: giữ định nghĩa; tách dòng giảm giá cấp lệnh; thêm khối "thu trong ngày"; chờ Kế toán ký | Dev must change (nhỏ) |
| R82 | Đã trả lời: giữ đối chiếu theo lệnh, thêm đối chiếu theo phiếu thu của ngày; chờ Kế toán | Dev must change (nhỏ) |
| R83 | Đã trả lời: 5 ngày; 1 ngày; chưa thu đổi thành 1 ngày; chênh lệch quỹ 0 ₫, xem lại sau 2 tuần; chờ Chủ, Quản lý | Dev must change (cấu hình) |
| R84 | Đã trả lời: giữ phân quyền; không quyền nguồn thì không liên kết đi sâu; chờ Chủ dự án | Dev default OK (kiểm tra) |
| R85 | Đã trả lời: hợp nhất chỉ cộng bản tổng hợp; so sánh chi nhánh ngoài 1.9; hiện "tổng của N chi nhánh" | Dev default OK |
| R86 | Đã trả lời: 15 phút giờ làm việc và một lần cuối đêm; ngày chốt không bị job đụng; chờ Chủ dự án (Cloud Scheduler) | Dev default OK (nhãn giờ cập nhật) |
| R87 | Đã trả lời: đủ cho pilot một chi nhánh; trần quét thành cấu hình 3.000; chạm trần không được là số chính thức; cảnh báo 70% | Dev must change |
| R88 | Đã trả lời: giữ quy tắc; thêm dấu "có điều chỉnh sau chốt"; chờ Kế toán (FR-RPT-010) | Dev must change (nhỏ) |
| R89 | Đã trả lời: chỉ CSV ở pilot; giới hạn mềm 20 lần/người/ngày; chống chèn công thức, BOM | Dev must change (kiểm tra) |
| R90 | Đã trả lời: thứ tự FR-RPT-012, 007, 014, 013, tháng/cùng kỳ, 009, biểu đồ; chờ Chủ | Dev default OK (chưa làm) |
| R91 | Đã trả lời: mức tối thiểu cho pilot; thêm kiểm tra phụ tùng/phiếu xuất ở slice kế tiếp; chờ Kế toán | Dev default OK |
| R92 | Đã trả lời: chấp nhận 0 chỉ mục, tổng 191/200 | Dev default OK |

Dev must change (tóm tắt, chi tiết ở `ba-answers-for-dev.md` §22.5):

1. `computeDaily`: tách giảm giá cấp lệnh khỏi "thuế và chênh lệch làm tròn"; thêm khối "thu trong ngày" và đối chiếu B theo phiếu thu; test tổng ba dòng bằng tổng lệnh (R81, R82).
2. `report-policy`: mặc định chưa thu sau giao xe = 1 ngày; nhãn "Chênh lệch quỹ ca" (R83).
3. `RptConfig`: trần quét thành cấu hình (3.000), cờ "không đầy đủ" chặn nhãn chính thức và "Chốt ngày", cảnh báo 70% (R87).
4. Dấu "có điều chỉnh sau chốt" kèm chênh lệch; số chính thức không tự đổi (R88).
5. Xuất CSV: chống chèn công thức, UTF-8 BOM, giới hạn mềm 20 lần/người/ngày (R89).
6. Kiểm tra: ma trận vai trò và liên kết đi sâu (R84), nhãn "tổng của N chi nhánh" (R85), nhãn giờ cập nhật (R86).

## Slice 1.11 (SYS-007 nhập dữ liệu từ Excel): câu hỏi mới

Dev đã dựng công cụ nhập cho ba loại (khách và xe, danh mục phụ tùng, tồn đầu kỳ). Dev tiếp tục theo giá trị tạm dưới đây, không chờ trả lời.

| # | Gửi | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- | --- |
| R93 | Khách/BA | Mẫu Excel thật của khách (BA-20) chưa có. Mẫu tạm do dev định (cột tiếng Việt, tải được ở màn hình nhập); hệ thống tự khớp cột theo tên và cho chọn lại cột. Cần mẫu thật của từng chi nhánh để chốt tên cột và bí danh. | Mẫu tạm 3 loại | `crm/application/importer.ts`, `inv/application/importer.ts` |
| R94 | Khách | Giới hạn tệp: 5 MB và 2.000 dòng mỗi lô, ghi đồng bộ theo bước nhỏ (thiết kế G4-SYS-20 nêu 20 MB và 50.000 dòng, xử lý nền). Cần lô lớn hơn cho pilot không (cần hàng đợi nền, cùng R76/R86). | 5 MB, 2.000 dòng | `SysConfig.importMaxBytes/importMaxRows` |
| R95 | KT/QL | Tồn đầu kỳ: dev dùng phiếu điều chỉnh đầu kỳ (ADJ, nguồn "tồn đầu kỳ") đã có của slice 1.4, KHÔNG phải phiếu nhập GRN. Phiếu được tạo ở trạng thái nháp, người nhập không tự ghi sổ được (cần quản lý khác duyệt, giữ nguyên tách nhiệm). Mỗi 100 dòng là một phiếu. Hoàn tác: hủy nháp, hoặc đảo phiếu đã ghi sổ bằng phiếu đảo (RULE-010). Phụ tùng tính số lẻ (quantityScale khác 1) chưa nhập được bằng tệp. Đơn giá vốn là VND nguyên mỗi đơn vị. Có chấp nhận quy trình này không. | Như mô tả | `inv/application/importer.ts` |
| R96 | Chủ/QL | Hoàn tác khách và xe: xóa hẳn (không ẩn danh) chỉ khi bản ghi còn nguyên như lúc nhập (phiên bản 1, một chủ sở hữu, không phát sinh lệnh/khoản phải thu); bản ghi đã dùng hoặc sửa thì chặn cả lần hoàn tác và không xóa gì. Mã khách đã cấp số không được tái dùng (có khoảng trống). Hoàn tác danh mục phụ tùng bị chặn khi phụ tùng đã có lịch sử kho. | Như mô tả | `crm/application/importer.ts` |
| R97 | Khách | Trùng khách: một dòng một khách; các dòng cùng "Mã khách cũ" gộp thành một khách nhiều xe. Không có mã cũ thì không gộp theo số điện thoại (chỉ cảnh báo số điện thoại đã có ở khách khác, vẫn tạo mới). Biển số và số khung trùng với dữ liệu có sẵn là lỗi chặn. Cần quy tắc gộp khách trùng khi chuyển dữ liệu thật không. | Cảnh báo, không gộp | `crm/application/importer.ts` |
| R98 | Chủ | Quyền: `data-import` (xem, chạy/ghi, hoàn tác) cho CH, QL (chi nhánh mình), TK; mỗi loại còn cần quyền tạo của phân hệ (khách+xe, phụ tùng, phiếu kho). QĐ, KT, AD không có. Thiết kế G4-SYS-20 cho phép AD, KT nhập nhiều loại hơn; công nợ đầu kỳ, nhân sự, dịch vụ/bảng giá, lịch sử sửa chữa chưa làm. | Như mô tả | `sys/domain/permissions.ts` |
| R99 | Chủ/Luật sư | Báo cáo lỗi theo dòng không chứa giá trị ô (để không lộ dữ liệu cá nhân); dữ liệu dòng chờ ghi được lưu tạm và xóa sau khi ghi hoặc hoàn tác. Cần lưu tệp gốc để đối chiếu sau này không, và lưu bao lâu (liên quan thời hạn lưu). | Không lưu tệp gốc | `sys/application/dataImport.ts` |
| R100 | D | Ghi lô chạy theo bước nhỏ, mỗi bước là các giao dịch của phân hệ chủ; không có giao dịch xuyên suốt cả lô. Kiểm tra toàn tệp xảy ra trước khi ghi nên tệp lỗi không ghi gì; nếu giữa chừng xảy ra xung đột (người khác vừa tạo cùng biển số) lô dừng ở trạng thái "dừng giữa chừng", ghi tiếp được (khóa chống trùng theo lô) hoặc hoàn tác cả lô. Chỉ mục: +1 (lịch sử lô theo chi nhánh), tổng 192/200. | Như mô tả | `sys/application/dataImport.ts` |
