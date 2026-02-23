import React, { useState } from 'react';
import { Workflow, Play, Plus, Edit2, Trash2, Copy, ChevronRight } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { useStyleStore } from '../../stores/styleStore';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function WorkflowPanel() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const { segmentObjects, editImage } = useGeminiApi();
  const { layers, activeLayerId, addLayer } = useEditorStore();
  const { workflows } = useStyleStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  const handleRunWorkflow = async () => {
    if (!selectedWorkflow || !activeLayer?.image_base64) return;

    setIsRunning(true);
    let currentImage = activeLayer.image_base64;

    try {
      for (let i = 0; i < selectedWorkflow.steps.length; i++) {
        setCurrentStep(i);
        const step = selectedWorkflow.steps[i];

        switch (step.step_type) {
          case 'segment':
            const segResult = await segmentObjects(
              currentImage,
              step.parameters?.subject
                ? `Segment the ${step.parameters.subject}`
                : 'Segment all objects'
            );
            if (segResult.success && segResult.segments?.length > 0) {
              // Use the first segment's mask
              const { applyMaskToImage } = await import('../../utils/imageUtils');
              currentImage = await applyMaskToImage(currentImage, segResult.segments[0].mask_base64);

              addLayer({
                id: `layer-${Date.now()}-${i}`,
                name: `Workflow Step ${i + 1}: Segment`,
                type: 'image',
                image_base64: currentImage,
                visible: true,
                opacity: 1,
                blend_mode: 'normal',
                order: layers.length
              });
            }
            break;

          case 'edit':
            const editPrompt = step.parameters?.costume
              ? `Transform to a ${step.parameters.costume} costume, ${step.parameters.style || 'artistic'} style`
              : step.parameters?.target_style
              ? `Transform to ${step.parameters.target_style} style`
              : step.parameters?.new_background
              ? `Change background to ${step.parameters.new_background}`
              : step.parameters?.new_outfit
              ? `Change outfit to ${step.parameters.new_outfit}`
              : 'Enhance the image';

            const editResult = await editImage(
              editPrompt,
              currentImage,
              null,
              step.style_id
            );

            if (editResult.success && editResult.image_base64) {
              currentImage = editResult.image_base64;

              addLayer({
                id: `layer-${Date.now()}-${i}`,
                name: `Workflow Step ${i + 1}: Edit`,
                type: 'image',
                image_base64: currentImage,
                visible: true,
                opacity: 1,
                blend_mode: 'normal',
                order: layers.length
              });
            }
            break;
        }
      }

      toast.success('Workflow completed!');
    } catch (error) {
      console.error('Workflow failed:', error);
      toast.error('Workflow failed at step ' + (currentStep + 1));
    } finally {
      setIsRunning(false);
      setCurrentStep(-1);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Workflow size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Workflows</h2>
        </div>
        <p className="text-xs text-gray-500">
          Automate multi-step image processing
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Workflow List */}
        <div>
          <label className="label">Available Workflows</label>
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflowId(workflow.id)}
                className={clsx(
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  selectedWorkflowId === workflow.id
                    ? 'bg-editor-accent/20 border-editor-accent'
                    : 'bg-editor-bg border-transparent hover:border-editor-border'
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{workflow.name}</p>
                  <span className="text-xs text-gray-500">
                    {workflow.steps?.length || 0} steps
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{workflow.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Workflow Details */}
        {selectedWorkflow && (
          <div>
            <label className="label">Workflow Steps</label>
            <div className="space-y-2">
              {selectedWorkflow.steps?.map((step, index) => (
                <div
                  key={index}
                  className={clsx(
                    'p-3 rounded-lg bg-editor-bg border transition-colors',
                    currentStep === index
                      ? 'border-editor-accent'
                      : 'border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                      currentStep === index
                        ? 'bg-editor-accent text-white'
                        : currentStep > index
                        ? 'bg-green-500 text-white'
                        : 'bg-editor-border text-gray-400'
                    )}>
                      {currentStep > index ? '✓' : index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">
                        {step.step_type.replace('_', ' ')}
                      </p>
                      {step.style_id && (
                        <p className="text-xs text-gray-500">Style: {step.style_id}</p>
                      )}
                      {step.parameters && Object.keys(step.parameters).length > 0 && (
                        <p className="text-xs text-gray-500">
                          {Object.entries(step.parameters)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                    {currentStep === index && isRunning && (
                      <div className="spinner w-4 h-4" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example Workflows */}
        <div className="bg-editor-bg/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Example Workflow: Pet Pirate</p>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Upload a pet photo</li>
            <li>Segment the pet from background</li>
            <li>Transform to pirate costume</li>
            <li>Add dramatic background</li>
          </ol>
        </div>

        {/* Tips */}
        <div className="bg-editor-bg/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Tips:</p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Select a layer before running</li>
            <li>Each step creates a new layer</li>
            <li>You can edit intermediate results</li>
          </ul>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-editor-border">
        <button
          onClick={handleRunWorkflow}
          disabled={!selectedWorkflow || !activeLayer?.image_base64 || isRunning}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <div className="spinner w-4 h-4" />
              Running Step {currentStep + 1}...
            </>
          ) : (
            <>
              <Play size={18} />
              Run Workflow
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default WorkflowPanel;
