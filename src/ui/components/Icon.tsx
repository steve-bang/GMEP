/** Sprite icon (design/assets/icons.svg, Lucide style). Decorative unless `label` is given. */
export function Icon({ name, size, label }: { name: string; size?: 'sm' | 'lg'; label?: string }) {
  const cls = ['icon', size ? `icon--${size}` : ''].filter(Boolean).join(' ');
  return (
    <svg
      className={cls}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
