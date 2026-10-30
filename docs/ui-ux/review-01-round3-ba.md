# BA Review vòng 3 (kiểm tra cuối) – Gói G1 Xác thực và Dashboard theo vai trò

Phiên bản 0.1 · 30/10/2026 · Người lập: BA · Đối tượng: `design/g1-auth-dashboard/*`, `design/assets/app.js` (ROLE_MENU), `docs/ui-ux/01-auth-dashboard.md` §11b, §12, `docs/ui-ux/00-foundation.md` §7. Review tĩnh, đối chiếu mã thực tế; chưa chạy trình duyệt.

## 1. Kết luận

**ĐẠT** (Blocker 0, Major 0). Còn **2 Minor** (F1R3-01, F1R3-02), cùng nằm ở `ROLE_MENU`, sửa trong đợt foundation kế tiếp, không chặn bàn giao gói G1. Cộng 7 mục chuyển dev không chặn.

| Mức | Còn mở |
| --- | --- |
| Blocker | 0 |
| Major | 0 |
| Minor | 2 |
| Chuyển dev (không chặn) | 7 |

## 2. Kiểm F1R2-01..05 và 3 mục vòng 1 “một phần”

| Mục | Kết quả | Bằng chứng |
| --- | --- | --- |
| F1R2-01 chế độ menu | **Đạt** | `design/assets/app.js:330-348`: thêm `approve` = “Xem và duyệt”. CH `inv`, `set` = approve; QV `inv` = approve; QL `ro/pur/hr/fin` = approve, `inv` = full; QĐ `ro` = full. Không còn mâu thuẫn với nút “Mở hàng chờ phê duyệt” của DSH-01. Đối chiếu đầy đủ ở mục 3 |
| F1R2-02 “Báo quản đốc” giả | **Đạt** | `g1-dsh-07.html:27`: bỏ xác nhận thành công; chỉ dẫn “Nói trực tiếp với quản đốc” + phiếu giấy; nút “Gửi khi có mạng” toast “Chờ gửi… chưa gửi được vì mất kết nối”, thẻ “Chờ gửi” (`:98`), không phải trạng thái hạng mục |
| F1R2-03 đích “Thợ quá tải” | **Đạt** | `g1-dsh-01.html:87` đã đổi sang `G2-REC-05` (CH có X ở phân thợ); `G1-DSH-09` chỉ còn ở chính dsh-09 |
| F1R2-04 delta số tạm | **Đạt** | Ba trang ghi “so với 01–29/09/2026, chưa gồm ngày 30/10 (số tạm)”. Tự tính lại: chuỗi 1.647,5 (01–29/10) / 1.519,4 (01–29/09) = +8,4%; nhóm Miền Nam 1.466,5 / 1.352,4 = +8,4%; Quận 7 +11,3% ở cả DSH-06 và bảng chi nhánh DSH-01. Khớp |
| F1R2-05 tên khách thẻ việc | **Đạt** | `g1-dsh-07.html:45,52,58,65,72` “Khách: anh …” rút gọn, không SĐT, không địa chỉ (Xn đúng FRD §2) |
| F1-14 tìm kiếm Thợ | **Đạt** | Ma trận `g1-shl-02.html:101-107`: TH chỉ xe/lệnh của mình, không hàng khách, không tìm SĐT; khớp quyết định vòng 2 câu 10 |
| F1-23 kỷ luật token | **Đạt ở mức chấp nhận, chuyển dev** | Số `style=` vẫn 128 dòng/26 file (không tăng sau sửa); không có màu cứng; quy tắc “chỉ giá trị động” đã ghi |
| F1-28 bộ lọc | **Đạt ở mức prototype, chuyển dev** | Kiểm tra tương lai, 366 ngày, Đến ≥ Từ còn nguyên; hạn chế kỳ/chi nhánh chưa điều khiển số liệu được ghi rõ |

## 3. Đối chiếu ROLE_MENU (12 vai trò) với FRD §2

Quy tắc đã ghi trong mã: mục gộp nhiều hàng FRD lấy mức cao nhất (S > D > X > Xn). “Kho” = danh mục phụ tùng + nhập/xuất/kiểm kê + chuyển kho; “Tài chính” = thu tiền/sổ quỹ + công nợ/giá vốn.

| Vai trò | Kết quả đối chiếu | Ghi chú |
| --- | --- | --- |
| CH | Khớp | ro/cust/hr/fin/einv/rpt X; Kho D; Cài đặt D |
| QV | Khớp, trừ `set` | Kho = D (chuyển kho) ✓. `set: limited` xem F1R3-02 |
| QL | Khớp | ro D, Kho S (chuyển kho S), pur D, hr D, fin D (công nợ X), einv X, set S |
| CV | **Lệch nhỏ** | Thiếu `inv` (FRD: danh mục phụ tùng và bảng giá = X); `set: limited` xem F1R3-01, 02 |
| QĐ | Khớp, trừ `set` | ro S (phân thợ, QC), cust X, hr X, rpt Xn |
| TH | Khớp | ro, cust, hr, rpt đều Xn |
| TK | Khớp, trừ `set` | Kho S, pur S, ro X, không cust/fin ✓ |
| TN | Khớp | fin S (thu tiền), einv S, ro X, cust X, không Kho ✓ |
| KT | Khớp, trừ `set` | fin S (công nợ/giá vốn), einv S, các mục còn lại X |
| AD | Khớp | Chỉ `dash: sys` và `set: full`; ô “Báo cáo và dashboard” của AD trong FRD là “-” (đã nêu ở vòng 1 để ghi chú FRD) |
| MH | Chấp nhận | FRD §2 bản 0.2: mua hàng do MH và TK tạo (S); `inv: view` là suy luận từ ba-answers-04 Phụ lục C (ngoài gói G1) |
| NS | Chấp nhận | `hr: full`; FRD không có hàng riêng cho NS, theo FR-HRM và ba-answers-04 |

## 4. Finding mới vòng 3 (chỉ điểm có tác động nghiệp vụ/an toàn)

**F1R3-01 – Cố vấn dịch vụ thiếu mục Kho phụ tùng ở chế độ xem (Minor)**
- `design/assets/app.js:337` CV không có `inv`, trong khi FRD §2 cho CV **X** ở “Danh mục phụ tùng và bảng giá”, và ma trận tìm kiếm G1 (`g1-shl-02.html:104`) cho CV tìm được phụ tùng (tồn khả dụng, không giá vốn). CV cần tra giá, tồn khi lập báo giá, nên menu và tìm kiếm đang mâu thuẫn.
- Sửa: thêm `inv: 'view'` cho CV (nhãn “Chỉ xem”, giới hạn danh mục và bảng giá, không phiếu kho và giá vốn). QL, QĐ không cần sửa.

**F1R3-02 – Mục Cài đặt “Danh mục” cho QV, CV, QĐ, TK, KT không có căn cứ trong FRD §2 (Minor)**
- `design/assets/app.js:335,337,338,340,342` `set: 'limited'` (nhãn “Danh mục”). FRD §2 hàng “Người dùng, phân quyền, cấu hình” ghi “-” cho các vai trò này; FR-SYS-006/016 nói về danh mục dùng chung nhưng không cấp quyền vào Cài đặt.
- Sửa một trong hai: (a) bỏ `set` của các vai trò này; hoặc (b) thêm ghi chú vào FRD §2 rằng các vai trò đó được **xem** danh mục dùng chung (dịch vụ, giờ chuẩn, bảng giá, mẫu chứng từ) và giữ nhãn “Danh mục”. BA đề xuất (b) vì CV, TK cần xem bảng giá và danh mục; cần chủ dự án xác nhận.

Các điểm vòng 3 đã tự kiểm và **không** thành finding: hàng chờ “Chờ gửi” không phải trạng thái hạng mục; so sánh +8,4%/+8,4%/+11,3% khớp giữa DSH-01/02/06; tổng 5 chi nhánh, lợi nhuận, phải thu/phải trả vẫn khớp như vòng 2.

## 5. Chuyển cho dev (không chặn)

1. Dọn 128 thuộc tính `style=` (F1-23).
2. Nối bộ lọc kỳ/chi nhánh với một truy vấn cho KPI, biểu đồ, bảng thay thế (F1-28).
3. Hàng chờ “Chờ gửi” ở màn thợ: lưu cục bộ bền (qua tải lại trang), gửi kèm **thời điểm bấm** để quản đốc không hiểu nhầm độ trễ, tự gửi khi có mạng, hết hạn/hủy được; thẻ không tự đổi thành “đã báo” nếu chưa có xác nhận từ máy chủ.
4. Phân quyền, phạm vi chi nhánh, menu, tìm kiếm, `?role=`, menu “xem thử vai trò” chỉ minh họa; máy chủ lọc trước khi gửi (§10.1).
5. Roving tabindex cho lưới thẻ chi nhánh và thợ; đo tương phản; thử trình đọc màn hình; kiểm bố cục 1440/1024/768/390 px; phông WOFF2.
6. Hạn phiên, đếm lùi, khóa màn hình, khóa PIN do máy chủ cấp.
7. Test đơn vị cho công thức tổng, tuổi nợ, lợi nhuận, và phép so sánh kỳ (cùng ngày, đến cùng giờ) với ví dụ kế toán duyệt (NFR-MNT-01).

## 6. Việc tài liệu còn lại (không làm trong lượt này)

`01-auth-dashboard.md` §11b: ghi F1R2-01..05 là Xong và F1R3; §12 chỉ giữ câu còn mở (xác nhận của khách). FRD §2: ghi chú AD và quyền xem danh mục (F1R3-02). RULE-007 theo đề xuất vòng 2 câu 8.
