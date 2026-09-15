const ESTADOS = {
  pendiente:   { clase: 'insignia--pendiente',  texto: 'Pendiente' },
  aprobado:    { clase: 'insignia--aprobado',   texto: 'Aprobado' },
  desaprobado: { clase: 'insignia--rechazado',  texto: 'Rechazado' },
};

/* Los badges de estado documental se redefinían en cada módulo, con hex
   sueltos que ya no coincidían entre sí (#E65100 aquí, ámbar allá). */
export default function Insignia({ estado, tono, children, punto = true }) {
  const meta = estado ? ESTADOS[estado] : null;
  const clase = meta?.clase || (tono ? `insignia--${tono}` : 'insignia--neutro');
  return (
    <span className={`insignia ${clase}${punto ? '' : ' insignia--sin-punto'}`}>
      {children || meta?.texto || estado}
    </span>
  );
}

/** Etiqueta corta de formato de archivo (PDF / XLS / DOC). */
export function Formato({ mime }) {
  const m = mime || '';
  const tipo = m.includes('pdf') ? 'pdf'
    : m.includes('sheet') || m.includes('excel') ? 'xls'
    : m.includes('word') || m.includes('document') ? 'doc'
    : 'otro';
  return <span className={`formato formato--${tipo}`}>{tipo === 'otro' ? 'ARCH' : tipo.toUpperCase()}</span>;
}
