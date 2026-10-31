# Danh mục câu chữ trạng thái hệ thống (Error/System State Copy Catalog)

Phiên bản 1.0 · 31/10/2026 · Người lập: designer · Trả lời DS-09 (mã lý do chuẩn) và yêu cầu trạng thái của slice 1.1/1.2. Câu chữ đi vào `messages/vi.json` (next-intl, chỉ tiếng Việt). Lỗi API theo RFC 9457 (`application/problem+json`).

Nguyên tắc câu chữ (theo skill `dashboard-ui-ux`, mục States và Vietnam localization):

1. Công thức: **điều gì xảy ra + vì sao (nếu biết) + cách khắc phục**. Không đổ lỗi cho người dùng; không hiện stack trace, mã kỹ thuật, tên bảng. Mã tham chiếu yêu cầu (`REQ-xxxxxx`) hiện ở dòng nhỏ và có nút Sao chép.
2. Giọng bình tĩnh, câu ngắn, không chấm than, không viết hoa toàn bộ. Xưng "bạn". Động từ cụ thể trên nút ("Đăng nhập lại", "Xem bản mới nhất"), không dùng "OK", "Đồng ý" trơ trọi.
3. Dấu tiếng Việt đầy đủ; chuẩn hóa NFC; chừa chỗ cho chuỗi dài hơn tiếng Anh (nhãn nút co giãn, không cố định chiều rộng).
4. Số và ngày theo `vi-VN`: tiền `1.250.000 ₫`, ngày `dd/MM/yyyy`, giờ 24h `HH:mm`; thời gian chờ định dạng `mm:ss`, lấy từ `Retry-After` hoặc trường của máy chủ, **không hard-code số phút trong chữ** (các số trong prototype chỉ minh họa).
5. Không tiết lộ sự tồn tại: 404 dùng cho cả bản ghi không có và bản ghi ngoài phạm vi; thông báo đăng nhập, quên mật khẩu, khóa tạm giống nhau cho mọi tài khoản.
6. Dữ liệu người dùng đã nhập **không bị xóa** khi lỗi (trừ mật khẩu: giữ trong bộ nhớ trang, không lưu bền vững).
7. Lỗi nghiệp vụ (tồn không đủ, vượt hạn mức) khác lỗi kỹ thuật: nêu số liệu và lối ra.

## 1. Bảng tổng hợp theo mã trạng thái

| Mã | Khi nào | Khuôn UI | `role` / focus |
| --- | --- | --- | --- |
| 401 | Phiên hết hạn (rảnh hoặc tuyệt đối) hoặc cookie bị thu hồi | Màn khóa phiên G1-AUT-09 nếu đang trong ứng dụng (giữ nháp); chuyển G5-AUT-04 kèm thông báo nếu mở trang mới | `status`; focus vào ô mật khẩu |
| 403 | Có bản ghi hoặc chức năng mà vai trò đã biết là tồn tại nhưng không được phép | Toàn trang G1-ERR-01 hoặc ReasonDisabled tại nút | `status`; focus tiêu đề |
| 404 | Không có trang, hoặc bản ghi không có/ngoài phạm vi | Toàn trang G1-ERR-02 hoặc trạng thái trống trong khối | `status`; focus tiêu đề |
| 409 | Xung đột phiên bản (`If-Match`), trạng thái đã đổi, yêu cầu trùng đang xử lý | Hộp thoại hoặc alert trong form kèm so sánh | `alertdialog` hoặc `alert` |
| 422 | Dữ liệu không hợp lệ hoặc vi phạm quy tắc nghiệp vụ | Lỗi cạnh trường + tóm tắt đầu form | `alert` cho tóm tắt; focus lỗi đầu |
| 429 | Quá giới hạn tần suất | Alert có đếm lùi, nút gửi tắt kèm lý do | `alert` (đếm lùi không đọc từng giây) |
| 500 / 502 / 504 | Lỗi hệ thống, hết thời gian chờ | Toàn trang G1-ERR-03, hoặc ErrorState trong khối + Thử lại | `alert` |
| 503 | Bảo trì có kế hoạch | G1-ERR-04 biến thể bảo trì | `status` |
| offline | Trình duyệt mất mạng hoặc API không tới được | Banner đầu trang + tắt nút cần mạng + giữ nháp | `alert` lúc mất, `status` lúc có lại |

Ánh xạ RFC 9457 (gợi ý cho dev, tên `type` do dev chốt): `type` ổn định dạng `urn:gmep:problem:<slug>`, `title` bằng tiếng Việt không dùng làm nội dung chính của UI (UI tra theo `type`/`code` trong từ điển), `status`, `detail` (mô tả cho nhật ký, không hiển thị nguyên văn nếu chứa dữ liệu nhạy cảm), `instance` = mã tham chiếu `REQ-…`, `errors[{pointer, code, params}]` cho 422. UI chọn câu chữ theo `code` và điền `params` (ví dụ số lượng, hạn mức) bằng ICU MessageFormat.

---

## 2. Từng trạng thái

### 2.1 401 Phiên đã hết hạn

| Thành phần | Nội dung |
| --- | --- |
| Tiêu đề | Phiên làm việc đã hết hạn |
| Thông báo | Vì an toàn, bạn cần đăng nhập lại. Bản nháp đang soạn được giữ trên thiết bị và hiện lại sau khi bạn đăng nhập bằng cùng tài khoản. |
| Nút | **Đăng nhập lại** (chính) |
| Biến thể trong ứng dụng | Màn khóa phiên (G1-AUT-09): "Nhập mật khẩu để tiếp tục" giữ nguyên màn hình bên dưới, quay lại đúng chỗ đang làm. |
| Cảnh báo trước | 60 giây trước khi khóa vì rảnh: "Phiên sắp hết hạn sau 01:00 do không có thao tác." + nút **Tiếp tục làm việc**. Thời hạn rảnh/tuyệt đối theo vai trò là cấu hình `[Cần xác nhận]` Q5. |
| Khác với đăng nhập sai | Đăng nhập sai mật khẩu **không** dùng câu này (xem 2.9). |
| Lưu ý dev | API trả 401 với `code: session_expired`; UI không tự chuyển trang nếu còn nháp chưa lưu cục bộ, mà mở màn khóa phiên trước. Không đặt thông tin tài khoản vào URL `next`. Đăng nhập xong quay về `next` chỉ khi cùng nguồn gốc (tránh open redirect). |

### 2.2 403 Không có quyền

| Thành phần | Trang | Hành động (nút khóa) |
| --- | --- | --- |
| Tiêu đề | Bạn không có quyền xem trang này | (không có; dùng lý do dưới nút) |
| Thông báo | Vai trò hiện tại của bạn (Cố vấn dịch vụ) chưa được cấp quyền xem mục này. Nếu bạn cần dùng, nhờ quản lý chi nhánh hoặc quản trị hệ thống cấp quyền. | Bạn chưa có quyền duyệt giảm giá. Yêu cầu sẽ chuyển cho Quản lý chi nhánh. (lý do cụ thể theo §3) |
| Nút | **Về trang chủ**; **Gửi yêu cầu cấp quyền** (chỉ khi có quy trình, `[Cần xác nhận]`) | `aria-disabled` + dòng lý do |
| Lưu ý | Chỉ dùng 403 khi người dùng *đã biết* mục đó tồn tại (menu, URL công khai trong tổ chức). Bản ghi cụ thể ngoài phạm vi: dùng 404 (2.3). Không liệt kê quyền "còn thiếu" chi tiết nếu làm lộ cấu hình bảo mật. Hiển thị **ẩn thay vì chặn** cho mục menu mà vai trò không bao giờ cần. |
| Mã tham chiếu | Dòng nhỏ: "Mã tham chiếu REQ-… (đưa cho quản trị hệ thống nếu cần hỗ trợ)". |

### 2.3 404 Không tìm thấy (cũng dùng cho bản ghi ngoài phạm vi)

| Thành phần | Nội dung |
| --- | --- |
| Tiêu đề | Không tìm thấy nội dung này |
| Thông báo | Liên kết có thể đã cũ, nội dung đã được lưu trữ, hoặc bạn không có quyền xem. Kiểm tra lại mã chứng từ hoặc quay về danh sách để tìm. |
| Nút | **Về danh sách** (chính, về danh sách của module hiện tại), **Tìm kiếm** (mở Ctrl+K) |
| Tuyệt đối không | Không viết "thuộc chi nhánh khác", "bạn không có quyền với chi nhánh X", "bản ghi tồn tại nhưng…". Câu chữ, mã trạng thái, kích thước phản hồi, thời gian phản hồi **giống hệt** cho bản ghi không tồn tại và bản ghi ngoài phạm vi (NFR-ISO-01, UAT-06; ADR §6.3 "bản ghi ngoài phạm vi trả 404"). |
| Trong khối (danh sách tìm kiếm) | Không có kết quả: "Không tìm thấy kết quả cho “…” trong phạm vi bạn được xem. Kiểm tra chính tả (có thể gõ không dấu) hoặc đổi phạm vi chi nhánh." (không nói chi nhánh khác có hay không). |
| Biến thể | URL cũ của chứng từ đã được gộp/đổi mã: chuyển hướng 301 nội bộ, không hiện 404. |

### 2.4 409 Xung đột phiên bản

| Thành phần | Nội dung |
| --- | --- |
| Tiêu đề | Bản ghi vừa được cập nhật bởi người khác |
| Thông báo | Nguyễn Thị Thu Hà đã sửa phiếu này lúc 09:12. Thay đổi của bạn chưa được lưu để tránh ghi đè. Xem bản mới nhất rồi áp dụng lại thay đổi cần thiết. |
| Nút | **Xem bản mới nhất** (chính; tải lại, giữ thay đổi đang soạn ở khung "Thay đổi của bạn" để sao chép) · **Sao chép thay đổi của tôi** · Hủy |
| Hiển thị | Hộp thoại có hai cột "Của bạn" và "Bản mới nhất" cho các trường khác nhau (DiffView). Quy tắc gộp tự động (nếu có) `[Cần xác nhận]` với BA: mặc định **không** tự gộp. |
| Biến thể 1: trạng thái đã đổi | "Trạng thái của lệnh đã thay đổi thành <Chờ QC> nên thao tác này không còn áp dụng. Tải lại để xem tình trạng hiện tại." Nút **Tải lại**. |
| Biến thể 2: đang xử lý | "Yêu cầu này đang được xử lý. Vui lòng đợi vài giây, không cần bấm lại. Hệ thống không tạo bản ghi trùng." Dùng khi cùng `Idempotency-Key` đang chạy (hóa đơn điện tử, thu tiền, xuất kho). Khi hoàn tất, trả đúng kết quả của lần đầu. |
| Biến thể 3: trùng khóa nghiệp vụ | "Mã kho “KHO-Q7-01” đã được dùng trong chi nhánh này. Chọn mã khác." (thực chất là 422/409 theo lỗi trường; đặt cạnh ô mã). |
| Lưu ý dev | Dùng `ETag`/`version` và `If-Match`; 409 trả `current` (bản mới) trong `errors[]` hoặc qua GET riêng. Không bao giờ ghi đè im lặng. |

### 2.5 422 Dữ liệu không hợp lệ

| Thành phần | Nội dung |
| --- | --- |
| Tóm tắt đầu form (khi ≥ 2 lỗi) | Có 2 mục cần sửa trước khi lưu: Tên kho, Số lượng. (mỗi mục là liên kết nhảy tới ô) |
| Lỗi cạnh trường | Theo bảng dưới; hiện ngay dưới ô, `aria-invalid`, `aria-describedby`; tiêu điểm vào ô lỗi đầu tiên khi gửi. |
| Nút | Nút gửi vẫn bật (không khóa vì lỗi); nút **Lưu nháp** vẫn dùng được khi nháp không đầy đủ. |
| Giữ dữ liệu | Không xóa gì đã nhập. |

Thư viện lỗi trường (điền `{…}` từ `params`):

| Mã (`code`) | Câu chữ |
| --- | --- |
| `required` | Nhập {tên trường}. Ví dụ: {ví dụ}. |
| `too_short` | {Tên trường} cần ít nhất {min} ký tự. |
| `too_long` | {Tên trường} tối đa {max} ký tự. Hiện có {n}. |
| `invalid_format.email` | Email chưa đúng định dạng. Ví dụ: ha.nguyen@garage.vn. |
| `invalid_format.phone` | Số điện thoại gồm 10 số, bắt đầu bằng 0 (hoặc +84). Ví dụ: 0903 456 321. `[Cần xác nhận]` quy tắc số điện thoại quốc tế. |
| `invalid_format.plate` | Biển số chưa đúng dạng. Ví dụ: 51H-123.45. Biển ngoại giao hay tạm: chọn “Loại biển” rồi nhập tự do. |
| `invalid_format.money` | Nhập số tiền bằng số, không có chữ, không có số lẻ. Ví dụ: 1.250.000. |
| `out_of_range` | {Tên trường} từ {min} đến {max}. |
| `duplicate` | {Tên trường} “{giá trị}” đã tồn tại {phạm vi}. Chọn giá trị khác. (phạm vi nói “trong chi nhánh này”, không nêu chi nhánh khác) |
| `date.past` | Ngày không được trước {dd/MM/yyyy}. |
| `date.locked` | Ngày {dd/MM/yyyy} đã khóa sổ. Chọn ngày sau {dd/MM/yyyy} hoặc nhờ kế toán trưởng mở lại ngày (có lý do). |
| `stock.insufficient` | Chỉ còn {khả dụng} khả dụng, bạn yêu cầu {yêu cầu}. Giảm số lượng, chờ hàng về, hoặc xin chuyển kho. |
| `limit.discount` | Giảm giá {x}% vượt hạn mức {y}% của vai trò bạn. Gửi xin duyệt hoặc giảm xuống tối đa {y}%. |
| `limit.below_cost` | Giá bán thấp hơn giá vốn. Cần Quản lý chi nhánh duyệt. |
| `state.invalid` | Trạng thái hiện tại ({trạng thái}) không cho phép thao tác này. |
| `policy.password.min_length` | Mật khẩu cần ít nhất 10 ký tự. Gợi ý: dùng một cụm từ dễ nhớ, ví dụ garage-quan7-mua-thu. |
| `policy.password.reused` | Mật khẩu này đã dùng gần đây. Không dùng lại 5 mật khẩu gần nhất. |
| `policy.password.common` | Mật khẩu này quá phổ biến nên dễ bị đoán. Chọn một cụm từ khác, dài hơn. (BA đề xuất chặn mật khẩu thông dụng, chờ xác nhận; chưa đưa vào danh sách yêu cầu hiển thị trực tiếp) |
| `policy.password.contains_identity` | Mật khẩu không nên chứa tên, email hoặc mã nhân viên của bạn. Chọn một cụm từ khác. (như trên, chờ xác nhận) |
| `mismatch` | Hai mật khẩu chưa giống nhau. Nhập lại đúng mật khẩu ở ô trên. |

Số 10 và 5 của mật khẩu lấy từ ADR §6.3 và `ba-decisions` D-03, **chưa có trong FR-SYS-001**; phải đọc từ cấu hình, không viết cứng (xem mục gửi BA ở báo cáo).

### 2.6 429 Quá nhiều yêu cầu

| Thành phần | Nội dung |
| --- | --- |
| Tiêu đề | Bạn thao tác hơi nhanh |
| Thông báo | Hệ thống tạm giới hạn số lần thử để bảo vệ tài khoản và dữ liệu. Thử lại sau {mm:ss}. Nội dung bạn đã nhập vẫn được giữ. |
| Nút | **Thử lại** (tắt, hiện lý do và đếm lùi; bật khi hết thời gian) |
| Biến thể quên mật khẩu | Bạn đã yêu cầu quá nhiều lần. Vì an toàn, hãy thử lại sau {mm:ss}. Cần vào gấp: nhờ quản lý chi nhánh cấp mã tạm. |
| Biến thể danh sách/tìm kiếm | "Đang tải quá nhiều lần liên tiếp. Tự thử lại sau {mm:ss}." (GET được tự thử lại có giãn cách; ghi xuất file không tự thử lại). |
| a11y | Chỉ đọc "thử lại sau" một lần khi xuất hiện và khi sắp hết, không đọc từng giây. |
| Lưu ý dev | Đếm lùi từ `Retry-After`; không hiện số lần giới hạn. Với đăng nhập/quên mật khẩu/xác thực mạnh, thông báo giống nhau cho mọi thông tin đầu vào (không lộ tài khoản có tồn tại). |

### 2.7 500 Lỗi hệ thống

| Thành phần | Toàn trang | Trong một khối | Khi lưu thất bại |
| --- | --- | --- | --- |
| Tiêu đề | Hệ thống đang gặp sự cố | Không tải được {tên khối} | Chưa lưu được |
| Thông báo | Đây không phải lỗi của bạn và dữ liệu đã lưu không bị ảnh hưởng. Thử lại sau ít phút. Nếu vẫn lỗi, báo quản lý kèm mã tham chiếu bên dưới. | Các khối khác vẫn dùng được. Thử tải lại khối này. | Dữ liệu bạn nhập vẫn còn trên màn hình. Thử lưu lại; hệ thống không tạo bản ghi trùng nếu bạn bấm nhiều lần. |
| Nút | **Thử lại**, **Về trang chủ** | **Thử lại** | **Thử lại**, **Lưu nháp trên thiết bị** |
| Mã tham chiếu | `REQ-…` + nút Sao chép | cùng | cùng |
| Khác | 502/504 dùng cùng câu; 504 thêm "Yêu cầu mất quá nhiều thời gian." | Không biến thành “Không có dữ liệu” | Với ghi rủi ro dùng `Idempotency-Key`: thử lại an toàn; nói rõ khi chưa rõ kết quả: "Chưa biết thao tác đã hoàn tất chưa. Kiểm tra danh sách trước khi làm lại." |

### 2.8 Offline (mất kết nối)

| Thành phần | Nội dung |
| --- | --- |
| Banner (toàn khung, `alert--banner`) | **Mất kết nối.** Bản nháp được lưu trên thiết bị (lúc 09:14). Chưa thể xuất kho, thu tiền, xuất hóa đơn. Đang thử kết nối lại… |
| Khi có lại mạng | Toast (`status`): "Đã kết nối lại" · "Bản nháp đã được đồng bộ lúc 09:21." Banner biến mất. Nếu đồng bộ gặp xung đột: mở 409 (2.4). |
| Nút cần mạng | `aria-disabled` + lý do `OFFLINE` ("Đang mất kết nối: thao tác này cần mạng."). |
| Dữ liệu đã tải | Vẫn xem được, ghi "Dữ liệu cập nhật lúc 09:15" (không giả làm mới). |
| Trang công khai (đăng nhập, khách duyệt báo giá) | "Chưa gửi được. Kiểm tra Wi-Fi hoặc 4G rồi bấm lại. Thông tin bạn nhập vẫn được giữ." |
| Thợ ở xưởng | Chính sách ghi giờ khi mất mạng của Phase 1 chưa chốt (BA-08, `ba-decisions`): hiện tại thiết kế chặn ghi giờ và hướng dẫn phiếu giấy ở G1-ERR-04; không đổi câu chữ khi chưa có quyết định. |
| Phạm vi cần ghi chú | Cho phép **chỉ cảnh báo và lưu nháp** theo CLAUDE.md (không phải offline đầy đủ). |
| Đổi phạm vi khi offline | Nút Áp dụng của ScopePicker tắt: "Đang mất kết nối: chưa đổi được phạm vi vì số liệu không tải được. Phạm vi hiện tại được giữ nguyên." |

### 2.9 Các trạng thái xác thực liên quan (đồng bộ với G5-AUT-01…05)

| Tình huống | Tiêu đề | Thông báo | Nút |
| --- | --- | --- | --- |
| Sai thông tin đăng nhập (401) | Không đăng nhập được | Email, mã nhân viên hoặc mật khẩu chưa đúng. Kiểm tra phím Caps Lock rồi nhập lại, hoặc chọn “Quên mật khẩu”. Nếu vẫn không vào được, liên hệ quản lý chi nhánh. | Đăng nhập · Quên mật khẩu |
| Khóa tạm sau nhiều lần sai | Tạm dừng đăng nhập trên thiết bị này | Đã có nhiều lần đăng nhập chưa thành công. Thử lại sau {mm:ss} hoặc dùng “Quên mật khẩu” để đặt mật khẩu mới. Quản lý chi nhánh cũng có thể mở khóa giúp bạn. (Giống nhau cho mọi thông tin đăng nhập, kể cả tên không tồn tại, vô hiệu hay bị khóa; lý do thật chỉ hiện cho quản lý/quản trị ở G4-SYS-03; BA `ba-answers-for-dev.md` §1.4.) | Quên mật khẩu |
| Quên mật khẩu đã gửi (trung tính) | Kiểm tra email của bạn | Nếu thông tin vừa nhập khớp một tài khoản, hướng dẫn đặt lại mật khẩu đã được gửi. Liên kết có hiệu lực trong thời gian ghi trong email và chỉ dùng một lần. | Gửi lại (sau đếm lùi) · Quay lại đăng nhập |
| Liên kết đặt lại hết hạn | Liên kết đã hết hạn | Liên kết đặt lại mật khẩu chỉ có hiệu lực trong thời gian ngắn. Hãy yêu cầu một liên kết mới; liên kết cũ không dùng được nữa. | Yêu cầu liên kết mới |
| Liên kết đã dùng | Liên kết này đã được dùng | Mỗi liên kết chỉ dùng một lần. Nếu bạn đã đặt mật khẩu mới, hãy đăng nhập. Nếu không phải bạn đã dùng, yêu cầu liên kết mới và báo quản lý chi nhánh. | Đăng nhập · Yêu cầu liên kết mới |
| Lời mời hết hạn | Lời mời đã hết hạn | Lời mời chỉ có hiệu lực trong thời gian giới hạn. Nhờ quản lý chi nhánh gửi lại lời mời mới, rồi mở liên kết trong email mới. | Về trang đăng nhập |
| Lời mời bị thu hồi (không quyền) | Lời mời không còn hiệu lực | Lời mời này đã bị thu hồi trước khi bạn kích hoạt. Liên hệ quản lý chi nhánh để được xác nhận lại. | Về trang đăng nhập |
| Xác thực mạnh sai | Mã hoặc PIN chưa đúng | Mã trong ứng dụng đổi mỗi 30 giây: đợi mã mới rồi nhập lại. Với PIN: nhập lại đúng 6 số. Bạn còn {n} lần thử (chỉ hiện nếu máy chủ trả về). | Xác nhận |
| Xác thực mạnh khóa | Đã nhập sai quá số lần cho phép | Để bảo vệ tài khoản, hãy thử lại sau {mm:ss}. Hết thời gian chờ vẫn không được: nhờ người có thẩm quyền đặt lại xác thực hai lớp. Họ sẽ xác minh danh tính và việc này được ghi nhật ký. | Quay lại đăng nhập |
| Xác thực mạnh chưa sẵn sàng | Chưa thể xác thực hai lớp | Bước xác thực này chưa sẵn sàng trên hệ thống nên chưa thể đăng nhập. Đây không phải lỗi của bạn. Báo quản trị hệ thống kèm mã tham chiếu. | Về trang đăng nhập |
| Chưa gán chi nhánh | Tài khoản chưa được gán chi nhánh nào | Bạn cần được gán ít nhất một chi nhánh và một vai trò mới xem được dữ liệu. Nhờ quản lý chi nhánh hoặc quản trị hệ thống gán giúp, rồi tải lại trang. | Gửi yêu cầu gán chi nhánh (`[Cần xác nhận]`) |

## 3. Mã lý do khóa nút (ReasonDisabled)

Máy chủ trả `can` và `reason.code` cùng bản ghi; UI tra câu chữ theo bảng này. Hiện thành chữ cạnh nút, không chỉ tooltip.

| `reason.code` | Câu chữ |
| --- | --- |
| `NO_PERMISSION` | Bạn chưa có quyền {hành động}. Liên hệ {người cấp quyền}. |
| `BRANCH_LOCKED` | Chi nhánh đã khóa: chỉ xem lịch sử, không tạo hay sửa chứng từ. |
| `BRANCH_CLOSING` | Chi nhánh đang ngừng nhận lệnh mới: không tạo được {đối tượng} mới; vẫn xử lý được các lệnh đang mở. |
| `SCOPE_MERGED` | Chọn một chi nhánh để {hành động}. Mỗi chứng từ gắn với đúng một chi nhánh. |
| `PERIOD_CLOSED` | Ngày {dd/MM/yyyy} đã khóa sổ. Cần kế toán trưởng mở lại ngày (có lý do). |
| `STATE_INVALID` | Trạng thái hiện tại ({trạng thái}) không cho phép {hành động}. |
| `SELF_APPROVAL` | Người lập yêu cầu không tự duyệt. Nhờ {vai trò duyệt}. |
| `STOCK_INSUFFICIENT` | Chỉ còn {khả dụng} khả dụng. Giảm số lượng hoặc xin chuyển kho. |
| `OFFLINE` | Đang mất kết nối: thao tác này cần mạng. |
| `REQUIRES_APPROVAL` | Cần được duyệt trước ({người duyệt}). |
| `PENDING_APPROVAL` | Đang chờ duyệt, chưa sửa được. |
| `ALREADY_DONE` | Việc này đã hoàn tất lúc {HH:mm dd/MM/yyyy}. |

## 4. Khối dữ liệu: trống, đang tải, một phần, cũ

| Trạng thái | Tiêu đề | Thông báo | Nút |
| --- | --- | --- | --- |
| Trống lần đầu | Chưa có {đối tượng} nào | {Câu hướng dẫn tạo}. Ví dụ: “Chưa có phiếu sửa chữa nào. Tạo phiếu mới để bắt đầu tiếp nhận xe.” | Tạo {đối tượng} (nếu có quyền; không có quyền: bỏ nút, giữ câu hướng dẫn) |
| Trống do lọc | Không có kết quả phù hợp | Không có {đối tượng} nào khớp bộ lọc hiện tại. Bỏ bớt bộ lọc hoặc đổi khoảng thời gian. | Xóa bộ lọc |
| Đang tải | (skeleton đúng hình, nhãn ẩn) “Đang tải {tên khối}” | Quá 10 giây: “Đang tải lâu hơn bình thường…” | Hủy (tùy) |
| Một phần | (alert trong khối) {Tên phần} chưa tải được | Các số khác vẫn đúng. Số trên thẻ này chưa gồm {phần thiếu}. | Thử lại |
| Dữ liệu cũ | (dòng nhỏ) Cập nhật lúc {HH:mm} | Dữ liệu có thể đã thay đổi. | Làm mới |
| Không quyền xem khối | Bạn chưa có quyền xem {khối} | Vai trò {tên vai trò} không xem được mục này. | (không) |

## 5. Gắn vào giao diện (cho dev)

- Thư viện chuỗi theo khóa ổn định (`errors.401.title`, `errors.409.body`…), không ghép câu từ nhiều mảnh; dùng ICU MessageFormat cho biến.
- `ErrorBoundary` + `error.tsx` của Next dùng mẫu 2.7; `not-found.tsx` dùng 2.3; `global-error` có mã tham chiếu.
- Trang ERR của prototype: `design/g1-auth-dashboard/g1-err-01…05.html` (403, 404, 5xx, offline/bảo trì, liên kết hết hạn) là hình thức chuẩn; câu chữ ở tài liệu này thắng nếu khác.
- Test: mỗi mã trong bảng §1 có một test e2e xem tiêu đề, nút và `role` (axe không báo lỗi).

## 6. Điểm cần BA/chủ dự án quyết (không tự quyết)

1. Có nút "Gửi yêu cầu cấp quyền" ở 403 và "Gửi yêu cầu gán chi nhánh" khi chưa gán không? (cần quy trình và người nhận).
2. Quy tắc gộp thay đổi khi 409 (mặc định không tự gộp).
3. Quy tắc số điện thoại (ví dụ số nước ngoài).
4. Thời gian rảnh/tuyệt đối của phiên theo vai trò (Q5) và số lần/thời gian khóa (Q6): UI chỉ hiển thị giá trị máy chủ trả về.
5. Chính sách ghi giờ của thợ khi mất mạng ở Phase 1 (BA-08).
