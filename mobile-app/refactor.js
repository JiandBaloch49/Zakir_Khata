const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'services', 'database');

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.ts')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // 1. Replace user_id
    content = content.replace(
      /WHERE \((user_id) = \? OR (user_id) IN \(SELECT id FROM users WHERE parentId = \?\)\)/g,
      'WHERE ($1 = ? OR $1 IN (SELECT id FROM users WHERE parentId = ?) OR $1 IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))'
    );

    // 2. Replace userId
    content = content.replace(
      /WHERE \((userId) = \? OR (userId) IN \(SELECT id FROM users WHERE parentId = \?\)\)/g,
      'WHERE ($1 = ? OR $1 IN (SELECT id FROM users WHERE parentId = ?) OR $1 IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))'
    );

    // 3. Replace b.user_id
    content = content.replace(
      /WHERE \((b\.user_id) = \? OR (b\.user_id) IN \(SELECT id FROM users WHERE parentId = \?\)\)/g,
      'WHERE ($1 = ? OR $1 IN (SELECT id FROM users WHERE parentId = ?) OR $1 IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))'
    );

    // 4. Replace s.user_id
    content = content.replace(
      /WHERE \((s\.user_id) = \? OR (s\.user_id) IN \(SELECT id FROM users WHERE parentId = \?\)\)/g,
      'WHERE ($1 = ? OR $1 IN (SELECT id FROM users WHERE parentId = ?) OR $1 IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))'
    );

    // 5. Replace staff performance u.parentId = ? OR u.id = ?
    content = content.replace(
      /WHERE u\.parentId = \? OR u\.id = \?/g,
      'WHERE u.id = ? OR u.parentId = ? OR u.parentId IN (SELECT id FROM users WHERE parentId = ?)'
    );

    // Now append a third 'userId' to the arrays [userId, userId] -> [userId, userId, userId]
    content = content.replace(/\[userId, userId\]/g, '[userId, userId, userId]');

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', file);
    }
  }
});
