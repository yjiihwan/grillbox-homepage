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
  // 주문은 매장 수와 무관하게 항상 매장 선택 단계를 거친다 — 다매장이 기본 전제(형 방침)
  function hasStores(c) { return visibleStores(c).length > 0; }
  // 실제로 사용자가 고른 적이 있는 매장만 — readSelected는 기본값(첫 매장)을 돌려주므로 확인 배너 판정엔 쓸 수 없다
  function savedStore(c) {
    var saved;
    try { saved = localStorage.getItem(SEL_KEY); } catch (e) { return null; }
    if (!saved) return null;
    return visibleStores(c).filter(function (s) { return s.id === saved; })[0] || null;
  }
  // 매장별 지도 — 전역 links.naverPlace 로 폴백하면 다른 매장 지도로 새므로 주소 검색으로 대체한다
  function storeMapUrl(s) {
    if (!s) return '';
    if (s.naverPlace) return s.naverPlace;
    var q = s.mapQuery || s.address || s.name;
    return q ? 'https://map.naver.com/p/search/' + encodeURIComponent(q) : '';
  }
  // 매장별 주문 링크 — 없으면 전역 links.order 대신 그 매장 상세로 보낸다(오주문 방지)
  function storeOrderUrl(s) { return (s && s.orderUrl) || ''; }
  function storeHref(id) { return ROOT + 'stores/?store=' + encodeURIComponent(id); }
  // 좌표는 관리자에서 문자열로 들어올 수 있다 — 빈 값·비수치는 거리 계산 대상에서 뺀다
  function hasGeo(s) { return !!s && s.lat !== '' && s.lng !== '' && isFinite(+s.lat) && isFinite(+s.lng); }

  function bindText(c, node) {
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
  }

  function hydrate(c) {
    normalizeStores(c);
    var sel = readSelected(c);
    if (sel) c.store = sel;

    document.querySelectorAll('[data-cms]').forEach(function (node) { bindText(c, node); });
    document.querySelectorAll('[data-cms-src]').forEach(function (node) {
      var v = get(c, node.getAttribute('data-cms-src'));
      if (typeof v === 'string' && v) node.setAttribute('src', ROOT + v);
    });
    applyStore(c, sel);

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

    renderStores(c);
    bindOrderCtas(c);
  }

  /* ── 선택 매장이 바뀌면 다시 그려야 하는 것들 ── */
  // 헤더 「매장 변경」·모달에서 매장을 고르면 링크·전화·배지·바를 그 자리에서 갱신한다(새로고침 없이)
  function applyStore(c, sel) {
    // store(단수)는 선택 매장의 별칭 — 갱신 후 store.* 텍스트를 다시 그려야 카드가 이전 매장으로 남지 않는다
    if (sel) {
      c.store = sel;
      document.querySelectorAll('[data-cms^="store."]').forEach(function (node) { bindText(c, node); });
    }
    document.querySelectorAll('[data-cms-href]').forEach(function (node) {
      var key = node.getAttribute('data-cms-href');
      var v = get(c, key);
      // 주문·길찾기는 반드시 매장별 값 — 매장이 있으면 전역 links.* 로 폴백하지 않는다
      if (sel && key === 'links.order') v = storeOrderUrl(sel) || storeHref(sel.id);
      if (sel && key === 'links.naverPlace') v = storeMapUrl(sel) || v;
      if (typeof v === 'string' && v) node.setAttribute('href', v);
    });
    if (sel) {
      // data-store-tpl="속성|템플릿" — {name} 등 매장 값을 끼워 넣는다 (alt·aria 다매장 대응)
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
    openBadges(c, sel);
    renderStoreBar(c, sel);
    renderHomeStores(c, sel);
  }

  /* ── 헤더·푸터 「현재 매장 ○○점 (변경)」 ──
     2026-09-09 형 지시로 상단 바를 걷어냈다. 매장을 바꿔도 «보이는 화면»은 거의 그대로였고
     (홈의 매장 카드 1블록·매장 페이지 사진뿐, 나머지는 href 속성) 매장이 1곳이라 노이즈였다.
     매장 선택은 «주문할 때»(bindOrderCtas)로 옮겼다 — 고를 이유가 생기는 시점이다.
     마크업은 제거했지만 함수는 남긴다: content.json 으로 바를 되살릴 여지를 두고,
     data-render 노드가 없으면 아무것도 하지 않는다(방어). */
  function renderStoreBar(c, sel) {
    var bar = document.querySelector('[data-render="store-bar"]');
    var foot = document.querySelector('[data-render="store-bar-foot"]');
    var t = (c.storeBar) || {};
    // 바 마크업이 없으면(2026-09-09 제거) 노출도 없고 여백 보정도 없어야 한다 —
    // has-storebar 는 앵커 스크롤 여백(110px)을 주는 클래스라, 바 없이 붙으면 헛여백이 생긴다.
    var multi = !!sel && !!bar;
    document.body.classList.toggle('has-storebar', multi);
    if (bar) {
      bar.hidden = !multi;
      bar.innerHTML = '';
      if (multi) {
        var inn = el('div', 'store-bar-in');
        inn.appendChild(el('span', 'k', (t.label || '현재 매장') + ' '));
        inn.appendChild(el('strong', null, sel.shortName || sel.name));
        var b = el('button', 'chg', t.changeCta || (c.storeSelect && c.storeSelect.changeCta) || '매장 변경');
        b.type = 'button';
        b.addEventListener('click', function () { openStoreSelect(c, null); });
        inn.appendChild(b);
        bar.appendChild(inn);
      }
    }
    if (foot) {
      foot.hidden = !multi;
      foot.innerHTML = '';
      if (multi) {
        foot.appendChild(document.createTextNode((t.label || '현재 매장') + ' '));
        foot.appendChild(el('strong', null, sel.shortName || sel.name));
        var b2 = el('button', 'chg', t.changeCta || '매장 변경');
        b2.type = 'button';
        b2.addEventListener('click', function () { openStoreSelect(c, null); });
        foot.appendChild(b2);
      }
    }
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

  /* ── /stores — 매장 목록 ↔ 매장 상세 ──
     매장 2곳 이상 + ?store= 없음 → 목록. ?store=<id> 또는 매장 1곳 → 상세(불필요한 단계 제거).
     개별 매장 LocalBusiness 스키마는 상세에서만 낸다 — 목록은 ItemList. */
  function storeParam() {
    var m = /[?&]store=([^&]*)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function renderStores(c) {
    var host = document.querySelector('[data-render="store-blocks"]');
    if (!host) return;
    var list = visibleStores(c);
    if (!list.length) { renderStoresEmpty(c, host); return; }
    var want = storeParam();
    var detail = list.filter(function (s) { return s.id === want; })[0] || (list.length === 1 ? list[0] : null);
    var listHost = document.querySelector('[data-render="store-list"]');
    var mapHost = document.querySelector('[data-render="store-map"]');
    var crumb = document.querySelector('[data-render="store-crumb"]');

    if (detail) {
      renderStoreBlocks(c, [detail]);
      if (listHost) { listHost.hidden = true; listHost.innerHTML = ''; }
      if (mapHost) { mapHost.hidden = false; applyStoreMap(mapHost, c, detail); }
      if (crumb) {
        crumb.hidden = list.length < 2;
        crumb.innerHTML = '';
        if (list.length > 1) {
          var a = el('a', null, (c.storeBar && c.storeBar.backCta) || '← 전체 매장');
          a.href = './';
          crumb.appendChild(a);
        }
      }
      renderStoresJsonLd(c, [detail]);
      return;
    }

    host.innerHTML = '';
    if (mapHost) mapHost.hidden = true;
    if (crumb) { crumb.hidden = true; crumb.innerHTML = ''; }
    if (listHost) {
      listHost.hidden = false;
      listHost.innerHTML = '';
      list.forEach(function (st) { listHost.appendChild(storeListCard(c, st)); });
    }
    renderStoresJsonLd(c, list, 'list');
  }
  // 보이는 매장이 0곳 — 노량진점 정적 폴백이 그대로 남지 않게 비우고 안내를 낸다
  function renderStoresEmpty(c, host) {
    var t = (c.storeSelect) || {};
    host.innerHTML = '';
    ['store-list', 'store-map', 'store-crumb'].forEach(function (k) {
      var n = document.querySelector('[data-render="' + k + '"]');
      if (n) { n.hidden = true; n.innerHTML = ''; }
    });
    var box = el('div', 'ssel-empty stores-empty');
    box.appendChild(el('h2', null, t.emptyTitle || '아직 이 지역엔 매장이 없어요'));
    box.appendChild(el('p', null, t.emptyBody || ''));
    if (c.links && c.links.instagram) box.appendChild(extLink('btn btn-outline', c.links.instagram, (c.insta && c.insta.cta) || '인스타그램 팔로우'));
    host.appendChild(box);
    var node = document.getElementById('stores-jsonld');
    if (node) node.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: 0, itemListElement: [] }, null, 2);
  }
  function applyStoreMap(mapHost, c, s) {
    var a = mapHost.querySelector('a');
    if (a) {
      var mu = storeMapUrl(s);
      if (mu) a.setAttribute('href', mu);
      a.setAttribute('aria-label', s.name + ' 위치를 네이버 지도에서 보기');
    }
    var im = mapHost.querySelector('img');
    if (im) {
      if (s.mapImg) im.setAttribute('src', ROOT + s.mapImg);
      im.setAttribute('alt', s.name + ' 위치 지도');
    }
  }
  function storeListCard(c, s, href) {
    var a = el('a', 'store-list-card');
    a.href = href || ('./?store=' + encodeURIComponent(s.id));
    if (s.photoExterior) {
      var im = new Image();
      im.src = ROOT + s.photoExterior; im.alt = ''; im.setAttribute('aria-hidden', 'true');
      im.loading = 'lazy'; im.width = 2528; im.height = 1696;
      a.appendChild(im);
    }
    var body = el('div', 'store-list-body');
    var head = el('div', 'store-list-head');
    head.appendChild(el('h2', null, s.name));
    var badge = el('span', 'badge-open', storeStatusText(c, s));
    if (s.status === 'soon' || !isOpenNow(s)) badge.classList.add('badge-closed');
    head.appendChild(badge);
    body.appendChild(head);
    body.appendChild(el('p', 'addr', s.address));
    body.appendChild(el('p', 'meta', s.hoursText));
    body.appendChild(el('p', 'more', (c.storesPage && c.storesPage.moreCta) || '매장 상세 보기 →'));
    a.appendChild(body);
    return a;
  }

  /* ── 홈 H5 — 매장이 2곳 이상이면 대표(선택) 매장 아래에 전 매장 목록을 함께 낸다 ── */
  function renderHomeStores(c, sel) {
    var host = document.querySelector('[data-render="home-store-list"]');
    if (!host) return;
    var list = visibleStores(c);
    host.innerHTML = '';
    host.hidden = list.length < 2;
    if (list.length < 2) return;
    list.forEach(function (s) {
      var card = storeListCard(c, s, storeHref(s.id));
      if (sel && s.id === sel.id) card.classList.add('is-current');
      host.appendChild(card);
    });
  }

  function renderStoreBlocks(c, list) {
    var host = document.querySelector('[data-render="store-blocks"]');
    if (!host) return;
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

      // 값이 빈 칸은 라벨째 그리지 않는다 — 새 매장을 덜 채운 상태로 추가해도 빈 행이 남지 않게
      [['주소', s.address], ['영업시간', s.hoursText]].forEach(function (row) {
        if (!row[1]) return;
        var r = el('div', 'info-row');
        r.appendChild(el('span', 'k', row[0]));
        r.appendChild(el('span', null, row[1]));
        d.appendChild(r);
      });
      if (s.phone) {
        var rp = el('div', 'info-row');
        rp.appendChild(el('span', 'k', '전화'));
        var tel = el('a', null, s.phone); tel.href = 'tel:' + s.phone;
        rp.appendChild(tel);
        d.appendChild(rp);
      }
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
      var mu = storeMapUrl(s);
      if (mu) row.appendChild(extLink('btn btn-red', mu, ss.ctaDirections || '길찾기'));
      if (s.phone) {
        var call = el('a', 'btn btn-outline', ss.ctaCall || '전화하기');
        call.href = 'tel:' + s.phone;
        row.appendChild(call);
      }
      // 주문 링크가 없는 매장은 버튼을 아예 내지 않는다 — 다른 매장 주문 화면으로 새면 오주문
      if (storeOrderUrl(s)) row.appendChild(extLink('btn btn-outline', s.orderUrl, '포장 주문하기'));
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
  function renderStoresJsonLd(c, stores, mode) {
    var node = document.getElementById('stores-jsonld');
    if (!node) return;
    var origin = location.origin + ROOT.replace(/^\.\.\//, '/').replace(/^\.\//, '/');
    if (mode === 'list') {
      // 목록 화면은 개별 매장 스키마를 내지 않는다 — 상세 페이지로 가는 ItemList만
      node.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: (c.storesPage && c.storesPage.h1) || '매장 안내',
        numberOfItems: stores.length,
        itemListElement: stores.map(function (s, i) {
          return { '@type': 'ListItem', position: i + 1, name: s.name, url: location.href.split(/[?#]/)[0] + '?store=' + encodeURIComponent(s.id) };
        })
      }, null, 2);
      return;
    }
    var list = stores.map(function (s) {
      var d = {
        '@type': 'Restaurant',
        name: s.name,
        description: '주문받고 그때 직화로 굽는 스테이크 덮밥·파스타·카레·샐러드 전문점 그릴박스 ' + (s.shortName || s.name) + '.',
        servesCuisine: '한식 직화 스테이크 덮밥',
        address: addressOf(s),
        hasMenu: origin.replace(/\/$/, '') + '/menu/',
        parentOrganization: { '@type': 'Organization', name: '그릴박스', url: 'https://grillbox.co.kr' }
      };
      // 빈 값은 아예 내지 않는다 — 덜 채워진 매장에서 잘못된 구조화 데이터가 나가지 않게
      if (s.phone) d.telephone = telOf(s.phone);
      if (s.openHour && s.closeHour) d.openingHours = 'Mo-Su ' + s.openHour + '-' + s.closeHour;
      var mu = storeMapUrl(s);
      if (mu) d.hasMap = mu;
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
  // 국가번호 표기 — 원 표기의 하이픈 묶음을 그대로 살린다. 숫자만 붙여 쓴 번호는 3-4-4로만 나눈다
  // (하이픈 없이 자릿수만 보고 나누면 0507-1234-5678 이 507-1234-5678 이 아니라 5071-234-5678 로 잘린다)
  function telOf(phone) {
    var raw = String(phone || '').replace(/[^0-9-]/g, '').replace(/^-+|-+$/g, '');
    if (!raw) return '';
    if (raw.indexOf('-') >= 0) return '+82-' + raw.replace(/^0/, '');
    // 하이픈 없는 번호는 국번(02 / 010 / 0507 / 070 / 지역 2자리)을 알아보고 나눈다
    var m = /^0(2|1[016-9]|50\d|70|80\d|\d{2})(\d{3,4})(\d{4})$/.exec(raw);
    return m ? '+82-' + m[1] + '-' + m[2] + '-' + m[3] : '+82-' + raw.replace(/^0/, '');
  }

  // 영업 중 뱃지 — KST 기준으로 실제 영업시간과 대조 (정적 사이트라 서버 없이 계산)
  // data-open-badge 는 "선택된 매장" 배지 전용. 매장별로 렌더되는 목록·블록 안 배지는 각자 계산하므로 건드리지 않는다.
  function openBadges(c, sel) {
    if (!sel) return;
    var ss = c.storeSection || {};
    document.querySelectorAll('[data-open-badge]').forEach(function (b) {
      if (b.closest('[data-render="store-blocks"], [data-render="store-list"], [data-render="home-store-list"]')) return;
      var open = isOpenNow(sel);
      b.textContent = open ? (ss.badgeOpen || '지금 영업 중') : tpl(ss.badgeClosedTpl || '오늘 {openHour} 오픈', sel);
      b.classList.toggle('badge-closed', !open);
    });
  }

  /* ── 매장 선택 (§7) — 매장 수와 무관하게 주문 CTA는 항상 선택 단계를 거친다 ── */
  function bindOrderCtas(c) {
    // 보이는 매장이 0곳(전 매장 휴점)이면 주문 링크는 숨겨진 매장으로 가면 안 된다 — 매장 안내로 보낸다
    if (!hasStores(c)) {
      document.querySelectorAll('[data-cms-href="links.order"]').forEach(function (a) {
        a.setAttribute('href', ROOT + 'stores/');
        a.removeAttribute('target');
      });
      return;
    }
    var list = visibleStores(c);
    var goto = function (s) {
      var url = storeOrderUrl(s);
      // 주문 링크가 없는 매장이면 그 매장 상세로 — 다른 매장 주문 화면으로 새지 않게
      if (url) window.open(url, '_blank', 'noopener');
      else location.href = storeHref(s.id);
    };
    document.querySelectorAll('[data-cms-href="links.order"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        // 매장이 1곳이면 고를 게 없다 — 모달을 띄우지 않고 바로 주문으로 보낸다.
        // 2곳 이상이 되면 여기서 선택 모달이 뜬다(코드 수정 없이 매장 등록만으로 전환).
        if (list.length === 1) { goto(list[0]); return; }
        openStoreSelect(c, goto);
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
    // 매장 1곳이면 검색창이 숨겨져 있다 — 실제로 보이는 첫 요소에 포커스
    var f = modal.root.querySelector('.ssel-search:not([hidden])') || modal.root.querySelector('.ssel-cta') || modal.root.querySelector('.ssel-close');
    if (f) f.focus();
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
    var geoReady = visibleStores(c).some(hasGeo);
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
      applyStore(c, s);
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
      if (state.coords && hasGeo(s)) meta += ' · ' + tpl(tc.distanceTpl, { distance: distanceText(state.coords, s) });
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
        var mu = storeMapUrl(s);
        if (mu) row.appendChild(extLink('ssel-sub-link', mu, tc.subDirections));
        if (s.phone) {
          var call = el('a', 'ssel-sub-link', tc.subCall);
          call.href = 'tel:' + s.phone;
          row.appendChild(call);
        }
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
        // 좌표 없는 매장은 뒤로 — NaN이 섞이면 정렬이 통째로 무너진다
        var dOf = function (s) { return hasGeo(s) ? distance(state.coords, s) : Infinity; };
        shown = shown.slice().sort(function (a, b) { return dOf(a) - dOf(b); });
      }
      // 매장이 1곳뿐이면 검색·탭·카운트는 군더더기 — 「이 매장으로 주문하기」 확인 단계만 남긴다
      var single = all.length < 2;
      search.hidden = single;
      tabs.hidden = single;
      count.hidden = single;
      nearby.hidden = single || !geoReady;

      // 실제로 고른 적이 있는 매장만 상단에서 이어가게 — 기본값(첫 매장)을 고른 것처럼 보이게 하지 않는다
      banner.innerHTML = '';
      var cur = savedStore(c);
      if (cur) {
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

  // 관리자에서 넣은 좌표는 문자열로 들어올 수 있다 — 숫자로 강제
  function distance(c0, s) {
    var R = 6371, rad = Math.PI / 180;
    var sLat = +s.lat, sLng = +s.lng;
    var dLat = (sLat - c0.lat) * rad, dLng = (sLng - c0.lng) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(c0.lat * rad) * Math.cos(sLat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
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
