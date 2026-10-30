# Design System & Design Token — Garage Management Platform

Calm Enterprise · Purple Accent. Đây là nguồn chuẩn (do chủ dự án cung cấp) cho mọi thiết kế UI/UX; mọi màn hình phải tuân thủ. Khi tài liệu này mâu thuẫn với nghiệp vụ trong BRD/FRD thì nghiệp vụ thắng; về hình thức giao diện thì tài liệu này thắng.

## 1. Triết lý

- **Clarity over Decoration**: thông tin rõ ràng hơn hiệu ứng. Chủ garage nhận ra doanh thu, xe đang sửa, việc trễ, tồn kho thấp mà không cần đọc nhiều.
- **Action-oriented**: mỗi màn hình trả lời: Tôi đang ở đâu? Tình trạng hiện tại là gì? Cần làm gì tiếp theo?
- **Prevent Errors**: xác nhận trước thao tác quan trọng, nêu rõ hậu quả, lưu lịch sử (tiền, phụ tùng, tiến độ).
- **Progressive Disclosure**: người mới chỉ thấy cái cần; nghiệp vụ nâng cao hiện khi cần.
- **One System, Multiple Roles**: cùng design system, trải nghiệm theo vai trò.

Người dùng không phải dân công nghệ: chủ garage, quản lý chi nhánh, cố vấn dịch vụ, kỹ thuật viên, thủ kho, thu ngân, kế toán. Nhìn là hiểu, biết làm gì tiếp, hạn chế thao tác sai.

Tham chiếu: Stripe (dùng màu thương hiệu có tiết chế, SaaS hiện đại), Material Design 3 (semantic color roles, accessibility), IBM Carbon (nền trung tính, phân lớp bề mặt), Atlassian (token đặt tên theo ý nghĩa, spacing, typography). Không sao chép giao diện sản phẩm cụ thể.

**Mô hình token 3 lớp**: Primitive (giá trị gốc) → Semantic (`color.text.primary`, `color.status.success`, `color.surface.page`) → Component (button, input, table, sidebar, modal). Đổi màu thương hiệu hoặc thêm dark mode không phải sửa từng component.

## 2. Màu sắc — Purple-first, neutral-driven

Brand `#635BFF` (Stripe Purple). Chỉ dùng tím cho hành động chính, trạng thái tương tác và điểm nhấn thương hiệu; phần lớn giao diện là nền trung tính sáng, chữ dễ đọc, màu trạng thái có ý nghĩa.

### Semantic tokens

| Token | Value | Dùng cho |
| --- | --- | --- |
| brand.primary | #635BFF | CTA, link, selected |
| brand.hover | #5148E5 | Hover button |
| brand.active | #4038C7 | Pressed |
| brand.subtle | #F1F0FF | Nền selected |
| text.primary | #111827 | Nội dung chính |
| text.secondary | #4B5563 | Mô tả, label |
| text.tertiary | #6B7280 | Metadata |
| text.disabled | #9CA3AF | Disabled |
| surface.page | #F8F9FC | Nền trang |
| surface.card | #FFFFFF | Card, panel |
| surface.subtle | #F1F2F6 | Khu vực phụ |
| border.default | #E5E7EB | Border mặc định |
| border.strong | #D1D5DB | Border nổi bật |

### Màu chức năng (trạng thái)

| Màu | Value | Ý nghĩa |
| --- | --- | --- |
| Success | #16A34A | Đã hoàn thành, đã thanh toán, còn hàng |
| Warning | #D97706 | Chờ duyệt, sắp trễ, tồn kho thấp |
| Danger | #DC2626 | Quá hạn, lỗi, thiếu hàng, thanh toán thất bại |
| Info | #2563EB | Đang xử lý, đang vận chuyển, thông tin |
| Neutral | #64748B | Nháp, chưa bắt đầu, không hoạt động |

Quy tắc bắt buộc:
- Không dùng tím cho mọi trạng thái.
- Xanh lá chỉ cho thành công, không có nghĩa "mọi thứ tốt".
- Vàng/cam là cảnh báo cần chú ý, không trang trí.
- Đỏ cho lỗi hoặc hành động rủi ro.
- Badge trạng thái luôn có chữ, không chỉ dựa vào màu.
- Badge là nền nhạt + chữ đậm, không dùng nền đậm cho mọi badge.

### Màu theo nghiệp vụ garage

| Nghiệp vụ | Trạng thái | Màu |
| --- | --- | --- |
| Repair Order | Chờ tiếp nhận | Neutral |
| Repair Order | Chờ duyệt báo giá | Warning |
| Repair Order | Đang sửa chữa | Info |
| Repair Order | Chờ QC | Purple |
| Repair Order | Sẵn sàng bàn giao | Success |
| Repair Order | Đã hủy | Danger |
| Inventory | Đủ hàng | Success |
| Inventory | Sắp hết | Warning |
| Inventory | Hết hàng | Danger |
| Payment | Chưa thanh toán | Warning |
| Payment | Thanh toán một phần | Info |
| Payment | Đã thanh toán | Success |
| Payment | Hoàn tiền | Neutral |

## 3. Typography

Font chính **Be Vietnam Pro** (có thể Inter nếu dev đã chuẩn hóa; không dùng nhiều font).

| Token | Size / Line height | Weight | Dùng cho |
| --- | --- | --- | --- |
| display.lg | 32 / 40 | 700 | KPI nổi bật |
| heading.xl | 24 / 32 | 600 | Page title |
| heading.lg | 20 / 28 | 600 | Section title |
| heading.md | 18 / 26 | 600 | Card title |
| heading.sm | 16 / 24 | 600 | Subsection |
| body.lg | 16 / 24 | 400 | Nội dung dài |
| body.md | 14 / 20 | 400 | Nội dung mặc định |
| body.sm | 13 / 18 | 400 | Mô tả phụ |
| label.md | 14 / 20 | 500 | Form label |
| caption | 12 / 16 | 400 | Metadata |

- Nội dung bảng mặc định 14px. Form label không nhỏ hơn 13–14px. Không dùng 11px cho thông tin nghiệp vụ.
- Số tiền, số lượng, biển số, mã phiếu dùng tabular numbers (`font-variant-numeric: tabular-nums`).
- Không lạm dụng chữ in hoa. Tiêu đề phân cấp rõ.

## 4. Spacing & layout

Base 4px; khoảng thường dùng 8, 12, 16, 24, 32.

| Token | Value | Dùng |
| --- | --- | --- |
| space.0 | 0 | Không |
| space.1 | 4 | Icon + text sát |
| space.2 | 8 | Gap nhỏ |
| space.3 | 12 | Form field, badge |
| space.4 | 16 | Padding mặc định |
| space.5 | 20 | Nhóm nội dung |
| space.6 | 24 | Card padding |
| space.8 | 32 | Section gap |
| space.10 | 40 | Nhóm lớn |
| space.12 | 48 | Layout section |
| space.16 | 64 | Khoảng lớn |

| Layout (desktop) | Giá trị |
| --- | --- |
| Sidebar expanded / collapsed | 248px / 72px |
| Topbar | 64px |
| Page padding ngang / dọc | 32px / 24px |
| Content max-width | 1600px |
| Card gap | 16–24px |
| Form field gap | 16px |
| Table row height | 52–56px (compact 44px) |

Grid desktop 1440: 12 cột, gutter 24px.

| Breakpoint | Width | Thiết kế |
| --- | --- | --- |
| mobile | 0–639 | 1 cột, navigation mobile |
| tablet | 640–1023 | 2 cột, sidebar thu gọn |
| desktop | 1024–1279 | Sidebar compact |
| wide | 1280–1535 | Dashboard tiêu chuẩn |
| ultrawide | ≥1536 | Nội dung giới hạn max-width |

Không ép bảng 12 cột vào điện thoại: trên mobile chuyển thành card/list hoặc xem chi tiết từng bản ghi.

## 5. Radius, border, elevation

Phong cách soft enterprise: bo góc nhẹ, border tinh tế, shadow nhẹ. Ưu tiên border để phân tách; shadow chỉ cho lớp nổi (popover, dropdown, dialog).

| Radius | Value | Dùng |
| --- | --- | --- |
| xs | 4 | Badge, tag |
| sm | 6 | Input, control nhỏ |
| md | 8 | Button, dropdown |
| lg | 12 | Card, panel |
| xl | 16 | Modal, panel lớn |
| 2xl | 20 | Feature container |
| full | 999 | Avatar, pill |

| Elevation | Value | Dùng |
| --- | --- | --- |
| shadow.none | none | Table, page |
| shadow.sm | 0 1px 2px rgba(16,24,40,.05) | Card |
| shadow.md | 0 4px 12px rgba(16,24,40,.08) | Dropdown |
| shadow.lg | 0 12px 32px rgba(16,24,40,.12) | Modal |
| shadow.focus | 0 0 0 3px rgba(99,91,255,.18) | Focus ring |

## 6. Component design language

Button: primary (tím), secondary, tertiary/ghost, danger (chỉ khi thực sự cần). Ví dụ: "+ Tạo phiếu sửa chữa", "Lưu nháp", "Hủy", "Xóa phiếu". Input: label luôn hiện, dấu * cho bắt buộc, trạng thái default/focus/error/disabled. Badge trạng thái: Chờ tiếp nhận, Chờ duyệt, Đang sửa chữa, Chờ QC, Hoàn thành, Đã hủy.

| Nhóm | Components |
| --- | --- |
| Navigation | Sidebar, Topbar, Breadcrumb, Tabs, Pagination |
| Actions | Button, Icon Button, Dropdown, Split Button |
| Data display | Table, Card, KPI Card, Avatar, Badge, Tooltip |
| Form | Input, Select, Date Picker, Textarea, Checkbox, Radio |
| Feedback | Toast, Alert, Dialog, Confirmation, Empty State |
| Data operations | Search, Filter, Sort, Column Settings, Bulk Actions |
| Workflow | Stepper, Timeline, Kanban, Progress Bar |
| Garage-specific | Vehicle Card, Repair Order Card, Technician Card, Parts Item, Inspection Checklist, Approval Panel |

Data Table (cốt lõi cho kế toán, thủ kho, quản lý, cố vấn): tìm kiếm nhanh; filter theo chi nhánh/trạng thái/thời gian; sort; pagination; ẩn/hiện cột; sticky header; bulk action có kiểm soát; loading/empty/error; tổng số bản ghi và tổng tiền khi phù hợp.

## 7. Visual direction & layout chuẩn

Shell: Sidebar trái (logo "GARAGE OS", WORKSPACE: Tổng quan, Phiếu sửa chữa, Lịch hẹn, Khách hàng, Kho phụ tùng, Tài chính, Báo cáo), Topbar (chọn chi nhánh, tìm kiếm, thông báo, tài khoản), Breadcrumb, Page header (tiêu đề, mô tả ngắn, primary action).

Dashboard mẫu: "Tổng quan — Thứ Sáu, 30 tháng 10 · Tất cả chi nhánh"; KPI: Doanh thu 128,5 tr, Xe đang sửa 42, Chờ duyệt 08, Trễ hẹn 03; "Công việc cần chú ý": Chờ duyệt báo giá 08, Xe chờ phụ tùng 04, Chờ kiểm tra QC 06.

Templates:
- **A. Application Shell** (sidebar, topbar, main, breadcrumb, page header).
- **B. Dashboard**: KPI, biểu đồ doanh thu/hiệu quả, công việc cần chú ý, xe đang sửa, hoạt động gần đây, bộ lọc thời gian + chi nhánh.
- **C. List Page**: title + CTA, search + filter, table, pagination, bulk action.
- **D. Detail Page**: header (mã phiếu, biển số, trạng thái, action), nội dung nghiệp vụ, sidebar (liên quan, lịch sử, ghi chú), timeline.
- **E. Create/Edit Form**: chia nhóm thông tin, stepper nếu quy trình dài, không quá nhiều field một màn hình, sticky footer (Lưu nháp / Tiếp tục / Hủy).

## 8. Dashboard theo vai trò (mỗi role một trang tổng quan riêng)

- **Owner**: doanh thu toàn chuỗi, lợi nhuận theo chi nhánh, số xe đang sửa, chi nhánh tốt/kém, việc cần phê duyệt. (Strategic overview)
- **Branch Manager**: xe đang tiếp nhận, công việc quá hạn, kỹ thuật viên đang làm, kho sắp hết, doanh thu trong ngày. (Daily operations)
- **Service Advisor**: lịch hẹn hôm nay, xe chờ tiếp nhận, báo giá chờ khách duyệt, xe đang sửa, xe chờ bàn giao. (Task-focused)
- **Warehouse**: phiếu nhập hàng, phiếu xuất theo lệnh sửa chữa, yêu cầu cấp phụ tùng, tồn thấp, điều chuyển. (Inventory operations)
- **Accountant**: doanh thu, thu chi, công nợ phải thu/phải trả, hóa đơn, đối soát và báo cáo. (Financial control)

Thêm theo BRD/FRD: Kỹ thuật viên (việc được giao, tablet) và Thu ngân.

## 9. Data visualization

| Dữ liệu | Visualization |
| --- | --- |
| Doanh thu theo thời gian | Line chart |
| Doanh thu theo chi nhánh | Horizontal bar |
| Cơ cấu doanh thu | Stacked bar hoặc donut |
| Trạng thái phiếu sửa chữa | Stacked bar |
| Tồn kho theo nhóm | Bar chart |
| Năng suất kỹ thuật viên | Table + bar |
| Công nợ theo tuổi nợ | Aging table / stacked bar |
| Tiến độ sửa chữa | Timeline / stepper |

Quy tắc: luôn có tên biểu đồ và đơn vị; có filter thời gian + chi nhánh; tooltip giá trị chính xác; không quá nhiều màu; không dùng biểu đồ tròn để so sánh nhiều chi nhánh; có bảng dữ liệu thay thế; không dùng đỏ/xanh lá làm màu trang trí.

## 10. Icon, imagery, motion

Lucide Icons, stroke 1.75–2px; size mặc định 20px, nhỏ 16px, lớn 24px, navigation 20px; không trộn outline và filled. Gợi ý: Dashboard → LayoutDashboard; Repair Order → ClipboardList; Vehicle → CarFront; Customer → Users; Inventory → Warehouse; Finance → Wallet; Reports → ChartNoAxesCombined; Settings → Settings.

Motion: hover 120ms; button press 100ms; dropdown 150ms; modal 180ms; page transition 180–220ms; toast 200ms. Nhanh, nhẹ, không gây mất tập trung; hỗ trợ `prefers-reduced-motion`.

## 11. Accessibility & usability

| Hạng mục | Chuẩn |
| --- | --- |
| Text contrast | WCAG AA, thường 4.5:1 |
| Large text | 3:1 |
| Focus indicator | Hiện rõ khi dùng bàn phím |
| Touch target | Tối thiểu 44 × 44px |
| Error message | Nêu rõ lỗi và cách sửa |
| Required field | Dấu * và giải thích |
| Status | Không chỉ dùng màu |
| Form | Label luôn hiển thị |
| Keyboard | Điều hướng bằng Tab |
| Language | Tiếng Việt dễ hiểu, tránh thuật ngữ kỹ thuật |

Mục tiêu WCAG 2.2 AA. #635BFF với nền trắng ~4.70:1 (đủ cho chữ trắng trên nút tím cỡ chữ thường); phải kiểm tra lại từng cặp màu semantic khi đưa vào component thực tế.

## 12. Cấu trúc token bàn giao (Figma/Developer)

Garage Design System: 01 Foundations (Colors, Typography, Spacing, Radius, Elevation, Grid, Motion, Iconography) · 02 Semantic Tokens (Text, Surface, Border, Brand, Status, Chart, Interaction) · 03 Components · 04 Patterns (Search & Filter, CRUD, Approval, Data Table, Form, Timeline, Empty State) · 05 Templates (Dashboard, List, Detail, Create/Edit, Settings, Reports) · 06 Product Screens (Repair Order, Inventory, Customer, Vehicle, Finance, Procurement, Workforce).

### CSS tokens (tên token dùng chung cho designer và developer)

```css
:root {
  /* Brand */
  --color-brand-50: #F5F4FF;
  --color-brand-100: #EBE9FF;
  --color-brand-200: #D7D3FF;
  --color-brand-300: #B7B0FF;
  --color-brand-400: #958BFF;
  --color-brand-500: #635BFF;
  --color-brand-600: #5148E5;
  --color-brand-700: #4038C7;
  --color-brand-800: #302B9F;
  --color-brand-900: #211E70;
  /* Semantic */
  --color-primary: var(--color-brand-500);
  --color-primary-hover: var(--color-brand-600);
  --color-primary-active: var(--color-brand-700);
  --color-primary-subtle: var(--color-brand-50);
  --color-text-primary: #111827;
  --color-text-secondary: #4B5563;
  --color-text-tertiary: #6B7280;
  --color-text-disabled: #9CA3AF;
  --color-page: #F8F9FC;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F1F2F6;
  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;
  --color-success: #16A34A;
  --color-success-bg: #DCFCE7;
  --color-warning: #D97706;
  --color-warning-bg: #FEF3C7;
  --color-danger: #DC2626;
  --color-danger-bg: #FEE2E2;
  --color-info: #2563EB;
  --color-info-bg: #DBEAFE;
  /* Typography */
  --font-sans: "Be Vietnam Pro", sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.8125rem;
  --font-size-md: 0.875rem;
  --font-size-lg: 1rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 999px;
  /* Layout */
  --sidebar-width: 248px;
  --sidebar-collapsed-width: 72px;
  --topbar-height: 64px;
  --content-max-width: 1600px;
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(16,24,40,.05);
  --shadow-md: 0 4px 12px rgba(16,24,40,.08);
  --shadow-lg: 0 12px 32px rgba(16,24,40,.12);
  --shadow-focus: 0 0 0 3px rgba(99,91,255,.18);
}
```

## 13. Quy tắc UX riêng cho Garage Platform

- **A. Không biến dashboard thành bảng Excel khổng lồ**: tạo phiếu sửa chữa, tiếp nhận xe, xuất kho chia thành các bước logic.
- **B. Luôn hiển thị trạng thái nghiệp vụ rõ ràng**: người dùng biết xe đã tiếp nhận chưa, báo giá đã duyệt chưa, đã cấp phụ tùng chưa, kỹ thuật viên đang ở công đoạn nào, đã QC chưa, đã thanh toán chưa.
- **C. Phân biệt hành động chính/phụ**: ví dụ Repair Order — Primary: Cập nhật tiến độ; Secondary: In phiếu; Tertiary: Xem lịch sử; Danger: Hủy phiếu.
- **D. Thao tác nguy hiểm phải xác nhận hoặc cần quyền đặc biệt**: xóa phiếu, điều chỉnh tồn kho, hoàn tiền, giảm giá vượt hạn mức, thay đổi giá vốn, hủy hóa đơn, ghi nhận thanh toán.
- **E. Empty state hướng dẫn**: ví dụ "Chưa có phiếu sửa chữa nào. Tạo phiếu mới để bắt đầu tiếp nhận xe."

## 14. Lộ trình thiết kế End-to-End

1. **Design Foundation**: brand/color, typography, spacing, radius, elevation, grid/responsive, iconography, variables.
2. **Core Components**: buttons, inputs, selects; tables, cards, badges; dialog, dropdown, toast; navigation, tabs, pagination; loading/empty/error. Mỗi component có Default, Hover, Focus, Active, Disabled, Loading, Error khi phù hợp.
3. **Application Shell**: sidebar, topbar, branch selector, global search, notification center, user menu.
4. **Core Product Screens** (theo workflow): Dashboard; Customer & Vehicle; Appointment & Check-in; Inspection & Diagnosis; Estimate & Approval; Repair Order; Technician & Workforce; Inventory & Warehouse; Finance & Payment; Reports.
5. **Usability Testing**: tiếp nhận xe mới; lập báo giá và gửi khách duyệt; giao việc cho kỹ thuật viên; xuất phụ tùng cho phiếu; thu tiền và xem công nợ. Ghi thời gian, số lỗi, điểm nhầm lẫn, tỷ lệ hoàn thành.
6. **Developer Handoff**: variables và token naming, component variants, responsive, interaction spec, validation/error states, permissions và role-based visibility, accessibility checklist.

Lời khuyên: không bắt đầu bằng việc vẽ dashboard đẹp; bắt đầu từ Foundation → Application Shell + Component Library → một workflow hoàn chỉnh từ tiếp nhận xe đến thanh toán. **Repair Order (Phiếu sửa chữa)** là màn hình chuẩn đầu tiên để kiểm chứng design system.

## 15. Checklist nghiệm thu Design System

- [ ] Đủ primitive và semantic tokens
- [ ] Light theme và cấu trúc sẵn sàng mở rộng Dark theme
- [ ] Đủ màu trạng thái nghiệp vụ
- [ ] Typography hỗ trợ tiếng Việt
- [ ] Spacing, radius, elevation thống nhất
- [ ] Component variants và interaction states
- [ ] Bảng dữ liệu và filter patterns
- [ ] Responsive rules desktop, tablet, mobile
- [ ] Empty, loading, error và permission states
- [ ] Accessibility và contrast checklist
- [ ] Dashboard riêng theo từng role
- [ ] Figma variables và developer handoff

## 16. Quyết định chốt

Design direction Calm Enterprise SaaS · Brand #635BFF · Font Be Vietnam Pro · Base spacing 4px · Grid 12 cột · Sidebar 248px · Topbar 64px · Card radius 12px · Input radius 8px · Chữ bảng 14px · Nền #F8F9FC · Surface #FFFFFF · Component clean, border tinh tế, shadow tối thiểu · Icon Lucide · WCAG 2.2 AA · Role-based, workflow-driven.
