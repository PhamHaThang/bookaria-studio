export function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
    return (
        <>
            {error && (
                <p className="feedback error" role="alert">
                    {error}
                </p>
            )}
            {success && (
                <p className="feedback success" role="status">
                    {success}
                </p>
            )}
        </>
    );
}
