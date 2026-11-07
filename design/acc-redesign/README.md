# Thiết kế lại nhóm "Thu ngân và tài chính" (prototype)

Prototype HTML cho 5 màn hình của nhóm sidebar Thu ngân và tài chính, làm theo cách của `../rec-redesign` (token trong `../assets/tokens.css`, không đổi giá trị token). Mở trực tiếp bằng trình duyệt, bắt đầu từ `cashier.html`; các trang liên kết với nhau bằng dòng điều hướng ở đầu trang.

| Mục sidebar | Màn hình | File | FR / RULE |
| --- | --- | --- | --- |
| Thu tiền | Thu tiền theo lệnh: tab Chờ thu, Công nợ, Đã thu hôm nay; hộp thoại thu nhiều hình thức | `cashier.html` | FR-ACC-001, 002, 019 |
| Ca thu ngân | Đếm két, đối chiếu, giải trình chênh lệch, chốt ca (có nút xem thử Đang mở / Đã chốt) | `shift.html` | FR-ACC-004 |
| Chốt ngày | Danh sách điều kiện chặn và cảnh báo, chốt ngày (xem thử 3 trạng thái) | `day-close.html` | FR-ACC-004, 005; FR-EIN-009 |
| Sổ quỹ | Dòng thu chi theo thời gian, số dư, phiếu chi có hạn mức, đảo bút toán | `cashbook.html` | FR-ACC-003, 018; RULE-010, 011 |
| Hóa đơn điện tử | Hóa đơn theo việc: Cần phát hành, Đang gửi, Gửi lỗi, Đã phát hành, Điều chỉnh | `invoices.html` | FR-EIN-001, 002, 005, 007, 009, 010, 011, 013 |

`common.css` dùng chung (dựa trên `rec-redesign/common.css`, thêm khối phạm vi, cảnh báo, hộp thoại). Ảnh chụp ở `screenshots/` (`-d` = 1440px, `-m` = 390px).

## Ý tưởng chính
- Biển số là định danh chính của mọi dòng ở thu tiền và hóa đơn; mã lệnh, mã phiếu là thông tin phụ.
- Trạng thái riêng cho từng đối tượng, không trộn: thanh toán (Chưa thu, Thu một phần, Ghi nợ đã duyệt, Đã thu đủ), lệnh (dòng phụ nhỏ), hóa đơn (Chưa phát hành, Đang gửi, Gửi lỗi, Đã phát hành, Chờ duyệt điều chỉnh). Trạng thái hóa đơn nói rõ là lấy từ nhà cung cấp.
- Tab theo việc cần làm có đếm; một nút hành động mỗi dòng (Thu tiền, Phát hành, Kiểm tra trạng thái, Mở hóa đơn PDF).
- Nút bị chặn nêu lý do: chốt ca (chưa nhập tiền đếm, chênh lệch chưa giải trình), chốt ngày (liệt kê từng việc chặn kèm nút tới nơi xử lý), phát hành hóa đơn (thiếu mã số thuế), duyệt điều chỉnh (chỉ kế toán trưởng).
- Phát hành idempotent hiện ra cho người dùng: hộp thoại có khóa chống trùng, bấm xong dòng chuyển Đang gửi, không có nút gửi lại; hết thời gian chờ thì "Kiểm tra rồi thử lại" hỏi nhà cung cấp trước (FR-EIN-013).
- Không có Sửa hoặc Xóa với tiền: thu nhầm thì "Đảo bút toán" kèm lý do; phiếu gốc gạch ngang kèm huy hiệu "Đã bị đảo bởi …", phiếu đảo có mã riêng và không đảo tiếp (RULE-010). Hóa đơn sai thì điều chỉnh hoặc thay thế.
- Thu tiền: số mặc định là số còn nợ, chuyển khoản, thẻ, ví bắt nhập mã giao dịch, tiền mặt tính tiền thối, không cho thu vượt số còn nợ; lệnh đang sửa chỉ thu được đặt cọc.
- Mọi màn nêu phạm vi chi nhánh, ca hoặc ngày và thời điểm tính số liệu (RULE-015). Tiền là số nguyên VND, định dạng vi-VN.

## Chưa xác nhận / chưa xây
- **Dữ liệu là dữ liệu mẫu** (số tiền, mã phiếu PT, PC, DT, số hóa đơn 1C26TAA-…, tên khách, thu ngân).
- **Chưa kiểm tra ở Playwright, bàn phím, tương phản** (xem phần cuối). Chưa thử dark mode.
- **Chốt ngày**: việc nào chặn, việc nào chỉ cảnh báo là đề xuất. FR-ACC-004 chỉ nêu chắc chắn chặn khi còn chênh lệch quỹ chưa giải trình; ca chưa chốt đặt là chặn [Cần xác nhận]. Lệnh chưa thu đủ, lệnh chưa có hóa đơn, lệnh còn mở chỉ là cảnh báo [Cần xác nhận]. Quy trình mở lại ngày đã khóa ở đây chỉ là dòng chữ, chưa thiết kế màn.
- **Ca thu ngân**: một thu ngân một ca, nhập một số tiền đếm (chưa chia theo mệnh giá), quỹ đầu ca lấy từ ca trước. Có hay không ngưỡng chênh lệch tối đa cho phép chốt, và ai xem giải trình, chưa nêu trong FR [Cần xác nhận]. Chưa có màn mở ca.
- **Thu tiền**: phần thu vượt thành khoản nhận trước (FR-ACC-015, 022) chưa thiết kế, màn đang chặn thu vượt; phân bổ một khoản cho nhiều hóa đơn chưa có; hoàn tiền (FR-ACC-016) chưa có; thu nợ doanh nghiệp theo hạn mức (FR-ACC-020) chỉ hiện nhãn. Lệnh đang sửa chỉ thu cọc là đề xuất theo FR-ACC-002.
- **Sổ quỹ**: hạn mức chi tự chi tại quầy 500.000 ₫ là giá trị mẫu (FR-ACC-018, RULE-011 chưa nêu số). Đảo bút toán chưa rõ có cần duyệt không, và với ngày đã chốt thì ghi phiếu đảo vào ngày nào [Cần xác nhận]; prototype chỉ thiết kế ngày chưa chốt. Chưa có sổ quỹ ngân hàng và đối soát (FR-ACC-017).
- **Hóa đơn**: tên trạng thái và mã trạng thái là mẫu; thật lấy theo nhà cung cấp (hiện chỉ có nhà cung cấp giả lập, chưa chọn nhà cung cấp thật). "Chờ duyệt điều chỉnh" và quyền kế toán trưởng theo FR-EIN-007, nhưng danh mục các trường hợp sai sót cần kế toán xác nhận. Chưa thiết kế: màn lập hóa đơn điều chỉnh, thay thế, hủy; gửi cho khách qua email, SMS, Zalo (FR-EIN-008); hàng chờ thử lại tự động và thông báo kế toán (FR-EIN-010) ngoài trạng thái "Gửi lỗi"; thời điểm lập hóa đơn và xử lý tiền cọc (FR-EIN-012). Thuế suất 8% là mẫu theo cấu hình.
- Nút "Kiểm tra trạng thái" mô phỏng kết quả phát hành thành công; "Mở hóa đơn PDF" và "In phiếu thu" chỉ hiện thông báo. Chưa có bản in A5 và khổ nhiệt cho phiếu thu, phiếu chi, biên bản chốt ca (FR-ACC-014), chưa có trạng thái loading, lỗi, mất kết nối và lưu nháp.
- Phân quyền chưa thiết kế đủ (thu ngân, kế toán, quản lý, chủ): ngoài nút duyệt điều chỉnh bị chặn, các màn chưa có chế độ chỉ xem hoặc ẩn số.
- **Ngân sách index (172/200)**: tab Chờ thu, Công nợ cần lọc lệnh theo số còn nợ và hình thức ghi nợ; Đã thu hôm nay theo ngày; sổ quỹ theo chi nhánh và thời gian (có thể đã có); hóa đơn theo chi nhánh và trạng thái, cùng danh sách lệnh hoàn tất chưa có hóa đơn (FR-EIN-009) cần lọc chéo hai tập. Có thể cần thêm 3 đến 5 index tổ hợp (chưa đếm bằng `pnpm check:indexes`, chưa đối chiếu `repos/queries.ts`). Số đếm trên tab nên là số tính sẵn theo ngày hoặc lọc phía client trong một chi nhánh để không tốn index.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.

## Kết quả kiểm tra
Xem báo cáo cuối của phiên làm việc: ghi rõ phần nào đã chạy Playwright và phần nào chưa.
