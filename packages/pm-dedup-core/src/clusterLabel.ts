const leadingPrefixes = (member: string): string[] => {
  const scopeEnd = member.startsWith("@") ? member.indexOf("/") : -1;
  const scope = scopeEnd === -1 ? null : member.slice(0, scopeEnd);
  const rest = scope === null ? member : member.slice(scopeEnd + 1);

  const segments = rest.split("-");
  const withinRest = segments.map((_segment, index) => {
    const joined = segments.slice(0, index + 1).join("-");
    return scope === null ? joined : `${scope}/${joined}`;
  });

  return scope === null ? withinRest : [scope, ...withinRest];
};

const covers = (prefix: string, member: string): boolean =>
  member === prefix ||
  member.startsWith(`${prefix}-`) ||
  member.startsWith(`${prefix}/`);

interface PrefixGroup {
  prefix: string;
  covered: string[];
}

/**
 * The prefix shared by the most members. Ties go to the longest prefix, so a
 * family named after a scope wins over the bare package name it also matches.
 */
const bestGroup = (members: string[]): PrefixGroup | null => {
  const candidates = [...new Set(members.flatMap(leadingPrefixes))];

  let best: PrefixGroup | null = null;
  for (const prefix of candidates.toSorted((a, b) => a.localeCompare(b))) {
    const covered = members.filter((member) => covers(prefix, member));
    if (
      best === null ||
      covered.length > best.covered.length ||
      (covered.length === best.covered.length &&
        prefix.length > best.prefix.length)
    ) {
      best = { prefix, covered };
    }
  }
  return best;
};

const formatGroup = ({ prefix, covered }: PrefixGroup): string => {
  if (covered.length === 1 && covered[0] === prefix) return prefix;
  if (prefix.startsWith("@") && !prefix.includes("/")) return `${prefix}/*`;
  return covered.includes(prefix) ? `${prefix}*` : `${prefix}-*`;
};

/**
 * A readable identity for a lockstep cluster, derived from the prefixes its
 * members share: `@typescript-eslint/* (+1 more)`, `metro* + @react-native/*`.
 * A second group is only worth naming when it covers more than one member;
 * anything left over is counted, never guessed at.
 */
export const clusterLabel = (members: string[]): string => {
  const first = bestGroup(members);
  if (first === null) return "";

  const groups = [first];
  const remaining = members.filter((member) => !covers(first.prefix, member));

  const second = remaining.length > 0 ? bestGroup(remaining) : null;
  if (second !== null && second.covered.length > 1) groups.push(second);

  const uncovered = members.filter(
    (member) => !groups.some((group) => covers(group.prefix, member)),
  ).length;

  const label = groups.map(formatGroup).join(" + ");
  return uncovered === 0 ? label : `${label} (+${uncovered} more)`;
};
