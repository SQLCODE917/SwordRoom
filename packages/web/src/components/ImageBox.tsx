interface ImageBoxProps {
  imageUrl: string | null;
  placeholder: string;
}

export function ImageBox({ imageUrl, placeholder }: ImageBoxProps) {
  return (
    <div className="c-imgbox">
      <div className="c-imgbox__frame">
        {imageUrl ? (
          <img className="c-imgbox__img" src={imageUrl} alt="Character portrait preview" />
        ) : (
          <div className="c-imgbox__placeholder t-small">{placeholder}</div>
        )}
      </div>
      <div className="c-imgbox__actions">
        <button className="c-btn is-disabled" type="button" disabled>
          Upload (Later Ticket)
        </button>
      </div>
      <div className="c-imgbox__err t-small"> </div>
    </div>
  );
}
