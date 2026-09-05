#!/usr/bin/env node
/* 관리자 계정 봉인 생성기 (개발자용).
   사용: node tools/seal_auth.mjs <아이디> <비밀번호|-> <토큰파일|->  → admin/auth.json 생성
   비밀번호에 '-'를 주면 무작위 강한 비밀번호를 만들어 stdout에 한 번만 출력한다.
   토큰파일에 '-'를 주면 stdin에서 읽는다. 평문 토큰·비밀번호는 어디에도 기록하지 않는다. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(join(here, '..', 'admin', 'sealbox.js'));
const { GBSeal } = globalThis;

const [user, pwArg, tokArg] = process.argv.slice(2);
if (!user || !pwArg || !tokArg) {
  console.error('usage: node tools/seal_auth.mjs <user> <password|-> <tokenfile|->');
  process.exit(2);
}
const password = pwArg === '-' ? GBSeal.randomPassword(20) : pwArg;
const token = (tokArg === '-' ? readFileSync(0, 'utf8') : readFileSync(tokArg, 'utf8')).trim();
if (!token) { console.error('empty token'); process.exit(2); }

const box = await GBSeal.seal(user, password, token);
const out = join(here, '..', 'admin', 'auth.json');
writeFileSync(out, JSON.stringify(box, null, 2) + '\n');
const check = await GBSeal.open(box, user, password);
if (check !== token) { console.error('self-check failed'); process.exit(1); }
console.log(JSON.stringify({ written: 'admin/auth.json', user: box.user, password: pwArg === '-' ? password : '(given)', selfCheck: 'ok' }));
