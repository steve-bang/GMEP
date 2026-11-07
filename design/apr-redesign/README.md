# Thiết kế lại nhóm "Phê duyệt" (prototype)

Prototype HTML cho 3 màn hình của nhóm Phê duyệt (APR), làm theo cách của `../rec-redesign`, `../inv-redesign`, `../acc-redesign` (token trong `../assets/tokens.css`, không đổi giá trị token). Mở trực tiếp bằng trình duyệt, bắt đầu từ `queue.html`; các trang liên kết bằng dòng điều hướng ở đầu trang. Thay thế (về cách trình bày) `../g4-finance/g4-apr-01..04.html`; bản cũ giữ nguyên.

| Màn hình | File | FR / RULE |
| --- | --- | --- |
| Hàng chờ: tab Cần tôi duyệt, Đã chuyển lên cấp trên, Tôi đề xuất, Đã xử lý; lọc theo nhóm; xem thử vai trò Quản lý, Chủ garage, Thủ kho; xem thử trạng thái Có dữ liệu, Đang tải, Lỗi | `queue.html` | FR-SYS-033, 034, 015; RULE-036 |
| Chi tiết yêu cầu và quyết định duyệt, từ chối kèm lý do, chuyển cấp: 11 tình huống chọn ở ô "Xem thử tình huống" (`?s=` và `?r=` trên địa chỉ) | `request.html` | FR-SYS-033, 034; RULE-010, 011, 036; FR-PUR-009; FR-ACC-005 |
| Ma trận hạn mức (chỉ đọc) có ô "Thử một giá trị", ủy quyền, tham số | `matrix.html` | FR-SYS-033, 034; RULE-036 |

Mười một tình huống ở `request.html`: `cap1` chờ cấp 1 duyệt được; `cap2` chờ cấp 2, Quản lý chỉ xem; `auto` đã tự chuyển cấp 1 lên 2; `reauth` cần nhập lại mật khẩu; `conflict` xung đột 409; `expired` lượt duyệt hết hạn; `proxy` đã duyệt theo ủy quyền; `own` yêu cầu do chính người xem lập; `store` Thủ kho xem (ẩn giá trị tiền); `offline` mất kết nối giữ nháp; `urgent` hậu duyệt mua gấp.

`common.css` dùng chung (dựa trên `acc-redesign/common.css`, thêm thanh hạn mức `.lim`, dòng thời gian `.tl`, dòng hàng `.ln`, dải điều hướng `.subnav`). `measure.js` chụp 1440px (`-d`) và 390px (`-m`) vào `screenshots/`, đo tràn ngang và lỗi JS cho từng trang và từng tình huống.

## Ý tưởng chính
- Hàng chờ chia theo việc của người xem, có đếm: Cần tôi duyệt (chỉ yêu cầu đang chờ đúng cấp của bạn), Đã chuyển lên cấp trên (chỉ xem), Tôi đề xuất, Đã xử lý. Mỗi dòng một nút: Xem và quyết định; dòng chưa duyệt được thì nút Duyệt bị chặn và nêu lý do ngay dưới nút (đã ở cấp 2, người đề xuất không tự duyệt). Mã chứng từ là liên kết vào chi tiết kể cả khi nút bị chặn.
- Định danh mỗi dòng là biển số (nếu có) cộng mã chứng từ; loại yêu cầu là huy hiệu; trạng thái yêu cầu phê duyệt tách khỏi trạng thái chứng từ gốc (thanh toán, phiếu kho, lệnh). Cấp chờ, thời gian chờ, "Quá nhắc", "Đã tự chuyển cấp" là huy hiệu riêng.
- `canApprove` theo cấp: yêu cầu vượt hạn mức cấp 1 mở thẳng ở cấp 2 và chỉ hiện ở hàng "Cần tôi duyệt" của người có quyền cấp 2; Quản lý mở link vẫn đọc được nhưng cả ba nút đều khóa kèm lý do. Chuyển cấp chỉ lên cấp kế tiếp, kèm lý do (Q-R2 a); cấp 2 hiện "đã ở cấp cuối".
- Tự chuyển cấp (T1 nhắc, T2 chuyển) hiện trên dòng thời gian; yêu cầu đã chuyển cấp vẫn là Chờ duyệt, không vào tab Đã xử lý.
- Quyết định: Duyệt có hộp thoại xác nhận (giá trị, cấp, ô đã xem), ô mật khẩu chỉ hiện khi loại yêu cầu bật cờ nhập lại mật khẩu, sai mật khẩu không khóa yêu cầu (thử nhập "sai"). Không có MFA. Bấm hai lần không duyệt hai lần. Từ chối và Chuyển cấp bắt lý do từ 5 ký tự.
- Hoàn tác: Từ chối và Chuyển cấp có Hoàn tác 10 giây (đưa yêu cầu về Chờ duyệt). Duyệt không có Hoàn tác vì hành động đề xuất được thực hiện ngay; sai thì đảo bằng chứng từ mới (RULE-010), nói rõ trong hộp thoại và thông báo.
- Thủ kho không thấy giá trị tiền ở điều chỉnh tồn và chuyển kho (Q-R3 a): ẩn giá trị, thanh so với hạn mức và cột thành tiền (vì suy ngược ra giá vốn), chỉ còn số lượng.
- Mọi màn nêu phạm vi (Quận 7 hoặc toàn chuỗi cho Chủ garage) và thời điểm cập nhật (RULE-015). Tiền là số nguyên VND, định dạng vi-VN, ngày dd/MM/yyyy, tìm không phân biệt dấu.
- Ma trận: "Chưa chốt" giữ nguyên là Chưa chốt, kèm hệ quả "chưa ban hành: lên cấp cao nhất"; ô "Thử một giá trị" cho thấy yêu cầu sẽ chờ cấp nào (hoặc không cần duyệt).

## Chưa xác nhận / chưa xây
- **Dữ liệu là dữ liệu mẫu**: người, mã chứng từ, số tiền, biển số. Mọi số hạn mức, T1, T2 là minh họa, chưa ban hành chính thức (D-11); mọi yêu cầu loại chưa ban hành lên cấp cao nhất. Các ô "Chưa chốt" (đối soát cấp 1 và 2, xuất dùng nội bộ, mua gấp, giờ nhắc nhập kho không đơn mua) giữ nguyên.
- **Chưa chạy gì**: chưa mở bằng trình duyệt, chưa chạy `measure.js`, chưa kiểm tra bàn phím, tương phản, dark mode, đọc màn hình. Chưa thử tràn ngang ở 390px.
- **Cần API / chưa xây ở dev**: chuyển cấp thủ công (Q-R2 a đã chốt, dev chưa có API; slice 2.5 chỉ có chuyển cấp tự động). Hoàn tác Từ chối, Chuyển cấp trong 10 giây là đề xuất của designer, cần BA và dev xác nhận có cho phép không và người đề xuất khi nào mới nhận thông báo [Cần xác nhận].
- **Chủ garage duyệt thay cấp 1**: prototype khóa (yêu cầu cấp 1 chờ Quản lý) và ghi [Cần xác nhận]; chưa có trong FR.
- **Rút yêu cầu** của người đề xuất (yêu cầu của mình đang chờ) chưa thiết kế vì chưa có trong FR [Cần xác nhận].
- **Duyệt hàng loạt** (loại bật cờ bulkAllowed trong ma trận) chưa thiết kế ở hàng chờ mới; chỉ ghi chú ở chân bảng. Bản cũ `g4-apr-01.html` có.
- **Chỉnh sửa ma trận và ủy quyền**: chỉ có hộp thoại giải thích ngày hiệu lực; bảng sửa từng ô, màn xem tác động, màn ban hành ủy quyền chưa thiết kế.
- Chi tiết yêu cầu dùng 11 tình huống đại diện, không phải mỗi loại yêu cầu một bản; các dòng cùng loại ở hàng chờ trỏ vào tình huống gần nhất. Chưa có biến thể riêng cho giảm giá, chênh lệch quỹ, hủy lệnh, mở lại ngày ở trạng thái Chờ cấp 1 ngoài vài ví dụ.
- Chủ garage chưa được thiết kế màn hình xem hợp nhất nhiều chi nhánh ở chi tiết (đổi phạm vi rõ ràng giữa một chi nhánh và toàn chuỗi mới là một dòng chữ ở dải phạm vi).
- Cộng dồn chống chia nhỏ 7 ngày: [Cần xác nhận Q67]; ô thử ở ma trận chưa tính cộng dồn.
- **Ngân sách index (172/200)**: tab Cần tôi duyệt và Đã chuyển lên cấp trên cần lọc theo cấp chờ, vai trò duyệt, trạng thái; Tôi đề xuất theo người đề xuất và trạng thái; Đã xử lý theo thời điểm; bộ đếm trên tab. Phần lớn có thể đã có từ slice 2.5 (`approvals.byStatus`); ước lượng thêm 2 đến 3 index tổ hợp (cấp chờ + trạng thái + thời điểm; người đề xuất + trạng thái; quá hạn T1). Chưa đếm bằng `pnpm check:indexes`, chưa đối chiếu `repos/queries.ts`. Số đếm trên tab nên là số tính sẵn hoặc lọc phía client trong một chi nhánh để không tốn index.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.
