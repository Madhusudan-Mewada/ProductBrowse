import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// ─── GET /api/products ────────────────────────────────────────────────────────
// Query params:
//   limit    - number of products per page (default 20, max 100)
//   cursor   - opaque string from previous response (for next page)
//   category - filter by category name (optional)
//
// HOW CURSOR WORKS:
//   cursor encodes the last seen product's (created_at, id).
//   We fetch products strictly older than that point → no duplicates,
//   no skipped rows, even if new products are inserted between pages.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = req.query.category as string | undefined;
    const cursorParam = req.query.cursor as string | undefined;

    // Decode cursor → { createdAt, id }
    let cursorCreatedAt: string | null = null;
    let cursorId: number | null = null;

    if (cursorParam) {
      try {
        const decoded = Buffer.from(cursorParam, 'base64').toString('utf8');
        const parts = decoded.split('__');
        if (parts.length === 2) {
          cursorCreatedAt = parts[0];
          cursorId = parseInt(parts[1]);
        }
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    // Build query dynamically
    // We ORDER BY created_at DESC, id DESC so ties in timestamp are broken by id.
    // Cursor condition: go past the last seen (created_at, id) pair.
    const params: (string | number)[] = [];
    let paramIndex = 1;

    let whereClause = '';
    const conditions: string[] = [];

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (cursorCreatedAt && cursorId !== null) {
      // Products that come AFTER (older than) the cursor in our DESC sort.
      // Tie-break on id: same timestamp but lower id comes later in DESC order.
      conditions.push(
        `(created_at < $${paramIndex} OR (created_at = $${paramIndex} AND id < $${paramIndex + 1}))`
      );
      params.push(cursorCreatedAt);
      params.push(cursorId);
      paramIndex += 2;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    params.push(limit + 1); // fetch one extra to know if there's a next page
    const limitParam = paramIndex;

    const query = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParam}
    `;

    const result = await pool.query(query, params);
    const rows = result.rows;

    const hasNextPage = rows.length > limit;
    const products = hasNextPage ? rows.slice(0, limit) : rows;

    // Encode cursor from last product
    let nextCursor: string | null = null;
    if (hasNextPage && products.length > 0) {
      const last = products[products.length - 1];
      const raw = `${last.created_at.toISOString()}__${last.id}`;
      nextCursor = Buffer.from(raw).toString('base64');
    }

    return res.json({
      products,
      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/products/categories ────────────────────────────────────────────
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM products ORDER BY category'
    );
    return res.json({ categories: result.rows.map((r) => r.category) });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;