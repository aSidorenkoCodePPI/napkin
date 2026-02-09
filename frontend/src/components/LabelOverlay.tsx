import type { LabelItem } from '../types';

interface LabelOverlayProps {
  labels: LabelItem[];
}

export function LabelOverlay({ labels }: LabelOverlayProps) {
  return (
    <div className="label-overlay">
      {labels.map((label, i) => (
        <div
          key={i}
          className="label-tag"
          style={{
            left: `${label.x_percent * 100}%`,
            top: `${label.y_percent * 100}%`,
          }}
          title={label.description}
        >
          <span className="label-type">{label.type}</span>
          {label.name}
        </div>
      ))}
    </div>
  );
}
