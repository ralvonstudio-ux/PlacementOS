import type { ResolvedQuestionImage } from '@placementos/types';

interface Props {
  image: ResolvedQuestionImage;
  width?: number;
}

/** Renders only the figure's bounding-box crop out of the full page image, using a pure-CSS
 *  crop (no canvas/JS measurement needed): the image is scaled up so the crop region fills the
 *  container, then shifted so that region lands at the container's origin. */
export function CroppedFigure({ image, width = 220 }: Props) {
  const { boundingBox: bb } = image;
  const height = width * (bb.height / bb.width);

  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', borderRadius: 8 }} className="border border-gray-200 bg-gray-50">
      <img
        src={image.pageImageDataUri}
        alt="Figure"
        style={{
          position: 'absolute',
          left: `-${(bb.x / bb.width) * 100}%`,
          top: `-${(bb.y / bb.height) * 100}%`,
          width: `${(1 / bb.width) * 100}%`,
          maxWidth: 'none',
        }}
      />
    </div>
  );
}
