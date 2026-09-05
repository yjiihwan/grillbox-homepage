# 그릴박스 홈페이지 (실서비스 가능 완성본 · 5단계)

한식 직화구이 덮밥 브랜드 **그릴박스**의 공식 홈페이지. 빌드 없는 순수 정적 사이트.

- 🧪 스테이징: https://yjiihwan.github.io/grillbox-homepage/
- 페이지: `/`(홈 9섹션) · `/menu/`(전체 메뉴·가격) · `/stores/`(매장 안내) · `/admin/`(콘텐츠 관리)
- **⚠️ 실서버 grillbox.co.kr(imweb)·DNS와 무관** — 실서버 배포는 개발자 인계 후 별도 진행.

## 5단계에서 바뀐 것 (2026-09-04)

- `[SLOT]` 자리표시 **전부 제거** — 실데이터로 교체 (노량진점 네이버 주문 메뉴·가격 16종, 네이버플레이스 매장정보·실리뷰 3건, 실링크 4종).
- "고기 10배" 주장 → 실측 전이므로 **실판매 중량 기준(200g/300g/500g)** 으로 교체 (과장 리스크 제거).
- 전 버튼·링크 실동작: 주문(네이버 주문)·길찾기(네이버 지도)·전화(tel:)·인스타·카카오채널·지도 임베드.
- 메뉴 사진: 네이버 주문 등록 **브랜드 공식 상품컷**으로 교체 (AI 생성 컷은 분위기 컷에만 잔존).
- **관리자 페이지 `/admin/`** — 문구·가격·이미지·매장정보를 개발자 없이 수정 (`content.json` + GitHub API).

## 관리자 UX 개편 (2026-09-05)

- 아이디·비밀번호 로그인(로그인 유지·로그아웃), 토큰 입력 UI 완전 제거 — 저장 권한은 `admin/auth.json`에 비밀번호로 봉인(PBKDF2+AES-GCM, 암호문만 저장).
- 좌측 메뉴(모바일=상단 탭) 7개 항목 · 항목마다 한글 설명 + 「실제 화면 보기」 · 저장 바(바뀐 곳 N개 → 저장 중 → 저장 완료 → 사이트에 반영됐어요) · 실패 시 한글 안내 · 사진은 파일 선택 → 미리보기 → 저장.
- 계정 재설정: `admin/setup.html` 또는 `tools/seal_auth.mjs` (docs/HANDOFF.md).

## 완성본 통합 (2026-09-05 저녁)

- design 최종 이미지 세트 반영(히어로·H2 3단·H3 시퀀스·H5 매장 2컷·H6 그릇·/menu 탑뷰·og 3종·아이콘) + 신규 인스타 타일 6·홈 대표 메뉴 크롭 3(`menus[].imgHome`). **페이지 내 동일 사진 중복 0.**
- 지도: Google 임베드 → 정적 지도 이미지 + 네이버 지도 링크 (어떤 환경에서도 빈 박스 없음).
- `404.html` · `site.webmanifest` · 512 아이콘 · 폰트 preconnect/preload · 전 이미지 width/height+aspect-ratio · H2 연출컷 고지 문구.

## 문서

- 운영자용: [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) — 관리자 페이지 사용법 (스크린샷 포함)
- 개발자용: [docs/HANDOFF.md](docs/HANDOFF.md) — 구조·배포·콘텐츠 수정 흐름·보안 모델

## 검증

게이트: `~/sally/_gb_home5_shots.mjs <baseUrl> <outDir>` — 4페이지+404 × PC1440/mo390 스크린샷 + SLOT·placeholder 0 + 금지어 + 죽은 링크 0 + 이미지 전수 유효·alt 전수·width/height + **페이지 내 이미지 중복 0** + 정적 지도 + og/favicon/manifest 200 + 메뉴 탭·햄버거·관리자 로그인 실동작.
관리자 UX 게이트: `~/sally/_gb_admin_ux_shots.mjs <baseUrl> <outDir> [--save]` — 로그인 오답/정답·7탭·개발 용어 0·overflow 0·수정→저장→사이트 반영→원복→로그아웃 (자격: `~/shared_inbox/secrets_grillbox_admin.json` 또는 GB_ADMIN_ID/GB_ADMIN_PW).
