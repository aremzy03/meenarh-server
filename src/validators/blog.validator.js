const { z } = require('zod');

const createBlogSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  cover_image_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  status: z.enum(['draft', 'published']).optional(),
});

const updateBlogSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').optional(),
  content: z.string().min(10, 'Content must be at least 10 characters').optional(),
  cover_image_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  status: z.enum(['draft', 'published']).optional(),
});

function validateCreateBlog(req, res, next) {
  const result = createBlogSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0].message,
    });
  }
  req.body = result.data;
  next();
}

function validateUpdateBlog(req, res, next) {
  const result = updateBlogSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0].message,
    });
  }
  req.body = result.data;
  next();
}

module.exports = { validateCreateBlog, validateUpdateBlog };
