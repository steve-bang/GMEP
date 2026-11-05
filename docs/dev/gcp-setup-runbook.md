# Runbook dựng GCP/Firebase và deploy staging

> **Trạng thái:** viết khi chưa có GCP project và chưa có quyền truy cập cloud, nên **chưa có bước nào được chạy thử trên GCP**. Script đã chạy ở chế độ `DRY_RUN=1` (chỉ in lệnh) và kiểm cú pháp; cờ lệnh `gcloud` lấy từ tài liệu Google. Lần chạy đầu tiên phải ghi lại chỗ nào lệch rồi sửa script/runbook.
> Chạy local bằng emulator: xem `README.md`.

## 0. Phạm vi và quan hệ với `deploy-guide.md`

- `docs/dev/deploy-guide.md` (nằm trên nhánh `feat/email-smtp-adapter-deploy-guide`, sẽ merge riêng) mô tả **kiến trúc triển khai và từng lệnh deploy thủ công** (Cloud Run, SMTP, Scheduler, domain, việc còn chặn go-live). **Runbook này không lặp lại** mà bổ sung phần nó chưa có: tạo project và billing, quyền tối thiểu cho từng danh tính, Workload Identity Federation, script idempotent, workflow GitHub Actions, giám sát, ngân sách, sao lưu, smoke test, và danh sách việc của chủ dự án.
- Tên tài nguyên **trùng với deploy-guide** để hai tài liệu không mâu thuẫn: service `gmep`, repository Artifact Registry `gmep`, service account `gmep-run` và `scheduler`, secret `gmep-firebase-api-key`, `gmep-email-smtp-url`, `gmep-cron-secret`, job `gmep-run-due`, vùng `asia-southeast1`.
- Khác biệt có chủ ý (đều chặt hơn, không trái): (1) `storage.objectAdmin` chỉ cấp trên bucket file, không cấp toàn project; (2) `serviceAccountTokenCreator` **không** cấp mặc định vì URL ký chưa được xây (cấp khi tính năng đó có, `GRANT_URL_SIGNING=true`); (3) quyền đọc secret cấp theo từng secret; (4) Scheduler dùng OIDC (cách B của deploy-guide), `CRON_SECRET` mặc định không dùng; (5) bucket file là bucket riêng `<PROJECT_ID>-files` nên `GMEP_FILES_BUCKET` được đặt rõ ràng.
- **Biến môi trường trên `master` khác nhánh SMTP:** nhánh `feat/email-smtp-adapter-deploy-guide` thêm `EMAIL_SMTP_URL` (secret) và `EMAIL_FROM`, và ở `GMEP_ENV=prod` bắt buộc cả hai. `master` (`src/platform/config/env.ts`) chưa có hai biến này; thiết lập chúng sớm vô hại vì schema bỏ qua biến lạ. Sau khi nhánh đó merge, bảng ở mục 6 vẫn đúng.
- Việc **khởi tạo dữ liệu ban đầu** (công ty, chi nhánh, vai trò, tài khoản chủ, cấu hình thuế/giá) chưa có công cụ: xem deploy-guide §8. Staging chưa dùng được đầy đủ nếu chưa làm; đây là việc riêng, `CRON_COMPANY_ID` cần id công ty tạo ở đó.

## 1. Chuẩn bị và vai trò

Công cụ: `gcloud` (đăng nhập bằng tài khoản Google của người thực hiện), Docker, pnpm, Node 22. Các script nằm ở `infra/gcp/` và đều:

- mặc định **`DRY_RUN=1`** (chỉ in lệnh, không gọi gcloud nào, kể cả kiểm tra tồn tại); áp dụng bằng `DRY_RUN=0`;
- idempotent (kiểm tra trước khi tạo; gán IAM lặp lại an toàn);
- đọc cấu hình từ biến môi trường hoặc tệp `INFRA_ENV_FILE`.

Vì sao `gcloud` thay vì Terraform: ADR 0001 §7 (CI/CD và môi trường) nói "Terraform cỡ nhỏ" cho hạ tầng, nhưng máy build không có terraform để kiểm HCL, còn script có thể xem và kiểm dry-run ngay, dễ chạy trong Cloud Shell cho người không chuyên và đã đủ cho 1 đến 3 môi trường. Có thể chuyển sang Terraform sau mà không đổi tên tài nguyên (cần `terraform import`). `[Cần xác nhận]` với chủ dự án/dev nếu bắt buộc Terraform.

```bash
cp infra/gcp/staging.env.example infra/gcp/staging.env   # tệp *.env bị gitignore, chỉ điền placeholder đã thay bằng giá trị thật
export INFRA_ENV_FILE=infra/gcp/staging.env
DRY_RUN=1 infra/gcp/00-bootstrap.sh                        # xem trước
```

| Người   | Làm gì                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| Chủ     | Billing account, tạo project (hoặc cấp quyền tạo), chạy hoặc ủy quyền mục 2 đến 5, 12     |
| Dev     | Mục 6 (tạo API key, nạp secret nếu được giao), 7 đến 9, 11, smoke test (mục 14)           |
| Cả hai  | Quyết định `[Cần xác nhận]`: vùng và pháp lý (BA-11), thời hạn lưu trữ, tên miền, mail    |

## 2. Tạo project và billing (chủ)

Mỗi môi trường một project riêng (`<PROJECT_ID>` cho staging; prod là project khác). Đặt `PROJECT_ID` có tiền tố rõ nghĩa, ví dụ `gmep-staging-xxxx`.

Cách 1 (qua console): Console > chọn organization/folder > New project, gắn billing account. Cách 2 (script, cần quyền `roles/resourcemanager.projectCreator` và `roles/billing.user`):

```bash
# trong staging.env: CREATE_PROJECT=1, PARENT_FLAG=--organization=<ORG_ID>, BILLING_ACCOUNT_ID=<...>
DRY_RUN=0 infra/gcp/00-bootstrap.sh
```

Kiểm tra org policy trước (Console > IAM & Admin > Organization Policies), vì hai chính sách thường làm hỏng bước sau:

- `iam.allowedPolicyMemberDomains` (Domain restricted sharing) chặn `allUsers` trên Cloud Run, làm `--allow-unauthenticated` thất bại. Nếu bật, cần miễn trừ cho project này, hoặc đặt Load Balancer/IAP phía trước (đổi thiết kế, hỏi dev).
- `gcp.resourceLocations` phải cho phép `asia-southeast1`.

## 3. Bật API, Firestore, Artifact Registry, bucket (script 00)

`00-bootstrap.sh` thực hiện, theo thứ tự: gắn billing; bật API (`run`, `artifactregistry`, `secretmanager`, `firestore`, `firebase`, `firebaserules`, `identitytoolkit`, `storage`, `cloudscheduler`, `iamcredentials`, `sts`, `monitoring`, `logging`, `billingbudgets`, `apikeys`, ...); tạo repository Docker `gmep`; tạo **Firestore Native `(default)` ở `asia-southeast1`**; bật PITR nếu `ENABLE_PITR=true`; lịch backup hằng ngày; bucket **riêng tư** `<PROJECT_ID>-files` (uniform access, chặn public).

```bash
DRY_RUN=0 infra/gcp/00-bootstrap.sh
```

Lưu ý:

- **Vùng Firestore không đổi được sau khi tạo.** ADR 0001 ghi vùng là `[Cần xác nhận]` chờ luật sư (BA-11). Staging dùng thử không sao; **prod phải có xác nhận trước.**
- Prod đặt `ENABLE_PITR=true`, `DELETE_PROTECTION=true`. Thời hạn giữ backup (`BACKUP_RETENTION`) là `[Cần xác nhận]` theo thời hạn lưu trữ; mặc định 7 ngày.
- Bucket mặc định `<project>.appspot.com`/`.firebasestorage.app` của Firebase **không** được dùng: code dùng `GMEP_FILES_BUCKET`, nên đặt biến này (script 30 đã đặt).

## 4. Firebase và Authentication (làm tay, một lần)

Script không làm được bước này vì cần bấm trên console.

1. Firebase Console > Add project > chọn **project GCP đã có** (không tạo project mới) > tắt Google Analytics. (Hoặc `pnpm exec firebase projects:addfirebase <PROJECT_ID>`.)
2. Authentication > Get started (nâng lên Identity Platform nếu được hỏi) > bật provider **Email/Password**. Không cần các provider khác.
3. Authentication > Settings > User actions: **tắt "Enable create (sign up)"**. Người dùng chỉ do server tạo bằng Admin SDK (mời người dùng), không có đăng ký công khai; Admin SDK không bị ảnh hưởng bởi cờ này. Chạy thử đăng nhập ở smoke test để xác nhận.
4. Tạo **Web API key chỉ dùng cho server** và giới hạn theo API:
   ```bash
   gcloud services api-keys create --project=<PROJECT_ID> --display-name="gmep-server-identity-toolkit" \
     --api-target=service=identitytoolkit.googleapis.com
   gcloud services api-keys list --project=<PROJECT_ID> --format='value(name,displayName)'
   gcloud services api-keys get-key-string <KEY_NAME_hoặc_UID> --project=<PROJECT_ID>   # in giá trị, KHÔNG dán vào chat, ticket hay repo
   ```
   Có thể dùng key "Browser key" Firebase tự tạo, nhưng nên giới hạn API. Không đặt giới hạn theo "HTTP referrer" vì request đi từ server Cloud Run (không có referrer); giới hạn theo API là đủ. Key này là giá trị của secret `gmep-firebase-api-key` (mục 6).
5. Trình duyệt không bao giờ gọi Firebase, nên **không cần** thêm authorized domain và **không** lấy cấu hình web của Firebase.

## 5. Danh tính và IAM tối thiểu, Workload Identity Federation (script 10)

Cần `GITHUB_REPOSITORY=<OWNER>/<REPO>` trong env. Người chạy cần `roles/resourcemanager.projectIamAdmin`, `roles/iam.serviceAccountAdmin`, `roles/iam.workloadIdentityPoolAdmin` (chủ có sẵn qua Owner).

```bash
DRY_RUN=0 infra/gcp/10-iam.sh
```

| Danh tính                                        | Dùng cho                                | Quyền (đúng những gì script cấp)                                                                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gmep-run@<PROJECT_ID>.iam.gserviceaccount.com`  | Chạy Cloud Run (Admin SDK)              | `roles/datastore.user` (project), `roles/firebaseauth.admin` (project), `roles/storage.objectAdmin` (chỉ bucket file), `roles/secretmanager.secretAccessor` (từng secret, script 20). Không có key JSON; dùng Application Default Credentials.        |
| `scheduler@<PROJECT_ID>.iam.gserviceaccount.com` | Cloud Scheduler tạo OIDC token          | Không cần quyền nào trên project: Cloud Run công khai, ứng dụng tự kiểm tra token. Nếu sau này khóa service bằng IAM thì cấp `roles/run.invoker` trên service.                                                                                          |
| `gmep-deployer@<PROJECT_ID>.iam.gserviceaccount.com` | GitHub Actions (qua WIF)            | `roles/run.admin`, `roles/datastore.indexAdmin`, `roles/firebaserules.admin`, `roles/firebase.viewer`, `roles/serviceusage.serviceUsageConsumer`, `roles/browser`, `roles/artifactregistry.writer` (chỉ repo `gmep`), `roles/iam.serviceAccountUser` (chỉ trên `gmep-run`). Không đọc được secret hay dữ liệu. |

WIF: pool `github`, provider `github-oidc`, điều kiện thuộc tính `assertion.repository=='<OWNER>/<REPO>'`: chỉ repo này mượn được `gmep-deployer`. Script in ra hai giá trị cần đặt làm **biến** repo GitHub (mục 11). Muốn chặt hơn nữa (chỉ nhánh `master`), thêm `&& assertion.ref=='refs/heads/master'` vào điều kiện provider và chỉ chạy workflow từ `master`.

## 6. Secret Manager (script 20) và bảng biến môi trường

```bash
DRY_RUN=0 infra/gcp/20-secrets.sh        # tạo secret RỖNG + cấp quyền đọc cho gmep-run
```

Nạp giá trị (không bao giờ nằm trong repo, image, lịch sử lệnh dùng chung hay chat):

```bash
read -rs -p "API key: " V; printf '%s' "$V" | gcloud secrets versions add gmep-firebase-api-key --data-file=- --project=<PROJECT_ID>; unset V
read -rs -p "SMTP url: " V; printf '%s' "$V" | gcloud secrets versions add gmep-email-smtp-url --data-file=- --project=<PROJECT_ID>; unset V
```

Bảng đầy đủ theo `src/platform/config/env.ts` (master) và nhánh SMTP. Cột "Nơi đặt": **Secret** = Secret Manager gắn vào Cloud Run; **Env** = biến thường do `infra/gcp/30-deploy-service.sh` đặt.

| Biến                                           | Nơi đặt          | Ai cung cấp                       | Dùng ở đâu / ghi chú                                                                                                                                       |
| ---------------------------------------------- | ---------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GMEP_ENV`                                     | Env              | Script (`ENV_NAME`)               | `staging` hoặc `prod`. `local` bị từ chối nếu thiếu emulator. Không dùng `local` trên cloud.                                                                |
| `GMEP_DATA_BACKEND`                            | Env              | Script                            | `firestore`. `memory` bị từ chối ngoài local.                                                                                                              |
| `GCLOUD_PROJECT`                               | Env              | Script (`PROJECT_ID`)             | Admin SDK và Identity Toolkit. **Mặc định là `demo-gmep`**, nên thiếu biến này service chạy nhưng sai project.                                              |
| `FIREBASE_API_KEY`                             | **Secret** `gmep-firebase-api-key` | Dev tạo key (mục 4), nạp giá trị | Đăng nhập qua Identity Toolkit (`firebaseIdentity.ts`). **Mặc định là `demo-api-key`**: thiếu thì đăng nhập thất bại lặng lẽ.                                |
| `GMEP_FILES_BUCKET`                            | Env              | Script (`<PROJECT_ID>-files`)     | Bucket riêng tư cho XML/PDF hóa đơn (`firebaseFileStore.ts`). Mặc định `<project>.appspot.com` không dùng.                                                  |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` | **Không đặt** | Không ai | Chỉ cho local. Đặt trên cloud sẽ trỏ ứng dụng vào emulator không tồn tại.                                                                                  |
| `APP_BASE_URL`                                 | Env              | Dev (từ tên miền, mục 10)         | Gốc của link trong email. Phải `https://`.                                                                                                                  |
| `APP_ORIGIN`                                   | Env              | Script (= `APP_BASE_URL`)         | Origin cho phép ngoài chính Origin của request (kiểm tra Origin khi ghi). Sai thì mọi thao tác ghi bị từ chối.                                              |
| `TRUSTED_PROXY_HOPS`                           | Env              | Script (`1`)                      | Cloud Run + Google Front End = 1. Thêm Load Balancer/Cloudflare thì tăng đúng số lớp, nếu không rate limit/lockout theo IP sai.                              |
| `CRON_OIDC_AUDIENCE`                           | Env              | Script (URL `run.app` của service)| Phải đặt **cùng** `CRON_OIDC_SERVICE_ACCOUNT`, nếu không app không khởi động (`env.ts`). Bằng đúng `--oidc-token-audience` của Scheduler.                   |
| `CRON_OIDC_SERVICE_ACCOUNT`                    | Env              | Script (`scheduler@...`)          | Email mà token OIDC phải mang (`cronAuth.ts` kiểm `email` và `email_verified`).                                                                             |
| `CRON_COMPANY_ID`                                | Env              | Dev (id công ty sau khi bootstrap dữ liệu) | Công ty mà cron xử lý các chi nhánh. Một pháp nhân `[Cần xác nhận]`.                                                                         |
| `CRON_SECRET`                                  | Secret `gmep-cron-secret` (tùy chọn, bật bằng `CRON_SHARED_SECRET=true` ở cả `20-secrets.sh` và `30-deploy-service.sh`) | Dev sinh `openssl rand -base64 48` | Chỉ nếu muốn thêm kiểu shared secret (`CREATE_CRON_SECRET=true`, `CRON_SHARED_SECRET=true`). Mặc định bỏ, dùng OIDC. Tối thiểu 32 ký tự.                    |
| `EMAIL_SMTP_URL` (nhánh SMTP)                  | **Secret** `gmep-email-smtp-url` | Chủ/nhà cung cấp mail             | `smtps://user:pass@host:465`. Chỉ gắn khi đặt `EMAIL_FROM`. Bắt buộc ở prod sau khi nhánh SMTP merge.                                                       |
| `EMAIL_FROM` (nhánh SMTP)                      | Env              | Chủ                               | `GMEP <no-reply@domain>`. Đặt biến `STAGING_EMAIL_FROM` ở GitHub để workflow gắn cả hai. Chưa đặt: dùng outbox dev (staging) trong Firestore, **link nằm trong `emailOutbox`**. |
| `SESSION_TTL_HOURS` (12), `SESSION_IDLE_MINUTES` (30) | Env, mặc định | Chủ/BA `[Cần xác nhận]` D-05 | Thời hạn phiên. Chỉ đặt khi khác mặc định.                                                                                                                 |
| `IDEMPOTENCY_TTL_HOURS` (24)                   | Env, mặc định    | -                                 | Đi cùng chính sách TTL của `idempotencyKeys.expiresAt` (mục 7).                                                                                              |
| `AUTH_CACHE_TTL_SECONDS` (30), `CONFIG_CACHE_TTL_SECONDS` (60) | Env, mặc định | -                       | Độ trễ tối đa khi thu hồi phiên/cấu hình trên các instance khác.                                                                                            |
| `LOG_LEVEL`                                    | Env, mặc định    | -                                 | `info`; tăng `debug` tạm thời khi điều tra, không để lâu.                                                                                                  |
| `NODE_ENV`                                     | Image            | `Dockerfile`                      | `production`, không đặt tay.                                                                                                                                |

Thêm biến thường: sửa `infra/gcp/30-deploy-service.sh` (đó là nguồn duy nhất của định nghĩa service), không `gcloud run services update` tay (lần deploy sau sẽ ghi đè).

## 7. Firestore rules, index, TTL

Lần đầu làm tay (sau đó workflow làm, mục 11). Người chạy cần `roles/datastore.indexAdmin` + `roles/firebaserules.admin` (hoặc dùng `gmep-deployer` qua WIF).

```bash
pnpm install --frozen-lockfile
pnpm check:indexes            # phải xanh (ngân sách 200, fail trên 195)
pnpm exec firebase login      # tài khoản Google của dev
pnpm exec firebase deploy --only firestore:rules,firestore:indexes --project <PROJECT_ID>
gcloud firestore indexes composite list --project=<PROJECT_ID> --format='table(name.basename(),state)'   # đợi tất cả READY
gcloud firestore fields ttls list --project=<PROJECT_ID>     # idempotencyKeys, rateLimits, notifications, emailOutbox: ACTIVE
```

- `firestore.indexes.json` đã khai báo TTL trong `fieldOverrides`; nếu `ttls list` thiếu mục nào, chạy các lệnh trong `infra/firestore-ttl.md`.
- **Storage rules:** `storage.rules` chỉ áp dụng cho bucket được Firebase quản lý (bucket mặc định). Vì file nằm ở `<PROJECT_ID>-files` (không phải bucket Firebase, uniform access, không public, chỉ `gmep-run` ghi), rules là lớp phòng thủ thứ hai, không bắt buộc. Nếu muốn dùng: Firebase Console > Storage > Get started (tạo bucket mặc định `asia-southeast1`) rồi thêm `storage` vào `--only`. Workflow có ô `deploy_storage_rules` (mặc định tắt). Điểm này khác deploy-guide §2 (luôn deploy `storage`): ở đây tắt mặc định để không lỗi khi chưa có bucket Firebase.
- Index composite build vài phút; đợi READY trước khi cho người dùng vào.

## 8. Build image và deploy Cloud Run lần đầu (script 30)

Dockerfile đã khớp `next build` (multi-stage, `NEXT_OUTPUT=standalone`, cổng 8080, user không phải root, không có secret trong image; `.dockerignore` loại `.env*`, `docs`, `tests`). Không cần sửa.

```bash
REGION=asia-southeast1; PROJECT_ID=<PROJECT_ID>
gcloud auth configure-docker $REGION-docker.pkg.dev
export IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/gmep/gmep:$(git rev-parse --short HEAD)
DOCKER_BUILDKIT=1 docker build -t $IMAGE . && docker push $IMAGE       # hoặc: gcloud builds submit --tag $IMAGE .
# URL run.app của service là xác định trước: https://gmep-<PROJECT_NUMBER>.asia-southeast1.run.app
export APP_BASE_URL=https://gmep-<PROJECT_NUMBER>.asia-southeast1.run.app   # đổi sang tên miền thật ở mục 10
export CRON_COMPANY_ID=<id công ty>
DRY_RUN=0 infra/gcp/30-deploy-service.sh
```

Script từ chối chạy nếu secret `gmep-firebase-api-key` chưa có phiên bản hoặc `APP_BASE_URL` không phải `https://`. Cloud Run: `min-instances` mặc định 0 cho staging (đặt `MIN_INSTANCES=1` ở prod theo ADR để tránh khởi động lạnh trong giờ làm việc), `--allow-unauthenticated` là chủ ý (ứng dụng tự xác thực bằng cookie; route cron tự kiểm OIDC). Rollback: `gcloud run services update-traffic gmep --region=asia-southeast1 --to-revisions=<revision cũ>=100`.

## 9. Cloud Scheduler (script 40)

Người chạy cần `roles/cloudscheduler.admin` và `roles/iam.serviceAccountUser` trên `scheduler@...`.

```bash
DRY_RUN=0 infra/gcp/40-scheduler.sh      # job gmep-run-due, */15 * * * *, Asia/Ho_Chi_Minh
gcloud scheduler jobs run gmep-run-due --location=asia-southeast1 --project=<PROJECT_ID>
gcloud logging read 'resource.type="cloud_run_revision" AND httpRequest.requestUrl:"/internal/cron/run-due"' \
  --project=<PROJECT_ID> --limit=5 --format='table(timestamp,httpRequest.status)'     # kỳ vọng 200
```

Khớp với `src/platform/auth/cronAuth.ts`: `aud` = `CRON_OIDC_AUDIENCE` (URL `run.app` của service, cùng giá trị trong `--oidc-token-audience`), `email` = `CRON_OIDC_SERVICE_ACCOUNT` = `scheduler@...`, `email_verified` = true, chữ ký Google RS256. 401 nghĩa là sai audience hoặc service account (không nói rõ lý do, chủ ý); 404 nghĩa là cả hai biến OIDC và `CRON_SECRET` đều chưa đặt. Nếu bạn gọi bằng tên miền riêng thì audience vẫn là URL `run.app` vì Scheduler gọi thẳng URL đó trong script này.

## 10. Tên miền và HTTPS (`__Host-` cookie)

Cookie phiên là `__Host-gmep_session`: **chỉ chạy qua HTTPS**, `Secure`, `Path=/`, không có `Domain`. Hệ quả:

- Truy cập staging chỉ qua `https://` (URL `run.app` hợp lệ). Không thể kiểm thử đăng nhập qua `http://` hay `localhost` bằng service cloud.
- Một tên miền ứng dụng = một cookie; không chia sẻ cookie giữa subdomain (chủ ý).
- Dùng tên miền riêng: tạo Cloud Run domain mapping hoặc Load Balancer, chứng chỉ do Google quản lý, trỏ DNS theo bản ghi Google cung cấp (chủ sở hữu domain làm):
  ```bash
  gcloud beta run domain-mappings create --service=gmep --domain=<staging.example.vn> --region=asia-southeast1 --project=<PROJECT_ID>
  gcloud beta run domain-mappings describe --domain=<staging.example.vn> --region=asia-southeast1 --project=<PROJECT_ID>   # bản ghi DNS cần tạo
  ```
  Domain mapping của Cloud Run ở một số vùng còn hạn chế; nếu `asia-southeast1` không hỗ trợ hoặc cần độ ổn định, dùng Load Balancer HTTPS (có chi phí cố định, ADR 0001 §7). `[Cần xác nhận]` khi chọn.
- Sau khi có domain: đặt biến GitHub `STAGING_APP_BASE_URL=https://<domain>` và chạy lại workflow (hoặc script 30). **`APP_BASE_URL` sai thì link email sai; `APP_ORIGIN` sai thì mọi thao tác ghi bị từ chối (403).**

## 11. Deploy bằng GitHub Actions (`.github/workflows/deploy-staging.yml`)

Chỉ chạy tay (`workflow_dispatch`): Actions > deploy-staging > Run workflow, chọn nhánh/commit cần deploy. Không chạy khi push hay PR, và không đụng `ci.yml`. Job `preflight` kiểm biến; thiếu bất kỳ biến nào thì fail với thông báo rõ và **không build, không deploy**.

Biến repository (Settings > Secrets and variables > Actions > **Variables**). Không cần secret nào vì dùng WIF:

| Biến                                                                 | Giá trị                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                                                     | `<PROJECT_ID>` của staging                                                          |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`                                     | in ra bởi `10-iam.sh`: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github-oidc` |
| `GCP_DEPLOYER_SERVICE_ACCOUNT`                                       | `gmep-deployer@<PROJECT_ID>.iam.gserviceaccount.com`                                |
| `STAGING_APP_BASE_URL`                                               | `https://...` (run.app hoặc tên miền)                                               |
| `STAGING_CRON_COMPANY_ID`                                            | id công ty                                                                          |
| `GCP_REGION` (tùy chọn)                                              | mặc định `asia-southeast1`                                                          |
| `STAGING_EMAIL_FROM`, `STAGING_MIN_INSTANCES`, `STAGING_MAX_INSTANCES` (tùy chọn) | xem mục 6, 8                                                           |

Dùng biến cấp **repository** (không cấp environment) vì job `preflight` không gắn environment. Job `deploy` chạy trong GitHub Environment `staging`: nên tạo environment này và bật **Required reviewers** để có bước duyệt trước khi deploy.

Thứ tự trong workflow: build image (tag = commit SHA) và push > `pnpm check:indexes` > deploy Firestore rules/index > deploy Cloud Run bằng `infra/gcp/30-deploy-service.sh` > smoke test `/api/health?ready=1`. Workflow không tạo hạ tầng (mục 3, 5, 6, 9 làm trước) và không đụng secret.

## 12. Ngân sách, log, giám sát, sao lưu

**Ngân sách** (chủ chạy, cần `roles/billing.costsManager`): đặt `BILLING_ACCOUNT_ID`, `BUDGET_USD` rồi `DRY_RUN=0 infra/gcp/50-budget.sh` (cảnh báo ở 50%, 90%, 100%; email gửi tới quản trị billing). Ước tính chi phí và nguy cơ chi phí đọc Firestore tăng nhanh: ADR 0001 §7 (ước tính chi phí) và §8 (R-07).

**Log:** Cloud Run đã gửi stdout JSON (pino) vào Cloud Logging, mỗi dòng có correlation id. Truy vấn thường dùng (Logs Explorer):

```
resource.type="cloud_run_revision" resource.labels.service_name="gmep" severity>=ERROR
resource.type="cloud_run_revision" textPayload:"email delivery failed" OR jsonPayload.msg:"email delivery failed"
```

Tạo log-based alert cho `severity>=ERROR` (Logging > Log-based alerts, ngưỡng ví dụ 5 lỗi trong 5 phút, kênh email của dev/chủ). Đặt thời hạn lưu log (`_Default` bucket 30 ngày mặc định) khi có `[Cần xác nhận]` về lưu trữ; nhật ký nghiệp vụ nằm ở Firestore (`auditLogs`, `accessLogs`), không phụ thuộc Cloud Logging.

**Uptime check** (Console > Monitoring > Uptime checks > Create): giao thức HTTPS, host = tên miền hoặc host `run.app`, path `/api/health` (liveness), mỗi 1 phút, từ vùng châu Á; response phải chứa `"status":"ok"`. Tạo alert policy gửi email khi fail từ 2 vùng liên tiếp. Dùng `?ready=1` chỉ cho check thưa (5 phút) vì mỗi lần đọc Firestore. Mục tiêu NFR: 99,5% giờ làm việc.

**Sao lưu Firestore:** script 00 tạo lịch backup hằng ngày (giữ `BACKUP_RETENTION`); prod bật PITR. Khôi phục luôn vào database mới, rồi đối chiếu, tránh ghi đè `(default)`:

```bash
gcloud firestore backups list --project=<PROJECT_ID> --location=asia-southeast1
gcloud firestore databases restore --source-backup=<BACKUP_RESOURCE> --destination-database=restore-<YYYYMMDD> --project=<PROJECT_ID>
```

Diễn tập khôi phục ít nhất một lần trước go-live (ghi lại thời gian). Bucket file chưa bật versioning: cân nhắc `gcloud storage buckets update gs://<PROJECT_ID>-files --versioning` ở prod (hóa đơn XML/PDF là chứng từ), `[Cần xác nhận]` thời hạn lưu trữ.

## 13. Việc còn chặn dùng thật (ngoài hạ tầng)

Giống deploy-guide §8 và §9: chưa có script bootstrap dữ liệu (công ty, chi nhánh, vai trò, tài khoản chủ, cấu hình thuế/giá); chưa chọn nhà cung cấp hóa đơn điện tử (chỉ có `FakeProvider`); MFA ngoài phạm vi theo chủ; các mục `[Cần xác nhận]` ở `docs/dev/open-questions-for-ba.md`; rà soát bảo mật `docs/dev/security-checklist-status.md`. Ngoài ra trên `master`, thiếu `FIREBASE_API_KEY` hoặc `GCLOUD_PROJECT` ở `staging`/`prod` **không làm app dừng khởi động** (rơi về `demo-api-key`/`demo-gmep`); script 30 luôn đặt cả hai nhưng nên bổ sung kiểm tra fail-fast trong `env.ts` (đề xuất cho dev).

## 14. Smoke test sau lần deploy đầu

Thay `$URL` bằng URL service. Đánh dấu từng mục.

- [ ] `curl -s $URL/api/health` trả `"status":"ok"`; `curl -s "$URL/api/health?ready=1"` trả `"ready":true`, `backend` là `firestore`.
- [ ] `curl -sI $URL/` có `strict-transport-security`, `x-frame-options: DENY`, `content-security-policy` (nonce); không có `x-powered-by`.
- [ ] Mở `$URL` bằng trình duyệt qua HTTPS: trang đăng nhập hiển thị tiếng Việt, không lỗi console, không request nào tới `firebase`/`googleapis` từ trình duyệt (tab Network).
- [ ] Đăng nhập tài khoản chủ (sau bootstrap dữ liệu): cookie `__Host-gmep_session` có `Secure`, `HttpOnly`, `Path=/`, không `Domain`.
- [ ] Ghi sai Origin bị chặn: `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://evil.example' $URL/api/v1/...` trả 403.
- [ ] Cron: `curl -s -o /dev/null -w '%{http_code}' -X POST $URL/api/v1/internal/cron/run-due` (không token) trả 401; `gcloud scheduler jobs run gmep-run-due ...` rồi log cho 200.
- [ ] Không có biến emulator: `gcloud run services describe gmep --region=asia-southeast1 --format='yaml(spec.template.spec.containers[0].env)' | grep -i emulator` không ra gì.
- [ ] Revision chạy bằng `gmep-run` (không phải default compute SA): `gcloud run services describe gmep ... --format='value(spec.template.spec.serviceAccountName)'`.
- [ ] Phạm vi chi nhánh: người dùng chi nhánh A không thấy dữ liệu chi nhánh B (NFR-ISO-01) trên danh sách và tìm kiếm.
- [ ] Mỗi thay đổi tạo một dòng `auditLogs` (FR-SYS-003); thử Idempotency-Key gửi lặp không tạo bản ghi trùng.
- [ ] Hóa đơn thử (FakeProvider): file XML/PDF xuất hiện ở `gs://<PROJECT_ID>-files`, và bucket không truy cập công khai (`gcloud storage buckets describe gs://<PROJECT_ID>-files --format='value(iamConfiguration.publicAccessPrevention)'` là `enforced`).
- [ ] Mời một người dùng thử: email tới hộp thư (nếu đã có SMTP), hoặc link nằm ở `emailOutbox` (outbox dev) và đăng nhập được.
- [ ] Index tất cả READY, TTL ACTIVE (mục 7); log không chứa secret, số điện thoại đầy đủ hay địa chỉ.
- [ ] Budget và uptime check đã có; lịch backup có (`gcloud firestore backups schedules list`).

## Việc chủ dự án cần làm / cấp quyền

Danh sách đúng những gì dev cần từ chủ để làm hết runbook này. Chưa có những mục này thì dev không tiến hành được.

**A. Tài khoản và billing**

1. Một tài khoản Google (hoặc Cloud Identity/Workspace) làm chủ sở hữu GCP; cho biết **Billing Account ID** (dạng `XXXXXX-XXXXXX-XXXXXX`) và bảo đảm billing đã bật thẻ/hạn mức.
2. Tạo project staging (mục 2) hoặc cấp `roles/resourcemanager.projectCreator` + `roles/billing.user` cho dev; ghi lại `PROJECT_ID`. Prod là project riêng, làm sau và cần quyết định vùng (BA-11).
3. Kiểm tra org policy (`iam.allowedPolicyMemberDomains`, `gcp.resourceLocations`) cho phép `allUsers` trên Cloud Run và vùng `asia-southeast1`, hoặc miễn trừ cho project.

**B. Quyền cho dev (cấp trên project staging; Owner tạm thời cho bootstrap, thu hồi sau)**

4. Giai đoạn bootstrap (mục 3, 5, 6, 8, 9): `roles/owner` tạm thời, **hoặc** chủ tự chạy `00-bootstrap.sh`, `10-iam.sh`, `20-secrets.sh`, `50-budget.sh` và giao dev phần còn lại.
5. Sau bootstrap, quyền hằng ngày tối thiểu cho dev: `roles/viewer`, `roles/logging.viewer`, `roles/monitoring.viewer`, `roles/run.developer`, `roles/iam.serviceAccountUser` trên `gmep-run`, `roles/cloudscheduler.admin`, `roles/datastore.indexAdmin`, `roles/firebaserules.admin`. Dev không cần `secretmanager.secretAccessor` hay quyền đọc dữ liệu Firestore thật.
6. Quyền trên billing account cho người chạy ngân sách: `roles/billing.costsManager` (hoặc chủ chạy `50-budget.sh`).

**C. Firebase và giá trị cần chủ cung cấp**

7. Quyền Owner/Editor trên project Firebase để bấm bước mục 4 (Add Firebase, bật Email/Password, tắt sign-up) nếu dev chưa có.
8. Thông tin SMTP gửi mail (nhà cung cấp, `smtps://user:pass@host:465`, địa chỉ gửi `no-reply@<domain>`): **chủ hoặc nhà cung cấp mail tự nạp** vào secret `gmep-email-smtp-url`; dev không cần biết giá trị. Quyền DNS để thêm SPF/DKIM/DMARC.
9. Quyền quản lý DNS (hoặc người làm giúp) của tên miền staging/prod; **tên miền** đã chọn.

**D. GitHub**

10. Quyền admin trên repository (hoặc chủ tự làm) để: đặt các biến ở mục 11, tạo Environment `staging` với Required reviewers (chủ hoặc người được chỉ định).
11. Cho biết `OWNER/REPO` chính xác của repository (điều kiện WIF).

**E. Quyết định `[Cần xác nhận]` ảnh hưởng hạ tầng**

12. Vùng dữ liệu và pháp lý (BA-11): xác nhận `asia-southeast1` trước khi tạo Firestore prod (không đổi được).
13. Thời hạn lưu trữ backup/log/hóa đơn; số tiền ngân sách và email nhận cảnh báo; có dùng Load Balancer/Cloud Armor hay chỉ domain mapping; nhà cung cấp mail; một hay nhiều pháp nhân (`CRON_COMPANY_ID`).
