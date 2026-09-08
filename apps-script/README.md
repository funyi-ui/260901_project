# HANEUL.LOG Apps Script 인증 API

## 설치

1. 스프레드시트에서 확장 프로그램, Apps Script를 엽니다.
2. Code.gs 내용을 Apps Script 편집기에 붙여 넣습니다.
3. 프로젝트 설정에서 appsscript.json 매니페스트 표시를 켜고 파일 내용을 교체합니다.
4. 함수 목록에서 setupAuth를 한 번 실행하고 권한을 승인합니다. 실행하지 않아도 첫 API 요청에서 자동 초기화됩니다.
5. users와 sessions 시트가 생성됐는지 확인합니다.
6. 배포, 새 배포, 웹 앱을 선택합니다.
7. 실행 사용자는 나, 액세스 권한은 모든 사용자로 설정합니다.
8. 발급된 /exec URL을 복사합니다.

## 요청 종류

- signup: name, email, password
- login: email, password, remember
- session: token
- logout: token

POST 본문은 JSON이며 GitHub Pages에서는 Content-Type을 text/plain;charset=utf-8로 전송합니다.

배포 후 /exec?action=diagnostic 주소를 열면 시트와 Script Properties 접근 상태를 확인할 수 있습니다.

## 주의사항

- users 시트를 공개하거나 공유하지 마세요.
- PASSWORD_PEPPER는 Script Properties에만 두고 프론트엔드에 넣지 마세요.
- 비밀번호 원문은 저장하지 않지만 전용 인증 서비스보다 보안 기능이 제한적입니다.
- 결제나 민감한 개인정보를 다루는 서비스에는 Firebase Authentication 같은 전용 인증을 사용하세요.
- 코드를 수정하면 배포 관리에서 새 버전으로 다시 배포해야 합니다.
