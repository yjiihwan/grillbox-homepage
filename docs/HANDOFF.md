# 그릴박스 홈페이지 — 개발자 인계 문서

**빌드 없는 순수 정적 사이트**입니다. HTML/CSS/바닐라 JS만 사용 — 어떤 정적 호스팅(GitHub Pages, Netlify, S3, nginx…)에도 폴더째 올리면 그대로 동작합니다.

- 현재 스테이징: https://yjiihwan.github.io/grillbox-homepage/ (GitHub Pages, `main` 브랜치 루트)
- 저장소: https://github.com/yjiihwan/grillbox-homepage
- 실서버 이전 대상: grillbox.co.kr (현재 imweb — DNS/도메인 작업은 이 저장소 범위 밖)

## 저장소 구조

```
index.html          홈 (9섹션)
menu/index.html     전체 메뉴 (카테고리 탭 필터)
stores/index.html   매장 안내
admin/              관리자 페이지 (콘텐츠 CMS) — index.html + admin.js
content.json        ★ 콘텐츠 SSOT (문구·가격·매장정보·링크)
js/cms.js           content.json → 페이지 하이드레이션 + 탭 필터 + 영업중 뱃지
css/style.css       전체 스타일 (모바일 브레이크포인트 767px)
assets/             이미지 (webp 위주) · assets/cms/ 는 관리자 업로드 분
docs/               이 문서 + ADMIN_GUIDE.md(운영자용) + 스크린샷
robots.txt          /admin/ 크롤링 차단
```

## 콘텐츠 동작 방식 (중요)

1. **HTML에 실데이터가 정적으로 구워져 있다** — SEO·무JS 폴백용.
2. 로드 후 `js/cms.js`가 `content.json`을 fetch해서 `data-cms`(텍스트), `data-cms-href`(링크), `data-cms-src`(이미지) 속성 기준으로 **덮어쓴다**. 메뉴 그리드·리뷰는 `data-render` 컨테이너에 JSON 기준으로 재렌더.
3. 운영자는 `/admin/`에서 폼으로 `content.json`을 수정 → GitHub Contents API로 커밋 → Pages 재배포(1~2분)로 반영.

따라서 **운영자 수정분은 전부 `content.json`(+`assets/cms/`)에만 쌓인다.** HTML의 구운 값은 시간이 지나면 JSON과 어긋날 수 있는데, 사용자에겐 항상 JSON 값이 보이므로 기능 문제는 없다. 다만 SEO 최신화를 원하면 이관 시점에 JSON 값을 HTML에 다시 구워주는 것을 권장 (수동 또는 간단한 스크립트).

- 영업 중 뱃지: `cms.js`가 KST 기준 현재 시각과 `store.openHour/closeHour`를 비교해 계산 (서버 불필요).
- 지도: Google Maps `output=embed` iframe (키 불필요). 네이버 지도 API 키가 생기면 교체 권장.
- 메뉴 카테고리 탭: JS 필터 (`data-cat`). 카드 16장은 전부 DOM에 존재.

## 관리자 페이지 보안 모델

- 접근 암호(`admin.js`의 `PASS_HASH`, SHA-256)는 **열람 문턱일 뿐** — 정적 호스팅이라 진짜 인증은 불가능.
- **실제 쓰기 보호 = GitHub 토큰 인증.** 토큰은 운영자 브라우저 localStorage에만 존재, 저장소엔 어떤 비밀값도 없음.
- `/admin/`은 robots.txt + noindex 메타로 검색 차단.
- 실서버 이관 후에도 GitHub 저장소가 남아 있으면 관리자 페이지는 그대로 쓸 수 있다(커밋 → 실서버로 동기화하는 파이프라인만 붙이면 됨). imweb 등 저장소 밖으로 복사·이관하면 관리자 저장은 동작하지 않음.

## 배포 방법

- **GitHub Pages(현행)**: `main`에 push하면 자동 배포. 끝.
- **다른 호스팅으로 이관**: 저장소 파일 전체를 복사해 서빙. 상대경로만 사용하므로 서브패스 서빙도 가능. `admin/admin.js`의 `REPO`/`BRANCH` 상수만 환경에 맞게 확인.
- 커스텀 도메인 연결 시: Pages 설정에서 도메인 추가 + DNS CNAME (운영자 결정 사항).

## 콘텐츠 수정 흐름 요약

| 무엇 | 누가 | 어떻게 |
|---|---|---|
| 문구·가격·매장정보·링크·메뉴 사진 | 운영자 | `/admin/` (docs/ADMIN_GUIDE.md) |
| 섹션 구조·디자인·메뉴 추가/삭제 | 개발자 | HTML/CSS/content.json 직접 수정 후 push |
| 대표 메뉴 3종 교체 | 개발자 | content.json `menuHighlight.items` |

## 데이터 출처 (2026-09-04 기준)

- 메뉴명·가격·중량: 그릴박스 노량진점 네이버 주문 (biz 1346907) 2026-07-10 수집분
- 매장 주소·전화·영업시간: 네이버플레이스 (place 1093880694) 2026-09-04 확인
- 리뷰: 네이버플레이스 방문자 리뷰 원문 (2026-09-04 수집)
- 메뉴 사진: 네이버 주문에 등록된 브랜드 공식 상품컷 (webp 변환)
- ⚠️ 미확정 항목(사업자등록번호 등)은 저장소 밖 `04_dev/REPORT.md`의 "실데이터 교체 필요 목록" 참조
