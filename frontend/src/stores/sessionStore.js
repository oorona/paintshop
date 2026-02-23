import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSessionStore = create(
  persist(
    (set, get) => ({
      // Session
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),

      // Stats
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requests: [],

      updateStats: (tokenUsage, costEstimate, requestType, model, prompt) => set((state) => ({
        totalRequests: state.totalRequests + 1,
        totalInputTokens: state.totalInputTokens + (tokenUsage?.input_tokens || 0),
        totalOutputTokens: state.totalOutputTokens + (tokenUsage?.output_tokens || 0),
        totalCost: state.totalCost + (costEstimate?.total_cost || 0),
        requests: [...state.requests, {
          timestamp: new Date().toISOString(),
          type: requestType,
          model,
          inputTokens: tokenUsage?.input_tokens || 0,
          outputTokens: tokenUsage?.output_tokens || 0,
          cost: costEstimate?.total_cost || 0,
          prompt: prompt?.substring(0, 100)
        }]
      })),

      resetStats: () => set({
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        requests: []
      }),

      // Model settings
      selectedModel: 'gemini-2.5-flash-image',
      aspectRatio: '1:1',
      imageSize: '1K',
      thinkingLevel: 'high',
      mediaResolution: 'high',
      useGrounding: false,

      setSelectedModel: (model) => set({ selectedModel: model }),
      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
      setImageSize: (size) => set({ imageSize: size }),
      setThinkingLevel: (level) => set({ thinkingLevel: level }),
      setMediaResolution: (resolution) => set({ mediaResolution: resolution }),
      setUseGrounding: (use) => set({ useGrounding: use }),
    }),
    {
      name: 'gemini-editor-session',
      partialize: (state) => ({
        sessionId: state.sessionId,
        selectedModel: state.selectedModel,
        aspectRatio: state.aspectRatio,
        imageSize: state.imageSize,
        thinkingLevel: state.thinkingLevel,
        mediaResolution: state.mediaResolution,
        useGrounding: state.useGrounding,
      })
    }
  )
);
