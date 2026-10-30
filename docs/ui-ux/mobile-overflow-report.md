# Trang còn tràn ngang ở 390px

Đo bằng Playwright/Chromium (scrollWidth - clientWidth, viewport 390x844). Desktop 1440px: 0 trang tràn. Không có lỗi JavaScript ở 193 trang.

Lịch sử: 94 lượt tải tràn ban đầu → 34 (sửa topbar dùng chung) → 11 (.table-scroll position:relative) → 5 (.segmented, .card/.table-wrap min-width:0) → còn lại bên dưới.

Còn lại:
- +215px  design/foundation/components.html
- +143px  design/foundation/index.html
- +98px  design/g2-workshop/index.html

Ghi chú: foundation/components.html và foundation/index.html là trang showcase thiết kế; g2-workshop/index.html là trang mục lục — không phải màn hình sản phẩm.
