const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const resizeCanvasToContainer = (canvas: HTMLCanvasElement) => {
  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width ?? canvas.clientWidth ?? 640);
  const height = Math.round(rect?.height ?? canvas.clientHeight ?? Math.round(width * 0.75)) || 480;
  canvas.width = width;
  canvas.height = height;
};

export const drawImageToCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  cover: boolean,
  pan: { x: number; y: number },
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const scale = cover
    ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    : Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const baseOffsetX = (canvas.width - drawWidth) / 2;
  const baseOffsetY = (canvas.height - drawHeight) / 2;
  const extraX = Math.max(0, (drawWidth - canvas.width) / 2);
  const extraY = Math.max(0, (drawHeight - canvas.height) / 2);
  const offsetX = cover
    ? clamp(baseOffsetX + pan.x, baseOffsetX - extraX, baseOffsetX + extraX)
    : baseOffsetX;
  const offsetY = cover
    ? clamp(baseOffsetY + pan.y, baseOffsetY - extraY, baseOffsetY + extraY)
    : baseOffsetY;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return true;
};
