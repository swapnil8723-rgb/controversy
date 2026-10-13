// llms.txt: a plain map of the site for AI answer engines, so they can find and cite
// the canonical timeline for each controversy.
import { loadAll, recordUrl, explainerUrl } from '../lib/content';
import { VERTICALS, VERTICAL, STATUS } from '../lib/taxonomy';
import { BRAND, abs } from '../site';

export async function GET() {
  const { records, explainers } = await loadAll();
  const lines = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.description}`,
    '',
    'Every claim on a timeline page cites a source and is labelled as a fact (official, court or on-record source), reported (news reporting), an allegation (attributed), or a response. Status labels: ongoing, in court, resolved, disputed, not enough info.',
    '',
    `- [Editorial policy](${abs('/editorial-policy/')}): sourcing rules, labels and corrections`,
    `- [Latest updates](${abs('/latest/')}): every dated development, newest first`,
    '',
  ];
  for (const v of VERTICALS) {
    lines.push(`## ${VERTICAL[v].label}`, '');
    for (const r of records.filter((x) => x.data.vertical === v)) {
      lines.push(`- [${r.data.title}](${abs(recordUrl(r))}): ${STATUS[r.data.status].label}. ${r.data.summary}`);
    }
    for (const x of explainers.filter((e) => e.data.vertical === v)) {
      lines.push(`- [${x.data.title}](${abs(explainerUrl(x))}): ${x.data.summary}`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
