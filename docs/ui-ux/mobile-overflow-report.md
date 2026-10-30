# Trang còn tràn ngang ở 390px

Đo bằng Playwright/Chromium sau khi sửa topbar dùng chung (lỗi +6px và topbar đã hết). Còn lại là lỗi riêng của từng trang (tab, bảng, khối rộng hơn màn hình). Desktop 1440px: 0 trang tràn.
Cách đo: scrollWidth - clientWidth của documentElement, viewport 390x844.

Tràn (px) | trang
- +837px  design/g3-inventory-hr/g3-inv-09.html
- +616px  design/g3-inventory-hr/g3-pur-02.html
- +584px  design/g3-inventory-hr/g3-inv-07.html
- +578px  design/g3-inventory-hr/g3-inv-17.html
- +507px  design/g3-inventory-hr/g3-pur-08.html
- +506px  design/g3-inventory-hr/g3-hrm-06.html
- +502px  design/g4-finance/g4-acc-13.html
- +460px  design/g3-inventory-hr/g3-inv-18.html
- +405px  design/g3-inventory-hr/g3-inv-10.html
- +333px  design/g4-finance/g4-acc-03.html
- +320px  design/g4-finance/g4-acc-11.html
- +316px  design/g4-reports-system/g4-rpt-03.html
- +299px  design/g3-inventory-hr/g3-hrm-04.html
- +297px  design/g3-inventory-hr/g3-inv-03.html
- +268px  design/g3-inventory-hr/g3-inv-13.html
- +250px  design/g3-inventory-hr/g3-inv-14.html
- +215px  design/foundation/components.html
- +170px  design/g4-finance/g4-acc-19.html
- +167px  design/foundation/shell.html
- +164px  design/g4-finance/g4-apr-03.html
- +159px  design/g3-inventory-hr/g3-pur-03.html
- +154px  design/g3-inventory-hr/g3-inv-16.html
- +152px  design/g3-inventory-hr/g3-pur-05.html
- +146px  design/g1-auth-dashboard/g1-prf-01.html
- +143px  design/foundation/index.html
- +141px  design/g2-workshop/g2-rec-04.html
- +135px  design/g3-inventory-hr/g3-pur-06.html
- +134px  design/g3-inventory-hr/g3-hrm-08.html
- +98px  design/g2-workshop/index.html
- +66px  design/g2-workshop/g2-crm-02.html
- +57px  design/g4-finance/g4-ein-04.html
- +45px  design/g4-finance/g4-ein-02.html
- +39px  design/g4-finance/g4-acc-04.html
- +21px  design/g2-workshop/g2-crm-05.html
