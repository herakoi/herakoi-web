/**
 * LayerImageSampler samples a multi-layer image (FITS, or an ordinary image as R/G/B).
 *
 * Why: sonifiers should be able to use any layer, not only the colours on screen, and
 * at full precision rather than through 8-bit canvas pixels.
 * What: for each point it returns hue/saturation/value bytes (from the layer mapping)
 * plus every layer scaled to 0–1 under `layer.<index>`.
 * How: points arrive normalised to the canvas; setView() gives the transform the image
 * was drawn with, which is inverted to find the image pixel. Points outside the image
 * get no sample. A layer with no data (NaN) at a point is left out of that sample, and
 * `layer.<index>:distance` gives the distance to its nearest data instead; a point
 * where a colour layer has no data gets value 0 (silent).
 */

import type {
  DetectedPoint,
  ErrorOr,
  ImageSample,
  ImageSampler,
  SampleChannel,
} from "#src/core/interfaces";
import { hsvSampleChannels } from "#src/core/interfaces";
import { canvasToImagePixel, type ImageTransform } from "#src/shared/image/drawing";
import { imageToCube, type LayerCube } from "./lib/cube";
import { distanceToData } from "./lib/distance";
import { defaultLayerMapping, type LayerRender, renderLayers } from "./lib/render";

export const layerChannelKey = (index: number) => `layer.${index}`;

export const layerDistanceKey = (index: number) => `${layerChannelKey(index)}:distance`;

/** The channels a cube provides: hue/saturation/value, then one per layer. */
export const channelsForCube = (cube: LayerCube): SampleChannel[] => [
  ...hsvSampleChannels,
  ...cube.layers.map((layer, index) => ({
    key: layerChannelKey(index),
    label: `${index + 1}. ${layer.name}`,
    min: 0,
    max: 1,
    distanceKey: layerDistanceKey(index),
  })),
];

type View = {
  transform: ImageTransform;
  canvasWidth: number;
  canvasHeight: number;
};

export class LayerImageSampler implements ImageSampler {
  private cube: LayerCube | null = null;
  private render: LayerRender | null = null;
  /** Per layer: distance to the nearest data, or null when the layer has no blanks. */
  private distances: (Float32Array | null)[] = [];
  private view: View | null = null;

  /** Use this cube, rendered with `render`, for sampling. */
  setImage(cube: LayerCube, render: LayerRender): void {
    if (cube !== this.cube) {
      // Only the cube matters: a new layer mapping keeps the distances.
      this.distances = cube.layers.map((layer) =>
        distanceToData(layer.data, cube.width, cube.height),
      );
    }
    this.cube = cube;
    this.render = render;
  }

  /** Where the image is on the canvas the points are normalised to. */
  setView(transform: ImageTransform, canvasWidth: number, canvasHeight: number): void {
    this.view = { transform, canvasWidth, canvasHeight };
  }

  /**
   * Load an image as three layers, filling a canvas of its own size. The plugin uses
   * setImage/setView instead; this keeps the ImageSampler contract usable on its own.
   */
  async loadImage(
    source: string | HTMLImageElement | HTMLCanvasElement,
  ): Promise<ErrorOr<undefined>> {
    try {
      const image =
        typeof source === "string"
          ? await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error("Failed to load image."));
              img.src = source;
            })
          : source;
      const cube = imageToCube(image);
      this.setImage(cube, renderLayers(cube, defaultLayerMapping(cube.layers.length)));
      this.setView(
        {
          centerX: cube.width / 2,
          centerY: cube.height / 2,
          drawWidth: cube.width,
          drawHeight: cube.height,
          rotation: 0,
          imageWidth: cube.width,
          imageHeight: cube.height,
        },
        cube.width,
        cube.height,
      );
    } catch (error) {
      return error instanceof Error ? error : new Error("Failed to load image for sampling.");
    }
  }

  sampleAt(points: DetectedPoint[]): ErrorOr<Map<string, ImageSample>> {
    const samples = new Map<string, ImageSample>();
    for (const point of points) {
      const sample = this.samplePoint(point);
      if (sample) samples.set(point.id, sample);
    }
    return samples;
  }

  private samplePoint(point: DetectedPoint): ImageSample | null {
    const { cube, render, view } = this;
    if (!cube || !render || !view) return null;
    if (point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1) return null;

    const canvasX = point.x * (view.canvasWidth - 1);
    const canvasY = point.y * (view.canvasHeight - 1);
    const pixel = canvasToImagePixel(view.transform, canvasX, canvasY);
    if (!pixel) return null;

    const index = pixel.y * cube.width + pixel.x;
    const o = index * 4;
    const hasColour = render.hsv[o + 3] > 0;
    const data: Record<string, number> = {
      hueByte: render.hsv[o],
      saturationByte: render.hsv[o + 1],
      valueByte: hasColour ? render.hsv[o + 2] : 0,
      alpha: hasColour ? 255 : 0,
    };
    cube.layers.forEach((layer, layerIndex) => {
      const value = render.scales[layerIndex](layer.data[index]);
      if (!Number.isNaN(value)) {
        data[layerChannelKey(layerIndex)] = value;
        return;
      }
      const distance = this.distances[layerIndex]?.[index];
      if (distance !== undefined) data[layerDistanceKey(layerIndex)] = distance;
    });
    return { data };
  }
}
