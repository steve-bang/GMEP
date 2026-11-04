# Bảng ánh xạ UAT sang test tự động (việc 1f)

Cập nhật 04/11/2026, luồng A. Nguồn danh sách UAT: `docs/functional-requirements.md` mục kiểm thử chấp nhận (UAT-01 đến UAT-26). Mỗi dòng cho biết test nào chứng minh tiêu chí. "Tích hợp" = `tests/integration` (chạy trên bộ nhớ và Firestore Emulator), "E2E" = `e2e` (Playwright trên Emulator). Test mới của lượt này in đậm.

Quy ước: ĐỦ = tiêu chí của UAT có test; MỘT PHẦN = có test nhưng thiếu một vế (ghi rõ); CHƯA XÂY = chức năng chưa có trong giai đoạn 1; NGOÀI = cần thiết bị hoặc hạ tầng thật.

| UAT | Nội dung | Trạng thái | Test |
| --- | --- | --- | --- |
| 01 | Một xe từ nhận đến giao có hóa đơn; số liệu khớp trên báo cáo đối chiếu | ĐỦ | **`uat-journeys.test.ts` UAT-01** (đơn = tiền thu = hóa đơn, đối chiếu và báo cáo ngày khớp, đơn nằm trong drill-down); các đoạn: `slice-1-5/6/7/8/9.spec.ts`, `rpt.test.ts` "reconciliation" |
| 02 | Chặn xuất kho không chứng từ | ĐỦ | `inv.test.ts` (UAT-02), `inv-domain.test.ts` (UAT-02) |
| 03 | Hạng mục phát sinh: thợ không bắt đầu khi chưa duyệt; có bằng chứng duyệt | ĐỦ | **`uat-journeys.test.ts` UAT-03** (chưa duyệt thì lệnh chưa có hạng mục để giao/bắt đầu; duyệt qua liên kết thì thêm hạng mục, có bằng chứng); `rec-orders.test.ts:636`, `acc.test.ts:1180` (R47) |
| 04 | Chuyển kho có chênh lệch | CHƯA XÂY | INV phase 2 |
| 05 | Kiểm kê và điều chỉnh | CHƯA XÂY | INV phase 2 (điều chỉnh ADJ có, kiểm kê chưa) |
| 06 | Phân quyền theo chi nhánh | ĐỦ | `isolation.test.ts`; **`isolation-matrix.test.ts`** (ma trận sinh từ danh sách route, 2 chi nhánh, CRM/REC/ACC/EIN/INV/SYS/RPT, xuất); E2E `slice-1-5.spec.ts` ("branch isolation and roles") |
| 07 | Chốt ngày; sửa ngày đã khóa bị chặn | ĐỦ | `acc.test.ts` (UAT-07, "shift close, variance and day close"), `acc-domain.test.ts`; E2E `slice-1-7.spec.ts` (chốt ngày); **E2E `acc-day-reopen-ui.spec.ts`** (mở lại ngày qua giao diện; phần chủ duyệt đi qua API, xem F-3) |
| 08 | Hóa đơn điều chỉnh cần KT trưởng, liên kết hóa đơn gốc | ĐỦ | `ein.test.ts` (UAT-08) |
| 09 | Đổi thuế suất theo ngày hiệu lực | ĐỦ (số mẫu, chưa có chữ ký kế toán) | **`uat-journeys.test.ts` UAT-09** (đề xuất, chủ duyệt, báo giá trước ngày giữ 8 % và mã phiên bản, sau ngày áp 10 % bằng cấu hình, không đổi mã); `rec-ba17.test.ts` (R2), `config-admin.test.ts:30` |
| 10 | Quyền chủ dữ liệu: đồng ý, rút, yêu cầu xóa | ĐỦ | `crm.test.ts` (UAT-10) |
| 11 | Tính công theo quy tắc khách chốt | CHƯA XÂY | HRM phase 2, quy tắc chờ khách |
| 12 | Nhập Excel: lỗi theo dòng, không ghi một phần, hoàn tác theo lô | ĐỦ về API; MỘT PHẦN về giao diện | `import.test.ts`, `unit/sys-import.test.ts`; **E2E `sys-import-ui.spec.ts`** (mẫu CSV và xlsx, lỗi theo dòng, ánh xạ cột, chạy thử, ghi, hoàn tác, quyền, 375 px, axe); **`import-undo-multirow.test.ts`** (hoàn tác lô từ 2 khách trở lên; ĐANG ĐỎ trên Firestore, F-6) |
| 13 | Giữ chỗ và tồn khả dụng (20, giữ 5, thấy 15; hủy nhả) | ĐỦ | `inv.test.ts` (UAT-13), `inv-domain.test.ts`; song song: `inv.test.ts` "concurrency" (thêm 3 ca ở lượt này) |
| 14 | Phân bổ thanh toán nhiều hóa đơn | CHƯA XÂY | ACC phase 3 |
| 15 | Từ kiểm tra xe số đến báo giá | CHƯA XÂY | INS chờ khách xác nhận phạm vi |
| 16 | Đơn mua nhận nhiều lần | CHƯA XÂY | PUR phase 2 |
| 17 | Báo giá duyệt một phần (4.550.000: duyệt 2.050.000) | ĐỦ | `rec-approval.test.ts` (UAT-17), `unit/rec-approval.test.ts` |
| 18 | Đổi chủ xe, lịch sử giữ nguyên | ĐỦ | `crm.test.ts`, `crm-domain.test.ts`, E2E `slice-1-3.spec.ts` |
| 19 | Một người nhiều vai trò: đủ quyền hai vai, không hơn | ĐỦ theo tên test (chưa rà từng ca) | `isolation.test.ts`, `acc.test.ts`, `inv.test.ts`, `crm.test.ts`, `auth.test.ts` (người dùng `u_multi`: QL ở Q7, TK ở Thủ Đức) |
| 20 | Quyền xuất dữ liệu: không quyền thì không tải được danh sách khách | ĐỦ | `crm.test.ts` (UAT-20, xuất cột đầy đủ cần quyền) |
| 21 | Đồng sơn theo công đoạn | MỘT PHẦN | `rec-approval.test.ts:673` (hai loại dịch vụ, hai bộ bước); quy trình đồng sơn chưa khảo sát |
| 22 | Giá niêm yết và hạn mức giảm | MỘT PHẦN | `rec.test.ts:374` (giảm vượt hạn mức bị chặn, quản lý hạn mức cao hơn được), `rec-ba17.test.ts`; vế "đổi bảng giá không đổi báo giá đã gửi" được `uat-journeys.test.ts` UAT-09 chứng minh cho thuế, chưa có ca riêng cho giá |
| 23 | Chống phát hành trùng hóa đơn | ĐỦ | `ein.test.ts` (UAT-23); E2E `slice-1-8.spec.ts` (timeout rồi tra cứu) |
| 24 | Bảo hành chéo chi nhánh | CHƯA XÂY | chính sách chưa chốt |
| 25 | Giá vốn bình quân (10 x 100.000 và 20 x 120.000 là 113.333) | ĐỦ | `inv.test.ts`, `inv-domain.test.ts` (UAT-25) |
| 26 | Hạn mức công nợ doanh nghiệp | CHƯA XÂY | ACC-020, CRM-018 |

Hiệu năng (NFR-PERF-01/02) không phải UAT nhưng kèm theo: **`perf-nfr.test.ts`**. Bảo mật: `security-checklist-status.md`.

## Quyết định về phạm vi của việc 1f

- Kế hoạch đề nghị e2e Playwright cho từng UAT. UAT-01, 03, 09 được viết thành test tích hợp chạy trên cả hai backend vì mỗi hành trình chỉ cần API và nhanh hơn nhiều (dưới 10 giây); e2e hiện có đã bao phủ giao diện của các đoạn tương ứng. Nếu BA/khách muốn thấy UAT-01 trên giao diện liền mạch thì thêm một spec sau khi các lỗi giao diện trong `stream-a-findings.md` được sửa.
- Ngoài lượt (cần thiết bị hoặc hạ tầng thật, theo `plan-next-work.md`): in thử máy thật, kiểm thử thâm nhập, diễn tập khôi phục, k6 trên staging, tải 20 chi nhánh.
