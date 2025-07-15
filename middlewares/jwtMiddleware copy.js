import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
dotenv.config();

const jwtAuth = (roles = []) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            req.user = decoded;
          
            
            next();
        } catch (err) {
            res.status(401).json({ message: 'Invalid token' });
        }
    };
};

export default jwtAuth;
