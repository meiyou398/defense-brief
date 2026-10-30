import { validateExternalUrl } from './urls.mjs';

const reservedIDs = new Set(['main', 'source-tiers', 'source-rules']);

// Validate the catalog's rendered fields without changing editorial text or URLs.
export function validateSourceCatalog(catalog, file = 'data/sources.json') {
  const object = (value, path, required) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}：需要对象`);
    for (const key of required) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key}：缺少必填字段`);
  };
  const text = (value, path, allowEmpty = false) => {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`${path}：需要${allowEmpty ? '' : '非空'}文本`);
  };
  const array = (value, path, minimum = 0) => {
    if (!Array.isArray(value) || value.length < minimum) throw new Error(`${path}：需要至少 ${minimum} 项的数组`);
  };
  const tier = (value, path) => {
    if (!Number.isInteger(value) || value < 1 || value > 4) throw new Error(`${path}：需要 1–4 的整数分档`);
  };
  try {
    object(catalog, '$', ['updatedAt', 'intro', 'tiers', 'rules', 'groups']);
    text(catalog.updatedAt, '$.updatedAt');
    const date = new Date(`${catalog.updatedAt}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.updatedAt) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== catalog.updatedAt) {
      throw new Error('$.updatedAt：需要有效的 YYYY-MM-DD 日期');
    }
    text(catalog.intro, '$.intro');
    array(catalog.tiers, '$.tiers', 4);
    if (catalog.tiers.length !== 4) throw new Error('$.tiers：需要四个不同的分档说明');
    const tiers = new Set();
    catalog.tiers.forEach((entry, index) => {
      const path = `$.tiers[${index}]`;
      object(entry, path, ['tier', 'label', 'description']);
      tier(entry.tier, `${path}.tier`);
      if (tiers.has(entry.tier)) throw new Error(`${path}.tier：分档重复`);
      tiers.add(entry.tier);
      text(entry.label, `${path}.label`);
      text(entry.description, `${path}.description`);
    });
    array(catalog.rules, '$.rules');
    catalog.rules.forEach((rule, index) => text(rule, `$.rules[${index}]`));
    array(catalog.groups, '$.groups', 1);
    const IDs = new Set(reservedIDs);
    catalog.groups.forEach((group, index) => {
      const path = `$.groups[${index}]`;
      object(group, path, ['id', 'title', 'sources']);
      text(group.id, `${path}.id`);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(group.id)) throw new Error(`${path}.id：需要字母开头、仅含字母数字、短横线或下划线的锚点`);
      if (IDs.has(group.id)) throw new Error(`${path}.id：锚点重复或与页面固定锚点冲突`);
      IDs.add(group.id);
      text(group.title, `${path}.title`);
      array(group.sources, `${path}.sources`);
      group.sources.forEach((source, sourceIndex) => {
        const sourcePath = `${path}.sources[${sourceIndex}]`;
        object(source, sourcePath, ['name', 'url', 'tier', 'lang', 'description']);
        for (const key of ['name', 'lang', 'description']) text(source[key], `${sourcePath}.${key}`);
        validateExternalUrl(source.url, `${sourcePath}.url`);
        tier(source.tier, `${sourcePath}.tier`);
        if (Object.hasOwn(source, 'note')) text(source.note, `${sourcePath}.note`, true);
      });
    });
  } catch (error) {
    throw new Error(`${file} ${error.message}`, { cause: error });
  }
  return catalog;
}
