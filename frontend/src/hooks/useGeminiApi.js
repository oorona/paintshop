import { useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useEditorStore } from '../stores/editorStore';
import toast from 'react-hot-toast';

// Use environment variable for API base URL
// VITE_API_URL should be http://localhost:8000 (backend adds /api prefix)
const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;

export function useGeminiApi() {
  const {
    sessionId, setSessionId, updateStats,
    selectedModel, aspectRatio, imageSize, thinkingLevel, mediaResolution, useGrounding
  } = useSessionStore();
  const { setLoading } = useEditorStore();

  const handleResponse = useCallback(async (response, requestType, prompt) => {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    if (data.token_usage && data.cost_estimate) {
      updateStats(data.token_usage, data.cost_estimate, requestType, selectedModel, prompt);
    }

    return data;
  }, [sessionId, setSessionId, updateStats, selectedModel]);

  const generateImage = useCallback(async (prompt, styleId = null) => {
    setLoading(true, 'Generating image...');
    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          style_id: styleId,
          use_grounding: useGrounding,
          thinking_level: thinkingLevel,
          session_id: sessionId
        })
      });

      const data = await handleResponse(response, 'generate', prompt);

      if (data.success && data.image_base64) {
        toast.success('Image generated!');
        return data;
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedModel, aspectRatio, imageSize, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse]);

  const editImage = useCallback(async (prompt, imageData, maskData = null, styleId = null) => {
    setLoading(true, 'Editing image...');
    try {
      const response = await fetch(`${API_BASE}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_data: imageData,
          model: selectedModel,
          mask_data: maskData,
          style_id: styleId,
          use_grounding: useGrounding,
          thinking_level: thinkingLevel,
          session_id: sessionId
        })
      });

      const data = await handleResponse(response, 'edit', prompt);

      if (data.success && data.image_base64) {
        toast.success('Image edited!');
        return data;
      } else {
        throw new Error(data.error || 'Edit failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedModel, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse]);

  const multiImageEdit = useCallback(async (prompt, images, styleId = null) => {
    setLoading(true, 'Processing multiple images...');
    try {
      const response = await fetch(`${API_BASE}/edit/multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          images,
          model: 'gemini-3-pro-image-preview',
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          style_id: styleId,
          use_grounding: useGrounding,
          thinking_level: thinkingLevel,
          session_id: sessionId
        })
      });

      const data = await handleResponse(response, 'multi_edit', prompt);

      if (data.success && data.image_base64) {
        toast.success('Images combined!');
        return data;
      } else {
        throw new Error(data.error || 'Multi-image edit failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [aspectRatio, imageSize, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse]);

  const segmentObjects = useCallback(async (imageData, prompt = 'Detect and segment all objects') => {
    setLoading(true, 'Segmenting objects...');
    try {
      const response = await fetch(`${API_BASE}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          prompt,
          model: selectedModel,  // Uses model from UI selector
          media_resolution: mediaResolution
        })
      });

      const data = await handleResponse(response, 'segment', prompt);

      if (data.success) {
        toast.success(`Found ${data.segments?.length || 0} objects`);
        return data;
      } else {
        throw new Error(data.error || 'Segmentation failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedModel, mediaResolution, setLoading, handleResponse]);

  const detectObjects = useCallback(async (imageData, prompt = 'Detect all objects') => {
    setLoading(true, 'Detecting objects...');
    try {
      const response = await fetch(`${API_BASE}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          prompt,
          model: 'gemini-3-flash-preview',
          media_resolution: mediaResolution
        })
      });

      const data = await handleResponse(response, 'detect', prompt);

      if (data.success) {
        toast.success(`Detected ${data.objects?.length || 0} objects`);
        return data;
      } else {
        throw new Error(data.error || 'Detection failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [mediaResolution, setLoading, handleResponse]);

  const understandImage = useCallback(async (imageData, prompt) => {
    setLoading(true, 'Analyzing image...');
    try {
      const response = await fetch(`${API_BASE}/understand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          prompt,
          model: 'gemini-3-flash-preview',
          media_resolution: mediaResolution
        })
      });

      const data = await handleResponse(response, 'understand', prompt);

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'Understanding failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [mediaResolution, setLoading, handleResponse]);

  const styleTransfer = useCallback(async (imageData, styleReference, prompt, styleStrength = 0.7) => {
    setLoading(true, 'Applying style...');
    try {
      const response = await fetch(`${API_BASE}/style-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          style_reference: styleReference,
          prompt,
          model: 'gemini-3-pro-image-preview',
          style_strength: styleStrength
        })
      });

      const data = await handleResponse(response, 'style_transfer', prompt);

      if (data.success && data.image_base64) {
        toast.success('Style applied!');
        return data;
      } else {
        throw new Error(data.error || 'Style transfer failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, handleResponse]);

  const inpaint = useCallback(async (imageData, maskData, prompt, preserveBackground = true) => {
    setLoading(true, 'Inpainting...');
    try {
      const response = await fetch(`${API_BASE}/inpaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          mask_data: maskData,
          prompt,
          model: 'gemini-3-pro-image-preview',
          preserve_background: preserveBackground
        })
      });

      const data = await handleResponse(response, 'inpaint', prompt);

      if (data.success && data.image_base64) {
        toast.success('Inpainting complete!');
        return data;
      } else {
        throw new Error(data.error || 'Inpainting failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, handleResponse]);

  const assistPrompt = useCallback(async (context, taskType = 'generate') => {
    setLoading(true, 'Creating prompt...');
    try {
      const response = await fetch(`${API_BASE}/prompt/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          task_type: taskType,
          model: 'gemini-3-pro-preview',
          thinking_level: 'high'
        })
      });

      const data = await handleResponse(response, 'prompt_assist', context);

      if (data.success && data.text_response) {
        toast.success('Prompt created!');
        return data.text_response;
      } else {
        throw new Error(data.error || 'Prompt assist failed');
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, handleResponse]);

  return {
    generateImage,
    editImage,
    multiImageEdit,
    segmentObjects,
    detectObjects,
    understandImage,
    styleTransfer,
    inpaint,
    assistPrompt
  };
}
