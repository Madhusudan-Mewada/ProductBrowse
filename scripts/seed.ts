/**
 * Seed Script — generates 200,000 products in one SQL statement.
 *
 * WHY ONE QUERY?
 *   Inserting 200k rows one-by-one in a loop = 200k round-trips to DB → very slow.
 *   PostgreSQL's generate_series() lets the DB itself generate all rows internally
 *   in a single INSERT, which is ~100x faster.
 *
 * Run: npm run seed
 */

import pool from '../src/db';
import dotenv from 'dotenv';

dotenv.config();

const CATEGORIES = [
  'Mobile',
  'Laptop',
  'Shoes',
  'Clothing',
  'Books',
  'Home Appliances',
  'Sports',
  'Toys',
  'Furniture',
  'Grocery',
];

async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      price       NUMERIC(10, 2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Index for fast cursor pagination (the core query uses these columns)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_created_at_id
    ON products (created_at DESC, id DESC);
  `);

  // Index for category filter
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category);
  `);

  console.log('✅ Table and indexes created');
}

async function seed() {
  console.log('🌱 Starting seed...');

  // Build the category array as a Postgres literal so SQL can random-pick
  const pgArray =
    'ARRAY[' + CATEGORIES.map((c) => `'${c}'`).join(',') + ']::text[]';

  // One single INSERT — PostgreSQL generates 200k rows internally.
  // generate_series(1, 200000) produces i = 1..200000
  // random() * interval '2 years' spreads created_at over 2 years so pages have varied data
  await pool.query(`
    INSERT INTO products (name, category, price, created_at, updated_at)
    SELECT
      'Product #' || i,
      (${pgArray})[1 + (floor(random() * ${CATEGORIES.length}))::int],
      round((random() * 99900 + 100)::numeric, 2),
      NOW() - (random() * interval '730 days'),
      NOW() - (random() * interval '30 days')
    FROM generate_series(1, 200000) AS i;
  `);

  console.log('✅ 200,000 products inserted!');
}

async function main() {
  try {
    await createTable();

    // Check if already seeded
    const count = await pool.query('SELECT COUNT(*) FROM products');
    const existing = parseInt(count.rows[0].count);

    if (existing > 0) {
      console.log(`⚠️  Table already has ${existing} rows. Skipping seed.`);
      console.log('   To re-seed: DROP TABLE products; then run again.');
    } else {
      await seed();
    }
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();