export function notFound(req, res, next) {
  res.status(404);
  res.json({ message: `Not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Zod-style errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      message: 'Validation error',
      issues: err.issues,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      details: err.message,
    });
  }

  res.status(status);
  res.json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : null),
  });
}

