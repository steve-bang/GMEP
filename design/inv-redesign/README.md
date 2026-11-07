# Thiết kế lại nhóm "Kho và phụ tùng" (prototype)

Prototype HTML cho 5 màn hình giá trị nhất của nhóm sidebar Kho và phụ tùng, làm theo cách của `../rec-redesign` (token trong `../assets/tokens.css`, không đổi giá trị token). Mở trực tiếp bằng trình duyệt, bắt đầu từ `stock.html`; các trang liên kết với nhau bằng dòng điều hướng ở đầu trang.

| Mục sidebar | Màn hình | File | FR / RULE |
| --- | --- | --- | --- |
| Tồn kho | Tồn kho theo bốn số, tab theo việc cần làm, xem thử vai trò Thủ kho / Cố vấn | `stock.html` | FR-INV-003, 013, 014, 020; RULE-008 |
| Tồn kho | Chi tiết phụ tùng: bốn số, bước tiếp theo, sổ kho, giữ chỗ, hàng đang chuyển, đảo phiếu | `part-detail.html` | FR-INV-020, 021; RULE-009, 010 |
| Nhập kho | Nhập kho theo đơn mua, đối chiếu số lượng và giá | `receipt.html` | FR-INV-004, 005, 019 |
| Chuyển kho | Phiếu chuyển giữa chi nhánh: cần nhận, cần gửi, đã đóng; nhận hàng kèm biên bản chênh lệch | `transfers.html` | FR-INV-010, 026 |
| Kiểm kê | Đếm từng mã, quét mã vạch, chênh lệch, lý do, gửi duyệt điều chỉnh | `stocktake.html` | FR-INV-011, 012 |

`common.css` dùng chung (dựa trên `rec-redesign/common.css`, thêm khối phạm vi, bốn số, cảnh báo, hộp thoại). Ảnh chụp ở `screenshots/` (`-d` = 1440px, `-m` = 390px).

## Ý tưởng chính
- Định danh chính của phụ tùng là tên kèm mã (phụ tùng không có biển số); biển số chỉ xuất hiện khi dòng sổ kho gắn với một lệnh, để thủ kho biết xe nào đã lấy hàng.
- Tab theo việc cần làm, có đếm: Cần xử lý, Đang chuyển về, Có giữ chỗ (tồn kho); Cần nhận, Cần gửi (chuyển kho); Chưa đếm, Lệch (kiểm kê).
- Bốn số luôn đi cùng nhau và Có thể bán được nhấn mạnh, đỏ khi bằng 0. Cảnh báo dưới định mức so với Có thể bán, không so với tồn thực (RULE-008).
- Mỗi dòng một nút hành động, chọn theo tình huống: dưới định mức nhưng hàng đang về thì "Theo dõi phiếu chuyển" (không đặt mua trùng); chi nhánh khác còn dư thì "Yêu cầu chuyển kho"; không ai dư thì "Tạo yêu cầu mua".
- Nút bị chặn nêu lý do ngay dưới nút (phiếu chờ duyệt, thiếu dòng đếm, lệch chưa có lý do, tồn chỉ đổi qua chứng từ).
- Sổ kho không có Sửa hoặc Xóa: sai thì "Đảo phiếu" kèm lý do, phiếu gốc gạch ngang và gắn "Đã bị đảo", phiếu đảo có mã riêng (RULE-009, RULE-010).
- Nhập kho: lệch số lượng hoặc giá vượt ngưỡng đổi nút thành "Gửi quản lý duyệt lệch", tồn chưa đổi cho đến khi duyệt.
- Chuyển kho: hàng đang đi đường không vào Có thể bán của hai bên; nhận khác số gửi thì bắt nhập lý do và lập biên bản.
- Kiểm kê cỡ chạm 44px (nút tăng giảm, ô số), quét mã vạch cộng 1 vào đúng dòng, mã lạ báo lỗi rõ.
- Mọi màn nêu phạm vi (chi nhánh, kho) và thời điểm tính tồn (RULE-015). Tìm không dấu. Số nguyên, tiền VND có dấu chấm.

## Chưa xác nhận / chưa xây
- **Dữ liệu là dữ liệu mẫu** (mã phụ tùng, số tồn, mã phiếu PCK/GRN/GIN/ADJ/RTN, tên chi nhánh). Định dạng mã chứng từ lấy gần với quy ước hiện có nhưng chưa đối chiếu code đánh số.
- **Chưa kiểm tra ở Playwright, bàn phím, tương phản** (xem mục Kết quả kiểm tra bên dưới). Chưa thử dark mode.
- **Vai trò Cố vấn trên `stock.html`** chỉ thấy Có thể bán, dựa theo ghi chú ở `g3-inv-01`; ma trận quyền thật cần BA xác nhận. Cố vấn không có nút đặt hoặc chuyển hàng là đề xuất.
- **Gợi ý "Chi nhánh Thủ Đức có thể cho 8"** dựa trên FR-INV-031 (chỉ hiện số "có thể cho", cờ xem liên chi nhánh). Hệ thống hiện chưa có màn dùng phép chiếu này ở danh sách tồn: cần nối dữ liệu, có thể phát sinh query mới.
- **Nút "Yêu cầu chuyển kho" và "Tạo yêu cầu mua" trên tồn kho** là đề xuất đi tắt từ danh sách; bản nháp phiếu chưa xây trong luồng hiện tại. `part-requests.html` của nhóm rec-redesign cũng có nút tương tự.
- **Ngưỡng lệch khi nhập kho** (5% giá, vượt số còn chờ) là giá trị mẫu; ngưỡng thật do cấu hình, FR-INV-005 chưa nêu số [Cần xác nhận]. Ai duyệt lệch (quản lý chi nhánh hay cấp cao) cũng chưa nêu.
- **Danh mục lý do chênh lệch kiểm kê** (4 lý do) là mẫu [Cần xác nhận]; chưa thiết kế ngưỡng chênh lệch cần cấp cao duyệt, tồn thay đổi trong lúc đang đếm (hàng xuất, nhập khi kiểm kê), hay kiểm kê theo lô và serial.
- **Đảo phiếu kho**: ai được đảo, phiếu nào đảo được (ví dụ phiếu nhập đã xuất hết một phần), phiếu đảo có cần duyệt hay không chưa có trong FR. Prototype giả định gửi quản lý duyệt, tồn đổi sau khi duyệt (theo FR-INV-012 cho điều chỉnh).
- **Chuyển kho**: trạng thái "Chờ duyệt, Chờ gửi, Đang đi đường, Đã nhận, Đóng có chênh lệch" là bộ mẫu; FR-INV-010 chỉ nêu gửi, nhận, đi đường, biên bản chênh lệch. Việc có bước duyệt trước khi gửi cần BA xác nhận.
- Chưa có: tạo phiếu chuyển, tạo đơn mua, chọn đơn mua khác, hàng loạt lô và serial, giá vốn và tồn theo lô (FR-INV-003, 024), bản in phiếu nhập, xuất và biên bản chênh lệch (A5, A4, nhiệt), camera thật (quét mã chỉ mô phỏng bằng ô nhập), trạng thái loading, lỗi, mất kết nối và lưu nháp.
- **Ngân sách index (172/200)**: tab Cần xử lý (dưới định mức), Có giữ chỗ, Đang chuyển về cần lọc theo Có thể bán so với định mức, theo giữ chỗ và theo phiếu chuyển; sổ kho theo phụ tùng và thời gian; phiếu chuyển theo chi nhánh nhận, chi nhánh gửi và trạng thái; dòng kiểm kê theo trạng thái đếm. Có thể cần thêm 3 đến 6 index tổ hợp (chưa đếm bằng `pnpm check:indexes`, chưa kiểm tra index đang có trong `repos/queries.ts`). Cách giảm: đếm số lượng trên tab bằng số liệu tính sẵn hoặc lọc phía client trong một chi nhánh, vì mỗi chi nhánh chỉ có vài nghìn mã.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.

## Kết quả kiểm tra
Xem báo cáo cuối của phiên làm việc: ghi rõ phần nào đã chạy Playwright và phần nào chưa. Script chụp và đo (1440px, 390px, đo `scrollWidth - clientWidth`, lỗi JS) dùng cùng cách với `docs/ui-ux/mobile-overflow-report.md`.
