import React, { useEffect } from 'react';

export function ListeningButtons({ onRed, onGreen, size = 56 }) {
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'x') onRed?.();
      if (k === 'c') onGreen?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRed, onGreen]);

  const base =
    'rounded-full transition active:scale-95 shadow-lg ring-2 ring-black/40';
  return (
    <div className="flex gap-8 items-center">
      <button
        aria-label="Three odd numbers (red)"
        onClick={onRed}
        className={`${base} bg-red-600 hover:bg-red-500`}
        style={{ width: size, height: size }}
      />
      <button
        aria-label="Three even numbers (green)"
        onClick={onGreen}
        className={`${base} bg-green-600 hover:bg-green-500`}
        style={{ width: size, height: size }}
      />
    </div>
  );
}