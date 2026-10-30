# UI/UX – Phase 0: Design Foundation, Component Library, Application Shell

Phiên bản: 0.1 (nháp thiết kế) · Nguồn chuẩn: `docs/design-system.md` (giá trị token, font, kích thước layout KHÔNG đổi). Nghiệp vụ lấy từ `docs/business-requirements.md`, `docs/functional-requirements.md`, `docs/user-journey-business-workflow.md`.

Sản phẩm kèm theo (HTML/CSS/JS thuần, mở trực tiếp bằng trình duyệt, không build):

| File | Nội dung |
| --- | --- |
| `design/assets/tokens.css` | Token 3 lớp + dark mode (cấu trúc) |
| `design/assets/base.css` | Reset, typography, tabular-nums, focus, reduced-motion |
| `design/assets/components.css` | Toàn bộ component + Application Shell |
| `design/assets/icons.svg` | Sprite icon kiểu Lucide (dùng khi chạy qua http) |
| `design/assets/app.js` | JS prototype (nhúng sprite icon cho `file://`, tương tác minh họa) |
| `design/foundation/index.html` | Showcase: màu, typography, spacing, radius, elevation, grid, motion, icon, tương phản |
| `design/foundation/components.html` | Thư viện component đầy đủ trạng thái |
| `design/foundation/shell.html` | Application Shell responsive + đổi vai trò/chi nhánh |

Lưu ý icon: sprite được vẽ lại theo phong cách Lucide (outline, viewBox 24, stroke 1,75–2px) để chạy được khi mở `file://` (trình duyệt chặn `<use href="file.svg#id">` ngoài file). Khi dev chọn stack, thay bằng gói Lucide chính thức, giữ nguyên tên icon.

---

## 1. Tổ chức token 3 lớp

| Lớp | Vai trò | Ví dụ | Ở đâu trong `tokens.css` |
| --- | --- | --- | --- |
| 1. Primitive | Giá trị gốc, không mang ý nghĩa | `--color-brand-500`, `--palette-gray-600`, `--palette-green-800`, `--space-4` | Khối §12 nguyên văn + khối “PRIMITIVE bổ sung” (`--palette-*`) |
| 2. Semantic | Ý nghĩa sử dụng | `--color-primary`, `--color-text-secondary`, `--color-success-text`, `--color-purple-bg`, `--chart-series-1`, `--dur-modal`, `--z-modal` | Khối §12 (phần Semantic) + khối “SEMANTIC bổ sung” |
| 3. Component | Riêng từng component | `--btn-height-md`, `--input-radius`, `--table-row-height`, `--sidebar-item-active-bg`, `--dialog-radius` | Khối “COMPONENT tokens” |

Quy tắc dùng:
- Component chỉ tham chiếu lớp 2 và 3. Không dùng mã hex trực tiếp trong CSS component (ngoại lệ: chữ trắng `#fff` trên nền tím/đỏ đậm).
- Khối §12 được chép nguyên văn; mọi token mới đặt tên không trùng. Token bổ sung chính: `--color-text-on-primary`, `--color-text-link`, `--color-{success|warning|danger|info|neutral|purple}-{bg,text,border}`, `--chart-*`, `--dur-*`, `--z-*`, `--lh-*`, token component.
- Dark mode: chỉ ghi đè lớp 2 (+ vài token lớp 3) dưới `[data-theme="dark"]` (đã có bản nháp; chưa kiểm thử tương phản đầy đủ nên chưa phát hành).
- Hiệu chỉnh thiết kế (không đổi giá trị chuẩn): (a) màu chữ trong badge dùng bản đậm (`--color-*-text`) vì #16A34A và #D97706 chỉ khoảng 3,3:1 và 3,2:1 trên trắng; (b) link dùng `--color-brand-600` (`--color-text-link`) vì brand-500 chỉ ~4,4:1 trên nền trang #F8F9FC; (c) focus dùng `--shadow-focus` kèm viền đặc 2px tím vì alpha 18% quá nhạt; (d) “Chờ QC” dùng thang brand (`--color-purple-*` = brand-600/100/800).

Breakpoint không đặt thành CSS variable (media query không đọc được): mobile 0–639, tablet 640–1023, desktop 1024–1279, wide 1280–1535, ultrawide ≥ 1536.

## 2. Quy ước đặt tên class

BEM: `block`, `block__element`, `block--modifier`. Không tiền tố. Ví dụ `.btn--primary`, `.field__error`, `.kpi__value`, `.table--compact`, `.badge--warning`.

- Trạng thái: `.is-loading`, `.is-selected`, `.is-open`, `.is-error`, `.is-disabled`, `.is-visible`; ưu tiên thuộc tính ARIA khi có nghĩa: `aria-current="page"`, `aria-selected`, `aria-pressed`, `aria-sort`, `aria-invalid`, `aria-checked`.
- Giả lập trạng thái tĩnh cho showcase: `.is-hover`, `.is-focus`, `.is-active`. Trong sản phẩm dùng `:hover`, `:focus-visible`, `:active`.
- Utility: `.stack`, `.row`, `.grid--n`, `.num`/`.tabular`, `.money`, `.plate`, `.code`, `.text-secondary`, `.sr-only`.
- Hook JS prototype: thuộc tính `data-*` (`data-open`, `data-close`, `data-branch`, `data-menu`…), không dùng class để bắt sự kiện.
- Badge đặt tên theo MÀU (`badge--success`), việc ánh xạ trạng thái nghiệp vụ → màu nằm ở §6, tránh class theo nghiệp vụ để khi đổi màu không phải đổi tên.

## 3. Danh mục component và trạng thái

| Nhóm | Component | Trạng thái đã thiết kế |
| --- | --- | --- |
| Actions | Button primary/secondary/ghost/danger (sm 32, md 40, lg 44, xl 52), Icon button, Button group/Split button, Danger-outline | Default, Hover, Focus, Active, Disabled (kèm tooltip lý do), Loading |
| Form | Input, Select, Textarea, Date field (dd/MM/yyyy), Ô tiền (căn phải), Checkbox, Radio, Switch, Masked value | Default, Hover, Focus, Error (kèm thông báo cách sửa), Disabled, Read-only; checkbox thêm Indeterminate |
| Data display | Badge (6 màu, bộ trạng thái cho 5 đối tượng + kho), Tag, Count pill, Plate tag, Avatar (+ trạng thái làm việc), Card, KPI Card, Tooltip | KPI: default, cảnh báo, nguy hiểm, loading, lỗi, dữ liệu cũ (“Cập nhật lúc …”) |
| Data table | Table (sticky header, 52/56px, compact 44px, sort, chọn dòng, bulk bar, footer tổng, cột tiền căn phải), Card list (mobile), Pagination, Filter bar + chip, Cột hiển thị | Có dữ liệu, Loading (skeleton), Empty lần đầu, Empty do lọc, Error + thử lại, Không có quyền, Hover, Selected |
| Navigation | Sidebar (248/72), Topbar (64), Breadcrumb, Tabs, Segmented, Bottom nav, Drawer menu | Default, Hover, Active, Disabled/khóa |
| Workflow | Stepper, Timeline, Progress (xác định/không xác định), Kanban | Done, Current, Error, Pending |
| Feedback | Dialog thường, Dialog nguy hiểm (nhập lý do + gõ mã xác nhận), Dialog đảo bút toán, Drawer, Dropdown/Menu, Toast, Alert (5 loại), Banner mất kết nối, Bản nháp đã lưu, Skeleton, Empty, Error, Permission | Đóng/mở, Esc đóng, trả focus về nút gọi |
| Garage | Vehicle Card, Repair Order Card, Technician Card (nút 52px), Parts Item (4 số tồn), Inspection Checklist (Tốt/Theo dõi/Hỏng, có chữ), Approval Panel (duyệt một phần + bằng chứng) | Default, cảnh báo, trễ hẹn |
| Shell | Branch selector + banner phạm vi, Global search (Ctrl K), Notification center, User menu, Page header | Tất cả chi nhánh / một chi nhánh, mất kết nối, thu gọn, mobile drawer |

## 4. Quy ước hiển thị dữ liệu (VND, ngày, biển số)

| Loại | Quy ước | Ví dụ |
| --- | --- | --- |
| Tiền VND | Dấu chấm phân cách nghìn, không số lẻ, ký hiệu ` ₫` sau số (có khoảng trắng không ngắt), căn phải, tabular-nums | `1.250.000 ₫` |
| Tiền rút gọn (KPI) | Chỉ ở KPI card, kèm đơn vị: `128,5 tr ₫` (dấu phẩy thập phân). Bảng và chứng từ luôn dùng số đầy đủ | `128,5 tr ₫` |
| Số lượng/tồn | tabular-nums, căn phải; chỉ hiện số lẻ khi đơn vị cần (lít) | `24`, `2,5 lít` |
| Ngày | `dd/MM/yyyy`; ngày giờ `HH:mm dd/MM/yyyy` (24h); ngày có thứ ở tiêu đề dashboard: “Thứ Sáu, 30/10/2026” | `30/10/2026 09:15` |
| Biển số | In hoa, giữ dấu gạch và dấu chấm như biển thật, tabular-nums; dùng `.plate` trong bảng, `.plate-tag` (viền) ở thẻ/card | `51H-123.45`, `30G-456.78` |
| Mã phiếu | `RO-năm-số`, tabular-nums, không ngắt dòng | `RO-2026-001284` (tạm; định dạng mã chờ BA) |
| Số điện thoại | Mặc định che theo vai trò: `090••• ••321`; nút “Hiện số” ghi nhật ký truy cập | |
| Phạm vi | Mỗi KPI/báo cáo/xuất file ghi “chi nhánh + khoảng thời gian + thời điểm cập nhật” (RULE-015) | `Quận 7 · 01–30/10/2026 · 09:15` |
| Tìm kiếm | Không phân biệt dấu/hoa thường (cần dev/BA xác nhận kỹ thuật); gợi ý chuẩn hóa biển số khi gõ | |

## 5. Quy tắc responsive

| Dải | Shell | Nội dung |
| --- | --- | --- |
| ≥ 1280 | Sidebar 248px (người dùng thu gọn được xuống 72px, ghi nhớ) | Dashboard tiêu chuẩn, 12 cột, gutter 24, tối đa 1600px căn giữa |
| 1024–1279 | Sidebar compact (mở 248 nhưng nội dung chuyển 1 cột ở khối phụ) | Lưới 2–3 cột |
| 640–1023 | Sidebar tự thu gọn 72px (icon + chấm báo), tooltip bằng `title` | Lưới 2 cột; mọi control ≥ 44px |
| 0–639 | Sidebar thành drawer (nút menu), thêm Bottom nav 4 mục + “Thêm”; search thu thành icon | 1 cột; bảng → card list; dialog thành bottom sheet; page padding 16 |

Quy tắc thêm: không cuộn ngang toàn trang; bảng rộng cuộn ngang trong khung và có cột định danh đầu; touch target ≥ 44px khi cảm ứng hoặc < 1024px; màn thợ trên tablet dùng nút xl (52px), mục tiêu bắt đầu/hoàn thành việc ≤ 2 chạm (NFR).

## 6. Trạng thái nghiệp vụ → Badge

Mỗi đối tượng một bộ riêng. Badge luôn có chữ. DS = `design-system.md §2`; UJ = `user-journey §7`. Ô có dấu (*) là màu do designer đề xuất vì nguồn chưa nêu.

| Đối tượng | Trạng thái | Màu | Nguồn |
| --- | --- | --- | --- |
| Báo giá | Nháp | Neutral | UJ (màu*) |
| | Đã gửi | Info | UJ (*) |
| | Duyệt toàn phần | Success | UJ (*) |
| | Duyệt một phần | Warning | UJ (*) |
| | Từ chối | Danger | UJ (*) |
| | Hết hạn | Neutral | UJ (*) |
| Lệnh sửa chữa | Chờ tiếp nhận | Neutral | DS |
| | Chờ duyệt báo giá | Warning | DS (xem câu hỏi BA #1) |
| | Đã duyệt | Info | UJ (*) |
| | Đang sửa chữa | Info | DS |
| | Tạm dừng | Warning | UJ (*) |
| | Chờ QC (“chờ kiểm tra”) | Purple (brand-600/100/800) | DS |
| | Sẵn sàng bàn giao | Success | DS |
| | Hoàn tất | Success | UJ (*) |
| | Đã hủy | Danger | DS |
| Hạng mục | Chưa làm / Đang làm / Tạm dừng / Hoàn thành / Trả lại | Neutral / Info / Warning / Success / Danger | UJ (*) |
| Thanh toán | Chưa thanh toán | Warning | DS |
| | Thanh toán một phần | Info | DS |
| | Đã thanh toán | Success | DS |
| | Hoàn tiền | Neutral | DS |
| Hóa đơn | Chưa xuất / Đã xuất / Điều chỉnh / Thay thế / Hủy | Neutral / Success / Info / Info / Danger | UJ (*) |
| Kho | Đủ hàng / Sắp hết / Hết hàng | Success / Warning / Danger | DS (so với tồn khả dụng) |

Quy tắc màu: xanh lá chỉ cho thành công; vàng/cam cho cảnh báo cần chú ý; đỏ cho lỗi/rủi ro; tím chỉ cho “Chờ QC” trong nhóm trạng thái và cho hành động chính, không dùng tím cho mọi trạng thái. Chi tiết hiển thị từng đối tượng trong màn hình chi tiết phải hiện song song (không gộp): ví dụ hàng huy hiệu “Lệnh – Thanh toán – Hóa đơn”.

## 7. Bảng vai trò → menu (đề xuất, suy ra từ FRD §2)

Ký hiệu: ✓ đầy đủ theo quyền, Xem = chỉ đọc, Xn = chỉ phần của mình, – = ẩn cả mục. Hành động không được phép trong mục đang hiện thì để disabled kèm lý do, không ẩn lặng lẽ.

| Menu | CH | QV | QL | CV | QĐ | TH | TK | TN | KT | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tổng quan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (việc của tôi) | ✓ | ✓ | ✓ | – |
| Phiếu sửa chữa | ✓ | ✓ | ✓ | ✓ | ✓ | Xn | Xem | Xem | Xem | – |
| Lịch hẹn | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – |
| Khách hàng & Xe | ✓ | ✓ | ✓ | ✓ | – | – | – | Xem | Xem | – |
| Kho phụ tùng | ✓ | ✓ | ✓ | – | – | – | ✓ | – | Xem | – |
| Mua hàng | ✓ | ✓ | ✓ | – | – | – | ✓ | – | Xem | – |
| Nhân sự & Công thợ | ✓ | ✓ | ✓ | – | Xem | – | – | – | Xem | – |
| Tài chính | Xem | Xem | ✓ | – | – | – | – | ✓ (thu tiền) | ✓ | – |
| Hóa đơn | Xem | Xem | Xem | – | – | – | – | ✓ | ✓ | – |
| Báo cáo | ✓ | ✓ | ✓ | Xn | Xn | – | Xn | Xn | ✓ | – |
| Cài đặt | Duyệt | – | ✓ (chi nhánh mình) | – | – | – | – | – | – | ✓ |
| Phạm vi chi nhánh | Tất cả | Nhóm được giao | Chi nhánh được gán | như QL | như QL | như QL | như QL | như QL | Theo gán | Cấu hình |

Ghi chú hiện thực trong `shell.html`: mỗi mục có `data-menu`; `app.js` giữ bảng `ROLE_MENU` (chỉ cho prototype). Nhóm menu rỗng tự ẩn. Bộ chọn chi nhánh chỉ cho “Tất cả chi nhánh” khi vai trò là CH/QV; các vai trò khác thấy ghi chú giải thích vì sao không có lựa chọn hợp nhất. Quản trị hệ thống chỉ thấy Cài đặt và không thấy dữ liệu nghiệp vụ nhạy cảm.

## 8. Phạm vi dữ liệu (RULE-015) trong shell

- Branch selector luôn nằm trong topbar, có nhãn “Phạm vi dữ liệu”; khi chọn “Tất cả chi nhánh” nút đổi sang nền tím nhạt (is-all) để phân biệt với xem một chi nhánh.
- Dưới page header luôn có thanh phạm vi: chi nhánh, khoảng thời gian, thời điểm cập nhật, nút làm mới. Đổi chi nhánh hiện toast xác nhận bằng chữ.
- Việc chuyển giữa một chi nhánh và hợp nhất phải là hành động chủ động (chọn trong menu), không tự đổi.

## 9. Accessibility – checklist tự kiểm (WCAG 2.2 AA)

| Hạng mục | Kết quả tự kiểm |
| --- | --- |
| Tương phản chữ thường ≥ 4,5:1 | Đạt cho các cặp trong `index.html §9` (tính tự động theo token đang áp dụng). Hai cặp không đạt có chủ đích và không dùng làm chữ: màu gốc Success/Warning trên trắng; brand-500 làm chữ trên nền trang (~4,4:1). Cặp `text.tertiary` trên `surface.subtle` (#F1F2F6) xấp xỉ 4,3:1: không đạt, quy ước dùng `text.secondary` trên nền đó |
| Thành phần đồ họa ≥ 3:1 | CHƯA ĐẠT: viền input (border.strong #D1D5DB) chỉ ≈ 1,5:1 với nền trắng, giữ nguyên theo token chuẩn (xem câu hỏi #6). Series biểu đồ đạt |
| Không chỉ dựa vào màu | Badge luôn có chữ; rating checklist có icon + chữ; trễ hẹn có chữ “Trễ”; delta KPI có mũi tên + chữ |
| Focus nhìn thấy | `:focus-visible` = viền đặc 2px tím + `--shadow-focus`; áp dụng cho nút, link, input, checkbox/radio/switch |
| Bàn phím | Tab qua mọi control; Esc đóng dialog/dropdown/drawer menu; mũi tên ←→ chuyển tab; Ctrl+K vào ô tìm kiếm; skip link “Bỏ qua điều hướng” |
| Touch target ≥ 44px | Tự nâng khi `pointer: coarse` hoặc < 1024px (nút, input, menu, tab, pagination); checkbox/radio/switch có vùng bấm 44px; nút icon 40px trên chuột (nâng 44px khi cảm ứng) |
| Label luôn hiện | Mọi field có `<label>`; không dùng placeholder thay label |
| Lỗi nêu cách sửa | Mọi ví dụ lỗi nêu nguyên nhân + cách sửa, có `aria-invalid`, `aria-describedby` |
| Trường bắt buộc | Dấu * kèm chú thích “Dấu * là trường bắt buộc” |
| Cỡ chữ | Chữ bảng 14px; không dùng 11px cho nghiệp vụ (nhỏ nhất 12px, chỉ cho caption/count) |
| ARIA | Tab (`role=tablist/tab/tabpanel`), sort (`aria-sort`), progress (`role=progressbar`), dialog (`role=dialog/alertdialog`, `aria-modal`), toast (`aria-live=polite`), banner mất mạng (`role=alert`) |
| Reduced motion | `prefers-reduced-motion` tắt hoạt ảnh (base.css, skeleton) |
| Ngôn ngữ | `lang="vi"`; font hỗ trợ đủ dấu tiếng Việt, line-height ≥ 1,43 |

Chưa kiểm: đọc bằng screen reader thực tế, focus trap hoàn chỉnh trong dialog (prototype chỉ đưa focus vào dialog và trả về khi đóng), roving tabindex cho menu, kiểm thử trên thiết bị cảm ứng thật, dark mode.

## 10. Hành vi UX cần giữ khi phát triển

- Nút bị khóa phải có lý do (tooltip `aria-describedby`); không ẩn hành động mà người dùng cần biết.
- Hành động tài chính: “Đảo bút toán”/“Điều chỉnh”, không có nút “Xóa” cho chứng từ đã ghi sổ (RULE-010). Hủy lệnh sau xuất phụ tùng cần phiếu hoàn kho và duyệt (UJ §7).
- Dialog nguy hiểm: nêu hậu quả, bắt buộc lý do (≥ 5 ký tự là giả định), gõ mã để mở nút.
- Nút xuất hóa đơn/thu tiền: khóa khi đang xử lý (idempotent, FR-EIN) và hiện kết quả bằng chữ.
- Mất kết nối: banner cố định nói rõ cái gì không làm được, bản nháp lưu lúc mấy giờ; không làm mất dữ liệu đang nhập.
- Số liệu có thể cũ luôn ghi “Cập nhật lúc …”.
- Empty lần đầu khác empty do lọc khác lỗi tải; lỗi không được hiển thị như “không có dữ liệu”.

## 11. Vấn đề phát hiện và giả định (CẦN BA / CHỦ DỰ ÁN XÁC NHẬN)

Giả định của designer (đã làm theo, dễ đổi):

1. Màu cho trạng thái chưa có trong design-system (Báo giá, Hạng mục, Hóa đơn, Đã duyệt, Tạm dừng, Hoàn tất của lệnh) do designer chọn theo ngữ nghĩa §2 (xem bảng §6).
2. Bảng vai trò → menu (§7) suy ra từ ma trận FRD §2; các ô “Xem/Xn” là cách hiểu của designer.
3. Mã phiếu hiển thị dạng `RO-2026-001284` và mã phiếu thu `PT-2026-000912` chỉ là mẫu.
4. Lý do bắt buộc tối thiểu 5 ký tự; chấp nhận ghi nhật ký khi bấm “Hiện số” điện thoại.
5. Dark mode chỉ ở mức cấu trúc; giá trị dark chưa được kiểm thử.
6. Thứ tự “Thực tế / Đang giữ / Đang về / Khả dụng” cho bốn số tồn kho.

Câu hỏi cho BA:

| # | Vấn đề | Lý do |
| --- | --- | --- |
| 1 | Trạng thái lệnh sửa chữa: `design-system §2` có “Chờ tiếp nhận”, “Chờ duyệt báo giá”, “Sẵn sàng bàn giao”; `user-journey §7` định nghĩa lệnh chỉ bắt đầu từ “Đã duyệt” (chờ duyệt báo giá thuộc đối tượng Báo giá) và có “Tạm dừng”, “Hoàn tất”, không có “Chờ tiếp nhận”. Dashboard mẫu của design-system lại đếm “Chờ duyệt báo giá = 08” như một việc cần chú ý. Cần chốt tập trạng thái chính thức của Lệnh và Báo giá, và “Chờ tiếp nhận” là trạng thái của đối tượng nào (Lịch hẹn/Tiếp nhận?) | Nguy cơ hiển thị trạng thái nhầm đối tượng, vi phạm nguyên tắc 5 bộ trạng thái riêng |
| 2 | “Chờ QC” (design-system) và “chờ kiểm tra” (user-journey) là cùng một trạng thái? | Đặt tên thống nhất cho UI |
| 3 | Trạng thái “Chờ phụ tùng” (UJ §8, ngoại lệ phụ tùng thiếu) là trạng thái của lệnh hay cờ cảnh báo? Dashboard mẫu có “Xe chờ phụ tùng 04” | Cần badge/bộ lọc tương ứng |
| 4 | Công thức tồn khả dụng và “Sắp hết” (ngưỡng theo từng mặt hàng?) | Hiện badge kho đúng; RULE-008 |
| 5 | Có hiển thị ở UI cả “Phát sinh chờ khách duyệt” như trạng thái của hạng mục không (UJ §8 BR-REC-04)? Trong UJ §7 hạng mục chỉ có 5 trạng thái | Ví dụ badge “Chờ khách duyệt (phát sinh)” là đề xuất |
| 6 | Tương phản của viền input: `border.strong` #D1D5DB trên nền trắng chỉ ~1,5:1, dưới ngưỡng 3:1 của WCAG 1.4.11 cho thành phần UI. Chủ dự án có cho phép dùng viền đậm hơn (ví dụ #9CA3AF ≈ 2,5:1 hoặc #6B7280 ≈ 4,8:1) cho input không? Hiện giữ nguyên token theo yêu cầu | Tuân thủ mục tiêu WCAG 2.2 AA |
| 7 | design-system mâu thuẫn nội bộ: §5 gán radius `sm 6px` cho Input, §16 chốt “Input radius 8px”. Đang dùng 8px (`--radius-md`) | Xác nhận |
| 8 | Quy tắc dữ liệu cá nhân: vai trò nào được “Hiện số” điện thoại/địa chỉ, có cần lý do khi xem, ghi nhật ký ra sao (Luật BVDLCN 2025) | Hành vi nút “Hiện số” |
| 9 | Phạm vi “Quản lý vùng” (nhóm chi nhánh): có cần chọn nhóm trong branch selector (ngoài “Tất cả” và từng chi nhánh)? Chủ garage có thể có nhiều pháp nhân (mở): selector có thêm cấp “Pháp nhân”? | Cấu trúc branch selector |
| 10 | FRD §2 cho Kế toán quyền X ở “Báo giá và lệnh sửa chữa”, nên bảng §7 để KT “Xem” mục Phiếu sửa chữa. Cần xác nhận KT có thấy cả thông tin khách (SĐT/địa chỉ) trên phiếu hay chỉ phần tài chính | Truy vết từ hóa đơn về lệnh; che dữ liệu cá nhân |
| 11 | Định dạng mã chứng từ (lệnh, phiếu thu, phiếu nhập…) và biển số (xe máy, biển 5 số cũ/mới, biển ngoại giao/quân đội) | Ô nhập, tìm kiếm, cắt chữ |
| 12 | Máy in và khổ giấy (A4/A5/nhiệt) và mẫu in từng chứng từ; có cần in tem/QR cho phụ tùng? | Thiết kế mẫu in ở giai đoạn sau |
| 13 | Mốc “tối đa 2 chạm” của thợ: danh sách việc có cần lọc theo khoang/ca? Thợ có chấm dừng khi chờ phụ tùng không? | Thiết kế màn tablet |
| 14 | Hạn mức cần duyệt (giảm giá, chi phí, tồn kho) vẫn “[Cần chốt]”: UI hiện chỉ có khung (cảnh báo “Vượt hạn mức”), chưa có số | Không hard-code |
| 15 | Thông báo: kênh (trong app, Zalo, SMS) và loại thông báo cần đưa vào notification center; thời gian lưu | Notification center hiện là mẫu |
| 16 | Dark mode có thuộc phạm vi phát hành không? Nếu có, cần duyệt bảng giá trị dark | Hiện chỉ cấu trúc |
| 17 | Dùng phông Be Vietnam Pro (tải Google Fonts) hay tự host (chạy offline/mạng nội bộ tại garage)? | Prototype đang tải từ Google Fonts, có fallback hệ thống |
