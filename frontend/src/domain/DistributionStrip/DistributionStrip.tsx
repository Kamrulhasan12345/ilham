import { useEffect, useRef } from 'react';
import { Table } from '../../ui/Table';
import styles from './DistributionStrip.module.css';

export interface StrengthBucket {
  bucket: number;
  count: number;
}

/** Where this hadith sits in the corpus: 14 buckets over every scored
    hadith, drawn on canvas. Canvas themes itself, so it reads the tokens
    at paint time and repaints when the theme changes. The table below is
    the source of truth; the strip is the summary. */
export function DistributionStrip({
  buckets,
  strength,
}: {
  buckets: StrengthBucket[];
  strength: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || buckets.length === 0) return;
    const paint = () => {
      const root = getComputedStyle(document.documentElement);
      const ink = root.getPropertyValue('--ink').trim() || '#111211';
      const rule = root.getPropertyValue('--rule').trim() || '#D8D7D1';
      const index = root.getPropertyValue('--index').trim() || '#2437C4';
      const width = canvas.clientWidth || 600;
      const height = 96;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);
      const max = Math.max(...buckets.map((b) => b.count), 1);
      const gap = 3;
      const barWidth = (width - gap * (buckets.length - 1)) / buckets.length;
      const here = strength === null ? -1 : Math.min(14, Math.floor(strength * 14) + 1);
      buckets.forEach((b, i) => {
        const barHeight = Math.max(2, (b.count / max) * (height - 20));
        const x = i * (barWidth + gap);
        const y = height - 16 - barHeight;
        ctx.fillStyle = b.bucket === here ? index : b.count === 0 ? rule : ink;
        ctx.fillRect(x, y, barWidth, barHeight);
      });
      ctx.fillStyle = rule;
      ctx.fillRect(0, height - 12, width, 1);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => paint();
    media.addEventListener('change', onMedia);
    window.addEventListener('resize', paint);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', onMedia);
      window.removeEventListener('resize', paint);
    };
  }, [buckets, strength]);

  const nonEmpty = buckets.filter((b) => b.count > 0);

  return (
    <div>
      <p className={styles.caption}>
        Every scored hadith in the corpus, in 14 buckets.
        {strength !== null ? (
          <>
            {' '}
            This hadith sits in bucket {Math.min(14, Math.floor(strength * 14) + 1)}, marked in the
            accent.
          </>
        ) : null}
      </p>
      <canvas
        ref={canvasRef}
        className={styles.strip}
        role="img"
        aria-label="Distribution of chain strengths across the corpus"
      />
      <Table caption="Scored hadiths per strength bucket. Buckets with no hadiths are listed as zero.">
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            <th scope="col">Strength range</th>
            <th scope="col">Hadiths</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.bucket}>
              <td className="m m--bare">{`[${b.bucket}]`}</td>
              <td className="m m--bare">{`[${((b.bucket - 1) / 14).toFixed(2)}–${(b.bucket / 14).toFixed(2)}]`}</td>
              <td className="m m--bare">{`[${b.count}]`}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className={styles.note}>{nonEmpty.length} of the 14 buckets hold at least one hadith.</p>
    </div>
  );
}
