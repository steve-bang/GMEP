# Trang còn tràn ngang ở 390px

Đo bằng Playwright/Chromium (scrollWidth - clientWidth, viewport 390x844). Desktop 1440px: 0 trang tràn.

- +567px  design/g3-inventory-hr/g3-inv-07.html
- +502px  design/g4-finance/g4-acc-13.html
- +388px  design/g3-inventory-hr/g3-inv-10.html
- +333px  design/g4-finance/g4-acc-03.html
- +320px  design/g4-finance/g4-acc-11.html
- +316px  design/g4-reports-system/g4-rpt-03.html
- +299px  design/g3-inventory-hr/g3-hrm-04.html
- +251px  design/g3-inventory-hr/g3-inv-13.html
- +215px  design/foundation/components.html
- +170px  design/g4-finance/g4-acc-19.html
- +167px  design/foundation/shell.html
- +164px  design/g4-finance/g4-apr-03.html
- +146px  design/g1-auth-dashboard/g1-prf-01.html
- +143px  design/foundation/index.html
- +141px  design/g2-workshop/g2-rec-04.html
- +134px  design/g3-inventory-hr/g3-hrm-08.html
- +112px  design/g3-inventory-hr/g3-inv-03.html
- +98px  design/g2-workshop/index.html
- +66px  design/g2-workshop/g2-crm-02.html
- +57px  design/g4-finance/g4-ein-04.html
- +45px  design/g4-finance/g4-ein-02.html
- +39px  design/g4-finance/g4-acc-04.html
- +21px  design/g2-workshop/g2-crm-05.html

## Phần tử gây tràn (đo bằng Playwright)

- design/g1-auth-dashboard/g1-prf-01.html: section.card (right=536); form#pf.card (right=536)
- design/g2-workshop/g2-crm-02.html: div.segmented (right=456)
- design/g2-workshop/g2-crm-05.html: div.segmented (right=411)
- design/g2-workshop/g2-rec-04.html: div.segmented (right=531)
- design/g3-inventory-hr/g3-hrm-04.html: —
- design/g3-inventory-hr/g3-hrm-08.html: div.g3-chip-badges (right=524); div.g3-chip-badges (right=475)
- design/g3-inventory-hr/g3-inv-03.html: —
- design/g3-inventory-hr/g3-inv-07.html: —
- design/g3-inventory-hr/g3-inv-10.html: —
- design/g3-inventory-hr/g3-inv-13.html: —
- design/g4-finance/g4-acc-03.html: section.card (right=723); section.card (right=723)
- design/g4-finance/g4-acc-04.html: span#tt-cq.tooltip (right=429)
- design/g4-finance/g4-acc-11.html: section.card (right=710); div.stack (right=710)
- design/g4-finance/g4-acc-13.html: section.card (right=892); section.card (right=892)
- design/g4-finance/g4-acc-19.html: section.card (right=560); aside.g4f-aside (right=560)
- design/g4-finance/g4-apr-03.html: section.card (right=554); section.card (right=554); section.card (right=554)
- design/g4-finance/g4-ein-02.html: div.stack (right=435); aside.g4f-aside (right=435)
- design/g4-finance/g4-ein-04.html: fieldset.card (right=445); aside.g4f-aside (right=447)
- design/g4-reports-system/g4-rpt-03.html: section.card.g4r-chartcard (right=706); section.table-wrap (right=706)
