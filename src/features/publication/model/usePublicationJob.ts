import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import type { JobStatus } from '../../../shared/contracts/enums.schema';
import { auth } from '../../auth';
import { pagesApi } from '../../pages';
import {
    existingJob,
    jobOutcome,
    type Outcome,
    readTask,
    storeTask,
    type Task,
    taskKey,
    uncertainRequest,
} from './job';

const statusLabels: Record<JobStatus, string> = {
    QUEUED: 'Đang chờ xử lý',
    RUNNING: 'Đang xử lý',
    SUCCEEDED: 'Hoàn tất',
    FAILED: 'Thất bại',
};

export function usePublicationJob(userId: string, bookId: string, onComplete: () => void) {
    const key = taskKey(userId, bookId);
    const [task, setTask] = useState<Task | null>(() => readTask(key));
    const [paused, setPaused] = useState(false),
        [done, setDone] = useState(false);
    const [posting, setPosting] = useState(false),
        [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null),
        [outcome, setOutcome] = useState<Outcome | null>(null);
    const alive = useRef(true),
        lock = useRef(false),
        completed = useRef(onComplete);
    completed.current = onComplete;
    const session = useCallback(
        () => alive.current && auth.store.getState().user?.id === userId,
        [userId],
    );
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    function remember(value: Task | null) {
        storeTask(key, value);
        setTask(value);
    }
    useEffect(() => {
        if (!task?.jobId || paused || done) return;
        const abort = new AbortController();
        const began = Date.now();
        let timer: ReturnType<typeof setTimeout>;
        async function poll() {
            try {
                const job = await pagesApi.job(task?.jobId || '', abort.signal);
                if (abort.signal.aborted || !session() || !task) return;
                const result = jobOutcome(task, bookId, job);
                setMessage(
                    `${task.type === 'PUBLISH_BOOK' ? 'Xuất bản' : 'Xuất PDF'}: ${job.progress}% · ${statusLabels[job.status]}`,
                );
                if (job.status === 'FAILED') {
                    setError(
                        job.error?.message ||
                            'Tác vụ thất bại. Kiểm tra dữ liệu trước khi gửi yêu cầu mới.',
                    );
                    setDone(true);
                    storeTask(key, null);
                    completed.current();
                    return;
                }
                if (result) {
                    setOutcome(result);
                    setDone(true);
                    storeTask(key, null);
                    completed.current();
                    return;
                }
                if (Date.now() - began > 120_000) {
                    setPaused(true);
                    setError('Tác vụ chưa hoàn tất. Tiếp tục kiểm tra tác vụ hiện tại.');
                    return;
                }
                timer = setTimeout(() => {
                    void poll();
                }, 1500);
            } catch (cause) {
                if (!abort.signal.aborted && session()) {
                    setPaused(true);
                    setError(errorMessage(cause));
                }
            }
        }
        void poll();
        return () => {
            abort.abort();
            clearTimeout(timer);
        };
    }, [task, paused, done, bookId, key, session]);
    async function start(
        type: Task['type'],
        versionNo: number | null,
        send: () => Promise<{ jobId: string }>,
    ) {
        if (lock.current || (task && !done)) return;
        lock.current = true;
        setPosting(true);
        setDone(false);
        setPaused(false);
        setError(null);
        setOutcome(null);
        // Persist before sending: a lost response/reload must not silently replay the mutation.
        const pending = { type, versionNo, jobId: null };
        remember(pending);
        setMessage('Đang gửi yêu cầu…');
        try {
            const result = await send();
            if (session()) remember({ ...pending, jobId: result.jobId });
        } catch (cause) {
            if (!session()) return;
            const id = existingJob(cause);
            if (id) remember({ ...pending, jobId: id, versionNo: null });
            else {
                if (!uncertainRequest(cause)) remember(null);
                setError(errorMessage(cause));
                setMessage('');
            }
        } finally {
            lock.current = false;
            if (session()) setPosting(false);
        }
    }
    return {
        task,
        posting,
        busy: posting || Boolean(task && !done),
        paused,
        done,
        message,
        error,
        outcome,
        start,
        resume() {
            setError(null);
            setPaused(false);
        },
        release() {
            if (!posting) {
                remember(null);
                setDone(false);
                setError(null);
                setMessage('');
            }
        },
    };
}
