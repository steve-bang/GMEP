#!/usr/bin/env bash
# Chuyển các màn bị bỏ, gộp hoặc hoãn (phía công khai và quản trị nền tảng) vào _deferred/ bằng git mv,
# rồi sửa đường dẫn tương đối của chúng (thêm một cấp thư mục) để vẫn mở được bằng file://.
# Chạy MỘT lần từ gốc kho: bash design/tenant-signup/_deferred/move-deferred.sh
# Bản thân các trang giữ lại KHÔNG liên kết tới các trang này, nên chạy hay chưa chạy đều không có liên kết gãy ở màn đang dùng.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p _deferred/public _deferred/platform-admin

for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 17 18; do
  git mv "public/tsu-$n.html" "_deferred/public/tsu-$n.html"
done
for n in 61 62 63 64 65 67 68; do
  git mv "platform-admin/tsu-$n.html" "_deferred/platform-admin/tsu-$n.html"
done

# Đường dẫn dùng chung và liên kết sang màn còn dùng (thêm một cấp ../)
sed -i -E \
  -e 's#(href|src)="\.\./\.\./assets/#\1="../../../assets/#g' \
  -e 's#href="ts-public\.css"#href="../../public/ts-public.css"#g' \
  -e 's#href="\.\./public/ts-public\.css"#href="../../public/ts-public.css"#g' \
  -e 's#href="ts-admin\.css"#href="../../platform-admin/ts-admin.css"#g' \
  -e 's#src="\.\./ts-common\.js"#src="../../ts-common.js"#g' \
  -e 's#src="ts-admin\.js"#src="../../platform-admin/ts-admin.js"#g' \
  -e 's#href="(tsu-14|tsu-15|tsu-16|tsx-0[123])\.html#href="../../public/\1.html#g' \
  -e 's#href="(tsu-60|tsu-66|tsx-30)\.html#href="../../platform-admin/\1.html#g' \
  -e 's#href="\.\./public/(tsu-14|tsu-15|tsu-16|tsx-0[123])\.html#href="../../public/\1.html#g' \
  -e 's#href="\.\./(onboarding|account)/#href="../../\1/#g' \
  _deferred/public/*.html _deferred/platform-admin/*.html

echo "Xong. Kiểm tra: git status design/tenant-signup"
