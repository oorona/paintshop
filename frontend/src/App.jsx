import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from './components/UI/Header';
import Sidebar from './components/UI/Sidebar';
import Canvas from './components/Editor/Canvas';
import LayerPanel from './components/Editor/LayerPanel';
import GenerationPanel from './components/Panels/GenerationPanel';
import EditingPanel from './components/Panels/EditingPanel';
import SegmentationPanel from './components/Panels/SegmentationPanel';
import DetectionPanel from './components/Panels/DetectionPanel';
import StylesPanel from './components/Panels/StylesPanel';
import PromptAssistPanel from './components/Panels/PromptAssistPanel';
import WorkflowPanel from './components/Panels/WorkflowPanel';
import MemesPanel from './components/Panels/MemesPanel';
import TextToolPanel from './components/Panels/TextToolPanel';
import Footer from './components/UI/Footer';
import LoadingOverlay from './components/UI/LoadingOverlay';
import ImageUploadModal from './components/Modals/ImageUploadModal';
import UrlImportModal from './components/Modals/UrlImportModal';
import { useEditorStore } from './stores/editorStore';
import { useStyleStore } from './stores/styleStore';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;

function App() {
  const { activePanel, isLoading, loadingMessage, activeModal, closeModal } = useEditorStore();
  const { setStyles, setStyleCategories, setPromptTemplates, setTemplateCategories, setWorkflows, setMemeTemplates } = useStyleStore();
  const [initialized, setInitialized] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch styles
        const stylesRes = await fetch(`${API_BASE}/styles`);
        if (stylesRes.ok) {
          const styles = await stylesRes.json();
          setStyles(styles);
        }

        // Fetch style categories
        const catRes = await fetch(`${API_BASE}/styles/categories`);
        if (catRes.ok) {
          const categories = await catRes.json();
          setStyleCategories(categories);
        }

        // Fetch prompt templates
        const templatesRes = await fetch(`${API_BASE}/prompts`);
        if (templatesRes.ok) {
          const templates = await templatesRes.json();
          setPromptTemplates(templates);
        }

        // Fetch template categories
        const templateCatRes = await fetch(`${API_BASE}/prompts/categories`);
        if (templateCatRes.ok) {
          const categories = await templateCatRes.json();
          setTemplateCategories(categories);
        }

        // Fetch workflows
        const workflowsRes = await fetch(`${API_BASE}/workflows`);
        if (workflowsRes.ok) {
          const workflows = await workflowsRes.json();
          setWorkflows(workflows);
        }

        // Fetch meme templates
        const memesRes = await fetch(`${API_BASE}/memes`);
        if (memesRes.ok) {
          const memes = await memesRes.json();
          setMemeTemplates(memes);
        }

        setInitialized(true);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        setInitialized(true);
      }
    };

    fetchData();
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'generate':
        return <GenerationPanel />;
      case 'edit':
        return <EditingPanel />;
      case 'segment':
        return <SegmentationPanel />;
      case 'detect':
        return <DetectionPanel />;
      case 'styles':
        return <StylesPanel />;
      case 'prompts':
        return <PromptAssistPanel />;
      case 'workflows':
        return <WorkflowPanel />;
      case 'memes':
        return <MemesPanel />;
      case 'text':
        return <TextToolPanel />;
      default:
        return <GenerationPanel />;
    }
  };

  if (!initialized) {
    return (
      <div className="h-screen w-screen bg-editor-bg flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-400">Loading Gemini AI Image Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-editor-bg flex flex-col overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #2a2a2a',
          },
        }}
      />

      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Canvas />
        </div>

        {/* Right Panel - Active Feature */}
        <div className="w-80 bg-editor-panel border-l border-editor-border flex flex-col overflow-hidden">
          {renderPanel()}
        </div>

        {/* Far Right - Layers */}
        <div className="w-64 bg-editor-panel border-l border-editor-border overflow-hidden">
          <LayerPanel />
        </div>
      </div>

      {/* Footer with status and cost */}
      <Footer />

      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay message={loadingMessage} />}

      {/* Modals */}
      {activeModal === 'upload' && <ImageUploadModal onClose={closeModal} />}
      {activeModal === 'url-import' && <UrlImportModal onClose={closeModal} />}
    </div>
  );
}

export default App;
