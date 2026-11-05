import { Redo2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/primitives/button';
import type {
    HistoryChange,
    HistoryFeedback,
    HistoryTarget,
} from '../../book-draft/model/history-description';

export function notifyHistoryFeedback(
    feedback: HistoryFeedback | null,
    viewingInteractions: boolean,
    onView: (target: HistoryTarget) => void,
) {
    if (feedback?.scope !== 'interaction' || viewingInteractions) return;
    const target = feedback.target;
    toast.success(feedback.message, {
        id: 'scene-history-feedback',
        duration: 6500,
        action: target ? { label: 'Xem luồng', onClick: () => onView(target) } : undefined,
    });
}
export function SceneHistoryControls({
    undoChange,
    redoChange,
    canUndo,
    canRedo,
    disabled,
    onUndo,
    onRedo,
}: {
    undoChange: HistoryChange | null;
    redoChange: HistoryChange | null;
    canUndo: boolean;
    canRedo: boolean;
    disabled: boolean;
    onUndo: () => void;
    onRedo: () => void;
}) {
    const undoLabel = undoChange ? `Hoàn tác: ${undoChange.label} (Ctrl Z)` : 'Hoàn tác (Ctrl Z)';
    const redoLabel = redoChange
        ? `Làm lại: ${redoChange.label} (Ctrl Shift Z)`
        : 'Làm lại (Ctrl Shift Z)';
    return (
        <>
            <Button
                variant="ghost"
                size="icon-sm"
                data-testid="scene-history-undo"
                aria-label={undoLabel}
                title={undoLabel}
                disabled={disabled || !canUndo}
                onClick={onUndo}
            >
                <Undo2 />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                data-testid="scene-history-redo"
                aria-label={redoLabel}
                title={redoLabel}
                disabled={disabled || !canRedo}
                onClick={onRedo}
            >
                <Redo2 />
            </Button>
        </>
    );
}
