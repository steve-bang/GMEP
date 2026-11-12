# 10. Từ điển thuật ngữ

Bảng thuật ngữ nghiệp vụ gara và hệ thống (tiếng Việt, giải thích, tên tiếng Anh). Người đọc: designer; dùng để viết microcopy đúng và tránh tự đặt tên khác cho cùng khái niệm. Giao diện chỉ dùng tiếng Việt; cột tiếng Anh dùng để đặt tên component và trao đổi.

## 1. Quy trình sửa chữa

| Thuật ngữ | Giải thích | Tiếng Anh |
| --- | --- | --- |
| Tiếp nhận (xe) | Bước nhận xe vào xưởng: ghi biển số, số km, yêu cầu của khách, hiện trạng, ảnh | Check-in / Intake |
| Cố vấn dịch vụ | Nhân viên tiếp khách, báo giá, theo dõi tiến độ, bàn giao xe; đầu mối của khách | Service advisor |
| Báo giá | Đề nghị giá để khách duyệt; có phiên bản và có thể duyệt một phần. Không phải hóa đơn | Quote / Estimate |
| Phiên bản (báo giá) | Bản v1, v2… của một báo giá; bản cũ chỉ đọc | Quote version |
| Chờ khách duyệt | Nhãn hiển thị của báo giá đã gửi | Awaiting customer approval |
| Duyệt một phần | Khách chỉ đồng ý một số hạng mục; lệnh chỉ chứa phần được duyệt | Partial approval |
| Báo giá bổ sung | Báo giá cho hạng mục phát sinh ngoài báo giá ban đầu, cần khách duyệt mới được làm | Supplementary quote |
| Hạng mục phát sinh | Việc phát hiện thêm khi đang sửa, ngoài báo giá | Additional work item |
| Lệnh sửa chữa | Chứng từ gốc của một lần xe vào xưởng: công, phụ tùng, giờ làm, thanh toán, hóa đơn. Bắt đầu từ lúc khách duyệt báo giá. (Một số người gọi "phiếu sửa chữa") | Repair order (RO) |
| Hạng mục (sửa chữa) | Một đầu việc trong lệnh (ví dụ thay má phanh trước), có thợ chính, giờ chuẩn, trạng thái riêng | Repair item / Job line |
| Giờ chuẩn | Số giờ định mức của một hạng mục dịch vụ, dùng tính giá công và công thợ | Standard hours / Flat-rate hours |
| Đơn giá giờ công | Giá một giờ công chuẩn; đổi theo ngày hiệu lực | Labor rate |
| Giờ thực | Số giờ thợ thực sự làm (bấm bắt đầu/kết thúc) | Actual hours |
| Công thợ | Dữ liệu giờ/tiền công gắn thợ, dùng cho bảng công và hoa hồng (không phải lương) | Labor / Technician time |
| Phụ tùng | Vật tư, linh kiện thay thế | Parts / Spare parts |
| Thợ / kỹ thuật viên | Người thực hiện sửa chữa | Technician / Mechanic |
| Quản đốc | Người phân việc cho thợ và kiểm tra chất lượng | Workshop foreman / Supervisor |
| QC / Kiểm tra chất lượng | Kiểm tra cuối theo checklist trước khi giao xe (nhãn ngắn "Chờ QC") | Quality check (QC) |
| Trả lại (hạng mục) | QC không đạt, hạng mục quay lại cho thợ sửa | Rework / Returned |
| Tạm dừng | Trạng thái lệnh/hạng mục đang dừng, luôn kèm lý do | On hold |
| Chờ phụ tùng | Lý do của Tạm dừng khi thiếu phụ tùng (không phải trạng thái riêng) | Waiting for parts |
| Sẵn sàng bàn giao | Lệnh đã qua QC, chờ thanh toán và giao xe | Ready for handover |
| Bàn giao / Giao xe | Giao xe cho khách kèm biên bản | Handover / Delivery |
| Biên bản giao xe | Chứng từ khách xác nhận đã nhận xe | Handover record |
| Kiểm tra xe số | Kiểm tra theo mẫu, đánh dấu xanh/vàng/đỏ kèm ảnh/video; lỗi vàng/đỏ thành danh sách lỗi | Digital vehicle inspection (DVI) |
| Bảo hành | Xe quay lại vì lỗi cũ/trong thời hạn bảo hành; mở lệnh bảo hành gắn lệnh gốc | Warranty |
| Gói bảo dưỡng | Gói dịch vụ bảo dưỡng định kỳ theo km hoặc thời gian | Maintenance package |
| Đồng sơn | Sửa chữa thân vỏ và sơn; có quy trình công đoạn riêng (chưa chốt) | Body and paint |
| Lịch hẹn | Hẹn trước của khách; có trạng thái trễ hẹn, dời, vắng | Appointment |
| Trễ hẹn | Khách hoặc xe quá giờ hẹn | Overdue / Late |
| Số km (odometer) | Số km xe đã chạy khi nhận; thấp hơn lần trước thì cảnh báo | Odometer |
| Biển số | Biển số xe; lưu chuẩn hóa, hiển thị `51H-123.45` | License plate |
| Đăng kiểm | Kiểm định kỹ thuật định kỳ của xe; chu kỳ theo loại xe và năm sản xuất | Vehicle inspection (roadworthiness) |

## 2. Kho và phụ tùng

| Thuật ngữ | Giải thích | Tiếng Anh |
| --- | --- | --- |
| Tồn thực tế | Số lượng đang có trong kho | On-hand |
| Tồn giữ chỗ / Đã giữ | Số lượng đã dành cho lệnh đã duyệt nhưng chưa xuất | Reserved |
| Đang vận chuyển | Hàng đang chuyển giữa kho, chưa thuộc tồn bán được của kho nào | In-transit |
| Tồn khả dụng / Có thể bán | Tồn thực tế trừ giữ chỗ (không cộng hàng đang vận chuyển); dùng để cảnh báo và chặn xuất | Available |
| Định mức tồn | Mức tồn tối thiểu/tối đa theo mặt hàng và chi nhánh | Min/Max stock level |
| Sắp hết / Hết hàng / Đủ hàng | Huy hiệu suy ra từ khả dụng so với định mức | Low / Out of stock / In stock |
| Phiếu nhập kho | Chứng từ nhập hàng (viết tắt PN) | Goods receipt note (GRN) |
| Phiếu xuất kho | Chứng từ xuất hàng theo lệnh/phiếu hợp lệ (PX/GIN) | Goods issue note (GIN) |
| Yêu cầu cấp phụ tùng | Yêu cầu của thợ gửi thủ kho để xuất phụ tùng cho một lệnh | Parts request |
| Phiếu hoàn kho | Hoàn phụ tùng chưa lắp về kho (HK) | Return to stock |
| Chuyển kho | Chuyển hàng giữa kho/chi nhánh, hai bước gửi và nhận (CK) | Stock transfer |
| Biên bản chênh lệch | Ghi nhận khi hàng nhận khác hàng gửi, kèm ảnh | Discrepancy report |
| Kiểm kê | Đếm thực tế để so với tồn hệ thống (KK) | Stocktake / Inventory count |
| Phiếu điều chỉnh | Chứng từ điều chỉnh tồn sau kiểm kê có lý do và duyệt (ADJ) | Stock adjustment |
| Xuất dùng nội bộ | Xuất vật tư không theo lệnh nhưng có lý do hợp lệ và duyệt | Internal use issue |
| Bán lẻ (phụ tùng) | Bán phụ tùng tại quầy bằng phiếu riêng, không cần lệnh (BL) | Over-the-counter sale |
| Giá niêm yết | Giá bán chuẩn theo bảng giá | List price |
| Giá vốn | Giá vốn của phụ tùng (phương pháp tính chưa chốt); chỉ một số vai trò được xem | Cost / Cost price |
| Giá thực tế | Giá bán thực sau giảm giá | Actual price |
| Nhà cung cấp | Bên bán phụ tùng cho garage | Supplier / Vendor |
| Yêu cầu mua | Đề nghị mua hàng, cần duyệt (YM) | Purchase request |
| Đơn mua | Đơn đặt hàng gửi nhà cung cấp, nhận nhiều lần (DM) | Purchase order (PO) |
| Mua gấp | Mua trước, duyệt sau (hậu duyệt) | Urgent purchase |
| Đối chiếu ba bên | So đơn mua, hàng nhận, hóa đơn nhà cung cấp | Three-way match |
| Phiếu trả hàng | Trả hàng lỗi cho nhà cung cấp | Return to vendor |

## 3. Tiền, kế toán, hóa đơn

| Thuật ngữ | Giải thích | Tiếng Anh |
| --- | --- | --- |
| Thanh toán | Giao dịch tiền của khách cho lệnh; nhiều lần, nhiều hình thức | Payment |
| Phiếu thu | Chứng từ ghi nhận đã thu tiền (PT) | Receipt voucher |
| Phiếu chi | Chứng từ chi tiền (PC) | Payment voucher |
| Hoàn tiền | Trả tiền lại cho khách, cần duyệt | Refund |
| Khoản nhận trước / Tiền cọc | Tiền khách đưa trước hoặc phần dư thanh toán | Advance / Deposit |
| Phân bổ thanh toán | Gán một lần thanh toán cho nhiều hóa đơn (nhiều-nhiều) | Payment allocation |
| Công nợ phải thu | Khách còn nợ | Accounts receivable (AR) |
| Công nợ phải trả | Garage còn nợ nhà cung cấp | Accounts payable (AP) |
| Tuổi nợ | Phân loại công nợ theo thời gian quá hạn | Aging |
| Sổ quỹ | Sổ ghi thu chi tiền mặt | Cash book |
| Ca thu ngân / Chốt ca | Ca làm của thu ngân; cuối ca đếm quỹ và so với sổ | Cashier shift / Shift close |
| Chốt ngày | Quản lý chi nhánh khóa ngày sau khi kiểm các mục chặn | Day close |
| Khóa kỳ / Mở lại | Khóa hoặc mở lại kỳ kế toán/kỳ công, mở lại cần chủ duyệt | Period lock / Reopen |
| Bút toán đảo | Chứng từ ngược để sửa giao dịch đã ghi sổ (không xóa) | Reversal entry |
| Điều chỉnh | Chứng từ điều chỉnh giá trị đã ghi | Adjustment |
| Hóa đơn điện tử | Hóa đơn lập qua nhà cung cấp, có trạng thái hợp lệ; XML + PDF | E-invoice |
| Nhà cung cấp hóa đơn điện tử | Bên cung cấp cổng phát hành hóa đơn (chưa chốt) | E-invoice provider |
| Hóa đơn điều chỉnh / thay thế / hủy | Cách sửa hóa đơn sai theo quy định | Adjusting / Replacement / Cancelled invoice |
| Đơn vị phát hành | Pháp nhân hoặc chi nhánh đứng tên bán trên hóa đơn | Invoice issuer |
| Mẫu số, ký hiệu hóa đơn | Thông tin nhận diện loại hóa đơn | Invoice template / series |
| Mã số thuế (MST) | Mã số thuế của doanh nghiệp | Tax code |
| Thuế GTGT | Thuế giá trị gia tăng; thuế suất theo ngày hiệu lực | VAT |
| Chống trùng (idempotent) | Bấm nhiều lần hoặc timeout không tạo bản ghi thứ hai | Idempotency |
| Giá vốn dịch vụ / Lãi gộp | Chi phí và lợi nhuận gộp theo lệnh | Cost of service / Gross profit |
| Kế toán trưởng (KTT) | Cờ quyền của vai trò kế toán, duyệt hóa đơn điều chỉnh/thay thế/hủy | Chief accountant |

## 4. Hệ thống, tổ chức, quyền

| Thuật ngữ | Giải thích | Tiếng Anh |
| --- | --- | --- |
| Chi nhánh | Một cửa hàng của garage; dữ liệu nghiệp vụ gắn đúng một chi nhánh | Branch |
| Kho | Nơi chứa phụ tùng thuộc một chi nhánh | Warehouse |
| Pháp nhân / Công ty | Đơn vị pháp lý; có thể một hoặc nhiều trong một tenant | Legal entity / Company |
| Tenant | Một khách hàng độc lập của nền tảng (một garage/chuỗi); dữ liệu tách hẳn nhau. Trong giao diện gọi là "công ty" | Tenant |
| Nhóm chi nhánh | Tập chi nhánh do quản lý vùng phụ trách (chưa chốt có không) | Branch group / Region |
| Phạm vi (dữ liệu) | Chi nhánh/nhóm/toàn chuỗi mà người dùng đang xem | Scope |
| Hợp nhất | Xem tổng nhiều chi nhánh; chỉ chủ/quản lý vùng | Consolidated view |
| Vai trò | Nhóm quyền theo chức danh (chủ, quản lý, cố vấn…) | Role |
| Tư cách thành viên | Việc một người thuộc một công ty với vai trò riêng | Membership |
| Góc nhìn vai trò | Chuyển trang chủ giữa các vai trò của người kiêm nhiệm | Role view |
| Che dữ liệu | Hiển thị một phần số điện thoại/địa chỉ theo vai trò | Data masking |
| Lời mời | Cách nhân viên kích hoạt tài khoản qua liên kết, hiệu lực 72 giờ, dùng một lần | Invitation |
| PIN | Mã 6 số của thợ trên thiết bị xưởng | PIN |
| Thiết bị xưởng | Tablet đã đăng ký gắn chi nhánh, dùng chung | Shop-floor device |
| Phê duyệt | Quy trình duyệt theo hạn mức và cấp | Approval |
| Hạn mức | Ngưỡng giá trị cần duyệt hoặc tối đa được làm | Limit / Threshold |
| Chuyển cấp | Chuyển yêu cầu lên cấp duyệt cao hơn | Escalation |
| Hậu duyệt | Duyệt sau khi đã làm (mua gấp) | Post-approval |
| Người lập / người đề xuất | Người tạo yêu cầu; không tự duyệt | Requester |
| Cấu hình có ngày hiệu lực | Giá trị đổi theo ngày; chứng từ cũ giữ phiên bản đã áp | Effective-dated configuration |
| Nhật ký thao tác | Bản ghi bất biến ai làm gì, khi nào | Audit log |
| Nhập bù | Bản ghi nhập sau từ phiếu giấy khi mất mạng, kèm giờ thật | Back-entry |
| Số tạm / chính thức | Số liệu chưa/đã chốt ngày | Provisional / Final |
| Yêu cầu của chủ dữ liệu | Khách yêu cầu xem, sửa, xóa dữ liệu cá nhân | Data subject request |
| Đồng ý xử lý dữ liệu | Ghi nhận khách đồng ý, mục đích và kênh | Consent |
| Nhập Excel | Khởi tạo dữ liệu từ tệp Excel của khách | Excel import |
| Dashboard / Tổng quan | Trang tổng hợp số liệu theo vai trò | Dashboard |
