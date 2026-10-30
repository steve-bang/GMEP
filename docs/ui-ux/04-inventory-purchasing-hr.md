# UI/UX – Gói G3: Kho, Mua hàng, Nhân sự (INV · PUR · HRM)

Trạng thái: đang thực hiện (giai đoạn 1 – kế hoạch). Thư mục prototype: `design/g3-inventory-hr/` (tiền tố class `g3-`). Tài liệu này sẽ được hoàn thiện ở giai đoạn 4.

## Kế hoạch

- Phạm vi: 39 màn hình theo `screen-inventory.md` §4 (INV 19, PUR 10, HRM 10). Mỗi màn hình một file `g3-<nhóm>-<số>.html`, hộp thoại/drawer/trạng thái gộp trong file màn hình cha.
- Thứ tự: (1) `pack.css`, `pack.js` (shell dùng chung, trạng thái xem thử, quyền theo vai trò, ô tồn 4 số, quét mã); (2) INV P1: 01–10, 19; (3) INV P2/P2+ còn lại, PUR, HRM; (4) `index.html`, tự review, hoàn thiện tài liệu.
- Ràng buộc nghiệp vụ xuyên suốt: bốn con số tồn (Thực tế · Giữ chỗ · Đang vận chuyển · Khả dụng, Khả dụng = Thực tế − Giữ chỗ, hàng đang vận chuyển không cộng, RULE-008); mọi biến động tồn qua chứng từ (RULE-009), không có màn sửa tồn trực tiếp; công thức công/hoa hồng, giá vốn, hạn mức duyệt, bước yêu cầu/duyệt mua hàng là cấu hình (D-11, D-13).
