import type { ComponentProps, ReactNode } from 'react';

export function SceneEditorFrame(props: ComponentProps<'section'>) {
    return (
        <section
            className="scene-editor m-0 min-h-[100dvh] bg-surface p-0 [--control-height:40px] [--text-md:0.8125rem] [--text-sm:0.8125rem] [--text-xs:0.75rem] [&_[data-slot=select-trigger]]:m-0 [&_audio]:my-3 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-105 [&_input:not([type=checkbox])]:m-0 [&_label]:m-0 [&_textarea]:m-0 [.scene-editor_&_.button]:min-h-10 [.scene-editor_&_.button]:w-auto [.scene-editor_&_.button]:px-[13px] [.scene-editor_&_.button]:py-[9px] [.scene-editor_&_.button]:text-[length:13px]"
            {...props}
        />
    );
}

export function SceneEditorHeader({ children }: { children: ReactNode }) {
    return (
        <header className="scene-heading editor-header grid h-16 min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-border border-b bg-surface px-5 py-0">
            {children}
        </header>
    );
}

export function ScenePageDock({ children }: { children: ReactNode }) {
    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--canvas-hints-height,2.5rem)_+_16px)] z-5 grid [grid-template-columns:inherit] [.scene-editor[data-panel=interactions]_&]:hidden [.scene-editor[data-panel=preview]_&]:hidden"
            data-page-dock
        >
            <div className="col-start-1 flex min-w-0 -translate-x-[calc(var(--inspector-offset)/2)] justify-center px-4 transition-[translate] duration-200 ease-out motion-reduce:transition-none [.scene-editor[data-panel=preview]_&]:translate-x-0">
                {children}
            </div>
        </div>
    );
}
