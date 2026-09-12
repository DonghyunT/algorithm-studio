/**
 * ==============================================================================
 * 🔑 [설정 템플릿] AI API 키 및 환경 설정 예시
 * ==============================================================================
 * [사용 방법]:
 * 1. 이 파일(config.example.js)을 복사하여 같은 위치에 'config.js'로 이름을 변경합니다.
 * 2. 아래 UPSTAGE_API_KEY에 발급받으신 Upstage Solar API 키를 입력합니다.
 * 3. 'config.js' 파일은 .gitignore에 등록되어 있으므로 GitHub에 절대 업로드되지 않습니다.
 * 
 * [Vercel 배포 시]:
 * - Vercel 대시보드 > Project Settings > Environment Variables에
 *   키 이름: UPSTAGE_API_KEY, 값: 선생님의_API_키 를 등록하시면
 *   api/chat.js 서버리스 함수를 통해 학생들에게 키를 숨긴 채 안전하게 배포됩니다.
 */
const UPSTAGE_API_KEY = "선생님의_UPSTAGE_API_키";
const SOLAR_MODEL = "solar-pro4";
