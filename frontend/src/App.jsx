import React, { useEffect } from 'react';
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
import { API_BASE } from './config/api';

function App() {
  const { activePanel, isLoading, loadingMessage, activeModal, closeModal } = useEditorStore();
  const { setStyles, setStyleCategories, setPromptTemplates, setTemplateCategories, setWorkflows, setMemeTemplates } = useStyleStore();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const resources = [
        { url: `${API_BASE}/styles`, setter: setStyles, label: 'styles' },
        { url: `${API_BASE}/styles/categories`, setter: setStyleCategories, label: 'style categories' },
        { url: `${API_BASE}/prompts`, setter: setPromptTemplates, label: 'prompt templates' },
        { url: `${API_BASE}/prompts/categories`, setter: setTemplateCategories, label: 'template categories' },
        { url: `${API_BASE}/workflows`, setter: setWorkflows, label: 'workflows' },
        { url: `${API_BASE}/memes`, setter: setMemeTemplates, label: 'memes' },
      ];

      const results = await Promise.allSettled(
        resources.map(async ({ url, setter, label }) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${label}`);
          }

          const data = await response.json();
          setter(data);
        })
      );

      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error('Bootstrap data fetch failed:', result.reason);
        }
      });
    };

    fetchData();
  }, [setStyles, setStyleCategories, setPromptTemplates, setTemplateCategories, setWorkflows, setMemeTemplates]);

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
