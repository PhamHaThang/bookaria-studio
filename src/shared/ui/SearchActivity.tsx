import { useEffect, useRef, useState } from 'react';
import { Spinner } from './primitives/spinner';

/** A background poll of the same query is not a new search. */
export function SearchActivity({ query = '', fetching }: { query?: string; fetching: boolean }) {
    const previous = useRef(query);
    const [active, setActive] = useState(query);
    useEffect(() => {
        if (previous.current !== query) {
            previous.current = query;
            setActive(query);
        }
        if (!fetching) setActive('');
    }, [query, fetching]);
    if (!fetching || !query || active !== query) return null;
    return (
        <span role="status" className="my-2 flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner aria-hidden="true" className="size-4" />
            Đang tìm kiếm…
        </span>
    );
}
