const path = require('node:path');

const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.ps1', '.msi', '.com', '.scr', '.vbs', '.js', '.jar']);

function normalizePath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return '';
  return path.resolve(targetPath);
}

function isTrustedSenderUrl(url) {
  return typeof url === 'string' && url.startsWith('noexif://app/');
}

function isBlockedExecutablePath(targetPath) {
  const ext = path.extname(String(targetPath || '')).toLowerCase();
  return EXECUTABLE_EXTENSIONS.has(ext);
}

function isAllowedJsonPath(targetPath) {
  return path.extname(String(targetPath || '')).toLowerCase() === '.json';
}

function isAllowedPngPath(targetPath) {
  return path.extname(String(targetPath || '')).toLowerCase() === '.png';
}

function validateCleanPngBuffer(buffer, options = {}) {
  const maxBytes = options.maxBytes || 50 * 1024 * 1024;
  const maxDimension = options.maxDimension || 8000;
  const blockedChunks = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');

  if (data.length < 33 || !data.subarray(0, 8).equals(signature)) {
    throw new Error('Prompt card must be a valid PNG file.');
  }
  if (data.length > maxBytes) {
    throw new Error('Prompt card PNG is too large.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  const chunks = [];

  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > data.length) {
      throw new Error('Prompt card PNG is malformed.');
    }
    chunks.push(type);
    if (blockedChunks.has(type)) {
      throw new Error(`Prompt card PNG contains hidden metadata chunk: ${type}.`);
    }
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('Prompt card PNG has invalid IHDR chunk.');
      width = data.readUInt32BE(offset + 8);
      height = data.readUInt32BE(offset + 12);
      if (!width || !height || width > maxDimension || height > maxDimension) {
        throw new Error('Prompt card PNG dimensions are not allowed.');
      }
    }
    offset = chunkEnd;
    if (type === 'IEND') break;
  }

  if (chunks[0] !== 'IHDR' || !chunks.includes('IEND')) {
    throw new Error('Prompt card PNG is missing required chunks.');
  }

  return { width, height, chunks };
}

function createPathAccessGuard() {
  const allowedPaths = new Set();
  const allowedDirectories = new Set();

  function rememberPath(targetPath) {
    const normalized = normalizePath(targetPath);
    if (normalized) allowedPaths.add(normalized);
    return normalized;
  }

  function rememberDirectory(targetPath) {
    const normalized = normalizePath(targetPath);
    if (normalized) allowedDirectories.add(normalized);
    return normalized;
  }

  function rememberGeneratedOutput(targetPath) {
    const normalized = rememberPath(targetPath);
    if (normalized) rememberDirectory(path.dirname(normalized));
    return normalized;
  }

  function isAllowed(targetPath) {
    const normalized = normalizePath(targetPath);
    if (!normalized) return false;
    if (allowedPaths.has(normalized) || allowedDirectories.has(normalized)) return true;
    for (const directory of allowedDirectories) {
      const relative = path.relative(directory, normalized);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return true;
    }
    return false;
  }

  function isAllowedToOpen(targetPath) {
    return isAllowed(targetPath) && !isBlockedExecutablePath(targetPath);
  }

  return {
    rememberPath,
    rememberDirectory,
    rememberGeneratedOutput,
    isAllowed,
    isAllowedToOpen,
  };
}

module.exports = {
  createPathAccessGuard,
  isAllowedJsonPath,
  isAllowedPngPath,
  isBlockedExecutablePath,
  isTrustedSenderUrl,
  normalizePath,
  validateCleanPngBuffer,
};
