import Uppy from '@uppy/core';
import { getPaletteSync } from 'colorthief';
import { createId, now } from '../ids';

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      image.onload = () => resolve({ dataUrl: reader.result, image, width: image.naturalWidth || 1200, height: image.naturalHeight || 800 });
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function createAssetRecords(files, { projectId = null, source = '本地上传' } = {}) {
  const uppy = new Uppy({ restrictions: { maxNumberOfFiles: 30, maxFileSize: 20 * 1024 * 1024, allowedFileTypes: ['image/*'] }, autoProceed: false });
  try {
    files.forEach((file) => uppy.addFile({ name: file.name, type: file.type, data: file, source: 'muse-file-input' }));
    const records = [];
    for (const item of uppy.getFiles()) {
      const decoded = await readImage(item.data);
      let colors = [];
      try {
        colors = (getPaletteSync(decoded.image, { colorCount: 5, quality: 7 }) ?? []).map((color) => color.hex().toUpperCase());
      } catch {
        colors = ['#D9D0C0', '#8D9B91', '#303936'];
      }
      const timestamp = now();
      records.push({
        id: createId('asset'), projectId, kind: 'image', name: item.name,
        url: decoded.dataUrl, width: decoded.width, height: decoded.height,
        originalAsset: { url: decoded.dataUrl, width: decoded.width, height: decoded.height, mimeType: item.type },
        displayAsset: { url: decoded.dataUrl, width: decoded.width, height: decoded.height, fit: 'contain', crop: 'none' },
        source, tags: [], colors, note: '', favorite: false,
        createdAt: timestamp, updatedAt: timestamp,
      });
    }
    return records;
  } finally {
    uppy.destroy();
  }
}
