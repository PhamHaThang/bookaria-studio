import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useId, useState } from 'react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from './primitives/input-group';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'> & { visibilityLabel?: string };

export function PasswordInput({
    id,
    disabled,
    visibilityLabel = 'mật khẩu',
    className,
    ...props
}: PasswordInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const action = `${visible ? 'Ẩn' : 'Hiện'} ${visibilityLabel}`;
    return (
        <InputGroup className={className}>
            <InputGroupInput
                {...props}
                id={inputId}
                disabled={disabled}
                type={visible ? 'text' : 'password'}
            />
            <InputGroupAddon align="inline-end">
                <InputGroupButton
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={action}
                    title={action}
                    aria-controls={inputId}
                    aria-pressed={visible}
                    onClick={() => setVisible((current) => !current)}
                >
                    {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </InputGroupButton>
            </InputGroupAddon>
        </InputGroup>
    );
}
