import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const jwtAuth = (roles = []) => {
  return (req, res, next) => {
    // Read token from httpOnly cookie
    const token = req.cookies.GDS_Token;
console.log();

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Role-based access check
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: Role not authorized' });
      }

      req.user = decoded; // Attach user info to request
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};

export default jwtAuth;
