# 카운터 팡팡 자동 테스트

게임 화면을 실제 브라우저(Playwright)로 열어서 확인하는 테스트예요. 게임 빌드에는 포함되지 않아요.

## 실행 방법 (Claude 작업 환경 기준)
```
npm run build
npx next start -p 3222 &          # 테스트용 서버 켜기
npm test                          # 문제 만들기 + 예전 저장값 변환 검사 (서버 필요 없음)
NODE_PATH=$(npm root -g) node tests/features.test.js   # 기능별 점검
NODE_PATH=$(npm root -g) node tests/games.test.js 100  # 자동 게임 100판
NODE_PATH=$(npm root -g) node tests/cloud.test.js      # 계정 연결 흐름 (가짜 로그인·가짜 서버 응답, 실제 서버 접속 없음)
```
- `CP_URL` 환경 변수로 다른 주소를 테스트할 수 있어요 (기본 `http://localhost:3222`).
- 결과는 ✅ / ❌ 로 출력돼요.
