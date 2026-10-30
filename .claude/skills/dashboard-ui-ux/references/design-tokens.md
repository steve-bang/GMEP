# Design token, theme và dark mode

Giá trị dưới đây là **điểm khởi đầu hợp lý**, không phải luật. Nếu dự án đã có design system, dùng nó và chỉ áp các nguyên tắc về cách đặt tên, tách vai trò và kiểm tra.

## Mục lục
1. Nguyên tắc token
2. Spacing và layout
3. Typography
4. Màu
5. Radius, viền, elevation
6. Density
7. Dark mode
8. Chuyển động
9. Mẫu CSS variables

## 1. Nguyên tắc token

- **Đặt tên theo vai trò, không theo giá trị**: `--color-text-muted`, `--color-surface-raised`, `--color-status-danger`, không phải `--gray-500` ở chỗ dùng. Có hai tầng: *primitive* (thang màu thô) -> *semantic* (vai trò). Component chỉ dùng semantic.
- Một nguồn sự thật cho giá trị; theme (sáng/tối/density) chỉ đổi ánh xạ semantic -> primitive.
- Mỗi token phải có chỗ dùng rõ ràng; tránh token "mồ côi" và giá trị tùy tiện ngoài thang (magic number).
- Ghi kèm cặp tương phản đã kiểm tra (text trên surface) để dev không phải đoán.

## 2. Spacing và layout

- Lưới cơ sở **8px**, với bước nhỏ 4px: `4, 8, 12, 16, 20, 24, 32, 48, 64`. Đặt tên theo thang (`space-1 ... space-8`) hoặc theo phần trăm cơ sở.
- Padding thẻ 16-24; khoảng cách giữa khối 16-24; khoảng cách giữa nhóm lớn 32+.
- Gutter grid 16-24; lề trang 24-32 desktop, 16 mobile.
- Khoảng trắng dùng để nhóm trước khi dùng viền/bóng.

## 3. Typography

- Chọn **một họ chữ sans** dễ đọc ở cỡ nhỏ, **có hỗ trợ đầy đủ dấu tiếng Việt** (xem `vietnam-localization.md`), cộng tùy chọn một họ mono cho mã/ID.
- Bật `font-variant-numeric: tabular-nums` cho bảng, KPI, mọi nơi số cần thẳng hàng.
- Thang chữ gợi ý (dashboard dày thông tin thường dùng cỡ nhỏ hơn website thường):

| Vai trò | Cỡ / line-height | Đậm |
|---|---|---|
| Caption / helper | 12 / 16-18 | 400 |
| Body nhỏ (bảng, nhãn) | 13-14 / 20 | 400-500 |
| Body | 14-16 / 22-24 | 400 |
| Tiêu đề khối | 16-18 / 24 | 600 |
| Tiêu đề trang | 20-24 / 28-32 | 600-700 |
| **Metric (số KPI)** | 28-36 / 36-40 | 600-700, tabular |

- Cỡ chữ nội dung tối thiểu ~12px cho caption, ~14px cho nội dung chính; tránh chữ xám nhạt cỡ nhỏ.
- Tiếng Việt: line-height thoải mái (body >= 1.5), cẩn thận với tiêu đề viết hoa có dấu chồng (Ế, Ộ); tránh `line-height` < 1.2 cho tiêu đề.
- Dùng đơn vị tương đối (rem) để tôn trọng cài đặt phóng chữ của người dùng; bố cục không vỡ ở 200% zoom.

## 4. Màu

**Nhóm token ngữ nghĩa cần có:**
- Nền: `background` (nền trang), `surface` (thẻ), `surface-raised` (popover/dropdown), `surface-sunken` (vùng lõm/nền input), `overlay`.
- Chữ: `text` (chính), `text-secondary`, `text-muted` (vẫn >= 4.5:1), `text-disabled`, `text-on-primary`, `text-link`.
- Viền: `border`, `border-subtle` (đường kẻ hàng bảng), `border-strong`, `focus-ring`.
- Thương hiệu: `primary`, `primary-hover`, `primary-active`, `primary-subtle` (nền nhạt).
- Trạng thái: `success`, `warning`, `danger`, `info`, mỗi loại có **nền nhạt**, **viền**, **chữ/icon** đậm.
- Dữ liệu: bảng categorical thứ tự cố định, thang sequential, cặp diverging (xem `charts-and-kpi.md`). Tách khỏi màu thương hiệu và màu trạng thái.

**Quy tắc dùng:**
- Phần lớn UI dùng trung tính; màu thương hiệu cho hành động chính và điểm nhấn; màu trạng thái chỉ cho ngữ nghĩa trạng thái.
- Màu trạng thái luôn đi cùng icon/nhãn.
- Kiểm tra mọi cặp chữ/nền: >= 4.5:1 (chữ thường), >= 3:1 (chữ lớn, icon, viền điều khiển, thành phần đồ họa). Kiểm tra cả trạng thái hover, disabled (nên vẫn đọc được), selected.

## 5. Radius, viền, elevation

- Radius: 4 (badge/chip nhỏ), 6-8 (input, nút), 8-12 (thẻ), 12-16 (modal/sheet). Chọn một "tính cách" (sắc/mềm) và nhất quán.
- Dashboard dày dữ liệu thường ưu tiên **viền mảnh 1px nhạt** để phân vùng, đổ bóng chỉ cho lớp nổi (dropdown, modal, toast). Tối đa 3 mức elevation.
- Tránh lồng thẻ trong thẻ trong thẻ; dùng khoảng trắng và tiêu đề nhóm.

## 6. Density

- Hỗ trợ ít nhất 2 mức (Comfortable/Compact) cho bảng và danh sách; lưu lựa chọn người dùng. Đổi density chỉ thay token spacing/chiều cao hàng, không thay thiết kế.
- Dạng gợi ý chiều cao hàng bảng: 40 / 48 / 56px. Vùng bấm tối thiểu 24x24 CSS px (WCAG 2.2 AA), khuyến nghị 32px+ cho điều khiển thường dùng và lớn hơn trên cảm ứng.

## 7. Dark mode

- Làm bằng token ngay từ đầu (xem mẫu bên dưới) và hỗ trợ cả `prefers-color-scheme` lẫn công tắc thủ công lưu theo người dùng.
- **Đừng đảo màu tự động hay copy nguyên bản light.** Chọn lại từng bậc: nền không dùng đen thuần mà là xám than đậm; chữ không trắng thuần quá chói mà là trắng ngà; giảm độ bão hòa của màu nhấn để khỏi "rung" trên nền tối.
- Chiều sâu trong dark mode thể hiện bằng **bề mặt sáng dần** (surface càng nổi càng sáng hơn), không phải bằng đổ bóng.
- Dữ liệu: chọn lại bậc màu biểu đồ cho nền tối (nền tối cho nhiều sắc thái đạt tương phản hơn) và kiểm tra lại tương phản từng cặp.
- Kiểm tra hình ảnh, logo, ảnh chụp, đường kẻ lưới, skeleton, trạng thái hover/selected, focus ring.
- Với ứng dụng dùng cả ngày (vận hành, phân tích), dark mode là kỳ vọng thực tế chứ không chỉ "tính năng thêm"; với nhiều người dùng văn phòng, light mặc định vẫn hợp lý. Cho người dùng chọn, mặc định theo hệ điều hành.

## 8. Chuyển động

- Thời lượng ngắn: 100-200ms cho phản hồi tức thời (hover, toggle), 200-300ms cho chuyển lớp (panel, modal); easing ra-chậm (ease-out) cho phần tử xuất hiện.
- Chuyển động phục vụ hiểu biết (chuyển trạng thái, vị trí) chứ không trang trí. Biểu đồ vào cảnh ngắn hoặc không cần.
- Luôn tôn trọng `prefers-reduced-motion: reduce` (tắt/giảm animation, skeleton shimmer, auto-scroll).

## 9. Mẫu CSS variables

```css
:root {
  /* spacing */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* radius */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;

  /* typography */
  --font-sans: "Inter", "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", Menlo, monospace;
  --text-xs: 12px; --text-sm: 13px; --text-base: 14px; --text-lg: 16px;
  --text-xl: 20px; --text-metric: 32px;
  --leading-body: 1.5; --leading-tight: 1.25;

  /* semantic color: LIGHT (giá trị minh họa, thay theo thương hiệu và kiểm tra tương phản) */
  --color-bg: #f6f8fb;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-border: #d9e0ea;
  --color-border-subtle: #eaeef4;
  --color-text: #111827;
  --color-text-secondary: #374151;
  --color-text-muted: #5b6676;
  --color-primary: #1d4ed8;
  --color-on-primary: #ffffff;
  --color-focus-ring: #1d4ed8;

  --color-success-bg: #e8f6ee; --color-success-fg: #11643a;
  --color-warning-bg: #fff4e0; --color-warning-fg: #8a4b00;
  --color-danger-bg:  #fdeaea; --color-danger-fg:  #a11a1a;
  --color-info-bg:    #e6f0fd; --color-info-fg:    #1a4fa0;
}

/* DARK: chọn lại từng bậc, không đảo tự động. Giá trị minh họa. */
:root[data-theme="dark"] {
  --color-bg: #0f141b;
  --color-surface: #161c25;          /* càng nổi càng sáng hơn */
  --color-surface-raised: #1d2530;
  --color-border: #2b3544;
  --color-border-subtle: #212a36;
  --color-text: #e8ecf2;             /* trắng ngà, không trắng thuần */
  --color-text-secondary: #c3cbd6;
  --color-text-muted: #98a3b3;
  --color-primary: #6b9bff;          /* giảm bão hòa/tăng sáng cho nền tối */
  --color-on-primary: #0b1220;
  --color-focus-ring: #8fb2ff;
}

/* Theo hệ điều hành khi người dùng chưa chọn thủ công */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #0f141b;
    --color-surface: #161c25;
    --color-surface-raised: #1d2530;
    --color-border: #2b3544;
    --color-border-subtle: #212a36;
    --color-text: #e8ecf2;
    --color-text-secondary: #c3cbd6;
    --color-text-muted: #98a3b3;
    --color-primary: #6b9bff;
    --color-on-primary: #0b1220;
    --color-focus-ring: #8fb2ff;
  }
}

body { font-family: var(--font-sans); line-height: var(--leading-body); background: var(--color-bg); color: var(--color-text); }
.num { font-variant-numeric: tabular-nums; text-align: right; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Lưu ý khi dùng mẫu: các giá trị màu chỉ minh họa; phải chạy kiểm tra tương phản cho từng cặp text/surface và các cặp trạng thái (success/warning/danger/info) trong cả hai theme trước khi chốt. Bản dark cần định nghĩa lại cả bộ token trạng thái và màu dữ liệu. Để tránh lặp khối token dark, dùng bước build (Style Dictionary, Tailwind theme, CSS-in-JS) sinh cả hai selector từ một nguồn.
