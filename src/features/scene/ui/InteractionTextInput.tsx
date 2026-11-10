import { BufferedInput } from '@/shared/ui/BufferedTextInput';

export function InteractionTextInput(props: {
    value: string;
    disabled: boolean;
    onValueChange: (value: string) => void;
}) {
    return <BufferedInput aria-label="Giá trị ghi nhớ" maxLength={500} {...props} />;
}
