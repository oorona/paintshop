import React from 'react';

function LoadingOverlay({ message = 'Processing...' }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-editor-panel border border-editor-border rounded-xl p-8 text-center shadow-2xl">
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className="w-16 h-16 border-4 border-editor-border rounded-full" />
          {/* Spinning ring */}
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-editor-accent rounded-full animate-spin" />
          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-editor-accent rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-white font-medium mb-1">{message}</p>
        <p className="text-gray-500 text-sm">This may take a moment...</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
