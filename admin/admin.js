/* 그릴박스 관리자 — content.json을 화면 폼으로 고치고 저장소에 반영한다.
   인증: admin/auth.json(봉인된 저장 권한)을 아이디+비밀번호로 열어 세션에만 둔다(sealbox.js).
   운영자 화면에는 개발 용어를 노출하지 않는다. */
(function () {
  var REPO = 'yjiihwan/grillbox-homepage';
  var BRANCH = 'main';
  var SESSION_KEY = 'gb_admin_session';
  var KEEP_DAYS = 30;
  var MAX_IMG = 2.5 * 1024 * 1024;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  var session = null;      // { u, t, exp }
  var content = null;      // 편집 중
  var original = null;     // 마지막 저장본
  var pendingImages = {};  // path(예: menus.3.img) -> { file, url }
  var saving = false;

  /* ───────── 세션 ───────── */
  function readSession() {
    var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || !s.t || (s.exp && Date.now() > s.exp)) { clearSession(); return null; }
      return s;
    } catch (e) { clearSession(); return null; }
  }
  function writeSession(s, keep) {
    var raw = JSON.stringify(s);
    if (keep) localStorage.setItem(SESSION_KEY, raw); else sessionStorage.setItem(SESSION_KEY, raw);
  }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); }

  /* ───────── 로그인 ───────── */
  var authBox = null;
  function loadAuthBox() {
    if (authBox) return Promise.resolve(authBox);
    return fetch('auth.json?ts=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('auth');
      return r.json();
    }).then(function (b) { authBox = b; return b; });
  }

  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-id').focus();
  }

  function initLogin() {
    var form = $('#login-form'), btn = $('#login-btn'), msg = $('#login-msg');
    $('#pw-eye').addEventListener('click', function () {
      var inp = $('#login-pw'); var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      this.textContent = show ? '숨기기' : '보기';
      this.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 보기');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('#login-id').value, pw = $('#login-pw').value, keep = $('#login-keep').checked;
      msg.hidden = true;
      if (!id.trim() || !pw) { msg.textContent = '아이디와 비밀번호를 모두 입력해 주세요.'; msg.hidden = false; return; }
      btn.disabled = true; btn.textContent = '확인 중…';
      loadAuthBox().then(function (box) { return GBSeal.open(box, id, pw); }).then(function (secret) {
        if (!secret) {
          msg.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.'; msg.hidden = false;
          $('#login-pw').value = ''; $('#login-pw').focus();
          return;
        }
        session = { u: id.trim().toLowerCase(), t: secret, exp: keep ? Date.now() + KEEP_DAYS * 864e5 : null };
        writeSession(session, keep);
        $('#login-pw').value = '';
        openApp();
      }).catch(function () {
        msg.textContent = '로그인 정보를 확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'; msg.hidden = false;
      }).finally(function () { btn.disabled = false; btn.textContent = '로그인'; });
    });
  }

  function logout() {
    if (isDirty() && !confirm('저장하지 않은 변경이 있어요. 그래도 로그아웃할까요?')) return;
    clearSession(); session = null; content = null; original = null; pendingImages = {};
    $('#content').innerHTML = ''; $('#sidenav').innerHTML = '';
    showLogin();
  }

  /* ───────── 본문 ───────── */
  function openApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#user-chip').textContent = session.u;
    setStatus('loading', '불러오는 중…');
    fetch('../content.json?ts=' + Date.now()).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (c) {
      content = c; original = JSON.parse(JSON.stringify(c)); pendingImages = {};
      buildNav(); buildPanels();
      var want = (location.hash || '').replace('#', '') || 'home';
      activate(SECTIONS.some(function (s) { return s.key === want; }) ? want : 'home');
      refreshDirty();
    }).catch(function () {
      setStatus('err', '내용을 불러오지 못했어요. 새로고침(F5) 해 주세요.');
    });
  }

  function get(path, obj) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj || content); }
  function set(path, v) {
    var ks = path.split('.'); var o = content;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  /* 화면 구성 — key, 아이콘, 이름, 설명, 미리보기 링크 */
  var SECTIONS = [
    { key: 'home', ico: '🏠', title: '홈 화면 문구', short: '첫 화면 제목·소개 문구', desc: '홈페이지 첫 화면부터 아래로 이어지는 큰 제목과 소개 문구를 고칠 수 있어요. 줄바꿈은 그대로 화면에 반영돼요.', preview: '../' },
    { key: 'menu', ico: '🍖', title: '메뉴 · 가격', short: '메뉴명·설명·사이즈별 가격', desc: '전체 메뉴 16종의 이름, 한 줄 설명, 사이즈별 가격이에요. 홈 화면 대표 메뉴와 메뉴 페이지에 함께 반영돼요.', preview: '../menu/' },
    { key: 'store', ico: '📍', title: '매장 정보', short: '주소·영업시간·전화', desc: '매장 이름·주소·영업시간·전화번호예요. 홈 화면 매장 안내와 매장 페이지에 함께 반영돼요.', preview: '../stores/' },
    { key: 'reviews', ico: '💬', title: '고객 리뷰', short: '홈 화면 리뷰 3건', desc: '홈 화면에 보이는 고객 리뷰 3건이에요. 실제 고객이 남긴 리뷰 원문만 넣어 주세요 (만든 리뷰는 표시광고법 위반 소지).', preview: '../#reviews' },
    { key: 'photos', ico: '🖼️', title: '사진', short: '메뉴 사진·고기양 비교 사진', desc: '사진을 새 파일로 바꿀 수 있어요. 파일을 고르면 미리보기가 바뀌고, 「저장하기」를 누르면 사이트에 올라가요. 2.5MB 이하 가로 사진을 권장해요.', preview: '../menu/' },
    { key: 'links', ico: '🔗', title: '버튼 연결 주소', short: '주문·길찾기·SNS 링크', desc: '「바로 주문」「길찾기」「인스타그램」「카카오톡」 버튼을 누르면 열리는 주소예요. 주소가 바뀌었을 때만 고쳐 주세요.', preview: '../' },
    { key: 'business', ico: '🏢', title: '사업자 정보', short: '상호·사업자등록번호·하단 표기', desc: '모든 페이지 맨 아래에 작게 들어가는 사업자 표기예요. 비워 둔 항목은 화면에 아예 나오지 않으니, 확정된 값만 채우면 돼요.', preview: '../' },
    { key: 'pages', ico: '📄', title: '기타 문구', short: '메뉴·매장 페이지 안내', desc: '메뉴 페이지와 매장 페이지의 안내 문구예요.', preview: '../menu/' }
  ];

  function buildNav() {
    $('#sidenav').innerHTML = SECTIONS.map(function (s) {
      return '<button type="button" class="nav-item" data-key="' + s.key + '"><span class="ico">' + s.ico + '</span><span><b>' + s.title + '</b><small>' + s.short + '</small></span><span class="cnt" data-cnt="' + s.key + '"></span></button>';
    }).join('');
    $$('.nav-item').forEach(function (b) { b.addEventListener('click', function () { activate(b.getAttribute('data-key')); }); });
  }
  function activate(key) {
    $$('.nav-item').forEach(function (b) {
      var on = b.getAttribute('data-key') === key;
      b.classList.toggle('active', on);
      if (on && b.scrollIntoView) b.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === key); });
    if (history.replaceState) history.replaceState(null, '', '#' + key);
    window.scrollTo(0, 0);
  }

  /* ── 필드 헬퍼 ── */
  function field(path, label, opt) {
    opt = opt || {};
    var v = get(path); if (v == null) v = '';
    var id = 'f_' + path.replace(/\./g, '_');
    var help = opt.help ? '<span class="help">' + opt.help + '</span>' : '';
    var inner;
    if (opt.type === 'textarea') inner = '<textarea id="' + id + '" data-path="' + path + '" rows="' + (opt.rows || 3) + '">' + esc(v) + '</textarea>';
    else if (opt.type === 'price') inner = '<span class="input-suffix" data-suffix="원"><input type="text" inputmode="numeric" id="' + id + '" data-path="' + path + '" data-kind="price" value="' + esc(Number(v).toLocaleString('ko-KR')) + '"></span>';
    else if (opt.type === 'select') inner = '<select id="' + id + '" data-path="' + path + '">' + (opt.options || []).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    else inner = '<input type="' + (opt.type === 'url' ? 'url' : opt.type === 'tel' ? 'tel' : opt.type === 'email' ? 'email' : 'text') + '" id="' + id + '" data-path="' + path + '" value="' + esc(v) + '"' + (opt.placeholder ? ' placeholder="' + esc(opt.placeholder) + '"' : '') + '>';
    return '<label class="field" for="' + id + '"><span>' + label + '</span>' + inner + help + '</label>';
  }
  function card(title, desc, where, body) {
    return '<div class="card"><div class="card-head"><div><h3>' + title + '</h3>' + (desc ? '<p class="desc">' + desc + '</p>' : '') + '</div>' +
      (where ? '<span class="where"><a href="' + where.href + '" target="_blank" rel="noopener">' + where.label + ' ↗</a></span>' : '') + '</div>' + body + '</div>';
  }
  function photoBox(path, label, fallbackPath) {
    var cur = get(path) || (fallbackPath ? get(fallbackPath) : '');
    var pend = pendingImages[path];
    var src = pend ? pend.url : (cur ? '../' + cur + '?ts=' + Date.now() : '');
    return '<div class="menu-photo' + (pend ? ' pending' : '') + (src ? '' : ' empty') + '" data-photo="' + path + '">' +
      '<img' + (src ? ' src="' + esc(src) + '"' : '') + ' alt="' + esc(label) + '">' +
      '<label class="ph-btn">' + (src ? '사진 바꾸기' : '사진 올리기') + '<input type="file" accept="image/*" data-img-path="' + path + '"></label></div>';
  }

  function panelHead(s) {
    return '<div class="panel-head"><div><h2>' + s.ico + ' ' + s.title + '</h2><p>' + s.desc + '</p></div><a class="preview-link" href="' + s.preview + '" target="_blank" rel="noopener">실제 화면 보기 ↗</a></div>';
  }

  function buildPanels() {
    var html = '';
    SECTIONS.forEach(function (s) {
      html += '<div class="panel" data-panel="' + s.key + '">' + panelHead(s) + PANEL[s.key]() + '</div>';
    });
    var root = $('#content');
    root.innerHTML = html;
    bindInputs(root);
  }

  var PANEL = {
    home: function () {
      var menuOptions = function (sel) {
        return content.menus.map(function (m) { return '<option value="' + m.id + '"' + (m.id === sel ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
      };
      return card('첫 화면 (가장 위)', '사이트에 들어오면 가장 먼저 보이는 큰 제목과 버튼 문구예요.', { href: '../#hero', label: '이 부분 보기' },
          field('hero.h1', '큰 제목', { type: 'textarea', rows: 2, help: '줄을 나누면 화면에서도 그 자리에서 줄이 바뀌어요.' }) +
          field('hero.sub', '소개 문구', { type: 'textarea', rows: 2 }) +
          '<div class="grid2">' + field('hero.ctaStore', '왼쪽 버튼 글자') + field('hero.ctaOrder', '오른쪽 버튼 글자') + '</div>' +
          field('nav.order', '맨 위 「바로 주문」 버튼 글자', { help: '모든 페이지 맨 위 빨간 버튼이에요. 매장이 2곳 이상이 되면 「매장 골라 주문」으로 바꿔 주세요.' })) +
        card('고기양 소개', '200g · 300g · 500g 비교 사진이 있는 부분이에요.', { href: '../#weight', label: '이 부분 보기' },
          field('weight.head', '제목') + field('weight.sub', '소개 문구') + field('weight.caption', '사진 아래 설명') +
          field('weight.footnote', '작은 글씨 안내', { help: '가격·중량 기준을 밝히는 문구예요. 실제 판매 기준과 다르면 안 돼요.' })) +
        card('직화 소개', '불 위에서 굽는 사진이 있는 부분이에요.', { href: '../#fire', label: '이 부분 보기' },
          field('fire.head', '제목') + field('fire.body', '본문', { type: 'textarea', rows: 3, help: '줄바꿈이 그대로 반영돼요.' }) + field('fire.caption', '사진 위 짧은 문구') +
          '<div class="grid3">' + [0, 1, 2].map(function (i) { return field('fire.steps.' + i, '사진 ' + (i + 1) + ' 아래 글'); }).join('') + '</div>') +
        card('대표 메뉴 3종', '홈 화면에 크게 보여 줄 메뉴 3개를 고르세요. 이름·가격·사진은 「메뉴 · 가격」에서 고쳐요.', { href: '../#menu', label: '이 부분 보기' },
          field('menuHighlight.head', '제목') + field('menuHighlight.sub', '소개 문구') +
          '<div class="grid3">' + [0, 1, 2].map(function (i) {
            return '<label class="field" for="f_hl_' + i + '"><span>대표 메뉴 ' + (i + 1) + '</span><select id="f_hl_' + i + '" data-path="menuHighlight.items.' + i + '">' + menuOptions(content.menuHighlight.items[i]) + '</select></label>';
          }).join('') + '</div>' + field('menuHighlight.cta', '「전체 메뉴 보기」 버튼 글자')) +
        card('브랜드 소개', '홈 화면 아래쪽 브랜드 이야기 부분이에요.', { href: '../#brand', label: '이 부분 보기' },
          field('brand.head', '제목') + field('brand.body', '본문', { type: 'textarea', rows: 4, help: '칼로리·단백질 같은 수치나 효능 표현은 실측 자료가 있을 때만 넣어 주세요.' })) +
        card('인스타그램 소개', '', { href: '../#insta', label: '이 부분 보기' },
          field('insta.head', '제목') + field('insta.sub', '소개 문구', { help: '@계정이름을 함께 적어 두면 좋아요.' }) + field('insta.cta', '버튼 글자')) +
        card('마지막 안내 (맨 아래 큰 문구)', '', { href: '../#cta', label: '이 부분 보기' },
          field('finalCta.head', '제목') + field('finalCta.sub', '소개 문구') +
          '<div class="grid2">' + field('finalCta.ctaStore', '왼쪽 버튼 글자') + field('finalCta.ctaOrder', '오른쪽 버튼 글자') + '</div>');
    },
    menu: function () {
      var html = '<div class="notice">가격은 숫자만 적으면 돼요 (예: 8900). 쉼표와 「원」은 자동으로 붙어요. 사진은 「사진」 탭이나 여기서 바로 바꿀 수 있어요.</div>';
      content.categories.forEach(function (cat) {
        html += '<p class="cat-title">' + esc(cat.label).toUpperCase() + '</p>';
        content.menus.forEach(function (m, i) {
          if (m.cat !== cat.id) return;
          var p = 'menus.' + i + '.';
          html += '<div class="card"><div class="menu-card">' + photoBox(p + 'img', m.name) + '<div>' +
            field(p + 'name', '메뉴 이름') + field(p + 'desc', '한 줄 설명') +
            '<div class="grid3">' + field(p + 'prices.base', '기본 (200g)', { type: 'price' }) + field(p + 'prices.xl2', '2XL (300g)', { type: 'price' }) + field(p + 'prices.xl3', '3XL (500g)', { type: 'price' }) + '</div>' +
            '</div></div></div>';
        });
      });
      return html;
    },
    store: function () {
      var html = '<div class="notice">매장은 여기서 직접 <b>추가·삭제·순서 변경</b>할 수 있어요. 매장이 2곳 이상이 되면 홈·매장 페이지·「바로 주문」 버튼이 자동으로 「매장 선택」 방식으로 바뀌어요.</div>';
      html += '<div class="list-bar"><span>매장 ' + content.stores.length + '곳</span><button type="button" class="btn btn-primary btn-sm" data-store-add>＋ 매장 추가</button></div>';
      content.stores.forEach(function (s, i) {
        var p = 'stores.' + i + '.';
        var nm = s.name || ('새 매장 ' + (i + 1));
        html += '<section class="store-group" data-store-group="' + i + '">' +
          '<div class="group-head"><h3><span class="no">' + (i + 1) + '</span>' + esc(nm) + '</h3><div class="group-btns">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-store-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + esc(nm) + ' 위로">↑ 위로</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-store-down="' + i + '"' + (i === content.stores.length - 1 ? ' disabled' : '') + ' aria-label="' + esc(nm) + ' 아래로">↓ 아래로</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-store-del="' + i + '" aria-label="' + esc(nm) + ' 삭제">삭제</button>' +
          '</div></div>' +
          card('기본 정보', '', { href: '../stores/', label: '매장 페이지 보기' },
            '<div class="grid2">' + field(p + 'name', '매장 이름', { placeholder: '예: 그릴박스 노량진점' }) + field(p + 'shortName', '짧은 이름', { placeholder: '예: 노량진점', help: '매장 선택 화면·구조화 데이터에서 짧게 쓰여요.' }) + '</div>' +
            field(p + 'address', '주소', { placeholder: '예: 서울 동작구 만양로14가길 23 1층', help: '지도도 이 주소로 표시돼요.' }) +
            '<div class="grid2">' + field(p + 'phone', '전화번호', { type: 'tel', placeholder: '0507-0000-0000' }) + field(p + 'seatNote', '좌석 한 줄 소개', { placeholder: '예: 혼밥도 편해요' }) + '</div>' +
            '<div class="grid2">' + field(p + 'mapQuery', '지도 검색어', { placeholder: '예: 서울 동작구 만양로14가길 23', help: '지도에서 이 매장을 찾을 때 쓰는 검색어예요. 보통 주소와 같게 두면 돼요.' }) +
              field(p + 'status', '노출 상태', { type: 'select', options: [['open', '영업 중 (사이트에 보임)'], ['soon', '오픈 준비 중 (「오픈 소식 받기」로 표시)'], ['hidden', '숨김 (휴점·사이트에 안 보임)']], help: '「영업 중」이면 오픈·마감 시각을 보고 지금 영업 중인지 자동으로 표시해요.' }) + '</div>' +
            field(p + 'access', '가는 길 안내', { type: 'textarea', rows: 2, help: '도보 O분 같은 표현은 실제로 재 본 뒤에만 적어 주세요.' })) +
          card('영업시간', '「지금 영업 중」 표시는 오픈·마감 시각을 보고 자동으로 바뀌어요. 영업시간이 바뀌면 세 칸을 모두 고쳐 주세요.', null,
            field(p + 'hoursText', '화면에 보이는 영업시간 글', { placeholder: '예: 매일 11:00 – 21:50' }) +
            '<div class="grid2">' + field(p + 'openHour', '오픈 시각', { placeholder: '11:00', help: '시:분 형식 (예 11:00)' }) + field(p + 'closeHour', '마감 시각', { placeholder: '21:50', help: '시:분 형식 (예 21:50)' }) + '</div>') +
          card('링크', '이 매장의 주문·지도 주소예요. 매장마다 다르니 꼭 그 매장 주소를 넣어 주세요.', null,
            field(p + 'orderUrl', '이 매장 주문 주소', { type: 'url', placeholder: 'https://booking.naver.com/…', help: '「바로 주문」·「포장 주문하기」 버튼이 여는 주소예요.' }) +
            field(p + 'naverPlace', '이 매장 지도 주소', { type: 'url', placeholder: 'https://map.naver.com/…', help: '「길찾기」 버튼이 여는 네이버 지도 주소예요.' })) +
          card('사진', '외관·내부 사진은 매장 페이지와 매장 선택 화면에, 지도 사진은 매장 페이지 위쪽 지도 자리에 쓰여요. 2.5MB 이하 가로 사진을 권장해요.', null,
            '<div class="photo-grid">' +
              '<figure class="photo-tile">' + photoBox(p + 'photoExterior', nm + ' 외관') + '<figcaption><b>매장 외관</b><small>가로 사진 (3:2)</small>' + undoBtn(p + 'photoExterior') + '</figcaption></figure>' +
              '<figure class="photo-tile">' + photoBox(p + 'photoInterior', nm + ' 내부') + '<figcaption><b>매장 내부</b><small>가로 사진 (3:2)</small>' + undoBtn(p + 'photoInterior') + '</figcaption></figure>' +
              '<figure class="photo-tile">' + photoBox(p + 'mapImg', nm + ' 지도') + '<figcaption><b>지도 사진</b><small>매장 페이지 위쪽 지도</small>' + undoBtn(p + 'mapImg') + '</figcaption></figure>' +
            '</div>') +
          card('이 매장 사업자 정보 (선택)', '가맹점처럼 매장마다 사업자가 다를 때만 채워 주세요. 비워 두면 「사업자 정보」 탭에 넣은 본사 값이 그대로 쓰여요.', null,
            '<div class="grid2">' + field(p + 'business.companyName', '상호 (법인명)', { placeholder: '비우면 본사 값' }) + field(p + 'business.ceo', '대표자명', { placeholder: '비우면 본사 값' }) + '</div>' +
            '<div class="grid2">' + field(p + 'business.regNo', '사업자등록번호', { placeholder: '000-00-00000' }) + field(p + 'business.mailOrderNo', '통신판매업 신고번호', { placeholder: '제 0000-지역-0000 호' }) + '</div>' +
            field(p + 'business.address', '사업장 주소', { placeholder: '비우면 본사 값 · 매장 주소와 다를 수 있어요' })) +
          '</section>';
      });
      html += card('홈 화면 매장 영역 문구', '홈 화면 가운데 「가까운 그릴박스」 부분이에요.', { href: '../#store', label: '이 부분 보기' },
          field('storeSection.head', '제목') + field('storeSection.sub', '소개 문구') +
          '<div class="grid2">' + field('storeSection.badgeOpen', '영업 중일 때 표시') + field('storeSection.badgeClosedTpl', '영업 전일 때 표시', { help: '{openHour} 자리에 오픈 시각이 들어가요.' }) + '</div>' +
          '<div class="grid3">' + field('storeSection.ctaDirections', '「길찾기」 버튼') + field('storeSection.ctaCall', '「전화하기」 버튼') + field('storeSection.allStores', '「전체 매장 보기」 링크') + '</div>' +
          field('storeSection.mapCta', '지도 위 안내 글'));
      html += card('매장 페이지 문구', '', { href: '../stores/', label: '매장 페이지 보기' },
        field('storesPage.h1', '페이지 제목') + field('storesPage.intro', '맨 위 소개 문구', { type: 'textarea', rows: 2 }) + field('storesPage.tail', '맨 아래 한 줄'));
      html += card('매장 선택 화면 문구', '매장이 2곳 이상일 때 「바로 주문」을 누르면 뜨는 화면이에요.' + (content.stores.filter(function (s) { return s.status !== 'hidden'; }).length > 1 ? '' : ' 지금은 보이는 매장이 한 곳이라 화면에 나오지 않아요.'), null,
        field('storeSelect.title', '제목') + field('storeSelect.sub', '안내 문구', { type: 'textarea', rows: 2 }) +
        '<div class="grid2">' + field('storeSelect.tabAll', '「전체 매장」 탭') + field('storeSelect.tabOpen', '「지금 영업 중」 탭') + '</div>' +
        '<div class="grid2">' + field('storeSelect.card.cta', '매장 카드 버튼') + field('storeSelect.confirmCta', '이어서 주문 버튼') + '</div>' +
        field('storeSelect.searchPlaceholder', '검색창 안내 글') +
        field('storeSelect.emptyTitle', '검색 결과 없을 때 제목') + field('storeSelect.emptyBody', '검색 결과 없을 때 안내', { type: 'textarea', rows: 2 }) +
        field('storeSelect.footnote', '맨 아래 각주'));
      return html;
    },
    reviews: function () {
      var html = card('리뷰 영역 문구', '', { href: '../#reviews', label: '이 부분 보기' },
        field('reviews.head', '제목') + field('reviews.tail', '맨 아래 한 줄') +
        field('reviews.source', '출처 표기', { help: '리뷰를 어디서 언제 가져왔는지 적어요. 각 리뷰 아래에 함께 보여요.' }));
      content.reviews.items.forEach(function (r, i) {
        var p = 'reviews.items.' + i + '.';
        html += card('리뷰 ' + (i + 1), '', null, field(p + 'text', '리뷰 내용', { type: 'textarea', rows: 3 }) + field(p + 'visited', '방문 시기', { placeholder: '예: 2026년 8월 방문' }));
      });
      return html;
    },
    photos: function () {
      var tiles = '';
      content.weight.tiers.forEach(function (t, i) {
        tiles += '<figure class="photo-tile">' + photoBox('weight.tiers.' + i + '.img', t.label + ' ' + t.grams) + '<figcaption><b>고기양 비교 · ' + esc(t.label) + '</b><small>' + esc(t.grams) + ' · 홈 화면</small>' + undoBtn('weight.tiers.' + i + '.img') + '</figcaption></figure>';
      });
      var html = card('고기양 비교 사진 (3장)', '홈 화면에서 200g · 300g · 500g을 나란히 보여 주는 사진이에요. 같은 각도·같은 그릇으로 찍은 사진이 좋아요.', { href: '../#weight', label: '이 부분 보기' }, '<div class="photo-grid">' + tiles + '</div>');
      tiles = '';
      content.menus.forEach(function (m, i) {
        var p = 'menus.' + i + '.img';
        tiles += '<figure class="photo-tile">' + photoBox(p, m.name) + '<figcaption><b>' + esc(m.name) + '</b><small>' + esc(catLabel(m.cat)) + '</small>' + undoBtn(p) + '</figcaption></figure>';
      });
      html += card('메뉴 사진 (16장)', '메뉴 페이지 카드에 쓰여요. 가로로 긴 사진(4:3)이 잘 맞아요.', { href: '../menu/', label: '메뉴 페이지 보기' }, '<div class="photo-grid">' + tiles + '</div>');
      tiles = '';
      content.menuHighlight.items.forEach(function (id) {
        var i = content.menus.findIndex(function (m) { return m.id === id; }); if (i < 0) return;
        var m = content.menus[i]; var p = 'menus.' + i + '.imgHome';
        tiles += '<figure class="photo-tile">' + photoBox(p, m.name + ' (홈 화면)', 'menus.' + i + '.img') + '<figcaption><b>' + esc(m.name) + '</b><small>홈 화면 대표 메뉴 · 비워 두면 메뉴 사진과 같아요</small>' + undoBtn(p) + '</figcaption></figure>';
      });
      html += card('홈 화면 대표 메뉴 사진 (3장)', '홈 화면 대표 메뉴 3개에만 쓰이는 사진이에요. 메뉴 페이지 사진과 다른 구도로 두면 홈이 덜 반복돼 보여요.', { href: '../#menu', label: '이 부분 보기' }, '<div class="photo-grid">' + tiles + '</div>');
      return html;
    },
    links: function () {
      return card('버튼이 여는 주소', '주소를 바꾼 뒤에는 저장 후 실제로 버튼을 눌러 잘 열리는지 꼭 확인해 주세요.', null,
        field('links.order', '「바로 주문」 예비 주소', { type: 'url', help: '주문 주소는 「매장 정보」 탭에서 매장별로 넣어요. 여기 값은 매장 주소가 비었을 때만 쓰여요.' }) +
        field('links.naverPlace', '「길찾기」 예비 주소', { type: 'url', help: '길찾기 주소도 「매장 정보」 탭에서 매장별로 넣어요.' }) +
        field('links.instagram', '「인스타그램」 버튼', { type: 'url' }) +
        field('links.kakao', '「카카오톡 채널」 버튼', { type: 'url' }));
    },
    business: function () {
      var b = 'footer.business.';
      return '<div class="notice">여기에 넣은 내용은 홈 · 메뉴 · 매장 등 <b>모든 페이지 맨 아래</b>에 작은 글씨로 함께 표시돼요. <b>비워 둔 항목은 화면에 아예 나오지 않으니</b>, 확정된 값만 채우고 나머지는 비워 두셔도 괜찮아요.</div>' +
        card('사업자 정보 (모든 페이지 맨 아래)', '온라인으로 주문·결제를 받는 사이트가 표시해야 하는 항목이에요. 사업자등록증·통신판매업 신고증에 적힌 값을 그대로 옮겨 적어 주세요.', { href: '../', label: '이 부분 보기' },
          '<div class="grid2">' +
            field(b + 'companyName', '상호 (법인명)', { placeholder: '예: 주식회사 인디펜던트', help: '사업자등록증에 적힌 상호를 그대로 넣어 주세요.' }) +
            field(b + 'ceo', '대표자명', { placeholder: '예: 홍길동' }) +
          '</div>' +
          '<div class="grid2">' +
            field(b + 'regNo', '사업자등록번호', { placeholder: '000-00-00000', help: '숫자 10자리를 000-00-00000 모양으로 넣어 주세요.' }) +
            field(b + 'mailOrderNo', '통신판매업 신고번호', { placeholder: '제 0000-서울OO-0000 호', help: '관할 구청에서 받은 신고증에 적힌 번호예요. 아직 없으면 비워 두세요.' }) +
          '</div>' +
          field(b + 'address', '사업장 주소', { placeholder: '예: 서울특별시 동작구 ○○로 00, 0층', help: '사업자등록증상 소재지예요. 매장 주소와 다를 수 있어요.' }) +
          '<div class="grid2">' +
            field(b + 'phone', '대표 전화', { type: 'tel', placeholder: '02-0000-0000' }) +
            field(b + 'email', '이메일', { type: 'email', placeholder: 'name@example.com' }) +
          '</div>' +
          '<div class="grid2">' +
            field(b + 'privacyOfficer', '개인정보관리책임자', { placeholder: '예: 홍길동 (privacy@example.com)', help: '고객 정보를 다루는 책임자예요. 이름만 적어도 되고, 연락처를 함께 적어도 좋아요.' }) +
            field(b + 'etc', '기타 표기 (선택)', { placeholder: '예: 호스팅 제공 ○○○', help: '위 항목에 없는 표기가 필요할 때만 쓰세요. 라벨 없이 적은 그대로 보여요.' }) +
          '</div>') +
        card('맨 아래 나머지 문구', '사업자 정보 위·아래에 함께 보이는 줄이에요.', { href: '../', label: '이 부분 보기' },
          field('footer.company', '운영 표기 한 줄', { help: '사업자 정보와 별개로 맨 위에 굵게 보이는 줄이에요. 예: 운영: 주식회사 인디펜던트 · 그릴박스' }) +
          field('footer.contact', '문의 안내 한 줄') + field('footer.copyright', '저작권 표기'));
    },
    pages: function () {
      return card('메뉴 페이지 안내 문구', '', { href: '../menu/', label: '메뉴 페이지 보기' },
        field('menuPage.h1', '페이지 제목') + field('menuPage.intro', '맨 위 소개 문구', { type: 'textarea', rows: 2 }) + field('menuPage.sizeNote', '사이즈 안내') + field('menuPage.originHead', '원산지 안내 제목') +
        field('menuPage.origin', '원산지 안내', { type: 'textarea', rows: 2, help: '법정 원산지 표기 문구가 확정되면 여기에 넣어 주세요.' }));
    }
  };
  function catLabel(id) { var c = content.categories.find(function (x) { return x.id === id; }); return c ? c.label : ''; }
  function undoBtn(path) { return pendingImages[path] ? '<button type="button" class="undo" data-undo="' + path + '">바꾸기 취소</button>' : ''; }

  /* ── 매장 추가 · 삭제 · 순서 변경 ── */
  function rebuildPanel(key) {
    var panel = $('[data-panel="' + key + '"]');
    if (!panel) return;
    var sec = SECTIONS.filter(function (s) { return s.key === key; })[0];
    panel.innerHTML = panelHead(sec) + PANEL[key]();
    bindInputs(panel);
    refreshDirty();
  }
  // 저장 전 사진(pendingImages)은 stores.<번호>.<칸> 키로 잡혀 있어 순서가 바뀌면 같이 옮겨 줘야 한다
  function remapStoreImages(mapIndex) {
    var next = {};
    Object.keys(pendingImages).forEach(function (k) {
      var m = /^stores\.(\d+)\.(.+)$/.exec(k);
      if (!m) { next[k] = pendingImages[k]; return; }
      var to = mapIndex(+m[1]);
      if (to == null) { URL.revokeObjectURL(pendingImages[k].url); return; }
      next['stores.' + to + '.' + m[2]] = pendingImages[k];
    });
    pendingImages = next;
  }
  function newStoreId() {
    var ids = content.stores.map(function (s) { return s.id; });
    var n = content.stores.length + 1;
    while (ids.indexOf('store' + n) >= 0) n++;
    return 'store' + n;
  }
  function addStore() {
    // 새 매장은 「오픈 준비 중」으로 시작 — 주소·영업시간을 채우기 전에 「지금 영업 중」으로 보이지 않게
    content.stores.push({
      id: newStoreId(), name: '', shortName: '', address: '', hoursText: '', openHour: '', closeHour: '',
      phone: '', seatNote: '', access: '', mapQuery: '', naverPlace: '', orderUrl: '', status: 'soon'
    });
    rebuildPanel('store');
    var g = $('[data-store-group="' + (content.stores.length - 1) + '"]');
    if (g && g.scrollIntoView) g.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var f = g && $('input', g); if (f) f.focus();
    toast('빈 매장이 추가됐어요. 이름 · 주소 · 영업시간 · 주문 주소를 채우고 「저장하기」를 눌러 주세요.', 'ok');
  }
  function delStore(i) {
    var s = content.stores[i]; if (!s) return;
    if (content.stores.length <= 1) {
      toast('매장은 최소 한 곳이 있어야 해요. 잠시 감추려면 「노출 상태」를 「숨김」으로 바꿔 주세요.', 'err');
      return;
    }
    var nm = s.name || ('새 매장 ' + (i + 1));
    if (!confirm('「' + nm + '」을(를) 매장 목록에서 지울까요?\n「저장하기」를 누르면 사이트에서도 사라져요. 잠시만 감추려면 「노출 상태」를 「숨김」으로 바꾸는 편이 안전해요.')) return;
    content.stores.splice(i, 1);
    remapStoreImages(function (k) { return k === i ? null : k > i ? k - 1 : k; });
    rebuildPanel('store');
    toast('「' + nm + '」을(를) 지웠어요. 「저장하기」를 눌러야 사이트에 반영돼요.', 'ok');
  }
  function moveStore(i, d) {
    var j = i + d;
    if (j < 0 || j >= content.stores.length) return;
    var t = content.stores[i]; content.stores[i] = content.stores[j]; content.stores[j] = t;
    remapStoreImages(function (k) { return k === i ? j : k === j ? i : k; });
    rebuildPanel('store');
    var g = $('[data-store-group="' + j + '"]');
    if (g && g.scrollIntoView) g.scrollIntoView({ block: 'center' });
  }

  /* ── 입력 바인딩 ── */
  function bindInputs(root) {
    $$('[data-path]', root).forEach(function (el) {
      var path = el.getAttribute('data-path');
      var handler = function () {
        var v = el.value;
        if (el.getAttribute('data-kind') === 'price') {
          var n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
          if (isNaN(n)) { el.value = ''; return; }
          el.value = n.toLocaleString('ko-KR');
          v = n;
        }
        set(path, v);
        el.classList.toggle('changed', JSON.stringify(v) !== JSON.stringify(get(path, original)));
        refreshDirty();
      };
      el.addEventListener('input', handler);
      if (el.tagName === 'SELECT') el.addEventListener('change', handler);
    });
    $$('[data-img-path]', root).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var path = inp.getAttribute('data-img-path');
        var f = inp.files && inp.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) { toast('이미지 파일만 올릴 수 있어요 (jpg · png · webp).', 'err'); inp.value = ''; return; }
        if (f.size > MAX_IMG) { toast('사진이 2.5MB를 넘어요. 크기를 줄여서 다시 골라 주세요.', 'err'); inp.value = ''; return; }
        if (pendingImages[path]) URL.revokeObjectURL(pendingImages[path].url);
        pendingImages[path] = { file: f, url: URL.createObjectURL(f) };
        // 같은 사진이 여러 곳(메뉴 탭·사진 탭)에 보이므로 전부 갱신
        $$('[data-photo="' + path + '"]').forEach(function (box) { box.classList.add('pending'); box.classList.remove('empty'); $('img', box).src = pendingImages[path].url; });
        $$('.photo-tile').forEach(function (tile) {
          var box = $('[data-photo="' + path + '"]', tile); if (!box) return;
          var cap = $('figcaption', tile); var old = $('.undo', cap); if (old) old.remove();
          cap.insertAdjacentHTML('beforeend', undoBtn(path));
        });
        inp.value = '';
        refreshDirty();
        toast('사진이 바뀔 준비가 됐어요. 「저장하기」를 누르면 사이트에 올라가요.', 'ok');
      });
    });
  }

  /* 패널이 다시 그려져도 살아 있도록 #content에 한 번만 위임한다 */
  function bindDelegation() {
    $('#content').addEventListener('click', function (e) {
      var b = e.target.closest('[data-undo]');
      if (b) {
        var path = b.getAttribute('data-undo');
        if (pendingImages[path]) URL.revokeObjectURL(pendingImages[path].url);
        delete pendingImages[path];
        var cur = get(path);
        $$('[data-photo="' + path + '"]').forEach(function (box) {
          box.classList.remove('pending');
          var img = $('img', box);
          if (cur) { box.classList.remove('empty'); img.src = '../' + cur + '?ts=' + Date.now(); }
          else { box.classList.add('empty'); img.removeAttribute('src'); }
        });
        b.remove();
        refreshDirty();
        return;
      }
      if (e.target.closest('[data-store-add]')) { addStore(); return; }
      var del = e.target.closest('[data-store-del]');
      if (del) { delStore(+del.getAttribute('data-store-del')); return; }
      var up = e.target.closest('[data-store-up]');
      if (up) { moveStore(+up.getAttribute('data-store-up'), -1); return; }
      var dn = e.target.closest('[data-store-down]');
      if (dn) { moveStore(+dn.getAttribute('data-store-down'), 1); return; }
    });
  }

  /* ── 변경 추적 ── */
  var SECTION_PATHS = {
    home: /^(hero|weight\.(head|sub|caption|footnote)|fire|menuHighlight|insta|finalCta|brand|nav)\./,
    menu: /^menus\.\d+\.(name|desc|prices)/,
    store: /^(store|stores|storeSection|storeSelect|storesPage)\./,
    reviews: /^reviews\./,
    photos: /^(menus\.\d+\.img|menus\.\d+\.imgHome|weight\.tiers\.\d+\.img)$/,
    links: /^links\./,
    business: /^footer\./,
    pages: /^menuPage\./
  };
  function changedPaths() {
    var out = [];
    $$('[data-path]').forEach(function (el) {
      var p = el.getAttribute('data-path');
      if (JSON.stringify(get(p)) !== JSON.stringify(get(p, original))) out.push(p);
    });
    Object.keys(pendingImages).forEach(function (p) { out.push(p); });
    // 매장을 지우면 그 칸이 화면에서 사라져 위 비교로는 잡히지 않는다 — 목록 자체를 대조한다
    var ids = function (o) { return ((o && o.stores) || []).map(function (s) { return s.id; }).join('|'); };
    if (ids(content) !== ids(original)) out.push('stores._list');
    return out;
  }
  function isDirty() { return changedPaths().length > 0; }
  function refreshDirty() {
    if (saving) return;
    var paths = changedPaths();
    Object.keys(SECTION_PATHS).forEach(function (k) {
      var n = paths.filter(function (p) { return SECTION_PATHS[k].test(p); }).length;
      var el = $('[data-cnt="' + k + '"]'); if (el) el.textContent = n ? String(n) : '';
    });
    $('#save-btn').disabled = !paths.length;
    $('#revert-btn').disabled = !paths.length;
    if (paths.length) setStatus('dirty', '바뀐 곳 ' + paths.length + '개 · 아직 저장하지 않았어요');
    else if (!$('#savebar').classList.contains('ok')) setStatus('', '바뀐 내용이 없어요');
  }
  function revert() {
    if (!confirm('저장하지 않은 변경을 모두 되돌릴까요?')) return;
    Object.keys(pendingImages).forEach(function (p) { URL.revokeObjectURL(pendingImages[p].url); });
    pendingImages = {};
    content = JSON.parse(JSON.stringify(original));
    var active = ($('.panel.active') || {}).getAttribute ? $('.panel.active').getAttribute('data-panel') : 'home';
    buildPanels(); activate(active); refreshDirty();
    toast('저장 전 상태로 되돌렸어요.', 'ok');
  }

  /* ── 상태 표시 ── */
  function setStatus(kind, html) {
    var bar = $('#savebar');
    bar.className = 'savebar' + (kind ? ' ' + kind : '');
    $('#save-text').innerHTML = html;
  }

  /* ───────── 저장 (저장소 반영) ───────── */
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Authorization': 'Bearer ' + session.t, 'Accept': 'application/vnd.github+json' }, opts.headers || {});
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, opts).then(function (r) {
      if (r.status === 401 || r.status === 403 || (r.status === 404 && opts.method === 'PUT')) { var e = new Error('auth'); e.status = r.status === 404 ? 403 : r.status; throw e; }
      return r;
    });
  }
  function fileToB64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result.split(',')[1]); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  /* 파일별 최신 sha를 기억한다 — 저장 직후 GET이 잠시 옛 값을 돌려줘 충돌(409)이 나는 것을 막는다 */
  var knownSha = {};
  function fetchSha(path) {
    return api(path + '?ref=' + BRANCH + '&ts=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json().then(function (j) { return j.sha; }) : null;
    });
  }
  function putFile(path, b64, msg, retried) {
    var shaP = knownSha[path] ? Promise.resolve(knownSha[path]) : fetchSha(path);
    return shaP.then(function (sha) {
      var body = { message: msg, content: b64, branch: BRANCH };
      if (sha) body.sha = sha;
      return api(path, { method: 'PUT', body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 409 || r.status === 422) {
        if (retried) { var e = new Error('conflict'); e.status = 409; throw e; }
        delete knownSha[path];
        return fetchSha(path).then(function (sha) { knownSha[path] = sha; return putFile(path, b64, msg, true); });
      }
      if (!r.ok) { var e2 = new Error('put'); e2.status = r.status; throw e2; }
      return r.json().then(function (j) { if (j && j.content && j.content.sha) knownSha[path] = j.content.sha; return j; });
    });
  }
  function humanError(e) {
    if (e && e.status === 401 || e && e.status === 403) return '저장 권한을 확인할 수 없어요. 로그아웃 후 다시 로그인해 보세요. 계속 안 되면 개발 담당자에게 「관리자 계정 설정 갱신」을 요청해 주세요.';
    if (e && e.status === 409) return '다른 곳에서 먼저 저장된 내용이 있어요. 새로고침(F5)해서 최신 내용을 불러온 뒤 다시 고쳐 주세요.';
    if (e && e.status === 413) return '사진이 너무 커서 올리지 못했어요. 2.5MB 이하로 줄여서 다시 시도해 주세요.';
    if (e && e.status === 404) return '저장할 곳을 찾지 못했어요. 새로고침(F5) 후 다시 시도해 주세요.';
    if (e instanceof TypeError) return '인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대부분 해결돼요.';
    return '저장하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 개발 담당자에게 알려 주세요.';
  }
  function slug(path) {
    var parts = path.split('.');
    if (parts[0] === 'menus') return content.menus[+parts[1]].id + (parts[2] === 'imgHome' ? '_home' : '');
    if (parts[0] === 'weight') return 'size_' + content.weight.tiers[+parts[2]].grams.replace(/[^0-9]/g, '');
    if (parts[0] === 'stores') {
      var st = content.stores[+parts[1]];
      return 'store_' + ((st && st.id) || parts[1]) + '_' + parts[2].replace(/^photo/, '').toLowerCase();
    }
    return parts.join('_');
  }

  // store(단수)는 하위호환용 별칭 — 항상 stores[0]을 따른다
  function syncStoreAlias() {
    if (!content.stores || !content.stores[0]) return;
    if (!content.store) content.store = {};
    ['name', 'address', 'hoursText', 'openHour', 'closeHour', 'phone', 'seatNote', 'mapQuery'].forEach(function (k) {
      content.store[k] = content.stores[0][k];
    });
  }

  function save() {
    if (saving || !isDirty()) return;
    saving = true;
    var btn = $('#save-btn'); btn.disabled = true; btn.textContent = '저장 중…'; $('#revert-btn').disabled = true;
    var imgs = Object.keys(pendingImages), total = imgs.length + 1, done = 0;
    var progress = function (label) { setStatus('saving', label + (total > 1 ? ' (' + (done + 1) + '/' + total + ')' : '')); };
    var steps = Promise.resolve();
    imgs.forEach(function (path) {
      var f = pendingImages[path].file;
      var ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      var newPath = 'assets/cms/' + slug(path) + '_' + Date.now() + '.' + ext;
      steps = steps.then(function () { progress('사진 올리는 중…'); return fileToB64(f); })
        .then(function (b64) { return putFile(newPath, b64, '관리자: 사진 교체 (' + slug(path) + ')'); })
        .then(function () { set(path, newPath); done++; });
    });
    var rev = Date.now().toString(36);
    steps.then(function () {
      progress('저장 중…');
      syncStoreAlias();
      content._meta.updated = new Date().toISOString().slice(0, 10);
      content._meta.rev = rev;
      var json = JSON.stringify(content, null, 2) + '\n';
      return putFile('content.json', btoa(unescape(encodeURIComponent(json))), '관리자: 내용 수정 (' + content._meta.updated + ')');
    }).then(function () {
      imgs.forEach(function (p) { URL.revokeObjectURL(pendingImages[p].url); });
      pendingImages = {};
      original = JSON.parse(JSON.stringify(content));
      $$('.changed').forEach(function (el) { el.classList.remove('changed'); });
      $$('.menu-photo.pending').forEach(function (b) { b.classList.remove('pending'); });
      $$('[data-undo]').forEach(function (b) { b.remove(); });
      Object.keys(SECTION_PATHS).forEach(function (k) { var el = $('[data-cnt="' + k + '"]'); if (el) el.textContent = ''; });
      saving = false;
      setStatus('ok', '저장 완료 ✓ 사이트에 반영되는 중이에요 (보통 1~2분)…');
      toast('저장했어요. 1~2분 뒤 사이트에서 새로고침하면 바뀐 내용이 보여요.', 'ok');
      watchDeploy(rev);
    }).catch(function (e) {
      saving = false;
      setStatus('err', humanError(e));
      toast(humanError(e), 'err');
      refreshDirty();
    }).finally(function () {
      btn.textContent = '저장하기';
      if (!saving) { btn.disabled = !isDirty(); $('#revert-btn').disabled = !isDirty(); }
    });
  }

  /* 저장 뒤 실제 사이트에 새 내용이 올라왔는지 확인해 알려 준다 */
  var deployTimer;
  function watchDeploy(rev) {
    clearTimeout(deployTimer);
    var started = Date.now();
    var tick = function () {
      fetch('../content.json?ts=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
        if (c && c._meta && c._meta.rev === rev) {
          if (!isDirty()) setStatus('ok', '사이트에 반영됐어요 ✓ <a href="../" target="_blank" rel="noopener">사이트에서 확인하기 ↗</a>');
          return;
        }
        if (Date.now() - started > 6 * 60e3) {
          if (!isDirty()) setStatus('ok', '저장은 됐어요 ✓ 반영이 조금 늦어지고 있어요 — 몇 분 뒤 사이트를 새로고침해 보세요.');
          return;
        }
        deployTimer = setTimeout(tick, 15000);
      }).catch(function () { deployTimer = setTimeout(tick, 15000); });
    };
    deployTimer = setTimeout(tick, 20000);
  }

  /* ── 토스트 ── */
  var toastTimer;
  function toast(msg, cls) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + (cls || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 5000);
  }

  /* ───────── 시작 ───────── */
  initLogin();
  bindDelegation();
  $('#logout-btn').addEventListener('click', logout);
  $('#save-btn').addEventListener('click', save);
  $('#revert-btn').addEventListener('click', revert);
  window.addEventListener('beforeunload', function (e) { if (content && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 's' && content) { e.preventDefault(); save(); } });

  session = readSession();
  if (session) openApp(); else showLogin();
})();
