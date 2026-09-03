# 그릴박스 홈페이지 개편 — staging 미리보기
- 근거: `~/shared_inbox/results/grillbox_homepage_renewal_20260903/` (01_branding → 02_marketing v1.1 카피 → 03_design 시안)
- 순수 정적 HTML/CSS 3페이지: `/`(홈 9섹션) · `/menu/` · `/stores/`
- **⚠️ staging 전용** — 실서버 grillbox.co.kr(imweb)·DNS와 무관. prod 반영은 형 승인 후 별도.
- `[SLOT: …]` 빨간 칩 = 운영자 실데이터 치환 지점(02 문서 §7과 1:1): 메뉴명·가격·구성 / 매장 주소·영업시간·전화·주차·좌석 / 실리뷰 3건(창작 금지) / 10배 비교 실측치·측정일 / ORDER_LINK(자체앱 vs 배달앱 — GNB·CTA "바로 주문" href) / INSTA_HANDLE / 사업자 정보 / 원산지 / 지도 좌표
- 실데이터 확보 시: Restaurant/Menu JSON-LD 추가(02 §5), 각 html의 TODO 주석 참조.
- 게이트: `~/sally/_gb_homepage_shots.mjs <baseUrl> <outDir>` — PC1440/모바일390 전 페이지 스크린샷 + 가로 overflow + 카피 57건 대조 + 금지어 14종 + 메타/alt.
