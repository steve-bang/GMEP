# GMEP – Danh sách gom câu hỏi mở về multi-tenant

- **Phiên bản:** 1.0 · **Ngày:** 06/11/2026 · **Người lập:** BA · **Trạng thái:** bản gom, chưa có câu nào được trả lời thêm so với các nguồn.
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

**Chưa phải quyết định của khách:** feedback 06/11/2026 (QĐT-S01 đến S09, mã tắt "D1 đến D9" trong `tenant-signup-simplified.md` mục 9; **không nhầm với D1 đến D3 ở trên**) là phản hồi của một chủ garage nhỏ khi đi thử luồng, BA đã ghi thành đề xuất, chưa được khách, luật sư hay kế toán xác nhận chính thức. Bản tối giản (QĐT-S, FR-TEN-051 đến 055, RULE-033, 034) cũng là đề xuất BA.

---

## 2. Mức A: chặn ADR 0002 (dev không viết được ADR chính thức nếu thiếu)

| Mã | Câu hỏi | Ai trả lời | Khuyến nghị BA (chưa quyết thay) | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| Q3 | Hợp đồng, quy định hay khách mục tiêu nào đòi **tách dữ liệu vật lý**? Có cần hạng "khách lớn tách riêng"? | CDA, LS; DEV đánh giá | Trả lời hai câu nghiệp vụ trước (có đòi tách không; có hạng khách lớn không); sau đó dev so A/B/C theo tiêu chí mục 6 của analysis kèm đo chỉ mục | Chọn A/B/C; FR-TEN-006, 007, 009, 034; mọi slice |
| Q2 | Số tenant sau 12 và 24 tháng, quy mô điển hình, thời điểm tenant thứ hai | CDA | Cần con số; trả lời cùng Q3 | Ít tenant lớn nghiêng B/C, nhiều tenant nhỏ nghiêng A; NFR-TEN-06 |
| Q4, Q25, C-01, C-S14 | Định danh đăng nhập: một người thuộc nhiều tenant? email duy nhất toàn nền tảng hay chỉ trong tenant? cách xác định tenant khi đăng nhập? Mô hình: (a) một thông tin đăng nhập cho mỗi email, nhiều tư cách thành viên; (b) mỗi tenant một tài khoản riêng | CDA, DEV (ADR) | Hướng (a) như C-S14, **không** buộc email duy nhất cho tư cách thành viên, phiên gắn đúng một tenant. Đây là khuyến nghị; QĐT-S01 mới chỉ là đề xuất | FR-TEN-016, 017; RULE-026, 034; TSU-14, 15; UAT-TEN-07, 21 |
| Q14 | Chủ dự án và khách đầu tiên có cùng một bên không? Khách có đồng ý nền tảng phục vụ garage khác trên cùng hạ tầng? Ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 §12 mục #2 chưa trả lời)? | CDA, KH | Cần văn bản của khách đầu tiên trước ADR và trước mở đăng ký | Không đồng ý: tách hạ tầng cho khách đầu tiên (đổi Q3, Q26) hoặc dừng hướng dùng chung |
| Q26 | Cấp phát tenant tự động trên Firebase/GCP cần tạo gì, giới hạn số lượng, độ trễ, chi phí cố định mỗi tenant (kể cả tenant không trả tiền), vùng dữ liệu, ai sở hữu tổ chức GCP và tài khoản thanh toán | DEV (spike), CDA | Yêu cầu nghiệp vụ: không bước thủ công, vài phút, chi phí cố định gần 0 khi chưa trả tiền, xuất/xóa/khôi phục riêng được (NFR-TEN-05, R-TEN-07) | FR-TEN-002, 042; NFR-TEN-05 |
| Q12, Q32 | Pháp nhân nào phát hành hóa đơn tiền dịch vụ; VAT cho dịch vụ phần mềm trực tuyến; thời điểm lập; hộ kinh doanh; dùng thử có hóa đơn không | CDA, KTN, LS | Chỉ chặn ADR ở mức hook: lưu thông tin người mua đã xác minh, số liệu tiền của nền tảng tách khỏi sổ tenant; thuế là cấu hình có hiệu lực theo ngày | RULE-025, 031; FR-TEN-048 |
| Q27 | Hướng thu tiền: billing trong hay ngoài hệ thống ở MT-2; không lưu thông tin thẻ | CDA, KTN | Chỉ cần định hướng cho ADR; **không lưu thông tin thẻ**; chọn nhà cung cấp ở MT-3 | Hook thuê bao, đối soát; FR-TEN-047 |
| Q37 **MỚI** | **Thứ tự và mức đánh đổi:** MT-0 chạy cùng Phase 1 pilot; MT-1 (mở đăng ký) song song hay sau pilot ổn định? Chấp nhận pilot trễ bao nhiêu vì retrofit tenant (R-TEN-10)? | CDA | BA không quyết; đề nghị MT-0 trước go-live pilot, MT-1 sau pilot ổn định (ý kiến BA, chưa xác nhận) | Kế hoạch slice; M13 |
| M1 (BA đã nêu yêu cầu, dev xác nhận) | `companyId` hiện là ranh giới ngoài cùng trong mã và chỉ mục; khi có tenant thì khóa đánh số, mã nhân viên, mã khách, `CRON_COMPANY_ID` gắn **tenant** hay **Company** | DEV | Yêu cầu nghiệp vụ (RULE-016, 018): mã và khóa chống trùng duy nhất **trong tenant**; `Company` giữ nghĩa pháp nhân. Dev quyết cách ánh xạ từ `companyId` hiện có | Mọi repository, chỉ mục, seed |

---

## 3. Mức B: chặn build (xếp theo đợt)

### 3.1 Chặn build MT-0 (nền, cùng Phase 1)

| Mã | Câu hỏi | Ai | Khuyến nghị BA | FR bị chặn |
| --- | --- | --- | --- | --- |
| Q24, C-16 | Số người và nhóm vai trò nền tảng thực tế; thao tác nào cần hai người duyệt; ma trận quyền nền tảng (đề xuất ở FRD §2, mục "Ma trận quyền nền tảng") | CDA | Hai người cho ngưng, chấm dứt, xóa, truy cập khẩn cấp (RULE-027); duyệt ca đăng ký bị cờ là một người ngoài danh sách (QĐT-38) | FR-TEN-011, 013 |
| Q36 **MỚI** (nâng C-14) | Vai trò nền tảng có quyền rất cao nhưng MFA đang ngoài phạm vi (`StrongAuthPort` trống). Có đề nghị owner cân nhắc **ngoại lệ riêng cho vai trò nền tảng** không? | CDA | Khuyến nghị cân nhắc ngoại lệ; nếu không, ghi rủi ro chấp nhận và giữ hai người duyệt | FR-TEN-011; TSU-60; NFR-TEN-08 |
| K2 (ba-answers) | Dãy số chứng từ theo chi nhánh hay pháp nhân | KT, KH | Theo tenant, rồi theo phạm vi cấu hình; chốt khi khách trả lời | FR-TEN-020 |
| Q38 **MỚI** | **Tenant số 1** chấp nhận điều khoản và DPA theo bản chuẩn (như tenant tự đăng ký) hay theo hợp đồng riêng? Có tính vào gói/dùng thử không? | CDA, KH, LS | RULE-029 đòi chấp nhận phiên bản điều khoản trước dữ liệu thật, kể cả tenant số 1; cần trả lời trước go-live pilot | FR-TEN-031, 037 |

### 3.2 Chặn build MT-1 (tự phục vụ có kiểm soát)

| Mã | Câu hỏi | Ai | Khuyến nghị BA | FR, màn bị chặn |
| --- | --- | --- | --- | --- |
| Q28, C-07, C-S01 | Mức xác minh tenant: nguồn tra MST, có cần giấy đăng ký, xác thực người đại diện, tự động hay duyệt tay, nhận hộ kinh doanh hay cá nhân, ngoại lệ RULE-032 (nhượng quyền, nhiều thương hiệu cùng pháp nhân), đường khiếu nại | CDA, LS, DEV | Tra MST tự động + duyệt tay ca bị cờ; nếu chưa có nguồn: cho dùng ứng dụng, **khóa phát hành hóa đơn thật** (RULE-028) | FR-TEN-040; TSX-30 |
| Q29, C-08, C-23 (một phần) | Chống lạm dụng: chỉ nhận từ Việt Nam?, trần tenant mới mỗi giờ/ngày, chi phí tối đa cho tenant chưa trả tiền, danh sách chặn | CDA | Trần thấp lúc đầu, tăng dần theo số liệu | FR-TEN-041; NFR-TEN-07 |
| C-S23 | Ngưỡng tự bật kiểm tra người thật (`bot_check.always`) | CDA | Đặt tham số, rà sau 2 tuần | FR-TEN-041 |
| Q21, Q34, C-06, C-25, C-23 | Dùng thử hay early access; thời lượng; mốc bắt đầu đồng hồ; số ngày mỗi nấc thang hết hạn; xử lý khi còn xe nằm xưởng. **Lưu ý:** bản tối giản (QĐT-S04) chỉ hiển thị "Dùng thử" và đã ngầm chọn `trial` | CDA, LS | Quyết trước khi mở đăng ký để Điều khoản nêu đúng; mọi số là tham số cấu hình; RULE-030 là sàn (không xóa dữ liệu) | FR-TEN-044; TSX-01, TSU-41, BAN-A |
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
| C-S15 | Email đã có tài khoản đăng ký garage mới: thêm vào tài khoản hiện có hay chặn | CDA, LS | Thêm, kèm email nói rõ cho chủ hộp thư | FR-TEN-039 |
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
| C-S18, C-S19, C-S20 | Hotline/Zalo thật; quy trình "bạn sẽ được liên hệ" sau hết dùng thử (ai, kênh, bao lâu); Điều khoản nêu việc điều kiện sử dụng sau dùng thử sẽ thỏa thuận | CDA, LS | Lọc "Sắp hết dùng thử" ở TSX-30 và nhắc nội bộ | Mở đăng ký |
| Q35 | Đối tượng tenant mục tiêu: chỉ chuỗi garage hay cả garage đơn lẻ, hộ kinh doanh | CDA | Chỉ Việt Nam; phạm vi do owner chọn | Xác minh, quota nhỏ nhất |
| C-S24 | Tên sản phẩm chính thức (GARAGE OS hay GMEP) trước khi công bố; đổi sau thì Điều khoản/DPA đã chấp nhận ghi tên cũ | CDA | Chốt trước khi có tenant ngoài | Công bố |
| C-S08 | Hoãn màn chấp nhận lại điều khoản (TSU-18, TSU-67): **không công bố bản điều khoản thứ hai trước khi dựng** | LS, CDA | Hoãn có điều kiện | Công bố điều khoản bản 2 |
| C-10, C-27, C-28, C-09, C-23 | Yêu cầu chấm dứt bằng điện tử có đủ giá trị không; chuỗi xác nhận; CH vắng mặt thì ai tải gói xuất; thời hạn giữ dữ liệu khi không chọn gói; nấc thang hết dùng thử | LS, CDA | Điện tử có xác nhận qua email; chỉ qua hỗ trợ có xác minh danh tính | Tenant đầu tiên hết dùng thử hoặc chấm dứt |
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

Q6 (thương hiệu, tên miền con hay riêng; liên quan Q25), Q15 (phạm vi địa lý), Q17 (chỉ cấu hình, không mã riêng theo tenant: BA suy ra từ D2, chờ xác nhận), Q18 (phát hành phiên bản, nhóm thử), Q19 (chia sẻ dữ liệu giữa tenant; khuyến nghị không, RULE-017), Q22 (sáp nhập, tách tenant; khuyến nghị xuất và nhập), Q10 phần benchmark (FR-TEN-038, MT-3), C-S14 phần UI "đổi công ty" nếu U2.

---

## 6. Câu dev tự trả lời (điều tra kỹ thuật, không phải quyết định kinh doanh)

Đây là danh sách để ADR 0002 chính thức trả lời. BA chỉ nêu ràng buộc nghiệp vụ ở `docs/dev/multi-tenant-requirements-for-dev.md`.

| # | Câu | Ràng buộc nghiệp vụ liên quan | Phụ thuộc |
| --- | --- | --- | --- |
| DEV-1 | Phương án cô lập nào đạt cả bảy tiêu chí ở mục 7 của tài liệu dev (rò rỉ, xuất/xóa/khôi phục riêng, chi phí tenant nhỏ, cấp phát tự động, hiệu năng công bằng, hạn mức chỉ mục, di chuyển một tenant ra riêng) | RULE-016, 017; FR-TEN-009, 034 | Q2, Q3, Q26 |
| DEV-2 | Ảnh hưởng của trục tenant lên ngân sách chỉ mục 193/200 (ngưỡng fail 195) theo từng phương án; bằng chứng đo bằng `pnpm check:indexes` | Không được nâng trần (ba-answers câu 40) | DEV-1 |
| DEV-3 | Ánh xạ `companyId` hiện có sang tenant và/hoặc Company (M1) | RULE-018 | Q3 |
| DEV-4 | Định danh: tách vùng danh tính nền tảng khỏi vùng danh tính tenant (FR-TEN-011), mô hình tư cách thành viên (C-S14), thu hồi phiên theo tenant | RULE-026, 034 | Q4, Q25 |
| DEV-5 | Cấp phát tự động idempotent, chạy lại không trùng, đo thời gian cấp phát (spike) | FR-TEN-002, 042; NFR-TEN-05 | Q26 |
| DEV-6 | Giữ nguyên số chứng từ đã cấp và khóa chống phát hành trùng hóa đơn không hết hạn khi chuyển dữ liệu hiện có thành tenant số 1 (M7); kế hoạch quay lui | FR-TEN-031; FR-EIN-013 | – |
| DEV-7 | URL ký và đường dẫn tệp có tenant (M9); tác vụ nền chạy theo tenant, không chặn nhau (M8) | FR-TEN-009, 015 | DEV-1 |
| DEV-8 | Cách phân biệt dữ liệu thử và thật khi nhập Excel (C-15), nếu C-S04 không được chấp nhận | FR-TEN-029, 030 | C-S04 |
| DEV-9 | Cơ chế chống bot và nguồn tra MST (C-17), liên kết một lần (C-S16) | FR-TEN-040, 041, 053 | Q28 |
| DEV-10 | Kế hoạch retrofit các slice 0.3 đến 1.11 và slice MT-0 vào `implementation-plan.md` §7 (M13) | NFR-TEN-01 | Q37 |

---

## 7. Gợi ý nhóm câu cho buổi làm việc tiếp theo

1. **Với chủ dự án (nửa ngày):** Q2, Q3 (hai câu nghiệp vụ), Q4/Q25/C-S14, Q14, Q37, Q24, Q36, Q12/Q27 (ở mức hướng), Q21/Q34 (trial hay early access).
2. **Với khách đầu tiên:** Q14, Q38, K2 (dãy số), C-S09 (nội dung gói mẫu), C-S12.
3. **Với luật sư:** Q8, Q30, C-S02/S07, C-S08, C-S20, Q7, Q28 (ngoại lệ RULE-032), C-S15.
4. **Với kế toán:** Q12/Q32 (kế toán nền tảng), Q16, Q20, C-S13, C-S22, C-S05.
5. **Với dev:** DEV-1 đến DEV-10; thứ tự đề nghị: DEV-3, DEV-1, DEV-2 trước.
