# Thiết kế lại nhóm "Đăng nhập và xác thực" (prototype)

Prototype HTML cho 6 màn hình (kèm các biến thể) của luồng vào hệ thống, dùng token trong `../assets/tokens.css` (không đổi giá trị token). Mở trực tiếp bằng trình duyệt, bắt đầu từ `login.html`. Mỗi trang có thanh "Xem thử trạng thái" (chọn bằng nút hoặc hash, ví dụ `login.html#locked`) và khung "Ghi chú cho dev và BA" ở cuối. Ảnh chụp tạo bằng `node design/auth-redesign/measure.js` (`-d` = 1440px, `-m` = 390px; mỗi trạng thái một ảnh). **Chưa chạy lần nào** (tác giả không có shell): chưa có ảnh, chưa đo tràn ngang 390px, chưa kiểm lỗi JS.

| Màn hình | Nội dung | File | Trạng thái xem thử |
| --- | --- | --- | --- |
| Đăng nhập | Email + mật khẩu; tab "Bằng mã nhân viên" (mã công ty 6 chữ số, mã nhân viên, mật khẩu) | `login.html` | email, mã nhân viên, sai thông tin, khóa tạm (đếm lùi), mất mạng, đang gửi, hết phiên, lỗi hệ thống |
| Chọn công ty và phạm vi | CompanyPicker (nhiều tư cách), bộ chọn phạm vi (một chi nhánh hoặc hợp nhất), đổi công ty trong phiên | `choose.html` | chọn công ty, chọn chi nhánh (quản lý), chủ garage (hợp nhất được), chưa gán chi nhánh, không có công ty dùng được, đang tải, lỗi, mất mạng, đổi công ty |
| Quên mật khẩu | Gửi liên kết qua email, kết quả trung lập; hướng dẫn cho tài khoản không email | `forgot.html` | nhập email, không có email, đang gửi, đã gửi, 429, mất mạng, lỗi |
| Đặt mật khẩu mới | Từ liên kết email; đổi mật khẩu tạm lần đầu của nhân viên | `reset.html` | đặt mới, đổi mật khẩu tạm, vi phạm chính sách, đang lưu, xong, liên kết hết hạn, đã dùng, mất mạng, lỗi |
| Kích hoạt lời mời | Chưa có tài khoản (tạo mật khẩu) và đã có tài khoản (thêm công ty) | `invite.html` | chưa có tài khoản, đã có tài khoản, đang kích hoạt, xong, hết hạn, thu hồi, đã dùng, mất mạng, lỗi |
| Thư viện trạng thái | 401 (màn khóa phiên), khóa tạm, 403, 404, 429, 500, 503, mất kết nối, bảng mã lý do khóa nút | `states.html` | 9 chip |

`common.css` dùng chung; `auth.js` chỉ làm chuyển trạng thái, đếm lùi, hiện mật khẩu (không gọi mạng).

## Ý tưởng chính
- Một thẻ, một việc: mỗi bước chỉ có một nút chính cỡ chạm (`--input-height-touch`), không có trang phụ trang trí.
- Nút bị chặn không biến mất: dùng `aria-disabled`, kèm dòng "Chưa bấm được: ..." ngay dưới nút (khóa tạm, mất mạng, chưa chọn công ty, chưa đồng ý quy định). Mã lý do theo `state-copy.md` §3.
- Trung lập: sai thông tin, khóa tạm, quên mật khẩu, mất công ty, 404 dùng một câu cho mọi trường hợp, không lộ tài khoản, mã công ty hay bản ghi ngoài phạm vi có tồn tại hay không.
- Số lần thử, thời gian khóa, Retry-After, hạn liên kết do máy chủ trả; số trong prototype (14:32, 15:00, 01:00) chỉ minh họa.
- Luồng sau mật khẩu đúng: nhiều tư cách thì CompanyPicker, một tư cách thì vào thẳng bước phạm vi, "Đổi công ty" luôn có trong phiên (cảnh báo bản nháp). Nhân viên mã công ty + mã nhân viên chỉ có một tư cách nên không qua CompanyPicker.
- Phạm vi hiện rõ từ lúc chọn: nút Hợp nhất bị chặn nêu lý do, chi nhánh khóa sổ không chọn được và nêu lý do (RULE-015).
- Không có MFA, không giá, gói, dùng thử.
- Giữ dữ liệu khi lỗi (trừ mật khẩu chỉ giữ trong bộ nhớ trang); trạng thái đúng thứ tự: lỗi cạnh trường, tóm tắt thông báo, focus vào ô lỗi đầu.

## Chưa xác nhận / chưa xây
Đối chiếu `docs/dev/status.md` (chỉ đọc, chưa mở `src/`):
- **Đã build, chưa có giao diện thiết kế**: đăng nhập email và mã công ty + mã nhân viên (P2-C) với công tắc tối thiểu; trang `/login/change-password`; trang chọn công ty tối giản; trang lời mời. Prototype này đề xuất hình thức chính thức; dev cần đổi hoặc bổ sung nhãn, thứ tự và trạng thái.
- **Khác bản đã build, cần dev và BA xem**: (1) đã build không nhớ và không gợi ý mã công ty (đúng với prototype, khác TSU-14 cũ); (2) tab "Không có email" ở quên mật khẩu chỉ là hướng dẫn vì hệ thống không gửi gì cho tài khoản mã nhân viên; (3) màn khóa phiên 401 trong ứng dụng, cảnh báo 60 giây trước khi hết phiên và trang 403, 404, 5xx chưa rõ đã có hay chưa (chưa đối chiếu `src/`).
- **Chưa xây / chưa quyết**: lối "Đổi công ty" trong phiên và cảnh báo bản nháp (cần quyết số phiên: đổi tư cách là đăng nhập lại hay giữ hai phiên); hiển thị tư cách bị chấm dứt hay thu hồi trong CompanyPicker; nút "Gửi yêu cầu cấp quyền" và "Gửi yêu cầu gán chi nhánh" (cần quy trình và người nhận); tự điền tên người được mời; ghi nhớ thiết bị.
- **`[Cần xác nhận]`**: chính sách mật khẩu (tối thiểu 10 ký tự, không trùng 5 mật khẩu gần nhất lấy từ ADR §6.3 và `ba-decisions` D-03, chưa có trong FR-SYS-001; chặn mật khẩu phổ biến và chứa tên/email/mã NV là đề xuất); thời hạn phiên rảnh và tuyệt đối theo vai trò (Q5), số lần và thời gian khóa (Q6); hạn liên kết đặt lại, hạn lời mời, hạn mật khẩu tạm (hiện 72 giờ); câu về lời mời hết hạn, thu hồi, đã dùng (giữ ba câu hay gộp một); nội dung và phiên bản quy định sử dụng (luật sư, RULE-029); chính sách ghi giờ của thợ khi mất mạng (BA-08); kênh lấy lại mã công ty cho người quên.
- Dữ liệu là dữ liệu mẫu (tên công ty, người dùng, chi nhánh, mã `REQ-7F3A92`). Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp sẽ dùng font dự phòng.
- Chưa thử chế độ tối, chưa kiểm contrast bằng công cụ (chỉ dùng cặp token đã có), chưa kiểm bằng trình đọc màn hình.
