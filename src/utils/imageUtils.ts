export async function processAvatarFile(
  file: File,
  outputSize = 256
): Promise<{ blob: Blob; dataUrl: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP, or GIF).');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large. Please choose a file under 10 MB.');
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image.'));
      el.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas is unavailable.');
    }

    // Center-crop square from source image
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - minSide) / 2;
    const sy = (img.naturalHeight - minSide) / 2;

    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, outputSize, outputSize);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Image compression failed.'))),
        'image/jpeg',
        0.85
      );
    });

    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
