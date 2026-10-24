import './bookaria-logo.css';

export function BookariaLogo({ symbol = false }: { symbol?: boolean }) {
    return (
        <img
            className={symbol ? 'bookaria-logo bookaria-logo-symbol' : 'bookaria-logo'}
            src={symbol ? '/brand/bookaria-symbol.svg' : '/brand/bookaria-wordmark.svg'}
            alt="Bookaria"
            width={symbol ? 36 : 176}
            height={symbol ? 18 : 26}
            decoding="async"
        />
    );
}
