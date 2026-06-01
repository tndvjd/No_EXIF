import { useEffect } from 'react';

export function useSelectedImagePreview({ selectedImage, setImages }) {
  useEffect(() => {
    if (!selectedImage?.path || selectedImage.preview || !window.noExif?.loadPreview) return undefined;

    let cancelled = false;
    window.noExif.loadPreview(selectedImage.path)
      .then(result => {
        if (cancelled || !result?.preview) return;
        setImages(current => current.map(image => (
          image.path === selectedImage.path ? { ...image, preview: result.preview } : image
        )));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedImage?.path, selectedImage?.preview, setImages]);
}
