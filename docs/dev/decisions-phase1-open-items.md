# Quyết định cho các mục mở của Phase 1 (05/11/2026)

Chủ dự án giao quyền chốt cho dev/điều phối; các quyết định dưới đây lấy đúng đề xuất mặc định trong `ba-spec-phase1-open-items.md`. Vẫn là đề xuất chờ khách xác nhận, nhưng dev được phép cài theo chúng. Đổi quyết định thì sửa file này và spec.

| Mã | Quyết định |
| --- | --- |
| F1-1 | Khách/xe liên kết nhiều chi nhánh: mọi chi nhánh có liên kết được sửa (như hiện tại); xem lại theo trường trước khi mở chi nhánh thứ hai. |
| F1-2 | CH ở chế độ hợp nhất không ghi chéo (`scope_merged`). |
| F1-3 | Thông điệp 409 không nêu tên chi nhánh đích ở pilot. |
| F1-4 | Danh sách ngoại lệ cấp công ty và gán vai trò theo chi nhánh giữ như đang cài. |
| P-1 | Khóa kỳ tháng (FR-ACC-005) vào Phase 3 cùng FR-ACC-012. Pilot giữ chốt ngày và mở lại ngày. Không dựng ở Phase 1. |
| P-3 | KT khóa; CH khóa được mọi chi nhánh; mở lại do CH duyệt kèm mật khẩu, lý do, hạn dùng, báo ngoại lệ. |
| P-6 | Sau cuối tháng chỉ nhắc, không tự khóa. |
| M-1 | Gợi ý trùng khách: MST (doanh nghiệp), SĐT kèm tên (cá nhân); không dùng biển số/số khung. Sửa FR-CRM-003 và §25 Q-C. |
| M-2 | Gộp: chọn tay bản giữ lại, mặc định bản tạo sớm hơn; bản bị gộp thành `merged`, không xóa. |
| M-4 | QL đề xuất, CH duyệt trong chi nhánh; xuyên chi nhánh do vai trò cấp công ty đề xuất, CH duyệt. |
| M-5 | Hoàn tác gộp trong 30 ngày, sau đó xóa dữ liệu cá nhân bản bị gộp. |
| M-6 | Gộp khách (FR-CRM-003) vào Phase 2; pilot chỉ cảnh báo trùng SĐT (đã có). |
| K-1 | Không dựng slice 1.10 (INS) trong Phase 1. UAT-15 chuyển "hoãn chờ kích hoạt". Nếu xưởng cần, làm checklist tối thiểu trong REC (FR-REC-037 đề xuất) sau khi đo công. |
| K-2 | INS (khi làm) chỉ ảnh, không video. |
| K-4 | Xem lại INS sau 4 đến 6 tuần pilot. |

## Vẫn mở (cần bên ngoài, không tự chốt)

Kế toán khách: P-2, P-4, P-5, M-7. Luật sư: M-3. Khách: K-3.

## Việc dev cài theo quyết định này

1. Test ghi chéo cho khách/xe liên kết nhiều chi nhánh; test thân lỗi 409 không lộ chi nhánh đích.
2. Một điểm kiểm tra ngày chốt dùng chung cho mọi chứng từ tiền và kho (kiểm lại hiện trạng).
3. Kế hoạch thêm `businessDate` cho EIN (chưa đổi dữ liệu, chờ P-4).
4. Sửa dòng F-1 lỗi thời trong `open-questions-for-ba.md`.
