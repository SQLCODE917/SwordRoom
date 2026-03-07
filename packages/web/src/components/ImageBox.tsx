import { useRef } from 'react';

interface ImageBoxProps {
  imageUrl: string | null;
  placeholder: string;
  isLoading?: boolean;
  errorMessage?: string;
  onFileSelected?: (file: File) => void;
}

export function ImageBox({ imageUrl, placeholder, isLoading = false, errorMessage = ' ', onFileSelected }: ImageBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootClassName = `c-imgbox ${isLoading ? 'is-loading' : ''} ${errorMessage.trim() ? 'is-error' : ''}`.trim();

  return (
    <div className={rootClassName}>
      <div className="c-imgbox__frame">
        {imageUrl ? (
          <img className="c-imgbox__img" src={imageUrl} alt="Character portrait preview" />
        ) : (
          <div className="c-imgbox__placeholder t-small">{placeholder}</div>
        )}
      </div>
      <div className="c-imgbox__actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !onFileSelected) {
              return;
            }
            onFileSelected(file);
            event.currentTarget.value = '';
          }}
        />
        <button
          className={`c-btn ${isLoading ? 'is-disabled' : ''}`.trim()}
          type="button"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
        >
          {isLoading ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      <div className="c-imgbox__err t-small">{errorMessage || ' '}</div>
    </div>
  );
}
