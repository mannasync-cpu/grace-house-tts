declare module 'react-quill-new/dist/quill.snow.css';
declare module 'react-quill-new' {
    import React from 'react';

    interface ReactQuillProps {
        theme?: string;
        value?: string;
        defaultValue?: string;
        onChange?: (value: string) => void;
        modules?: Record<string, unknown>;
        formats?: string[];
        placeholder?: string;
        readOnly?: boolean;
        className?: string;
        style?: React.CSSProperties;
    }

    const ReactQuill: React.FC<ReactQuillProps>;
    export default ReactQuill;
}
