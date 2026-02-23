import { create } from 'zustand';

export const useStyleStore = create((set, get) => ({
  // Styles
  styles: [],
  selectedStyleId: null,
  styleCategories: [],

  setStyles: (styles) => set({ styles }),
  setSelectedStyleId: (id) => set({ selectedStyleId: id }),
  setStyleCategories: (categories) => set({ styleCategories: categories }),

  getSelectedStyle: () => {
    const { styles, selectedStyleId } = get();
    return styles.find(s => s.id === selectedStyleId);
  },

  // Prompt templates
  promptTemplates: [],
  selectedTemplateId: null,
  templateCategories: [],

  setPromptTemplates: (templates) => set({ promptTemplates: templates }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setTemplateCategories: (categories) => set({ templateCategories: categories }),

  getSelectedTemplate: () => {
    const { promptTemplates, selectedTemplateId } = get();
    return promptTemplates.find(t => t.id === selectedTemplateId);
  },

  // Workflows
  workflows: [],
  selectedWorkflowId: null,

  setWorkflows: (workflows) => set({ workflows }),
  setSelectedWorkflowId: (id) => set({ selectedWorkflowId: id }),

  getSelectedWorkflow: () => {
    const { workflows, selectedWorkflowId } = get();
    return workflows.find(w => w.id === selectedWorkflowId);
  },

  // Prompt history
  promptHistory: [],
  addToPromptHistory: (prompt) => set((state) => ({
    promptHistory: [prompt, ...state.promptHistory.filter(p => p !== prompt)].slice(0, 50)
  })),

  // Favorite prompts
  favoritePrompts: [],
  addFavoritePrompt: (prompt) => set((state) => ({
    favoritePrompts: [...state.favoritePrompts, { id: Date.now(), text: prompt, createdAt: new Date().toISOString() }]
  })),
  removeFavoritePrompt: (id) => set((state) => ({
    favoritePrompts: state.favoritePrompts.filter(p => p.id !== id)
  })),

  // Meme templates
  memeTemplates: [],
  memeSearchQuery: '',
  selectedMemeId: null,

  setMemeTemplates: (memes) => set({ memeTemplates: memes }),
  setMemeSearchQuery: (query) => set({ memeSearchQuery: query }),
  setSelectedMemeId: (id) => set({ selectedMemeId: id }),

  getFilteredMemes: () => {
    const { memeTemplates, memeSearchQuery } = get();
    if (!memeSearchQuery) return memeTemplates;
    const query = memeSearchQuery.toLowerCase();
    return memeTemplates.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.tags?.some(t => t.toLowerCase().includes(query))
    );
  },

  getSelectedMeme: () => {
    const { memeTemplates, selectedMemeId } = get();
    return memeTemplates.find(m => m.id === selectedMemeId);
  },
}));
