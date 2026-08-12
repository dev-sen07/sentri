const fs = require('fs'); const html = fs.readFileSync('error.html', 'utf8'); console.log(html.substring(0,2000).replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim());
