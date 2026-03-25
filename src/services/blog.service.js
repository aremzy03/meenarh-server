const pool = require('../config/db');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function createPost({ title, content, cover_image_url, status, author_id }) {
  let slug = slugify(title);

  // Ensure unique slug
  const [existing] = await pool.execute('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
  if (existing.length > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  const publishedAt = status === 'published' ? new Date() : null;

  const [result] = await pool.execute(
    `INSERT INTO blog_posts (title, slug, content, cover_image_url, author_id, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, content, cover_image_url || null, author_id, status || 'draft', publishedAt]
  );

  return { id: result.insertId, slug };
}

async function getAllPosts() {
  const [posts] = await pool.execute(
    `SELECT bp.id, bp.title, bp.slug, bp.cover_image_url, bp.status, bp.published_at, bp.created_at, bp.updated_at,
            u.name as author_name
     FROM blog_posts bp
     LEFT JOIN users u ON bp.author_id = u.id
     ORDER BY bp.created_at DESC`
  );
  return posts;
}

async function getPostById(id) {
  const [posts] = await pool.execute(
    `SELECT bp.*, u.name as author_name
     FROM blog_posts bp
     LEFT JOIN users u ON bp.author_id = u.id
     WHERE bp.id = ?`,
    [id]
  );
  return posts[0] || null;
}

async function getPublishedPosts() {
  const [posts] = await pool.execute(
    `SELECT bp.id, bp.title, bp.slug, bp.cover_image_url, bp.published_at, bp.created_at,
            u.name as author_name
     FROM blog_posts bp
     LEFT JOIN users u ON bp.author_id = u.id
     WHERE bp.status = 'published'
     ORDER BY bp.published_at DESC`
  );
  return posts;
}

async function getPublishedPostBySlug(slug) {
  const [posts] = await pool.execute(
    `SELECT bp.*, u.name as author_name
     FROM blog_posts bp
     LEFT JOIN users u ON bp.author_id = u.id
     WHERE bp.slug = ? AND bp.status = 'published'`,
    [slug]
  );
  return posts[0] || null;
}

async function updatePost(id, { title, content, cover_image_url, status }) {
  const fields = [];
  const values = [];

  if (title !== undefined) {
    fields.push('title = ?');
    values.push(title);
  }
  if (content !== undefined) {
    fields.push('content = ?');
    values.push(content);
  }
  if (cover_image_url !== undefined) {
    fields.push('cover_image_url = ?');
    values.push(cover_image_url);
  }
  if (status !== undefined) {
    fields.push('status = ?');
    values.push(status);
    if (status === 'published') {
      fields.push('published_at = COALESCE(published_at, NOW())');
    }
  }

  if (fields.length === 0) return false;

  values.push(id);
  await pool.execute(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

async function deletePost(id) {
  const [result] = await pool.execute('DELETE FROM blog_posts WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { createPost, getAllPosts, getPostById, getPublishedPosts, getPublishedPostBySlug, updatePost, deletePost };
