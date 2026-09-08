/* 그릴박스 CMS 하이드레이션 — content.json이 SSOT.
   HTML에는 동일 값이 정적으로 구워져 있고(SEO·무JS 폴백), 로드 후 JSON 값으로 덮어쓴다.
   /admin/ 에서 content.json을 수정하면 배포 없이(정확히는 GitHub Pages 자동 반영 후) 사이트가 갱신된다.
   문구 SSOT: shared_inbox/results/grillbox_homepage_copy_ssot_20260908/COPY_SSOT.md (v2.0) */
(function () {
  var ROOT = document.body.getAttribute('data-root') || './';
  var SEL_KEY = 'gb_store';
  var won = function (n) { return n.toLocaleString('ko-KR') + '원'; };

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function tpl(s, vars) {
    return String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] == null ? m : vars[k];
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── 사업자 정보 ── */
  // 표기 순서 = 화면 노출 순서. 값이 빈 항목은 라벨째 그리지 않는다(라벨만 남는 일 방지).
  var BIZ_FIELDS = [
    ['companyName', '상호'],
    ['ceo', '대표자'],
    ['regNo', '사업자등록번호'],
    ['mailOrderNo', '통신판매업신고번호'],
    ['address', '주소'],
    ['phone', '대표전화'],
    ['email', '이메일'],
    ['privacyOfficer', '개인정보관리책임자'],
    ['etc', '']
  ];
  function bizValue(v) { return typeof v === 'string' ? v.trim() : ''; }
  // 매장 값이 있으면 그것을, 비어 있으면 본사(footer.business) 값을 쓴다 — 가맹점 사업자 표기 대응
  function mergeBiz(base, over) {
    var out = {};
    BIZ_FIELDS.forEach(function (f) {
      out[f[0]] = bizValue(over && over[f[0]]) || bizValue(base && base[f[0]]);
    });
    return out;
  }
  function renderBiz(node, biz) {
    if (!node) return;
    node.innerHTML = '';
    BIZ_FIELDS.forEach(function (f) {
      var v = bizValue(biz && biz[f[0]]);
      if (!v) return;
      var span = document.createElement('span');
      if (f[1]) { span.appendChild(el('b', null, f[1])); span.appendChild(document.createTextNode(' ')); }
      span.appendChild(document.createTextNode(v));
      node.appendChild(span);
    });
  }
  function bizNode(cls, biz) {
    var d = el('div', cls);
    renderBiz(d, biz);
    return d.childNodes.length ? d : null;
  }

  /* ── 매장 ── */
  // store(단수)는 stores[0] 별칭. 구 content.json(배열 없음)도 그대로 뜨게 양방향으로 채운다.
  function normalizeStores(c) {
    if (!Array.isArray(c.stores) || !c.stores.length) c.stores = c.store ? [c.store] : [];
    c.stores.forEach(function (s, i) { if (!s.id) s.id = 'store' + i; });
    return c.stores;
  }
  function visibleStores(c) {
    return c.stores.filter(function (s) { return s.status !== 'hidden'; });
  }
  function isOpenNow(s) {
    if (!s || !s.openHour || !s.closeHour) return false;
    try {
      var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      var mins = now.getHours() * 60 + now.getMinutes();
      var p = function (t) { var a = t.split(':'); return (+a[0]) * 60 + (+a[1]); };
      return mins >= p(s.openHour) && mins < p(s.closeHour);
    } catch (e) { return false; }
  }
  function storeStatusText(c, s) {
    var ss = c.storeSelect && c.storeSelect.card;
    if (s.status === 'soon') return (ss && ss.badgeSoon) || '오픈 준비 중';
    if (isOpenNow(s)) return (ss && ss.badgeOpen) || '지금 영업 중';
    return tpl((ss && ss.badgeClosedTpl) || '오늘 {openHour} 오픈', s);
  }
  function readSelected(c) {
    var list = visibleStores(c);
    if (!list.length) return null;
    var saved;
    try { saved = localStorage.getItem(SEL_KEY); } catch (e) { saved = null; }
    var hit = saved && list.filter(function (s) { return s.id === saved; })[0];
    return hit || list[0];
  }
  function writeSelected(id) {
    try { localStorage.setItem(SEL_KEY, id); } catch (e) { /* 저장 실패해도 선택 자체는 동작 */ }
  }
  // 매장이 1곳이면 선택 단계 없이 바로 주문 링크로 — 불필요한 단계는 전환을 깎는다
  function needsSelect(c) { return visibleStores(c).length > 1; }

  function hydrate(c) {
    normalizeStores(c);
    var sel = readSelected(c);
    if (sel) c.store = sel;

    document.querySelectorAll('[data-cms]').forEach(function (node) {
      var v = get(c, node.getAttribute('data-cms'));
      if (typeof v === 'number') v = String(v);
      if (typeof v !== 'string') return;
      if (v.indexOf('\n') >= 0) {
        node.innerHTML = '';
        v.split('\n').forEach(function (line, i) {
          if (i) node.appendChild(document.createElement('br'));
          node.appendChild(document.createTextNode(line));
        });
      } else node.textContent = v;
    });
    document.querySelectorAll('[data-cms-href]').forEach(function (node) {
      var key = node.getAttribute('data-cms-href');
      var v = get(c, key);
      // 주문·길찾기는 매장별 값이 우선 (links.* 는 하위호환 폴백)
      if (sel && key === 'links.order' && sel.orderUrl) v = sel.orderUrl;
      if (sel && key === 'links.naverPlace' && sel.naverPlace) v = sel.naverPlace;
      if (typeof v === 'string' && v) node.setAttribute('href', v);
    });
    document.querySelectorAll('[data-cms-src]').forEach(function (node) {
      var v = get(c, node.getAttribute('data-cms-src'));
      if (typeof v === 'string' && v) node.setAttribute('src', ROOT + v);
    });
    // data-store-tpl="속성|템플릿" — {name} 등 매장 값을 끼워 넣는다 (alt·aria 다매장 대응)
    if (sel) {
      document.querySelectorAll('[data-store-tpl]').forEach(function (node) {
        var parts = node.getAttribute('data-store-tpl').split('|');
        if (parts.length < 2) return;
        node.setAttribute(parts[0], tpl(parts.slice(1).join('|'), sel));
      });
      document.querySelectorAll('[data-store-tel]').forEach(function (node) {
        if (sel.phone) node.setAttribute('href', 'tel:' + sel.phone);
      });
      document.querySelectorAll('[data-store-src]').forEach(function (node) {
        var v = sel[node.getAttribute('data-store-src')];
        if (v) node.setAttribute('src', ROOT + v);
      });
    }

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
        var a = el('article', 'review-card');
        var q = el('span', 'qmark', '“'); q.setAttribute('aria-hidden', 'true');
        a.appendChild(q);
        a.appendChild(el('p', 'body', r.text));
        a.appendChild(el('p', 'src', r.visited + ' · ' + c.reviews.source));
        rv.appendChild(a);
      });
    }

    // /stores — 매장 블록 전수 렌더 (매장이 늘면 블록도 늘어난다)
    // 푸터는 모든 페이지 공통 — 각 페이지 <footer> 안 [data-render="footer-business"] 한 곳에서만 그린다
    renderBiz(document.querySelector('[data-render="footer-business"]'), c.footer && c.footer.business);

    renderStoreBlocks(c);
    renderStoresJsonLd(c);

    openBadges(c, sel);
    bindOrderCtas(c);
  }

  function menuCard(m, highlight) {
    var a = el('article', 'card');
    a.setAttribute('data-cat', m.cat);
    a.innerHTML =
      '<div class="thumb"><img loading="lazy" width="960" height="720"></div>' +
      '<div class="card-body"><h3></h3><p class="desc"></p>' +
      '<div class="price-row"><span class="price"></span></div>' +
      '<div class="size-rows"></div></div>';
    var img = a.querySelector('img');
    // 홈 대표 카드는 크롭 차등본(imgHome)을 우선 — 같은 상품컷이 /menu와 겹쳐 보이지 않게
    img.src = ROOT + ((highlight && m.imgHome) || m.img);
    img.alt = m.name + ' — 그릴박스';
    a.querySelector('h3').textContent = m.name;
    a.querySelector('.desc').textContent = m.desc;
    a.querySelector('.price').textContent = won(m.prices.base);
    var sr = a.querySelector('.size-rows');
    [['기본 200g', m.prices.base], ['2XL 300g', m.prices.xl2], ['3XL 500g', m.prices.xl3]].forEach(function (t) {
      sr.appendChild(el('span', 'size-row', t[0] + ' ' + won(t[1])));
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

  /* ── /stores 매장 블록 ── */
  function renderStoreBlocks(c) {
    var host = document.querySelector('[data-render="store-blocks"]');
    if (!host) return;
    var list = visibleStores(c);
    if (!list.length) return;
    host.innerHTML = '';
    var ss = c.storeSection || {};
    list.forEach(function (s) {
      var art = el('article', 'store-block');
      var photos = el('div', 'store-photos');
      [[s.photoExterior, s.name + ' 매장 외관 — 그릴박스'], [s.photoInterior, s.name + ' 1인 카운터석 — 그릴박스']].forEach(function (pair) {
        if (!pair[0]) return;
        var im = new Image();
        im.src = ROOT + pair[0]; im.alt = pair[1]; im.loading = 'lazy';
        im.width = 2528; im.height = 1696;
        photos.appendChild(im);
      });
      art.appendChild(photos);

      var d = el('div', 'store-detail');
      var h2 = document.createElement('h2');
      h2.appendChild(el('span', null, s.name));
      h2.appendChild(document.createTextNode(' '));
      var badge = el('span', 'badge-open', storeStatusText(c, s));
      if (!isOpenNow(s)) badge.classList.add('badge-closed');
      h2.appendChild(badge);
      d.appendChild(h2);

      [['주소', s.address], ['영업시간', s.hoursText]].forEach(function (row) {
        var r = el('div', 'info-row');
        r.appendChild(el('span', 'k', row[0]));
        r.appendChild(el('span', null, row[1]));
        d.appendChild(r);
      });
      var rp = el('div', 'info-row');
      rp.appendChild(el('span', 'k', '전화'));
      var tel = el('a', null, s.phone); tel.href = 'tel:' + s.phone;
      rp.appendChild(tel);
      d.appendChild(rp);
      if (s.access) {
        var ra = el('div', 'info-row');
        ra.appendChild(el('span', 'k', '가는 길'));
        ra.appendChild(el('span', null, s.access));
        d.appendChild(ra);
      }
      if (s.seatNote) {
        var p = document.createElement('p');
        p.appendChild(el('span', 'seat-tag', s.seatNote));
        d.appendChild(p);
      }
      var row = el('div', 'btn-row');
      row.appendChild(extLink('btn btn-red', s.naverPlace, ss.ctaDirections || '길찾기'));
      var call = el('a', 'btn btn-outline', ss.ctaCall || '전화하기');
      call.href = 'tel:' + s.phone;
      row.appendChild(call);
      row.appendChild(extLink('btn btn-outline', s.orderUrl, '포장 주문하기'));
      d.appendChild(row);
      var sb = bizNode('store-biz', mergeBiz(c.footer && c.footer.business, s.business));
      if (sb) d.appendChild(sb);
      art.appendChild(d);
      host.appendChild(art);
    });
  }
  function extLink(cls, href, text) {
    var a = el('a', cls, text);
    a.href = href || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // /stores 구조화 데이터는 매장별 1건 — 매장을 추가하면 JSON-LD도 함께 늘어난다
  function renderStoresJsonLd(c) {
    var node = document.getElementById('stores-jsonld');
    if (!node) return;
    var origin = location.origin + ROOT.replace(/^\.\.\//, '/').replace(/^\.\//, '/');
    var list = visibleStores(c).map(function (s) {
      var d = {
        '@type': 'Restaurant',
        name: s.name,
        description: '주문받고 그때 직화로 굽는 스테이크 덮밥·파스타·카레·샐러드 전문점 그릴박스 ' + (s.shortName || s.name) + '.',
        servesCuisine: '한식 직화 스테이크 덮밥',
        address: addressOf(s),
        telephone: telOf(s.phone),
        openingHours: 'Mo-Su ' + s.openHour + '-' + s.closeHour,
        hasMap: s.naverPlace,
        hasMenu: origin.replace(/\/$/, '') + '/menu/',
        parentOrganization: { '@type': 'Organization', name: '그릴박스', url: 'https://grillbox.co.kr' }
      };
      if (s.photoExterior) d.image = origin.replace(/\/$/, '') + '/' + s.photoExterior;
      return d;
    });
    node.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': list }, null, 2);
  }
  function addressOf(s) {
    var m = /^(\S+)\s+(\S+구)\s+(.*)$/.exec(s.address || '');
    return {
      '@type': 'PostalAddress',
      streetAddress: m ? m[3] : (s.address || ''),
      addressLocality: m ? m[2] : '',
      addressRegion: m ? m[1] : '',
      addressCountry: 'KR'
    };
  }
  function telOf(phone) {
    var digits = String(phone || '').replace(/[^0-9]/g, '');
    return digits ? '+82-' + digits.replace(/^0/, '').replace(/^(\d{3,4})(\d{3,4})(\d{4})$/, '$1-$2-$3') : '';
  }

  // 영업 중 뱃지 — KST 기준으로 실제 영업시간과 대조 (정적 사이트라 서버 없이 계산)
  function openBadges(c, sel) {
    if (!sel) return;
    var ss = c.storeSection || {};
    document.querySelectorAll('[data-open-badge]').forEach(function (b) {
      var open = isOpenNow(sel);
      b.textContent = open ? (ss.badgeOpen || '지금 영업 중') : tpl(ss.badgeClosedTpl || '오늘 {openHour} 오픈', sel);
      b.classList.toggle('badge-closed', !open);
    });
  }

  /* ── 매장 선택 (§7) — 매장 2곳 이상일 때만 개입 ── */
  function bindOrderCtas(c) {
    if (!needsSelect(c)) return;
    document.querySelectorAll('[data-cms-href="links.order"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openStoreSelect(c, function (s) { window.open(s.orderUrl || (c.links && c.links.order) || '#', '_blank', 'noopener'); });
      });
    });
  }

  var modal = null;
  function openStoreSelect(c, onPick) {
    var t = c.storeSelect; if (!t) return;
    if (!modal) modal = buildModal(c);
    modal.onPick = onPick;
    modal.render();
    modal.root.hidden = false;
    document.body.style.overflow = 'hidden';
    var s = modal.root.querySelector('.ssel-search');
    if (s) s.focus();
  }
  function closeStoreSelect() {
    if (!modal) return;
    modal.root.hidden = true;
    document.body.style.overflow = '';
  }

  function buildModal(c) {
    var t = c.storeSelect, tc = t.card;
    var root = el('div', 'ssel-back');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t.title);

    var box = el('div', 'ssel');
    var close = el('button', 'ssel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', t.closeAria);
    close.addEventListener('click', closeStoreSelect);
    box.appendChild(close);
    box.appendChild(el('h2', 'ssel-title', t.title));
    box.appendChild(el('p', 'ssel-sub', t.sub));

    var banner = el('div', 'ssel-banner');
    box.appendChild(banner);

    var search = el('input', 'ssel-search');
    search.type = 'search';
    search.placeholder = t.searchPlaceholder;
    search.setAttribute('aria-label', t.searchAria);
    box.appendChild(search);

    var notice = el('p', 'ssel-notice', t.locationNotice);
    notice.hidden = true;
    var nearby = el('button', 'ssel-nearby', t.nearbyCta);
    nearby.type = 'button';
    // 좌표(lat/lng)가 있는 매장이 없으면 거리순 정렬 자체가 불가 — 버튼을 감춘다
    var geoReady = c.stores.some(function (s) { return s.lat && s.lng; });
    if (!geoReady) nearby.hidden = true;
    box.appendChild(nearby);
    box.appendChild(notice);

    var tabs = el('div', 'ssel-tabs');
    var tabAll = el('button', 'ssel-tab active', t.tabAll);
    var tabOpen = el('button', 'ssel-tab', t.tabOpen);
    [tabAll, tabOpen].forEach(function (b) { b.type = 'button'; tabs.appendChild(b); });
    box.appendChild(tabs);

    var count = el('p', 'ssel-count');
    box.appendChild(count);
    var list = el('ul', 'ssel-list');
    list.setAttribute('aria-label', t.listAria);
    box.appendChild(list);
    var empty = el('div', 'ssel-empty');
    box.appendChild(empty);
    box.appendChild(el('p', 'ssel-foot', t.footnote));
    root.appendChild(box);
    document.body.appendChild(root);

    var state = { q: '', tab: 'all', coords: null };
    var api = { root: root, onPick: null };

    function pick(s) {
      writeSelected(s.id);
      c.store = s;
      closeStoreSelect();
      if (api.onPick) api.onPick(s);
    }

    function card(s) {
      var li = document.createElement('li');
      var b = el('div', 'ssel-card');
      b.setAttribute('aria-label', tpl(tc.ariaTpl, { name: s.name, status: storeStatusText(c, s) }));
      if (s.photoExterior) {
        var im = new Image();
        im.src = ROOT + s.photoExterior; im.alt = ''; im.setAttribute('aria-hidden', 'true');
        im.className = 'ssel-thumb'; im.loading = 'lazy';
        b.appendChild(im);
      }
      var body = el('div', 'ssel-body');
      var head = el('div', 'ssel-head');
      head.appendChild(el('strong', null, s.name));
      var badge = el('span', 'badge-open', storeStatusText(c, s));
      if (s.status === 'soon' || !isOpenNow(s)) badge.classList.add('badge-closed');
      head.appendChild(badge);
      body.appendChild(head);
      body.appendChild(el('p', 'ssel-addr', s.address));
      var meta = tpl(tc.hoursTpl || '{hoursText}', s);
      if (state.coords && s.lat && s.lng) meta += ' · ' + tpl(tc.distanceTpl, { distance: distanceText(state.coords, s) });
      body.appendChild(el('p', 'ssel-meta', meta));
      if (s.seatNote) body.appendChild(el('p', 'ssel-seat', s.seatNote));

      var row = el('div', 'ssel-actions');
      var soon = s.status === 'soon';
      var main = el('button', 'btn btn-red ssel-cta', soon ? tc.ctaSoon : tc.cta);
      main.type = 'button';
      main.addEventListener('click', function () {
        if (soon) { window.open(c.links.instagram, '_blank', 'noopener'); return; }
        pick(s);
      });
      row.appendChild(main);
      if (!soon) {
        row.appendChild(extLink('ssel-sub-link', s.naverPlace, tc.subDirections));
        var call = el('a', 'ssel-sub-link', tc.subCall);
        call.href = 'tel:' + s.phone;
        row.appendChild(call);
      }
      body.appendChild(row);
      b.appendChild(body);
      li.appendChild(b);
      return li;
    }

    function matches(s) {
      var q = state.q.trim();
      if (q && (s.name + ' ' + s.address + ' ' + (s.shortName || '')).indexOf(q) < 0) return false;
      if (state.tab === 'open' && !isOpenNow(s)) return false;
      return true;
    }

    api.render = function () {
      var all = visibleStores(c);
      var shown = all.filter(matches);
      if (state.coords) {
        shown = shown.slice().sort(function (a, b) { return distance(state.coords, a) - distance(state.coords, b); });
      }
      // 이미 고른 매장이 있으면 상단에서 그대로 이어가게 — 매번 다시 고르게 하지 않는다
      banner.innerHTML = '';
      var cur = readSelected(c);
      if (cur && all.length > 1) {
        banner.appendChild(el('span', null, tpl(t.selectedTpl, cur)));
        var go = el('button', 'btn btn-red ssel-confirm', t.confirmCta);
        go.type = 'button';
        go.addEventListener('click', function () { pick(cur); });
        var chg = el('button', 'ssel-change', t.changeCta);
        chg.type = 'button';
        chg.addEventListener('click', function () { banner.hidden = true; search.focus(); });
        banner.appendChild(go);
        banner.appendChild(chg);
        banner.hidden = false;
      } else banner.hidden = true;

      count.textContent = tpl(t.countTpl, { n: shown.length });
      list.innerHTML = '';
      shown.forEach(function (s) { list.appendChild(card(s)); });
      empty.innerHTML = '';
      if (!shown.length) {
        empty.appendChild(el('h3', null, t.emptyTitle));
        empty.appendChild(el('p', null, t.emptyBody));
        var b2 = el('button', 'btn btn-outline', t.emptyCta);
        b2.type = 'button';
        b2.addEventListener('click', function () { state.q = ''; state.tab = 'all'; search.value = ''; syncTabs(); api.render(); });
        empty.appendChild(b2);
        empty.hidden = false;
      } else empty.hidden = true;
    };

    function syncTabs() {
      tabAll.classList.toggle('active', state.tab === 'all');
      tabOpen.classList.toggle('active', state.tab === 'open');
    }
    search.addEventListener('input', function () { state.q = search.value; api.render(); });
    tabAll.addEventListener('click', function () { state.tab = 'all'; syncTabs(); api.render(); });
    tabOpen.addEventListener('click', function () { state.tab = 'open'; syncTabs(); api.render(); });
    nearby.addEventListener('click', function () {
      notice.hidden = false;
      notice.textContent = t.locationNotice;
      if (!navigator.geolocation) { notice.textContent = t.errorBody; return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        notice.hidden = true;
        api.render();
      }, function () { notice.textContent = t.errorBody; });
    });
    root.addEventListener('click', function (e) { if (e.target === root) closeStoreSelect(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root.hidden) closeStoreSelect(); });
    return api;
  }

  function distance(c0, s) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (s.lat - c0.lat) * rad, dLng = (s.lng - c0.lng) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(c0.lat * rad) * Math.cos(s.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function distanceText(c0, s) {
    var km = distance(c0, s);
    return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km';
  }

  // 모바일 햄버거 — 링크 이동 시 자동 닫힘
  var hb = document.querySelector('.hamburger');
  var mnav = document.querySelector('.m-nav');
  if (hb && mnav) {
    hb.addEventListener('click', function () {
      var open = mnav.classList.toggle('open');
      hb.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      hb.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mnav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        mnav.classList.remove('open');
        hb.setAttribute('aria-label', '메뉴 열기');
        hb.setAttribute('aria-expanded', 'false');
      }
    });
  }

  fetch(ROOT + 'content.json?ts=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(hydrate)
    .catch(function () { /* JSON 로드 실패 시 정적 HTML 그대로 노출 */ });
})();
