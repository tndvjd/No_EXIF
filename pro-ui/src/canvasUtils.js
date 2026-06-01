export function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      try {
        if (!blob) {
          reject(new Error('PNG 렌더링에 실패했습니다.'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      } catch (error) {
        reject(error);
      }
    }, 'image/png');
  });
}
