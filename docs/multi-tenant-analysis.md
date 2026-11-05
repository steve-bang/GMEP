# GMEP – Phân tích nghiệp vụ Multi-tenant (BA)

- **Trạng thái:** Nháp BA, chưa được chủ dự án hay khách xác nhận. Tính năng tương lai, **chưa build, chưa nằm trong phạm vi hiện tại** (CLAUDE.md, mục "Multi-tenant").
- **Ngày:** 05/11/2026
- **Người viết:** BA
- **Tài liệu liên quan:** [BRD](business-requirements.md) · [FRD](functional-requirements.md) · [User journey](user-journey-business-workflow.md) · [ADR 0002 (nháp kỹ thuật)](adr/0002-multi-tenant.md) · [ADR 0001](adr/0001-tech-stack.md) · [ba-answers-for-dev](dev/ba-answers-for-dev.md) · [open-questions-for-ba](dev/open-questions-for-ba.md)
- **Quy ước:** mọi điểm chưa chốt ghi `[Cần xác nhận: ai]`. Tài liệu này không chọn công nghệ và không giả định đáp án cho các điểm đó. Mã `FR-TEN-xxx`, `BR-TEN-xx`, `RULE-016` đến `RULE-027`, `NFR-TEN-xx`, `UAT-TEN-xx` là **mã đề xuất**, chưa nhập vào FRD/BRD; đã kiểm tra không trùng mã hiện có (RULE hiện đến 015, UAT đến 26, FR-SYS đến 018 trong FRD; dev đã tạm dùng FR-SYS-019 đến 032 và UAT-27 đến 31 trong `ba-answers-for-dev.md`, nên nhóm mới dùng tiền tố riêng để khỏi đụng mã).

## Mục lục

1. [Tóm tắt và kết luận chính](#1-tóm-tắt-và-kết-luận-chính)
2. [Thuật ngữ và ranh giới khái niệm](#2-thuật-ngữ-và-ranh-giới-khái-niệm)
3. [Mô hình kinh doanh và các phương án](#3-mô-hình-kinh-doanh-và-các-phương-án)
4. [Actor mới và phân tách quyền](#4-actor-mới-và-phân-tách-quyền)
5. [Vòng đời tenant (state machine)](#5-vòng-đời-tenant-state-machine)
6. [Cô lập dữ liệu](#6-cô-lập-dữ-liệu)
7. [Cấu hình theo tenant](#7-cấu-hình-theo-tenant)
8. [Gói dịch vụ, quota và billing](#8-gói-dịch-vụ-quota-và-billing)
9. [Onboarding và chuyển dữ liệu Excel theo tenant](#9-onboarding-và-chuyển-dữ-liệu-excel-theo-tenant)
10. [Người dùng và định danh](#10-người-dùng-và-định-danh)
11. [Báo cáo cấp nền tảng](#11-báo-cáo-cấp-nền-tảng)
12. [Audit, dữ liệu cá nhân, pháp lý và lưu trữ](#12-audit-dữ-liệu-cá-nhân-pháp-lý-và-lưu-trữ)
13. [Tác động lên các module hiện có](#13-tác-động-lên-các-module-hiện-có)
14. [Yêu cầu đề xuất: BR, RULE, FR, NFR](#14-yêu-cầu-đề-xuất-br-rule-fr-nfr)
15. [User journey chính](#15-user-journey-chính)
16. [Kịch bản nghiệm thu đề xuất (UAT-TEN)](#16-kịch-bản-nghiệm-thu-đề-xuất-uat-ten)
17. [Phân đợt và điều kiện bắt đầu](#17-phân-đợt-và-điều-kiện-bắt-đầu)
18. [Điểm `[Cần xác nhận]` và câu hỏi cho owner/khách](#18-điểm-cần-xác-nhận-và-câu-hỏi-cho-ownerkhách)
19. [Mâu thuẫn, khoảng trống phát hiện trong tài liệu hiện có](#19-mâu-thuẫn-khoảng-trống-phát-hiện-trong-tài-liệu-hiện-có)
20. [Danh sách chỉnh sửa đề xuất cho các tài liệu khác](#20-danh-sách-chỉnh-sửa-đề-xuất-cho-các-tài-liệu-khác)
21. [Ma trận truy vết](#21-ma-trận-truy-vết)

---

## 1. Tóm tắt và kết luận chính

1. **Multi-tenant khác "nhiều pháp nhân".** Nhiều pháp nhân (FR-SYS-018) là chuyện *trong* một chuỗi garage; tenant là một *khách hàng độc lập của nền tảng*, dữ liệu tách hoàn toàn khỏi tenant khác (đồng nhất với ADR 0002 §1).
2. **Câu hỏi chặn lớn nhất không phải kỹ thuật mà là thương mại và hợp đồng.** Tài liệu hiện chưa nói rõ: (a) chủ dự án là ai so với khách đầu tiên, (b) khách đầu tiên có đồng ý dùng chung nền tảng với garage khác không, (c) dự án GCP/Firebase thuộc tổ chức nào (ADR 0001 §12, mục #2 "cấp dự án GCP/Firebase thuộc tổ chức của khách" vẫn **chưa trả lời**). Nếu hạ tầng thuộc tổ chức của khách đầu tiên thì việc phục vụ tenant khác trên đó cần thỏa thuận riêng. Xem Q1, Q2, Q14 ở mục 18.
3. **Chưa thể chốt mô hình cô lập từ phía BA.** BA chỉ nêu yêu cầu nghiệp vụ (không rò rỉ chéo tenant, xuất/xóa/khôi phục riêng một tenant, hạn mức riêng). Phương án A/B/C của ADR 0002 §3 được chọn sau khi có số tenant, yêu cầu hợp đồng và ý kiến luật sư (Q3).
4. **Xóa dữ liệu khi chấm dứt va chạm trực tiếp với nghĩa vụ lưu trữ hóa đơn và chứng từ** (RULE-010, NFR-DAT-01, BRD mục 7) và với quyền xóa dữ liệu cá nhân (Luật 91/2025/QH15). Đề xuất quy trình hai bước: trả dữ liệu cho tenant, rồi mới xóa hoặc ẩn danh theo chính sách lưu trữ có xác nhận; mặc định không xóa (khớp ba-answers §8.1). Thời hạn và vai trò pháp lý (bên kiểm soát/bên xử lý dữ liệu) `[Cần xác nhận: Luật sư]`.
5. **Hai vai trò mới tách hẳn khỏi 10 vai trò trong tenant:** nhóm vai trò nền tảng (platform owner, super admin, hỗ trợ, vận hành billing). Nhân sự nền tảng mặc định **không** xem dữ liệu nghiệp vụ của tenant; truy cập hỗ trợ phải có lý do, thời hạn, phạm vi và hiển thị cho tenant (mở rộng nguyên tắc ghi chú FRD mục 2: "Quản trị hệ thống... không xem được dữ liệu nhạy cảm").
6. **Khái niệm `Company` đang bị dùng cho hai nghĩa** trong tài liệu và dev docs (xem mục 2 và 19). Cần chốt thuật ngữ trước khi viết FR chính thức.
7. **Đề xuất:** 8 BR (BR-TEN-01 đến 08), 12 RULE (RULE-016 đến 027), 38 FR nhóm mới FR-TEN-001 đến 038 (20 Must, 13 Should, 5 Could), 6 NFR-TEN, 12 UAT-TEN. Phân thành 4 đợt (mục 17), đợt đầu chỉ cần cho tenant thứ hai chạy dưới hình thức *cấp phát thủ công do vận hành nền tảng thực hiện*, chưa cần tự đăng ký hay billing tự động.
8. **Điều đã làm được ngay (không tốn chức năng):** kỷ luật ở ADR 0002 §4 và kiểm tra ở mục 19 (bảng rà soát mã/định danh theo công ty).

## 2. Thuật ngữ và ranh giới khái niệm

| Thuật ngữ | Định nghĩa đề xuất | Nguồn / ghi chú |
| --- | --- | --- |
| Nền tảng (Platform) | Hệ thống GMEP và tổ chức vận hành nó | Mới |
| Chủ nền tảng (Platform owner) | Pháp nhân/cá nhân sở hữu và bán dịch vụ GMEP | Mới. Quan hệ với "Chủ dự án" và "Khách" hiện nay chưa rõ (Q14) |
| Tenant | Một khách hàng độc lập của nền tảng; một ranh giới dữ liệu, cấu hình, người dùng, hợp đồng | ADR 0002 §1 |
| Company (pháp nhân) | Đơn vị pháp lý trong một tenant; một tenant có từ một Company trở lên; mỗi Company có đơn vị phát hành hóa đơn riêng | FR-SYS-018, BR-EIN-04 |
| Branch / Warehouse | Đơn vị vận hành trong Company | FR-SYS-005, 011 |
| Quản trị tenant (Tenant admin) | Vai trò AD hiện có (Quản trị hệ thống) nhưng phạm vi là **một tenant** | FRD mục 2; BRD mục 5 ghi "Toàn hệ thống" cần sửa thành "toàn tenant" |
| Nhân sự nền tảng | Tài khoản thuộc tổ chức vận hành nền tảng, không thuộc tenant nào | Mới |
| Bên kiểm soát / bên xử lý dữ liệu | Vai trò theo luật bảo vệ dữ liệu cá nhân: giả thuyết tenant là bên kiểm soát, nền tảng là bên xử lý | `[Cần xác nhận: Luật sư]` (Q8) |

**Quan hệ phân cấp đề xuất:** Platform → Tenant → Company → Branch → Warehouse. Điểm cần xử lý: trong tài liệu hiện có `companyId` đang đóng vai trò "ranh giới ngoài cùng" (ví dụ mã nhân viên duy nhất theo `companyId`, ba-answers dòng 118; `CRON_COMPANY_ID` ở deploy-guide; khóa dãy số `(companyId, phạm vi, loại, kỳ)` ở ba-answers §6). Khi một tenant có nhiều pháp nhân, các khóa đó phải gắn với **tenant** hay với **Company** là quyết định thiết kế cần BA và dev làm rõ trước (xem mục 19, mâu thuẫn M1).

## 3. Mô hình kinh doanh và các phương án

Tài liệu hiện có không nêu mô hình thương mại. Các phương án để owner chọn (Q1):

| # | Mô hình | Mô tả | Hệ quả nghiệp vụ chính |
| --- | --- | --- | --- |
| S1 | SaaS thuê bao dùng chung | Nhiều chuỗi garage dùng cùng một bản chạy, cấu hình riêng | Cần quota, billing, vận hành nền tảng, SLA chung, nâng cấp đồng loạt |
| S2 | Triển khai riêng cho từng khách (managed) | Mỗi khách một bản chạy do chủ nền tảng vận hành | Ít cần cô lập trong ứng dụng nhưng chi phí vận hành tăng theo số khách; gần với hiện trạng |
| S3 | Cấp phép phần mềm và khách tự vận hành | Khách tự lo hạ tầng | Ngoài phạm vi multi-tenant; chỉ nêu để loại trừ |
| S4 | Lai (S1 cho khách nhỏ, S2 cho khách lớn hoặc yêu cầu pháp lý) | | Cần đồng thời hai mô hình vận hành |

BA không khuyến nghị mô hình, vì dữ liệu để quyết (số tenant, giá, hợp đồng) chưa có. Mọi FR-TEN dưới đây viết trung tính với S1, S2, S4 ở mức hành vi nhìn thấy được.

Giả thuyết cần kiểm chứng (không đưa vào FR): khách mục tiêu là chuỗi garage vừa và nhỏ tại Việt Nam, có bài toán giống khách đầu tiên (BRD mục 2). Chưa có khảo sát thị trường trong tài liệu `[Cần xác nhận: Chủ dự án]`.

## 4. Actor mới và phân tách quyền

### 4.1 Actor nền tảng (mới)

| Actor | Mô tả | Được làm | Không được làm (mặc định) |
| --- | --- | --- | --- |
| Chủ nền tảng (Platform owner) | Người chịu trách nhiệm kinh doanh nền tảng | Duyệt tạo/ngưng/chấm dứt tenant, xem báo cáo cấp nền tảng, duyệt cấp quyền hỗ trợ đặc biệt | Xem dữ liệu nghiệp vụ tenant |
| Quản trị nền tảng (Platform super admin) | Vận hành kỹ thuật và cấu hình nền tảng | Tạo tenant, cấp phát, đổi gói, cấu hình mặc định nền tảng, danh mục pháp lý dùng chung | Xem dữ liệu nghiệp vụ, đăng nhập thay người dùng tenant |
| Hỗ trợ nền tảng (Platform support) | Hỗ trợ tenant | Xem thông tin tenant ở mức hồ sơ và trạng thái, mở phiên hỗ trợ có kiểm soát khi tenant cho phép | Truy cập ngoài phiên hỗ trợ đã được cấp; xem dữ liệu cá nhân chưa che |
| Vận hành billing nền tảng | Lập kỳ thanh toán cho tenant | Xem gói, mức dùng, công nợ tenant | Xem dữ liệu nghiệp vụ |

Chi tiết quyền chính xác là ma trận quyền nền tảng (FR-TEN-011) `[Cần xác nhận: Chủ dự án]`.

### 4.2 Actor trong tenant (giữ nguyên, thêm ranh giới)

- 10 vai trò hiện có và 4 vai trò bổ sung bản 0.2 (FRD mục 2) giữ nguyên, nay luôn nằm **trong một tenant**.
- **Chủ garage (CH)** của tenant là người ký hợp đồng thương mại với chủ nền tảng (giả thuyết) và duyệt các thao tác nhạy cảm cấp tenant: mời quản trị tenant, đồng ý cho hỗ trợ truy cập, yêu cầu chấm dứt. `[Cần xác nhận: Chủ dự án]`.
- **Quản trị hệ thống (AD)** trở thành "quản trị tenant": cấu hình trong tenant, không thấy dữ liệu nhạy cảm (FRD mục 2), không có quyền nền tảng nào.

### 4.3 Bên ngoài (mới hoặc thay đổi so với BRD mục 5)

| Bên | Thay đổi |
| --- | --- |
| Nhà cung cấp hóa đơn điện tử | Mỗi tenant (và mỗi Company) có thể dùng nhà cung cấp, tài khoản và chứng thư khác nhau (RULE-024) |
| Nhà cung cấp SMS/Zalo | Như trên, theo tenant |
| Nhà cung cấp hạ tầng | Chịu chung nhiều tenant; ảnh hưởng đến hợp đồng bảo mật |
| Cơ quan quản lý dữ liệu cá nhân | Liên quan khi có sự cố; vai trò của nền tảng với tenant (Q8) |

## 5. Vòng đời tenant (state machine)

Đây là bộ trạng thái của một đối tượng thứ sáu, **tách biệt** với năm đối tượng hiện có (báo giá, lệnh, hạng mục, thanh toán, hóa đơn), đúng nguyên tắc "không dùng một trạng thái chung".

### 5.1 Trạng thái

| Trạng thái | Ý nghĩa | Người dùng tenant | Dữ liệu |
| --- | --- | --- | --- |
| Đã đề xuất (`proposed`) | Có yêu cầu hoặc hợp đồng, chưa cấp phát | Chưa có | Chỉ hồ sơ tenant |
| Đang cấp phát (`provisioning`) | Đang tạo không gian dữ liệu, cấu hình mặc định, tài khoản chủ | Chưa đăng nhập | Đang khởi tạo |
| Cấp phát lỗi (`provision_failed`) | Một bước không hoàn tất | Không | Có thể thử lại hoặc hủy |
| Đang triển khai (`onboarding`) | Đã có tenant, đang cấu hình, nhập Excel, huấn luyện; môi trường thử hóa đơn (`fake`/test) | Đăng nhập được, không phát hành hóa đơn thật | Đầy đủ |
| Hoạt động (`active`) | Dùng thật | Đầy đủ theo gói và quyền | Đầy đủ |
| Hạn chế (`restricted`) | Vi phạm hạn mức hoặc quá hạn thanh toán; chỉ chặn tạo mới theo chính sách | Làm tiếp chứng từ đang mở; không tạo mới theo cấu hình | Đầy đủ |
| Tạm ngưng (`suspended`) | Chủ nền tảng hoặc tenant tạm dừng | Mặc định chỉ đọc và tải dữ liệu; hoặc chặn hoàn toàn nếu lý do an ninh | Giữ nguyên |
| Đang chấm dứt (`terminating`) | Đã nhận yêu cầu chấm dứt; giai đoạn trả dữ liệu | Chỉ đọc và tải xuất dữ liệu | Giữ nguyên, tạo gói xuất |
| Đã chấm dứt (`terminated`) | Hết dịch vụ, chờ hết thời hạn giữ | Không đăng nhập (trừ cổng tải lưu trữ nếu có, Q7) | Khóa, chỉ giữ phần luật yêu cầu |
| Đã xóa (`purged`) | Đã xóa hoặc ẩn danh theo chính sách; còn bằng chứng xóa | Không | Chỉ còn hồ sơ tối thiểu và chứng nhận xóa |
| Đã hủy (`cancelled`) | Hủy trước khi dùng thật (từ `proposed`, `provision_failed`, `onboarding`) | Không | Xóa ngay nếu chưa có dữ liệu thật; nếu đã nhập thử thì xử lý như `terminated` rút gọn |

### 5.2 Sơ đồ (văn bản)

```
proposed -> provisioning -> onboarding -> active <-> restricted
                |               |          |  \          |
                v               v          v   \         v
         provision_failed   cancelled   suspended <------+
                |                          |
                +-> provisioning (thử lại) +-> active (mở lại)
active | restricted | suspended -> terminating -> terminated -> purged
```

### 5.3 Chuyển trạng thái

| Từ | Đến | Ai thực hiện | Điều kiện | Lưu ý |
| --- | --- | --- | --- | --- |
| proposed | provisioning | Quản trị nền tảng, có duyệt của Chủ nền tảng | Hồ sơ tenant đủ, hợp đồng/đồng ý điều khoản đã ghi (FR-TEN-037) | Idempotent: cấp phát lặp lại không tạo tenant thứ hai (FR-TEN-002) |
| provisioning | onboarding | Hệ thống | Mọi bước checklist cấp phát đạt | Gửi lời mời cho chủ garage (cùng cơ chế lời mời FR-SYS-019 đề xuất) |
| provisioning | provision_failed | Hệ thống | Một bước lỗi | Giữ nhật ký bước đã xong để thử lại không trùng |
| onboarding | active | Quản trị nền tảng với xác nhận của CH tenant | Checklist kích hoạt (FR-TEN-004) | Chưa khai đơn vị phát hành hóa đơn thì chạy `fake`, không phát hành thật (khớp R69) |
| active | restricted | Hệ thống hoặc Quản trị nền tảng | Vượt hạn mức cứng hoặc quá hạn thanh toán sau thời gian ân hạn | Không chặn hoàn tất chứng từ đang mở (RULE-023) |
| restricted | active | Như trên | Khắc phục điều kiện | |
| active / restricted | suspended | Chủ nền tảng; hoặc CH tenant yêu cầu | Lý do bắt buộc ghi nhật ký | Mọi phiên đang mở bị thu hồi theo cấu hình (RULE-027) |
| suspended | active | Chủ nền tảng | Hết lý do | Báo cho CH tenant |
| active / restricted / suspended | terminating | Chủ nền tảng sau yêu cầu bằng văn bản của tenant, hoặc do vi phạm hợp đồng | Bản xác nhận chấm dứt; công nợ thanh toán đã xử lý hoặc ghi nhận | Bắt đầu tạo gói xuất dữ liệu (FR-TEN-006) |
| terminating | terminated | Chủ nền tảng | Tenant xác nhận đã nhận dữ liệu, hoặc hết thời hạn trả dữ liệu theo hợp đồng | Đồng hồ thời hạn giữ bắt đầu |
| terminating | active | Chủ nền tảng | Tenant rút yêu cầu trong thời hạn cho phép | Chỉ nếu hợp đồng cho phép |
| terminated | purged | Quản trị nền tảng với duyệt của Chủ nền tảng | Hết thời hạn giữ theo luật và hợp đồng; không có yêu cầu giữ pháp lý | Có chứng nhận xóa; sao lưu hết hạn theo chu kỳ (FR-TEN-007) |

Không có đường từ `purged` quay lại. Khôi phục tenant `terminated` trong thời hạn cho phép là FR-TEN-008 (Should).

### 5.4 Ngoại lệ

| Tình huống | Xử lý đề xuất |
| --- | --- |
| Tenant nợ phí nhưng đang có xe nằm xưởng | `restricted` không chặn hoàn tất lệnh đang mở và giao xe; chặn tạo lệnh mới theo cấu hình (RULE-023) |
| Yêu cầu từ cơ quan nhà nước phải giữ dữ liệu | "Giữ pháp lý" chặn `purged`; có người duyệt và lý do |
| Tenant mất khả năng tự tải hóa đơn khi bị ngưng | Vẫn truy xuất và tải hóa đơn, chứng từ (RULE-021), trừ khi ngưng vì sự cố an ninh |
| Tenant bị ngưng giữa lúc có hóa đơn đang chờ nhà cung cấp phản hồi | Tác vụ đồng bộ trạng thái hóa đơn vẫn chạy để không mất trạng thái; không phát hành mới |
| Cấp phát lỗi giữa chừng | Thử lại từng bước, không tạo bản trùng (RULE-018); hoặc hủy và dọn |
| Hai tenant sáp nhập, một tenant tách | Không chuyển bản ghi giữa tenant (RULE-016); dùng xuất và nhập có duyệt, ghi vào Q22 |
| Tenant muốn thêm pháp nhân thứ hai | Thuộc cấu hình trong tenant (FR-SYS-018), không phải vòng đời tenant; có thể ảnh hưởng gói (FR-TEN-024) |

## 6. Cô lập dữ liệu

Yêu cầu nghiệp vụ nâng NFR-ISO-01 từ "chi nhánh" lên "tenant". Phạm vi áp dụng, đối chiếu từng nơi dữ liệu thoát ra (ba-answers mục 7: "mọi nơi dữ liệu thoát ra"):

| Nơi | Yêu cầu | Bao phủ bởi |
| --- | --- | --- |
| Danh sách, tìm kiếm (kể cả tìm toàn cục) | Không bao giờ trả bản ghi của tenant khác | FR-TEN-009 |
| Báo cáo, dashboard, xuất dữ liệu | Như trên; tên tệp xuất không lộ tenant khác | FR-TEN-009 |
| API ngoài (FR-SYS-017) | Khóa API gắn đúng một tenant; không có khóa dùng chung | FR-TEN-009, 021 |
| Tệp, ảnh, XML/PDF hóa đơn, URL ký (ADR 0001 §7.3) | Đường dẫn và URL ký kiểm tenant trước khi cấp | FR-TEN-009 |
| Thông báo (FR-SYS-008) | Không gửi sự kiện của tenant này cho người dùng tenant khác | FR-TEN-009 |
| Tác vụ nền, hàng đợi, đồng bộ hóa đơn, nhắc hạn | Chạy theo từng tenant; lỗi tenant này không chặn tenant khác | FR-TEN-009, 015 |
| Nhật ký, nhật ký truy cập dữ liệu cá nhân | Tách theo tenant | FR-TEN-013 |
| Sao lưu, khôi phục | Khôi phục một tenant không ảnh hưởng tenant khác | FR-TEN-034 |
| Bộ nhớ đệm, khóa chống trùng, đánh số | Khóa chứa tenant | RULE-018 |
| Dữ liệu seed, kiểm thử | Không giả định một tenant | NFR-TEN-01 |

**Ba phương án cô lập (ADR 0002 §3) nhìn từ nghiệp vụ**, để owner trao đổi với luật sư và khách (BA không chọn):

| Tiêu chí nghiệp vụ | A: dùng chung dữ liệu, có mã tenant | B: cơ sở dữ liệu riêng mỗi tenant | C: dự án hạ tầng riêng mỗi tenant |
| --- | --- | --- | --- |
| Chi phí cho tenant nhỏ | Thấp nhất | Trung bình | Cao nhất |
| Thuyết phục khách lớn hoặc hợp đồng yêu cầu tách | Khó | Dễ hơn | Dễ nhất |
| Xuất, xóa, khôi phục riêng một tenant | Khó nhất | Dễ | Dễ nhất |
| Rủi ro rò rỉ do lỗi lọc | Cao nhất | Thấp | Thấp nhất |
| Tenant lớn ảnh hưởng tenant khác | Có | Ít | Không |
| Giới hạn đã biết | Ngân sách chỉ mục 193/200 (ADR 0002) | Giới hạn số database mỗi dự án | Vận hành phức tạp |

Phương án có thể khác nhau theo cấp khách (S4, mục 3). Quyết định thuộc owner, luật sư và dev (Q3).

## 7. Cấu hình theo tenant

### 7.1 Phân tầng cấu hình

Đề xuất bốn tầng, mỗi giá trị có ngày hiệu lực (NFR-MNT-01, BR-ACC-08, FR-SYS-006):

| Tầng | Ví dụ | Ai sửa |
| --- | --- | --- |
| Nền tảng | Danh mục pháp lý: thuế suất, chu kỳ đăng kiểm, khung mẫu hóa đơn theo Phụ lục luật; mặc định vai trò, workflow mẫu | Quản trị nền tảng |
| Tenant | Chính sách mật khẩu, lưu trữ, hạn mức giảm giá mặc định, mẫu in, thương hiệu | Quản trị/chủ tenant |
| Company | Đơn vị phát hành hóa đơn, kỳ kế toán, đánh số theo pháp nhân | Kế toán/quản trị tenant |
| Branch | Giờ làm, bảng giá chi nhánh, hạn mức duyệt | Quản lý chi nhánh |

Quy tắc: thay đổi ở tầng trên **không** tự sửa chứng từ đã phát hành (RULE-019), áp dụng tương lai theo ngày hiệu lực; ghi rõ nguồn của giá trị đang dùng.

Điểm mở: danh mục pháp lý (thuế suất...) do nền tảng cập nhật chung cho mọi tenant để tránh sai lệch, hay mỗi tenant tự chịu trách nhiệm? Tenant có được ghi đè không? `[Cần xác nhận: Chủ dự án, Kế toán khách]` (Q16). Công thức thuế, giá, công, giá vốn vẫn cần ví dụ kiểm thử do kế toán xác nhận (NFR-MNT-01); với nhiều tenant, mỗi bộ cấu hình khác biệt cần bộ ví dụ riêng hay chỉ bộ mặc định, cũng thuộc Q16.

### 7.2 Các cấu hình cụ thể

| Chủ đề | Yêu cầu | Ghi chú |
| --- | --- | --- |
| Đánh số chứng từ | Dãy số thuộc tenant; hai tenant được phép trùng số; mã chi nhánh `MÃCN` duy nhất **trong tenant** (ba-answers §6 đã coi bất biến) | FR-TEN-020; sửa tiêu chí "duy nhất trên toàn hệ thống" của FR-REC-030 thành "duy nhất trong tenant" (mục 20) |
| Thuế | Thuế suất theo hiệu lực, theo Company | BR-ACC-08 |
| Mẫu in | Tenant có mẫu riêng; phần bắt buộc theo luật hóa đơn không được gỡ | FR-TEN-022; Phụ lục luật hóa đơn trong FR-EIN-003 |
| Hóa đơn điện tử | Nhà cung cấp, tài khoản, chứng thư, mẫu số, ký hiệu, môi trường thử/thật theo tenant và Company; bí mật không dùng chung | FR-TEN-021; FR-EIN-003, 004; R69 |
| Thương hiệu | Tên, logo trên giao diện và phiếu in; mức tùy biến giao diện (chỉ logo/tên, hay đổi màu) | ADR 0002 §2 đặt "tùy biến giao diện" ngoài mục tiêu; vẫn cần quyết nghiệp vụ (Q6). Design tokens bắt buộc giữ nguyên (CLAUDE.md), nên tùy biến sâu tạm là Won't |
| Tên miền | Tên miền con theo tenant, hoặc tên miền riêng | FR-TEN-023 (Could), Q6 |
| Ngôn ngữ, tiền tệ | Hiện vi, VND (FR-SYS-009). Tenant ngoài Việt Nam: chưa xét | Won't cho đợt đầu, Q15 |
| Quy trình theo loại dịch vụ | Cấu hình được (đồng sơn có luồng riêng, chưa khảo sát) | Chính sách "cấu hình, không viết riêng cho từng tenant" (Q17) |
| Chính sách lưu trữ | Theo tenant, mặc định "không xóa" (FR-SYS-031 đề xuất) | FR-TEN-018 |

## 8. Gói dịch vụ, quota và billing

Không có nội dung này trong ADR 0002 §2 (ngoài mục tiêu của ADR) và trong BRD. Mục này phân tích **như nhu cầu nghiệp vụ**, để owner quyết có làm hay không và khi nào.

### 8.1 Chiều quota có thể có (cần owner chọn)

| Chiều | Gợi ý từ docs | Ghi chú |
| --- | --- | --- |
| Số chi nhánh | NFR-SCL-01: 8 hiện tại, 20 sau 2 năm | Thêm chi nhánh vốn là cấu hình (NFR-SCA-01) |
| Số người dùng | 80 đến 100 hiện tại, 250 đến 300 sau 2 năm | Người dùng hoạt động hay người dùng được tạo? |
| Số lệnh sửa chữa hoặc xe mỗi tháng | 120 đến 200 xe mỗi ngày | Là chỉ số tải |
| Dung lượng ảnh/video | Liên quan INS, ADR 0001 R-10 | Tốn chi phí lưu trữ |
| Số hóa đơn điện tử mỗi tháng | Nhà cung cấp thường tính theo số hóa đơn | Chi phí qua nhà cung cấp của tenant |
| Module được bật | Phân giai đoạn 1 đến 4 của BRD mục 9 | Bật theo gói (FR-TEN-026) |
| Số lần gọi API | FR-SYS-017 | |

### 8.2 Hành vi khi chạm hạn mức

Đề xuất theo nguyên tắc RULE-023: ngưỡng cảnh báo (ví dụ 80% và 100%, tham số `[Cần xác nhận]`), sau đó chặn **tạo mới** có kiểm soát, không bao giờ chặn hoàn tất, thu tiền, giao xe hoặc phát hành hóa đơn của chứng từ đang mở. Hạn mức mềm (cho vượt, ghi nhận để tính phí) hay cứng là quyết định thương mại (Q13).

### 8.3 Billing (cho tenant trả tiền nền tảng)

| Phương án | Mô tả | Nhận xét BA |
| --- | --- | --- |
| B0 | Lập hợp đồng và hóa đơn ngoài hệ thống; hệ thống chỉ giữ gói và trạng thái | Phù hợp tenant thứ hai và thứ ba; không build tính phí |
| B1 | Hệ thống ghi nhận mức dùng và xuất bảng kê để lập hóa đơn ngoài hệ thống | Cân bằng |
| B2 | Hệ thống lập kỳ thanh toán, công nợ tenant, nhắc nợ, liên kết thanh toán trực tuyến | Chi phí xây cao, phụ thuộc nhà cung cấp thanh toán |

Khuyến nghị tạm: B0 hoặc B1 cho đợt đầu, B2 chỉ khi số tenant đủ lớn. Đây là gợi ý để owner cân nhắc, không phải quyết định (Q5).

Lưu ý nghiệp vụ: hóa đơn **chủ nền tảng phát cho tenant** là hóa đơn của một pháp nhân khác, nằm ngoài hệ thống hóa đơn của tenant (RULE-025). Pháp nhân phát hành, thuế áp dụng cho dịch vụ phần mềm trực tuyến `[Cần xác nhận: Kế toán và Luật sư của chủ nền tảng]` (Q12).

## 9. Onboarding và chuyển dữ liệu Excel theo tenant

### 9.1 Quy trình đề xuất

| Bước | Nội dung | Tham chiếu |
| --- | --- | --- |
| 1 | Ký hợp đồng, ghi đồng ý điều khoản và xử lý dữ liệu cá nhân | FR-TEN-037, Q8 |
| 2 | Cấp phát tenant, chủ garage nhận lời mời kích hoạt | FR-TEN-002 |
| 3 | Khảo sát nhanh mô hình pháp lý (một hay nhiều pháp nhân), đơn vị phát hành hóa đơn, đánh số, kỳ kế toán | Câu hỏi giống Discovery của khách đầu tiên (BRD mục 10); đóng gói thành bộ câu hỏi chuẩn (Phụ lục A) |
| 4 | Cấu hình: chi nhánh, kho, vai trò, danh mục dịch vụ, bảng giá, thuế | FR-SYS-005, 006, 016 |
| 5 | Nhập Excel theo mẫu: khách, xe, phụ tùng, tồn đầu kỳ, nhân viên | FR-SYS-007, BRD mục 12; theo từng tenant (FR-TEN-029) |
| 6 | Chạy thử ở môi trường `onboarding` (hóa đơn `fake`), huấn luyện | FR-TEN-030 |
| 7 | Kiểm tra kích hoạt rồi chuyển `active` | FR-TEN-004 |
| 8 | Vận hành song song, nghiệm thu | Mẫu như pilot của khách đầu tiên |

### 9.2 Điểm riêng của nhập Excel đa tenant

- Lô nhập và hoàn tác theo lô thuộc đúng tenant; người dùng tenant này không thấy lô của tenant khác (FR-TEN-029).
- Mẫu Excel chuẩn do nền tảng cung cấp; ánh xạ cột là cấu hình theo tenant (BRD mục 12 đã nói mẫu của khách đầu tiên chưa được xem; các tenant sau sẽ có mẫu khác).
- Tồn đầu kỳ và mã phụ tùng là phần khó nhất (BRD mục 12): mỗi tenant cần người phụ trách dữ liệu và quy tắc chuẩn hóa mã riêng.
- Số năm lịch sử cần chuyển do từng tenant quyết (câu hỏi mở "số năm lịch sử sửa chữa", CLAUDE.md).

### 9.3 Tenant đầu tiên (di chuyển dữ liệu hiện có)

Dữ liệu của khách đầu tiên phải trở thành "tenant số 1" **mà không đổi số chứng từ đã cấp, không làm mất tính hợp lệ của nhật ký và hóa đơn** (FR-TEN-031). Có downtime không, nhà cung cấp hóa đơn và khóa idempotency của hóa đơn (FR-EIN-013) xử lý thế nào là nội dung kiểm tra bắt buộc `[Cần xác nhận: Dev]`. Nên thực hiện *trước* khi tenant thứ hai có mặt, và tốt nhất trước khi dữ liệu thật của khách đầu tiên lớn thêm (xem mục 17).

## 10. Người dùng và định danh

### 10.1 Bối cảnh hiện có

- Đăng nhập bằng email hoặc mã nhân viên (Q7, N10 của open-questions); mã nhân viên duy nhất theo công ty; đăng nhập bằng mã khi mơ hồ thì bị từ chối.
- Không có tự đăng ký; tài khoản do chủ hoặc AD tạo; lời mời 72 giờ (FR-SYS-019 đề xuất).
- MFA nằm ngoài phạm vi do quyết định của owner (CLAUDE.md, `StrongAuthPort` là hook trống). Tài liệu này không đưa MFA vào FR-TEN.

### 10.2 Phương án cho người dùng nhiều tenant (Q4)

| Phương án | Mô tả | Hệ quả nghiệp vụ |
| --- | --- | --- |
| U1 | Một tài khoản thuộc đúng một tenant; cùng một người ở hai tenant có hai tài khoản và hai mật khẩu | Đơn giản, cách ly mạnh; bất tiện cho kế toán thuê ngoài, tư vấn |
| U2 | Một danh tính, nhiều tư cách thành viên (membership) mỗi tenant, chọn tenant khi đăng nhập hoặc đổi tenant | Tiện; cần quy tắc: phiên chỉ thuộc một tenant tại một thời điểm, quyền không cộng gộp giữa tenant, thu hồi từng tư cách |
| U3 | Như U2 chỉ cho nhóm vai trò đặc biệt (kế toán, tư vấn, hỗ trợ) | Trung gian |

Câu hỏi này quyết định cách xác định tenant khi đăng nhập (từ tên miền con, từ lựa chọn của người dùng, hay từ tài khoản) và email có duy nhất toàn nền tảng hay chỉ trong tenant. Hiện chưa có dữ liệu về nhu cầu thực. `[Cần xác nhận: Chủ dự án]`.

Yêu cầu chung bất kể phương án (FR-TEN-010, 016): mỗi phiên làm việc thuộc **đúng một** tenant; không thể suy ra việc tồn tại hay không của tài khoản ở tenant khác qua thông báo lỗi (nhất quán với thông báo trung lập của FR-SYS-019 đề xuất); thu hồi tư cách ở tenant A không ảnh hưởng tenant B.

## 11. Báo cáo cấp nền tảng

| Nhóm báo cáo | Nội dung | Có dữ liệu nghiệp vụ tenant? |
| --- | --- | --- |
| Danh mục tenant | Trạng thái, gói, ngày kích hoạt, ngày ngưng | Không |
| Sử dụng | Số chi nhánh, người dùng hoạt động, lệnh/tháng, dung lượng, số hóa đơn | Chỉ số tổng hợp, không có bản ghi |
| Sức khỏe | Lỗi tích hợp hóa đơn, hàng đợi, tốc độ phản hồi theo tenant | Không |
| Thương mại | Doanh thu thuê bao, công nợ tenant, tỷ lệ rời bỏ | Không (dữ liệu của nền tảng) |
| Benchmark ngành | So sánh ẩn danh giữa tenant (doanh thu/xe, thời gian sửa) | **Có**, chỉ khi tenant đồng ý (FR-TEN-038, Q10) |

Nguyên tắc: báo cáo nền tảng theo RULE-015 vẫn nêu thời điểm và phạm vi; không cho "đào sâu" vào bản ghi tenant (RULE-017). Có cho tenant xem vị trí của mình so với benchmark không là câu hỏi thương mại (Q10).

## 12. Audit, dữ liệu cá nhân, pháp lý và lưu trữ

### 12.1 Audit

| Loại nhật ký | Nội dung | Ai xem |
| --- | --- | --- |
| Nhật ký tenant | Như FR-SYS-003, 014 và nhật ký truy cập dữ liệu cá nhân; thuộc tenant | CH, AD, QL, KT theo ba-answers §8.2 |
| Nhật ký nền tảng | Tạo/đổi trạng thái tenant, đổi gói, cấu hình mặc định, **phiên hỗ trợ**, xuất/xóa dữ liệu tenant | Chủ nền tảng; phần liên quan tenant hiển thị cho CH tenant |

Cả hai bất biến, không sửa, không xóa; ghi lý do (RULE-013, FR-TEN-013). Khi nhân sự nền tảng mở phiên hỗ trợ, mỗi lần "Hiện" dữ liệu cá nhân bị che vẫn ghi nhật ký truy cập (FR-SYS-025 đề xuất) kèm danh tính nhân sự nền tảng.

### 12.2 Dữ liệu cá nhân (Luật 91/2025/QH15, Nghị định 356/2025 theo NFR-PRI-01)

Các điểm phải chốt với luật sư của chủ nền tảng (Q8), vì tài liệu hiện chỉ viết cho trường hợp một doanh nghiệp (khách đầu tiên):

| Chủ đề | Câu hỏi |
| --- | --- |
| Vai trò | Tenant là bên kiểm soát, nền tảng là bên xử lý (giả thuyết)? Cần hợp đồng/thỏa thuận xử lý dữ liệu theo phiên bản |
| Chuyển dữ liệu ra nước ngoài | Chủ dự án đã chấp nhận dữ liệu đặt tại Singapore cho khách đầu tiên (ADR 0001 A3). Tenant mới có cần đánh giá/điều kiện riêng không? |
| Thông báo sự cố | Thời hạn và đầu mối báo cho tenant và cơ quan |
| Yêu cầu của chủ thể dữ liệu | Khách của garage gửi yêu cầu xóa: ai tiếp nhận (tenant), nền tảng hỗ trợ thế nào (FR-CRM-010, 011) |
| Nhân sự nền tảng | Truy cập dữ liệu cá nhân theo nhu cầu tối thiểu |
| Đồng ý của chủ xe | Ghi theo tenant; mục đích đồng ý thuộc tenant (FR-CRM-010) |

### 12.3 Lưu trữ khi chấm dứt (xung đột cần giải quyết)

| Dữ liệu | Ràng buộc đã biết | Đề xuất |
| --- | --- | --- |
| Hóa đơn (XML/PDF), chứng từ kế toán | Phải lưu đủ thời hạn luật (NFR-DAT-01, RULE-010); thời hạn chưa chốt, `[Cần xác nhận: Kế toán khách]` | Trả cho tenant dưới dạng gói lưu trữ có kiểm tra toàn vẹn; thời hạn giữ thêm tại nền tảng (nếu có) là dịch vụ ghi trong hợp đồng (Q7) |
| Hồ sơ khách, xe | Quyền xóa, trừ khách còn công nợ, bảo hành, lệnh mở (ba-answers §8.1) | Gói xuất cho tenant rồi ẩn danh/xóa theo chính sách |
| Hồ sơ nhân viên | Nghĩa vụ xóa khi nghỉ việc từ 1/1/2026 (BRD mục 7) | Như trên, theo tenant |
| Nhật ký | Đề xuất không thấp hơn thời hạn chứng từ liên quan (ba-answers §8.1) | Đưa vào gói xuất; sau đó theo chính sách |
| Sao lưu | FR-SYS-010 | Tenant đã `purged` hết khỏi sao lưu sau chu kỳ ghi rõ (FR-TEN-007) |

Mặc định hiện hành "chưa đặt thời hạn, không xóa" (ba-answers §8.1) được giữ; nền tảng chỉ xóa khi có cấu hình chính sách được người có thẩm quyền xác nhận (RULE-020).

## 13. Tác động lên các module hiện có

| Module | Tác động | FR/RULE liên quan |
| --- | --- | --- |
| SYS | Là nơi chịu tác động chính: phạm vi (Scope) thêm lớp tenant, vai trò nền tảng tách riêng, phân cấp cấu hình, đánh số theo tenant, audit tách, sao lưu theo tenant, khóa API theo tenant, lời mời và phiên theo tenant, nhập Excel theo tenant | FR-SYS-001, 002, 003, 005, 006, 007, 010, 011, 012, 017, 018; FR-SYS-028, 030, 031, 032 đề xuất |
| REC | Số lệnh duy nhất trong tenant (FR-REC-030); trạng thái và workflow không đổi; mẫu in theo tenant; nhắc/thông báo theo tenant | RULE-002 |
| INS | Ảnh/video INS là dữ liệu cá nhân (biển số, người); đường dẫn và URL ký theo tenant; quota dung lượng | ADR 0001 §7.3 |
| CRM | Khách và xe **không chia sẻ** giữa tenant (kể cả cùng biển số); phép chiếu xuyên chi nhánh (FR-CRM-004, ba-answers P3) chỉ trong tenant; đồng ý liên hệ theo tenant | RULE-017 |
| INV | Danh mục phụ tùng, bảng giá, kho theo tenant; chuyển kho chỉ trong tenant; chuyển kho giữa hai pháp nhân vẫn là câu hỏi mở của tenant 1 | RULE-008, 009 |
| PUR | Nhà cung cấp phụ tùng là dữ liệu của tenant, không dùng chung danh bạ giữa tenant | RULE-017 |
| HRM | Hồ sơ nhân viên theo tenant; mã nhân viên duy nhất trong phạm vi do thiết kế chốt (mục 19, M1); chính sách xóa khi nghỉ việc theo tenant | FR-HRM-012 |
| ACC | Kỳ kế toán, đóng sổ, hạn mức chi, phê duyệt theo tenant/Company; xuất dữ liệu cho phần mềm kế toán riêng của từng tenant | RULE-010, 011 |
| EIN | Nhà cung cấp, bí mật, chứng thư, mẫu số, ký hiệu theo tenant và Company; khóa chống phát hành trùng không hết hạn phải bền qua mọi trạng thái vòng đời (kể cả `suspended`, di chuyển tenant 1); tác vụ đồng bộ chạy theo tenant | FR-EIN-003, 004, 013; RULE-024, 025 |
| RPT | Báo cáo hợp nhất vẫn trong phạm vi tenant (và theo Company, R85); báo cáo nền tảng là nhóm mới (FR-TEN-033) | RULE-015, 017 |

## 14. Yêu cầu đề xuất: BR, RULE, FR, NFR

Cách đọc MoSCoW ở mục này: **tương đối với chương trình multi-tenant**, không phải với Phase 1 của khách đầu tiên (không FR-TEN nào thuộc Phase 1). Must = cần trước khi tenant thứ hai dùng dữ liệu thật; Should = trước khi mở bán rộng; Could = khi có nhu cầu; Won't = chưa làm ở đợt này.

### 14.1 Yêu cầu nghiệp vụ đề xuất (BR-TEN)

| Mã | Yêu cầu nghiệp vụ | MoSCoW |
| --- | --- | --- |
| BR-TEN-01 | Phục vụ nhiều khách hàng độc lập trên một nền tảng mà dữ liệu của khách này không bao giờ lộ cho khách khác | Must |
| BR-TEN-02 | Có quy trình cấp phát, kích hoạt, tạm ngưng, chấm dứt và xóa dữ liệu tenant có kiểm soát và có nhật ký | Must |
| BR-TEN-03 | Mỗi tenant cấu hình riêng đánh số, thuế, mẫu in, hóa đơn điện tử, kênh thông báo mà không sửa mã nguồn | Must |
| BR-TEN-04 | Nhân sự nền tảng không truy cập dữ liệu nghiệp vụ của tenant trừ khi có lý do, thời hạn, sự đồng ý và nhật ký | Must |
| BR-TEN-05 | Tuân thủ luật bảo vệ dữ liệu cá nhân và nghĩa vụ lưu trữ hóa đơn, chứng từ của từng tenant, kể cả khi chấm dứt dịch vụ | Must |
| BR-TEN-06 | Có gói dịch vụ, hạn mức và theo dõi sử dụng để vận hành thương mại | Should |
| BR-TEN-07 | Đưa tenant mới vào vận hành nhanh nhờ bộ câu hỏi chuẩn, nhập Excel và môi trường thử | Should |
| BR-TEN-08 | Chủ nền tảng thấy sức khỏe và mức sử dụng của các tenant mà không thấy dữ liệu nghiệp vụ | Should |

### 14.2 Quy tắc nghiệp vụ đề xuất (RULE)

Tiếp nối RULE-015; mọi RULE dưới đây là đề xuất, chờ xác nhận.

| Mã | Quy tắc | Truy vết FR | Ghi chú |
| --- | --- | --- | --- |
| RULE-016 | Mỗi bản ghi thuộc đúng một tenant, bất biến sau khi tạo; không chuyển bản ghi giữa tenant, chỉ xuất rồi nhập có duyệt | FR-TEN-009, 010 | Mở rộng RULE-012 |
| RULE-017 | Không có truy cập, tìm kiếm, tổng hợp chéo tenant; nền tảng chỉ cộng gộp dữ liệu nghiệp vụ của tenant khi có đồng ý và đã ẩn danh | FR-TEN-009, 033, 038 | Mở rộng NFR-ISO-01 |
| RULE-018 | Số chứng từ, mã và khóa chống trùng duy nhất trong tenant; không có bộ đếm toàn nền tảng; hai tenant được phép trùng số | FR-TEN-020 | Làm rõ FR-REC-030, FR-SYS-028 đề xuất |
| RULE-019 | Cấu hình kế thừa nền tảng, tenant, Company, Branch và có hiệu lực theo ngày; đổi cấu hình tầng trên không sửa chứng từ đã phát hành | FR-TEN-018, 019 | Mở rộng NFR-MNT-01, BR-ACC-08 |
| RULE-020 | Tạm ngưng không xóa dữ liệu; chấm dứt không xóa ngay; chỉ xóa hoặc ẩn danh sau khi trả dữ liệu, hết thời hạn giữ theo luật và hợp đồng, không có giữ pháp lý, và có người duyệt | FR-TEN-005 đến 007 | Phù hợp RULE-010 |
| RULE-021 | Trong lúc hạn chế, tạm ngưng hoặc chấm dứt (trừ sự cố an ninh) tenant vẫn truy xuất và tải được hóa đơn, chứng từ thuộc thời hạn lưu | FR-TEN-005, 006 | Bảo vệ nghĩa vụ pháp lý của tenant |
| RULE-022 | Truy cập hỗ trợ của nhân sự nền tảng cần lý do, thời hạn, phạm vi tối thiểu, sự đồng ý của tenant (trừ trường hợp khẩn cấp có duyệt và báo lại), và hiển thị cho tenant | FR-TEN-012 | Mở rộng nguyên tắc ghi chú FRD mục 2 |
| RULE-023 | Vượt hạn mức hoặc hạn chế thương mại không được chặn hoàn tất chứng từ đang mở (thu tiền, giao xe, phát hành hóa đơn); chỉ chặn tạo mới theo chính sách | FR-TEN-005, 025 | |
| RULE-024 | Tích hợp bên ngoài, bí mật, chứng thư số và khóa API là của từng tenant (và Company); không dùng chung giữa tenant | FR-TEN-021 | Mở rộng BR-EIN-04, FR-SYS-017 |
| RULE-025 | Hóa đơn của tenant phát hành dưới đơn vị phát hành của tenant; nền tảng không phát hành thay; hóa đơn nền tảng thu phí tenant nằm ngoài hệ thống hóa đơn của tenant | FR-TEN-021, 028 | |
| RULE-026 | Mỗi phiên làm việc thuộc đúng một tenant; đổi tenant là ngữ cảnh mới; tạm ngưng hoặc thu hồi tư cách thu hồi phiên theo cấu hình | FR-TEN-010, 016, 017 | |
| RULE-027 | Mọi thao tác cấp nền tảng ghi nhật ký nền tảng bất biến kèm lý do; thao tác nhạy cảm (ngưng, chấm dứt, xóa, truy cập khẩn cấp) cần hai người: người đề xuất và người duyệt | FR-TEN-003, 013 | Mở rộng RULE-013 |

Ghi chú: quy tắc "tenant là bên kiểm soát, nền tảng là bên xử lý" **không** được đưa thành RULE vì chờ luật sư (Q8).

### 14.3 Yêu cầu chức năng đề xuất (FR-TEN)

Định dạng như bảng FR hiện có, thêm cột truy vết: BR, RULE, workflow (mục 5 và 15) và UAT (mục 16).

#### Nhóm A. Hồ sơ và vòng đời tenant

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-001 | Hồ sơ tenant: mã tenant bất biến, tên, thông tin liên hệ, pháp nhân đại diện, tham chiếu hợp đồng, gói, trạng thái, ngày tạo; không xóa | Must | Mã không đổi được sau khi tạo; không có thao tác xóa hồ sơ; mọi thay đổi có nhật ký nền tảng | BR-TEN-02 / RULE-016, 027 / J1 / UAT-TEN-01 |
| FR-TEN-002 | Cấp phát tenant theo checklist: tạo tenant, Company đầu tiên, cấu hình mặc định nền tảng, tài khoản chủ garage bằng lời mời; chạy lại không tạo bản trùng; lỗi giữa chừng cho phép thử lại từng bước hoặc hủy | Must | Cấp phát hai lần cùng một yêu cầu cho một tenant; kết quả cấp phát lỗi giữa chừng thử lại hoàn tất mà không có dữ liệu trùng; tenant mới không thấy dữ liệu tenant khác | BR-TEN-02, 03 / RULE-018 / J1 / UAT-TEN-01 |
| FR-TEN-003 | Vòng đời trạng thái theo mục 5; mỗi chuyển trạng thái có người thực hiện, người duyệt (với bước nhạy cảm), lý do và thời điểm; chuyển trái quy tắc bị chặn | Must | Không chuyển được `purged` về `active`; ngưng/chấm dứt/xóa thiếu người duyệt hoặc lý do bị từ chối; có đủ dòng nhật ký | BR-TEN-02 / RULE-020, 027 / mục 5 / UAT-TEN-02 |
| FR-TEN-004 | Kiểm tra trước kích hoạt: có chủ garage đã đăng nhập, có ít nhất một Company, một chi nhánh, một kho; đơn vị phát hành hóa đơn đã khai hoặc xác nhận chạy `fake`; chính sách lưu trữ đã xem; điều khoản đã chấp nhận | Should | Thiếu mục thì không chuyển `active` và nêu mục thiếu; không phát hành hóa đơn thật khi chưa khai đơn vị phát hành | BR-TEN-02, 07 / RULE-024 / J1 / UAT-TEN-01 |
| FR-TEN-005 | Hạn chế và tạm ngưng: chế độ "chặn tạo mới", "chỉ đọc và tải dữ liệu", "chặn hoàn toàn (an ninh)"; phiên đang mở bị thu hồi theo cấu hình; thông báo cho CH tenant | Must | Ở chế độ chỉ đọc không tạo/sửa được chứng từ nhưng tải được hóa đơn và xuất dữ liệu; ở chế độ chặn tạo mới, lệnh đang mở vẫn thu tiền và giao xe được; dữ liệu giữ nguyên | BR-TEN-02, 05 / RULE-020, 021, 023, 026 / J3 / UAT-TEN-03 |
| FR-TEN-006 | Chấm dứt và gói xuất dữ liệu: tạo gói gồm dữ liệu nghiệp vụ, XML/PDF hóa đơn, tệp đính kèm, nhật ký, kèm danh mục và mã kiểm tra toàn vẹn; ghi nhận tenant đã nhận | Must | Gói mở được độc lập; số bản ghi và mã kiểm tra khớp nguồn; không chứa dữ liệu tenant khác; ghi nhận ai nhận, khi nào | BR-TEN-02, 05 / RULE-020, 021 / J4 / UAT-TEN-04 |
| FR-TEN-007 | Xóa hoặc ẩn danh sau chấm dứt theo chính sách lưu trữ: chặn khi còn thời hạn giữ hoặc có giữ pháp lý; chỉ chạy khi có người duyệt; ra chứng nhận xóa; nêu thời điểm dữ liệu hết khỏi sao lưu | Must | Chưa có cấu hình chính sách thì không xóa gì; có giữ pháp lý thì chặn; xóa xong không tra cứu được dữ liệu tenant, còn chứng nhận xóa không chứa dữ liệu cá nhân | BR-TEN-05 / RULE-020 / J4 / UAT-TEN-04 |
| FR-TEN-008 | Mở lại tenant `terminating` hoặc `terminated` trong thời hạn cho phép theo hợp đồng | Should | Trước hạn mở lại được và dữ liệu nguyên vẹn; sau hạn không mở được | BR-TEN-02 / RULE-020 / mục 5 / UAT-TEN-02 |

#### Nhóm B. Cô lập và bảo mật

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-009 | Cô lập tuyệt đối dữ liệu giữa tenant ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp và URL ký, thông báo, tác vụ nền và nhật ký | Must | Tài khoản tenant A không thấy, không tìm thấy, không tải, không xuất được dữ liệu tenant B ở mọi kênh; bản ghi ngoài tenant trả "không tìm thấy" | BR-TEN-01 / RULE-016, 017 / mục 6 / UAT-TEN-05 |
| FR-TEN-010 | Mỗi yêu cầu và phiên thuộc đúng một tenant do hệ thống xác định, không do dữ liệu người dùng gửi lên tự quyết; thiếu hoặc không hợp lệ thì từ chối | Must | Sửa tham số, tiêu đề hay đường dẫn để trỏ sang tenant khác không đọc/ghi được dữ liệu tenant khác | BR-TEN-01 / RULE-016, 026 / mục 10 / UAT-TEN-05 |
| FR-TEN-011 | Vai trò nền tảng tách khỏi vai trò tenant, có ma trận quyền riêng; không vai trò nền tảng nào mặc định xem dữ liệu nghiệp vụ; không tài khoản nào vừa là nhân sự nền tảng vừa là người dùng tenant | Must | Quản trị nền tảng mở danh sách lệnh sửa chữa của tenant bị từ chối; vai trò tenant không vào được màn nền tảng | BR-TEN-04 / RULE-022 / mục 4 / UAT-TEN-06 |
| FR-TEN-012 | Phiên hỗ trợ có kiểm soát: tenant cho phép (hoặc khẩn cấp có người duyệt), có lý do, phạm vi, thời hạn tự hết, mọi thao tác ghi nhật ký, dữ liệu cá nhân vẫn che, CH tenant xem được lịch sử các phiên | Must | Không có phiên hợp lệ thì hỗ trợ không xem được dữ liệu; hết hạn tự đóng; mỗi phiên có dòng nhật ký hiển thị cho tenant | BR-TEN-04 / RULE-022 / J5 / UAT-TEN-06 |
| FR-TEN-013 | Nhật ký nền tảng bất biến, tách khỏi nhật ký tenant, ghi người, thời điểm, hành động, đối tượng tenant, lý do, giá trị trước và sau (không chứa dữ liệu cá nhân của khách tenant) | Must | Không sửa/xóa được; thao tác ngưng, chấm dứt, đổi gói, phiên hỗ trợ đều có dòng; nhật ký tenant không chứa thao tác nền tảng nhạy cảm của tenant khác | BR-TEN-02, 04 / RULE-027 / mục 12 / UAT-TEN-02 |
| FR-TEN-014 | Bộ kiểm thử cách ly có thêm trục tenant, chạy tự động; kết quả là điều kiện bắt buộc trước khi kích hoạt tenant mới hoặc phát hành bản mới | Must | Có báo cáo kiểm thử kết hợp tenant × vai trò × kênh; lỗi rò rỉ chặn phát hành | BR-TEN-01 / RULE-017 / mục 6 / UAT-TEN-05 |
| FR-TEN-015 | Hạn mức công bằng giữa tenant: giới hạn tần suất yêu cầu, nhập/xuất, tác vụ nền theo tenant; tenant dùng nặng không làm chậm tenant khác ngoài ngưỡng NFR | Should | Một tenant nhập tệp lớn và gọi API dồn dập; tenant khác vẫn đạt NFR-PERF-01 | BR-TEN-01 / – / – / UAT-TEN-12 |

#### Nhóm C. Người dùng và định danh

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-016 | Xác định tenant khi đăng nhập không mơ hồ; thông báo lỗi trung lập, không lộ tài khoản có tồn tại ở tenant nào; thu hồi tài khoản hoặc tư cách ở một tenant không ảnh hưởng tenant khác | Must | Cùng email/mã nhân viên ở hai tenant đăng nhập vào đúng tenant được chọn; mã nhân viên trùng giữa tenant không gây nhầm | BR-TEN-01 / RULE-026 / J6 / UAT-TEN-07 |
| FR-TEN-017 | Một người dùng thuộc nhiều tenant (phương án U2 hoặc U3) với chọn và đổi tenant, quyền không cộng gộp giữa tenant | Could (chờ Q4) | Đổi tenant tạo ngữ cảnh mới; quyền tenant A không có ở tenant B; thu hồi tư cách ở A không đăng xuất B | BR-TEN-01 / RULE-026 / J6 / UAT-TEN-07 |

#### Nhóm D. Cấu hình

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-018 | Cấu hình phân tầng nền tảng, tenant, Company, Branch có ngày hiệu lực; hiển thị nguồn của giá trị đang áp dụng; gồm chính sách lưu trữ, mật khẩu, hạn mức giảm giá mặc định | Must | Đổi cấu hình tenant không ảnh hưởng tenant khác; giá trị tầng dưới ghi đè tầng trên theo quy tắc; chứng từ đã phát hành giữ giá trị cũ | BR-TEN-03 / RULE-019 / – / UAT-TEN-08 |
| FR-TEN-019 | Danh mục pháp lý do nền tảng quản lý (thuế suất, chu kỳ đăng kiểm, khung mẫu theo luật) phát hành cho tenant có ngày hiệu lực; cho phép hoặc không cho tenant ghi đè theo quyết định Q16 | Should | Đổi thuế suất ở nền tảng áp cho lệnh sau ngày hiệu lực của mọi tenant trong phạm vi phát hành, không sửa mã; có ghi nhận ai phát hành | BR-TEN-03 / RULE-019 / – / UAT-TEN-08 (mở rộng UAT-09) |
| FR-TEN-020 | Đánh số, mã chi nhánh, mã nhân viên, mã khách duy nhất trong tenant; khóa dãy số chứa tenant; hai tenant được trùng số | Must | Hai tenant cùng phát hành số đầu tiên của cùng loại chứng từ không xung đột và không ảnh hưởng nhau | BR-TEN-03 / RULE-018 / – / UAT-TEN-08 |
| FR-TEN-021 | Cấu hình tích hợp theo tenant và Company: nhà cung cấp hóa đơn, SMS/Zalo, khóa/bí mật, chứng thư, môi trường thử/thật; không dùng chung; chưa cấu hình thì "Chưa kích hoạt" | Must | Hóa đơn của tenant A mang đơn vị phát hành của A; không hóa đơn nào dùng bí mật của tenant khác; `fake` bị từ chối ở `live` | BR-TEN-03 / RULE-024, 025 / – / UAT-TEN-09 |
| FR-TEN-022 | Mẫu in và thương hiệu theo tenant (tên, logo, nội dung chân trang); phần bắt buộc theo luật hóa đơn không gỡ được | Should | Phiếu in của tenant A không có thương hiệu của B; mẫu hóa đơn thiếu trường bắt buộc bị chặn | BR-TEN-03 / – / – / UAT-TEN-09 |
| FR-TEN-023 | Tên miền con hoặc tên miền riêng cho tenant | Could (chờ Q6) | Truy cập theo tên miền của tenant dẫn đúng ngữ cảnh tenant; tên miền không lộ danh sách tenant | BR-TEN-03 / RULE-026 / – / – |

#### Nhóm E. Gói, quota, billing

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-024 | Danh mục gói dịch vụ và hạn mức (chiều theo Q13) có ngày hiệu lực; gán gói cho tenant có lịch sử | Should | Đổi gói áp từ ngày hiệu lực; lịch sử gói của tenant xem được | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-025 | Thực thi hạn mức: cảnh báo theo ngưỡng; vượt thì chặn tạo mới hoặc ghi nhận vượt tùy loại; không chặn hoàn tất chứng từ đang mở | Should | Vượt số chi nhánh thì không tạo thêm nhưng lệnh đang mở vẫn thu tiền và giao xe; cảnh báo gửi đúng người | BR-TEN-06 / RULE-023 / J3 / UAT-TEN-10 |
| FR-TEN-026 | Bật/tắt module theo gói; module tắt không hiện, không gọi được qua API, dữ liệu đã có giữ nguyên | Should | Tắt PUR ở tenant A không còn menu và API; bật lại thấy dữ liệu cũ | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-027 | Ghi nhận mức sử dụng theo tenant theo các chiều đã chọn, có kỳ và có thể đối chiếu | Should | Số liệu sử dụng khớp số đếm từ nguồn cho cùng kỳ | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-028 | Billing: kỳ thanh toán, bảng kê, công nợ tenant, liên kết trạng thái thanh toán với `restricted` sau thời gian ân hạn; phương án B0, B1, B2 theo Q5 | Could (chờ Q5) | Quá hạn sau ân hạn chuyển `restricted` có nhật ký; trả nợ chuyển lại `active` | BR-TEN-06 / RULE-023, 025 / J3 / UAT-TEN-10 |

#### Nhóm F. Onboarding và di chuyển

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-029 | Nhập Excel theo tenant (mở rộng FR-SYS-007): lô, lỗi, xem trước, hoàn tác theo lô thuộc tenant; mẫu chuẩn nền tảng và ánh xạ cột theo tenant | Must | Lô của tenant A không thấy và không hoàn tác được từ tenant B; tệp lỗi không ghi một phần | BR-TEN-07 / RULE-016 / J1 / UAT-TEN-11 |
| FR-TEN-030 | Môi trường thử cho tenant đang triển khai: dữ liệu thử tách khỏi dữ liệu thật, hóa đơn `fake`, có thể xóa dữ liệu thử trước khi kích hoạt | Should | Dữ liệu thử xóa được mà không ảnh hưởng cấu hình; không phát hành hóa đơn thật ở `onboarding` | BR-TEN-07 / RULE-024 / J1 / UAT-TEN-01 |
| FR-TEN-031 | Di chuyển dữ liệu hiện có thành tenant số 1: giữ nguyên số chứng từ đã cấp, hóa đơn và khóa chống trùng, nhật ký; có kế hoạch quay lui; đối chiếu số lượng trước và sau | Must | Số bản ghi và tổng tiền từng loại trước và sau khớp; không số chứng từ nào đổi; không phát hành hóa đơn trùng sau di chuyển | BR-TEN-02 / RULE-016, 018 / mục 9.3 / UAT-TEN-11 |
| FR-TEN-032 | Bộ câu hỏi khảo sát chuẩn cho tenant mới (pháp nhân, hóa đơn, đánh số, kỳ, quy trình, lưu trữ) lưu cùng hồ sơ | Could | Hồ sơ tenant có phiên bản bộ câu hỏi và câu trả lời | BR-TEN-07 / – / J1 / – |

#### Nhóm G. Báo cáo nền tảng, vận hành, tuân thủ

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-033 | Báo cáo nền tảng: danh mục tenant, trạng thái, gói, mức sử dụng, sức khỏe tích hợp; không chứa bản ghi nghiệp vụ | Should | Báo cáo hiện số liệu tổng hợp theo tenant; không có đường dẫn đào sâu tới lệnh hay khách | BR-TEN-08 / RULE-017 / – / UAT-TEN-06 |
| FR-TEN-034 | Sao lưu và khôi phục theo tenant: khôi phục riêng một tenant tới thời điểm chọn không ảnh hưởng tenant khác; mục tiêu RPO/RTO theo SLA đã thỏa thuận (mở rộng FR-SYS-010, NFR-AVA-02) | Must | Thử khôi phục một tenant thành công, dữ liệu tenant khác không đổi; có biên bản thử theo lịch | BR-TEN-01, 02 / RULE-016 / – / UAT-TEN-12 |
| FR-TEN-035 | Thông báo vận hành từ nền tảng tới tenant (bảo trì, sự cố, thay đổi luật, phiên bản mới) theo vai trò nhận | Should | CH và AD tenant nhận thông báo; không tenant nào nhận thông báo dành riêng tenant khác | BR-TEN-02 / – / – / – |
| FR-TEN-036 | Quy trình xử lý sự cố dữ liệu cá nhân: xác định tenant bị ảnh hưởng, báo cho tenant theo hạn thỏa thuận, lưu hồ sơ sự cố (thời hạn pháp lý chờ luật sư, Q8) | Must | Có mẫu và đầu mối; hồ sơ sự cố liên kết nhật ký; chỉ tenant bị ảnh hưởng nhận thông báo | BR-TEN-05 / RULE-017, 027 / – / UAT-TEN-12 |
| FR-TEN-037 | Ghi nhận chấp thuận điều khoản dịch vụ và thỏa thuận xử lý dữ liệu theo phiên bản, theo tenant (mở rộng FR-SYS-023 đề xuất); phiên bản mới cần chấp thuận lại | Should | Tenant chưa chấp thuận phiên bản hiện hành không kích hoạt được; có lịch sử người chấp thuận và thời điểm | BR-TEN-05 / – / J1 / UAT-TEN-01 |

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-038 | Số liệu tổng hợp ẩn danh và benchmark giữa tenant, chỉ gồm tenant đã đồng ý, có ngưỡng số tenant tối thiểu để không suy ngược được một tenant | Could (chờ Q10) | Tenant không đồng ý không có mặt trong số liệu; không xem được số liệu riêng từng tenant khác | BR-TEN-08 / RULE-017 / – / UAT-TEN-06 |

Tổng cộng: **38 FR-TEN** (20 Must, 13 Should, 5 Could); bảng kiểm đếm theo mã ở mục 21. FR-TEN-038 nằm ở bảng riêng ngay trên vì thuộc nhóm báo cáo nhưng được thêm sau.

### 14.4 Yêu cầu phi chức năng đề xuất (NFR-TEN)

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-TEN-01 | Cách ly | Mọi kiểm thử cách ly, dữ liệu seed và UAT có trục tenant; không giả định một tenant | Điều kiện phát hành, mở rộng UAT-06 |
| NFR-TEN-02 | Hiệu năng | Hiệu năng của tenant không giảm quá ngưỡng NFR-PERF-01, 02 do tenant khác dùng nặng | Đo ở kiểm thử tải đa tenant `[Cần xác nhận: số tenant và tải]` |
| NFR-TEN-03 | Khả dụng | SLA theo gói: tỷ lệ khả dụng, RPO, RTO, giờ hỗ trợ; ngoại lệ bảo trì báo trước | `[Cần xác nhận: Chủ dự án]`; hiện đề xuất 99,5% giờ làm việc và RPO 1 giờ, RTO 4 giờ (NFR-AVA-01, 02) chỉ cho tenant 1 |
| NFR-TEN-04 | Khôi phục | Khôi phục, xuất và xóa theo từng tenant | Có biên bản thử theo lịch (FR-TEN-034) |
| NFR-TEN-05 | Cấp phát | Thời gian cấp phát một tenant mới và số bước thủ công | Chỉ tiêu `[Cần xác nhận]`; đo ở tenant thứ hai |
| NFR-TEN-06 | Quy mô | Số tenant và quy mô mỗi tenant thiết kế | `[Cần xác nhận: Chủ dự án]`, hiện chưa có số (Q2); NFR-SCL-01 chỉ mô tả một tenant |

## 15. User journey chính

### J1. Chủ nền tảng đưa một tenant mới vào vận hành

| Bước | Hành động | Hệ thống | Ngoại lệ |
| --- | --- | --- | --- |
| 1 | Quản trị nền tảng tạo hồ sơ tenant sau khi ký hợp đồng | `proposed`, ghi tham chiếu hợp đồng | Thiếu thông tin pháp nhân thì không sang bước 2 |
| 2 | Duyệt và chạy cấp phát | `provisioning`, checklist từng bước | Lỗi một bước: `provision_failed`, thử lại hoặc hủy |
| 3 | Chủ garage nhận lời mời, đặt mật khẩu, chấp nhận điều khoản | Ghi chấp thuận theo phiên bản | Lời mời hết hạn thì cấp lại |
| 4 | Khảo sát chuẩn, cấu hình pháp nhân, chi nhánh, kho, vai trò | `onboarding` | Pháp nhân chưa rõ thì chỉ chạy `fake` |
| 5 | Nhập Excel, đối chiếu, chạy thử | Dữ liệu thử tách khỏi dữ liệu thật | Lô lỗi không ghi một phần |
| 6 | Kiểm tra trước kích hoạt, CH xác nhận | `active` | Thiếu mục thì giữ `onboarding` |

### J2. Chủ garage của tenant trong tuần đầu

Đăng nhập, xem mình ở đâu (tên tenant, gói, hạn mức còn lại), mời quản lý chi nhánh và AD, xem lịch sử phiên hỗ trợ và nhật ký, cấu hình chính sách lưu trữ. Không thấy hay đoán được tenant khác (RULE-017).

### J3. Hạn chế vì hạn mức hoặc công nợ thương mại

Hệ thống cảnh báo CH tenant ở ngưỡng; quá hạn thì chuyển `restricted` sau thời gian ân hạn đã thỏa thuận. Cố vấn vẫn hoàn tất lệnh đang mở, thu ngân thu tiền, kế toán phát hành hóa đơn của lệnh đã giao; không tạo lệnh mới nếu chính sách chặn. Sau khi khắc phục, `active` trở lại. Mọi bước ghi nhật ký nền tảng.

### J4. Chấm dứt và trả dữ liệu

| Bước | Hành động | Ngoại lệ |
| --- | --- | --- |
| 1 | Tenant gửi yêu cầu bằng văn bản; Chủ nền tảng duyệt, lý do ghi nhật ký | Còn công nợ: xử lý trước hoặc ghi nhận điều khoản |
| 2 | Chuyển `terminating`, tenant chỉ đọc và tải | Có lệnh mở: yêu cầu hoàn tất hoặc ghi nhận chấp nhận |
| 3 | Tạo và bàn giao gói xuất; tenant xác nhận nhận | Không xác nhận trong hạn: theo hợp đồng |
| 4 | `terminated`, bắt đầu thời hạn giữ | Giữ pháp lý: chặn xóa |
| 5 | Duyệt xóa hoặc ẩn danh, ra chứng nhận | Chưa có chính sách: không xóa |

### J5. Hỗ trợ truy cập một vấn đề của tenant

CH hoặc AD tenant gửi yêu cầu hỗ trợ kèm đồng ý cấp quyền xem trong N giờ (tham số); nhân sự hỗ trợ mở phiên, thấy dữ liệu đã che; mỗi lần "Hiện" ghi lý do; hết giờ phiên tự đóng; CH tenant xem được lịch sử. Khẩn cấp (sự cố) có người duyệt thứ hai và báo lại tenant.

### J6. Kế toán làm việc cho hai tenant (nếu chọn U2 hoặc U3)

Đăng nhập, chọn tenant A, làm việc; đổi sang tenant B (ngữ cảnh mới, quyền của B); A thu hồi tư cách thì B không bị ảnh hưởng. Nếu chọn U1: hai tài khoản riêng.

## 16. Kịch bản nghiệm thu đề xuất (UAT-TEN)

Mã tạm, chốt khi áp dụng vào FRD; không trùng UAT-01 đến 26 và UAT-27 đến 31 tạm của dev.

| Mã | Kịch bản | Kết quả mong đợi | FR |
| --- | --- | --- | --- |
| UAT-TEN-01 | Cấp phát và kích hoạt tenant mới | Cấp phát lặp không tạo trùng; lỗi giữa chừng thử lại được; thiếu mục kích hoạt thì chặn; hóa đơn thật bị chặn ở `onboarding` | FR-TEN-001, 002, 004, 030, 037 |
| UAT-TEN-02 | Đổi trạng thái vòng đời | Chuyển trái quy tắc bị chặn; thiếu lý do hoặc người duyệt bị từ chối; có nhật ký nền tảng; mở lại trong hạn | FR-TEN-003, 008, 013 |
| UAT-TEN-03 | Hạn chế và tạm ngưng | Lệnh đang mở vẫn thu tiền, giao xe; chỉ đọc vẫn tải được hóa đơn; dữ liệu không đổi | FR-TEN-005, 025 |
| UAT-TEN-04 | Chấm dứt, gói xuất, xóa | Gói khớp số bản ghi và mã toàn vẹn; chưa có chính sách thì không xóa; giữ pháp lý chặn xóa; có chứng nhận xóa | FR-TEN-006, 007 |
| UAT-TEN-05 | Cô lập giữa tenant | Tài khoản tenant A không thấy dữ liệu tenant B ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp, thông báo; sửa tham số không vượt được | FR-TEN-009, 010, 014 |
| UAT-TEN-06 | Quyền nền tảng và hỗ trợ | Nhân sự nền tảng không xem dữ liệu nghiệp vụ ngoài phiên hỗ trợ; phiên hết hạn tự đóng; báo cáo nền tảng không có bản ghi nghiệp vụ | FR-TEN-011, 012, 033, 038 |
| UAT-TEN-07 | Người dùng và đăng nhập đa tenant | Cùng email hoặc mã nhân viên ở hai tenant vào đúng tenant; thông báo lỗi trung lập; thu hồi ở A không ảnh hưởng B | FR-TEN-016, 017 |
| UAT-TEN-08 | Cấu hình và đánh số theo tenant | Hai tenant phát hành cùng số đầu tiên không xung đột; đổi thuế suất áp theo hiệu lực, chứng từ cũ không đổi | FR-TEN-018, 019, 020 |
| UAT-TEN-09 | Tích hợp, mẫu in và thương hiệu theo tenant | Hóa đơn mang đúng đơn vị phát hành; không dùng bí mật tenant khác; mẫu thiếu trường bắt buộc bị chặn | FR-TEN-021, 022 |
| UAT-TEN-10 | Gói, hạn mức, module | Cảnh báo theo ngưỡng; vượt thì chặn tạo mới nhưng không chặn hoàn tất; tắt module thì ẩn và chặn API | FR-TEN-024, 025, 026, 027, 028 |
| UAT-TEN-11 | Nhập Excel và di chuyển tenant 1 | Lô tách theo tenant; số bản ghi và tổng tiền trước sau di chuyển khớp; không đổi số chứng từ; không hóa đơn trùng | FR-TEN-029, 031 |
| UAT-TEN-12 | Khôi phục, tải đa tenant, sự cố dữ liệu | Khôi phục một tenant không ảnh hưởng tenant khác; một tenant tải nặng không làm tenant khác vượt NFR; hồ sơ sự cố đúng tenant | FR-TEN-015, 034, 036 |

## 17. Phân đợt và điều kiện bắt đầu

Phân đợt chỉ là **đề xuất BA**, không phải kế hoạch đã duyệt.

| Đợt | Mục tiêu | FR chính | Hình thức vận hành |
| --- | --- | --- | --- |
| MT-0 (đang áp dụng) | Kỷ luật không chặn đường (ADR 0002 §4) | Không có FR-TEN | Rà soát mục 19 khi viết mã mới |
| MT-1 | Nhận tenant thứ hai dưới dạng cấp phát thủ công bởi nhân sự nền tảng | FR-TEN-001 đến 003, 005 đến 007, 009 đến 014, 016, 018, 020, 021, 029, 031, 034, 036 | Billing ngoài hệ thống (B0); chưa tự đăng ký |
| MT-2 | Mở bán có kiểm soát | FR-TEN-004, 008, 015, 019, 022, 024 đến 027, 030, 032, 033, 035, 037 | Có gói, quota, billing B1 |
| MT-3 | Mở rộng thương mại | FR-TEN-017, 023, 028, 038 | Người dùng nhiều tenant, tên miền, billing B2, benchmark |

Điều kiện bắt đầu MT-1 (đề xuất, mục tiêu tránh làm sớm):

1. Phase 1 pilot của khách đầu tiên đã vận hành ổn định; không làm đồng thời để khỏi tăng rủi ro pilot.
2. Owner đã trả lời tối thiểu Q1 đến Q4, Q7, Q8, Q14.
3. ADR 0002 được thay bằng ADR chính thức, có spike chứng minh cô lập (ADR 0002 §6).
4. Khách đầu tiên xác nhận bằng văn bản việc nền tảng phục vụ tenant khác và nơi đặt hạ tầng (Q14).
5. Bộ kiểm thử cách ly có trục tenant đạt (UAT-TEN-05).

## 18. Điểm `[Cần xác nhận]` và câu hỏi cho owner/khách

### 18.1 Câu hỏi quyết định (cần owner trả lời trước tiên)

| Mã | Chủ đề | Câu hỏi | Phương án | Khuyến nghị BA | Ảnh hưởng nếu chọn |
| --- | --- | --- | --- | --- | --- |
| Q1 | Mô hình kinh doanh `[Chủ dự án]` | Bán dịch vụ theo mô hình nào? | S1 SaaS dùng chung; S2 triển khai riêng từng khách; S4 lai | Chưa đủ dữ liệu để khuyến nghị; nếu chưa chắc có khách thứ hai trong 12 tháng thì chỉ giữ MT-0 | S1: cần toàn bộ FR-TEN; S2: giảm Nhóm B, E nhưng tăng chi phí vận hành từng khách; S4: cần cả hai |
| Q2 | Quy mô `[Chủ dự án]` | Số tenant dự kiến trong 2 năm, quy mô mỗi tenant, thời điểm tenant thứ hai? | Con số cụ thể | Cần con số để chọn mô hình cô lập | Ít tenant lớn nghiêng B/C; nhiều tenant nhỏ nghiêng A (ADR 0002) |
| Q3 | Mô hình cô lập `[Chủ dự án, Luật sư, Dev]` | Hợp đồng/pháp lý có yêu cầu tách dữ liệu vật lý không? | A dùng chung; B riêng cơ sở dữ liệu; C riêng dự án; khác nhau theo cấp khách | Hỏi yêu cầu hợp đồng trước; BA không chọn công nghệ | Mục 6; ảnh hưởng chi phí, ngân sách chỉ mục (193/200 ở A), xuất/xóa/khôi phục theo tenant |
| Q4 | Người dùng nhiều tenant `[Chủ dự án]` | Có người dùng cùng làm cho nhiều tenant (kế toán thuê ngoài, tư vấn)? | U1; U2; U3 | U1 cho MT-1 nếu chưa có nhu cầu thực, để MT-3 làm U2/U3 | Cách xác định tenant khi đăng nhập, email duy nhất toàn nền tảng hay trong tenant, phiên và thu hồi (FR-TEN-016, 017) |
| Q5 | Billing `[Chủ dự án]` | Tính phí thế nào và có làm trong hệ thống? | B0, B1, B2 | B0 hoặc B1 cho đợt đầu | B2 là hạng mục lớn, kéo thêm tích hợp thanh toán và pháp lý thuế |
| Q6 | Thương hiệu, tên miền `[Chủ dự án]` | Tenant có logo/tên riêng, tên miền con, hay tên miền riêng? | Chỉ tên và logo; thêm màu; tên miền con; tên miền riêng | Tên và logo trên giao diện và phiếu in; tên miền con nếu cần xác định tenant; tránh đổi màu vì design tokens bắt buộc | Tên miền riêng kéo theo chứng chỉ, DNS, cookie `__Host-`, vận hành |
| Q7 | Chấm dứt `[Chủ dự án, Kế toán khách, Luật sư]` | Khi chấm dứt: định dạng gói xuất, thời hạn tenant tải, thời hạn nền tảng còn giữ, có giữ hóa đơn thay tenant không, ai chịu chi phí? | Chỉ trả rồi xóa; trả và giữ N năm có phí; giữ lâu theo luật | Hai bước: trả dữ liệu rồi xóa theo chính sách đã xác nhận; mặc định không xóa | Nghĩa vụ lưu hóa đơn thuộc về tenant hay nền tảng; chi phí lưu trữ dài hạn; FR-TEN-006, 007 |
| Q8 | Pháp lý dữ liệu cá nhân `[Luật sư của chủ nền tảng]` | Vai trò tenant/nền tảng, thỏa thuận xử lý dữ liệu, chuyển dữ liệu ra nước ngoài cho tenant mới (A3 chỉ duyệt cho tenant 1), thông báo sự cố, hạn mức hiệu lực của Luật 91/2025 với doanh nghiệp nhỏ? | Nhiều | Mời luật sư trả lời bằng văn bản trước MT-1 | Có thể buộc đổi nơi đặt dữ liệu hoặc thêm điều khoản hợp đồng |
| Q9 | SLA và hỗ trợ `[Chủ dự án]` | Mức khả dụng, RPO/RTO, giờ hỗ trợ, kênh, thời hạn phản hồi theo gói? | Một mức; theo gói | Tối thiểu giữ NFR-AVA-01, 02 nếu chưa có cam kết khác | NFR-TEN-03; chi phí vận hành; bồi thường khi vi phạm |
| Q10 | Truy cập và tổng hợp dữ liệu `[Chủ dự án, Luật sư]` | Nhân sự nền tảng được xem gì, khi nào; có benchmark giữa tenant không và dựa trên đồng ý nào? | Không bao giờ; chỉ phiên hỗ trợ; có benchmark ẩn danh khi đồng ý | Chỉ phiên hỗ trợ, benchmark để MT-3 | FR-TEN-012, 038; niềm tin của tenant |
| Q11 | Đăng ký `[Chủ dự án]` | Tenant mới do nhân viên nền tảng tạo (bán qua kênh bán hàng) hay tự đăng ký trên web? | Bán hàng trước, tự đăng ký sau | Bán hàng trước (ADR 0002 §2 đã đặt tự đăng ký ngoài mục tiêu) | Tự đăng ký cần xác minh doanh nghiệp, chống lạm dụng, thanh toán |
| Q12 | Pháp nhân nền tảng `[Chủ dự án, Kế toán của chủ nền tảng]` | Pháp nhân nào phát hành hóa đơn phí dịch vụ, thuế áp dụng cho dịch vụ phần mềm? | | | RULE-025; billing |
| Q13 | Gói và hạn mức `[Chủ dự án]` | Chiều tính hạn mức (mục 8.1), ngưỡng, mềm hay cứng? | Nhiều | Bắt đầu một đến hai chiều (số chi nhánh, số người dùng) | FR-TEN-024 đến 027 |
| Q14 | Quan hệ với khách đầu tiên `[Chủ dự án, Khách]` | Chủ dự án và khách đầu tiên có là cùng bên không; khách có đồng ý chia sẻ nền tảng với garage khác; ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 #2 chưa trả lời); khách có điều khoản về "quyền kiểm soát dữ liệu" (BRD Fit-Gap) | | Cần làm rõ **trước** mọi thiết kế | Có thể chặn cả chương trình hoặc buộc tách hạ tầng cho khách đầu tiên |
| Q15 | Phạm vi địa lý `[Chủ dự án]` | Tenant ngoài Việt Nam, ngôn ngữ và tiền tệ khác? | Chỉ Việt Nam; mở rộng | Chỉ Việt Nam (FR-SYS-009, luật VN) | Mở rộng kéo theo luật hóa đơn, thuế, dữ liệu cá nhân từng nước |
| Q16 | Danh mục pháp lý và kiểm thử `[Chủ dự án, Kế toán khách]` | Thuế suất và danh mục luật do nền tảng cập nhật chung; tenant có ghi đè không; ai chịu trách nhiệm đúng/sai và bộ ví dụ kiểm thử cho từng tenant? | Chung và khóa; chung và cho ghi đè; riêng từng tenant | Chung, tenant không ghi đè giá trị luật định | FR-TEN-019; NFR-MNT-01 |
| Q17 | Tùy biến `[Chủ dự án]` | Có nhận yêu cầu riêng của từng tenant (workflow, báo cáo) không; cấu hình hay mã riêng? | Chỉ cấu hình; cấu hình và gói dịch vụ chuyên biệt | Chỉ cấu hình trong nền tảng chung | Mã riêng cho từng tenant làm nâng cấp khó |
| Q18 | Phát hành phiên bản `[Chủ dự án, Dev]` | Mọi tenant cùng phiên bản? Có nhóm thử trước? Báo trước bao lâu khi đổi quy trình? | | Một phiên bản, báo trước | FR-TEN-035 |
| Q19 | Chia sẻ dữ liệu giữa tenant `[Chủ dự án]` | Có chia sẻ lịch sử xe, danh bạ nhà cung cấp phụ tùng giữa tenant? | Không; có với đồng ý | Không (RULE-017) | CRM, PUR; pháp lý dữ liệu cá nhân |
| Q20 | Chính sách lưu trữ mặc định `[Kế toán khách, Luật sư]` | Thời hạn lưu mỗi loại dữ liệu cho tenant mới | Theo bảng ba-answers §8.1 | Giữ "chưa đặt, không xóa" tới khi xác nhận | FR-TEN-007 |
| Q21 | Dùng thử `[Chủ dự án]` | Có giai đoạn dùng thử miễn phí; hết hạn xử lý dữ liệu ra sao? | | Chỉ dùng thử qua `onboarding` | FR-TEN-030 |
| Q22 | Sáp nhập, tách tenant `[Chủ dự án]` | Có hỗ trợ chuyển dữ liệu giữa tenant (mua lại, tách thương hiệu)? | Không; xuất và nhập có phí | Xuất và nhập, không chuyển trực tiếp (RULE-016) | Quy trình dịch vụ |
| Q23 | Hỗ trợ tại chỗ `[Chủ dự án]` | Ngôn ngữ, kênh và giờ hỗ trợ | | | NFR-TEN-03 |
| Q24 | Vai trò nền tảng `[Chủ dự án]` | Số người, nhóm vai trò nền tảng thực tế, có cần hai người duyệt cho thao tác nhạy cảm? | | Hai người cho ngưng, chấm dứt, xóa, truy cập khẩn cấp | RULE-027 |

### 18.2 Điểm `[Cần xác nhận]` đã có sẵn và liên quan

| Điểm | Nguồn | Liên quan |
| --- | --- | --- |
| Một hay nhiều pháp nhân trong một tenant | BRD mục 10; FR-SYS-018 | Chọn khóa đánh số, mã nhân viên theo tenant hay Company (M1) |
| Cấp dự án GCP thuộc tổ chức của khách (#2) | ADR 0001 §12 | Q14 |
| Thời hạn lưu trữ hóa đơn, chứng từ, nhật ký | NFR-DAT-01; ba-answers §8.1 | Q7, Q20 |
| Luật sư xác nhận nhóm doanh nghiệp miễn hay ân hạn | NFR-PRI-01 | Q8 |
| Nhà cung cấp hóa đơn, Zalo/SMS | CLAUDE.md "Open decisions" | Cấu hình theo tenant (FR-TEN-021) |
| Dãy số theo chi nhánh hay pháp nhân | ba-answers K2 | FR-TEN-020 |

## 19. Mâu thuẫn, khoảng trống phát hiện trong tài liệu hiện có

| Mã | Phát hiện | Nơi | Đề xuất |
| --- | --- | --- | --- |
| M1 | `Company` bị dùng cho cả "ranh giới ngoài cùng" (mã nhân viên duy nhất theo `companyId`, khóa dãy số, `CRON_COMPANY_ID`) lẫn "pháp nhân" (FR-SYS-018 cho phép nhiều pháp nhân, BR-EIN-04). Khi có tenant, các khóa này phải gắn tenant hay Company chưa được nói | ba-answers dòng 118 và §6; deploy-guide dòng 154; CLAUDE.md "Domain model" | Chốt thuật ngữ ở mục 2; tách "công ty (tenant)" khỏi "pháp nhân"; làm rõ trong FRD trước khi viết FR chính thức |
| M2 | FR-REC-030 có tiêu chí "mã duy nhất trên toàn hệ thống" (ba-answers dòng 327 ghi như vậy) trái với RULE-018 đề xuất | FRD, ba-answers | Sửa thành "duy nhất trong tenant" khi áp dụng |
| M3 | FRD mục 2 và BRD mục 5 viết AD "toàn hệ thống" dễ bị hiểu là quyền nền tảng | FRD mục 2, BRD mục 5 | Đổi thành "toàn tenant" và thêm vai trò nền tảng |
| M4 | NFR-ISO-01 chỉ nói chi nhánh; NFR-SCL-01 chỉ mô tả một tenant; NFR-AVA-02 giả định một khách | FRD mục 11 | Bổ sung theo mục 20 |
| M5 | ADR 0002 đặt billing, tự đăng ký, thương hiệu, tên miền là "không mục tiêu" nhưng chưa có nơi nào ghi nhu cầu nghiệp vụ | ADR 0002 §2 | Mục 8 của tài liệu này lấp chỗ trống; ADR chính thức cần tham chiếu |
| M6 | ADR 0001 A3 chấp nhận dữ liệu tại Singapore chỉ dựa trên khách đầu tiên; chưa có đánh giá cho tenant mới | ADR 0001 §12 | Q8 |
| M7 | Khóa chống trùng hóa đơn không hết hạn (FR-EIN-013) và di chuyển sang tenant: chưa có kịch bản bảo đảm giữ khóa | ba-answers §8.1 | FR-TEN-031 và UAT-TEN-11 |
| M8 | Chưa có FR nào nói về trạng thái tenant ngưng đối với tác vụ nền (đồng bộ hóa đơn, nhắc hạn, Idempotency-Key) | FRD | Bổ sung ở FR-TEN-005 và NFR |
| M9 | ADR 0001 §7.3 điều kiện 5 để mở việc cấp URL ký cho XML/PDF hóa đơn; với nhiều tenant cần kiểm tenant trong mọi URL ký | ADR 0001 | FR-TEN-009 |
| M10 | Mã FR-SYS-019 đến 032 và UAT-27 đến 31 đang ở trạng thái "đề xuất/tạm" ở dev docs; tài liệu này dựa vào chúng ở vài chỗ (FR-SYS-019, 023, 025, 028, 031) | ba-answers, proposed-doc-changes | Các tham chiếu này chỉ có hiệu lực khi các FR đó được nhập vào FRD |

## 20. Danh sách chỉnh sửa đề xuất cho các tài liệu khác

Không sửa trong lần này; làm khi owner xác nhận và có yêu cầu. Giữ nguyên mã hiện có; mã mới thêm vào cuối từng mục.

### BRD (`docs/business-requirements.md`)

1. Mục 4: thêm "Multi-tenant" vào nhóm "ngoài phạm vi giai đoạn đầu, cần đánh giá riêng" (cùng danh sách dòng 136 đến 142).
2. Mục 5: sửa "Quản trị hệ thống: Toàn hệ thống" thành "toàn tenant"; thêm bốn vai trò nền tảng ở mục 4.1 và bên ngoài ở mục 4.3.
3. Mục 6: thêm BR-TEN-01 đến 08 vào bảng BR bản mới; RULE-016 đến 027 vào "Quy tắc nghiệp vụ".
4. Mục 7: thêm ghi chú pháp lý cho nền tảng (vai trò xử lý dữ liệu, lưu hóa đơn khi chấm dứt) sau khi luật sư trả lời.
5. Mục 8: thêm rủi ro: rò rỉ chéo tenant, tranh chấp dữ liệu khi chấm dứt, khách đầu tiên không đồng ý chia sẻ nền tảng, chi phí vận hành tăng theo tenant, phụ thuộc một đội ngũ hỗ trợ.
6. Mục 9 và 10: thêm lộ trình MT-0 đến MT-3 (nếu owner duyệt) và Q1 đến Q24.
7. Mục 3: bổ sung chỉ số thành công cho nền tảng (số tenant, thời gian cấp phát) nếu owner duyệt.

### FRD (`docs/functional-requirements.md`)

1. Mục 2: thêm ma trận quyền nền tảng riêng (FR-TEN-011) và ghi chú AD là quản trị tenant.
2. Thêm mục mới "FR: Multi-tenant (TEN)" sau mục 10, với FR-TEN-001 đến 038.
3. FR-SYS-002, 005, 006, 007, 010, 011, 012, 017, 018: thêm câu "trong phạm vi một tenant" và liên kết FR-TEN tương ứng; FR-SYS-018: phân biệt tenant và Company.
4. FR-REC-030: sửa tiêu chí "duy nhất trên toàn hệ thống" thành "duy nhất trong tenant" (RULE-018).
5. Mục 11: NFR-ISO-01 mở rộng lên tenant; thêm NFR-TEN-01 đến 06; làm rõ NFR-SCL-01 và NFR-AVA-02 chỉ cho khách đầu tiên.
6. Mục 12: ghi tích hợp bên ngoài theo tenant (hóa đơn, SMS, Zalo); thêm "nhập Excel theo tenant".
7. Mục 13: thêm UAT-TEN-01 đến 12; thêm hàng TEN vào ma trận truy vết; ghi rõ không thuộc Phase 1.
8. Tiêu đề ở mục "Tổng hợp theo phân hệ": thêm phân hệ TEN (chỉ khi owner duyệt).

### User journey (`docs/user-journey-business-workflow.md`)

1. Mục 1: thêm persona nền tảng (Chủ nền tảng, Quản trị nền tảng, Hỗ trợ).
2. Mục 2: thêm hành trình J1 đến J6.
3. Mục 7: thêm bộ trạng thái tenant (mục 5.1) làm đối tượng thứ sáu, ghi rõ tách khỏi năm đối tượng; thêm hàng vào ma trận phê duyệt cho ngưng, chấm dứt, xóa, truy cập khẩn cấp (hai người duyệt).
4. Mục 8: thêm ngoại lệ trong mục 5.4.

### Tài liệu dev và ADR

1. `docs/adr/0002-multi-tenant.md`: nối với tài liệu này (câu hỏi Q1 đến Q24 bổ sung cho mục 7 của ADR); thêm các hệ quả từ mục 19 (M1, M7, M9).
2. `docs/dev/open-questions-for-ba.md`: thêm Q-TEN (các câu ở mục 18) khi owner yêu cầu.
3. `docs/dev/ba-answers-for-dev.md`: làm rõ phạm vi khóa dãy số và mã nhân viên (tenant hay Company) khi có quyết định M1.
4. `CLAUDE.md`: sau khi owner chốt thuật ngữ (mục 2) cập nhật mục Multi-tenant.

## 21. Ma trận truy vết

| BR | RULE | FR-TEN | UAT-TEN | FR/NFR hiện có liên quan |
| --- | --- | --- | --- | --- |
| BR-TEN-01 | 016, 017, 026 | 009, 010, 014, 015, 016, 017, 034 | 05, 07, 12 | NFR-ISO-01, FR-SYS-002, RULE-012 |
| BR-TEN-02 | 016, 018, 020, 027 | 001, 002, 003, 005, 006, 007, 008, 013, 031, 034, 035 | 01, 02, 03, 04, 11, 12 | FR-SYS-003, 010, 011, RULE-010 |
| BR-TEN-03 | 018, 019, 024, 025 | 018, 019, 020, 021, 022, 023 | 08, 09 | FR-SYS-005, 006, 016, FR-EIN-003, BR-ACC-08, NFR-MNT-01 |
| BR-TEN-04 | 022, 027 | 011, 012, 013 | 06 | FRD mục 2 (ghi chú AD), FR-SYS-025 đề xuất |
| BR-TEN-05 | 020, 021 | 005, 006, 007, 036, 037 | 03, 04, 12 | NFR-DAT-01, NFR-PRI-01, FR-SYS-031 đề xuất, FR-CRM-010, 011, RULE-010 |
| BR-TEN-06 | 023, 025 | 024, 025, 026, 027, 028 | 10 | NFR-SCL-01, NFR-SCA-01 |
| BR-TEN-07 | 016, 024 | 004, 029, 030, 032 | 01, 11 | FR-SYS-007, BRD mục 12 |
| BR-TEN-08 | 017 | 033, 038 | 06 | RULE-015 |

Kiểm đếm FR-TEN theo ưu tiên (38 mã):

| MoSCoW | Số lượng | Mã |
| --- | --- | --- |
| Must | 20 | 001, 002, 003, 005, 006, 007, 009, 010, 011, 012, 013, 014, 016, 018, 020, 021, 029, 031, 034, 036 |
| Should | 13 | 004, 008, 015, 019, 022, 024, 025, 026, 027, 030, 033, 035, 037 |
| Could | 5 | 017, 023, 028, 032, 038 |

Số lượng đề xuất: **8 BR-TEN, 12 RULE (016 đến 027), 38 FR-TEN, 6 NFR-TEN, 12 UAT-TEN.**

---

### Phụ lục A. Bộ câu hỏi khảo sát chuẩn cho tenant mới (tóm tắt)

1. Mô hình pháp lý: một công ty nhiều chi nhánh phụ thuộc, nhiều pháp nhân, hộ kinh doanh; ai là đơn vị phát hành hóa đơn.
2. Nhà cung cấp hóa đơn điện tử, mẫu số, ký hiệu, ai giữ chứng thư số.
3. Đánh số chứng từ: dãy theo chi nhánh hay pháp nhân, kỳ đặt lại số, liền số.
4. Kỳ kế toán, phần mềm kế toán đang dùng, định dạng xuất kỳ cuối.
5. Quy trình theo loại dịch vụ, có đồng sơn không.
6. Quy tắc tính công, hoa hồng, hạn mức giảm giá, hạn mức duyệt.
7. Số chi nhánh, người dùng, xe mỗi ngày, số năm lịch sử cần chuyển.
8. Chính sách lưu trữ và kế toán trưởng/luật sư của tenant.
9. Thiết bị và máy in tại chi nhánh.
10. Người phụ trách dữ liệu, kế hoạch huấn luyện và vận hành song song.
