'use client';

/**
 * Last-resort boundary (state-copy §2.7). It replaces the root layout, so it cannot use the app's
 * providers: plain markup with the design classes, Vietnamese copy inline for this one file.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <main className="main" id="main" role="alert">
          <div className="main__inner">
            <div className="state">
              <div className="state__title">Hệ thống đang gặp sự cố</div>
              <p className="state__text">
                Đây không phải lỗi của bạn và dữ liệu đã lưu không bị ảnh hưởng. Thử lại sau ít
                phút. Nếu vẫn lỗi, báo quản lý kèm mã tham chiếu bên dưới.
              </p>
              {error.digest ? <div className="state__ref">Mã truy vết: {error.digest}</div> : null}
              <div className="state__actions">
                <button type="button" className="btn btn--primary" onClick={reset}>
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
