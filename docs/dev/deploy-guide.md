# Hướng dẫn deploy GMEP (dev / staging / prod)

> **Trạng thái:** chưa có GCP project thật, nên các bước dưới đây **chưa được chạy thử trên GCP**. Chúng được rút ra từ code (`Dockerfile`, `src/platform/config/env.ts`, `firebase.json`, `infra/firestore-ttl.md`) và từ tài liệu của Google. Lần deploy đầu tiên phải đi theo thứ tự này và ghi lại chỗ nào lệch.
> Chạy local (emulator): xem `README.md`. Tài liệu này chỉ nói về môi trường thật.

## 0. Kiến trúc triển khai

- **Một ứng dụng duy nhất**: Next.js (frontend + backend) đóng gói bằng `Dockerfile` (standalone, user không phải root, cổng 8080), chạy trên **Cloud Run**.
- Dữ liệu: **Firestore**, **Firebase Auth (Identity Platform)**, **Cloud Storage**, tất cả chỉ được gọi từ server bằng Admin SDK. Trình duyệt không bao giờ gọi Firebase; Security Rules từ chối mọi truy cập client.
- Vùng: `asia-southeast1` cho mọi thứ.
- Lập lịch: **Cloud Scheduler** gọi endpoint nội bộ `POST /api/v1/internal/cron/run-due`.
- Email: SMTP của nhà cung cấp bất kỳ (xem mục 5).

Ba môi trường nên tách **project riêng**: `gmep-dev`, `gmep-staging`, `gmep-prod`. `GMEP_ENV` nhận `dev | staging | prod`.

## 1. Chuẩn bị

Cần cài: `gcloud`, `firebase-tools` (đã có trong devDependencies, chạy bằng `pnpm exec firebase`), Docker, pnpm.

```bash
export PROJECT=gmep-prod          # đổi theo môi trường
export REGION=asia-southeast1
gcloud auth login
gcloud config set project $PROJECT
```

Bật API:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com firestore.googleapis.com \
  identitytoolkit.googleapis.com storage.googleapis.com cloudscheduler.googleapis.com
```

## 2. Dữ liệu: Firestore, Auth, Storage

1. **Firestore** (Native mode, đúng vùng, không đổi được sau khi tạo):
   ```bash
   gcloud firestore databases create --location=$REGION --type=firestore-native
   ```
2. **Identity Platform / Firebase Auth**: vào Firebase Console, thêm project vào Firebase, bật *Authentication* với provider **Email/Password**. Tạo **Web API key** (Project settings) và dùng làm `FIREBASE_API_KEY`. Key này server dùng để gọi Identity Toolkit, không đưa xuống trình duyệt. Nên giới hạn key theo API (Identity Toolkit).
3. **Cloud Storage**: dùng bucket mặc định hoặc tạo bucket **private** riêng (uniform bucket-level access, không public) và đặt `GMEP_FILES_BUCKET`.
   ```bash
   gcloud storage buckets create gs://$PROJECT-files --location=$REGION --uniform-bucket-level-access
   ```
4. **Rules và index** (chạy từ thư mục gốc repo):
   ```bash
   pnpm exec firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT
   ```
   - `pnpm check:indexes` phải xanh trước khi deploy (ngân sách 200 composite index; CI fail trên 195).
   - `firestore.indexes.json` đã khai báo TTL (`idempotencyKeys`, `rateLimits`, `notifications`, `emailOutbox`). Nếu TTL không được tạo, chạy các lệnh trong `infra/firestore-ttl.md`.
   - Index composite build mất vài phút; đợi trạng thái *READY* trước khi mở cho người dùng.
5. **Sao lưu**: bật PITR cho Firestore (`gcloud firestore databases update --enable-pitr`) và lập lịch export định kỳ. Số năm lưu trữ là mục `[Cần xác nhận]` (retention), hỏi khách trước khi cấu hình xóa.

## 3. Service account và Secret Manager

Tạo service account chạy Cloud Run, chỉ cấp quyền cần thiết:

```bash
gcloud iam service-accounts create gmep-run --display-name="GMEP Cloud Run"
SA=gmep-run@$PROJECT.iam.gserviceaccount.com
for r in roles/datastore.user roles/firebaseauth.admin roles/storage.objectAdmin \
         roles/secretmanager.secretAccessor roles/iam.serviceAccountTokenCreator; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$r
done
```

- `serviceAccountTokenCreator` (trên chính service account) cần để ký signed URL khi đọc file hóa đơn; nếu tách quyền chặt hơn, cấp ở mức service account thay vì mức project.
- Không tải key JSON. Cloud Run dùng Application Default Credentials.

Secret (không bao giờ đặt trong image, repo hay biến plain-text):

```bash
printf '%s' '<web api key>'                          | gcloud secrets create gmep-firebase-api-key --data-file=-
printf '%s' 'smtps://user:pass@smtp.example.vn:465'  | gcloud secrets create gmep-email-smtp-url --data-file=-
openssl rand -base64 48 | tr -d '\n'                 | gcloud secrets create gmep-cron-secret --data-file=-
```

(`CRON_SECRET` tối thiểu 32 ký tự. Có thể bỏ nó và dùng OIDC, xem mục 6.)

## 4. Build image và deploy Cloud Run

```bash
gcloud artifacts repositories create gmep --repository-format=docker --location=$REGION
IMAGE=$REGION-docker.pkg.dev/$PROJECT/gmep/gmep:$(git rev-parse --short HEAD)
gcloud builds submit --tag $IMAGE .          # hoặc: docker build -t $IMAGE . && docker push $IMAGE
```

Deploy (thay `APP_URL` bằng domain thật, xem mục 7; lần đầu có thể chạy trước để lấy URL `*.run.app` rồi deploy lại):

```bash
gcloud run deploy gmep --image $IMAGE --region $REGION \
  --service-account $SA --port 8080 \
  --allow-unauthenticated \
  --min-instances 1 --max-instances 10 --cpu 1 --memory 1Gi \
  --set-env-vars GMEP_ENV=prod,GMEP_DATA_BACKEND=firestore,GCLOUD_PROJECT=$PROJECT,TRUSTED_PROXY_HOPS=1,APP_BASE_URL=$APP_URL,APP_ORIGIN=$APP_URL,EMAIL_FROM='GMEP <no-reply@example.vn>',CRON_COMPANY_ID=<id công ty> \
  --set-secrets FIREBASE_API_KEY=gmep-firebase-api-key:latest,EMAIL_SMTP_URL=gmep-email-smtp-url:latest,CRON_SECRET=gmep-cron-secret:latest
```

Ghi chú:

- `--allow-unauthenticated` là bình thường: xác thực do chính ứng dụng làm (cookie `__Host-gmep_session`). Endpoint cron tự kiểm tra secret/OIDC.
- **Không đặt** `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`. `GMEP_DATA_BACKEND=memory` bị từ chối ngoài local.
- Ứng dụng từ chối khởi động ở `GMEP_ENV=prod` nếu thiếu `EMAIL_SMTP_URL` và `EMAIL_FROM` (đây là chủ ý, tránh để link kích hoạt nằm dạng plain text trong collection `emailOutbox`).
- `TRUSTED_PROXY_HOPS=1` vì chỉ có Google Front End phía trước. Nếu thêm Load Balancer/Cloudflare, tăng đúng số lớp, nếu không rate limit và lockout theo IP sẽ sai.
- Cookie phiên có tiền tố `__Host-` nên **bắt buộc HTTPS** và không đặt `Domain`; Cloud Run và domain tùy chỉnh đều thỏa.
- Các biến phiên và cache (`SESSION_TTL_HOURS`, `SESSION_IDLE_MINUTES`, `AUTH_CACHE_TTL_SECONDS`, `CONFIG_CACHE_TTL_SECONDS`, `IDEMPOTENCY_TTL_HOURS`) có mặc định; giá trị theo vai trò là mục `[Cần xác nhận]` D-05.
- `--min-instances 1` tránh cold start trong giờ làm việc (NFR: thao tác thường dưới 2 giây).

Kiểm tra sau deploy:

```bash
URL=$(gcloud run services describe gmep --region $REGION --format='value(status.url)')
curl -s $URL/api/health            # liveness
curl -s "$URL/api/health?ready=1"  # readiness: có đọc Firestore, kỳ vọng "ready": true
```

Cloud Run nên dùng `/api/health?ready=1` cho startup probe nếu muốn chặn traffic tới khi kết nối được data store.

## 5. Email (invitation, quên mật khẩu)

Adapter `SmtpEmailGateway` (`src/infrastructure/email/`) dùng SMTP thuần nên không phụ thuộc nhà cung cấp (Amazon SES, SendGrid, Mailgun, Google Workspace, hoặc máy chủ mail của khách).

| Biến             | Ý nghĩa                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `EMAIL_SMTP_URL` | `smtps://user:pass@host:465` (hoặc `smtp://host:587` có STARTTLS). **Là secret.** |
| `EMAIL_FROM`     | `GMEP <no-reply@domain>`                                                        |

Hành vi:

- Đặt cả hai hoặc không đặt biến nào. Không đặt và `GMEP_ENV` khác `prod`: dùng outbox dev (ghi vào collection `emailOutbox`, không gửi gì).
- Gửi lỗi thì adapter log (chỉ ghi tên template và domain người nhận, không ghi nội dung vì có link dùng một lần) rồi ném lỗi. Mời người dùng sẽ báo lỗi để quản trị viên mời lại. **Quên mật khẩu vẫn trả kết quả trung tính** (không lộ tài khoản có tồn tại), nên theo dõi log `email delivery failed` để biết mail không đi.
- `Message-ID` ổn định theo id thông điệp; gửi lại cùng một thông điệp mang cùng danh tính nhưng không bảo đảm chống trùng ở phía nhà cung cấp.

Việc cần làm ở phía DNS của domain gửi: **SPF, DKIM, DMARC** theo hướng dẫn của nhà cung cấp, nếu không email dễ vào thư rác.

Thử gửi một email thật trước khi mở cho người dùng: tạo một user thử và dùng chức năng mời, hoặc chạy "quên mật khẩu" cho tài khoản của bạn trên staging.

## 6. Cloud Scheduler (tác vụ định kỳ)

Endpoint `POST /api/v1/internal/cron/run-due` chạy các job tới hạn của RPT (báo cáo ngày) và EIN (hàng đợi hóa đơn lỗi). Không đặt `CRON_SECRET` và OIDC thì endpoint **tắt** (404).

**Cách A: shared secret** (đơn giản):

```bash
gcloud scheduler jobs create http gmep-run-due --location=$REGION \
  --schedule="*/15 * * * *" --time-zone="Asia/Ho_Chi_Minh" \
  --uri="$URL/api/v1/internal/cron/run-due" --http-method=POST \
  --headers="x-cron-secret=$(gcloud secrets versions access latest --secret=gmep-cron-secret)"
```

**Cách B: OIDC** (khuyến nghị, không phải lưu secret trong Scheduler): tạo service account `scheduler@...`, đặt `CRON_OIDC_AUDIENCE=$URL` và `CRON_OIDC_SERVICE_ACCOUNT=scheduler@$PROJECT.iam.gserviceaccount.com` (phải đặt cả hai), rồi tạo job với `--oidc-service-account-email` và `--oidc-token-audience=$URL`.

`CRON_COMPANY_ID` là công ty mà các chi nhánh được xử lý (hiện giả định một pháp nhân, `[Cần xác nhận]`).

## 7. Domain và HTTPS

1. Cloud Run domain mapping hoặc Load Balancer ánh xạ `app.example.vn` tới service. Chứng chỉ do Google quản lý.
2. Đặt `APP_BASE_URL` và `APP_ORIGIN` đúng domain (link trong email dùng `APP_BASE_URL`; kiểm tra Origin của các request ghi dùng `APP_ORIGIN`). Sai hai biến này: link email trỏ sai chỗ hoặc mọi thao tác ghi bị từ chối.
3. Sau khi có domain, deploy lại service với hai biến đã sửa.

## 8. Khởi tạo dữ liệu ban đầu — **chưa có công cụ**

`pnpm seed` chỉ dành cho emulator và từ chối chạy ở môi trường khác (đúng chủ ý, vì dữ liệu giả và mật khẩu demo). **Hiện chưa có script bootstrap** cho môi trường thật. Trước khi go-live cần có một script/lệnh quản trị chạy một lần, tạo:

1. Công ty, chi nhánh đầu tiên, kho.
2. 10 vai trò và ma trận quyền (dữ liệu nằm ở `src/modules/sys/domain/permissions.ts`).
3. Tài khoản chủ (CH) trong Firebase Auth và user tương ứng trong Firestore, rồi gửi lời mời kích hoạt (cần email adapter, đã có).
4. Cấu hình có hiệu lực theo ngày: thuế, đơn giá công, giờ chuẩn, giới hạn giảm giá, bảng giá, đánh số chứng từ, hóa đơn (`einvoice-issuer`). Giá trị thật do kế toán khách xác nhận.
5. Import dữ liệu từ Excel (slice 1.11) sau khi khách chốt mẫu.

Đây là việc còn thiếu lớn nhất để chạy được production; nên làm thành một task riêng.

## 9. Việc còn chặn go-live (ngoài hạ tầng)

- Nhà cung cấp **hóa đơn điện tử** chưa chọn: chỉ có `FakeProvider`; issuer ở chế độ `live` với `fake` bị coi là "chưa kích hoạt".
- **MFA** nằm ngoài phạm vi theo quyết định của chủ (chỉ có hook `StrongAuthPort`).
- Các mục `[Cần xác nhận]` trong `docs/dev/open-questions-for-ba.md` (thời hạn lưu trữ, hạn mức phê duyệt, phương pháp giá vốn, v.v.).
- Cần review bảo mật theo `docs/dev/security-checklist-status.md` trước khi mở cho người dùng thật.

## 10. Danh sách kiểm tra trước mỗi lần deploy

- [ ] CI xanh trên commit sẽ deploy (`pnpm run ci`; `pnpm audit:prod` ngoài CI).
- [ ] `pnpm check:indexes` xanh; index mới đã deploy và ở trạng thái READY.
- [ ] Image build bằng `Dockerfile` (không đặt secret trong image).
- [ ] Biến môi trường: không có `*_EMULATOR_HOST`; `GMEP_ENV` đúng; `APP_BASE_URL` và `APP_ORIGIN` đúng.
- [ ] Deploy lên staging trước, kiểm tra `/api/health?ready=1`, đăng nhập, mời user (email tới hộp thư thật).
- [ ] Triển khai prod; có sẵn cách rollback: `gcloud run services update-traffic gmep --to-revisions=<revision cũ>=100`.
