import { readFileSync } from 'node:fs';

const defaultSchema = JSON.parse(readFileSync(new URL('../data/schema.json', import.meta.url), 'utf8'));

// The supplied schema uses this small, explicit set of JSON Schema keywords.
// Keeping validation here avoids adding a validator to the dependency list.
export function validateIssue(raw, schema = defaultSchema, file = 'issue') {
  function visit(value, rule, path) {
    if (rule.$ref) {
      const resolved = rule.$ref.split('/').slice(1).reduce((s, key) => s[key], schema);
      return visit(value, resolved, path);
    }
    if (rule.oneOf) {
      const valid = rule.oneOf.filter(option => {
        try { visit(value, option, path); return true; } catch { return false; }
      });
      if (valid.length !== 1) throw new Error(`${path}：不符合允许的数据格式`);
      return;
    }
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const matches = rule.type === 'integer' ? Number.isInteger(value) : !rule.type || type === rule.type;
    if (!matches || (type === 'number' && !Number.isFinite(value))) throw new Error(`${path}：需要 ${rule.type}`);
    if (rule.enum && !rule.enum.includes(value)) throw new Error(`${path}：需要 ${rule.enum.join(' / ')}`);
    if (type === 'object') {
      for (const key of rule.required || []) if (!(key in value)) throw new Error(`${path}.${key}：缺少必填字段`);
      for (const [key, child] of Object.entries(value)) {
        if (rule.additionalProperties === false && !Object.hasOwn(rule.properties || {}, key)) throw new Error(`${path}.${key}：未知字段`);
        if (rule.properties?.[key]) visit(child, rule.properties[key], `${path}.${key}`);
      }
    }
    if (type === 'array') {
      if (rule.minItems !== undefined && value.length < rule.minItems) throw new Error(`${path}：至少 ${rule.minItems} 项`);
      if (rule.maxItems !== undefined && value.length > rule.maxItems) throw new Error(`${path}：最多 ${rule.maxItems} 项`);
      value.forEach((child, i) => visit(child, rule.items, `${path}[${i}]`));
    }
    if (type === 'string') {
      if (rule.maxLength !== undefined && [...value].length > rule.maxLength) throw new Error(`${path}：超过 ${rule.maxLength} 字`);
      if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw new Error(`${path}：格式不正确`);
      if (rule.format === 'date-time') {
        const match = value.match(/^(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
        const day = match && new Date(`${match[1]}T00:00:00Z`);
        if (!match || !Number.isFinite(Date.parse(value)) || !Number.isFinite(day.valueOf()) || day.toISOString().slice(0, 10) !== match[1]) throw new Error(`${path}：需要有效且带时区的 ISO 时间`);
      }
      if (rule.format === 'uri') {
        try { new URL(value); } catch { throw new Error(`${path}：需要完整 URL`); }
      }
    }
    if (type === 'number') {
      if (rule.minimum !== undefined && value < rule.minimum) throw new Error(`${path}：不能小于 ${rule.minimum}`);
      if (rule.maximum !== undefined && value > rule.maximum) throw new Error(`${path}：不能大于 ${rule.maximum}`);
    }
  }
  try {
    visit(raw, schema, '$');
    const date = new Date(`${raw.date}T00:00:00Z`);
    if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== raw.date) throw new Error('$.date：无效日期');
    const count = raw.sections.reduce((sum, s) => sum + s.items.length, 0);
    if (!count) throw new Error('$.sections：至少需要一条正文');
    const ref = (n, path) => { if (n > count) throw new Error(`${path}：条目 ${n} 不存在（共 ${count} 条）`); };
    raw.highlights?.forEach((h, i) => ref(h.item, `$.highlights[${i}].item`));
    raw.stats?.forEach((s, i) => ref(s.item, `$.stats[${i}].item`));
    raw.featured?.forEach((n, i) => ref(n, `$.featured[${i}]`));
    raw.sections.forEach((s, i) => s.items.forEach((item, j) => {
      item.related?.forEach((n, k) => ref(n, `$.sections[${i}].items[${j}].related[${k}]`));
      item.links?.forEach((link, k) => {
        if (!/^https?:\/\//i.test(link.url)) throw new Error(`$.sections[${i}].items[${j}].links[${k}].url：来源只允许 http/https`);
      });
    }));
  } catch (error) {
    throw new Error(`${file} ${error.message}`, { cause: error });
  }
  return raw;
}
