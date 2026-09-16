import React from 'react';

/**
 * Red caption line shown when one or more channels are out of tolerance.
 * Returns null when the message list is empty.
 */
export function ToleranceMessage({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="text-center text-red-600 font-semibold text-sm">
      {messages.map((m, i) => (
        <div key={i}>{m}</div>
      ))}
    </div>
  );
}
