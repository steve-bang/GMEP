# UI/UX Gói 5: Tài chính và hóa đơn (G4-ACC, G4-APR, G4-EIN)

Trạng thái: đang thiết kế (giai đoạn 1 của 4: rà danh mục và kế hoạch). Thư mục prototype: `design/g4-finance/` (tiền tố class `g4f-`).

## Kế hoạch

Phạm vi gồm 31 màn hình theo `screen-inventory.md` §8.1 đến §8.3: G4-ACC-01..20 (20 màn), G4-APR-01..03 (3 màn), G4-EIN-01..08 (8 màn). Thứ tự làm: (1) luồng Phase 1 sống còn: thu tiền ACC-01/02/03, sổ quỹ ACC-04, chốt ca/ngày ACC-08/09, hàng chờ và chi tiết phê duyệt APR-01/02/03, hóa đơn EIN-01..08; (2) công nợ, giá vốn, lãi lỗ, hoàn tiền, đề xuất chi (P2/P3); (3) ngân hàng, khóa kỳ, kết xuất, phân bổ, sơ đồ tài khoản; (4) hoàn thiện tài liệu, index, tự review.

Cách dựng: mỗi màn hình là một file HTML dùng `pack.js` (dựng Application Shell chuẩn, bộ chuyển trạng thái xem thử, khóa nút theo vai trò và theo mất kết nối, khóa chống bấm đúp) và `pack.css` (class `g4f-`), cùng `design/assets/*` dùng chung.
