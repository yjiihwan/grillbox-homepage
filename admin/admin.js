/* 그릴박스 콘텐츠 관리자 — content.json을 폼으로 수정하고 GitHub API로 커밋한다.
   보안 모델: 접근 암호는 열람 문턱일 뿐이고, 실제 쓰기 보호는 GitHub 토큰 인증이 전부다.
   토큰은 localStorage에만 있고 저장소에는 절대 커밋되지 않는다. */
(function () {
  var REPO = 'yjiihwan/grillbox-homepage';
  var BRANCH = 'main';
  var PASS_HASH = '7866a0eadd3d517cf581c72c6af57ff5bad4af6dcb269d30aa665d85adb9da94';

  var content = null;
  var dirty = false;
  var $ = function (s) { return document.querySelector(s); };

  /* ── 접근 게이트 ── */
  function sha256(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function tryGate() {
    sha256($('#gate-pass').value).then(function (h) {
      if (h === PASS_HASH) {
        sessionStorage.setItem('gb_admin_ok', '1');
        openEditor();
      } else {
        $('#gate-msg').style.display = 'block';
      }
    });
  }
  $('#gate-btn').addEventListener('click', tryGate);
  $('#gate-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryGate(); });
  if (sessionStorage.getItem('gb_admin_ok') === '1') openEditor();

  function openEditor() {
    $('#gate').style.display = 'none';
    $('#editor').style.display = 'block';
    var tok = localStorage.getItem('gb_admin_token');
    if (tok) $('#gh-token').value = tok;
    $('#gh-token').addEventListener('change', function () {
      localStorage.setItem('gb_admin_token', $('#gh-token').value.trim());
    });
    fetch('../content.json?ts=' + Date.now()).then(function (r) { return r.json(); }).then(function (c) {
      content = c;
      buildForm();
    }).catch(function () { toast('content.json을 불러오지 못했어요. 새로고침 해보세요.', 'err'); });
  }

  /* ── 데이터 경로 유틸 ── */
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, content); }
  function set(path, v) {
    var ks = path.split('.'); var o = content;
    for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v;
    markDirty();
  }
  function markDirty() { dirty = true; $('#dirty-dot').textContent = '수정됨 · 저장 필요'; }

  /* ── 폼 스키마 ── */
  var SECTIONS = [
    { title: '링크 (버튼 목적지)', hint: '바로 주문·길찾기·SNS 버튼이 여는 주소예요.', fields: [
      ['links.order', '바로 주문 링크 (네이버 주문)', 'url'],
      ['links.naverPlace', '길찾기 링크 (네이버 지도)', 'url'],
      ['links.instagram', '인스타그램', 'url'],
      ['links.kakao', '카카오톡 채널', 'url']] },
    { title: '홈 — 히어로 (첫 화면)', fields: [
      ['hero.h1', '큰 제목 (줄바꿈 유지)', 'textarea'],
      ['hero.sub', '부제', 'textarea'],
      ['hero.ctaStore', '버튼1 문구', 'text'],
      ['hero.ctaOrder', '버튼2 문구', 'text']] },
    { title: '홈 — 고기양 섹션', fields: [
      ['weight.head', '헤드라인', 'text'],
      ['weight.sub', '서브', 'text'],
      ['weight.caption', '사진 캡션', 'text'],
      ['weight.footnote', '각주(기준 표기)', 'text']] },
    { title: '홈 — 직화 섹션', fields: [
      ['fire.head', '헤드라인', 'text'],
      ['fire.body', '본문 (줄바꿈 유지)', 'textarea'],
      ['fire.caption', '사진 위 캡션', 'text']] },
    { title: '매장 정보', hint: '홈·매장 페이지에 함께 반영돼요.', fields: [
      ['store.name', '매장명', 'text'],
      ['store.address', '주소', 'text'],
      ['store.hoursText', '영업시간 표기', 'text'],
      ['store.openHour', '오픈 시각 (HH:MM — 영업중 뱃지 계산용)', 'text'],
      ['store.closeHour', '마감 시각 (HH:MM)', 'text'],
      ['store.phone', '전화번호', 'text'],
      ['store.seatNote', '좌석 한 줄 소개', 'text']] },
    { title: '리뷰', hint: '실제 고객 리뷰 원문만 넣어주세요 (창작 금지 — 표시광고 리스크).', fields: [
      ['reviews.head', '헤드라인', 'text'],
      ['reviews.source', '출처 표기', 'text'],
      ['reviews.tail', '하단 한 줄', 'text'],
      ['reviews.items.0.text', '리뷰 1', 'textarea'],
      ['reviews.items.0.visited', '리뷰 1 방문 시기', 'text'],
      ['reviews.items.1.text', '리뷰 2', 'textarea'],
      ['reviews.items.1.visited', '리뷰 2 방문 시기', 'text'],
      ['reviews.items.2.text', '리뷰 3', 'textarea'],
      ['reviews.items.2.visited', '리뷰 3 방문 시기', 'text']] },
    { title: '인스타·최종 CTA·푸터', fields: [
      ['insta.sub', '인스타 서브 (핸들 포함)', 'text'],
      ['finalCta.head', '최종 CTA 헤드라인', 'text'],
      ['finalCta.sub', '최종 CTA 서브', 'text'],
      ['footer.company', '푸터 사업자 표기', 'textarea'],
      ['footer.contact', '푸터 문의 문구', 'text']] },
    { title: '메뉴·매장 페이지 문구', fields: [
      ['menuPage.intro', '/menu 인트로', 'textarea'],
      ['menuPage.sizeNote', '/menu 사이즈 안내', 'text'],
      ['menuPage.origin', '/menu 원산지 안내', 'textarea'],
      ['storesPage.intro', '/stores 인트로', 'textarea'],
      ['storesPage.tail', '/stores 말미 문구', 'text']] }
  ];

  function fieldHtml(path, label, type) {
    var v = get(path); if (v == null) v = '';
    var esc = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    if (type === 'textarea') return '<label>' + label + '</label><textarea data-path="' + path + '">' + esc + '</textarea>';
    return '<label>' + label + '</label><input type="' + (type === 'url' ? 'url' : 'text') + '" data-path="' + path + '" value="' + esc + '">';
  }

  function buildForm() {
    var root = $('#form-root');
    var html = '';
    SECTIONS.forEach(function (sec) {
      html += '<div class="card"><h2>' + sec.title + '</h2>' + (sec.hint ? '<p class="hint">' + sec.hint + '</p>' : '');
      sec.fields.forEach(function (f) { html += fieldHtml(f[0], f[1], f[2]); });
      html += '</div>';
    });
    // 메뉴 16종
    html += '<div class="card"><h2>메뉴 (이름·설명·가격·사진)</h2><p class="hint">가격은 숫자만 입력하세요 (예: 8900). 사진 교체는 파일 선택 → 저장 시 함께 업로드돼요.</p>';
    content.menus.forEach(function (m, i) {
      var p = 'menus.' + i + '.';
      html += '<details class="menu-item"' + (i === 0 ? ' open' : '') + '><summary>' + m.name + '</summary>' +
        '<div class="mi-head" style="margin-top:10px"><img src="../' + m.img + '?ts=' + Date.now() + '" alt=""><span class="filebtn">사진 교체: <input type="file" accept="image/*" data-img-index="' + i + '"></span></div>' +
        fieldHtml(p + 'name', '메뉴명', 'text') +
        fieldHtml(p + 'desc', '한 줄 설명', 'text') +
        '<div class="grid3">' +
        '<div>' + fieldHtml(p + 'prices.base', '기본 200g 가격', 'number') + '</div>' +
        '<div>' + fieldHtml(p + 'prices.xl2', '2XL 300g 가격', 'number') + '</div>' +
        '<div>' + fieldHtml(p + 'prices.xl3', '3XL 500g 가격', 'number') + '</div>' +
        '</div></details>';
    });
    html += '</div>';
    root.innerHTML = html;

    root.querySelectorAll('[data-path]').forEach(function (el) {
      el.addEventListener('input', function () {
        var path = el.getAttribute('data-path');
        var v = el.value;
        if (/prices\.(base|xl2|xl3)$/.test(path)) {
          v = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
          if (isNaN(v)) return;
        }
        set(path, v);
      });
    });
    root.querySelectorAll('[data-img-index]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var i = +inp.getAttribute('data-img-index');
        var f = inp.files[0];
        if (!f) return;
        if (f.size > 2.5 * 1024 * 1024) { toast('이미지가 2.5MB를 넘어요. 줄여서 다시 올려주세요.', 'err'); inp.value = ''; return; }
        pendingImages[i] = f;
        markDirty();
        toast('사진이 담겼어요 — 「저장」을 누르면 함께 반영돼요.', 'ok');
      });
    });
    $('#save-btn').addEventListener('click', save);
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  var pendingImages = {}; // menuIndex -> File

  /* ── GitHub API 저장 ── */
  function gh(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Authorization': 'Bearer ' + localStorage.getItem('gb_admin_token'),
      'Accept': 'application/vnd.github+json'
    }, opts.headers || {});
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, opts);
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
    return gh(path + '?ref=' + BRANCH, {}).then(function (r) {
      return r.ok ? r.json().then(function (j) { return j.sha; }) : null;
    }).then(function (sha) {
      var body = { message: msg, content: b64, branch: BRANCH };
      if (sha) body.sha = sha;
      return gh(path, { method: 'PUT', body: JSON.stringify(body) }).then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || r.status); });
        return r.json();
      });
    });
  }

  function save() {
    var tok = localStorage.getItem('gb_admin_token');
    if (!tok) { toast('저장하려면 위에 GitHub 토큰을 먼저 넣어주세요.', 'err'); return; }
    var btn = $('#save-btn');
    btn.disabled = true; btn.textContent = '저장 중…';
    var steps = Promise.resolve();
    Object.keys(pendingImages).forEach(function (iStr) {
      var i = +iStr, f = pendingImages[i];
      var ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      var newPath = 'assets/cms/' + content.menus[i].id + '_' + Date.now() + '.' + ext;
      steps = steps.then(function () { return fileToB64(f); })
        .then(function (b64) { return putFile(newPath, b64, '관리자: ' + content.menus[i].name + ' 사진 교체'); })
        .then(function () { content.menus[i].img = newPath; });
    });
    steps.then(function () {
      content._meta.updated = new Date().toISOString().slice(0, 10);
      var json = JSON.stringify(content, null, 2);
      var b64 = btoa(unescape(encodeURIComponent(json)));
      return putFile('content.json', b64, '관리자: 콘텐츠 수정 (' + content._meta.updated + ')');
    }).then(function () {
      dirty = false; pendingImages = {};
      $('#dirty-dot').textContent = '';
      toast('저장 완료. 1~2분 뒤 사이트에 반영돼요 (반영 후 새로고침으로 확인).', 'ok');
    }).catch(function (e) {
      toast('저장 실패: ' + e.message + ' — 토큰 권한(Contents: Read and write)을 확인해 주세요.', 'err');
    }).finally(function () {
      btn.disabled = false; btn.textContent = '저장 (사이트 반영)';
    });
  }

  var toastTimer;
  function toast(msg, cls) {
    var el = $('#status');
    el.textContent = msg;
    el.className = 'status show ' + (cls || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'status'; }, 6000);
  }
})();
