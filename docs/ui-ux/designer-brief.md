# Brief chung cho designer (mỗi gói màn hình)

Bạn là designer của dự án GMEP (repo /home/user/GMEP). Bắt buộc nạp skill dashboard-ui-ux trước. Nhiệm vụ: thiết kế MỘT GÓI màn hình của web dashboard Garage ERP (gói nêu ở cuối), dưới dạng prototype HTML/CSS thuần mở được bằng trình duyệt (file://), kèm tài liệu mô tả UI/UX flow.

ĐỌC TRƯỚC (bắt buộc, theo thứ tự):
1. /home/user/GMEP/docs/design-system.md — token và quy tắc do chủ dự án chốt, KHÔNG được đổi giá trị/tên token, font, kích thước layout; mọi màn hình phải tuân thủ.
2. /home/user/GMEP/docs/ui-ux/00-foundation.md — cách dùng token 3 lớp, danh mục component/class, quy ước (VND 1.250.000 ₫, ngày dd/MM/yyyy, biển số, mã chứng từ), role→menu, các class mới (tag, datepicker, combobox, qty, upload, otp, pii, branch scope...).
3. /home/user/GMEP/docs/ui-ux/ba-decisions.md — quyết định BA đã chốt (bảng trạng thái→màu→badge A.2, tồn khả dụng, che SĐT, branch selector, mã chứng từ, khổ in...). Tuân thủ; nếu cần khác thì ghi vào mục 'Câu hỏi cho BA' của tài liệu gói.
4. /home/user/GMEP/docs/ui-ux/screen-inventory.md — danh mục màn hình: mục §0 (chú giải), phần của gói bạn, §5 (quyết định), §6 (khoảng trống), §7 (luồng), §9 (ghi chú designer).
5. Phần FR/workflow liên quan trong docs/functional-requirements.md và docs/user-journey-business-workflow.md khi cần chi tiết nghiệp vụ.
Tham khảo mẫu code: design/foundation/shell.html và components.html (dùng đúng shell, class và JS có sẵn).

QUY TẮC KỸ THUẬT:
- Mỗi màn hình trong danh mục = 1 file .html trong thư mục gói (tên file = mã màn hình viết thường, ví dụ g2-rec-04.html), link ../assets/tokens.css, base.css, components.css, app.js. KHÔNG sửa design/assets/* (dùng chung giữa các gói chạy song song). Nếu cần style/component bổ sung, tạo file riêng design/<thư-mục-gói>/pack.css (dùng token, tên class tiền tố theo gói), không hard-code hex.
- Màn hình dạng modal/drawer/dialog/trạng thái (loading/empty/error/no-permission) có thể gộp trong file của màn hình cha nhưng phải liệt kê rõ trong tài liệu và có thể bật xem (ví dụ query ?state=empty hoặc bộ chuyển trạng thái nhỏ trong prototype). Với mỗi màn hình đủ các trạng thái nêu trong danh mục.
- Một file index.html trong thư mục gói liệt kê toàn bộ màn hình của gói (mã, tên, link, vai trò, ưu tiên).
- Mỗi trang dùng Application Shell chuẩn (trừ trang xác thực/lỗi/khách ngoài hệ thống) và đúng menu theo vai trò; hiển thị rõ phạm vi chi nhánh và thời điểm dữ liệu (RULE-015).
- Responsive desktop/tablet/mobile theo design-system §4; bảng → card list trên mobile; touch target ≥44px trên cảm ứng; label luôn hiện; chữ ≥12px (bảng 14px); tabular-nums cho tiền/số lượng/biển số/mã; badge luôn có chữ; thao tác nguy hiểm dùng Confirmation (mức nguy hiểm theo foundation); empty state có hướng dẫn tiếng Việt; không dùng 'Xóa' cho chứng từ đã ghi sổ (dùng đảo/điều chỉnh).
- Dữ liệu mẫu tiếng Việt thực tế cho garage, nhất quán giữa các màn hình trong gói; dữ liệu cá nhân dùng cơ chế .pii theo vai trò.
- Không tự đặt quy tắc nghiệp vụ. Chưa chắc → ghi vào 'Câu hỏi cho BA' (BA sẽ review và trả lời). Mục [Cần xác nhận] phải thiết kế theo hướng cấu hình được.
- Làm theo GIAI ĐOẠN, ghi file ngay khi xong từng giai đoạn (để không mất việc nếu bị ngắt): (1) rà danh mục và lập kế hoạch 1 đoạn đầu tài liệu; (2) màn hình ưu tiên Phase 1 / luồng chính; (3) các màn hình còn lại; (4) hoàn thiện tài liệu + index + tự review.
- Cần hiệu quả: dùng chung khối HTML lặp, giữ mỗi file gọn nhưng đầy đủ nội dung nghiệp vụ; không bỏ sót màn hình nào trong danh mục (ưu tiên đủ phủ trước, rồi tinh chỉnh độ sâu của màn hình quan trọng).

TÀI LIỆU GÓI (tiếng Việt): ghi vào file nêu ở cuối, gồm: phạm vi gói; bảng màn hình (mã, tên, file, template, vai trò, trạng thái đã thiết kế); UI/UX flow (luồng điều hướng giữa các màn hình bằng danh sách bước có mã màn hình + sơ đồ văn bản/Mermaid); mô tả từng nhóm màn hình (mục đích, bố cục theo template, component dùng, hành động chính/phụ/nguy hiểm, trạng thái, quy tắc hiển thị theo vai trò, responsive); ánh xạ FR/RULE; kiểm tra accessibility đã tự đánh giá; mục 'Giả định' và 'Câu hỏi cho BA'.
Bạn không có trình duyệt nên không xem trực quan được: tự rà kỹ cú pháp HTML, đường dẫn tương đối và tên class tồn tại trong components.css. Không commit/push. Trả lời cuối ngắn gọn: số màn hình đã làm / tổng, các file chính, điểm yếu tự đánh giá, câu hỏi cho BA.

