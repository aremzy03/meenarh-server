const blogService = require('../services/blog.service');

async function createPost(req, res, next) {
  try {
    const { title, content, cover_image_url, status } = req.body;
    const author_id = req.user.id;

    const post = await blogService.createPost({ title, content, cover_image_url, status, author_id });

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

async function getAllPosts(_req, res, next) {
  try {
    const posts = await blogService.getAllPosts();
    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    const post = await blogService.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const updated = await blogService.updatePost(req.params.id, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const post = await blogService.getPostById(req.params.id);
    res.json({ success: true, message: 'Post updated successfully', data: post });
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const deleted = await blogService.deletePost(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function getPublishedPosts(_req, res, next) {
  try {
    const posts = await blogService.getPublishedPosts();
    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
}

async function getPublishedPostBySlug(req, res, next) {
  try {
    const post = await blogService.getPublishedPostBySlug(req.params.slug);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPost, getAllPosts, getPostById, updatePost, deletePost, getPublishedPosts, getPublishedPostBySlug };
