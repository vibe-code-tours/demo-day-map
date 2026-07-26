// Minimal flat-YAML reader — zero dependencies.
// Supports exactly what teams/team-NN.yaml needs: `key: value` lines,
// `#` comments, blank values, and optionally quoted strings.
// Anything nested (lists, maps) is out of scope and throws, so a bad edit
// fails loudly at generate time instead of silently producing an empty booth.

const QUOTED = /^(['"])(.*)\1$/;

export function parseFlatYaml(src, label = "<yaml>") {
  const out = {};
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) return;
    if (/^\s/.test(line)) {
      throw new Error(`${label}:${i + 1}: indented line — only flat "key: value" is supported`);
    }
    const at = line.indexOf(":");
    if (at < 1) throw new Error(`${label}:${i + 1}: expected "key: value", got ${JSON.stringify(raw)}`);
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value === "-" || value.startsWith("- ")) {
      throw new Error(`${label}:${i + 1}: lists are not supported in team files`);
    }
    const q = QUOTED.exec(value);
    if (q) value = q[2];
    out[key] = value === "" ? null : /^-?\d+$/.test(value) ? Number(value) : value;
  });
  return out;
}
