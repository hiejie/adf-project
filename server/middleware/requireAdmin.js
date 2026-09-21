function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
    return;
  }

  if (req.originalUrl.startsWith("/admin/api")) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  res.redirect("/admin/login");
}

module.exports = requireAdmin;
