import { create } from 'zustand';

// Helper to create a white canvas as base64
const createWhiteCanvas = (width = 1024, height = 1024) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png').split(',')[1];
};

// Initial blank canvas layer
const initialLayer = {
  id: 'layer-background',
  name: 'Background',
  type: 'image',
  image_base64: null, // Will be set on first access
  visible: true,
  opacity: 1,
  blend_mode: 'normal',
  order: 0
};

export const useEditorStore = create((set, get) => ({
  // Canvas state
  canvas: null,
  setCanvas: (canvas) => set({ canvas }),

  // Project state
  project: null,
  setProject: (project) => set({ project }),

  // Unsaved changes tracking
  hasUnsavedChanges: false,
  savedLayerSnapshot: null,
  markAsChanged: () => set({ hasUnsavedChanges: true }),
  markAsSaved: () => set((state) => ({
    hasUnsavedChanges: false,
    savedLayerSnapshot: JSON.stringify(state.layers)
  })),
  checkForChanges: () => {
    const { layers, savedLayerSnapshot } = get();
    if (!savedLayerSnapshot) return layers.length > 0;
    return JSON.stringify(layers) !== savedLayerSnapshot;
  },

  // Layers - initialize with background layer
  layers: [],
  activeLayerId: null,

  // Initialize canvas with blank white background
  initializeCanvas: (width = 1024, height = 1024) => {
    const { layers } = get();
    if (layers.length === 0) {
      const whiteCanvas = createWhiteCanvas(width, height);
      const bgLayer = {
        ...initialLayer,
        image_base64: whiteCanvas
      };
      set({
        layers: [bgLayer],
        activeLayerId: bgLayer.id
      });
    }
  },
  setLayers: (layers) => set({ layers }),
  setActiveLayerId: (id) => set({ activeLayerId: id }),

  // Clear all layers
  clearLayers: () => set({ layers: [], activeLayerId: null, hasUnsavedChanges: false, savedLayerSnapshot: null }),

  // Load image as base layer, clearing existing layers
  loadImage: (imageBase64, name = 'Image') => {
    const layerId = `layer-${Date.now()}`;
    const newLayers = [{
      id: layerId,
      name,
      type: 'image',
      image_base64: imageBase64,
      visible: true,
      opacity: 1,
      blend_mode: 'normal',
      order: 0
    }];
    set({
      layers: newLayers,
      activeLayerId: layerId,
      hasUnsavedChanges: false,
      savedLayerSnapshot: JSON.stringify(newLayers)
    });
  },

  addLayer: (layer) => set((state) => ({
    layers: [...state.layers, layer],
    activeLayerId: layer.id,
    hasUnsavedChanges: true
  })),
  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map(l => l.id === id ? { ...l, ...updates } : l),
    hasUnsavedChanges: true
  })),
  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter(l => l.id !== id),
    activeLayerId: state.activeLayerId === id ? null : state.activeLayerId,
    hasUnsavedChanges: true
  })),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const newLayers = [...state.layers];
    const [removed] = newLayers.splice(startIndex, 1);
    newLayers.splice(endIndex, 0, removed);
    return { layers: newLayers.map((l, i) => ({ ...l, order: i })), hasUnsavedChanges: true };
  }),

  // Selection
  selectedObjects: [],
  setSelectedObjects: (objects) => set({ selectedObjects: objects }),

  // Tool state
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Zoom and pan
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),

  // History (undo/redo)
  history: [],
  historyIndex: -1,
  pushHistory: (state) => set((s) => ({
    history: [...s.history.slice(0, s.historyIndex + 1), state],
    historyIndex: s.historyIndex + 1
  })),
  undo: () => {
    const { historyIndex, history, layers } = get();
    if (historyIndex > 0) {
      set({
        historyIndex: historyIndex - 1,
        layers: history[historyIndex - 1]
      });
    }
  },
  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      set({
        historyIndex: historyIndex + 1,
        layers: history[historyIndex + 1]
      });
    }
  },

  // Clipboard
  clipboard: null,
  setClipboard: (data) => set({ clipboard: data }),

  // Loading states
  isLoading: false,
  loadingMessage: '',
  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),

  // Modal state
  activeModal: null,
  modalData: null,
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Active panel
  activePanel: 'generate',
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
