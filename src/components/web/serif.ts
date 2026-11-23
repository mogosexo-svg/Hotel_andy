// Titulares: cada palabra va en su propio span para animarla al entrar. *cursiva* marca el énfasis.
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
export function titulo(texto: string): string {
  let i = 0;
  return texto
    .split(/(\*[^*]+\*)/)
    .flatMap((parte) => {
      const cursiva = parte.startsWith('*');
      return parte.replace(/\*/g, '').split(/\s+/).filter(Boolean).map((w) => {
        const h = `<span class="w" style="--i:${i++}"><span>${esc(w)}</span></span>`;
        return cursiva ? `<em>${h}</em>` : h;
      });
    })
    .join(' ');
}
