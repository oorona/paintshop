import { useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useEditorStore } from '../stores/editorStore';
import { API_BASE } from '../config/api';
import toast from 'react-hot-toast';

export function useGeminiApi() {
  const {
    sessionId, setSessionId, updateStats,
    selectedModel, aspectRatio, imageSize, thinkingLevel, mediaResolution, useGrounding
  } = useSessionStore();
  const { setLoading } = useEditorStore();

  const formatDuration = useCallback((durationMs) => {
    if (!durationMs || durationMs < 1000) {
      return `${durationMs || 0}ms`;
    }

    const seconds = durationMs / 1000;
    return seconds >= 10 ? `${seconds.toFixed(1)}s` : `${seconds.toFixed(2)}s`;
  }, []);

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

  const handleStreamResult = useCallback((data, requestType, prompt) => {
    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    if (data.token_usage && data.cost_estimate) {
      updateStats(data.token_usage, data.cost_estimate, requestType, selectedModel, prompt);
    }
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
        toast.success(`Image generated in ${formatDuration(data.duration_ms)}`);
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
  }, [selectedModel, aspectRatio, imageSize, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse, formatDuration]);

  const generateImageStream = useCallback(async (prompt, styleId = null, handlers = {}) => {
    const { onThought, onSession, onResult } = handlers;

    const response = await fetch(`${API_BASE}/generate/stream`, {
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

    if (!response.ok || !response.body) {
      let message = 'Streaming generation failed';
      try {
        const data = await response.json();
        message = data.error || message;
      } catch {
        // Keep fallback message
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);

        if (event.type === 'session') {
          if (event.session_id && !sessionId) {
            setSessionId(event.session_id);
          }
          onSession?.(event.session_id);
        } else if (event.type === 'thought') {
          onThought?.(event.text);
        } else if (event.type === 'result') {
          handleStreamResult(event.data, 'generate', prompt);
          onResult?.(event.data);
          if (event.data.success && event.data.image_base64) {
            toast.success(`Image generated in ${formatDuration(event.data.duration_ms)}`);
            return event.data;
          }
          throw new Error(event.data.error || 'Generation failed');
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Streaming generation failed');
        }
      }

      if (done) {
        break;
      }
    }

    throw new Error('Streaming generation ended without a final result');
  }, [
    selectedModel,
    aspectRatio,
    imageSize,
    useGrounding,
    thinkingLevel,
    sessionId,
    setSessionId,
    handleStreamResult,
    formatDuration
  ]);

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
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          style_id: styleId,
          use_grounding: useGrounding,
          thinking_level: thinkingLevel,
          session_id: sessionId
        })
      });

      const data = await handleResponse(response, 'edit', prompt);

      if (data.success && data.image_base64) {
        toast.success(`Image edited in ${formatDuration(data.duration_ms)}`);
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
  }, [selectedModel, aspectRatio, imageSize, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse, formatDuration]);

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
        toast.success(`Images combined in ${formatDuration(data.duration_ms)}`);
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
  }, [aspectRatio, imageSize, useGrounding, thinkingLevel, sessionId, setLoading, handleResponse, formatDuration]);

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
        toast.success(`Style applied in ${formatDuration(data.duration_ms)}`);
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
  }, [setLoading, handleResponse, formatDuration]);

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
        toast.success(`Inpainting complete in ${formatDuration(data.duration_ms)}`);
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
  }, [setLoading, handleResponse, formatDuration]);

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
    generateImageStream,
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
