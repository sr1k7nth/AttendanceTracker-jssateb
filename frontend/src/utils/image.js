/* Shared on-device image resize for uploads (Support + Feedback).
   Shrink to ~1200px and re-encode as JPEG so posts stay far under the
   server's 5 MB cap. */

export function loadImageEl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

export async function compressImage(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Attach an image file (PNG or JPEG).');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageEl(url);
    const MAX = 1200;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) throw new Error('Could not process that image.');
    return new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function assertUnderLimit(file, label = 'Screenshot') {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${label} still over 5 MB after resizing. Try a smaller image.`);
  }
}
