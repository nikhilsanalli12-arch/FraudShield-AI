export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to role verification.',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. This endpoint requires one of the following roles: [${allowedRoles.join(', ')}]. Your active role is '${userRole}'.`,
        requiredRoles: allowedRoles,
        currentRole: userRole,
      });
    }

    next();
  };
}

