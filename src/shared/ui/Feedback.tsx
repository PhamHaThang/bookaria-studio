import { Alert } from './Alert';
export function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
    return (
        <>
            {error && <Alert tone="danger">{error}</Alert>}
            {success && <Alert tone="success">{success}</Alert>}
        </>
    );
}
