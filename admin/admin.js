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
    { key: 'pages', ico: '📄', title: '기타 문구', short: '메뉴·매장 페이지·하단 표기', desc: '메뉴 페이지와 매장 페이지의 안내 문구, 사이트 맨 아래 사업자 표기예요.', preview: '../menu/' }
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
    else inner = '<input type="' + (opt.type === 'url' ? 'url' : opt.type === 'tel' ? 'tel' : 'text') + '" id="' + id + '" data-path="' + path + '" value="' + esc(v) + '"' + (opt.placeholder ? ' placeholder="' + esc(opt.placeholder) + '"' : '') + '>';
    return '<label class="field" for="' + id + '"><span>' + label + '</span>' + inner + help + '</label>';
  }
  function card(title, desc, where, body) {
    return '<div class="card"><div class="card-head"><div><h3>' + title + '</h3>' + (desc ? '<p class="desc">' + desc + '</p>' : '') + '</div>' +
      (where ? '<span class="where"><a href="' + where.href + '" target="_blank" rel="noopener">' + where.label + ' ↗</a></span>' : '') + '</div>' + body + '</div>';
  }
  function photoBox(path, label) {
    var src = pendingImages[path] ? pendingImages[path].url : '../' + get(path) + '?ts=' + Date.now();
    return '<div class="menu-photo' + (pendingImages[path] ? ' pending' : '') + '" data-photo="' + path + '"><img src="' + esc(src) + '" alt="' + esc(label) + '">' +
      '<label class="ph-btn">사진 바꾸기<input type="file" accept="image/*" data-img-path="' + path + '"></label></div>';
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
          '<div class="grid2">' + field('hero.ctaStore', '왼쪽 버튼 글자') + field('hero.ctaOrder', '오른쪽 버튼 글자') + '</div>') +
        card('고기양 소개', '200g · 300g · 500g 비교 사진이 있는 부분이에요.', { href: '../#weight', label: '이 부분 보기' },
          field('weight.head', '제목') + field('weight.sub', '소개 문구') + field('weight.caption', '사진 아래 설명') +
          field('weight.footnote', '작은 글씨 안내', { help: '가격·중량 기준을 밝히는 문구예요. 실제 판매 기준과 다르면 안 돼요.' })) +
        card('직화 소개', '불 위에서 굽는 사진이 있는 부분이에요.', { href: '../#fire', label: '이 부분 보기' },
          field('fire.head', '제목') + field('fire.body', '본문', { type: 'textarea', rows: 3, help: '줄바꿈이 그대로 반영돼요.' }) + field('fire.caption', '사진 위 짧은 문구')) +
        card('대표 메뉴 3종', '홈 화면에 크게 보여 줄 메뉴 3개를 고르세요. 이름·가격·사진은 「메뉴 · 가격」에서 고쳐요.', { href: '../#menu', label: '이 부분 보기' },
          field('menuHighlight.head', '제목') + field('menuHighlight.sub', '소개 문구') +
          '<div class="grid3">' + [0, 1, 2].map(function (i) {
            return '<label class="field" for="f_hl_' + i + '"><span>대표 메뉴 ' + (i + 1) + '</span><select id="f_hl_' + i + '" data-path="menuHighlight.items.' + i + '">' + menuOptions(content.menuHighlight.items[i]) + '</select></label>';
          }).join('') + '</div>') +
        card('인스타그램 소개', '', { href: '../#insta', label: '이 부분 보기' },
          field('insta.head', '제목') + field('insta.sub', '소개 문구', { help: '@계정이름을 함께 적어 두면 좋아요.' }) + field('insta.cta', '버튼 글자')) +
        card('마지막 안내 (맨 아래 큰 문구)', '', { href: '../#cta', label: '이 부분 보기' },
          field('finalCta.head', '제목') + field('finalCta.sub', '소개 문구'));
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
      return card('기본 정보', '', { href: '../stores/', label: '매장 페이지 보기' },
          field('store.name', '매장 이름') + field('store.address', '주소', { help: '지도도 이 주소로 표시돼요.' }) +
          '<div class="grid2">' + field('store.phone', '전화번호', { type: 'tel' }) + field('store.seatNote', '좌석 한 줄 소개') + '</div>') +
        card('영업시간', '「지금 영업 중」 표시는 오픈·마감 시각을 보고 자동으로 바뀌어요. 영업시간이 바뀌면 세 칸을 모두 고쳐 주세요.', null,
          field('store.hoursText', '화면에 보이는 영업시간 글', { placeholder: '예: 매일 11:00 – 21:50' }) +
          '<div class="grid2">' + field('store.openHour', '오픈 시각', { placeholder: '11:00', help: '시:분 형식 (예 11:00)' }) + field('store.closeHour', '마감 시각', { placeholder: '21:50', help: '시:분 형식 (예 21:50)' }) + '</div>') +
        card('매장 페이지 문구', '', { href: '../stores/', label: '매장 페이지 보기' },
          field('storesPage.intro', '맨 위 소개 문구', { type: 'textarea', rows: 2 }) + field('storesPage.tail', '맨 아래 한 줄'));
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
      html += card('메뉴 사진 (16장)', '메뉴 페이지와 홈 화면 대표 메뉴에 쓰여요. 가로로 긴 사진(4:3)이 잘 맞아요.', { href: '../menu/', label: '메뉴 페이지 보기' }, '<div class="photo-grid">' + tiles + '</div>');
      return html;
    },
    links: function () {
      return card('버튼이 여는 주소', '주소를 바꾼 뒤에는 저장 후 실제로 버튼을 눌러 잘 열리는지 꼭 확인해 주세요.', null,
        field('links.order', '「바로 주문」 버튼', { type: 'url', help: '네이버 주문 페이지 주소' }) +
        field('links.naverPlace', '「길찾기」 버튼', { type: 'url', help: '네이버 지도의 매장 페이지 주소' }) +
        field('links.instagram', '「인스타그램」 버튼', { type: 'url' }) +
        field('links.kakao', '「카카오톡 채널」 버튼', { type: 'url' }));
    },
    pages: function () {
      return card('메뉴 페이지 안내 문구', '', { href: '../menu/', label: '메뉴 페이지 보기' },
          field('menuPage.intro', '맨 위 소개 문구', { type: 'textarea', rows: 2 }) + field('menuPage.sizeNote', '사이즈 안내') +
          field('menuPage.origin', '원산지 안내', { type: 'textarea', rows: 2, help: '법정 원산지 표기 문구가 확정되면 여기에 넣어 주세요.' })) +
        card('사이트 맨 아래 (모든 페이지 공통)', '', { href: '../#cta', label: '이 부분 보기' },
          field('footer.company', '사업자 표기', { type: 'textarea', rows: 2, help: '상호 · 사업자등록번호 · 대표자 · 주소 등을 적어요.' }) +
          field('footer.contact', '문의 안내 한 줄') + field('footer.copyright', '저작권 표기'));
    }
  };
  function catLabel(id) { var c = content.categories.find(function (x) { return x.id === id; }); return c ? c.label : ''; }
  function undoBtn(path) { return pendingImages[path] ? '<button type="button" class="undo" data-undo="' + path + '">바꾸기 취소</button>' : ''; }

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
        $$('[data-photo="' + path + '"]').forEach(function (box) { box.classList.add('pending'); $('img', box).src = pendingImages[path].url; });
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
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-undo]'); if (!b) return;
      var path = b.getAttribute('data-undo');
      if (pendingImages[path]) URL.revokeObjectURL(pendingImages[path].url);
      delete pendingImages[path];
      $$('[data-photo="' + path + '"]').forEach(function (box) { box.classList.remove('pending'); $('img', box).src = '../' + get(path) + '?ts=' + Date.now(); });
      b.remove();
      refreshDirty();
    });
  }

  /* ── 변경 추적 ── */
  var SECTION_PATHS = {
    home: /^(hero|weight\.(head|sub|caption|footnote)|fire|menuHighlight|insta|finalCta)\./,
    menu: /^menus\.\d+\.(name|desc|prices)/,
    store: /^(store|storesPage)\./,
    reviews: /^reviews\./,
    photos: /^(menus\.\d+\.img|weight\.tiers\.\d+\.img)$/,
    links: /^links\./,
    pages: /^(menuPage|footer)\./
  };
  function changedPaths() {
    var out = [];
    $$('[data-path]').forEach(function (el) {
      var p = el.getAttribute('data-path');
      if (JSON.stringify(get(p)) !== JSON.stringify(get(p, original))) out.push(p);
    });
    Object.keys(pendingImages).forEach(function (p) { out.push(p); });
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
  function putFile(path, b64, msg) {
    return api(path + '?ref=' + BRANCH, {}).then(function (r) {
      return r.ok ? r.json().then(function (j) { return j.sha; }) : null;
    }).then(function (sha) {
      var body = { message: msg, content: b64, branch: BRANCH };
      if (sha) body.sha = sha;
      return api(path, { method: 'PUT', body: JSON.stringify(body) });
    }).then(function (r) {
      if (!r.ok) { var e = new Error('put'); e.status = r.status; throw e; }
      return r.json();
    });
  }
  function humanError(e) {
    if (e && e.status === 401 || e && e.status === 403) return '저장 권한을 확인할 수 없어요. 로그아웃 후 다시 로그인해 보세요. 계속 안 되면 개발 담당자에게 「관리자 계정 설정 갱신」을 요청해 주세요.';
    if (e && e.status === 409) return '다른 곳에서 먼저 저장된 내용이 있어요. 새로고침(F5)해서 최신 내용을 불러온 뒤 다시 고쳐 주세요.';
    if (e && (e.status === 413 || e.status === 422)) return '사진이 너무 커서 올리지 못했어요. 2.5MB 이하로 줄여서 다시 시도해 주세요.';
    if (e && e.status === 404) return '저장할 곳을 찾지 못했어요. 새로고침(F5) 후 다시 시도해 주세요.';
    if (e instanceof TypeError) return '인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대부분 해결돼요.';
    return '저장하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 개발 담당자에게 알려 주세요.';
  }
  function slug(path) {
    var parts = path.split('.');
    if (parts[0] === 'menus') return content.menus[+parts[1]].id;
    if (parts[0] === 'weight') return 'size_' + content.weight.tiers[+parts[2]].grams.replace(/[^0-9]/g, '');
    return parts.join('_');
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
  $('#logout-btn').addEventListener('click', logout);
  $('#save-btn').addEventListener('click', save);
  $('#revert-btn').addEventListener('click', revert);
  window.addEventListener('beforeunload', function (e) { if (content && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 's' && content) { e.preventDefault(); save(); } });

  session = readSession();
  if (session) openApp(); else showLogin();
})();
