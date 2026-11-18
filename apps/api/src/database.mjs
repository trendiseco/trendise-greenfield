import {policyDocument,policyEffectiveDate,policyRulesVersion} from '../../../shared/order-policy.mjs';
import pg from 'pg';
import {upgradeSizeChart} from '../../../shared/size-chart.mjs';
import {websiteState} from './website.mjs';
import {isDeepStrictEqual} from 'node:util';
import { readFile } from 'node:fs/promises';
import { Commerce } from './core.mjs';
import {rebuildProjections} from './database-projections.mjs';
const maps=['reservations','orders','sales','sessions','otpRequests','eventIds'];
const fields=['products','locations','stock','ledger','audit','drafts','approvals','roles','users','website','additionalCategories','hiddenCategories','posPromotions','posTerms','policy','version','policyHistory'];
const projectionKeys=[...fields.filter(key=>!['additionalCategories','hiddenCategories','posPromotions','posTerms','policy','version','policyHistory'].includes(key)),...maps.filter(key=>!['sessions','otpRequests'].includes(key))];
export function snapshot(commerce) {
  return Object.fromEntries([
    ...fields.map(key => [key, commerce[key]]),
    ...maps.map(key => [key, [...commerce[key]]]),
  ]);
}

export function restore(commerce, data) {
  for (const key of fields) {
    if (data[key] !== undefined) commerce[key] = data[key];
  }
  commerce.additionalCategories = data.additionalCategories ?? [];
  commerce.hiddenCategories = data.hiddenCategories ?? [];
  commerce.posPromotions = data.posPromotions ?? {};
  commerce.posTerms = data.posTerms ?? null;
  commerce.policyHistory = {...(data.policyHistory || {})};
  commerce.policyHistory[commerce.version] ??= policyDocument(commerce.policy);

  if (commerce.policy.rulesVersion !== policyRulesVersion) {
    commerce.version += '-R' + policyRulesVersion;
    commerce.policy = {
      ...commerce.policy,
      version: commerce.version,
      rulesVersion: policyRulesVersion,
      effectiveDate: policyEffectiveDate,
    };
    delete commerce.policy.sections;
  }
  commerce.policyHistory[commerce.version] ??= policyDocument(commerce.policy);
  commerce.website = data.website || websiteState();
  commerce.products = commerce.products.map(upgradeSizeChart);
  for (const draft of Object.values(commerce.drafts)) {
    draft.product = upgradeSizeChart(draft.product);
  }
  for (const key of maps) commerce[key] = new Map(data[key]);
}

export function poolFor(url = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error('DATABASE_URL required. Run npm run db:migrate and db:seed. Memory mode requires explicit ALLOW_MEMORY=true.');
  }
  return new pg.Pool({connectionString: url, max: 5});
}

export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(8291042)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const version of ['001_m02', '002_website']) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
      if (applied.rowCount) continue;

      const migration = await readFile(new URL('../migrations/' + version + '.sql', import.meta.url), 'utf8');
      await client.query(migration);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const commerce = new Commerce();
    const inserted = await client.query(
      'INSERT INTO commerce_state(id,payload) VALUES(1,$1) ON CONFLICT DO NOTHING RETURNING id',
      [snapshot(commerce)]
    );
    if (inserted.rowCount) await rebuildProjections(client, commerce);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class DurableCommerce extends Commerce {
  constructor(pool) {
    super();
    this.pool = pool;
    this.requestQueue = Promise.resolve();
  }

  async unit(fn, {readOnly = false} = {}) {
    const previousRequest = this.requestQueue;
    let releaseRequest;
    this.requestQueue = new Promise(resolve => { releaseRequest = resolve; });
    await previousRequest;

    let client;
    let previousState;
    try {
      client = await this.pool.connect();
      await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
      const lock = readOnly ? '' : ' FOR UPDATE';
      const result = await client.query('SELECT payload FROM commerce_state WHERE id=1' + lock);
      if (!result.rowCount) throw new Error('Run db:seed before starting API');

      restore(this, result.rows[0].payload);
      if (!readOnly) previousState = structuredClone(snapshot(this));

      const value = await fn();
      if (!readOnly) {
        const nextState = snapshot(this);
        const projectionsChanged = projectionKeys.some(key => !isDeepStrictEqual(previousState[key], nextState[key]));
        if (projectionsChanged) await rebuildProjections(client, this);
        if (!isDeepStrictEqual(previousState, nextState)) {
          await client.query('UPDATE commerce_state SET payload=$1,updated_at=now() WHERE id=1', [nextState]);
        }
      }

      await client.query('COMMIT');
      return value;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      if (previousState) restore(this, previousState);
      throw error;
    } finally {
      client?.release();
      releaseRequest();
    }
  }
}
