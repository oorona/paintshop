import React, { useState } from 'react';
import { DollarSign, Activity, ChevronUp, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useEditorStore } from '../../stores/editorStore';
import clsx from 'clsx';

function Footer() {
  const {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  } = useSessionStore();

  const { isLoading, loadingMessage } = useEditorStore();
  const [showDetails, setShowDetails] = useState(false);

  const formatCost = (cost) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    if (cost < 1) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  return (
    <footer className="h-8 bg-editor-panel border-t border-editor-border flex items-center justify-between px-4 text-sm">
      {/* Left section - Status messages */}
      <div className="flex items-center gap-4 flex-1">
        {isLoading ? (
          <div className="flex items-center gap-2 text-editor-accent">
            <Loader2 size={14} className="animate-spin" />
            <span>{loadingMessage || 'Processing...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <CheckCircle size={14} className="text-green-500" />
            <span>Ready</span>
          </div>
        )}
      </div>

      {/* Right section - Cost tracker */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Activity size={14} />
          <span>{totalRequests} requests</span>
        </div>

        <div className="h-4 w-px bg-editor-border" />

        <div className="flex items-center gap-2 text-gray-400">
          <span>{formatTokens(totalInputTokens + totalOutputTokens)} tokens</span>
        </div>

        <div className="h-4 w-px bg-editor-border" />

        <div className="flex items-center gap-2 text-editor-accent font-medium">
          <DollarSign size={14} />
          <span>{formatCost(totalCost)}</span>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1 hover:bg-editor-hover rounded"
        >
          <ChevronUp size={14} className={clsx('transition-transform', showDetails && 'rotate-180')} />
        </button>
      </div>

      {/* Details popup */}
      {showDetails && (
        <div className="absolute bottom-8 right-4 w-64 bg-editor-panel border border-editor-border rounded-lg shadow-xl p-3 z-50">
          <h4 className="font-medium mb-2">Session Details</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Requests:</span>
              <span>{totalRequests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Input Tokens:</span>
              <span>{formatTokens(totalInputTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Output Tokens:</span>
              <span>{formatTokens(totalOutputTokens)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-gray-500">Total Cost:</span>
              <span className="text-editor-accent">{formatCost(totalCost)}</span>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

export default Footer;
