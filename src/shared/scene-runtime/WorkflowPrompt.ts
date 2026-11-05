import type { WorkflowQuestion } from '../contracts/scene.schema';

/** Screen-space question shared by AR, reading mode and Studio preview. */
export function askWorkflowQuestion(
    question: WorkflowQuestion,
    signal: AbortSignal,
): Promise<string | null> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.dataset.workflowQuestion = '';
        dialog.className =
            'm-auto max-h-[calc(100dvh-2rem)] w-[min(480px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg outline-none open:flex open:flex-col backdrop:bg-black/50';
        dialog.setAttribute('aria-label', 'Câu hỏi tương tác');
        const header = document.createElement('header');
        header.className = 'flex shrink-0 items-start gap-3 p-5';
        const content = document.createElement('div');
        content.className = 'min-w-0 flex-1';
        const title = document.createElement('h2');
        title.textContent = question.title;
        title.tabIndex = -1;
        title.className = 'm-0 wrap-anywhere text-lg font-semibold leading-7 outline-none';
        const hint = document.createElement('p');
        hint.textContent = 'Chạm một đáp án để trả lời.';
        hint.className = 'm-0 mt-2 text-sm leading-5 text-muted-foreground';
        content.append(title, hint);
        const close = document.createElement('button');
        close.type = 'button';
        close.setAttribute('aria-label', 'Đóng câu hỏi');
        close.className =
            'm-0 inline-flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-1.5 text-foreground transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.75');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('size-5');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
        svg.append(path);
        close.append(svg);
        header.append(content, close);
        const choiceArea = document.createElement('div');
        choiceArea.dataset.questionChoices = '';
        choiceArea.className = 'min-h-0 overflow-y-auto overscroll-contain';
        const choices = document.createElement('fieldset');
        choices.className = 'm-0 flex min-w-0 flex-col gap-2 border-0 px-5 pt-0 pb-5';
        const legend = document.createElement('legend');
        legend.textContent = 'Chọn một đáp án';
        legend.className = 'sr-only';
        choices.append(legend);
        choiceArea.append(choices);
        const footer = document.createElement('footer');
        footer.hidden = true;
        footer.className = 'flex shrink-0 items-center gap-4 border-t border-border p-5 pt-4';
        const feedback = document.createElement('div');
        feedback.setAttribute('role', 'status');
        feedback.tabIndex = -1;
        feedback.className = 'min-w-0 flex-1 outline-none';
        const feedbackTitle = document.createElement('p');
        feedbackTitle.className = 'm-0 text-sm font-semibold leading-6';
        const feedbackHint = document.createElement('p');
        feedbackHint.textContent = 'Đóng để tiếp tục trải nghiệm.';
        feedbackHint.className = 'm-0 mt-1 text-sm leading-5 text-muted-foreground';
        feedback.append(feedbackTitle, feedbackHint);
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = 'Đóng';
        dismiss.className =
            'm-0 inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
        footer.append(feedback, dismiss);
        let selectedChoice: string | null = null;
        let settled = false;
        const finish = (value: string | null, aborted = false) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            dialog.close();
            dialog.remove();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
                previousFocus.focus({ preventScroll: true });
            if (aborted) reject(signal.reason);
            else resolve(value);
        };
        const abort = () => finish(null, true);
        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.questionChoice = choice.id;
            button.setAttribute('aria-label', choice.text);
            button.className =
                'm-0 flex min-h-14 w-full shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left font-normal text-foreground transition-colors hover:not-disabled:border-primary hover:not-disabled:bg-primary hover:not-disabled:text-primary-foreground disabled:cursor-default disabled:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
            const marker = document.createElement('span');
            marker.setAttribute('aria-hidden', 'true');
            marker.textContent = String.fromCharCode(65 + index);
            marker.className =
                'm-0 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-current font-medium text-xs';
            const text = document.createElement('span');
            text.textContent = choice.text;
            text.className = 'min-w-0 flex-1 wrap-anywhere font-normal text-sm leading-6';
            button.append(marker, text);
            button.onclick = () => {
                if (settled || selectedChoice !== null) return;
                selectedChoice = choice.id;
                const correct = choice.id === question.correctChoiceId;
                choices.querySelectorAll<HTMLButtonElement>('button').forEach((option) => {
                    option.disabled = true;
                    const isCorrect = option.dataset.questionChoice === question.correctChoiceId;
                    const isSelected = option.dataset.questionChoice === selectedChoice;
                    option.dataset.questionSelected = String(isSelected);
                    if (isCorrect || isSelected) {
                        option.classList.remove('border-border', 'bg-surface', 'text-foreground');
                        option.dataset.questionResult = isCorrect ? 'correct' : 'incorrect';
                        option.className += isCorrect
                            ? ' border-success-foreground bg-success text-success-foreground'
                            : ' border-danger-foreground bg-danger text-danger-foreground';
                        const label = document.createElement('span');
                        label.textContent = isCorrect ? 'Đáp án đúng' : 'Đã chọn';
                        label.className = 'shrink-0 text-xs font-medium';
                        option.append(label);
                    }
                });
                feedback.dataset.questionFeedback = correct ? 'correct' : 'incorrect';
                feedbackTitle.textContent = correct
                    ? 'Bạn đã trả lời đúng.'
                    : 'Bạn đã trả lời sai.';
                feedbackTitle.className += correct
                    ? ' text-success-foreground'
                    : ' text-danger-foreground';
                hint.textContent = 'Xem kết quả bên dưới, rồi đóng để tiếp tục.';
                footer.hidden = false;
                feedback.focus({ preventScroll: true });
            };
            choices.append(button);
        });
        close.onclick = () => finish(selectedChoice);
        dismiss.onclick = () => finish(selectedChoice);
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish(selectedChoice);
        });
        dialog.append(header, choiceArea, footer);
        document.body.append(dialog);
        signal.addEventListener('abort', abort, { once: true });
        dialog.showModal();
        title.focus({ preventScroll: true });
    });
}
