# 11. Dữ liệu mẫu giả

Bộ dữ liệu **hoàn toàn giả** và nhất quán để đổ vào mockup: 3 chi nhánh, khách, xe, biển số, lệnh sửa chữa ở đủ trạng thái, phụ tùng bốn số tồn, người dùng theo vai trò, số tiền VND. Người đọc: designer dựng mockup. Không có dữ liệu thật của khách hàng; mọi tên, số điện thoại, mã số thuế, biển số, số hóa đơn đều là hư cấu (nếu trùng người/xe thật chỉ là ngẫu nhiên). Số trong các bảng cộng đúng với nhau; các mức thuế, đơn giá giờ công và hạn mức là **minh họa**.

**Ngày "hôm nay" của bộ dữ liệu: Thứ Sáu, 30/10/2026, thời điểm hiển thị 09:15.** Múi giờ chi nhánh: Việt Nam.

## 1. Tổ chức

| Mục | Giá trị |
| --- | --- |
| Công ty (tenant) | Garage Minh Phát |
| Pháp nhân | Công ty TNHH Garage Minh Phát (một pháp nhân) |
| Mã số thuế (giả) | 0399 000 111 |
| Sản phẩm hiển thị trên khung ứng dụng | GMEP |
| Đơn vị trên chứng từ in | Garage Minh Phát · Chi nhánh {tên chi nhánh} |

| Mã | Chi nhánh | Địa chỉ (giả) | Kho |
| --- | --- | --- | --- |
| Q7 | Chi nhánh Quận 7 | 123 Nguyễn Thị Thập, Quận 7, TP. Hồ Chí Minh | Kho Quận 7 |
| TD | Chi nhánh Thủ Đức | 45 Võ Văn Ngân, TP. Thủ Đức, TP. Hồ Chí Minh | Kho Thủ Đức |
| DN | Chi nhánh Hải Châu | 78 Nguyễn Văn Linh, Hải Châu, Đà Nẵng | Kho Hải Châu |

Thông số minh họa: đơn giá giờ công chuẩn 200.000 ₫/giờ; thuế GTGT 8% (minh họa, có hiệu lực đến 31/12/2026; từ 01/01/2027 dự kiến 10%, kế toán xác nhận); báo giá hết hạn sau 7 ngày; thợ chỉ thấy việc của mình.

## 2. Dashboard hợp nhất toàn chuỗi (30/10/2026, số tạm 09:15)

| Chỉ số | Toàn chuỗi | Q7 | TD | DN |
| --- | --- | --- | --- | --- |
| Doanh thu hôm nay | 128.500.000 ₫ (hiển thị `128,5 tr ₫`) | 62.400.000 ₫ | 41.300.000 ₫ | 24.800.000 ₫ |
| Xe đang sửa | 42 | 18 | 14 | 10 |
| Báo giá chờ khách duyệt | 8 | 4 | 3 | 1 |
| Trễ hẹn | 3 | 1 | 2 | 0 |
| Chờ QC | 6 | 3 | 2 | 1 |
| Xe chờ phụ tùng | 4 | 2 | 1 | 1 |

Chuỗi doanh thu 7 ngày (toàn chuỗi, đơn vị triệu ₫, minh họa): 24/10: 96,2 · 25/10: 71,4 · 26/10 (Chủ nhật): 38,9 · 27/10: 104,8 · 28/10: 117,6 · 29/10: 122,3 · 30/10: 128,5 (tạm).

Các chỉ số khác (minh họa, cho thẻ KPI chủ garage): công nợ phải thu còn lại 86.400.000 ₫; giá trị tồn kho 1,25 tỷ ₫; 5 yêu cầu chờ chủ duyệt (2 giảm giá vượt hạn mức, 1 chuyển kho giá trị lớn, 1 hóa đơn thay thế, 1 chênh lệch quỹ).

Việc cần chú ý (Q7): Chờ duyệt báo giá 4 · Xe chờ phụ tùng 2 · Chờ QC 3.

## 3. Người dùng theo vai trò (chi nhánh Q7 là chính)

Số điện thoại giả luôn có dạng `0900 000 1xx`; email giả dùng miền không có thật (`@garage-mau.example`).

| Vai trò | Họ tên | Mã nhân viên | Chi nhánh | Ghi chú |
| --- | --- | --- | --- | --- |
| Chủ garage (CH) | Nguyễn Hoàng Long | NV-HQ-001 | Toàn chuỗi | Đăng nhập email `long@garage-mau.example` |
| Quản lý vùng (QV) `[Chưa chốt có vai trò này]` | Phạm Quốc Việt | NV-HQ-004 | Nhóm miền Nam (TD, Q7) | Nhóm chi nhánh `[Chưa chốt]` |
| Quản lý chi nhánh (QL) | Trần Thị Mai | NV-Q7-002 | Q7 | |
| Cố vấn dịch vụ (CV) | Lê Đức Anh | NV-Q7-006 | Q7 | |
| Quản đốc/QC (QĐ) | Hoàng Văn Thắng | NV-Q7-004 | Q7 | |
| Thợ (TH) | Nguyễn Văn Hải | NV-Q7-014 | Q7 | PIN 6 số; chuyên động cơ |
| Thợ (TH) | Đỗ Minh Khôi | NV-Q7-017 | Q7 | PIN 6 số; chuyên gầm phanh |
| Thợ (TH) | Phan Quốc Tín | NV-Q7-021 | Q7 | |
| Thủ kho (TK) | Bùi Thị Lan | NV-Q7-008 | Q7 | Không thấy giá vốn |
| Thu ngân (TN) | Vũ Ngọc Ánh | NV-Q7-010 | Q7 | Ca sáng 07:30 |
| Kế toán (KT, có cờ kế toán trưởng) | Đinh Thị Hạnh | NV-HQ-006 | Toàn chuỗi | Duyệt hóa đơn điều chỉnh |
| Mua hàng (MH) | Ngô Văn Phúc | NV-HQ-009 | TD, Q7 | |
| Nhân sự (NS) | Lý Thu Trang | NV-HQ-011 | Toàn chuỗi | |
| Quản trị hệ thống (AD) | Cao Văn Dũng | NV-HQ-002 | Toàn tenant | Không xem dữ liệu khách |
| Người nhiều công ty (ví dụ cho màn chọn công ty) | Trần Văn Bình | | Garage Minh Phát (QL) và Garage Bình An (CH) | Hai tư cách thành viên cùng một email |

Người nhiều vai trò: Bùi Thị Lan kiêm thủ kho và thu ngân tại Q7 (quyền cộng gộp).

## 4. Khách hàng và xe

| Mã khách | Tên | Loại | SĐT (giả, đầy đủ) | Hiển thị che | Chi nhánh gần nhất |
| --- | --- | --- | --- | --- | --- |
| KH-0001 | Nguyễn Văn An | Cá nhân | 0900 000 101 | `09•• ••• 101` | Q7 |
| KH-0002 | Lê Thị Hoa | Cá nhân | 0900 000 102 | `09•• ••• 102` | Q7 |
| KH-0003 | Trần Quốc Bảo | Cá nhân | 0900 000 103 | `09•• ••• 103` | Q7 |
| KH-0004 | Phạm Minh Tuấn | Cá nhân | 0900 000 104 | `09•• ••• 104` | Q7 |
| KH-0005 | Võ Thanh Sơn | Cá nhân | 0900 000 105 | `09•• ••• 105` | Q7 |
| KH-0006 | Công ty TNHH Vận tải Sao Việt | Doanh nghiệp | 0900 000 106 (người liên hệ Đỗ Văn Khánh) | `09•• ••• 106` | Q7 |
| KH-0007 | Đặng Thu Hà | Cá nhân | 0900 000 107 | `09•• ••• 107` | Q7 (khách từ Hà Nội) |
| KH-0008 | Hoàng Gia Huy | Cá nhân | 0900 000 108 | `09•• ••• 108` | DN |
| KH-0009 | Lê Hải Đăng | Cá nhân | 0900 000 109 | `09•• ••• 109` | TD |
| KH-0010 | Mai Văn Nam | Cá nhân | 0900 000 110 | `09•• ••• 110` | TD |
| KH-0011 | Trịnh Quang Hưng | Cá nhân | 0900 000 111 | `09•• ••• 111` | Q7 |

Khách doanh nghiệp KH-0006: MST giả 0399 000 222; tên pháp nhân trên hóa đơn "Công ty TNHH Vận tải Sao Việt"; hạn mức công nợ 20.000.000 ₫ và kỳ thanh toán 30 ngày (minh họa); công nợ hiện tại 6.480.000 ₫.

Địa chỉ giả (hiển thị che chỉ quận/huyện, tỉnh): KH-0001 "Quận 7, TP. Hồ Chí Minh"; KH-0007 "Cầu Giấy, Hà Nội"; KH-0008 "Hải Châu, Đà Nẵng".

| Biển số | Xe | Năm | Số km gần nhất | Chủ xe | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 51H-123.45 | Toyota Vios | 2019 | 48.200 | KH-0001 | Lần sửa trước 12/04/2026 ở 40.100 km |
| 51K-678.90 | Hyundai Accent | 2021 | 31.050 | KH-0002 | |
| 51G-456.78 | Mazda CX-5 | 2020 | 62.700 | KH-0003 | |
| 51F-112.33 | Kia Morning | 2018 | 74.900 | KH-0004 | |
| 61A-333.44 | Mitsubishi Xpander | 2021 | 58.300 | KH-0005 | Biển Bình Dương |
| 51B-234.56 | Toyota Innova | 2018 | 112.400 | KH-0006 | Biển kinh doanh vận tải |
| 51B-234.57 | Toyota Innova | 2018 | 118.900 | KH-0006 | Biển kinh doanh vận tải |
| 30H-789.01 | Honda CR-V | 2017 | 96.800 | KH-0007 | Biển Hà Nội |
| 43A-555.12 | Ford Ranger | 2022 | 41.600 | KH-0008 | Biển Đà Nẵng; từng sửa tại DN (RO-DN-2608-00019) |
| 51A-909.09 | Toyota Camry | 2016 | 128.400 | KH-0009 | |
| 51L-808.80 | Honda City | 2020 | 36.500 | KH-0010 | |
| 51M-246.80 | Honda Civic | 2019 | 52.300 | KH-0011 | |

Ví dụ xe đổi chủ: 51F-112.33 thuộc KH-0004 từ 05/03/2025; trước đó thuộc "Hoàng Thị Lý" đến 04/03/2025; lịch sử giữ nguyên.

Ví dụ cảnh báo số km: nhập 40.000 cho 51H-123.45 thấp hơn lần trước 40.100 → cảnh báo, yêu cầu lý do.

## 5. Lệnh sửa chữa hôm nay (chi nhánh Q7, trừ ghi chú)

Giá đã **gồm thuế 8%** (minh họa) ở cột "Tổng". Mỗi lệnh có ba huy hiệu: Lệnh · Thanh toán · Hóa đơn.

| Mã lệnh | Xe | Khách | Lệnh | Thanh toán | Hóa đơn | Tổng (đã gồm thuế) | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RO-Q7-2610-00131 | Innova 51B-234.56 | Công ty Sao Việt | **Đã duyệt** | Chưa thanh toán | Chưa xuất | 2.052.000 ₫ | Chưa phân thợ; khách công nợ doanh nghiệp |
| RO-Q7-2610-00130 | Xpander 61A-333.44 | Võ Thanh Sơn | **Tạm dừng** · tag "Chờ phụ tùng" | Chưa thanh toán | Chưa xuất | 4.968.000 ₫ | Thiếu má phanh trước Xpander (xem mục 6, chuyển kho CK-TD-2610-00012). Báo giá duyệt một phần |
| RO-Q7-2610-00128 | Vios 51H-123.45 | Nguyễn Văn An | **Đang sửa chữa** | Chưa thanh toán | Chưa xuất | 2.311.200 ₫ | Nhận 08:10; hẹn giao 16:00; chi tiết ở mục 5.1 |
| RO-Q7-2610-00129 | Morning 51F-112.33 | Phạm Minh Tuấn | **Chờ QC** | Chưa thanh toán | Chưa xuất | 918.000 ₫ | Bảo dưỡng 10.000 km; chờ quản đốc kiểm |
| RO-Q7-2610-00127 | CX-5 51G-456.78 | Trần Quốc Bảo | **Sẵn sàng bàn giao** | **Thanh toán một phần** (đã thu 2.000.000 ₫, còn 1.510.000 ₫) | Chưa xuất | 3.510.000 ₫ | Cố vấn chờ khách đến lấy xe |
| RO-Q7-2610-00126 | Accent 51K-678.90 | Lê Thị Hoa | **Hoàn tất** | **Đã thanh toán** (tiền mặt, 09:05) | **Đã xuất** (1C26TMP / 00000087) | 1.620.000 ₫ | Đã giao xe lúc 09:10 |
| RO-Q7-2610-00125 | CR-V 30H-789.01 | Đặng Thu Hà | **Đã hủy** | (không có) | (không có) | 0 ₫ | Hủy sau khi duyệt; lý do "Khách đổi ý, không sửa tại Q7"; có 1 lọc dầu đã xuất, hoàn kho bằng phiếu HK-Q7-2610-00004 |
| RO-TD-2610-00057 | Camry 51A-909.09 | Lê Hải Đăng | **Hoàn tất** | **Đã thanh toán** | **Chưa xuất** + chỉ báo "Lỗi phát hành, chờ thử lại (lần 2 lúc 11:42 hôm qua)" | 4.320.000 ₫ | Ví dụ lỗi hóa đơn (chi nhánh TD) |

Các giờ chỉ để dựng mockup.

### 5.1 Chi tiết RO-Q7-2610-00128 (màn chuẩn số 1)

| Mục | Giá trị |
| --- | --- |
| Biển số, xe | 51H-123.45 · Toyota Vios 2019 |
| Khách | Nguyễn Văn An (SĐT che theo vai trò) |
| Cố vấn | Lê Đức Anh |
| Nhận xe | 30/10/2026 08:10 · Số km 48.200 · Hẹn giao 16:00 |
| Yêu cầu của khách | "Thay dầu, nghe tiếng kêu ở bánh trước khi phanh" |
| Hiện trạng | Trầy nhẹ cản trước bên phải (có ảnh); đèn báo dầu sáng |
| Báo giá nguồn | BG-Q7-2610-00231 (phiên bản v1, Duyệt toàn phần lúc 08:45 tại quầy) |
| Huy hiệu | Lệnh: Đang sửa chữa · Thanh toán: Chưa thanh toán · Hóa đơn: Chưa xuất |

| # | Hạng mục | Thợ chính | Trạng thái hạng mục | Giờ chuẩn | Dòng | Số lượng × đơn giá | Thành tiền (chưa thuế) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thay dầu động cơ và lọc dầu | Nguyễn Văn Hải | Hoàn thành (09:02) | 0,5 | Công thay dầu | 0,5 giờ × 200.000 ₫ | 100.000 ₫ |
| | | | | | Dầu động cơ 5W-30 (LD-0001) | 4 lít × 185.000 ₫ | 740.000 ₫ |
| | | | | | Lọc dầu động cơ Vios (LL-0010) | 1 × 120.000 ₫ | 120.000 ₫ |
| 2 | Thay má phanh trước | Đỗ Minh Khôi | Đang làm (bắt đầu 09:05) | 1,0 | Công thay má phanh | 1,0 giờ × 200.000 ₫ | 200.000 ₫ |
| | | | | | Má phanh trước Vios (MP-0201) | 1 bộ × 980.000 ₫ | 980.000 ₫ |

Tổng chưa thuế 2.140.000 ₫ (hạng mục 1: 960.000 ₫, hạng mục 2: 1.180.000 ₫) · Thuế GTGT 8%: 171.200 ₫ · **Tổng cộng 2.311.200 ₫**.

Phụ tùng: dầu và lọc dầu đã xuất (GIN-Q7-2610-00341, 08:50); má phanh đã xuất (GIN-Q7-2610-00342, 09:03). Phát sinh: chưa có. Lịch sử mẫu: 08:10 Tiếp nhận (Lê Đức Anh) · 08:30 Gửi báo giá · 08:45 Khách duyệt toàn phần tại quầy · 08:46 Mở lệnh · 08:55 Phân thợ (Hoàng Văn Thắng) · 09:02 Hạng mục 1 hoàn thành · 09:05 Hạng mục 2 bắt đầu → lệnh tự chuyển Đang sửa.

### 5.2 Hạng mục phát sinh (ví dụ, RO-Q7-2610-00128)

Thợ Đỗ Minh Khôi phát hiện đĩa phanh trước mòn: đề xuất hạng mục phát sinh "Thay đĩa phanh trước (cặp)" 1.800.000 ₫ + công 300.000 ₫ = 2.100.000 ₫ chưa thuế (2.268.000 ₫ gồm thuế); trạng thái thuộc tính duyệt: **Chờ khách duyệt (phát sinh)**; nút Bắt đầu của hạng mục này **khóa kèm lý do**; hết hạn duyệt sau 24 giờ (cấu hình).

## 6. Phụ tùng và tồn kho bốn số (kho Quận 7, 09:15)

Khả dụng = Thực tế − Giữ chỗ (Đang vận chuyển không cộng). "Định mức" là tồn khả dụng tối thiểu cấu hình theo mặt hàng và chi nhánh.

| Mã | Phụ tùng | ĐV | Tồn thực tế | Đã giữ | Đang vận chuyển | Khả dụng | Định mức | Huy hiệu | Giá niêm yết | Giá vốn (ẩn với TK, CV, MH) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LD-0001 | Dầu động cơ Castrol 5W-30 | lít | 48 | 8 | 0 | 40 | 30 | Đủ hàng | 185.000 ₫ | 142.000 ₫ |
| LL-0010 | Lọc dầu động cơ Toyota Vios | cái | 12 | 3 | 0 | 9 | 10 | Sắp hết | 120.000 ₫ | 78.000 ₫ |
| MP-0201 | Má phanh trước Toyota Vios | bộ | 5 | 1 | 0 | 4 | 4 | Sắp hết | 980.000 ₫ | 690.000 ₫ |
| MP-0305 | Má phanh trước Mitsubishi Xpander | bộ | 0 | 0 | 4 | 0 | 4 | Hết hàng + tag "Đang vận chuyển 4" | 1.350.000 ₫ | 940.000 ₫ |
| BU-0040 | Bugi Iridium NGK | cái | 36 | 4 | 0 | 32 | 20 | Đủ hàng | 210.000 ₫ | 140.000 ₫ |
| DH-0012 | Dầu hộp số CVT | lít | 22 | 5 | 0 | 17 | 20 | Sắp hết | 340.000 ₫ | 250.000 ₫ |
| NM-0007 | Nước làm mát 4 lít | can | 15 | 0 | 0 | 15 | (chưa đặt) | Chưa đặt định mức | 95.000 ₫ | 60.000 ₫ |

Tình huống: RO-Q7-2610-00130 (Xpander) cần 1 bộ MP-0305 nhưng khả dụng 0 → lệnh Tạm dừng · Chờ phụ tùng.

Yêu cầu cấp phụ tùng mẫu (thủ kho): YC-Q7-2610-00412 · Lệnh RO-Q7-2610-00130 · Bugi Iridium NGK × 4 (BU-0040) · Dầu hộp số CVT × 5 lít (DH-0012) · trạng thái **Đã xuất một phần** · Má phanh MP-0305 × 1: **Thiếu hàng, chờ hàng về**.

### 6.1 Chuyển kho và mua hàng (ví dụ)

| Chứng từ | Nội dung | Trạng thái |
| --- | --- | --- |
| CK-TD-2610-00012 | Chuyển Thủ Đức → Quận 7: Má phanh trước Xpander × 4 bộ (giá vốn 940.000 ₫ × 4 = 3.760.000 ₫); gửi 29/10/2026 16:30 | **Đang vận chuyển** |
| CK-Q7-2610-00014 | Chuyển Quận 7 → Hải Châu: Lọc dầu Toyota × 600 cái (giá trị 46.800.000 ₫ theo giá vốn 78.000 ₫) | **Chờ duyệt** (giá trị lớn; chủ hoặc quản lý vùng) |
| YM-Q7-2610-00031 | Yêu cầu mua Lọc dầu Toyota × 40 (78.000 ₫ × 40 = 3.120.000 ₫) | **Chờ duyệt** (vượt hạn mức minh họa) |
| DM-Q7-2610-00018 | Đơn mua dầu 5W-30 × 100 lít (142.000 ₫ × 100 = 14.200.000 ₫); nhà cung cấp "Công ty TNHH Phụ tùng Đại Phát" | **Nhận một phần** (60/100 lít) |

## 7. Báo giá (đủ 6 trạng thái)

| Mã | Xe | Trạng thái | Giá báo (gồm thuế) | Ghi chú |
| --- | --- | --- | --- | --- |
| BG-Q7-2610-00238 | Accent 51K-678.90 | **Nháp** (v1) | 1.350.000 ₫ | Bảo dưỡng định kỳ |
| BG-Q7-2610-00235 | Ranger 43A-555.12 | **Chờ khách duyệt** | 2.916.000 ₫ | Gửi 08:40, hết hạn 06/11/2026; xe này từng sửa ở Hải Châu (lịch sử xuyên chi nhánh) |
| BG-Q7-2610-00233 | Xpander 61A-333.44 | **Duyệt một phần** | Báo giá 7.344.000 ₫; duyệt 4.968.000 ₫ | Chi tiết bên dưới |
| BG-Q7-2610-00231 | Vios 51H-123.45 | **Duyệt toàn phần** | 2.311.200 ₫ | Đã thành RO-Q7-2610-00128 |
| BG-TD-2610-00040 | Honda City 51L-808.80 | **Từ chối** | 5.832.000 ₫ | Khách từ chối toàn bộ (Thủ Đức) |
| BG-Q7-2609-00198 | Morning 51F-112.33 | **Hết hạn** | 3.348.000 ₫ | Báo giá tháng trước, không phản hồi |

Chi tiết BG-Q7-2610-00233 (chưa thuế): (a) Thay má phanh trước: công 250.000 + má phanh 1.350.000 = 1.600.000 · **Duyệt**; (b) Thay bugi 4 cái: 4 × 210.000 = 840.000 + công 160.000 = 1.000.000 · **Duyệt**; (c) Thay dầu hộp số CVT: 5 lít × 340.000 = 1.700.000 + công 300.000 = 2.000.000 · **Duyệt**; (d) Vệ sinh kim phun 1.200.000 · **Từ chối** (lưu để nhắc); (e) Thay lọc gió điều hòa và vệ sinh dàn lạnh 1.000.000 · **Từ chối** (lưu để nhắc). Tổng chưa thuế 6.800.000 ₫; được duyệt 4.600.000 ₫; thuế 8% → 7.344.000 ₫ và 4.968.000 ₫. Hạng mục (a) là "Bắt buộc an toàn" (phanh): bỏ chọn phải có cảnh báo và lý do. Giảm giá đề xuất 8% cho báo giá này vượt hạn mức giảm 5% (minh họa) → chờ quản lý duyệt.

## 8. Thu tiền, ca, chốt ngày (Q7, 30/10/2026)

| Mã phiếu | Lệnh | Hình thức | Số tiền | Giờ |
| --- | --- | --- | --- | --- |
| PT-Q7-2610-00210 | RO-Q7-2610-00126 | Tiền mặt | 1.620.000 ₫ | 09:05 |
| PT-Q7-2610-00211 | RO-Q7-2610-00127 | Chuyển khoản | 2.000.000 ₫ | 08:55 |

Ca sáng (Vũ Ngọc Ánh, mở 07:30): quỹ đầu ca 2.000.000 ₫ + thu tiền mặt 1.620.000 ₫ = **sổ quỹ 3.620.000 ₫**; thực đếm 3.600.000 ₫ → **chênh lệch −20.000 ₫** (cần giải trình, quản lý chi nhánh duyệt). Thu chuyển khoản trong ca: 2.000.000 ₫.

Mục chặn khi chốt ngày Q7 (ví dụ): 4 lệnh còn mở; 1 lệnh hoàn tất chưa thu (RO-00127 còn 1.510.000 ₫); 2 lệnh hoàn tất chưa hóa đơn; chênh lệch quỹ −20.000 ₫ chưa duyệt → nút "Khóa ngày" bị khóa kèm lý do.

## 9. Hóa đơn điện tử (số giả)

Mẫu số/ký hiệu giả `1C26TMP`; số hóa đơn do nhà cung cấp cấp.

| Số | Lệnh | Số tiền | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| 1C26TMP / 00000087 | RO-Q7-2610-00126 | 1.620.000 ₫ | Đã xuất | 30/10/2026 09:12 |
| 1C26TMP / 00000079 | RO-Q7-2610-00104 | 1.188.000 ₫ | Điều chỉnh | Điều chỉnh bởi hóa đơn liên kết |
| 1C26TMP / 00000081 | RO-Q7-2610-00107 | 2.376.000 ₫ | Thay thế | Thay bằng 1C26TMP / 00000084 |
| 1C26TMP / 00000083 | RO-Q7-2610-00109 | 864.000 ₫ | Hủy | Có lý do, kế toán trưởng đã duyệt |
| (chưa có số) | RO-TD-2610-00057 | 4.320.000 ₫ | Chưa xuất | Chỉ báo "Lỗi phát hành, chờ thử lại"; không bấm phát hành lại, truy vấn trước |

## 10. Hàng chờ phê duyệt (ví dụ cho chủ và quản lý)

Hạn mức trong ví dụ là **minh họa, chưa chốt**.

| # | Loại | Đối tượng | Người đề xuất | Cấp chờ | Chi tiết |
| --- | --- | --- | --- | --- | --- |
| 1 | Giảm giá vượt hạn mức | BG-Q7-2610-00233 | Lê Đức Anh (CV) | Quản lý chi nhánh (Trần Thị Mai) | Xin giảm 8%, hạn mức 5%; 09:10 |
| 2 | Hủy lệnh sau xuất phụ tùng | RO-Q7-2610-00125 | Lê Đức Anh (CV) | Quản lý chi nhánh | Đã hoàn kho 1 lọc dầu (HK-Q7-2610-00004) |
| 3 | Chênh lệch quỹ cuối ca | Ca sáng 30/10, Q7 | Vũ Ngọc Ánh (TN) | Quản lý chi nhánh | −20.000 ₫; có giải trình "Thối thừa tiền lẻ" |
| 4 | Chuyển kho giá trị lớn | CK-Q7-2610-00014 | Trần Thị Mai (QL) | Chủ garage hoặc quản lý vùng | 46.800.000 ₫; đã chờ 1 ngày làm việc, đã nhắc |
| 5 | Hóa đơn thay thế | 1C26TMP / 00000081 | Đinh Thị Hạnh (KT) | Kế toán trưởng | Đã tự chuyển cấp sau quá hạn: vẫn "Chờ duyệt"; cấp trước bị khóa kèm lý do |
| 6 | Yêu cầu mua vượt hạn mức | YM-Q7-2610-00031 | Ngô Văn Phúc (MH) | Quản lý chi nhánh | 3.120.000 ₫ |

Ví dụ khóa: Lê Đức Anh mở yêu cầu số 1 → nút Duyệt khóa "Người lập yêu cầu không tự duyệt. Nhờ Quản lý chi nhánh".

## 11. Lịch hẹn hôm nay (Q7)

| Giờ hẹn | Khách / xe | Dịch vụ | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| 08:00 | Nguyễn Văn An · 51H-123.45 | Thay dầu, kiểm tra phanh | Đã đến | Thành RO-Q7-2610-00128 |
| 07:45 | Phạm Minh Tuấn · 51F-112.33 | Bảo dưỡng 10.000 km | Đã đến | Thành RO-Q7-2610-00129 |
| 08:30 | Trịnh Quang Hưng · 51M-246.80 | Kiểm tra điều hòa | **Trễ hẹn** (trễ 45 phút lúc 09:15) | Nhãn cảnh báo kèm biểu tượng đồng hồ; nút nhanh: Gọi khách, Dời lịch, Đánh dấu vắng |
| 14:00 | Lê Thị Hoa · 51K-678.90 | Bảo dưỡng định kỳ | Đã hẹn | |
| 15:30 | Mai Văn Nam · 51L-808.80 | Thay lốp | **Chờ xác nhận** | Khách tự đặt trực tuyến |

## 12. Nhật ký thao tác (ví dụ)

| Thời điểm | Người | Hành động | Đối tượng | Chi nhánh |
| --- | --- | --- | --- | --- |
| 30/10/2026 09:10 | Lê Đức Anh (CV) | Đề xuất giảm giá 8% | BG-Q7-2610-00233 | Q7 |
| 30/10/2026 09:12 | Đinh Thị Hạnh (KT) | Hiện số điện thoại (lý do: Đối chiếu hóa đơn) | KH-0002 | Q7 |
| 30/10/2026 09:05 | Đỗ Minh Khôi (TH) | Bắt đầu hạng mục "Thay má phanh trước" | RO-Q7-2610-00128 | Q7 |
| 30/10/2026 08:50 | Bùi Thị Lan (TK) | Xuất kho GIN-Q7-2610-00341 | RO-Q7-2610-00128 | Q7 |
| 30/10/2026 08:45 | Lê Đức Anh (CV) | Ghi nhận khách duyệt toàn phần tại quầy | BG-Q7-2610-00231 | Q7 |
| 29/10/2026 16:30 | Bùi Thị Lan (TK) | Gửi phiếu chuyển kho | CK-TD-2610-00012 | TD |
| 29/10/2026 14:02 | Cao Văn Dũng (AD) | Gửi lời mời kích hoạt cho nhân viên mới | NV-Q7-024 | Q7 |

## 13. Cấu hình có ngày hiệu lực (ví dụ: thuế suất GTGT)

| Phiên bản | Giá trị | Hiệu lực từ | Đến | Trạng thái | Người tạo |
| --- | --- | --- | --- | --- | --- |
| v1 | 10% | 01/01/2022 | 30/06/2025 | Đã dùng trong chứng từ (chỉ đọc) | Đinh Thị Hạnh |
| v2 | 8% | 01/07/2025 | 31/12/2026 | **Đang hiệu lực** · Đã dùng trong chứng từ | Đinh Thị Hạnh |
| v3 | 10% | 01/01/2027 | (không giới hạn) | **Đã lên lịch** (chờ kế toán xác nhận) | Đinh Thị Hạnh |

Nhóm áp dụng 8%: do kế toán xác nhận nhóm công và phụ tùng (minh họa). Ví dụ xem trước: "Từ 01/01/2027, báo giá và hóa đơn mới dùng 10%; chứng từ đã tạo trước đó giữ nguyên 8%."

## 14. Nhập dữ liệu Excel (ví dụ)

Loại dữ liệu: Danh mục phụ tùng · Tệp `danh-muc-phu-tung-q7.xlsx` · 1.248 dòng · **1.231 hợp lệ, 17 lỗi**. Ví dụ lỗi theo dòng: dòng 45 "Mã phụ tùng trùng LD-0001"; dòng 112 "Giá nhập trống"; dòng 306 "Đơn vị tính không hợp lệ (cho phép: cái, bộ, lít, can)". Nguồn tên trùng cần gộp: "Lọc dầu Toyota" và "Oil Filter Toyota". Xác nhận ghi lô: gõ cụm xác nhận.

## 15. Nhân sự và công thợ (cho các màn giai đoạn sau)

| Nhân viên | Hôm nay | Ghi chú (giá trị minh họa, chưa có công thức công chốt) |
| --- | --- | --- |
| Nguyễn Văn Hải | Trong ca 07:30; hoàn thành hạng mục 1 của RO-00128 (giờ chuẩn 0,5; giờ thực 0,4) | Hiệu suất = giờ chuẩn / giờ thực |
| Đỗ Minh Khôi | Trong ca 07:30; đang làm hạng mục 2 | |
| Phan Quốc Tín | Đi muộn 12 phút | Huy hiệu "Đi muộn 12 phút" (Warning) |

Công thức tính công và hoa hồng là `[Chưa chốt]`: mockup chỉ hiển thị giờ chuẩn, giờ thực và dòng công, không đặt công thức.

## 16. Gợi ý dùng bộ dữ liệu

- Màn chuẩn số 1 (`G2-REC-04`): dùng RO-Q7-2610-00128, thêm trạng thái phát sinh ở mục 5.2.
- Bảng điều phối (kanban): dùng mục 5 (đủ 7 trạng thái lệnh) + dải "trước lệnh" gồm lịch hẹn chờ tiếp nhận và báo giá chờ duyệt (mục 7, 11).
- Tồn kho bốn số: mục 6; thử nhãn dài với "Má phanh trước Mitsubishi Xpander (bộ)".
- Chủ garage trên điện thoại: mục 2, 10.
- Thử độ dài chuỗi: tên pháp nhân "Công ty TNHH Vận tải Sao Việt"; địa chỉ dài "123 Nguyễn Thị Thập, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh".
