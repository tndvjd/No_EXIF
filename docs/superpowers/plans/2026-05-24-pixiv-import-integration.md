# Pixiv Import Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pixiv_crawl` 프로젝트의 Pixiv 이미지 수집 기능을 No EXIF Pro 안에 "Pixiv 가져오기" 기능으로 통합한다.

**Architecture:** No EXIF Pro의 Electron/React 화면은 그대로 유지하고, Pixiv API/다운로드 처리는 Python 브리지 뒤에 붙인다. 쉽게 말하면 React는 운전석, Python은 엔진룸, Electron IPC는 운전석과 엔진룸을 연결하는 인터폰이다.

**Tech Stack:** Electron, React, Vite, Python, pixivpy3, requests, Pillow, Node test runner, unittest, Playwright/Electron QA.

---

## Product Direction

Pixiv 통합은 No EXIF Pro의 기존 역할을 해치지 않고 "이미지 소스 가져오기"로 붙인다.

1. **MVP:** Pixiv 사용자 ID/URL 입력 -> 작품 목록 조회 -> 다운로드 대상 선택 -> 지정 폴더에 다운로드 -> 앱 이미지 목록에 추가.
2. **확장:** 대량 다운로드 진행률, 실패 재시도, 중단, 이미 받은 파일 스킵, 메타데이터 탭/EXIF 제거 탭으로 보내기.
3. **나중:** 태그 검색, 북마크, 작가별 라이브러리, 다운로드 기록 DB.

## Safety Rules

- `C:\Users\cdg\Documents\pixiv_crawl\token.txt`는 복사하지 않는다.
- `C:\Users\cdg\Documents\pixiv_crawl\.venv`는 복사하지 않는다.
- `C:\Users\cdg\Documents\pixiv_crawl\downloads`는 앱 코드에 섞지 않는다.
- Refresh Token은 UI 입력 또는 `%APPDATA%\pixiv_crawl\refresh_token.txt` 같은 사용자 설정 위치에서만 읽는다.
- 다운로드 결과 이미지는 No EXIF Pro가 선택/생성한 폴더만 열 수 있게 `pathGuard`에 등록한다.

## File Structure

### Create

- `tools/pixiv_bridge.py`  
  Pixiv 로그인, 작품 목록 조회, 이미지 다운로드를 JSON 명령으로 처리한다.

- `tests/test_pixiv_bridge.py`  
  Pixiv URL 파싱, 헤더, 파일명, 결과 포맷, 토큰 미노출을 검증한다.

- `pro-ui/src/PixivImportMode.jsx`  
  Pixiv 가져오기 화면을 담당한다.

- `pro-ui/src/pixivImportUtils.js`  
  UI 상태 계산, 입력 정리, 결과 카운트 계산 같은 순수 함수를 담는다.

- `pro-ui/src/pixivImportUtils.test.mjs`  
  React 없이 빠르게 검증 가능한 JS 테스트.

### Modify

- `requirements.txt`  
  `pixivpy3`, `requests` 의존성을 No EXIF Pro 쪽 Python 환경에 추가한다.

- `electron/main.cjs`  
  `pixiv:list`, `pixiv:download`, `pixiv:chooseOutputDirectory` IPC를 추가한다.

- `electron/preload.cjs`  
  `window.noExif.listPixivWorks`, `window.noExif.downloadPixivWorks`, `window.noExif.choosePixivOutputDirectory`를 노출한다.

- `pro-ui/src/ModeRail.jsx`  
  좌측 레일에 "Pixiv 가져오기" 모드를 추가한다.

- `pro-ui/src/App.jsx`  
  새 모드 상태, 다운로드 결과를 기존 이미지 목록에 추가하는 흐름을 연결한다.

- `tools/electron_qa.cjs`  
  Pixiv 탭 진입과 기본 UI 표시를 확인한다. 실제 Pixiv 네트워크 호출은 기본 E2E에서 하지 않는다.

- `README.md`  
  Pixiv 기능 사용법, 토큰 보관 주의, 실행 방법을 갱신한다.

---

## Task 1: Isolate Pixiv Engine

**Files:**
- Create: `tools/pixiv_bridge.py`
- Create: `tests/test_pixiv_bridge.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add dependencies**

Add these lines to `requirements.txt` if missing:

```txt
pixivpy3==3.7.5
requests>=2.31.0
```

- [ ] **Step 2: Write failing tests for URL parsing and headers**

Create `tests/test_pixiv_bridge.py`:

```python
import os
import tempfile
import unittest
from unittest.mock import patch

from tools.pixiv_bridge import (
    IMAGE_REQUEST_HEADERS,
    extract_user_id,
    safe_output_name,
)


class PixivBridgeTests(unittest.TestCase):
    def test_extract_user_id_from_url(self):
        self.assertEqual(
            extract_user_id("https://www.pixiv.net/users/73211891/illustrations"),
            "73211891",
        )

    def test_extract_user_id_from_plain_id(self):
        self.assertEqual(extract_user_id(" 73211891 "), "73211891")

    def test_extract_user_id_rejects_invalid_input(self):
        self.assertIsNone(extract_user_id("https://example.com/users/123"))

    def test_download_headers_match_pixiv_app_request_shape(self):
        self.assertEqual(IMAGE_REQUEST_HEADERS["Referer"], "https://app-api.pixiv.net/")
        self.assertIn("PixivIOSApp", IMAGE_REQUEST_HEADERS["User-Agent"])

    def test_safe_output_name_removes_path_parts(self):
        self.assertEqual(safe_output_name("../bad/144721221.jpg"), "144721221.jpg")
```

- [ ] **Step 3: Run test and verify it fails**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_pixiv_bridge -v
```

Expected: FAIL because `tools.pixiv_bridge` does not exist yet.

- [ ] **Step 4: Implement minimal bridge helpers**

Create `tools/pixiv_bridge.py`:

```python
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

import requests
from pixivpy3 import AppPixivAPI


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_REQUEST_HEADERS = {
    "Referer": "https://app-api.pixiv.net/",
    "User-Agent": "PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)",
}


@dataclass
class DownloadResult:
    status: str
    file_name: str
    path: str
    size_bytes: int = 0
    message: str = ""


def extract_user_id(value):
    text = str(value or "").strip()
    if text.isdigit():
        return text
    parsed = urlparse(text)
    if parsed.netloc and parsed.netloc not in {"www.pixiv.net", "pixiv.net"}:
        return None
    match = re.search(r"/users/(\d+)", parsed.path)
    return match.group(1) if match else None


def safe_output_name(file_name):
    return os.path.basename(str(file_name or "").replace("\\", "/"))


def extension_from_url(image_url):
    extension = os.path.splitext(urlparse(str(image_url)).path)[1].lower()
    return extension if extension in IMAGE_EXTENSIONS else ".jpg"
```

- [ ] **Step 5: Run helper tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_pixiv_bridge -v
```

Expected: PASS.

---

## Task 2: Add JSON Commands for Pixiv List and Download

**Files:**
- Modify: `tools/pixiv_bridge.py`
- Modify: `tests/test_pixiv_bridge.py`

- [ ] **Step 1: Add tests for command result shape**

Append to `tests/test_pixiv_bridge.py`:

```python
from tools.pixiv_bridge import build_download_plan


class PixivPlanTests(unittest.TestCase):
    def test_build_download_plan_keeps_extensions(self):
        class Urls:
            original = "https://i.pximg.net/img-original/img/test/144721221.png"

        class Page:
            image_urls = Urls()

        class Illust:
            id = 144721221
            title = "sample"
            type = "illust"
            meta_single_page = None
            meta_pages = [Page()]

        plan = build_download_plan([Illust()])
        self.assertEqual(plan[0]["fileName"], "001_144721221_p0.png")
        self.assertEqual(plan[0]["illustId"], 144721221)
```

- [ ] **Step 2: Implement `build_download_plan`**

Add to `tools/pixiv_bridge.py`:

```python
def build_download_plan(illusts):
    downloads = []
    for order, illust in enumerate(illusts, start=1):
        if getattr(illust, "meta_single_page", None):
            image_url = illust.meta_single_page.get("original_image_url") or illust.image_urls.large
            downloads.append({
                "illustId": illust.id,
                "title": getattr(illust, "title", ""),
                "url": image_url,
                "fileName": f"{order:03d}_{illust.id}{extension_from_url(image_url)}",
            })
            continue
        for page_index, page in enumerate(getattr(illust, "meta_pages", []) or []):
            image_url = page.image_urls.original
            downloads.append({
                "illustId": illust.id,
                "title": getattr(illust, "title", ""),
                "url": image_url,
                "fileName": f"{order:03d}_{illust.id}_p{page_index}{extension_from_url(image_url)}",
            })
    return downloads
```

- [ ] **Step 3: Implement command dispatcher**

Add to `tools/pixiv_bridge.py`:

```python
class PixivService:
    def __init__(self, request_timeout=30):
        self.api = AppPixivAPI(timeout=request_timeout)
        self.request_timeout = request_timeout

    def login(self, refresh_token):
        self.api.auth(refresh_token=refresh_token)

    def list_user_works(self, user_id, limit=30):
        result = self.api.user_illusts(user_id)
        illusts = []
        while result is not None and len(illusts) < limit:
            for illust in result.illusts:
                if len(illusts) >= limit:
                    break
                if illust.type in ["illust", "manga"]:
                    illusts.append(illust)
            next_qs = self.api.parse_qs(result.next_url)
            if not next_qs:
                break
            result = self.api.user_illusts(**next_qs)
        return build_download_plan(illusts)

    def download_one(self, item, output_dir, retries=2):
        file_name = safe_output_name(item["fileName"])
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        target = Path(output_dir) / file_name
        if target.exists() and target.stat().st_size > 0:
            return DownloadResult("skipped", file_name, str(target), target.stat().st_size, "already exists")
        temp = target.with_suffix(target.suffix + ".part")
        last_error = ""
        for _attempt in range(retries + 1):
            try:
                response = requests.get(
                    item["url"],
                    headers=IMAGE_REQUEST_HEADERS,
                    stream=True,
                    timeout=self.request_timeout,
                )
                if response.status_code != 200:
                    raise RuntimeError(f"HTTP {response.status_code}")
                with open(temp, "wb") as output:
                    for chunk in response.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            output.write(chunk)
                if temp.stat().st_size <= 0:
                    raise RuntimeError("downloaded file is empty")
                os.replace(temp, target)
                return DownloadResult("downloaded", file_name, str(target), target.stat().st_size, "downloaded")
            except Exception as exc:
                last_error = str(exc)
                if temp.exists():
                    temp.unlink()
        return DownloadResult("failed", file_name, str(target), 0, last_error)


def read_payload():
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def write_payload(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    payload = read_payload()
    try:
        service = PixivService(request_timeout=int(payload.get("requestTimeout", 30)))
        token = payload.get("refreshToken") or os.environ.get("PIXIV_REFRESH_TOKEN", "")
        if not token:
            raise ValueError("Refresh token is required.")
        service.login(token)
        if command == "list":
            user_id = extract_user_id(payload.get("target", ""))
            if not user_id:
                raise ValueError("Valid Pixiv user URL or ID is required.")
            items = service.list_user_works(user_id, limit=int(payload.get("limit", 30)))
            write_payload({"ok": True, "userId": user_id, "items": items})
        elif command == "download":
            output_dir = payload.get("outputDir", "")
            results = [
                asdict(service.download_one(item, output_dir, retries=int(payload.get("retries", 2))))
                for item in payload.get("items", [])
            ]
            write_payload({"ok": True, "results": results})
        else:
            raise ValueError(f"Unknown command: {command}")
    except Exception as exc:
        write_payload({"ok": False, "error": str(exc)})
        raise SystemExit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run Python tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Expected: PASS.

---

## Task 3: Connect Electron IPC

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Test: `electron/security.test.cjs`

- [ ] **Step 1: Add a generic Pixiv bridge runner**

In `electron/main.cjs`, add near `runBridge`:

```js
function runPixivBridge(command, payload) {
  return new Promise((resolve, reject) => {
    const python = resolvePythonCommand();
    const child = spawn(
      python.command,
      [...python.argsPrefix, path.join(ROOT, 'tools', 'pixiv_bridge.py'), command],
      {
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', code => {
      try {
        const parsed = stdout ? JSON.parse(stdout) : {};
        if (code !== 0 || parsed.ok === false) {
          reject(new Error(parsed.error || stderr || `Pixiv bridge exited with code ${code}`));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Pixiv bridge returned invalid JSON: ${error.message}\n${stderr}`));
      }
    });
    child.stdin.write(JSON.stringify(payload || {}));
    child.stdin.end();
  });
}
```

- [ ] **Step 2: Add IPC handlers**

In `electron/main.cjs`, inside `app.whenReady().then(() => { ... })`:

```js
ipcMain.handle('pixiv:chooseOutputDirectory', async event => {
  assertTrustedSender(event);
  const result = await dialog.showOpenDialog({
    title: 'Pixiv 이미지를 저장할 폴더 선택',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return pathGuard.rememberDirectory(result.filePaths[0]);
});

ipcMain.handle('pixiv:list', async (event, payload) => {
  assertTrustedSender(event);
  return runPixivBridge('list', payload);
});

ipcMain.handle('pixiv:download', async (event, payload) => {
  assertTrustedSender(event);
  const outputDir = normalizePath(payload?.outputDir || '');
  if (!pathGuard.isAllowed(outputDir)) {
    throw new Error('Pixiv output directory was not selected in this session.');
  }
  const result = await runPixivBridge('download', { ...payload, outputDir });
  for (const item of result.results || []) {
    if (item.path) pathGuard.rememberPath(item.path);
  }
  return result;
});
```

- [ ] **Step 3: Expose functions in preload**

Add to `electron/preload.cjs`:

```js
choosePixivOutputDirectory: () => ipcRenderer.invoke('pixiv:chooseOutputDirectory'),
listPixivWorks: payload => ipcRenderer.invoke('pixiv:list', payload),
downloadPixivWorks: payload => ipcRenderer.invoke('pixiv:download', payload),
```

- [ ] **Step 4: Run JS tests**

Run:

```powershell
npm run test:js
```

Expected: PASS.

---

## Task 4: Add Pixiv Import UI

**Files:**
- Create: `pro-ui/src/PixivImportMode.jsx`
- Create: `pro-ui/src/pixivImportUtils.js`
- Create: `pro-ui/src/pixivImportUtils.test.mjs`
- Modify: `pro-ui/src/ModeRail.jsx`
- Modify: `pro-ui/src/App.jsx`
- Modify: `pro-ui/src/styles.css`

- [ ] **Step 1: Add utility tests**

Create `pro-ui/src/pixivImportUtils.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { countPixivResults, normalizePixivTarget } from './pixivImportUtils.js';

test('normalizePixivTarget trims input', () => {
  assert.equal(normalizePixivTarget(' 73211891 '), '73211891');
});

test('countPixivResults counts statuses', () => {
  assert.deepEqual(countPixivResults([
    { status: 'downloaded' },
    { status: 'skipped' },
    { status: 'failed' },
    { status: 'downloaded' },
  ]), { downloaded: 2, skipped: 1, failed: 1 });
});
```

- [ ] **Step 2: Add utility implementation**

Create `pro-ui/src/pixivImportUtils.js`:

```js
export function normalizePixivTarget(value) {
  return String(value || '').trim();
}

export function countPixivResults(results) {
  return (results || []).reduce((counts, item) => {
    if (item.status === 'downloaded') counts.downloaded += 1;
    else if (item.status === 'skipped') counts.skipped += 1;
    else if (item.status === 'failed') counts.failed += 1;
    return counts;
  }, { downloaded: 0, skipped: 0, failed: 0 });
}
```

- [ ] **Step 3: Add mode rail item**

Modify `pro-ui/src/ModeRail.jsx`:

```jsx
import { Download, Grid2X2, Search, Share2, ShieldCheck } from 'lucide-react';

export const modes = [
  { id: 'exif', label: 'EXIF 제거', shortLabel: 'EXIF 제거', icon: ShieldCheck },
  { id: 'grid', label: '그리드 생성', shortLabel: '그리드', icon: Grid2X2 },
  { id: 'metadata', label: '메타데이터', shortLabel: '메타데이터', icon: Search },
  { id: 'prompt-share', label: '프롬프트 공유', shortLabel: '프롬프트', icon: Share2 },
  { id: 'pixiv', label: 'Pixiv 가져오기', shortLabel: 'Pixiv', icon: Download },
];
```

- [ ] **Step 4: Create Pixiv import component**

Create `pro-ui/src/PixivImportMode.jsx`:

```jsx
import React from 'react';

export function PixivImportMode({
  pixivState,
  onChange,
  onChooseOutputDir,
  onListWorks,
  onDownload,
  onAddDownloadedImages,
  busy,
}) {
  const selectedCount = pixivState.items.filter(item => item.selected !== false).length;

  return (
    <section className="pixiv-mode">
      <div className="pixiv-panel">
        <h2>Pixiv 가져오기</h2>
        <label>
          Refresh Token
          <input
            type="password"
            value={pixivState.refreshToken}
            onChange={event => onChange({ refreshToken: event.target.value })}
            placeholder="Pixiv refresh token"
          />
        </label>
        <label>
          작가 URL 또는 ID
          <input
            value={pixivState.target}
            onChange={event => onChange({ target: event.target.value })}
            placeholder="https://www.pixiv.net/users/73211891/illustrations"
          />
        </label>
        <label>
          최대 작품 수
          <input
            type="number"
            min="1"
            max="200"
            value={pixivState.limit}
            onChange={event => onChange({ limit: Number(event.target.value) })}
          />
        </label>
        <button onClick={onListWorks} disabled={busy}>목록 불러오기</button>
      </div>

      <div className="pixiv-results">
        <div className="section-head">
          <h3>다운로드 대상</h3>
          <span>{selectedCount}장 선택</span>
        </div>
        <div className="pixiv-list">
          {pixivState.items.map((item, index) => (
            <label className="pixiv-row" key={`${item.illustId}-${item.fileName}`}>
              <input
                type="checkbox"
                checked={item.selected !== false}
                onChange={event => {
                  const items = pixivState.items.map((current, itemIndex) => (
                    itemIndex === index ? { ...current, selected: event.target.checked } : current
                  ));
                  onChange({ items });
                }}
              />
              <span>{item.fileName}</span>
              <small>{item.title}</small>
            </label>
          ))}
        </div>
      </div>

      <aside className="pixiv-inspector">
        <h3>저장</h3>
        <button onClick={onChooseOutputDir}>저장 폴더 선택</button>
        <p>{pixivState.outputDir || '저장 폴더를 선택하세요.'}</p>
        <button className="primary-action" onClick={onDownload} disabled={busy || !selectedCount}>
          선택 이미지 다운로드
        </button>
        <button onClick={onAddDownloadedImages} disabled={!pixivState.downloadedPaths.length}>
          다운로드한 이미지 앱에 추가
        </button>
      </aside>
    </section>
  );
}
```

- [ ] **Step 5: Wire state in App**

In `pro-ui/src/App.jsx`, import component:

```js
import { PixivImportMode } from './PixivImportMode.jsx';
import { countPixivResults, normalizePixivTarget } from './pixivImportUtils.js';
```

Add state:

```js
const [pixivState, setPixivState] = useState({
  refreshToken: '',
  target: '',
  limit: 30,
  outputDir: '',
  items: [],
  results: [],
  downloadedPaths: [],
});
```

Add handlers:

```js
function updatePixivState(patch) {
  setPixivState(current => ({ ...current, ...patch }));
}

async function choosePixivOutputDir() {
  const outputDir = await window.noExif.choosePixivOutputDirectory();
  if (outputDir) updatePixivState({ outputDir });
}

async function listPixivWorks() {
  setBusy(true);
  try {
    const result = await window.noExif.listPixivWorks({
      refreshToken: pixivState.refreshToken,
      target: normalizePixivTarget(pixivState.target),
      limit: pixivState.limit,
    });
    updatePixivState({ items: result.items.map(item => ({ ...item, selected: true })) });
    setToast({ tone: 'success', message: `Pixiv 목록 ${result.items.length}장을 불러왔습니다.` });
  } catch (error) {
    setToast({ tone: 'error', message: error.message || 'Pixiv 목록을 불러오지 못했습니다.' });
  } finally {
    setBusy(false);
  }
}

async function downloadPixivWorks() {
  setBusy(true);
  try {
    const selected = pixivState.items.filter(item => item.selected !== false);
    const result = await window.noExif.downloadPixivWorks({
      refreshToken: pixivState.refreshToken,
      outputDir: pixivState.outputDir,
      items: selected,
      retries: 2,
    });
    const counts = countPixivResults(result.results);
    updatePixivState({
      results: result.results,
      downloadedPaths: result.results
        .filter(item => item.status === 'downloaded' || item.status === 'skipped')
        .map(item => item.path),
    });
    setToast({ tone: 'success', message: `Pixiv 다운로드 완료 · 저장 ${counts.downloaded}장 · 스킵 ${counts.skipped}장` });
  } catch (error) {
    setToast({ tone: 'error', message: error.message || 'Pixiv 다운로드에 실패했습니다.' });
  } finally {
    setBusy(false);
  }
}

async function addDownloadedPixivImages() {
  await addImagePaths(pixivState.downloadedPaths);
  setActiveMode('metadata');
}
```

Render `PixivImportMode` for `activeMode === 'pixiv'`.

- [ ] **Step 6: Run JS tests**

Run:

```powershell
npm run test:js
```

Expected: PASS.

---

## Task 5: Add Styling and UX Polish

**Files:**
- Modify: `pro-ui/src/styles.css`
- Modify: `pro-ui/src/PixivImportMode.jsx`

- [ ] **Step 1: Add three-panel Pixiv layout**

Add CSS:

```css
.pixiv-mode {
  display: grid;
  grid-template-columns: 340px minmax(420px, 1fr) 340px;
  min-height: 100%;
  background: #0e1110;
}

.pixiv-panel,
.pixiv-results,
.pixiv-inspector {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
}

.pixiv-panel input,
.pixiv-inspector input {
  width: 100%;
  min-height: 40px;
  margin-top: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #121614;
  color: #f4f0e8;
}

.pixiv-list {
  display: grid;
  gap: 8px;
}

.pixiv-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.pixiv-row small {
  grid-column: 2;
  color: rgba(244, 240, 232, 0.58);
}
```

- [ ] **Step 2: Add empty and error states**

In `PixivImportMode.jsx`, show:

```jsx
{!pixivState.items.length && (
  <div className="empty-drop-card">
    <strong>Pixiv 작가 URL을 입력하면 다운로드 후보가 여기에 표시됩니다.</strong>
    <span>먼저 목록을 확인하고 필요한 이미지만 선택해 저장합니다.</span>
  </div>
)}
```

- [ ] **Step 3: Verify manually**

Run:

```powershell
npm run build
.\run.bat
```

Expected: Electron window opens, left rail has Pixiv mode, Pixiv mode renders without blank screen.

---

## Task 6: QA and Regression

**Files:**
- Modify: `tools/electron_qa.cjs`
- Modify: `README.md`

- [ ] **Step 1: Add E2E navigation check**

In `tools/electron_qa.cjs`, add a click for the Pixiv mode rail button and assert visible text:

```js
await page.locator('[data-mode="pixiv"]').click();
await expectText(page, 'Pixiv 가져오기');
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run verify
```

Expected:

- `npm run build` PASS
- `npm run test:js` PASS
- `npm run test:py` PASS
- `npm run test:e2e` PASS
- `npm audit --audit-level=high` PASS

- [ ] **Step 3: Manual Pixiv smoke test**

Only after the user provides or confirms a valid Refresh Token:

```powershell
.\run.bat
```

Manual checks:

- Pixiv 탭 진입
- 작가 URL 또는 ID 입력
- 목록 불러오기 성공
- 일부 이미지만 체크
- 다운로드 성공/스킵/실패 카운트 표시
- 다운로드한 이미지 앱에 추가
- 메타데이터 탭에서 이미지 표시
- EXIF 제거 탭으로 이동 후 저장 가능

---

## Recommended Implementation Order

1. Python 엔진 분리: Pixiv 기능을 독립적으로 테스트 가능하게 만든다.
2. Electron IPC 연결: 앱에서 Python 엔진을 부를 수 있게 한다.
3. React UI 추가: 새 탭을 만든다.
4. 다운로드 결과를 기존 이미지 목록에 연결한다.
5. QA와 문서화.

## Acceptance Criteria

- No EXIF Pro에서 "Pixiv 가져오기" 탭이 보인다.
- Pixiv 사용자 ID/URL에서 다운로드 후보 목록을 불러온다.
- 체크한 이미지만 다운로드한다.
- 이미 있는 파일은 스킵한다.
- 다운로드한 이미지를 No EXIF Pro의 기존 이미지 목록에 추가할 수 있다.
- 다운로드한 이미지는 메타데이터/EXIF 제거/그리드/프롬프트 공유 흐름에 들어갈 수 있다.
- Refresh Token은 로그, Toast, 테스트 출력에 노출되지 않는다.
- `npm run verify`가 통과한다.

## Known Risks

- Pixiv API/이미지 서버 정책은 바뀔 수 있다. `Referer`/`User-Agent` 헤더는 지금 확인된 방식이지만 장기적으로는 재검증이 필요하다.
- Refresh Token은 계정 열쇠와 같다. 앱에 저장 기능을 넣는다면 암호화 또는 OS 보안 저장소를 별도로 검토해야 한다.
- 대량 다운로드는 네트워크 작업이라 CPU보다 대기 시간이 병목이다. 쉽게 말해 컴퓨터가 느린 게 아니라 Pixiv 서버 응답과 다운로드 속도를 기다리는 시간이 크다.
- 현재 No EXIF Pro의 일부 한글 문자열이 깨져 보이는 파일이 있다. Pixiv 탭 구현 중 직접 만지는 파일은 UTF-8로 정리하되, 대규모 문자열 정리는 별도 작업으로 분리한다.

## Self-Review

- Spec coverage: Pixiv 세션 재사용, 토큰 안전, 다운로드 헤더, UI 탭, 기존 No EXIF 흐름 연결, QA를 포함했다.
- Placeholder scan: 구현을 미루는 TBD 항목 없이 각 작업에 파일과 명령을 지정했다.
- Type consistency: Python 결과는 `{ ok, items }`, `{ ok, results }`이고 React/Electron에서 같은 이름을 사용한다.

