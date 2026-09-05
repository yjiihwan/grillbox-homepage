/* 봉인 상자 — 저장 권한(비밀 값)을 관리자 비밀번호로 잠가 둔다.
   비밀번호 → PBKDF2-SHA256 → AES-256-GCM 키. 아이디는 GCM 추가 인증 데이터(AAD)라
   아이디·비밀번호 둘 중 하나만 틀려도 열리지 않는다. 저장소에는 암호문만 있다.
   브라우저(admin.js·setup.html)와 Node(tools/seal_auth.mjs)가 같은 파일을 쓴다. */
(function (root) {
  var subtle = root.crypto.subtle;
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var ITER = 310000;

  function b64(buf) {
    var s = ''; var a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s); var a = new Uint8Array(bin.length);
    for (var i = 0; i < a.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function normUser(u) { return String(u || '').trim().toLowerCase(); }

  function deriveKey(password, saltBytes, iter) {
    return subtle.importKey('raw', enc.encode(String(password).normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iter },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /* seal(user, password, secret) → 저장소에 둘 JSON 객체 */
  function seal(user, password, secret) {
    var salt = root.crypto.getRandomValues(new Uint8Array(16));
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(password, salt, ITER).then(function (key) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(normUser(user)) }, key, enc.encode(secret));
    }).then(function (ct) {
      return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct), user: normUser(user) };
    });
  }

  /* open(box, user, password) → secret 문자열 / 실패 시 null (아이디·비밀번호 불일치는 구분하지 않는다) */
  function open(box, user, password) {
    if (!box || !box.ct) return Promise.resolve(null);
    return deriveKey(password, unb64(box.salt), box.iter || ITER).then(function (key) {
      return subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(normUser(user)) }, key, unb64(box.ct));
    }).then(function (pt) { return dec.decode(pt); }).catch(function () { return null; });
  }

  function randomPassword(len) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 0/O/1/l/I 제외
    var out = ''; var r = root.crypto.getRandomValues(new Uint8Array(len || 20));
    for (var i = 0; i < r.length; i++) out += alphabet[r[i] % alphabet.length];
    return out;
  }

  root.GBSeal = { seal: seal, open: open, randomPassword: randomPassword, ITER: ITER };
})(typeof globalThis !== 'undefined' ? globalThis : window);
