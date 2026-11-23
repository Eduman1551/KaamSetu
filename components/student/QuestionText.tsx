// Renders question text with ``` fenced code blocks as monospace blocks.
export default function QuestionText({ text, className = '' }: { text: string; className?: string }) {
  const parts: { code: boolean; text: string }[] = [];
  const re = /```[a-zA-Z]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ code: false, text: text.slice(last, m.index) });
    parts.push({ code: true, text: m[1].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) });
  return (
    <div className={className}>
      {parts.map((p, i) =>
        p.code ? (
          <pre key={i} className="my-3 overflow-x-auto rounded-xl border border-ink/10 bg-navy-950 p-3 font-mono text-[13px] leading-relaxed text-ink/90">
            {p.text}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap wrap-any">
            {p.text.trim()}
          </p>
        ),
      )}
    </div>
  );
}

/** Options that look like code are shown in monospace. */
export const looksLikeCode = (s: string) => /[{}();=]|=>|\w\(|\[\w*\]/.test(s) && !/^[A-Z][a-z]+ [a-z]/.test(s);
