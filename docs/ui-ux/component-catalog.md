# Danh mục component hợp nhất (Unified Component Catalog)

Phiên bản 1.0 · 31/10/2026 · Người lập: designer · Trả lời mục DS-01, DS-02, DS-09 của `docs/dev/review-docs-and-design.md` · Dùng cho slice 1.1 và 1.2 trở đi.

Quy tắc ưu tiên không đổi: nghiệp vụ trong `docs/*.md` thắng; hình thức theo `docs/design-system.md` (token không đổi); thực hành UI/UX theo skill `dashboard-ui-ux`. Tên class và token giữ nguyên 1:1 (`design/assets/components.css` đã được port sang `src/app/styles/` và `src/ui/`). Mọi chỗ ghi `[Cần xác nhận]` hoặc "giả định" là chưa có quyết định, không hard-code.

## 0. Cách đọc và những điều đã kiểm

Nguồn tham chiếu trong `design/` được ghi bằng đường dẫn tương đối. Số liệu dưới đây đo bằng grep trên repo ngày 31/10/2026 (không ước lượng).

| Điều đã kiểm | Kết quả |
| --- | --- |
| Số khối class tiền tố gói trong `pack.css` | Đếm tay từ kết quả grep tên khối (phần trước `__` hoặc `--`, bỏ trùng): g1 94 · g2w 71 · g2q 50 · g3 31 · g4f 43 · g4r 75, tổng 364 khối (± vài khối do g2q/g3/g4f/g4r được cắt ở dấu gạch đầu tiên sau tiền tố). Toàn bộ đã được gộp theo họ ở §3; không bỏ sót họ nào trong danh sách grep |
| Nơi dựng Application Shell | Dựng bằng JS ở 4 nơi: `g1-auth-dashboard/g1-shell.js:123`, `g2-quote-delivery/pack.js:49`, `g4-finance/pack.js:45`, `g4-reports-system/pack.js:54`. Chép tay markup tĩnh ở 64 trang `g2-workshop/*.html` và `g3-inventory-hr/*.html`, cộng `foundation/shell.html`. Bản đã port: `src/ui/components/AppShell.tsx` (chỉ là chỉ báo `.branch-static`, chưa có bộ chọn) |
| Hộp thoại "Lưu nháp trước khi đổi phạm vi" | Ba bản chép: `g1-shell.js:142`, `g2-workshop/pack.js:75`, `foundation/shell.html:242` (review ghi 144 và 77, số dòng lệch nhẹ). Logic đổi phạm vi + hỏi nháp nằm chung ở `assets/app.js` §8 (dòng 254 đến 287) |
| Focus trap và trả focus của dialog | **Đã có** ở `assets/app.js:119–157`: nền được đặt `inert`, `Tab` quay vòng trong `.overlay.is-open`, `Esc` đóng, focus trả về nơi mở. Đính chính lại ghi chú "prototype thiếu focus trap": thiếu thật là roving tabindex và phím mũi tên cho nhóm nút `aria-pressed` (segmented, rating, thẻ chọn chi nhánh `.g1-branch`), typeahead cho menu, và khóa cuộn nền khi dialog mở. Phần dưới đặc tả đầy đủ cho bản thật |
| Phím mũi tên đã có trong prototype | Tabs (`app.js:215–228`), Dropdown/menu (`:194–212`), Combobox (`:514–519`), Date picker (`:578–582`) |
| Phím mũi tên chưa có | `.segmented__item[aria-pressed]`, `.rating__opt`, `.g1-branch[aria-pressed]`, `.g1-worker`, `.g2q-choice`: hiện là nhóm nút Tab từng cái một; bản thật phải là `radiogroup` hoặc `toolbar` với roving tabindex (xem §2.2 và §2.18) |
| Playwright | Môi trường làm việc lần này không có shell nên **không chạy được đo** (xem báo cáo cuối); số liệu đo mức layout nằm ở `mobile-overflow-report.md` (193 trang trước G5) |

Mức dùng lại của từng component, ký hiệu ở các bảng:

- **Đã port**: đã có trong `src/ui/components/` (Button, AppShell, DataTable, FilterBar, StatusBadge, States, Icon). Dev mở rộng tại chỗ, không viết lại.
- **Dựng ở slice 1.1/1.2**: chưa có trong `src/ui`, cần ngay (ScopePicker, UnsavedDialog, ConfirmDialog, Dialog, Field/PasswordField/OtpInput, AuthLayout).
- **Dựng khi tới gói tương ứng**: KpiCard, MoneyInput, ApprovalPanel, PartsItem, Chart, PrintSheet.
- **Chỉ prototype**: không dựng (StateSwitcher, thanh `*-proto`, `data-g*-views`).

## 1. Cây phân tầng (để dev biết đặt component ở đâu)

```
Tokens (tokens.css) ─ Base (base.css: reset, a11y, tiện ích stack/row/sr-only/skip-link)
└─ Primitive: Button, IconButton, Icon, Badge/Tag, Field, Input, Select, Checkbox, Switch, Avatar
   └─ Composite: Dialog, Drawer, Dropdown/Menu, Tabs, Segmented, Stepper, Toast, Alert, Tooltip, Combobox, DatePicker
      └─ Pattern: DataTable + FilterBar + Pagination + BulkBar, KpiCard, StatusBadge, States (Empty, Loading, Error, NoPermission, Offline, Stale),
                  ScopeBar + ScopePicker, ApprovalPanel, PartsItem(Stock4), MoneyInput/Money, PiiField, UnsavedDialog, ConfirmDialog, Chart, PrintSheet
         └─ Layout: AppShell, AuthLayout, PageHeader, DetailLayout (main + aside + timeline), PublicLayout (khách qua liên kết)
```

Quy tắc: component Pattern chỉ ghép Primitive/Composite, không thêm màu hay khoảng cách ngoài token. Trạng thái nghiệp vụ là dữ liệu cấu hình (bảng ở §2.9), không viết cứng trong từng màn hình.

---

## 2. Đặc tả từng component

Mỗi mục: **Mục đích · Props/biến thể · Trạng thái · Bàn phím và a11y (WCAG 2.2 AA) · Responsive · Nguồn tham chiếu · FR/màn hình dùng · Trùng lặp không dựng lại.**

### 2.1 AppShell (khung ứng dụng) · Đã port, mở rộng

- **Mục đích:** sidebar 248/72px, topbar 64px, vùng nội dung, bottom nav điện thoại. Một khung duy nhất cho mọi màn hình có đăng nhập; màn thợ dùng cấu hình menu rút gọn, trang công khai không dùng.
- **Props:** `nav` (nhóm, mục, `mode` hiển thị "Chỉ xem/Của tôi/Danh mục/Hệ thống" theo quyền), `scope` (nhận trạng thái từ ScopePicker hoặc chip tĩnh), `user`, `role views`, `banners` (offline, bảo trì), `pageHeader`.
- **Trạng thái:** sidebar mở/thu gọn (ghi nhớ), mobile drawer; chế độ chỉ xem do khóa chi nhánh; banner offline (`.net-banner`).
- **Bàn phím/a11y:** skip link tới `#main`; `nav` có `aria-label`; mục hiện tại `aria-current="page"`; nút thu gọn `aria-expanded`; drawer mobile là dialog modal (xem §2.4); `Esc` đóng. Phím tắt `Ctrl+K` đưa focus vào tìm kiếm toàn cục (không bắt khi đang gõ trong ô nhập khác).
- **Responsive:** ≥1280 mở; 640–1023 tự thu gọn 72px; <640 drawer + bottom nav; topbar không tràn (quy tắc `00-foundation.md` §5).
- **Nguồn:** `design/foundation/shell.html`, `g1-auth-dashboard/g1-shell.js`, `src/ui/components/AppShell.tsx`.
- **Dùng ở:** G1-SHL-01 và mọi màn hình trong khung.
- **Trùng lặp, KHÔNG dựng lại:** 4 bộ dựng JS của gói (g1-shell.js, g2-quote-delivery/pack.js, g4-finance/pack.js, g4-reports-system/pack.js) và 64 bản markup chép tay. Chỉ dựng một `AppShell`.

### 2.2 ScopeBar và ScopePicker (phạm vi chi nhánh) · Dựng ở slice 1.2

Prototype đầy đủ trạng thái: `design/g5-scope-auth/g5-scp-01.html` (tương tác) và `g5-scp-02.html` (tĩnh). Trả lời DS-02 và câu hỏi Q3 của dev. **Đây là giả định thiết kế chờ BA/chủ dự án chốt** (xem cuối mục).

**Mục đích.** (1) *ScopeBar* (`.scope-banner`): dải luôn hiện dưới tiêu đề trang, ghi phạm vi + thời gian + "Cập nhật lúc" (RULE-015). (2) *ScopePicker*: thay chỉ báo tĩnh ở topbar khi người dùng có từ 2 chi nhánh trở lên. Chuyển giữa **một chi nhánh** và **hợp nhất** là hai kiểu xem tách bạch, không trộn trong một danh sách phẳng.

**Quy tắc hiển thị (giả định, chờ xác nhận):**

| Tình huống | Hiển thị |
| --- | --- |
| Đúng 1 chi nhánh được gán | **Không có bộ chọn.** Chip tĩnh `.branch-static` "Chi nhánh của bạn: …". Không vào Tab. |
| ≥ 2 chi nhánh | Nút `.branch-btn` mở bảng chọn. Khớp đề xuất BA (`docs/dev/ba-answers-for-dev.md` §4, Q3, chờ xác nhận): người nhiều chi nhánh *không* phải CH/QV **phải chọn từng chi nhánh** (nhớ lựa chọn gần nhất) và không có chế độ hợp nhất; CH/QV mặc định "Tất cả chi nhánh được phép" để *xem*, muốn *tạo* chứng từ phải chọn đúng một chi nhánh. Không dùng mặc định "gộp mọi chi nhánh được giao" của slice 1.1 nữa. |
| Hợp nhất được phép (vai trò CH, QV theo FRD §2 và `ba-decisions`) | Tab "Hợp nhất" bật: "Tất cả chi nhánh được gán (N)" và các nhóm chi nhánh được giao (nhóm: `[Cần xác nhận]`). |
| Hợp nhất không được phép | Tab "Hợp nhất" vẫn hiện, `aria-disabled`, kèm đoạn lý do hiển thị thường trực (không chỉ tooltip): "Xem hợp nhất chưa dùng được với vai trò của bạn…". Không âm thầm bỏ tab (nguyên tắc "hiện lý do thay vì ẩn"). |
| Chi nhánh `closing` "Ngừng nhận lệnh mới" và `locked` "Khóa" (FR-SYS-011; ba trạng thái do BA đề xuất ở `ba-answers-for-dev.md` §5, chờ xác nhận) | Cả hai vẫn chọn được (tra cứu lịch sử). `closing`: tag warning "Ngừng nhận lệnh mới" (biểu tượng đồng hồ); vẫn sửa/xuất kho/thu tiền/hóa đơn cho lệnh đang mở, chỉ chặn tạo mới. `locked`: tag warning "Chỉ xem" (biểu tượng khóa); ScopeBar thêm "Chi nhánh khóa: chỉ xem". Nút tạo chứng từ `aria-disabled` kèm lý do (`BRANCH_CLOSING` hoặc `BRANCH_LOCKED`, xem `state-copy.md` §3). Chính xác từng hành động bị chặn do `can`/`reason` từ server quyết định, UI không tự suy ra từ trạng thái chi nhánh. |
| Quyền theo từng danh sách (BA §4: `resolveScope(actor, permission)`) | Một người có thể được giữ quyền khác nhau ở từng chi nhánh (QL tại Q7, TK tại Thủ Đức). Bộ chọn liệt kê chi nhánh người đó được gán; **phạm vi hiệu lực của một danh sách** có thể hẹp hơn. Khi hẹp hơn, ScopeBar thêm dòng "Danh sách này chỉ gồm: Chi nhánh Quận 7 (nơi bạn có quyền xem mục này)"; nếu rỗng thì dùng NoPermissionState. Chưa có prototype riêng cho tình huống này (ghi nhận). |
| Chưa gán chi nhánh | Trạng thái trống "Tài khoản chưa được gán chi nhánh nào", không dữ liệu, không bộ chọn. |
| Chi nhánh người dùng không được gán | **Không liệt kê.** Chỉ có dòng "Bạn được gán N chi nhánh." Tìm không ra thì nói "trong các chi nhánh bạn được gán", không tiết lộ chi nhánh khác tồn tại (NFR-ISO-01). |
| Tạo chứng từ khi đang xem hợp nhất | Nút tạo `aria-disabled`, lý do: "Chọn một chi nhánh để tạo… Mỗi chứng từ gắn với đúng một chi nhánh." |

**Props ScopePicker:** `branches[{id, name, roleAtBranch, locked?, lockReason?}]`, `groups[{id, name, branchIds}]`, `mergedAllowed: boolean`, `mergedDeniedReason: string`, `value: ScopeKey` (`single:<id>` | `all` | `group:<id>`), `onApply(scopeKey)`, `hasUnsavedDraft: boolean`, `offline: boolean`, `searchThreshold = 6`. Server là nguồn sự thật cho `value` và danh sách (dev trả `Scope` đã `resolveScope`); UI không tự suy ra quyền.

**Trạng thái:** đóng · mở · mở có tìm kiếm không kết quả · chọn khác phạm vi hiện tại (Áp dụng bật) · không đổi (Áp dụng `aria-disabled`, lý do hiện ở chân bảng) · mất kết nối (Áp dụng tắt, lý do hiện) · có nháp (mở UnsavedDialog) · đang tải số liệu sau khi đổi (skeleton các khối, ScopeBar đổi ngay).

**Luồng đổi phạm vi:** chọn trong bảng → *Áp dụng phạm vi* (một nút duy nhất, tránh đổi nhầm bằng một chạm; `Enter` trên dòng = áp dụng) → nếu có nháp thì UnsavedDialog → server đổi phạm vi → toast bằng chữ "Đã đổi phạm vi dữ liệu: …" + ScopeBar đổi nền (tím nhạt khi hợp nhất, `scope-banner--branch` khi một chi nhánh) + mọi KPI/bảng tải lại, mỗi KPI ghi phạm vi ở dòng `.kpi__scope`. URL mang phạm vi (ví dụ `?scope=single:q7`) để chia sẻ và F5 giữ nguyên `[giả định]`.

**Bàn phím và a11y:**
- Nút mở: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; `Enter`/`Space`/`↓` mở; nhãn truy cập "Phạm vi dữ liệu hiện tại: …".
- Bảng là `role="dialog"` có `aria-labelledby`, `aria-describedby`; trên điện thoại `aria-modal="true"` + nền mờ; trên desktop không che nền nhưng `Tab` vẫn quay vòng trong bảng, `Esc` hoặc bấm ngoài đóng và **trả focus về nút mở**. Bản thật nên dùng `<dialog>` hoặc Radix Popover/Dialog thay vì tự viết.
- "Kiểu xem" là `radiogroup` hai nút (`role="radio"`, `aria-checked`), roving tabindex, `←→↑↓` đổi, `Home/End`. Danh sách chi nhánh là `radiogroup`, mỗi dòng `role="radio"`, roving tabindex (chỉ dòng đang chọn trong Tab order), `↑↓` chọn dòng kế (focus đi kèm lựa chọn), `Home/End`, `Enter` áp dụng. Ô tìm: `↓` nhảy vào danh sách.
- Tìm không dấu (`da nang` ra "Đà Nẵng"): dùng cùng hàm gấp dấu với ô tìm khác (DS-07). Hiện ô tìm khi từ 6 chi nhánh trở lên `[giả định]`.
- Trạng thái luôn có chữ, không chỉ màu: "Đang dùng", "Chỉ xem", "Hợp nhất". Mục tiêu chạm ≥ 44px (dòng 56 đến 64px trên điện thoại).
- Thay đổi phạm vi được thông báo qua vùng `role="status"` (ScopeBar) và toast; không trộm focus của người dùng.
- Tôn trọng `prefers-reduced-motion` (chỉ animation mở bảng là `gm-pop`).

**Responsive.** ≥640px: popover neo dưới nút, rộng tối đa 440px. <640px: bottom sheet toàn chiều ngang, tối đa 88vh, thanh kéo trang trí, nút Áp dụng/Hủy dính chân và co giãn, nền mờ `--color-surface-overlay`. Tablet xưởng không dùng bộ chọn (thợ cố định một chi nhánh; xem AUT-10). Nút ở topbar điện thoại: bỏ chữ "Phạm vi dữ liệu" khi quá hẹp nhưng tên chi nhánh vẫn đọc được qua `aria-label`; ScopeBar bên dưới tiêu đề luôn đủ chữ.

**Chuyển Phase:** hợp nhất giữa nhiều pháp nhân: bộ lọc "Pháp nhân" xuất hiện khi có > 1 pháp nhân (đã có `.legal-filter`); báo cáo chính thức không cộng gộp qua pháp nhân (đã thiết kế).

**Nguồn tham chiếu:** `design/g5-scope-auth/pack.css` (`g5-scope`, `g5-panel`, `g5-opt`, `g5-mode`), `pack.js`; lớp gốc `.branch-btn`, `.branch-static`, `.scope-banner`, `.menu-item`, `.legal-filter` trong `components.css` (dòng 585–594, 767–771); logic prototype cũ `assets/app.js` §8.

**FR/màn dùng:** FR-SYS-002, 011, 012; NFR-ISO-01; RULE-015. Mọi màn hình trong khung; G1-AUT-08 là màn chọn lúc đăng nhập (dùng lại cùng danh sách và quy tắc).

**Trùng lặp, KHÔNG dựng lại:** dropdown 3 cấp trong `g1-shell.js:49–64` và `g2-workshop/pack.js:44`; `bItem`/`br`; `g1-branch*` và `g1-radio-dot` (thẻ chọn chi nhánh ở AUT-08 → dùng chung `ScopeOption` của §2.2); thanh phạm vi `.g1-filter__asof`, `.g2w-banners` (xem §3).

**Câu hỏi còn mở (không tự quyết):** đề xuất BA ở `ba-answers-for-dev.md` §4 chờ khách xác nhận (mọi thẻ ghi "Đề xuất BA – chờ xác nhận"); "nhóm chi nhánh" (Nhóm Miền Nam…) có tồn tại và ai định nghĩa (FRD chỉ nhắc QV thấy nhóm được giao); ngưỡng số chi nhánh bật ô tìm (6 là giả định thiết kế); phạm vi có đi theo URL không (giả định có); FR mới FR-SYS-032 (chi nhánh làm việc) do BA đề xuất, UI bám tên "chi nhánh làm việc" khi nói về nơi chứng từ mới được tạo.

### 2.3 StateSwitcher (bộ chuyển trạng thái xem thử) · Chỉ prototype, KHÔNG dựng

- **Mục đích:** thanh "Xem thử trạng thái (chỉ prototype)" để người duyệt xem loading, empty, lỗi, không quyền… không cần dữ liệu thật. Trong sản phẩm thật các trạng thái đến từ dữ liệu/lỗi API.
- **Giá trị cho dev:** *danh sách trạng thái từng màn hình* (tên nút của thanh chính là danh sách trạng thái cần dựng và test). Dùng làm bảng kiểm test: mỗi trạng thái một story/Playwright test.
- **Trùng lặp:** `.g1-proto` + `data-g1-views` (`g1-auth.js`), `.g2w-proto`/`g2w-states` (`g2-workshop/pack.js` §3), `.g2q-proto`, `.g3-statebar`, `.g4f-demo`, `.g4r-statebar`, `.g5-proto`. Không dựng component nào trong số này. Nếu cần công cụ cho nội bộ, dùng Storybook controls.

### 2.4 Dialog, Drawer, BottomSheet (nền) · Dựng ở slice 1.1

- **Mục đích:** một component modal cho mọi hộp thoại, ngăn kéo phải (`.overlay--drawer`) và bottom sheet điện thoại (dialog <640px đã thành sheet qua CSS).
- **Props:** `open`, `onClose`, `title`, `description`, `role: 'dialog' | 'alertdialog'`, `size: sm | md`, `initialFocus`, `closeOnOverlay` (tắt cho hộp thoại nguy hiểm), `returnFocusTo`.
- **Trạng thái:** đóng, mở, đang xử lý (nút chính loading, các nút khác khóa), lỗi trong hộp thoại (`alert` đầu thân).
- **Bàn phím/a11y:** `role`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`; focus đầu tiên là phần tử `autofocus` (với hộp thoại nguy hiểm: nút an toàn), nếu không thì phần tử nhập đầu; **focus trap** `Tab`/`Shift+Tab` quay vòng; `Esc` đóng (trừ khi đang xử lý); nền `inert`; khóa cuộn `body`; trả focus về phần tử mở (nếu phần tử đó đã biến mất, về tiêu đề trang). Vị trí kỹ thuật: dùng `<dialog>.showModal()` hoặc Radix Dialog (không tự viết lại vòng Tab).
- **Responsive:** <640px thành bottom sheet, footer nút co giãn; ≥640px căn giữa, tối đa 480/640px; thân cuộn khi cao hơn viewport, header/footer dính.
- **Nguồn:** `components.css` §9 (dòng 381–409); hành vi `assets/app.js:119–169`.
- **Dùng ở:** gần như mọi màn hình.
- **Trùng lặp:** các `.g2q-dlg`, `g1-lockwhy` (lý do khóa), dialog dựng tay trong `g1-shell.js`, `g2-workshop/pack.js`, `foundation/shell.html`: đều là Dialog + nội dung riêng.

### 2.5 UnsavedDialog (lưu nháp trước khi rời hoặc đổi phạm vi) · Dựng ở slice 1.2

- **Mục đích:** chặn mất dữ liệu khi (a) đổi phạm vi chi nhánh, (b) đăng xuất, (c) rời trang có form chưa lưu, (d) hết phiên (G1-AUT-09 giữ nháp).
- **Props:** `reason: 'scope-change' | 'logout' | 'navigate' | 'session'`, `fromLabel`, `toLabel`, `draftTitle`, `onSaveAndContinue()`, `onStay()`, `saveState: idle | saving | failed | offline`.
- **Nội dung chuẩn (scope-change):** tiêu đề "Lưu nháp trước khi đổi phạm vi?"; thân: nêu *chi nhánh từ → đến*, nói rõ "nháp được lưu vào chi nhánh hiện tại, không chuyển sang chi nhánh mới"; hai nút: **Ở lại, tiếp tục soạn** (an toàn, nhận focus đầu) và **Lưu nháp và đổi phạm vi** (chính). Không có nút "Bỏ nháp" ở đây: bỏ nháp là hành động riêng, ở màn nháp.
- **Trạng thái:** mặc định · đang lưu (nút chính loading) · lưu thất bại (alert "Chưa lưu được nháp lên hệ thống. Nháp vẫn nằm trên thiết bị. Phạm vi chưa đổi." + Thử lại) · mất kết nối (không mở, xem ScopePicker: Áp dụng tắt).
- **a11y:** `alertdialog`, mô tả được đọc khi mở. Nháp chung thiết bị: key nháp gồm `userId + branchId + loại chứng từ` (không để nháp chi nhánh A hiện ở B).
- **Nguồn:** `g1-shell.js:142`, `g2-workshop/pack.js:75`, `foundation/shell.html:242`, `assets/app.js:276–284`; bản chuẩn `g5-scope-auth/g5-scp-01.html` (`#g5-dlg-draft`).
- **FR:** RULE-015 / D-06 (`ba-decisions.md`), NFR (mất mạng: cảnh báo + lưu nháp).
- **Trùng lặp, KHÔNG dựng lại:** ba bản chép nêu trên; hộp thoại đăng xuất `dlg-logout` có đoạn `data-draft-only` chính là biến thể `reason: 'logout'`.

### 2.6 ConfirmDialog (hành động rủi ro) · Dựng ở slice 1.1

- **Mục đích:** xác nhận 3 mức theo `ui-ux-flow.md` §5: (1) *thường*: một câu hỏi, hai nút; (2) *nguy hiểm*: nêu hậu quả bằng `.impact-list`, nút `btn--danger`, có thể bắt lý do; (3) *rất nguy hiểm/đảo bút toán*: gõ từ khóa (`data-confirm-word`) + lý do ≥ 5 ký tự.
- **Props:** `level: 1|2|3`, `title`, `consequences: string[]`, `requireReason?: {min}`, `requireWord?: string`, `confirmLabel` (động từ cụ thể, không dùng "OK"), `cancelLabel`, `loading`.
- **Quy tắc miền (RULE-010):** không có hành động "Xóa" cho chứng từ đã ghi sổ; dùng *Đảo (reverse)/Điều chỉnh*, nhãn nút nói rõ "Tạo bút toán đảo". Hủy lệnh sau khi xuất phụ tùng đi qua REC-06 + duyệt, không phải ConfirmDialog đơn.
- **a11y:** `alertdialog`; focus đầu vào nút Hủy (mức 2, 3) hoặc ô nhập đầu; nút nguy hiểm `aria-disabled` kèm dòng chữ nêu điều còn thiếu ("Nhập đúng từ …"); không đóng bằng click nền. Lỗi 409/422 từ server hiện trong hộp thoại.
- **Nguồn:** `components.css` §9 (`.dialog`, `.impact-list`), `assets/app.js:158–169` (`data-confirm-guard`), `foundation/components.html`.
- **Dùng ở:** REC-06, ACC-07, EIN-04, INV-07/17, SYS (khóa chi nhánh) và nhiều màn.
- **Trùng lặp:** `.g2w-danger-zone`, `.g4f-lock*`, `.g2q-lockbar`, `.g1-lockwhy` là *nội dung* gắn vào ConfirmDialog hoặc ReasonDisabled (§2.20), không phải component riêng.

### 2.7 KpiCard · Dựng khi tới dashboard

- **Mục đích:** một con số + nhãn + so sánh + phạm vi (`.kpi`).
- **Props:** `label`, `value` (số đã định dạng), `unit?`, `delta?: {value, direction, label}`, `tone: default|warning|danger`, `href?` (drill-down), `scopeText` (**bắt buộc**, RULE-015), `asOf?`, `state: ready|loading|error|stale|denied`.
- **Trạng thái:** default, cảnh báo, nguy hiểm, loading (skeleton giữ chiều cao), lỗi một thẻ (nút thử lại, không phá cả trang), dữ liệu cũ (chữ "Cập nhật lúc hh:mm"), không quyền (khóa + lý do).
- **a11y:** nếu là liên kết, toàn thẻ là một `<a>`, tên truy cập "Doanh thu: 58.700.000 ₫, Phạm vi: Chi nhánh Quận 7"; mũi tên tăng/giảm có chữ, không chỉ màu; số `tabular-nums`; không dùng tooltip làm nơi duy nhất giải thích cách tính (có biểu tượng thông tin mở popover bàn phím được).
- **Responsive:** lưới `auto-fit minmax(200px, 1fr)`; điện thoại 1 cột, thẻ thứ tự theo ưu tiên của vai trò.
- **Nguồn:** `components.css:218–231`; `g1-auth-dashboard/g1-dsh-*.html`.
- **Dùng ở:** G1-DSH-01…10, RPT, tổng quan các module.
- **Trùng lặp, KHÔNG dựng lại:** `g1-kpis`, `g1-hl-card`, `g2q-sumtiles`/`g2q-tile`, `g4f-sum`/`g4f-big`, `g4r-cards`/`g4r-repcard`/`g4r-meter`, `g3-card`. Tất cả là KpiCard hoặc thẻ tổng hợp (SummaryTile) với props khác nhau.

### 2.8 MoneyInput và Money (tiền VND) · Dựng khi tới gói tiền

- **Mục đích:** nhập và hiển thị tiền nguyên VND (không thập phân), căn phải, `tabular-nums`, hậu tố ` ₫`, dấu chấm hàng nghìn. Lưu `integer` VND (RULE trong CLAUDE.md).
- **Props MoneyInput:** `value: number | null`, `onChange(number | null)`, `min`, `max`, `limit?: {amount, label}` (giảm giá vượt hạn mức, bán dưới giá vốn → hiện cảnh báo và hướng xin duyệt), `readOnly`, `maskedUnlessPermitted` (giá vốn chỉ CH, QV, QL, KT thấy).
- **Hành vi:** gõ số thô, tự chèn dấu chấm khi rời ô hoặc khi gõ nhưng giữ vị trí con trỏ; dán "1.250.000" hoặc "1250000 ₫" đều hiểu; không nhận dấu phẩy thập phân; `inputmode="numeric"`; lỗi ghi cách sửa ("Nhập số tiền bằng số, không có chữ").
- **Money (hiển thị):** bảng và chứng từ dùng số đầy đủ; KPI mới được rút gọn "128,5 tr ₫"; âm hiển thị `−` kèm màu danger **và** chữ nhãn (hoàn tiền, âm quỹ).
- **a11y:** nhãn luôn hiện; hậu tố ₫ là `aria-hidden` kèm `aria-label` hoặc đọc "đồng"; ô tổng dùng `<output>` hoặc `aria-live="polite"` khi tính lại.
- **Nguồn:** `docs/ui-ux/00-foundation.md` §4, các ô `.input` có `.num`; `g2w-money`, `g4f-money`, `g4r-money`.
- **FR:** FR-REC-031, RULE-010, các ACC.
- **Trùng lặp:** `g2w-money`, `g4f-money`, `g4r-money` (cùng căn phải + tabular-nums), `g3-num`.

### 2.9 StatusBadge (5 bộ trạng thái tách biệt) · Đã port, thêm cấu hình

- **Mục đích:** nhãn trạng thái có chữ + màu (`.badge badge--tone`), không bao giờ chỉ dựa màu. **Năm đối tượng, năm bộ riêng** (CLAUDE.md, `ba-decisions.md` A.2); mỗi đối tượng là một `type` riêng, không có "status chung".
- **Props:** `kind: 'quote' | 'order' | 'item' | 'payment' | 'invoice' | …(bộ kho, mua, nhân sự)`, `status: string`, `extra?: {reason?: string; overdue?: boolean}`, `size`. Component tra bảng `kind + status → {tone, label}`; truyền trạng thái lạ → ném lỗi ở dev (không rơi về neutral im lặng).

| Đối tượng | Trạng thái → màu (chữ trên badge) |
| --- | --- |
| Báo giá (`quote`, 6 đã xác nhận; "Đã hủy" thứ 7 chờ xác nhận) | Nháp → Neutral · Đã gửi → **Warning** "Chờ khách duyệt" · Duyệt toàn phần → Success · Duyệt một phần → Warning · Từ chối → Danger · Hết hạn → Neutral |
| Lệnh sửa chữa (`order`, 7) | Đã duyệt → **Neutral** · Đang sửa → Info "Đang sửa chữa" · Tạm dừng → Warning + tag lý do (`.tag--reason`, ví dụ "Chờ phụ tùng") · Chờ kiểm tra → Purple "Chờ QC" · Sẵn sàng giao → Success "Sẵn sàng bàn giao" · Hoàn tất → Success · Đã hủy → Danger |
| Hạng mục (`item`, 5) | Chưa làm Neutral · Đang làm Info · Tạm dừng Warning · Hoàn thành Success · Trả lại Danger. Thuộc tính duyệt phát sinh "Chờ khách duyệt (phát sinh)" là **tag** Warning cạnh badge, không phải trạng thái thứ 6 |
| Thanh toán (`payment`) | Chưa thanh toán Warning · Thanh toán một phần Info · Đã thanh toán Success · Hoàn tiền Neutral · cờ "Quá hạn" là tag Danger |
| Hóa đơn (`invoice`) | Chưa xuất Neutral · Đã xuất Success · Điều chỉnh Info · Thay thế Info · Hủy Danger. Chỉ báo đồng bộ nhà cung cấp là `.sync` (spinner + chữ), **không** phải badge trạng thái (trạng thái lấy từ nhà cung cấp, DM-9) |
| Kho, mua hàng, nhân sự | Xem `00-foundation.md` §6 và §6a; quy tắc chung: "Chờ duyệt" luôn Warning, "Từ chối" luôn Danger, "Đã ghi sổ/Đã duyệt/Nhận đủ" Success, "Nháp/Đã hủy/Đã đóng" Neutral, tím chỉ cho "Chờ QC" |

- **Trạng thái:** mặc định, có tag phụ, thu gọn trên bảng hẹp (vẫn có chữ), `badge--lg` ở header chi tiết.
- **a11y:** chữ đủ tương phản (`--color-*-text` trên `-bg`); biểu tượng chấm `::before` trang trí; trong bảng sắp xếp theo trạng thái dùng thứ tự nghiệp vụ, không theo chữ cái.
- **Màn chi tiết lệnh** hiện song song hàng "Lệnh · Thanh toán · Hóa đơn" ba badge cạnh nhau (lệnh Hoàn tất vẫn có thể "Chưa thanh toán").
- **Nguồn:** `components.css:182–198`, `src/ui/components/StatusBadge.tsx` (hiện chỉ nhận `tone`; cần thêm bảng `kind/status`), `docs/ui-ux/00-foundation.md` §6.
- **Bản đã port cần sửa:** `StatusBadge({tone})` cho phép mọi người truyền tay màu → thay bằng API `kind/status` để không ai tự "chế" trạng thái.
- **Trùng lặp:** `g2q-badges`, `g1-chip-state`, các `*-statebar` hiện nhãn trạng thái dựng tay.

### 2.10 ApprovalPanel (duyệt báo giá một phần, duyệt chứng từ) · Dựng khi tới REC/QUO/APR

- **Mục đích:** hai kiểu: (1) *Duyệt theo hạng mục* của báo giá (`.approval`: dòng, tổng, bằng chứng) cho khách và cố vấn; (2) *Hàng chờ phê duyệt* (APR) theo hạn mức, người lập ≠ người duyệt.
- **Props (kiểu 1):** `lines[{id,label,price,mandatory,approved}]`, `totals {quoted, approved}`, `evidence {method, at, hash}`, `canPartiallyApprove`, `onChange`. Bỏ tick hạng mục "Bắt buộc" mở cảnh báo an toàn + lý do; "Từ chối toàn bộ báo giá" là hành động riêng.
- **Props (kiểu 2):** `request {type, amount, limit, requester}`, `canApprove` (+ `whyNot`), `onApprove`, `onReject (lý do bắt buộc)`.
- **Trạng thái:** chờ · duyệt một phần · duyệt toàn phần · từ chối · hết hạn · phiên bản mới thay thế · chỉ đọc (đã chốt) · không quyền duyệt (kèm lý do: "Bạn là người lập yêu cầu").
- **a11y:** mỗi dòng là `checkbox` có nhãn đủ ("Duyệt: Thay má phanh trước, 1.250.000 ₫"); tổng cập nhật qua `aria-live="polite"`; nút duyệt `aria-disabled` kèm lý do hiển thị; trên điện thoại khách (chữ ≥ 16px, nút ≥ 44px).
- **Nguồn:** `components.css:541–548`; `g2-quote-delivery/g2-quo-03.html`, `g2-quo-06.html`, `g4-finance/g4-apr-*.html`.
- **FR:** FR-REC-009, 026, 031; FR-SYS-004; RULE-005/006/011.
- **Trùng lặp:** `g2q-choice(s)`, `g2q-sign`, `g2q-cond`, `g4f-limit`, `g4f-entry`; "Phát sinh chờ duyệt" của thợ dùng chung ApprovalPanel kiểu 1.

### 2.11 PartsItem và Stock4 (bốn số tồn kho) · Dựng khi tới INV/REC

- **Mục đích:** một dòng phụ tùng kèm bốn số **Thực tế · Giữ chỗ · Đang vận chuyển · Khả dụng** (`.part-item` + `.stock4`). Cảnh báo và chặn xuất so với **Khả dụng** (= Thực tế − Giữ chỗ; hàng đang vận chuyển không cộng, RULE-008). Không có nút "Sửa tồn" (RULE-007, 009).
- **Props:** `part {sku, name, price?}`, `stock {onHand, reserved, inTransit, available}`, `minLevel?`, `ordered?` (tag phụ "Đã đặt N", không phải số thứ năm), `scope`, `showCost: boolean` (theo quyền), `qtyRequested?` (kiểm vượt khả dụng).
- **Trạng thái:** đủ hàng (Success) · sắp hết (Warning, `stock4__cell--low`) · hết (Danger, `--out`) · chưa đặt định mức (Neutral) · khả dụng liên chi nhánh (hiện số của chi nhánh khác chỉ "số có thể cho", BA-05).
- **a11y:** bốn số là danh sách mô tả (`dl`), nhãn đầy đủ khi đọc ("Khả dụng 3"); màu nền phụ trợ nhưng nhãn luôn là chữ; số nguyên/thập phân theo đơn vị (lít) `[Cần xác nhận]` BA-04.
- **Responsive:** `<480px` thành 2×2 (`components.css:526`).
- **Nguồn:** `components.css:514–526`, `g3-inventory-hr/g3-inv-03/04/06.html`, `g2-quote-delivery/g2-quo-02.html` (`g2q-stock`).
- **Trùng lặp:** `g2q-stock`, `g2w-part`, `g3-var`/`g3-hit`/`g3-num`, `g3-scan` (mặc dù quét mã là component riêng: BarcodeScan).

### 2.12 DataTable · Đã port, mở rộng

- **Mục đích:** bảng cho kế toán, thủ kho, quản lý: tìm, lọc, sắp xếp, phân trang, ẩn/hiện cột, sticky header, chọn nhiều + bulk bar, tổng ở chân; điện thoại thành thẻ danh sách (`.record-list`).
- **Props:** `columns[{key, label, type: text|number|money|date|status, sortable, align, mask?}]`, `rows`, `total`, `page`, `pageSize` (mặc định 25, tối đa 100, Q12), `sort`, `selection`, `bulkActions`, `footerTotals`, `state: ready|loading|empty-first|empty-filtered|error|denied`, `rowHref`, `scopeText`.
- **Quy tắc:** chữ căn trái, số/tiền căn phải + `tabular-nums`; sắp xếp/lọc/phân trang phía server khi dữ liệu lớn; cột có `aria-sort`; hàng được chọn không chỉ đổi màu (checkbox); xuất dữ liệu chỉ khi có quyền xuất (FR-SYS-013) và ghi phạm vi + thời gian ở đầu tệp (RULE-015); dữ liệu cá nhân che theo vai trò (§2.16).
- **Bàn phím/a11y:** `<table>` thật với `<th scope>`; tiêu đề sắp xếp là nút; `Space` chọn hàng; hàng liên kết có một liên kết chính trong ô mã (không phủ cả hàng bằng `onclick`); bulk bar xuất hiện bằng `role="region"` + thông báo "Đã chọn N dòng"; sticky header không che focus (`scroll-padding-top`).
- **Responsive:** cuộn ngang trong `.table-scroll` (không tràn trang); <640px chuyển `.record-list`.
- **Nguồn:** `components.css` §5, `src/ui/components/DataTable.tsx`, `g2-workshop/g2-crm-01.html`, `g2-rec-02.html`, `g3-inv-01/08.html`, `g4-finance/g4-acc-02.html`.
- **Trùng lặp:** `g2w-table-filters`, `g2w-cell-stack`, `g3-row`, `g3-matrix`/`g3-cell`, `g4f-matrix`, `g4r-matrix`/`g4r-cell`, `g1-matrix` (ma trận quyền/lưới: component MatrixTable riêng, không phải DataTable).

### 2.13 FilterBar · Đã port, mở rộng

- **Mục đích:** hàng bộ lọc trên bảng/báo cáo: tìm, trạng thái, khoảng ngày, chi nhánh (nếu hợp nhất), chip lọc đang áp dụng, "Xóa tất cả", lưu chế độ xem.
- **Props:** `fields[]`, `values`, `onApply`, `onReset`, `appliedChips[]`, `savedViews?`, `asOf?`, `scope` (hiển thị cạnh, không thay ScopeBar).
- **Quy tắc:** bộ lọc đang áp dụng luôn nhìn thấy dạng chip có nút xóa; kết quả "không có dữ liệu do lọc" khác "chưa có dữ liệu" (§2.14); tìm không dấu; ngày `dd/MM/yyyy`; điện thoại: bộ lọc nằm trong Drawer, nút "Lọc (N)" hiện số bộ lọc đang bật.
- **a11y:** `role="search"` cho ô tìm; các control là form thường; chip xóa có tên "Bỏ lọc: Trạng thái = Đang sửa".
- **Nguồn:** `components.css:289–` (`.filter-bar`, `.chip`, `.chip-filter`), `src/ui/components/FilterBar.tsx`; `g1-filter*`.
- **Trùng lặp:** `g1-filter` (cùng ý nhưng gắn dashboard + "Cập nhật lúc"), `g2w-table-filters`, `g2w-seg-row`, `g2w-chips`.

### 2.14 States: EmptyState · LoadingState · ErrorState · NoPermissionState · OfflineBanner · StaleNote · Đã port, mở rộng

- **Mục đích:** mỗi khối có đủ 7 trạng thái (skill §6): loading (skeleton đúng hình), empty lần đầu (có hướng dẫn hành động), empty do lọc (nút xóa lọc), error (nút thử lại + mã tham chiếu), partial, stale/offline (ghi thời điểm), no-permission (nói *vì sao* và liên hệ ai).
- **Props chung:** `title`, `text` (cách khắc phục), `actions`, `reference?` (mã tham chiếu yêu cầu), `tone`. Câu chữ chuẩn: `docs/ui-ux/state-copy.md`.
- **Bàn phím/a11y:** `ErrorState` `role="alert"`; `NoPermissionState` và `Loading` `role="status"`; loading đặt `aria-busy`; tiêu đề lỗi trang nhận focus khi lỗi thay thế cả trang; layout không nhảy khi dữ liệu về (skeleton giữ chiều cao); lỗi tải không được hiển thị như "không có dữ liệu".
- **Biến thể trang:** `404/403/5xx/offline/link-expired` toàn trang (G1-ERR-01…05) dùng `ErrorPage` bọc `State` + liên kết Về trang chủ.
- **Nguồn:** `components.css` §10 (`.state`, `.skeleton`), `src/ui/components/States.tsx`, `g1-err-*.html`.
- **Trùng lặp:** `g1-state-flush`, `g1-state-wide`, `g1-stale`, `g1-err`, `g1-chip-state`, `g1-icon-badge`, `g2w-states`, `g2w-drop-denied`, `g3-readonly`, `g3-why`, `g4f-readonly`, `g4f-why`, `g4f-rolenote`, `g2w-why`, `g4r-why`: đều là State/ReasonDisabled/ReadOnlyNote, không viết lại.

### 2.15 Form: Field, PasswordField, OtpInput, Combobox, DatePicker, QtyStepper, Upload · Dựng ở slice 1.1 (Field, PasswordField, OtpInput)

- **Field:** nhãn luôn hiện, dấu `*` kèm lời giải thích "Bắt buộc nhập", gợi ý (`.field__hint`), lỗi (`.field__error`) nêu cách sửa, liên kết bằng `aria-describedby`; `aria-invalid` khi lỗi; chuyển focus tới ô lỗi đầu tiên khi gửi; không xóa dữ liệu đã nhập khi lỗi.
- **PasswordField:** nút hiện/ẩn là `button` có `aria-pressed` và tên "Hiện mật khẩu"; cảnh báo Caps Lock; `autocomplete="current-password"`/`"new-password"`; cho phép dán (không chặn trình quản lý mật khẩu); danh sách yêu cầu *trực tiếp* là `ul` có tên và mỗi dòng ghi "Đạt/Chưa đạt" bằng chữ (không chỉ biểu tượng). Chỉ liệt kê quy tắc có trong tài liệu: ≥ 10 ký tự (kiểm trực tiếp) và khác 5 mật khẩu gần nhất (chỉ kiểm khi lưu, ghi rõ trên dòng). Chữ hoa/số/ký tự đặc biệt và danh sách mật khẩu thông dụng `[Cần xác nhận]`: không thêm. Không có thanh "độ mạnh" khi chưa có quy tắc (G1 có thanh đó; G5 bỏ).
- **OtpInput:** 6 ô, dán cả mã vào ô đầu, `inputmode="numeric"`, `autocomplete="one-time-code"`, mũi tên và Backspace chuyển ô, nhóm có `aria-labelledby`; chế độ PIN che ký tự (`type="password"` từng ô). Lỗi hiển thị một chỗ và cho biết cách sửa.
- **Combobox, DatePicker:** `role="combobox"`/`listbox` theo WAI-ARIA, tìm không dấu; ngày nhập tay luôn được; ngày khóa sổ có lý do; tuần bắt đầu Thứ Hai.
- **QtyStepper:** nút ± ≥ 44px, nhập tay, cảnh báo vượt Khả dụng; **Upload:** nút chụp ảnh, nén phía trình duyệt, tiến trình, lỗi thử lại (giới hạn media: DS-05, `[Cần xác nhận]`).
- **Nguồn:** `components.css` §2 và §12; `g1-auth-dashboard/g1-aut-0*.html`; `assets/app.js` §10–§12.
- **Trùng lặp:** `g1-fs`, `g1-form`, `g1-fieldset`, `g1-pw*`, `g1-rules`, `g1-strength`, `g1-pin-dots`, `g1-pinpad`, `g1-qr`, `g1-key`, `g1-codes`, `g1-countdown`, `g2w-pub-input`, `g2w-wizard-panel`.

### 2.16 PiiField (dữ liệu cá nhân che theo vai trò) · Dựng khi tới CRM

- **Mục đích:** SĐT/email/địa chỉ che mặc định (`09•• ••• 123`, `a•••@gmail.com`, địa chỉ chỉ quận và tỉnh); nút **Hiện** ghi nhật ký truy cập, tự che lại sau 30 giây; vai trò không được xem thì **không có** trường (không phải ô trống). Bảng quyền ở SYS-04, không hard-code.
- **Quy tắc kỹ thuật:** giá trị đầy đủ **không** có trong HTML/props trước khi Hiện; nút Hiện gọi endpoint có nhật ký; kết quả tự che bằng timer; xuất file cũng che theo quyền.
- **Props:** `kind: phone|email|address`, `maskedValue`, `canReveal`, `needReason`, `onReveal(reason?)`, `revealedFor` (giây).
- **a11y:** nút Hiện có tên "Hiện số điện thoại của <khách>"; khi hiện, thông báo `aria-live="polite"` và đếm lùi không gây tiếng ồn; không tự che khi người dùng đang chọn/sao chép.
- **Nguồn:** `components.css` (`.pii`, `.masked`), `assets/app.js` §12, `g2w-pii`, `g3-masked`.
- **Trùng lặp:** `g2w-pii`, `g3-masked`, `g3-sample`.

### 2.17 Stepper và Wizard (nhập liệu nhiều bước) · Dựng khi cần

- **Mục đích:** form dài chia bước (REC-01 5 bước, SYS-20 6 bước, ACC-08 4 bước, kích hoạt tài khoản). Không dùng cho form ngắn: kích hoạt tài khoản ở G5-AUT-03 chỉ **một trang** (ít bước hơn bản wizard 4 bước của G1-AUT-06, đo bằng số lần chạm).
- **Props:** `steps[{id,label,state: done|current|error|pending}]`, `onNext/onBack`, `validateStep`, `draftKey`.
- **a11y:** `ol` có `aria-label`, bước hiện tại `aria-current="step"`; khi sang bước mới focus vào tiêu đề bước (`tabindex="-1"`); lỗi bước ghi tên bước; chân dính (Lưu nháp / Quay lại / Tiếp tục).
- **Nguồn:** `components.css` (`.stepper`), `g1-auth.js` §5, `g2w-wizard-panel`, `g2w-wizard-foot`, `g4r-wiz`, `g2q-steps`.

### 2.18 Nhóm lựa chọn: Segmented, RadioCards, Rating · Dựng khi cần (roving tabindex)

- **Mục đích:** chọn một trong vài giá trị (kiểu xem, mức xanh/vàng/đỏ, thẻ chọn chi nhánh/thợ).
- **a11y bắt buộc (khác prototype hiện tại):** nếu chọn đúng một giá trị → `role="radiogroup"` + `role="radio"` + `aria-checked` + roving tabindex + phím mũi tên; nếu là bật/tắt độc lập → nút `aria-pressed` (từng nút một điểm Tab) hoặc `toolbar`. **Không** dùng `aria-pressed` cho nhóm loại trừ nhau. Lựa chọn bằng màu (Rating) luôn có chữ.
- **Nguồn:** `components.css:316–319`, `:533–539`; `g5-scope-auth/pack.css` (`.g5-mode`).
- **Trùng lặp:** `.g1-branch`, `.g1-worker`, `.g2q-choice`, `.g2w-ins-item` (radio dạng thẻ) và `g2w-rating-xl`.

### 2.19 Chart (biểu đồ) và bảng thay thế · Dựng khi tới dashboard

- **Mục đích:** đường (doanh thu theo thời gian), cột ngang (so sánh chi nhánh), cột xếp chồng (trạng thái lệnh), aging; luôn kèm *bảng dữ liệu thay thế* (nút "Xem dạng bảng"), tên biểu đồ, đơn vị, tooltip bàn phím dùng được, màu có mẫu hoặc nhãn phụ. Không dual-axis, không 3D, không pie nhiều lát.
- **Props:** `kind`, `series`, `scopeText`, `period`, `state`, `tableFallback`.
- **a11y:** SVG có `role="img"` + `aria-label` tóm tắt (ví dụ "Doanh thu 7 ngày, tăng 12%"); điểm dữ liệu focus được hoặc có bảng thay thế; tương phản 3:1 cho cột/đường; không chỉ màu.
- **Nguồn:** `g1-auth-dashboard/g1-charts.js`, `g1-chart*`, `g4r-chart*`, `g4f-hbars`, `g4f-aging`.
- **Trùng lặp:** `g1-chart`, `g1-sw`, `g1-tip`, `g1-ax`, `g1-val`, `g1-grid`, `g1-base`, `g1-hl`, `g1-cursor`, `g1-target`, `g1-line`, `g1-dot`, `g1-seg`, `g1-f1…5`, `g1-k1…5`, `g1-b1…5` và bản g4r tương ứng (`g4r-svg`, `g4r-grid`, `g4r-axis`, `g4r-line`, `g4r-dot`, `g4r-bar`, `g4r-target`, `g4r-s1…5`, `g4r-f1…5`, `g4r-b1…5`, `g4r-tip`, `g4r-hbar`, `g4r-stack`, `g4r-legend`, `g4r-chartcard`): hai bộ vẽ trùng nhau. Dựng một `Chart`.

### 2.20 ReasonDisabled (khóa kèm lý do) · Dựng ở slice 1.1

- **Mục đích:** hành động bị khóa vẫn nhìn thấy và giải thích vì sao (nguyên tắc `ui-ux-flow.md` §5.6, DS-09). Hợp đồng API: bản ghi trả `can: {action: boolean}` và `reason: {action: {code, message}}`.
- **Hiển thị:** nút `aria-disabled="true"` (không dùng thuộc tính `disabled` để vẫn focus/đọc được) + dòng lý do ngay cạnh hoặc dưới (`aria-describedby`); bấm vào nút khóa không làm gì ngoài toast thông tin (tùy). Tooltip chỉ là phần phụ, không phải nơi duy nhất.
- **Mã lý do chuẩn (danh sách tối thiểu cho dev):** `NO_PERMISSION` (Bạn chưa có quyền …), `BRANCH_LOCKED` (Chi nhánh đã khóa: chỉ xem), `BRANCH_CLOSING` (Chi nhánh ngừng nhận lệnh mới), `SCOPE_MERGED` (Chọn một chi nhánh để …), `PERIOD_CLOSED` (Ngày/kỳ đã khóa), `STATE_INVALID` (Trạng thái hiện tại không cho phép …), `SELF_APPROVAL` (Người lập không tự duyệt), `STOCK_INSUFFICIENT` (Vượt tồn khả dụng), `OFFLINE` (Đang mất kết nối), `REQUIRES_APPROVAL` (Cần phê duyệt trước). Chữ tiếng Việt chuẩn: `state-copy.md` §3.
- **Trùng lặp:** `g1-lockwhy`, `g2q-lockbar`, `g3-why`, `g4f-why`, `g4f-lock`, `g2w-why`, `g4r-why`, `tag--reason` (dùng cho lý do *Tạm dừng*, giữ nguyên).

### 2.21 PrintSheet (mẫu in) · Dựng khi tới in ấn (DS-04)

- **Mục đích:** một nguồn mẫu in HTML in-first (không phụ thuộc JS) dùng cho cả in trình duyệt và PDF máy chủ; khổ A4, A5, nhiệt 80mm; tiêu đề lặp, số trang thật; ghi phạm vi/thời gian/người in.
- **Props:** `paper: a4|a5|thermal80`, `doc` (báo giá, lệnh, hóa đơn, biên bản bàn giao, phiếu thu), `branch`, `printedBy`, `copy: 'original'|'copy'`.
- **Nguồn:** `g2-quote-delivery/g2-prt-01.html` (`g2q-paper`, `g2q-sheet`, `g2q-d`, `g2q-dl`), `g4f-print*`, `g4f-receipt`, `g4f-invoice`, `g4f-a5`, `g3-paper`, `g2w-print-preview`, `g4r-print`.
- **Trùng lặp:** các họ `*-paper`, `*-sheet`, `*-print*`, `*-receipt`, `*-invoice`: là mẫu của PrintSheet, không phải component UI.

### 2.22 AuthLayout và PublicLayout · Dựng ở slice 1.1

- **AuthLayout:** thẻ trung tâm rộng 440px (`--wide` 600px) trên nền trang, logo, chân trang hỗ trợ; một `h1` mỗi trang; phản hồi dạng `alert` ngay trên biểu mẫu; mọi lỗi nêu cách sửa; thông báo trung tính (không lộ tài khoản có tồn tại); `noscript` có chữ hướng dẫn. Mẫu G5: `g5-scope-auth/g5-aut-01…05.html`.
- **PublicLayout:** trang khách qua liên kết (duyệt báo giá, theo dõi tiến độ, đặt lịch): mobile-first, chữ ≥ 16px, không có shell, liên kết hết hạn → ERR-05.
- **Nguồn:** `g1-auth-dashboard/pack.css` (`g1-auth-*`), `g2w-public*`.
- **Trùng lặp:** `g1-auth-body/brand/card/foot/links/wrap/lead`, `g2w-public-bar`/`g2w-public`.

### 2.23 Component khác (một dòng mỗi cái)

| Component | Ghi chú | Nguồn |
| --- | --- | --- |
| Toast, Alert, Tooltip | Toast `role="status"`; lỗi nghiêm trọng dùng Alert thường trực, không dùng toast; Tooltip chỉ bổ sung | `components.css` §9 |
| Tabs | `tablist/tab/tabpanel`, mũi tên, Home/End (đã có) | `app.js:214–228` |
| Timeline, Progress | Lịch sử trạng thái, tiến độ; `g2w-tl`, `g2q-track`, `g2q-timelog` | `components.css` |
| Kanban | Kéo thả kiểm điều kiện có phương án bàn phím (menu "Chuyển sang…"); `g2w-board`, `g2w-move`, `g2w-drag-hint`, `g2w-drop-denied` | `components.css`, `g2-rec-03.html` |
| Calendar/Agenda | `g2w-cal*`, `g2w-appt`, `g2w-slots`, `g2w-capacity`, `g2w-walkin`, `g2w-agenda`; lưới ngày cần bản danh sách thay thế cho trình đọc màn hình | `g2-apt-01.html` |
| BarcodeScan | Quét camera + nhập tay; `g3-scan*`; thử lại khi từ chối quyền camera | `g3-inv-09/16.html` |
| Checklist, Rating | Kiểm tra xe số (xanh/vàng/đỏ + chữ); `g2w-ins-*`, `g2w-fuel`, `g2w-media*` | `components.css:528–539` |
| TechBigButton | Nút xl 52px cho thợ, bắt đầu/kết thúc ≤ 2 chạm, Hoàn tác 10 giây; `g2q-bigbtn`, `g2q-tec`, `g2q-job`, `g2q-timer`, `g2q-undo` | `g2-quote-delivery/g2-tec-01…04.html` |
| DiffView | So sánh phiên bản/giá trị trước-sau; `g1-diff`, `g2w-diff`, `g2q-diff`, `g4f-diff`, `g4r-diff`, `g4r-diffbox`, `g4r-before`, `g4r-after` | nhiều màn |
| KeyValue (`dl`) | Danh sách khóa-giá trị: `g1-kv`, `g2w-kv`, `g2q-kv`, `g3-kv`, `g4f-kv`, `g4r-kv` | nhiều màn |
| SubNav | Thanh điều hướng con của module: `g3-subnav`, `g4f-subnav`, `g4f-sublinks`, `g4r-subnav`, `g4r-settings` | `g3-*`, `g4-*` |
| ThreeWayMatch | Đối chiếu ba bên đơn mua–phiếu nhập–hóa đơn NCC: `g3-3way` | `g3-pur-07.html` |
| TotalsBlock | Tổng tiền, thuế, tổng cộng: `g2q-totals`, `g2w-total`, `g3-total`, `g4r-total`, `g4f-sum` | nhiều màn |

---

## 3. Bảng ánh xạ class tiền tố gói → component chuẩn

Cách dùng: tìm họ class (phần trước `__`/`--`), đọc cột "Chuẩn". Cột "Hành động": **Dùng chuẩn** = viết tại component chuẩn, bỏ class tiền tố; **Giữ cục bộ** = bố cục riêng của một màn (không chia sẻ), viết bằng CSS module cùng token; **Bỏ** = chỉ để minh họa/prototype. Class `g1-m0`, `g1-mt3`, `g1-mt5`, `g1-full`, `g1-grow`, `g1-nowrap-row`, `g2w-nowrap`, `g2w-right`, `g2w-muted`, `g4f-nowrap`, `g4f-muted`, `g4f-ok/bad/warn` là *tiện ích khoảng cách/căn chỉnh/màu chữ*: dùng `.stack`, `.row`, `.text-secondary`, `.num` của `base.css` và token màu, không dựng lại.

### 3.1 Gói G1 (`g1-auth-dashboard/pack.css`, `g1-*.js`)

| Họ class g1- | Chuẩn | Hành động |
| --- | --- | --- |
| `auth-body`, `auth-brand`, `auth-card`, `lead`, `auth-foot`, `auth-links`, `wrap`, `noscript` | AuthLayout (§2.22) | Dùng chuẩn |
| `fs`, `fieldset`, `form`, `step-title` | Field/FormSection (§2.15) | Dùng chuẩn |
| `pw`, `rules`, `strength` | PasswordField (§2.15); `strength` bỏ vì chưa có quy tắc độ mạnh | Dùng chuẩn / Bỏ `strength` |
| `center`, `countdown` | AuthLayout + CountdownText (`Retry-After`) | Dùng chuẩn |
| `qr`, `key`, `codes` | Thiết lập TOTP (khe StrongAuth, chủ dự án cung cấp phần máy chủ) | Giữ cục bộ, chờ A2 |
| `pin-dots`, `pinpad`, `device`, `workers`, `worker` | OtpInput/PIN + RadioCards (§2.15, §2.18) cho AUT-10 | Dùng chuẩn |
| `branch-list`, `branch`, `radio-dot` | ScopePicker option (`g5-opt`) (§2.2) | Dùng chuẩn |
| `err`, `state-flush`, `state-wide`, `stale`, `chip-state`, `icon-badge` | States (§2.14) | Dùng chuẩn |
| `proto`, `shl-demo`, `open`, `how` (khi dùng trong thanh xem thử) | StateSwitcher (§2.3) | Bỏ |
| `filter`, `bar` (thanh lọc dashboard) | FilterBar + ScopeBar (§2.13, §2.2) | Dùng chuẩn |
| `kpis`, `hl-card`, `sum` | KpiCard / SummaryTile (§2.7) | Dùng chuẩn |
| `cols`, `stack`, `row`, `inline-icon`, `note`, `m0`, `mt3`, `mt5`, `full`, `grow`, `nowrap-row` | Tiện ích bố cục | Dùng tiện ích chuẩn |
| `job` | Thẻ việc của thợ (TechJobCard) / hàng danh sách việc | Giữ cục bộ (DSH-07) |
| `chart`, `sw`, `tip`, `ax`, `val`, `grid`, `base`, `hl`, `cursor`, `target`, `line`, `dot`, `seg`, `f1…f5`, `k1…k5`, `b1…b5` | Chart (§2.19) | Dùng chuẩn |
| `notif` | NotificationList (trung tâm thông báo) | Dựng ở NTF |
| `matrix` | MatrixTable (ma trận quyền/cấu hình) | Dùng chuẩn |
| `profile`, `kv` | KeyValue/ProfileCard (§2.23) | Dùng chuẩn |
| `prov` | Chọn nhà cung cấp tích hợp (SYS) | Giữ cục bộ |
| `reasons`, `lockwhy`, `diff`, `slip` | ReasonDisabled (§2.20), DiffView, ghi chú phiếu giấy dự phòng (ERR-04) | Dùng chuẩn |
| `idx`, `role-links` | Trang mục lục prototype | Bỏ |

### 3.2 Gói G2 workshop (`g2-workshop/pack.css`, `pack.js`)

| Họ class g2w- | Chuẩn | Hành động |
| --- | --- | --- |
| `proto`, `states`, thuộc tính `data-g2w-*` (variants, vshow, vro, vload, verr, var, vgroup, vlabel, tpl, deny, allow, denied, scope, keep) | StateSwitcher (§2.3) | Bỏ |
| `split`, `stack`, `two`, `three`, `trio`, `sec-title`, `muted`, `nowrap`, `right`, `inline-actions`, `cell-stack` | DetailLayout/tiện ích | Dùng chuẩn |
| `kv` | KeyValue | Dùng chuẩn |
| `ro-head`, `objects`, `obj`, `due`, `actions`, `danger-zone`, `flow`, `flow-arrow`, `link`, `check`, `total` | Đầu chi tiết lệnh: hàng StatusBadge x3 (§2.9), nút hành động, ConfirmDialog (§2.6), liên kết đối tượng | Giữ cục bộ (REC-04 là màn chuẩn) |
| `item`, `why`, `part`, `hours` | Dòng hạng mục lệnh + PartsItem (§2.11) + ReasonDisabled (§2.20) | Dùng chuẩn |
| `tl`, `hist` | Timeline | Dùng chuẩn |
| `banners` | ScopeBar/banner xếp chồng (§2.1, §2.2) | Dùng chuẩn |
| `money` | Money (§2.8) | Dùng chuẩn |
| `table-filters`, `seg-row`, `chips` | FilterBar (§2.13) | Dùng chuẩn |
| `pii`, `consent` | PiiField (§2.16) + ghi nhận đồng ý | Dùng chuẩn |
| `board`, `card-meta`, `drop-denied`, `drag-hint`, `move` | Kanban (§2.23) | Dùng chuẩn |
| `cal`, `cal-wrap`, `appt`, `capacity`, `walkin`, `agenda`, `slots` | Calendar/Agenda (§2.23) | Giữ cục bộ (APT) |
| `wizard-panel`, `wizard-foot`, `vehicle-found`, `asset-grid`, `fuel`, `review` | Wizard (§2.17) tiếp nhận | Dùng chuẩn + Giữ cục bộ phần vehicle |
| `print-preview` | PrintSheet (§2.21) | Dùng chuẩn |
| `ins-item`, `rating-xl`, `media-row`, `media`, `ins-sum`, `ins-sticky` | Checklist/Rating/Upload (§2.23, §2.15) | Dùng chuẩn |
| `profile`, `owner`, `diff` | ProfileCard, lịch sử sở hữu xe, DiffView | Giữ cục bộ / Dùng chuẩn |
| `index-table` | Mục lục prototype | Bỏ |
| `public-bar`, `public`, `pub-input` | PublicLayout (§2.22) | Dùng chuẩn |
| `ghost` | Trạng thái giữ chỗ lịch (placeholder) | Giữ cục bộ |

### 3.3 Gói G2 quote-delivery (`g2-quote-delivery/pack.css`)

| Họ class g2q- | Chuẩn | Hành động |
| --- | --- | --- |
| `proto` | StateSwitcher | Bỏ |
| `split`, `head`, `links`, `group`, `note` | DetailLayout, đầu chi tiết, liên kết đối tượng | Dùng chuẩn |
| `badges` | Hàng StatusBadge (§2.9) | Dùng chuẩn |
| `kv` | KeyValue | Dùng chuẩn |
| `lines`, `mark`, `totals`, `ver`, `diff`, `sticky`, `dlg` | Bảng dòng báo giá (Money, PartsItem), TotalsBlock, so sánh phiên bản, chân dính, Dialog | Dùng chuẩn |
| `stock` | Stock4 (§2.11) | Dùng chuẩn |
| `choice`, `choices`, `sign`, `cond`, `steps`, `cards` | ApprovalPanel (§2.10), RadioCards (§2.18), chữ ký | Dùng chuẩn |
| `tec`, `bigbtn`, `workerbar`, `sumtiles`, `tile`, `job`, `timer`, `panel`, `reasons`, `undo`, `has`, `big`, `timelog`, `lockbar` | TechBigButton + thẻ việc thợ (tablet), Hoàn tác 10 giây, ReasonDisabled | Dùng chuẩn (TECH) |
| `qc` | Checklist QC | Giữ cục bộ (DLV) |
| `cust`, `phone`, `photos`, `photo`, `health`, `track` | PublicLayout (trang khách) + Timeline tiến độ | Dùng chuẩn |
| `paper`, `sheet`, `d`, `dl`, `hl`, `noprint` | PrintSheet (§2.21) | Dùng chuẩn |

### 3.4 Gói G3 (`g3-inventory-hr/pack.css`)

| Họ class g3- | Chuẩn | Hành động |
| --- | --- | --- |
| `meta`, `subnav`, `section`, `actions`, `chip`, `ellip` | SubNav/PageHeader/Chip | Dùng chuẩn |
| `statebar`, `noscript` | StateSwitcher, thông báo cần JS | Bỏ |
| `split`, `side`, `row`, `card`, `check` | DetailLayout, Card, Checkbox | Dùng chuẩn |
| `kv` | KeyValue | Dùng chuẩn |
| `masked`, `sample` | PiiField / ghi chú mẫu | Dùng chuẩn / Bỏ `sample` |
| `why`, `readonly` | ReasonDisabled, ReadOnlyNote | Dùng chuẩn |
| `var`, `hit`, `num` | PartsItem/Stock4 kèm tồn khả dụng (§2.11) | Dùng chuẩn |
| `scan` | BarcodeScan (§2.23) | Dùng chuẩn |
| `matrix`, `cell` | MatrixTable (kiểm kê, bảng công) | Dùng chuẩn |
| `formula` | Hiển thị công thức (giải thích cách tính) | Giữ cục bộ |
| `3way` | ThreeWayMatch (§2.23) | Giữ cục bộ (PUR-07) |
| `line`, `bar`, `total` | Dòng chứng từ, thanh tiến độ, TotalsBlock | Dùng chuẩn |
| `tablet` | Biến thể tablet của màn kiểm kê | Giữ cục bộ |
| `paper` | PrintSheet | Dùng chuẩn |

### 3.5 Gói G4 finance (`g4-finance/pack.css`)

| Họ class g4f- | Chuẩn | Hành động |
| --- | --- | --- |
| `demo`, `hint`, `idx`, `sample` | StateSwitcher/mục lục/mẫu | Bỏ |
| `subnav`, `sublinks` | SubNav | Dùng chuẩn |
| `two`, `aside`, `section`, `steps`, `pane` | DetailLayout, Stepper (§2.17), Tabs/Pane | Dùng chuẩn |
| `kv`, `sum`, `big` | KeyValue, KpiCard/SummaryTile (§2.7) | Dùng chuẩn |
| `matrix` | MatrixTable | Dùng chuẩn |
| `denom` | Kiểm đếm mệnh giá (chốt ca) | Giữ cục bộ (ACC-08) |
| `invoice`, `receipt`, `a5`, `print`, `printing`, `pa` | PrintSheet (§2.21) | Dùng chuẩn |
| `limit` | Chỉ báo hạn mức (ApprovalPanel kiểu 2, MoneyInput `limit`) | Dùng chuẩn |
| `ok`, `bad`, `warn`, `muted`, `nowrap` | Tiện ích màu chữ/không ngắt dòng | Dùng tiện ích |
| `money` | Money | Dùng chuẩn |
| `flow` | Luồng bước tiền (Timeline) | Dùng chuẩn |
| `pay` | Phân bổ thanh toán nhiều-nhiều | Giữ cục bộ (ACC-03) |
| `reversed`, `entry` | Bút toán đảo (hiển thị gạch + liên kết gốc), dòng bút toán | Giữ cục bộ nhưng theo RULE-010 |
| `lock`, `why`, `rolenote`, `readonly` | ReasonDisabled, ReadOnlyNote | Dùng chuẩn |
| `checks` | Danh sách kiểm trước chốt (Checklist) | Dùng chuẩn |
| `aging`, `seg`, `legend`, `hbars` | Chart (§2.19) | Dùng chuẩn |
| `diff` | DiffView | Dùng chuẩn |

### 3.6 Gói G4 reports-system (`g4-reports-system/pack.css`, `pack.js`)

| Họ class g4r- | Chuẩn | Hành động |
| --- | --- | --- |
| `statebar`, `noscript` | StateSwitcher | Bỏ |
| `code`, `mono`, `secret` | Mã/giá trị đơn cách (`.code`), che bí mật (khóa API, hiện một lần) | Dùng chuẩn |
| `own`, `only`, `notq7`, `notkt`, `notqv`, `v`, `kt`, `tk`, `notcv`, `cv`, `hide`, `nottn`, `tn` | Cờ mô phỏng vai trò của prototype (ẩn/hiện theo vai trò) | Bỏ. Server quyết định, UI nhận `can`/`reason` (§2.20) |
| `settings`, `subnav` | SubNav, layout Cài đặt | Dùng chuẩn |
| `chart`, `svg`, `grid`, `axis`, `line`, `dot`, `bar`, `target`, `s1…s5`, `f1…f5`, `b1…b5`, `hbar`, `stack`, `legend`, `tip`, `chartcard`, `meter` | Chart (§2.19) | Dùng chuẩn |
| `cards`, `repcard`, `ranked`, `rank`, `total`, `formula`, `fav` | Thẻ báo cáo, xếp hạng, yêu thích, TotalsBlock, hiển thị công thức | Dùng chuẩn / Giữ cục bộ `repcard` |
| `why`, `miss`, `ok` | ReasonDisabled, chỉ báo thiếu/đủ | Dùng chuẩn |
| `split` | DetailLayout | Dùng chuẩn |
| `matrix`, `cell` | MatrixTable | Dùng chuẩn |
| `ver`, `diff`, `diffbox`, `before`, `after` | Phiên bản cấu hình có hiệu lực (ConfigVersion) + DiffView | Dùng chuẩn |
| `kv`, `money` | KeyValue, Money | Dùng chuẩn |
| `tree` | TreeView (cơ cấu tổ chức) | Giữ cục bộ (SYS-05) |
| `wiz`, `drop`, `rowerr` | Wizard nhập Excel (§2.17), vùng thả tệp, lỗi theo dòng | Giữ cục bộ (SYS-20) |
| `print`, `sec` | PrintSheet, tiêu đề mục | Dùng chuẩn |

### 3.7 Gói G5 (mới, `g5-scope-auth/pack.css`)

| Họ class g5- | Chuẩn | Ghi chú |
| --- | --- | --- |
| `scope`, `backdrop`, `panel` (`__head`, `__body`, `__foot`, `__sum`, `__grab`, `__title`), `mode`, `why`, `list`, `opt` (`__dot`, `__main`, `__name`, `__sub`), `empty`, `live` | ScopePicker (§2.2) | Dùng chuẩn; dev đổi sang Dialog/Popover thật |
| `page`, `frame`, `topbar`, `content`, `kpis`, `actions`, `reason`, `draft`, `spec*`, `keys`, `nowrap`, `proto*`, `idx` | Khung trình bày prototype | Bỏ |
| `slot*`, `contract`, `field-ok` | Khe StrongAuth (§2.15, ghi chú dev) | Bỏ khi có phần máy chủ |

---

## 4. Danh sách "KHÔNG dựng lại" (tổng hợp)

1. Bộ dựng khung ứng dụng của từng gói (4 bộ JS + 64 bản markup chép tay): dùng `AppShell`.
2. Dropdown chọn chi nhánh 3 cấp trong `g1-shell.js`/`g2-workshop/pack.js` và `app.js` §8: dùng `ScopePicker`.
3. Ba bản hộp thoại nháp chưa lưu: dùng `UnsavedDialog`.
4. Mọi `*-proto`, `*-statebar`, `*-demo`, `data-g*-views`, thuộc tính `data-g2w-v*`: chỉ prototype.
5. Hai bộ vẽ biểu đồ SVG (`g1-chart*` và `g4r-chart*`): một `Chart`.
6. Thẻ KPI/tổng hợp lặp ở 6 gói: một `KpiCard` + `SummaryTile`.
7. Các lớp "lý do khóa" lặp: một `ReasonDisabled`.
8. Cờ mô phỏng vai trò `g4r-only/notq7/kt/tk/cv/tn…`, `data-show-roles`, `data-g2w-allow/deny`: quyền do server quyết định.
9. Sáu bản bảng khóa-giá trị (`*-kv`): một `KeyValue`.
10. Trang HTML xác thực G1-AUT-04/05/06: đã thay bằng G5-AUT-01/02/03 (xem `STATUS.md`). G1-AUT-01/02/03/07/08/09/10 vẫn là tham chiếu hợp lệ.

## 5. Ma trận component × màn hình × FR (rút gọn cho slice 1.1 và 1.2)

| Component | Màn hình dùng | FR / quy tắc |
| --- | --- | --- |
| AuthLayout, Field, PasswordField | G5-AUT-01…04, G1-AUT-07 | FR-SYS-001 |
| OtpInput + khe StrongAuth | G5-AUT-05, G1-AUT-02/03/10 | FR-SYS-001, ADR 0001 §2.1 A2 |
| States (Error, NoPermission, Offline), ErrorPage | G1-ERR-01…05, mọi khối | `state-copy.md` |
| AppShell, ScopeBar, ScopePicker | G1-SHL-01, G5-SCP-01/02, G1-AUT-08 | FR-SYS-002, 011, 012; RULE-015 |
| UnsavedDialog, Dialog, ConfirmDialog | Mọi form; đổi phạm vi; đăng xuất | RULE-010, D-06 |
| DataTable, FilterBar | `sys/warehouses` (slice 1.1), mọi danh sách | NFR-PERF-01, Q12 |
| StatusBadge | Mọi danh sách có trạng thái | CLAUDE.md "năm đối tượng" |
| ReasonDisabled | Mọi nút có điều kiện | FR-SYS-013, DS-09 |

## 6. Việc đã đổi so với kết quả review trước (để BA/dev biết)

- Đính chính: prototype *đã có* focus trap/inert cho dialog (xem §0); phần thiếu là roving tabindex, typeahead và nhóm radio đúng ngữ nghĩa.
- Không còn khuyến nghị "gộp mọi chi nhánh được giao" làm mặc định cho người nhiều chi nhánh (giá trị tạm của slice 1.1). Đề xuất mới ở §2.2, chờ chốt Q3.
- Thanh "độ mạnh mật khẩu" của G1-AUT-05/06 không đưa vào chuẩn vì tài liệu chưa có quy tắc độ mạnh (`[Cần xác nhận]`).
