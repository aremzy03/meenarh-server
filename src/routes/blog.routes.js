const { Router } = require('express');
const blogController = require('../controllers/blog.controller');
const { validateCreateBlog, validateUpdateBlog } = require('../validators/blog.validator');

// Public routes (mounted at /api/blog)
const publicRouter = Router();
publicRouter.get('/', blogController.getPublishedPosts);
publicRouter.get('/:slug', blogController.getPublishedPostBySlug);

// Admin routes (mounted under /api/admin/blog, auth applied by parent)
const adminRouter = Router();
adminRouter.post('/', validateCreateBlog, blogController.createPost);
adminRouter.get('/', blogController.getAllPosts);
adminRouter.get('/:id', blogController.getPostById);
adminRouter.put('/:id', validateUpdateBlog, blogController.updatePost);
adminRouter.delete('/:id', blogController.deletePost);

module.exports = { publicRouter, adminRouter };
