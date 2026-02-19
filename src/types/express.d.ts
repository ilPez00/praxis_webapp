// Extend Express Request to carry the authenticated user's ID set by authenticateToken middleware
declare namespace Express {
  interface Request {
    user?: {
      id: string;
    };
  }
}
