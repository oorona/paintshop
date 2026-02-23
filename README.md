# Gemini AI Image Editor

A comprehensive AI-powered image editor using Google's Gemini API for image generation, editing, segmentation, and understanding.

## Features

### Image Generation
- Text-to-image generation with Gemini 2.5 Flash Image and Gemini 3 Pro Image
- 32 predefined artistic styles (Photography, Digital Art, Traditional Art, Stylized)
- Customizable aspect ratios (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
- Resolution options up to 4K
- Google Search grounding for fact-verified generation

### Image Editing
- Natural language editing with AI
- Multi-image composition (up to 14 images with Gemini 3 Pro)
- Style transfer between images
- Inpainting with masks
- Background removal/replacement

### Image Understanding
- Semantic segmentation with AI-generated masks
- Object detection with bounding boxes
- Visual Q&A and captioning
- Automatic mask extraction

### Layer System
- Multiple layer support with drag-and-drop reordering
- Layer visibility, opacity, and blend modes
- Mask operations (union, intersection, subtract, XOR)
- Layer extraction and compositing

### Prompt Assistance
- AI-powered prompt generation
- 12+ prompt templates for various tasks
- Prompt history and favorites
- Task-specific optimization

### Workflow Automation
# Gemini AI Image Editor

AI-powered, multimodal image editor and understanding platform built around Google's Gemini models. The project focuses on advanced image synthesis, editing, semantic understanding, and prompt engineering to enable production-grade generative AI workflows.

Short repo description: A production-oriented, Gemini-powered multimodal image editor (generation, editing, segmentation, detection, VQA, and prompt engineering).

## AI Capabilities (high-level)

- **Generative image synthesis**: text-to-image generation using Gemini image models (Gemini 2.5 Flash Image, Gemini 3 Pro Image). Supports high-resolution outputs (up to 4K), multiple aspect ratios, and style conditioning.
- **Multimodal editing & composition**: inpainting, masked edits, multi-image composition (up to 14 images for Gemini 3 Pro), background replacement, and targeted region edits using mask inputs.
- **Style transfer & transformation**: transfer artistic style from reference images with controllable strength.
- **Semantic understanding**: semantic segmentation that returns mask images, object detection with normalized bounding boxes, visual question answering (VQA) and captioning for images.
- **Prompt engineering & assistance**: LLM-driven prompt generation and optimization (task-specific templates for generation, editing, segmentation, and style descriptions).
- **Workflow automation**: predefined and custom multi-step workflows to chain segmentation, editing, style application, and composition.
- **Layered editing model**: multiple layers with masks, blend modes, visibility, reorder, and compositing operations to support non-destructive editing.
- **Cost & session analytics**: per-request token accounting, cost estimation, session tracking, and historical request logs for monitoring usage and optimizing model choices.

Keywords: generative AI, multimodal models, image synthesis, inpainting, semantic segmentation, object detection, VQA, prompt engineering, grounding, model grounding (Google Search), token accounting, session analytics, Gemini.

## Where to find the technical docs

- Installation & quickstart: [docs/INSTALLATION.md](docs/INSTALLATION.md)
- Configuration & environment variables: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- Architecture & component overview: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Full technical spec (plain text): [specs/specs.txt](specs/specs.txt)

For developers and technical reviewers: the documentation in `docs/` and `specs/` contains system-level details, configuration examples, and architecture diagrams. The root README is intentionally focused on the AI/ML capabilities and high-level description.
```
