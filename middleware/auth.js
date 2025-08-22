import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_insecure_jwt_key_change_me';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success:false, message:'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
}

export function requireRole(role) {
  return function(req, res, next) {
    if (!req.user || req.user.role !== role) return res.status(403).json({ success:false, message:'Forbidden' });
    next();
  }
}
