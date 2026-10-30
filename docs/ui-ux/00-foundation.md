# UI/UX – Phase 0: Design Foundation, Component Library, Application Shell

Phiên bản: 0.2 (đã xử lý review BA F-01..F-17 và quyết định `ba-decisions.md`) · Nguồn chuẩn: `docs/design-system.md` (giá trị token, font, kích thước layout KHÔNG đổi). Nghiệp vụ lấy từ `docs/business-requirements.md`, `docs/functional-requirements.md`, `docs/user-journey-business-workflow.md`, `docs/ui-ux/ba-decisions.md` (BA đề xuất, chờ chủ dự án xác nhận) và `docs/ui-ux/review-00-foundation-ba.md`.

Sản phẩm kèm theo (HTML/CSS/JS thuần, mở trực tiếp bằng trình duyệt, không build):

| File | Nội dung |
| --- | --- |
| `design/assets/tokens.css` | Token 3 lớp + dark mode (cấu trúc, không phát hành) |
| `design/assets/base.css` | `@font-face` tự host, reset, typography, tabular-nums, focus, reduced-motion |
| `design/assets/components.css` | Toàn bộ component + Application Shell (§14 là phần bổ sung sau review) |
| `design/assets/fonts/` | Chỗ đặt 4 file WOFF2 Be Vietnam Pro (xem `README.md` trong thư mục; **chưa có file**) |
| `design/assets/icons.svg` | Sprite icon kiểu Lucide (dùng khi chạy qua http) |
| `design/assets/app.js` | JS prototype (nhúng sprite icon cho `file://`, tương tác minh họa) |
| `design/foundation/index.html` | Showcase: màu, typography, spacing, radius, elevation, grid, motion, icon, tương phản |
| `design/foundation/components.html` | Thư viện component đầy đủ trạng thái |
| `design/foundation/shell.html` | Application Shell responsive, đổi vai trò/phạm vi chi nhánh |

Lưu ý icon: sprite vẽ lại theo phong cách Lucide (outline, viewBox 24, stroke 1,75–2px) để chạy được khi mở `file://`. Khi dev chọn stack, thay bằng gói Lucide chính thức, giữ nguyên tên icon.

Lưu ý phông: đã bỏ Google Fonts; `base.css` khai báo `@font-face` (400/500/600/700, `font-display: swap`, thử `local()` trước, rồi `fonts/BeVietnamPro-*.woff2`). Môi trường tạo prototype không có mạng nên **chưa có file WOFF2**; khi chưa có, trang rơi về font hệ thống (system-ui/Segoe UI/Roboto), vẫn đủ dấu. Cách lấy file và đặt tên ghi trong `design/assets/fonts/README.md`.

---

## 1. Tổ chức token 3 lớp

| Lớp | Vai trò | Ví dụ | Ở đâu trong `tokens.css` |
| --- | --- | --- | --- |
| 1. Primitive | Giá trị gốc, không mang ý nghĩa | `--color-brand-500`, `--palette-gray-450`, `--palette-green-800`, `--palette-red-700`, `--space-4` | Khối §12 nguyên văn + khối “PRIMITIVE bổ sung” (`--palette-*`) |
| 2. Semantic | Ý nghĩa sử dụng | `--color-primary`, `--color-text-link`, `--color-success-text`, `--color-purple-bg`, `--color-text-inverse`, `--shadow-focus-error`, `--chart-series-1`, `--dur-modal`, `--z-modal` | Khối §12 (Semantic) + khối “SEMANTIC bổ sung” |
| 3. Component | Riêng từng component | `--btn-height-md`, `--input-border`, `--control-border`, `--input-border-focus`, `--input-border-error`, `--radius-control`, `--table-row-height`, `--sidebar-item-active-bg` | Khối “COMPONENT tokens” |

Quy tắc dùng:
- Component chỉ tham chiếu lớp 2 và 3. Không có mã hex/`rgba` trong `components.css`; mọi giá trị đi qua token (lớp primitive là nơi duy nhất giữ hex, trừ khối dark mode cấu trúc).
- Khối §12 được chép nguyên văn; token mới đặt tên không trùng. Bổ sung của BA/designer ghi chú “chờ chủ dự án xác nhận” và đề nghị chép vào phụ lục `design-system.md`.
- Dark mode: chỉ ghi đè lớp 2 (+ vài token lớp 3) dưới `[data-theme="dark"]`. **Không thuộc phạm vi phát hành** (câu 16): nút chuyển trong prototype ghi “Tối (bản nháp)”, chưa kiểm thử tương phản.
- Bốn hiệu chỉnh đã được BA chấp nhận (không đổi giá trị chuẩn): (i) chữ badge dùng bản đậm `--color-*-text`; (ii) link và chữ tím trên nền sáng dùng `--color-text-link` = brand-600; (iii) focus = outline đặc 2px tím + `--shadow-focus` làm vầng ngoài, và **không khai báo `border-radius` trong `:focus-visible`**; (iv) viền control nhập liệu `--input-border` (xem dưới).
- **`--input-border` = `--palette-gray-450` = #868D9A**, đo 3,34:1 trên #FFFFFF và khoảng 3,15:1 trên nền trang #F8F9FC (đạt ≥ 3:1 WCAG 1.4.11 nên không phải dùng #6B7280). Áp dụng cho input, select, textarea, date, OTP, qty, checkbox, radio, switch tắt, chip lọc, ô tìm kiếm topbar (`--control-border`). `border.default`/`border.strong` giữ cho card, bảng, divider. Hover = `--input-border-hover` (#6B7280). Lưu ý: trên nền `surface.subtle` (#F1F2F6) tỷ lệ còn khoảng 3,0:1, nên đặt control trên nền trắng/nền trang.
- (v) Touch target: control 40px (nút md), 32px (nút sm), 40px (nút icon) **chỉ** khi `pointer: fine` và màn ≥ 1024px; còn lại (cảm ứng hoặc < 1024px) mọi control ≥ 44px, màn thợ 52px.
- Radius: Input/Select/Textarea/Date/OTP/Combobox 8px (`--radius-md`, theo §16); control nhỏ 6px (`--radius-control`): checkbox, segmented, menu item, ngày trong lịch, tùy chọn combobox.

Breakpoint không đặt thành CSS variable: mobile 0–639, tablet 640–1023, desktop 1024–1279, wide 1280–1535, ultrawide ≥ 1536.

## 2. Quy ước đặt tên class

BEM: `block`, `block__element`, `block--modifier`. Không tiền tố. Ví dụ `.btn--primary`, `.field__error`, `.kpi__value`, `.table--compact`, `.badge--warning`, `.combobox__option`.

- Trạng thái: `.is-loading`, `.is-selected`, `.is-open`, `.is-error`, `.is-disabled`, `.is-visible`, `.is-active`; ưu tiên ARIA khi có nghĩa: `aria-current="page"`, `aria-selected`, `aria-pressed`, `aria-sort`, `aria-invalid`, `aria-checked`, `aria-expanded`.
- Giả lập trạng thái tĩnh cho showcase: `.is-hover`, `.is-focus`, `.is-active`. Sản phẩm dùng `:hover`, `:focus-visible`, `:active`.
- Utility: `.stack`, `.row`, `.grid--n`, `.num`/`.tabular`, `.money`, `.plate`, `.code`, `.text-secondary`, `.sr-only`.
- Hook JS prototype: thuộc tính `data-*`.
- Badge/tag đặt tên theo MÀU (`badge--success`, `tag--warning`); ánh xạ trạng thái → màu ở §6.

## 3. Danh mục component và trạng thái

| Nhóm | Component | Trạng thái đã thiết kế |
| --- | --- | --- |
| Actions | Button primary/secondary/ghost/danger (sm 32, md 40, lg 44, xl 52), Icon button, Button group/Split button, Danger-outline | Default, Hover, Focus, Active, Disabled (kèm tooltip lý do), Loading |
| Form | Input, Select, Textarea, Ô tiền (căn phải), Checkbox, Radio, Switch | Default, Hover, Focus, Error (nêu cách sửa), Disabled, Read-only, Indeterminate |
| Form nâng cao (mới) | **Date Picker** (một ngày, khoảng ngày, lối tắt, ngày khóa sổ, tuần bắt đầu Thứ 2, nhập tay luôn được, phím mũi tên), **Combobox/Autocomplete** (biển số, khách, phụ tùng; tìm không phân biệt dấu; gợi ý chuẩn hóa biển số; “Thêm mới”; empty), **Số lượng** (stepper, vượt tồn), **Tải ảnh/chụp ảnh** (kéo thả, nhiều ảnh, nén giả lập, tiến trình, lỗi, xóa), **Input OTP** (6 ô, dán, lỗi, disabled) | Default, Focus, Error, Disabled, Loading (tiến trình) |
| Dữ liệu cá nhân (mới) | `.pii` che theo vai trò + nút Hiện, dialog lý do, tự che sau 30 giây | Che, Hiện, Không có quyền, Đầy đủ |
| Data display | Badge (6 màu), Tag (6 màu + tag lý do), Chỉ báo `sync`, Count pill, Plate tag, Avatar, Card, KPI Card, Tooltip | KPI: default, cảnh báo, nguy hiểm, loading, lỗi, dữ liệu cũ |
| Data table | Table (sticky header, 52/56/44px, sort, chọn dòng, bulk bar, footer tổng), Card list mobile, Pagination, Filter bar + chip, Cột hiển thị | Có dữ liệu, Loading, Empty lần đầu, Empty do lọc, Error, Không có quyền, Hover, Selected |
| Navigation | Sidebar (248/72; nhãn chế độ “Chỉ xem/Của tôi/Hệ thống”), Topbar, Breadcrumb, Tabs, Segmented, Bottom nav, Drawer menu, **Branch selector 3 cấp + chi nhánh tĩnh** | Default, Hover, Active, Disabled/khóa |
| Workflow | Stepper, Timeline, Progress, Kanban + dải “Trước lệnh” | Done, Current, Error, Pending |
| Feedback | Dialog thường/nguy hiểm/đảo bút toán/lý do xem/lưu nháp đổi phạm vi, Drawer, Dropdown/Menu, Toast, Alert, Banner mất kết nối, Bản nháp, Skeleton, Empty, Error, Permission | Đóng/mở, Esc, focus trap, trả focus |
| Garage | Vehicle Card, Repair Order Card, Technician Card, Parts Item (4 số + “Đang về N”), Inspection Checklist, Approval Panel | Default, cảnh báo, trễ hẹn |

## 4. Quy ước hiển thị dữ liệu

| Loại | Quy ước | Ví dụ |
| --- | --- | --- |
| Tiền VND | Dấu chấm nghìn, không số lẻ, ` ₫` sau số, căn phải, tabular-nums | `1.250.000 ₫` |
| Tiền rút gọn | Chỉ ở KPI, kèm đơn vị; bảng và chứng từ luôn dùng số đầy đủ | `128,5 tr ₫` |
| Ngày | `dd/MM/yyyy`; ngày giờ `HH:mm dd/MM/yyyy` (24h); tiêu đề dashboard “Thứ Sáu, 30/10/2026” | `30/10/2026 09:15` |
| Mã chứng từ (BA, câu 11) | `LOẠI-MÃCN-YYMM-STT` (STT 5 chữ số, đánh lại mỗi tháng theo chi nhánh và loại; tiền tố và độ dài là cấu hình). RO lệnh · BG báo giá (`-v2`) · PT/PC phiếu thu/chi · PN/PX nhập/xuất kho · CK/KK chuyển kho/kiểm kê · DM đơn mua · BL bán lẻ. Số hóa đơn điện tử do nhà cung cấp cấp, không dùng mã này. Hiển thị tabular-nums, không ngắt dòng; tìm chấp nhận thiếu dấu gạch hoặc chỉ STT | `RO-Q7-2610-00128`, `BG-Q7-2610-00231-v2` |
| Biển số (BA, câu 11) | Lưu bản chuẩn hóa (in hoa, bỏ khoảng trắng/chấm/gạch); hiển thị: ô tô 5 số `51H-123.45`, cũ `51H-1234`, xe máy `59-X1 123.45`, cũ `59-S1 1234`. Biển ngoại giao/quân đội/tạm/nước ngoài: nhập tự do kèm “Loại biển”, chỉ cảnh báo, không chặn lưu. Combobox gợi ý chuẩn hóa khi gõ. Màu nền biển không là tín hiệu giao diện | `51H-123.45` |
| SĐT / email / địa chỉ | Che mặc định theo vai trò (§6b): SĐT `09•• ••• 123`, email `a•••@gmail.com`, địa chỉ chỉ quận/huyện, tỉnh/thành. Giá trị đầy đủ không có trong HTML trước khi Hiện | |
| Phạm vi | Mỗi KPI/báo cáo/xuất file ghi chi nhánh + khoảng thời gian + thời điểm cập nhật (RULE-015) | `Quận 7 · 01–30/10/2026 · 09:15` |
| Tồn kho | Khả dụng = Thực tế − Đang giữ; hàng đang về không cộng; badge so với định mức tối thiểu của từng mặt hàng/chi nhánh (RULE-008, FR-INV-013) | Thực tế 5 · Giữ 2 · Về 10 · Khả dụng 3 |

Ghi chú: các dữ liệu mẫu trong prototype vẫn dùng chuỗi `RO-2026-001284` (và tương tự) cho dễ đọc; định dạng chính thức ở trên chỉ là chuỗi khác, đổi khi làm màn hình thật.

## 5. Quy tắc responsive

| Dải | Shell | Nội dung |
| --- | --- | --- |
| ≥ 1280 | Sidebar 248px (thu gọn 72px, ghi nhớ) | Dashboard tiêu chuẩn, 12 cột, gutter 24, tối đa 1600px |
| 1024–1279 | Sidebar compact | Lưới 2–3 cột |
| 640–1023 | Sidebar tự thu gọn 72px (icon + chấm báo; nhãn chế độ ẩn), tooltip bằng `title` | Lưới 2 cột; control ≥ 44px |
| 0–639 | Sidebar thành drawer; Bottom nav (mục theo quyền) + “Thêm”; search thu thành icon | 1 cột; bảng → card list; dialog thành bottom sheet; page padding 16 |

Quy tắc thêm: không cuộn ngang toàn trang; bảng rộng cuộn ngang trong khung; touch target theo (v) ở §1; màn thợ trên tablet dùng nút xl (52px), bắt đầu/hoàn thành ≤ 2 chạm.

## 6. Trạng thái nghiệp vụ → Badge (theo `ba-decisions.md` A.2)

Năm đối tượng, năm bộ trạng thái riêng, không dùng chung. Badge luôn có chữ. Nguồn: DS = design-system §2, UJ = user-journey §7, BA = BA đề xuất (chờ xác nhận).

| Đối tượng | Trạng thái | Màu | Chữ trên badge | Nguồn |
| --- | --- | --- | --- | --- |
| Lịch hẹn / Tiếp nhận (trước lệnh) | Chờ xác nhận (khách tự đặt) | Warning | Chờ xác nhận | BA |
| | Đã hẹn | Info | Đã hẹn | BA |
| | Chờ tiếp nhận | Neutral | Chờ tiếp nhận | DS |
| | Đã tiếp nhận | Success | Đã tiếp nhận | BA |
| | Không đến / Đã hủy | Neutral / Danger | Không đến / Đã hủy | BA |
| Báo giá | Nháp | Neutral | Nháp | UJ |
| | Đã gửi | **Warning** | **Chờ khách duyệt** | UJ + DS |
| | Duyệt toàn phần | Success | Duyệt toàn phần | UJ |
| | Duyệt một phần | Warning | Duyệt một phần | UJ |
| | Từ chối | Danger | Từ chối | UJ |
| | Hết hạn | Neutral | Hết hạn | UJ |
| Lệnh sửa chữa (7) | Đã duyệt | **Neutral** | Đã duyệt | UJ |
| | Đang sửa | Info | Đang sửa chữa | DS |
| | Tạm dừng | Warning | Tạm dừng + tag lý do (vd. “Chờ phụ tùng”) | UJ |
| | Chờ kiểm tra | Purple | Chờ QC (tên đầy đủ: Chờ kiểm tra chất lượng) | DS |
| | Sẵn sàng giao | Success | Sẵn sàng bàn giao | DS |
| | Hoàn tất | Success | Hoàn tất | UJ |
| | Đã hủy | Danger | Đã hủy | DS |
| Hạng mục (5) | Chưa làm / Đang làm / Tạm dừng / Hoàn thành / Trả lại | Neutral / Info / Warning / Success / Danger | cùng tên | UJ |
| Hạng mục – thuộc tính duyệt (không phải trạng thái thứ 6) | Chờ khách duyệt (phát sinh) | Warning (tag) | Chờ khách duyệt (phát sinh), cạnh badge “Chưa làm”, khóa nút Bắt đầu kèm lý do | BA |
| Thanh toán | Chưa thanh toán / Thanh toán một phần / Đã thanh toán / Hoàn tiền | Warning / Info / Success / Neutral | cùng tên | DS |
| | Cờ “Quá hạn” (công nợ) | Danger (tag) | Quá hạn | BA |
| Hóa đơn | Chưa xuất / Đã xuất / Điều chỉnh / Thay thế / Hủy | Neutral / Success / Info / Info / Danger | cùng tên | UJ |
| | Chỉ báo đồng bộ (đang gửi / lỗi phát hành / chờ truy vấn lại) | `.sync` (spinner + chữ), không là badge trạng thái | | BA |
| Kho | Đủ hàng / Sắp hết / Hết hàng | Success / Warning / Danger | cùng tên | DS |
| | Chưa đặt định mức | Neutral | Chưa đặt định mức | BA |
| | Đang về N | Info (tag phụ) | Đang về N | BA |

Quy tắc: xanh lá chỉ cho thành công; vàng/cam cảnh báo; đỏ lỗi/rủi ro; tím chỉ cho “Chờ QC” và hành động chính. Màn chi tiết lệnh hiện song song hàng “Lệnh – Thanh toán – Hóa đơn”; lệnh Hoàn tất có thể còn Thanh toán = Chưa thanh toán (công nợ).

Thay đổi so với bản trước: Báo giá “Đã gửi” Info → Warning (“Chờ khách duyệt”); Lệnh “Đã duyệt” Info → Neutral; bỏ “Chờ tiếp nhận” và “Chờ duyệt báo giá” khỏi bộ Lệnh, thêm bộ Lịch hẹn/Tiếp nhận; thêm tag lý do cho Tạm dừng. Đếm “Chờ duyệt báo giá 08” trên dashboard và pill menu Phiếu sửa chữa = báo giá ở trạng thái Đã gửi. “Xe chờ phụ tùng 04” = lệnh Tạm dừng có lý do Chờ phụ tùng.

### 6b. Hiện dữ liệu cá nhân theo vai trò (câu 8)

| Vai trò | SĐT | Địa chỉ | Nút Hiện |
| --- | --- | --- | --- |
| CV, QL, TN, QĐ (chi nhánh mình) | Đầy đủ | Đầy đủ | Không cần (ghi nhật ký khi mở hồ sơ) |
| CH, QV | Che | Che số nhà/đường | Có, ghi nhật ký, không cần lý do |
| KT | Che | Che | Có, **bắt buộc chọn lý do** |
| TK | Che | Không hiển thị | Không |
| TH, AD | Không hiển thị | Không hiển thị | Không |

Giá trị đầy đủ không gửi xuống trình duyệt trước khi Hiện; tự che lại sau 30 giây. Bảng quyền che sửa được ở cấu hình (G4-SYS-04), không hard-code.

## 7. Bảng vai trò → menu (theo FRD §2; đã sửa theo F-06)

Khóa vai trò kỹ thuật không dấu: `CH QV QL CV QD TH TK TN KT AD` (`QD` hiển thị là “QĐ”). “✓” tạo/sửa/duyệt (S, D) · Xem = chỉ xem (X) · Của tôi = chỉ phần của mình (Xn) · Hệ thống = chỉ sức khỏe hệ thống. Mục có Xem/Của tôi/Hệ thống hiện thêm nhãn nhỏ cạnh tên mục. Hành động không được phép trong mục đang hiện để disabled kèm lý do.

| Menu | CH | QV | QL | CV | QĐ | TH | TK | TN | KT | MH | NS | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tổng quan | ✓ | ✓ | ✓ | ✓ | ✓ | Của tôi | ✓ | ✓ | ✓ | – | – | Hệ thống |
| Phiếu sửa chữa (báo giá, lệnh) | Xem | Xem | ✓ | ✓ | Xem | Của tôi | Xem | Xem | Xem | – | – | – |
| Lịch hẹn | Xem | Xem | ✓ | ✓ | – | – | – | – | – | – | – | – |
| Khách hàng & Xe | Xem | Xem | ✓ | ✓ | Xem | Của tôi | – | Xem | Xem | – | – | – |
| Kho phụ tùng | Xem | Xem | ✓ | – | – | – | ✓ | – | Xem | Xem | – | – |
| Mua hàng | Xem | Xem | ✓ | – | – | – | ✓ | – | Xem | ✓ | – | – |
| Nhân sự & Công thợ | Xem | Xem | ✓ | Của tôi | Xem | Của tôi | – | – | Xem | – | ✓ | – |
| Tài chính (thu tiền, sổ quỹ, công nợ) | Xem | Xem | ✓ | Xem | – | – | – | ✓ | ✓ | – | – | – |
| Hóa đơn | Xem | Xem | Xem | – | – | – | – | ✓ | ✓ | – | – | – |
| Báo cáo | Xem | Xem | Xem | Của tôi | Của tôi | Của tôi | Của tôi | Của tôi | Xem | Của tôi | Của tôi | – |
| Cài đặt | ✓ (duyệt) | Danh mục | ✓ (chi nhánh mình) | Danh mục | Danh mục | – | Danh mục | – | Danh mục | – | – | ✓ |

Cập nhật theo `ba-answers-04.md` (Câu 5, Phụ lục C) và `ba-answers-06.md` (Câu 1): thêm hai vai trò riêng **MH** (Mua hàng: Mua hàng đầy đủ, Kho phụ tùng chỉ xem, Báo cáo của tôi; không thấy giá vốn, không nhận hàng) và **NS** (Nhân sự: Nhân sự & Công thợ đầy đủ, Báo cáo của tôi; xem dữ liệu nhân sự theo ma trận che Phụ lục D). MH và NS **không có dashboard riêng** (D-09): trang đầu là Mua hàng / Nhân sự, nên menu không có “Tổng quan” và nhãn trang hiện tại chuyển sang mục đầu tiên còn hiện; trên bottom nav mobile hiện thêm “Mua hàng” (MH) hoặc “Nhân sự” (NS). Phạm vi chi nhánh của MH/NS: chọn trong các chi nhánh được gán (`pick`). Mục “Cài đặt” là một mục duy nhất ở chân sidebar; chế độ **“Danh mục”** (`limited`) nghĩa là chỉ liệt kê các màn cài đặt vai trò được mở, nhóm rỗng ẩn; TH, TN, MH, NS không có mục này.

Thay đổi so với bản trước: QĐ thêm Khách hàng & Xe (Xem); TH thêm Khách hàng & Xe (Của tôi), Nhân sự & Công thợ (Của tôi); CV thêm Nhân sự & Công thợ (Của tôi) và Tài chính (Xem trạng thái thu); AD thêm Tổng quan (Hệ thống); CH, QV chuyển các mục thành Xem đúng FRD; KT Phiếu sửa chữa = Xem.

Phạm vi chi nhánh (branch selector):

| Vai trò | Hiển thị |
| --- | --- |
| CH | 3 cấp: “Tất cả chi nhánh” (toàn chuỗi) · Nhóm chi nhánh · Từng chi nhánh |
| QV | “Tất cả nhóm được giao” · các nhóm được giao · chi nhánh trong nhóm |
| QL, KT, MH, NS | Chọn trong các chi nhánh được gán; không có hợp nhất; chi nhánh chưa cấp quyền hiện khóa kèm lý do |
| CV, QĐ, TH, TK, TN (Phase 1 pilot) | Không có bộ chọn: hiện tên chi nhánh tĩnh “Chi nhánh của bạn” |
| AD | Không gắn chi nhánh |

Pháp nhân là bộ lọc phụ, ẩn khi hệ thống chỉ có một pháp nhân; khi hiện, báo cáo chính thức ghi pháp nhân và không cộng gộp giữa các pháp nhân. Đổi phạm vi khi đang soạn chứng từ hỏi lưu nháp trước (D-06). Banner phạm vi luôn hiện (RULE-015).

## 8. Phạm vi dữ liệu (RULE-015) trong shell

- Branch selector trong topbar có nhãn “Phạm vi dữ liệu”; chọn hợp nhất/nhóm thì nút nền tím nhạt (is-all).
- Dưới page header luôn có thanh phạm vi: chi nhánh (và pháp nhân nếu có), khoảng thời gian, thời điểm cập nhật, nút làm mới. Đổi phạm vi hiện toast bằng chữ.
- Chuyển một chi nhánh ↔ hợp nhất là hành động chủ động.

## 9. Accessibility – checklist tự kiểm (WCAG 2.2 AA)

| Hạng mục | Kết quả tự kiểm |
| --- | --- |
| Tương phản chữ ≥ 4,5:1 | Đạt cho các cặp trong `index.html §9` (tính tự động theo token). Có chủ đích không dùng làm chữ: màu gốc Success/Warning/Danger/Info trên trắng và brand-500 trên nền trang. `text.tertiary` trên `surface.subtle` (≈ 4,3:1) không đạt: dùng `text.secondary` trên nền đó |
| Thành phần đồ họa ≥ 3:1 | **Đạt**: `--input-border` #868D9A ≈ 3,34:1 trên trắng cho input/select/textarea/checkbox/radio/switch/chip lọc/ô tìm kiếm. Giữ border.strong chỉ cho card/bảng/divider |
| Không chỉ dựa vào màu | Badge luôn có chữ; rating có icon + chữ; trễ hẹn có chữ “Trễ”; delta KPI có mũi tên + chữ; ngày khóa sổ có gạch ngang + ghi chú chữ |
| Focus nhìn thấy | `:focus-visible` = outline 2px tím + `--shadow-focus`; không đổi radius của phần tử |
| Touch target ≥ 44px | Nâng khi `pointer: coarse` hoặc < 1024px: nút, input, menu, tab, pagination, chip (+ nút xóa chip 44px), chip lọc, nút sắp xếp cột, nút toast, qty, ngày trong lịch, nút xóa ảnh |
| Label luôn hiện | Mọi field có `<label>` |
| Lỗi nêu cách sửa | Có `aria-invalid`, `aria-describedby` |
| Cỡ chữ | Bảng 14px; nhỏ nhất 12px (caption/count) |
| ARIA | tablist/tab/tabpanel, `aria-sort`, `progressbar`, `dialog/alertdialog` + `aria-modal`, `combobox/listbox/option` + `aria-activedescendant`, `aria-live` cho toast, `role=alert` cho banner mất mạng |
| Reduced motion | `prefers-reduced-motion` tắt hoạt ảnh |

### Hành vi bàn phím (bàn giao dev, đã hiện thực trong prototype)

| Component | Hành vi |
| --- | --- |
| Dialog / Drawer | Mở: đặt `aria-modal`, nền `inert`, focus vào ô nhập/nút đầu; Tab/Shift+Tab xoay vòng trong dialog (focus trap); Esc đóng; đóng thì trả focus về phần tử gọi (nếu mở từ menu thì về nút mở menu); bấm nền mờ đóng |
| Dropdown / Menu | Enter/Space/↓/↑ trên nút mở và focus vào mục (mục đang chọn nếu có); ↓ ↑ di chuyển vòng; Home/End; Esc đóng và trả focus về nút; Tab đóng; chọn mục đóng menu |
| Tabs | ← → di chuyển và kích hoạt; Home/End; Tab ra khỏi danh sách tab vào panel |
| Combobox | Gõ lọc (không phân biệt dấu, biển số bỏ dấu chấm/gạch); ↓ ↑ chọn; Enter chốt; Esc đóng; ô vẫn nhập tay tự do |
| Date picker | Nút lịch mở popup, focus vào ngày; ← → ↑ ↓ di chuyển ngày (sang tháng khác tự động); Esc đóng và trả focus; ngày khóa sổ không chọn được |
| OTP | Tự nhảy ô; Backspace lùi; ← →; dán tự chia ô |
| Toàn cục | Ctrl+K vào tìm kiếm; skip link |

Chưa kiểm/chưa làm: screen reader thật; roving tabindex đầy đủ cho menu (đang dùng focus di chuyển); thiết bị cảm ứng thật; dark mode; focus trap cho drawer menu mobile của shell; tooltip đóng bằng Esc.

## 10. Hành vi UX cần giữ khi phát triển

- Nút bị khóa phải có lý do (tooltip `aria-describedby`).
- Hành động tài chính: “Đảo bút toán”/“Điều chỉnh”, không có “Xóa” cho chứng từ đã ghi sổ (RULE-010).
- Dialog nguy hiểm: nêu hậu quả, bắt buộc lý do (≥ 5 ký tự là giả định), gõ mã để mở nút.
- Nút xuất hóa đơn/thu tiền khóa khi đang xử lý (idempotent). Đồng bộ hóa đơn hiện bằng `.sync`.
- Mất kết nối: banner nói rõ cái gì không làm được, bản nháp lưu lúc mấy giờ.
- Số liệu có thể cũ ghi “Cập nhật lúc …”.
- Empty lần đầu ≠ empty do lọc ≠ lỗi tải.
- UI không chứa số hạn mức duyệt: mọi cảnh báo “Vượt hạn mức” lấy từ cấu hình G4-APR-03 và hiện giá trị so với hạn mức cùng tên cấp duyệt (câu 14).
- Thông báo: Phase 1 trong hệ thống; kênh chưa cấu hình hiện “Chưa kích hoạt”; hai mức “Cần xử lý” / “Thông tin” (câu 15).
- Màn thợ: danh sách “Việc của tôi hôm nay”; tạm dừng 2 chạm chọn lý do (Chờ phụ tùng, Chờ khách duyệt phát sinh, Nghỉ, Khác) (câu 13).
- Mẫu in: A4 / A5 / nhiệt 80 mm (58 mm cấu hình), theo khổ không theo hãng; tem/QR phụ tùng là Could, P2+ (câu 12).

## 11. Các câu hỏi cho BA: đã được BA trả lời

17 câu hỏi của phiên bản 0.1 đã được BA trả lời trong `docs/ui-ux/ba-decisions.md` (BA đề xuất, chờ chủ dự án xác nhận chính thức). Tóm tắt nơi áp dụng: câu 1–3, 5 → §6; câu 4 → §4, §6 (kho); câu 6, 7 → §1 (viền input, radius); câu 8, 10 → §6b; câu 9 → §7; câu 11 → §4; câu 12 → §10; câu 13–15 → §10; câu 16 → §1 (dark mode không phát hành); câu 17 → phông tự host (đầu tài liệu).

Còn mở sau lượt này (cần người quyết định, không thuộc 17 câu):
1. Chủ dự án duyệt bốn bổ sung token (badge text, link, focus outline, `--input-border`) và sửa `design-system.md` §5 (radius input 8px).
2. Tải 4 file WOFF2 Be Vietnam Pro vào `design/assets/fonts/` (kiểm tra giấy phép OFL và hiển thị dấu).
3. Cập nhật `user-journey §7` theo `ba-decisions.md` mục D (bộ trạng thái Lịch hẹn/Tiếp nhận, lý do tạm dừng, thuộc tính duyệt hạng mục, chỉ báo đồng bộ hóa đơn).
4. Giả định đã làm theo, dễ đổi: lý do bắt buộc ≥ 5 ký tự; thời gian tự che 30 giây; hết hạn OTP 5 phút (cấu hình); danh sách lý do xem của KT (Đối chiếu hóa đơn / Thu hồi công nợ / Lý do khác); danh sách nhóm chi nhánh mẫu.

## 12. Bảng Finding → đã xử lý ở đâu

| Finding | Mức | Xử lý | Ở đâu |
| --- | --- | --- | --- |
| F-01 Trạng thái gắn nhầm đối tượng | Blocker | Làm lại bộ badge theo A.2 (Lịch hẹn/Tiếp nhận, Báo giá “Chờ khách duyệt” = Warning, Lệnh 7 trạng thái, Đã duyệt = Neutral, Tạm dừng + tag lý do); sửa bảng mẫu, Kanban (dải “Trước lệnh” + cột trạng thái Lệnh), KPI, pill menu, chip lọc | `components.html` §3, §5, §8; `shell.html` (menu, KPI, bảng); `index.html` §2; tài liệu §6 |
| F-02 `:focus-visible` đổi bo góc | Major | Bỏ `border-radius` | `base.css` |
| F-03 Viền control < 3:1 | Major | Token `--palette-gray-450` #868D9A (đo 3,34:1) → `--input-border`, `--control-border`, `--input-border-focus/-error`; áp dụng cho input, select, textarea, checkbox, radio, switch, chip lọc, qty, OTP, upload, ô tìm kiếm | `tokens.css`, `components.css`; cặp mới trong `index.html §9`; tài liệu §1, §9 |
| F-04 Phông Google Fonts | Major | Bỏ link, `@font-face` tự host 400/500/600/700 + `local()` + fallback; README tải file | `base.css`, `assets/fonts/README.md`, 3 trang HTML. **File WOFF2 chưa có** (không có mạng) |
| F-05 Control < 44px khi cảm ứng | Major | Media `(pointer: coarse), (max-width: 1023px)` nâng chip (+ vùng bấm nút xóa 44px), chip lọc, nút sắp xếp, nút toast, qty, ngày lịch, nút xóa ảnh; toast đóng dùng class thay inline | `components.css` §14.12, `app.js` |
| F-06 Bảng vai trò lệch FRD | Major | `ROLE_MENU` theo FRD §2 với chế độ full/view/own/sys, khóa `QD`, nhãn chế độ trên menu, ẩn nhóm rỗng; sửa bảng trong shell và tài liệu | `app.js`, `shell.html`, tài liệu §7 |
| F-07 Branch selector 3 cấp | Major | Menu Hợp nhất / Nhóm / Chi nhánh theo vai trò, QV “Tất cả nhóm được giao”, bộ lọc Pháp nhân ẩn khi 1 pháp nhân (có công tắc giả lập), chi nhánh tĩnh khi 1 chi nhánh, hỏi lưu nháp khi đổi phạm vi, số chi nhánh tính động | `shell.html`, `app.js`, `components.css` §14.8 |
| F-08 Bàn phím dialog/dropdown | Major | Focus trap, inert nền, trả focus, ↓↑ Home End Esc Tab cho menu, Home/End cho tabs; bảng hành vi bàn giao | `app.js`; tài liệu §9 |
| F-09 PII che theo vai trò | Major | Component `.pii`: định dạng `09•• ••• 123`, địa chỉ chỉ quận/tỉnh, Hiện theo vai trò, KT chọn lý do, tự che 30 giây, dữ liệu đầy đủ không nằm trong DOM (hàm mô phỏng API tải khi bấm), trạng thái không có quyền | `app.js` §12, `components.html` §2, `components.css` §14.7 |
| F-10 Date Picker | Major | Popup lịch (một ngày/khoảng, lối tắt, tuần từ Thứ 2, khóa sổ, bàn phím, nhập tay) | `components.html` §2b, `components.css` §14.2, `app.js` §14 |
| F-11 Thiếu badge/tag mới | Minor | Bộ Lịch hẹn/Tiếp nhận, tag lý do, “Quá hạn”, “Đang về N”, “Chưa đặt định mức”, chỉ báo `sync` | `components.html` §3, `components.css` §14.1 |
| F-12 Hex/`rgba` trong CSS | Minor | Thay bằng token (`--color-text-inverse`, `--color-text-on-primary`, `--color-knob`, `--shadow-focus-error`, `--palette-red-700/800`, `--palette-*-300`, `--palette-gray-0/50/150`); bỏ override tooltip dark. Còn hex trong khối primitive và dark mode cấu trúc (đúng chỗ) | `tokens.css`, `components.css` |
| F-13 Ô tìm kiếm topbar không có ranh giới | Minor | Nền trắng + `--input-border` | `components.css` |
| F-14 Dọn prototype | Minor | Số chi nhánh động, nút dark ghi “bản nháp”, toast nhật ký đổi chữ, xóa “cần BA xác nhận” khỏi sản phẩm mẫu | `app.js`, `shell.html`, `components.html`, `index.html` |
| F-15 Badge rỗng | Minor | Kiểm tra: badge “Chưa đồng bộ” có chữ; đã bỏ icon ẩn thừa | `components.html` |
| F-16 Mẫu in | Minor | Ghi khổ A4/A5/nhiệt và backlog G2-PRT; chưa thiết kế mẫu (không chặn Phase 0) | `components.html` §12, tài liệu §10 |
| F-17 Combobox, upload, qty, OTP | Minor | Đã thêm cả bốn component | `components.html` §2b, `components.css` §14.3–14.6, `app.js` §13, §15 |
