# Phát hiện của luồng A (kiểm thử), 04/11/2026

Luồng A không sửa `src/`. Mỗi mục dưới đây có file, mô tả, cách tái hiện (test đang đỏ hoặc test dùng để kiểm lại). Mức độ do luồng A ước lượng.

| # | Mức | Nơi | Tóm tắt | Test chứng minh |
| --- | --- | --- | --- | --- |
| F-6 | Cao | `src/modules/crm/application/importer.ts` hàm `undo` | Hoàn tác lô nhập khách và xe có từ 2 khách trở lên trả 500 trên Firestore (bộ nhớ vẫn qua) | `tests/integration/import-undo-multirow.test.ts` (đỏ trên Firestore); `e2e/sys-import-ui.spec.ts` bước hoàn tác |
| F-8 | Trung bình | `src/ui/components/ConfirmDialog.tsx` | Hộp thoại xác nhận không chuyển tiêu điểm vào trong khi mở bằng bàn phím, không giữ tiêu điểm trong hộp, không trả tiêu điểm về nút mở | `e2e/a11y-phase1.spec.ts` "confirmation dialog by keyboard" (đỏ) |
| F-3 | Trung bình | `src/app/(shell)/approvals/ApprovalActions.tsx` | Màn hình Phê duyệt không có ô nhập lại mật khẩu, nên chủ không duyệt được "mở lại ngày" (R106) bằng giao diện | `e2e/acc-day-reopen-ui.spec.ts` (đi vòng bằng API ở bước chủ duyệt) |
| F-5 | Thấp | `src/app/(shell)/sys/imports/page.tsx:30-31` | Dùng khóa `common.noPermissionTitle/Text`, khóa thật là `states.noPermissionTitle/Text` | `e2e/sys-import-ui.spec.ts` (nhật ký máy chủ `MISSING_MESSAGE` khi nhân viên tư vấn mở `/sys/imports`) |
| F-7 | Thấp | `src/app/(shell)/acc/cashbook` (màn Sổ quỹ) | Tràn ngang 2 px ở 375 px | `e2e/a11y-phase1.spec.ts` ("cash book: horizontal overflow 2px", đỏ) |
| F-1 | Thấp, cần BA | `src/platform/rbac/rbac.ts` (`resolveScope` dùng cho đọc theo id) | Người có quyền toàn công ty (CH, KT) đã chọn chi nhánh làm việc vẫn đọc được bản ghi chi nhánh khác theo id (danh sách thì đã bị thu hẹp theo chi nhánh). Người chỉ có một chi nhánh thì đúng (404) | `tests/integration/isolation-matrix.test.ts` (không khẳng định phần này cho chủ; ghi chú trong tệp) |
| F-2 | Thấp | `GET /api/v1/crm/vehicles/[id]/history` | Xe ngoài phạm vi trả 200 với danh sách rỗng, còn id không tồn tại trả 404: lộ việc id có thật. Id ngẫu nhiên nên rủi ro thấp | `tests/integration/isolation-matrix.test.ts` (`emptyForUnknown`) |
| F-4 | Thấp, theo dõi | nhập Excel, chạy thử | Thời gian chạy thử của lô nhập tăng theo lượng dữ liệu có sẵn (Emulator: 2.000 dòng 9 s, rồi 24 s, 1.000 dòng 28 s khi đã có 4.000 khách). Ghi nhận cho quyết định R94 | `tests/integration/perf-nfr.test.ts` (in số đo bằng `PERF_REPORT=<tệp>`) |

## Chi tiết và cách tái hiện

### F-6 Hoàn tác lô nhập nhiều dòng hỏng trên Firestore

`undo` trong `importer.ts` gom tối đa 20 xe (rồi 20 khách) vào một giao dịch, và trong vòng lặp đọc (`getInTx`, `listByVehicleInTx`) xen với ghi (`remove`, `audit.record`) của vòng trước. Firestore bắt buộc mọi lần đọc trong giao dịch phải xong trước lần ghi đầu tiên (README); bộ nhớ không bắt lỗi này. Lô một khách qua, từ hai khách trở lên trả 500 `internal`. Cách tái hiện: `pnpm exec firebase emulators:exec --only firestore,auth,storage --project demo-gmep "vitest run --project integration tests/integration/import-undo-multirow.test.ts"`. Hướng sửa: đọc cả đoạn (xe, chủ sở hữu) trước, rồi mới ghi. Hệ quả: tính năng "hoàn tác theo lô" của UAT-12 không dùng được với lô thật.

### F-8 ConfirmDialog (WCAG 2.4.3, 2.1.2, mẫu hộp thoại của ARIA)

Chú thích trong mã nói "focus lands on the safe button", nhưng nút hủy dùng `autoFocus={open}` trên phần tử luôn được gắn sẵn (chỉ ẩn bằng `hidden`), nên `autoFocus` không bao giờ chạy lại khi mở. Mở bằng phím Enter, tiêu điểm vẫn ở nút mở phía sau lớp phủ; không có bẫy tiêu điểm; Esc đóng được nhưng tiêu điểm không trả về nút mở. Tái hiện: `e2e/a11y-phase1.spec.ts` ca thứ hai.

### F-3 Duyệt mở lại ngày cần mật khẩu nhưng màn hình không có ô mật khẩu

`approvals.ts` (`decideApproval`) yêu cầu `reauthPassword` khi duyệt các loại trong `REAUTH_ON_APPROVE` (mở lại ngày). `ApprovalActions.tsx` chỉ gửi `{version, decision}`. Chủ bấm "Duyệt" trên `/approvals` sẽ nhận lỗi. `config/[type]/DecideButtons.tsx` đã có mẫu ô mật khẩu có thể dùng lại. Lượt này spec e2e phải đi vòng bằng API.

### F-1 Phạm vi đọc theo id không thu hẹp theo chi nhánh làm việc

`resolveWorkingScope` thu hẹp danh sách theo chi nhánh làm việc, nhưng nhiều đường đọc theo id dùng `resolveScope` (chỉ theo quyền). Với CH hoặc KT (quyền `*`), chọn chi nhánh Q7 rồi gọi `GET /api/v1/sys/warehouses/wh_br_td_WH-CHINH` trả 200. Có thể là chủ ý (liên kết chéo, khoan sâu) nhưng không khớp câu "đã chọn chi nhánh thì chỉ chi nhánh đó" trong chú thích `resolveWorkingScope`. Cần BA/dev quyết định; test ma trận hiện chỉ khẳng định đúng cho người dùng một chi nhánh.

### F-2 Lịch sử xe ngoài phạm vi

`GET /api/v1/crm/vehicles/<id xe chi nhánh khác>/history` cho người dùng không có `vehicle-history-cross:view` trả `{items:[],nextCursor:null}` 200, còn id không có thật trả 404.

### F-4 Số đo cho R94 (nền)

Emulator Firestore, 2.000 dòng khách và xe: ghi 42 đến 43 giây mỗi lô, chạy thử 9 đến 28 giây tùy lượng dữ liệu đã có. Dưới ngưỡng 60 s của kế hoạch nhưng sát; ngưỡng x2 trong test là 120 s. Bộ nhớ: dưới 1,5 s. Số này chỉ có ý nghĩa tương đối (Emulator, không phải GCP).

## Thông tin chạy test (không phải lỗi)

- Hai luồng dùng chung cổng Emulator mặc định (8080, 9099, 9199) và cổng Playwright 3100: khi luồng B đang chạy Emulator thì `emulators:exec` của luồng A báo "port taken". Luồng A chạy bằng cấu hình cổng khác (`--config` tạm ngoài kho). Hai lượt `playwright test` không thể song song vì cổng 3100 và `ORIGIN` cố định trong `e2e/acc-helpers.ts`.
- `PLAYWRIGHT_CHROMIUM_PATH` cần đặt tới `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` trong sandbox này (bản mặc định của Playwright tìm `chromium_headless_shell-1248`).
