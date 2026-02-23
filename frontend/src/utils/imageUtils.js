export function base64ToBlob(base64, mimeType = 'image/png') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export function base64ToUrl(base64, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`;
}

export function urlToBase64(url) {
  return url.split(',')[1] || url;
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function urlToBlob(url) {
  const response = await fetch(url);
  return response.blob();
}

export function downloadImage(base64, filename = 'image.png') {
  const blob = base64ToBlob(base64);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getImageDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.src = base64ToUrl(base64);
  });
}

export async function resizeImage(base64, maxWidth, maxHeight, keepAspectRatio = true) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (keepAspectRatio) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else {
        width = maxWidth;
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.src = base64ToUrl(base64);
  });
}

export function createMaskFromSelection(canvas, selectionPath) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;

  const ctx = maskCanvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.beginPath();
  selectionPath.forEach((point, i) => {
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fill();

  return maskCanvas.toDataURL('image/png').split(',')[1];
}

export function invertMask(maskBase64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.src = base64ToUrl(maskBase64);
  });
}

export function applyMaskToImage(imageBase64, maskBase64, invert = false) {
  return new Promise(async (resolve) => {
    const finalMask = invert ? await invertMask(maskBase64) : maskBase64;

    const imageImg = new Image();
    const maskImg = new Image();

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        const canvas = document.createElement('canvas');
        canvas.width = imageImg.width;
        canvas.height = imageImg.height;

        const ctx = canvas.getContext('2d');

        // Draw image
        ctx.drawImage(imageImg, 0, 0);

        // Apply mask
        ctx.globalCompositeOperation = 'destination-in';

        // Scale mask to image size if needed
        ctx.drawImage(maskImg, 0, 0, imageImg.width, imageImg.height);

        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }
    };

    imageImg.onload = checkLoaded;
    maskImg.onload = checkLoaded;

    imageImg.src = base64ToUrl(imageBase64);
    maskImg.src = base64ToUrl(finalMask);
  });
}

// Remove mask area from image (destination-out) - keeps everything except the masked area
export function removeMaskFromImage(imageBase64, maskBase64) {
  return new Promise((resolve) => {
    const imageImg = new Image();
    const maskImg = new Image();

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        const canvas = document.createElement('canvas');
        canvas.width = imageImg.width;
        canvas.height = imageImg.height;

        const ctx = canvas.getContext('2d');

        // Draw image
        ctx.drawImage(imageImg, 0, 0);

        // Remove masked area
        ctx.globalCompositeOperation = 'destination-out';

        // Scale mask to image size if needed
        ctx.drawImage(maskImg, 0, 0, imageImg.width, imageImg.height);

        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }
    };

    imageImg.onload = checkLoaded;
    maskImg.onload = checkLoaded;

    imageImg.src = base64ToUrl(imageBase64);
    maskImg.src = base64ToUrl(maskBase64);
  });
}

export function compositeImages(backgroundBase64, foregroundBase64, x = 0, y = 0, opacity = 1) {
  return new Promise((resolve) => {
    const bgImg = new Image();
    const fgImg = new Image();

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        const canvas = document.createElement('canvas');
        canvas.width = bgImg.width;
        canvas.height = bgImg.height;

        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.drawImage(bgImg, 0, 0);

        // Draw foreground with opacity
        ctx.globalAlpha = opacity;
        ctx.drawImage(fgImg, x, y);

        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }
    };

    bgImg.onload = checkLoaded;
    fgImg.onload = checkLoaded;

    bgImg.src = base64ToUrl(backgroundBase64);
    fgImg.src = base64ToUrl(foregroundBase64);
  });
}

export function drawBoundingBoxes(imageBase64, boxes) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Draw boxes
      boxes.forEach((box, index) => {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#82e0aa'];
        const color = colors[index % colors.length];

        // Convert normalized coordinates to pixels
        const x1 = (box.box[1] / 1000) * img.width;
        const y1 = (box.box[0] / 1000) * img.height;
        const x2 = (box.box[3] / 1000) * img.width;
        const y2 = (box.box[2] / 1000) * img.height;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw label
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        const label = box.label + (box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : '');
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 20, textWidth + 8, 20);

        ctx.fillStyle = 'white';
        ctx.fillText(label, x1 + 4, y1 - 5);
      });

      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.src = base64ToUrl(imageBase64);
  });
}

// Mask Operations - combine multiple masks with different operations

// Helper to load an image and get its pixel data
function loadImageData(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({
        canvas,
        ctx,
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width: img.width,
        height: img.height
      });
    };
    img.src = base64ToUrl(base64);
  });
}

// Union (OR) - combine masks, white where either mask is white
export async function maskUnion(mask1Base64, mask2Base64) {
  const [data1, data2] = await Promise.all([
    loadImageData(mask1Base64),
    loadImageData(mask2Base64)
  ]);

  const result = data1.ctx.createImageData(data1.width, data1.height);
  const pixels1 = data1.imageData.data;
  const pixels2 = data2.imageData.data;

  for (let i = 0; i < result.data.length; i += 4) {
    // Use max of both masks (union)
    const val = Math.max(pixels1[i], pixels2[i]);
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }

  data1.ctx.putImageData(result, 0, 0);
  return data1.canvas.toDataURL('image/png').split(',')[1];
}

// Intersection (AND) - white only where both masks are white
export async function maskIntersection(mask1Base64, mask2Base64) {
  const [data1, data2] = await Promise.all([
    loadImageData(mask1Base64),
    loadImageData(mask2Base64)
  ]);

  const result = data1.ctx.createImageData(data1.width, data1.height);
  const pixels1 = data1.imageData.data;
  const pixels2 = data2.imageData.data;

  for (let i = 0; i < result.data.length; i += 4) {
    // Use min of both masks (intersection)
    const val = Math.min(pixels1[i], pixels2[i]);
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }

  data1.ctx.putImageData(result, 0, 0);
  return data1.canvas.toDataURL('image/png').split(',')[1];
}

// Subtract - remove mask2 from mask1
export async function maskSubtract(mask1Base64, mask2Base64) {
  const [data1, data2] = await Promise.all([
    loadImageData(mask1Base64),
    loadImageData(mask2Base64)
  ]);

  const result = data1.ctx.createImageData(data1.width, data1.height);
  const pixels1 = data1.imageData.data;
  const pixels2 = data2.imageData.data;

  for (let i = 0; i < result.data.length; i += 4) {
    // Subtract: mask1 minus mask2, clamped to 0
    const val = Math.max(0, pixels1[i] - pixels2[i]);
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }

  data1.ctx.putImageData(result, 0, 0);
  return data1.canvas.toDataURL('image/png').split(',')[1];
}

// XOR - white where only one mask is white (exclusive)
export async function maskXor(mask1Base64, mask2Base64) {
  const [data1, data2] = await Promise.all([
    loadImageData(mask1Base64),
    loadImageData(mask2Base64)
  ]);

  const result = data1.ctx.createImageData(data1.width, data1.height);
  const pixels1 = data1.imageData.data;
  const pixels2 = data2.imageData.data;

  for (let i = 0; i < result.data.length; i += 4) {
    // XOR: absolute difference
    const val = Math.abs(pixels1[i] - pixels2[i]);
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }

  data1.ctx.putImageData(result, 0, 0);
  return data1.canvas.toDataURL('image/png').split(',')[1];
}

// Combine multiple masks with an operation
export async function combineMasks(maskBase64Array, operation = 'union') {
  if (maskBase64Array.length === 0) return null;
  if (maskBase64Array.length === 1) return maskBase64Array[0];

  const operationFn = {
    union: maskUnion,
    intersection: maskIntersection,
    subtract: maskSubtract,
    xor: maskXor
  }[operation];

  if (!operationFn) {
    throw new Error(`Unknown mask operation: ${operation}`);
  }

  // Apply operation sequentially to combine all masks
  let result = maskBase64Array[0];
  for (let i = 1; i < maskBase64Array.length; i++) {
    result = await operationFn(result, maskBase64Array[i]);
  }

  return result;
}
