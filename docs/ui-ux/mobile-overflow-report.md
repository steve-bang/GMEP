# Trang còn tràn ngang ở 390px

Đo bằng Playwright/Chromium (scrollWidth - clientWidth, viewport 390x844). Desktop 1440px: 0 trang tràn. Không có lỗi JavaScript ở 193 trang.

Lịch sử: 94 lượt tải tràn ban đầu → 34 (sửa topbar dùng chung) → 11 (.table-scroll position:relative: phần tử .sr-only tuyệt đối thoát khung cuộn) → 5 (.segmented, .card/.table-wrap min-width:0).

Còn lại:
- +215px  design/foundation/components.html
- +143px  design/foundation/index.html
- +139px  design/g4-finance/g4-apr-03.html
- +134px  design/g3-inventory-hr/g3-hrm-08.html
- +98px  design/g2-workshop/index.html

Ghi chú: foundation/components.html và foundation/index.html là trang showcase thiết kế (không phải màn hình sản phẩm); g2-workshop/index.html là trang mục lục; g4-apr-03 và g3-hrm-08 đang được designer sửa.
