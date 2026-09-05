/* 그릴박스 CMS 하이드레이션 — content.json이 SSOT.
   HTML에는 동일 값이 정적으로 구워져 있고(SEO·무JS 폴백), 로드 후 JSON 값으로 덮어쓴다.
   /admin/ 에서 content.json을 수정하면 배포 없이(정확히는 GitHub Pages 자동 반영 후) 사이트가 갱신된다. */
(function () {
  var ROOT = document.body.getAttribute('data-root') || './';
  var won = function (n) { return n.toLocaleString('ko-KR') + '원'; };

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }

  function hydrate(c) {
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      var v = get(c, el.getAttribute('data-cms'));
      if (typeof v === 'string') {
        if (v.indexOf('\n') >= 0) {
          el.innerHTML = '';
          v.split('\n').forEach(function (line, i) {
            if (i) el.appendChild(document.createElement('br'));
            el.appendChild(document.createTextNode(line));
          });
        } else el.textContent = v;
      }
    });
    document.querySelectorAll('[data-cms-href]').forEach(function (el) {
      var v = get(c, el.getAttribute('data-cms-href'));
      if (typeof v === 'string' && v) el.setAttribute('href', v);
    });
    document.querySelectorAll('[data-cms-src]').forEach(function (el) {
      var v = get(c, el.getAttribute('data-cms-src'));
      if (typeof v === 'string' && v) el.setAttribute('src', ROOT + v);
    });

    // 홈 — 메뉴 하이라이트 3종
    var hl = document.querySelector('[data-render="menu-highlight"]');
    if (hl && c.menuHighlight && c.menus) {
      hl.innerHTML = '';
      c.menuHighlight.items.forEach(function (id) {
        var m = c.menus.find(function (x) { return x.id === id; });
        if (m) hl.appendChild(menuCard(m, true));
      });
    }

    // /menu — 전체 메뉴 그리드 + 카테고리 필터
    var grid = document.querySelector('[data-render="menu-grid"]');
    if (grid && c.menus) {
      grid.innerHTML = '';
      c.menus.forEach(function (m) { grid.appendChild(menuCard(m, false)); });
      var pills = document.querySelector('[data-render="menu-pills"]');
      if (pills && c.categories) {
        pills.innerHTML = '';
        c.categories.forEach(function (cat, i) {
          var b = document.createElement('button');
          b.className = 'pill' + (i === 0 ? ' active' : '');
          b.setAttribute('role', 'tab');
          b.setAttribute('data-cat', cat.id);
          b.textContent = cat.label;
          b.addEventListener('click', function () { filterCat(cat.id, pills, grid); });
          pills.appendChild(b);
        });
        filterCat(c.categories[0].id, pills, grid);
      }
    }

    // 홈 H7 리뷰
    var rv = document.querySelector('[data-render="reviews"]');
    if (rv && c.reviews) {
      rv.innerHTML = '';
      c.reviews.items.forEach(function (r) {
        var a = document.createElement('article');
        a.className = 'review-card';
        var q = document.createElement('span'); q.className = 'qmark'; q.setAttribute('aria-hidden', 'true'); q.textContent = '“';
        var b = document.createElement('p'); b.className = 'body'; b.textContent = r.text;
        var s = document.createElement('p'); s.className = 'src'; s.textContent = r.visited + ' · ' + c.reviews.source;
        a.appendChild(q); a.appendChild(b); a.appendChild(s);
        rv.appendChild(a);
      });
    }

    openBadges(c.store);
  }

  function menuCard(m, highlight) {
    var a = document.createElement('article');
    a.className = 'card';
    a.setAttribute('data-cat', m.cat);
    var alt = m.name + ' — 그릴박스';
    a.innerHTML =
      '<div class="thumb"><img loading="lazy" width="960" height="720"></div>' +
      '<div class="card-body"><h3></h3><p class="desc"></p>' +
      '<div class="price-row"><span class="price"></span></div>' +
      '<div class="size-rows"></div></div>';
    var img = a.querySelector('img');
    // 홈 대표 카드는 크롭 차등본(imgHome)을 우선 — 같은 상품컷이 /menu와 겹쳐 보이지 않게
    img.src = ROOT + ((highlight && m.imgHome) || m.img); img.alt = alt;
    a.querySelector('h3').textContent = m.name;
    a.querySelector('.desc').textContent = m.desc;
    a.querySelector('.price').textContent = won(m.prices.base);
    var sr = a.querySelector('.size-rows');
    [['기본 200g', m.prices.base], ['2XL 300g', m.prices.xl2], ['3XL 500g', m.prices.xl3]].forEach(function (t) {
      var row = document.createElement('span');
      row.className = 'size-row';
      row.textContent = t[0] + ' ' + won(t[1]);
      sr.appendChild(row);
    });
    return a;
  }

  function filterCat(catId, pills, grid) {
    pills.querySelectorAll('.pill').forEach(function (b) {
      var on = b.getAttribute('data-cat') === catId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    grid.querySelectorAll('.card').forEach(function (card) {
      card.style.display = card.getAttribute('data-cat') === catId ? '' : 'none';
    });
  }

  // 영업 중 뱃지 — KST 기준으로 실제 영업시간과 대조 (정적 사이트라 서버 없이 계산)
  function openBadges(store) {
    if (!store) return;
    var badges = document.querySelectorAll('[data-open-badge]');
    if (!badges.length) return;
    try {
      var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      var mins = now.getHours() * 60 + now.getMinutes();
      var p = function (s) { var t = s.split(':'); return (+t[0]) * 60 + (+t[1]); };
      var open = mins >= p(store.openHour) && mins < p(store.closeHour);
      badges.forEach(function (b) {
        b.textContent = open ? '지금 영업 중' : '오늘 ' + store.openHour + ' 오픈';
        b.classList.toggle('badge-closed', !open);
      });
    } catch (e) { /* 뱃지는 부가 정보 — 실패 시 정적 텍스트 유지 */ }
  }

  // 모바일 햄버거 — 링크 이동 시 자동 닫힘
  var hb = document.querySelector('.hamburger');
  var mnav = document.querySelector('.m-nav');
  if (hb && mnav) {
    hb.addEventListener('click', function () { mnav.classList.toggle('open'); });
    mnav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') mnav.classList.remove('open');
    });
  }

  fetch(ROOT + 'content.json?ts=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(hydrate)
    .catch(function () { /* JSON 로드 실패 시 정적 HTML 그대로 노출 */ });
})();
