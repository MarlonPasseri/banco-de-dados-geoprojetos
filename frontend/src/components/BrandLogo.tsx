type GeoProjetosMarkProps = {
  className?: string;
  title?: string;
};

type GeoProjetosSignatureProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  showBadge?: boolean;
  showTagline?: boolean;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function GeoProjetosMark({ className, title }: GeoProjetosMarkProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M64 8 80 24H104V48L120 64 104 80V104H80L64 120 48 104H24V80L8 64 24 48V24H48ZM64 18 52 30H32V50L20 64 32 78V98H52L64 110 76 98H96V78L108 64 96 50V30H76ZM64 40 72 52 86 56 76 64 86 72 72 76 64 88 56 76 42 72 52 64 42 56 56 52Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GeoProjetosSignature({
  className,
  compact = false,
  inverse = false,
  showBadge = false,
  showTagline = true,
}: GeoProjetosSignatureProps) {
  return (
    <div className={joinClasses("gp-brand", compact && "gp-brand-compact", inverse && "gp-brand-inverse", className)}>
      <div className="gp-brand-mark-shell" aria-hidden="true">
        <GeoProjetosMark className="gp-brand-mark" />
      </div>

      <div className="gp-brand-copy">
        <div className="gp-brand-name-row">
          <span className="gp-brand-name">Geoprojetos</span>
          <span className="gp-brand-legal">engenharia ltda.</span>
        </div>

        {showTagline ? <div className="gp-brand-tag">Excelencia e qualidade desde 1985</div> : null}
      </div>

      {showBadge ? (
        <div className="gp-brand-anniversary" aria-label="40 anos">
          <strong>40</strong>
          <span>anos</span>
        </div>
      ) : null}
    </div>
  );
}
