const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createPathAccessGuard,
  isBlockedExecutablePath,
  isAllowedJsonPath,
  isAllowedPngPath,
  isTrustedSenderUrl,
  validateCleanPngBuffer,
} = require('./security.cjs');

const mainSource = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');

test('isTrustedSenderUrl accepts only the packaged noexif app origin', () => {
  assert.equal(isTrustedSenderUrl('noexif://app/index.html'), true);
  assert.equal(isTrustedSenderUrl('noexif://app/assets/index.js'), true);
  assert.equal(isTrustedSenderUrl('file:///C:/tmp/index.html'), false);
  assert.equal(isTrustedSenderUrl('https://example.com'), false);
});

test('packaged app protocol serves a restrictive content security policy', () => {
  assert.match(mainSource, /Content-Security-Policy/i);
  assert.match(mainSource, /default-src 'self'/);
  assert.match(mainSource, /script-src 'self'/);
  assert.match(mainSource, /style-src 'self' 'unsafe-inline'/);
  assert.match(mainSource, /img-src 'self' data: blob:/);
  assert.match(mainSource, /connect-src 'self'/);
  assert.match(mainSource, /object-src 'none'/);
});

test('browser window enables the renderer sandbox', () => {
  assert.match(mainSource, /sandbox:\s*true/);
});

test('path guard allows only remembered files or children of remembered directories', () => {
  const guard = createPathAccessGuard();
  const root = path.resolve('C:/Users/cdg/Pictures/No_EXIF_Export_2026-05-18_1200');
  const image = path.join(root, 'NOEXIF_photo.png');
  const outside = path.resolve('C:/Users/cdg/Desktop/photo.png');

  guard.rememberDirectory(root);

  assert.equal(guard.isAllowed(root), true);
  assert.equal(guard.isAllowed(image), true);
  assert.equal(guard.isAllowed(outside), false);

  guard.rememberPath(outside);
  assert.equal(guard.isAllowed(outside), true);
});

test('path guard blocks executable open targets even when inside an allowed directory', () => {
  const guard = createPathAccessGuard();
  const root = path.resolve('C:/Users/cdg/Pictures/No_EXIF_Export_2026-05-18_1200');
  const script = path.join(root, 'run.bat');

  guard.rememberDirectory(root);

  assert.equal(isBlockedExecutablePath(script), true);
  assert.equal(guard.isAllowedToOpen(script), false);
});

test('e2e shell open path reports success without opening Explorer', () => {
  const start = mainSource.indexOf("ipcMain.handle('shell:openPath'");
  const end = mainSource.indexOf("ipcMain.handle('shell:showItemInFolder'");
  const handlerSource = mainSource.slice(start, end);

  assert.match(handlerSource, /if\s*\(isE2ERun\(\)\)\s*return\s*\{\s*ok:\s*true,\s*e2e:\s*true\s*\}/);
  assert.ok(handlerSource.indexOf('isE2ERun()') < handlerSource.indexOf('shell.openPath'));
});

test('e2e shell show item reports success without revealing Explorer', () => {
  const start = mainSource.indexOf("ipcMain.handle('shell:showItemInFolder'");
  const end = mainSource.indexOf("ipcMain.handle('metadata:saveJson'");
  const handlerSource = mainSource.slice(start, end);

  assert.match(handlerSource, /if\s*\(isE2ERun\(\)\)\s*return\s*\{\s*ok:\s*true,\s*e2e:\s*true\s*\}/);
  assert.ok(handlerSource.indexOf('isE2ERun()') < handlerSource.indexOf('shell.showItemInFolder'));
});

test('metadata JSON save path must stay json', () => {
  assert.equal(isAllowedJsonPath('C:/Users/cdg/Documents/out.metadata.json'), true);
  assert.equal(isAllowedJsonPath('C:/Users/cdg/Documents/out.txt'), false);
});

test('prompt card output path must stay png', () => {
  assert.equal(isAllowedPngPath('C:/Users/cdg/Documents/PROMPT_CARD_photo.png'), true);
  assert.equal(isAllowedPngPath('C:/Users/cdg/Documents/PROMPT_CARD_photo.jpg'), false);
  assert.equal(isAllowedPngPath('C:/Users/cdg/Documents/PROMPT_CARD_photo.exe'), false);
});

test('validateCleanPngBuffer accepts PNG pixels and rejects hidden metadata chunks', () => {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1080, 0);
  ihdrData.writeUInt32BE(1350, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdr = pngChunk('IHDR', ihdrData);
  const idat = pngChunk('IDAT', Buffer.from([0]));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  const clean = Buffer.concat([signature, ihdr, idat, iend]);

  assert.deepEqual(validateCleanPngBuffer(clean), { width: 1080, height: 1350, chunks: ['IHDR', 'IDAT', 'IEND'] });
  assert.throws(
    () => validateCleanPngBuffer(Buffer.concat([signature, ihdr, pngChunk('eXIf', Buffer.from('secret')), iend])),
    /metadata chunk/i,
  );
  assert.throws(() => validateCleanPngBuffer(Buffer.from('not png')), /valid PNG/i);
});

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  return Buffer.concat([length, typeBuffer, data, crc]);
}
