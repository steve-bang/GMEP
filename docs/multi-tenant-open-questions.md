# GMEP – Danh sách gom câu hỏi mở về multi-tenant

- **Phiên bản:** 1.1 · **Ngày:** 06/11/2026 · **Người lập:** BA · **Trạng thái:** bản gom; v1.1 ghi 4 quyết định của chủ dự án ngày 06/11/2026 (mục 1A), khuyến nghị BA cho Q37, Q38 (mục 1B, **chỉ là đề xuất**) và hai câu mới Q40, Q41 phát sinh từ các quyết định.
- **Nguồn gom:** Q1 đến Q35 trong `multi-tenant-analysis.md` (mục 18, Phụ lục B); C-01 đến C-28 trong `ui-ux/tenant-signup-spec.md` mục 5; C-S01 đến C-S24 trong `ui-ux/tenant-signup-simplified.md` mục 7 và 9.7; mục 7 của `adr/0002-multi-tenant.md`; mâu thuẫn M1, M7, M13 của analysis mục 19; câu mới Q36 đến Q39 (đánh dấu **MỚI**) do BA phát hiện khi gom.
- **Nguyên tắc:** BA nêu khuyến nghị, **không quyết thay** chủ dự án, khách, luật sư hay kế toán, và không chọn công nghệ thay dev. Một câu có khuyến nghị vẫn là câu mở cho tới khi người có thẩm quyền trả lời.
- **Cách tra:** đọc mục 1 (đã quyết) để khỏi hỏi lại; mục 2 đến 5 xếp theo **mức chặn**; mục 6 là việc cần dev tự trả lời (kết quả điều tra, không phải quyết định kinh doanh); mục 7 là câu để hỏi trong buổi làm việc tiếp theo.

Người trả lời: **CDA** chủ dự án (owner) · **KH** khách đầu tiên (tenant số 1) · **LS** luật sư (của chủ nền tảng hoặc của khách, ghi rõ) · **KT** kế toán (của khách, hoặc **KTN** kế toán của chủ nền tảng) · **DEV** dev.

---

## 1. Đã quyết, không hỏi lại

| Mã | Quyết định | Ngày, người | Ghi chú |
| --- | --- | --- | --- |
| D1 | Multi-tenant là yêu cầu thiết kế ngay từ đầu | 05/11/2026, khách/chủ dự án | Thay dòng "future, not built" cũ trong CLAUDE.md |
| D2 | Chủ garage khác tự đăng ký và tự triển khai | 05/11/2026, khách/chủ dự án | Nhân viên trong tenant vẫn không tự đăng ký, chỉ lời mời |
| D3 | Có gói dịch vụ để thu tiền; thu tiền làm sau, theo phase | 05/11/2026, khách/chủ dự án | Hệ quả: Q1 = SaaS dùng chung (S1), Q11 = tự đăng ký, Q5 một phần |

### 1A. Đã quyết ngày 06/11/2026 (chủ dự án)

Mã CD1 đến CD4 chỉ để tra trong các tài liệu; không nhầm với D1 đến D3 (khách, 05/11) hay "D1 đến D9" (feedback).

| Mã | Câu gốc | Quyết định | Hệ quả BA đã ghi vào tài liệu | Còn mở sau quyết định |
| --- | --- | --- | --- | --- |
| CD1 | C-S14 (gộp Q4, Q25, C-01) | **Một email có thể thuộc nhiều tenant**: một danh tính, nhiều tư cách thành viên (U2) | FR-TEN-016, 017 và RULE-026, 034 hết `[Cần xác nhận]`; **FR-TEN-017 nâng Could/MT-3 thành Must/MT-0** (nền: danh tính, tư cách thành viên, phiên chọn tenant); email là khóa danh tính duy nhất toàn nền tảng, mã nhân viên và mã khách vẫn duy nhất trong tenant (RULE-018); phiên vẫn đúng một tenant (RULE-026) | Q41 (quy tắc vận hành); cách mô hình hóa do dev (DEV-4, ADR 0002); C-S15 gần như tự giải (email đã có thì thêm tư cách thành viên, vẫn cần email xác nhận tới chủ hộp thư) |
| CD2 | Q21, Q34 (gộp C-06, C-23, C-25) | Tenant **không gán gói = miễn phí hoàn toàn**: không trial đếm ngược; thu tiền làm sau, gói chỉ là tùy chọn về sau | **RULE-035 mới**; FR-TEN-044 viết lại thành "Gói mặc định miễn phí" (không còn đồng hồ dùng thử); bỏ trạng thái `trial`, bỏ `expired` do hết dùng thử; bỏ nấc thang hết dùng thử; UAT-TEN-16 viết lại; copy "Dùng thử N ngày" bỏ | Q40 (giới hạn và tenant bỏ hoang, vì chi phí không còn được trial chặn: R-TEN-07, R-TEN-14 mới); C-S19 hết nghĩa; C-S20 đổi thành "điều kiện thay đổi dịch vụ miễn phí và áp phí về sau" (gộp vào Q38 và luật sư) |
| CD3 | Q36 (nâng C-14) | **Bỏ MFA cho vai trò nền tảng, tạm thời bỏ qua**; nhất quán với quyết định MFA ngoài phạm vi | Ghi là **rủi ro chấp nhận có thời hạn xem lại** (R-TEN-13 mới); giữ biện pháp bù: hai người duyệt thao tác nhạy cảm (RULE-027), nhật ký nền tảng bất biến (FR-TEN-013), phiên hỗ trợ có đồng ý (RULE-022); không thêm FR về MFA | Mốc xem lại: BA đề xuất **trước khi mở đăng ký cho người ngoài (MT-1)** và không muộn hơn một mốc ngày do chủ dự án chọn; chờ chủ dự án đặt ngày |
| CD4 | C-S24 | Tên sản phẩm = **GMEP** (bỏ GARAGE OS) | `brand.name` mặc định "GMEP" (FR-TEN-055 hết `[Cần xác nhận]`); designer đổi chữ trong prototype; Điều khoản/DPA nêu tên GMEP | Tên miền, tên pháp nhân bán dịch vụ vẫn là chuyện khác (Q6, Q12); tên hiển thị vẫn là hằng cấu hình, không viết cứng |

### 1B. Khuyến nghị BA cho Q37 và Q38 (ĐỀ XUẤT, chờ chủ dự án và luật sư xác nhận; chưa phải quyết định)

Chủ dự án giao BA tham khảo các hệ thống SaaS khác rồi gợi ý. Nguồn đã tra (ngắn gọn; chỉ nêu điều tìm thấy, không suy rộng):

- **Một email, nhiều tổ chức:** Atlassian dùng một tài khoản theo email truy cập nhiều site ([community.atlassian.com](https://community.atlassian.com/forums/Jira-questions/JIRA-Cloud-in-Slack-How-to-connect-a-different-JIRA-account/qaa-p/1513200), [jira.atlassian.com/browse/ID-6403](https://jira.atlassian.com/browse/ID-6403)); Notion liệt kê mọi workspace gắn với email trong bộ chuyển workspace, gói trả phí áp cho một workspace chứ không cho cả tài khoản ([notion.com/help](https://www.notion.com/help/create-delete-and-switch-workspaces)); Xero (nguồn bên thứ ba, chưa đối chiếu trợ giúp chính thức) cho một đăng nhập vào nhiều tổ chức, mời bằng đúng email ([hướng dẫn GRA](https://www.gra.co.nz/_downloads/Accept%20an%20Invite%20to%20use%20Xero.pdf)). Slack đi hướng khác: mỗi workspace là một tài khoản riêng dù cùng email ([suptask.com](https://www.suptask.com/blog/use-multiple-accounts-workspaces-slack)). Kết luận: CD1 (U2) khớp thông lệ Atlassian, Notion, Xero; cái giá là phải có quy tắc phiên và thu hồi theo tư cách (Q41). Shopify, Odoo, Zoho, MISA, KiotViet: **không tìm được nguồn đủ tin cậy**, BA không viết.
- **Giai đoạn đối tác thiết kế trước khi mở công khai:** mẫu Design Partner Agreement của Common Paper ([commonpaper.com](https://commonpaper.com/standards/design-partner-agreement/1.0/cover-page-and-standard-terms-pdf), [bài hướng dẫn](https://commonpaper.com/blog/how-to-work-with-design-partners)) và điều khoản của Ashby ([ashbyhq.com](https://www.ashbyhq.com/resources/terms-design-partner)): nhóm nhỏ chọn lọc, quyền lợi và nghĩa vụ (phản hồi, có thể không phí) ghi bằng văn bản, bổ sung cho hợp đồng dịch vụ chính, đối tác thoát được bất kỳ lúc nào, chương trình kết thúc hoặc chuyển sang điều khoản chuẩn khi phát hành rộng rãi. SaaStr ([saastr.com](https://www.saastr.com/dear-saastr-what-incentives-are-given-to-design-partners-and-other-super-early-customers)) nêu ưu đãi thường gặp (giá tốt, tiếp cận sớm). Các nguồn này không nói về dữ liệu cá nhân hay luật Việt Nam.
- **Gói miễn phí và dữ liệu:** Slack từ 26/08/2024 xóa dữ liệu cũ hơn một năm ở workspace miễn phí ([thestar.com.my](https://thestar.com.my/tech/tech-news/2024/07/01/slack-to-delete-chats-and-files-from-free-workspaces-at-end-of-august), [alternativeto.net](https://alternativeto.net/news/2024/8/slack-will-delete-content-older-than-one-year-for-free-plan-users-starting-august-26th)). GMEP không được làm vậy với hóa đơn, chứng từ (RULE-020, 021, 030); đây là lý do có Q40.
- **Luật Việt Nam:** Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (ban hành 31/12/2025, hiệu lực 01/01/2026); luật phân biệt bên kiểm soát, bên xử lý (xử lý theo yêu cầu của bên kiểm soát thông qua hợp đồng), bên kiểm soát và xử lý ([thuvienphapluat.vn](https://thuvienphapluat.vn/van-ban/Quyen-dan-su/Nghi-dinh-356-2025-ND-CP-huong-dan-Luat-Bao-ve-du-lieu-ca-nhan-687428.aspx), [PwC Việt Nam](https://www.pwc.com/vn/vn/publications/2026/20260128-new-rules-personal-data-protection.pdf), [EY Việt Nam](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/ey-vietnam-legal-alert-march-2026-decree-no356-2025-nd-cp-providing-detailed-guidance-for-implementation-of-personal-data-protection-law-viet.pdf)). Các điểm sau chỉ lấy từ trang tư vấn thứ cấp, **luật sư phải đối chiếu văn bản gốc**: phải lưu và chứng minh được thời điểm, nội dung đồng ý; phản hồi yêu cầu rút đồng ý, hạn chế, phản đối trong 02 ngày làm việc; chuyển dữ liệu ra nước ngoài siết chặt hơn; dịch vụ xử lý dữ liệu có thể cần điều kiện riêng ([luatvietan.vn](https://luatvietan.vn/diem-moi-cua-nghi-dinh-356-2025-so-voi-nghi-dinh-13-2023-ve-huong-dan-bao-ve-du-lieu-ca-nhan.html)).

**Q37, khuyến nghị (đề xuất): MT-0 xong và qua cổng trước go-live pilot; pilot chạy như đối tác thiết kế đóng; MT-1 build sau khi pilot ổn định.**

Lập luận, theo thứ tự:

1. **MT-0 trước go-live, không sau.** Dữ liệu hiện chỉ ở Emulator, chưa có dữ liệu thật; retrofit trục tenant vào mã, chỉ mục, khóa đánh số, khóa chống trùng hóa đơn rẻ nhất lúc này và đắt hơn nhiều sau khi có hóa đơn thật (R-TEN-09, FR-TEN-031). Đây cũng là điều kiện để tenant số 1 là một tenant thật ngay từ ngày đầu.
2. **Cổng vào go-live pilot (đề xuất, đo được):** FR-TEN-014 (ma trận cô lập hai tenant, seed hai tenant) đạt; FR-TEN-031 đạt (đối chiếu trước và sau, số chứng từ, khóa hóa đơn); FR-TEN-016, 017 đạt ở mức nền (một email hai tenant); `pnpm check:indexes` không vượt 195; hồ sơ Q38 đã ký.
3. **Không chạy MT-1 song song với pilot.** MT-1 (21 FR) phụ thuộc điều kiện ngoài tầm dev và chưa có: văn bản luật sư (Q8, Q30), văn bản của khách đầu tiên về dùng chung nền tảng (Q14), mức xác minh (Q28), chống lạm dụng (Q29), SLA và hỗ trợ (Q9, Q33), thử xâm nhập có ca "tenant độc hại" (NFR-TEN-08, slice 1.12 chưa làm). Mở đăng ký khi pilot chưa ổn nhân đôi nguồn sự cố và mở bề mặt tấn công đúng lúc hóa đơn thật của khách số 1 chạy lần đầu.
4. **Cách làm cho BA, luật sư vẫn chạy song song được:** trong lúc dev làm MT-0 và pilot, BA và luật sư chuẩn bị Điều khoản, DPA, mức xác minh, bộ copy; designer dựng lại màn đăng ký. Không tốn thời gian dev, nên không làm pilot trễ.
5. **Mở đăng ký theo hai nấc (đề xuất):** nấc 1 mời hoặc danh sách chờ, vài tenant, có hồ sơ đối tác thiết kế; nấc 2 đăng ký công khai sau khi UAT-TEN-05, 13, 14, 15, 21 và thử xâm nhập đạt. Cách này cũng giúp kiểm soát chi phí khi mọi tenant đều miễn phí (CD2, Q40).
6. **Mức trễ pilot chấp nhận (R-TEN-10):** BA không có ước lượng của dev nên **không đưa con số**. Đề nghị chủ dự án đặt trần sau khi DEV-10 (kế hoạch retrofit, M13) cho ước lượng MT-0 (15 FR sau CD1). Nếu vượt trần, **cắt theo thứ tự**, không cắt bốn nhóm cốt lõi (cô lập FR-TEN-009, 010, 014; tenant số 1 FR-TEN-031; đánh số FR-TEN-020; danh tính FR-TEN-016, 017): (a) FR-TEN-011, 013 chỉ ở mức vai trò nền tảng tối thiểu và nhật ký, **không có UI** (cấp phát tenant bằng quy trình nội bộ chạy lại được, FR-TEN-002); (b) FR-TEN-018 chỉ hai tầng (nền tảng, tenant) trước, Company và Branch giữ như hiện có; (c) FR-TEN-021 chỉ cho tenant số 1 trước khi phát hành hóa đơn thật. Mỗi mục cắt phải ghi nợ kỹ thuật vào `implementation-plan.md` §7.
7. **Khi nào đổi sang song song:** nếu chủ dự án có hẹn garage thứ hai tự đăng ký trong thời gian ngắn. Khi đó chỉ chuẩn bị phần MT-1 không đụng pilot (hồ sơ pháp lý, màn hình), vẫn không build MT-1 trước khi pilot qua cổng.

| Phương án | Ưu | Nhược, tác động |
| --- | --- | --- |
| A (khuyến nghị): MT-0, pilot đóng, rồi MT-1 | Rủi ro thấp nhất cho khách số 1; rẻ nhất cho retrofit; thời gian pháp lý trùng với thời gian pilot | Garage ngoài chưa vào được tới khi MT-1 xong; doanh thu từ tenant ngoài (khi có) lùi |
| B: MT-0 rồi MT-1 song song pilot | Mở đăng ký sớm hơn | Dev chia đôi, pilot dễ trễ và lỗi; luật sư chưa xong thì không mở được; chi phí tenant miễn phí chưa có hạn mức |
| C: MT-0 sau pilot | Pilot sớm nhất | Retrofit trên dữ liệu thật và hóa đơn thật (R-TEN-09, M7); **BA không khuyến nghị** |

**Q38, khuyến nghị (đề xuất): tenant số 1 là đối tác thiết kế đầu tiên; ký thỏa thuận riêng ngắn đi kèm chấp nhận Điều khoản và DPA bản chuẩn có phiên bản, trước khi nhập bất kỳ dữ liệu thật nào (kể cả nhập Excel).** Phần đánh dấu **[LS]** do luật sư soạn hoặc xác nhận, BA không viết thay.

1. **Cấu trúc hồ sơ tối thiểu (ba tài liệu):** (i) thỏa thuận đối tác thiết kế, bổ sung cho Điều khoản dịch vụ, theo mẫu như Common Paper, Ashby; (ii) Điều khoản dịch vụ bản chuẩn v1 (cùng bản tenant tự đăng ký sẽ nhận sau này, để tenant số 1 không là ngoại lệ trong mô hình dữ liệu của RULE-029, FR-TEN-037); (iii) thỏa thuận xử lý dữ liệu cá nhân (DPA) bản chuẩn v1. Lý do dùng bản chuẩn: một mô hình dữ liệu cho mọi tenant, không có "hợp đồng riêng" làm khó phiên bản và chấp nhận lại về sau.
2. **Vai trò theo Luật 91/2025/QH15 (hướng đề xuất, [LS] xác nhận):** tenant là **bên kiểm soát** dữ liệu cá nhân của khách, chủ xe, nhân viên của chính tenant; nền tảng là **bên xử lý**, xử lý theo hướng dẫn của tenant thông qua hợp đồng. Riêng dữ liệu tài khoản đăng nhập, nhật ký an ninh và vận hành do nền tảng tự quyết mục đích, nền tảng là **bên kiểm soát và xử lý** cho phần đó. Với danh tính một-nhiều (CD1), email và thông tin đăng nhập của một người thuộc nhiều tenant thuộc nhóm "nền tảng tự quyết", nên phải nêu trong DPA. **[LS]** Nếu chủ dự án và khách đầu tiên là cùng một pháp nhân (Q14 chưa trả lời) thì hồ sơ có thể gọn hơn nhưng vẫn cần phân định vai trò.
3. **Nội dung tối thiểu của DPA [LS]:** phạm vi, mục đích, loại dữ liệu (SĐT, địa chỉ, biển số, lịch sử sửa chữa, dữ liệu nhân viên, ảnh nếu có INS) và thời hạn; chỉ xử lý theo hướng dẫn của tenant; nhân sự nền tảng không truy cập ngoài phiên hỗ trợ có đồng ý (RULE-022); biện pháp bảo mật (cách ly tenant, che dữ liệu, nhật ký); thông báo sự cố cho tenant trong hạn do luật sư chốt (FR-TEN-036); danh sách bên xử lý phụ (nhà cung cấp hạ tầng đám mây, nhà cung cấp hóa đơn điện tử, SMS/Zalo; những nhà cung cấp tích hợp là của tenant theo RULE-024); chuyển dữ liệu ra nước ngoài vì dữ liệu đặt ở Singapore (ADR 0001 A3), điều kiện và hồ sơ theo luật; hỗ trợ tenant đáp ứng quyền của chủ thể dữ liệu trong hạn luật; trả dữ liệu rồi xóa khi chấm dứt, tôn trọng nghĩa vụ lưu hóa đơn, chứng từ của tenant (RULE-020, 021); quyền kiểm tra, bảo mật thông tin.
4. **Điều khoản thương mại của đối tác thiết kế (chủ dự án quyết, [LS] soạn):** miễn phí và không SLA cam kết ngoài mức công bố (NFR-AVA-01, 02 nếu chưa có cam kết khác); phản hồi; quyền thoát bất kỳ lúc nào kèm trả dữ liệu; nêu rằng điều kiện dịch vụ miễn phí có thể đổi và việc áp phí về sau (nếu có) báo trước một thời hạn và không xóa dữ liệu (đóng C-S20, RULE-030); dữ liệu thuộc tenant, mã nguồn và hạ tầng thuộc bên được xác định ở Q14; giới hạn trách nhiệm, luật áp dụng, giải quyết tranh chấp; quảng bá hay case study chỉ khi khách đồng ý riêng.
5. **"Có tính vào gói hay dùng thử không?"** Không: theo CD2 tenant số 1 ở gói mặc định miễn phí, không có đồng hồ; hồ sơ tenant ghi tham chiếu thỏa thuận (FR-TEN-001 đã có trường tham chiếu hợp đồng).
6. **Hệ quả thực hiện:** FR-TEN-037 thuộc MT-1, nhưng RULE-029 áp ngay cho tenant số 1. Đề xuất: ở MT-0 chỉ **ghi nhận thủ công** (tệp đã ký, người ký, ngày, phiên bản) vào hồ sơ tenant và chặn nhập dữ liệu thật tới khi có bản ghi này; chưa làm giao diện chấp nhận điện tử. Chờ chủ dự án xác nhận mới thêm vào FRD.
7. **Cái luật sư cần trả lời trước khi ký (gộp Q8, Q30, C-S02, C-S20 ở phạm vi tenant số 1):** vai trò hai bên như mục 2; mức chi tiết của DPA; điều kiện chuyển dữ liệu ra Singapore; nghĩa vụ báo sự cố và hạn; thỏa thuận ký tay hay điện tử cho tenant số 1; điều khoản đổi điều kiện một phía.

### 1C. Câu mới phát sinh từ các quyết định ngày 06/11/2026

| Mã | Câu hỏi | Ai | Phương án, khuyến nghị BA | Ảnh hưởng nếu chọn khác |
| --- | --- | --- | --- | --- |
| Q40 **MỚI** | Vì mọi tenant miễn phí và không còn đồng hồ dùng thử: (a) tenant miễn phí có giới hạn tối thiểu (số chi nhánh, số người dùng, dung lượng ảnh INS, tin SMS/Zalo) không; (b) tenant không hoạt động lâu thì xử lý ra sao | CDA | (a) có giới hạn mềm thấp, cảnh báo thay vì chặn, theo FR-TEN-015, 025 (RULE-023: không chặn hoàn tất chứng từ đang mở); (b) nhắc, rồi hạn chế tạo mới, rồi chỉ đọc theo thang RULE-030, **không xóa** (RULE-020, 021: hóa đơn, chứng từ phải còn tra được); mọi ngưỡng là tham số | Không giới hạn: chi phí hạ tầng không doanh thu tăng không trần (R-TEN-07, 14); xóa tenant bỏ hoang: trái RULE-020 và nghĩa vụ lưu hóa đơn |
| Q41 **MỚI** | Quy tắc vận hành cho một danh tính nhiều tư cách (CD1): (a) quên hoặc đổi mật khẩu áp mọi tenant của email; (b) tenant A vô hiệu hóa người dùng thì chỉ thu hồi tư cách A; (c) tenant A không được thấy email đó còn thuộc tenant nào khác; (d) nhân sự nền tảng dùng email riêng, không trùng email thành viên tenant (FR-TEN-011); (e) mời email đã có tài khoản: thêm tư cách thành viên sau khi người đó chấp nhận lời mời, không ghi đè mật khẩu | CDA, DEV (ADR), LS cho (c) | (a) có, một mật khẩu, email nêu rõ phạm vi; (b) có; (c) có, vì tiết lộ ràng buộc giữa các tenant là rò rỉ; (d) có; (e) có | Mỗi tenant một mật khẩu riêng quay về mô hình bị loại (CD1); không có (c): lộ quan hệ giữa các tenant; không có (d): vi phạm FR-TEN-011 |

**Chưa phải quyết định của khách:** feedback 06/11/2026 (QĐT-S01 đến S09, mã tắt "D1 đến D9" trong `tenant-signup-simplified.md` mục 9; **không nhầm với D1 đến D3 ở trên**) là phản hồi của một chủ garage nhỏ khi đi thử luồng, BA đã ghi thành đề xuất, chưa được khách, luật sư hay kế toán xác nhận chính thức. Bản tối giản (QĐT-S, FR-TEN-051 đến 055, RULE-033, 034) cũng là đề xuất BA.

---

## 2. Mức A: chặn ADR 0002 (dev không viết được ADR chính thức nếu thiếu)

| Mã | Câu hỏi | Ai trả lời | Khuyến nghị BA (chưa quyết thay) | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| Q3 | Hợp đồng, quy định hay khách mục tiêu nào đòi **tách dữ liệu vật lý**? Có cần hạng "khách lớn tách riêng"? | CDA, LS; DEV đánh giá | Trả lời hai câu nghiệp vụ trước (có đòi tách không; có hạng khách lớn không); sau đó dev so A/B/C theo tiêu chí mục 6 của analysis kèm đo chỉ mục | Chọn A/B/C; FR-TEN-006, 007, 009, 034; mọi slice |
| Q2 | Số tenant sau 12 và 24 tháng, quy mô điển hình, thời điểm tenant thứ hai | CDA | Cần con số; trả lời cùng Q3 | Ít tenant lớn nghiêng B/C, nhiều tenant nhỏ nghiêng A; NFR-TEN-06 |
| Q4, Q25, C-01, C-S14 | **ĐÃ QUYẾT 06/11/2026 (CD1, mục 1A): một email thuộc nhiều tenant, một danh tính, nhiều tư cách thành viên.** Phần còn lại là việc của dev: mô hình hóa danh tính, tư cách thành viên, phiên, thu hồi (DEV-4) và quy tắc vận hành Q41 | DEV (ADR), CDA (Q41) | Xem Q41 | FR-TEN-016, 017; RULE-026, 034; TSU-14, 15; UAT-TEN-07, 21 |
| Q14 | Chủ dự án và khách đầu tiên có cùng một bên không? Khách có đồng ý nền tảng phục vụ garage khác trên cùng hạ tầng? Ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 §12 mục #2 chưa trả lời)? | CDA, KH | Cần văn bản của khách đầu tiên trước ADR và trước mở đăng ký | Không đồng ý: tách hạ tầng cho khách đầu tiên (đổi Q3, Q26) hoặc dừng hướng dùng chung |
| Q26 | Cấp phát tenant tự động trên Firebase/GCP cần tạo gì, giới hạn số lượng, độ trễ, chi phí cố định mỗi tenant (kể cả tenant không trả tiền), vùng dữ liệu, ai sở hữu tổ chức GCP và tài khoản thanh toán | DEV (spike), CDA | Yêu cầu nghiệp vụ: không bước thủ công, vài phút, chi phí cố định gần 0 khi chưa trả tiền, xuất/xóa/khôi phục riêng được (NFR-TEN-05, R-TEN-07) | FR-TEN-002, 042; NFR-TEN-05 |
| Q12, Q32 | Pháp nhân nào phát hành hóa đơn tiền dịch vụ; VAT cho dịch vụ phần mềm trực tuyến; thời điểm lập; hộ kinh doanh; dùng thử có hóa đơn không | CDA, KTN, LS | Chỉ chặn ADR ở mức hook: lưu thông tin người mua đã xác minh, số liệu tiền của nền tảng tách khỏi sổ tenant; thuế là cấu hình có hiệu lực theo ngày | RULE-025, 031; FR-TEN-048 |
| Q27 | Hướng thu tiền: billing trong hay ngoài hệ thống ở MT-2; không lưu thông tin thẻ | CDA, KTN | Chỉ cần định hướng cho ADR; **không lưu thông tin thẻ**; chọn nhà cung cấp ở MT-3 | Hook thuê bao, đối soát; FR-TEN-047 |
| Q37 **MỚI** | **Thứ tự và mức đánh đổi:** MT-0 chạy cùng Phase 1 pilot; MT-1 (mở đăng ký) song song hay sau pilot ổn định? Chấp nhận pilot trễ bao nhiêu vì retrofit tenant (R-TEN-10)? | CDA | **Chủ dự án giao BA gợi ý (06/11/2026); khuyến nghị đầy đủ ở mục 1B, vẫn chờ chủ dự án xác nhận:** MT-0 xong và qua cổng trước go-live pilot, pilot đóng như đối tác thiết kế, MT-1 build sau khi pilot ổn định; mức trễ chấp nhận do chủ dự án đặt sau ước lượng của DEV-10 | Kế hoạch slice; M13 |
| M1 (BA đã nêu yêu cầu, dev xác nhận) | `companyId` hiện là ranh giới ngoài cùng trong mã và chỉ mục; khi có tenant thì khóa đánh số, mã nhân viên, mã khách, `CRON_COMPANY_ID` gắn **tenant** hay **Company** | DEV | Yêu cầu nghiệp vụ (RULE-016, 018): mã và khóa chống trùng duy nhất **trong tenant**; `Company` giữ nghĩa pháp nhân. Dev quyết cách ánh xạ từ `companyId` hiện có | Mọi repository, chỉ mục, seed |

---

## 3. Mức B: chặn build (xếp theo đợt)

### 3.1 Chặn build MT-0 (nền, cùng Phase 1)

| Mã | Câu hỏi | Ai | Khuyến nghị BA | FR bị chặn |
| --- | --- | --- | --- | --- |
| Q24, C-16 | Số người và nhóm vai trò nền tảng thực tế; thao tác nào cần hai người duyệt; ma trận quyền nền tảng (đề xuất ở FRD §2, mục "Ma trận quyền nền tảng") | CDA | Hai người cho ngưng, chấm dứt, xóa, truy cập khẩn cấp (RULE-027); duyệt ca đăng ký bị cờ là một người ngoài danh sách (QĐT-38) | FR-TEN-011, 013 |
| Q36 (nâng C-14) | **ĐÃ QUYẾT 06/11/2026 (CD3, mục 1A): bỏ MFA cho vai trò nền tảng, tạm thời bỏ qua; rủi ro chấp nhận có thời hạn xem lại (R-TEN-13).** Còn chờ chủ dự án đặt mốc ngày xem lại | CDA | Giữ hai người duyệt (RULE-027) và nhật ký nền tảng làm biện pháp bù | FR-TEN-011; TSU-60; NFR-TEN-08 |
| K2 (ba-answers) | Dãy số chứng từ theo chi nhánh hay pháp nhân | KT, KH | Theo tenant, rồi theo phạm vi cấu hình; chốt khi khách trả lời | FR-TEN-020 |
| Q38 **MỚI** | **Tenant số 1** chấp nhận điều khoản và DPA theo bản chuẩn (như tenant tự đăng ký) hay theo hợp đồng riêng? Có tính vào gói/dùng thử không? | CDA, KH, LS | RULE-029 đòi chấp nhận phiên bản điều khoản trước dữ liệu thật, kể cả tenant số 1; cần trả lời trước go-live pilot. **Chủ dự án giao BA gợi ý; khuyến nghị ở mục 1B, chờ chủ dự án và luật sư:** thỏa thuận đối tác thiết kế ngắn + Điều khoản và DPA bản chuẩn v1, ký trước dữ liệu thật; "có tính vào dùng thử không" đã được CD2 trả lời (không, gói mặc định miễn phí) | FR-TEN-031, 037 |

### 3.2 Chặn build MT-1 (tự phục vụ có kiểm soát)

| Mã | Câu hỏi | Ai | Khuyến nghị BA | FR, màn bị chặn |
| --- | --- | --- | --- | --- |
| Q28, C-07, C-S01 | Mức xác minh tenant: nguồn tra MST, có cần giấy đăng ký, xác thực người đại diện, tự động hay duyệt tay, nhận hộ kinh doanh hay cá nhân, ngoại lệ RULE-032 (nhượng quyền, nhiều thương hiệu cùng pháp nhân), đường khiếu nại | CDA, LS, DEV | Tra MST tự động + duyệt tay ca bị cờ; nếu chưa có nguồn: cho dùng ứng dụng, **khóa phát hành hóa đơn thật** (RULE-028) | FR-TEN-040; TSX-30 |
| Q29, C-08, C-23 (một phần) | Chống lạm dụng: chỉ nhận từ Việt Nam?, trần tenant mới mỗi giờ/ngày, chi phí tối đa cho tenant chưa trả tiền, danh sách chặn | CDA | Trần thấp lúc đầu, tăng dần theo số liệu | FR-TEN-041; NFR-TEN-07 |
| C-S23 | Ngưỡng tự bật kiểm tra người thật (`bot_check.always`) | CDA | Đặt tham số, rà sau 2 tuần | FR-TEN-041 |
| Q21, Q34, C-06, C-25, C-23 | **ĐÃ QUYẾT 06/11/2026 (CD2, mục 1A): tenant không gán gói = miễn phí hoàn toàn, không trial đếm ngược; thu tiền làm sau, gói là tùy chọn về sau.** Hết nghĩa: thời lượng trial, mốc đồng hồ, nấc thang hết dùng thử. Còn mở: giới hạn tenant miễn phí và tenant bỏ hoang (Q40) | CDA (Q40), LS | RULE-030 vẫn là sàn (không xóa dữ liệu) cho nợ phí về sau | FR-TEN-044 (viết lại); TSX-01, TSU-41, BAN-A (bỏ chữ "dùng thử") |
| C-S04, C-15 | Tenant `active` ngay sau TSX-10 với hóa đơn `fake`, không có môi trường thử tách dữ liệu (đổi FR-TEN-030 cho đường tự đăng ký)? | CDA, DEV | Có; hóa đơn `fake`, dữ liệu mẫu gắn cờ `sample` | FR-TEN-030, 004, 043 |
| C-S05 | Suy loại hình từ độ dài MST (10 số doanh nghiệp, 12 số hộ kinh doanh/cá nhân) | KT, LS | Suy ra, rà bằng bước tra MST | TSX-01 |
| C-12 | Định dạng MST được nhận, có kiểm tra chữ số kiểm tra, xử lý MST 13 số | KT, LS | Là cấu hình ở TSU-66 | V-MST |
| C-S06, C-13 | SĐT bắt buộc ở TSX-10; có xác thực OTP không | CDA | Bắt buộc, không OTP | TSX-10 |
| C-S02, C-S07, C-02 | Câu đồng ý một câu ngắn kèm bản đầy đủ có đủ giá trị bằng chứng không; tư cách "người đại diện hợp pháp" đặt ở đâu; nội dung Điều khoản | LS | Gộp tư cách người đại diện vào bản đầy đủ; luật sư soạn bản chuẩn có phiên bản | TSX-01; RULE-029 |
| C-S09 | Nội dung gói dịch vụ và phụ tùng mẫu, giá minh họa; ai soạn; gói đồng sơn chỉ gắn nhãn tới khi khảo sát | KH (garage mẫu), CDA | Có giá mẫu gắn nhãn, nhắc xem lại trước khi in báo giá đầu tiên | TSX-11 |
| C-S10 | UI nhiều chi nhánh/kho hiện tự động theo số lượng (≥ 2) hay có công tắc riêng | CDA | Tự động theo số lượng | FR-TEN-051 |
| C-S11 | Chính sách lưu trữ "đã xem" thỏa bằng liên kết trong ô DPA | LS | Chấp nhận | FR-TEN-004 |
| C-S12 | CH trong tổ chức một chi nhánh có đủ quyền vai trò QL để duyệt chiết khấu, chi vượt hạn mức (RULE-011) | CDA | Có, theo ma trận FRD §2; kiểm lại | FR-TEN-051 |
| C-S13 | Thuế suất, đánh số, kỳ mặc định lấy từ cấu hình hiệu lực theo ngày; kế toán ký duyệt giá trị mặc định (NFR-MNT-01); riêng thuế suất xác nhận một lần trước hóa đơn thật | KT, DEV | Có | FR-TEN-052 |
| Q16 | Danh mục pháp lý do nền tảng cập nhật chung; tenant ghi đè không; ai chịu trách nhiệm đúng/sai; bộ ví dụ kiểm thử | CDA, KT | Nền tảng chịu trách nhiệm, tenant không ghi đè giá trị luật định | FR-TEN-019 |
| Q10 | Nhân sự nền tảng xem gì, khi nào; thời hạn phiên hỗ trợ | CDA, LS | Chỉ phiên hỗ trợ có đồng ý; khẩn cấp có người duyệt thứ hai | FR-TEN-012 |
| C-S16 | Cách tiêu thụ liên kết một lần để phần mềm quét thư không làm hỏng liên kết (GET hiện trang, POST tiêu thụ) | DEV | Như QĐT-S02 | FR-TEN-053 |
| C-S17 | Biện pháp bù rủi ro liên kết bị chuyển tiếp: nhập lại mật khẩu cho đổi email/mật khẩu, xuất dữ liệu, hóa đơn thật; có rút ngắn 72 giờ không | CDA, bảo mật | Có nhập lại mật khẩu; giữ 72 giờ làm tham số, xem lại sau pilot | FR-TEN-053 |
| C-S15 | Email đã có tài khoản đăng ký garage mới: thêm vào tài khoản hiện có hay chặn. **Nay theo CD1:** thêm tư cách thành viên vào danh tính hiện có, không ghi đè mật khẩu; còn mở đúng cách bảo đảm người đăng ký là chủ hộp thư (Q41 e) | CDA, LS | Thêm, kèm email nói rõ cho chủ hộp thư; phản hồi ở màn đăng ký vẫn trung lập | FR-TEN-039 |
| C-S18 | Giá trị thật `support.phone`, `support.zalo`, `support.hours`, `support.email` dự phòng; ai trực | CDA | Cung cấp trước khi mở đăng ký | FR-TEN-054 |
| C-S21 | "Phần mềm khác": chỉ ghi nhận hay có dịch vụ chuyển dữ liệu | CDA | Chỉ ghi nhận | FR-TEN-043 |
| C-S22 | Hóa đơn bản thử mang dấu "BẢN THỬ, không có giá trị hóa đơn" | KT, LS | Có | FR-TEN-004; EIN |
| C-17 | Cơ chế chống bot, nguồn tra MST, cách cấp phát ảnh hưởng thời gian cấp phát (NFR-TEN-05) | DEV | Spike | FR-TEN-042 |
| C-18, C-19, C-20 (= Q39 **MỚI**), C-26 | Không thu email khi đóng đăng ký (đã tạm QĐT-33); thời hạn giữ hồ sơ bị từ chối; tenant tự đổi mã công ty (mã nay chỉ là mã hỗ trợ, QĐT-S01); số lượt khiếu nại, hạn bổ sung, `tracking_token_days` | CDA | Theo cột khuyến nghị ở spec mục 5; mã công ty không đổi ở giai đoạn đầu | TSU-01, 09, 10 |
| C-21 | Tháng bắt đầu kỳ kế toán mặc định, định dạng xuất kỳ cuối | KT | Mặc định tháng 1 | cấu hình |
| C-24 | MH, NS là vai trò riêng (đã bổ sung vào FRD §2 ngày 06/11/2026); cho CH thứ hai không; QV mặc định ẩn | CDA | Giữ QĐT-21; không cho CH thứ hai ở bản đầu | TSX-11 |
| C-S03 | Đã **thay thế** bởi QĐT-S02 (liên kết một lần tự đăng nhập bất kể trình duyệt) | – | – | – |

---

## 4. Mức C: chặn go-live (pilot tenant số 1, hoặc mở đăng ký cho người ngoài)

| Mã | Câu hỏi | Ai | Khuyến nghị BA | Chặn |
| --- | --- | --- | --- | --- |
| Q8, C-03 | Vai trò bên kiểm soát/bên xử lý dữ liệu, DPA, chuyển dữ liệu ra nước ngoài (Singapore, ADR 0001 A3 mới duyệt cho tenant số 1), thông báo sự cố, hiệu lực Luật 91/2025 với doanh nghiệp nhỏ | LS | Văn bản của luật sư trước khi mở đăng ký | Mở đăng ký (MT-1) |
| Q30, C-02 | Hiệu lực chấp nhận điện tử (click-wrap), người có thẩm quyền, bằng chứng lưu, đổi điều khoản một phía, luật áp dụng, giới hạn trách nhiệm | LS | Luật sư soạn bản chuẩn có phiên bản | Mở đăng ký |
| Q14 | Văn bản của khách đầu tiên về dùng chung nền tảng và nơi đặt hạ tầng (đã ở mức A) | CDA, KH | – | Mở đăng ký |
| Q38 **MỚI** | Tenant số 1 chấp nhận điều khoản/DPA thế nào (đã ở mức B, MT-0) | CDA, KH, LS | – | Go-live pilot |
| Q31 | Hóa đơn điện tử theo từng tenant: nhà cung cấp nào tích hợp sẵn, ai trả phí, nền tảng có làm đại lý không, nơi giữ bí mật và chứng thư số của tenant | CDA, DEV, KT | Tenant tự có nhà cung cấp và chứng thư; nền tảng không phát hành thay (RULE-025) | Phát hành hóa đơn thật cho tenant ngoài |
| Q9, Q23, Q33, C-11 | SLA, RPO/RTO, giờ và kênh hỗ trợ, hỗ trợ có tính phí không, mức hỗ trợ khi chưa thu phí | CDA | Công bố mức tối thiểu trước khi mở; giữ NFR-AVA-01, 02 nếu chưa có cam kết khác | Mở đăng ký |
| C-S18, C-S19, C-S20 | Hotline/Zalo thật. **C-S19 hết nghĩa** (không còn "hết dùng thử", CD2). **C-S20 đổi:** Điều khoản nêu điều kiện thay đổi dịch vụ miễn phí và việc áp phí về sau (báo trước, không xóa dữ liệu), gộp vào Q38 | CDA, LS | Bỏ lọc "Sắp hết dùng thử" ở TSX-30 | Mở đăng ký |
| Q35 | Đối tượng tenant mục tiêu: chỉ chuỗi garage hay cả garage đơn lẻ, hộ kinh doanh | CDA | Chỉ Việt Nam; phạm vi do owner chọn | Xác minh, quota nhỏ nhất |
| C-S24 | **ĐÃ QUYẾT 06/11/2026 (CD4, mục 1A): tên sản phẩm = GMEP.** Điều khoản và DPA ghi tên GMEP | CDA | – | – |
| C-S08 | Hoãn màn chấp nhận lại điều khoản (TSU-18, TSU-67): **không công bố bản điều khoản thứ hai trước khi dựng** | LS, CDA | Hoãn có điều kiện | Công bố điều khoản bản 2 |
| C-10, C-27, C-28, C-09, C-23 | Yêu cầu chấm dứt bằng điện tử có đủ giá trị không; chuỗi xác nhận; CH vắng mặt thì ai tải gói xuất; thời hạn giữ dữ liệu khi tenant miễn phí không hoạt động (gộp Q40); nấc thang hết dùng thử **bỏ** (CD2) | LS, CDA | Điện tử có xác nhận qua email; chỉ qua hỗ trợ có xác minh danh tính | Tenant đầu tiên chấm dứt hoặc bị hạn chế |
| Q7, Q20 | Chấm dứt: định dạng gói xuất, thời hạn tải, thời hạn nền tảng còn giữ, chính sách lưu trữ mặc định theo loại dữ liệu | CDA, KT, LS | Hai bước: trả dữ liệu rồi xóa theo chính sách đã xác nhận; mặc định không xóa | FR-TEN-006, 007 |
| Hạng mục kiểm thử | UAT-TEN-05, 13, 14, 15, 21 đạt; thử xâm nhập có kịch bản "tenant độc hại" (NFR-TEN-08); khôi phục một tenant đã thử (UAT-TEN-12) | DEV, CDA | – | Mở đăng ký |

---

## 5. Mức D: chặn thu tiền (MT-2, MT-3); mức E: không chặn

### 5.1 Mức D

| Mã | Câu hỏi | Ai | Khuyến nghị BA |
| --- | --- | --- | --- |
| Q13, C-04 | Gói và hạn mức: chiều tính, ngưỡng cảnh báo, mềm hay cứng, giá đã gồm VAT chưa | CDA | Bắt đầu một đến hai chiều (số chi nhánh, số người dùng) |
| Q12, Q32, C-05 | Pháp nhân, VAT, hóa đơn nền tảng (đã nêu ở mức A) | CDA, KTN, LS | Thuế là cấu hình có hiệu lực theo ngày |
| Q27 | Nhà cung cấp thanh toán cụ thể | CDA, KTN | Khảo sát ở MT-3 |
| C-22 | Hạ gói: chặn hay cảnh báo | CDA | Chặn |
| Q5 (phần còn mở) | Giá, cổng thanh toán, VAT | CDA | Xem các dòng trên |

### 5.2 Mức E: không chặn sớm

Q6 (thương hiệu, tên miền con hay riêng; liên quan Q25), Q15 (phạm vi địa lý), Q17 (chỉ cấu hình, không mã riêng theo tenant: BA suy ra từ D2, chờ xác nhận), Q18 (phát hành phiên bản, nhóm thử), Q19 (chia sẻ dữ liệu giữa tenant; khuyến nghị không, RULE-017), Q22 (sáp nhập, tách tenant; khuyến nghị xuất và nhập), Q10 phần benchmark (FR-TEN-038, MT-3). (C-S14 phần UI "đổi công ty" nay thuộc FR-TEN-017, đã quyết CD1.)

---

## 6. Câu dev tự trả lời (điều tra kỹ thuật, không phải quyết định kinh doanh)

Đây là danh sách để ADR 0002 chính thức trả lời. BA chỉ nêu ràng buộc nghiệp vụ ở `docs/dev/multi-tenant-requirements-for-dev.md`.

| # | Câu | Ràng buộc nghiệp vụ liên quan | Phụ thuộc |
| --- | --- | --- | --- |
| DEV-1 | Phương án cô lập nào đạt cả bảy tiêu chí ở mục 7 của tài liệu dev (rò rỉ, xuất/xóa/khôi phục riêng, chi phí tenant nhỏ, cấp phát tự động, hiệu năng công bằng, hạn mức chỉ mục, di chuyển một tenant ra riêng) | RULE-016, 017; FR-TEN-009, 034 | Q2, Q3, Q26 |
| DEV-2 | Ảnh hưởng của trục tenant lên ngân sách chỉ mục 193/200 (ngưỡng fail 195) theo từng phương án; bằng chứng đo bằng `pnpm check:indexes` | Không được nâng trần (ba-answers câu 40) | DEV-1 |
| DEV-3 | Ánh xạ `companyId` hiện có sang tenant và/hoặc Company (M1) | RULE-018 | Q3 |
| DEV-4 | Định danh (đã quyết CD1: một danh tính, nhiều tư cách thành viên): tách vùng danh tính nền tảng khỏi vùng danh tính tenant (FR-TEN-011), mô hình tư cách thành viên, phiên chọn một tenant, thu hồi phiên theo tư cách, ánh xạ tài khoản hiện có thành danh tính + tư cách thành viên của tenant số 1 | RULE-026, 034; FR-TEN-016, 017 | Q41 |
| DEV-5 | Cấp phát tự động idempotent, chạy lại không trùng, đo thời gian cấp phát (spike) | FR-TEN-002, 042; NFR-TEN-05 | Q26 |
| DEV-6 | Giữ nguyên số chứng từ đã cấp và khóa chống phát hành trùng hóa đơn không hết hạn khi chuyển dữ liệu hiện có thành tenant số 1 (M7); kế hoạch quay lui | FR-TEN-031; FR-EIN-013 | – |
| DEV-7 | URL ký và đường dẫn tệp có tenant (M9); tác vụ nền chạy theo tenant, không chặn nhau (M8) | FR-TEN-009, 015 | DEV-1 |
| DEV-8 | Cách phân biệt dữ liệu thử và thật khi nhập Excel (C-15), nếu C-S04 không được chấp nhận | FR-TEN-029, 030 | C-S04 |
| DEV-9 | Cơ chế chống bot và nguồn tra MST (C-17), liên kết một lần (C-S16) | FR-TEN-040, 041, 053 | Q28 |
| DEV-10 | Kế hoạch retrofit các slice 0.3 đến 1.11 và slice MT-0 vào `implementation-plan.md` §7 (M13) | NFR-TEN-01 | Q37 |

---

## 7. Gợi ý nhóm câu cho buổi làm việc tiếp theo

1. **Với chủ dự án (nửa ngày):** Q2, Q3 (hai câu nghiệp vụ), Q14, Q37 (xác nhận khuyến nghị 1B, đặt trần trễ pilot), Q24, Q12/Q27 (ở mức hướng), Q40, Q41, mốc ngày xem lại MFA nền tảng (CD3). (Q4/Q25/C-S14, Q36, Q21/Q34, C-S24 đã quyết 06/11/2026.)
2. **Với khách đầu tiên:** Q14, Q38 (thỏa thuận đối tác thiết kế, mục 1B), K2 (dãy số), C-S09 (nội dung gói mẫu), C-S12.
3. **Với luật sư:** Q38 (mục 1B, các điểm [LS]: vai trò bên kiểm soát/xử lý, chuyển dữ liệu ra Singapore, báo sự cố), Q8, Q30, C-S02/S07, C-S08, C-S20 (đã đổi), Q7, Q28 (ngoại lệ RULE-032), C-S15, Q41 (c).
4. **Với kế toán:** Q12/Q32 (kế toán nền tảng), Q16, Q20, C-S13, C-S22, C-S05.
5. **Với dev:** DEV-1 đến DEV-10; thứ tự đề nghị: DEV-3, DEV-1, DEV-2 trước.
